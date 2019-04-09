"use strict";

const Util = require('util');

/**
 * Base service that all object CRUD services should inherit
 */
class CrudService {

    /**
     * Constructor
     * @param app
     * @param options
     */
    constructor(app, options) {

        Object.defineProperty(this, 'app', {
            enumerable: false,
            value: app
        });

        // Required settings
        this.service = options.service;
        this.database = options.database || this.service.config.database; // default to the service connection database param, if given
        this.table = options.table;

        // Optional settings
        this.idField = options.idField || 'id';
        this.statusField = options.statusField || 'status';
        this.updatedField = options.updatedField || 'updated';

        /**
         * Base number of times that
         * @type {number}
         * @protected
         */
        this._createRetryCount = options.createRetryCount || 3;

        /**
         * Model keys that can be updated via ._update(model, data)
         * @type {Array}
         * @protected
         */
        this._modifiableKeys = options.modifiableKeys || [];

        /**
         * The status to set models to when "deleted"
         * @type {string}
         * @protected
         */
        this._deletedStatus = options.deletedStatus || 'dead';

        /**
         * Whether to actively prevent dead resources from returning in find and retrieve calls
         * @type {boolean}
         * @private
         */
        this._concealDeadResources = options.concealDeadResources !== undefined ? options.concealDeadResources : true;

        this._retrieve = Util.promisify(this._retrieve.bind(this));
        this._find = Util.promisify(this._find.bind(this));
        this._count = Util.promisify(this._count.bind(this));
        this._update = Util.promisify(this._update.bind(this));
        this._bulkUpdate = Util.promisify(this._bulkUpdate.bind(this));
        this._delete = Util.promisify(this._delete.bind(this));
        this._bulkDelete = Util.promisify(this._bulkDelete.bind(this));
        this._deletePermanently = Util.promisify(this._deletePermanently.bind(this));
        this._bulkDeletePermanently = Util.promisify(this._bulkDeletePermanently.bind(this));
    }

