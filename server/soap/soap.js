module.exports = SoapManager;
var soap = require('soap'),
    fs = require('fs'),
    config = require('../config'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    log = new (require('../logging'))('./logs'),
    parseXML = require('xml2js').parseString,
    loadFromCache = config.cashing.soap,
    tracks = require('../tracks'),
    tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password),

    counter = 0,
    starTime,
    totalPoints = 0;

// k00056.0
// 12101968 123

function SoapManager(login) {
    this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
    this.urlPda = "@sngtrans.com.ua/client/ws/pda/?wsdl";
    this.login = login;
    this.admin_login = 'soap_admin';
    this.password = '$o@p';
    //this.admin_login = 'samogot';
    //this.password = 'samogot123';
}

SoapManager.prototype.getFullUrl = function () {
    return 'https://' + this.admin_login + ':' + this.password + this.url;
};

SoapManager.prototype.getAllDailyData = function (callback, date) {
    if (!loadFromCache) {
        this.getDailyPlan(callback, date);
    } else {
        this.loadFromCachedJson(callback);
    }
};

SoapManager.prototype.loadFromCachedJson = function (callback) {
    fs.readFile('./logs/final_data.js', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        console.log('The data loaded from the cache.');

        var jsonData = JSON.parse(data);
        //jsonData.server_time = parseInt(Date.now() / 1000); // - 3600 * 3; // Date.now();
        //console.log(jsonData.server_time);
        //
        //jsonData.tasks_loaded = true;
        //jsonData.sended = false;
        //for (var i = 0; i < jsonData.routes.length; i++) {
        //    tracksManager.getRouterData(jsonData, i, checkBeforeSend, callback);
        //}
        //tracksManager.getRealTracks(jsonData, checkBeforeSend, callback);

        callback(jsonData);
    });
};

SoapManager.prototype.loadDemoData = function (callback) {
    //this.getReasonList();

    fs.readFile('./data/demoDay.js', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        data = JSON.parse(data);
        //fs.readFile('./data/pushes.js', 'utf8', function (err, pushes) {
        //    if (err) {
        //        return console.log(err);
        //    }
        //
        //    data.demoPushes = JSON.parse(pushes);
        //    callback(data);
        //});
        callback(data);
    });
};

function checkBeforeSend(_data, callback) {
    var data;
    for (var k = 0; k < _data.length; k++) {
        data = _data[k];

        if (data.sensors == null) { // || !data.tasks_loaded) {
            return;
        }

        for (var i = 0; i < data.routes.length; i++) {
            if (!data.routes[i].time_matrix_loaded
                || !data.routes[i].plan_geometry_loaded) {
                //console.log(i, data.routes[i].time_matrix_loaded, data.routes[i].plan_geometry_loaded);
                return;
            }
        }

        for (i = 0; i < data.sensors.length; i++) {
            if (data.sensors[i].loading && !data.sensors[i].stops_loaded) {
                return;
            }
        }
    }

    for (k = 0; k < _data.length; k++) {
        data = _data[k];

        for (i = 0; i < data.routes.length; i++) {
            delete data.routes[i].time_matrix_loaded;
            delete data.routes[i].plan_geometry_loaded;
        }

        for (i = 0; i < data.sensors.length; i++) {
            delete data.sensors[i].real_track_loaded;
            delete data.sensors[i].loading;
        }
    }

    for (i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].routes.length; j++) {
            data[i].routes[j].itineraryID = data[i].ID;
        }
    }


    data = _data;
    for (i = 0; i < data.length; i++) {
        for (j = 0; j < data[i].routes.length; j++) {
            data[i].routes[j].itineraryID = data[i].ID;
        }
    }

    var allData = JSON.parse(JSON.stringify(data[0])),
        gIndex = 0;

    allData.idArr = [];
    allData.idArr.push(data[0].ID);

    for (i = 1; i < data.length; i++) {
        allData.DISTANCE = parseInt(allData.DISTANCE) + parseInt(data[i].DISTANCE);
        allData.NUMBER_OF_ORPHANS = parseInt(allData.NUMBER_OF_ORPHANS) + parseInt(data[i].NUMBER_OF_ORPHANS);
        allData.NUMBER_OF_TASKS = parseInt(allData.NUMBER_OF_TASKS) + parseInt(data[i].NUMBER_OF_TASKS);
        allData.TIME = parseInt(allData.TIME) + parseInt(data[i].TIME);
        allData.VALUE = parseInt(allData.VALUE) + parseInt(data[i].VALUE);
        allData.routes = allData.routes.concat(data[i].routes);
        allData.idArr.push(data[i].ID);

        allData.waypoints = allData.waypoints.concat(data[i].waypoints);
    }

    for (j = 1; j < data.length; j++) {
        for (k = 0; k < data[j].sensors.length; k++) {
            if (data[j].sensors[k].real_track != undefined) {
                allData.sensors[k].real_track = data[j].sensors[k].real_track;
                //console.log('save real_track!');
            }
        }
    }

    for (i = 0; i < allData.routes.length; i++) {
        for (var j = 0; j < allData.routes[i].points.length; j++) {
            allData.routes[i].points[j].base_arrival = allData.routes[i].points[j].ARRIVAL_TIME;
            if (allData.routes[i].points[j].waypoint == undefined) continue;

            allData.routes[i].points[j].waypoint.gIndex = gIndex;
            gIndex++;
        }
    }

    console.log('DONE!');
    log.toFLog('final_data.js', allData);
    callback(allData);
}

