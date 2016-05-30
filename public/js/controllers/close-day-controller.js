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
        //console.log(scope.setCheckAll, ' stchk');
        //scope.setCheckAll = true;
        //if(!scope.setCheckAll){
         //   scope.setCheckAll = true;  // проставляем галочку на общем чекбоксе
            rootScope.$emit('showCheckBoxToClose');  //  ------> point-index-controller
        //}else{
        //    scope.setCheckAll = false;   // снимаем галочку с главного чекбокса
        //};
    };
    rootScope.$on('returnCheckBoxes', function (event, data){  // <-----point-index-controller
        console.log(data);
        for(var i = 0; i < scope.data.routes.length; i++){
           if(scope.data.routes[i].filterId == data.filterId){
               scope.data.routes[i].getCheck = true;
               break;
            }
        }
        scope.disabledBtnCloseDay = false;


        // var splited = data.checkbox.split('-')[3];
        // if(data.ischecked == true) {
        //     // console.log(splited, data.driver, ' uuuuuuuuuuuuuuuuuuuu');
        //     scope['setCheck_' + splited] = true; //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //     scope['setDisabled_' + splited] = false;
        //     if (!s_dataToCloseArr_general[splited]) s_dataToCloseArr_general[splited] = data.driver;
        //     if (!s_dataToCloseArr_reserve[splited]) s_dataToCloseArr_reserve[splited] = data.driver;
        //     //console.log(s_dataToCloseArr_general, 's_arr');
        //     scope.disabledBtnCloseDay = false; //разрешаем кнопку "Закрыть день"
        //     //scope.setCheck_7 = true;
        // }
        // for(var i = 0; i < scope.data.routes.length; i++){
        //    if(scope.data.routes[i].filterId == splited){
        //         scope.data.routes[i].ischecked = data.ischecked;
        //         break;
        //     }
        // }
    });


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
    


    scope.toggleCheckBoxToClose = function(){
        console.info(scope.data.routes);
        // var splited = event.target.attributes['1'].value.split('-')[3];
        // //console.log( scope['setCheck_'+splited], ' scope+splt');
        // if(scope['setCheck_'+splited] == true){
        //     if(s_dataToCloseArr_general[splited]) delete s_dataToCloseArr_general[splited]; //это удаленное значение в случае надобности можно восстановить из s_dataToCloseArr_reserve
        //     scope['setCheck_'+splited]=false;
        //     for(var i = 0; i < scope.data.routes.length; i++){
        //         if(scope.data.routes[i].filterId == splited){
        //             scope.data.routes[i].ischecked = false;
        //             break;
        //         }
        //     }
        // }else{
        //     s_dataToCloseArr_general[splited] = s_dataToCloseArr_reserve[splited];
        //     scope['setCheck_'+splited]=true;
        //     for(var i = 0; i < scope.data.routes.length; i++){
        //         if(scope.data.routes[i].filterId == splited){
        //             scope.data.routes[i].ischecked = true;
        //             break;
        //         }
        //     }
        // }
        //
       // console.log(splited);
      //  console.log(scope.data.routes);
       // console.log(s_dataToCloseArr_general, 'sss');
        //event.target.attributes['4'].value= (event.target.attributes['4'].value!= 'false') ? 'false' : 'true';

        //for(var prop in event.target.attributes['4'])
        //if(event.target.attributes['4'].value == 'false'){
        //    event.target.attributes['4'].value = 'true';
        //}else{
        //    event.target.attributes['4'].value = 'false';
        //}
        //console.log(event.target.attributes['4'].value, ' ev');
        //scope.setCheck_2 = true;
        //console.log(scope.setCheck_2, ' ch');
        //$('#close-table-checkbox-7').removeAttr('checked');
        //scope.$load();
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



           



    scope.closeTableRowClick = function(uniqueID, $index){
    	//rootScope.$emit('closeDriverName', uniqueID);
        if(scope.selected == $index){
            scope.selected = -1;
            rootScope.$emit('closeDriverName', uniqueID, false); // false не рисовать новый маршрут
        }else{
            scope.selected = $index;
            rootScope.$emit('closeDriverName', uniqueID, true); // true рисовать новый маршрут
        }
    };

    scope.selected = -1;



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

}]);