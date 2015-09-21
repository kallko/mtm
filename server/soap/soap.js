module.exports = SoapManager;
var fs = require('fs');

var soap = require('soap'),
    fs = require('fs'),
    xmlConstructor = require('./xmlConstructor'),
    _xml = new xmlConstructor(),
    // logging = require('./logging'),
    // log = new logging(),
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
          // dump(res.MESSAGE.PLANS[0].ITINERARY);
          var itineraries = res.MESSAGE.PLANS[0].ITINERARY;
          for (var i = 0; i < itineraries.length; i++) {
            me.getItinerary(client, itineraries[i].$.ID, itineraries[i].$.VERSION);
            // console.log(_xml.itineraryXML(itineraries[i].$.ID, itineraries[i].$.VERSION));
            // console.log();
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
  client.run({'input_data' : _xml.itineraryXML(id, version)}, function(err, result) {
    if (!err) {
      console.log('DONE getItinerary for ');
      console.log(_xml.itineraryXML(id, version));
      // console.log('RESULT ');
      // console.log(result.return);
      console.log();

      parseXML(result.return, function(err, res) {

        // console.log('getItinerary parseXML result');
        if(res.MESSAGE.ITINERARIES[0].ITINERARY == null) return;

        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].$);
        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE.length);
        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE[0].$);
        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE[0].SECTION.length);
        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE[1].$);
        // dump(res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE[1].SECTION.length);

        logVer++;
        toFLog("./logs/" + logVer + "_log.js", res);


        var routes = res.MESSAGE.ITINERARIES[0].ITINERARY[0].ROUTES[0].ROUTE,
            toSendData = {},
            tmpRoute,
            tmpSection;

        toSendData.info = res.MESSAGE.ITINERARIES[0].ITINERARY[0].$;
        toSendData.routes = [];
        for (var i = 0; i < routes.length; i++) {
          tmpRoute = {};
          tmpRoute.info = routes[i].$;
          tmpRoute.points = [];

          for (var j = 0; j < routes[i].SECTION.length; j++) {
            tmpRoute.points.push(routes[i].SECTION[j].$);
          }

          toSendData.routes.push(tmpRoute);
        }

        // dump(toSendData);
        toFLog("./logs/" + logVer + "_optimizedlog.js", toSendData);


      });
    } else {
      console.log('getItinerary ERROR');
      console.log(err.body);
    }
  });
}

function dump(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function toFLog(path, data) {
  fs.writeFile(path, JSON.stringify(data, null, 2), function(err) {
      if(err) {
          return console.log(err);
      }

      console.log("The file was saved to " + path + "!");
  });
}