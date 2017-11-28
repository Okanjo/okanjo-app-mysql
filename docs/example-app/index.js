"use strict";

const OkanjoApp = require('okanjo-app');
// const MySQLService = require('okanjo-app-mysql');
const MySQLService = require('../../MySQLService');

const config = require('./config');
const app = new OkanjoApp(config);

app.services = {
    mysql: new MySQLService(app, app.config.mysql)
};

app.connectToServices(() => {

    // In this example, we wil:
    // - Make a database
    // - Make a table
    // - Insert a record
    // - Query the record
    // - Delete the database

    // - Make a database
    console.log('Creating database...');
    app.services.mysql.query(`CREATE DATABASE my_database;`, (err) => {
        if (err) throw err;

        // - Make a table
        console.log('Creating table...');
        app.services.mysql.query(`
        CREATE TABLE my_database.my_table (
            id INT UNSIGNED NOT NULL PRIMARY KEY,
            name VARCHAR(255) NULL DEFAULT null
        );`, (err) => {
            if (err) throw err;

            // - Insert a record
            console.log('Inserting records...');
            app.services.mysql.query(`
            INSERT INTO my_database.my_table (id, name) VALUES 
                (1, 'apples'),
                (2, 'grapes')
            ;`, (err) => {
                if (err) throw err;

                // - Query the record
                console.log('Selecting record...');
                app.services.mysql.query(`SELECT * FROM my_database.my_table WHERE id = ?;`, [ 1 ], (err, res) => {
                    if (err) throw err;

                    console.log(' * Row id: %d, name: %s', res[0].id, res[0].name);

                    // - Delete the database
                    console.log('Dropping database...');
                    app.services.mysql.query(`DROP DATABASE my_database;`, (err) => {
                        if (err) throw err;

                        console.log('DONE!');
                        process.exit(0);
                    });
                });
            });
        });
    });
});