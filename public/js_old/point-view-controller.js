// контроллер для отображения окна точки
angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope', '$http', 'Statuses', '$filter',
    function (scope, rootScope, http, Statuses, filter) {
        var STATUS,
            parent; // откуда было открыто окно

        init();

        // начальная инициализация контроллера
        function init() {
            $('#point-view').popup({
                    transition: 'all 0.15s',
                    onclose: function () {
                        if (scope.point.lockedByMe && !scope.route.locked)  scope.toggleTaskBlock();
                    }
                }
            );

            initStatuses();

            rootScope.$on('showPoint', show);
            rootScope.$on('newTextStatus', newTextStatus);
            rootScope.$on('companyName', function (event, data) {
                scope.companyName = data;
                console.log(data);
            });
            rootScope.$on('lockRoute', lockRoute);
            rootScope.$on('unlockRoute', unlockRoute);
        }

        // показать окно с точкой
        function show(event, data) {
            scope.point = data.point;

            $('#promised-start-card').val(filter('date')(data.point.promised_window_changed.start * 1000, 'HH:mm'));
            $('#promised-finish-card').val(filter('date')(data.point.promised_window_changed.finish * 1000, 'HH:mm'));

            scope.route = data.route;
            parent = data.parent;

            $('#point-view').popup('show');
        }

        // заблокировать маршрут
        function lockRoute(event, data) {
            scope.$emit('unlockAllRoutes', {filterId: data.route.filterId});
            scope.route = data.route;
            scope.point = data.point;
            scope.route.lockedByMe = false;
            scope.toggleRouteBlock();
        }

        // разблокировать маршрут
        function unlockRoute(event, data) {
            scope.route = data.route;
            scope.point = data.point;
            scope.route.lockedByMe = true;
            scope.toggleRouteBlock();
        }

        // инициализация статусов
        function initStatuses() {
            STATUS = Statuses.getStatuses();
            scope.statuses = Statuses.getTextStatuses();
        }

        // назначение нового текстового статуса
        function newTextStatus(event, text) {
            if (scope.point)    scope.point.textStatus = text;
        }

        // подтверждение статуса (генерирует событие, которое принимается в PointIndexController
        // и подтверждает сомнительный статус
        scope.confirmStatus = function () {
            console.log('confirmStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'confirm-status'
            });
        };

        // отмена сомнительного статуса
        scope.cancelStatus = function () {
            console.log('cancelStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'not-delivered-status'
            });
        };

        // отменить задачу
        scope.cancelTask = function () {
            console.log('cancelTask');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'cancel-point'
            });
        };

        // перекелючить (вкл/выкл) блокировку задачи
        scope.toggleTaskBlock = function () {
            var url;

            if (!scope.point.locked) {
                url = './opentask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER + '?lockTask=false';
                http.get(url)
                    .success(function (data) {
                        if (data.status === 'ok') {
                            scope.point.locked = true;
                            scope.point.lockedByMe = true;
                        } else if (data.status === 'locked' && data.me) {
                            scope.point.locked = true;
                            scope.point.lockedByMe = true;
                        } else if (data.status === 'locked') {
                            scope.$emit('showNotification', {text: 'Задание заблокировано пользователем ' + data.byUser});
                        }
                    });
            } else {
                url = './unlocktask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER;
                http.get(url)
                    .success(function (data) {
                        if (data.status === 'unlocked') {
                            scope.point.locked = false;
                            scope.point.lockedByMe = false;
                        }
                    });
            }
        };

        // перекелючить (вкл/выкл) блокировку маршрута целиком
        scope.toggleRouteBlock = function () {
            var url = (scope.route.lockedByMe ? './unlockroute/' : './lockroute/') + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.route.filterId + '/',
                first = true;
            for (var i = 0; i < scope.route.points.length; i++) {
                if (scope.route.points[i].TASK_NUMBER != '') {
                    url += (!first ? ';' : '') + scope.route.points[i].TASK_NUMBER;
                    first = false;
                }
            }

            if (!scope.route.lockedByMe) {
                http.get(url)
                    .success(function (data) {
                        //console.log(data);
                        if (data.status == 'ok') {
                            scope.$emit('unlockAllRoutes', {filterId: scope.route.filterId});
                            scope.route.lockedByMe = true;
                            scope.route.locked = true;
                            for (var i = 0; i < scope.route.points.length; i++) {
                                if (!scope.route.points[i].TASK_NUMBER) continue;

                                scope.route.points[i].locked = true;
                                scope.route.points[i].lockedByMe = true;
                                scope.route.points[i].lockedRoute = true;
                            }
                        }
                    });
            } else {
                http.get(url)
                    .success(function (data) {
                        console.log(data);
                        delete scope.route.lockedByMe;
                        delete scope.route.locked;
                        for (var i = 0; i < scope.route.points.length; i++) {
                            if (!scope.route.points[i].TASK_NUMBER) continue;

                            delete scope.route.points[i].locked;
                            delete scope.route.points[i].lockedByMe;
                            delete scope.route.points[i].lockedRoute;
                        }
                    });
            }
        };

        // проверка на неопределенность статуса задачи
        scope.unconfirmed = function () {
            return scope.point && !scope.point.confirmed && (scope.point.status == STATUS.FINISHED ||
                scope.point.status == STATUS.FINISHED_LATE || scope.point.status == STATUS.FINISHED_TOO_EARLY);
        };

        // проверка на блокировку статуса задачи
        scope.locked = function (point) {
            return scope.point && scope.point.TASK_NUMBER
                && (!scope.point.locked || scope.point.lockedByMe)
                && (!scope.route.locked || scope.route.lockedByMe);
        };

        // изменить обещанные окна
        scope.changePromisedWindow = function (point) {
            var start = $('#promised-start-card').val().split(':'),
                finish = $('#promised-finish-card').val().split(':'),
                oldStart = new Date(point.promised_window_changed.start * 1000),
                clearOldDate = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate()).getTime();

            point.promised_window_changed = {
                start: clearOldDate / 1000 + start[0] * 3600 + start[1] * 60,
                finish: clearOldDate / 1000 + finish[0] * 3600 + finish[1] * 60
            };

            // в зависимости от того, откуда открыто окно данные меняются в исходных данных или
            // же только в изменяемой копии редактируемого маршрута
            if (parent === 'editRoute') {
                console.log('checkPoint');
                scope.$emit('checkPoint', point);
            } else {
                console.log('updateRawPromised');
                scope.$emit('updateRawPromised', {point: point});
            }
        };

        // открывает окно в 1С IDS-овцев
        scope.open1CWindow = function () {
            console.log('open1CWindow');
            http.get('./openidspointwindow/' + scope.point.waypoint.ID)
                .success(function (data) {
                    console.log(data);
                });
        };

    }]);