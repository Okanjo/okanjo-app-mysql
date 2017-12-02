const should = require('should');

describe('CrudService', () => {

    const MySQLService = require('../MySQLService');
    const CrudService = require('../CrudService');
    const OkanjoApp = require('okanjo-app');
    const config = require('./config');

    let app;

    before((done) => {

        app = new OkanjoApp(config);

        app.services = {
            db: new MySQLService(app, app.config.mysql.my_database)
        };

        app.connectToServices(() => {
            app.services.db.pool.should.be.ok();

            // Drop existing test database and table
            app.services.db.query('DROP DATABASE IF EXISTS `crud_test`;', (err) => {
                should(err).not.be.ok();

                app.services.db.query('CREATE DATABASE `crud_test`;', (err) => {
                    should(err).not.be.ok();

                    // Create test database and table
                    app.services.db.query(`
                    CREATE TABLE \`crud_test\`.\`user\` (
                      \`id\` varchar(255) NOT NULL,
                      \`username\` varchar(255) NOT NULL,
                      \`email\` varchar(255) DEFAULT NULL,
                      \`first_name\` varchar(255) DEFAULT NULL,
                      \`last_name\` varchar(255) DEFAULT NULL,
                      \`status\` varchar(255) NOT NULL,
                      \`created\` datetime NOT NULL,
                      \`updated\` datetime NOT NULL,
                      PRIMARY KEY (\`id\`),
                      UNIQUE KEY \`username_UNIQUE\` (\`username\`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`, (err) => {
                        should(err).not.be.ok();
                        done();
                    });

                });
            });
        });

    });

    let crud;

    describe('constructor', () => {

        it('should instantiate', (done) => {

            crud = new CrudService(app, {
                service: app.services.db,
                database: 'crud_test',
                table: 'user'
            });

            should(crud).be.ok();

            done();

        });

        it('should accept various options', (done) => {

            app.config.mysql.my_database.database = 'crud_test';
            let crud = new CrudService(app, {
                service: app.services.db,
                table: 'user',
                createRetryCount: 2,
                modifiableKeys: ['hi'],
                deletedStatus: 'kaput',
                concealDeadResources: false
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

    const now = new Date('2017-11-30T17:17:34-06:00');

    describe('_create', () => {

        it('should create a record', (done) => {
            crud._create({
                id: 'a',
                username: 'a',
                email: 'a@a.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc.id.should.be.exactly('a');
                doc.username.should.be.exactly('a');
                doc.email.should.be.exactly('a@a.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('active');
                doc.created.should.be.equal(now);
                doc.updated.should.be.equal(now);

                done();
            });
        });

        it('should fail to create with collision', (done) => {

            crud._create({
                id: 'a',
                username: 'aa',
                email: 'a@a.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (err) => {
                should(err).be.ok();

                done();
            });

        });

    });

    describe('_createWithRetry', () => {

        it('should create a record on second attempt (pk collision)', (done) => {
            crud._createWithRetry({
                email: 'b@b.com',
                username: 'b',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                data.id = attempt === 0 ? 'a' : 'b'; // a will collide on first attempt, second will fix it
                return data;
            }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc.id.should.be.exactly('b');
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

        it('should create a record on second attempt (unique collision)', (done) => {
            crud._createWithRetry({
                id: 'c',
                email: 'c@c.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => {
                data.username = attempt === 0 ? 'b' : 'c'; // b will collide on first attempt, second will fix it
                return data;
            }, (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc.id.should.be.exactly('c');
                doc.username.should.be.exactly('c');
                doc.email.should.be.exactly('c@c.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('active');
                doc.created.should.be.equal(now);
                doc.updated.should.be.equal(now);

                done();
            });
        });

        it('should should give up when the closure is stubborn', (done) => {
            crud._createWithRetry({
                id: 'c',
                username: 'c',
                email: 'c@c.com',
                first_name: null,
                last_name: null,
                status: 'active',
                created: now,
                updated: now
            }, (data, attempt) => data, (err) => {
                should(err).be.ok();

                done();
            });
        });

    });

    describe('_retrieve', () => {

        it('should callback null with no id present', (done) => {
            crud._retrieve(undefined, (err, doc, fields) => {
                should(err).be.exactly(null);
                should(doc).be.exactly(null);

                crud._retrieve(null, (err, doc) => {
                    should(err).be.exactly(null);
                    should(doc).be.exactly(null);
                    should(fields).be.exactly(null);

                    done();
                });

            });
        });

        it('should not retrieve a bogus record', (done) => {

            crud._retrieve('bogus', (err, doc, fields) => {
                should(err).not.be.ok();
                should(doc).be.exactly(null);
                should(fields).be.ok();

                done();
            });

        });

        it('should retrieve a record', (done) => {

            crud._retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                console.log(doc);

                doc.id.should.be.exactly('a');
                doc.username.should.be.exactly('a');
                doc.email.should.be.exactly('a@a.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('active');
                doc.created.toISOString().should.be.equal(now.toISOString());
                doc.updated.toISOString().should.be.equal(now.toISOString());

                done();
            });

        });

        it('should not retrieve a dead resource', (done) => {
            crud._create({
                id: 'dead',
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

                doc.id.should.be.exactly('dead');
                doc.username.should.be.exactly('dead');
                doc.email.should.be.exactly('dead@dead.com');
                should(doc.first_name).be.exactly(null);
                should(doc.last_name).be.exactly(null);
                doc.status.should.be.exactly('dead');
                doc.created.should.be.equal(now);
                doc.updated.should.be.equal(now);

                // now try fetching it
                crud._retrieve('dead', (err, doc, fields) => {
                    should(err).not.be.ok();
                    should(doc).not.be.ok();
                    should(fields).be.ok();

                    done();
                });
            });
        });

        it('should retrieve dead resource if concealment is disabled', (done) => {
            crud._concealDeadResources = false;
            crud._retrieve('dead', (err, doc, fields) => {
                should(err).not.be.ok();
                should(doc).be.ok();
                should(fields).be.ok();

                doc.id.should.be.exactly('dead');
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

    });

    describe('_find', () => {

        it('should find all alive resources', (done) => {
            crud._find({}, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should find all alive resources (null options)', (done) => {
            crud._find({}, null, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should find all resources if concealment is disabled', (done) => {
            crud._concealDeadResources = false;
            crud._find({}, (err, docs, fields) => {
                crud._concealDeadResources = true;
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                done()
            });
        });

        it('should find all resources if concealment explicitly disabled', (done) => {
            crud._find({}, { conceal: false }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                done()
            });
        });

        it('should find all resources if concealment is disabled and criteria is empty', (done) => {
            crud._concealDeadResources = false;
            crud._find(null, (err, docs, fields) => {
                crud._concealDeadResources = true;
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(4); // a, b, c, dead

                console.log(docs);


                done()
            });
        });

        it('should combine status and concealment args', (done) => {
            crud._find({
                status: 'active'
            }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done()
            });
        });

        it('should include concealment with an empty criteria set', (done) => {
            crud._find(null, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c

                done()
            });
        });

        it('should return only the fields asked for if specified', (done) => {
            crud._find({}, { fields: { username: 1 } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c
                docs.forEach((doc) => {
                    should(doc.id).be.ok(); // id should be present even if you didn't ask for it
                    should(doc.username).be.ok();
                    should(doc.email).not.be.ok();
                });

                done()
            });
        });

        it('should return only the fields asked for if specified with no id', (done) => {
            crud._find({}, { fields: { id: 0, username: 1 } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // a, b, c
                docs.forEach((doc) => {
                    should(doc.id).not.be.ok(); // id was explicitly disabled
                    should(doc.username).be.ok();
                    should(doc.email).not.be.ok();
                });

                done()
            });
        });

        it('should sort by a given field or fields', (done) => {
            crud._find({}, { sort: { id: -1, username: 1 } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(3); // c, b, a
                docs.forEach((doc, i) => {
                    switch(i) {
                        case 0: doc.id.should.be.exactly('c'); break;
                        case 1: doc.id.should.be.exactly('b'); break;
                        case 2: doc.id.should.be.exactly('a'); break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done()
            });
        });

        it('should handle pagination', (done) => {
            crud._find({}, { skip: 0, take: 2 }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();

                docs.length.should.be.exactly(2); // a, b
                docs.forEach((doc, i) => {
                    switch(i) {
                        case 0: doc.id.should.be.exactly('a'); break;
                        case 1: doc.id.should.be.exactly('b'); break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                crud._find({}, { skip: 2, take: 2 }, (err, docs, fields) => {
                    should(err).not.be.ok();
                    should(docs).be.ok();
                    should(fields).be.ok();

                    docs.length.should.be.exactly(1); // c
                    docs[0].id.should.be.exactly('c');

                    done();

                });

            });
        });

        it('should handle offset, no limit', (done) => {
            crud._find({}, { skip: 1 }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(2); // b, c
                docs.forEach((doc, i) => {
                    switch (i) {
                        case 0:
                            doc.id.should.be.exactly('b');
                            break;
                        case 1:
                            doc.id.should.be.exactly('c');
                            break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done();
            });
        });

        it('should handle limit, no offset', (done) => {
            crud._find({}, { take: 2 }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(2); // a, b
                docs.forEach((doc, i) => {
                    switch (i) {
                        case 0:
                            doc.id.should.be.exactly('a');
                            break;
                        case 1:
                            doc.id.should.be.exactly('b');
                            break;
                        default:
                            throw new Error('not supposed to be here');
                    }
                });

                done();
            });
        });

        it('should handle special operator: array (in)', (done) => {
            crud._find({ id: ['a','b'] }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(2); // a, b

                done();
            });
        });

        it('should handle special operator: $ne array (not in)', (done) => {
            crud._find({ id: { $ne: ['a','b'] } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(1); // c

                done();
            });
        });

        it('should handle special operator: $gt', (done) => {
            crud._find({ created: { $gt: new Date('2017-11-29T17:17:34-06:00')} }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle special operator: $gt', (done) => {
            crud._find({ created: { $gte: now } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle special operator: $lt', (done) => {
            crud._find({ created: { $lt: new Date('2017-12-01T17:17:34-06:00')} }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle special operator: $lt', (done) => {
            crud._find({ created: { $lte: now } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

        it('should handle special operator: $ne', (done) => {
            crud._find({ id: { $ne: 'a' } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(2); // b, c

                done();
            });
        });

        it('should handle regular operator: =', (done) => {
            crud._find({ id: 'a' }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(1); // a

                done();
            });
        });

        it('should warn when you are crazy', (done) => {
            crud._find({ created: { $crazy: 'yes' } }, (err, docs, fields) => {
                should(err).not.be.ok();
                should(docs).be.ok();
                should(fields).be.ok();


                docs.length.should.be.exactly(3); // a, b, c

                done();
            });
        });

    });

    describe('_count', () => {

        it('should get a count', (done) => {
            crud._count({}, (err, count, fields) => {
                should(err).not.be.ok();
                should(count).be.ok();
                should(fields).be.ok();

                count.should.be.exactly(3);

                done();
            });
        });

        it('should get a count with no options', (done) => {
            crud._count({}, null, (err, count, fields) => {
                should(err).not.be.ok();
                should(count).be.ok();
                should(fields).be.ok();

                count.should.be.exactly(3);

                done();
            });
        });

        it('should get a count with options', (done) => {
            crud._count({ }, { conceal: false }, (err, count, fields) => {
                should(err).not.be.ok();
                should(count).be.ok();
                should(fields).be.ok();

                count.should.be.exactly(4);

                done();
            });
        });

    });

    describe('_update', () => {

        it('should update a doc', (done) => {
            crud._retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc.first_name = 'unit';
                doc.last_name = 'test';

                crud._update(doc, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();

                    // The reference should not have been broken
                    doc.should.be.exactly(doc2);

                    // The updated time should have changed
                    doc2.updated.toISOString().should.not.be.exactly(now.toISOString());

                    // Fetch a clean copy
                    crud._retrieve('a', (err, doc) => {
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
            crud._retrieve('a', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                crud._modifiableKeys = ['first_name', 'last_name'];

                crud._update(doc, {first_name: 'unit2', last_name: 'test2'}, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();

                    doc2.first_name.should.be.exactly('unit2');
                    doc2.last_name.should.be.exactly('test2');

                    done();
                });
            });
        });

        it('should handle disabling updatedField', (done) => {
            crud._retrieve('b', (err, doc) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                crud.updatedField = null;
                crud._update(doc, (err, doc2) => {
                    should(err).not.be.ok();
                    should(doc2).be.ok();
                    crud.updatedField = 'updated';

                    // The reference should not have been broken
                    doc.should.be.exactly(doc2);

                    // The updated time should have changed
                    doc2.updated.toISOString().should.be.exactly(now.toISOString());

                    // Fetch a clean copy
                    crud._retrieve('b', (err, doc) => {
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
            crud._update(doc, (err, doc) => {
                should(err).be.ok();
                should(doc).be.exactly(null);

                done();
            });
        });

    });

    describe('_bulkUpdate', () => {

        it('should bulk update matched records', (done) => {
            crud._bulkUpdate({ id: ['a','b'] }, { first_name: 'bulk' }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(2);
                res.changedRows.should.be.exactly(2);

                done();
            });

        });

        it('should not set updated when configured to do so', (done) => {
            crud.updatedField = null;
            crud._bulkUpdate({ id: ['a','b'] }, { first_name: 'bulk' }, (err, res) => {
                crud.updatedField = 'updated';
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(2); // we looked at 2 rows
                res.changedRows.should.be.exactly(0); // but did not change them (updated didn't change)

                done();
            });
        });

        it('should update all rows if no criteria set', (done) => {
            crud._bulkUpdate({ }, { first_name: null }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(3); // a, b, c  (dead not affected)
                res.changedRows.should.be.exactly(3);

                done();
            });
        });

        it('should update all rows if no criteria set, without concealment', (done) => {
            crud._bulkUpdate({ }, { first_name: 'bulkers' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(4); // a, b, c, dead
                res.changedRows.should.be.exactly(4);

                done();
            });
        });

        it('should update all rows if falsey criteria set, without concealment', (done) => {
            crud._bulkUpdate(null, { first_name: 'bulkers' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();


                res.affectedRows.should.be.exactly(4); // a, b, c, dead
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

        it('should update all rows and merge status criteria, with concealment', (done) => {
            crud._bulkUpdate({ status: 'active' }, { first_name: 'merge' }, { conceal: true }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();


                res.affectedRows.should.be.exactly(3); // a, b, c
                res.changedRows.should.be.exactly(3);

                done();
            });
        });

    });

    describe('_delete', () => {

        it('should fake delete a record', (done) => {
            const doc = { id: 'c' };
            crud._delete(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc).be.ok();

                doc2.should.be.exactly(doc);
                doc2.status.should.be.exactly('dead');

                crud._retrieve('c', (err, doc) => {
                    should(err).not.be.ok();
                    should(doc).be.exactly(null);

                    done();
                });
            });
        });

    });

    describe('_bulkDelete', () => {

        it('should bulk delete with no options', (done) => {
            crud._bulkDelete({ id: 'c' }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(0); // c is dead so nothing
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

        it('should bulk delete with options', (done) => {
            crud._bulkDelete({ id: 'c' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(1); // c
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

    });

    describe('_deletePermanently', () => {

        it('should really delete a record', (done) => {
            const doc = { id: 'b' };
            crud._deletePermanently(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc2).be.ok();

                doc2.should.be.exactly(doc);

                crud._find({}, { conceal: false }, (err, docs) => {
                    should(err).not.be.ok();
                    should(docs).be.ok();

                    docs.length.should.be.exactly(3); // a, c, dead (b is really gone)

                    done();
                });
            });
        });

        it('should error when no id given', (done) => {
            const doc = {};
            crud._deletePermanently(doc, (err, doc) => {
                should(err).be.ok();
                should(doc).be.exactly(doc);

                done();
            });
        });

        it('trying to delete something that was already deleted should warn', (done) => {
            const doc = { id: 'b' };
            crud._deletePermanently(doc, (err, doc2) => {
                should(err).not.be.ok();
                should(doc2).be.ok();

                doc2.should.be.exactly(doc);

                done();
            });
        });

    });

    describe('_bulkDeletePermanently', () => {

        it('should bulk delete everything (no criteria, no opts)', (done) => {
            crud._bulkDeletePermanently(null, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(1); // a
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

        it('should bulk delete no conceal', (done) => {
            crud._bulkDeletePermanently({ id: 'c' }, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(1); // c
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

        it('should bulk delete conceal with status', (done) => {
            crud._bulkDeletePermanently({ status: 'dead' }, { conceal: true }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(0); // lol dead things are concealed, so duh 0
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

        it('should bulk delete no conceal with falsey criteria', (done) => {
            crud._bulkDeletePermanently(null, { conceal: false }, (err, res) => {
                should(err).not.be.ok();
                should(res).be.ok();

                res.affectedRows.should.be.exactly(1); // dead, conveniently the last record in the db
                res.changedRows.should.be.exactly(0);

                done();
            });
        });

    });


});