module.exports = TracksManager;

var request = require("request"),
    fs = require('fs'),
    config = require('./config'),
    log = new (require('./logging'))('./logs'),
    loadFromCache = config.cashing.tracks;

function TracksManager(aggregatorUrl, routerUrl, login, password) {
    this.aggregatorUrl = aggregatorUrl;
    this.routerUrl = routerUrl;
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

TracksManager.prototype.getTrackByStates = function (states, gid, demoTime, callback) {
    var counter = 0,
        me = this,
        started = 0,
        updateTime = states[0].lastTrackUpdate == undefined ? 0 : states[0].lastTrackUpdate;

    //console.log('last update time,', updateTime);
    for (var i = 0; i < states.length; i++) {
        if ((demoTime != -1 && states[i].t2 > demoTime) ||
            (demoTime == -1 && states[i].t1 < updateTime + 1800)) continue;

        started++;
        (function (ii) {
            //console.log('load part #', ii);
            me.getTrackPart(gid, states[ii].t1, states[ii].t2, function (data) {
                states[ii].coords = data;
                //console.log('done loading part #', ii);
                counter++;
                if (counter == started) {
                    callback(states);
                }
            });
        })(i);
    }

    if (started == 0) {
        callback(states);
    }

};

TracksManager.prototype.getRealTrackParts = function (data, from, to, callback) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
            this.stop_d, this.move_s, this.move_d),
        counter = 0,
        reqCounter = 0,
        result = [],
        me = this;

    for (var i = 0; i < data.routes.length; i++) {
        for (var j = 0; j < data.sensors.length; j++) {
            if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                counter++;
                (function (jj) {
                    //console.log(url + '&gid=' + data.sensors[jj].GID);
                    request({
                        url: url + '&gid=' + data.sensors[jj].GID,
                        json: true
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            result.push({
                                'gid': data.sensors[jj].GID,
                                'data': body
                            });
                            reqCounter++;
                            if (counter == reqCounter) {
                                console.log('Done, loading stops!');
                                callback(result);
                            }
                        }
                    });
                })(j);
            }
        }
    }

    //request({
    //    url: url,
    //    json: true
    //}, function (error, response, body) {
    //    if (!error && response.statusCode === 200) {
    //        callback(body);
    //    }
    //});
};

TracksManager.prototype.createParamsStr = function (from, to, undef_t, undef_d,
                                                    stop_s, stop_d, move_s, move_d, op) {
    op = typeof op !== 'undefined' ? op : 'states';

    return this.aggregatorUrl
        + op
        + '?login=' + this.login
        + '&pass=' + this.password
        + '&from=' + from
        + '&to=' + to
        + '&undef_t=' + undef_t
        + '&undef_d=' + undef_d
        + '&stop_s=' + stop_s
        + '&stop_d=' + stop_d
        + '&move_s=' + move_s
        + '&move_d=' + move_d
        + '&current=true';
};

TracksManager.prototype.getRouterData = function (_data, index, nIndx, checkBeforeSend, callback, onlyOne) {

    var data = onlyOne ? _data : _data[nIndx],
        loc_str = '',
        points = data.routes[index].points,
        me = this;

    //log.toFLog('points_' + nIndx + '_' + index, points);
    //console.log('getRouterData', index);
    //console.log('points.length', points.length);
    for (var i = 0; i < points.length; i++) {
        if (points[i].LAT != null && points[i].LON != null) {
            loc_str += "&loc=" + points[i].LAT + "," + points[i].LON;
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
            checkBeforeSend(_data, callback);
        } else {
            console.log('table', points.length, body);
        }
    });

    //console.log(this.routerUrl + 'viaroute?instructions=true&compression=false' + loc_str);
    request({
        url: this.routerUrl + 'viaroute?instructions=false&compression=false' + loc_str,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            //console.log('Viaroute READY!', index);
            if (body.route_geometry == null) {
                console.log('body.route_geometry == null');
                data.routes[index].plan_geometry = [];
                data.routes[index].plan_geometry_loaded = false;
                me.getGeometryByParts(_data, nIndx, index, 0, checkBeforeSend, callback, onlyOne);
            } else {
                data.routes[index].plan_geometry = body.route_geometry_splited;
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(_data, callback);
            }
        } else {
            console.log('viaroute', points.length, body);
        }
    });
};

