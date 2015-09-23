angular.module('MTMonitor').config(function ($routeProvider) {
    $routeProvider
        .when('/', {
            redirectTo: '/points'
        })

        .when('/points', {
            templateUrl: './templates/points/index.html',
            controller: 'PointIndexController'
        })

        .otherwise({redirectTo: '/'});
});
