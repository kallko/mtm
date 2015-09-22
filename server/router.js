var express = require('express'),
    app = express(),
    router = express.Router(),    
    soap = require('./soap/soap');

// var soapManager = new soap('hd', 'QJQB8uxW');
// var soapManager = new soap('k00056.0', 'As123456');
// soapManager.getAllDailyData(function(data) {
// 	console.log('=== getAllDailyData callback ===');
// });

router.route('/')
  .get(function(req, res){
    res.status(200);
});

router.route('/dailydata')
  .get(function(req, res){
    // var soapManager = new soap('hd', 'QJQB8uxW');
    var soapManager = new soap('k00056.0', 'As123456');
    soapManager.getAllDailyData(dataReadyCallback);

    function dataReadyCallback(data) {
    	console.log('=== dataReadyCallback === send data to client ===');
    	res.status(200).json(data);
    }
});

module.exports = router;