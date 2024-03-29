"use strict";

const Util = require('util');

/**
 * Base service that all object CRUD services should inherit
 */
class MariaDBCrudService {

    /**
     * Constructor
     * @param app
     * @param options
     */
    constructor(app, options) {
        this.app = app;

        if (!options) {
            throw new Error('MariaDBCrudService: `options` are required.');
        }

        // Required settings
        /**
         * Underlying MariaDB service instance
         * @type {MariaDBService}
         */
        this.service = options.service;

        if (!this.service) {
            throw new Error('MariaDBCrudService: `service` must be defined on initialization');
        }

        this.schema = options.schema || options.database || this.service.config.database; // default to the service connection database param, if given
        this.table = options.table;

        if (!this.schema) {
            throw new Error('MariaDBCrudService: `database` or `schema` must be defined on initialization');
        }

        if (!this.table) {
            throw new Error('MariaDBCrudService: `table` must be defined on initialization');
        }

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
         * @protected
         */
        this._concealDeadResources = options.concealDeadResources !== undefined ? options.concealDeadResources : true;

        this.retrieve = Util.promisify(this.retrieve.bind(this));
        this.find = Util.promisify(this.find.bind(this));
        this.count = Util.promisify(this.count.bind(this));
        this.update = Util.promisify(this.update.bind(this));
        this.bulkUpdate = Util.promisify(this.bulkUpdate.bind(this));
        this.delete = Util.promisify(this.delete.bind(this));
        this.bulkDelete = Util.promisify(this.bulkDelete.bind(this));
        this.deletePermanently = Util.promisify(this.deletePermanently.bind(this));
        this.bulkDeletePermanently = Util.promisify(this.bulkDeletePermanently.bind(this));
    }

    /**
     * Hook to create the database schema if it does not exist
     * @param {Connection} connection - Active connection
     * @returns {Promise<void>}
     * @protected
     */
    async _createSchema(connection) {
        await this.service.query(`CREATE DATABASE \`${this.schema}\`;`, [], { connection });
    }

    // noinspection JSMethodCanBeStatic
    /**
     * Hook to update the database schema if it already exists
     * @param {Connection} connection - Active session
     * @returns {Promise<void>}
     * @protected
     */
    async _updateSchema(connection) { // eslint-disable-line no-unused-vars
        // Could add/remove views, triggers, procedures, you name it...
    }

    /**
     * Hook to create the database table if it does not exist
     * @param {Connection} connection – Active session
     * @returns {Promise<void>}
     * @protected
     */
    async _createTable(connection) { // eslint-disable-line no-unused-vars
        const err = new Error('MariaDBCrudService: Method _createTable must be overridden to properly create your table');
        await this.app.report(err, { schema: this.schema, table: this.table });
        throw err;

        // For example, you might want to do something like this:
        // const res = await connection.query(`
        //     CREATE TABLE ${this.schema}.${this.table} (
        //         \`id\` varchar(255) NOT NULL,
        //         \`name\` varchar(255) NOT NULL,
        //         \`status\` varchar(255) NOT NULL,
        //         \`created\` datetime NOT NULL,
        //         \`updated\` datetime NOT NULL,
        //         PRIMARY KEY (\`id\`),
        //     ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        // `);
    }

    /**
     * Hook to update a table if it already exists
     * @param {Connection} connection – Active session
     * @returns {Promise<void>}
     * @protected
     */
    async _updateTable(connection) { // eslint-disable-line no-unused-vars
        // Could add/remove columns, indices, FK's, you name it...
    }

    /**
     * Initializes the database and table. Use this._createSchema, this._createTable, this._updateSchema, this._updateTable hooks for implementation
     * @returns {Promise<void>}
     */
    async init() {
        // Get a new session
        const connection = await this.service.getConnection();

        // Start a transaction to prevent races
        await connection.beginTransaction();

        try {

            // Schema exists?
            let schemas = await this.service.query(`SHOW DATABASES LIKE ?;`, [this.schema], { connection });
            let exists = schemas.length === 1;
            if (!exists) {
                // No, let the operator create it
                await this._createSchema(connection);
            } else {
                // Let the app update anything it wants to here
                await this._updateSchema(connection)
            }

            // Table exists?
            const tables = await this.service.query(`SHOW TABLES FROM \`${this.schema}\` LIKE ?;`, [this.table], { connection });
            exists = tables.length === 1;
            if (!exists) {
                // No, let the operator create it
                await this._createTable(connection);
            } else {
                // Let the app update anything it wants to here
                await this._updateTable(connection);
            }

            // Commit the results
            await connection.commit();

        } catch (err) {
            await this.app.report('MariaDBCrudService: Failed to initialize', err, { schema: this.schema, table: this.table });

            // Abort
            await connection.rollback();

            // rethrow
            throw err;

        } finally {
            // Always close the session when done
            await connection.end();
        }
    }

