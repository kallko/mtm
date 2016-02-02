angular.module('acp').factory('Plan', ['$http', function PlanFactory(http) {
    return {
        all: function(timestamp) {
            return http.get('./getplan/' + timestamp);
        }
    };
}]);