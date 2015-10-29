var express = require('express'),
    router = express.Router(),
    config = require('./config'),
    soap = require('./soap/soap'),
    tracks = require('./tracks'),
    log = new (require('./logging'))('./logs'),
    fs = require('fs'),
    db = new (require('./db/DBManager'))('postgres://pg_suser:zxczxc90@localhost/plannary'),
    cashedDataArr = [],
    tracksManager = new tracks(
        config.aggregator.url,
        config.router.url,
        config.aggregator.login,
        config.aggregator.password);

router.route('/')
    .get(function (req, res) {
        res.status(200);
    });

router.route('/login')
    .get(function (req, res) {
        req.session.login = req.query.curuser;
        res.sendFile('index.html', {root: './public/'});
    });

router.route('/acp')
    .get(function (req, res) {
        res.sendFile('index.html', {root: './public/acp/'});
    });

router.route('/acp/login')
    .get(function (req, res) {
        req.session.login = req.query.curuser;
        console.log(req.query.curuser);
        res.sendFile('index.html', {root: './public/acp/'});
    });

router.route('/acp/savesolution')
    .post(function (req, res) {
        console.log('savesolution');
        console.log(req.body.solution.length);
        log.toFLog(config.defaultMonitoringLogin + '_solution.json', req.body.solution);
        res.status(200).json({status: 'saved'});
    });

router.route('/acp/loadsolution')
    .get(function (req, res) {
        console.log('loadsolution for ', config.defaultMonitoringLogin);

        fs.readFile('./logs/' + config.defaultMonitoringLogin + '_solution.json', 'utf8', function (err, data) {
            if (err) {
                console.log(err);
                return err;
            } else {
                console.log('Done!');
                res.status(200).json(JSON.parse(data));
            }
        });
    });

var counter = 0;
router.route('/acp/getstops/:gid/:from/:to')
    .get(function (req, res) {
        //console.log('getstops');

        //fs.readFile('./logs/test.txt', 'utf8', function (err, data) {
        //    console.log(err, data);
        //});

        fs.readFile('./logs/' + req.params.gid + '_' +  req.params.from + '_' + req.params.to + '.json', 'utf8', function (err, data) {
            if (err) {
                console.log('new request for GID #' + req.params.gid);
                tracksManager.getStops(req.params.gid, req.params.from, req.params.to, function(data) {
                    counter++;
                    console.log('loaded for GID#' + req.params.gid + ', counter = ' + counter);
                    log.toFLog(req.params.gid + '_' +  req.params.from + '_' + req.params.to + '.json', data);
                    res.status(200).json({gid: req.params.gid, data: data});
                });
            } else {
                console.log('GID #' + req.params.gid + ' LOADED FROM CACHE!');
                res.status(200).json({gid: req.params.gid, data: JSON.parse(data)});
            }
        });

        //tracksManager.getStops(req.params.gid, req.params.from, req.params.to, function(data) {
        //    log.toFLog(req.params.gid + '_' +  req.params.from + '_' + req.params.to + '.json', data);
        //    res.status(200).json({gid: req.params.gid, data: data});
        //});
    });

router.route('/acp/gettracks/:gid/:from/:to')
    .get(function (req, res) {
        console.log('gettracks');
        tracksManager.getTrackPart(req.params.gid, req.params.from, req.params.to, function(data) {
            res.status(200).json({gid: req.params.gid, data: data});
        });
    });

router.route('/acp/getsensors')
    .get(function (req, res) {
        console.log('getsensors');
        var soapManager = new soap(config.defaultMonitoringLogin);
        soapManager.getAllSensors(function (data) {
            res.status(200).json(data);
        });

        //res.status(200).json({status: 'ok'});
    });

router.route('/dailydata')
    .get(function (req, res) {
        // TODO: !!! REMOVE !!!
        if (req.session.login == null) {
            req.session.login = config.defaultSoapLogin;
        }

        var now = Date.now(),
            day = 86400000,
            today12am = now - (now % day);

        if (//req.session.lastUpdate != null && req.session.lastUpdate == today12am &&
            req.query.force == null && req.session.login != null
             && cashedDataArr[req.session.login] != null &&
            cashedDataArr[req.session.login].lastUpdate == today12am) {
            console.log('=== loaded from session === send data to client ===');
            res.status(200).json(cashedDataArr[req.session.login]);
        } else {
            var soapManager = new soap(req.session.login);
            soapManager.getAllDailyData(dataReadyCallback);

            function dataReadyCallback(data) {
                console.log('=== dataReadyCallback === send data to client ===');
                data.lastUpdate = today12am;
                cashedDataArr[req.session.login] = data;
                res.status(200).json(data);
            }
        }
    });

router.route('/tracks/:gid&:from&:to&:undef_t&:undef_d&:stop_s&:stop_d&:move_s&:move_d')
    .get(function (req, res) {

        //console.log('=== load tracks ===');
        tracksManager.getTrack(
            req.params.gid,
            req.params.from,
            req.params.to,
            req.params.undef_t,
            req.params.undef_d,
            req.params.stop_s,
            req.params.stop_d,
            req.params.move_s,
            req.params.move_d, function (data) {
                res.status(200).json(data);
            });
    });

router.route('/trackparts/:start/:end')
    .get(function (req, res) {
        console.log('trackparts', req.session.login);
        if (req.session.login == undefined) {
            res.status(401).json({status: 'Unauthorized'});
            return;
        }

        var first = true;
        tracksManager.getRealTrackParts(cashedDataArr[req.session.login], req.params.start, req.params.end,
            function (data) {
                if(!first) return;

                console.log('getRealTrackParts DONE');
                first = false;
                res.status(200).json(data);
            });
    });

// http://localhost:9020/trackparts/1445002662/1445001662
// http://localhost:9020/login?curuser=k00056.0

router.route('/findpath2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        console.log('=== router.route findpath ===');
        tracksManager.findPath(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

router.route('/findtime2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        tracksManager.findTime(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

router.route('/log')
    .post(function (req, res) {
        //db.testConnection();
        db.logMessage(1, req.body.message, function (err, result) {
            res.status(200).json({error: err, result: result});
        });
    });

router.route('/test')
    .get(function (req, res) {
        console.log(req.session.login);
        res.status(200).json({sessionLogin: req.session.login});
    });

module.exports = router;