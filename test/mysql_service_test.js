const should = require('should');

describe('MySQLService', () => {

    const MySQLService = require('../MySQLService');
    const OkanjoApp = require('okanjo-app');
    const config = require('./config');

    let app;

    before(async () => {

        app = new OkanjoApp(config);

        app.services = {
            db: new MySQLService(app, app.config.mysql.my_database)
        };

        await app.connectToServices();

        app.services.db.client.should.be.ok();

    });

    after(async () => {
        // close the pool, since it'll hold open the app
        await app.services.db.close();
    });

    it('should explode if no config given', () => {
        (() => { new MySQLService(app) }).should.throw(/config/);
    });

    it('should explode if no session config given', () => {
        (() => { new MySQLService(app, {}) }).should.throw(/session/);
    });
    //
    // it('should explode if no session config given', () => {
    //     (() => { new MySQLService(app, { session: {} }) }).should.throw(/client/);
    // });

    it('should be able to handle a close even if the pool has not started', async () => {
        const app = new OkanjoApp({ mysql: { client: {}, session: {} } });
        const service = new MySQLService(app, app.config.mysql);
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
            err.info.code.should.be.exactly(1064);
            err.message.should.match(/DATATHINGS/);
            should(res).be.exactly(undefined);
            done();
        });
    });

    it('should report query errors w/ promise', (done) => {
        app.services.db.query('SHOW DATATHINGS;').catch((err) => {
            err.should.be.an.Object();
            err.info.code.should.be.exactly(1064);
            err.message.should.match(/DATATHINGS/);
            done();
        });
    });

    it('should get a connection', (done) => {
        app.services.db.getSession().then((session) => {
            should(session).be.an.Object();

            //Issue a query
            app.services.db.query('SHOW DATABASES;', (err, res) => {
                should(err).be.exactly(null);

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                session.close();
                done();
            }, { session });
        });
    });

    it('should get a connection w/ promise', (done) => {
        app.services.db.getSession().then((session) => {
            should(session).be.an.Object();

            //Issue a query
            app.services.db.query('SHOW DATABASES;').then((res) => {

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                session.close();
                done();
            }, { session });
        });
    });

    describe('escapeIdentifier', () => {

        it('should escape double quotes from a string', () => {
            should(app.services.db.escapeIdentifier('foo"bar')).be.exactly('foo\\"bar');
        });

        it('should escape mixing escaping characters and double quotes from string', () => {
            should(app.services.db.escapeIdentifier('foo\\"bar')).be.exactly('foo\\\\"bar');
        });

        it('should ignore empty strings', () => {
            should(app.services.db.escapeIdentifier('')).be.empty();
        });

        it('should escape backticks', () => {
            should(app.services.db.escapeIdentifier('foo')).be.exactly('foo');
            should(app.services.db.escapeIdentifier('fo`o')).be.exactly('fo``o');
            should(app.services.db.escapeIdentifier('fo``o-ba``r')).be.exactly('fo````o-ba````r');
        });

    });
});