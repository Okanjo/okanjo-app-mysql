"use strict";

// Ordinarily, you would set normally and not use environment variables,
// but this is for ease of running the example across platforms
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MARIA_PORT ||  process.env.MYSQL_PORT || '3306';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASS || 'unittest';
const schema = process.env.MYSQL_DB || undefined;

//noinspection JSUnusedGlobalSymbols
module.exports = {

    mariadb: {
        user,
        password,
        host,
        port: port,
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

};