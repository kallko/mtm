var express = require('express'),
    app = express(),
    bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: '50mb'}));

app.use(express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

var router = require('./server/router'),
	port = process.argv[2] || 9020;

app.use('/', router).listen(process.env.PORT || port);
console.log('Listening on port ' + (process.env.PORT || port) + '...');
