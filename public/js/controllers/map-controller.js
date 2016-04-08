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
            maximized = false,                          // развернута ли панелька на весь браузер
            textStatuses = Statuses.getTextStatuses(),  // расширенная информация о статусах
            STATUS = Statuses.getStatuses();            // коды статусов




        initMap();
        addListeners();

        // отрисовать комбинированный маршрут
        function drawCombinedRoute(route) {
            drawRealRoute(route);

            var i = route.points.length - 1;
            // i будет равна первой выполненной задаче с конца маршрута
            for (; i >= 0; i--) {
                if (route.points[i].status == STATUS.FINISHED ||
                    route.points[i].status == STATUS.FINISHED_LATE ||
                    route.points[i].status == STATUS.FINISHED_TOO_EARLY) break;
            }

            // если трек есть и последняя задача в марщруте не выполнена - отрисовать остаток планового маршрута
            if (route.real_track != undefined && i != route.points.length - 1) {
                var lastCoords = route.real_track[route.real_track.length - 1].coords,
                    carPos = lastCoords[lastCoords.length - 1],
                    url = './findpath2p/' + carPos.lat + '&' + carPos.lon + '&' + route.points[i + 1].LAT
                        + '&' + route.points[i + 1].LON;
                http.get(url).
                    success(function (data) {
                        var geometry = getLatLonArr(data);
                        addPolyline(geometry, 'blue', 3, 0.5, 1, true);
                        if (carPos != null && geometry[0] != null) {
                            addPolyline([[carPos.lat, carPos.lon], [geometry[0].lat, geometry[0].lng]], 'blue', 3, 0.5, 1, true);
                        }
                        drawPlannedRoute(route.plan_geometry, i);
                    });

            }

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
                drawPushes = $('#draw-pushes').is(':checked');  // отрисовать нажатия
                stops=[];

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
                    stops.push(track[i]);

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
                    tmpTitle = 'Остановка #' + stopIndx + '\n';
                    tmpTitle += 'Время прибытия: ' + formatDate(new Date(track[i].t1 * 1000)) + '\n';
                    tmpTitle += 'Время отбытия: ' + formatDate(new Date(track[i].t2 * 1000)) + '\n';
                    tmpTitle += 'Длительность: ' + mmhh(track[i].time) + '\n';

                    if (i + 1 < track.length) {
                        tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist + track[i + 1].dist) + ' метра(ов)';
                        polyline = new L.Polyline([track[i].coords[0], track[i].coords[track[i].coords.length - 1]], {
                            color: color,
                            weight: 3,
                            opacity: 0.8,
                            smoothFactor: 1
                        });

                        polyline.addTo(map);
                    } else if (i + 1 == track.length) {
                        tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist) + ' метра(ов)';
                    }

                    tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon],
                        {'title': tmpTitle,
                        'draggable': true});
                    tmpVar.source=track[i];
                    tmpVar.stopIndx=stopIndx;
                    tmpVar.routeRealTrackIndx=i;
                    tmpVar.setIcon(getIcon(stopTime, 15, 'white', 'black'));


                    tmpVar.on('dblclick', function(event){
                        var localData=event.target;
                        rootScope.$emit('pointEditingPopup', localData );

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
                        };

                        try{
                            scope.spiderMarker.fire('click')}
                        catch (e) {
                            console.log(e);
                        };

                        scope.baseCurrentWayPoints[scope.minI].stopState=scope.currentDraggingStop.source;// тщательно оттестировать
                        checkAndAddNewWaypointToStop(scope.currentDraggingStop, scope.minI);

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
                    map.panTo(new L.LatLng(track[i].coords[indx].lat, track[i].coords[indx].lon));
                }
            }


            // если не включена отрисовка нажатий - выход из функции
            if (!pushes) return;

            for (var i = 0; drawPushes && i < pushes.length; i++) {
                tmpTitle = 'Время нажатия: ' + pushes[i].time + '\n';
                tmpTitle += 'Время нажатия GPS: ' + pushes[i].gps_time + '\n';
                tmpTitle += 'ID задания: ' + pushes[i].number;

                tmpVar = L.marker([pushes[i].lat, pushes[i].lon], {'title': tmpTitle});
                tmpVar.setIcon(getIcon('S', iconIndex, 'orange', 'black'));
                addMarker(tmpVar);
            }
        }

        // получить текстовый статус по коду статуса
        function getTextStatuses(status) {
            for (var i = 0; i < textStatuses.length; i++) {
                if (textStatuses[i].value === status) return textStatuses[i];
            }
        }

        // отрисовать все точки (задачи) на карте
        function drawAllPoints(points) {
            var tmpVar,
                title,
                tmpStatus,
                tmpBgColor,
                tmpFColor,
                point;


            scope.baseCurrentWayPoints=points;
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;

            for (var i = 0; i < points.length; i++) {
                title = '';
                point = points[i];

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


                //Добавление титра реально обслужено. Если нет введенного в ручную параметра real_service_time то ставится автоматически время всего стопа
                if(typeof (point.autofill_service_time)!='undefined'){
                    title += 'Реально обслужено за: ' + mmhh((point.real_service_time) || (point.autofill_service_time)) + '\n';
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
                    tmpBgColor = '#5cb85c';
                    tmpFColor = 'black';
                }

                tmpVar.source=point;

                // Установка новых координат для вэйпоинта при переноске маркера-point
                tmpVar.on('dragend', function(event){

                    var newMarker = event.target;

                    var message = "Вы собираетесь изменить координаты " + newMarker.source.waypoint.NAME + " \n"
                        + "Старые координаты " + newMarker.source.waypoint.LAT + " " + newMarker.source.waypoint.LON + "\n"
                        + "Новые координаты " + event.target.getLatLng().lat.toPrecision(8) + " " + event.target.getLatLng().lng.toPrecision(8);

                    if (confirm(message)){
                        alert("Координаты изменены");
                        newMarker.source.waypoint.LAT=event.target.getLatLng().lat.toPrecision(8);
                        newMarker.source.waypoint.LON=event.target.getLatLng().lng.toPrecision(8);

                    } else {

                        newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();
                    }

                });



                tmpVar.on('dblclick', function(event){
                    console.log('this is waypoint ', event.target);
                });

                tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
                addMarker(tmpVar);

            }
        }

        rootScope.$on('confirmViewPointEditing', function(event, data){}); // прием события от подтвержденной карточки остановки

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
            if (pos.top < y && pos.left < x &&
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
                drawCombinedRoute(route);
            });

            rootScope.$on('drawRealTrack', function (event, route) {
                drawRealRoute(route);
                drawAllPoints(route.points)
            });

            rootScope.$on('drawPlannedTrack', function (event, route) {
                drawPlannedRoute(route.plan_geometry, 0);
                drawAllPoints(route.points);
            });

            rootScope.$on('drawRealAndPlannedTrack', function (event, route) {
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

            console.log("Make map opacity")
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


            console.log(map + " Map preinit");

            map = new L.Map('map', {
                center: new L.LatLng(50.4412776, 30.6671281),
                zoom: 11,
                layers: [
                    new L.TileLayer('http://tms{s}.visicom.ua/2.0.0/planet3/base_ru/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        tms: true,
                        attribution: 'Данные карт © 2013 ЧАО «<a href="http://visicom.ua/">Визиком</a>»',
                        subdomains: '123'
                    })
                ]
            });

            L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);

            oms = new OverlappingMarkerSpiderfier(map);
            console.log("oms",oms,oms.prototype);
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
        }

        // установить центр карты
        console.log("Centre map");
        function setMapCenter(lat, lon) {
            var zoom = map.getZoom() > 15 ? map.getZoom() : 15,
                offset = map.getSize(),
                tmp = map.project(new L.LatLng(lat, lon), zoom).subtract(
                    [
                        position.width / 2 - offset.x / 2 + position.offset.left,
                        position.height / 2 - offset.y / 2 + position.offset.top
                    ]),
                target = map.unproject(tmp, zoom);
            map.setView(target, zoom);
        }





        // Проверка на добавление в остановку обслуживания точки, которая уже обслуживается этим стопом.
        function checkAndAddNewWaypointToStop(stop, indx){




            //Нахождение маркера соответсвующего найденному waypoint
            var i=0;
            while(i<markersArr.length){
                if((typeof (markersArr[i].source)!='undefined') && (typeof (markersArr[i].source.NUMBER)!='undefined') && (markersArr[i].source.NUMBER==(indx+1))){
                    var marker=markersArr[i];
                    console.log('marker for waypoint', marker)
                    break;
                };
                i++;
            }


            var wayPoint=marker.source;
            console.log("I want to connect", stop, 'with point', wayPoint, "and indx", indx);
            wayPoint.haveStop=true;


            var oldStopTime=wayPoint.real_arrival_time;
            console.log('oldStopTime', oldStopTime);

            //var oldStop= $.extend(true, {}, wayPoint.stopState);













            // Проверка на аккуратность и внимательность человекаю Не пытается ли он связать уже связанные точку и стоп
            if(typeof(wayPoint.stopState)!='undefined' && typeof(wayPoint.stopState.servicePoints)!='undefined'){
                var i=0;
                var duplicate=false;

                console.log("Start Duplicate Checkfor wayPoint", wayPoint.stopState.servicePoints, "and indx", indx  );

                while( i<wayPoint.stopState.servicePoints.length){
                    console.log("looking Duplicate", typeof (wayPoint.stopState.servicePoints));
                    if(wayPoint.stopState.servicePoints[i]==indx){
                        console.log("FIND DUPLICATE")
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
                        console.log("Oldstop Marker", oldStopMarker);
                        break;
                    }
                    i++;
                }


                //Удаляем из старого маркера шз его сервиспоинтс indx
                var i=0;
                while (typeof (oldStopMarker.source.servicePoints)!='undefined' && i<oldStopMarker.source.servicePoints.length){

                    if (oldStopMarker.source.servicePoints[i]==indx){
                        oldStopMarker.source.servicePoints.splice(i, 1);
                        scope.$apply();
                    }
                    i++;
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

                if(dist<minDist){
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
                };

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

        map.on('zoomend', function(event){
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;
        })


        // При клике на маркераб которые сливаются в одну точкуб омс их разбрасывает и выдает новые временные координаты.
        // Однако в массиве маркеров могут быть и стопы и вэйпоинты. Мы используем специальную функцию, которая выберет из маркеров только
        // вэйпоинты и передает их новые координаты в root.currentWayPoints
        oms.addListener('spiderfy', function(event) {
            createNewTempCurrentWayPoints(event);

        });


        //Возврат к нормальным координатам,
        oms.addListener('unspiderfy', function(event) {
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=scope.baseCurrentWayPoints;
        });

        function createNewTempCurrentWayPoints (data){
            scope.tempCurrentWayPoints=[];
            scope.tempCurrentWayPoints=$.extend(true, {}, scope.baseCurrentWayPoints); //JQerry клонирование  объекта координат для изменения

            var omsPoints=[];
            var i=0;
            // В spider объектах отделяем waypoints от stop и waypoints складываем в массив omsPoints
            while (i<data.length){
                if(typeof(data[i].stopIndx)=='undefined') {
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
             var size = markersArr.length;
             while (i<size){
               if(typeof (markersArr[i].stopIndx)=='undefined' && typeof (markersArr[i].source)!='undefined') {
                   if (markersArr[i].source.NUMBER==(indx+1)) {
                       num=markersArr[i].source.NUMBER;
                       container=markersArr[i];
                   }
               }
                 i++;
             }

             container.setIcon(getIcon(num, 14, '#5cb85c', 'black')).update();
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
                        break;
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
                    console.log('FIND markersArr[i]', markersArr[i])
                    break;
                }
                i++;
            }


            var startSymb=marker.options.title.indexOf("Статус");
            var endSymb=marker.options.title.indexOf("Время при");
            var newTitle=marker.options.title.substring(0,startSymb)+'Статус: '+newStatus+'\n'+marker.options.title.substring(endSymb);
            marker.options.title=newTitle;
            //marker._icon.title=newTitle;
            console.log("marker", marker);

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

    }]);


