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
        + "," + points[startPos].END_LON +
        '&loc=' + points[startPos + 1].END_LAT
        + "," + points[startPos + 1].END_LON,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            res = res.concat(body.route_geometry);
            startPos++;
            //console.log('iteration #', startPos);
            if(points.length > startPos + 1){
                me.getGeometryByParts(data, index, startPos, res, checkBeforeSend, callback);
            } else {
                data.routes[index].plan_geometry = res;
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(data, callback);
            }
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

//TracksManager.prototype.getGeometry
// http://sngtrans.com.ua:5201/table?
// "http://sngtrans.com.ua:5201/viaroute?instructions=true";