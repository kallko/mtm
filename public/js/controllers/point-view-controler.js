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
        }

        function initStatuses (event, data) {
            if (scope.statuses) return;

            console.log('initStatuses', data);
            STATUS = data.statuses;
            scope.statuses = data.filters;
            //console.log('initStatuses', scope.statuses);
        }

    }]);