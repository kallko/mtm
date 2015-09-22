module.exports = SoapManager;
var fs = require('fs');

var soap = require('soap'),
    fs = require('fs'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    logging = require('../logging'),
    log = new logging('./logs'),
    parseXML = require('xml2js').parseString;

// emitter.setMaxListeners(25);

// 144700:tarasenkog
// hd:QJQB8uxW
// k00056.0:As123456
// meest.disp:dispmeest

function SoapManager(login, password) {
  this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
  this.login = login;
  this.password = password;
}

SoapManager.prototype.getFullUrl = function() {
  return 'https://' + this.login + ':' + this.password + this.url;
};

SoapManager.prototype.getAllDailyData = function(){
  this.getDailyPlan();
};

SoapManager.prototype.getDailyPlan = function(){
  var me = this;

  soap.createClient(me.getFullUrl(), function(err, client) {
    if (err) throw err;
    client.setSecurity(new soap.BasicAuthSecurity(me.login, me.password));
    client.run({'input_data' : _xml.dailyPlanXML()}, function(err, result) {
      if (!err) {
        console.log('DONE getDailyPlan');
        console.log(result.return);

        console.log();
        parseXML(result.return, function(err, res) {
          if(res.MESSAGE.PLANS == null) return;

          var itineraries = res.MESSAGE.PLANS[0].ITINERARY;
          for (var i = 0; i < itineraries.length; i++) {
            me.getItinerary(client, itineraries[i].$.ID, itineraries[i].$.VERSION);
          }

        });
      } else {
        console.log('getDailyPlan ERROR');
        console.log(err.body);
      }
    });
  });
};

SoapManager.prototype.getItinerary = function(client, id, version) {
  var me = this;
  client.run({'input_data' : _xml.itineraryXML(id, version)}, function(err, result) {
    if (!err) {
      console.log('DONE getItinerary for ');
      console.log(_xml.itineraryXML(id, version));
      console.log();

      parseXML(result.return, function(err, res) {

        if(res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
           res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') return;

        log.toFLog("log.js", res);

        var data = res.MESSAGE.ITINERARIES[0].ITINERARY[0].$;
        me.prepareItinerary(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE, data);
        me.getTransportsAndDrivers(client, data);

      });
    } else {
      console.log('getItinerary ERROR');
      console.log(err.body);
    }
  });
};

SoapManager.prototype.prepareItinerary = function(routes, data) {
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
}

SoapManager.prototype.getTransportsAndDrivers = function(client, data) {
  var me = this;
  log.l("getTransportsAndDrivers");
  log.l(_xml.transportsAndDriversXML());
  client.run({'input_data' : _xml.transportsAndDriversXML()}, function(err, result) {
    if (!err) {
      parseXML(result.return, function(err, res) {
        log.toFLog("transports_driver.js", res);
        // return; // !!!!!!!!!!!!!!!!!!!!!!!

        var transports = res.MESSAGE.TRANSPORTS[0].TRANSPORT,
            drivers =  res.MESSAGE.DRIVERS[0].DRIVER;
        //     waypoints = res.MESSAGE.WAYPOINTS[0].WAYPOINT;
        // log.l('waypoints.length = ' + waypoints.length);

        data.transports = [];
        for (var i = 0; i < transports.length; i++) {
          data.transports.push(transports[i].$);
        }

        data.drivers = [];
        for (var i = 0; i < drivers.length; i++) {
          data.drivers.push(drivers[i].$);
        }

        log.toFLog("routes.js", data);
      });
      
    }
  });
}

// SoapManager.prototype.sendData()