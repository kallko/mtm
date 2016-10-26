/**
 * Created by dev-2 on 19.10.16.
 */
angular.module('MTMonitor').controller('EditConditionController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {

    scope.mode=[];
    scope.mode.push({value:-1, name: "Режим корректировки"});
    scope.mode.push({value:0, name: "Замена водителя"});
    scope.mode.push({value:1, name: "Замена устройства"});
    scope.selectedMode=-1;
    scope.selectedRouteFilterId =-1;
    scope.iMEI="";

    rootScope.$on('choseproblem', function (event, filterId){
        console.log("В изменение условий пришли данные", filterId);
        if (filterId == undefined || filterId == -1 ) return;

        for (var i=0; i< rootScope.data.routes.length; i++) {
            console.log(rootScope.data.routes[i].filterId , filterId);
            if (rootScope.data.routes[i].filterId == filterId){
                scope.route = rootScope.data.routes[i];
                break;
            }
        }

        scope.allDrivers=rootScope.data.drivers;
        scope.allTransports=rootScope.data.transports;
    });



    scope.changeDriver = function() {
        //console.log(scope.selectedDriver, scope.selectedTransport, scope.selectedStart);
        rootScope.$emit('changeDriver', scope.selectedDriver, scope.selectedTransport, scope.selectedStart, scope.route.uniqueID); //эмитируем в поинтиндекс контроллер, чтобы там сделать все изменения в данных
        scope.selectedStart=false;
    };


    scope.setMobileDevice = function(){
        console.log(scope.selectedRouteFilterId, scope.changeTime, scope.iMEI);
        scope.changeTime = rootScope.nowTime;
        if(scope.selectedRouteFilterId == -1 || scope.selectedRouteFilterId == undefined || !scope.changeTime || !scope.iMEI){
            scope.$emit('showNotification', {text: "Заполните все необходимые поля", duration: 3000});
            return;
        }
        //console.log("Входные данные",  scope.selectedRouteFilterId, scope.changeTime, scope.iMEI, scope.iMEI.length, (parseInt(scope.iMEI)).toString().length, (parseInt(scope.iMEI)).length);
        if(scope.iMEI.length !=15 || (parseInt(scope.iMEI)).toString().length != 15){
            scope.$emit('showNotification', {text: "Введен некорректный IMEI", duration: 3000});
            return;
        }
        var route;
        for(var i=0; i<rootScope.data.routes.length; i++){
            console.log("Поиск роута", rootScope.data.routes[i].filterId, scope.selectedRouteFilterId );
            if(rootScope.data.routes[i].filterId == scope.selectedRouteFilterId) {
                route=rootScope.data.routes[i];
            }
        }

        setNewMobileDevice(route, scope.iMEI, scope.changeTime)

    };


    function timeCorrection() {

    }

    function changeGid(route, newGid) {
        route.real_track=[];
        route.transport.gid = newGid;
        scope.$emit('clearMap');
        scope.$emit('drawRealTrack', route);

    }


    function setNewMobileDevice(route, imei, time){
        console.log("DriverID", route.driver.ID);
        http.post('./setmobiledevice/', {imei:imei, driver:route.driver.ID})
            .success(function(data) {
                console.log("Set mobile device complete", data, data.result, data.result.return);



                var r = new RegExp("\x27+", "g");
                var obj = (data.result.return).replace(r, "\"");
                console.log("Obj", obj);
                obj=obj.replace(/\s/ig, "");
                console.log("Obj", obj , !obj.endsWith("\}"));
                if (!obj.endsWith("}")) obj+="}";
                obj=JSON.parse(obj);

                if (obj.result == 'error') {
                    scope.$emit('showNotification', {text:"Некорректный IMEI", duration: 3000});
                    return;
                }
                var newGid=obj.gid;





                //timeCorrection(); //todo функция объединения существующего трека с новым.
                changeGid(route ,newGid);


            })
    }

}]);