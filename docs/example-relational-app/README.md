# Example Application Usage

This is an example for how you can use the CollectionCrudService in an app.

Run like so, replacing your mysql info for your test server:
```sh
MYSQL_HOST=localhost MYSQL_PORT=33060 MYSQL_USER=root MYSQL_PASS=unittest node docs/example-app/index.js
```

Replace the values for your test environment.

The output of the application should look something like this:
```

Inserting records...
Apple: { id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T21:15:07.447Z,
  updated: 2019-04-10T21:15:07.447Z }
Grape: { id: 'grape',
  name: 'Grape',
  color: 'green',
  status: 'active',
  created: 2019-04-10T21:15:07.478Z,
  updated: 2019-04-10T21:15:07.478Z }

Retrieving records...
Apple: { id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T21:15:07.000Z,
  updated: 2019-04-10T21:15:07.000Z }
Grape: { id: 'apple',
  name: 'Apple',
  color: 'red',
  status: 'active',
  created: 2019-04-10T21:15:07.000Z,
  updated: 2019-04-10T21:15:07.000Z }

Finding records...
Fruit: [ { id: 'apple',
    name: 'Apple',
    color: 'red',
    status: 'active',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z },
  { id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z } ]

Updating records...
Apple: { id: 'apple',
  name: 'Green Apple',
  color: 'green',
  status: 'active',
  created: 2019-04-10T21:15:07.000Z,
  updated: 2019-04-10T21:15:07.604Z }
Grape: { id: 'apple',
  name: 'Purple Grape',
  color: 'purple',
  status: 'active',
  created: 2019-04-10T21:15:07.000Z,
  updated: 2019-04-10T21:15:07.635Z }

Deleting doc...
Apple: { id: 'apple',
  name: 'Green Apple',
  color: 'green',
  status: 'dead',
  created: 2019-04-10T21:15:07.000Z,
  updated: 2019-04-10T21:15:07.664Z }

Finding records...
Fruit: [ { id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z } ]

Finding all records...
Fruit: [ { id: 'apple',
    name: 'Green Apple',
    color: 'green',
    status: 'dead',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z },
  { id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z } ]

Permanently delete record..

Finding all records...
Fruit: [ { id: 'grape',
    name: 'Grape',
    color: 'green',
    status: 'active',
    created: 2019-04-10T21:15:07.000Z,
    updated: 2019-04-10T21:15:07.000Z } ]

Permanently delete all records...
1 docs affected

Finding all records...
Fruit: []
DONE!

```