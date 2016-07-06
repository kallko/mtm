angular.module('MTMonitor')
    .directive('habraHabr', function() {
        return{
            templateUrl:"tr.html",
            restrict: 'A',
            replace: 'true',
            transclude: true,
            priority: 1001,
            scope: {
                row: '=row'
            }
        }
    });