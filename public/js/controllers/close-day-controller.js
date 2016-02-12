angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', function (scope, rootScope) {
    init();

    function init() {
        rootScope.$on('closeDay', function (event, data) {
            console.log(data);
            scope.closeDay = data;
        });
    }

}]);