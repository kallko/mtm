angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', '$filter', '$http', function (scope, rootScope, filter, http) {

    scope.disabledBtnCloseDay = true; //на старте обезвреживаем кнопку "Закрыть день"

    var s_dataToCloseArr_general = [];    //главный массив элементов (водителей) к закрытию. Индекс - номер, значение - имя водителя
    var s_dataToCloseArr_reserve = []; // тот же массив, что и s_dataToCloseArr_general_general, но в отличие от s_dataToCloseArr_general_general, функция toggleCheckBoxToClose() не имеет права ничего удалять из него 
    var currentDay = true; // при инициализации подгружается текущий день
    scope.closeDayClick = function(){
        scope.orderCloseDay('getCheck');
        rootScope.$emit('pushCloseDayDataToServer', {data: scope.data, currentDay: currentDay });
        
        delete s_dataToCloseArr_reserve; // удаляем резервный массив, может удалим еще что-то 
    };
    scope.showCheckBoxToClose = function(){    //отобразить чекбоксы тех водителей, у ктоторых нет проблем и готовых к удалению
        var forSome = function (status, confirmed, havStop){
            if( confirmed || ( (status == 0 || status == 1 || status == 2 || status == 6) && havStop  ) || status == 8){
                return true;
            }
            return false;
        };

        outer: for(var m = 0; m < scope.data.routes.length; m++) {
            for (var i = 0; scope.data.routes[m].points.length > i; i++) {
                if (scope.data.routes[m].getCheck || !forSome(scope.data.routes[m].points[i].status, scope.data.routes[m].points[i].confirmed, scope.data.routes[m].points[i].haveStop)) {
                    continue outer;
                }
            }
            scope.data.routes[m].getCheck = true;
            scope.disabledBtnCloseDay = false;
        }
    };



    rootScope.$on('checkInCloseDay', function(){ // проверка а не появились ли новые маршруты к закрытию (авто)
        scope.showCheckBoxToClose();
    });



    var orderBy = filter('orderBy');
    scope.order = function(predicate){
        scope.predicate = predicate;
        scope.reverse = (scope.predicate === predicate) ? !scope.reverse : false;
        scope.data.routes = orderBy(scope.data.routes, predicate, scope.reverse);
    };

    scope.orderCloseDay = function(predicate){
      scope.data.routes = orderBy(scope.data.routes, predicate);
    };
    

        rootScope.$on('forCloseController', function (event, data) {
            
            scope.data = data;
            scope.companyName = data.companyName;
            scope.user = data.user;
            scope.serverTime = data.server_time;
            rootScope.clickOff = false;// вызывает слой, который не дает кликать по таблице, пока не закончилась отрисовка маршрута
            for(var i=0; i < data.routes.length; i++){
                data.routes[i].getCheck = false;  //на старте по умолчаню выключаем все чекбоксы
            }
        });
    
    scope.closeTableRowClick = function(item){
        rootScope.carCentre=true;// после отрисовки маршрута отцентрировать по машинеж
        
        if(item.selected){
            item.selected = false;
            rootScope.$emit('closeDriverName', item.filterId, false); // false не рисовать новый маршрут
        }else{
            for(var i = 0; scope.data.routes.length > i; i++){
                scope.data.routes[i].selected = false;
            }
            item.selected = true;
            rootScope.$emit('closeDriverName', item.filterId, true); // true рисовать новый маршрут
        }
    };





    scope.routesFilter = function(item){
        if(item.getCheck == true || item.oldroute == true){
            return false;
        }
        return true;
    };

    scope.listOldRoutes = false;
    scope.voldRoutes = {};
    scope.cacheOldRoutes = {};


    scope.chengeSelectDayOldRoutes = function(){
        console.log(scope.selectDeyOldRoutes);
        if(scope.selectDeyOldRoutes !== null){
            console.log(scope.selectDeyOldRoutes, 'отправка в поинт ндекс');
            rootScope.$emit('reqOldroute',  scope.selectDeyOldRoutes);
            currentDay = false;
            $('#problem-index-btn').addClass('btn-success');
        }
    };

    scope.showGetCurrentday = false;
    rootScope.$on('thisIsOldDay', function(event, data){
        scope.showGetCurrentday = true;
    });

    scope.getCurrentday = function(){
        rootScope.$emit('getCurrentday');
        scope.showGetCurrentday = false;
        currentDay = true;
        $('#problem-index-btn').addClass('btn-success');
        scope.selectDeyOldRoutes = 'У вас есть не закрытые дни';
    };



    scope.showSelectDayOldRoutes = false;
    http.get('./keysoldroutescache')
        .success(function (data) {
            console.log(data);
            if(data != null && data.length != 0){
                scope.showSelectDayOldRoutes = true;
                scope.deysOldRoutes = data;
            }else{
                scope.showSelectDayOldRoutes = false;
            }
        })
        .error(function(err){
            rootScope.errorNotification('./keysoldroutescache/');
        });
    rootScope.$on('successCloseOldRoutes', function(event){
        console.log(scope.data);
        if(scope.data.routes.length == 0 ){
            for(var i = 0; scope.deysOldRoutes.length > i; i++){
                if(scope.deysOldRoutes[i] == scope.data.routesOfDate){
                    scope.deysOldRoutes.splice(i, 1);
                    break;
                }
            }
            delete scope.data;
            if(scope.deysOldRoutes.length == 0){
                scope.showGetCurrentday = false;
                scope.showSelectDayOldRoutes = false;
                alert('вовзвр, текущий день');
                rootScope.$emit('getCurrentday');
                currentDay = true;

            }else{
                scope.selectDeyOldRoutes = 'У вас есть не закрытые дни';
            }
        }
    })

        //scope.forNodeSerch;

    scope.startSerchOnNode = function (){
       //alert("Заработало!!!" + scope.forNodeSerch)
       console.log("Start serch in closedayController");
        http.post('./nodeserch', {data: scope.forNodeSerch})
            .success(function(data) {
                console.log("Результат поиска", data);
                createDisplay(data);
            })
            .error(function(data) {

            })
    };


    function createDisplay(data){
        //На первом этапе в дисплей добавляется совпадение по водителюб потом название, адресб комментарий
        scope.serchDisplay=[];
        for (var i=0; i<data.length; i++) {
            if (data[i].name == undefined && data[i].adress == undefined && data[i].comment == undefined){
                scope.serchDisplay.push(data[i]);
                data.splice(i,1);
                i--;
            }
        }

        scope.serchDisplay = scope.serchDisplay.concat(data);

    }

    scope.loadSerchResult = function(id) {
        console.log("Работает "+id);

        var extra = 1; //Стандартное количество привышения количества роутов
        for (var i=0; i<rootScope.data.settings.userRoles.length; i++){
            if (rootScope.data.settings.userRoles[i] == 'supervisor' ||  rootScope.data.settings.userRoles[i] == 'head'){
                extra = 100;
                break;
            }
        }

        console.log("EXTRA", extra, rootScope.data.settings.role);

        if (rootScope.data.routes.length >= rootScope.data.settings.problems_to_operator + extra && rootScope.data.currentDay == true ) {

            scope.$emit('clearMap');

            alert("Вы уже заблокировали предельное количество маршрутов");
            rootScope.clickOff = false;
        }
        else scope.$emit('loadoneroute', id);
    };

    scope.statuses = function () {
        //console.log("begin");


        http.get('./getServerStatus' )
            .success(function (data){
                console.log("Success 2", data.result.online);
                alert("Status компании " + data.result.company +"\n" +
                    "Беспроблемных роутов " + data.result.routes + "\n" +
                    "Роутов в очереди " + data.result.line_routes + "\n" +
                    "Заблокированных роутов " + data.result.blocked_routes + "\n" +
                    "Старых роутов " + data.result.oldRoutes+ "\n" +
                    "Сейчас online " + data.result.online);
            });



    };


    scope.notify = function(){
        http.get('./notification')
            .success(function (data){
                alert("Notification complete." );
            });
    };

    scope.checkRoutes = function (){
        console.log("Check start");
        if (rootScope.data == undefined || rootScope.data.routes == undefined || rootScope.data.routes.length <1 ) return;
        for (var i=0; i<rootScope.data.routes.length; i++){

            var route = rootScope.data.routes[i];
            console.log("Route", route.uniqueID);
            for (var j=0; j<route.points.length; j++){
                //console.log(j);
                if (route.points[j].stopState != undefined) {
                    //console.log("Сравнение", route.points[j].autofill_service_time , route.points[j].stopState.time)
                    if (route.points[j].autofill_service_time != route.points[j].stopState.time) {
                        console.log("Find Problem ", route.points[j]);
                    }
                }
            }
        }
        console.log("Start call");

        rootScope.$emit('CollectNewDataForClosingRoutesTestFunction');


    };


    scope.saveData = function () {
        console.log("begin");
        http.get('./saveData')
            .success(function (data){
                alert("Saving complete. Result is in console" );
                console.log("Result of saving", data.mes)

            });



    };


    scope.loadData = function () {
        //console.log("begin");
        http.get('./loadData')
            .success(function (data){
                console.log("Success", data);

            });



    }


    scope.analysisIDSpoints = function () {
        //http.post('./signalDriverToDispatcher/', { data: "{ '{\'driverID\':\'123\',\'company\':\'228932\',\'client_id\':\'12525\'}': '' }"})
        //    .then(function(){
        //        console.log("SUCCESS");
        //    });


        //http.get('./analysisIDSpoints')
        //    .success(function (data){
        //        console.log("Success", data);
        //
        //    });
    }

}]);