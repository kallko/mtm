angular.module('acp').controller('MapController', ['$scope', function (scope) {
    var map,
        markersArr = [],
        oms,
        mapJ,
        pointsTableJ,
        settingsPanelJ,
        windowJ,

        colors = [
            '#A9D0F5',
            '#40FF00',
            '#04B4AE',
            '#F7BE81',
            '#F5A9E1',
            '#F78181',
            '#9F81F7',
            '#D7DF01',
            '#F5D0A9',
            '#A4A4A4'
        ];

    initMap();
    setListeners();

    function initMap() {
        map = new L.Map('map', {
            center: new L.LatLng(50.4303429,30.5621329),
            zoom: 12,
            layers : [
                new L.TileLayer('http://tms{s}.visicom.ua/2.0.0/planet3/base_ru/{z}/{x}/{y}.png',{
                    maxZoom: 19,
                    tms : true,
                    attribution : 'Данные карт © 2013 ЧАО «<a href="http://visicom.ua/">Визиком</a>»',
                    subdomains : '123'
                })
            ]
        });

        map.options.maxZoom = 20;

        L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);

        oms = new OverlappingMarkerSpiderfier(map);
    }

    scope.map.clearMap = function () {
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
    };

    function setListeners() {
        windowJ = $(window);
        pointsTableJ = $('#points-table-holder');
        mapJ = $('#map');
        settingsPanelJ = $('#setting-holder');

        windowJ.resize(resize);
        resize();
    }

    function resize() {
        var mapTopMargin = pointsTableJ.height() + settingsPanelJ.height();
        mapJ.height(windowJ.height() - mapTopMargin);
        mapJ.css('margin', mapTopMargin + 'px 0 0 0');
        map.invalidateSize();
    }

    scope.map.drawButtonsPushes = function (pushes) {
        for (var i = 0; i < pushes.length; i++) {
            for (var j = 0; j < pushes[i].coords.length; j++) {
                scope.map.drawMarker(pushes[i].coords[j], j, '', 14, colors[i % colors.length], 'black');
            }
        }
    };

    scope.map.drawMarker = function (point, text, title, iconIndex, colorB, colorF, draggable) {
        draggable = typeof draggable !== 'undefined' ? draggable : false;
        var tmpMarker;
        if (draggable) {
            tmpMarker = L.marker(point, {
                'title': title,
                draggable: draggable,
                zIndexOffset: 1000
            });
            tmpMarker.on('dragend', function(e) {
                scope.points.setNewLatLon(e.target._latlng);
            });
        } else {
            tmpMarker = L.marker(point, {'title': title});
        }
        tmpMarker.setIcon(getIcon(text, iconIndex, colorB, colorF));
        addMarker(tmpMarker);
    };

    scope.map.setCenter = function (point) {
        var zoom = map.getZoom() > 17 ? map.getZoom() : 17;
        map.setView(point, zoom);
    };

    function addMarker(marker) {
        map.addLayer(marker);
        oms.addMarker(marker);
        markersArr.push(marker);
    }

    scope.map.drawPoint = function (point) {
        var title;

        for (var i = 0; i < point.coords.length; i++) {
            title = 'Нажатие #' + (i + 1) + '\n';
            title += point.coords[i].time;
            scope.map.drawMarker(point.coords[i], i + 1, title, 14, '#40CAF7', 'black');

            for (var j = 0; point.coords[i].stops != null && j < point.coords[i].stops.length; j++) {
                title = 'Стоп #' + (j + 1) + '\n';
                title += 'Точки #' + (i + 1) + '\n';
                title += new Date(point.coords[i].stops[j].t1 * 1000);
                scope.map.drawMarker(point.coords[i].stops[j], j + 1, title, 14, 'lightgreen', 'black');
                L.polyline([point.coords[i].stops[j], point.coords[i]], {
                    color: 'black',
                    weight: 1,
                    opacity: 1
                }).addTo(map);
            }
        }

        title = 'Новый центр\n';
        title += 'Название: ' + point.name + '\n';
        title += 'Адрес: ' + point.adress + '\n';
        title += 'ID: ' + point.id + '\n';

        scope.map.setCenter(point.new_position);
        scope.map.drawMarker(point.new_position, 'C', title, 14, 'yellow', 'black', true);
    }

}]);