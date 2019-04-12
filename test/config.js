"use strict";

const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '33060';
const mariaPort = process.env.MARIA_PORT || '3308';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASS || 'unittest';
const schema = process.env.MYSQL_DB || undefined;
const generateIds = process.env.GENERATE_IDS==='1' || port === '33060';

//noinspection JSUnusedGlobalSymbols
module.exports = {

    mysql: {
        my_database: {
            session: {
                host,
                port,
                user,
                password,
                schema
            },
            client: {
                pooling: {
                    enabled: true,
                    maxSize: 25,        // max num of active connections
                    maxIdleTime: 0,     // in ms, 0=infinite, how long a connection can be idle
                    queueTimeout: 0     // in ms, 0=infinite, how long to wait for an available conn from pool
                }
            },
            generateIds
        },
    },

    mariadb: {
        my_database: {
            user,
            password,
            host,
            port: mariaPort,
            database: schema,
            acquireTimeout: 10000,      // Timeout to get a new connection from pool in ms.
            connectionLimit: 25,        // Max num of active connections
            minDelayValidation: 500,    // When asking a connection to pool, the pool will validate the connection state.
                                        //  "minDelayValidation" permits disabling this validation if the connection has
                                        //  been borrowed recently avoiding useless verifications in case of frequent
                                        //  reuse of connections. 0 means validation is done each time the connection
                                        //  is asked. (in ms)
            connectTimeout: 10000,      // Sets the connection timeout in milliseconds.
            socketTimeout: 0,           // Sets the socket timeout in milliseconds after connection succeeds.
                                        // A value of 0 disables the timeout.
        }
    }

};