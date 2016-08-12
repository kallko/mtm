// контроллер для редактирование маршрутов
angular.module('MTMonitor').controller('EditRouteController', ['$scope', '$rootScope', 'Statuses', '$timeout', '$http',
    '$filter', 'TimeConverter',
    function (scope, rootScope, Statuses, timeout, http, filter, TimeConverter) {
        var minWidth = 20,                      // минимальная ширина блока
            widthDivider = 15,                  // на сколько делить время блока, чтобы получить ширину в пикселях
            movedJ,                             // передвигаемый элемент
            toHideJ,                            // скрываемый элемент
            editPanelJ,                         // холдер панельки редактирования
            maxWidth,                           // максимальная ширина блока
            hidePlaceholder = false,            // отображается ли плейсхолдер
            routerData,                         // матрицы расстояний и времен проезда по рекдатируемому маршруту
            serverTime,                         // серверное время
            firstInit,                          // флаг первой инициализации
            workingWindow,                      // рабочее окно
            STATUS = Statuses.getStatuses(),
            textStatuses = Statuses.getTextStatuses(),// статусы
            baseRoute;                          // базовый неизмененный маршрут

        scope.iteration;                         // Количество попыток пересчетов
        scope.newStart;
        scope.newFinish;

        scope.newRoutes = 0;                        // todo Временно показывает количество предлагаемых маршрутов

        scope.BOX_TYPE = {                      // типы блоков
            TRAVEL: 0,
            DOWNTIME: 1,
            TASK: 2
        };
        scope.recalc_modes = [                  // типы пересчетов
            {name: 'без окон', value: 0},
            {name: 'по заданным окнам', value: 1},
            {name: 'по увеличенному заданному окну', value: 2}
        ];
        scope.recalc_mode = scope.recalc_modes[0].value;
        scope.STATUS = STATUS;
        scope.accept = false;

        init();

        // базовая инициализация
        function init() {

           // editPanelJ = $('#edit-panel');

            rootScope.$on('routeToChange', onRouteToChange);
            rootScope.$on('checkPoint', onPromisedChanged);
           // myLayout.on('stateChanged', onResize);
        }

        // пересчет ширины боксов при изменении размеров панельки
        //function onResize(e) {
        //    maxWidth = editPanelJ.width() - 30;
        //
        //    if (!scope.originalBoxes) return;
        //
        //    resetBlocksWidth(scope.originalBoxes);
        //    resetBlocksWidth(scope.changebleBoxes);
        //    scope.$apply();
        //}

        // обработчик события изменения обещанного окна
        function onPromisedChanged(event, point) {
            console.log('point >>>', point);

            point.old_promised = {
                start: point.promised_window.start,
                finish: point.promised_window.finish
            };

            point.promised_window.start = point.promised_window_changed.start;
            point.promised_window.finish = point.promised_window_changed.finish;

            if (workingWindow === 1) {
                point.working_window = point.promised_window;
                recalculateRoute();
            }

            point.promisedWasChanged = true;
        }

        // пересчитать ширину блоков
        //function resetBlocksWidth(boxes) {
        //    var widthRes;
        //    for (var i = 0; i < boxes.length; i++) {
        //        widthRes = scope.boxWidth(boxes[i].size, boxes[i].type);
        //        boxes[i].width = widthRes.width;
        //        boxes[i].tooBig = widthRes.tooBig;
        //    }
        //}

        // загружен новый маршрут
        function onRouteToChange(event, data) {
            scope.display = [];
            scope.selectedDriver= false;
            scope.selectedTransport = false;
            scope.selectedStart= false;
            scope.accept = false;
            scope.iteration = 0;
            console.log("I recieve DATA", data);
            scope.allDrivers=data.allDrivers;
            scope.allTransports=data.allTransports;
            scope.id = data.route.filterId;
            for (var i=0; i<rootScope.data.routes.length; i++){
                if(rootScope.data.routes[i].filterId == scope.id ) scope.parent_route = rootScope.data.routes[i];
            }

            console.log(data.route);
            if( data.route.DISTANCE == 0) {
                scope.disableRecalculate = scope.disableSaveRoutes = true;
            }else{
                scope.disableRecalculate = scope.disableSaveRoutes = false;
            }
            var routeCopy = JSON.parse(JSON.stringify(scope.parent_route)); // копируем без ссылок маршрут
            baseRoute = data.route;
            serverTime = data.serverTime;
            firstInit = true;
            routerData = undefined;
            workingWindow = data.workingWindow;

            // если включен демо режим, определяем положение машины по ближайшему к серверному времени стейту
            if (data.demoMode) {
                routeCopy.car_position = undefined;
                for (var i = 0; i < routeCopy.real_track.length; i++) {
                    if (routeCopy.real_track[i].t1 < serverTime &&
                        routeCopy.real_track[i].t2 > serverTime) {
                        routeCopy.car_position = routeCopy.real_track[i];
                        break;
                    }
                }

                routeCopy.car_position = routeCopy.car_position ? routeCopy.car_position :
                    routeCopy.real_track[routeCopy.real_track.length - 1];
            }

            scope.route = routeCopy;
            if (scope.route.car_position == undefined) createCarPosition();

            scope.changedRoute = JSON.parse(JSON.stringify(routeCopy));



            moveSkippedToEnd(scope.changedRoute);
            markWarehouses(scope.changedRoute);
            markWarehouses(scope.route);
            // из изменяемого маршрута убираем выполненные точки
            for (var i = 0; i < scope.changedRoute.points.length; i++) {
                if (scope.changedRoute.points[i].status == scope.STATUS.FINISHED ||
                    scope.changedRoute.points[i].status == scope.STATUS.FINISHED_LATE ||
                    scope.changedRoute.points[i].status == scope.STATUS.FINISHED_TOO_EARLY) {
                    scope.changedRoute.points.splice(i, 1);
                    scope.changedRoute.lastPointIndx--;
                    i--;
                } else {
                    scope.changedRoute.points[i].base_index = i;
                }
            }

            if (scope.changedRoute.points.length > 1) {
                // если в маршруте остались невыполненные точки, блокируем его
                //scope.$emit('lockRoute', {
                //    route: data.route,
                //    point: data.route.points[0]
                //});

                //todo plесь отключили автоматический пересчет
                //loadRouterData(scope.changedRoute.points, recalculateRoute);
            } else {
                // в противном случае, показываем попап и выгружаем маршрут из панели редактирования
                //scope.$emit('showNotification', {
                //    text: scope.changedRoute.points.length == 0 ?
                //        'Маршрут полностью выполнен.' : 'В маршруте осталось одно задание.'
                //});
                //scope.route = undefined;
                //scope.changedRoute = undefined;
            }
        }

        // пересчитать маршрут (клиентская валидация маршрута)
        function recalculateRoute() {



            // копируем без ссылок маршрут
            // загружаем данные с роутера, если не сделали этого раньше
            if (!routerData) {
                loadRouterData(scope.changedRoute.points, recalculateRoute);
                return;
            }
            console.log("changedRoute",  scope.changedRoute);
            if(scope.changedRoute.car_position == undefined || scope.changedRoute.car_position.lat == undefined || scope.changedRoute.car_position.lon ) createNewCarPosition(scope.changedRoute);
            //var last = scope.changedRoute.lastPointIndx + 1 >= scope.changedRoute.points.length ?
            //    scope.changedRoute.points.length - 1 : scope.changedRoute.lastPointIndx + 1;

            //console.log("last point", last);
            var url = './findtime2p/'
                    + scope.changedRoute.car_position.lat + '&'
                    + scope.changedRoute.car_position.lon + '&'
                    + scope.changedRoute.points[0].LAT + '&'
                    + scope.changedRoute.points[0].LON;

            // получаем расстояние от текущего положения машины и до следующей в плане точки
            http.get(url)
                .success(function (data) {
                    // пересчитываем
                    var fromPoint,
                        toPoint,
                        cTime;

                    cTime = applyTravelTimeToPoint(scope.changedRoute.points[0],
                        parseInt(data.time_table[0][0][1] / 10), serverTime);

                    for (var i = 1; i < scope.changedRoute.points.length; i++) {
                        fromPoint = scope.changedRoute.points[i - 1];
                        toPoint = scope.changedRoute.points[i];
                        cTime = applyTravelTimeToPoint(toPoint,
                            routerData.timeTable[fromPoint.base_index][toPoint.base_index] / 10, cTime);
                    }

                    // после пересчета обновляем данные о блоках
                    //todo рассчитать полученные данные и вывести в ХТМЛ
                   createDisplayCollection();
                })
                .error(function(data){
                    console.log("This is ERROR!");
                });
        }

        // применить времена проезда ко всем параметрам задач
        function applyTravelTimeToPoint(point, travelTime, cTime) {
            point.TRAVEL_TIME = travelTime;
            cTime += travelTime;
            point.DOWNTIME = getDowntime(cTime, point);
            cTime += point.DOWNTIME;
            point.arrival_time_ts = cTime;
            point.ARRIVAL_TIME = filter('date')(cTime * 1000, 'dd.MM.yyyy HH:mm:ss');
            point.arrival_time_hhmm = point.ARRIVAL_TIME.substr(11, 8);
            cTime += parseInt(point.TASK_TIME);
            point.end_time_ts = cTime;
            point.END_TIME = filter('date')(cTime * 1000, 'dd.MM.yyyy HH:mm:ss');
            point.end_time_hhmm = point.END_TIME.substr(11, 8);

            checkLate(point);

            return cTime;
        }

        // получить времена простоя
        function getDowntime(time, point) {
            if (!point || !point.working_window) return 0;

            if (point.working_window.start > time) {
                return point.working_window.start - time;
            }

            return 0;
        }

        // проверить, есть ли опаздание по точке
        function checkLate(point) {
            if (!point || !point.working_window) return;

            point.late = point.arrival_time_ts > point.working_window.finish;
        }

        // переместить пропущенные задачи в конец маршрута
        function moveSkippedToEnd(route) {
            console.log("Приступаем к обработке роута", route);
            var toMoveArr = [],
                lastTask;
            var lastindx = route.points.length - 1;
            console.log("Last indx = ", lastindx);

            //todo костыль на отсутсвие парковки
            route.warehouseEnd =false;
            if (route.points[lastindx].waypoint != undefined && undefined && route.points[lastindx].waypoint.TYPE == "WAREHOUSE") {
                route.warehouseEnd =true;
            }
            //route.warehouseEnd = (route.points[lastindx].waypoint != undfined && route.points[lastindx].waypoint.TYPE == "WAREHOUSE");
            if (route.warehouseEnd) lastTask = route.points.pop();


            //todo проверить что произойдет если убит нижний блок
            //for (var i = 0; i < route.points.length > i && i < route.lastPointIndx + 1 - toMoveArr.length; i++) {
            //    if (route.points[i].status != scope.STATUS.FINISHED &&
            //        route.points[i].status != scope.STATUS.FINISHED_LATE &&
            //        route.points[i].status != scope.STATUS.FINISHED_TOO_EARLY) {
            //        toMoveArr.push(route.points[i]);
            //        route.points.splice(i, 1);
            //        i--;
            //    }
            //}

            console.log ("Заданий на перенос", toMoveArr.length);
            route.lastPointIndx -= toMoveArr.length;
            for (var i = 0; i < toMoveArr.length; i++) {
                toMoveArr[i].TRAVEL_TIME = '0';
                toMoveArr[i].DOWNTIME = '0';
                route.points.push(toMoveArr[i]);
            }

            if (route.warehouseEnd) route.points.push(lastTask);
        }

        // пометить склады
        function markWarehouses(route) {
            for (var i = 0; i < route.points.length; i++) {
                route.points[i].warehouse = route.points[i].waypoint && route.points[i].waypoint.TYPE == "WAREHOUSE";
            }
        }

        // получить данные с роутера
        function loadRouterData(points, callback) {

            var pointsStr = '';
            for (var i = 0; i < points.length; i++) {
                if (points[i].LAT != null && points[i].LON != null) {
                    pointsStr += "&loc=" + points[i].LAT + "," + points[i].LON;
                }
            }

            http.get('./getroutermatrix/' + pointsStr)
                .success(function (data) {
                    routerData = {
                        lengthTable: data.length_table[0],
                        timeTable: data.time_table[0]
                    };
                    callback();
                });
        }

        // обновить индексы задач
        function updateIndices(points) {
            for (var i = 0; i < points.length; i++) {
                points[i].index = i;
            }
        }

        // обновить массив блоков
        //function updateBoxes(updateOriginal) {
        //    if (updateOriginal) {
        //        scope.originalBoxes = getBoxesFromRoute(scope.route);
        //        firstInit = false;
        //    }
        //
        //    updateIndices(scope.changedRoute.points);
        //    scope.changebleBoxes = getBoxesFromRoute(scope.changedRoute);
        //
        //    // назначение обработчиков на пересозданных блоках
        //    timeout(function () {
        //        $('.draggable-box').draggable({
        //            start: onDragStartTask,
        //            stop: onDragStopTask,
        //            helper: 'clone'
        //        });
        //
        //        $('.droppable-box').droppable({
        //            drop: onDropTask
        //            , over: function (event, ui) {
        //                $('.tmp-place').remove();
        //                hidePlaceholder = false;
        //                var dataIndex = $(this).data('index'),
        //                    placeHolder = $('<div class="box tmp-place" style="width: ' + movedJ.width() + 'px;" ' +
        //                        ' data-index="' + dataIndex + '" ></div>');
        //                $('#box-' + scope.BOX_TYPE.TASK + '-' + dataIndex).before(placeHolder);
        //                placeHolder.droppable({
        //                    drop: onDropTask
        //                });
        //            }
        //            , out: function (event, ui) {
        //                hidePlaceholder = true;
        //                timeout(function () {
        //                    if (hidePlaceholder) $('.tmp-place').remove();
        //                }, 100);
        //            }
        //        });
        //    }, 1);
        //}

        // обработчик события начало передвижения блока
        //function onDragStartTask(event, ui) {
        //    ui.helper.css('z-index', '999999');
        //    movedJ = ui.helper;
        //    toHideJ = $('#box-' + scope.BOX_TYPE.TASK + '-' + movedJ.data('index'));
        //    toHideJ.hide();
        //}

        // обработчик события завершения передвижения блока
        //function onDragStopTask(event, ui) {
        //    ui.helper.css('left', '0px').css('top', '0px').css('z-index', 'auto');
        //    $('.tmp-place').remove();
        //    toHideJ.show();
        //}

        // обработчик события бросания блока на другйо блок
        //function onDropTask(event, ui) {
        //    var moved = ui.helper.data('index'),
        //        target = $(this).data('index'),
        //        point = scope.changedRoute.points.splice(moved, 1)[0];
        //
        //    $('.tmp-place').remove();
        //    if (target == 55555) {
        //        scope.changedRoute.points.push(point);
        //    } else {
        //        target = target > moved ? target - 1 : target;
        //        scope.changedRoute.points.splice(target, 0, point);
        //    }
        //
        //    recalculateRoute();
        //}

        // сгенерировать блоки из маршрута
        //function getBoxesFromRoute(route) {
        //    var boxes = [],
        //        point,
        //        tmpTime,
        //        widthRes;
        //
        //    for (var i = 0; i < route.points.length; i++) {
        //        point = route.points[i];
        //
        //        // блок проезда
        //        if (point.TRAVEL_TIME != '0') {
        //            tmpTime = parseInt(point.TRAVEL_TIME);
        //            widthRes = scope.boxWidth(tmpTime, scope.BOX_TYPE.TRAVEL);
        //            boxes.push({
        //                type: scope.BOX_TYPE.TRAVEL,
        //                size: tmpTime,
        //                status: point.status,
        //                index: point.index,
        //                width: widthRes.width,
        //                tooBig: widthRes.tooBig
        //            });
        //        }
        //
        //        // блок простоя
        //        if (point.DOWNTIME != '0') {
        //            tmpTime = parseInt(point.DOWNTIME);
        //            widthRes = scope.boxWidth(tmpTime, scope.BOX_TYPE.DOWNTIME);
        //            boxes.push({
        //                type: scope.BOX_TYPE.DOWNTIME,
        //                size: tmpTime,
        //                status: point.status,
        //                index: point.index,
        //                width: widthRes.width,
        //                tooBig: widthRes.tooBig
        //            });
        //        }
        //
        //        // блок задачи
        //        if (point.TASK_TIME != '0') {
        //            tmpTime = parseInt(point.TASK_TIME);
        //            widthRes = scope.boxWidth(tmpTime, scope.BOX_TYPE.TASK);
        //            boxes.push({
        //                type: scope.BOX_TYPE.TASK,
        //                size: tmpTime,
        //                number: point.NUMBER,
        //                arrivalStr: point.arrival_time_hhmm,
        //                endTimeStr: point.end_time_hhmm,
        //                travelTime: point.TRAVEL_TIME,
        //                downtime: point.DOWNTIME,
        //                status: point.status,
        //                index: point.index,
        //                late: point.late,
        //                windows: point.AVAILABILITY_WINDOWS,
        //                promised: point.promised_window_changed,
        //                waypointNumber: point.END_WAYPOINT,
        //                width: widthRes.width,
        //                tooBig: widthRes.tooBig,
        //                warehouse: point.warehouse
        //            });
        //        }
        //    }
        //
        //    return boxes;
        //}
        //
        //// расчитать ширину блока
        //scope.boxWidth = function (size, type) {
        //    var mWidth = type == scope.BOX_TYPE.TASK ? minWidth : size / widthDivider,
        //        res = parseInt(size / widthDivider > minWidth ? size / widthDivider : mWidth);
        //
        //    if (res > maxWidth) {
        //        res = {width: maxWidth, tooBig: true};
        //    } else {
        //        res = {width: res, tooBig: false};
        //    }
        //
        //    return res;
        //};
        //
        //// создание всплывающей подсказки для блока
        //scope.tooltip = function (box) {
        //    var result = '';
        //
        //    switch (box.type) {
        //        case scope.BOX_TYPE.TASK:
        //            result += 'Задача #' + box.number + '\n';
        //            break;
        //        case scope.BOX_TYPE.TRAVEL:
        //            result += 'Переезд' + '\n';
        //            break;
        //        case scope.BOX_TYPE.DOWNTIME:
        //            result += 'Простой' + '\n';
        //            break;
        //    }
        //
        //    result += 'Продолжительность: ' + toMinutes(box.size) + ' мин.\n';
        //
        //    if (box.type == scope.BOX_TYPE.TASK) {
        //        result += 'Время прибытия: ' + box.arrivalStr + '\n';
        //        result += 'Время отъезда: ' + box.endTimeStr + '\n';
        //        result += 'Заказанное окно: ' + box.windows + '\n';
        //        result += 'Обещананое окно: ' +
        //            filter('date')(box.promised.start * 1000, 'HH:mm') +
        //            ' - ' +
        //            filter('date')(box.promised.finish * 1000, 'HH:mm') + '\n';
        //        result += 'Измененное окно: ' +
        //            filter('date')(box.promised.start * 1000, 'HH:mm') +
        //            ' - ' +
        //            filter('date')(box.promised.finish * 1000, 'HH:mm') + '\n';
        //        result += 'Переезд: ' + toMinutes(box.travelTime) + ' мин.\n';
        //        result += 'Простой: ' + toMinutes(box.downtime) + ' мин.\n';
        //    }
        //
        //    return result;
        //};

        function getTextStatuses  (status) {
            console.log("Looking for status", textStatuses.length);
            for (var i = 0; i < textStatuses.length; i++) {
                if (textStatuses[i].value === status) return textStatuses[i];
            }
        }

        function toMinutes(seconds) {
            return parseInt(seconds / 60);
        }

        // открытие окна задачи по даблклику на блоке
        //scope.boxDblClick = function (waypointNumber) {
        //    for (var i = 0; i < scope.changedRoute.points.length; i++) {
        //        if (scope.changedRoute.points[i].END_WAYPOINT == waypointNumber) {
        //            scope.$emit('showPoint', {
        //                point: scope.changedRoute.points[i],
        //                route: scope.route,
        //                parent: 'editRoute'
        //            });
        //            break;
        //        }
        //    }
        //};

        // приводит маршрут в необходимый формат и отправляетего на математический сервер для пересчета
        scope.recalculateRoute = function () {


            scope.display = [];
            var route;
            for (var i=0; i<rootScope.data.routes.length; i++){
                if(rootScope.data.routes[i].filterId == scope.id ) {
                    route = JSON.parse(JSON.stringify(rootScope.data.routes[i]));
                    break;
                }
            }

            if(route.car_position == undefined || route.car_position.lat == undefined || route.car_position.lon ) createNewCarPosition(route);
            rootScope.data.routes[i].car_position = route.car_position;

            if (route != undefined) {

                route.recalcIter = scope.iteration || 0;
                route.recalcIter++;
                alert(route.recalcIter);
                scope.iteration ++;

                console.log('route to rebuild', route);

                var mathInput = {
                        "margin_of_safety": 1,
                        "garbage": false,
                        "one_car_recalc": true,
                        "etaps": 1,
                        "parent_id": "",
                        "points": [],
                        "cargo_list": [],
                        "trList": [],
                        "jobList": [],
                        "depotList": [],
                        "inn_list": []
                    },
                    point,
                    pt,
                    job,
                    timeWindow,
                    delay,
                    late;

                for (var i = 0; i < route.points.length; i++) {
                    // если первая задача в маршруте является складом, добавляем его в список складов
                    if (mathInput.depotList.length == 0 && route.points[i].waypoint.TYPE == 'WAREHOUSE') {
                        timeWindow = TimeConverter.getTstampAvailabilityWindow(route.points[i].waypoint.AVAILABILITY_WINDOWS,
                            serverTime);
                        mathInput.depotList.push({
                            "id": "1",
                            "point": "-2",
                            "window": {
                                "start": timeWindow[0].start,  //END_TIME: "30.10.2015 19:50:02"
                                "finish": timeWindow[0].finish  //START_TIME: "30.10.2015 06:30:00"
                            }
                        });
                        break;
                    }
                }

                //Если склад не обнаружен, назначем его - последней подтвержденной точкой на маршруте
                if(mathInput.depotList.length == 0) {
                    findAlternativeDepot(route, mathInput);
                }

                var trWindow = TimeConverter.getTstampAvailabilityWindow('03:00 - ' +
                        route.transport.END_OF_WORK.substr(0, 5), serverTime),          // широкое окно доступности
                    jobWindows,
                    timeStep = 600;                                                     // шаг расширения окон

                console.log("Какое то trWindow",trWindow, "and route is", route);

                for (i = 0; i < route.points.length; i++) {

                    // добавляет в список задач все невыполненные задачи
                    if ((route.points[i].status > 3 && route.points[i].status != 8) ) {
                        console.log("Budem brat?", route.points[i].status);
                        pt = route.points[i];
                       // console.log("Dobavlzem tohku v peresschet", pt);
                        point = {
                            "lat": parseFloat(pt.LAT),
                            "lon": parseFloat(pt.LON),
                            "ID": pt.waypoint.gIndex + '', //pt.waypoint.ID,
                            "servicetime": 0, //parseInt(pt.waypoint.QUEUING_TIME),
                            "add_servicetime": 0, // parseInt(pt.waypoint.EXTRA_DURATION_FOR_NEW_DRIVER),
                            "max_height_transport": 0,
                            "max_length_transport": 0,
                            "only_pallets": false,
                            "ramp": false,
                            "need_refrigerator": false,
                            "temperature_control": false,
                            "ignore_cargo_incompatibility": false,
                            "ignore_pallet_incompatibility": false,
                            "region": "-1"
                        };

                        mathInput.points.push(point);

                        late = route.points[i].status == 4;
                        delay = route.points[i].status == 5;

                        jobWindows = [];
                        jobWindows = [
                            {
                                "start": pt.working_window.start,
                                "finish": pt.working_window.finish
                            }];


                        if (late){

                        jobWindows = [
                            {
                                "start": rootScope.nowTime,
                                "finish": rootScope.nowTime+60*60
                            }];
                            console.log("Расширяем окно для точки время вышло", pt, jobWindows[0].start, jobWindows[0].finish);
                        }

                        if(late && route.recalcIter>2) {
                            jobWindows = [
                                {
                                    "start": rootScope.nowTime,
                                    "finish": route.points[route.points.length-1].arrival_time_ts+60*30
                                }];
                            console.log("Расширяем окно для точки в последний раз", pt, jobWindows[0].start, jobWindows[0].finish);
                        }


                        if(late && route.recalcIter>3) {
                            var endDay = new Date();
                            endDay.setHours(24,0,0,0);
                            var tsEndDay=endDay.valueOf();

                            jobWindows = [
                                {
                                    "start": rootScope.nowTime,
                                    "finish": tsEndDay/1000
                                }];
                            console.log("Свободное окно для время вышло", pt, rootScope.nowTime, tsEndDay/1000);
                        }

                        if (delay && route.recalcIter>1) {

                            jobWindows = [
                                {
                                    "start": pt.working_window.start,
                                    "finish": pt.working_window.finish+30*60
                                }];
                            console.log("Расширяем окно для точки опаздывает", pt, jobWindows[0].start, jobWindows[0].finish);
                        }



                        if(route.recalcIter>4){
                            var endDay = new Date();
                            endDay.setHours(24,0,0,0);
                            var tsEndDay=endDay.valueOf();

                            jobWindows = [
                                {
                                    "start": rootScope.nowTime,
                                    "finish": tsEndDay/1000
                                }];
                            console.log("Свободное окно для время вышло", pt, rootScope.nowTime, tsEndDay/1000);

                        }
                        // выбор типа пересчета
                        //todo переделать когда будут варианты
                        //switch (scope.recalc_mode) {
                        //    case scope.recalc_modes[0].value:   // пересчет по большим окнам
                        //        jobWindows = [
                        //            {
                        //                "start": late ? serverTime : pt.promised_window_changed.start,
                        //                "finish": late ? trWindow[0].finish : pt.promised_window_changed.finish
                        //            }
                        //        ];
                        //        break;
                        //    case scope.recalc_modes[1].value:   // пересчет по заданным окнам
                        //        jobWindows = [
                        //            {
                        //                "start": pt.promised_window_changed.start,
                        //                "finish": pt.promised_window_changed.finish
                        //            }
                        //        ];
                        //        break;
                        //    case scope.recalc_modes[2].value:   // пересчет при рекрусивном увелечении окон
                        //        jobWindows = [
                        //            {
                        //                "start": pt.promised_window_changed.start - timeStep,
                        //                "finish": pt.promised_window_changed.finish + timeStep
                        //            }
                        //        ];
                        //        pt.promised_window_changed = jobWindows[0];
                        //        break;
                        //}

                        job = {
                            "id": i.toString(),
                            "weigth": parseInt(pt.WEIGHT),
                            "volume": parseInt(pt.VOLUME),
                            "value": parseInt(pt.VALUE),
                            "servicetime": parseInt(pt.TASK_TIME),
                            "cargo_type": "-1",
                            "vehicle_required": "",
                            "penalty": 0,
                            "rest": false,
                            "backhaul": false,
                            "point": pt.waypoint.gIndex + '',
                            "windows": jobWindows
                        };
                        mathInput.jobList.push(job);
                    }
                }

                if(route.car_position == undefined || route.car_position.lat == undefined || route.car_position.lon ) createNewCarPosition(route);

                point = {
                    "lat": parseFloat(route.car_position.lat),
                    "lon": parseFloat(route.car_position.lon),
                    "ID": "-2",
                    "servicetime": 0,
                    "add_servicetime": 0,
                    "max_height_transport": 0,
                    "max_length_transport": 0,
                    "only_pallets": false,
                    "ramp": false,
                    "need_refrigerator": false,
                    "temperature_control": false,
                    "ignore_cargo_incompatibility": false,
                    "ignore_pallet_incompatibility": false,
                    "region": "-1"
                };

                mathInput.points.push(point);

                // если маршрут заканчивается складом, то мы отправляем его как точку гаража
                if (route.warehouseEnd) {
                    point = {
                        "lat": parseFloat(route.points[route.points.length - 1].LAT),
                        "lon": parseFloat(route.points[route.points.length - 1].LON),
                        "ID": "-3",
                        "servicetime": 0,
                        "add_servicetime": 0,
                        "max_height_transport": 0,
                        "max_length_transport": 0,
                        "only_pallets": false,
                        "ramp": false,
                        "need_refrigerator": false,
                        "temperature_control": false,
                        "ignore_cargo_incompatibility": false,
                        "ignore_pallet_incompatibility": false,
                        "region": "-1"
                    };

                    mathInput.points.push(point);
                }

                // добавляем транспорт
                console.log("Выбор веса", (parseInt(route.transport.MAXIMUM_WEIGHT) > route.weight+1), parseInt(route.transport.MAXIMUM_WEIGHT , route.weight+1));

                mathInput.trList.push({
                    "id": "-1",
                    "cost_per_hour": parseInt(route.transport.COST_PER_HOUR),
                    "cost_per_km": parseInt(route.transport.COST_PER_KILOMETER),
                    "cost_onTime": parseInt(route.transport.COST_ONE_TIME),
                    "maxweigth": (parseInt(route.transport.MAXIMUM_WEIGHT) > route.weight+1) ? parseInt(route.transport.MAXIMUM_WEIGHT) : route.weight+1,
                    "maxvolume": parseInt(route.transport.MAXIMUM_VOLUME),
                    "maxvalue": parseInt(route.transport.MAXIMUM_VALUE),
                    "multi_use": true,
                    "amount_use": 1,
                    "proto": false,
                    "cycled": false,
                    "time_load": 0,
                    "time_min": 0,
                    "window": {
                        "start": serverTime,
                        "finish": trWindow[0].finish
                    },
                    "weigth_nominal": 0,
                    "time_max": 0,
                    "start_point": "-1",
                    "finish_point": route.warehouseEnd ? "-3" : "-1",
                    "points_limit": 0,
                    "road_speed": 1,
                    "point_speed": 1,
                    "add_servicetime": 0, // parseInt(route.transport.TIME_OF_DISEMBARK),
                    "number_of_pallets": 0,
                    "refrigerator": false,
                    "temperature_control": false,
                    "low_temperature": 0,
                    "high_temperature": 0,
                    "time_preserving": 0,
                    "height": 0,
                    "length": 0,
                    "can_with_ramp": true,
                    "can_without_ramp": true,
                    "use_inn": false,
                    "min_rest_time": 0,
                    "region": "-1",
                    "donor": false,
                    "recipient": false,
                    "points_acquaintances": [],
                    "tr_constraints": [],
                    "tr_permits": []
                });

                console.log("Big MATH INPUT",mathInput);
                scope.mathInputJson = mathInput;
                // оптравляем на пересчет
                http.post('./recalculate/', {input: mathInput}).
                    success(function (data) {
                    console.log("Recalculate receive DATA",data);
                        processModifiedPoints(route, data);
                    })
                .error(function(data){
                    console.log("ERROR, data");
                });
            }
        };




        // обработывает ответ от математического сервера
        function processModifiedPoints(changedRoute, data) {
            console.log('Recalculate READY >>', data);

            if(data.solutions[0] != undefined && data.solutions[0].routes != undefined && data.solutions[0].routes.length != undefined){
                scope.newRoutes = data.solutions[0].routes.length
            }

            scope.newRoutes = data.solutions[0].routes.length || 'Error';

            // в случае если вернуло ошибку, решений ноль или в результате вернуло несколько маршрутов,
            // показываем сообщение об ошибке
            if (data.status == 'error' || data.solutions.length == 0 || data.solutions[0].routes.length != 1) {
                console.log('Bad data');
                scope.$emit('showNotification', {text: 'Автоматический пересчет не удался.'});
                return;
            }

            console.log('MATH DATE >> ', new Date(serverTime * 1000));

            var newSolution = data.solutions[0].routes[0].deliveries,
                updatedPoints = [],
                point,
                tmp;

            //todo собрать решение из полученного.


            // обновляем изменяемую копию маршрута
            for (var i = 0; i < newSolution.length; i++) {
                tmp = newSolution[i].pointId;
                if (newSolution[i].pointId == -3) {
                    point = changedRoute.points[changedRoute.points.length - 1];
                    point.ARRIVAL_TIME = filter('date')((newSolution[i].arrival * 1000), 'dd.MM.yyyy HH:mm:ss');
                    updatedPoints.push(point);
                    break;
                }

                for (var j = 0; j < changedRoute.points.length; j++) {
                    if (newSolution[i].pointId == changedRoute.points[j].waypoint.gIndex) {
                        point = changedRoute.points[j];
                        point.ARRIVAL_TIME = filter('date')((newSolution[i].arrival * 1000), 'dd.MM.yyyy HH:mm:ss');

                        point.new_arrival_time = newSolution[i].arrival;
                        console.log("New arrival.time", point.new_arrival_time);
                        updatedPoints.push(point);
                    }
                }

                for (var j = 0; j < scope.changedRoute.points.length; j++) {
                    if (newSolution[i].pointId == scope.changedRoute.points[j].waypoint.gIndex) {
                        point = scope.changedRoute.points[j];
                       // point.ARRIVAL_TIME = filter('date')((newSolution[i].arrival * 1000), 'dd.MM.yyyy HH:mm:ss');

                        point.new_arrival_time = newSolution[i].arrival;
                        //console.log("New arrival.time", point.new_arrival_time);
                        //updatedPoints.push(point);
                    }
                }
            }

            changedRoute.points = updatedPoints;
            // проводим клиентскую валидацию измененного маршрута
            recalculateRoute();
        }

        // сохранить измененный маршрут в основной массив данных
        scope.saveRoutes = function () {
            scope.$emit('saveRoutes', {route: scope.changedRoute, timestamp: parseInt(Date.now() / 1000)});
            scope.route = undefined;
            scope.changedRoute = undefined;
        };

        // отменить редактирование и выгрузить маршрут
        scope.cancelEdit = function () {
            scope.$emit('unlockRoute', {
                route: baseRoute,
                point: baseRoute.points[0]
            });

            scope.route = undefined;
            scope.changedRoute = undefined;
        };

        rootScope.$on('clearmap', function(){
            scope.route = undefined;
            scope.changedRoute = undefined;
        });

    scope.changeDriver = function() {
        //console.log(scope.selectedDriver, scope.selectedTransport, scope.selectedStart);
        rootScope.$emit('changeDriver', scope.selectedDriver, scope.selectedTransport, scope.selectedStart, scope.route.uniqueID); //эмитируем в поинтиндекс контроллер, чтобы там сделать все изменения в данных
        scope.selectedStart=false;
    };


    rootScope.$on('checkInCloseDay', function () {

        if (scope.route == undefined) return;

        var route=scope.route;
        //showProblem(scope.route);
        scope.iteration = 0;

        if (route.have_attention == undefined || route.have_attention == true) route.have_attention =false;
        for (var i = 0; i<route.points.length; i++){
            if (route.points[i].status == 6) route.have_attention = true;
        }

    });


        function  findAlternativeDepot(route, mathInput) {
            console.log("Нет нормального склада, будем искать");
            var warehouse = route.points[0];
            var realTime = route.points[0].real_arrival_time == undefined ? 0 : route.points[0].real_arrival_time;
            for (var i=0; i<route.points.length; i++){
                if (route.points[i] != undefined && route.points[i].real_arrival_time > realTime){
                    warehouse = route.points[i];
                    realTime = route.points[i].real_arrival_time;
                }
            }

            console.log("Будем считать складом", warehouse);
            mathInput.depotList.push({
                "id": "1",
                "point": "-2",
                "window": {
                    "start": rootScope.nowTime-10*60,  //END_TIME: "30.10.2015 19:50:02"
                    "finish": rootScope.nowTime+24*60*60  //START_TIME: "30.10.2015 06:30:00"
                }
            })

        }

        function createCarPosition() {
            if (scope.route.real_track != undefined && scope.route.real_track.length>0){
                scope.route.car_position ={};
                scope.route.car_position.lat = scope.route.real_track[scope.route.real_track.length -1].lat;
                scope.route.car_position.lon = scope.route.real_track[scope.route.real_track.length -1].lon;
                return;
            }
        }


        function createDisplayCollection(){
            scope.display = [];
            for (var  i= 0; i< scope.route.points.length; i++){
                if (scope.route.points[i].status <4 || scope.route.points[i].status == 8) {
                    console.log("Точка доставлена или отменена");
                    continue;

                }
                //console.log("точка не отменена и должна быть в измененном маршруте");

                for (var j=0; j< scope.changedRoute.points.length; j++){
                    if (scope.route.points[i].row_id == scope.changedRoute.points[j].row_id ) {
                       //console.log("Соответствие найдено");
                        console.log("Создаем и проверяем точку точку", scope.route.points[i]);
                        scope.display.push({
                            exNumber: scope.route.points[i].NUMBER,
                            status: getTextStatuses(scope.route.points[i].status).name,
                            changes: scope.change_time || 0,
                            startKOK:scope.route.points[i].working_window.start,
                            endKOK: scope.route.points[i].working_window.finish,
                            startZOK : scope.route.points[i].windows[0].start,
                            endZOK : scope.route.points[i].windows[0].finish,
                            exArrival: scope.route.points[i].arrival_time_ts,
                            newArrival: scope.changedRoute.points[j].new_arrival_time,
                            editWindow: false,
                            newPromisedFinishCard:0,
                            newPromisedStartCard:0,
                            gIndex: scope.route.points[i].waypoint.gIndex
                        })
                    }

                }
            }

            function compareArrivalTime (a, b){
                return a.newArrival - b.newArrival;
            }

            scope.display.sort(compareArrivalTime);



        }

        scope.handRecalc = function (item, t1, t2, route){
            var result = new Date;
            result.setHours(0, 0, 0, 0);
            var newStart = new Date(t1).getTime() /1000;
            var newFinish = new Date(t2).getTime()/1000;
            //todo разобратьсз с летним временем
            result.setHours(0,0,newStart+2*60*60,0);
            var tsStart = (result.valueOf()/1000);
            result.setHours(0, 0, 0, 0);
            result.setHours(0,0,newFinish+2*60*60,0);
            var tsFinish = (result.valueOf()/1000);
            //console.log("NEW WINDOW timeStamp", tsFinish, tsStart, rootScope.nowTime);
            console.log("Identificator tohki", item.gIndex, scope.mathInputJson.jobList[0].point);
            //Поиск в mathinpute данной точки и замена ей временного окна.

            for (var i=0; i<scope.mathInputJson.jobList.length; i++){
                if(item.gIndex == parseInt( scope.mathInputJson.jobList[i].point)) {
                    console.log("Соответсвующая точка найдкена",scope.mathInputJson.jobList[i] );
                    scope.mathInputJson.jobList[i].windows[0].start = tsStart;
                    scope.mathInputJson.jobList[i].windows[0].finish = tsFinish;
                }

            }

            console.log("NEW Big MATH INPUT",scope.mathInputJson);

            // оптравляем на пересчет
            http.post('./recalculate/', {input: scope.mathInputJson}).
                success(function (data) {
                    console.log("Recalculate receive DATA",data);
                    processModifiedPoints(route, data);
                })
                .error(function(data){
                    console.log("ERROR, data");
                });


        };

        scope.showWindow = function (item) {
            item.editWindow = !item.editWindow;
        };

        scope.newPromisedWindow = function (item){
            var i = parseInt( (scope.item.newPromisedStartCard)/1000, 10 );
            var j = parseInt( (scope.item.newPromisedFinishCard)/1000, 10 );
            console.log("New TIme", i, j);
        };


        scope.confirmEditing = function() {
            console.log("Существует", rootScope.data.routes, "Отредактировано", scope.changedRoute);

            function compareNewArrivalTime (a, b){
                return a.new_arrival_time - b.new_arrival_time;
            }

            scope.changedRoute.points.sort(compareNewArrivalTime);

            //Этап 0 Определяем, какой роут редактируем
            var rootRoute;
            for (var i=0; i<rootScope.data.routes.length; i++){
                if(rootScope.data.routes[i].uniqueID == scope.changedRoute.uniqueID){
                    rootRoute = rootScope.data.routes[i];
                    console.log("Маршрут для редактирования выбран");
                    break;
                }
            }
            console.log("До редактирования в роуте точек =", rootRoute.points.length, scope.changedRoute.points.length );

            //Этап 1 Убираем все пересчитанные точки из базового роута

            for ( i=0; i<scope.changedRoute.points.length; i++){
                for (var j=0; j<rootRoute.points.length; j++){
                    if(scope.changedRoute.points[i].waypoint.gIndex == rootRoute.points[j].waypoint.gIndex){
                        rootRoute.points.splice(j,1);
                        break;
                    }
                }
            }

            console.log("После удаления", rootRoute.points.length, scope.changedRoute.points.length);
            rootRoute.points=rootRoute.points.concat(scope.changedRoute.points);
            console.log("После объединения точек в ротуе", rootRoute.points.length);


            //Этап 2 меняем номера заданий, arrival_time_ts promised_window_changed change_time

            for (var i=0; i<rootRoute.points.length; i++){
                rootRoute.points[i].NUMBER = i+1;
                delete rootRoute.points[i].fact_number;
                if (rootRoute.points[i].new_arrival_time != undefined && rootRoute.points[i].new_arrival_time !=rootRoute.points[i].arrival_time_ts ){
                    rootRoute.points[i].arrival_time_ts = rootRoute.points[i].new_arrival_time;
                    if(rootRoute.points[i].change_time == undefined) rootRoute.points[i].change_time=0;
                    rootRoute.points[i].change_time++;
                    //изменение обещанного окна. Последнее утвержденное и пересчитанное окно есть  в mathinput
                    for(var j=0; j<scope.mathInputJson.jobList.length; j++){
                        if (rootRoute.points[i].waypoint.gIndex == scope.mathInputJson.jobList[j].point){
                            rootRoute.points[i].promised_window_changed.start=scope.mathInputJson.jobList[j].windows[0].start;
                            rootRoute.points[i].promised_window_changed.finish=scope.mathInputJson.jobList[j].windows[0].finish;
                            console.log("Изменили обещанное окно", scope.mathInputJson.jobList[j].windows[0].finish);
                        }
                    }

                }

            }

            console.log("Новый роут", rootRoute);
            scope.$emit('updateDisplayCollection');
            scope.$emit('clearMap');
            scope.$emit('saveRoute', rootRoute.filterId);
            scope.display = [];

        };


        function createNewCarPosition(route){
            route.car_position = {};
            route.car_position.lat = route.points[0].LAT;
            route.car_position.lon = route.points[0].LON;

            for (var i=0; i<route.points.length; i++){
                if(route.points[i].status<4){
                    route.car_position.lat = route.points[i].LAT;
                    route.car_position.lon = route.points[i].LON;
                }
            }
        }







    }]);