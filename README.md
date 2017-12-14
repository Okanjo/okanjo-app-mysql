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

This class does not emit events.


# CrudService

Base class for building services based on a MySQL table. The idea of using CrudService is to:
 * Stop duplicating logic across every single service you have to write (CRUDL)
 * Automatically handle and report errors on common operations so you don't need to in the business logic
 * Provide base functions that can be optionally used in the service when exposed as whatever names you like
   * This also allows you to hook-in logic on various events (e.g. when service.delete is called, do something special)
 * Conceal deleted rows without actually deleting them
   * We don't like to permanently delete data. Instead, we like to leave tombstones behind so we can audit before cleaning up later. This is also very handy for syncing to data lakes. Do you know what rows were deleted in the last 15 minutes?
   * When a row is deleted, its `status` column is just set to `dead`. 
   * The `_find`, `_retrieve`, `_bulkUpdate`, `_bulkDelete` and `_bulkPermanentlyDelete` helpers automatically deal with dead rows, pretending like they were really deleted.

Note: you should extend this class to make it useful!

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.service` – (read-only) The MySQLService instance managing the connection pool
* `service.database` – (read-only) The string name of the database the table is in 
* `service.table` – (read-only) The string name of the table this service is treating as a resource collection
* `service.idField` – (read-only) The field that is expected to be unique, like a single-column primary key.
* `service.statusField` – (read-only) The field that is used for row status, such as `dead` statuses
* `service.updatedField` – (read-only) The field that is automatically set to `new Date()` when updating
* `service._createRetryCount` – (read-only) How many times a `_createWithRetry` method can attempt to create a doc before giving up 
* `service._modifiableKeys` – (read-only) What column names are assumed to be safe to copy from user-data
* `service._deletedStatus` – (read-only) The status to set docs to when "deleting" them
* `service._concealDeadResources` – (read-only) Whether this service should actively prevent "deleted" (status=dead) resources from returning in _retrieve and _find  

## Methods

### `new CrudService(app, options)`
Creates a new instance. Ideally, you would extend it and call it via `super(app, options)`.
* `app` – The OkanjoApp instance to bind to
* `options` – Service configuration options
  * `options.service` – (Required) The MySQLService instance managing the connection pool
  * `options.database` – (Optionalish) The string name of the database the table. Defaults to `service.config.database` if not defined.
  * `options.table` – (Required) The string name of the table this service is managing
  * `options.idField` – (Optional) The field that is expected to be unique, like a single-column primary key. Defaults to `id`.
  * `options.statusField` – (Optional) The field that is used for row status, such as `dead` statuses. Defaults to `status`.
  * `options.updatedField` – (Optional) The field that is automatically set to `new Date()` when updating. Defaults to `updated`.
  * `options.createRetryCount` – (Optional) How many times a `_createWithRetry` method can attempt to create a doc before giving up. Defaults to `3`.
  * `options.modifiableKeys` – (Optional) What column names are assumed to be safe to copy from user-data. Defaults to `[]`.
  * `options.deletedStatus` – (Optional) The status to set docs to when "deleting" them. Defaults to `dead`.
  * `options.concealDeadResources` – (Optional) Whether this service should actively prevent "deleted" (status=dead) resources from returning in `_retrieve`, `_find`, `_bulkUpdate`, `_bulkDelete`, and `_bulkDeletePermanently`. Defaults to `true`.

### `_create(data, [options], callback, [suppressCollisionError])`
Creates a new row.
* `data` – The row object to store
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row that was created
* `suppressCollisionError` - Internal flag to suppress automatically reporting the error if it is a collision

Returns the underlying MySQL query.

### `_createWithRetry(data, objectClosure, [options], callback, [attempt])`
Creates a new row after calling the given object closure. This closure is fired again (up to `service._createRetryCount` times) in the event there is a collision. 
This is useful when you store rows that have unique fields (e.g. an API key) that you can regenerate in that super rare instance that you collide
* `data` – The row object to store
* `objectClosure(data, attempt)` – Function fired before saving the new row. Set changeable, unique properties here
  * `data` – The row object to store
  * `attempt` – The attempt number, starting at `0`
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The new row that was created
* `attempt` – The internal attempt number (will increase after collisions)

Returns the underlying MySQL query.

### `_retrieve(id, [options], callback)`
Retrieves a single row from the table.
* `id` – The id of the row.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row if found or `null` if not found
  
Returns the underlying MySQL query.
  
### `_find(criteria, [options], callback)`
Finds rows matching the given criteria. Supports pagination, field selection and more!
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.skip` – Offsets the result set by this many records (pagination). Default is unset.  
  * `options.take` – Returns this many records (pagination). Default is unset.
  * `options.fields` – Returns only the given fields (same syntax as mongo selects, e.g. `{ field: 1, exclude: 0 }` ) Default is unset.
  * `options.sort` – Sorts the results by the given fields (same syntax as mongo sorts, e.g. `{ field: 1, reverse: -1 }`). Default is unset.
  * `options.conceal` – Whether to conceal dead resources. Default is `true`. 
  * `options.mode` – (Internal) Query mode, used to toggle query modes like SELECT COUNT(*) queries
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – Fired when completed
  * `err` – Error, if occurred
  * `docs` – The array of rows returned or `[]` if none found.
  
