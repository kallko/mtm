angular.module('MTMonitor').controller('CloseDayController', ['$scope', '$rootScope', '$filter', function (scope, rootScope, filter) {
   init();
    scope.disabledBtnCloseDay = true; //на старте обезвреживаем кнопку "Закрыть день"
    var s_dataToCloseArr_general = [];    //главный массив элементов (водителей) к закрытию. Индекс - номер, значение - имя водителя
    var s_dataToCloseArr_reserve = []; // тот же массив, что и s_dataToCloseArr_general_general, но в отличие от s_dataToCloseArr_general_general, функция toggleCheckBoxToClose() не имеет права ничего удалять из него 
    scope.closeDayClick = function(){
        scope.order();
        confirm('Ура!!! Мы закрыли день! Надо выслать массив s_dataToCloseArr_general с данными!  '+s_dataToCloseArr_general);
    	//console.log('start closeday');
        //rootScope.$emit('setCheckBox');
        //console.log($('#close-table-driver-5').html(), ' el');
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
        var splited = data.checkbox.split('-')[3];
        if(data.ischecked == true) {
            // console.log(splited, data.driver, ' uuuuuuuuuuuuuuuuuuuu');
            scope['setCheck_' + splited] = true; //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            scope['setDisabled_' + splited] = false;
            if (!s_dataToCloseArr_general[splited]) s_dataToCloseArr_general[splited] = data.driver;
            if (!s_dataToCloseArr_reserve[splited]) s_dataToCloseArr_reserve[splited] = data.driver;
            //console.log(s_dataToCloseArr_general, 's_arr');
            scope.disabledBtnCloseDay = false; //разрешаем кнопку "Закрыть день"
            //scope.setCheck_7 = true;
        }
        for(var i = 0; i < scope.data.routes.length; i++){
           if(scope.data.routes[i].filterId == splited){
                scope.data.routes[i].ischecked = data.ischecked;
                break;
            }
        }
    });


    rootScope.$on('checkInCloseDay', function(){ // проверка а не появились ли новые маршруты к закрытию (авто)
        scope.showCheckBoxToClose();
    });



    var orderBy = filter('orderBy');
   // console.log(orderBy);
    scope.order = function(predicate) {
        scope.data.routes = orderBy(scope.data.routes, 'ischecked');
      //  console.log(scope.data.routes);
    };



    scope.toggleCheckBoxToClose = function(){
        var splited = event.target.attributes['1'].value.split('-')[3];
        //console.log( scope['setCheck_'+splited], ' scope+splt');
        if(scope['setCheck_'+splited] == true){
            console.log(scope.data.routes[splited].ischecked);
            if(s_dataToCloseArr_general[splited]) delete s_dataToCloseArr_general[splited]; //это удаленное значение в случае надобности можно восстановить из s_dataToCloseArr_reserve
            scope['setCheck_'+splited]=false;
            for(var i = 0; i < scope.data.routes.length; i++){
                if(scope.data.routes[i].filterId == splited){
                    scope.data.routes[i].ischecked = false;
                    break;
                }
            }
        }else{
            s_dataToCloseArr_general[splited] = s_dataToCloseArr_reserve[splited];
            scope['setCheck_'+splited]=true;
            for(var i = 0; i < scope.data.routes.length; i++){
                if(scope.data.routes[i].filterId == splited){
                    scope.data.routes[i].ischecked = true;
                    break;
                }
            }
        };
        scope.order();
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






    function init(){
        rootScope.$on('forCloseController', function (event, data) {
            scope.data = data;
            scope.companyName = data.companyName;
            scope.user = data.user;
            scope.serverTime = data.server_time;
            for(var s=0; s<data.routes.length; s++){
                data.routes[s].s_driverNumber = s; 
                scope['setDisabled_'+s] = true;  //на старте по умолчаню запираем все чекбоксы
            }
        });
    };
    scope.closeTableRowClick = function(){

    	rootScope.$emit('closeDriverName', event.currentTarget.childNodes[5].innerHTML);
    }
}]);