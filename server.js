var express = require('express'),
    app = express(),
    session = require('express-session'),
    bodyParser = require('body-parser');

app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true, parameterLimit:100000}));



app.use(session({
    secret: 'keyboard cat 2',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

var mtmRouter = require('./server/routers/mtm-router'), // подключение основного роутера для монитора диспетчера
    acpRouter = require('./server/routers/acp-router'), // подключение роутера для аналитической консоли
    port = process.argv[2] || 9020;

console.log(new Date());

app.use('/', mtmRouter);
app.use('/acp', acpRouter);

app.listen(process.env.PORT || port);
console.log('Listening on port ' + (process.env.PORT || port) + '...\n');