TracksManager.prototype.getGeometryByParts = function (_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne) {
    var data = onlyOne ? _data : _data[nIndx],
        points = data.routes[index].points,
        me = this,
        query = this.routerUrl + 'viaroute?instructions=false&compression=false'
            + '&loc=' + points[startPos].LAT
            + "," + points[startPos].LON
            + '&loc=' + points[startPos + 1].LAT
            + "," + points[startPos + 1].LON;

    //console.log(startPos, points[startPos], points[startPos + 1]);
    //log.toFLog('points', points);

    if(points[startPos].LAT == undefined || points[startPos + 1].LAT == undefined) {
        startPos++;
        me.getGeometryByParts(_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne);
        return;
    }

    request({
        url: query,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            data.routes[index].plan_geometry.push(body.route_geometry);
            startPos++;
            //console.log('iteration #', startPos);
            if (points.length > startPos + 1) {
                me.getGeometryByParts(_data, nIndx, index, startPos, checkBeforeSend, callback, onlyOne);
            } else {
                data.routes[index].plan_geometry_loaded = true;
                checkBeforeSend(_data, callback);
            }
        } else {
            console.log('getGeometryByParts ERROR', body, error, query);
        }
    });
};

TracksManager.prototype.getTracksAndStops = function (_data, nIndx, checkBeforeSend, callback) {
    console.log('=== getRealTracks ===');

    var me = this,
        data = _data[nIndx],
        now = new Date(data.server_time * 1000),
        url = this.createParamsStr(
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000,
            this.undef_t, this.undef_d,
            this.stop_s, this.stop_d, this.move_s, this.move_d);

    for (var i = 0; i < data.routes.length; i++) {
        for (var j = 0; j < data.sensors.length; j++) {
            if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                if (data.routes[i].haveSensor) {
                    data.routes[i].moreThanOneSensor = true;
                    console.log('moreThanOneSensor = true');
                    break;
                }

                data.sensors[j].loading = true;
                data.routes[i].haveSensor = true;

                (function (jj) {
                    console.log('request for stops ', jj, url + '&gid=' + data.sensors[jj].GID);
                    request({
                        url: url + '&gid=' + data.sensors[jj].GID,
                        json: true
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            console.log('stops for sensor loaded', jj);
                            data.sensors[jj].stops_loaded = true;
                            data.sensors[jj].real_track = body;
                            checkBeforeSend(_data, callback);
                            //if (body == undefined || body == "invalid parameter 'gid'. ") {
                            //    data.sensors[jj].real_track = undefined;
                            //} else {
                            //    var counter = 0;
                            //    for (var k = 0; k < body.length; k++) {
                            //        (function (kk) {
                            //            me.getTrackPart(data.sensors[jj].GID, body[kk].t1, body[kk].t2, function (trackPart) {
                            //                body[kk].coords = trackPart;
                            //                counter++;
                            //                if (counter == body.length) {
                            //                    data.sensors[jj].real_track = body;
                            //                    //log.toFLog(data.sensors[jj].GID + '_body.js', body);
                            //                    data.sensors[jj].real_track_loaded = true;
                            //                    console.log('track for sensor loaded', jj);
                            //                    checkBeforeSend(_data, callback);
                            //                }
                            //            });
                            //        })(k);
                            //    }
                            //}
                        }
                    });
                })(j);
                //break;
            }
        }
    }
};

TracksManager.prototype.getAllStops = function (data, checkBeforeSend, callback) {
    console.log('=== getRealTracks ===');

    var now = new Date(),
        url = this.createParamsStr(
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000,
            this.undef_t, this.undef_d,
            this.stop_s, this.stop_d, this.move_s, this.move_d);

    for (var i = 0; i < data.routes.length; i++) {
        for (var j = 0; j < data.sensors.length; j++) {
            if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                data.sensors[j].stops_loading = true;
                data.stops_started = true;
                (function (jj) {
                    console.log('request STOPS for sensor #', jj, url + '&gid=' + data.sensors[jj].GID);
                    request({
                        url: url + '&gid=' + data.sensors[jj].GID,
                        json: true
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            console.log('stops for sensor loaded', jj);
                            if (body == undefined || body == "invalid parameter 'gid'. ") {
                                data.sensors[jj].stops = undefined;
                            } else {
                                data.sensors[jj].stops = body;
                            }
                            data.sensors[jj].stops_loaded = true;
                            checkBeforeSend(data, callback);
                        }
                    });
                })(j);
                break;
            }
        }
    }
};

