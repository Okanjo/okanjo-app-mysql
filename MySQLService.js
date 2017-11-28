"use strict";

const mysql = require('mysql');

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

        app._serviceConnectors.push((cb) => this.connect(cb));
    }

    /**
     * Connects to the MySQL database, and initializes the connection pool
     * @param callback
     */
    connect(callback) {
        // Luckily, all we have to do here is define the pool
        this.pool = mysql.createPool(this.config);

        // Not really async, cuz the connection will be obtained on demand
        callback();
    }

    /**
     * Shortcut to issue a query to MySQL using any available connection
     * @param {string} query
     * @param {Object} [options]
     * @param callback
     */
    query(query, options, callback) {
        // Pull args sent here
        const args = Array.prototype.slice.call(arguments);

        // Intercept and wrap the original callback
        if (typeof args[args.length-1] === "function") {
            const originalCallback = args[args.length-1];
            args[args.length-1] = function(err, res) {
                const callbackArgs = Array.prototype.slice.call(arguments);

                // Intercept and report query errors!
                if (err) {
                    this.app.report('MySQL Query Error!', err, res, args);
                }

                originalCallback.apply(null, callbackArgs);
            }.bind(this);
        }

        this.pool.query.apply(this.pool, args);
    }

    /**
     * Shortcut to get an exclusive connection from the pool (e.g. for transactions). DON'T FORGET TO `connection.release()`!
     * @param callback
     */
    getConnection(callback) {
        this.pool.getConnection((err, connection) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('MySQL Pool: Could not get connection!', err);
            }
            callback(err, connection);
        });
    }
}

module.exports = MySQLService;