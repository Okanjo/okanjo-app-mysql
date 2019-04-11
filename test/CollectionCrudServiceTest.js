"use strict";

const should = require('should');

describe('CrudService', () => {

    const MySQLService = require('../MySQLService');
    const CollectionCrudService = require('../CollectionCrudService');
    const OkanjoApp = require('okanjo-app');
    const config = require('./config');

    let app;
    let crud;

    const schemaName = 'crud_test';
    const collectionName = 'accounts';
    const now = new Date('2019-04-09T12:21:00-05:00');

    const purgeTable = async () => {
        const session = await app.services.db.getSession();
        await session
            .getSchema(schemaName)
            .getCollection(collectionName)
            .remove('true')
            .execute();
    };

    const createDummyRecord = async (data) => {
        const doc = await crud.create(data || {
            _id: 'a',
            username: 'a',
            email: 'a@a.com',
            first_name: null,
            last_name: null,
            status: 'active',
            created: now,
            updated: now
        });
        should(doc).be.ok();

        if (!data) {
            doc._id.should.be.exactly('a');
            doc.username.should.be.exactly('a');
            doc.email.should.be.exactly('a@a.com');
            should(doc.first_name).be.exactly(null);
            should(doc.last_name).be.exactly(null);
            doc.status.should.be.exactly('active');
            doc.created.should.be.equal(now);
            doc.updated.should.be.equal(now);
        }

        return doc;
    };

    before((done) => {

        app = new OkanjoApp(config);

        app.services = {
            db: new MySQLService(app, app.config.mysql.my_database)
        };

        app.connectToServices()
            .then(() => {
                app.services.db.client.should.be.ok();
                return app.services.db.getSession();
            })
            .then(session => {
                return session
                    .dropSchema(schemaName)
                    .then(() => Promise.resolve(session))
                ;
            })
            .then(session => {
                return session
                    .createSchema(schemaName)
                    .then(() => Promise.resolve(session))
                ;
            })
            .then(session => {
                return session
                    .getSchema(schemaName)
                    .createCollection(collectionName)
                    // .then(() => Promise.resolve(session))
                ;
            })
            //// MySQL 5.7 does not support creating indices... COOL™
            // .then(session => {
            //     return session
            //         .getSchema(schemaName)
            //         .getCollection(collectionName)
            //         .createIndex("username", {
            //             fields: [
            //                 {
            //                     field: '$.username',
            //                     type: 'TEXT(10)',
            //                     required: true
            //                 }
            //             ]}
            //         );
            // })
            .then(() => {

                crud = new CollectionCrudService(app, {
                    service: app.services.db,
                    schema: schemaName,
                    collection: collectionName
                });

                should(crud).be.ok();

                done();
            })
            .catch(err => {
                done(err);
            })
        ;

    });

    after(async () => {
        // close the pool, since it'll hold open the app
        await app.services.db.close();
    });

    describe('constructor', () => {

        it('should accept various options', (done) => {

            let crud = new CollectionCrudService(app, {
                service: app.services.db,
                database: schemaName,
                table: collectionName,
                createRetryCount: 2,
                modifiableKeys: ['hi'],
                deletedStatus: 'kaput',
                concealDeadResources: false,
                generateIds: true
            });

            // noinspection JSAccessibilityCheck
            crud._createRetryCount.should.be.exactly(2);
            // noinspection JSAccessibilityCheck
            crud._modifiableKeys.should.deepEqual(['hi']);
            // noinspection JSAccessibilityCheck
            crud._deletedStatus.should.be.exactly('kaput');
            // noinspection JSAccessibilityCheck
            crud._concealDeadResources.should.be.exactly(false);

            done();
        });

    });

    describe('getSchema', () => {

        it('should get the underlying Schema object', (done) => {

            crud.getSchema((err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();

                res.session.close().then(() => done());
            });

        });

        it('should get the underlying Schema object w/ null session', (done) => {

            crud.getSchema(null, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();

                res.session.close().then(() => done());
            });

        });

        it('should get the underlying Schema object w/ promise', (done) => {

            crud.getSchema().then(res => {
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();

                res.session.close().then(() => done());
            });

        });

        it('should get the underlying Schema object w/ given session', (done) => {

            crud.service.getSession()
                .then(session => {
                    return crud.getSchema(session)
                })
                .then(res => {
                    should(res).be.ok();
                    should(res.session).be.ok();
                    should(res.schema).be.ok();
                    return res.session.close();
                })
                .then(() => {
                    done();
                })
                .catch(err => done(err))
            ;

        });

    });

    describe('getCollection', () => {

        it('should get the collection', (done) => {
            crud.getCollection(null, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();
                should(res.collection).be.ok();

                res.session.close().then(() => done());
            });
        });

        it('should get the collection w/o session', (done) => {
            crud.getCollection((err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();
                should(res.collection).be.ok();

                res.session.close().then(() => done());
            });
        });

        it('should get the collection w/ promise', (done) => {
            crud.getCollection().then((res) => {
                should(res).be.ok();
                should(res.session).be.ok();
                should(res.schema).be.ok();
                should(res.collection).be.ok();

                res.session.close().then(() => done());
            });
        });



        it('should get the collection w/ session', (done) => {
            crud.service.getSession()
                .then(session => {
                    return crud.getCollection(session)
                })
                .then(res => {
                    should(res).be.ok();
                    should(res.session).be.ok();
                    should(res.schema).be.ok();
                    should(res.collection).be.ok();

                    return res.session.close();
                })
                .then(() => {
                    done();
                })
                .catch(err => done(err))
            ;
        });

    });

    describe('init', () => {

        describe('basic usage', () => {

            let crud;

            before(async () => {

                crud = new CollectionCrudService(app, {
                    service: app.services.db,
                    schema: 'unittest_init',
                    collection: 'test_collection'
                });

                const session = await crud.service.getSession();
                await session.dropSchema(crud.schema);
                await session.close();
            });

            it('init should create schema and collection when not present', async () => {
                await crud.init();

                const { session, schema, collection } = await crud.getCollection();

                let exists = await schema.existsInDatabase();
                exists.should.be.exactly(true);

                exists = await collection.existsInDatabase();
                exists.should.be.exactly(true);

                await session.close()
            });

            it('init should not have a problem if they already exist', async () => {
                await crud.init();

                const { session, schema, collection } = await crud.getCollection();

                let exists = await schema.existsInDatabase();
                exists.should.be.exactly(true);

                exists = await collection.existsInDatabase();
                exists.should.be.exactly(true);

                await session.close()
            });

        });

        describe('power usage', () => {

            let crud;
            let firedCreateSchema = false;
            let firedCreateCollection = false;
            let firedUpdateSchema = false;
            let firedUpdateCollection = false;

            before(async () => {

                class UnitTestService extends CollectionCrudService {

                    constructor(app) {
                        super(app, {
                            service: app.services.db,
                            schema: 'unittest_init',
                            collection: 'test_collection'
                        });
                    }

                    async _createSchema(session) {
                        firedCreateSchema.should.be.exactly(false);
                        firedCreateSchema = true;
                        return await super._createSchema(session);
                    }

                    async _updateSchema(session, schema) {
                        firedUpdateSchema.should.be.exactly(false);
                        firedUpdateSchema = true;
                        return await super._updateSchema(session, schema);
                    }

                    async _createCollection(session, schema) {
                        await super._createCollection(session, schema);
                        firedCreateCollection.should.be.exactly(false);
                        firedCreateCollection = true;
                    }

                    async _updateCollection(session, table) {
                        await super._updateCollection(session, table);
                        firedUpdateCollection.should.be.exactly(false);
                        firedUpdateCollection = true;
                    }

                }

                crud = new UnitTestService(app);

                const session = await crud.service.getSession();
                await session.dropSchema(crud.schema);
                await session.close();
            });

            it('it should create the database and collection', (done) => {
                firedCreateSchema = false;
                firedUpdateSchema = false;
                firedCreateCollection = false;
                firedUpdateCollection = false;
                crud.init()
                    .then(() => {
                        firedCreateSchema.should.be.exactly(true);
                        firedUpdateSchema.should.be.exactly(false);
                        firedCreateCollection.should.be.exactly(true);
                        firedUpdateCollection.should.be.exactly(false);
                        done();
                    })
                    .catch(err => done(err))
                ;
            });

            it('it should have no problem if everything exists already', (done) => {
                firedCreateSchema = false;
                firedUpdateSchema = false;
                firedCreateCollection = false;
                firedUpdateCollection = false;
                crud.init()
                    .catch(err => done(err))
                    .then(() => {
                        firedCreateSchema.should.be.exactly(false);
                        firedUpdateSchema.should.be.exactly(true);
                        firedCreateCollection.should.be.exactly(false);
                        firedUpdateCollection.should.be.exactly(true);
                        done();
                    })
                ;
            });

        });

    });

    describe('_encode, _decode', () => {

        it('should encode and decode payloads', () => {

            // Original, typical payload
            const payload = {
                _id: 'something',
                num: 42,
                nil: null,
                arr: [1,"2",3,now],
                created: now
            };

            // Clone it for sending to MySQL
            const clone = crud._encode(payload);
            clone.should.not.be.exactly(payload);
            clone.should.deepEqual({
                _id: 'something',
                num: 42,
                nil: null,
                arr: [ 1, '2', 3, '2019-04-09T17:21:00.000Z' ],
                created: '2019-04-09T17:21:00.000Z'
            });
            clone.created.should.have.type('string');

            // Take a MySQL payload and convert it back for the application
            const returned = crud._decode(clone);
            returned.should.deepEqual(payload);
            returned.created.should.be.instanceOf(Date);
        });

    });

    describe('_create', () => {

        before(async () => {
            await purgeTable();
        });

        it('should create a record', async () => {
            const doc = await crud.create({
                _id: 'a',
                username: 'a',
                email: 'a@a.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });

            should(doc).be.ok();
            should(doc._id).be.ok();
        });

        it('should create a record without an id', async () => {
            const doc = await crud.create({
                username: 'b',
                email: 'b@b.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, null);

            should(doc).be.ok();
            should(doc._id).be.ok();

            // console.log(doc);
        });

        it('should fail to create with collision', () => {
            return crud.create({
                _id: 'a',
                username: 'aa',
                email: 'a@a.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }).should.be.rejectedWith({ info: { code: CollectionCrudService._collisionErrorCode } })

        });

    });

    describe('_createWithRetry', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
        });

        it('should create a record on second attempt (pk collision)', (done) => {
            crud.createWithRetry({
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                data._id = attempt === 0 ? 'a' : 'b'; // a will collide on first attempt, second will fix it
                return data;
            }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc._id.should.be.exactly('b');
                doc.username.should.be.exactly('b');
                doc.email.should.be.exactly('b@b.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('active');
                doc.created.should.be.equal(now);
                doc.updated.should.be.equal(now);

                done();
            });
        });

        it('should create a record on second attempt (pk collision) w/ promise', async () => {
            const doc = await crud.createWithRetry({
                email: 'bb@bb.com',
                username: 'bb',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                data._id = attempt === 0 ? 'a' : 'bb'; // a will collide on first attempt, second will fix it
                return data;
            });

            should(doc).be.ok();
            doc._id.should.be.exactly('bb');
            doc.username.should.be.exactly('bb');
            doc.email.should.be.exactly('bb@bb.com');
            should(doc.first_name).be.exactly(null);
            should(doc.last_name).be.exactly(null);
            doc.status.should.be.exactly('active');
            doc.created.should.be.equal(now);
            doc.updated.should.be.equal(now);

        });

        it('should should give up when the closure is stubborn', (done) => {
            crud.createWithRetry({
                _id: 'b',
                username: 'c',
                email: 'c@c.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                attempt.should.be.lessThanOrEqual(2);
                return data;
            }, (err) => {
                should(err).be.ok();

                done();
            });
        });

        it('should should give up when the closure is stubborn w/ promise', (done) => {
            crud.createWithRetry({
                _id: 'a',
                username: 'a',
                email: 'a@a.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                attempt.should.be.lessThanOrEqual(2);
                return data;
            }).catch((err) => {
                should(err).be.ok();

                done();
            });
        });

        it('should handle error ', (done) => {
            crud.createWithRetry(null, (data, attempt) => {
                attempt.should.be.lessThanOrEqual(0);
                return data;
            }, (err) => {
                should(err).be.ok();
                err.info.code.should.be.exactly(5115);
                done();
            });
        });

        it('should handle error w/ promise', (done) => {
            crud.createWithRetry(null, (data, attempt) => {
                attempt.should.be.lessThanOrEqual(0);
                return data;
            }).catch((err) => {
                should(err).be.ok();
                err.info.code.should.be.exactly(5115);
                done();
            });
        });

    });

    describe('_retrieve', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
        });

        it('should callback null with no id present', (done) => {
            crud.retrieve(undefined, (err, doc) => {
                should(err).be.exactly(null);
                should(doc).be.exactly(null);

                crud.retrieve(null, (err, doc) => {
                    should(err).be.exactly(null);
                    should(doc).be.exactly(null);

                    done();
                });

            });
        });

        it('should not retrieve a bogus record', (done) => {

            crud.retrieve('bogus', null, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.exactly(null);

                done();
            });

        });

        it('should retrieve a record', (done) => {

            crud.retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                // console.log(doc);

                doc._id.should.be.exactly('a');
                doc.username.should.be.exactly('a');
                doc.email.should.be.exactly('a@a.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('active');
                doc.created.toISOString().should.be.equal(now.toISOString());
                doc.updated.toISOString().should.be.equal(now.toISOString());

                done();
            })

        });

        it('should not retrieve a dead resource', (done) => {
            crud.create({
                _id: 'dead',
                username: 'dead',
                email: 'dead@dead.com',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc._id.should.be.exactly('dead');
                doc.username.should.be.exactly('dead');
                doc.email.should.be.exactly('dead@dead.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('dead');
                doc.created.should.be.equal(now);
                doc.updated.should.be.equal(now);

                // now try fetching it
                crud.retrieve('dead', (err, doc) => {
                    should(err).not.be.ok();
                    should(doc).not.be.ok();

                    done();
                });
            });
        });

        it('should retrieve dead resource if concealment is disabled', (done) => {
            crud._concealDeadResources = false;
            crud.retrieve('dead', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc._id.should.be.exactly('dead');
                doc.username.should.be.exactly('dead');
                doc.email.should.be.exactly('dead@dead.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('dead');
                doc.created.toISOString().should.be.equal(now.toISOString());
                doc.updated.toISOString().should.be.equal(now.toISOString());

                crud._concealDeadResources = true;
                done();
            });
        });

        it('should handle errors', (done) => {
            crud.retrieve({a:1}, null, (err, doc) => {
                should(err).be.ok();
                should(doc).not.be.ok();

                done();
            });
        });

    });

    describe('_find', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord({
                _id: 'a',
                email: 'a@a.com',
                username: 'a',
                first_name: null,
                last_name: null,
                status: 'active',
                order: 2,
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                order: 1,
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                order: 3,
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                order: 7,
                created: now,
                updated: now
            });
        });

        it('should find all alive resources', (done) => {
            crud.find({}, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should find all alive resources (null options)', (done) => {
            crud.find({}, null, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should find all resources if concealment is disabled', (done) => {
            crud._concealDeadResources = false;
            crud.find({}, (err, docs) => {
                crud._concealDeadResources = true;
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                done()
            });
        });

        it('should find all resources if concealment explicitly disabled', (done) => {
            crud.find({}, { conceal: false }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                done()
            });
        });

        it('should find all resources if concealment is disabled and criteria is empty', (done) => {
            crud._concealDeadResources = false;
            crud.find(null, (err, docs) => {
                crud._concealDeadResources = true;
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                // console.log(docs);


                done()
            });
        });

        it('should combine status and concealment args', (done) => {
            crud.find({
                status: 'active'
            }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done()
            });
        });

        it('should include concealment with an empty criteria set', (done) => {
            crud.find(null, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done()
            });
        });

        it('should return only the fields asked for if specified', (done) => {
            crud.find({}, { fields: { username: 1 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c
                docs.forEach((doc) => {
                    should(doc._id).be.ok(); // id should be present even if you didn't ask for it
                    should(doc.username).be.ok();
                    should(doc.email).not.be.ok();
                });

                done()
            });
        });

        it('should return only the fields asked for if specified with no id', (done) => {
            crud.find({}, { fields: { _id: 0, username: 1 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // a, b, c
                docs.forEach((doc) => {
                    should(doc._id).not.be.ok(); // id was explicitly disabled
                    should(doc.username).be.ok();
                    should(doc.email).not.be.ok();
                });

                done()
            });
        });

        it('should sort by a given field or fields', (done) => {
            crud.find({}, { sort: { _id: -1, username: 1 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(3); // c, b, a
                docs.forEach((doc, i) => {
                    switch(i) {
                        case 0: doc._id.should.be.exactly('c'); break;
                        case 1: doc._id.should.be.exactly('b'); break;
                        case 2: doc._id.should.be.exactly('a'); break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done()
            });
        });

        it('should handle pagination', (done) => {
            crud.find({}, { skip: 0, take: 2 }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();

                docs.length.should.be.exactly(2); // a, b
                docs.forEach((doc, i) => {
                    switch(i) {
                        case 0: doc._id.should.be.exactly('a'); break;
                        case 1: doc._id.should.be.exactly('b'); break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                crud.find({}, { skip: 2, take: 2 }, (err, docs) => {
                    should(err).not.be.ok();
                    should(docs).be.ok();

                    docs.length.should.be.exactly(1); // c
                    docs[0]._id.should.be.exactly('c');

                    done();

                });

            });
        });

        it('should handle offset, no limit', (done) => {
            crud.find({}, { skip: 1 }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2); // b, c
                docs.forEach((doc, i) => {
                    switch (i) {
                        case 0:
                            doc._id.should.be.exactly('b');
                            break;
                        case 1:
                            doc._id.should.be.exactly('c');
                            break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done();
            });
        });

        it('should handle limit, no offset', (done) => {
            crud.find({}, { take: 2 }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2); // a, b
                docs.forEach((doc, i) => {
                    switch (i) {
                        case 0:
                            doc._id.should.be.exactly('a');
                            break;
                        case 1:
                            doc._id.should.be.exactly('b');
                            break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done();
            });
        });

        it('should handle special operator: array (in)', (done) => {
            crud.find({ _id: ['a','b'] }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2); // a, b

                done();
            });
        });

        it('should handle special operator: $ne array (not in)', (done) => {
            crud.find({ _id: { $ne: ['a','b'] } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(1); // c

                done();
            });
        });

        it('should handle special operator: $gt', (done) => {
            crud.find({ order: { $gt: 2 }}, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(1);

                done();
            });
        });

        it('should handle special operator: $gte', (done) => {
            crud.find({ order: { $gte: 2 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2);

                done();
            });
        });

        it('should handle special operator: $lt', (done) => {
            crud.find({ order: { $lt: 2 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(1);

                done();
            });
        });

        it('should handle special operator: $lte', (done) => {
            crud.find({ order: { $lte: 2 } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2);

                done();
            });
        });

        it('should handle special operator: $ne', (done) => {
            crud.find({ _id: { $ne: 'a' } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(2); // b, c

                done();
            });
        });

        it('should handle regular operator: =', (done) => {
            crud.find({ _id: 'a' }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(1); // a

                done();
            });
        });

        it('should warn when you are crazy', (done) => {
            crud.find({ created: { $crazy: 'yes' } }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle errors', (done) => {
            crud.find({ _id: { $gt: {a:1} } }, (err, docs) => {
                should(err).be.ok();
                should(docs).not.be.ok();

                done();
            });
        });

    });

    describe('_buildCriteria', () => {

        it('should handle edge cases', () => {
            crud._buildCriteria({}, [], {});
        });

    });

    describe('_count', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
        });

        it('should get a count', (done) => {
            crud.count({}, (err, count) => {
                should(err).not.be.ok();
                should(count).be.ok();

                count.should.be.exactly(3);

                done();
            });
        });

        it('should get a count with no options', (done) => {
            crud.count({}, null, (err, count) => {
                should(err).not.be.ok();
                should(count).be.ok();

                count.should.be.exactly(3);

                done();
            });
        });

        it('should get a count with options', (done) => {
            crud.count({ }, { conceal: false }, (err, count) => {
                should(err).not.be.ok();
                should(count).be.ok();

                count.should.be.exactly(4);

                done();
            });
        });

        it('should handle errors', (done) => {
            crud.count({ _id: { $gt: { a: 1 }}}, (err, count) => {
                should(err).be.ok();
                should(count).not.be.ok();

                done();
            });
        });

    });

    describe('_update', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
        });

        it('should update a doc', (done) => {
            crud.retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc.first_name = 'unit';
                doc.last_name = 'test';

                crud.update(doc, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();

                    // The reference should not have been broken
                    doc.should.be.exactly(doc2);

                    // The updated time should have changed
                    doc2.updated.toISOString().should.not.be.exactly(now.toISOString());

                    // Fetch a clean copy
                    crud.retrieve('a', (err, doc) => {
                        should(err).not.be.ok();
                        should(doc).be.ok();

                        doc.first_name.should.be.exactly('unit');
                        doc.last_name.should.be.exactly('test');

                        done();
                    });
                });
            });
        });

        it('should apply modifiable fields', (done) => {
            crud.retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                crud._modifiableKeys = ['first_name', 'last_name'];

                crud.update(doc, {first_name: 'unit2', last_name: 'test2'}, null, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();

                    doc2.first_name.should.be.exactly('unit2');
                    doc2.last_name.should.be.exactly('test2');

                    done();
                });
            });
        });

        it('should handle disabling updatedField', (done) => {
            crud.retrieve('b', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                crud.updatedField = null;
                crud.update(doc, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();
                    crud.updatedField = 'updated';

                    // The reference should not have been broken
                    doc.should.be.exactly(doc2);

                    // The updated time should have changed
                    doc2.updated.toISOString().should.be.exactly(now.toISOString());

                    // Fetch a clean copy
                    crud.retrieve('b', (err, doc) => {
                        should(err).not.be.ok();
                        should(doc).be.ok();

                        doc.updated.toISOString().should.be.exactly(now.toISOString());

                        done();
                    });
                });
            });
        });

        it('should error if you do not identify your object', (done) => {
            const doc = { username: 'bogus' };
            crud.update(doc, (err, doc) => {
                should(err).be.ok();
                should(doc).be.exactly(null);

                done();
            });
        });

        it('should handle errors', (done) => {
            crud.update({ _id: { a: 1 }, stuff: 'oops'}, (err, doc2) => {
                should(err).be.ok();
                should(doc2).not.be.ok();

                done();
            });
        });
    });

    describe('_bulkUpdate', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
        });

        it('should bulk update matched records', (done) => {
            crud.bulkUpdate({ _id: ['a','b'] }, { first_name: 'bulk' }, (err, result) => {
                should(err).not.be.ok();
                should(result).be.ok();

                result.getAffectedItemsCount().should.be.exactly(2);

                done();
            });
        });

        it('should not set updated when configured to do so', (done) => {
            crud.updatedField = null;
            crud.bulkUpdate({ _id: ['a','b'] }, { first_name: 'bulk2' }, null, (err, res) => {
                crud.updatedField = 'updated';
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(2); // we looked at 2 rows

                done();
            });
        });

        it('should update all rows if no criteria set', (done) => {
            crud.bulkUpdate({ }, { first_name: "bob" }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(3); // a, b, c  (dead not affected)

                done();
            });
        });

        it('should update all rows if no criteria set, without concealment', (done) => {
            crud.bulkUpdate({ }, { first_name: 'bulkers' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(4); // a, b, c, dead

                done();
            });
        });

        it('should update all rows if falsey criteria set, without concealment', (done) => {
            crud.bulkUpdate(null, { first_name: 'bulkers' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();


                res.getAffectedItemsCount().should.be.exactly(4); // a, b, c, dead

                done();
            });
        });

        it('should update all rows and merge status criteria, with concealment', (done) => {
            crud.bulkUpdate({ status: 'active' }, { first_name: 'merge' }, { conceal: true }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();


                res.getAffectedItemsCount().should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle errors', (done) => {
            crud.bulkUpdate({ _id: { $gt: {a: 1} }}, { first_name: 'bulk' }, (err, result) => {
                should(err).be.ok();
                should(result).not.be.ok();

                done();
            });
        });

    });

    describe('_delete', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
        });

        it('should fake delete a record', (done) => {
            const doc = { _id: 'c' };
            crud.delete(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc2.should.be.exactly(doc);
                doc2.status.should.be.exactly('dead');

                crud.retrieve('c', (err, doc) => {
                    should(err).not.be.ok();
                    should(doc).be.exactly(null);

                    done();
                });
            });
        });

    });

    describe('_bulkDelete', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
        });

        it('should bulk delete with no options', (done) => {
            crud.bulkDelete({ status: 'active' }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(3);

                done();
            });
        });

        it('should bulk delete with options', (done) => {
            crud.bulkDelete({ _id: 'c' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(1); // c

                done();
            });
        });

    });

    describe('_deletePermanently', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
        });

        it('should really delete a record', (done) => {
            const doc = { _id: 'b' };
            crud.deletePermanently(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc2).be.ok();

                doc2.should.be.exactly(doc);

                crud.find({}, { conceal: false }, (err, docs) => {
                    should(err).not.be.ok();
                    should(docs).be.ok();

                    docs.length.should.be.exactly(0);

                    done();
                });
            });
        });

        it('should error when no id given', (done) => {
            const doc = {};
            crud.deletePermanently(doc, null, (err, doc) => {
                should(err).be.ok();
                should(doc).be.exactly(doc);

                done();
            });
        });

        it('trying to delete something that was already deleted should be ok', (done) => {
            const doc = { _id: 'b' };
            crud.deletePermanently(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc2).be.ok();

                doc2.should.be.exactly(doc);

                done();
            });
        });

        it('should handle errors', (done) => {
            const doc = { _id: {} };
            crud.deletePermanently(doc, (err, doc2) => {
                should(err).be.ok();
                should(doc2).not.be.ok();

                done();
            });
        });

    });

    describe('_bulkDeletePermanently', () => {

        before(async () => {
            await purgeTable();
            await createDummyRecord();
            await createDummyRecord({
                _id: 'b',
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'c',
                email: 'c@c.com',
                username: 'c',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
            await createDummyRecord({
                _id: 'd',
                email: 'd@d.com',
                username: 'd',
                first_name: null,
                last_name: null,
                status: 'dead',
                created: now,
                updated: now
            });
        });

        it('should bulk delete everything (no criteria, no opts)', (done) => {
            crud.bulkDeletePermanently(null, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(2); // a,b

                done();
            });
        });

        it('should bulk delete no conceal', (done) => {
            crud.bulkDeletePermanently({ _id: 'd' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(1); // d

                done();
            });
        });

        it('should bulk delete conceal with status', (done) => {
            crud.bulkDeletePermanently({ status: 'dead' }, { conceal: true }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(0); // lol dead things are concealed, so duh 0

                done();
            });
        });

        it('should bulk delete no conceal with falsey criteria', (done) => {
            crud.bulkDeletePermanently(null, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(1); // dead, c

                done();
            });
        });

        it('should handle errors', (done) => {
            crud.bulkDeletePermanently({ _id: { $gt: {a: 1} } }, null, (err, res) => {
                should(err).be.ok();
                should(res).not.be.ok();

                done();
            });
        });

    });

    describe('Transactions', () => {

        // All crud functions should work in a transaction w/ options
        let session;

        before((done) => {
            app.services.db.getSession()
                .then(sess => {
                    session = sess;

                    return session.startTransaction();
                })
                .then(() => {
                    done();
                })
                .catch(err => {
                    throw err;
                });
        });

        after((done) => {
            session.commit()
                .then(() => {
                    return session.close();
                })
                .then(() => {
                    done();
                })
            ;
        });

        it('_create in transaction', (done) => {
            crud.create({
                _id: 'txn',
                username: 'txn',
                email: 'txn@txn.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_createWithRetry in transaction', (done) => {
            crud.createWithRetry({
                _id: 'txn2',
                username: 'txn2',
                email: 'txn2@txn2.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                attempt.should.be.lessThanOrEqual(2);
                data._id = 'txn2'; // a will collide on first attempt, second will fix it
                return data;
            }, { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_retrieve in transaction', (done) => {
            crud.retrieve('txn', { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_find in transaction', (done) => {
            crud.find({ _id: 'txn2' }, { session }, (err, docs) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                docs.length.should.be.exactly(1);

                done();
            });
        });

        it('_count in transaction', (done) => {
            crud.count({ _id: 'txn2' }, { session }, (err, count) => {
                should(err).not.be.ok();
                should(count).be.ok();
                count.should.be.exactly(1);

                done();
            });
        });

        it('_update in transaction', (done) => {
            crud.update({ _id: 'txn', first_name: 'changed' }, {}, { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_bulkUpdate in transaction', (done) => {
            crud.bulkUpdate({ _id: 'txn' }, { last_name: 'bulk' }, { session }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.getAffectedItemsCount().should.be.exactly(1);

                done();
            });
        });

        it('_delete in transaction', (done) => {
            crud.delete({ _id: 'txn2' }, { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_bulkDelete in transaction', (done) => {
            crud.bulkDelete({ _id: 'txn2' }, { session }, (err, res) => {
                should(err).not.be.ok();

                res.getAffectedItemsCount().should.be.exactly(0);

                done();
            });
        });

        it('_deletePermanently in transaction', (done) => {
            crud.deletePermanently({ _id: 'txn2' }, { session }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                done();
            });
        });

        it('_bulkDeletePermanently in transaction', (done) => {
            crud.bulkDeletePermanently({ _id: 'txn' }, { session }, (err, res) => {
                should(err).not.be.ok();

                res.getAffectedItemsCount().should.be.exactly(1);

                done();
            });
        });


    });

});