"use strict";

const MySQL = require('mysql');

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

        app._serviceConnectors.push(async () => this.connect());
    }

    /**
     * Connects to the MySQL database, and initializes the connection pool
     */
    async connect() {
        // Luckily, all we have to do here is define the pool
        this.pool = MySQL.createPool(this.config);
    }

    /**
     * Shortcut to issue a query to MySQL using any available connection
     * @param {string} query
     * @param {Object} [options]
     * @param {function(err:*, results:*, fields:*)} [callback]
     * @returns {Promise<{results:*,fields:*}>}
     */
    query(query, options, callback) {
        return this.wrapQuery(this.pool, query, options, callback);
    }

    /**
     * Wrap a connection.query with a promise
     * @param {*} connection
     * @param {string} query
     * @param {*} [options]
     * @param {function} [callback]
     * @returns {Promise<{results:*,fields:*}>}
     */
    wrapQuery(connection, query, options, callback) {
        return new Promise((resolve, reject) => {

            if (typeof options === "function") {
                callback = options;
                options = undefined;
            }
            if (!options) {
                options = undefined;
            }

            // Fire the query
            connection.query(query, options, async (err, results, fields) => {

                // Intercept and report query errors!
                if (err) {
                    await this.app.report('MySQLService: Query error', err, { query, options, results, fields });
                    if (callback) { // noinspection JSUnresolvedFunction
                        return callback(err);
                    }
                    return reject(err);
                } else {
                    if (callback) { // noinspection JSUnresolvedFunction
                        return callback(null, {results, fields});
                    }
                    return resolve({ results, fields});
                }
            });
        });
    }

    /**
     * Shortcut to get an exclusive connection from the pool (e.g. for transactions). DON'T FORGET TO `connection.release()`!
     */
    async getConnection(callback) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection(async (err, connection) => {
                /* istanbul ignore if: out of scope */
                if (err) {
                    await this.app.report('MySQLService: Could not get connection from pool!', err);
                    if (callback) return callback(err);
                    return reject(err);
                } else {
                    if (callback) return callback(null, connection);
                    return resolve(connection);
                }
            });
        });
    }
}

module.exports = MySQLService;