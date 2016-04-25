// контроллер для работы с попапами
angular.module('MTMonitor').controller('NotificationController', ['$scope', '$rootScope', '$timeout',
    function (scope, rootScope, timeout) {

        //init();

        rootScope.$on('showNotification', function (event, data) {
            showPopup(data.text, data.duration);
            //console.log(rootScope.data);
        });

        rootScope.$on('showCloseRoutePoints', function (event, data) {
            showPopup('Окно сработало', data.duration);
            //console.log(rootScope.data);
        });

        rootScope.$on('ReqChengeCoord', function(event, data){
            $('#ConfirmchengeCoord div').html(data.message);
            $('#ConfirmchengeCoord').popup('show');

        });

        scope.chengeCoordPoint = function(bool){
            rootScope.$emit('ResChengeCoord', bool);
            $('#ConfirmchengeCoord').popup('hide');
        };

/*
        function init() {
            $('#notification').popup({
                //transition: 'all 0.10s' ------------not working
            });
        }
*/
        
        // эта фукнция выводит popup, она универсальна, вызывается из point-index-controller
        
        function showPopup(text, duration) {
            $('#notification div').html(text);
            $('#notification').popup('show');
            if (!duration) return;       

            timeout(function () {
                $('#notification').popup('hide');
            }, duration);
        }
        
    }]);
/*
 function showPopup(text, duration) {
            console.log(text+' text', duration+ ' duration');
            $('#notification div').html(text);
            $('#notification').popup('show');
            if (!duration) return;       

            setTimeout(function () {
                $('#notification').popup('hide');
            }, duration);
        }

*/