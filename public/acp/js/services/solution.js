angular.module('acp').factory('Solution', ['$http', function SolutionFactory(http) {
    return {
        save: function(solution) {
            return http.post('./savesolution', {solution: solution});
        },

        load: function() {
            return http.get('./loadsolution');
        },

        saveBig: function(bigSolution) {
            return http.post('./savebigsol', {solution: bigSolution});
        },

        merge: function(newData) {
            return http.post('./mergesolution',  {newData: newData});
        }
    };
}]);