/**
 * Created by dev-2 on 19.10.16.
 */
angular.module('MTMonitor').controller('EditConditionController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {



    rootScope.$on('choseproblem', function (event, filterId){
        console.log("В изменение условий пришли данные", filterId);
        if (filterId == undefined || filterId == -1 ) return;

        for (var i=0; i< rootScope.data.routes.length; i++) {
            console.log(rootScope.data.routes[i].filterId , filterId);
            if (rootScope.data.routes[i].filterId == filterId){
                scope.route = rootScope.data.routes[i];
                break;
            }
        }

        scope.allDrivers=rootScope.data.drivers;
        scope.allTransports=rootScope.data.transports;
    });



    scope.changeDriver = function() {
        //console.log(scope.selectedDriver, scope.selectedTransport, scope.selectedStart);
        rootScope.$emit('changeDriver', scope.selectedDriver, scope.selectedTransport, scope.selectedStart, scope.route.uniqueID); //эмитируем в поинтиндекс контроллер, чтобы там сделать все изменения в данных
        scope.selectedStart=false;
    };

}]);