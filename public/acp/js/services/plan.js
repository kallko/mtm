angular.module('acp').factory('Plan', ['$http', function PlanFactory(http) {
    return {
        all: function(timestamp) {
            //console.log('PlanFactory.all', from, to);
            return http.get('./getplan/' + timestamp);
        }
    };
}]);