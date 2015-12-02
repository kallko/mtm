angular.module('MTMonitor').controller('NotificationController', ['$scope', '$rootScope', function (scope, rootScope) {

    init();

    rootScope.$on('showNotification', function (event, text) {
        showPopup(text);
    });

    function init() {
        $('#notification').popup({
            transition: 'all 0.1s'
        });

        //window.setTimeout(function() {
        //    showPopup('looooooooooong test test  test notification');
        //}, 1000);
    }

    function showPopup(text) {
        $('#notification div').html(text);
        $('#notification').popup('show');
    }

}]);