TracksManager.prototype.getAllTracks = function (data, checkBeforeSend, callback) {
    console.log('=== getRealTracks ===');

    var now = new Date(),
        url = this.createParamsStr(
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000,
            this.undef_t, this.undef_d,
            this.stop_s, this.stop_d, this.move_s, this.move_d, 'messages');

    for (var i = 0; i < data.routes.length; i++) {
        for (var j = 0; j < data.sensors.length; j++) {
            if (data.routes[i].TRANSPORT == data.sensors[j].TRANSPORT) {
                data.sensors[j].track_loading = true;
                data.tracks_started = true;
                (function (jj) {
                    console.log('request TRACK for sensor #', jj, url + '&gid=' + data.sensors[jj].GID);
                    request({
                        url: url + '&gid=' + data.sensors[jj].GID,
                        json: true
                    }, function (error, response, body) {
                        if (!error && response.statusCode === 200) {
                            console.log('track for sensor loaded', jj);
                            if (body == undefined || body == "invalid parameter 'gid'. ") {
                                data.sensors[jj].track = undefined;
                            } else {
                                data.sensors[jj].track = body;
                            }
                            data.sensors[jj].track_loaded = true;
                            checkBeforeSend(data, callback);
                        }
                    });
                })(j);
                break;
            }
        }
    }
};

