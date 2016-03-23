angular.module('MTMonitor').controller('PointPopupEditController', ['$scope', '$rootScope',
    function (scope, rootScope) {
    	scope.pointEditingPopup = false;
    	rootScope.$on('pointEditingPopup', function (event, data) { // окошко редактирования точки
            scope.pointEditingPopup = true;
            console.log(scope.pointEditingPopup, ' pointpopup');
            console.log('Sobitie');
            console.log(data, ' data');
            $('#point-editing-popup').popup('show');
        }) //
    }]);