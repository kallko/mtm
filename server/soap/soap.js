module.exports = SoapManager;
var soap = require('soap'),
    fs = require('fs'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    logging = require('../logging'),
    log = new logging('./logs'),
    parseXML = require('xml2js').parseString,
    loadFromCache = true,

    counter = 0,
    starTime,
    totalPoints = 0;

// 144700:tarasenkog
// hd:QJQB8uxW
// k00056.0:As123456
// meest.disp:dispmeest

function SoapManager(login, password) {
    this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
    this.login = login;
    this.password = password;
}

SoapManager.prototype.getFullUrl = function () {
    return 'https://' + this.login + ':' + this.password + this.url;
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
        callback(JSON.parse(data));
    });
};

SoapManager.prototype.getDailyPlan = function (callback) {
    var me = this;

    soap.createClient(me.getFullUrl(), function (err, client) {
        if (err) throw err;
        client.setSecurity(new soap.BasicAuthSecurity(me.login, me.password));
        client.run({'input_data': _xml.dailyPlanXML()}, function (err, result) {
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
    client.run({'input_data': _xml.itineraryXML(id, version)}, function (err, result) {
        if (!err) {
            console.log('DONE getItinerary for ');
            console.log(_xml.itineraryXML(id, version));
            console.log();

            parseXML(result.return, function (err, res) {

                if (res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
                    res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') return;

                log.toFLog("log.js", res);

                var data = res.MESSAGE.ITINERARIES[0].ITINERARY[0].$;
                data.date = new Date();
                me.prepareItinerary(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, data);
                me.getAdditionalData(client, data, callback);

            });
        } else {
            console.log('getItinerary ERROR');
            console.log(err.body);
        }
    });
};


SoapManager.prototype.prepareItinerary = function (routes, data) {
    var tmpRoute;
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
};

SoapManager.prototype.getAdditionalData = function (client, data, callback) {
    var me = this;
    log.l("getAdditionalData");
    log.l(_xml.additionalDataXML(data.ID) + '\n');
    client.run({'input_data': _xml.additionalDataXML(data.ID)}, function (err, result) {
        if (!err) {
            parseXML(result.return, function (err, res) {
                //log.toFLog("transports_driver.js", res);

                var transports = res.MESSAGE.TRANSPORTS[0].TRANSPORT,
                    drivers = res.MESSAGE.DRIVERS[0].DRIVER,
                    waypoints = res.MESSAGE.WAYPOINTS[0].WAYPOINT,
                    sensors = res.MESSAGE.SENSORS[0].SENSOR;
                //tasks = res.MESSAGE.TASKS[0].TASK;
                log.l('waypoints.length = ' + waypoints.length);

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

                data.tasks = [];
                //if (tasks != null) {
                //    for (i = 0; i < tasks.length; i++) {
                //        data.tasks.push(tasks[i].$);
                //    }
                //}

                counter = 0;
                totalPoints = 0;
                for (i = 0; i < data.routes.length; i++) {
                    for (var j = 0; j < data.routes[i].points.length; j++) {
                        if (data.routes[i].points[j].TASK_NUMBER == '') continue;
                        totalPoints++;
                        me.getTask(client, data.routes[i].points[j].TASK_NUMBER,
                            data.routes[i].points[j].TASK_DATE, data, callback);
                    }
                }

                //log.toFLog("routes.js", data);
            });

        }
    });
};

SoapManager.prototype.getTask = function (client, taskNumber, taskDate, data, callback) {
    //log.l("\ngetTask");
    //log.l(_xml.taskXML(taskNumber, taskDate));
    client.run({'input_data': _xml.taskXML(taskNumber, taskDate)}, function (err, result) {
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
                //if (counter == 2) {
                //    log.dump(res);
                //}

                data.tasks.push(res.MESSAGE.TASKS[0].TASK[0].$);
                if (counter == totalPoints) {
                    callback(data);
                    log.toFLog('final_data.js', data);
                }
            });
        }
    });


};

// SoapManager.prototype.sendData()