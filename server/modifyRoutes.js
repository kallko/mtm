/**
 * Created by dev-2 on 18.11.16.
 */
module.exports = ModifyRoutes;

function ModifyRoutes (){

}

ModifyRoutes.prototype.ReplaceStopObjectByStopLink = function (routes) {
    if (!routes) return;
    console.log("start changeStopObjectByStopLink");

    for (var  i = 0; i < routes.length; i++){
        for (var j = 0; j < routes[i].points.length; j++){

            if (!routes[i].points[j].stopState) continue;

            var stopLink = routes[i].real_track.filter(function(real_track) {
                return real_track.id == routes[i].points[j].stopState.id;
            });
            routes[i].points[j].stopState = stopLink[0];

        }
    }

};