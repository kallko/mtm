angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', function (scope, rootScope) {
   init();
    scope.closeDayClick=function() {
    	//console.log('start closeday');
        //rootScope.$emit('setCheckBox');
        //console.log($('#close-table-driver-5').html(), ' el');
    };
    scope.showCheckBoxToClose = function(){
        rootScope.$emit('showCheckBoxToClose');
    };
    scope.hideCheckBoxToClose = function($event){
        console.log($event, ' event');
        $('#main-checkbox').removeAttr('checked');
        $('input[checked]').removeAttr('checked');
    }
    function init(){

        rootScope.$on('forCloseController', function (event, data) {
        	scope.data = data;
            scope.companyName = data.companyName;
            scope.user = data.user;
            scope.serverTime = data.server_time;
            for(var s=0; s<data.routes.length; s++){
                data.routes[s].s_driverNumber = s; 
                console.log(data.routes[s].s_driverNumber, ' data');
            }
            });
    };
    scope.closeTableRowClick = function(){

    	rootScope.$emit('closeDriverName', event.currentTarget.childNodes[5].innerHTML);
    }
}]);