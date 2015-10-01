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
        drawTracks(data);
    });

    rootScope.$on('clearTracks', function (event, data) {
        clearMap();
    });

    function drawTracks(tracks) {
        var tmpVar,
            polyline,
            iconIndex = 14,
            tmpTitle = '',
            color = '';

        for (var i = 0; i < tracks.length; i++) {
            color = 'white';
            if (tracks[i].state == 'MOVE') {
                color = '#5cb85c';
            } else if (tracks[i].state == 'ARRIVAL') {
                color = '#c9302c';
                //continue;
            } else if (tracks[i].state == 'NO_SIGNAL' || tracks[i].state == 'NO SIGNAL') {
                color = '#5bc0de';
                //continue;
            } else if (tracks[i].state == 'START') {
                color = 'yellow';
                //continue;
            }

            if (tracks[i].coords != null) {
                tmpTitle = 'Дистанция: ' + tracks[i].dist + '\n';
                tmpTitle += 'Время прибытия: ' + new Date(tracks[i].t1 * 1000) + '\n';
                tmpTitle += 'Длительность: ' + parseInt(tracks[i].time / 60) + ' минут';
                tmpVar = L.marker([tracks[i].coords[0].lat, tracks[i].coords[0].lon],
                    {'title': tmpTitle});
                tmpVar.setIcon(getIcon(i, iconIndex, color, 'black'));
                map.addLayer(tmpVar);
                markersArr.push(tmpVar);

                polyline = new L.Polyline(tracks[i].coords, {
                    color: color,
                    weight: 3,
                    opacity: 1,
                    smoothFactor: 1
                });
                polyline.addTo(map);
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
        map = L.map('map').setView([50.4412776, 30.5671281], 12);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);
        _map = map;
    }

    function resize() {
        $('#map').height($(window).height());
        $('#map').width($(window).width());
        map.invalidateSize();
    }

    function clearMap(){
        var m = map;
        for(i in m._layers) {
            if(m._layers[i]._path != undefined) {
                try {
                    m.removeLayer(m._layers[i]);
                }
                catch(e) {
                    console.log("problem with " + e + m._layers[i]);
                }
            }
        }

        for (var i = 0; i < markersArr.length; i++) {
            map.removeLayer(markersArr[i]);
        }
    }

}]);
