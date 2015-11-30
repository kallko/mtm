/**
 * Created by dev-2 on 25.11.15.
 */

angular.module('MTMonitor').controller('SettingController', ['$scope', '$rootScope', '$timeout',
    function (scope, rootScope, timeout) {

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

        scope.workingWindowTypes = [
            {name: 'Обещанное окно', value: 0},
            {name: 'Заказанное окно', value: 1}
        ];

        rootScope.$on('setMode', function (event, params) {
            scope.demoMd = params.mode;
        });


        //scope.$watch(function () {
        //    return scope.params.predictMinutes
        //        + scope.params.factMinutes
        //        + scope.params.volume
        //        + scope.params.weight
        //        + scope.params.value;
        //}, function () {
        //    //console.log('some params changed', scope.params);
        //    scope.$emit('settingChanged', scope.params);
        //});
    }

    scope.saveAllParams = function () {
        scope.$emit('settingsChanged', scope.params);
    };

}]);