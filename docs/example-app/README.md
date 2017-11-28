# Example Application Usage

This is an example for how you can use the mysql service in an app. 

Run like so, replacing your mysql info for your test server:
```sh
MYSQL_HOST=192.168.99.100 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASS=unittest node docs/example-app/index.js
```

Replace the values for your test environment.

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