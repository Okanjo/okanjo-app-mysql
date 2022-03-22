"use strict";

const debug = require('debug')('mysqlservice');
const MySQL = require('@mysql/xdevapi');
const Column = require('@mysql/xdevapi/lib/DevAPI/Column');

/**
 * MYSQL Database service
 */
class MySQLService {

    /**
     * Constructor
     * @param {OkanjoApp} app
     * @param {Object} config
     */
    constructor(app, config) {
        this.app = app;
        this.config = config;

        // No config = no dice.
        if (!this.config) {
            throw new Error('MySQLService: `config` must be defined on initialization!');
        }

        if (!this.config.session) {
            throw new Error('MySQLService: `config.session` must be defined on initialization!');
        }

        // if (!this.config.client) {
        //     throw new Error('MySQLService: `config.client` must be defined on initialization!');
        // }

        app._serviceConnectors.push(async () => this.connect());
    }

    /**
     * Connects to the MySQL database, and initializes the connection pool
     */
    async connect() {
        // Luckily, all we have to do here is define the pool
        debug('Starting connection pool');
        try {
            this.client = MySQL.getClient(this.config.session, this.config.client);
        } catch(err) {
            await this.app.report('Failed to setup connection to MySQL', err);
            this.client = null;
            throw err;
        }
    }

    /**
     * Closes down the connection pool.
     * @returns {Promise<void>}
     */
    async close() {
        debug('Closing connection pool');
        if (this.client) await this.client.close();
    }

    // noinspection JSMethodCanBeStatic
    /**
     * Escapes a schema or field name
     * @param {string} str – Identifier
     * @returns {string} Escaped value that can safely go into a quoted string
     */
    escapeIdentifier(str) {
        return (str || '')
            .replace(/\\\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/`/g, '``')
        ;
    }

    /**
     * Converts query arguments into MySQL format (e.g. Date -> string)
     * @param {[*]} args – Query arguments
     * @returns {[*]} – Encoded query arguments
     */
    encodeParams(args) {
        return args.map((val) => {
            // Convert Date objects into MySQL date strings
            if (val instanceof Date) {
                return val.toISOString().replace(/(T|\..*$)/g, ' ').trim();
            } else {
                return val;
            }
        });
    }

    /**
     * Converts raw mysql row values back into native JavaScript types (e.g. timestamp -> Date)
     * @param {[*]} args – Row values
     * @param {[Column]} cols – Table Column objects
     * @returns {[*]} – Decoded row values
     */
    decodeParams(args, cols) {
        return args.map((val, i) => {
            if (cols[i].getType() === Column.Type.DATETIME) { // DATETIME
                return new Date(val);
            } else {
                return val;
            }
        });
    }

    /**
     * Query Execution wrapper
     * @param {SqlExecute} query – mysqlx session.sql() query object
     * @param {{supress:number?}} options – Execution functionality options
     * @returns {Promise<any>}
     */
    execute(query, options={}) {
        return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
            const records = []; // raw records received by the driver
            let cols = [];      // raw metadata about the records (e.g. columns)
            let rows = [];      // transformed rows to objects
            let res;            // query response to get additional info about the query

            try {
                debug('Executing query:\n%s\nArguments:\n%O',
                    query.getSQL(),
                    query
                );
                res = await query.execute(
                    row => records.push(row),
                    colGroup => cols = cols.concat(colGroup)
                );
                debug('Query completed');

                rows = records.map((raw) => {
                    const row = {};
                    let col;
                    this.decodeParams(raw, cols).forEach((val, i) => {
                        col = cols[i];
                        row[col.getColumnLabel() || /* istanbul ignore next: old driver compatibility */ col.getColumnName()] = val;
                        // console.log(col)
                    });
                    return row;
                });
            } catch(err) {
                if (!options.suppress || options.suppress !== err.info.code) {
                    await this.app.report('MySQLService: Error executing query', err, {
                        query,
                        sql: query.getSQL ? query.getSQL() : /* istanbul ignore next: idk if this is safe, so checking method is present before firing it  */ null,
                        info: err.info,
                    });
                }
                return reject(err);
            }

            // Expose additional query data, without compromising default functionality
            Object.defineProperties(rows, {
                raw: {
                    enumerable: false,
                    value: records
                },
                result: {
                    enumerable: false,
                    value: res
                },
                cols: {
                    enumerable: false,
                    value: cols
                }
            });

            return resolve(rows);
        });
    }

    /**
     * Issues a SQL query with parameterized arguments.
     * @param {string} sql – Query string
     * @param {Object} [args] – Query ordinal argument values
     * @param {function(err:*, res:*?)} [callback] – Optional callback to fire when completed
     * @param {{session:*?, suppress:number?}} [options] – Query functionality options
     * @returns {Promise<{rows:*}>}
     */
    query(sql, args, callback, options) {
        return new Promise((resolve, reject) => {
            let resolveSession;

            // args is optional
            if (typeof args === "function") {
                options = callback;
                callback = args;
                args = null;
            }

            // if a session was given, resolve it otherwise fetch a new session from the pool
            if (options && options.session) {
                debug('Using supplied session for query');
                resolveSession = Promise.resolve(options.session);
            } else {
                debug('Getting a new session for query');
                try {
                    resolveSession = this.client.getSession();
                } catch (err) /* istanbul ignore next: oos */ {
                    this.app.report('Failed to get session on MySQL client', err);
                    return reject(err);
                }
            }

            let session;
            let error;
            let response;

            resolveSession
                .then(sess => {
                    // hold session
                    session = sess;

                    // generate query
                    const query = session.sql(sql);

                    // bind query ordinal placeholders
                    if (args) query.bind(this.encodeParams(args));

                    // execute the query
                    return this.execute(query, options)
                        .then(res => {
                            debug('Query succeeded');
                            response = res;
                            error = null;
                        }, /* istanbul ignore next: oos */ err => {
                            debug('Query failed', err);
                            error = err;
                            response = null;
                        })
                    ;
                }, /* istanbul ignore next: oos */ err => {
                    this.app.report('Failed to resolve session', err);
                    error = err;
                })
                .finally(() => {
                    // close the session if one was pulled for this operation
                    if (session && (!options || !options.session)) {
                        debug('Closing query session');
                        session.close();
                    }

                    if (callback) {
                        callback(error, response);
                        resolve(); // callback disables rejections
                    } else {
                        if (error) return reject(error);
                        return resolve(response)
                    }
                })
            ;
        });
    }

    /**
     * Gets a fresh session from the pool
     * @returns {*|Promise<Session>}
     */
    getSession() {
        return this.client.getSession();
    }
}

module.exports = MySQLService;