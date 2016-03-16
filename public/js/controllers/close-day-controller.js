angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', function (scope, rootScope) {
   init();
    scope.closeDayClick=function() {
    	console.log('start closeday');
    	//console.log(rootScope.rowCollection[0], ' from closeday')
    }
    function init(){

        rootScope.$on('forCloseController', function (event, data) {
        	scope.data = data;
            scope.companyName = data.companyName;
            scope.user = data.user;
            scope.serverTime = data.server_time;

            //console.log(data.routes[1], ' data');
            });
    };
    scope.closeTableRowClick = function(){

    	rootScope.$emit('closeDriverName', event.currentTarget.childNodes[5].innerHTML);
    }
}]);