    /**
     * Creates a new model
     * @param {*} data - Record properties
     * @param {*} [options] – Query options
     * @param {function(err:*, data:*?)} [callback]
     * @protected
     */
    _create(data, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        return new Promise((resolve, reject) => {
            const { suppressCollisionError = false, session } = (options || {});

            const args = [];
            const sets = Object.keys(data).map((field) => {
                args.push(data[field]);
                return `\`${this.service.escapeIdentifier(field)}\` = ?`;
            });

            let sql = `INSERT INTO \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\` SET ` + sets.join(', ');

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {

                        if (!suppressCollisionError || err.info.code !== CrudService._collisionErrorCode) {
                            await this.app.report('CrudService: Failed to create record', err, { sql, args, res });
                        }

                        if (callback) return callback(err);
                        return reject(err);
                    }

                    // res -> https://dev.mysql.com/doc/dev/connector-nodejs/8.0/module-Result.html
                    // console.log('getAffectedRowsCount', res.result.getAffectedRowsCount());
                    // console.log('getWarnings', res.result.getWarnings());
                    // console.log('getWarningsCount', res.result.getWarningsCount());
                    // console.log('getGeneratedIds', res.result.getGeneratedIds());
                    // console.log('getAutoIncrementValue', res.result.getAutoIncrementValue());

                    // TODO - think about pulling the last inserted id?
                    if (callback) return callback(null, data);
                    return resolve(data);
                },
                {
                    suppress: suppressCollisionError ? CrudService._collisionErrorCode : null,
                    session
                }
            );

        });
    }

    /**
     * Creates a new record but calls the objectClosure function before each save attempt
     * @param {*} data – Model properties
     * @param {function(data:*,attempt:Number)} objectClosure - Called to obtain the object row properties before save
     * @param {*} [options] – Query options
     * @param {function(err:*, data:*?)} [callback]
     * @protected
     */
    _createWithRetry(data, objectClosure, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = null;
        }
        options = options || {};
        options.suppressCollisionError = true;

        return new Promise(async (resolve, reject) => {
            for (let i = 0; i < this._createRetryCount; i++) {
                let doc;
                try {
                    doc = await this._create(await objectClosure(data, i), options)
                } catch(err) {
                    if (err.info.code === CrudService._collisionErrorCode) {
                        if (this._createRetryCount === (i+1)) {
                            await this.app.report('CrudService: All attempts failed to create record due to collisions!', { err, data, database: this.database, table: this.table });
                            if (callback) return callback(err);
                            return reject(err);
                        } else {
                            continue; // next try
                        }
                    } else {
                        //_create should have reported the error
                        if (callback) return callback(err);
                        return reject(err);
                    }
                }

                // Got a doc
                if (callback) return callback(null, doc);
                return resolve(doc);
            }
        });
    }

    /**
     * Retrieves a model given an identifier.
     *
     * WARNING: this _can_ retrieve dead statuses
     *
     * @param {string} id - Row identifier
     * @param {*} [options] – Query options
     * @param {function(err:Error, row:*)} callback – Fired when completed
     * @protected
     */
    _retrieve(id, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = null;
        }

        const { session } = (options || {});

        // Only do a query if there's something to query for
        if (id !== undefined && id !== null) {
            let sql = `SELECT * FROM \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\` WHERE \`${this.service.escapeIdentifier(this.idField)}\` = ?`;
            const args = [id];

            // If conceal mode is activated, prevent dead resources from returning
            if (this._concealDeadResources) {
                sql += ` AND \`${this.service.escapeIdentifier(this.statusField)}\` != ?`;
                args.push(this._deletedStatus);
            }

            sql += ' LIMIT 1';

            this.service.query(
                sql,
                args,
                async (err, res) => {

                    let row = null;
                    /* istanbul ignore if: this should be next to impossible to trigger */
                    if (err) await this.app.report('CrudService: Failed to retrieve record', err, { id, sql, args, res });
                    else {
                        if (res && res.length > 0) row = res[0];
                    }

                    callback(err, row);
                },
                { session }
            );

        } else {
            // id has no value - so... womp.
            callback(null, null);
        }
    }

    /**
     * Retrieves one or more records that match the given criteria
     * @param {*} criteria - Filter criteria
     * @param {{[skip]:number, [take]:number, [fields]:string|*, [sort]:*, [mode]:string}} [options] - Query options
     * @param {function(err:Error, results:*)} callback – Fired when completed
     * @return {Query}
     * @protected
     */
    _find(criteria, options, callback) {

        // Allow overloading by skipping options
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Default options
            options = options || {};
        }

        const { session } = options;

        let where = [];
        let args = [];

        // Strip options out so we can stick them into the query builder
        let skip, limit, fields, sort, conceal = true, mode;
        if (options.skip !== undefined) { skip = options.skip; delete options.skip; }
        if (options.take !== undefined) { limit = options.take; delete options.take; }
        if (options.fields !== undefined) { fields = options.fields; delete options.fields; }
        if (options.sort !== undefined) { sort = options.sort; delete options.sort; }
        if (options.conceal !== undefined) { conceal = options.conceal; delete options.conceal; }
        if (options.mode !== undefined) { mode = options.mode; delete options.mode; fields = undefined; }

        // Actively prevent dead resources from returning, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were even given criteria
            if (criteria) {

                // Check if we were given a status filter
                if (criteria[this.statusField]) {

                    // Composite both status requirements together
                    where.push(`\`${this.service.escapeIdentifier(this.statusField)}\` = ? AND \`${this.service.escapeIdentifier(this.statusField)}\` != ?`);
                    args.push(criteria[this.statusField]);
                    args.push(this._deletedStatus);

                    // Remove the original status filter from criteria
                    delete criteria[this.statusField];

                } else {
                    // No status given, default it to conceal dead things
                    criteria[this.statusField] = { $ne: this._deletedStatus };
                }
            } else {
                // No criteria given, default it to conceal dead things
                criteria = { [this.statusField]: { $ne: this._deletedStatus } };
            }
        }

        // Build the query where args
        this._buildCriteria(criteria || {}, where, args);

        // Build the fields clause
        let fieldsSql = mode === CrudService._QUERY_MODE.COUNT ? 'COUNT(*) AS `count`' : '*';
        if (fields !== undefined) {
            if (fields.id === undefined) {
                fields.id = 1;
            }
            const allowedFields = Object.keys(fields).filter((field) => fields[field]);
            fieldsSql = allowedFields.map((field) => `\`${this.service.escapeIdentifier(field)}\``).join(', ');
        }

        let sql = `SELECT ${fieldsSql} FROM \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\``;

        // Attach the where clause
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        // Attach order by clause
        if (sort !== undefined) {
            sql += ' ORDER BY ' + Object.keys(sort).map((field) => {
                return `\`${this.service.escapeIdentifier(field)}\` ${sort[field] > 0 ? 'ASC' : 'DESC'}`
            });
        }

        // Attach limit clause
        if (skip !== undefined || limit !== undefined) {
            let cap = {
                offset: 0,
                limit: CrudService.MAX_VALUE
            };
            if (skip !== undefined) { cap.offset = skip; }
            if (limit !== undefined) { cap.limit = limit; }

            if (cap.limit === CrudService.MAX_VALUE) {
                sql += ` LIMIT ?,${CrudService.MAX_VALUE}`;
                args.push(cap.offset);
            } else {
                sql += ' LIMIT ?,?';
                args.push(cap.offset, cap.limit);
            }
        }

        this.service.query(
            sql,
            args,
            async (err, res) => {
                /* istanbul ignore if: hopefully you shouldn't throw query errors, and if you do, that's on you */
                if (err) {
                    await this.app.report('CrudService: Failed to find records', err, { sql, args, res });
                }
                callback(err, res);
            },
            { session }
        );
    }

    /**
     * Converts object criteria into a WHERE query clause parts
     * @param criteria
     * @param where
     * @param args
     * @param equality
     * @private
     */
    _buildCriteria(criteria, where, args, equality = true) {
        // For each field present in the criteria
        Object.keys(criteria).forEach(async (field) => {
            const value = criteria[field];

            // Handle special types of values
            if (Array.isArray(value)) {
                // Arrays turn to WHERE IN ...
                where.push(`\`${this.service.escapeIdentifier(field)}\` ${!equality ? 'NOT ' : ''}IN (${(new Array(value.length)).fill('?').join(', ')})`);
                value.forEach((val) => args.push(val));
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Buffer.isBuffer(value)) {
                // Value is an object, try to keep some similarity here between mongo
                const startingWhereLength = where.length;

                if (value.$ne) {
                    this._buildCriteria({ [field]: value.$ne }, where, args, false);
                }

                if (value.$gt) {
                    where.push(`\`${this.service.escapeIdentifier(field)}\` > ?`);
                    args.push(value.$gt);
                }

                if (value.$gte) {
                    where.push(`\`${this.service.escapeIdentifier(field)}\` >= ?`);
                    args.push(value.$gte);
                }

                if (value.$lt) {
                    where.push(`\`${this.service.escapeIdentifier(field)}\` < ?`);
                    args.push(value.$lt);
                }

                if (value.$lte) {
                    where.push(`\`${this.service.escapeIdentifier(field)}\` <= ?`);
                    args.push(value.$lte);
                }

                if (startingWhereLength === where.length) {
                    await this.app.report('CrudService: No object modifier set on object query criteria', { field, value });
                }
            } else {
                // Standard value
                where.push(`\`${this.service.escapeIdentifier(field)}\` ${!equality ? '!' : ''}= ?`);
                args.push(value);
            }
        });
    }

    /**
     * Performs a find-based query but is optimized to only return the count of matching records, not the records themselves
     * @param {*} criteria - Filter criteria
     * @param {{[skip]:number, [take]:number, [fields]:string|*, [sort]:*, [exec]:boolean}} [options] - Query options
     * @param {function(err:Error, docs:number)} callback – Fired when completed
     * @return {Query}
     * @protected
     */
    _count(criteria, options, callback) {
        // Allow overloading by skipping options
        if (typeof options === "function") {
            //noinspection JSValidateTypes
            callback = options;
            options = {};
        } else {
            // Default options
            options = options || {};
        }

        // Don't execute, we want the query so we can fudge it
        options.mode = CrudService._QUERY_MODE.COUNT;
        delete options.skip;
        delete options.take;
        delete options.sort;
        delete options.fields;


        // Exec the count query
        return this._find(criteria, options, (err, res) => {
            callback(err, res && res.length > 0 && res[0].count)
        });
    }

    /**
     * Applies the data properties to the row
     * @param {*} doc - Row to update
     * @param {*} [data] - Data to apply to the row before saving
     * @protected
     */
    _applyUpdates(doc, data) {
        // When given a data object, apply those keys to the model when allowed to do so
        if (data && typeof data === "object") {
            this._modifiableKeys.forEach(function (property) {
                /* istanbul ignore else: too edge casey to test this way */
                if (data.hasOwnProperty(property)) {
                    doc[property] = data[property];
                }
            });
        }
    }

    /**
     * Update an existing row
     * @param doc - row to update
     * @param [data] - Data to apply to the row before saving
     * @param [options] – Query options
     * @param {function(err:*, row:*?)} callback – Fired when saved or failed to save
     * @protected
     */
    async _update(doc, data, options, callback) {

        // Allow overloading of _update(obj, callback)
        if (typeof data === "function") {
            callback = data;
            options = {};
            data = null;
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const { session } = (options || {});

        // Apply any given key updates, if given
        this._applyUpdates(doc, data);

        // Ensure when you update an object, no matter what it is, we update our auditing field
        if (this.updatedField) doc.updated = new Date();

        // Make sure we know what we are updating!
        if (doc[this.idField] === undefined) {
            await this.app.report('CrudService: Cannot update row if id field not provided!', { doc, data, idField: this.idField });
            // noinspection JSUnresolvedFunction
            callback(new Error('CrudService: Cannot update row if id field not provided'), null);
        } else {

            // Remove the id field from the query so we're not randomly setting id=id in there
            const args = [];
            const setData = Object.assign({}, doc);
            delete setData[this.idField];
            const sets = Object.keys(setData).map((field) => {
                args.push(setData[field]);
                return `\`${this.service.escapeIdentifier(field)}\` = ?`;
            });


            let sql = `UPDATE \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\` SET ${sets.join(', ')} WHERE \`${this.service.escapeIdentifier(this.idField)}\` = ?`;
            args.push(doc[this.idField]);

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {
                        await this.app.report('CrudService: Failed to update record', err, { doc, data, sql, args, res });
                        // noinspection JSUnresolvedFunction
                        return callback(err);
                    }

                    // res -> https://dev.mysql.com/doc/dev/connector-nodejs/8.0/module-Result.html
                    // console.log('getAffectedRowsCount', res.result.getAffectedRowsCount());
                    // console.log('getWarnings', res.result.getWarnings());
                    // console.log('getWarningsCount', res.result.getWarningsCount());
                    // console.log('getGeneratedIds', res.result.getGeneratedIds());
                    // console.log('getAutoIncrementValue', res.result.getAutoIncrementValue());

                    // TODO - consider re-retrieving the record instead of returning the doc

                    // noinspection JSUnresolvedFunction
                    callback(null, doc);
                },
                {
                    session
                }
            );
        }
    }

    /**
     * Updates all records that match the given criteria with the given properties
     * @param {*} criteria – Query criteria (just like _find)
     * @param {*} data – Column-value properties to set on each matched record
     * @param {{connection:*, conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*?)} callback – Fired when completed
     * @protected
     */
    _bulkUpdate(criteria, data, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { session, conceal = true } = (options || {});

        // Normalize criteria
        criteria = criteria || {};

        // Automatically bump updated time on matched records if configured to do so
        if (this.updatedField) data.updated = new Date();

        const args = [];
        const setData = Object.assign({}, data);
        delete setData[this.idField];

        const sets = Object.keys(setData).map((field) => {
            args.push(setData[field]);
            return `\`${this.service.escapeIdentifier(field)}\` = ?`;
        });

        let sql = `UPDATE \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\` SET ${sets.join(', ')}`;

        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`\`${this.service.escapeIdentifier(this.statusField)}\` = ? AND \`${this.service.escapeIdentifier(this.statusField)}\` != ?`);
                args.push(criteria[this.statusField]);
                args.push(this._deletedStatus);

                // Remove the original status filter from criteria
                delete criteria[this.statusField];

            } else {
                // No status given, default it to conceal dead things
                criteria[this.statusField] = { $ne: this._deletedStatus };
            }
        }

        // Add criteria to query
        this._buildCriteria(criteria, where, args);
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        return this.service.query(
            sql,
            args,
            async (err, res) => {
                if (err) {
                    await this.app.report('CrudService: Failed to bulk update rows', err, { criteria, data, sql, args, res });
                    // noinspection JSUnresolvedFunction
                    return callback(err);
                }

                // res -> https://dev.mysql.com/doc/dev/connector-nodejs/8.0/module-Result.html
                // console.log('getAffectedRowsCount', res.result.getAffectedRowsCount());
                // console.log('getWarnings', res.result.getWarnings());
                // console.log('getWarningsCount', res.result.getWarningsCount());
                // console.log('getGeneratedIds', res.result.getGeneratedIds());
                // console.log('getAutoIncrementValue', res.result.getAutoIncrementValue());

                // noinspection JSUnresolvedFunction
                callback(null, res);
            },
            {
                session
            }
        );
    }

    /**
     * Fake-deletes a row from the table (by changing its status to dead and updating the row)
     * @param {*} doc - Row to update
     * @param {*} [options] – Query options
     * @param {function(err:Error, obj:*?)} [callback] – Fired when saved or failed to save
     * @protected
     */
    _delete(doc, options, callback) {
        doc.status = this._deletedStatus;
        return this._update(doc, null, options, (err, doc) => {
            callback(err, doc);
        });
    }

    /**
     * Fake-deletes all matching rows from the table (by changing status to dead)
     * @param {*} criteria – Query criteria (just like _find)
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*?)} callback – Fired when completed
     * @protected
     */
    _bulkDelete(criteria, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        return this._bulkUpdate(criteria, { status: this._deletedStatus }, options, callback);
    }

    /**
     * Permanently removes a row from the table
     * @param {*} doc - row to delete
     * @param {*} [options] - Query options
     * @param {function(err:Error, obj:*?)} [callback] - Fired when deleted or failed to delete
     * @protected
     */
    _deletePermanently(doc, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const { session } = (options || {});

        // Make sure we know what we are deleting!
        if (doc[this.idField] === undefined) {
            this.app.report('CrudService: Cannot delete row if id field not provided!', { doc, idField: this.idField }).then(() => {
                callback(new Error('CrudService: Cannot delete row if id field not provided'), doc);
            });
        } else {

            let sql = `DELETE FROM \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\` WHERE \`${this.service.escapeIdentifier(this.idField)}\` = ?`;
            let args = [doc[this.idField]];

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {
                        await this.app.report('CrudService: Failed to perma-delete row', err, { doc, sql, args, res });
                        // noinspection JSUnresolvedFunction
                        return callback(err);
                    }

                    // res -> https://dev.mysql.com/doc/dev/connector-nodejs/8.0/module-Result.html
                    // console.log('getAffectedRowsCount', res.result.getAffectedRowsCount());
                    // console.log('getWarnings', res.result.getWarnings());
                    // console.log('getWarningsCount', res.result.getWarningsCount());
                    // console.log('getGeneratedIds', res.result.getGeneratedIds());
                    // console.log('getAutoIncrementValue', res.result.getAutoIncrementValue());

                    // noinspection JSUnresolvedFunction
                    callback(null, doc);
                },
                {
                    session
                }
            );
        }
    }

    /**
     * Permanently removes all records matching the given criteria from the table
     * @param {*} criteria – Query criteria (just like _find)
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*)} callback – Fired when completed
     * @protected
     */
    _bulkDeletePermanently(criteria, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { session, conceal=true } = (options || {});

        // Normalize criteria
        criteria = criteria || {};

        let sql = `DELETE FROM \`${this.service.escapeIdentifier(this.database)}\`.\`${this.service.escapeIdentifier(this.table)}\``;
        let args = [];
        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`\`${this.service.escapeIdentifier(this.statusField)}\` = ? AND \`${this.service.escapeIdentifier(this.statusField)}\` != ?`);
                args.push(criteria[this.statusField]);
                args.push(this._deletedStatus);

                // Remove the original status filter from criteria
                delete criteria[this.statusField];

            } else {
                // No status given, default it to conceal dead things
                criteria[this.statusField] = { $ne: this._deletedStatus };
            }
        }

        // Add criteria to query
        this._buildCriteria(criteria, where, args);
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        return this.service.query(
            sql,
            args,
            async (err, res) => {
                if (err) {
                    await this.app.report('CrudService: Failed to bulk perma-delete rows', err, { criteria, sql, args, res });
                    // noinspection JSUnresolvedFunction
                    return callback(err);
                }

                // res -> https://dev.mysql.com/doc/dev/connector-nodejs/8.0/module-Result.html
                // console.log('getAffectedRowsCount', res.result.getAffectedRowsCount());
                // console.log('getWarnings', res.result.getWarnings());
                // console.log('getWarningsCount', res.result.getWarningsCount());
                // console.log('getGeneratedIds', res.result.getGeneratedIds());
                // console.log('getAutoIncrementValue', res.result.getAutoIncrementValue());

                // noinspection JSUnresolvedFunction
                callback(null, res);
            },
            {
                session
            }
        );
    }
}

/**
 * MySQL collision error code
 * @type {number}
 * @static
 * @private
 */
CrudService._collisionErrorCode = 1062; // ER_DUP_ENTRY:

/**
 * Query mode for _find
 * @type {{COUNT: string}}
 * @private
 */
CrudService._QUERY_MODE = {
    COUNT: 'COUNT'
};

/**
 * Maximum number of rows in a MySQL table, used for offset LIMIT statements with no page size
 */
CrudService.MAX_VALUE = '18446744073709551615';

module.exports = CrudService;
