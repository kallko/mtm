// контроллер для работы с настройками
angular.module('MTMonitor').controller('SettingController', ['$scope', '$rootScope', 'Settings', '$filter', '$http',
    function (scope, rootScope, Settings, filter, http) {

        init();

        // начальная инициализация контроллера
        function init() {
            scope.demoMd = false;
            //scope.params = Settings.load();


            console.log("!!!!!!!!!!!!!!!!!scope.params!!!!!!!!!!!!!!",scope.params, newSettings);


            scope.workingWindowTypes = [
                {name: 'Заказанное окно', value: 0},
                {name: 'Обещанное окно', value: 1}
            ];

            // в случае активации демо режима
            rootScope.$on('setMode', function (event, params) {
                scope.demoMd = params.mode;
                scope.startDemoTime = params.demoStartTime;
            });
        }
        // rootScope.$on('changeRouteListOrder', function(event, ordered){
        //
        //     scope.route_name = ordered;
        //     scope.ordered = ordered;
        // });
        // scope.route_name = 'nameDriver';
        // scope.ordered = 'nameDriver';

        // обработчик кнопки сохранить, вызывается в index.html (ng-click)
        // scope.loadOldDay = function(){
        //     if(scope.showDate!=undefined){
        //         var dateTS = scope.showDate.getTime();
        //         scope.params.showDate = (dateTS + 1000*60*60*24) - 1 || -1;
        //         console.log(scope.params.showDate);
        //
        //         //rootScope.$emit('fastCalc');
        //         rootScope.$emit('stateChanged');
        //         http.post('./currentsrvertime/')
        //             .success(function (serverTime){
        //                 var chooseDate = new Date(scope.params.showDate);
        //                 var currentTime = new Date(serverTime);
        //                 if(chooseDate.getFullYear()+'.'+chooseDate.getMonth()+'.'+chooseDate.getDate() == currentTime.getFullYear()+'.'+currentTime.getMonth()+'.'+currentTime.getDate()){
        //                     scope.params.showDate = null;
        //                     scope.$emit('loadOldDay', scope.params);
        //                 }else{
        //                     scope.$emit('loadOldDay', scope.params);
        //                 }
        //             });
        //     }
        // };

        

        //scope.saveAllParams = function () {
        //    Settings.saveToLocalStorage(scope.params);
        //    scope.$emit('settingsChanged', scope.params);
        //};
    }]);