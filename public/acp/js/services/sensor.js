// сервис для работы с сенсорами
angular.module('acp').factory('Sensor', ['$http', function SensorFactory(http) {
    return {
        all: function () {
            return http.get('./getsensors');
        }
    };
}]);