angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope', '$http',
    function (scope, rootScope, http) {
        var STATUS;

        init();

        function init() {
            $('#point-view').popup({
                transition: 'all 0.1s'
            });

            rootScope.$on('showPoint', show);
            rootScope.$on('sendStatuses', initStatuses);
        }

        function show (event, row) {
            scope.point = row;
            //$('#point-view').popup({
            //    onopen: function() {
            //        console.log('ONOPEN');
            //    }
            //});
            $('#point-view').popup('show');
            console.log('show:', row);
        }

        function initStatuses (event, data) {
            if (scope.statuses) return;

            STATUS = data.statuses;
            scope.statuses = data.filters;
        }

        scope.confirmStatus = function () {
            console.log('confirmStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'confirm-status'
            });
        };

        scope.cancelStatus = function () {
            console.log('cancelStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'not-delivered-status'
            });
        };

        scope.cancelTask = function () {
            console.log('cancelTask');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'cancel-point'
            });
        };

        scope.blockTask = function () {
            var url = './opentask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER + '?lockTask=false';
            http.get(url)
                .success(function (data) {
                    scope.$emit('showNotification', {text: 'Задание переведено в режим редактирования.'});
                })

                .error(function (data, error) {
                    if (error == 423) {
                        scope.$emit('showNotification', {text: 'Задание заблокировано пользователем ' + data.byUser});
                    }
                });
        };

        scope.unconfirmed = function () {
            return scope.point && !scope.point.confirmed && (scope.point.status == STATUS.FINISHED ||
                scope.point.status == STATUS.FINISHED_LATE || scope.point.status == STATUS.FINISHED_TOO_EARLY);
        };

    }]);