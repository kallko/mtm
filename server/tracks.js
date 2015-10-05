module.exports = TracksManager;

var request = require("request"),
    fs = require('fs'),
    log = new (require('./logging'))('./logs'),
    loadFromCache = true;

function TracksManager(aggregatorUrl, routerUrl, login, password) {
    this.aggregatorUrl = aggregatorUrl;
    this.routerUrl = routerUrl,
    this.login = login;
    this.password = password;
}

TracksManager.prototype.getTrack = function (gid, from, to, undef_t, undef_d,
                                             stop_s, stop_d, move_s, move_d, callback) {

    if (loadFromCache) {
        fs.readFile('./logs/' + gid + '_' + 'track.js', 'utf8', function (err, data) {
            if (err) {
                return console.log(err);
            }

            //console.log('The tracks loaded from the cache.');
            callback(JSON.parse(data));
        });
    } else {
        var url = this.aggregatorUrl
            + 'states'
            + '?login=' + this.login
            + '&pass=' + this.password
            + '&gid=' + gid
            + '&from=' + from
            + '&to=' + to
            + '&undef_t=' + undef_t
            + '&undef_d=' + undef_d
            + '&stop_s=' + stop_s
            + '&stop_d=' + stop_d
            + '&move_s=' + move_s
            + '&move_d=' + move_d;
        console.log(url);

        request({
            url: url,
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                log.toFLog(gid + '_' + 'track.js', body);
                callback(body);
            }
        });
    }
};

TracksManager.prototype.getTimeMatrix = function (points, data, index, checkBeforeSend, callback) {
    var url = this.routerUrl +  'table?';

    for (var i = 0; i < points.length; i++) {
        if(points[i].END_LAT != null && points[i].END_LON != null){
            url += "&loc=" + points[i].END_LAT + "," + points[i].END_LON;
        }
    }

    request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            //log.dump(body);

            data.routes[index].time_matrix = body;
            checkBeforeSend(data, callback);
        }
    });
};

//TracksManager.prototype.getGeometry
// http://sngtrans.com.ua:5201/table?
// "http://sngtrans.com.ua:5201/viaroute?instructions=true";