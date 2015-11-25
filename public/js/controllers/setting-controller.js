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
            value: 0
        };

        scope.$watch(function () {
            return scope.params.predictMinutes
                + scope.params.factMinutes
                + scope.params.volume
                + scope.params.weight
                + scope.params.value;
        }, function () {
            scope.$emit('settingChanged', scope.params);
        });
    }

}]);