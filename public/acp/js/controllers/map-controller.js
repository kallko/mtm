angular.module('acp').controller('MapController', ['$scope', function (scope) {
        var map,
            markersArr = [],
            oms,
            mapJ,
            pointsTableJ,
            settnigsPanelJ,
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
            map = L.map('map').setView([50.4412776, 30.6671281], 11);
            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            L.control.scale({position: 'topleft', metric: true, imperial: false}).addTo(map);

            oms = new OverlappingMarkerSpiderfier(map);
        }

        scope.map.clearMap = function() {
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
            settnigsPanelJ = $('#setting-holder');

            windowJ.resize(resize);
            resize();
        }

        function resize() {
            var mapTopMargin = pointsTableJ.height() + settnigsPanelJ.height();
            mapJ.height(windowJ.height() - mapTopMargin);
            mapJ.css('margin', mapTopMargin + 'px 0 0 0');
            map.invalidateSize();
        }

        scope.map.drawButtonsPushes = function(pushes) {
            for (var i = 0; i < pushes.length; i++) {
                for (var j = 0; j < pushes[i].coords.length; j++) {
                    scope.map.drawMarker(pushes[i].coords[j], j, '', 14, colors[i % colors.length], 'black');
                }
            }
        };

        scope.map.drawMarker = function (point, text, title, iconIndex, colorB, colorF) {
            var tmpMarker = L.marker(point, {'title': title});
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

            for(var i = 0; i < point.coords.length; i++) {
                title = 'Нажатие #' + (i + 1) + '\n';
                title += point.coords[i].time;
                scope.map.drawMarker(point.coords[i], i + 1, title, 14, '#40CAF7', 'black');
            }

            title = 'Центральная точка\n';
            title += 'Название: ' + point.name + '\n';
            title += 'Адрес: ' + point.adress + '\n';
            title += 'ID: ' + point.id + '\n';

            scope.map.setCenter(point.center);
            scope.map.drawMarker(point.center, 'c', title, 14, 'yellow', 'black');
            scope.map.drawMarker(point.median, 'm', title, 14, 'yellow', 'black');
            scope.map.drawMarker(point.new_position, 'r', title, 14, 'yellow', 'black');
        }
}]);