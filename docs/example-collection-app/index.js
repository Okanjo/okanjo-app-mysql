"use strict";

const OkanjoApp = require('okanjo-app');
// const MySQLService = require('okanjo-app-mysql');
const MySQLService = require('../../MySQLService');
const CollectionCrudService = require('../../CollectionCrudService');

const config = require('./config');
const app = new OkanjoApp(config);

// Example service using the collection CRUD service
class FruitService extends CollectionCrudService {

    constructor(app) {
        super(app, {
            service: app.services.mysql,
            schema: 'my_database',
            collection: 'my_collection',
            modifiableKeys: [
                'name',
                'color'
            ]
        });

        // Create the database/collection if not present on app start
        app.registerServiceConnector(async () => await this.init());
    }
}

app.services = {};
app.services.mysql = new MySQLService(app, app.config.mysql);
app.services.fruit = new FruitService(app);

app.connectToServices().then(async () => {

    // Create docs
    console.log('\nInserting records...');
    let apple = await app.services.fruit.create({
        _id: 'apple',
        name: 'Apple',
        color: 'red',
        status: 'active',
        created: new Date(),
        updated: new Date()
    });
    let grape = await app.services.fruit.create({
        _id: 'grape',
        name: 'Grape',
        color: 'green',
        status: 'active',
        created: new Date(),
        updated: new Date()
    });
    console.log('Apple:', apple);
    console.log('Grape:', grape);

    // Retrieve docs
    console.log('\nRetrieving records...');
    apple = await app.services.fruit.retrieve('apple');
    grape = await app.services.fruit.retrieve('apple');
    console.log('Apple:', apple);
    console.log('Grape:', grape);

    // Find docs
    console.log('\nFinding records...');
    let docs = await app.services.fruit.find({});
    console.log('Fruit:', docs);

    // Update docs
    console.log('\nUpdating records...');
    apple = await app.services.fruit.update(apple, { name: 'Green Apple', color: 'green' });
    grape = await app.services.fruit.update(grape, { name: 'Purple Grape', color: 'purple'});
    console.log('Apple:', apple);
    console.log('Grape:', grape);

    // Deleting docs
    console.log('\nDeleting doc...');
    apple = await app.services.fruit.delete(apple);
    console.log('Apple:', apple);

    // Find docs
    console.log('\nFinding records...');
    docs = await app.services.fruit.find({});
    console.log('Fruit:', docs);

    // Find all docs, including concealed docs
    console.log('\nFinding all records...');
    docs = await app.services.fruit.find({}, { conceal: false });
    console.log('Fruit:', docs);

    // Really delete docs
    console.log('\nPermanently delete record..');
    await app.services.fruit.deletePermanently(apple);

    // Find all docs, including concealed docs
    console.log('\nFinding all records...');
    docs = await app.services.fruit.find({}, { conceal: false });
    console.log('Fruit:', docs);

    // Really delete all records
    console.log('\nPermanently delete all records...');
    const res = await app.services.fruit.bulkDeletePermanently({});
    console.log('%d docs affected', res.getAffectedItemsCount());

    // Find all docs, including concealed docs
    console.log('\nFinding all records...');
    docs = await app.services.fruit.find({}, { conceal: false });
    console.log('Fruit:', docs);


}).finally(async () => {
    console.log('DONE!');
    await app.services.mysql.close();
});