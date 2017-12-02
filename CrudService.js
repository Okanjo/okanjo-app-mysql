"use strict";

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
        // Make sure we're not going to have problems
        //assert(typeof model === "function", 'Model given is not an model function!');
        //assert(model.base === Mongoose, 'Model given is not a mongoose model!');

        // Hold a reference to the app
        // this.app = app;

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
    }

    /**
     * Creates a new model
     * @param {*} data - Record properties
     * @param {function(err:Error, obj:*)} [callback] – Fired when saved or failed to save
     * @param {boolean} [suppressCollisionError] - Option to suppress error reporting on collisions (for quiet retry handling)
     * @protected
     */
    _create(data, callback, suppressCollisionError) {

        let sql = `INSERT INTO \`${this.database}\`.\`${this.table}\` SET ?`;

        // Skip the query abstraction and go straight to the pool, cuz we don't want it reporting for us
        return this.service.pool.query(sql, data, (err, res) => {
            if (err) {
                if (!suppressCollisionError || err.errno !== CrudService._collisionErrorCode) {
                    this.app.report('Failed to create new record!', err, { sql, data, res });
                }
            }

            // TODO - think about pulling the last inserted id?

            callback(err, data);
        });
    }

    /**
     * Creates a new record but calls the objectClosure function before each save attempt
     * @param {*} data – Model properties
     * @param {function(data:*,attempt:Number)} objectClosure - Called to obtain the object row properties before save
     * @param {function(err:Error, obj:*)} [callback] – Fired when saved or failed to save
     * @param {Number} [attempt] - Internal, used if the save attempt failed due to a collision
     * @protected
     */
    _createWithRetry(data, objectClosure, callback, attempt) {
        attempt = attempt || 0;
        return this._create(objectClosure(data, attempt), (err, doc) => {
            // Only retry if the error matches our known error code
            if (err && err.errno === CrudService._collisionErrorCode) {
                if (++attempt >= this._createRetryCount) {
                    // Report here because we told _create not to report collisions
                    this.app.report('All attempts failed to create record due to collisions!', { err, data, database: this.database, table: this.table });
                    /* istanbul ignore else: fuck you debbie */
                    if (callback) callback(err);
                } else {
                    // Try, try again, Mr. Kidd
                    setImmediate(() => this._createWithRetry(data, objectClosure, callback, attempt));
                }
            } else {
                callback(err, doc);
            }
        }, true);
    }

    /**
     * Retrieves a model given an identifier.
     *
     * WARNING: this _can_ retrieve dead statuses
     *
     * @param {string} id - Row identifier
     * @param {function(err:Error, doc:*, fields:*)} callback – Fired when completed
     * @protected
     */
    _retrieve(id, callback) {

        // Only do a query if there's something to query for
        if (id !== undefined && id !== null) {

            let sql = `SELECT * FROM ??.?? WHERE ?? = ?`;
            const args = [this.database, this.table, this.idField, id];

            // If conceal mode is activated, prevent dead resources from returning
            if (this._concealDeadResources) {
                sql += ' AND ?? != ?';
                args.push(this.statusField, this._deletedStatus);
            }

            sql += ' LIMIT 1';

            return this.service.query(sql, args, (err, res, fields) => {
                let row = null;
                /* istanbul ignore if: this should be next to impossible to trigger */
                if (err) this.app.report('Failed to retrieve record', err, { id, sql, args, res, fields});
                else {
                    if (res && res.length > 0) row = res[0];
                }

                callback(err, row, fields);
            });

        } else {
            // id has no value - so... womp.
            callback(null, null, null);
        }
    }

    /**
     * Retrieves one or more records that match the given criteria
     * @param {*} criteria - Filter criteria
     * @param {{[skip]:number, [take]:number, [fields]:string|*, [sort]:*, [mode]:string}} [options] - Query options
     * @param {function(err:Error, docs:[*], fields:*)} callback – Fired when completed
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

        let where = [];
        let args = [this.database, this.table];

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
                    where.push('?? = ? AND ?? != ?');
                    args.push(this.statusField, criteria[this.statusField]);
                    args.push(this.statusField, this._deletedStatus);

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
            fieldsSql = allowedFields.map(() => '??').join(', ');
            args = allowedFields.concat(args);
        }

        let sql = `SELECT ${fieldsSql} FROM ??.??`;

        // Attach the where clause
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        // Attach order by clause
        if (sort !== undefined) {
            sql += ' ORDER BY ' + Object.keys(sort).map((field) => {
                args.push(field);
                return `?? ${sort[field] > 0 ? 'ASC' : 'DESC'}`
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

            sql += ' LIMIT ?,?';
            args.push(cap.offset, cap.limit);
        }

        return this.service.query(sql, args, (err, res, fields) => {
            /* istanbul ignore if: hopefully you shouldn't throw query errors, and if you do, that's on you */
            if (err) {
                this.app.report('Failed to find records', err, { sql, args, res, fields, mysqlQuery });
            }
            callback(err, res, fields);
        });
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
        Object.keys(criteria).forEach((field) => {
            const value = criteria[field];

            // Handle special types of values
            if (Array.isArray(value)) {
                // Arrays turn to WHERE IN ...
                where.push(`?? ${!equality ? 'NOT ' : ''}IN (?)`);
                args.push(field, value);
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Buffer.isBuffer(value)) {
                // Value is an object, try to keep some similarity here between mongo
                const startingWhereLength = where.length;

                if (value.$ne) {
                    this._buildCriteria({ [field]: value.$ne }, where, args, false);
                }

                if (value.$gt) {
                    where.push('?? > ?');
                    args.push(field, value.$gt);
                }

                if (value.$gte) {
                    where.push('?? >= ?');
                    args.push(field, value.$gte);
                }

                if (value.$lt) {
                    where.push('?? < ?');
                    args.push(field, value.$lt);
                }

                if (value.$lte) {
                    where.push('?? <= ?');
                    args.push(field, value.$lte);
                }

                if (startingWhereLength === where.length) {
                    this.app.report('No object modifier set on object query criteria', { field, value });
                }
            } else {
                // Standard value
                where.push(`?? ${!equality ? '!' : ''}= ?`);
                args.push(field, value);
            }
        });
    }

    /**
     * Performs a find-based query but is optimized to only return the count of matching records, not the records themselves
     * @param {*} criteria - Filter criteria
     * @param {{[skip]:number, [take]:number, [fields]:string|*, [sort]:*, [exec]:boolean}} [options] - Query options
     * @param {function(err:Error, docs:number, fields:*)} callback – Fired when completed
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
        return this._find(criteria, options, (err, res, fields) => {
            callback(err, res && res.length > 0 && res[0].count, fields)
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
     * @param {*} doc - row to update
     * @param {*} [data] - Data to apply to the row before saving
     * @param {function(err:Error, obj:*)} callback – Fired when saved or failed to save
     * @protected
     */
    _update(doc, data, callback) {

        // Allow overloading of _update(obj, callback)
        if (typeof data === "function") {
            callback = data;
            data = null;
        }

        // Apply any given key updates, if given
        this._applyUpdates(doc, data);

        // Ensure when you update an object, no matter what it is, we update our auditing field
        if (this.updatedField) doc.updated = new Date();

        // Make sure we know what we are updating!
        if (doc[this.idField] === undefined) {
            this.app.report('Cannot update row if id field not provided!', { doc, data, idField: this.idField });
            callback(new Error('Cannot update row if id field not provided'), null);
        } else {

            // Remove the id field from the query so we're not randomly setting id=id in there
            let sets = Object.assign({}, doc);
            delete sets[this.idField];

            let sql = 'UPDATE ??.?? SET ? WHERE ?? = ?';
            let args = [this.database, this.table, sets, this.idField, doc[this.idField]];

            return this.service.query(sql, args, (err, res, fields) => {
                /* istanbul ignore if: hopefully you shouldn't throw query errors, and if you do, that's on you */
                if (err) {
                    this.app.report('Failed to update row', err, { doc, data, sql, args, res, fields });
                }

                // TODO - consider re-retrieving the record instead of returning the doc
                callback(err, doc);
            });
        }
    }

    /**
     * Updates all records that match the given criteria with the given properties
     * @param {*} criteria – Query criteria (just like _find)
     * @param {*} data – Column-value properties to set on each matched record
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*)} callback – Fired when completed
     * @protected
     */
    _bulkUpdate(criteria, data, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        // Normalize criteria
        criteria = criteria || {};

        // Automatically bump updated time on matched records if configured to do so
        let sets = Object.assign({}, data);
        if (this.updatedField) sets.updated = new Date();

        let sql = 'UPDATE ??.?? SET ?';

        let args = [this.database, this.table, sets];
        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        let conceal = options.conceal !== undefined ? options.conceal : true;
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push('?? = ? AND ?? != ?');
                args.push(this.statusField, criteria[this.statusField]);
                args.push(this.statusField, this._deletedStatus);

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

        return this.service.query(sql, args, (err, res) => {
            /* istanbul ignore if: hopefully you shouldn't throw query errors, and if you do, that's on you */
            if (err) {
                this.app.report('Failed to bulk update rows', err, { criteria, data, sql, args, res, fields });
            }

            callback(err, res);
        });
    }

    /**
     * Fake-deletes a row from the table (by changing its status to dead and updating the row)
     * @param {*} doc - Row to update
     * @param {function(err:Error, obj:*)} [callback] – Fired when saved or failed to save
     * @protected
     */
    _delete(doc, callback) {
        doc.status = this._deletedStatus;
        return this._update(doc, (err, doc) => {
            callback(err, doc);
        });
    }

    /**
     * Fake-deletes all matching rows from the table (by changing status to dead)
     * @param {*} criteria – Query criteria (just like _find)
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*)} callback – Fired when completed
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
     * @param {function(err:Error, obj:*)} [callback] - Fired when deleted or failed to delete
     * @protected
     */
    _deletePermanently(doc, callback) {
        // Make sure we know what we are deleting!
        if (doc[this.idField] === undefined) {
            this.app.report('Cannot delete row if id field not provided!', { doc, idField: this.idField });
            callback(new Error('Cannot delete row if id field not provided'), doc);
        } else {

            let sql = 'DELETE FROM ??.?? WHERE ?? = ?';
            let args = [this.database, this.table, this.idField, doc[this.idField]];

            return this.service.query(sql, args, (err, res, fields) => {
                /* istanbul ignore if: out of scope cuz maybe you got FK constrains cramping your style */
                if (err) {
                    this.app.report('Failed to delete row', err, { doc, sql, args, res, fields})
                } else if (res.affectedRows <= 0) {
                    // Warn if the expected result is not present
                    this.app.report('Database reported no affected rows for delete operation. Was this row already deleted?', { doc, sql, args, res, fields });
                }
                callback(err, doc);
            });
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

        // Normalize criteria
        criteria = criteria || {};

        let sql = 'DELETE FROM ??.??';
        let args = [this.database, this.table];
        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        let conceal = options.conceal !== undefined ? options.conceal : true;
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push('?? = ? AND ?? != ?');
                args.push(this.statusField, criteria[this.statusField]);
                args.push(this.statusField, this._deletedStatus);

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

        return this.service.query(sql, args, (err, res, fields) => {
            /* istanbul ignore if: out of scope cuz maybe you got FK constrains cramping your style? */
            if (err) {
                this.app.report('Failed to bulk perm-delete rows', err, { criteria, sql, args, res, fields})
            }
            callback(err, res);
        });

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
 * Object class to prevent big number serialization issues
 */
class MaxValue {
    // noinspection JSUnusedGlobalSymbols
    // noinspection JSMethodCanBeStatic
    // noinspection JSUnusedGlobalSymbols
    /**
     * Formatter for SQL queries, return the number as-is, so no rounding issues occur
     * @return {string}
     */
    toSqlString() {
        return '18446744073709551615'
    }
}

CrudService.MAX_VALUE = new MaxValue();

module.exports = CrudService;
