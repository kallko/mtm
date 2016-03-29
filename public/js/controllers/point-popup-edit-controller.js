angular.module('MTMonitor').controller('PointPopupEditController', ['$scope', '$rootScope',
    function (scope, rootScope) {
    	var wayPointsToRemoveFromStop = []; // массив точек обслуживания, представленных к удалению (отвязыванию) из соответствующего стопа 

    	scope.pointEditingPopup = false;
        scope.deletePointFromStop=function(){
        	alert('deleted');
        };
    	rootScope.$on('pointEditingPopup', function (event, data) { // окошко редактирования точки
	        console.log(data, ' data');
	        scope.data = data.source;
	        scope.stopIndx = data.stopIndx;
    		if(scope.data.servicePoints && scope.data.servicePoints.length>1){
    			
	            //scope.viewPointsCollection = [{prop1: 111, prop2: 222}, {prop1: 'aaa', prop2: 'bbb'}, {prop1: 1212, prop2: 5454}];
	            scope.pointEditingPopup = true;
	            //console.log(scope.pointEditingPopup, ' pointpopup');
	            //console.log('Sobitie');
	            //console.log(data, ' data');
	           	
	            for (var s=0; s<scope.data.servicePoints.length; s++){
	            	$('#stop-point-view-table').append('<tr data-table-stop-trow data-row='+s+'><td>'+
	            		(scope.data.servicePoints[s]+1)+
	            		'</td><td><input data-table-stop-input-'+s+' type="text" class="promised-text-card">'+
	            		'</td><td> <button data-delete-from-stop='+s+' class="btn btn-primary btn-sm">Отвязать от стопа</button></td></tr>');
	            };
	            //document.querySelector('[data-table-stop-input-'+s+']').value='ccc';
	            // $('[data-delete-from-stop]').click(function(){
	            // 	alert(this, 'deleted');
	            // });
	            $('#point-editing-popup').popup('show');
	            //------------------------------разброс врмени простоя по точкам------
	            //------------------------------разброс времемни по умолчанию
	            var wayPointTime,  // такое сообщение увидит опрератор если на обслуживание точки ушло меньше минуты
	            	wayPointTimeRestOnePoint,
	            	wayPointTimeRestTotal,
	            	wayPointTimeInteger;

	            function setDeafaultInterval(){

		            if(scope.data.time/scope.data.servicePoints.length >= 60){ //время стопа в секундах, разделяется между точками обслуживания и переводиться в минуты
		            	wayPointTime = (scope.data.time/60)/(scope.data.servicePoints.length); // время обслуживания точки с дробью
		            	wayPointTimeInteger = Math.floor(wayPointTime); // время обслуживания точки округленное в сторону уменьшения (дробь вычитается)
		            	
		            	wayPointTimeRestOnePoint = wayPointTime - wayPointTimeInteger;  //вычисляется остаток (отнятая дробь) и округляется до единицы стандартно для одной точки
		            	
		            	//console.log(wayPointTime, ' wayPointTime');
		            	//console.log(wayPointTimeInteger, ' wayPointTimeInteger');
		            }else{
		            	wayPointTimeInteger = 1;
		            };
		            	//-------------------------------------------------
		            var wayPointIntValues = {}; //этот объект содержит ту же информацию, что и $('[...]').val(), только типа int, чтоб потом не делать parseInt()	
		           //console.log(wayPointIntValues, ' !!wayPointIntValues');
		            for (var s=0; s<scope.data.servicePoints.length-1; s++){	
		            	$('[data-table-stop-input-'+s+']').val(wayPointTimeInteger);
		            	wayPointIntValues['[data-table-stop-input-'+s+']'] = wayPointTimeInteger;
		            };
		            var lastItem = scope.data.servicePoints.length-1;  // эта переменная используется только в нескольких строчках ниже.
		            wayPointTimeRestTotal = Math.round(wayPointTimeRestOnePoint*(lastItem+1));
		            if(wayPointTimeInteger + wayPointTimeRestTotal>=1){
		            	//console.log(wayPointTimeRestOnePoint, ' wayPointTimeRestOnePoint');
		            	//console.log(wayPointTimeRestTotal, ' wayPointTimeRestTotal');
		            	$('[data-table-stop-input-'+lastItem+']').val(wayPointTimeInteger + wayPointTimeRestTotal);
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = (wayPointTimeInteger + wayPointTimeRestTotal);	
		            }else{
		            	$('[data-table-stop-input-'+lastItem+']').val(1);
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = 1;		
		            };

	            	setManualInterval(wayPointIntValues);
	            };
	            setDeafaultInterval();

	            function setManualInterval(wayPointIntValues){
	            	//console.log(wayPointIntValues, ' wayPointIntValues');
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
	            	for(var s=0; s<=scope.data.servicePoints.length; s++){
	            		$('[data-table-stop-input-'+s+']').focus(function($event){
	            			//console.log(intervalSummManual, 'zapusk');
	            			previousTarget.target = currentTarget.target;
	            			previousTarget.value = currentTarget.value;
	            			currentTarget.target = $event.currentTarget;
	            			currentTarget.value = parseInt($event.currentTarget.value); //используется для отката значения, если оператор ввел некорректно новое
	            			intervalSummManual = 0;
	            			console.log(previousTarget, ' pr');
	            			console.log(currentTarget, ' cr');
	            			for (var s=0; s<scope.data.servicePoints.length; s++){
		            			intervalSummManual += parseInt($('[data-table-stop-input-'+s+']').val());
		            			//console.log(intervalSummManual, ' intervalSummManual');
		            		};
	            				var localSumm = 0;
	            					lastItem = scope.data.servicePoints.length-1;
	            				for (var s=0; s<scope.data.servicePoints.length-1; s++){
	            					localSumm += parseInt($('[data-table-stop-input-'+s+']').val());
	            				};
	            				if(intervalSummAutoFilled-localSumm>=0){
	            					if(parseInt($('[data-table-stop-input-'+lastItem+']').val())>(intervalSummAutoFilled-localSumm)){
	            						alert('Вы ввели слишком большое значение или оставили поле пустым!');
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
						$('[data-delete-from-stop="'+s+'"]').click(function($event){
							console.log(scope.data.servicePoints.length, ' servicePoints');

							//----------------------------------------------
							var localIndex = $($event.currentTarget).attr('data-delete-from-stop');
							var localItem = scope.data.servicePoints[localIndex];
							wayPointsToRemoveFromStop.push({index: localIndex, item: localItem});
							delete scope.data.servicePoints[localIndex];
							//scope.data.servicePoints.splice(scope.data.servicePoints.indexOf(localItem), 1);
							//----------------------------------------------
							$('[data-row="'+localIndex+'"]').remove();
							setDeafaultInterval(); //!!!!!!!!!!!!!!!!!!!!!!!
							console.log(wayPointsToRemoveFromStop, ' wayPointsToRemoveFromStop');
							console.log(scope.data.servicePoints, ' servicePoints');
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
	            	for(var s=0; s< wayPointsToRemoveFromStop.length; s++){
	            		scope.data.servicePoints[wayPointsToRemoveFromStop[s].index]=wayPointsToRemoveFromStop[s].item;
	            	};
	            	wayPointsToRemoveFromStop = [];
	            	hidePopup(id);
	            	console.log(wayPointsToRemoveFromStop, ' cancel');
	            };
	            scope.confirm = function(id){
	            	rootScope.$emit('confirmViewPointEditing', scope.data.servicePoints);
	            	wayPointsToRemoveFromStop = [];
	            	hidePopup(id);
	            	console.log('emited edited servicePoints', scope.data.servicePoints);
	            };
    		};
        });

    }]);