// контроллер для работы с картой
angular.module('MTMonitor').controller('MapController', ['$scope', '$rootScope', '$http', 'Statuses',
    function (scope, rootScope, http, Statuses) {
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


        initMap();
        addListeners();

        // отрисовать комбинированный маршрут
        function drawCombinedRoute(route) {
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

            //console.log("route", route)

            if (!route || !route.real_track) return;


            var track = route.real_track,
                pushes = route.pushes,
                tmpVar,
                polyline,
                iconIndex = 14,
                tmpTitle = '',
                color = '',
                stopIndx,
                stopTime,
                drawStops = $('#draw-stops').is(':checked'),    // отрисовать стопы

                //drawPushes = $('#draw-pushes').is(':checked');  // отрисовать нажатия если в таблице стоит галочка.
                drawPushes = true;  // Железно отрисовывать пуши.

                //stops=[];
                markersArr=[];
                gpsPushMarkers=[];


            for (var i = 0; i < track.length; i++) {
                if (track[i].coords == null || track[i].coords.constructor !== Array) continue;

                color = '#5cb85c';
                // отрисовать движение
                if (track[i].state == 'MOVE') {
                    polyline = new L.Polyline(track[i].coords, {
                        color: color,
                        weight: 3,
                        opacity: 0.8,
                        smoothFactor: 1
                    });

                    polyline.addTo(map);
                } else if (track[i].state == 'ARRIVAL')
                { // отрисовать стоп
                    // если отрисовка стопов выключена, пропустить итерацию
                    //stops.push(track[i]);

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
                    tmpTitle += ' (' + mmhh(track[i].time) + ')'+ '\n';

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
                        {'title': tmpTitle,
                        'draggable': true});
                    tmpVar.source=track[i];
                    //console.log("tmpVar", tmpVar);


                    // удаляем в стейте лишние координаты
                    if(tmpVar.source.coords.length>2){
                        tmpVar.source.coords.splice(1,tmpVar.source.coords.length-2);
                    }

                    tmpVar.stopIndx=stopIndx;
                    tmpVar.routeRealTrackIndx=i;
                    tmpVar.setIcon(getIcon(stopTime, 15, 'white', 'black'));

                    var LAT=+track[i].coords[0].lat;
                    var LON=+track[i].coords[0].lon;
                    var lat=+track[i].lat;
                    var lon=+track[i].lon;

                    //console.log(" LATLON",LAT, LON, lat, lon );

                    var stopPolyline = new L.Polyline([[LAT, LON], [lat, lon], track[i].coords[track[i].coords.length - 1]], {
                        color: color,
                        weight: 3,
                        opacity: 0.8,
                        smoothFactor: 1
                    });

                    stopPolyline.addTo(map);


                    tmpVar.on('click', function(event){

                        var localData=event.target;
                        // if(localData.source.servicePoints == undefined ){
                        //     return;
                        // }
                        var timeData = checkRealServiceTime(localData);
                        var taskTime = getTaskTime(localData);
                        console.log(taskTime);
                        rootScope.$emit('pointEditingPopup', localData , timeData, taskTime);


                    });


                    tmpVar.on('drag', function(event) {

                        oms.removeMarker(event.target);
                        scope.currentDraggingStop=event.target;
                        findNearestPoint(this._latlng.lat, this._latlng.lng);

                    });



                    tmpVar.on('dragend', function(event){


                        var container=event.target;
                        oms.addMarker(container);
                        container.setLatLng([container.source.lat, container.source.lon]).update();


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

                        //console.log(scope.baseCurrentWayPoints[scope.minI].stopState, "connect", scope.currentDraggingStop.source);

                        scope.baseCurrentWayPoints[scope.minI].stopState=scope.currentDraggingStop.source;// тщательно оттестировать

                        if (confirm("Хотите связать стоп " + Math.round(scope.currentDraggingStop.source.time/60) + " минут с точкой " + (scope.minI+1) + " ?")) {
                        } else {
                            return
                        }
                       // console.log(scope.currentDraggingStop, scope.minI);
                        checkAndAddNewWaypointToStop(scope.currentDraggingStop, scope.minI);
                        scope.currentDraggingStop=null;

                    });

                    addMarker(tmpVar);

                } else if (track[i].state == 'NO_SIGNAL' || track[i].state == 'NO SIGNAL') {
                    color = '#5bc0de';
                } else if (track[i].state == 'START') {
                    color = 'yellow';
                }




                if (i + 1 == track.length) {
                    var indx = track[i].coords.length - 1;
                    tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon],
                        {
                            'title': 'Текущее положение транспортного средства\n' +
                            'Время сигнала: ' + formatDate(new Date(track[i].t2 * 1000))
                        });
                    tmpVar.setIcon(getIcon(i, 7, color, 'black'));
                    addMarker(tmpVar);
                    //console.log(map.getZoom(), "Zoom", track[i].coords[indx].lat, track[i].coords[indx].lon);

                    //Установить центр карты в текущее положение машины, если оно определено.
                    if(track[i].coords[indx].lat && track[i].coords[indx].lon) {
                        setMapCenter(track[i].coords[indx].lat, track[i].coords[indx].lon, 13);

                    } else {
                        console.log("Something wrong with car real coord");
                    }

                }


            }


            // тестовоотладочная функция проверки. Выбирает все привязанные стопы и печатает их с обслуженными точками.
            checkTestStops();
            // если не включена отрисовка нажатий - выход из функции

            // Закомментирован выбор рисовать или нет пуши на карте. По умолчанию рисовать.
            //if (!pushes) return;





            //console.log("????????????????????????? drawPushes", drawPushes, 'pushes',pushes);

            for (var i = 0; drawPushes && pushes && i < pushes.length; i++) {

                //console.log("Start drawing Pushes");

                tmpTitle = 'Время нажатия: ' + pushes[i].time + '\n';
                tmpTitle += 'Время нажатия GPS: ' + pushes[i].gps_time + '\n';
                tmpTitle += 'ID задания: ' + pushes[i].number;

                tmpVar = L.marker([pushes[i].lat, pushes[i].lon], {'title': tmpTitle});
                tmpVar.setIcon(getIcon('S', iconIndex, 'orange', 'black'));
                tmpVar.task_ID=pushes[i].number;




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
            scope.$apply;

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
                if (point.TASK_NUMBER == '') {
                    title = 'Склад\n';
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

                if (point.waypoint != null) {
                    title += 'Адрес: ' + point.waypoint.ADDRESS + '\n';
                   // title += 'Клиент: ' + point.waypoint.NAME + '\n';
                   // title += 'Комментарий: ' + point.waypoint.COMMENT + '\n';
                }


                //Добавление титра реально обслужено. Если нет введенного в ручную параметра real_service_time то ставится автоматически время всего стопа
                if(typeof (point.autofill_service_time)!='undefined'){
                    title += 'Реально обслужено за: ' + mmhh((point.real_service_time) || (point.autofill_service_time)) + '\n';
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

                if (!point.confirmed && (point.status == STATUS.FINISHED ||
                    point.status == STATUS.FINISHED_LATE || point.status == STATUS.FINISHED_TOO_EARLY)) {
                    tmpBgColor = 'yellow';
                    tmpFColor = 'black';
                }




                tmpVar.source=point;

                // Установка новых координат для вэйпоинта при переноске маркера-point
                tmpVar.on('dragend', function(event){
                    //dragendPoint = event.target;
                   // var newMarker = event.target;

                    rootScope.gpsConfirm=false;// подтверждена ли точка по GPS
                    scope.dragendPoint = event.target;// объект события при драге  маркера-point
                    rootScope.$emit('askGPSConfirmPoint', {point: event.target.source.waypoint});//point index controller

                   if(rootScope.gpsConfirm){
                        var message="Эта точка ранее уже была подтверждена GPS данными. Вы уверены, что хотите изменить ее координаты?";
                        if (!confirm(message)){
                            var newMarker= scope.dragendPoint;
                                newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();
                            return;}

                   };

                    var message = 'Вы собираетесь изменить координаты ' + scope.dragendPoint.source.waypoint.NAME + '\n'
                        + 'Старые координаты ' + scope.dragendPoint.source.waypoint.LAT + " " + scope.dragendPoint.source.waypoint.LON + '\n'
                        + 'Новые координаты ' + event.target.getLatLng().lat.toPrecision(8) + " " + event.target.getLatLng().lng.toPrecision(8);
                    rootScope.$emit('ReqChengeCoord', {message: message});

                });



                //используется только для отладки и настройки
                tmpVar.on('dblclick', function(event){
                    console.log('this is waypoint ', event.target);
                });


                if (point.TASK_NUMBER <0) {
                    tmpVar.setIcon(getIcon(point.NUMBER, 3, 'red', tmpFColor));
                } else {
                tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
                }

                addMarker(tmpVar);

            }


           // console.log('Finish draw markersArr.', markersArr, "points", points, "Only Points", markersArr.length==points.length );

            //Если рисовался только трек из точек, то центрировать карту по первой точке.
            if(markersArr.length==points.length) {
                setMapCenter(markersArr[0]._latlng.lat, markersArr[0]._latlng.lng, 13);
            }

            rootScope.clickOff=false;
            scope.$apply;

        }


        rootScope.$on('ResChengeCoord', function(event, bool, confirm){
           var newMarker = scope.dragendPoint;
            if (bool == 'true'){

                changeWaypointCoordinates(newMarker, newMarker.getLatLng().lat.toPrecision(8), newMarker.getLatLng().lng.toPrecision(8), confirm);
                rootScope.$emit('showNotification', {text:'Координаты изменены', duration:2000});
                $('#notification_wrapper').css('opacity', '1');
                //newMarker.source.waypoint.LAT=event.target.getLatLng().lat.toPrecision(8);
                //newMarker.source.waypoint.LON=event.target.getLatLng().lng.toPrecision(8);

            } else {

                //console.log(newMarker, "newMarker");

                newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();
            }
        });

        //rootScope.$on('confirmViewPointEditing', function(event, data){}); // прием события от подтвержденной карточки остановки

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
                point.status == STATUS.FINISHED_LATE || point.status == STATUS.FINISHED_TOO_EARLY)) {
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

            rootScope.$on('clearMap', function () {
                clearMap();
            });

            rootScope.$on('setMapCenter', function (event, data) {
                setMapCenter(data.lat, data.lon);
            });

            rootScope.$on('drawCombinedTrack', function (event, route) {
                //console.log('i gona  draw combined route', route);
                updateStoredMarkers(route);
                drawCombinedRoute(route);
                scope.route = route;
            });

            rootScope.$on('drawRealTrack', function (event, route) {
                //console.log('i gona  draw real route', route);
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
                center: new L.LatLng(50.4412776, 30.6671281),
                zoom: 11,
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

        // очистить карту
        function clearMap() {
            console.log("Clear Map");
            //updateStoredMarkers();

            var m = map;
            for (i in m._layers) {
                if (m._layers[i]._path != undefined) {
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
        }


        // установить центр карты
        //console.log("Centre map");
        function setMapCenter(lat, lon, newZoom) {

            var zoom = map.getZoom() > 15 ? map.getZoom() : 15,
                offset = map.getSize(),
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


            //Нахождение маркера соответсвующего найденному waypoint
            var i=0;
            while(i<markersArr.length){
                if((typeof (markersArr[i].source)!='undefined') && (typeof (markersArr[i].source.NUMBER)!='undefined') && (markersArr[i].source.NUMBER==(indx+1))){
                    var marker=markersArr[i];
                    //console.log('marker for waypoint', marker)
                    break;
                }
                i++;
            }


            var wayPoint=marker.source;
           // console.log("I want to connect", stop, 'with point', wayPoint, "and indx", indx);
            wayPoint.haveStop=true;


            var oldStopTime=wayPoint.real_arrival_time;
           // console.log('oldStopTime', oldStopTime);

            //var oldStop= $.extend(true, {}, wayPoint.stopState);

            wayPoint.real_service_time = 0;


            // Проверка на аккуратность и внимательность человекаю Не пытается ли он связать уже связанные точку и стоп
            if(typeof(wayPoint.stopState)!='undefined' && typeof(wayPoint.stopState.servicePoints)!='undefined'){
                var i=0;
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

                wayPoint.rawConfirmed =1;
                makeWayPointMarkerGreen(indx);
                changeFieldsAlredyConnectedPoints(wayPoint, stop);
                if(duplicate){return};
            }



            if(typeof (wayPoint.stopState)!='undefined'){

                //Находим маркер oldStop;
                var i=0;
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
                    var i=0;
                    while (typeof (oldStopMarker.source.servicePoints)!='undefined' && i<oldStopMarker.source.servicePoints.length){

                        if (oldStopMarker.source.servicePoints[i]==indx){
                            oldStopMarker.source.servicePoints.splice(i, 1);
                            scope.$apply();
                        }
                        i++;
                    }
                }


                if(typeof (stop.source.servicePoints)=='undefined'){
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
                    scope.minI=i;
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
                if(scope.tempCurrentWayPoints[scope.minI]==scope.baseCurrentWayPoints[scope.minI]) {


                    findAndClickMarker(scope.tempCurrentWayPoints[scope.minI]);
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
        });


        // При клике на маркераб которые сливаются в одну точкуб омс их разбрасывает и выдает новые временные координаты.
        // Однако в массиве маркеров могут быть и стопы и вэйпоинты. Мы используем специальную функцию, которая выберет из маркеров только
        // вэйпоинты и передает их новые координаты в root.currentWayPoints
        oms.addListener('spiderfy', function(event) {
            if(scope.learConnectWithStopsAndPoints!=undefined) {
                map.removeLayer(scope.learConnectWithStopsAndPoints);
            }

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
                                    if (arrIndexStopPoints[k] + 1 == markersArr[j].source.NUMBER) {
                                        var polyline = new L.Polyline([[servicePointsLat, servicePointsLng], [markersArr[j]._latlng.lat, markersArr[j]._latlng.lng]], {
                                            color: 'black',
                                            weight: 2,
                                            opacity: 0.5,
                                            smoothFactor: true
                                        });
                                        scope.learConnectWithStopsAndPoints.addLayer(polyline);
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
                var k=0;

                while(k<gpsPushMarkers.length){
                    var mobilePush=gpsPushMarkers[k];
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
                    scope.learConnectWithStopsAndPoints.addLayer(scope.pushPolyline);

                    k++;
                }

            }
        }


        //Возврат к нормальным координатам,
        oms.addListener('unspiderfy', function(event) {
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;
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
                var N=omsPoints[i].source.NUMBER;
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
                   if (markersArr[i].source.NUMBER==(indx+1)) {
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

             container.setIcon(getIcon(num, 14, '#0a800a', 'white')).update();

             //Если подтверждение точки вызвано не перетягиванием стопа, а подтверждением в таблице, то титл с реально обслуженным временем не добавляеться.
             if (scope.currentDraggingStop== null || scope.currentDraggingStop==undefined ) return;

             var k= container._icon.title.indexOf("Реально обслужено");
             if (k<0){
                 container.source.autofill_service_time=scope.currentDraggingStop.source.time;
                 container._icon.title+="Реально обслужено за: " + mmhh(scope.currentDraggingStop.source.time) + '\n';
             } else {
                 container._icon.title=container._icon.title.substring(0,k);
                 container._icon.title+="Реально обслужено за: " + mmhh(scope.currentDraggingStop.source.time) + '\n';
                 container.source.autofill_service_time=scope.currentDraggingStop.source.time;
             }
        };


        //Функция находящая ближайший марке, находящийся в oms при приближении к нему маркера остановки
        function findAndClickMarker(obj){
           // console.log("obj LAT LON", obj.LAT);
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

            waypoint.real_arrival_time=stop.source.t1;
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
            if (tmpPoint.promised_window_changed.start < tmpPoint.real_arrival_time) {
                console.log("window type2");
                tmpPoint.windowType = 2;
            } else {
                for (var l = 0; tmpPoint.windows != undefined && l < tmpPoint.windows.length; l++) {
                    if (tmpPoint.windows[l].start < tmpPoint.real_arrival_time) {
                        tmpPoint.windowType = 1;
                        console.log("window type1");
                        break;
                    }
                }
            }


            if (tmpPoint.rawConfirmed !== -1) {
                if (tmpPoint.real_arrival_time > tmpPoint.working_window.finish) {
                    tmpPoint.status = STATUS.FINISHED_LATE;
                } else if (tmpPoint.real_arrival_time < tmpPoint.working_window.start) {
                    tmpPoint.status = STATUS.FINISHED_TOO_EARLY;
                } else {
                    tmpPoint.status = STATUS.FINISHED;
                }
            }




        }


        // Костыль. Иногда даже при наличии связи стопа и точки, статус точки не "доставлено".
        // В этом случае вызывается эта функцияб после "ручного" связывания
        function changeFieldsAlredyConnectedPoints(waypoint, stop){

            waypoint.rawConfirmed = 1;
            console.log("changeFieldsAlredyConnectedPoints");

            waypoint.windowType = 0;
            if (waypoint.promised_window_changed.start < waypoint.real_arrival_time) {
                console.log("window type2");
                waypoint.windowType = 2;
            } else {
                for (var l = 0; waypoint.windows != undefined && l < waypoint.windows.length; l++) {
                    if (waypoint.windows[l].start < waypoint.real_arrival_time) {
                        waypoint.windowType = 1;
                        console.log("window type1");

                    }
                }
            }

            if (waypoint.rawConfirmed !== -1) {
                if (waypoint.real_arrival_time > waypoint.working_window.finish) {
                    waypoint.status = STATUS.FINISHED_LATE;
                } else if (waypoint.real_arrival_time < waypoint.working_window.start) {
                    waypoint.status = STATUS.FINISHED_TOO_EARLY;
                } else {
                    waypoint.status = STATUS.FINISHED;
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
            //console.log("Recieve data", data);
           var i=0;
            while(i<data.length){
                if (data[i].stopTime<0){
                   deleteSomePointsFromStop (data[i].wayPoint, stop)
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
                if (markersArr[i].source!=undefined && markersArr[i].source.NUMBER==(indx+1)){
                    var container=markersArr[i];
                   // console.log("Find marker", container);

                }
                i++;
            }
            container.source.real_service_time=time*60;
            var symbol= container.options.title.indexOf("Реально");//22
            //console.log("Symb", symbol);
            var title=container.options.title.substring(0,symbol+22);
            title+=time+":00";
            container.options.title=title;
            if (container._icon.title!=null){
            container._icon.title=title;}
            //scope.$apply;
        }


        //функция вызывается, когда из карточки остановки, одна или несколько точек отвязываются от стопа
        function deleteSomePointsFromStop (indx, stop) {
            //console.log("!!!!!!I try to delete point", indx, "from stop", stop);

            // нахождение маркера дя точки, которая отвязывается
            var i=0;
            while(i<markersArr.length){
                if (markersArr[i].source!=undefined && markersArr[i].source.NUMBER==(indx+1)){
                    var container=markersArr[i];
                   // console.log("Find marker", container);

                }
                i++;
            }

            //В стопе убирается информация о том, что он обслужил эту точку
            var i=0;
            while (i<stop.servicePoints.length){
                //console.log("looking");
                if (stop.servicePoints[i]==indx){
                    stop.servicePoints.splice(i, 1);
                    scope.$apply;
                }
                i++;
            }
            //console.log(stop.servicePoints, "stop.servicePoints");
            container.source.stopState.servicePoints=stop.servicePoints;
            //console.log(container.source.stopState.servicePoints);

            // В точке удаляется вся информация связанная со стопом.
            // После этого она становится либо в плане, либо опоздавшей в зависимости от текущего времени
            // и времени этой заявки, соответственно марке меняет цвет и меняется подсказка маркера
            delete container.source.stopState;
            delete container.source.stop_arrival_time;
           delete container.source.autofill_service_time;
           delete container.source.real_service_time;
           delete container.source.haveStop;
           delete container.source.real_arrival_time;
            var now =  parseInt(Date.now()/1000);
            container.source.status=5;
            var textStatus='опаздывает';
            var color='red';
            if (now < container.source.end_time_ts){
                container.source.status=7
                textStatus='запланирован';
                color='blue';
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

            //Сформировать soap data и soap запрос
            rootScope.$emit('pushWaypointTo1С', newMarker.source.waypoint, confirm);


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
                    var number=data.source.servicePoints[i]+1;
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
                    var number=data.source.servicePoints[i]+1;
                    var j=0;
                    while(j<markersArr.length){
                        if(markersArr[j].source!=undefined && markersArr[j].source.NUMBER!=undefined && markersArr[j].source.NUMBER==number){
                            //console.log('Marker real service time = ', markersArr[j].source.real_service_time);
                            // if(markersArr[j].source.real_service_time!=undefined){
                            //     times.push(markersArr[j].source.real_service_time);
                            // } else {
                            //     times.push(0);
                            // }
                            console.log(123123123);
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

        function saveUpdateToNode (){
            // тест отправки измененных данных на ноде сервер.
            var data=[];
            var i=0;
            while (i<allMarkers.length){
                var j=0;
                while (j<allMarkers[i].marks.length){

                    if (!allMarkers[i].marks[j].source) {
                        //console.log("I think this is the car", allMarkers[i].marks[j])
                    }
                    data.push(allMarkers[i].marks[j].source);
                    j++;
                }
                i++;
            }

            //console.log("send data from map", data);
            rootScope.$emit('saveUpdate', data);
        }


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
                while (markersArr[i].source != undefined) {
                    if (markersArr[i].source.servicePoints != undefined) {
                        //console.log("This is stop", markersArr[i].stopIndx, "and its serve", markersArr[i].source.servicePoints);
                    }
                    i++;
                }
            }
        }



        rootScope.$on('makeWaypointGreen', function (event, index) {
            console.log("Send ", (index-1));
           makeWayPointMarkerGreen(index-1);
        });

    }]);


