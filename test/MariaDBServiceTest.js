"use strict";

const should = require('should');

describe('MariaDBService', () => {

    const MariaDBService = require('../MariaDBService');
    const OkanjoApp = require('okanjo-app');
    const config = require('./config');

    let app;

    before(async () => {

        app = new OkanjoApp(config);

        app.services = {
            db: new MariaDBService(app, app.config.mariadb.my_database)
        };

        await app.connectToServices();

        app.services.db.pool.should.be.ok();

    });

    after(async () => {
        // close the pool, since it'll hold open the app
        await app.services.db.close();
    });

    it('should explode if no config given', () => {
        (() => { new MariaDBService(app) }).should.throw(/config/);
    });

    it('should be able to handle a close even if the pool has not started', async () => {
        const app = new OkanjoApp({ mariadb: { } });
        const service = new MariaDBService(app, app.config.mariadb);
        await service.close();
    });

    it('should query', (done) => {
        app.services.db.query('SHOW DATABASES;', (err, res) => {
            should(err).be.exactly(null);
            should(res).be.ok();
            should(res).be.an.Array();
            res.length.should.be.greaterThan(0);
            done();
        });
    });

    it('should query w/ options', (done) => {
        app.services.db.query('SHOW DATABASES WHERE ?;', [1], (err, res) => {
            should(err).be.exactly(null);
            should(res).be.ok();
            should(res).be.an.Array();
            res.length.should.be.greaterThan(0);
            done();
        });
    });

    it('should query without a callback', async () => {
        const res = await app.services.db.query('SHOW DATABASES;');
        should(res).be.ok();
        should(res).be.an.Array();
        res.length.should.be.greaterThan(0);
    });

    it('should report query errors', (done) => {
        app.services.db.query('SHOW DATATHINGS;', (err, res) => {
            //console.log(err, res);
            err.should.be.an.Object();
            err.errno.should.be.exactly(1064);
            err.message.should.match(/DATATHINGS/);
            should(res).be.exactly(undefined);
            done();
        });
    });

    it('should suppress query errors', (done) => {
        app.services.db.query('SHOW DATATHINGS;', (err, res) => {
            //console.log(err, res);
            err.should.be.an.Object();
            err.errno.should.be.exactly(1064);
            err.message.should.match(/DATATHINGS/);
            should(res).be.exactly(undefined);
            done();
        }, { suppress: 1064 });
    });

    it('should report query errors w/ promise', (done) => {
        app.services.db.query('SHOW DATATHINGS;').catch((err) => {
            err.should.be.an.Object();
            err.errno.should.be.exactly(1064);
            err.message.should.match(/DATATHINGS/);
            done();
        });
    });

    it('should get a connection', (done) => {
        app.services.db.getConnection().then((connection) => {
            should(connection).be.an.Object();

            //Issue a query
            app.services.db.query('SHOW DATABASES;', (err, res) => {
                should(err).be.exactly(null);

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                connection.end();
                done();

            }, { connection });
        });
    });

    it('should get a connection w/ promise', (done) => {
        app.services.db.getConnection().then((connection) => {
            should(connection).be.an.Object();

            //Issue a query
            app.services.db.query('SHOW DATABASES;').then((res) => {

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                connection.end();
                done();

            }, { connection });
        });
    });

    it('should error if you send query bad args', (done) => {
        app.services.db.query(1, (err) => {
            err.should.be.an.Object();
            err.message.should.match(/argument position/);
            done();
        });
    });

    it('should error if you send query bad args w/ promise', (done) => {
        app.services.db.query(1).catch((err) => {
            err.should.be.an.Object();
            err.message.should.match(/argument position/);
            done();
        });
    });

});