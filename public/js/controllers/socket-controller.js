/**
 * Created by dev-2 on 14.02.17.
 */
angular.module('MTMonitor').controller('SocketController', ['$scope', '$rootScope', '$filter', function (scope, rootScope, http) {
    console.log("SOCKET.IO");
    var socket = io('https://sngtrans.com.ua','/monitoring');
    //var socket = io('https://google.com.ua/monitoring/');
    //var socket = io();
    socket.on('dispatchers', function (data) {
           console.log(data);
        if (data.error) return;
           rootScope.socketData = rootScope.socketData || {};
           rootScope.socketData.dispatchers = data;
        //socket.emit('my other event', { my: 'data' });
        scope.$emit('dispatchersLoad');
    });


    socket.on('sendReport', function (data) {
        console.log("Receive REPORT", data);
    });


    rootScope.$on("loadRoutes", function(){
        socket.emit("loadRoutes");
    });

    rootScope.$on('askDispatchersForReport', function (event, from, to) {
       socket.emit("askDispatchersForReport", {"from":from, "to":to})
    });


}]);