SoapManager.prototype.getDailyPlan = function (callback, date) {
    var me = this,
        itIsToday = typeof date === 'undefined';

    if (date) {
        date = parseInt(date);
        date += 21 * 3600000;
    }

    // ONLY FOR TEST
    date = !itIsToday ? date : Date.now();
    //date = date - 86400000 * 2;
    //date = 1448992800000;
    //1448992800000

    console.log('itIsToday', itIsToday);
    console.log('Date >>>', new Date(date));

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log(me.login);
        console.log(_xml.dailyPlanXML(date));
        client.runAsUser({'input_data': _xml.dailyPlanXML(date), 'user': me.login}, function (err, result) {
            if (!err) {
                console.log('DONE getDailyPlan');
                console.log(result.return);

                console.log();
                parseXML(result.return, function (err, res) {
                    if (res.MESSAGE.PLANS == null) {
                        console.log('NO PLANS!');
                        callback({status: 'no plan'});
                        return;
                    }

                    var itineraries = res.MESSAGE.PLANS[0].ITINERARY,
                        data = [];
                    for (var i = 0; i < itineraries.length; i++) {
                        me.getItinerary(client, itineraries[i].$.ID, itineraries[i].$.VERSION, itIsToday, data, date, callback);
                    }

                });
            } else {
                console.log('getDailyPlan ERROR');
                console.log(err.body);
            }
        });
    });
};

SoapManager.prototype.getItinerary = function (client, id, version, itIsToday, data, date, callback) {
    var me = this;

    if (!config.loadOnlyItineraryNew && (this.login != 'IDS.a.kravchenko' && this.login != 'ids.dsp')) {
        //console.log('_xml.itineraryXML(id, version) >>>>>', _xml.itineraryXML(id, version));
        client.runAsUser({'input_data': _xml.itineraryXML(id, version), 'user': me.login}, function (err, result) {
            itineraryCallback(err, result, me, client, itIsToday, data, date, callback);
        });
    }

    //console.log("_xml.itineraryXML(id, version, true) >>>>>", _xml.itineraryXML(id, version, true));
    client.runAsUser({'input_data': _xml.itineraryXML(id, version, true), 'user': me.login}, function (err, result) {
        itineraryCallback(err, result, me, client, itIsToday, data, date, callback);
    });
};

