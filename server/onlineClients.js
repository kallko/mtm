/**
 * Created by dev-2 on 17.02.17.
 */
module.exports = OnlineClients;

var _clients = [];

function OnlineClients (){

}

OnlineClients.prototype.getData = function (){
    return _clients;
};

OnlineClients.prototype.setData = function (data){
    _clients = data;
};

