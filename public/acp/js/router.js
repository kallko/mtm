angular.module('acp').config(function($routeProvider){
    $routeProvider
        .when('/', {
            redirectTo: '/console'
        })

        .when('/console', {
            templateUrl: './templates/analyzer/index.html',
            controller: 'AnalyzerIndexController'
        })

        .otherwise({redirectTo: '/'});
});
