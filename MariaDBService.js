"use strict";

const debug = require('debug')('mariadbservice');
const MariaDB = require('mariadb');

/**
 * MYSQL Database service
 */
class MariaDBService {

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

        app.registerServiceConnector(async () => this.connect());
    }

    /**
     * Connects to the MariaDB database, and initializes the connection pool
     */
    async connect() {
        // Luckily, all we have to do here is define the pool
        debug('Starting connection pool');
        this.pool = MariaDB.createPool(this.config);
    }

    /**
     * Closes down the connection pool.
     * @returns {Promise<void>}
     */
    async close() {
        debug('Closing connection pool');
        if (this.pool) await this.pool.end();
    }

    /**
     * Issues a SQL query with parameterized arguments.
     * @param {string} sql – Query string
     * @param {[*]} [args] – Query argument values
     * @param {function(err:*, res:*?)} [callback] – Optional callback to fire when completed
     * @param {{connection:*?, suppress:number?}} [options] – Query functionality options
     * @returns {Promise<*>}
     */
    query(sql, args, callback, options) { // eslint-disable-line no-unused-vars
        return new Promise((resolve, reject) => {

            // Decipher args
            let _sql, _args, _callback, _options, _err;
            Array.from(arguments).forEach((arg, i) => {
                if (!_sql && typeof arg === "string") {
                    _sql = arg;
                } else if (!_args && Array.isArray(arg)) {
                    _args = arg;
                } else if (!_callback && typeof arg === "function") {
                    _callback = arg;
                } else if (!_options && typeof arg === "object" && arg !== null) {
                    _options = arg;
                } else {
                    _err = new Error(`MariaDBService: Invalid argument position=${i}, type=\`${typeof arg}\`. Expected: sql=string, args=array, callback=function, options=object`);
                }
            });

            // Throw invalid argument error
            if (_err) {
                this.app.report('MariaDBService: Failed to execute query', _err, { sql: _sql, args: _args, options: _options });
                if (_callback) return setImmediate(() => _callback(_err));
                return reject(_err);
            }

            _options = _options || {};

            let { connection, suppress } = _options;

            // if a session was given, resolve it otherwise fetch a new session from the pool
            let resolveConnection;
            if (_options && _options.connection) {
                debug('Using supplied connection for query');
                resolveConnection = Promise.resolve(_options.connection);
            } else {
                debug('Getting a connection from the pool');
                resolveConnection = this.getConnection();
            }

            resolveConnection
                .then(conn => {
                    // hold session
                    connection = conn;

                    // execute the query
                    debug('Executing query:\n%s\nArguments:\n%O', _sql, _args);
                    return connection.query(_sql, _args);
                })
                .then(res => {

                    // Keep meta, but hide it from enumeration
                    const meta = res.meta;
                    delete res.meta;
                    Object.defineProperty(res, 'meta', {
                        enumerable: false,
                        value: meta
                    });

                    debug('Query completed');

                    // return the results if successful
                    if (_callback) return setImmediate(() => _callback(null, res));
                    return resolve(res);
                })
                .catch(async err => {
                    // Report error if not suppressed
                    if (!suppress || err.errno !== suppress) {
                        debug('Query failed');
                        await this.app.report('MariaDBService: Failed to execute query', err, { sql: _sql, args: _args, options: _options });
                    }

                    if (_callback) return setImmediate(() => _callback(err));
                    return reject(err);
                })
                .finally(() => {
                    // release the connection back to the pool if generated for this query
                    if (connection && (!_options || !_options.connection)) {
                        debug('Releasing connection back to the pool');
                        return connection.end();
                    }
                })
            ;
        });
    }

    /**
     * Gets a fresh connection from the pool
     * @returns {*|Promise<Connection>}
     */
    getConnection() {
        return this.pool.getConnection()
    }
}

module.exports = MariaDBService;