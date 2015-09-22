module.exports = SoapManager;
var fs = require('fs');

var soap = require('soap'),
    fs = require('fs'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    logging = require('../logging'),
    log = new logging('./logs'),
    parseXML = require('xml2js').parseString
    logVer = 0;

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

SoapManager.prototype.getAllData = function(){
  var dailyPlan = this.getDailyPlan(),
      result = [],
      tmpItinerary;
  if(dailyPlan == null) return;

  for (var i = 0; i < dailyPlan.length; i++) {
    tmpItinerary = this.getItinerary(client, dailyPlan[i].$.ID, dailyPlan[i].$.VERSION);
    if(tmpItinerary != null) result.push(tmpItinerary);
  }
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

          return res.MESSAGE.PLANS[0].ITINERARY;
          // var itineraries = res.MESSAGE.PLANS[0].ITINERARY;
          // for (var i = 0; i < itineraries.length; i++) {
          //   me.getItinerary(client, itineraries[i].$.ID, itineraries[i].$.VERSION);
          // }

        });
      } else {
        console.log('getDailyPlan ERROR');
        console.log(err.body);
      }
    });
  });
};

SoapManager.prototype.getItinerary = function(client, id, version) {
  client.run({'input_data' : _xml.itineraryXML(id, version)}, function(err, result) {
    if (!err) {
      console.log('DONE getItinerary for ');
      console.log(_xml.itineraryXML(id, version));
      console.log();

      parseXML(result.return, function(err, res) {

        if(res.MESSAGE.ITINERARIES[0].ITINERARY == null ||
           res.MESSAGE.ITINERARIES[0].ITINERARY[0].$.APPROVED !== 'true') return;


        logVer++;
        log.toFLog(logVer + "_log.js", res);


        var routes = res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE,
            toSendData = {},
            tmpRoute,
            tmpSection;

        toSendData = res.MESSAGE.ITINERARIES[0].ITINERARY[0].$;
        toSendData.routes = [];
        for (var i = 0; i < routes.length; i++) {
          tmpRoute = {};
          tmpRoute = routes[i].$;
          tmpRoute.points = [];

          for (var j = 0; j < routes[i].SECTION.length; j++) {
            tmpRoute.points.push(routes[i].SECTION[j].$);
          }

          toSendData.routes.push(tmpRoute);
        }

        log.toFLog(logVer + "_optimizedlog.js", toSendData);
        return toSendData;


      });
    } else {
      console.log('getItinerary ERROR');
      console.log(err.body);
    }
  });
}