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

ModifyPoints.prototype.makeWarehouse = function(point, push) {
    console.log("MakemakeWarehouse");
    point.mobile_arrival_time = push.gps_time_ts;
    point.real_arrival_time = push.gps_time_ts;
    point.overdue_time = point.mobile_arrival_time > point.end_time_ts ? point.mobile_arrival_time - point.end_time_ts : 0;
    point.status = point.overdue_time > 0 ? 1:0;
    point.problem_index = 0;
    point.confirmed = true;
    point.warehouse = true;
    point.status_model = 27;
    point.limit = 95;

};