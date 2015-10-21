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

    counter = 0,
    starTime,
    totalPoints = 0;

    // k00056.0
    // 12101968 123

function SoapManager(login) {
    this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
    this.login = login;
    this.admin_login = 'soap_admin';
    this.password = '$o@p';
    //this.admin_login = 'samogot';
    //this.password = 'samogot123';
}

SoapManager.prototype.getFullUrl = function () {
    return 'https://' + this.admin_login + ':' + this.password + this.url;
};

SoapManager.prototype.getAllDailyData = function (callback) {
    if (!loadFromCache) {
        this.getDailyPlan(callback);
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
        //tracksManager = new tracks('http://192.168.9.29:3001/',
        //    'http://sngtrans.com.ua:5201/',
        //    'admin', 'admin321');
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

function checkBeforeSend(data, callback) {
    if (data.sended || data.sensors == null) { // || !data.tasks_loaded) {
        return;
    }

    //for (var i = 0; i < data.routes.length; i++) {
    //    if (!data.routes[i].time_matrix_loaded
    //        || !data.routes[i].plan_geometry_loaded) {
    //        return;
    //    }
    //}

    for (i = 0; i < data.sensors.length; i++) {
        if (data.sensors[i].loading && !data.sensors[i].real_track_loaded) {
            return;
        }
    }

    for (i = 0; i < data.routes.length; i++) {
        delete data.routes[i].time_matrix_loaded;
        delete data.routes[i].plan_geometry_loaded;
    }

    for (i = 0; i < data.sensors.length; i++) {
        delete data.sensors[i].real_track_loaded;
        delete data.sensors[i].loading;
    }


    console.log('5');
    data.sended = true;
    console.log('DONE!');
    log.toFLog('final_data.js', data);
    callback(data);
}

SoapManager.prototype.getDailyPlan = function (callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.admin_login, me.password));
        console.log(me.login);
        console.log(_xml.dailyPlanXML());
        client.runAsUser({'input_data': _xml.dailyPlanXML(), 'user': me.login}, function (err, result) {
            if (!err) {
                console.log('DONE getDailyPlan');
                console.log(result.return);

                console.log();
                parseXML(result.return, function (err, res) {
                    if (res.MESSAGE.PLANS == null) return;

                    var itineraries = res.MESSAGE.PLANS[0].ITINERARY;
                    for (var i = 0; i < itineraries.length; i++) {
                        me.getItinerary(client, itineraries[i].$.ID, itineraries[i].$.VERSION, callback);
                    }

                });
            } else {
                console.log('getDailyPlan ERROR');
                console.log(err.body);
            }
        });
    });
};

SoapManager.prototype.getItinerary = function (client, id, version, callback) {
    var me = this;
    client.runAsUser({'input_data': _xml.itineraryXML(id, version), 'user': me.login}, function (err, result) {
        if (!err) {
            //console.log('DONE getItinerary for ');
            //console.log(_xml.itineraryXML(id, version));
            //console.log();

            parseXML(result.return, function (err, res) {

                if (res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
                    res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') return;

                log.toFLog("log_" + parseInt(id) + ".js", res);

                var data = res.MESSAGE.ITINERARIES[0].ITINERARY[0].$,
                    tracksManager;
                data.sended = false;
                data.date = new Date();
                data.server_time = parseInt(Date.now() / 1000);
                tracksManager = me.prepareItinerary(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, data, callback);
                me.getAdditionalData(client, data, tracksManager, callback);

            });
        } else {
            console.log('getItinerary ERROR');
            console.log(err.body);
        }
    });
};

SoapManager.prototype.prepareItinerary = function (routes, data, callback) {
    var tmpRoute,
        tracksManager = new tracks(
            config.aggregator.url,
            config.router.url,
            config.aggregator.login,
            config.aggregator.password);

    data.routes = [];
    for (var i = 0; i < routes.length; i++) {
        tmpRoute = {};
        tmpRoute = routes[i].$;
        tmpRoute.points = [];

        for (var j = 0; j < routes[i].SECTION.length; j++) {
            tmpRoute.points.push(routes[i].SECTION[j].$);
        }

        data.routes.push(tmpRoute);
    }

    for (i = 0; i < data.routes.length; i++) {
        tracksManager.getRouterData(data, i, checkBeforeSend, callback);
    }

    return tracksManager;
};

SoapManager.prototype.getAdditionalData = function (client, data, tracksManager, callback) {
    var me = this;
    log.l("getAdditionalData");
    log.l("=== a_data; data.ID = " + data.ID + " === \n");
    log.l(_xml.additionalDataXML(data.ID));
    client.runAsUser({'input_data': _xml.additionalDataXML(data.ID), 'user': me.login}, function (err, result) {
        if (!err) {
            parseXML(result.return, function (err, res) {

                var transports = res.MESSAGE.TRANSPORTS[0].TRANSPORT,
                    drivers = res.MESSAGE.DRIVERS[0].DRIVER,
                    waypoints = res.MESSAGE.WAYPOINTS[0].WAYPOINT,
                    sensors = res.MESSAGE.SENSORS[0].SENSOR;
                log.l('waypoints.length = ' + waypoints.length);
                //log.toFLog("additional_data.js", res);

                data.transports = [];
                for (var i = 0; i < transports.length; i++) {
                    data.transports.push(transports[i].$);
                }

                data.drivers = [];
                for (i = 0; i < drivers.length; i++) {
                    data.drivers.push(drivers[i].$);
                }

                data.waypoints = [];
                for (i = 0; i < waypoints.length; i++) {
                    data.waypoints.push(waypoints[i].$);
                }

                data.sensors = [];
                for (i = 0; i < sensors.length; i++) {
                    data.sensors.push(sensors[i].$);
                }

                tracksManager.getRealTracks(data, checkBeforeSend, callback);

                checkBeforeSend(data, callback);

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
            //if (data.ID == '317') {
                log.l(err.body);
            //}
        }
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

// SoapManager.prototype.sendData()