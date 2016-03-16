angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', function (scope, rootScope) {
   init();
   	rootScope.testDriver = 'Павлов СЕРГЕЙ'; //переключатель режимов окон попапа
    scope.closeDayClick=function() {
    	console.log('start closeday');
    	console.log(rootScope.rowCollection[0], ' from closeday');
		console.log(scope.companyName, 'nnnnnnnnnnnnn');
		//$('#test-popup').css('show');
		scope.view = !scope.view;
		console.log(scope.view,  ' view');
		

    }
    function init(){

        rootScope.$on('forCloseController', function (event, data) {
        	scope.data = data;
            scope.companyName = data.companyName;
            scope.user = data.user;
            scope.serverTime = data.server_time;
            //console.log(data.user, ' user');
            console.log(data.routes[1], ' data');
            });
    };
    scope.closeTableRowClick = function(){

    	rootScope.$emit('closeDriverName', event.currentTarget.childNodes[3].innerHTML);
    	//console.log($event);
    }
    //scope.showCloseRoutePoints = function(){
    //	$('#close-route-points').popup('show');
    //};
      
}]);