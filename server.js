var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

var router = require('./server/router');

app.use('/', router).listen(process.env.PORT || 9001);
console.log('Listening on port ' + (process.env.PORT || 9001) + '...');
