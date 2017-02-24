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
    if (!data) {
        console.log("!!!!!!! Try to save ZERRO Data!!!");
        return;
    }
    _data = data;
};