function itineraryCallback(err, result, me, client, itIsToday, data, date, callback) {
    if (!err) {
        //console.log(result.return);
        //log.toFLog('itinerary', result.return, false);
        //log.toFLog('itinerary', result.return, false);
        parseXML(result.return, function (err, res) {

            if (res.MESSAGE.ITINERARIES == null ||
                res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
                res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') return;

            console.log('APPROVED = ' + res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED);
            var nIndx = data.push(res.MESSAGE.ITINERARIES[0].ITINERARY[0].$);

            nIndx--;
            data[nIndx].sended = false;
            data[nIndx].date = new Date(date);
            data[nIndx].server_time = parseInt(date / 1000);
            me.prepareItinerary(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, data, itIsToday, nIndx, callback);
            me.getAdditionalData(client, data, itIsToday, nIndx, callback);

        });
    } else {
        console.log('getItinerary ERROR');
        console.log(err.body);
    }
}

SoapManager.prototype.prepareItinerary = function (routes, data, itIsToday, nIndx, callback) {
    var tmpRoute;

    data[nIndx].routes = [];
    for (var i = 0; i < routes.length; i++) {
        tmpRoute = {};
        tmpRoute = routes[i].$;
        tmpRoute.points = [];

        if (routes[i].SECTION == undefined) continue;

        for (var j = 0; j < routes[i].SECTION.length; j++) {
            if (j == 0 && routes[i].SECTION[j].$.START_WAYPOINT == "") {
                routes[i].SECTION[j].$.START_WAYPOINT = routes[i].SECTION[j].$.END_WAYPOINT;
                //routes[i].SECTION.shift();
                //j--;
                //continue;
            }

            tmpRoute.points.push(routes[i].SECTION[j].$);
        }

        data[nIndx].routes.push(tmpRoute);
    }
};

SoapManager.prototype.getAdditionalData = function (client, data, itIsToday, nIndx, callback) {
    var me = this;
    log.l("getAdditionalData");
    log.l("=== a_data; data.ID = " + data[nIndx].ID + " === \n");
    //log.l(_xml.additionalDataXML(data[nIndx].ID));
    client.runAsUser({'input_data': _xml.additionalDataXML(data[nIndx].ID), 'user': me.login}, function (err, result) {
        if (!err) {
            parseXML(result.return, function (err, res) {

                var transports = res.MESSAGE.TRANSPORTS[0].TRANSPORT,
                    drivers = res.MESSAGE.DRIVERS[0].DRIVER,
                    waypoints = res.MESSAGE.WAYPOINTS[0].WAYPOINT,
                    sensors = res.MESSAGE.SENSORS[0].SENSOR;
                if (waypoints == undefined) return;

                log.l('waypoints.length = ' + waypoints.length);

                data[nIndx].transports = [];
                for (var i = 0; i < transports.length; i++) {
                    data[nIndx].transports.push(transports[i].$);
                }

                data[nIndx].drivers = [];
                for (i = 0; i < drivers.length; i++) {
                    data[nIndx].drivers.push(drivers[i].$);
                }

                data[nIndx].waypoints = [];
                for (i = 0; i < waypoints.length; i++) {
                    data[nIndx].waypoints.push(waypoints[i].$);
                }

                for (var j = 0; j < data[nIndx].routes.length; j++) {
                    for (i = 0; i < data[nIndx].routes[j].points.length; i++) {
                        var tPoint = data[nIndx].routes[j].points[i];
                        for (var k = 0; k < data[nIndx].waypoints.length; k++) {
                            if (tPoint.END_WAYPOINT == data[nIndx].waypoints[k].ID) {
                                tPoint.waypoint = data[nIndx].waypoints[k];
                                tPoint.LAT = tPoint.waypoint.LAT;
                                tPoint.LON = tPoint.waypoint.LON;
                                break;
                            }
                        }

                        for (var k = 0; k < data[nIndx].waypoints.length; k++) {
                            if (tPoint.START_WAYPOINT == data[nIndx].waypoints[k].ID) {
                                tPoint.START_LAT = data[nIndx].waypoints[k].LAT;
                                tPoint.START_LON = data[nIndx].waypoints[k].LON;
                                break;
                            }
                        }
                    }
                }

                data[nIndx].sensors = [];
                if (sensors == undefined) {
                    console.log('NO SENSORS!');
                    callback({status: 'no sensors'});
                }

                for (i = 0; i < sensors.length; i++) {
                    data[nIndx].sensors.push(sensors[i].$);
                }

                //if (itIsToday) {
                for (i = 0; i < data[nIndx].routes.length; i++) {
                    tracksManager.getRouterData(data, i, nIndx, checkBeforeSend, callback);
                }
                tracksManager.getTracksAndStops(data, nIndx, checkBeforeSend, callback);
                checkBeforeSend(data, callback);
                //} else {
                //    console.log('DONE!');
                //    callback(data);
                //}

                //data.tasks = [];
                //
                //counter = 0;
                //totalPoints = 0;
                //for (i = 0; i < data.routes.length; i++) {
                //    for (var j = 0; j < data.routes[i].points.length; j++) {
                //        if (data.routes[i].points[j].TASK_NUMBER == '') continue;
                //        totalPoints++;
                //        (function (ii, jj) {
                //            setTimeout(function () {
                //                me.getTask(client, data.routes[ii].points[jj].TASK_NUMBER,
                //                    data.routes[ii].points[jj].TASK_DATE, data, callback);
                //            }, (i + j) * 50);
                //        })(i, j);
                //    }
                //}
            });

        } else {
            log.l(err.body);
        }
    });
};

SoapManager.prototype.getReasonList = function () {
    console.log('getReasonList');
    var me = this,
        url = 'https://' + this.admin_login + ':' + this.password + this.urlPda;
    soap.createClient(url, function (err, client) {
        if (err) throw err;

        client.setSecurity(new soap.BasicAuthSecurity('k00056.0', 'As123456'));
        console.log(client.describe());
        client.get_reason_list(function (err, result) {
            if (!err) {
                log.dump(result.return.reason);
                log.toFLog('reason_list.js', result.return.reason);
            } else {
                console.log('err', err.body);
            }
        });
    });
};

SoapManager.prototype.getTask = function (client, taskNumber, taskDate, data, callback) {
    client.runAsUser({'input_data': _xml.taskXML(taskNumber, taskDate), 'user': me.login}, function (err, result) {
        if (!err) {

            if (counter == 0) {
                starTime = Date.now();
                log.l('========= totalPoints = ' + totalPoints);
            }

            counter++;
            if (counter % 10 == 0) {
                log.l(taskNumber + ' OK: counter = ' + counter + '; totalPoints = ' + totalPoints);
            }

            if (counter == totalPoints) {
                log.l('======== TOTAL TIME = ' + ((Date.now() - starTime) / 1000) + ' seconds');
            }

            parseXML(result.return, function (err, res) {

                data.tasks.push(res.MESSAGE.TASKS[0].TASK[0].$);
                if (counter == totalPoints) {
                    data.tasks_loaded = true;
                    console.log('all tasks DONE!');
                    checkBeforeSend(data, callback);
                }
            });
        }
    });


};

SoapManager.prototype.getAllSensors = function (callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log('getAllSensors', me.login);
        client.runAsUser({'input_data': _xml.allSensorsXML(), 'user': me.login}, function (err, result) {
            if (!err) {
                console.log('getAllSensors OK');
                parseXML(result.return, function (err, res) {
                    res = res.MESSAGE.SENSORS[0].SENSOR;
                    var sensors = [];
                    for (var i = 0; i < res.length; i++) {
                        sensors.push(res[i].$);
                    }

                    callback(sensors);
                });
            } else {
                console.log('getAllSensors ERROR');
                console.log(err.body);
            }
        });
    });
};

