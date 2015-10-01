var express = require('express'),
    app = express(),
    router = express.Router(),
    soap = require('./soap/soap'),
    tracks = require('./tracks');

router.route('/')
    .get(function (req, res) {
        res.status(200);
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

        console.log('=== load tracks ===');
        var tracksManager = new tracks('http://192.168.9.242:3001/states', 'admin', 'admin321');
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

router.route('/log')
    .post(function (req, res) {
        console.log(req.body);
        console.log('req.body.test = ' + req.body.test);
        res.status(200).json({status: 'ok', data: req.body.test});
    });

module.exports = router;