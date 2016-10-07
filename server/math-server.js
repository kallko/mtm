module.exports = MathServer;

var request = require('request'),
    config = require('./config'),
    fs = require('fs'),
    log = new (require('./logging'))('./logs');

// класс для работы с математическим сервером
function MathServer() {
    this.mathServerUrl = config.mathServer.url;
}

// запрос на пересчет маршрута
MathServer.prototype.recalculate = function (route, callback) {
    var me = this;
    log.info(this.mathServerUrl + 'task?action=add&globalID=uniqGuid' + Date.now() + '&task=' + JSON.stringify(route));
    log.toFLog('query.js', this.mathServerUrl + 'task?action=add&globalID=uniqGuid&task=' + JSON.stringify(route));
    request({
        url: this.mathServerUrl + 'task?action=add&globalID=uniqGuid' + Date.now() + '&task=' + JSON.stringify(route),
        json: true
    }, function (error, response, body) {
        log.info('recalculate callback!');
        if (error) {
            log.info(error);
        } else {
            log.toFLog('math_res.js', body);
            var queryID = body.query;

            var intervalID = setInterval(function () {
                request({
                    url: me.mathServerUrl + 'task?action=getState&queryID=' + queryID + '&lastSID=0',
                    json: true
                }, function (error, response, body) {
                    if (error || body.error) {
                        log.info(error);
                        if (body)   log.info(body.error);
                        clearInterval(intervalID);
                        callback({status: 'error'});
                    } else {
                        if (body.state.status == 3 || body.state.status == 4 || body.state.status == 5) {
                            if (body.state.status == 4) {
                                log.toFLog('math_res2.js', body);
                                log.info('Math ready!');
                                log.info(body);
                                clearInterval(intervalID);
                                body.timestamp = parseInt(Date.now() / 1000);
                                callback(body);
                            } else {
                                clearInterval(intervalID);
                                callback({status: 'error'});
                            }
                        }
                    }
                });
            }, 1000);
        }
    });
};