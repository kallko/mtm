// контроллер работы с точками и нажатиями
angular.module('acp').controller('PointsTableController', ['$scope', '$http', function (scope, http) {
   // переинициализация контроллера
   scope.points.reinit = function (data) {
        scope.selectedRow = -1;
        scope.rowCollection = [];

        for (var i = 0; i < data.length; i++) {
            scope.data[i].coords_length = scope.data[i].coords.length;
            scope.rowCollection.push(data[i]);
        }

        scope.displayCollection = [].concat(scope.rowCollection);
        console.log('reinit', {'scope.rowCollection': scope.rowCollection});
    };

    // обработчик нажатия на строке в таблице
    scope.rowClick = function (row_id) {
        lastRowId = row_id;

        $('.selected-row').removeClass('selected-row');
        if (scope.selectedRow == row_id) {
            scope.selectedRow = -1;
        } else {
            $('#row-' + row_id).addClass('selected-row');
            scope.selectedRow = row_id;
        }

        var row = scope.rowCollection[row_id];
        if (row == undefined || row.center.lat == undefined) return;

        changeHideButtonText(row.hide);
        scope.map.clearMap();
        scope.map.drawPoint(row);
    };

    // скрыть строку
    scope.points.hideRow = function () {
        var row = scope.rowCollection[scope.selectedRow];
        row.hide = !row.hide;
        row.needSave = true;
        changeHideButtonText(row.hide);
    };

    // поменять текст кнопки в зависимости от выбранной строки
    function changeHideButtonText(hidden) {
        var btn = $('#hide-row-btn');
        if (hidden) {
            btn.text("отображать строку");
        } else {
            btn.text("скрыть строку");
        }
    }

    // обозначить точку как выполненную
    scope.points.doneRow = function () {
        if (scope.selectedRow != -1) {
            var row = scope.rowCollection[scope.selectedRow];
            row.done = !row.done;
            row.needSave = true;

            console.log(row);
        }
    };

    // назначить новые кооординаты
    scope.points.setNewLatLon = function (latlon) {
        if (scope.selectedRow != -1) {
            var row = scope.rowCollection[scope.selectedRow];
            row.new_position.lat = parseFloat(latlon.lat.toFixed(5));
            row.new_position.lon = parseFloat(latlon.lng.toFixed(5));
            row.changed = true;
            row.needSave = true;

            var point = $('#row-' + lastRowId);
            point.trigger('click');
            point.trigger('click');
        }
    };

}]);