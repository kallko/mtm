// контроллер для работы с настройками
angular.module('MTMonitor').controller('SettingController', ['$scope', '$rootScope', 'Settings', '$filter',
    function (scope, rootScope, Settings, filter) {

        init();

        // начальная инициализация контроллера
        function init() {
            scope.demoMd = false;
            scope.params = Settings.load();

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

        // сохраняет все параметры
        scope.saveAllParams = function () {
            var date = new Date($('#show-date').val());
            scope.params.showDate = date.getTime() || -1;
            scope.$emit('settingsChanged', scope.params);
            Settings.saveToLocalStorage(scope.params);
        };
    }]);