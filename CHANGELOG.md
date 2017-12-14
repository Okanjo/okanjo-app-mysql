# Changelog

## v1.2.0
 * Added `options` to crud functions that did not previously have them
 * Added: All crud functions will use options.connection to execute queries if given (supports transactions) 

## v1.1.0
 * Added CrudService for MySQL that works just like our MongoService/CrudService
 * MySQLService#query now returns the underlying query object

## v1.0.0
 * Initial public release