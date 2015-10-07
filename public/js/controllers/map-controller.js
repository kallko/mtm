angular.module('MTMonitor').controller('MapController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {
    var map,
        position,
        inside = false,
        holderEl = null,
        changingWindow = false,
        markersArr = [];

    initMap();
    addListeners();
    // setTransparent();

    rootScope.$on('drawTracks', function (event, data) {
        drawTrack(data.track);
        drawAllPoints(data.points);
    });

    rootScope.$on('clearMap', function () {
        clearMap();
    });

    rootScope.$on('drawAllPoints', function (event, data) {
        drawAllPoints(data);
    });

    rootScope.$on('setMapCenter', function (event, data) {
        setMapCenter(data.lat, data.lon);
    });

    rootScope.$on('drawPlannedTrack', function (event, route) {
        drawPlannedRoute(route);
    });

    rootScope.$on('drawCombinedTrack', function (event, route) {
        drawCombinedRoute(route);
    });

    rootScope.$on('drawCheckedPoints', function (event, data) {
        // TODO
    });

    function drawCombinedRoute(route) {
        var real_track = route.plan_geometry,
            planned_track = route.plan_geometry;
    }

    function drawPlannedRoute(route) {
        var track = route.plan_geometry;
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

        for (i = 0; i < route.points.length; i++) {
            tmp = L.marker([route.points[i].END_LAT, route.points[i].END_LON], // availability_windows_str
                {
                    'title': 'Время прибытия: ' + route.points[i].arrival_time_hhmm + '\n' +
                    'Временное окно: ' + route.points[i].availability_windows_str
                });
            tmp.setIcon(getIcon(i, 14, 'white', 'black'));
            map.addLayer(tmp);
            markersArr.push(tmp);
        }
    }

    function drawTrack(track) {
        if (track == null) return;

        var tmpVar,
            polyline,
            iconIndex = 14,
            tmpTitle = '',
            color = '';

        for (var i = 0; i < track.length; i++) {
            color = 'white';
            if (track[i].state == 'MOVE') {
                color = '#5cb85c';
            } else if (track[i].state == 'ARRIVAL') {
                color = '#c9302c';
                //continue;
            } else if (track[i].state == 'NO_SIGNAL' || track[i].state == 'NO SIGNAL') {
                color = '#5bc0de';
                //continue;
            } else if (track[i].state == 'START') {
                color = 'yellow';
                //continue;
            }

            if (track[i].coords != null) {

                tmpTitle = 'Дистанция: ' + track[i].dist + '\n';
                tmpTitle += 'Время прибытия: ' + new Date(track[i].t1 * 1000) + '\n';
                //tmpTitle += 'lat: ' + tracks[i].lat + '\n';
                //tmpTitle += 'lon: ' + tracks[i].lon + '\n';
                tmpTitle += 'Длительность: ' + parseInt(track[i].time / 60) + ' минут';
                tmpVar = L.marker([track[i].coords[0].lat, track[i].coords[0].lon],
                    {'title': tmpTitle});
                tmpVar.setIcon(getIcon(parseInt(i / 2 + 0.5) - 1, iconIndex, color, 'black'));
                map.addLayer(tmpVar);
                markersArr.push(tmpVar);

                polyline = new L.Polyline(track[i].coords, {
                    color: color,
                    weight: 3,
                    opacity: 0.5,
                    smoothFactor: 1
                });

                polyline.addTo(map);

                if (i + 1 == track.length) {
                    var indx = track[i].coords.length - 1;
                    tmpVar = L.marker([track[i].coords[indx].lat, track[i].coords[indx].lon]);
                    tmpVar.setIcon(getIcon(i, 7, color, 'black'));
                    map.addLayer(tmpVar);
                    markersArr.push(tmpVar);
                }
            }
        }
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
    }

    function drawAllPoints(data) {
        var tmpVar;
        for (var i = 0; i < data.length; i++) {
            tmpVar = L.marker([data[i].END_LAT, data[i].END_LON],
                {
                    'title': new Date(data[i].arrival_time_ts * 1000).toString() // + '\n' +
                    //'lat = ' + data[i].END_LAT + '\n' +
                    //'lon = ' + data[i].END_LON
                });
            tmpVar.setIcon(getIcon(i + 1, 14, 'white', 'black'));
            map.addLayer(tmpVar);
            markersArr.push(tmpVar);
        }
    }

    function setMapCenter(lat, lon) {
        var zoom = map.getZoom() > 15 ? map.getZoom() : 15;
        map.setView(new L.LatLng(lat, lon), zoom);
    }
}]);