Returns the underlying MySQL query.
  
#### Special operators
Mongo uses a JSON-like query syntax that is robust and easy to use. MySQL uses SQL, which means translating from JSON isn't wonderful.
Instead, we opted to support some mongo-like operators for consistency with our okanjo-app-mongo version of CrudService.

* `{ field: value }` – Equal – Translates to `WHERE field = value`
* `{ field: [ values... ]` – IN – Translates to `WHERE field IN (values...)`
* `{ field: { $ne: value } }` - Not-Equal – Translates to `WHERE field != value`
* `{ field: { $ne: [ values... ] } }` - Not-IN– Translates to `WHERE field NOT IN (values...)`
* `{ field: { $gt: value } }` - Greater-Than – Translates to `WHERE field > value`
* `{ field: { $gte: value } }` - Greater-Than-Or-Equal – Translates to `WHERE field >= value`
* `{ field: { $lt: value } }` - Less-Than – Translates to `WHERE field < value`
* `{ field: { $lte: value } }` - Less-Than-Or-Equal – Translates to `WHERE field <= value`

### `_count(criteria, [options], callback)`
Counts the number of matched records.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, count)` – Fired when completed
  * `err` – Error, if occurred
  * `count` – The number of matched rows or `0` if none found.

### `_update(row, [data], [options], callback)`
Updates the given row and optionally applies user-modifiable fields, if service is configured to do so.
* `doc` – The row to update. Must include configured id field.  
* `data` – (Optional) Additional pool of key-value fields. Only keys that match `service._modifiableKeys` will be copied if present. Useful for passing in a request payload and copying over pre-validated data as-is.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.
  
### `_bulkUpdate(criteria, data, [options], callback)`
Updates all rows matching the given criteria with the new column values.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `data` – Field-value pairs to set on matched rows
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.
  
### `_delete(row, [options], callback)`
Fake-deletes a row from the table. In reality, it just sets its status to `dead` (or whatever the value of `service._deletedStatus` is).
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.
  
### `_bulkDelete(criteria, [options], callback)`
Fake-deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.

### `_deletePermanently(row, [options], callback)`
Permanently deletes a row from the table. This is destructive!
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.   
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.
  
### `_bulkDeletePermanently(criteria, [options], callback)`
Permanently deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, res)` – Fired when completed
  * `err` – Error, if occurred
  * `res` – The MySQL response. Contains properties like `res.affectedRows` and `res.changedRows`.
  
## Events

This class does not emit events.


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
