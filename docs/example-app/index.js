"use strict";

const OkanjoApp = require('okanjo-app');
// const MySQLService = require('okanjo-app-mysql');
const MySQLService = require('../../MySQLService');

const config = require('./config');
const app = new OkanjoApp(config);

app.services = {
    mysql: new MySQLService(app, app.config.mysql)
};

app.connectToServices().then(async () => {

    // In this example, we wil:
    // - Make a database
    // - Make a table
    // - Insert records
    // - Show the records
    // - Query for a specific record
    // - Delete the database

    const databaseName = 'my_database';
    const tableName = 'my_table';

    // - Make a database
    console.log('Creating database...');
    await app.services.mysql.query(`DROP DATABASE IF EXISTS ${databaseName};`);
    await app.services.mysql.query(`CREATE DATABASE ${databaseName};`);

    // - Make a table
    console.log('Creating table...');
    await app.services.mysql.query(`
        CREATE TABLE ${databaseName}.${tableName} (
            id INT UNSIGNED NOT NULL PRIMARY KEY,
            name VARCHAR(255) NULL DEFAULT null
        )`
    );

    // - Insert records
    console.log('Inserting records...');
    await app.services.mysql.query(
        `INSERT INTO ${databaseName}.${tableName} (id, name) VALUES 
            (?, ?),
            (?, ?);`,
        [
            1, 'apples',
            2, 'grapes'
        ]
    );

    // - Show the records
    console.log('Selecting all records...');
    let rows = await app.services.mysql.query(`SELECT * FROM ${databaseName}.${tableName}`);
    rows.forEach((row) => {
        console.log(' * Row id: %d, name: %s', row.id, row.name);
    });

    // You have access to the Result object:
    console.log(' * Warnings: %d', rows.result.getWarningsCount());

    // You also have access to the result columns
    console.log('Columns:');
    rows.cols.forEach(col => {
        console.log(' * %s.%s.%s, length = %d', col.schema, col.table, col.name, col.length);
    });

    // - Query for a specific record
    console.log('Selecting record #1...');
    rows = await app.services.mysql.query(`SELECT * FROM ${databaseName}.${tableName} WHERE id = ?;`, [ 1 ]);

    console.log(' * Row id: %d, name: %s', rows[0].id, rows[0].name);

    // - Delete the database
    console.log('Dropping database...');
    await app.services.mysql.query(`DROP DATABASE ${databaseName};`);

    console.log('DONE!');
    await app.services.mysql.close();
});