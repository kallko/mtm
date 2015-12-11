angular.module('MTMonitor').controller('NotificationController', ['$scope', '$rootScope', '$timeout',
    function (scope, rootScope, timeout) {

    init();

    rootScope.$on('showNotification', function (event, data) {
        showPopup(data.text, data.duration);
    });

    function init() {
        $('#notification').popup({
            transition: 'all 0.1s'
        });
    }

    function showPopup(text, duration) {
        $('#notification div').html(text);
        $('#notification').popup('show');
        if (!duration) return;

        timeout(function() {
            $('#notification').popup('hide');
        }, duration);
    }

}]);