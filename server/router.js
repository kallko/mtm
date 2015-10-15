var express = require('express'),
    router = express.Router(),
    soap = require('./soap/soap'),
    tracks = require('./tracks'),
    log = new (require('./logging'))('./logs'),
    db = new (require('./db/DBManager'))('postgres://pg_suser:zxczxc90@localhost/plannary');

router.route('/')
    .get(function (req, res) {
        res.status(200);
    });

router.route('/login')
    .get(function (req, res) {
        req.session.login = req.query.curuser;
        res.sendFile('index.html', {root: './public/'});
    });

router.route('/dailydata')
    .get(function (req, res) {
        // var soapManager = new soap('hd', 'QJQB8uxW');
        var soapManager = new soap('k00056.0', 'As123456');
        soapManager.getAllDailyData(dataReadyCallback);

        function dataReadyCallback(data) {
            console.log('=== dataReadyCallback === send data to client ===');
            res.status(200).json(data);
        }
    });

router.route('/tracks/:gid&:from&:to&:undef_t&:undef_d&:stop_s&:stop_d&:move_s&:move_d')
    .get(function (req, res) {

        //console.log('=== load tracks ===');
        var tracksManager = new tracks('http://192.168.9.29:3001/',
            'http://sngtrans.com.ua:5201/',
            'admin', 'admin321');
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

router.route('/findpath2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        console.log('=== router.route findpath ===');
        var tracksManager = new tracks('http://192.168.9.29:3001/',
            'http://sngtrans.com.ua:5201/',
            'admin', 'admin321');

        tracksManager.findPath(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

router.route('/findtime2p/:lat1&:lon1&:lat2&:lon2')
    .get(function (req, res) {
        var tracksManager = new tracks('http://192.168.9.29:3001/',
            'http://sngtrans.com.ua:5201/',
            'admin', 'admin321');

        tracksManager.findTime(req.params.lat1, req.params.lon1, req.params.lat2, req.params.lon2,
            function (data) {
                res.status(200).json(data);
            });
    });

router.route('/log')
    .post(function (req, res) {
        //db.testConnection();
        db.logMessage(1, req.body.message, function(err, result) {
            res.status(200).json({error: err, result: result});
        });
    });

router.route('/test')
    .get(function (req, res) {
        console.log(req.session.login);
        res.status(200).json({sessionLogin: req.session.login});
    });

module.exports = router;