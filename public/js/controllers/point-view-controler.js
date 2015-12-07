angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope',
    function (scope, rootScope) {
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
            $('#point-view').popup('show');
            console.log('show:', row);
        }

        function initStatuses (event, data) {
            if (scope.statuses) return;

            console.log('initStatuses', data);
            STATUS = data.statuses;
            scope.statuses = data.filters;
        }

        scope.confirmStatus = function () {
            console.log('confirmStatus');
        };

        scope.cancelStatus = function () {
            console.log('cancelStatus');
        };

        scope.cancelTask = function () {
            console.log('cancelTask');
        };

        scope.unconfirmed = function () {
            return !scope.point.confirmed && (scope.point.status == STATUS.FINISHED ||
                scope.point.status == STATUS.FINISHED_LATE || scope.point.status == STATUS.FINISHED_TOO_EARLY);
        };

    }]);