// контроллер для работы с картой
angular.module('MTMonitor').controller('MapController', ['$scope', '$rootScope', '$http', 'Statuses', 'Settings',
    function (scope, rootScope, http, Statuses, Settings) {
        var map,                                        // объект карты
            oms,                                        // слой используемый Overlapping Marker Spiderfier
            position,                                   // позиция границ прозрачного окна карты
            inside = false,                             // находится ли курсор над прозрачным окном отображающим карту
            holderEl = null,                            // обертка внутренностей панели отображающей карту
            changingWindow = false,                     // меняется ли позиция окна в текущйи момент
            markersArr = [],                            // список маркеров отрисованных на карте
            allMarkers=[],                               // Накапливаеммый массив маркеров как минимум единожды отображенных маршрутов
            maximized = false,                          // развернута ли панелька на весь браузер
            textStatuses = Statuses.getTextStatuses(),  // расширенная информация о статусах
            STATUS = Statuses.getStatuses(),            // коды статусов


            currentRouteID,                             //ID отображаемого в данный момент маршрута
            gpsPushMarkers=[];                          // Массив маркеров пушей текущего маршрута


            scope.params = {} //scope.params || Settings.load();
            scope.opacityMode = false;
        //timeThreshold = scope.params.timeThreshold * 60;

        initMap();
        addListeners();

        // отрисовать комбинированный маршрут
        function drawCombinedRoute(route) {

            console.log("I gona draw Combined track");
            markersArr=[];

            drawRealRoute(route);

            //!!!!!!!!!!!!!Далее идет отрисовка планируемого маршрута!!!!!!!!!
            // Мы его пока закомментируем.

            //var i = route.points.length - 1;
            //// i будет равна первой выполненной задаче с конца маршрута
            //for (; i >= 0; i--) {
            //    if (route.points[i].status == STATUS.FINISHED ||
            //        route.points[i].status == STATUS.FINISHED_LATE ||
            //        route.points[i].status == STATUS.FINISHED_TOO_EARLY) break;
            //}
            //
            //// если трек есть и последняя задача в марщруте не выполнена - отрисовать остаток планового маршрута
            ////console.log("real track", route.real_track);
            //if (route.real_track != undefined && i != route.points.length - 1 && route.real_track.length>0) {
            //    var lastCoords = route.real_track[route.real_track.length - 1].coords,
            //        carPos = lastCoords[lastCoords.length - 1],
            //        url = './findpath2p/' + carPos.lat + '&' + carPos.lon + '&' + route.points[i + 1].LAT
            //            + '&' + route.points[i + 1].LON;
            //    http.get(url)
            //        .success(function (data) {
            //            var geometry = getLatLonArr(data);
            //            addPolyline(geometry, 'blue', 3, 0.5, 1, true);
            //            if (carPos != null && geometry[0] != null) {
            //                addPolyline([[carPos.lat, carPos.lon], [geometry[0].lat, geometry[0].lng]], 'blue', 3, 0.5, 1, true);
            //            }
            //            drawPlannedRoute(route.plan_geometry, i);
            //        })
            //        .error(function(err){
            //            rootScope.errorNotification(url);
            //        });
            //
            //}

            drawAllPoints(route.points);
            rootScope.clickOff=false;
        }

        // из массива строк получить массив LatLng объектов
        function getLatLonArr(data) {
            var tmp,
                geometry = [];

            for (var i = 0; i < data.length; i++) {
                if (data[i] == null) continue;
                tmp = data[i].split(",");
                geometry.push(new L.LatLng(parseFloat(tmp[0]), parseFloat(tmp[1])));
            }

            return geometry;
        }

        // отрисовать плановый трек с заданной позиции
        function drawPlannedRoute(track, startIndx) {
            if (track == null) return;

            var geometry = [];
            for (var i = startIndx; i < track.length; i++) {
                if (track[i] == null) continue;
                geometry = geometry.concat(getLatLonArr(track[i]));
            }

            addPolyline(geometry, 'blue', 3, 0.5, 1, true);
        }

        // отрисовать фактический трек
        function drawRealRoute(route) {

            scope.opacityMode = false;


            if (!route || route.real_track == "invalid parameter 'gid'. ") return;
            console.log("I gona draw real route", route);


            if (route.real_track != undefined && typeof (route.real_track) != 'string') drawStates(route.real_track, route);
//            var start = strToTstamp(route.START_TIME);
//            var end = strToTstamp(route.END_TIME);
//            if (end<route.max_arrival_time) end = route.max_arrival_time;
//            // console.log("Start", start, "End", end);
//
//
            var track = route.real_track,
                pushes = route.pushes,
                tmpVar,
                polyline,
                iconIndex = 14,
                tmpTitle = '',
                color = '',
                stopIndx,
                stopTime,
                timeThreshold = rootScope.settings.timeThreshold * 60,
                drawStops = $('#draw-stops').is(':checked'),    // отрисовать стопы
            //drawStops = true;

            //drawPushes = $('#draw-pushes').is(':checked');  // отрисовать нажатия если в таблице стоит галочка.
                drawPushes = true;  // Железно отрисовывать пуши.

            //stops=[];
            //markersArr=[];
            gpsPushMarkers=[];
//
//            if( track!=undefined) {
//                //todo тестово отладочный блок
//                for ( i = 1; i < track.length; i++) {
//                    if (track[i].t1 != track[i-1].t2){
//
//                        console.log ("Проверка трека показала разрыв", track[i-1] , track[i] );
//                       if (rootScope.data.settings.user == "ids.kalko" || rootScope.data.settings.user == "ids.dsp") alert("Обнаружен разрыв трека! Обратитесь к разработчику");
//                    }
//                }
//
//
//                for (i = 0; i < track.length; i++) {
//                    // console.log(i, "track", track[i], track[i].coords.constructor !== Array);
//                    if (track[i].coords == null || track[i].coords.constructor !== Array || track[i].coords == undefined ) {
//                        console.log("Это какой то бракованный СТЭЙТ. Я не буду его рисовать", track[i]);
//                        if (rootScope.settings.user == "ids.kalko" || rootScope.settings.user == "ids.dsp") alert("Обнаружен поломаный стейт, обратитесь к разработчику");
//                        continue;
//                    }
//                    //console.log(" track[i].time",  track[i].coords);
//
//
//                    //todo снять комментарий, когда правильно рассчитают время финиша
//                   // console.log("Времена", track[i].coords[0].t, start, timeThreshold);
//                    if( track[i].coords[0] == undefined || track[i].coords[0].t < start-timeThreshold) {
//                        //console.log("Its too early track");
//                        continue
//                    }; //не отрисовываем стопы больше чем за (указано в настройках) минут от начала маршрута.
//                    if( track[i].coords[0].t > end+timeThreshold) {
//                        //console.log("Its too past track");
//                        break;
//                    } //не отрисовываем стопы больше чем за (указано в настройках) минут после окончания маршрута.
//
//
//                    color = '#5cb85c';
//                    // отрисовать движение
//                    if (track[i].state == 'MOVE') {
//                        console.log("draw polyline");
//                        polyline = new L.Polyline(track[i].coords, {
//                            color: color,
//                            weight: 3,
//                            opacity: 0.8,
//                            smoothFactor: 1
//                        });
//                        if (i + 1 == track.length) {
//                            polyline.redrawer = true;
//                            markersArr.push(polyline);
//                       }
//                        polyline.on('click', function (event) {
//                            console.log(event.target);
//                        });
//                        polyline.addTo(map);
//                    } else if (track[i].state == 'ARRIVAL') { // отрисовать стоп
//                        // если отрисовка стопов выключена, пропустить итерацию
//                        //stops.push(track[i]);
//
//// todo раскомментировать когда будет правильно рассчитываться время финиша
//                        if (track[i].coords.t1 < start - rootScope.settings.timeThreshold*60) continue; //не отрисовываем стопы больше чем за (указано в настройках) минут от начала маршрута
//                        if (track[i].coords.t1 > end + rootScope.settings.timeThreshold*60) break; //не отрисовываем стопы больше чем за (указано в настройках) минут после окончания маршрута.
//
//                        if (!drawStops) continue;
//
//
//                        stopIndx = (parseInt(i / 2 + 0.5) - 1);
//                        stopTime = mmhh(track[i].time);
//                        tmpVar = stopTime.split(':');
//                        if (tmpVar[1] != '00') {
//                            stopTime = parseInt(tmpVar[0]) + 1;
//                        } else {
//                            stopTime = parseInt(tmpVar[0]);
//                        }
//
//                        // формирование всплывающей подсказки для стопов
//                        // Закомментирована лишняя информация
//
//                        //tmpTitle = 'Остановка #' + stopIndx + '\n';
//                        tmpTitle = 'Остановка в: ' + formatDate(new Date(track[i].t1 * 1000));
//                        //tmpTitle += 'Время отбытия: ' + formatDate(new Date(track[i].t2 * 1000)) + '\n';
//                        tmpTitle += ' (' + mmhh(track[i].time) + ')' + '\n';
//
//                        //if (i + 1 < track.length) {
//                        //    tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist + track[i + 1].dist) + ' метра(ов)';
//                        //    polyline = new L.Polyline([track[i].coords[0], track[i].coords[track[i].coords.length - 1]], {
//                        //        color: color,
//                        //        weight: 3,
//                        //        opacity: 0.8,
//                        //        smoothFactor: 1
//                        //    });
//                        //
//                        //    polyline.addTo(map);
//                        //} else if (i + 1 == track.length) {
//                        //    tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist) + ' метра(ов)';
//                        //}
//
//
//                        //tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon], - заменили эту строку на нижнюю
//                        //чтобы стоп рисовался по усредненным данным, а не по первым. В связи с этим, необходимо добавить линию от конца трека до стопа.
//
//                        tmpVar = L.marker([track[i].lat, track[i].lon],
//                            {
//                                'title': tmpTitle,
//                                'draggable': true
//                            });
//                        tmpVar.source = track[i];
//                        //console.log("tmpVar", tmpVar);
//
//
//                        // удаляем в стейте лишние координаты
//                        if (tmpVar.source.coords.length > 2) {
//                            tmpVar.source.coords.splice(1, tmpVar.source.coords.length - 2);
//                        }
//
//                        tmpVar.stopIndx = stopIndx;
//                        tmpVar.routeRealTrackIndx = i;
//                        tmpVar.setIcon(getIcon(stopTime, 15, 'white', 'black'));
//
//                        var LAT = +track[i].coords[0].lat;
//                        var LON = +track[i].coords[0].lon;
//                        var lat = +track[i].lat;
//                        var lon = +track[i].lon;
//
//                        //console.log(" LATLON",LAT, LON, lat, lon );
//
//                        var stopPolyline = new L.Polyline([[LAT, LON], [lat, lon], track[i].coords[track[i].coords.length - 1]], {
//                            color: color,
//                            weight: 3,
//                            opacity: 0.8,
//                            smoothFactor: 1
//                        });
//                        if (i == track.length-1 )stopPolyline.redrawer = true;
//
//
//                        stopPolyline.on('click', function(event) {
//                            console.log(event.target);
//                        });
//                        stopPolyline.addTo(map);
//
//
//                        tmpVar.on('click', function (event) {
//
//                            var localData = event.target;
//                            // if(localData.source.servicePoints == undefined ){
//                            //     return;
//                            // }
//                            var timeData = checkRealServiceTime(localData);
//                            var taskTime = getTaskTime(localData);
//                            console.log(taskTime);
//                            rootScope.$emit('pointEditingPopup', localData, timeData, taskTime);
//
//
//                        });
//
//
//                        tmpVar.on('drag', function (event) {
//
//                            oms.removeMarker(event.target);
//                            scope.currentDraggingStop = event.target;
//                            findNearestPoint(this._latlng.lat, this._latlng.lng);
//
//                        });
//
//
//                        tmpVar.on('dragend', function (event) {
//
//
//                            var container = event.target;
//                            oms.addMarker(container);
//                            container.setLatLng([container.source.lat, container.source.lon]).update();
//
//
//                            try {
//                                map.removeLayer(scope.polyline)
//                            }
//                            catch (e) {
//                                console.log(e);
//                            }
//
//                            try {
//                                scope.spiderMarker.fire('click')
//                            }
//                            catch (e) {
//                                console.log(e);
//                            }
//
//                            //console.log(scope.baseCurrentWayPoints[scope.minI].stopState, "connect", scope.currentDraggingStop.source);
//
//                            scope.baseCurrentWayPoints[scope.minI].stopState = scope.currentDraggingStop.source;// тщательно оттестировать
//
//                            if (confirm("Хотите связать стоп " + Math.round(scope.currentDraggingStop.source.time / 60) + " минут с точкой " + (scope.minI + 1) + " ?")) {
//                            } else {
//                                return
//                            }
//                            // console.log(scope.currentDraggingStop, scope.minI);
//
//                            checkAndAddNewWaypointToStop(scope.currentDraggingStop, scope.minI);
//                            scope.currentDraggingStop = null;
//                            console.log("отправляем на пересчет", scope.baseCurrentWayPoints[scope.minI].route_id);
//                            rootScope.$emit('reFact', scope.baseCurrentWayPoints[scope.minI].route_id);// Пересчитать фактический порядок выполнения точек
//                            rootScope.$emit('checkInCloseDay');
//
//
//                            var reRoute;
//                            for (var i=0; i< rootScope.data.routes.length; i++){
//                                if (rootScope.data.routes[i].uniqueID == scope.baseCurrentWayPoints[scope.minI].uniqueID){
//                                    reRoute = rootScope.data.routes[i];
//                                }
//                            }
//                            rootScope.showProblem(reRoute);
//
//                        });
//
//                        addMarker(tmpVar);
//
//                    } else if (track[i].state == 'NO_SIGNAL' || track[i].state == 'NO SIGNAL') {
//                        color = '#de5bc0';
//                        polyline = new L.Polyline(track[i].coords, {
//                            color: color,
//                            weight: 3,
//                            opacity: 0.8,
//                            smoothFactor: 1
//                        });
//
//                        polyline.addTo(map);
//                    } else if (track[i].state == 'START') {
//                        color = 'yellow';
//                    }
//
//
//                    if (i + 1 == track.length) {
//                        var indx = track[i].coords.length - 1;
//                        tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon],
//                            {
//                                'title': 'Последнее известное положение транспортного средства\n' +
//                                'Время сигнала: ' + formatDate(new Date(track[i].t2 * 1000))
//                            });
//                        tmpVar.setIcon(getIcon(i, 7, color, 'black'));
//                        tmpVar.redrawer = true;
//                        tmpVar.on('click', function (event){
//                            //console.log (tmpVar._latlng);
//                            console.log(event.target);
//                            redrawTrac(event.target);
//                        });
//                        addMarker(tmpVar);
//                        //map.addLayer(tmpVar);
//                        //oms.addMarker(tmpVar);
//
//                        //console.log(map.getZoom(), "Zoom", track[i].coords[indx].lat, track[i].coords[indx].lon);
//
//                        //Установить центр карты в текущее положение машины, если оно определено.
//                        if (track[i].coords[indx].lat && track[i].coords[indx].lon && rootScope.carCentre) {
//                            setMapCenter(track[i].coords[indx].lat, track[i].coords[indx].lon, 13);
//                            rootScope.carCentre = false;
//
//                        } else {
//                            console.log("Something wrong with car real coord");
//                        }
//
//                    }
//
//
//                }
//            }

            // тестовоотладочная функция проверки. Выбирает все привязанные стопы и печатает их с обслуженными точками.
            // checkTestStops();
            // если не включена отрисовка нажатий - выход из функции

            // Закомментирован выбор рисовать или нет пуши на карте. По умолчанию рисовать.
            //if (!pushes) return;





            //console.log("????????????????????????? drawPushes", drawPushes, 'pushes',pushes);

            for (var i = 0; drawPushes && pushes && i < pushes.length; i++) {

                //console.log("Start drawing Pushes");

                if (pushes[i].is_start) {
                    tmpTitle = 'НАЧАЛО МАРШРУТА: '+ '\n';
                    tmpTitle += 'Время нажатия: ' + pushes[i].time + '\n';
                } else {
                    tmpTitle = 'Время нажатия: ' + pushes[i].time + '\n';
                }

                tmpTitle += 'Время нажатия GPS: ' + pushes[i].gps_time + '\n';
                if (pushes[i].plan_number) tmpTitle += '№ задания: ' + pushes[i].plan_number;
                if (pushes[i].is_warehouse) tmpTitle += 'СКЛАД: ' + pushes[i].point_number + '\n';
                if (pushes[i].canceled
                    && !pushes[i].is_start
                    && !pushes[i].is_warehouse) {tmpTitle += ' ОТМЕНЕНО';
                } else {
                    if (!pushes[i].is_start && !pushes[i].is_warehouse) {
                        tmpTitle += ' ВЫПОЛНЕНО';
                    }

                }


                var tmpVar = L.marker([pushes[i].lat, pushes[i].lon], {'title': tmpTitle});
                var pushColor='orange';
                if(pushes[i].long_away){
                    pushColor='#e01283';
                }
                tmpVar.source = pushes[i];

                tmpVar.setIcon(getIcon('M', iconIndex, pushColor, 'black'));
                tmpVar.task_ID=pushes[i].number;

                tmpVar.on('click', function(event){
                    var m = map;
                    var targetPoint;
                    for (var l in m._layers) {
                        //console.log( "Stop serching",l , m._layers[l]);
                        if (m._layers[l] &&
                            m._layers[l].source &&
                            m._layers[l].source.TASK_NUMBER &&
                            m._layers[l].source.TASK_NUMBER == event.target.source.number) {
                            targetPoint = m._layers[l];
                            break;
                        }
                    }
                    console.log(event.target.source.number, targetPoint);
                    shiftToOpacityMode(targetPoint);
                });


                map.addLayer(tmpVar);
                oms.addMarker(tmpVar);
                gpsPushMarkers.push(tmpVar);

                // закомментирована функция прорисовки линии от пуша к точке при наведении на пуш.

                //tmpVar.on('mouseover', function(event) {
                //
                //    if (map.getZoom()>=16){
                //        drawPushLine (event.target);
                //    }
                //
                //
                //});


                //tmpVar.on('mouseout', function(event) {
                //    if (scope.pushPolyline != undefined) {
                //        map.removeLayer(scope.pushPolyline);
                //    }
                //
                //});


                //addMarker(tmpVar);
            }

            //

            rootScope.clickOff=false;
           // scope.$apply;

        }

        // получить текстовый статус по коду статуса
        function getTextStatuses(status) {
            for (var i = 0; i < textStatuses.length; i++) {
                if (textStatuses[i].value === status) return textStatuses[i];
            }
        }

        // отрисовать все точки (задачи) на карте
        //var dragendPoint;

        function drawAllPoints(points) {
            var tmpVar,
                title,
                tmpStatus,
                tmpBgColor,
                tmpFColor,
                point;

            // Переопределение поинтс если они уже были отрисованы и с ними производились действия
            //console.log ("Points to draw" , points);



            scope.baseCurrentWayPoints=points;
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;

            for (var i = 0; i < points.length; i++) {
                title = '';
                point = points[i];



                // Создание титла к точке. Ненужная информация закоментчена.
                if(point.waypoint == undefined) {
                    title = 'Парковка\n';
                    tmpStatus = getTextStatuses(point.status);
                    title += 'Статус: ' + (tmpStatus ? tmpStatus.name : 'неизвестно') + '\n';
                }

                if (point.waypoint != undefined && point.waypoint.TYPE == "WAREHOUSE") {
                    title = 'Склад\n';
                    tmpStatus = getTextStatuses(point.status);
                    title += 'Статус: ' + (tmpStatus ? tmpStatus.name : 'неизвестно') + '\n';
                } else {


                    title = 'Точка #' + (point.NUMBER) + '\n';
                    tmpStatus = getTextStatuses(point.status);
                    title += 'Статус: ' + (tmpStatus ? tmpStatus.name : 'неизвестно') + '\n';
                }

                title += 'Время прибытия: ' + point.arrival_time_hhmm + ' (';
                //title += 'Время отбытия: ' + point.end_time_hhmm + '\n';
                title +=  mmhh(point.TASK_TIME) + ')'+'\n';
                title += 'Временное окно: ' + point.AVAILABILITY_WINDOWS + '\n';
                //title += 'Время простоя: ' + mmhh(point.DOWNTIME) + '\n';
                //title += 'Расстояние: ' + point.DISTANCE + ' метра(ов)\n';
                //title += 'Время на дорогу к точке: ' + mmhh(point.TRAVEL_TIME) + '\n';

                if (point.waypoint != null && point.waypoint != undefined) {
                    title += 'Адрес: ' + point.waypoint.ADDRESS + '\n';
                    // title += 'Клиент: ' + point.waypoint.NAME + '\n';
                    // title += 'Комментарий: ' + point.waypoint.COMMENT + '\n';
                }


                //Добавление титра реально обслужено. Если нет введенного в ручную параметра real_service_time то ставится автоматически время всего стопа
                if(typeof (point.stopState)!='undefined'){
                    title += 'Реально обслужено за: ' + mmhh((point.real_service_time) || (point.stopState.time)) + '\n';
                }


                ///Отлавливатель странных точек!!!!!
                if(point.LAT==undefined) {
                    console.log('!!!!!!!!!!!!!!!!!!!!!!This is the  problem point!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', point);
                    point.LAT=point.END_LAT;
                    point.LON=point.END_LON;
                }


                tmpVar = L.marker([point.LAT, point.LON], {
                    'title': title,
                    'draggable': true

                });

                tmpBgColor = '#7EDDFC';
                tmpFColor = 'white';
                if (tmpStatus) {
                    tmpBgColor = tmpStatus.color;
                }

                if (point.limit < rootScope.settings.limit && (point.status == STATUS.FINISHED ||
                    point.status == STATUS.FINISHED_LATE || point.status == STATUS.FINISHED_TOO_EARLY)) {
                    tmpBgColor = 'yellow';
                    tmpFColor = 'black';
                }




                tmpVar.source=point;

                // Установка новых координат для вэйпоинта при переноске маркера-point
                tmpVar
                    .on('dragend', function(event){
                        //dragendPoint = event.target;
                        // var newMarker = event.target;

                        rootScope.gpsConfirm=false;// подтверждена ли точка по GPS
                        scope.dragendPoint = event.target;// объект события при драге  маркера-point
                        rootScope.$emit('askGPSConfirmPoint', {point: event.target.source.waypoint, uniqueID : event.target.source.uniqueID});//point index controller
                        if(rootScope.gpsConfirm){
                             message="Эта точка ранее уже была подтверждена GPS данными. Вы уверены, что хотите изменить ее координаты?";
                            if (!confirm(message)){
                                var newMarker= scope.dragendPoint;
                                newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();
                                return;
                            }

                        }

                        var message = 'Вы собираетесь изменить координаты ' + scope.dragendPoint.source.waypoint.NAME + '\n'
                            + 'Старые координаты ' + scope.dragendPoint.source.waypoint.LAT + " " + scope.dragendPoint.source.waypoint.LON + '\n'
                            + 'Новые координаты ' + event.target.getLatLng().lat.toPrecision(8) + " " + event.target.getLatLng().lng.toPrecision(8);
                        rootScope.$emit('ReqChengeCoord', {message: message});


                    })
                    .on('click', function(event){
                        shiftToOpacityMode(event.target);
                    })
                    .on('dblclick', function(event){
                        console.log('this is waypoint ', event.target);
                    })
                    .on('mouseover', function(event){
                        scope.mousein = true;
                        setTimeout (function() {
                            if (scope.mousein) {
                            rootScope.$emit('clickOnMarkerWayPiont', event.target.source);
                            var source = event.target.source;
                            //console.log(source);
                            scope.drawConnectsActivePoint(source.stopState, source.NUMBER, source.TASK_NUMBER);}
                        }, 500);

                    })
                    .on('mouseout', function(event){
                        scope.mousein = false;
                    });


                if (point.TASK_NUMBER <0) {
                    tmpVar.setIcon(getIcon(point.NUMBER, 3, 'red', tmpFColor));
                } else {
                    tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
                }

                addMarker(tmpVar);

            }

            prepearDrawConnectsActivePoint.arr = true;
            prepearDrawConnectsActivePoint();




            // console.log('Finish draw markersArr.', markersArr, "points", points, "Only Points", markersArr.length==points.length );

            //Если рисовался только трек из точек, то центрировать карту по первой точке.
            if(markersArr.length == points.length && markersArr[0]) {
                setMapCenter(markersArr[0]._latlng.lat, markersArr[0]._latlng.lng, 13);
            }

            rootScope.clickOff=false;
            //scope.$apply;
        //
        }

        rootScope.$on('eventdrawConnectsActivePoint', function(event, stopState, number, TASK_NUMBER){
            if(!stopState && !number){
                return;
            }


            scope.drawConnectsActivePoint(stopState, number, TASK_NUMBER);

            scope.dataActivePoint = {
                stopState: stopState,
                number: number,
                teskNumber: TASK_NUMBER
            };
            prepearDrawConnectsActivePoint.event = true;
            prepearDrawConnectsActivePoint();
        });


        function prepearDrawConnectsActivePoint(){
            if(prepearDrawConnectsActivePoint.arr && prepearDrawConnectsActivePoint.event){
                scope.drawConnectsActivePoint(scope.dataActivePoint.stopState, scope.dataActivePoint.number, scope.dataActivePoint.TASK_NUMBER);
                prepearDrawConnectsActivePoint.arr = 0;
                prepearDrawConnectsActivePoint.event = 0;
            }
        }


        scope.drawConnectsActivePoint = function(stopState, number, TASK_NUMBER){
            if(stopState == undefined || !number || !TASK_NUMBER){
                return;
            }
            if(scope.singleConnect !== undefined){
                try {
                    map.removeLayer(scope.singleConnect);
                } catch (e) {
                    console.log(e);
                }
            }
            scope.singleConnect = new L.layerGroup().addTo(map);

            //console.log(" UNDEFINED HERE map 603", markersArr );
            outer:for (var i = 0; markersArr.length > i; i++) {
                if('source' in markersArr[i] && markersArr[i].source.state == "ARRIVAL" && 'servicePoints' in markersArr[i].source){
                    for(var j = 0; markersArr[i].source.servicePoints.length > j; j++){
                        if(number == markersArr[i].source.servicePoints[j]){
                            var servicePointsLat = markersArr[i]._latlng.lat;
                            var servicePointsLng = markersArr[i]._latlng.lng;
                            break outer;
                        }
                    }
                }
            }


            var j = 0;
            //console.log(" UNDEFINED HERE map 617", markersArr );
            while (j < markersArr.length) {
                if ((typeof (markersArr[j].source) != 'undefined') && (typeof (markersArr[j].source.NUMBER) != 'undefined')) {
                    if (number == markersArr[j].source.NUMBER && servicePointsLat && servicePointsLng) {
                        console.log("Before error", parseFloat(servicePointsLat), parseFloat(servicePointsLng), parseFloat(markersArr[j]._latlng.lat), parseFloat(markersArr[j]._latlng.lng));
                        var polyline = new L.Polyline([[parseFloat(servicePointsLat), parseFloat(servicePointsLng)], [parseFloat(markersArr[j]._latlng.lat), parseFloat(markersArr[j]._latlng.lng)]], {
                            color: '#46b8da',
                            weight: 4,
                            opacity: 0.5,
                            smoothFactor: 1
                        });
                        //console.log("Polyline Undefined???", servicePointsLat, servicePointsLng, markersArr[j]._latlng.lat, markersArr[j]._latlng.lng );
                        if (servicePointsLat != undefined && servicePointsLng != undefined && markersArr[j]._latlng.lat != undefined && markersArr[j]._latlng.lng != undefined) {
                            scope.singleConnect.addLayer(polyline);
                        }
                        //console.log(polyline);
                        // scope.singleConnect.addLayer(polyline);
                        break;
                    }
                }
                j++;
            }

            if (gpsPushMarkers !=undefined) {
                for(var k = 0; k<gpsPushMarkers.length; k++){
                    var mobilePush=gpsPushMarkers[k];
                    if (TASK_NUMBER==mobilePush.task_ID){
                        var LAT=mobilePush._latlng.lat;
                        var LON=mobilePush._latlng.lng;
                        var lat=servicePointsLat;
                        var lon=servicePointsLng;
                        if(LAT != undefined && LON != undefined && lat != undefined && lon != undefined) {
                            var line_points = [
                            [LAT, LON],
                            [lat, lon]];

                            var qwe = new L.polyline(line_points, {
                                color: '#46b8da',
                                weight: 4,
                                opacity: 0.5,
                                smoothFactor: 1
                            });
                            map.addLayer(qwe);
                            break;}

                    }
                }

            }
        };





        rootScope.$on('ResChengeCoord', function(event, bool, confirm){
            var newMarker = scope.dragendPoint;
            if (bool ){

                changeWaypointCoordinates(newMarker, newMarker.getLatLng().lat.toPrecision(8), newMarker.getLatLng().lng.toPrecision(8), confirm);
                console.log("New MARKER", newMarker.source.waypoint.CONFIRMBYGPS);
                newMarker.source.waypoint.CONFIRMBYGPS="true";
                console.log("NEW New MARKER", newMarker.source.waypoint.CONFIRMBYGPS);
                scope.$emit('addPointHistory', newMarker.source, "lat-lon change");
                rootScope.$emit('showNotification', {text:'Координаты изменены', duration:2000});
                $('#notification_wrapper').css('opacity', '1');


            } else {

                newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();
            }
        });


        // перевести timestamp в строковой формат времени минуты:часы
        function mmhh(time) {
            return (parseInt(time / 60)).padLeft() + ':' + (time % 60).padLeft();
        }

        // добавить ноль слева, если число меньше десяти
        Number.prototype.padLeft = function (base, chr) {
            var len = (String(base || 10).length - String(this).length) + 1;
            return len > 0 ? new Array(len).join(chr || '0') + this : this;
        };

        // добавить маркер на карту (добавляет сам маркер, добавляет в слой oms, добавляет в массив маркеров)
        function addMarker(marker) {
            // console.log("adMarker start", marker);

            map.addLayer(marker);
            oms.addMarker(marker);
            markersArr.push(marker);
        }



        // добавить полилайн на карту
        function addPolyline(geometry, color, weight, opacity, smoothFactor, decorator) {
            var polyline = new L.Polyline(geometry, {
                color: color,
                weight: weight,
                opacity: opacity,
                smoothFactor: smoothFactor
            });

            polyline.addTo(map);
        }

        // форматировать дату в строковой формат часы:минуты:секунды
        function formatDate(d) {
            var dformat =
                [d.getHours().padLeft(),
                    d.getMinutes().padLeft(),
                    d.getSeconds().padLeft()].join(':');
            return dformat;
        }

        // проверить попадание координаты в Rect
        function checkMouseInRect(pos, x, y) {
            if(pos.top < y && pos.left < x &&
                pos.top + pos.height > y && pos.left + pos.width > x) {
                return true;
            }

            return false;
        }

        function showMarker(point) {
            var tmpVar,
                title,
                tmpStatus,
                tmpBgColor,
                tmpBgColor,
                tmpFColor,

            //for (var i = 0; i < points.length; i++) {
                title = '';


            if (point.TASK_NUMBER == '') {
                title = 'Склад\n';
            } else {
                title = 'Точка #' + (point.NUMBER) + '\n';
                tmpStatus = getTextStatuses(point.status);
                title += 'Статус: ' + (tmpStatus ? tmpStatus.name : 'неизвестно') + '\n';
            }

            title += 'Время прибытия: ' + point.arrival_time_hhmm + '\n';
            title += 'Время отбытия: ' + point.end_time_hhmm + '\n';
            title += 'Время выполнения задачи: ' + mmhh(point.TASK_TIME) + '\n';
            title += 'Временное окно: ' + point.AVAILABILITY_WINDOWS + '\n';
            title += 'Время простоя: ' + mmhh(point.DOWNTIME) + '\n';
            title += 'Расстояние: ' + point.DISTANCE + ' метра(ов)\n';
            title += 'Время на дорогу к точке: ' + mmhh(point.TRAVEL_TIME) + '\n';

            if (point.waypoint != null) {
                title += 'Адрес: ' + point.waypoint.ADDRESS + '\n';
                title += 'Клиент: ' + point.waypoint.NAME + '\n';
                title += 'Комментарий: ' + point.waypoint.COMMENT + '\n';
            }

            tmpVar = L.marker([point.LAT, point.LON], {
                'title': title
            });
            tmpBgColor = '#7EDDFC';
            tmpFColor = 'white';
            tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
            if (tmpStatus) {
                tmpBgColor = tmpStatus.color;
            }

            if (!point.confirmed && (point.status == STATUS.FINISHED ||
                point.status == STATUS.FINISHED_LATE || point.status == STATUS.FINISHED_TOO_EARLY || point.status == STATUS.ATTENTION)) {
                tmpBgColor = 'yellow';
                tmpFColor = 'black';
            }
            // }
            tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
            return tmpVar;
        }

        // подписаться на ряд событий
        function addListeners() {
            $(window).resize(resize);
            resize();

            window.initialize = function (thisForm) {
                parentForm = thisForm;
                console.log('initialize complete', parentForm);
                //console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                //scope.$emit('logoutsave');
            };


            window.onCloseMonitoring = function () {
                //scope.$emit('logoutsave');

            };


            //$(window).onunload=function(){
            //   return "Hola"
            //};

            $(window).click(function() {
                var start = Date.now()/1000;
              rootScope.editing.start = start;
                //console.log("New Editing", rootScope.editing);


                //event.returnValue = "Write something clever here..";
        });



            //$(window).onbeforeunload = function(){
            //    if (confirm('Are you sure you want to leave this page?')){
            //        // user leaves
            //    }
            //    else{
            //        // your code
            //    }
            //};

            rootScope.$on('clearMap', function () {
                clearMap();
            });

            rootScope.$on('setMapCenter', function (event, data) {
                setMapCenter(data.lat, data.lon, data.zoom);
            });

            rootScope.$on('drawCombinedTrack', function (event, route, activePoint) {
                //console.log('i gona  draw combined route', route);
               
                //updateStoredMarkers(route);
                drawCombinedRoute(route);
                scope.route = route;
                showProblemPoint(route);
            });

            rootScope.$on('drawRealTrack', function (event, route) {
                //console.log('i gona  draw real route', route);
                scope.route = route;
                drawRealRoute(route);
                drawAllPoints(route.points)
            });

            rootScope.$on('drawPlannedTrack', function (event, route) {
                //console.log('i gona  draw planned route', route);

                drawPlannedRoute(route.plan_geometry, 0);
                drawAllPoints(route.points);
            });

            rootScope.$on('drawRealAndPlannedTrack', function (event, route) {
                //console.log('i gona  draw real Planned route', route);
                drawPlannedRoute(route.plan_geometry, 0);
                drawRealRoute(route);
                drawAllPoints(route.points);
            });

            holderEl = $('#transparent-map-holder');
            holderEl.parent().on('mouseenter', function (event) {
                // если на родителя холдера карты зашел курсор, но ещё не числится, что он внутри
                // и при этом панельки не меняются, происходит пересчет границ прозрачной панельки карты
                if (!inside && !changingWindow) {
                    checkMapWindowRect();
                }
            });

            var dragHandle = $('.lm_drag_handle'); // загаловок панели
            // нажатие на загаловке панели
            dragHandle.on('mousedown', function () {
                changingWindow = true;
                disableMap();
            });

            // отжатие загаловка панели
            dragHandle.on('mouseup', function () {
                changingWindow = false;
            });

            myLayout.on('stateChanged', function () {
                setTransparent();
                disableMap();
                changingWindow = false;
                checkMapWindowRect();
            });

            $('body').on('mouseenter', checkMapWindowRect);
            holderEl.on('mouseenter', checkMapWindowRect);

            $('.lm_maximise').on('click', function () {
                maximized = $(this).attr('title') === 'minimise';
                if (maximized) disableMap();
            })
        }

        // найти новые границы прозрачной панельки карты
        function checkMapWindowRect() {
            if (maximized) return;

            if (holderEl == null) {
                holderEl = $('#transparent-map-holder');
            }

            position = holderEl.position();
            position.width = holderEl.width();
            position.height = holderEl.height();
            position.offset = holderEl.offset();
            inside = true;
            $('.lm_goldenlayout').css('pointer-events', 'none');

            var $body = $('body');
            $body.off('mousemove');
            $body.mousemove(function (event) {
                if (!checkMouseInRect(position, event.clientX, event.clientY)) {
                    disableMap();
                }
            });
        }

        // отключить взаимодействие с картой
        function disableMap() {
            inside = false;
            $('.lm_goldenlayout').css('pointer-events', 'auto');
            $('body').off('mousemove');
        }

        // сделать панель карты прозрачной
        function setTransparent() {

            //console.log("Make map opacity")
            var el = holderEl.parent();

            for (var i = 0; i < 4; i++) {
                if (i == 3 && el[0] != undefined) {
                    $(el[0].firstChild).hide();
                }

                el.css('opacity', '0');
                el = el.parent();
            }
        }

        // инициализация карты
        function initMap() {


            //console.log(map + " Map preinit");

            var lay1= new L.TileLayer('http://tms{s}.visicom.ua/2.0.0/planet3/base_ru/{z}/{x}/{y}.png', {
                maxZoom: 19,
                tms: true,
                attribution: 'Данные карт © 2013 ЧАО «<a href="http://visicom.ua/">Визиком</a>»',
                subdomains: '123'
            });

            var lay2= new L.TileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: 'Map data '

            });

            map = new L.Map('map', {
                center: new L.LatLng(50.450475, 30.53589),
                zoom: 15,
                layers: [
                    lay2, lay1
                ]
            });

            L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);

            L.control.layers({"map 1":lay2, "map 2":lay1} ,{}, {position: 'topleft'} ).addTo(map);

            oms = new OverlappingMarkerSpiderfier(map);
            //console.log("oms",oms,oms.prototype);
        }

        // изменение размеров окна браузера и, как следствие, карты
        function resize() {


            console.log("map resize");
            var $map = $('#map');
            $map.height($(window).height());
            $map.width($(window).width());
            map.invalidateSize();
        }



        //function beforeunload(){
        //    alert("HEY AM HERE");
        //}

        // очистить карту
        function clearMap() {
            console.log("Clear Map");
            //updateStoredMarkers();


            var m = map;
            for (i in m._layers) {
                //console.log("Layer", m._layers[i] );
                if (m._layers[i]._path != undefined || m._layers[i].source != undefined) {
                    try {

                        m.removeLayer(m._layers[i]);
                    }
                    catch (e) {
                        console.log("problem with " + e + m._layers[i]);
                    }
                }
            }

            for (var i = 0; i < markersArr.length; i++) {
                map.removeLayer(markersArr[i]);
            }



            map.removeLayer(oms);
            // функция удаления с карты маркеров пушей

            if(!gpsPushMarkers || gpsPushMarkers.length==0) return;
            i=0;
            while(i<gpsPushMarkers.length){
                map.removeLayer(gpsPushMarkers[i]);
                i++;
            }

            markersArr = [];
            allMarkers =[];
        }


        // установить центр карты
        //console.log("Centre map");
        function setMapCenter(lat, lon, newZoom) {

            lat=parseFloat(lat);
            lon=parseFloat(lon);
            console.log("!!!!!!Работает функция центровки по координате", lat, lon);

            var zoom = map.getZoom() > 15 ? map.getZoom() : 15;
                console.log ("Set ZOOM to", zoom);
            var offset = map.getSize(),
                tmp = map.project(new L.LatLng(lat, lon), newZoom||zoom).subtract(
                    [
                        position.width / 2 - offset.x / 2 + position.offset.left,
                        position.height / 2 - offset.y / 2 + position.offset.top
                    ]),
                target = map.unproject(tmp, newZoom||zoom);

            map.setView(target, newZoom||zoom);
        }





        // Проверка на добавление в остановку обслуживания точки, которая уже обслуживается этим стопом.
        function checkAndAddNewWaypointToStop(stop, indx){
            console.log("checkAndAddNewWaypointToStop", stop, indx, markersArr.length);

            //Нахождение маркера соответсвующего найденному waypoint
            var i=0;
            while(i<markersArr.length){
                if (markersArr[i].source != undefined) console.log(markersArr[i].source.NUMBER, indx);

                if((typeof (markersArr[i].source)!='undefined') && (typeof (markersArr[i].source.NUMBER)!='undefined') && (markersArr[i].source.NUMBER==indx)){
                    var marker=markersArr[i];
                    console.log('marker for waypoint', marker);
                    break;
                }
                i++;
            }


            var wayPoint=marker.source;
            // console.log("I want to connect", stop, 'with point', wayPoint, "and indx", indx);
            wayPoint.haveStop=true;
            wayPoint.confirmed_by_operator=true;
            wayPoint.limit=100;
            wayPoint.problem_index=0;
            wayPoint.overdue_time=0;

            var oldStopTime=wayPoint.real_arrival_time;
            // console.log('oldStopTime', oldStopTime);

            //var oldStop= $.extend(true, {}, wayPoint.stopState);

            wayPoint.real_service_time = 0;
            scope.$emit('addPointHistory', wayPoint, "connect from map with stop", stop.t1);

            // Проверка на аккуратность и внимательность человекаю Не пытается ли он связать уже связанные точку и стоп
            if(typeof(wayPoint.stopState)!='undefined' && typeof(wayPoint.stopState.servicePoints)!='undefined'){
                i=0;
                var duplicate=false;

                //console.log("Start Duplicate Checkfor wayPoint", wayPoint.stopState.servicePoints, "and indx", indx  );

                while( i<wayPoint.stopState.servicePoints.length){
                    //console.log("looking Duplicate", typeof (wayPoint.stopState.servicePoints));
                    if(wayPoint.stopState.servicePoints[i]==indx){
                        duplicate=true;
                        break;
                    }
                    i++
                }

                //Проверка не был ли ранее этот стоп помечен как некорректный, и если да, то убрать его из списка
                if(wayPoint.incorrect_stop != undefined) {
                    var uniqueId = "" + stop.lat + stop.lon + stop.t1;
                    for(var si=0; si<wayPoint.incorrect_stop.length; si++ ){
                        if (wayPoint.incorrect_stop[si] == uniqueId){
                            wayPoint.incorrect_stop.splice(si,1);
                            si--;
                        }
                    }
                }

                wayPoint.rawConfirmed =1;
                makeWayPointMarkerGreen(indx);
                changeFieldsAlredyConnectedPoints(wayPoint, stop);
                if(duplicate){return}
            }



            if(typeof (wayPoint.stopState)!='undefined'){

                //Находим маркер oldStop;
                i=0;
                while(i<markersArr.length){

                    if((typeof (markersArr[i].source)!='undefined') &&(typeof (markersArr[i].source.t1!='undefined'))&& (markersArr[i].source.t1==oldStopTime)){
                        var oldStopMarker=markersArr[i];
                        //console.log("Oldstop Marker", oldStopMarker);
                        break;
                    }
                    i++;
                }


                //Удаляем из старого маркера  его сервиспоинтс indx, если он есть
                if(oldStopMarker!=undefined) {
                    i=0;
                    while (typeof (oldStopMarker.source.servicePoints)!='undefined' && i<oldStopMarker.source.servicePoints.length){

                        if (oldStopMarker.source.servicePoints[i]==indx){
                            oldStopMarker.source.servicePoints.splice(i, 1);
                            scope.$apply();
                        }
                        i++;
                    }
                }


                if(typeof (stop.source.servicePoints)=='undefined'){
                    console.log('Create 1 first servicePoints');
                    stop.source.servicePoints=[];
                }
                stop.source.servicePoints.push(indx);
                //oldStopMarker.source.servicePoints=oldStop.servicePoints;
                scope.$apply();

            } else {
                // console.log("Dont have stop yet");// У точки не было привязанного стопа. Добавляем
            }

            //// если этим стопом не обслужена еще ни одна точка, то создаем массив, закидываем туда точку и уходим.
            if(typeof (typeof(stop.source)!= 'undefined' && stop.source.servicePoints)=='undefined'){


                console.log('Create 2 first servicePoints');
                stop.source.servicePoints=[];
                stop.source.servicePoints.push(indx);

            }

            makeWayPointMarkerGreen(indx);
            changeFieldsAfterNewConnection(wayPoint, marker, stop);

        }


        // Нахождение ближайшего waypoint к стопу во время его 'drag', и отрисовка линии к нему
        function findNearestPoint(lat, lng){

            var i=0;
            var minDist=0.005;
            while(i<scope.baseCurrentWayPoints.length){


                var LAT=parseFloat(scope.tempCurrentWayPoints[i].LAT);
                var LNG=parseFloat(scope.tempCurrentWayPoints[i].LON);
                var dist=Math.sqrt((LAT-lat)*(LAT-lat)+(LNG-lng)*(LNG-lng));

                if(dist<=minDist){
                    minDist=dist;
                    var  minLAT=LAT;
                    var  minLNG=LNG;
                    console.log("Set of minI", scope.tempCurrentWayPoints[i]);
                    scope.minI=scope.tempCurrentWayPoints[i].NUMBER;
                    scope.minIIndx = i;
                }
                i++;
            }

            if (minDist<0.005){

                try{
                    map.removeLayer(scope.polyline)}
                catch (e) {
                    console.log(e);
                }

                try{
                    scope.spiderMarker.fire('click')}
                catch (e) {
                    console.log(e);
                }

                scope.polyline = L.polyline([[minLAT, minLNG], [lat, lng]], {color: '#5cb85c', weight: 3,
                    opacity: 0.5,
                    smoothFactor: 1});
                map.addLayer(scope.polyline);
                if(scope.tempCurrentWayPoints[scope.minIIndx]==scope.baseCurrentWayPoints[scope.minIIndx]) {


                    findAndClickMarker(scope.tempCurrentWayPoints[scope.minIIndx]);
                } else{
                    // console.log("!!!!Spider");
                }
            }


            if (minDist==0.005) {

                try {
                    map.removeLayer(scope.polyline)
                }
                catch (e) {
                    console.log(e);
                }
            }
        }

        // При зуме карты в любом направлении все омс маркеры теряют свойствоство spiderfy если они его до этого имели.

        scope.drowConnect = false;
        scope.drawMiniMarkers = false
        map.on('zoomend', function(event){
            scope.tempCurrentWayPoints=[];
            if (map.getZoom() > 17 && markersArr != undefined && !scope.drowConnect) {
                if(scope.learConnectWithStopsAndPoints!=undefined){
                    map.removeLayer(scope.learConnectWithStopsAndPoints);}
                drowConnectWithStopsAndPoints();
                scope.drowConnect = true;



            }else if(scope.drowConnect && map.getZoom() <= 17) {
                map.removeLayer(scope.learConnectWithStopsAndPoints);
                scope.drowConnect = false;
            }
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;

            if (map.getZoom()>17 && scope.route && !scope.drawMiniMarkers) {
                if (scope.miniMarkers != undefined) map.removeLayer(scope.miniMarkers);
                addMiniMarkers();
                scope.drawMiniMarkers = true;
            } else {
                if (map.getZoom()<17) {
                   // console.log("try to remove layer" , scope.miniMarkers.length);
                    try{
                    map.removeLayer(scope.miniMarkers);
                    } catch (e) {
                        console.log("Error", e);
                    }

                  //  console.log("try to remove 2 layer" , scope.miniMarkers.length);
                    scope.drawMiniMarkers = false;
                }
            }
        });


        // При клике на маркераб которые сливаются в одну точкуб омс их разбрасывает и выдает новые временные координаты.
        // Однако в массиве маркеров могут быть и стопы и вэйпоинты. Мы используем специальную функцию, которая выберет из маркеров только
        // вэйпоинты и передает их новые координаты в root.currentWayPoints
        oms.addListener('spiderfy', function(event) {
            if(scope.learConnectWithStopsAndPoints!=undefined) {
                map.removeLayer(scope.learConnectWithStopsAndPoints);
            }

            if (scope.dataActivePoint != undefined) scope.drawConnectsActivePoint(scope.dataActivePoint.stopState, scope.dataActivePoint.number, scope.dataActivePoint.TASK_NUMBER);
            createNewTempCurrentWayPoints(event);
            if (map.getZoom() > 17) {
                map.removeLayer(scope.learConnectWithStopsAndPoints);
                drowConnectWithStopsAndPoints();
            }

        });
        function drowConnectWithStopsAndPoints(){
            //console.info(markersArr);
            scope.learConnectWithStopsAndPoints = new L.layerGroup().addTo(map);

            if(markersArr != undefined) {
                for( var i = 0; i < markersArr.length; i++) {
                    if(typeof (markersArr[i].source) == 'undefined' ){
                        continue;
                    }
                    if (markersArr[i].source.servicePoints != undefined) {
                        var servicePointsLat = markersArr[i]._latlng.lat;
                        var servicePointsLng = markersArr[i]._latlng.lng;
                        var arrIndexStopPoints = markersArr[i].source.servicePoints;
                        //console.log(arrIndexStopPoints);
                        var j = 0;
                        while (j < markersArr.length) {
                            if ((typeof (markersArr[j].source) != 'undefined') && (typeof (markersArr[j].source.NUMBER) != 'undefined')) {
                                for (var k = 0; arrIndexStopPoints.length > k; k++) {
                                    if (arrIndexStopPoints[k] == markersArr[j].source.NUMBER) {
                                        if (markersArr[j]._latlng.lat != undefined && markersArr[j]._latlng.lng != undefined && servicePointsLat != undefined && servicePointsLng != undefined ){

                                            //console.log(servicePointsLat, servicePointsLng, markersArr[j]._latlng.lat, markersArr[j]._latlng.lng);

                                        var polyline = new L.Polyline([[servicePointsLat, servicePointsLng], [parseFloat(markersArr[j]._latlng.lat), parseFloat(markersArr[j]._latlng.lng)]], {
                                            color: 'black',
                                            weight: 2,
                                            opacity: 0.5,
                                            smoothFactor: true
                                        });
                                        scope.learConnectWithStopsAndPoints.addLayer(polyline);}
                                    }
                                }
                            }
                            j++;
                        }


                        //console.log ("This is stop", markersArr[i].stopIndx, "and its serve", markersArr[i].source.servicePoints);
                    }
                }
            }

            if (gpsPushMarkers !=undefined) {
                 k=0;

                while(k<gpsPushMarkers.length){
                    var mobilePush=gpsPushMarkers[k];
                    i=0;
                    while (i<markersArr.length) {
                        if (markersArr[i].source != undefined && markersArr[i].source.TASK_NUMBER!=  undefined && markersArr[i].source.TASK_NUMBER==mobilePush.task_ID){
                            break;
                        }
                        i++;
                    }

                    try{
                    var LAT=mobilePush._latlng.lat;
                    var LON=mobilePush._latlng.lng;
                    var lat=+markersArr[i]._latlng.lat;
                    var lon=+markersArr[i]._latlng.lng;
                    var line_points = [
                        [LAT, LON],
                        [lat, lon]];

                    scope.pushPolyline = new L.polyline(line_points, {
                        color: 'orange',
                        weight: 2,
                        opacity: 0.5,
                        smoothFactor: 1
                    });
                    scope.learConnectWithStopsAndPoints.addLayer(scope.pushPolyline);
                    } catch (e) {
                        console.log(e + "1497")
                    }
                    k++;
                }

            }
        }




        //Возврат к нормальным координатам,
        oms.addListener('unspiderfy', function(event) {
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;
            if (scope.dataActivePoint != undefined) scope.drawConnectsActivePoint(scope.dataActivePoint.stopState, scope.dataActivePoint.number, scope.dataActivePoint.TASK_NUMBER);
            if (map.getZoom() > 17) {
                map.removeLayer(scope.learConnectWithStopsAndPoints);
                drowConnectWithStopsAndPoints();
            }
        });


        // Функция необходимая для автоматического раскрытия oms маркеров.
        function createNewTempCurrentWayPoints (data){
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=$.extend(true, {}, scope.baseCurrentWayPoints); //JQerry клонирование  объекта координат для изменения

            var omsPoints=[];
            var i=0;



            // В spider объектах отделяем waypoints от stop и waypoints складываем в массив omsPoints
            while (i<data.length){
                if(typeof(data[i].stopIndx)=='undefined' && data[i].source!=undefined) {
                    omsPoints.push(data[i]);
                }
                i++;
            }
            i=0;
            // добавляем новые координаты для spider объектов. берем из omsPoints
            while (i<omsPoints.length) {
                if (omsPoints[i].source.NUMBER == undefined) {
                    i++;
                    continue;
                }
                var N=omsPoints[i].source.NUMBER;
                console.log("Before error N", N, "omsPoints[i].source", omsPoints[i].source);
                scope.tempCurrentWayPoints[N-1].LAT=omsPoints[i]._latlng.lat;
                scope.tempCurrentWayPoints[N-1].LON=omsPoints[i]._latlng.lng;
                i++
            }

        }

        // Изменяет цвет маркера на зеленый после того, как с ним связали первый стоп
        function makeWayPointMarkerGreen(indx){
            var container;
            var i=0;
            var num;
            console.log(markersArr, "markersArr");
            var size = markersArr.length;
            while (i<size){
                if(typeof (markersArr[i].stopIndx)=='undefined' && typeof (markersArr[i].source)!='undefined') {
                    if (markersArr[i].source.NUMBER==(indx)) {
                        num=markersArr[i].source.NUMBER;
                        container=markersArr[i];
                        //container.remake = true;
                        markersArr[i].source.confirmed=true;
                        markersArr[i].source.rawConfirmed=1;
                        console.log("markersArr[i]", markersArr[i]);
                        break;
                    }
                }
                i++;
            }

            container.setIcon(getIcon(num, 14, '#0a800a', 'white')).update();

            //Если подтверждение точки вызвано не перетягиванием стопа, а подтверждением в таблице, то титл с реально обслуженным временем не добавляеться.
            if (scope.currentDraggingStop== null || scope.currentDraggingStop==undefined ) return;

            var k = container._icon.title.indexOf("Реально обслужено");
            if (k<0){
                container.source.autofill_service_time=scope.currentDraggingStop.source.time;
                //container.source.autofill_change = '1505';
                container._icon.title+="Реально обслужено за: " + mmhh(scope.currentDraggingStop.source.time) + '\n' ;
            } else {
                container._icon.title=container._icon.title.substring(0,k);
                container._icon.title+="Реально обслужено за: " + mmhh(scope.currentDraggingStop.source.time) + '\n' ;
                //container.source.autofill_change = '1510';
                container.source.autofill_service_time=scope.currentDraggingStop.source.time;
            }
        }


        function makeWayPointMarkerBlue(indx){
            var container;
            var i=0;
            var num;
            console.log(markersArr, "markersArr");
            var size = markersArr.length;
            while (i<size){
                if(typeof (markersArr[i].stopIndx)=='undefined' && typeof (markersArr[i].source)!='undefined') {
                    if (markersArr[i].source.NUMBER==(indx)) {
                        num=markersArr[i].source.NUMBER;
                        container=markersArr[i];
                        markersArr[i].source.confirmed=true;
                        markersArr[i].source.rawConfirmed=1;
                        console.log("markersArr[i]", markersArr[i]);
                        break;
                    }
                }
                i++;
            }

            container.setIcon(getIcon(num, 14, '#4482AB', 'white')).update();

            //Если подтверждение точки вызвано не перетягиванием стопа, а подтверждением в таблице, то титл с реально обслуженным временем не добавляеться.
            if (scope.currentDraggingStop== null || scope.currentDraggingStop==undefined ) return;

            var k= container._icon.title.indexOf("Реально обслужено");
            if (k<0){
                container.source.autofill_service_time=scope.currentDraggingStop.source.time;
                //container.source.autofill_change = '1544';
            } else {
                container._icon.title=container._icon.title.substring(0,k);
                container.source.autofill_service_time=scope.currentDraggingStop.source.time;
                //container.source.autofill_change = '1548';
            }
        }


        //Функция находящая ближайший марке, находящийся в oms при приближении к нему маркера остановки
        function findAndClickMarker(obj){
            //console.log("obj LAT LON", obj);
            var i=0;
            while(i<markersArr.length){
                if (typeof (markersArr[i].stopIndx)=='undefined' && typeof (markersArr[i].source)!='undefined' && markersArr[i].source.NUMBER==obj.NUMBER)// выбрасываем маркера остановок и машины, находи марке соответсвующий объекту
                {
                    scope.spiderMarker=markersArr[i];
                    scope.spiderMarker.fire('click');
                }
                i++;
            }

        }


        // Функция менящая поля в объекте точки после связывания с новым стопом.
        //
        function changeFieldsAfterNewConnection(waypoint, marker, stop) {

            waypoint.real_arrival_time = stop.source.t1;
            // Определение и изменение статуса заявки.
            findStatusAndWindowForPoint(waypoint);

            var newStatus=Statuses.getTextStatuses()[waypoint.status+1].name;
            var startSymb=marker.options.title.indexOf("Статус");
            var endSymb=marker.options.title.indexOf("Время при");
            var newTitle=marker.options.title.substring(0,startSymb)+'Статус: '+newStatus+'\n'+marker.options.title.substring(endSymb);
            marker.options.title=newTitle;
            marker._icon.title=newTitle;

            startSymb=marker.options.title.indexOf("Реально обслужено за: ");
            if(startSymb>0) {
                newTitle=marker.options.title.substring(0, startSymb) + "Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
                marker.options.title=newTitle;
                marker._icon.title=newTitle;
            } else {

                marker.options.title+="Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
                marker._icon.title+="Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
            }
            scope.$apply();


        }


        // Функция определяющая статус точки в зависимости от времени связанного с ней стопа
        function findStatusAndWindowForPoint(tmpPoint) {
            tmpPoint.rawConfirmed = 1;


            tmpPoint.windowType = 0;
            if (tmpPoint.working_window[0].start > tmpPoint.real_arrival_time || tmpPoint.real_arrival_time > tmpPoint.working_window[tmpPoint.working_window.length -1].finish) {

                tmpPoint.windowType = "Вне окон";
            } else {
                if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time && tmpPoint.real_arrival_time < tmpPoint.promised_window_changed.finish) {
                    tmpPoint.windowType = "В обещанном";
                } else {
                    for (var l = 0; tmpPoint.working_window != undefined &&  tmpPoint.windowType == 0 && l < tmpPoint.working_window.length; l++) {
                        if (tmpPoint.working_window[l].start < tmpPoint.real_arrival_time && tmpPoint.working_window[l].finish > tmpPoint.real_arrival_time) {
                            tmpPoint.windowType = "В заказанном";

                            break;
                    }
                }}

            }

            if (tmpPoint.windowType == 0) tmpPoint.windowType = "Вне окон";



            tmpPoint.status = undefined;
                if (tmpPoint.real_arrival_time > tmpPoint.working_window[tmpPoint.working_window.length-1].finish) {
                    tmpPoint.status = 1;
                } else if (tmpPoint.real_arrival_time < tmpPoint.working_window[0].start) {
                    tmpPoint.status = 2;
                } else {
                    for (var i=0; (tmpPoint.working_window != undefined && i<tmpPoint.working_window.length); i++ ){
                        if (tmpPoint.working_window[i].start < tmpPoint.real_arrival_time && tmpPoint.working_window[i].finish > tmpPoint.real_arrival_time) {
                            tmpPoint.status = 0;
                            break;
                        }

                }

                    if (tmpPoint.status == undefined) tmpPoint.status = 1;
                }



        }


        // Костыль. Иногда даже при наличии связи стопа и точки, статус точки не "доставлено".
        // В этом случае вызывается эта функцияб после "ручного" связывания
        function changeFieldsAlredyConnectedPoints(waypoint, stop){

            waypoint.rawConfirmed = 1;
            console.log("changeFieldsAlredyConnectedPoints");

            waypoint.windowType = 'Вне окон';
            if (waypoint.promised_window_changed.start < waypoint.real_arrival_time
                && waypoint.promised_window_changed.finish > waypoint.real_arrival_time) {
                waypoint.windowType = 'В обещанном';
                //console.log('В заказанном')
            } else {
                for (var l = 0; waypoint.windows != undefined && l < waypoint.windows.length; l++) {
                    if (waypoint.windows[l].start < waypoint.real_arrival_time
                        && waypoint.windows[l].finish > waypoint.real_arrival_time) {
                        waypoint.windowType = 'В заказанном';
                        //console.log('В обещанном');
                        break;
                    }
                }
            }

            console.log("Окно", rootScope.settings.workingWindowType);
            if (rootScope.settings.workingWindowType == 1) {
                //tmpPoint.findStatus = true;
                if (waypoint.waypoint.TYPE == "WAREHOUSE"){
                    //todo Дописать определение статуса для склада
                    return;
                }




                if (waypoint.real_arrival_time > waypoint.working_window[waypoint.working_window.length-1].finish) {
                    waypoint.status = 1;
                    //console.log("Присваиваем статус 1, 1636");
                } else if (waypoint.real_arrival_time < waypoint.working_window[0].start) {
                    //console.log("Присваиваем статус 2, 1638");
                    waypoint.status = 2;
                } else {
                    //console.log("Присваиваем статус 0, 1641");
                    waypoint.status = 0;
                }
            } else{

                console.log("Начинаем определение статуса");
                if (waypoint.waypoint == undefined || waypoint.waypoint.TYPE == "WAREHOUSE"){
                    //todo Дописать определение статуса для склада
                    return;
                }


                var start, end;
                waypoint.status = undefined;

                if (waypoint.working_window[0] == undefined){
                    end = waypoint.working_window.finish;
                    start = waypoint.working_window.start;
                } else {
                    end = waypoint.working_window[waypoint.working_window.length-1].finish;
                    start = waypoint.working_window[0].start;
                }


                console.log ("Ориентиры", waypoint.real_arrival_time, start, end);
                if (waypoint.real_arrival_time > end)
                {
                    //console.log("Присваиваем статус 1");
                    waypoint.status = 1;

                }

                if (waypoint.real_arrival_time < start)
                {
                    //console.log("Присваиваем статус 2");
                    waypoint.status = 2;
                }

                if (waypoint.status == undefined) {
                    if (waypoint.working_window[0] == undefined) {
                        //console.log("Присваиваем статус 0");
                        waypoint.status = 0;
                    } else {
                        for (var k=0; k<waypoint.working_window.length; k++){
                            if (waypoint.real_arrival_time > waypoint.working_window[k].start && waypoint.real_arrival_time < waypoint.working_window[k].finish ){
                                waypoint.status = 0;
                                //console.log("Присваиваем статус 0");
                                break;
                            }
                        }


                    }


                    if(waypoint.status == undefined) {
                        //точка где то между окнами
                        //console.log("Присваиваем статус 1");
                        waypoint.status = 1; //todo Условно присвоили статус доставлен поздно, если не попали ни в одно окно
                    }

                }

            }

            var newStatus=Statuses.getTextStatuses()[waypoint.status+1].name;

            // нахождение маркера для этого вэйпоинта
            var i=0;
            while (i<markersArr.length){
                if(typeof (markersArr[i].source)!='undefined' && typeof (markersArr[i].source.NUMBER)!='undefined' && markersArr[i].source.NUMBER==waypoint.NUMBER){
                    var marker=markersArr[i];
                    //console.log('FIND markersArr[i]', markersArr[i]);
                }
                i++;
            }


            var startSymb=marker.options.title.indexOf("Статус");
            var endSymb=marker.options.title.indexOf("Время при");
            var newTitle=marker.options.title.substring(0,startSymb)+'Статус: '+newStatus+'\n'+marker.options.title.substring(endSymb);
            marker.options.title=newTitle;
            marker._icon.title=newTitle;
            //console.log("marker", marker);

            //Дописывание в титл информации реально обслужено
            startSymb=marker.options.title.indexOf("Реально обслужено за: ");
            if(startSymb>0) {
                newTitle=marker.options.title.substring(0, startSymb) + "Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
                marker.options.title=newTitle;
                marker._icon.title=newTitle;
            } else {

                marker.options.title+="Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
                marker._icon.title+="Реально обслужено за: " + mmhh(marker.source.stopState.time) + '\n';
            }
            scope.$apply();
        }

        // Слушательб который центрирует карту по точке
        rootScope.$on('findStopOnMarker', function(event, lat, lon){
            //console.log("Recieve ", lat, lon);
            //console.log("MapSize", map.getZoom());
            var currentZoom=map.getZoom();
            currentZoom = currentZoom<=15 ?  18:currentZoom;
            setMapCenter(lat, lon, currentZoom);
        })


        //Слушатель, который меняет данные на карте, после вызова карточки остановки
        rootScope.$on('confirmViewPointEditing', function(event, data, stop){
            console.log("Recieve data", data);
            var i=0;
            while(i<data.length){
                if (data[i].stopTime<0){
                    deleteSomePointsFromStop (data[i].wayPoint, stop);
                    console.log(data[i].wayPoint, stop);
                } else {
                    changeRealServiceTime(data[i].stopTime, data[i].wayPoint, stop);
                }

                i++;
            }
        });


        // Изменение параметра реально обслужено в точке после вызова карточки остановки
        function changeRealServiceTime(time, indx, stop){

            // console.log("I try to change to time", time , "in point", indx, "of stop", stop);
            var i=0;
            while(i<markersArr.length){
                if (markersArr[i].source!=undefined && markersArr[i].source.NUMBER==indx){
                    var container=markersArr[i];
                    // console.log("Find marker", container);

                }
                i++;
            }
            container.source.real_service_time=time*60;

            scope.$emit('addPointHistory', container.source, "change service time", time*60);

            var symbol= container.options.title.indexOf("Реально");//22
            //console.log("Symb", symbol);
            var title=container.options.title.substring(0,symbol+22);
            title+=time+":00";
            container.options.title=title;
            if (container._icon.title!=null){
                container._icon.title=title;}
            //scope.$apply;
        }

        rootScope.$on('unbindPointStop', function(event, row){
           // console.log(markersArr);
            var uniqueID;
           ouer: for(var i = 0; markersArr.length > i; i++ ){
                if('source' in markersArr[i] && 'servicePoints' in markersArr[i].source ){
                    for(var j = 0; markersArr[i].source.servicePoints.length > j; j++){
                        if(markersArr[i].source.servicePoints[j] == row.NUMBER){
                            uniqueID = markersArr[i].source.uniqueID;
                            deleteSomePointsFromStop(row.NUMBER, markersArr[i].source);
                            break ouer;
                        }
                    }
                }
            }

            var reRoute;
            for ( i = 0; i< rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == uniqueID){
                    reRoute = rootScope.data.routes[i];
                }
            }

            rootScope.showProblem(reRoute);

        });


        //функция вызывается, когда из карточки остановки, одна или несколько точек отвязываются от стопа
        function deleteSomePointsFromStop (indx, stop) {
            //console.log("!!!!!!I try to delete point", indx, "from stop", stop);
            console.log(indx, stop);
            // нахождение маркера дя точки, которая отвязывается
            var i=0;
            while(i<markersArr.length){
                if (markersArr[i].source!=undefined && markersArr[i].source.NUMBER==indx){
                    var container=markersArr[i];
                    // console.log("Find marker", container);

                }
                i++;
            }

            //В стопе убирается информация о том, что он обслужил эту точку
            i=0;
            while (i<stop.servicePoints.length){
                //console.log("looking");
                if (stop.servicePoints[i]==indx){
                    stop.servicePoints.splice(i, 1);
                    scope.$apply;
                }
                i++;
            }
            //console.log(stop.servicePoints, "stop.servicePoints");


            if (container.source.incorrect_stop == undefined) container.source.incorrect_stop = [];
            var uniqueId = "" + stop.lat + stop.lon + stop.t1;
            container.source.incorrect_stop.push(uniqueId);



            container.source.stopState.servicePoints=stop.servicePoints;
            //console.log(container.source.stopState.servicePoints);

            // В точке удаляется вся информация связанная со стопом.
            // После этого она становится либо в плане, либо опоздавшей в зависимости от текущего времени
            // и времени этой заявки, соответственно марке меняет цвет и меняется подсказка маркера
            delete container.source.stopState;
            delete container.source.stop_arrival_time;
            delete container.source.autofill_service_time;
            container.source.autofill_delete = '1910';
            delete container.source.real_service_time;
            delete container.source.haveStop;
            delete container.source.real_arrival_time;
            delete container.source.confirmed_by_operator;
            delete container.source.limit;

            scope.$emit('addPointHistory', container.source, "unbind stop point", stop.t1);

            var now =  rootScope.nowTime;
            container.source.status=5;

            var textStatus='опаздывает';
            var color='red';
            if (now < container.source.end_time_ts){
                container.source.status=7;
                textStatus='будет сделано';
                color='#4482AB';
            }
            if(now>container.source.controlled_window.finish){
                container.source.status=4;
                textStatus='время вышло';
            }

            var title=container.options.title;
            var symbol = title.indexOf("Статус");
            var begin=title.substring(0, symbol+8);
            symbol = title.indexOf("Время прибытия");
            var end =  title.substring(symbol);
            symbol=end.indexOf('Реально');
            end=end.substring(0,symbol);
            container.options.title = begin+textStatus+ '\n'+end;
            container._icon.title = begin+textStatus+ '\n'+end;
            container.setIcon(getIcon(container.source.NUMBER, 14, color, 'black')).update();

        }


        function changeWaypointCoordinates (newMarker, lat, lng, confirm){
            //console.log("Start Changes", newMarker, lat, lng);

            // в newmarker вставить новые координаты
            newMarker._latlng.lat=lat;
            newMarker._latlng.lng=lng;
            newMarker.source.LAT=lat;
            newMarker.source.LON=lng;
            newMarker.source.END_LAT=lat;
            newMarker.source.END_LON=lng;
            newMarker.source.waypoint.LAT=lat;
            newMarker.source.waypoint.LON=lng;

            console.log(lat, lng );
            //Сформировать soap data и soap запрос
            rootScope.$emit('pushWaypointTo1С', newMarker.source.waypoint, confirm);
            var route;
            for(var i=0; i<rootScope.data.routes.length; i++){
                if (rootScope.data.routes[i].uniqueID == newMarker.source.uniqueID) route = rootScope.data.routes[i];
            }

            scope.$emit('routeToChange', {
                route: route,
                serverTime: rootScope.nowTime,
                demoMode: false,
                workingWindow: rootScope.settings.workingWindowType,
                allDrivers: rootScope.data.drivers,
                allTransports: rootScope.data.transports

            });

            //var soapStr=testSoap(newMarker.source);
            //console.log(soapStr);
            // Отправить на сервер
            // Проверить результат


        }


        function checkRealServiceTime(data){
            //console.log("Checking Real Time in", data);
            var times=[];
            if(data.source.servicePoints!=undefined){
                var i=0;
                while (i<data.source.servicePoints.length){
                    //console.log("Hey!", data.source.servicePoints[i]+1);
                    var number=data.source.servicePoints[i];
                    var j=0;
                    while(j<markersArr.length){
                        if(markersArr[j].source!=undefined && markersArr[j].source.NUMBER!=undefined && markersArr[j].source.NUMBER==number){
                            //console.log('Marker real service time = ', markersArr[j].source.real_service_time);
                            if(markersArr[j].source.real_service_time!=undefined){
                                times.push(markersArr[j].source.real_service_time);
                            } else {
                                times.push(0);
                            }
                        }

                        j++;
                    }
                    i++;
                }
                //console.log('times', times);
            }
            return times;

        }
        function getTaskTime(data){
            //console.log("Checking Real Time in", data);
            var times=[];
            if(data.source.servicePoints!=undefined){
                var i=0;
                while (i<data.source.servicePoints.length){
                    //console.log("Hey!", data.source.servicePoints[i]+1);
                    var number=data.source.servicePoints[i];
                    var j=0;
                    while(j<markersArr.length){
                        if(markersArr[j].source!=undefined && markersArr[j].source.NUMBER!=undefined && markersArr[j].source.NUMBER==number){
                            //console.log('Marker real service time = ', markersArr[j].source.real_service_time);
                            // if(markersArr[j].source.real_service_time!=undefined){
                            //     times.push(markersArr[j].source.real_service_time);
                            // } else {
                            //     times.push(0);
                            // }
                            times.push(markersArr[j].source.TASK_TIME);
                        }

                        j++;
                    }
                    i++;
                }
                //console.log('times', times);
            }
            return times;

        }



        function updateStoredMarkers(route){
            //console.log("Previous route ", currentRouteID, 'current route ', route);


            // обновление нововго ID отрисованного маршрута
            var oldRouteID=currentRouteID;
            currentRouteID=route.itineraryID + '/' + route.ID;
            if(oldRouteID==currentRouteID){
                //console.log('You are calling the same route');
                return;
            }

            if(markersArr.length==0) return;

            //console.log ("Current routeID", currentRouteID);
            //console.log("current Markers", markersArr);
            var variant={};
            variant.id=oldRouteID;
            variant.marks=markersArr;


            // поиск рисовался ли уже этот маршрут ранее
            var i=0;
            var newRoute=true;
            while(i<allMarkers.length){
                if (oldRouteID==allMarkers[i].id) {

                    //console.log("We already draw this route, rewrite markers");
                    allMarkers[i].marks=markersArr;
                    newRoute=false;
                }


                i++;
            }


            if (newRoute) {
                //console.log('find new route');
                allMarkers.push(variant);
            }

            //console.log("AllMarkers", allMarkers);

            // поиск прорисованных ранее поинтов
            i=0;
            while (i<allMarkers.length){
                if (currentRouteID==allMarkers[i].id){

                    // console.log('This route was drawing not first time');
                    //console.log('route', route, 'markers', allMarkers[i].marks );
                    // обновление в роуте поинтсов, которые были отрисованы до этого
                    var j=0;
                    while (j< route.points.length){
                        var l=0;
                        while (l<allMarkers[i].marks.length){
                            if (allMarkers[i].marks[l].source && route.points[j].$$hashKey == allMarkers[i].marks[l].source.$$hashKey) {
                                //console.log ("Find marker that already exist", route.points[j], "==", allMarkers[i].marks[l].source);

                            }
                            l++;
                        }
                        j++;
                    }
                }
                i++;
            }
            saveUpdateToNode ();
        }
        //function testSoap(waypoint){
        //    var str = '';
        //    str += '<?xml version="1.0" encoding="UTF-8"?><MESSAGE xmlns="http://sngtrans.com.ua">';
        //    str += '<WAYPOINTS> <WAYPOINT ACTION="UPDATE" ';
        //    str += 'ID="'+waypoint.waypoint.ID + '" ';
        //    str += 'LAT="' + waypoint.LAT + '" ';
        //    str += 'LON="' + waypoint.LON + '" ';
        //    str += ' /> </WAYPOINTS>'
        //    str += '</MESSAGE>';
        //    return str;
        //}

        //function saveUpdateToNode (){
        //    // тест отправки измененных данных на ноде сервер.
        //    var data=[];
        //    var i=0;
        //    while (i<allMarkers.length){
        //        var j=0;
        //        while (j<allMarkers[i].marks.length){
        //
        //            if (!allMarkers[i].marks[j].source) {
        //                //console.log("I think this is the car", allMarkers[i].marks[j])
        //            }
        //            data.push(allMarkers[i].marks[j].source);
        //            j++;
        //        }
        //        i++;
        //    }
        //
        //    //console.log("send data from map", data);
        //    rootScope.$emit('saveUpdate', data);
        //}


        //rootScope.$on('logoutsave', saveUpdateToNode);
        

        function drawPushLine (mobilePush){

            //console.log("mobilePush", mobilePush);
            var i=0;
            while (i<markersArr.length) {
                if (markersArr[i].source != undefined && markersArr[i].source.TASK_NUMBER!=  undefined && markersArr[i].source.TASK_NUMBER==mobilePush.task_ID){
                    break;
                }
                i++;
            }

            var LAT=mobilePush._latlng.lat;
            var LON=mobilePush._latlng.lng;
            var lat=+markersArr[i]._latlng.lat;
            var lon=+markersArr[i]._latlng.lng;
            var line_points = [
                [LAT, LON],
                [lat, lon]];

            scope.pushPolyline = new L.polyline(line_points, {
                color: 'orange',
                weight: 2,
                opacity: 0.5,
                smoothFactor: 1
            });
            map.addLayer(scope.pushPolyline);
        }

        function checkTestStops() {
            // console.info(markersArr);
            // console.log("We will work with stop markers", markersArr);
            if(markersArr.length>0) {
                var i = 0;
                while (markersArr[i] && markersArr[i].source != undefined) {
                    if (markersArr[i].source.servicePoints != undefined) {
                        //console.log("This is stop", markersArr[i].stopIndx, "and its serve", markersArr[i].source.servicePoints);
                    }
                    i++;
                }
            }
        }


        function makeWayPointMarkerGrey(indx) {
            var container;
            var i=0;
            var num;
            // console.log(markersArr, "markersArr");
            var size = markersArr.length;
            while (i<size){
                if(typeof (markersArr[i].stopIndx)=='undefined' && typeof (markersArr[i].source)!='undefined') {
                    if (markersArr[i].source.NUMBER==(indx)) {
                        num=markersArr[i].source.NUMBER;
                        container=markersArr[i];
                        markersArr[i].source.confirmed=true;
                        markersArr[i].source.rawConfirmed=1;
                        markersArr[i].source.cancel_time=rootScope.nowTime;
                        console.log("markersArr[i]", markersArr[i]);
                        break;
                    }
                }
                i++;
            }

            container.setIcon(getIcon(num, 14, '#969696', 'white')).update();
        }


        rootScope.$on('makeWaypointGreen', function (event, index) {
            console.log("Send ", (index));
            makeWayPointMarkerGreen(index);
        });
        rootScope.$on('makeWaypointBlue', function(event, index){
            makeWayPointMarkerBlue(index);
        });


        rootScope.$on('makeWaypointGrey', function (event, index) {
            console.log("Send ", (index));
            makeWayPointMarkerGrey(index);
        });

        function strToTstamp(strDate, lockaldata) {
            //console.log(strDate, "strDate");
            var parts = strDate.split(' ');
            var    _date = parts[0].split('.');
            var _time;
            var toPrint=JSON.stringify(strDate);
            try {
                _time = parts[1].split(':');} catch (exeption) {
                console.log(toPrint, "Error", exeption, lockaldata);
            }



            //console.log(strDate, "strDate", "convert to", _date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]);

            return new Date(_date[2], _date[1] - 1, _date[0], _time[0], _time[1], _time[2]).getTime() / 1000;
        }



        function showProblemPoint(route) {
            map.setZoom(18);

            if (!route || !route.problem_point || !route.problem_point.waypoint || !scope.showProblemPoint) return;
            console.log("Координаты самой проблемной точки", parseFloat(route.problem_point.waypoint.LAT), parseFloat(route.problem_point.waypoint.LON));
            setMapCenter(parseFloat(route.problem_point.waypoint.LAT), parseFloat(route.problem_point.waypoint.LON), 18);
            scope.showProblemPoint = false;

        }


        rootScope.$on('showproblem', function(event, route){
            scope.showProblemPoint = true;
            showProblemPoint(route);
        });
        //rootScope.$on('receiveproblem', function (event, cache) {
        //    console.log("map-controller draw route from Cashe", cache);
        //    // console.log("FOR ALeXANDER", JSON.stringify(cache.routes[0].plan_geometry));
        //    // clearMap();
        //    // drawRealRoute(route);
        //})


        //функция помещающая все маркеры на видимую часть карты
        rootScope.$on('showAllMarkers', function(event){
            //console.log("Центрируем по всем маркерам");
            if (markersArr == undefined || markersArr.length == 0) return;
            var globalMarkers = [];
            globalMarkers = globalMarkers.concat(markersArr);
            //console.log(globalMarkers.length);
            for (var i=0; i< globalMarkers.length; i++){
             //   if (globalMarkers[i].source && globalMarkers[i].source.waypoint && globalMarkers[i].source.waypoint.TYPE) console.log ("globalMarkers[i].source.waypoint.TYPE", globalMarkers[i].source.waypoint.TYPE)
                if (globalMarkers[i].source != undefined && (globalMarkers[i].source.waypoint == undefined || globalMarkers[i].source.waypoint.TYPE == "WAREHOUSE" || globalMarkers[i].source.waypoint.TYPE == "PARKING")){
                    globalMarkers.splice(i,1);
                    i--;
                }
            }
            if (gpsPushMarkers == undefined || gpsPushMarkers.length == 0) gpsPushMarkers=[];
            globalMarkers = globalMarkers.concat(gpsPushMarkers);
            displayMarkers (globalMarkers);

        });


        function displayMarkers (globalMarkers) {
            //console.log("Работает функция отображения всех маркеров");
            //console.log("Zoom1", map.getZoom());
            //console.log(globalMarkers);
            if (globalMarkers != undefined && globalMarkers.length > 0) {
                var group = new L.featureGroup(globalMarkers);
                map.fitBounds(group.getBounds());
            }
            //console.log("Zoom2", map.getZoom());
            var newZoom = map.getZoom();
            //map.setZoom(newZoom); // Добавка
            //console.log(map.getCenter());
            var centre = map.getCenter();
            var zoom = map.getZoom(), //> 15 ? map.getZoom() : 15,
                offset = map.getSize(),
                tmp = map.project(new L.LatLng(centre.lat, centre.lng), zoom).subtract(
                    [
                        position.width / 2 - offset.x / 2 + position.offset.left,
                        position.height / 2 - offset.y / 2 + position.offset.top
                    ]),
                target = map.unproject(tmp, zoom);

            //добавка вместо
            // setMapCenter(target.lat, target.lng, newZoom);
           setTimeout(function(){
               //console.log("Before timeout ", target.lat, target.lng, newZoom);
               map.setView([target.lat, target.lng], newZoom);
               //map.setZoom(newZoom);
               //console.log("After Timeout", map.getCenter(), map.getZoom());
           }, 200);
            //console.log("Zoom3", map.getZoom());om());
        }


        rootScope.$on('redrawUpdate', function (event, states, id) {
            console.log("Готовимся к прорисовке");
            redrawTrac (states, id)
        });


        rootScope.$on('updatePush', function (event, data) {

        });


        function redrawTrac(states, id) {
            //для начала стираются старые данные
            var m = map;
            var route;
            for (var j=0; j< markersArr.length; j++){
                if (markersArr[j].redrawer) m.removeLayer(markersArr[j]);
            }

            //
            for (var i in m._layers) {
                //console.log("1", m._layers[i]);
                if (m._layers[i].redrawer == true)  m.removeLayer(m._layers[i]);

            }
            for (i=0; i<rootScope.data.routes.length; i++) {
                if (rootScope.data.routes[i].filterId == id) {
                   route = rootScope.data.routes[i];
                    break;
                }
            }

            console.log("Данные стерты, начинаем прорисовку новых элементов");
            drawStates (states, route);

            //теперь прорисовываются новые


        }

        function drawStates (states, route) {
        //console.log(" I will draw states");
   //         for (var i=0; i<states.length; i++ ) {
                console.log("I gona redraw real route", route);
                var start = strToTstamp(route.START_TIME);
                var end = strToTstamp(route.END_TIME);
                if (end<route.max_arrival_time) end = route.max_arrival_time;
                // console.log("Start", start, "End", end);


                var track = states,
                //pushes = route.pushes,
                    tmpVar,
                    polyline,
                    iconIndex = 14,
                    tmpTitle = '',
                    color = '',
                    stopIndx,
                    stopTime,
                    timeThreshold = rootScope.settings.timeThreshold * 60,
                    drawStops = $('#draw-stops').is(':checked'),    // отрисовать стопы
                //drawStops = true;

                //drawPushes = $('#draw-pushes').is(':checked');  // отрисовать нажатия если в таблице стоит галочка.
                    drawPushes = true;  // Железно отрисовывать пуши.

                //stops=[];
                //markersArr=[];
                //gpsPushMarkers=[];

                if( track!=undefined) {
                    //todo тестово отладочный блок
                    for (var i = 1; i < track.length; i++) {
                        if (track[i].t1 != track[i-1].t2){

                            console.log ("Проверка трека показала разрыв", track[i-1] , track[i] );
                            //if (rootScope.data.settings.user == "ids.kalko" || rootScope.data.settings.user == "ids.dsp") alert("Обнаружен разрыв трека! Обратитесь к разработчику");
                        }
                    }


                    for (i = 0; i < track.length; i++) {
                        // console.log(i, "track", track[i], track[i].coords.constructor !== Array);
                        if (track[i].coords == null || track[i].coords.constructor !== Array || track[i].coords == undefined ) {
                            console.log("Это какой то бракованный СТЭЙТ. Я не буду его рисовать", track[i]);
                            //if (track[i].constructor !== Array ) {
                            //    console.log("Найден гаденыш, убиваем");
                            //    track.splice(i,1);
                            //}
                            //if (rootScope.settings.user == "ids.kalko" || rootScope.settings.user == "ids.dsp") alert("Обнаружен поломаный стейт, обратитесь к разработчику");
                            continue;
                        }
                        //console.log(" track[i].time",  track[i].coords);


                        //todo снять комментарий, когда правильно рассчитают время финиша
                        // console.log("Времена", track[i].coords[0].t, start, timeThreshold);
                        if( track[i].coords[0] == undefined || track[i].coords[0].t < start-timeThreshold-60*90) {
                            //console.log("Its too early track");
                            continue
                        }; //не отрисовываем стопы больше чем за (указано в настройках) минут от начала маршрута.
                        if( track[i].coords[0].t > end+timeThreshold) {
                            //console.log("Its too past track");
                            break;
                        } //не отрисовываем стопы больше чем за (указано в настройках) минут после окончания маршрута.


                        ;
                        // отрисовать движение
                        if (track[i].state == 'MOVE') {
                                var speed = track[i].dist/track[i].time;
                                color = getPolylineColor(speed);

                                polyline = new L.Polyline(track[i].coords, {
                                color: color,
                                weight: 3,
                                opacity: 1,
                                smoothFactor: 1
                            });
                            track[i].inRoute = true;
                            if (i + 1 == track.length) {
                                polyline.redrawer = true;
                                markersArr.push(polyline);
                            }
                            //polyline.on('click', function (event) {
                            //    console.log(event.target);
                            //});
                            polyline.addTo(map);
                        } else if (track[i].state == 'ARRIVAL') { // отрисовать стоп
                            // если отрисовка стопов выключена, пропустить итерацию
                            //stops.push(track[i]);

// todo раскомментировать когда будет правильно рассчитываться время финиша
                            if (track[i].coords.t1 < start - rootScope.settings.timeThreshold*60 - 60*90) continue; //не отрисовываем стопы больше чем за (указано в настройках) минут от начала маршрута
                            if (track[i].coords.t1 > end + rootScope.settings.timeThreshold*60) break; //не отрисовываем стопы больше чем за (указано в настройках) минут после окончания маршрута.

                            if (!drawStops) continue;


                            stopIndx = (parseInt(i / 2 + 0.5) - 1);
                            stopTime = mmhh(track[i].time);
                            tmpVar = stopTime.split(':');
                            if (tmpVar[1] != '00') {
                                stopTime = parseInt(tmpVar[0]) + 1;
                            } else {
                                stopTime = parseInt(tmpVar[0]);
                            }

                            // формирование всплывающей подсказки для стопов
                            // Закомментирована лишняя информация

                            //tmpTitle = 'Остановка #' + stopIndx + '\n';
                            tmpTitle = 'Остановка в: ' + formatDate(new Date(track[i].t1 * 1000));
                            //tmpTitle += 'Время отбытия: ' + formatDate(new Date(track[i].t2 * 1000)) + '\n';
                            tmpTitle += ' (' + mmhh(track[i].time) + ')' + '\n';

                            //if (i + 1 < track.length) {
                            //    tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist + track[i + 1].dist) + ' метра(ов)';
                            //    polyline = new L.Polyline([track[i].coords[0], track[i].coords[track[i].coords.length - 1]], {
                            //        color: color,
                            //        weight: 3,
                            //        opacity: 0.8,
                            //        smoothFactor: 1
                            //    });
                            //
                            //    polyline.addTo(map);
                            //} else if (i + 1 == track.length) {
                            //    tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist) + ' метра(ов)';
                            //}


                            //tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon], - заменили эту строку на нижнюю
                            //чтобы стоп рисовался по усредненным данным, а не по первым. В связи с этим, необходимо добавить линию от конца трека до стопа.

                            tmpVar = L.marker([track[i].lat, track[i].lon],
                                {
                                    'title': tmpTitle,
                                    'draggable': true
                                });
                            tmpVar.source = track[i];
                            //console.log("tmpVar", tmpVar);


                            // удаляем в стейте лишние координаты
                            if (tmpVar.source.coords.length > 2) {
                                tmpVar.source.coords.splice(1, tmpVar.source.coords.length - 2);
                            }

                            tmpVar.stopIndx = stopIndx;
                            tmpVar.routeRealTrackIndx = i;
                            tmpVar.setIcon(getIcon(stopTime, 15, 'white', 'black'));

                            var LAT = +track[i].coords[0].lat;
                            var LON = +track[i].coords[0].lon;
                            var lat = +track[i].lat;
                            var lon = +track[i].lon;

                            //console.log(" LATLON",LAT, LON, lat, lon );

                            var stopPolyline = new L.Polyline([[LAT, LON], [lat, lon], track[i].coords[track[i].coords.length - 1]], {
                                color: color,
                                weight: 3,
                                opacity: 0.8,
                                smoothFactor: 1
                            });
                            if (i == track.length-1 )stopPolyline.redrawer = true;


                            //stopPolyline.on('click', function(event) {
                            //    console.log(event.target);
                            //});
                            stopPolyline.addTo(map);


                            tmpVar.on('click', function (event) {

                                var localData = event.target;
                                // if(localData.source.servicePoints == undefined ){
                                //     return;
                                // }
                                var timeData = checkRealServiceTime(localData);
                                var taskTime = getTaskTime(localData);
                                console.log(taskTime);
                                rootScope.$emit('pointEditingPopup', localData, timeData, taskTime);


                            });


                            tmpVar.on('drag', function (event) {

                                oms.removeMarker(event.target);
                                scope.currentDraggingStop = event.target;
                                findNearestPoint(this._latlng.lat, this._latlng.lng);

                            });


                            tmpVar.on('dragend', function (event) {


                                var container = event.target;
                                oms.addMarker(container);
                                container.setLatLng([container.source.lat, container.source.lon]).update();


                                try {
                                    map.removeLayer(scope.polyline)
                                }
                                catch (e) {
                                    console.log(e);
                                }

                                try {
                                    scope.spiderMarker.fire('click')
                                }
                                catch (e) {
                                    console.log(e);
                                }

                                //console.log(scope.baseCurrentWayPoints[scope.minI].stopState, "connect", scope.currentDraggingStop.source);

                                scope.baseCurrentWayPoints[scope.minIIndx].stopState = scope.currentDraggingStop.source;// тщательно оттестировать

                                if (confirm("Хотите связать стоп " + Math.round(scope.currentDraggingStop.source.time / 60) + " минут с точкой " + (scope.minI) + " ?")) {
                                } else {
                                    return
                                }
                                // console.log(scope.currentDraggingStop, scope.minI);

                                checkAndAddNewWaypointToStop(scope.currentDraggingStop, scope.minI);
                                scope.currentDraggingStop = null;
                                console.log("отправляем на пересчет", scope.baseCurrentWayPoints[scope.minIIndx].route_id);
                                rootScope.$emit('reFact', scope.baseCurrentWayPoints[scope.minIIndx].route_id);// Пересчитать фактический порядок выполнения точек
                                rootScope.$emit('checkInCloseDay');


                                var reRoute;
                                for (var i=0; i< rootScope.data.routes.length; i++){
                                    if (rootScope.data.routes[i].uniqueID == scope.baseCurrentWayPoints[scope.minIIndx].uniqueID){
                                        reRoute = rootScope.data.routes[i];
                                    }
                                }
                                rootScope.showProblem(reRoute);
                                scope.$emit('routeToChange', {
                                    route: reRoute,
                                    serverTime: rootScope.nowTime,
                                    demoMode: scope.demoMode,
                                    workingWindow: rootScope.settings.workingWindowType,
                                    allDrivers: rootScope.data.drivers,
                                    allTransports: rootScope.data.transports

                                });


                            });

                            addMarker(tmpVar);

                        } else if (track[i].state == 'NO_SIGNAL' || track[i].state == 'NO SIGNAL') {
                            color = '#de5bc0';
                            polyline = new L.Polyline(track[i].coords, {
                                color: color,
                                weight: 3,
                                opacity: 0.8,
                                smoothFactor: 1
                            });

                            polyline.addTo(map);
                        } else if (track[i].state == 'START') {
                            color = 'yellow';
                        }


                        if (i + 1 == track.length) {
                            if ((route.lastPosition && track[i].t2 && track[i].t2 > route.lastPosition) || route.lastPosition == undefined) route.lastPosition = track[i].t2;
                            var indx = track[i].coords.length - 1;
                            tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon],
                                {
                                    'title': 'Последнее известное положение транспортного средства\n' +
                                    'Время сигнала: ' + formatDate(new Date(route.lastPosition * 1000))
                                });
                            //console.log("Разница во времени", route.lastPosition, "И ", track[i].t2);
                            tmpVar.setIcon(getIcon(i, 7, color, 'black'));

                            tmpVar.on('click', function (event) {
                                console.log("Это машина", event.target);

                            });
                            tmpVar.redrawer = true;
                            //tmpVar.on('click', function (event){
                            //    //console.log (tmpVar._latlng);
                            //    console.log(event.target);
                            //    redrawTrac(event.target);
                            //});
                            addMarker(tmpVar);
                            var opacity;
                            scope.opacityMode ? opacity = 0.2 : 1;
                            tmpVar.setOpacity(opacity);
                            //map.addLayer(tmpVar);
                            //oms.addMarker(tmpVar);

                            //console.log(map.getZoom(), "Zoom", track[i].coords[indx].lat, track[i].coords[indx].lon);

                            //Установить центр карты в текущее положение машины, если оно определено.
                            if (track[i].coords[indx].lat && track[i].coords[indx].lon && rootScope.carCentre) {
                                setMapCenter(track[i].coords[indx].lat, track[i].coords[indx].lon, 13);
                                rootScope.carCentre = false;

                            } else {
                                console.log("Something wrong with car real coord");
                            }

                        }


                    }
                }




    //        }
        }

        function shiftToOpacityMode(target) {
            if (!target) return;
            console.log("TARGET", target);
            scope.opacityMode = !scope.opacityMode;
            var localM = map;

            if (scope.opacityMode) {
                for (var i in localM._layers) {
                    if (localM._layers[i].source &&
                        typeof (localM._layers[i].source) == 'object' &&
                        localM._layers[i].source.number == target.source.TASK_NUMBER) {
                        localM._layers[i].setOpacity(1);
                        continue;
                    }

                    if (target == localM._layers[i]){
                        localM._layers[i].setOpacity(1);
                        continue;
                    }

                    if (target.source.stopState &&
                        target.source.stopState == localM._layers[i].source){
                        localM._layers[i].setOpacity(1);
                        continue;
                    }

                    if (localM._layers[i].source &&
                        localM._layers[i].source.lat &&
                        localM._layers[i].source.lon &&
                        localM._layers[i].source.state &&
                        localM._layers[i].source.state == "ARRIVAL"
                    ) {

                        //console.log(parseFloat(target.source.LAT), parseFloat(target.source.LON), parseFloat(localM._layers[i].source.lat), parseFloat(localM._layers[i].source.lon));
                        var dist = getDistanceFromLatLonInM(parseFloat(target.source.LAT), parseFloat(target.source.LON), parseFloat(localM._layers[i].source.lat), parseFloat(localM._layers[i].source.lon))
                        var opacity = 0.1 + rootScope.data.settings.stopRadius * 0.8 / (rootScope.data.settings.stopRadius + dist);
                        //console.log("stop", localM._layers[i], "dist", dist, "opacity", opacity);
                        localM._layers[i].setOpacity(parseFloat(opacity));
                        continue;
                    }


                    try{
                        if ((localM._layers[i].source && typeof (localM._layers[i].source) != 'number')|| localM._layers[i].redrawer) localM._layers[i].setOpacity(0.3);
                    } catch(e) {
                        console.log(e, localM._layers[i]);

                    }

                }
            } else {

                for (var i in localM._layers) {

                    try{
                        if ((localM._layers[i].source && typeof (localM._layers[i].source) != 'number')|| localM._layers[i].redrawer)localM._layers[i].setOpacity(1);
                    } catch(e) {
                        console.log(e, localM._layers[i]);

                    }

                }
            }

        }


        function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
            try{
                var R = 6371; // Radius of the earth in km
                var dLat = deg2rad(lat2 - lat1);  // deg2rad below
                var dLon = deg2rad(lon2 - lon1);
                var a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2)
                    ;
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                var d = R * c; // Distance in km
                //console.log("lat1", lat1, "lon1", lon1, "lat2", lat2, "lon2", lon2, ' dist', d*1000);
                return d * 1000;

                function deg2rad(deg) {
                    return deg * (Math.PI / 180)
                }

            } catch (e) {
                log.error( "Ошибка "+ e + e.stack);
            }
        }


        function getPolylineColor (speed) {
            var color;
            if (speed > 13.9) color = "#040acc";
            if (speed > 11.1 && speed <= 13.9) color = "#28c1e0";
            if (speed > 8.3 && speed <= 11.1) color = "#02e05b";
            if (speed > 5.5 && speed <= 8.3) color = "#41e002";
            if (speed > 2.8 && speed <= 5.5) color = "#e07502";
            if (speed > 1.4 && speed <= 2.8) color = "#cc4106";
            if (speed <= 1.4) color = "";
            return color;
        }

        function addMiniMarkers(){
            if(scope.route.real_track == undefined || scope.route.real_track.length == 0) return;

            scope.miniMarkers = new L.layerGroup().addTo(map);

            for (var i = 0; i < scope.route.real_track.length; i++){
                if (scope.route.real_track[i].state != "MOVE" ||
                    scope.route.real_track[i].coords == undefined ||
                    !scope.route.real_track[i].inRoute ||
                    scope.route.real_track[i].coords.length < 6) continue;
                    var color = getPolylineColor(scope.route.real_track[i].dist/scope.route.real_track[i].time);
                for (var j = 5; j < scope.route.real_track[i].coords.length; j = j+5){


                    var circleLocation = new L.LatLng(scope.route.real_track[i].coords[j].lat, scope.route.real_track[i].coords[j].lon),
                        circleOptions = {
                            color: color,
                            fillColor: scope.route.real_track[i]
                        };

                    var circle = new L.Circle(circleLocation, 0.4, circleOptions);
                    circle.source = i*j;
                    var date = new Date(scope.route.real_track[i].coords[j].t*1000);
                    var hours = date.getHours();
                    var minutes = "0" + date.getMinutes();
                    var seconds = "0" + date.getSeconds();
                    var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
                    circle.bindPopup("" + formattedTime + " скорость " + parseInt((scope.route.real_track[i].dist/scope.route.real_track[i].time)*3.6) + " км/ч");
                    //circle.on('mouseover', function(event) {console.log("mouseover", event.target.source)});
                    scope.miniMarkers.addLayer(circle)
                }

                //console.log("Move finded");
            }

        }

        rootScope.$on('changeCarTitle', function(event, time){
            var marker = markersArr.filter(function(item){
                if (item.options && item.options.title) {
                    return item.options.title.startsWith("Последнее известное положение транспортного средства");
                }
            });
            //console.log("Найдена машина", marker);
            if (!marker || !marker.options || !marker.options.title) return;
            //console.log("Title", marker.options.title.substring(0, marker.options.title.length-8));
            marker.options.title = marker.options.title.substring(0, marker.options.title.length-8);
            marker.options.title += formatDate(time * 1000);
        });

        rootScope.$on('clearGeoMarker', function(event){
            if (scope.geoMarker) {
                map.removeLayer(scope.geoMarker);
            }
        });


        rootScope.$on('addGeoMarker', function(event, lat, lon){
            console.log("Try to Add GeoMarker");
            if (scope.geoMarker) {
                map.removeLayer(scope.geoMarker);
            }
                console.log("Create Marker");
                scope.geoMarker = L.marker([lat, lon], {'title': "GeoMarker"});
                //scope.geomarker.setIcon(getIcon('G', "1", "blue", 'black'));
                map.addLayer(scope.geoMarker);
                setMapCenter(lat, lon, 18);
        })

    }]);

