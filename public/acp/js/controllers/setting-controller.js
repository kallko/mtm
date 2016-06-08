// контроллер настроек
angular.module('acp').controller('SettingController', ['$scope', function (scope) {
    scope.params.mobilePushRadius = "150";
    scope.params.stopRadius = "80";
    scope.params.fromDate = '';
    scope.params.toDate = '';
}]);