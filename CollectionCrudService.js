"use strict";

const Util = require('util');
const Base58 = require('base-id').base58;

/**
 * CRUD service for working with MySQL Collections
 */
class CollectionCrudService {

    /**
     * Creates a new instance of the collection crud service
     * @param {OkanjoApp} app
     * @param {{service:MySQLService, schema:string, collection:string, idField:string?, statusField:string? updatedField:string?, generateIds:boolean?, createRetryCount:number?, modifiableKeys:[string]?, deletedStatus:string?, concealDeadResources:boolean?}} options
     */
    constructor(app, options) {
        this.app = app;

        // Required settings
        this.service = options.service;
        this.schema = options.schema || options.database;
        this.collection = options.collection || options.table;

        // Optional settings
        this.idField = options.idField || '_id';
        this.statusField = options.statusField || 'status';
        this.updatedField = options.updatedField || 'updated';

        /**
         * Whether to automatically generate _ids. MySQL 5.7 does not generate _ids on the server, but MySQL 8 does
         * @type {*|boolean}
         */
        this.generateIds = typeof options.generateIds !== "undefined" ? options.generateIds : (this.service.config.generateIds || false);

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

        this.getSchema = Util.promisify(this.getSchema.bind(this));
        this.getCollection = Util.promisify(this.getCollection.bind(this));
        this.create = Util.promisify(this.create.bind(this));
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
     * Encodes a doc before storing into MySQL (converts Date objects, etc)
     * @param {*} source – Source document
     * @param {*} [destination] – Optional, Destination object
     * @returns {*} Encoded document for MySQL
     * @protected
     */
    _encode(source, destination) {
        if (source !== null && typeof source === "object") {
            if (Array.isArray(source)) {
                destination = destination || [];
                source.forEach((val, index) => {
                    destination[index] = this._encode(val, destination[index]);
                });
            } else if (source instanceof Date) {
                destination = source.toISOString();
            } else {
                destination = destination || {};
                Object.keys(source).forEach((key) => {
                    destination[key] = this._encode(source[key], destination[key]);
                });
            }
        } else {
            destination = source;
        }

        return destination;
    }

    /**
     * Decodes a doc from MySQL before returning it to the app (converts ISO strings back to Dates)
     * @param {*} source – MySQL doc
     * @returns {*} Decoded document for app
     * @protected
     */
    _decode(source) {
        if (source !== null && typeof source === "object") {
            if (Array.isArray(source)) {
                source.forEach((val, index) => {
                    source[index] = this._decode(val);
                });
            } else {
                Object.keys(source).forEach((key) => {
                    source[key] = this._decode(source[key]);
                });
            }
        } else if (typeof source === "string" && CollectionCrudService._iso8601DatePattern.test(source)) {
            source = new Date(source);
        }

        return source;
    }

    /**
     * Gets the schema object this service belongs to
     * @param {Session} [session] – Session to use, or one will be pulled from the pool and provided
     * @param {function(err:Error|null, res:{session:Session, schema:Schema}?)} [callback] - Fired when completed
     * @returns {Promise<{session:Session, schema:Schema}>}
     */
    getSchema(session, callback) {
        if (typeof session === "function") {
            callback = session;
            session = null;
        }

        if (session) return callback(null, { session, schema: session.getSchema(this.schema) });

        this.service.getSession()
            .then(session => {
                setImmediate(() => callback(null, { session, schema: session.getSchema(this.schema) }));
            })
            .catch(/* istanbul ignore next: out of scope */ async err => {
                await this.app.report('CollectionCrudService: Failed to get schema', err, { schema: this.schema, collection: this.collection, info: err.info });
                setImmediate(() => callback(err));
            })
        ;
    }

    /**
     * Gets the collection object the service manages
     * @param {Session} [session] – Session to use, or one will be pulled from the pool and provided
     * @param {function(err:Error|null, res:{session:Session, schema:Schema, collection:Collection}?)} [callback] - Fired when completed
     * @returns {Promise<{session:Session, schema:Schema, collection:Collection}>}
     */
    getCollection(session, callback) {
        if (typeof session === "function") {
            callback = session;
            session = null;
        }

        this.getSchema(session, (err, res) => {
            /* istanbul ignore if: out of scope */
            if (err) return callback(err);

            res.collection = res.schema.getCollection(this.collection);
            callback(null, res);
        });
    }

    /**
     * Hook to create the database schema if it does not exist
     * @param {Session} session - Active session
     * @returns {Promise<Schema>} – Created Schema
     * @protected
     */
    async _createSchema(session) {
        // const schema = await session.createSchema(this.schema);
        return await session.createSchema(this.schema);
        // Remember to return the created schema
    }

    // noinspection JSMethodCanBeStatic
    /**
     * Hook to update the database schema if it already exists
     * @param {Session} session - Active session
     * @param {Schema} schema - Existing Schema
     * @returns {Promise<Schema>} – Updated Schema
     * @protected
     */
    async _updateSchema(session, schema) {
        // Could add/remove views, triggers, procedures, you name it...
        // Remember to return the updated schema
        return schema;
    }

    /**
     * Hook to create the collection if it does not exist
     * @param {Session} session – Active session
     * @param {Schema} schema – Existing Schema
     * @returns {Promise<void>}
     * @protected
     */
    async _createCollection(session, schema) {
        await schema.createCollection(this.collection);
    }

    /**
     * Hook to update a collection if it already exists
     * @param {Session} session – Active session
     * @param {Collection} collection – Existing Table
     * @returns {Promise<void>}
     * @protected
     */
    async _updateCollection(session, collection) {
        // Could add/remove indices here, etc
    }

    /**
     * Initializes the collection in the database. Creates the schema and collection if they do not exist.
     * @returns {Promise<void>}
     */
    async init() {
        // Get a session and the schema
        let { session, schema } = await this.getSchema();

        // Schema exists?
        let exists = await schema.existsInDatabase();
        if (!exists) {
            // No, let the operator create it
            schema = await this._createSchema(session);
        } else {
            // Let the app update anything it wants to here
            schema = await this._updateSchema(session, schema)
        }

        // Collection exists?
        const { collection } = await this.getCollection(session);
        exists = await collection.existsInDatabase();
        if (!exists) {
            // No, create it
            await this._createCollection(session, schema);
        } else {
            // Let the app update anything it wants to here
            await this._updateCollection(session, collection);
        }

        // TODO: consider automatic index handing here
        await session.close()
    }

    /**
     * Creates a new document
     * @param {*} data – Document data
     * @param {{suppressCollisionError:boolean?, session: Session}} [options] – Optional options
     * @param {function(err:Error|null, doc:*?)} [callback] – Fired when completed
     * @returns {Promise<*>}
     */
    create(data, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { suppressCollisionError = false, session } = (options || {});

        // Generate _id if needed
        if (data && !data[this.idField] && this.generateIds) {
            data[this.idField] = CollectionCrudService.generateId();
        }

        let _session;
        Promise
            .resolve(session ? session : this.service.getSession())
            .then(session => {
                _session = session;
                return session
                    .getSchema(this.schema)
                    .getCollection(this.collection)
                    .add(this._encode(data))
                    .execute()
                    .then(result => {
                        // If the server generated an id, then set it on the doc
                        const ids = result.getGeneratedIds();
                        if (ids.length > 0) {
                            data._id = ids[0];
                        }
                        setImmediate(() => callback(null, data));
                        return data;
                    })
                ;
            })
            .catch(async err => {
                if (!suppressCollisionError || !err.info || err.info.code !== CollectionCrudService._collisionErrorCode) {
                    await this.app.report('CollectionCrudService: Failed to create record', err, { schema: this.schema, collection: this.collection, data, info: err.info });
                }
                setImmediate(() => callback(err));
            })
            .finally(() => { if (!session) _session.close(); })
        ;
    }

    /**
     * Creates a document with automatic retry handling.
     * @param {*} data – Document data
     * @param {function(data:*, attempt:number)} objectClosure – Async function used to set the unique parts of the document that could cause collisions
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, doc:*?)} callback – Fired when completed
     * @returns {Promise<*>}
     */
    createWithRetry(data, objectClosure, options, callback) {
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
                    doc = await this.create(await objectClosure(data, i), options)
                } catch(err) {
                    if (err.info.code === CollectionCrudService._collisionErrorCode) {
                        if (this._createRetryCount === (i+1)) {
                            await this.app.report('CollectionCrudService: All attempts failed to create record due to collisions!', err, { schema: this.schema, collection: this.collection, data, info: err.info });
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
     * Retrieves a document from the collection by its id
     * @param {string} id – Unique id
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, doc:*?)} [callback] – Fired when completed
     * @returns {Promise<*>}
     */
    retrieve(id, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { session } = (options || {});

        if (id !== undefined && id !== null) {
            let _session;
            Promise
                .resolve(session ? session : this.service.getSession())
                .then(session => {
                    _session = session;
                    let instance = null;

                    let filter = `${this.idField} = :id`;
                    const args = { id };

                    if (this._concealDeadResources) {
                        filter += ` AND ${this.statusField} != :status`;
                        args.status = this._deletedStatus;
                    }

                    return session
                        .getSchema(this.schema)
                        .getCollection(this.collection)
                        .find(filter)
                        .bind(args)
                        .limit(1)
                        .execute(doc => {
                            instance = doc;
                        })
                        .then(() => instance)
                    ;
                })
                .then(result => {
                    setImmediate(() => callback(null, this._decode(result)));
                })
                .catch(async err => {
                    await this.app.report('CollectionCrudService: Failed to retrieve record', err, {
                        schema: this.schema,
                        collection: this.collection,
                        id,
                        info: err.info
                    });
                    setImmediate(() => callback(err));
                })
                .finally(() => { if (!session) _session.close(); })
            ;
        } else {
            callback(null, null);
        }
    }

    /**
     * Retrieves records from the collection that match the given criteria
     * @param {*} criteria - Query criteria expression
     * @param {{session: Session, skip:number?, take:number?, fields:*?, sort:*?, conceal:boolean?}} [options] – Optional options
     * @param {function(err:Error|null, docs:[*]?)} [callback] – Fired when completed
     * @returns {Promise<[*]>}
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

        const { session } = options;

        let where = [];
        let args = {};

        // Strip options out so we can stick them into the query builder
        let skip, limit, fields, sort, conceal = true;
        if (options.skip !== undefined) { skip = options.skip; delete options.skip; }
        if (options.take !== undefined) { limit = options.take; delete options.take; }
        if (options.fields !== undefined) { fields = options.fields; delete options.fields; }
        if (options.sort !== undefined) { sort = options.sort; delete options.sort; }
        if (options.conceal !== undefined) { conceal = options.conceal; delete options.conceal; }

        // Actively prevent dead resources from returning, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were even given criteria
            if (criteria) {

                // Check if we were given a status filter
                if (criteria[this.statusField]) {

                    // Composite both status requirements together
                    where.push(`${this.service.escapeIdentifier(this.statusField)} = :status AND ${this.service.escapeIdentifier(this.statusField)} != :notStatus`);
                    args.status = criteria[this.statusField];
                    args.notStatus = this._deletedStatus;

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
        this._buildCriteria(criteria || {}, where, args, true, 10);

        let fieldsExpression;
        let sortExpression;
        let limitExpression;

        // Build the fields clause
        if (fields !== undefined) {
            if (fields[this.idField] === undefined) {
                fields[this.idField] = 1;
            }
            fieldsExpression = Object.keys(fields).filter((field) => fields[field]);
        }

        // Handle order clause
        if (sort !== undefined) {
            sortExpression = Object.keys(sort).map((field) => {
                return `${field} ${sort[field] > 0 ? 'ASC' : 'DESC'}`
            });
        }

        // Handle limit clause
        if (skip !== undefined || limit !== undefined) {
            let cap = {
                offset: 0,
                limit: CollectionCrudService.MAX_VALUE
            };
            if (skip !== undefined) { cap.offset = skip; }
            if (limit !== undefined) { cap.limit = limit; }

            limitExpression = {
                count: cap.limit,
                offset: cap.offset
            };
        }

        let _session;
        Promise
            .resolve(session ? session : this.service.getSession())
            .then(session => {
                _session = session;
                let rows = [];

                let q = session
                    .getSchema(this.schema)
                    .getCollection(this.collection)
                    .find(where.length > 0 ? where.join(' AND ') : 'true');

                // where args
                if (Object.keys(args).length > 0) q = q.bind(args);

                // fields
                if (fieldsExpression) q = q.fields(fieldsExpression);

                // sort
                if (sortExpression) q = q.sort(sortExpression);

                // limit
                if (limitExpression && limitExpression.offset) q = q.offset(limitExpression.offset);
                if (limitExpression && limitExpression.count) q = q.limit(limitExpression.count);

                // Execute it
                return q
                    .execute(doc => {
                        rows.push(this._decode(doc));
                    })
                    .then((result) => {
                        Object.defineProperties(rows, {
                            result: {
                                enumerable: false,
                                value: result
                            }
                        });
                        return rows;
                    })
                ;
            })
            .then(rows => {
                setImmediate(() => callback(null, rows));
            })
            .catch(async err => {
                await this.app.report('CollectionCrudService: Failed to find records', err, {
                    schema: this.schema,
                    collection: this.collection,
                    criteria,
                    options,
                    where: where.length > 0 ? where.join(' AND ') /* istanbul ignore next: not worth a test */ : 'true',
                    args,
                    fieldsExpression,
                    sortExpression,
                    limitExpression,
                    info: err.info
                });
                setImmediate(() => callback(err));
            })
            .finally(() => { if (!session) _session.close(); })
        ;
    }

    /**
     * Converts the given criteria into where expressions for MySQL
     * @param {*} criteria - Query criteria expression
     * @param {[string]} where – Output array of string expressions
     * @param {*} args – Output bind arguments
     * @param {boolean} [equality] – Optional, whether to treat operator as == (true) or != (false)
     * @param {number} [counter] – Argument counter, incremented each time an argument is added
     * @returns {number} Updated argument counter value
     * @protected
     */
    _buildCriteria(criteria, where, args, equality = true, counter = 0) {
        // For each field present in the criteria
        Object.keys(criteria).forEach(async (field) => {
            const value = criteria[field];
            let expression;

            // Handle special types of values
            if (Array.isArray(value)) {
                // Arrays turn to WHERE (field != val AND field != val)... OR WHERE (field = val OR field = val)...
                expression = [];
                value.forEach((val) => {
                    expression.push(`${field} ${!equality ? '!=' : '='} :arg_${++counter}`);
                    args[`arg_${counter}`] = val;
                });
                where.push(`(${expression.join(!equality ? ' AND ' : ' OR ')})`);
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Buffer.isBuffer(value)) {
                // Value is an object, try to keep some similarity here between mongo
                const startingWhereLength = where.length;

                if (value.$ne) {
                    counter = this._buildCriteria({ [field]: value.$ne }, where, args, false, counter);
                }

                if (value.$gt) {
                    where.push(`${field} > :arg_${++counter}`);
                    args[`arg_${counter}`] = value.$gt;
                }

                if (value.$gte) {
                    where.push(`${field} >= :arg_${++counter}`);
                    args[`arg_${counter}`] = value.$gte;
                }

                if (value.$lt) {
                    where.push(`${field} < :arg_${++counter}`);
                    args[`arg_${counter}`] = value.$lt;
                }

                if (value.$lte) {
                    where.push(`${field} <= :arg_${++counter}`);
                    args[`arg_${counter}`] = value.$lte;
                }

                if (startingWhereLength === where.length) {
                    await this.app.report('CollectionCrudService: No object modifier set on object query criteria', { field, value });
                }
            } else {
                // Standard value
                where.push(`${field} ${!equality ? '!' : ''}= :arg_${++counter}`);
                args[`arg_${counter}`] = value;
            }
        });
        return counter;
    }

    /**
     * Counts the number of documents in the collection that meet the given criteria.
     * Warning – MySQL X protocol does not offer a COUNT(*) mechanism.
     *           This function is a cheap wrapper around _find, so why not just use _find yourself?
     * @param {*} criteria - Query criteria expression
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, count:number?)} [callback] – Fired when completed
     * @returns {Promise<number>}
     */
    count(criteria, options, callback) {

        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        this.find(criteria, options)
            .then((rows) => {
                callback(null, rows.length);
            })
            .catch(err => {
                callback(err);
            })
        ;
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
     * Updates a given document in the collection
     * @param {*} doc – Document to update
     * @param {*} data – Data to assign to doc, if keys are in this.modifiableKeys
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, doc:*?)} [callback] – Fired when completed
     * @returns {Promise<*>}
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

        const { session } = (options || {});

        // Apply any given key updates, if given
        this._applyUpdates(doc, data);

        // Ensure when you update an object, no matter what it is, we update our auditing field
        if (this.updatedField) doc.updated = new Date();

        // Make sure we know what we are updating!
        if (doc[this.idField] === undefined) {
            this.app.report('CollectionCrudService: Cannot update row if id field not provided!', { doc, data, idField: this.idField }).then(() => {
                // noinspection JSUnresolvedFunction
                callback(new Error('CollectionCrudService: Cannot update row if id field not provided'), null);
            })
        } else {

            let _session;
            Promise
                .resolve(session ? session : this.service.getSession())
                .then(session => {
                    _session = session;

                    let q = session
                        .getSchema(this.schema)
                        .getCollection(this.collection)
                        .modify(`${this.idField} = :id`)
                        .bind({ id: doc[this.idField] });

                    // Set given fields
                    const encodedDoc = this._encode(doc);
                    delete encodedDoc[this.idField];
                    Object.keys(encodedDoc).forEach((field) => {
                        q.set(field, encodedDoc[field])
                    });

                    // Execute it
                    return q
                        .execute()
                        .then((/*result*/) => {
                            // TODO - consider re-retrieving the record instead of returning the doc
                            return doc;
                        })
                    ;
                })
                .then(doc => {
                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(null, doc));
                })
                .catch(async err => {
                    await this.app.report('CollectionCrudService: Failed to update record', err, {
                        schema: this.schema,
                        collection: this.collection,
                        doc,
                        options,
                        info: err.info
                    });
                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(err));
                })
                .finally(() => { if (!session) _session.close(); })
            ;
        }
    }

    /**
     * Updates all documents that meet the given criteria.
     * @param {*} criteria – Filter query expression
     * @param {*} data - Properties to assign to matched documents
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, result:Result?)} [callback] – Fired when completed
     * @returns {Promise<Result>}
     */
    bulkUpdate(criteria, data, options, callback) {
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

        let where = [];
        let args = {};

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`${this.service.escapeIdentifier(this.statusField)} = :status AND ${this.service.escapeIdentifier(this.statusField)} != :notStatus`);
                args.status = criteria[this.statusField];
                args.notStatus = this._deletedStatus;

                // Remove the original status filter from criteria
                delete criteria[this.statusField];

            } else {
                // No status given, default it to conceal dead things
                criteria[this.statusField] = { $ne: this._deletedStatus };
            }
        }

        // Build the query where args
        this._buildCriteria(criteria, where, args, true, 10);

        let _session;
        Promise
            .resolve(session ? session : this.service.getSession())
            .then(session => {
                _session = session;

                let q = session
                    .getSchema(this.schema)
                    .getCollection(this.collection)
                    .modify(where.length > 0 ? where.join(' AND ') : 'true')
                ;

                // where args
                if (Object.keys(args).length > 0) q = q.bind(args);

                // Set given fields
                const encodedDoc = this._encode(data);
                delete encodedDoc[this.idField];
                Object.keys(encodedDoc).forEach((field) => {
                    q.set(field, encodedDoc[field])
                });

                // Execute it
                return q
                    .execute()
                    .then((result) => {
                        return result;
                    })
                ;
            })
            .then(result => {
                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(null, result));
            })
            .catch(async err => {
                await this.app.report('CollectionCrudService: Failed to bulk update records', err, {
                    schema: this.schema,
                    collection: this.collection,
                    data,
                    options,
                    info: err.info
                });
                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(err));
            })
            .finally(() => { if (!session) _session.close(); })
        ;
    }

    /**
     * Tombstones a document in the collection. Its status is changed to this._deletedStatus, but is not deleted.
     * @param {*} doc - Document to delete
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, doc:*?)} [callback] – Fired when completed
     * @returns {Promise<*>}
     */
    delete(doc, options, callback) {
        doc.status = this._deletedStatus;
        return this.update(doc, null, options, (err, doc) => {
            callback(err, doc);
        });
    }

    /**
     * Tombstones documents that meet the given criteria. Their status is changed but is not deleted.
     * @param {*} criteria – Filter query expression
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, result:Result?)} [callback] – Fired when completed
     * @returns {Promise<Result>}
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
     * Permanently deletes a document from the collection. They are physically removed, gone for good.
     * @param {*} doc – Document to delete
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, result:*?)} [callback] – Fired when completed
     * @returns {Promise<*>}
     */
    deletePermanently(doc, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const { session } = (options || {});

        // Make sure we know what we are updating!
        if (doc[this.idField] === undefined) {
            this.app.report('CollectionCrudService: Cannot perma-delete row if id field not provided!', { doc, idField: this.idField }).then(() => {
                // noinspection JSUnresolvedFunction
                callback(new Error('CollectionCrudService: Cannot perma-delete row if id field not provided'), null);
            });
        } else {

            let _session;
            Promise
                .resolve(session ? session : this.service.getSession())
                .then(session => {
                    _session = session;

                    return session
                        .getSchema(this.schema)
                        .getCollection(this.collection)
                        .remove(`${this.idField} = :id`)
                        .bind({ id: doc[this.idField] })
                        .execute()
                        .then((/*result*/) => {
                            return doc;
                        })
                    ;
                })
                .then(doc => {
                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(null, doc));
                })
                .catch(async err => {
                    await this.app.report('CollectionCrudService: Failed to perma-delete record', err, {
                        schema: this.schema,
                        collection: this.collection,
                        doc,
                        options,
                        info: err.info
                    });
                    // noinspection JSUnresolvedFunction
                    setImmediate(() => callback(err));
                })
                .finally(() => { if (!session) _session.close(); })
            ;
        }
    }

    /**
     * Permanently deletes documents that meet the given criteria. They are physically removed, gone for good.
     * @param {*} criteria – Filter query expression
     * @param {{session: Session}} [options] – Optional options
     * @param {function(err:Error|null, result:Result?)} [callback] – Fired when completed
     * @returns {Promise<Result>}
     */
    bulkDeletePermanently(criteria, options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const { session, conceal = true } = (options || {});

        // Normalize criteria
        criteria = criteria || {};

        let where = [];
        let args = {};

        // Actively prevent dead resources from updating, even if a status was given
        if (this._concealDeadResources && conceal) {

            // Check if we were given a status filter
            if (criteria[this.statusField]) {

                // Composite both status requirements together
                where.push(`${this.service.escapeIdentifier(this.statusField)} = :status AND ${this.service.escapeIdentifier(this.statusField)} != :notStatus`);
                args.status = criteria[this.statusField];
                args.notStatus = this._deletedStatus;

                // Remove the original status filter from criteria
                delete criteria[this.statusField];

            } else {
                // No status given, default it to conceal dead things
                criteria[this.statusField] = { $ne: this._deletedStatus };
            }
        }

        // Build the query where args
        this._buildCriteria(criteria, where, args, true, 10);

        let _session;
        Promise
            .resolve(session ? session : this.service.getSession())
            .then(session => {
                _session = session;

                let q = session
                    .getSchema(this.schema)
                    .getCollection(this.collection)
                    .remove(where.length > 0 ? where.join(' AND ') : 'true')
                ;

                // where args
                if (Object.keys(args).length > 0) q = q.bind(args);

                // Execute it
                return q
                    .execute()
                    .then((result) => {
                        return result;
                    })
                ;
            })
            .then(result => {
                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(null, result));
            })
            .catch(async err => {
                await this.app.report('CollectionCrudService: Failed to bulk perma-delete records', err, {
                    schema: this.schema,
                    collection: this.collection,
                    options,
                    info: err.info
                });
                // noinspection JSUnresolvedFunction
                setImmediate(() => callback(err));
            })
            .finally(() => { if (!session) _session.close(); })
        ;
    }

}

/**
 * Generates a new _id value for a document. Useful for MySQL 5.7, which does not support server-generated _ids.
 * @returns {string}
 */
CollectionCrudService.generateId = () => {
    // TODO: Consider changing algorithm
    // According to the MySQL docs, this should be a sequential id for INNODB index performance.
    // However, that defeats the purpose of non-enumerable identifiers, doesn't it?
    // See: https://dev.mysql.com/doc/x-devapi-userguide/en/understanding-automatic-document-ids.html
    return Base58.bytesToHex(Base58.generateBytes(16));
};

/**
 * MySQL collision error code
 * @type {number}
 * @static
 */
CollectionCrudService._collisionErrorCode = 5116; // Document contains a field value that is not unique but required to be

/**
 * ISO datetime format for converting document properties back into Date objects
 * @type {RegExp}
 * @private
 */
CollectionCrudService._iso8601DatePattern = /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;

/**
 * Maximum number of rows in a MySQL table, used for offset LIMIT statements with no page size
 */
CollectionCrudService.MAX_VALUE = Number.MAX_SAFE_INTEGER; // FIXME: protobuf craps when you try to use this value '18446744073709551615';

module.exports = CollectionCrudService;