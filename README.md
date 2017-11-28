# Okanjo MySQL Service

[![Build Status](https://travis-ci.org/Okanjo/okanjo-app-mysql.svg?branch=master)](https://travis-ci.org/Okanjo/okanjo-app-mysql) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app-mysql/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app-mysql?branch=master)

Service for interfacing with MySQL for the Okanjo App ecosystem.

## Installing

Add to your project like so: 

```sh
npm install okanjo-app-mysql
```

Note: requires the [`okanjo-app`](https://github.com/okanjo/okanjo-app) module.

## Example Usage

Here's an example app that demonstrates using several features of the module.

* `example-app`
  * `config.js`
  * `index.js`
  

### `example-app/config.js`
This is a basic configuration for the mysql service

```js
"use strict";

// Ordinarily, you would set normally and not use environment variables,
// but this is for ease of running the example across platforms
const host = process.env.MYSQL_HOST || '192.168.99.100';
const port = process.env.MYSQL_PORT || '3306';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASS || 'unittest';
const database = process.env.MYSQL_DB || undefined;

//noinspection JSUnusedGlobalSymbols
module.exports = {

    mysql: {
        connectionLimit : 10,
        host,
        port,
        user,
        password,
        database // e.g. default `use database <name>`, if set
    }

};
```

### `example-app/index.js`
Example app that creates a database and a table, inserts into the table, queries the table, and deletes the database when done.

```js
"use strict";

const OkanjoApp = require('okanjo-app');
const MySQLService = require('okanjo-app-mysql');

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
                app.services.mysql.query(`SELECT * FROM my_database.my_table WHERE id = 1;`, (err, res) => {
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
```

The output of the application should look something like this:
```text
Creating database...
Creating table...
Inserting records...
Selecting record...
 * Row id: 1, name: apples
Dropping database...
DONE!
```

A runnable version of this application can be found in [docs/example-app](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs/example-app).


# MySQLService

MySQL management class. Must be instantiated to be used.

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.config` – (read-only) The mysql service configuration provided when constructed
* `service.pool` – (read-only) The underlying [mysqljs/mysql](https://github.com/mysqljs/mysql) connection pool 

## Methods

### `new MySQLService(app, [config])`
Creates a new mysql service instance.
* `app` – The OkanjoApp instance to bind to
* `config` – (Required) The mysql service configuration object.
  * The configuration extends the [mysqljs/mysql](https://github.com/mysqljs/mysql#connection-options) connection pool configuration. See there for additional options.
  * `config.host` – Server hostname or ip address
  * `config.port` – Server port
  * `config.user` – Username to login as 
  * `config.password` – Password for the user 
  * `config.database` – (optional) Sets the context database if given. 

### `service.query(query, [options,] callback)`
Executes a query on the connection pool. See [mysqljs/mysql](https://github.com/mysqljs/mysql#performing-queries) for more query options.
* `query` – String or object query to execute
* `options` – (optional) Query arguments, such as values for prepared statements
* `callback(err, results, fields)`– Function to fire when query completes
  * `err` – Error if applicable
  * `results` – The rows or result of the query
  * `fields` – The fields contained in the results

### `service.getConnection(callback)`
Gets a dedicated connection from the pool. You must release it back to the pool when you are finished with it.
* `callback(err, connection)` – Function to fire when connection has been obtained
  * `err` – Error if there was an issue getting the connection from the pool
  * `connection` – The dedicated [mysqljs/mysql]() connection
  
Note: You must call `connection.release();` when you have finished using the connection to return it back to the pool.

## Events

This class does not emit events

## Extending and Contributing 

Our goal is quality-driven development. Please ensure that 100% of the code is covered with testing.

Before contributing pull requests, please ensure that changes are covered with unit tests, and that all are passing. 

### Testing

Before you can run the tests, you'll need a working MySQL server. We suggest using docker.

For example:

```bash
docker pull mysql:5
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=unittest mysql:5
```

To run unit tests and code coverage:
```sh
MYSQL_HOST=192.168.99.100 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASS=unittest npm run report
```

Update the `MYSQL_*` environment vars to match your docker host (e.g. host, port, user, pass etc)

This will perform:
* Unit tests
* Code coverage report
* Code linting

Sometimes, that's overkill to quickly test a quick change. To run just the unit tests:
 
```sh
npm test
```

or if you have mocha installed globally, you may run `mocha test` instead.
