# Example Application Usage

This is an example for how you can use the CollectionCrudService in an app.

Run like so, replacing your mysql info for your test server:
```sh
MYSQL_HOST=localhost MYSQL_PORT=33060 MYSQL_USER=root MYSQL_PASS=unittest node docs/example-collection-app/index.js
```

Replace the values for your test environment.

The output of the application should look something like this:
```
Inserting records...
Apple: { _id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.628Z }
Grape: { _id: 'grape',
  name: 'Grape',
  color: 'green',
  status: 'active',
  created: 2019-04-10T19:43:06.666Z,
  updated: 2019-04-10T19:43:06.666Z }

Retrieving records...
Apple: { _id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.628Z }
Grape: { _id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.628Z }

Finding records...
Fruit: [ { _id: 'apple',
    name: 'Apple',
    color: 'red',
    status: 'active',
    created: 2019-04-10T19:43:06.628Z,
    updated: 2019-04-10T19:43:06.628Z },
  { _id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T19:43:06.666Z,
    updated: 2019-04-10T19:43:06.666Z } ]

Updating records...
Apple: { _id: 'apple',
  name: 'Green Apple',
  color: 'green',
  status: 'active',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.811Z }
Grape: { _id: 'apple',
  name: 'Purple Grape',
  color: 'purple',
  status: 'active',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.849Z }

Deleting doc...
Apple: { _id: 'apple',
  name: 'Green Apple',
  color: 'green',
  status: 'dead',
  created: 2019-04-10T19:43:06.628Z,
  updated: 2019-04-10T19:43:06.883Z }

Finding records...
Fruit: [ { _id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T19:43:06.666Z,
    updated: 2019-04-10T19:43:06.666Z } ]

Finding all records...
Fruit: [ { _id: 'apple',
    name: 'Green Apple',
    color: 'green',
    status: 'dead',
    created: 2019-04-10T19:43:06.628Z,
    updated: 2019-04-10T19:43:06.883Z },
  { _id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T19:43:06.666Z,
    updated: 2019-04-10T19:43:06.666Z } ]

Permanently delete record..

Finding all records...
Fruit: [ { _id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T19:43:06.666Z,
    updated: 2019-04-10T19:43:06.666Z } ]

Permanently delete all records...
1 docs affected

Finding all records...
Fruit: []
DONE!

```