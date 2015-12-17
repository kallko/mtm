angular.module('MTMonitor').controller('EditRouteController', ['$scope', '$rootScope', 'Statuses',
    function (scope, rootScope, Statuses) {
        var minWidth = 0,
            widthDivider = 15;

        scope.BOX_TYPE = {
            TRAVEL: 0,
            DOWNTIME: 1,
            TASK: 2
        };
        scope.STATUS = Statuses.getStatuses();

        init();

        function init() {
            rootScope.$on('routeToChange', onRouteToChange);
        }

        function onRouteToChange(event, data) {
            console.log('onRouteToChange');

            scope.route = data.route;
            scope.changedRoute = JSON.parse(JSON.stringify(data.route));
            scope.originalBoxes = getBoxesFromRoute(scope.route);
            scope.$apply();

            console.log({'scope_boxes': scope.originalBoxes});
        }

        function getBoxesFromRoute(route) {
            var boxes = [],
                point,
                tmpTime;

            for (var i = 0; i < route.points.length; i++) {
                point = route.points[i];
                if (point.TRAVEL_TIME !== '0') {
                    tmpTime = parseInt(point.TRAVEL_TIME);
                    boxes.push({
                        type: scope.BOX_TYPE.TRAVEL,
                        size: tmpTime,
                        status: point.status
                    });
                }

                if (point.DOWNTIME !== '0') {
                    tmpTime = parseInt(point.DOWNTIME);
                    boxes.push({
                        type: scope.BOX_TYPE.DOWNTIME,
                        size: tmpTime,
                        status: point.status
                    });
                }

                if (point.TASK_TIME !== '0') {
                    tmpTime = parseInt(point.TASK_TIME);
                    boxes.push({
                        type: scope.BOX_TYPE.TASK,
                        size: tmpTime,
                        number: point.NUMBER,
                        arrivalStr: point.arrival_time_hhmm,
                        endTimeStr: point.end_time_hhmm,
                        travelTime: point.TRAVEL_TIME,
                        downtime: point.DOWNTIME,
                        status: point.status
                    });
                }
            }

            return boxes;
        }

        scope.boxWidth = function(size) {
            return size / widthDivider > minWidth ? size / widthDivider : minWidth;
        };

        scope.tooltip = function(box) {
            var result = '';

            switch (box.type) {
                case scope.BOX_TYPE.TASK:
                    result += 'Задача #' + box.number + '\n';
                    break;
                case scope.BOX_TYPE.TRAVEL:
                    result += 'Переезд' + '\n';
                    break;
                case scope.BOX_TYPE.DOWNTIME:
                    result += 'Простой' + '\n';
                    break;
            }

            result += 'Продолжительность: ' + toMinutes(box.size) + ' мин.\n';

            if (box.type == scope.BOX_TYPE.TASK) {
                result += 'Время прибытия: ' + box.arrivalStr + '\n';
                result += 'Время отъезда: ' + box.endTimeStr + '\n';
                result += 'Переезд: ' + toMinutes(box.travelTime) + ' мин.\n';
                result += 'Простой: ' + toMinutes(box.downtime) + ' мин.\n';
            }

            return result;
        };

        function toMinutes(seconds) {
            return parseInt(seconds / 60);
        }

    }]);