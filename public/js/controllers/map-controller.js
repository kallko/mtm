angular.module('MTMonitor').controller('MapController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {
    var map,
        oms,
        position,
        inside = false,
        holderEl = null,
        changingWindow = false,
        markersArr = [],
        maximized = false,
        highlightedPoint;

    initMap();
    addListeners();
    // setTransparent();

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
        drawAllPoints(route.points)
    });

    rootScope.$on('drawRealAndPlannedTrack', function (event, route) {
        drawPlannedRoute(route.plan_geometry, 0);
        drawRealRoute(route);
        drawAllPoints(route.points)
    });

    rootScope.$on('highlightPointMarker', function (event, point) {
        highlightPointMarker(point);
    });

    function highlightPointMarker(point) {
        //console.log('highlightPointMarker');
        //console.log(point);

        //highlightedPoint = L.marker([point.LAT, point.LON],
        //    {'title': 'title'});
        //highlightedPoint.setIcon(getIcon('TEST', 14, 'white', 'black'));
        //map.addLayer(highlightedPoint);
        //oms.addMarker(highlightedPoint);
    }

    function drawCombinedRoute(route) {
        //var real_track = route.plan_geometry,
        //    planned_track = route.plan_geometry;

        drawRealRoute(route);

        var i = route.points.length - 1;
        for (; i >= 0; i--) {
            if (route.points[i].status == 0) break;
        }

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

    function drawPlannedRoute(track, startIndx) {
        if (track == null) return;

        var tmp,
            geometry = [];

        for (var i = startIndx; i < track.length; i++) {
            if (track[i] == null) continue;
            geometry = geometry.concat(getLatLonArr(track[i]));
        }

        addPolyline(geometry, 'blue', 3, 0.5, 1, true);
    }

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
            drawStops = $('#draw-stops').is(':checked'),
            drawPushes = $('#draw-pushes').is(':checked');

        for (var i = 0; i < track.length; i++) {
            if (track[i].coords == null || track[i].coords.constructor !== Array) continue;

            color = '#5cb85c';
            if (track[i].state == 'MOVE') {
                polyline = new L.Polyline(track[i].coords, {
                    color: color,
                    weight: 3,
                    opacity: 0.8,
                    smoothFactor: 1
                });

                polyline.addTo(map);
                //continue;
            } else if (track[i].state == 'ARRIVAL') {
                stopIndx = (parseInt(i / 2 + 0.5) - 1);
                stopTime = mmhh(track[i].time);
                tmpVar = stopTime.split(':');
                if (tmpVar[1] != '00') {
                    stopTime = parseInt(tmpVar[0]) + 1;
                } else {
                    stopTime = parseInt(tmpVar[0]);
                }

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
                    //polyline = new L.Polyline(track[i].coords, {
                    //    color: 'red',
                    //    weight: 3,
                    //    opacity: 0.8,
                    //    smoothFactor: 1
                    //});
                    //
                    //polyline.addTo(map);
                }

                tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon],
                    {'title': tmpTitle});
                tmpVar.setIcon(getIcon(stopTime, iconIndex, color, 'black'));
                if (drawStops) addMarker(tmpVar);
                //continue;
            } else if (track[i].state == 'NO_SIGNAL' || track[i].state == 'NO SIGNAL') {
                color = '#5bc0de';
                //continue;
            } else if (track[i].state == 'START') {
                color = 'yellow';
                //continue;
            }

            if (i + 1 == track.length) {
                var indx = track[i].coords.length - 1;
                tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon],
                    {'title': 'Текущее положение транспортного средства\n' +
                    'Время сигнала: ' + formatDate(new Date(track[i].t2 * 1000))});
                tmpVar.setIcon(getIcon(i, 7, color, 'black'));
                addMarker(tmpVar);
            }
        }

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

    function drawAllPoints(points) {
        var tmpVar,
            title;
        for (var i = 0; i < points.length; i++) {
            title = '';
            if (points[i].TASK_NUMBER == '') {
                title = 'Склад\n';
            } else {
                title = 'Точка #' + (points[i].NUMBER) + '\n';
                title += 'Статус: ' + (points[i].status == 0 ? 'выполнена' : 'НЕ выполнена') + '\n';
            }

            title += 'Время прибытия: ' + points[i].arrival_time_hhmm + '\n';
            title += 'Время отбытия: ' + points[i].end_time_hhmm + '\n';
            title += 'Время выполнения задачи: ' + mmhh(points[i].TASK_TIME) + '\n';
            title += 'Временное окно: ' + points[i].AVAILABILITY_WINDOWS + '\n';
            title += 'Время простоя: ' + mmhh(points[i].DOWNTIME) + '\n';
            title += 'Расстояние: ' + points[i].DISTANCE + ' метра(ов)\n';
            title += 'Время на дорогу к точке: ' + mmhh(points[i].TRAVEL_TIME) + '\n';
            if (points[i].waypoint != null) {
                title += 'Адрес: ' + points[i].waypoint.ADDRESS + '\n';
                title += 'Клиент: ' + points[i].waypoint.NAME + '\n';
                title += 'Комментарий: ' + points[i].waypoint.COMMENT + '\n';
            }

            tmpVar = L.marker([points[i].LAT, points[i].LON], {
                'title': title
            });
            //tmpVar.pointIndx = i;
            tmpVar.setIcon(getIcon(points[i].NUMBER, 14, '#7EDDFC', 'black'));

            addMarker(tmpVar);
        }
    }

    function mmhh(time) {
        return (parseInt(time / 60)).padLeft() + ':' + (time % 60).padLeft();
    }

    Number.prototype.padLeft = function (base, chr) {
        var len = (String(base || 10).length - String(this).length) + 1;
        return len > 0 ? new Array(len).join(chr || '0') + this : this;
    };

    function addMarker(marker) {
        map.addLayer(marker);
        oms.addMarker(marker);
        markersArr.push(marker);
    }

    function addPolyline(geometry, color, weight, opacity, smoothFactor, decorator) {
        var polyline = new L.Polyline(geometry, {
                color: color,
                weight: weight,
                opacity: opacity,
                smoothFactor: smoothFactor
            });

        polyline.addTo(map);

        //if (decorator) {
        //    L.polylineDecorator(geometry, {
        //        opacity: 1,
        //        patterns: [
        //            {offset: 125, repeat: 250, symbol: L.Symbol.arrowHead({pixelSize: 14, pathOptions: {fillOpacity: 1, weight: 0, color: color}})}
        //        ]
        //    }).addTo(map);
        //}
    }

    function formatDate(d) {
        var dformat =
            //    [ d.getDate().padLeft(),
            //    (d.getMonth()+1).padLeft(),
            //    d.getFullYear()].join('/')+
            //' ' +
            [d.getHours().padLeft(),
                d.getMinutes().padLeft(),
                d.getSeconds().padLeft()].join(':');
        return dformat;
    }

    function checkMouseInRect(pos, x, y) {
        if (pos.top < y && pos.left < x &&
            pos.top + pos.height > y && pos.left + pos.width > x) {
            // console.log('Inside!');
            return true;
        }
        // console.log('Outside!');
        return false;
    }

    function addListeners() {
        $(window).resize(resize);
        resize();

        holderEl = $('#transparent-map-holder');
        holderEl.parent().on('mouseenter', function (event) {
            if (!inside && !changingWindow) {
                checkMapWindowRect();
            }
        });

        $('.lm_drag_handle').on('mousedown', function () {
            changingWindow = true;
            disableMap();
        });

        $('.lm_drag_handle').on('mouseup', function () {
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

        $('.lm_maximise').on('click', function() {
            maximized = $(this).attr('title') === 'minimise';
            if (maximized) disableMap();
        })
    }

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

        $('body').off('mousemove');
        $('body').mousemove(function (event) {
            //console.log("$('body').mousemove", position, event.clientX, event.clientY);
            if (!checkMouseInRect(position, event.clientX, event.clientY)) {
                disableMap();
            }
        });
    }

    function disableMap() {
        inside = false;
        $('.lm_goldenlayout').css('pointer-events', 'auto');
        $('body').off('mousemove');
    }

    function setTransparent() {
        var el = holderEl.parent();

        for (var i = 0; i < 4; i++) {
            if (i == 3 && el[0] != undefined) {
                $(el[0].firstChild).hide();
            }

            el.css('opacity', '0');
            el = el.parent();
        }
    }

    function initMap() {
        //map = L.map('map').setView([50.4412776, 30.6671281], 11);
        //L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        //    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        //}).addTo(map);

        map = new L.Map('map', {
            center: new L.LatLng(50.4412776, 30.6671281),
            zoom: 11,
            layers : [
                new L.TileLayer('http://tms{s}.visicom.ua/2.0.0/planet3/base_ru/{z}/{x}/{y}.png',{
                    maxZoom: 19,
                    tms : true,
                    attribution : 'Данные карт © 2013 ЧАО «<a href="http://visicom.ua/">Визиком</a>»',
                    subdomains : '123'
                })
            ]
        });

        L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);

        oms = new OverlappingMarkerSpiderfier(map);
    }

    function resize() {
        $('#map').height($(window).height());
        $('#map').width($(window).width());
        map.invalidateSize();
    }

    function clearMap() {
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
}]);
