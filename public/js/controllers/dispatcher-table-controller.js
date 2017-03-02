angular.module('MTMonitor').controller('DispatcherTableController', ['$scope', '$rootScope', function (scope, rootScope) {
    var vm = scope;
    vm.parseInt = parseInt;
    vm.localDispatchers;


    rootScope.$on('dispatchersLoad', init);


    function init(){

        console.log("Start Disp Init");
        vm.localDispatchers = rootScope.socketData.dispatchers;
        console.log(vm.localDispatchers);
        vm.localDispatchers.shifts.forEach(function(item){
            var result = vm.localDispatchers.allDispatchers.filter(function(disp){
                return item.dispatcher == disp.id;
            });
            item.fio = result[0].fio;
        });

        var shift = vm.localDispatchers.shifts[vm.localDispatchers.shifts.length - 1];
        if (!shift) return;
        var session = shift.sessions[shift.sessions.length - 1];
        if (!session || !session.routes || !session.routes.length) return;
        session.results = session.results || {};
        session.results.average_problems = parseInt(session.routes.reduce(function(summ, item){
            return summ + item.max_problem;
        },0)/session.routes.length);

    }


    if (rootScope && rootScope.data && rootScope.data.settings) vm.supervisor = rootScope.data.settings.userRoles.some(function(item){
        return item == 'supervisor'}) || false;


    if (rootScope.socketData)  vm.localDispatchers = rootScope.socketData.dispatchers;



    vm.dispTest = function() {
            console.log(vm.localDispatchers);

    }




}]);





































//vm.dispatchers = [];
//var testDispatcher = {};
//testDispatcher.name = "Иванова Богдана";
//testDispatcher.status = "Работает";
//testDispatcher.sessions = [];
//var session = {
//    start: 1485442099,
//    finish: 1485444099,
//    endMethod: "Перерыв",
//    problemReceived: 55,
//    problemAsked: 12
//};
//testDispatcher.sessions.push(session);
//session = {
//    start: 1485444099,
//    finish: 1485447099,
//    endMethod: "Конец смены",
//    problemReceived: 17,
//    problemAsked: 5
//};
//testDispatcher.routes = [];
//var route = {
//    name: "A09 первая см Петернко",
//    problem: 234,
//    start: 1485442099
//};
//testDispatcher.routes.push(route);
//route = {
//    name: "A107 первая см Иваненко",
//    problem: 19,
//    start: 1485443099
//};
//testDispatcher.routes.push(route);
//
//testDispatcher.sessions.push(session);
//vm.dispatchers.push(testDispatcher);
//testDispatcher = {};
//testDispatcher.name = "Богданова Иванна";
//testDispatcher.status = "Перерыв";
//testDispatcher.sessions = [];
//session = {
//    start: 1485442099,
//    finish: 1485444099,
//    endMethod: "Перерыв",
//    problemReceived: 55,
//    problemAsked: 12
//};
//testDispatcher.sessions.push(session);
//session = {
//    start: 1485444099,
//    finish: 1485447099,
//    endMethod: "Конец смены",
//    problemReceived: 17,
//    problemAsked: 5
//};
//testDispatcher.sessions.push(session);
//session = {
//    start: 1485444099,
//    finish: 1485467099,
//    endMethod: "Конец смены",
//    problemReceived: 17,
//    problemAsked: 5
//};
//testDispatcher.sessions.push(session);
//testDispatcher.routes = [];
//var route = {
//    name: "A09 первая см Петернко",
//    problem: 234,
//    start: 1485442099
//};
//testDispatcher.routes.push(route);
//route = {
//    name: "A107 первая см Иваненко",
//    problem: 19,
//    start: 1485443099
//};
//testDispatcher.routes.push(route);
//vm.dispatchers.push(testDispatcher);