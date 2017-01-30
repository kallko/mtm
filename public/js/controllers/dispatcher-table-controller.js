angular.module('MTMonitor').controller('DispatcherTableController', ['$scope', '$rootScope', '$filter', '$http', function (scope, rootScope, filter, http) {
    var vm = scope;
    vm.parseInt = parseInt;

    if (rootScope && rootScope.data && rootScope.data.settings) vm.supervisor = rootScope.data.settings.userRoles.some(function(item){
        return item == 'supervisor'});

    vm.dispatchers = [];
    var testDispatcher = {};
    testDispatcher.name = "Иванова Богдана";
    testDispatcher.status = "Работает";
    testDispatcher.sessions = [];
    var session = {
        start: 1485442099,
        finish: 1485444099,
        endMethod: "Перерыв",
        problemReceived: 55,
        problemAsked: 12
    };
    testDispatcher.sessions.push(session);
    session = {
        start: 1485444099,
        finish: 1485447099,
        endMethod: "Конец смены",
        problemReceived: 17,
        problemAsked: 5
    };
    testDispatcher.routes = [];
    var route = {
        name: "A09 первая см Петернко",
        problem: 234,
        start: 1485442099
    };
    testDispatcher.routes.push(route);
    route = {
        name: "A107 первая см Иваненко",
        problem: 19,
        start: 1485443099
    };
    testDispatcher.routes.push(route);

    testDispatcher.sessions.push(session);
    vm.dispatchers.push(testDispatcher);
    testDispatcher = {};
    testDispatcher.name = "Богданова Иванна";
    testDispatcher.status = "Перерыв";
    testDispatcher.sessions = [];
    session = {
        start: 1485442099,
        finish: 1485444099,
        endMethod: "Перерыв",
        problemReceived: 55,
        problemAsked: 12
    };
    testDispatcher.sessions.push(session);
    session = {
        start: 1485444099,
        finish: 1485447099,
        endMethod: "Конец смены",
        problemReceived: 17,
        problemAsked: 5
    };
    testDispatcher.sessions.push(session);
    session = {
        start: 1485444099,
        finish: 1485467099,
        endMethod: "Конец смены",
        problemReceived: 17,
        problemAsked: 5
    };
    testDispatcher.sessions.push(session);
    testDispatcher.routes = [];
    var route = {
        name: "A09 первая см Петернко",
        problem: 234,
        start: 1485442099
    };
    testDispatcher.routes.push(route);
    route = {
        name: "A107 первая см Иваненко",
        problem: 19,
        start: 1485443099
    };
    testDispatcher.routes.push(route);
    vm.dispatchers.push(testDispatcher);


}]);