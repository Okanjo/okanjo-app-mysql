"use strict";

const MySQL = require('mysql'); // for type extraction
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
    await app.services.mysql.query(`DROP DATABASE IF EXISTS ??;`, [databaseName]);
    await app.services.mysql.query(`CREATE DATABASE ??;`, [databaseName]);

    // - Make a table
    console.log('Creating table...');
    await app.services.mysql.query(`
        CREATE TABLE ??.?? (
            id INT UNSIGNED NOT NULL PRIMARY KEY,
            name VARCHAR(255) NULL DEFAULT null
        )`,
        [databaseName, tableName]
    );

    // - Insert records
    console.log('Inserting records...');
    await app.services.mysql.query(
        `INSERT INTO ??.?? (id, name) VALUES ?;`,
        [databaseName, tableName, [
            [1, 'apples'],
            [2, 'grapes']
        ]]
    );

    // - Show the records
    console.log('Selecting all records...');
    let { results, fields } = await app.services.mysql.query(`SELECT * FROM ??.??`, [databaseName, tableName]);
    results.forEach((row) => {
        console.log(' * Row id: %d, name: %s', row.id, row.name);
    });

    console.log('Fields:');
    const typeToName = (type) => Object.keys(MySQL.Types).find((key) => MySQL.Types[key] === type);
    fields.forEach((field) => {
        console.log(' * %s.%s.%s -> %s(%d)', field.db, field.table, field.name, typeToName(field.type), field.length)
    });

    // - Query for a specific record
    console.log('Selecting record #1...');
    ({ results } = await app.services.mysql.query(`SELECT * FROM ??.??WHERE id = ?;`, [ databaseName, tableName, 1 ]));

    console.log(' * Row id: %d, name: %s', results[0].id, results[0].name);

    // - Delete the database
    console.log('Dropping database...');
    await app.services.mysql.query(`DROP DATABASE ??;`, databaseName);

    console.log('DONE!');
    process.exit(0);
});