"use strict";

const OkanjoApp = require('okanjo-app');
// const MariaDBService = require('okanjo-app-mysql/MariaDBService');
const MariaDBService = require('../../MariaDBService');
// const MariaDBCrudService = require('okanjo-app-mysql/MariaDBCrudService');
const MariaDBCrudService = require('../../MariaDBCrudService');

const config = require('./config');
const app = new OkanjoApp(config);

// Example service using the relational CRUD service
class FruitService extends MariaDBCrudService {
    constructor(app) {
        super(app, {
            service: app.services.db,
            schema: 'my_database',
            table: 'my_fruit',
            modifiableKeys: [
                'name',
                'color'
            ]
        });

        // Create the database/collection if not present on app start
        app.registerServiceConnector(async () => await this.init());
    }

    /**
     * Create the table schema if not present
     * @param {Connection} connection – Active connection
     * @returns {Promise<void>}
     * @protected
     */
    async _createTable(connection) {   // Only hook that is required for this.init()
        /* const res = */ await this.service.query(`
            CREATE TABLE ${this.schema}.${this.table} (
                \`id\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`color\` varchar(255) NOT NULL,
                \`status\` varchar(255) NOT NULL,
                \`created\` datetime NOT NULL,
                \`updated\` datetime NOT NULL, 
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        `, { connection });
    }

    // Other optional hooks you might be interested in
    async _createSchema(connection) { return await super._createSchema(connection); }
    async _updateSchema(connection) { return await super._updateSchema(connection); }
    async _updateTable(connection) { return await super._updateTable(connection); }
}

app.services = {};
app.services.db = new MariaDBService(app, app.config.mariadb);
app.services.fruit = new FruitService(app);

app.connectToServices().then(async () => {

    // Create docs
    console.log('\nInserting records...');
    let apple = await app.services.fruit.create({
        id: 'apple',
        name: 'Apple',
        color: 'red',
        status: 'active',
        created: new Date(),
        updated: new Date()
    });
    let grape = await app.services.fruit.create({
        id: 'grape',
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
    console.log('%d docs affected', res.affectedRows);

    // Find all docs, including concealed docs
    console.log('\nFinding all records...');
    docs = await app.services.fruit.find({}, { conceal: false });
    console.log('Fruit:', docs);


}).finally(async () => {
    console.log('DONE!');
    await app.services.db.close();
});