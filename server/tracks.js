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
    this.undef_t = 60;
    this.undef_d = 1000;
    this.stop_s = 5;
    this.stop_d = 25;
    this.move_s = 5;
    this.move_d = 110;
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
        var url = this.createParamsStr(from, to, undef_t, undef_d, stop_s, stop_d, move_s, move_d);
        url += '&gid=' + gid;
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

TracksManager.prototype.createParamsStr = function (from, to, undef_t, undef_d,
                                                    stop_s, stop_d, move_s, move_d) {
    return this.aggregatorUrl
        + 'states'
        + '?login=' + this.login
        + '&pass=' + this.password
        + '&from=' + from
        + '&to=' + to
        + '&undef_t=' + undef_t
        + '&undef_d=' + undef_d
        + '&stop_s=' + stop_s
        + '&stop_d=' + stop_d
        + '&move_s=' + move_s
        + '&move_d=' + move_d;
};

TracksManager.prototype.getRouterData = function (data, index, checkBeforeSend, callback) {
    var loc_str = '',
        points = data.routes[index].points
    me = this;

    //console.log('getRouterData', index);
    for (var i = 0; i < points.length; i++) {
        if (points[i].END_LAT != null && points[i].END_LON != null) {
            loc_str += "&loc=" + points[i].END_LAT + "," + points[i].END_LON;
        }
    }

    //console.log(this.routerUrl + 'table?' + loc_str);
    request({
        url: this.routerUrl + 'table?' + loc_str,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            data.routes[index].time_matrix = body;
            data.routes[index].time_matrix_loaded = true;
            checkBeforeSend(data, callback);
        }
    });

    //console.log(this.routerUrl + 'viaroute?instructions=true&compression=false' + loc_str);
    request({
        url: this.routerUrl + 'viaroute?instructions=true&compression=false' + loc_str,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            if (body.route_geometry == null) {
                console.log('body.route_geometry == null');
                data.routes[index].plan_geometry_loaded = false;
                me.getGeometryByParts(data, index, 0, [], checkBeforeSend, callback);
            } else {
                data.routes[index].plan_geometry = body.route_geometry;
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(data, callback);
            }
        }
    });
};

TracksManager.prototype.getGeometryByParts = function (data, index, startPos, res, checkBeforeSend, callback) {
    var points = data.routes[index].points,
        me = this;

    request({
        url: this.routerUrl + 'viaroute?instructions=true&compression=false'
        + '&loc=' + points[startPos].END_LAT
        + "," + points[startPos].END_LON
        + '&loc=' + points[startPos + 1].END_LAT
        + "," + points[startPos + 1].END_LON,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            res = res.concat(body.route_geometry);
            startPos++;
            //console.log('iteration #', startPos);
            if (points.length > startPos + 1) {
                me.getGeometryByParts(data, index, startPos, res, checkBeforeSend, callback);
            } else {
                data.routes[index].plan_geometry = res;
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(data, callback);
            }
        }
    });
};

TracksManager.prototype.getRealTracks = function (data, checkBeforeSend, callback) {
    console.log('=== getRealTracks ===');

    var now = new Date(),
        url = this.createParamsStr(
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000,
            this.undef_t, this.undef_d,
            this.stop_s, this.stop_d, this.move_s, this.move_d);

    for (var i = 0; i < data.sensors.length && i < 1; i++) {
        console.log('request for sensor #', i, url + '&gid=' + data.sensors[i].GID);
        request({
            url: url + '&gid=' + data.sensors[i].GID,
            json: true
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                //log.toFLog(gid + '_' + 'track.js', body);
                //callback(body);
                console.log('sensor loaded', i);
                log.dump(data.sensors[i]);

                data.sensors[i].real_track = body;
                data.sensors[i].real_track_loaded = true;
                checkBeforeSend(data, callback);

            }
        });
    }
};

TracksManager.prototype.findPath = function (lat1, lon1, lat2, lon2, callback) {
    request({
        url: this.routerUrl + 'viaroute?instructions=true&compression=false'
        + '&loc=' + lat1
        + "," + lon1
        + '&loc=' + lat2
        + "," + lon2,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body.route_geometry);
        }
    });
};

TracksManager.prototype.findTime = function (lat1, lon1, lat2, lon2, callback) {
    request({
        url: this.routerUrl + 'table?'
        + '&loc=' + lat1
        + "," + lon1
        + '&loc=' + lat2
        + "," + lon2,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });
};

TracksManager.prototype.getTimeMatrix = function (data, index, checkBeforeSend, callback) {
    var url = this.routerUrl + 'table?',
        points = data[index];

    for (var i = 0; i < points.length; i++) {
        if (points[i].END_LAT != null && points[i].END_LON != null) {
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

TracksManager.prototype.getPlanGeometry = function (data, index, checkBeforeSend, callback) {
    var url = this.routerUrl + 'viaroute?instructions=true&compression=false',
        points = data[index];

    for (var i = 0; i < points.length; i++) {
        if (points[i].END_LAT != null && points[i].END_LON != null) {
            url += "&loc=" + points[i].END_LAT + "," + points[i].END_LON;
        }
    }

    request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            data.routes[index].plan_geometry = body.route_geometry;
            checkBeforeSend(data, callback);
        }
    });
};
