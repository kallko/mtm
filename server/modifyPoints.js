/**
 * Created by dev-2 on 18.11.16.
 */
module.exports = ModifyPoints;

var global = 1;

function ModifyPoints (){
        var local = 10;
        var global = 100;
    }

ModifyPoints.prototype.test = function(points) {
    console.log("Global", global);
    global ++;
    //local ++;
};