    /**
     * Creates a new model
     * @param {*} data - Record properties
     * @param {*} [options] – Query options
     * @param {function(err:*, data:*?)} [callback]
     */
    create(data, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        return new Promise((resolve, reject) => {
            const { suppressCollisionError = false, connection } = (options || {});

            const args = [];

            // Build query and args
            let sql = `INSERT INTO \`${this.schema}\`.\`${this.table}\` SET `
                + Object.keys(data).map((field) => { args.push(data[field]); return `\`${field}\` = ?`; }).join(', ');

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {

                        if (!suppressCollisionError || err.errno !== MariaDBCrudService._collisionErrorCode) {
                            await this.app.report('MariaDBCrudService: Failed to create record', err, { sql, args, res });
                        }

                        if (callback) return setImmediate(() => callback(err));
                        return reject(err);
                    }

                    // TODO - think about using last insert id res.insertId
                    
                    // Expose the result object on data w/o letting it enumerate
                    // Object.defineProperty(data, '_result', { enumerable: false, value: res });
                    
                    if (callback) return setImmediate(() => callback(null, data));
                    return resolve(data);
                },
                {
                    suppress: suppressCollisionError ? MariaDBCrudService._collisionErrorCode : null,
                    connection
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
     */
    createWithRetry(data, objectClosure, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = null;
        }
        options = options || {};
        options.suppressCollisionError = true;

        return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
            for (let i = 0; i < this._createRetryCount; i++) {
                let doc;
                try {
                    doc = await this.create(await objectClosure(data, i), options)
                } catch(err) {
                    if (err.errno === MariaDBCrudService._collisionErrorCode) {
                        if (this._createRetryCount === (i+1)) {
                            await this.app.report('MariaDBCrudService: All attempts failed to create record due to collisions!', { err, data, database: this.schema, table: this.table });
                            if (callback) return setImmediate(() => callback(err));
                            return reject(err);
                        } else {
                            continue; // next try
                        }
                    } else {
                        //_create should have reported the error
                        if (callback) return setImmediate(() => callback(err));
                        return reject(err);
                    }
                }

                // Got a doc
                if (callback) return setImmediate(() => callback(null, doc));
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
     */
    retrieve(id, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = null;
        }

        const { connection } = (options || {});

        // Only do a query if there's something to query for
        if (id !== undefined && id !== null) {
            let sql = `SELECT * FROM \`${this.schema}\`.\`${this.table}\` WHERE \`${this.idField}\` = ?`;
            const args = [id];

            // If conceal mode is activated, prevent dead resources from returning
            if (this._concealDeadResources) {
                sql += ` AND \`${this.statusField}\` != ?`;
                args.push(this._deletedStatus);
            }

            sql += ' LIMIT 1';

            this.service.query(
                sql,
                args,
                async (err, res) => {

                    let row = null;
                    /* istanbul ignore if: this should be next to impossible to trigger */
                    if (err) await this.app.report('MariaDBCrudService: Failed to retrieve record', err, { id, sql, args, res });
                    else {
                        if (res && res.length > 0) row = res[0];
                    }

                    setImmediate(() => callback(err, row));
                },
                { connection }
            );

        } else {
            // id has no value - so... womp.
            setImmediate(() => callback(null, null));
        }
    }

    /**
     * Retrieves one or more records that match the given criteria
     * @param {*} criteria - Filter criteria
     * @param {{[skip]:number, [take]:number, [fields]:string|*, [sort]:*, [mode]:string}} [options] - Query options
     * @param {function(err:Error, results:*)} callback – Fired when completed
     * @return {Query}
     */
    find(criteria, options, callback) {

        // Allow overloading by skipping options
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Default options
            options = options || {};
        }

        const { connection } = options;

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
                    where.push(`\`${this.statusField}\` = ? AND \`${this.statusField}\` != ?`);
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
        let fieldsSql = mode === MariaDBCrudService._QUERY_MODE.COUNT ? 'COUNT(*) AS `count`' : '*';
        if (fields !== undefined) {
            if (typeof fields.id === "undefined") {
                fields.id = 1;
            }
            const allowedFields = Object.keys(fields).filter((field) => fields[field]);
            fieldsSql = allowedFields.map((field) => `\`${field}\``).join(', ');
        }

        let sql = `SELECT ${fieldsSql} FROM \`${this.schema}\`.\`${this.table}\``;

        // Attach the where clause
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        // Attach order by clause
        if (sort !== undefined) {
            sql += ' ORDER BY ' + Object.keys(sort).map((field) => {
                return `\`${field}\` ${sort[field] > 0 ? 'ASC' : 'DESC'}`
            });
        }

        // Attach limit clause
        if (skip !== undefined || limit !== undefined) {
            let cap = {
                offset: 0,
                limit: MariaDBCrudService.MAX_VALUE
            };
            if (skip !== undefined) { cap.offset = skip; }
            if (limit !== undefined) { cap.limit = limit; }

            if (cap.limit === MariaDBCrudService.MAX_VALUE) {
                sql += ' LIMIT ?,'+MariaDBCrudService.MAX_VALUE.toSqlValue();
                args.push(cap.offset, cap.limit);
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
                    await this.app.report('MariaDBCrudService: Failed to find records', err, { sql, args, res });
                }
                setImmediate(() => callback(err, res));
            },
            { connection }
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
                where.push(`\`${field}\` ${!equality ? 'NOT ' : ''}IN (${(new Array(value.length)).fill('?').join(', ')})`);
                value.forEach((val) => args.push(val));
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Buffer.isBuffer(value)) {
                // Value is an object, try to keep some similarity here between mongo
                const startingWhereLength = where.length;

                if (value.$ne) {
                    this._buildCriteria({ [field]: value.$ne }, where, args, false);
                }

                if (value.$gt) {
                    where.push(`\`${field}\` > ?`);
                    args.push(value.$gt);
                }

                if (value.$gte) {
                    where.push(`\`${field}\` >= ?`);
                    args.push(value.$gte);
                }

                if (value.$lt) {
                    where.push(`\`${field}\` < ?`);
                    args.push(value.$lt);
                }

                if (value.$lte) {
                    where.push(`\`${field}\` <= ?`);
                    args.push(value.$lte);
                }

                if (startingWhereLength === where.length) {
                    await this.app.report('MariaDBCrudService: No object modifier set on object query criteria', { field, value });
                }
            } else {
                // Standard value
                where.push(`\`${field}\` ${!equality ? '!' : ''}= ?`);
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
     */
    count(criteria, options, callback) {
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
        options.mode = MariaDBCrudService._QUERY_MODE.COUNT;
        delete options.skip;
        delete options.take;
        delete options.sort;
        delete options.fields;


        // Exec the count query
        return this.find(criteria, options, (err, res) => {
            setImmediate(() => callback(err, res && res.length > 0 && res[0].count));
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
                if (data[property]) {
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
     */
    update(doc, data, options, callback) {

        // Allow overloading of _update(obj, callback)
        if (typeof data === "function") {
            callback = data;
            options = {};
            data = null;
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const { connection } = (options || {});

        // Apply any given key updates, if given
        this._applyUpdates(doc, data);

        // Ensure when you update an object, no matter what it is, we update our auditing field
        if (this.updatedField) doc.updated = new Date();

        // Make sure we know what we are updating!
        if (doc[this.idField] === undefined) {
            this.app.report('MariaDBCrudService: Cannot update row if id field not provided!', { doc, data, idField: this.idField }).then(() => {
                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(new Error('MariaDBCrudService: Cannot update row if id field not provided'), null));
            });
        } else {

            // Remove the id field from the query so we're not randomly setting id=id in there
            const args = [];
            const setData = Object.assign({}, doc);
            delete setData[this.idField];
            const sets = Object.keys(setData).map((field) => {
                args.push(setData[field]);
                return `\`${field}\` = ?`;
            });


            let sql = `UPDATE \`${this.schema}\`.\`${this.table}\` SET ${sets.join(', ')} WHERE \`${this.idField}\` = ?`;
            args.push(doc[this.idField]);

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {
                        await this.app.report('MariaDBCrudService: Failed to update record', err, { doc, data, sql, args, res });
                        // noinspection JSUnresolvedFunction
                        return setImmediate(() => callback(err));
                    }

                    // TODO - consider re-retrieving the record instead of returning the doc

                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(null, doc));
                },
                {
                    connection
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
     */
    bulkUpdate(criteria, data, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { connection, conceal = true } = (options || {});

        // Normalize criteria
        criteria = criteria || {};

        // Automatically bump updated time on matched records if configured to do so
        if (this.updatedField) data.updated = new Date();

        const args = [];
        const setData = Object.assign({}, data);
        delete setData[this.idField];

        const sets = Object.keys(setData).map((field) => {
            args.push(setData[field]);
            return `\`${field}\` = ?`;
        });

        let sql = `UPDATE \`${this.schema}\`.\`${this.table}\` SET ${sets.join(', ')}`;

        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`\`${this.statusField}\` = ? AND \`${this.statusField}\` != ?`);
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
                    await this.app.report('MariaDBCrudService: Failed to bulk update rows', err, { criteria, data, sql, args, res });
                    // noinspection JSUnresolvedFunction
                    return setImmediate(() => callback(err));
                }

                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(null, res));
            },
            {
                connection
            }
        );
    }

    /**
     * Fake-deletes a row from the table (by changing its status to dead and updating the row)
     * @param {*} doc - Row to update
     * @param {*} [options] – Query options
     * @param {function(err:Error, obj:*?)} [callback] – Fired when saved or failed to save
     */
    delete(doc, options, callback) {
        doc.status = this._deletedStatus;
        return this.update(doc, null, options, (err, doc) => {
            setImmediate(() => callback(err, doc));
        });
    }

    /**
     * Fake-deletes all matching rows from the table (by changing status to dead)
     * @param {*} criteria – Query criteria (just like _find)
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*?)} callback – Fired when completed
     */
    bulkDelete(criteria, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        return this.bulkUpdate(criteria, { status: this._deletedStatus }, options, callback);
    }

    /**
     * Permanently removes a row from the table
     * @param {*} doc - row to delete
     * @param {*} [options] - Query options
     * @param {function(err:Error, obj:*?)} [callback] - Fired when deleted or failed to delete
     */
    deletePermanently(doc, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const { connection } = (options || {});

        // Make sure we know what we are deleting!
        if (doc[this.idField] === undefined) {
            this.app.report('MariaDBCrudService: Cannot delete row if id field not provided!', { doc, idField: this.idField }).then(() => {
                setImmediate(() => callback(new Error('MariaDBCrudService: Cannot delete row if id field not provided'), doc));
            });
        } else {

            let sql = `DELETE FROM \`${this.schema}\`.\`${this.table}\` WHERE \`${this.idField}\` = ?`;
            let args = [doc[this.idField]];

            return this.service.query(
                sql,
                args,
                async (err, res) => {
                    if (err) {
                        await this.app.report('MariaDBCrudService: Failed to perma-delete row', err, { doc, sql, args, res });
                        // noinspection JSUnresolvedFunction
                        return setImmediate(() => callback(err));
                    }

                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(null, doc));
                },
                {
                    connection
                }
            );
        }
    }

    /**
     * Permanently removes all records matching the given criteria from the table
     * @param {*} criteria – Query criteria (just like _find)
     * @param {{conceal:boolean}} [options] – Additional options
     * @param {function(err:Error, res:*)} callback – Fired when completed
     */
    bulkDeletePermanently(criteria, options, callback) {

        // Allow overloading of _bulkUpdate(obj, data, callback)
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { connection, conceal=true } = (options || {});

        // Normalize criteria
        criteria = criteria || {};

        let sql = `DELETE FROM \`${this.schema}\`.\`${this.table}\``;
        let args = [];
        let where = [];

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`\`${this.statusField}\` = ? AND \`${this.statusField}\` != ?`);
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
                    await this.app.report('MariaDBCrudService: Failed to bulk perma-delete rows', err, { criteria, sql, args, res });
                    // noinspection JSUnresolvedFunction
                    return setImmediate(() => callback(err));
                }

                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(null, res));
            },
            {
                connection
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
MariaDBCrudService._collisionErrorCode = 1062; // ER_DUP_ENTRY:

/**
 * Query mode for _find
 * @type {{COUNT: string}}
 * @private
 */
MariaDBCrudService._QUERY_MODE = {
    COUNT: 'COUNT'
};

/**
 * Object class to prevent big number serialization issues
 */
class MaxValue {
    // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
    /**
     * Formatter for SQL queries, return the number as-is, so no rounding issues occur
     * @return {string}
     */
    toSqlValue() {
        return '18446744073709551615';
    }
}

MariaDBCrudService.MAX_VALUE = new MaxValue();

module.exports = MariaDBCrudService;
