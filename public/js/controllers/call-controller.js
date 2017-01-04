angular.module('MTMonitor').controller('CallController', ['$scope', '$rootScope', '$filter', '$http', function (scope, rootScope, filter, http) {
    //{"driverID":"123","company":"228932","client_id":"2254"}
    // { '{\'driverID\':\'123\',\'company\':\'228932\',\'client_id\':\'12525\'}': '' }
    scope.showCalls = false;
    scope.calls = [];


    rootScope.$on('showCalls', function(event){
        scope.showCalls = true;
        createCallsList();
        $('#call-view').popup('show');
    });


    rootScope.$on('newCalls', function(event, calls){
        console.log("New Calls recieved", calls);
        calls.forEach(function(call){
            rootScope.data.routes.forEach(function(route){
                if (route.uniqueID == call.uniqueID) {
                    route.calls = route.calls || [];
                    route.calls = route.calls.concat(call);
                }
            })
        })
    });

    function createCallsList(){
        if (!rootScope.data || !rootScope.data.routes || rootScope.data.routes.length == 0) {
            scope.title = "Нет списка возможных звонков";
            return
        }
        scope.title = "Список необходимых звонков";
        //scope.calls = [{
        //    time : 1483440515,
        //    driver: "Петров",
        //    uniqueID: 546764,
        //    point : 2,
        //    phone : "096 06 555 16",
        //    finished : false
        //}];
       scope.calls = [];

        rootScope.data.routes.forEach(function(route){
            if (route.calls && route.calls.length != 0){
                scope.calls  = scope.calls.concat(route.calls);
            }
        });

        scope.calls.forEach(function(call){
            rootScope.data.routes.forEach(function(route){
                route.points.forEach(function(point){
                    if (point.END_WAYPOINT == call.point) {
                        call.pointNumber = point.NUMBER;
                    }
                })
            })
        })
    }


    scope.confirmCall = function (call){
        call.finished = true;
    };

    scope.close = function(){
        $('#call-view').popup('hide');
    }
}]);
