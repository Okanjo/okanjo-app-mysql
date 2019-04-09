# Okanjo MySQL Service

[![Build Status](https://travis-ci.org/Okanjo/okanjo-app-mysql.svg?branch=master)](https://travis-ci.org/Okanjo/okanjo-app-mysql) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app-mysql/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app-mysql?branch=master)

Service for interfacing with MySQL for the Okanjo App ecosystem.

## Installing

Add to your project like so: 

```sh
npm install okanjo-app-mysql
```

Note: requires the [`okanjo-app`](https://github.com/okanjo/okanjo-app) module.

## Breaking Changes

### v3.0.0

 * Changed MySQL driver from [mysqljs/mysql](https://github.com/mysqljs/mysql) to [mysql/mysql-connector-nodejs](https://github.com/mysql/mysql-connector-nodejs)
 * MySQLService:
   * `config` options have changed. See [MySQLService](#MySQLService) for options.
   * `pool` property has been removed. A new property `client` basically replaces the pool.
   * `query` signature has changed from (query, options, callback) to (sql, args, callback, options)
   * `wrapQuery` has been removed
   * `getConnection` has been replaced with `getSession`
 * CrudService:
   * `connection` option in crud methods has been replaced with `session`. 
   * `CrudService.MAX_VALUE` constant class has been replaced with a simple string version. 

### v2.0.0

 * MySQLService:
   * `query` callback now returns a single parameter `response` object with properties: `results` and `fields` for compatibility with promises
 * CrudService:
   * `_create` arguments have changed to `data, options, callback`, `suppressCollisionError` has moved into `options`
   * `_createWithRetry` arguments have changed to `data, objectClosure, options, callback` (recursive `attempt` has been removed)
   * All crud methods return a Promise for async compatibility. Callback is an optional param. Fields have been removed as a response argument.
   * `_update` is now an async function


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
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '33060';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASS || 'unittest';
const schema = process.env.MYSQL_DB || undefined;

//noinspection JSUnusedGlobalSymbols
module.exports = {

    mysql: {
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
        }
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
```

The output of the application should look something like this:
```text
Creating database...
Creating table...
Inserting records...
Selecting all records...
 * Row id: 1, name: apples
 * Row id: 2, name: grapes
 * Warnings: 0
Columns:
 * my_database.my_table.id, length = 10
 * my_database.my_table.name, length = 255
Selecting record #1...
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
* `service.client` – (read-only) The underlying [mysql/mysql-connector-nodejs](https://github.com/mysql/mysql-connector-nodejs) connection pool 

## Methods

### `new MySQLService(app, [config])`

Creates a new mysql service instance.

* `app` – The OkanjoApp instance to bind to
* `config` – (Required) The mysql service configuration object.
  * `config.session` – The session config. See [mysql/mysql-connector-nodejs](https://github.com/mysql/mysql-connector-nodejs) for more options.
  * `config.session.host` – Server hostname or ip address
  * `config.session.port` – Server port
  * `config.session.user` – Username to login as 
  * `config.session.password` – Password for the user 
  * `config.session.schema` – (optional) Sets the context database if given.
  * `config.client` – The client config.  See [mysql/mysql-connector-nodejs](https://github.com/mysql/mysql-connector-nodejs) for more options.
  * `config.client.pooling` – Pooling options
  * `config.client.pooling.enabled` – Enable connection pooling.
  * `config.client.pooling.maxSize` – Maximum number of active connections to allow in the pool.
  * `config.client.pooling.maxIdleTime` – Maximum connection idle time. 0=Infinity
  * `config.client.pooling.queueTimeout` – Maximum amount of time to wait for a connection when pool is full. 0=Infinity

### `async service.connect()`
Initializes the connection pool client. Automatically called when app starts.

### `async service.close()`
Closes down the connection pool client.

### `service.escapeIdentifier(str)`
Escapes an identifier for use in a SQL query. For example, a schema name or column name.

### `service.encodeParams(args)` 
Internal. Encodes row arguments for use in a SQL query. For example, Date objects are converted to MySQL date strings.
* Returns array of encoded row arguments.

### `service.decodeParams(args, cols)`
Internal. Decodes row arguments for use in the application. For example, DATETIME fields are converted back to a Date object.
* Returns array of decoded row arguments.

### `service.execute(query, options={})`
Internal. Wrapper around the xmysql client SqlExecute execute function. Handles encoding and decoding of row arguments.
 * `query` – SqlExecute query
 * `options` – Optional options
   * `options.suppress` - An error code number to suppress
 * Returns a Promise<rows> 

### `service.query(sql, args, [callback], [options])`
Executes a query on the connection pool. See [mysqljs/mysql](https://github.com/mysqljs/mysql#performing-queries) for more query options.
* `sql` – SQL string to execute
* `args` – Query arguments for prepared statements.
* `callback(err, rows)`– (optional) Function to fire when query completes
  * `err` – Error if applicable
  * `rows` – Array of records
    * `results` – The query Result object.
    * `cols` – The metadata Column objects.
* `options` – (optional) Query options
  * `options.session` – Session to exectute the query in. If none given, a new Session will be pulled from the pool.
  * `options.suppress` – An error code to suppress
* Returns a Promise<rows>

### `service.getSession()`
Gets a dedicated session from the pool. You must release it back to the pool when you are finished with it.
* Returns a Promise<Session>
  
> Note: You must call `session.close();` when you have finished using the session to return it back to the pool.

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

### `_create(data, [options,] [callback])`
Creates a new row.
* `data` – The row object to store
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
  * `options.suppressCollisionError` - Internal flag to suppress automatically reporting the error if it is a collision
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row that was created
* Returns a promise

### `_createWithRetry(data, objectClosure, [options,] [callback])`
Creates a new row after calling the given object closure. This closure is fired again (up to `service._createRetryCount` times) in the event there is a collision. 
This is useful when you store rows that have unique fields (e.g. an API key) that you can regenerate in that super rare instance that you collide
* `data` – The row object to store
* `async objectClosure(data, attempt)` – Function fired before saving the new row. Set changeable, unique properties here
  * `data` – The row object to store
  * `attempt` – The attempt number, starting at `0`
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The new row that was created
* Returns a promise

### `_retrieve(id, [options], [callback])`
Retrieves a single row from the table.
* `id` – The id of the row.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row if found or `null` if not found
* Returns a promise
  
### `_find(criteria, [options], [callback])`
Finds rows matching the given criteria. Supports pagination, field selection and more!
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.skip` – Offsets the result set by this many records (pagination). Default is unset.  
  * `options.take` – Returns this many records (pagination). Default is unset.
  * `options.fields` – Returns only the given fields (same syntax as mongo selects, e.g. `{ field: 1, exclude: 0 }` ) Default is unset.
  * `options.sort` – Sorts the results by the given fields (same syntax as mongo sorts, e.g. `{ field: 1, reverse: -1 }`). Default is unset.
  * `options.conceal` – Whether to conceal dead resources. Default is `true`. 
  * `options.mode` – (Internal) Query mode, used to toggle query modes like SELECT COUNT(*) queries
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The array of rows returned or `[]` if none found.
* Returns a promise

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

### `_count(criteria, [options], [callback])`
Counts the number of matched records.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, count)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `count` – The number of matched rows or `0` if none found.
* Returns a promise

### `_update(row, [data], [options], [callback])`
Updates the given row and optionally applies user-modifiable fields, if service is configured to do so.
* `doc` – The row to update. Must include configured id field.  
* `data` – (Optional) Additional pool of key-value fields. Only keys that match `service._modifiableKeys` will be copied if present. Useful for passing in a request payload and copying over pre-validated data as-is.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise
  
### `_bulkUpdate(criteria, data, [options], [callback])`
Updates all rows matching the given criteria with the new column values.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `data` – Field-value pairs to set on matched rows
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise

### `_delete(row, [options], [callback])`
Fake-deletes a row from the table. In reality, it just sets its status to `dead` (or whatever the value of `service._deletedStatus` is).
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise
  
### `_bulkDelete(criteria, [options], [callback])`
Fake-deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise

### `_deletePermanently(row, [options], [callback])`
Permanently deletes a row from the table. This is destructive!
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.   
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise

### `_bulkDeletePermanently(criteria, [options], [callback])`
Permanently deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#Special operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns a promise
  
## Events

This class does not emit events.


## Extending and Contributing 

Our goal is quality-driven development. Please ensure that 100% of the code is covered with testing.

Before contributing pull requests, please ensure that changes are covered with unit tests, and that all are passing. 

### Testing

Before you can run the tests, you'll need a working MySQL server. We suggest using docker.

For example:

```bash
docker pull mysql:5.7
docker pull mysql:8
docker run -d -p 3306:3306 -p 33060:33060 -e MYSQL_ROOT_PASSWORD=unittest mysql:5.7
docker run -d -p 3307:3306 -p 33070:33060 -e MYSQL_ROOT_PASSWORD=unittest mysql:8

```

To run unit tests and code coverage:
```sh
MYSQL_HOST=localhost MYSQL_PORT=33060 MYSQL_USER=root MYSQL_PASS=unittest npm run report
MYSQL_HOST=localhost MYSQL_PORT=33070 MYSQL_USER=root MYSQL_PASS=unittest npm run report
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
