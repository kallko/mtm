angular.module('MTMonitor').controller('PointPopupEditController', ['$scope', '$rootScope',
    function (scope, rootScope) {
    	scope.hidePopup = function(id){
    		$(id).popup('hide');
    		$('[data-table-stop-trow]').remove();
    	}
    	scope.pointEditingPopup = false;
        scope.deletePointFromStop=function(){
        	alert('deleted');
        };
    	rootScope.$on('pointEditingPopup', function (event, data) { // окошко редактирования точки
    		if(data.servicePoints && data.servicePoints.length>1){
    			
	            scope.viewPointsCollection = [{prop1: 111, prop2: 222}, {prop1: 'aaa', prop2: 'bbb'}, {prop1: 1212, prop2: 5454}];
	            scope.pointEditingPopup = true;
	            console.log(scope.pointEditingPopup, ' pointpopup');
	            console.log('Sobitie');
	            console.log(data, ' data');
	            for (var s=0; s<scope.viewPointsCollection.length; s++){
	            	$('#stop-point-view-table').append('<tr data-table-stop-trow><td>'+
	            		scope.viewPointsCollection[s].prop1+
	            		'</td><td><input type="text" class="promised-text-card">'+
	            		'</td><td> <button data-delete-from-stop class="btn btn-primary btn-sm">Отвязать от стопа</button></td></tr>');
	            };
	            $('[data-delete-from-stop]').click(function(){
	            	alert(this, 'deleted');
	            })
	            $('#point-editing-popup').popup('show');
    		};
        });
    }]);