/**
 * Created by dev-2 on 25.11.15.
 */

angular.module('MTMonitor').controller('SettingController', ['$scope', function (scope) {

    init();

    function init() {
        scope.params = {
            predictMinutes: 10,
            factMinutes: 10,
            volume: 0,
            weight: 0,
            value: 0,
            workingWindowType: 0,
            endWindowSize: 3
        };

        scope.$emit('settingChanged', scope.params);

        scope.workingWindowTypes = [
            {name: 'Обещанное окно', value: 0},
            {name: 'Заказанное окно', value: 1}
        ];

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
        scope.$emit('settingChanged', scope.params);
    };

}]);