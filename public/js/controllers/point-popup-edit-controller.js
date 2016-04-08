angular.module('MTMonitor').controller('PointPopupEditController', ['$scope', '$rootScope',
    function (scope, rootScope) {
    	var wayPointsToRemoveFromStop = []; // массив точек обслуживания, представленных к удалению (отвязыванию) из соответствующего стопа 
    	var servicePointsReserve=[];
    	var localServicePoints = [];
    	scope.pointEditingPopup = false;
    	var outgoingData;
    	var wayPointsToRemoveFromStop = [];
        scope.deletePointFromStop=function(){
        	alert('deleted');
        };
    	rootScope.$on('pointEditingPopup', function (event, data) { // окошко редактирования точки
	       // console.log(data, ' data');
	        scope.data = data.source;
	       // localServicePoints = scope.data.servicePoints;
	       // servicePointsReserve = scope.data.servicePoints;
	        scope.stopIndx = data.stopIndx;
    		if(scope.data.servicePoints && scope.data.servicePoints.length>1){
	    		for(var s=0; s<scope.data.servicePoints.length; s++){
					localServicePoints[s] = scope.data.servicePoints[s];	
	    		};
	            //scope.viewPointsCollection = [{prop1: 111, prop2: 222}, {prop1: 'aaa', prop2: 'bbb'}, {prop1: 1212, prop2: 5454}];
	            scope.pointEditingPopup = true;
	            //console.log(scope.pointEditingPopup, ' pointpopup');
	            //console.log('Sobitie');
	            //console.log(data, ' data');
	           	function buildTable(servicePoints){

		            for (var s=0; s<servicePoints.length; s++){
		            	// servicePointsReserve[s] = localServicePoints[s] = servicePoints[s]; //!!!!!!!!!
		            	//console.log(localServicePoints, 'do do s' );
		            	$('#stop-point-view-table').append('<tr data-table-stop-trow data-row='+(servicePoints[s])+'><td data-service-point-name-'+s+'>'+
		            		(servicePoints[s]+1)+
		            		'</td><td><input data-table-stop-input-'+s+' type="number" class="promised-text-card">'+
		            		'</td><td> <button data-button data-delete-from-stop='+(servicePoints[s])+' class="btn btn-primary btn-sm">Отвязать от стопа</button></td></tr>');
		            };

		             $('[data-button]').click(function($event){
					//console.log($event, ' event');

					//----------------------------------------------
					var localItem = parseInt($($event.currentTarget).attr('data-delete-from-stop'));
					
					var localIndex = localServicePoints.indexOf(localItem);
					
					localServicePoints.splice(localIndex, 1);
				
					//----------------------------------------------
					wayPointsToRemoveFromStop.push({wayPoint: localItem, stopTime: -1}); 
					console.log(wayPointsToRemoveFromStop, ' wayPointsToRemoveFromStop');
					$('[data-row="'+localItem+'"]').remove();
					cleanTable();
					buildTable(localServicePoints);
					setDeafaultInterval(localServicePoints);
				});
	           	};
	           	function cleanTable(){
	           		$('[data-table-stop-trow]').remove();
	           	};
	           	buildTable(localServicePoints);
				scope.$apply();
	            $('#point-editing-popup').popup('show');
	            //------------------------------разброс врмени простоя по точкам------
	            //------------------------------разброс времемни по умолчанию
	            var wayPointTime,  // такое сообщение увидит опрератор если на обслуживание точки ушло меньше минуты
	            	wayPointTimeRestOnePoint,
	            	wayPointTimeRestTotal,
	            	wayPointTimeInteger;

	            function setDeafaultInterval(servicePoints){

		            if(scope.data.time/servicePoints.length >= 60){ //время стопа в секундах, разделяется между точками обслуживания и переводиться в минуты
		            	wayPointTime = (scope.data.time/60)/(servicePoints.length); // время обслуживания точки с дробью
		            	wayPointTimeInteger = Math.floor(wayPointTime); // время обслуживания точки округленное в сторону уменьшения (дробь вычитается)
		            	
		            	wayPointTimeRestOnePoint = wayPointTime - wayPointTimeInteger;  //вычисляется остаток (отнятая дробь) и округляется до единицы стандартно для одной точки
		            
		            }else{
		            	wayPointTimeInteger = 1;
		            };
		            	//-------------------------------------------------
		            var wayPointIntValues = {}; //этот объект содержит ту же информацию, что и $('[...]').val(), только типа int, чтоб потом не делать parseInt()	
		           //console.log(wayPointIntValues, ' !!wayPointIntValues');
		            for (var s=0; s<servicePoints.length-1; s++){	
		            	$('[data-table-stop-input-'+s+']').val(wayPointTimeInteger);
		            	wayPointIntValues['[data-table-stop-input-'+s+']'] = wayPointTimeInteger;
		            };
		            var lastItem = servicePoints.length-1;  // эта переменная используется только в нескольких строчках ниже.
		            wayPointTimeRestTotal = Math.round(wayPointTimeRestOnePoint*(lastItem+1));
		            if(wayPointTimeInteger + wayPointTimeRestTotal>=1){
		            	
		            	$('[data-table-stop-input-'+lastItem+']').val(wayPointTimeInteger + wayPointTimeRestTotal);
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = (wayPointTimeInteger + wayPointTimeRestTotal);	
		            }else{
		            	$('[data-table-stop-input-'+lastItem+']').val(1);
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = 1;		
		            };

	            	setManualInterval(wayPointIntValues, servicePoints);
	            };
	            setDeafaultInterval(localServicePoints);

	            function setManualInterval(wayPointIntValues, servicePoints){
	            	
	            	var intervalSummAutoFilled = 0,
	            		intervalSummManual = 0,
	            		currentTarget,
	            		previousTarget = {};
	            		currentTarget = {}; // 
	            	for(var property in wayPointIntValues){
	            		intervalSummAutoFilled += wayPointIntValues[property];
	            		//console.log(wayPointIntValues[property], ' property');
	            	};
	            	//console.log(intervalSummManual, ' intervalSumm');
	            	for(var s=0; s<=servicePoints.length; s++){
	            		$('[data-table-stop-input-'+s+']').focus(function($event){
	            			console.log(previousTarget.valueStr, typeof(previousTarget.valueStr), ' previousTarget valueStr');
	            		
	            			previousTarget.target = currentTarget.target;
	            			previousTarget.value = currentTarget.value;
	            			previousTarget.valueStr = currentTarget.valueStr;
	            			currentTarget.target = $event.currentTarget;
	            			currentTarget.target.valueStr = $event.currentTarget.value;
	            			currentTarget.value = parseInt($event.currentTarget.value); //используется для отката значения, если оператор ввел некорректно новое
	            			intervalSummManual = 0;
	            			
	            			for (var s=0; s<servicePoints.length; s++){
		            				if(parseInt($('[data-table-stop-input-'+s+']').val()) < 1){
		            				alert('Время на обслуживание одной точки не может быть менее минуты!');
		            				$('[data-table-stop-input-'+s+']').val(''+1);
	            				};
	            				
		            			intervalSummManual += parseInt($('[data-table-stop-input-'+s+']').val());
		            		};
	            				var localSumm = 0;
	            					lastItem = servicePoints.length-1;
	            				for (var s=0; s<servicePoints.length-1; s++){
	            					localSumm += parseInt($('[data-table-stop-input-'+s+']').val());
	            				};
	            				if(intervalSummAutoFilled-localSumm>=1){
	            					if(parseInt($('[data-table-stop-input-'+lastItem+']').val())>(intervalSummAutoFilled-localSumm)){
	            						
	            					};	
	            					$('[data-table-stop-input-'+lastItem+']').val(intervalSummAutoFilled-localSumm);
	            				} else {
		            				alert('Вы ввели слишком большое значение или оставили поле пустым!');
	            					$(previousTarget['target']).val(previousTarget.value);
	            					intervalSummManual = 0;
	            				};
	            				console.log(intervalSummAutoFilled, 'autofill');
	            				console.log(localSumm, ' localSumm');
	            		});
						
	            	};
	            };
	           
	            //функция, которая спрячет и расформирует окно карточки вызова
	            function hidePopup(id){
    				$(id).popup('hide');
    				$('[data-table-stop-trow]').remove();
    			};
	            //обработчик кнопки "отмена" и "закрыть": опустошает массив точек, представленных к удалению из стопа и прячет окно карточки остановки
	            scope.cancel = function(id){
	            	//scope.data.servicePoints = scope.data.servicePoints.concat(wayPointsToRemoveFromStop);
	            	wayPointsToRemoveFromStop = [];
	            	console.log(wayPointsToRemoveFromStop, ' wayPointsToRemoveFromStop');
	            	for(var s=0; s<servicePointsReserve.length; s++){
	            		localServicePoints[s] = servicePointsReserve[s];
	            	};
	            	
	            	hidePopup(id);
	            	
	            };
	            scope.confirm = function(id){
	            	for(var s=0; s<localServicePoints.length; s++){
	            		wayPointsToRemoveFromStop.push({wayPoint: parseInt($('[data-service-point-name-'+s+']').html())-1, stopTime: parseInt($('[data-table-stop-input-'+s+']').val())}); //объект на отправку 
	            	};
	            	rootScope.$emit('confirmViewPointEditing', wayPointsToRemoveFromStop);  //отправка массива точек, отвязанных от стопов
	            	console.log(wayPointsToRemoveFromStop, ' wayPointsToRemoveFromStop');
	            	wayPointsToRemoveFromStop = [];

	            	hidePopup(id);
	            	console.log('Emitted event from stop-card');
	            };
    		};
        });

    }]);