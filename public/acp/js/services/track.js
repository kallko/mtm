angular.module('acp').factory('Track', ['$http', function TrackFactory(http) {
    return {
      stops: function(gid, from, to) {
          return http.get('./getstops/' + gid + '/' + from + '/' + to);
      }
    };
}]);