SoapManager.prototype.getPlanByDate = function (timestamp, callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log('getPlansByTime', me.login);

        timestamp *= 1000;
        me.getDailyPlan(callback, timestamp);

        //callback({status: 'working for ' + timestamp});
    });
};

SoapManager.prototype.saveRoutesTo1C = function (routes) {
    console.log('saveRoutesTo1C');
    var counter = 0,
        me = this,
        loadGeometry = function (ii, jj, callback) {
            tracksManager.getRouteBetweenPoints([routes[ii].points[jj].startLatLon, routes[ii].points[jj].endLatLon],
                function (data) {
                    routes[ii].points[jj].geometry = data.route_geometry;
                    routes[ii].counter++;
                    //console.log('part ready', jj, routes[ii].counter, routes[ii].points.length);
                    if (routes[ii].counter == routes[ii].points.length) {
                        counter++;
                        console.log('route ready', ii);
                        if (routes.length == counter) {
                            callback();
                        }
                    }
                });
        };

    for (var i = 0; i < routes.length; i++) {
        routes[i].counter = 0;
        for (var j = 0; j < routes[i].points.length; j++) {
            loadGeometry(i, j, function () {
                var resXml = _xml.routesXML(routes, me.login);
                log.toFLog('saveChanges.xml', resXml, false);
            });
        }
    }
};

