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

            alert("Start drawing");
            //console.log(route , 'route')

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
                } else if (track[i].state == 'ARRIVAL') { // отрисовать стоп
                    // если отрисовка стопов выключена, пропустить итерацию
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

                    tmpVar.setIcon(getIcon(stopTime, iconIndex, color, 'black'));


                    //tmpVar.pointConnection = 12;

                    tmpVar.on('mouseover', function(event){

                        console.log("MouseOver Stop");
                        console.log("stop event " +
                            "", event);
                        console.log("this is stop ", this);
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




            for (var i = 0; i < points.length; i++) {
                title = '';
                point = points[i];

                if (point.TASK_NUMBER == '') {
                    title = 'Склад\n';
                } else {


                ////////////////tested information

                    //if(point.NUMBER==13){
                    //    console.log(point , " point " , point.NUMBER);
                    //}





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


                //if(point.stopState!=null){
                //    title+="stopState" + point.stopState.lat +'\n';
                //
                //}




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



               // tmpVar.id=route.ID +" "+ route.itineraryID +" "+stopIndx;
                // console.log(route);


                tmpVar.source=point;
                //
                //tmpVar.on('dblclick', function(event){
                //
                //    //console.log("this is point ", this);
                //    //console.log("event point ", event);
                //    //console.log("and point is ", point);
                //
                //    console.log ("point ", point.LAT, " ", point.LON, " waypoint ", this);
                //    //stopDragend(event);
                //
                //});



                tmpVar.on('dblclick', function(event){

                    alert("dblClick on Point");


                });


                // Установка новых координат для вэйпоинта при переноске маркера-point
                tmpVar.on('dragend', function(event){

                    var newMarker = event.target;

                    var message = "Вы собираетесь изменить координаты " + newMarker.source.waypoint.NAME + " \n"
                        + "Старые координаты " + newMarker.source.waypoint.LAT + " " + newMarker.source.waypoint.LON + "\n"
                        + "Новые координаты " + event.target.getLatLng().lat + " " + event.target.getLatLng().lng;

                    if (confirm(message)){
                        alert("Координаты изменены");
                        newMarker.source.waypoint.LAT=event.target.getLatLng().lat;
                        newMarker.source.waypoint.LON=event.target.getLatLng().lng;

                    } else {

                        newMarker.setLatLng([newMarker.source.waypoint.LAT, newMarker.source.waypoint.LON]  ,{draggable:'true'}).update();


                    }

                });

                tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
                addMarker(tmpVar);
            }
        }

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
            console.log("adMarker start", marker);

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
            tmpVar.setIcon(getIcon(point.NUMBER, 14, tmpBgColor, tmpFColor));
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
                    console.log("disable map");
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
            console.log(map + " Map postinit");
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


        //map.on('dblclick', function(event){
        //
        //    console.log("Map on Click", event.target);
        //
        //    var marker = new L.marker(event.latlng, { draggable:'true'});
        //    marker.on('dragend', function(event){
        //        var marker = event.target;
        //        var position = marker.getLatLng();
        //        alert(position);
        //        console.log(typeof (position));
        //        marker.setLatLng(position,{draggable:'true'}).update();
        //        marker.setIcon(getIcon("35", 14, 'yellow', 'black'));
        //
        //    });
        //
        //    addMarker(marker);
        //
        //    //map.addLayer(marker);
        //
        //
        //});
        //


        //var popup = new L.Popup();
        //oms.addListener('click', function(marker) {
        //    popup.setContent("Click on OMS");
        //    popup.setLatLng(marker.getLatLng());
        //    map.openPopup(popup);
        //});


        function stopDragend(e){
            alert("stop " + e);
            console.log(e);
        }

        function pointDragend(e){
            alert("point " + e);
        }


        function pointDblClick(e){
            console.log(e);
            alert("point " + e);
        }

    }]);