TracksManager.prototype.findPath = function (lat1, lon1, lat2, lon2, callback) {
    request({
        url: this.routerUrl + 'viaroute?instructions=false&compression=false'
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
        if (points[i].LAT != null && points[i].LON != null) {
            url += "&loc=" + points[i].LAT + "," + points[i].LON;
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
    var url = this.routerUrl + 'viaroute?instructions=false&compression=false',
        points = data[index];

    for (var i = 0; i < points.length; i++) {
        if (points[i].LAT != null && points[i].LON != null) {
            url += "&loc=" + points[i].LAT + "," + points[i].LON;
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

TracksManager.prototype.getRouteBetweenPoints = function (points, callback) {
    if (points.length < 2) return;

    var loc_str = "&loc=" + points[0].lat + "," + points[0].lon;
    for (var i = 1; i < points.length; i++) {
        loc_str += "&loc=" + points[i].lat + "," + points[i].lon;
    }

    request({
        url: this.routerUrl + 'viaroute?instructions=false&compression=false' + loc_str,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });

};

TracksManager.prototype.getStops = function (gid, from, to, callback) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
        this.stop_d, this.move_s, this.move_d);

    //console.log(url + '&gid=' + gid);
    request({
        url: url + '&gid=' + gid,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });
};

TracksManager.prototype.getTrackPart = function (gid, from, to, callback) {
    var url = this.createParamsStr(from, to, this.undef_t, this.undef_d, this.stop_s,
        this.stop_d, this.move_s, this.move_d, 'messages');

    //console.log(url + '&gid=' + gid);

    request({
        url: url + '&gid=' + gid,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });
};

TracksManager.prototype.sendDataToSolver = function () {

    fs.readFile('./logs/' + config.defaultMonitoringLogin + '_BigSolution.json', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        data = JSON.parse(data);
        var query;
        var func = function (ii, _query) {
            setTimeout(function () {
                request({
                    url: _query,
                    json: true
                }, function (error, response, body) {
                    console.log(body, ii);
                });

            }, ii * 4);
        };

        for (var i = 2000; i < data.length; i++) {
            if (i % 50 == 0) {
                if (query != undefined) {
                    func(i, query);
                }

                query = 'http://5.9.147.66:5500/visit?';
            } else {
                query += "&";
            }

            query += 'point=' + data[i].waypoint_id +
                '&data=' + data[i].transport_id + ';'
                + data[i].driver_id + ';'
                + data[i].timestamp + ';'
                + 'true;'
                + data[i].duration + ';'
                + data[i].weight + ';'
                + data[i].volume + ';'
                + '0;'
                + '0;'
                + '0;0;0;0';
        }
        func(i, query);


        console.log(data.length);
    });

};

TracksManager.prototype.getRouterMatrixByPoints = function (pointsStr, callback) {
    request({
        url: this.routerUrl + 'table?' + pointsStr,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    });
};

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function getNByGid(gid) {
    var nToGids = [['А28', 725],
        ['А17', 710],
        ['А15', 714],
        ['А12', 716],
        ['А43', 718],
        ['А27', 701],
        ['А59', 721],
        ['А49', 706],
        ['А48', 708],
        ['А50', 712],
        ['А32', 711],
        ['А64', 715],
        ['А68', 713],
        ['А33', 722],
        ['А73', 759],
        ['А46', 757],
        ['А61', 723],
        ['А41', 709],
        ['А22', 746],
        ['А18', 744],
        ['А10', 739],
        ['А24', 747],
        ['А08', 735],
        ['А78', 933],
        ['А79', 762],
        ['А37', 760],
        ['А05', 745],
        ['А55', 717],
        ['А42', 753],
        ['А45', 758],
        ['А52', 812],
        ['А75', 720],
        ['А47', 719],
        ['А35', 755],
        ['А09', 734],
        ['А81', 809],
        ['А21', 707],
        ['А19', 738],
        ['А03', 736],
        ['А23', 748],
        ['А29', 763],
        ['А51', 764],
        ['А34', 901],
        ['А14', 741],
        ['А54', 895],
        ['А63', 756],
        ['А38', 896],
        ['А74', 810],
        ['А02', 761],
        ['А44', 697],
        ['А11', 814],
        ['А16', 743],
        ['А56', 705],
        ['А04', 733],
        ['А01', 899],
        ['А69', 811],
        ['А06', 900],
        ['А77', 897],
        ['А36', 754],
        ['А07', 813],
        ['А25', 749]];

    for (var i = 0; i < nToGids.length; i++) {
        if (nToGids[i][1] == gid) return nToGids[i][0];
    }

    return 'NONE'
}

TracksManager.prototype.getStateDataByPeriod = function () {
    var gids = [741,708,711,710,712,764,709,715,739,742,753,897,725,714,716,718,701,713,723,746,735,762,812,720,733,814,896,756,721,706,759,757,744,747,760,717,758,719,755,734,809,707,738,736,748,763,749,754,813,811,705,743,899,745,933,900,697,761,810,895],
        step = 24 * 60 * 60,
        days = 61,
        startDate = 1446336000,
        endDate = startDate + days * 3600 * 24,
        tmpTime = startDate,
        result = {},
        me = this,
        reqCounter = 0,
        warehouse = {
            lat: 50.489879,
            lon: 30.451639
        },
        maxDistFromWh = 0.5,
        requests = [];

    while (tmpTime < endDate) {
        console.log(tmpTime);
        //console.log('day ', new Date(tmpTime * 1000));
        for (var j = 0; j < gids.length; j++) {
            requests.push([gids[j], tmpTime]);
        }

        tmpTime += step;
    }
    function do_func(){
        var wasNearWh = false,
            wasFarFromWh = false,
            returnToWh = false,
            nearWh,
            distFromWh,
            req=requests.pop(),
            gid=req[0], time=req[1];

        console.log('GO >>', new Date(time * 1000), gid);
        me.getStops(gid, time, time + step, function (data) {

            console.log('READY >>', new Date(time * 1000), gid);
            reqCounter++;

            result[gid] = result[gid] || {};
            result[gid][time] = result[gid][time] || {
                    MOVE: {
                        dist: 0,
                        time: 0
                    },

                    ARRIVAL: {
                        dist: 0,
                        time: 0
                    },

                    NO_SIGNAL: {
                        dist: 0,
                        time: 0
                    }
                };

            for (var i = 0; i < data.length; i++) {
                if (returnToWh) break;

                distFromWh = getDistanceFromLatLonInKm(warehouse.lat, warehouse.lon, data[i].lat, data[i].lon);
                nearWh = distFromWh < maxDistFromWh;

                wasNearWh = nearWh || wasNearWh;
                wasFarFromWh = (wasNearWh && !nearWh) || wasFarFromWh;
                returnToWh = wasFarFromWh && nearWh;

                if (!wasFarFromWh || returnToWh || data[i].state === 'START' || data[i].state === 'CURRENT_POSITION') continue;

                result[gid][time][data[i].state].dist += data[i].dist;
                result[gid][time][data[i].state].time += data[i].time;
            }

            if (reqCounter === gids.length * days) {
                console.log('Done!');
                log.toFLog('jsonStates.json', result);

                var strRes = '',
                //= 'Дата, Гид машины, Время движения, Дистанция движения, ' +
                //'Время простоя, Дистаниця простоя, Время без сигнала, Дистанция без сигнала',
                    states;

                for (var k in result) {
                    if (!result.hasOwnProperty(k)) continue;

                    for (var k2 in result[k]) {
                        if (!result[k].hasOwnProperty(k2)) continue;

                        states = result[k][k2];
                        strRes += (parseInt(k2) / 86400 + 25569) + ','
                            + getNByGid(k) + ','
                            + (states.MOVE.dist / 1000) + ','
                            + (states.MOVE.time / 24 / 3600) + ','
                            + (states.ARRIVAL.dist / 1000) + ','
                            + (states.ARRIVAL.time / 24 / 3600) + ','
                            + (states.NO_SIGNAL.dist / 1000) + ','
                            + (states.NO_SIGNAL.time / 24 / 3600)
                            + '\r\n';
                    }
                }

                //console.log(strRes);
                log.toFLog('jsonStates.csv', strRes, false);
            }
            do_func();
        });
    }
    do_func();
};









