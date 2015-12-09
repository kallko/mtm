/**
 * Created by dev-2 on 25.11.15.
 */

angular.module('MTMonitor').controller('SettingController', ['$scope', '$rootScope', 'Settings', '$filter',
    function (scope, rootScope, Settings, filter) {

        init();

        function init() {
            scope.demoMd = false;
            scope.params = {
                predictMinutes: 10,
                factMinutes: 15,
                volume: 0,
                weight: 0,
                value: 0,
                workingWindowType: 1,
                demoTime: 48,
                endWindowSize: 3,
                showDate: -1
            };

            var settings = Settings.load();
            scope.params = settings || scope.params;

            scope.workingWindowTypes = [
                {name: 'Заказанное окно', value: 0},
                {name: 'Обещанное окно', value: 1}
            ];

            rootScope.$on('setMode', function (event, params) {
                scope.demoMd = params.mode;
                scope.startDemoTime = params.demoStartTime;
                //console.log(params.demoStartTime);
            });
        }

        scope.saveAllParams = function () {
            var date = new Date($('#show-date').val());
            scope.params.showDate = date.getTime() || -1;
            scope.$emit('settingsChanged', scope.params);
            saveToLocalStorage();
        };

        function saveToLocalStorage() {
            localStorage['settings'] = JSON.stringify(scope.params);
        }
    }]);