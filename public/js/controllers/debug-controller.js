angular.module('MTMonitor').controller('DebugController', ['$scope', '$http', '$rootScope', function (scope, http, rootScope) {

    var _data;
    scope.params = {
        undef_t: 60,
        undef_d: 1000,
        stop_s: 5,
        stop_d: 25,
        move_s: 5,
        move_d: 90
    };

    scope.loadTracksWithParams = function () {
        scope.$emit('clearTracks');

        var q1 = '/tracks/631&1435708800&1437004800&' + getParamsStr(),
            q2 = '/tracks/713&1443484800&1443571200&' + getParamsStr();

        getTracks(q1);
        getTracks(q2);
    };

    function getTracks(query) {
        console.log(query);
        http.get(query, {}).
            success(function (tracks) {
                console.log({'track': tracks});
                scope.$emit('drawTracks', tracks);
            });
    }

    function getParamsWithNameStr() {
        return "undef_t=" + scope.params.undef_t +
            "&undef_d=" + scope.params.undef_d +
            "&stop_s=" + scope.params.stop_s +
            "&stop_d=" + scope.params.stop_d +
            "&move_s=" + scope.params.move_s +
            "&move_d=" + scope.params.move_d;
    }

    function getParamsStr() {
        return scope.params.undef_t +
            "&" + scope.params.undef_d +
            "&" + scope.params.stop_s +
            "&" + scope.params.stop_d +
            "&" + scope.params.move_s +
            "&" + scope.params.move_d;
    }

    rootScope.$on('saveForDebug', function(event, data){
        _data = data;
    });

    scope.test = function () {
        //scope.$emit('drawAllPoints', _data);

        // 50.507535
        // 30.502585

        // 50.503997
        // 30.50207

        http.get('findtime/50.507535&30.502585&50.503997&30.50207', {}).
            success(function (data) {
                console.log({'result': data});
            });
    };

}]);