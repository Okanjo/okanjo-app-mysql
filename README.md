# Okanjo MySQL Service

[![Build Status](https://travis-ci.org/Okanjo/okanjo-app-mysql.svg?branch=master)](https://travis-ci.org/Okanjo/okanjo-app-mysql) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app-mysql/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app-mysql?branch=master)

Service for interfacing with MySQL or MariaDB for the Okanjo App ecosystem.

## Installing

Add to your project like so: 

```sh
npm install okanjo-app-mysql
```

Note: requires the [`okanjo-app`](https://github.com/okanjo/okanjo-app) module.

## Breaking Changes

### v4.0.0

 * CrudService: 
   * Renamed `service.database` to `service.schema` for consistency
   * Removed `_` prefix from crud service functions

### v3.0.0

 * Node v10+ only (unless you polyfill Promise.prototype.finally support yourself)
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

# Examples

Runnable examples can be be found in [docs/](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs).

 * [example-app](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs/example-app) – Demonstrates direct SQL query usage 
 * [example-relational-app](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs/example-relational-app) – Demonstrates using CrudService in an app
 * [example-mariadb-app](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs/example-mariadb-app) – Demonstrates using MariaDBCrudService in an app
 * [example-collection-app](https://github.com/okanjo/okanjo-app-mysql/tree/master/docs/example-collection-app) – Demonstrates using CollectionCrudService in an app


# Classes

 * [MySQLService](#mysqlservice) – MySQL interface service, uses the Oracle mysql connector.
 * [MariaDBService](#mariadbservice) – MariaDB/MySQL interface service, uses the MariaDB connector.
 * [CrudService](#crudservice) – CRUD base class for MySQL relational tables. Depends on MySQLService.
 * [MariaDBCrudService](#mariadbcrudservice) – CRUD base class for MariaDB/MySQL relational tables. Depends on MariaDBService.
 * [CollectionCrudService](#collectioncrudservice) – CRUD base class for MySQL document collections. Depends on MySQLService.


# MySQLService

MySQL management class. Must be instantiated to be used. 

```js
const MySQLService = require('okanjo-app-mysql');
```

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
  * `config.generateIds` – Whether to generate collection document _id values locally (`true`) or rely on the server (`false`). Use this with MySQL 5.7 servers.

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
 * Returns `Promise<rows>` 

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
  * `options.session` – Session to execute the query in. If none given, a new Session will be pulled from the pool.
  * `options.suppress` – An error code to suppress
* Returns `Promise<rows>`

### `service.getSession()`
Gets a dedicated session from the pool. You must release it back to the pool when you are finished with it.
* Returns `Promise<Session>`
  
> Note: You must call `session.close();` when you have finished using the session to return it back to the pool.

## Events

This class does not emit events.


# MariaDBService

MariaDB management class. Must be instantiated to be used.

```js
const MariaDBService = require('okanjo-app-mysql/MariaDBService');
```

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.config` – (read-only) The MariaDB service configuration provided when constructed
* `service.pool` – (read-only) The underlying [MariaDB/mariadb-connector-nodejs](https://github.com/MariaDB/mariadb-connector-nodejs) connection pool 

## Methods

### `new MySQLService(app, [config])`

Creates a new mysql service instance.

* `app` – The OkanjoApp instance to bind to
* `config` – (Required) The mysql service configuration object.
  * `config.host` – Server hostname or ip address
  * `config.port` – Server port
  * `config.user` – Username to login as 
  * `config.password` – Password for the user 
  * `config.datbase` – (optional) Sets the context database if given.
  * See [connection options](https://mariadb.com/kb/en/library/connector-nodejs-promise-api/#connection-options) for additional connection/pool options.

### `async service.connect()`
Initializes the connection pool client. Automatically called when app starts.

### `async service.close()`
Closes down the connection pool client.

### `service.query(sql, args, [callback], [options])`
Executes a query on the connection pool. See [mysqljs/mysql](https://github.com/mysqljs/mysql#performing-queries) for more query options.
* `sql` – SQL string to execute
* `args` – Query arguments for prepared statements.
* `callback(err, rows)`– (optional) Function to fire when query completes
  * `err` – Error if applicable
  * `rows` – Array of records or [query result](https://mariadb.com/kb/en/library/connector-nodejs-promise-api/#poolquerysql-values-promise).
    * `meta` – The metadata column data. (non-enumerable, but exists!)
* `options` – (optional) Query options
  * `options.connection` – to execute the query in. If none given, a new Connection will be pulled from the pool.
  * `options.suppress` – An error code to suppress
* Returns `Promise<rows>`

### `service.getConnection()`
Gets a dedicated connection from the pool. You must release it back to the pool when you are finished with it.
* Returns `Promise<Connection>`
  
> Note: You must call `connection.end();` when you have finished using the session to return it back to the pool.

## Events

This class does not emit events.


# CrudService

Base class for building services based on relational MySQL tables. The idea of using CrudService is to:
 * Stop duplicating logic across every service you have to write (CRUDL)
 * Automatically handle and report errors on common operations so you don't need to in the business logic
 * Provide base functions that can be used in the service.
 * Provide hooks to create non-existent schemas and tables.
 * Automatic `Date` handling. Objects with `Date` values are encoded during inserts/updates, and decoded when retrieved. 
 * Conceal deleted rows without actually deleting them.
   * We don't like to permanently delete data. Instead, we like to leave tombstones behind so we can audit before cleaning up later. This is also very handy for syncing to data lakes. Do you know what rows were deleted in the last 15 minutes?
   * When a row is deleted, its `status` column is just set to `dead`. 
   * The `find`, `retrieve`, `bulkUpdate`, `bulkDelete` and `bulkPermanentlyDelete` helpers automatically deal with dead rows, pretending like they were really deleted.

Note: you should extend this class to make it useful!

```js
const CrudService = require('okanjo-app-mysql/CrudService');
```

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.service` – (read-only) The MySQLService instance managing the connection pool
* `service.schema` – (read-only) The string name of the database schema the table is in 
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
  * `options.schema` – (Optionalish) The string name of the database the table. Defaults to `service.config.session.schema` if not defined.
  * `options.table` – (Required) The string name of the table this service is managing
  * `options.idField` – (Optional) The field that is expected to be unique, like a single-column primary key. Defaults to `id`.
  * `options.statusField` – (Optional) The field that is used for row status, such as `dead` statuses. Defaults to `status`.
  * `options.updatedField` – (Optional) The field that is automatically set to `new Date()` when updating. Defaults to `updated`.
  * `options.createRetryCount` – (Optional) How many times a `_createWithRetry` method can attempt to create a doc before giving up. Defaults to `3`.
  * `options.modifiableKeys` – (Optional) What column names are assumed to be safe to copy from user-data. Defaults to `[]`.
  * `options.deletedStatus` – (Optional) The status to set docs to when "deleting" them. Defaults to `dead`.
  * `options.concealDeadResources` – (Optional) Whether this service should actively prevent "deleted" (status=dead) resources from returning in `_retrieve`, `_find`, `_bulkUpdate`, `_bulkDelete`, and `_bulkDeletePermanently`. Defaults to `true`.

### `async _createSchema(session)`
Hook fired during `init()` if the database schema does not exist. By default, the schema will be created.
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `session` – The active Session.
 * Returns the created Schema object. 
 
> Note: you must return the created Schema object.
 
### `async _updateSchema(session, schema)`
Hook fired during `init()` if the database schema already exists. By default, this function does nothing. 
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `session` - The active Session object.
 * `schema` – The existing Schema object.
 * Returns the existing Schema or updated Schema object.
 
> Note: you must return the created Schema object.

### `async _createTable(session, schema)`
Hook fired during `init()` if the table does not exist in the schema. By default, this function will throw an exception.
Override this function to create your table.
 * `session` - The active Session object.
 * `schema` – The existing Schema object.
 * No return value

> Note: you must override this method if you want `init` to auto-create your table. 

### `async _updateTable(session, table)`
Hook fired during `init()` if the table already exists in the schema. By default, this function does nothing.
Override this function to update your table definitions or enhance functionality.
 * `session` - The active Session object.
 * `table` – The existing Table object.
 * No return value

### `async init()`
Initializes the database and table. Uses the aforementioned hook functions to create or update the schema and table.

### `create(data, [options,] [callback])`
Creates a new row.
* `data` – The row object to store
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
  * `options.suppressCollisionError` - Internal flag to suppress automatically reporting the error if it is a collision
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row that was created
* Returns `Promise<doc>`

### `createWithRetry(data, objectClosure, [options,] [callback])`
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
* Returns `Promise<doc>`

### `retrieve(id, [options], [callback])`
Retrieves a single row from the table.
* `id` – The id of the row.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row if found or `null` if not found
* Returns `Promise<doc>`
  
### `find(criteria, [options], [callback])`
Finds rows matching the given criteria. Supports pagination, field selection and more!
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
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
* Returns `Promise<rows>`

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

### `count(criteria, [options], [callback])`
Counts the number of matched records.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, count)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `count` – The number of matched rows or `0` if none found.
* Returns `Promise<count>`

### `update(row, [data], [options], [callback])`
Updates the given row and optionally applies user-modifiable fields, if service is configured to do so.
* `doc` – The row to update. Must include configured id field.  
* `data` – (Optional) Additional pool of key-value fields. Only keys that match `service._modifiableKeys` will be copied if present. Useful for passing in a request payload and copying over pre-validated data as-is.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
### `bulkUpdate(criteria, data, [options], [callback])`
Updates all rows matching the given criteria with the new column values.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `data` – Field-value pairs to set on matched rows
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `delete(row, [options], [callback])`
Fake-deletes a row from the table. In reality, it just sets its status to `dead` (or whatever the value of `service._deletedStatus` is).
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
### `bulkDelete(criteria, [options], [callback])`
Fake-deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `deletePermanently(row, [options], [callback])`
Permanently deletes a row from the table. This is destructive!
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.   
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `bulkDeletePermanently(criteria, [options], [callback])`
Permanently deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
## Events

This class does not emit events.


# MariaDBCrudService

Base class for building services based on relational MariaDB/MySQL tables. The idea of using MariaDBCrudService is to:
 * Stop duplicating logic across every service you have to write (CRUDL)
 * Automatically handle and report errors on common operations so you don't need to in the business logic
 * Provide base functions that can be used in the service.
 * Provide hooks to create non-existent schemas and tables.
 * Automatic `Date` handling. Objects with `Date` values are encoded during inserts/updates, and decoded when retrieved. 
 * Conceal deleted rows without actually deleting them.
   * We don't like to permanently delete data. Instead, we like to leave tombstones behind so we can audit before cleaning up later. This is also very handy for syncing to data lakes. Do you know what rows were deleted in the last 15 minutes?
   * When a row is deleted, its `status` column is just set to `dead`. 
   * The `find`, `retrieve`, `bulkUpdate`, `bulkDelete` and `bulkPermanentlyDelete` helpers automatically deal with dead rows, pretending like they were really deleted.

Note: you should extend this class to make it useful!

```js
const MariaDBCrudService = require('okanjo-app-mysql/MariaDBCrudService');
```

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.service` – (read-only) The MariaDBService instance managing the connection pool
* `service.schema` – (read-only) The string name of the database schema the table is in 
* `service.table` – (read-only) The string name of the table this service is treating as a resource collection
* `service.idField` – (read-only) The field that is expected to be unique, like a single-column primary key.
* `service.statusField` – (read-only) The field that is used for row status, such as `dead` statuses
* `service.updatedField` – (read-only) The field that is automatically set to `new Date()` when updating
* `service._createRetryCount` – (read-only) How many times a `_createWithRetry` method can attempt to create a doc before giving up 
* `service._modifiableKeys` – (read-only) What column names are assumed to be safe to copy from user-data
* `service._deletedStatus` – (read-only) The status to set docs to when "deleting" them
* `service._concealDeadResources` – (read-only) Whether this service should actively prevent "deleted" (status=dead) resources from returning in _retrieve and _find  

## Methods

### `new MariaDBCrudService(app, options)`
Creates a new instance. Ideally, you would extend it and call it via `super(app, options)`.
* `app` – The OkanjoApp instance to bind to
* `options` – Service configuration options
  * `options.service` – (Required) The MySQLService instance managing the connection pool
  * `options.schema` – (Optionalish) The string name of the database the table. Defaults to `service.config.database` if not defined.
  * `options.table` – (Required) The string name of the table this service is managing
  * `options.idField` – (Optional) The field that is expected to be unique, like a single-column primary key. Defaults to `id`.
  * `options.statusField` – (Optional) The field that is used for row status, such as `dead` statuses. Defaults to `status`.
  * `options.updatedField` – (Optional) The field that is automatically set to `new Date()` when updating. Defaults to `updated`.
  * `options.createRetryCount` – (Optional) How many times a `_createWithRetry` method can attempt to create a doc before giving up. Defaults to `3`.
  * `options.modifiableKeys` – (Optional) What column names are assumed to be safe to copy from user-data. Defaults to `[]`.
  * `options.deletedStatus` – (Optional) The status to set docs to when "deleting" them. Defaults to `dead`.
  * `options.concealDeadResources` – (Optional) Whether this service should actively prevent "deleted" (status=dead) resources from returning in `_retrieve`, `_find`, `_bulkUpdate`, `_bulkDelete`, and `_bulkDeletePermanently`. Defaults to `true`.

### `async _createSchema(connection)`
Hook fired during `init()` if the database schema does not exist. By default, the schema will be created.
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `connection` – The active Connection.
 * No return value
 
### `async _updateSchema(connection)`
Hook fired during `init()` if the database schema already exists. By default, this function does nothing. 
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `connection` - The active Connection object.
 * No return value

### `async _createTable(connection)`
Hook fired during `init()` if the table does not exist in the schema. By default, this function will throw an exception.
Override this function to create your table.
 * `connection` - The active Connection object.
 * No return value

> Note: you must override this method if you want `init` to auto-create your table. 

### `async _updateTable(connection)`
Hook fired during `init()` if the table already exists in the schema. By default, this function does nothing.
Override this function to update your table definitions or enhance functionality.
 * `connection` - The active Connection object.
 * No return value

### `async init()`
Initializes the database and table. Uses the aforementioned hook functions to create or update the schema and table.

### `create(data, [options,] [callback])`
Creates a new row.
* `data` – The row object to store
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
  * `options.suppressCollisionError` - Internal flag to suppress automatically reporting the error if it is a collision
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row that was created
* Returns `Promise<doc>`

### `createWithRetry(data, objectClosure, [options,] [callback])`
Creates a new row after calling the given object closure. This closure is fired again (up to `service._createRetryCount` times) in the event there is a collision. 
This is useful when you store rows that have unique fields (e.g. an API key) that you can regenerate in that super rare instance that you collide
* `data` – The row object to store
* `async objectClosure(data, attempt)` – Function fired before saving the new row. Set changeable, unique properties here
  * `data` – The row object to store
  * `attempt` – The attempt number, starting at `0`
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The new row that was created
* Returns `Promise<doc>`

### `retrieve(id, [options], [callback])`
Retrieves a single row from the table.
* `id` – The id of the row.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The row if found or `null` if not found
* Returns `Promise<doc>`
  
### `find(criteria, [options], [callback])`
Finds rows matching the given criteria. Supports pagination, field selection and more!
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.skip` – Offsets the result set by this many records (pagination). Default is unset.  
  * `options.take` – Returns this many records (pagination). Default is unset.
  * `options.fields` – Returns only the given fields (same syntax as mongo selects, e.g. `{ field: 1, exclude: 0 }` ) Default is unset.
  * `options.sort` – Sorts the results by the given fields (same syntax as mongo sorts, e.g. `{ field: 1, reverse: -1 }`). Default is unset.
  * `options.conceal` – Whether to conceal dead resources. Default is `true`. 
  * `options.mode` – (Internal) Query mode, used to toggle query modes like SELECT COUNT(*) queries
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The array of rows returned or `[]` if none found.
* Returns `Promise<rows>`

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

### `count(criteria, [options], [callback])`
Counts the number of matched records.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, count)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `count` – The number of matched rows or `0` if none found.
* Returns `Promise<count>`

### `update(row, [data], [options], [callback])`
Updates the given row and optionally applies user-modifiable fields, if service is configured to do so.
* `doc` – The row to update. Must include configured id field.  
* `data` – (Optional) Additional pool of key-value fields. Only keys that match `service._modifiableKeys` will be copied if present. Useful for passing in a request payload and copying over pre-validated data as-is.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
### `bulkUpdate(criteria, data, [options], [callback])`
Updates all rows matching the given criteria with the new column values.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `data` – Field-value pairs to set on matched rows
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `delete(row, [options], [callback])`
Fake-deletes a row from the table. In reality, it just sets its status to `dead` (or whatever the value of `service._deletedStatus` is).
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
### `bulkDelete(criteria, [options], [callback])`
Fake-deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `deletePermanently(row, [options], [callback])`
Permanently deletes a row from the table. This is destructive!
* `doc` – The row to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.   
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`

### `bulkDeletePermanently(criteria, [options], [callback])`
Permanently deletes all rows matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.connection` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, rows)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `rows` – The MySQL response. Contains properties like `rows.result.getAffectedRowsCount()` and `res.result.getWarnings()`.
* Returns `Promise<rows>`
  
## Events

This class does not emit events.


# CollectionCrudService

Base class for building services based on MySQL document collections. The idea of using CollectionCrudService is to:
 * Stop duplicating logic across every service you have to write (CRUDL)
 * Automatically handle and report errors on common operations so you don't need to in the business logic
 * Provide base functions that can be used in the service.
 * Automatically creates the schema and collection if they do not exist.
 * Automatic `Date` handling. Objects with `Date` values are encoded during inserts/updates, and decoded when retrieved. 
 * Conceal deleted documents without actually deleting them.
   * We don't like to permanently delete data. Instead, we like to leave tombstones behind so we can audit before cleaning up later. This is also very handy for syncing to data lakes. Do you know what documents were deleted in the last 15 minutes?
   * When a doc is deleted, its `status` column is just set to `dead`. 
   * The `find`, `retrieve`, `bulkUpdate`, `bulkDelete` and `bulkPermanentlyDelete` helpers automatically deal with dead docs, pretending like they were really deleted.

Note: you should extend this class to make it useful!

```js
const CollectionCrudService = require('okanjo-app-mysql/CollectionCrudService');
```

## Properties
* `service.app` – (read-only) The OkanjoApp instance provided when constructed
* `service.service` – (read-only) The MySQLService instance managing the connection pool
* `service.schema` – (read-only) The string name of the database schema the table is in 
* `service.collection` – (read-only) The string name of the collection this service is accessing
* `service.idField` – (read-only) The field that is expected to be unique, like a single-column primary key.
* `service.statusField` – (read-only) The field that is used for doc status, such as `dead` statuses
* `service.updatedField` – (read-only) The field that is automatically set to `new Date()` when updating
* `service._createRetryCount` – (read-only) How many times a `_createWithRetry` method can attempt to create a doc before giving up 
* `service._modifiableKeys` – (read-only) What column names are assumed to be safe to copy from user-data
* `service._deletedStatus` – (read-only) The status to set docs to when "deleting" them
* `service._concealDeadResources` – (read-only) Whether this service should actively prevent "deleted" (status=dead) resources from returning in _retrieve and _find  

## Methods

### `new CollectionCrudService(app, options)`
Creates a new instance. Ideally, you would extend it and call it via `super(app, options)`.
* `app` – The OkanjoApp instance to bind to
* `options` – Service configuration options
  * `options.service` – (Required) The MySQLService instance managing the connection pool
  * `options.schema` – (Optionalish) The string name of the database the table. Defaults to `service.config.session.schema` if not defined.
  * `options.collection` – (Required) The string name of the collection this service is accessing
  * `options.idField` – (Optional) The field that is expected to be unique, like a single-column primary key. Defaults to `id`.
  * `options.statusField` – (Optional) The field that is used for doc status, such as `dead` statuses. Defaults to `status`.
  * `options.updatedField` – (Optional) The field that is automatically set to `new Date()` when updating. Defaults to `updated`.
  * `options.generateIds` – (Optional) Whether to automatically generate `_id` values. Enable this for MySQL 5.7
  * `options.createRetryCount` – (Optional) How many times a `_createWithRetry` method can attempt to create a doc before giving up. Defaults to `3`.
  * `options.modifiableKeys` – (Optional) What column names are assumed to be safe to copy from user-data. Defaults to `[]`.
  * `options.deletedStatus` – (Optional) The status to set docs to when "deleting" them. Defaults to `dead`.
  * `options.concealDeadResources` – (Optional) Whether this service should actively prevent "deleted" (status=dead) resources from returning in `_retrieve`, `_find`, `_bulkUpdate`, `_bulkDelete`, and `_bulkDeletePermanently`. Defaults to `true`.

### `async _createSchema(session)`
Hook fired during `init()` if the database schema does not exist. By default, the schema will be created.
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `session` – The active Session.
 * Returns the created Schema object. 
 
> Note: you must return the created Schema object.
 
### `async _updateSchema(session, schema)`
Hook fired during `init()` if the database schema already exists. By default, this function does nothing. 
Override this function to change or enhance functionality. For example, use it to create stored procedures, triggers, views, etc.  
 * `session` - The active Session object.
 * `schema` – The existing Schema object.
 * Returns the existing Schema or updated Schema object.
 
> Note: you must return the created Schema object.

### `async _createCollection(session, schema)`
Hook fired during `init()` if the collection does not exist in the schema. By default, this function will create the collection.
Override this function to create your collection.
 * `session` - The active Session object.
 * `schema` – The existing Schema object.
 * No return value

### `async _updateCollection(session, collection)`
Hook fired during `init()` if the collection already exists in the schema. By default, this function does nothing.
Override this function to update your collection definitions or enhance functionality.
 * `session` - The active Session object.
 * `collection` – The existing Collection object.
 * No return value

### `async init()`
Initializes the database schema and table using the aforementioned hook functions. The database and collection will be created if they do not already exist.

### `getSchema([session], [callback])`
Shortcut function to get the Schema object for the collection. Can also fetch a new Session.
 * `session` – Optional, active Session object. If not specified, a new Session will be opened and returned.
 * `callback(err, { session, schema })` – Optional, fired when done
 * Returns `Promise<{ session, schema }>`
   * `session` – The Session object passed, or new Session opened for this request.
   * `schema` – The Schema object
 
> Note: If using this function to open a Session, be sure to call `await session.close()` to release the session back to the pool.    

### `getCollection([session], [callback])`
Shortcut function to get the Schema and Collection objects. Can also fetch a new Session.
 * `session` – Optional, active Session object. If not specified, a new Session will be opened and returned.
 * `callback(err, { session, schema, collection })` – Optional, fired when done
 * Returns `Promise<{ session, schema, collection }>`
   * `session` – The Session object passed, or new Session opened for this request.
   * `schema` – The Schema object
   * `collection` – The Collection object

> Note: If using this function to open a Session, be sure to call `await session.close()` to release the session back to the pool.    

### `create(data, [options,] [callback])`
Creates a new doc.
* `data` – The doc object to store
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
  * `options.suppressCollisionError` - Internal flag to suppress automatically reporting the error if it is a collision
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc object
* Returns `Promise<doc>`

### `createWithRetry(data, objectClosure, [options,] [callback])`
Creates a new doc after calling the given object closure. This closure is fired again (up to `service._createRetryCount` times) in the event there is a collision. 
This is useful when you store docs that have unique fields (e.g. an API key) that you can regenerate in that super rare instance that you collide
* `data` – The doc object to store
* `async objectClosure(data, attempt)` – Function fired before saving the new doc. Set changeable, unique properties here
  * `data` – The doc object to store
  * `attempt` – The attempt number, starting at `0`
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc object
* Returns `Promise<doc>`

> Note: MySQL collections do not support unique keys, so this method is not that useful

### `retrieve(id, [options], [callback])`
Retrieves a single doc from the table.
* `id` – The id of the doc.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, doc)` – (Optional) Function fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc if found or `null` if not found
* Returns `Promise<doc>`
  
### `find(criteria, [options], [callback])`
Finds docs matching the given criteria. Supports pagination, field selection and more!
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.skip` – Offsets the result set by this many records (pagination). Default is unset.  
  * `options.take` – Returns this many records (pagination). Default is unset.
  * `options.fields` – Returns only the given fields (same syntax as mongo selects, e.g. `{ field: 1, exclude: 0 }` ) Default is unset.
  * `options.sort` – Sorts the results by the given fields (same syntax as mongo sorts, e.g. `{ field: 1, reverse: -1 }`). Default is unset.
  * `options.conceal` – Whether to conceal dead resources. Default is `true`. 
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, docs)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `docs` – The array of docs returned or `[]` if none found.
* Returns `Promise<docs>`

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

### `count(criteria, [options], [callback])`
Counts the number of matched records.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, count)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `count` – The number of matched docs or `0` if none found.
* Returns `Promise<count>`

> Note: MySQL collections do not offer a selective count operation. 
> This method internally calls `.find(criteria, { fields: { _id: 1 } })` and returns the array length.
> NOT. IDEAL.

### `update(doc, [data], [options], [callback])`
Updates the given doc and optionally applies user-modifiable fields, if service is configured to do so.
* `doc` – The doc to update. Must include configured id field.  
* `data` – (Optional) Additional pool of key-value fields. Only keys that match `service._modifiableKeys` will be copied if present. Useful for passing in a request payload and copying over pre-validated data as-is.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, doc)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc
* Returns `Promise<doc>`
  
### `bulkUpdate(criteria, data, [options], [callback])`
Updates all docs matching the given criteria with the new column values.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `data` – Field-value pairs to set on matched docs
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, result)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `result` – The MySQL response. Contains properties like `result.getAffectedItemsCount()` and `result.getWarnings()`.
* Returns `Promise<result>`

### `delete(doc, [options], [callback])`
Fake-deletes a doc from the table. In reality, it just sets its status to `dead` (or whatever the value of `service._deletedStatus` is).
* `doc` – The doc to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.  
* `callback(err, doc)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc
* Returns `Promise<doc>`
  
### `bulkDelete(criteria, [options], [callback])`
Fake-deletes all docs matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, result)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `result` – The MySQL response. Contains properties like `result.getAffectedItemsCount()` and `result.getWarnings()`.
* Returns `Promise<result>`

### `deletePermanently(doc, [options], [callback])`
Permanently deletes a doc from the table. This is destructive!
* `doc` – The doc to delete. Must include configured id field.
* `options` – (Optional) Query options
  * `options.session` – The connection to execute the query on. Defaults to the service pool.   
* `callback(err, doc)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `doc` – The doc
* Returns `Promise<doc>`

### `bulkDeletePermanently(criteria, [options], [callback])`
Permanently deletes all docs matching the given criteria.
* `criteria` – Object with field-value pairs. Supports some special [mongo-like operators](#special-operators)
* `options` – (Optional) Additional query options
  * `options.conceal` – Whether to conceal dead resources. Default is `true`.
  * `options.session` – The connection to execute the query on. Defaults to the service pool.
* `callback(err, result)` – (Optional) Fired when completed
  * `err` – Error, if occurred
  * `result` – The MySQL response. Contains properties like `result.getAffectedItemsCount()` and `result.getWarnings()`.
* Returns `Promise<result>`
  
## Events

This class does not emit events.


# CrudService vs MariaDBCrudService vs CollectionCrudService
 
Which service to use? In general, MySQL collections are a far worse option. 

MySQL's document store system should be treated as a novelty until it's feature parity and performance can match 
other NoSQL systems such as MongoDB.

By and large, the three services offer identical API's. The only differences pertain to response result features and initialization.

Differences between the services:

 * Drivers
   * MySQLService, CrudService, and CollectionCrudService use the Oracle MySQL connector.
   * MariaDBService and MariaDBCrudService use the MariaDB connector. MariaDB can access both MySQL and MariaDB servers.
 * Responses
   * CrudService will consistently return a `rows` array with query Result method accessors.
   * MariaDBCrudService will return `rows` with a `meta` property, or a response object if not a SELECT query.
   * CollectionCrudService will return the docs array, with no built-in ability to access the query Result object.
 * Count 
   * CrudService and MariaDBCrudService performs a `COUNT(*)` statement
   * CollectionCrudService uses `(await find({})).length` to simulate this
 * CreateWithRetry
   * CollectionCrudService can't really make much use of this feature since MySQL collections do not support unique indices.

## Extending and Contributing 

Our goal is quality-driven development. Please ensure that 100% of the code is covered with testing.

Before contributing pull requests, please ensure that changes are covered with unit tests, and that all are passing. 

### Testing

Before you can run the tests, you'll need a working MySQL server. We suggest using docker.

For example:

```bash
docker pull mariadb:10.3
docker pull mysql:5.7
docker pull mysql:8
docker run -d -p 3306:3306 -p 33060:33060 -e MYSQL_ROOT_PASSWORD=unittest mysql:5.7
docker run -d -p 3307:3306 -p 33070:33060 -e MYSQL_ROOT_PASSWORD=unittest mysql:8
docker run -d -p 3308:3306 -e MYSQL_ROOT_PASSWORD=unittest mariadb:10.3

```

To run unit tests and code coverage:
```sh
MYSQL_HOST=localhost MARIA_PORT=3308 MYSQL_PORT=33060 MYSQL_USER=root MYSQL_PASS=unittest npm run report
MYSQL_HOST=localhost MARIA_PORT=3308 MYSQL_PORT=33070 MYSQL_USER=root MYSQL_PASS=unittest npm run cover_noclean
```

Update the `MYSQL_*` environment vars to match your docker host (e.g. host, port, user, pass etc)

This will perform:
* Unit tests against MariaDB 10.3, MySQL 5.7 and MySQL 8
* Code coverage report
* Code linting

Sometimes, that's overkill to quickly test a quick change. To run just the unit tests:
 
```sh
npm test
```

or if you have mocha installed globally, you may run `mocha test` instead.
