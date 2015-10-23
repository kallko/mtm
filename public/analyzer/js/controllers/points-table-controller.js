angular.module('acp').controller('PointsTableController', ['$scope', '$http', function (scope, http) {

    scope.points.reinit = function (data) {
        scope.rowCollection = [];

        for (var i = 0; i < data.length; i++) {
            data[i].row_id = i;
            scope.rowCollection.push(data[i]);
        }

        scope.displayCollection = [].concat(scope.rowCollection);
        console.log('reinit', {'scope.rowCollection': scope.rowCollection});
    };

    scope.rowClick = function (row_id) {
        console.log(row_id);
        var row = scope.rowCollection[row_id];
        if (row == undefined || row.center_lat == undefined) return;

        scope.map.clearMap();
        scope.map.drawPoint(row);
    };

}]);