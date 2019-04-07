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

        app.services.db.pool.should.be.ok();

    });

    it('should explode if no config given', () => {
        (() => { new MySQLService(app) }).should.throw(/config/);
    });

    it('should query', (done) => {
        app.services.db.query('SHOW DATABASES;', (err, res) => {
            should(err).be.exactly(null);
            should(res).be.ok();
            should(res.results).be.an.Array();
            res.results.length.should.be.greaterThan(0);
            done();
        });
    });

    it('should query w/ options', (done) => {
        app.services.db.query('SHOW DATABASES;', {}, (err, res) => {
            should(err).be.exactly(null);
            should(res).be.ok();
            should(res.results).be.an.Array();
            res.results.length.should.be.greaterThan(0);
            done();
        });
    });

    it('should query without a callback', async () => {
        const res = await app.services.db.query('SHOW DATABASES;');
        should(res).be.ok();
    });

    it('should report query errors', (done) => {
        app.services.db.query('SHOW DATATHINGS;', (err, res) => {
            //console.log(err, res);
            err.should.be.an.Object();
            err.message.should.match(/ER_PARSE_ERROR/);
            should(res).be.exactly(undefined);
            done();
        });
    });

    it('should report query errors w/ promise', (done) => {
        app.services.db.query('SHOW DATATHINGS;').catch((err) => {
            err.should.be.an.Object();
            err.message.should.match(/ER_PARSE_ERROR/);
            done();
        });
    });

    it('should get a connection', (done) => {
        app.services.db.getConnection((err, connection) => {
            should(err).be.null();
            should(connection).be.an.Object();

            //Issue a query
            connection.query('SHOW DATABASES;', (err, res) => {
                should(err).be.exactly(null);

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                connection.release();
                done();
            });
        });
    });

    it('should get a connection w/ promise', (done) => {
        app.services.db.getConnection().then((connection) => {
            should(connection).be.an.Object();

            //Issue a query
            app.services.db.wrapQuery(connection, 'SHOW DATABASES;').then(({results:res}) => {

                should(res).be.an.Array();
                res.length.should.be.greaterThan(0);

                connection.release();
                done();
            });
        });
    });

});