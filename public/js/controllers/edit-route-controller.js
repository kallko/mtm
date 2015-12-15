angular.module('MTMonitor').controller('EditRouteController', ['$scope', '$rootScope',
    function (scope, rootScope) {
        init();

        function init() {
            rootScope.$on('routeToChange', onRouteToChange);
        }

        function onRouteToChange(event, data) {
            console.log('onRouteToChange');
            scope.route = data.route;
            scope.changedRoute = JSON.parse(JSON.stringify(data.route));

            scope.boxes = [];
            for (var i = 0; i < scope,route.points.length; i++) {
                // напихать туда время занимаемое для приезда, простой и сам таск как три разные сущности
            }

            scope.$apply();
            console.log('scope.route', scope.route);
        }

    }]);