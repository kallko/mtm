angular.module('acp').factory('Solution', ['$http', function SolutionFactory(http) {
    return {
        save: function(solution) {
            return http.post('./savesolution', {solution: solution});
        }
    };
}]);