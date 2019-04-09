# Example Application Usage

This is an example for how you can use the mysql service in an app. 

Run like so, replacing your mysql info for your test server:
```sh
MYSQL_HOST=localhost MYSQL_PORT=33060 MYSQL_USER=root MYSQL_PASS=unittest node docs/example-app/index.js
```

Replace the values for your test environment.

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