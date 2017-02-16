/**
 * Created by dev-2 on 14.02.17.
 */

console.log("SOCKET.IO");
var socket = io('http://localhost:9020');
socket.on('news', function (data) {
    console.log(data);
    socket.emit('my other event', { my: 'data' });
});