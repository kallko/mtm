module.exports = SoapManager;

var soap = require('soap');
    xmlConstructor = require('./xmlConstructor');
    _xml = new xmlConstructor();

// 144700:tarasenkog
// hd:QJQB8uxW
// k00056.0:As123456

function SoapManager(login, password){
  this.url = "@sngtrans.com.ua/client/ws/exchange/?wsdl";
  this.login = login;
  this.password = password;
}

SoapManager.prototype.getFullUrl = function(){
  return 'https://' + this.login + ':' + this.password + this.url
};

SoapManager.prototype.getDailyPlan = function(){
  var me = this;

  soap.createClient(me.getFullUrl(), function(err, client) {
    if (err) throw err;
    client.setSecurity(new soap.BasicAuthSecurity(me.login, me.password));
    //  console.log(client.describe());
    client.run({'input_data' : _xml.dailyPlanXML()},
      function(err, result) {
        if (!err) {
          console.log('DONE');
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('ERROR');
          console.log(err.body);
        }
    });
  });
};
