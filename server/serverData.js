/**
 * Created by dev-2 on 16.02.17.
 */
module.exports = ServerData;

var _data = undefined;
// sqlUniversal = new (require('./sqlUniversal'))();

function ServerData (){

}

ServerData.prototype.getData = function (){
    return _data;
};

ServerData.prototype.setData = function (data){
    if (!data) {
        console.log("!!!!!!! Try to save ZERRO Data!!!");
        return;
    }
    _data = data;
};

ServerData.prototype.whoAmI = function(key){
    for (var com in _data){
        console.log("EXIST COMPANY ", com);
        console.log(_data[com].prefix);
    }

    for (var company in _data){
        if (_data[company].prefix == key) return company;
    }
    return false;
};

ServerData.prototype.disconnectDispatcher = function (company, login){
    if (!_data || !_data[company] || !_data[company].dispatchers) return;
    var dispatchers = _data[company].dispatchers;
    if (!dispatchers) return;
    var disp = dispatchers.allDispatchers.filter(function (item) {
        return item.login == login;
    });
    var dispId = disp[0].id;
    var shift  = dispatchers.shifts.filter(function (item) {
        return item.dispatcher == dispId;
    }).first();
    var session = shift.sessions[shift.sessions.length - 1];
    session.end_time_stamp = parseInt(Date.now()/1000);
    session.routes.forEach(function(route){
        route.end = route.end || parseInt(Date.now()/1000);
    });
    if (session.routes && session.routes.length > 0) {
        session.results.average_time = session.routes.reduce(function (summ, route) {
            return summ + route.end - route.start;
        }, 0)/session.routes.length;
    }
    return {dispatcher:dispId, start_time_stamp: shift.start_time_stamp, sessions: shift.sessions}
};