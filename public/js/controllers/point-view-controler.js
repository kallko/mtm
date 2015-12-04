angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope',
    function (scope, rootScope) {
        init();

        function init() {
            $('#point-view').popup({
                transition: 'all 0.1s'
            });

            rootScope.$on('showPoint', show);
        }

        function show (event, row) {
            scope.point = row;

            //$('#point-view').popup('show');
        }

    }]);