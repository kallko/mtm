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
        
        //rootScope.$on('clearMap', function(){
        //    scope.statistic = {};
        //    scope.statistic.canceled = 0;
        //    scope.statistic.scheduled = 0;
        //    scope.statistic.attention = 0;
        //    scope.statistic.delay = 0;
        //    scope.statistic.timeOut = 0;
        //    scope.statistic.delivered = 0;
        //});

        rootScope.$on('holestatistic', function(event, obj) {
            //console.log("Statistic", obj);
            scope.statistic = {};
            scope.statistic.canceled = obj[8];
            scope.statistic.scheduled = obj[7];
            scope.statistic.attention = obj[6];
            scope.statistic.delay = obj[5];
            scope.statistic.timeOut = obj[4];
            scope.statistic.delivered = obj[0]+obj[1]+obj[2]+obj[3];
        });



        rootScope.$on('displayCollectionToStatistic', function(e, pointsArr){
            scope.statistic.canceled = 0;
            scope.statistic.scheduled = 0;
            scope.statistic.attention = 0;
            scope.statistic.delay = 0;
            scope.statistic.timeOut = 0;
            scope.statistic.delivered = 0;
            for(var i = 0; pointsArr.length > i; i++){
                //console.log('Calculate statistic')
                switch(pointsArr[i].status){
                    case 0:
                    case 1:
                    case 2: scope.statistic.delivered++; break;
                    case 4: scope.statistic.timeOut++; break;
                    case 5: scope.statistic.delay++; break;
                    case 6: scope.statistic.attention++; break;
                    case 7: scope.statistic.scheduled++; break;
                    case 8: scope.statistic.canceled++; break;
                }
            }
            //console.log("Result is ", scope.statistic);
        });

        //var users = [{type: "admin", name: "Ivanov"}, {type: "moderator", name: "Petrov"}];
        //
        //var isAdmin = user => return user.type === 'admin';
        //
        //var admins = users.filter(isAdmin);
        //
        //console.log("admins", admins);


    }]);