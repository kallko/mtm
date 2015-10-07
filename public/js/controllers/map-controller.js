angular.module('MTMonitor').controller('MapController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {
    var map,
        oms,
        position,
        inside = false,
        holderEl = null,
        changingWindow = false,
        markersArr = [];

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
        drawRealRoute(route.real_track);
        drawAllPoints(route.points)
    });

    rootScope.$on('drawPlannedTrack', function (event, route) {
        drawPlannedRoute(route.plan_geometry);
        drawAllPoints(route.points)
    });

    rootScope.$on('drawRealAndPlannedTrack', function (event, route) {
        drawPlannedRoute(route.plan_geometry);
        drawRealRoute(route.real_track);
        drawAllPoints(route.points)
    });

    function drawCombinedRoute(route) {
        var real_track = route.plan_geometry,
            planned_track = route.plan_geometry;
    }

    function drawPlannedRoute(track) {
        if (track == null) return;

        var tmp,
            geometry = [];

        for (var i = 0; i < track.length; i++) {
            if (track[i] == null) continue;
            tmp = track[i].split(",");
            geometry.push(new L.LatLng(parseFloat(tmp[0]), parseFloat(tmp[1])));
        }

        var polyline = new L.Polyline(geometry, {
            color: 'blue',
            weight: 3,
            opacity: 0.5,
            smoothFactor: 1
        });
        polyline.addTo(map);
    }

    function drawRealRoute(track) {
        if (track == null) return;

        var tmpVar,
            polyline,
            iconIndex = 14,
            tmpTitle = '',
            color = '',
            stopIndx,
            stopTime;

        for (var i = 0; i < track.length; i++) {
            if (track[i].coords == null) continue;

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
                tmpTitle = 'Остановка #' + stopIndx + '\n';
                tmpTitle += 'Время прибытия: ' + formatDate(new Date(track[i].t1 * 1000)) + '\n';
                tmpTitle += 'Время отбытия: ' + formatDate(new Date(track[i].t2 * 1000)) + '\n';
                tmpTitle += 'Длительность: ' + stopTime + '\n';

                if (i + 1 < track.length) {
                    tmpTitle += 'Дистанция до следующей остановки: ' + (track[i].dist + track[i + 1].dist) + ' метра(ов)';
                    polyline = new L.Polyline([track[i].coords[0], track[i].coords[track[i].coords.length - 1]], {
                        color: color,
                        weight: 3,
                        opacity: 0.8,
                        smoothFactor: 1
                    });

                    polyline.addTo(map);
                }

                tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon],
                    {'title': tmpTitle});
                tmpVar.setIcon(getIcon(stopTime, iconIndex, color, 'black'));
                addMarker(tmpVar);
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
                tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon]);
                tmpVar.setIcon(getIcon(i, 7, color, 'black'));
                addMarker(tmpVar);
            }
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
            title += 'Временное окно: ' + points[i].availability_windows_str + '\n';
            title += 'Время простоя: ' + mmhh(points[i].DOWNTIME) + '\n';
            title += 'Расстояние: ' + points[i].DISTANCE + ' метра(ов)\n';
            title += 'Время на дорогу к точке: ' + mmhh(points[i].TRAVEL_TIME) + '\n';
            title += 'Адрес: ' + points[i].waypoint.ADDRESS + '\n';
            title += 'Клиент: ' + points[i].waypoint.NAME + '\n';
            title += 'Комментарий: ' + points[i].waypoint.COMMENT + '\n';

            tmpVar = L.marker([points[i].END_LAT, points[i].END_LON], {
                'title': title
            });
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
    }

    function checkMapWindowRect() {
        if (holderEl == null) {
            holderEl = $('#transparent-map-holder');
        }

        position = holderEl.position();
        position.width = holderEl.width();
        position.height = holderEl.height();
        inside = true;
        $('.lm_goldenlayout').css('pointer-events', 'none');

        $('body').mousemove(function (event) {
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
        map = L.map('map').setView([50.4412776, 30.6671281], 11);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

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
        var zoom = map.getZoom() > 15 ? map.getZoom() : 15;
        map.setView(new L.LatLng(lat, lon), zoom);
    }
}]);
