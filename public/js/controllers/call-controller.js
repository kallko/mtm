angular.module('MTMonitor').controller('CallController', ['$scope', '$rootScope', '$filter', '$http', function (scope, rootScope, filter, http) {
    //{"driverID":"123","company":"228932","client_id":"2254"}
    scope.showCalls = false;
    scope.calls = [];


    rootScope.$on('showCalls', function(event){
        scope.showCalls = true;
        createCallsList();
        $('#call-view').popup('show');
    });


    function createCallsList(){
        if (!rootScope.data || !rootScope.data.routes || rootScope.data.routes.length == 0) {
            scope.title = "Нет списка возможных звонков";
            return
        }
        scope.title = "Список необходимых звонков";
        scope.calls = [{
            time : 1483440515,
            driver: "Петров",
            uniqueID: 546764,
            point : 2,
            phone : "096 06 555 16",
            finished : false
        }];
        //fixme scope.calls = [];

        rootScope.data.routes.forEach(function(route){
            if (route.calls && route.calls.length != 0){
                scope.calls  = scope.calls.concat(route.calls);
            }
        })

    }


    scope.confirmCall = function (call){
        call.finished = true;
    };

    scope.close = function(){
        $('#call-view').popup('hide');
    }
}]);
