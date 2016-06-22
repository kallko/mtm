// контроллер для работы с таблицей общей статистики по точкам
angular.module('MTMonitor').controller('StatisticController', ['$scope', '$http', '$timeout', '$interval'
    , '$filter', '$rootScope', 'Settings', 'Statuses', 'TimeConverter',
    function (scope, http, timeout, interval, filter, rootScope, Settings, Statuses, TimeConverter) {
        scope.statistic = {};
        scope.statistic.canceled = 0;
        scope.statistic.scheduled = 0;
        scope.statistic.attention = 0;
        scope.statistic.delay = 0;
        scope.statistic.timeOut = 0;
        scope.statistic.delivered = 0;
        
        
        rootScope.$on('displayCollectionToStatistic', function(e, displayCollection){
            //scope.displayCollection = displayCollection;
            scope.statistic.canceled = 0;
            scope.statistic.scheduled = 0;
            scope.statistic.attention = 0;
            scope.statistic.delay = 0;
            scope.statistic.timeOut = 0;
            scope.statistic.delivered = 0;
            for(var i = 0; displayCollection.length > i; i++){
                switch(displayCollection[i].status){
                    case (1 || 2 || 0): scope.statistic.delivered++; break;
                    case 4: scope.statistic.timeOut++; break;
                    case 5: scope.statistic.delay++; break;
                    case 6: scope.statistic.attention++; break;
                    case 7: scope.statistic.scheduled++; break;
                    case 8: scope.statistic.canceled++; break;
                }
            }
            console.log(scope.statistic);
        });


        scope.$watch('displayCollection', function() {
            // scope.statistic.canceled = 0;
            // scope.statistic.scheduled = 0;
            // scope.statistic.attention = 0;
            // scope.statistic.delay = 0;
            // scope.statistic.timeOut = 0;
            // scope.statistic.delivered = 0;
            // console.log(scope.displayCollection);
            // for(var i = 0; scope.displayCollection.length > i; i++){
            //     switch(scope.displayCollection[i].status){
            //         case (1 || 2 || 0): scope.statistic.delivered++; break;
            //         case 4: alert(123456); scope.statistic.timeOut++; break;
            //         case 5: scope.statistic.delay++; break;
            //         case 6: scope.statistic.attention++; break;
            //         case 7: scope.statistic.scheduled++; break;
            //         case 8: scope.statistic.canceled++; break;
            //     }
            // }
            // console.log(scope.statistic);
        });

    }]);