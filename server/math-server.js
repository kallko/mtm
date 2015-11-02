module.exports = MathServer;

var request = require('request'),
    config = require('./config'),
    querystring = require('querystring'),
    log = new (require('./logging'))('./logs');

function MathServer() {
    this.mathServerUrl = config.mathServer.url;
}

MathServer.prototype.recalculate = function (route, callback) {
    me = this;

    //for(var i = 0; i < route.points.length; i++) {
    //    route.points[i].lat = parseFloat(route.points[i].lat);
    //    route.points[i].lon = parseFloat(route.points[i].lon);
    //}

    log.toFLog('query.js', this.mathServerUrl + 'task?action=add&globalID=uniqGuid&task=' + JSON.stringify(route));
    request({
        url: this.mathServerUrl + 'task?action=add&globalID=uniqGuid&task=' + JSON.stringify(route),
        json: true
    }, function(error, response, body) {
        console.log('recalculate callback!');
        if(error) {
            console.log(error);
        } else {
            var intervalID = setInterval(function() {
                request({
                    url: me.mathServerUrl + 'task?action=getAllStates&globalID=uniqGuid',
                    json: true
                }, function (error, response, body) {
                    if(!error) {
                        console.log('Math ready!');
                    }
                });
            }, 5000);

            callback(body);
        }
    });
};

