/**
 * Created by dev-2 on 16.02.17.
 */
module.exports = ServerData;

var _data = undefined;

function ServerData (){

}

ServerData.prototype.getData = function (){
    return _data;
};

ServerData.prototype.setData = function (data){
    _data = data;
};

ServerData.prototype.test = function() {
    //console.log("Global", _data);
    //_data ++;
    //return _data;
};