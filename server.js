var express = require('express'),
    app = express(),
    soap = require('./server/soap/soap');

app.use(express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

var router = require('./server/router'),
	port = process.argv[2] || 9020;;

// var soapManager = new soap('hd', 'QJQB8uxW');
var soapManager = new soap('k00056.0', 'As123456');
// var soapManager = new soap('meest.disp', 'dispmeest');
soapManager.getDailyPlan();

app.use('/', router).listen(process.env.PORT || port);
console.log('Listening on port ' + (process.env.PORT || port) + '...');
