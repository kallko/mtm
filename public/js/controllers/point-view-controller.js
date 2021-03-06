// контроллер для отображения окна точки
angular.module('MTMonitor').controller('PointViewController', ['$scope', '$rootScope', '$http', 'Statuses', '$filter',
    function (scope, rootScope, http, Statuses, filter) {
        var STATUS,
            parent; // откуда было открыто окно
        scope.showRouteId;
        scope.onlyDriversNotes = [];

        //console.log("Start poinview");
        init();

        //todo from example
        //DESCRIPTION FOR_DRIVER FOR_OPERATOR ID IS_FOLDER USE_FOR_FAILURE USE_FOR_SUCCESS

        scope.selectReasons = [];
        scope.dropdownReasons = [ {id: 0, label: "никого нет дома",  ID : "2", USE_FOR_FAILURE: "true", use: "true" },
                                {id: 8, label: "нет денег",  ID : "2",  USE_FOR_FAILURE: "true", use: "true"},
                                {id: 3, label: "не пришел",  ID : "2", USE_FOR_FAILURE: "true", use: "true" },
                                {id: 4, label: "не подошел",  ID : "2", USE_FOR_FAILURE: "false" , use: "true"},
                                {id: 5, label: "просто ",  ID : "2", USE_FOR_FAILURE: "false" , use: "true"}
                            ];
        scope.dropdownSettings = {
            smartButtonMaxItems: 3,
            enableSearch: true,
            selectionLimit: 3,
            externalIdProp: '',
            groupByTextProvider: function(USE_FOR_FAILURE) { if (USE_FOR_FAILURE === 'true') { return 'Не доставлено'; } else { return 'Доставлено'; }
            }
        };
        scope.buttonText = {buttonDefaultText: 'Добавьте замечания'};

        // начальная инициализация контроллера
        function init() {
            $('#point-view').popup({
                    transition: 'all 0.15s',
                    onclose: function () {
                        if (scope.point.lockedByMe && !scope.route.locked)  scope.toggleTaskBlock();
                    }
                }
            );
            scope.showHideReasonButtons = true;


            initStatuses();

            rootScope.$on('showPoint', show);
            //rootScope.$on('newTextStatus', newTextStatus);
            rootScope.$on('companyName', function (event, data) {
                scope.companyName = data;
                console.log(data);
            });
            //rootScope.$on('lockRoute', lockRoute);
            //rootScope.$on('unlockRoute', unlockRoute);
        }

        scope.$watch('selectReasons', function(){
            //console.log ("First stage ",  scope.point.notes);

            if (scope.point && scope.point.status && scope.point.status != 8){
               var isCancelReasonAdded = scope.point.notes.some(function(item){
                   return item.USE_FOR_FAILURE == 'true'
               });

                if (isCancelReasonAdded) scope.showHideReasonButtons = true;
            }

            if (scope.point && scope.point.status && scope.point.status == 8) scope.showHideReasonButtons = false;

            if (scope.point) {
                scope.point.notes = scope.selectReasons;
                //console.log(scope.point.notes);
            };

            //console.log ("Second stage ",  scope.point.notes);
        });


        // показать окно с точкой
        function show(event, data) {

            if (rootScope.data && rootScope.data.notes && !rootScope.data.notes.reorange) reorangeNotes();





            //console.log("dropdownReasons", scope.dropdownReasons);

            scope.selectReasons = [];

            scope.operator_time = null;
            scope.point = data.point;
            createDisplayCollectionDriverNotes (scope.point);

            if (scope.point && scope.point.status < 3) {
                scope.dropdownReasons = rootScope.data.notes.filter(function(item){
                    return (item.FOR_OPERATOR == 'true' && (item.USE_FOR_SUCCESS == 'true')) ;
                });
            } else {
                scope.dropdownReasons = rootScope.data.notes.filter(function(item){
                    return (item.FOR_OPERATOR == 'true' && (item.USE_FOR_FAILURE == 'true')) ;
                });
            };

            if(scope.point && scope.point.notes && scope.point.notes.length > 0 ) scope.selectReasons = scope.point.notes;
            if (scope.point.stop_arrival_time != undefined )scope.operator_time = scope.point.stop_arrival_time;
            if (scope.operator_time == null && scope.point.stop_arrival_time == undefined) scope.operator_time = scope.point.mobile_arrival_time;
            if (scope.operator_time == null) scope.operator_time = rootScope.nowTime;
                //console.log("Это ДАТА", data);
            scope.operator_time_show = new Date(scope.operator_time *1000);
            scope.promisedStartCard = new Date(data.point.promised_window_changed.start * 1000);
            scope.promisedFinishCard = new Date(data.point.promised_window_changed.finish * 1000);
           // scope.promisedStartCard = filter('date')(data.point.promised_window_changed.start * 1000, 'HH/mm');
           // scope.promisedFinishCard = filter('date')(data.point.promised_window_changed.finish * 1000, 'HH/mm');

            scope.route = data.route;
            var route;
            for(var i=0; i<rootScope.data.routes.length; i++){
                if(data.point.uniqueID == rootScope.data.routes[i].uniqueID ) route = rootScope.data.routes[i];
            }
            scope.$emit('routeToChange', {
                route: route,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });
            //console.log ("Назначили Роут", data.point.uniqueID);
            scope.showRouteId = data.point.uniqueID;
            parent = data.parent;
            $('#point-view').popup('show');
            scope.showHideReasonButtons = scope.point && !scope.point.confirmed_by_operator && !scope.point.reason;
            if(scope.point && !scope.point.confirmed){
                scope.selectReasonList = "";
            }
            scope.disableConfirmBtn = true;
        }

         //заблокировать маршрут
        function lockRoute(event, data) {
            scope.$emit('unlockAllRoutes', {filterId: data.route.filterId});
            scope.route = data.route;
            scope.point = data.point;
            scope.route.lockedByMe = false;
           // scope.toggleRouteBlock();
        }

        // разблокировать маршрут
        function unlockRoute(event, data) {
            scope.route = data.route;
            scope.point = data.point;
            scope.route.lockedByMe = true;
           // scope.toggleRouteBlock();
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



        // загрузить список причин отмены заявки
        scope.showReasonList = false;

       

        // подтверждение статуса (генерирует событие, которое принимается в PointIndexController
        // и подтверждает сомнительный статус
        scope.confirmStatus = function () {
            //console.log("Operator Show", parseInt(scope.operator_time_show.getTime()/1000));
            scope.showHideReasonButtons = false;
            console.log('confirmStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'confirm-status',
                time: parseInt(scope.operator_time_show.getTime()/1000)
            });

            var reRoute;
            for (var i=0; i< rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == scope.showRouteId){
                    reRoute = rootScope.data.routes[i];
                }
            }
            rootScope.$emit('displayCollectionToStatistic', reRoute.points);
            scope.$emit('routeToChange', {
                route: reRoute,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });
            scope.$emit('addPointHistory', scope.point, "confirmed from card");

        };

        // отмена сомнительного статуса
        scope.cancelStatus = function () {
            scope.showHideReasonButtons = false;
            console.log('cancelStatus');
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'not-delivered-status'
            });
            var reRoute;
            for (var i=0; i< rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == scope.showRouteId){
                    reRoute = rootScope.data.routes[i];
                }
            }
            rootScope.showProblem(reRoute);
            scope.$emit('routeToChange', {
                route: reRoute,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });

            scope.$emit('addPointHistory', scope.point, "status canceled from card");
        };

        scope.returnStatus = function(){
            scope.showHideReasonButtons = true;
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'return-scheduled'
            });
            var reRoute;
            for (var i=0; i< rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == scope.showRouteId){
                    reRoute = rootScope.data.routes[i];
                }
            }
            rootScope.showProblem(reRoute);
            scope.$emit('routeToChange', {
                route: reRoute,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });
            scope.$emit('addPointHistory', scope.point, "return sheduled from card");
        };

        // отменить задачу
        scope.cancelTask = function () {
            scope.showHideReasonButtons = false;
            console.log('cancelTask');
            scope.point.changeConfirmation=true;
            scope.point.reason = scope.selectReasonList;
            scope.$emit('changeConfirmation', {
                row: scope.point,
                option: 'cancel-point'
            });
            var reRoute;
            for (var i=0; i< rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == scope.showRouteId){
                    reRoute = rootScope.data.routes[i];
                }
            }
            rootScope.showProblem(reRoute);
            scope.$emit('routeToChange', {
                route: reRoute,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });

            scope.$emit('addPointHistory', scope.point, "cancel point from card");
            if (reRoute.DISTANCE == 0) return;
            rootScope.$emit('startRecalc');
            $('#point-view').popup('hide');
            scope.$emit('showNotification', {text: 'Утвердите пересчитанный маршрут во вкладке Редактирование', duration: 4000});



        };

        scope.recalling = function(){
            scope.point.recall = true;
        };

        scope.cancelPush = function () {

            console.log('cancelPush');
            scope.$emit('cancelPush',  scope.point); //В поинт индекс контроллер
            scope.$emit('addPointHistory', scope.point, "cancel push from card");
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
                    })
                    .error(function(err){
                        rootScope.errorNotification(url);
                    });
            } else {
                url = './unlocktask/' + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.point.TASK_NUMBER;
                http.get(url)
                    .success(function (data) {
                        if (data.status === 'unlocked') {
                            scope.point.locked = false;
                            scope.point.lockedByMe = false;
                        }
                    })
                    .error(function(err){
                        rootScope.errorNotification(url);
                    });
            }
        };

        // перекелючить (вкл/выкл) блокировку маршрута целиком
        scope.toggleRouteBlock = function () {
            var url = (scope.route.lockedByMe ? './unlockroute/' : './lockroute/') + scope.point.itineraryID.replace('/', 'SL') + '/' + scope.route.filterId + '/',
                first = true;
            for (var i = 0; i < scope.route.points.length; i++) {
                if (scope.route.points[i].TASK_NUMBER != '') {
                    url += (!first ? ';' : '') + scope.route.points[i].TASK_NUMBER.replace('/', 'SL');
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
                    })
                    .error(function(err){
                        rootScope.errorNotification(url);
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
                    })
                    .error(function(err){
                        rootScope.errorNotification(url);
                    });
            }
        };

        // проверка на неопределенность статуса задачи
        scope.unconfirmed = function () {
            //return scope.point && !scope.point.confirmed && (scope.point.status == STATUS.FINISHED ||
              //  scope.point.status == STATUS.FINISHED_LATE || scope.point.status == STATUS.FINISHED_TOO_EARLY);

            return scope.point && !scope.point.confirmed;
        };

        // проверка на блокировку статуса задачи
        scope.locked = function (point) {
            return scope.point && scope.point.TASK_NUMBER
               && (!scope.point.locked || scope.point.lockedByMe)
               && (!scope.route.locked || scope.route.lockedByMe);
        };

        // изменить обещанные окна
        scope.changePromisedWindow = function (data) {

            var point = data.point;
            parent = data.parent;
            point.promised_window_changed.start = parseInt( (scope.promisedStartCard)/1000, 10 );
            point.promised_window_changed.finish = parseInt( (scope.promisedFinishCard)/1000, 10 );

            console.log("Измененные данные", point.promised_window_changed.start , point.promised_window_changed.finish);
            // point.promised_window_changed = {
            //     start: clearOldDate / 1000 + start[0] * 3600 + start[1] * 60,
            //     finish: clearOldDate / 1000 + finish[0] * 3600 + finish[1] * 60
            // };

            // в зависимости от того, откуда открыто окно данные меняются в исходных данных или
            // же только в изменяемой копии редактируемого маршрута
            console.log("Родитель", parent);
            if (parent === 'editRoute') {
                console.log('checkPoint');
                scope.$emit('checkPoint', point);
            } else {
                console.log('updateRawPromised');
                scope.$emit('updateRawPromised', {point: point});
                scope.cancel();
            }
        };
        scope.changePromisedCard = function(){
            var date = new Date();
            var offset = date.getTimezoneOffset();
            var newPromisedStart = new Date(scope.promisedStartCard).getTime() /1000;
            var newPromisedFinish = new Date(scope.promisedFinishCard).getTime()/1000;
            
            if(newPromisedStart >= newPromisedFinish || (newPromisedStart == scope.point.promised_window_changed.start && newPromisedFinish == scope.point.promised_window_changed.finish ) ){
                scope.disableConfirmBtn = true;
            }else{
                scope.disableConfirmBtn = false;
            }


        };

        rootScope.$on('addLoginAndTimeStampToNotes', function(event, routes){
            addLoginAndTimeStampToNotes(routes);
        });


        function addLoginAndTimeStampToNotes(routes){
            if (!routes) return;
            routes.forEach(function(route){
                route.points.forEach(function(point){
                    if (point.notes) {
                        point.notes.forEach(function(note){
                            if (note.login == undefined){
                                note.login = rootScope.data.settings.user;
                                note.time = rootScope.nowTime;
                            }
                        })
                    }
                })
            })

        }


        function createDisplayCollectionDriverNotes(point){
            if (!point) return;

            point.mobileNotes = [];
            if (point.mobile_push && point.mobile_push.delivery_notes){
                var res ='';
                var temp = /,/gi;
                res = point.mobile_push.delivery_notes.replace(temp, '","');
                res = res.replace('{', '["');
                res = res.replace('}', '"]');
                var mobile_notes_id = JSON.parse(res);
                point.mobile_notes_string =[];

                mobile_notes_id.forEach(function(item){
                    rootScope.data.notes.forEach(function(note){
                        if (item == note.ID){
                            point.mobile_notes_string.push(note.label);
                        }

                    })
                })

            }


        }


        scope.reCreateReasonsList = function(item) {
            console.log("RecreateReasonList", item)
        };

        scope.addAttributeToPoint = function (id, point){

            console.log("Point", point, "id", id)
        };


        scope.deleteAttributeToPoint = function (id, point){
            alert("Try to delete attribute to point " + id);
            console.log("Point", point)
        };


        function reorangeNotes() {
          if (!rootScope.data.notes || rootScope.data.notes.length < 1) return;
            console.log("Start reorange notes");

            rootScope.data.notes.forEach(function(item){
                item.label = item.DESCRIPTION;
                //item.lable = "Hej";
                item.id = parseInt(item.ID);
            });
            //scope.dropdownReasons = rootScope.data.notes;
            scope.onlyDriversNotes = rootScope.data.notes.filter(function(item){
                return item.FOR_DRIVER == 'true';
            });

            rootScope.data.notes.reorange = true;

            console.log("scope.onlyDriversNotes", scope.onlyDriversNotes);
            //console.log("scope.dropdownReasons", scope.dropdownReasons);



        };


        // открывает окно в 1С IDS-овцев
        rootScope.open1CWindow = function () {
            console.log('Point View open1CWindow');
            http.get('./openidspointwindow/' + scope.point.waypoint.ID + rootScope.settings.guid)
            //http.get('./openidspointwindow/' + 12)
                .success(function (data) {
                    console.log(data);
                })
                .error(function(err){
                    rootScope.errorNotification('./openidspointwindow/' + scope.point.waypoint.ID);
                });
        };
        scope.cancel = function () {
            $('#point-view').popup('hide');
        };
    }]);