/**
 * Created by dev-2 on 25.11.15.
 */

angular.module('MTMonitor').controller('SettingController', ['$scope', '$rootScope', 'Settings',
    function (scope, rootScope, Settings) {

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
                demoTime: 10,
                endWindowSize: 3
            };

            var settings = Settings.load();
            scope.params = settings || scope.params;

            scope.workingWindowTypes = [
                {name: 'Заказанное окно', value: 0},
                {name: 'Обещанное окно', value: 1}
            ];

            rootScope.$on('setMode', function (event, params) {
                scope.demoMd = params.mode;
            });
        }

        scope.saveAllParams = function () {
            scope.$emit('settingsChanged', scope.params);
            saveToLocalStorage();
        };

        function saveToLocalStorage() {
            localStorage['settings'] = JSON.stringify(scope.params);
        }
    }]);