SoapManager.prototype.openPointWindow = function (user, pointId) {
    var userIds = {
        'IDS.dev': '33d45347-7834-11e3-840c-005056a70133',
        '292942.Viktor': 'a6d774a7-fd9c-11e2-a23d-005056a74894',
        'IDS.a.kravchenko': '5229eabf-f516-11e2-a23d-005056a74894',
        'IDS.red\'kina' : 'efa17485-fb45-11e2-a23d-005056a74894'
    };

    //pointId = '2dddb7d0-c943-11e2-a05b-52540027e502';
    //user = 'IDS.a.kravchenko';

    console.log('user', user, 'pointId', pointId);
    console.log('userIds[user]', userIds[user]);

    if (!userIds[user]) {
        console.log('openPointWindow >> can not find user');
        return;
    }

    soap.createClient('http://SNG_Trans:J7sD3h9d0@api.alaska.com.ua:32080/1c/ws/SNGTrans.1cws?wsdl', function (err, client) {
        if (err) {
            console.log('user', user, 'pointId', pointId);
            console.log('err.body >> ', err.body);
            return;
        }
        client.setSecurity(new soap.BasicAuthSecurity('SNG_Trans', 'J7sD3h9d0'));

        ////console.log('client.describe() >>', client.describe());
        //console.log({
        //    UserId: userIds[user],
        //    ObjectType: 'СПРАВОЧНИК',
        //    ObjectName: 'КУБ_Точки',
        //    ElementId: pointId
        //});

        client.OpenElement({
            UserId: userIds[user],
            ObjectType: 'СПРАВОЧНИК',
            ObjectName: 'КУБ_Точки',
            ElementId: pointId
        }, function (err, result) {
            if(err) console.log(err.body);
            if(result) console.log(result);
        });
    });
};

//soap.createClient('http://SNG_Trans:J7sD3h9d0@api.alaska.com.ua:32080/1c/ws/SNGTrans.1cws?wsdl', function (err, client) {
//    if (err) throw err;
//    client.setSecurity(new soap.BasicAuthSecurity('SNG_Trans', 'J7sD3h9d0'));
//
//    console.log('client.describe() >>', client.describe());
//
//    client.OpenElement({
//        UserId: '33d45347-7834-11e3-840c-005  056a70133',
//        ObjectType: 'СПРАВОЧНИК',
//        ObjectName: 'КУБ_Точки',
//        ElementId: '7bebb6b0-91ee-11e5-bd07-005056a76b49'
//    }, function (err, result) {
//        console.log(err, result);
//    });
//});