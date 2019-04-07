"use strict";

const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '3306';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASS || 'unittest';
const database = process.env.MYSQL_DB || undefined;

//noinspection JSUnusedGlobalSymbols
module.exports = {

    mysql: {
        my_database: {
            connectionLimit : 10,
            host,
            port,
            user,
            password,
            database
        }
    }

};