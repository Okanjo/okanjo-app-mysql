"use strict";

const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '33060';
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
    }

};