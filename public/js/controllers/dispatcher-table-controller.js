angular.module('MTMonitor').controller('DispatcherTableController', ['$scope', '$rootScope', function (scope, rootScope) {
    var vm = scope;
    vm.parseInt = parseInt;
    vm.localDispatchers;
    //fixme данные для тестирования и отладки
    vm.columnList = { keyjson2: 'Header 2', keyjson3: 'Head 3'};
    vm.toSave = [{"keyjson2":"12", "keyjson3":"15" },{"keyjson2":"14", "keyjson3":"17" },{"keyjson2":"16", "keyjson3":"18" }];

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


            //vm.toSave = vm.localDispatchers.shifts[0];
            console.log("columnList", vm.columnList);
            console.log("LocalDispatchers", vm.localDispatchers);
            console.log("To save", vm.toSave);

    };

    vm.createReport = function () {
        console.log(vm.fromShowDate, vm.toShowDate);
        if (!vm.fromShowDate){
            vm.$emit('showNotification', {text:"Введите дату для начала отчета", duration:3000});
            return
        }
        var from_ts, to_ts;
        if (!vm.toShowDate)  {
            to_ts = parseInt(Date.now()/1000);
        } else {
            to_ts = parseInt(vm.toShowDate.getTime()/1000);
        }
        from_ts = parseInt(vm.fromShowDate.getTime()/1000);
        console.log(from_ts , to_ts, to_ts - from_ts);
        if (to_ts - from_ts < 0) {
            vm.$emit('showNotification', {text:"Дата начала отчета должна быть раньше даты окончания", duration:3000});
            return
        }
        vm.$emit('askDispatchersForReport', from_ts, to_ts);
    };


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