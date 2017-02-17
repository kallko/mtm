/**
 * Created by dev-2 on 17.02.17.
 */
module.exports = BlockedRoutes;

var _routes = [];

function BlockedRoutes (){

}

BlockedRoutes.prototype.getData = function (){
    return _routes;
};

BlockedRoutes.prototype.setData = function (data){
    _routes = data;
};

BlockedRoutes.prototype.test = function() {
    //console.log("Global", _data);
    //_data ++;
    //return _data;
};