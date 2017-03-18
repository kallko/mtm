/**
 * Created by dev-2 on 14.02.17.
 */
angular.module('MTMonitor').controller('SocketController', ['$scope', '$rootScope', '$filter', function (scope, rootScope, http) {
    console.log("SOCKET.IO");
    var socket = io('http://localhost:9020');
    socket.on('dispatchers', function (data) {
           console.log(data);
        if (data.error) return;
           rootScope.socketData = rootScope.socketData || {};
           rootScope.socketData.dispatchers = data;
        //socket.emit('my other event', { my: 'data' });
        scope.$emit('dispatchersLoad');
    });


    rootScope.$on("loadRoutes", function(){
        socket.emit("loadRoutes");
    })


}]);
