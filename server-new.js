var express = require('express'),
    app = express(),
    session = require('express-session'),
    bodyParser = require('body-parser');
var fs = require('fs');

var server = require('http').Server(app);
var io = require('socket.io')(server);


app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true, parameterLimit:1000000}));



app.use(session({
    secret: 'keyboard cat 2',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

var mtmRouter = require('./server/routers/mtm-router-new'), // подключение основного роутера для монитора диспетчера
    acpRouter = require('./server/routers/acp-router'), // подключение роутера для аналитической консоли
    serverData = require('./server/serverData'),
    sqlUniversalFile = require('./server/sqlUniversal'),
    port = process.argv[2] || 9020;

console.log(new Date());

app.use('/', mtmRouter);
app.use('/acp', acpRouter);

//app.listen(process.env.PORT || port);
server.listen(process.env.PORT || port);


console.info('Listening on port ' + (process.env.PORT || port) + '...\n');
var _data = new serverData ();
var sqlUniversal = new sqlUniversalFile();

io.on('connection', function (socket) {

    firstLogin();

    function firstLogin() {
        //socket.broadcast.to('game').emit('eventClient', 'nice game');
        var login = socket.conn.request.headers.referer.substring(socket.conn.request.headers.referer.indexOf("=")+1);
        var key = login.substring(0, login.indexOf('.'));
        console.log("SOCKET", login, " ", key);
        var company = _data.whoAmI(key);
        console.log ("I know who are you!!!!".red, company);
        var obj;
        if (company && _data.getData()[company].dispatchers) console.log ("TEST DATA".red, _data.getData()[company].dispatchers.concated);
        if (company && _data.getData()[company] && _data.getData()[company].dispatchers && _data.getData()[company].dispatchers.concated) {
            var isSuperVisor = askForRole(login, company);

            console.log("isSuperVisor", isSuperVisor);

            obj = _data.getData()[company].dispatchers;
            if (isSuperVisor) {
                socket.join(company);
                io.sockets.in(company).emit('dispatchers', obj);
            }
        } else {
            obj = { error: 'Wait' } ;
            socket.emit('dispatchers', obj);
            setTimeout(firstLogin, 10000);
        }

   }


    //console.log("USER CONNECTED");


    socket.on('my other event', function (data) {
        console.log(data);
    });


    socket.on("loadRoutes", function(data){
        var login = socket.conn.request.headers.referer.substring(socket.conn.request.headers.referer.indexOf("=")+1);
        var key = login.substring(0, login.indexOf('.'));
        var company = _data.whoAmI(key);
        console.log("SOCKET load Routes".red, login, " ", key, " ",  company);
        var obj = _data.getData()[company].dispatchers;
        io.sockets.in(company).emit('dispatchers', obj);
    });

    socket.on('disconnect', function() {
        var login = socket.conn.request.headers.referer.substring(socket.conn.request.headers.referer.indexOf("=")+1);
        var key = login.substring(0, login.indexOf('.'));
        console.log("KEY is ", key);
        var company = _data.whoAmI(key);
        if (!company) return;
        console.log("SOCKET DISCONNECT".red, login, " ", key," ",  company);
        var shift = _data.disconnectDispatcher(company, login);
        //fixme
        //sqlUniversal.save(company, "shifts", "dispatcher", "==", shift.dispatcher, "&&", "start_time_stamp", "==", shift.start_time_stamp,  "set", "sessions", "=", JSON.stringify(shift.sessions));
        var obj = _data.getData()[company].dispatchers ;
        if (obj) io.sockets.in(company).emit('dispatchers', obj);
    });


    function askForRole (login, company){
        var casheDataArray = _data.getData();
        var all = casheDataArray[company].dispatchers.allDispatchers;
        return all.filter(function(item){
            return item.login == login && item.is_superviser;
        })

    }


});
