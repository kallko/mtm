module.exports = DBManager;

var pg = require('pg');
pg.defaults.poolSize = 25;

function DBManager(conString) {
    this.conString = conString;
}

DBManager.prototype.queryToDB = function (query, values, callback) {
    pg.connect(this.conString, function (err, client, done) {
        if (err) {
            return console.error('error fetching client from pool', err);
        }

        client.query(query, values, function (err, result) {
            done();
            if (err) {
                console.log('error running query', err);
            }
            callback(err, result);
        });
    });
};

DBManager.prototype.testConnection = function () {
    this.queryToDB('SELECT $1::int AS number', ['1'], function (err, result) {
        console.log(result.rows[0].number);
    });
};

DBManager.prototype.logMessage = function (user_id, message, callback) {
    console.log('logMessage:', message);
    this.queryToDB('INSERT INTO logs(user_id, utimestamp, message) VALUES ($1, $2, $3);',
        [user_id, parseInt(Date.now() / 1000), message], callback);
};