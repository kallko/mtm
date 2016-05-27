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
/*
    	rootScope.$on('pointEditingPopup', function (event, data, time) { // окошко редактирования точки
	       // console.log(data, ' data');
	        scope.data = data.source;
			console.log("i recieve data", data);
			console.log("i recieve time", time);
	       // localServicePoints = scope.data.servicePoints;
	       // servicePointsReserve = scope.data.servicePoints;
	        scope.stopIndx = data.stopIndx;
            // if(scope.data.servicePoints && scope.data.servicePoints.length>1)
			// {
				localServicePoints=scope.data.servicePoints.slice();
                //for(var s=0; s<scope.data.servicePoints.length; s++){
				//	localServicePoints[s] = scope.data.servicePoints[s];
                //};
	            //scope.viewPointsCollection = [{prop1: 111, prop2: 222}, {prop1: 'aaa', prop2: 'bbb'}, {prop1: 1212, prop2: 5454}];
	            scope.pointEditingPopup = true;
	            //console.log(scope.pointEditingPopup, ' pointpopup');
	            //console.log('Sobitie');
	            //console.log(data, ' data');
				//console.log(localServicePoints, 'localServicePoints', scope.data.servicePoints, 'scope.data.servicePoints');
	           	function buildTable(servicePoints){
					console.info(servicePoints);
					//console.log("Start Table build");
					cleanTable();

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
		            	$('[data-table-stop-input-'+s+']').val(time[s]/60 || wayPointTimeInteger);
		            	wayPointIntValues['[data-table-stop-input-'+s+']'] = time[s]/60 || wayPointTimeInteger;
		            };
		            var lastItem = servicePoints.length-1;  // эта переменная используется только в нескольких строчках ниже.
		            wayPointTimeRestTotal = Math.round(wayPointTimeRestOnePoint*(lastItem+1));
		            if(wayPointTimeInteger + wayPointTimeRestTotal>=1){
		            	
		            	$('[data-table-stop-input-'+lastItem+']').val(time[lastItem]/60 || (wayPointTimeInteger + wayPointTimeRestTotal));
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = (time[lastItem]/60 || (wayPointTimeInteger + wayPointTimeRestTotal));
		            }else{
		            	$('[data-table-stop-input-'+lastItem+']').val(1);
		            	wayPointIntValues['[data-table-stop-input-'+lastItem+']'] = time[lastItem]/60 || 1;
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
	            scope.confirm = function(id) {
					for (var s = 0; s < localServicePoints.length; s++) {
						wayPointsToRemoveFromStop.push({
							wayPoint: parseInt($('[data-service-point-name-' + s + ']').html()) - 1,
							stopTime: parseInt($('[data-table-stop-input-' + s + ']').val())
						}); //объект на отправку
					}
					;
					if (wayPointsToRemoveFromStop.length > 0) {
						console.log(wayPointsToRemoveFromStop, ' wayPointsToRemoveFromStop', scope.data, " - stop");
						rootScope.$emit('confirmViewPointEditing', wayPointsToRemoveFromStop, scope.data);  //отправка массива точек, отвязанных от стопов

						wayPointsToRemoveFromStop = [];
					}
	            	hidePopup(id);
	            	console.log('Emitted event from stop-card');
	            };
    		//};
        });
*/
		rootScope.$on('pointEditingPopup', function (event, data, time, taskTime) {
			$('#point-editing-popup').popup('show');
			// console.log(data);
			// console.log(time);
			// console.log(taskTime);
			scope.stopIndx = data.stopIndx;
			scope.data = data.source;
			scope.stopWithOutPoints = false;
			scope.stopWithPoints = true;
			scope.start = parseInt(scope.data.t1 / 60) * 60; // избавляемся от "лишних" секунд
			scope.delta = parseInt(scope.data.time / 60) * 60;
			scope.shadowDelta = (scope.delta / 60 > time.length) ? scope.delta / 60 : time.length;
			console.log(scope.shadowDelta);
			scope.fin = scope.start + scope.delta;
			scope.cancel = function () {
				$('#point-editing-popup').popup('hide');
			};
			 if('servicePoints' in scope.data && scope.data.servicePoints.length > 0) {

				scope.servisPoints = [];
				scope.emmitServisPoints = []; // массив который будем эмитировать

				scope.calculationStopTime = function () {
					var sumTimeConfirmed = 0;
					var lengthConfirmat = 0;
					var lastUncomfirm;
					scope.sumStopTimeConf = 0;
					for (var i = 0; i < time.length; i++) {
						if (time[i] > 0) {
							lengthConfirmat++;
							sumTimeConfirmed += time[i];
						} else {
							lastUncomfirm = i;
						}
					}
					var servisPointsLng = scope.data.servicePoints.length;
					if ((scope.delta - sumTimeConfirmed) / (servisPointsLng - lengthConfirmat) >= 60) { //время стопа в секундах, разделяется между точками обслуживания и переводиться в минуты
						wayPointTimeInteger = parseInt(( (scope.delta - sumTimeConfirmed) / (servisPointsLng - lengthConfirmat)) / 60); // время обслуживания точки (целое)
					} else {
						wayPointTimeInteger = 1;
					}
					scope.disabled = false;
					for (var i = 0; servisPointsLng > i; i++) {
						scope.servisPoints[i] = {};
						scope.servisPoints[i].error = false;
						scope.servisPoints[i].wayPoint = (scope.data.servicePoints[i] * 1);
						scope.servisPoints[i].confirmTime = time[i] / 60;
						scope.servisPoints[i].taskTime = parseInt(taskTime[i] / 60);
						scope.servisPoints[i].stopTime = scope.servisPoints[i].confirmTime || wayPointTimeInteger;
						scope.sumStopTimeConf = scope.sumStopTimeConf + scope.servisPoints[i].confirmTime;
					}
					console.log(JSON.parse(JSON.stringify(scope.servisPoints)));
					if (lastUncomfirm) {
						var timelastUncomfirm = ((scope.delta - sumTimeConfirmed) / 60) - (wayPointTimeInteger * (servisPointsLng - lengthConfirmat - 1) );
						if (timelastUncomfirm < 1) {
							timelastUncomfirm = 1;
						}
						scope.servisPoints[lastUncomfirm].stopTime = timelastUncomfirm;
					}

					scope.$apply();
				};
				if (scope.data.servicePoints && scope.data.servicePoints.length > 0) {
					scope.calculationStopTime();
				}

				scope.unbindPoint = function ($index, $event) {

					scope.emmitServisPoints.push(scope.servisPoints.splice($index, 1)[0]);
					scope.emmitServisPoints[scope.emmitServisPoints.length - 1].stopTime = -1;
					scope.shadowDelta--;
					var sumTimeConfirmed = 0;
					var lengthConfirmat = 0;
					var lastUncomfirm;
					for (var i = 0; i < scope.servisPoints.length; i++) {
						if (scope.servisPoints[i].confirmTime > 0) {
							lengthConfirmat++;
							sumTimeConfirmed += scope.servisPoints[i].confirmTime;
							scope.sumStopTimeConf = sumTimeConfirmed;
						} else {
							lastUncomfirm = i;
						}
					}
					var servisPointsLng = scope.servisPoints.length;
					if ((scope.delta - sumTimeConfirmed) / (servisPointsLng - lengthConfirmat) >= 60) { //время стопа в секундах, разделяется между точками обслуживания и переводиться в минуты
						wayPointTimeInteger = parseInt(( (scope.delta - sumTimeConfirmed) / (servisPointsLng - lengthConfirmat)) / 60); // время обслуживания точки (целое)
					} else {
						wayPointTimeInteger = 1;
					}
					scope.disabled = false;

					for (var i = 0; scope.servisPoints.length > i; i++) {
						scope.servisPoints[i].stopTime = scope.servisPoints[i].confirmTime || wayPointTimeInteger;
					}
					if (lastUncomfirm) {
						var timelastUncomfirm = ((scope.delta - sumTimeConfirmed) / 60) - (wayPointTimeInteger * (servisPointsLng - lengthConfirmat - 1) );
						if (timelastUncomfirm < 1) {
							timelastUncomfirm = 1;
						}
						scope.servisPoints[lastUncomfirm].stopTime = timelastUncomfirm;
					}

				};
				scope.confirm = function () {
					scope.emmitServisPoints = scope.emmitServisPoints.concat(scope.servisPoints);
					rootScope.$emit('confirmViewPointEditing', scope.emmitServisPoints, scope.data);
					scope.cancel();
				};


				scope.chenge = function ($index, $event) {

					var sumStopTime = 0;
					var lengthComf = 0;
					var lastUnComf;
					for (var i = 0; scope.servisPoints.length > i; i++) {
						sumStopTime = sumStopTime + scope.servisPoints[i].stopTime;
						if (scope.servisPoints[i].confirmTime == 0) {
							lastUnComf = i;
						} else {
							lengthComf++;
						}
					}

					scope.servisPoints[$index].stopTime = parseInt(scope.servisPoints[$index].stopTime);

					scope.maxTimeStop = (scope.delta / 60) - (scope.servisPoints.length - 1) || 1;
					if (scope.maxTimeStop < 1) {
						scope.maxTimeStop = 1;
					}
					if (scope.servisPoints[$index].stopTime < 1) {
						scope.servisPoints[$index].stopTime = 1;
					}

					if (scope.maxTimeStop < scope.servisPoints[$index].stopTime) {
						scope.servisPoints[$index].stopTime = scope.maxTimeStop;
						for (var i = 0; scope.servisPoints.length > i; i++) {
							if (i == $index) {
								continue;
							}
							scope.servisPoints[i].stopTime = 1;
						}
						scope.disabled = false;
					} else {
						if (sumstop() > scope.shadowDelta) {
							scope.disabled = true;
						} else {
							scope.disabled = false;
						}
					}

					function sumstop() {
						var sumStop = 0;
						for (var i = 0; scope.servisPoints.length > i; i++) {
							sumStop += scope.servisPoints[i].stopTime;
						}
						return sumStop;
					}
					if( Number.isNaN(scope.servisPoints[$index].stopTime)){
						scope.disabled = true;
					}


				};
			 }else{
				scope.stopWithOutPoints = true;
				scope.stopWithPoints = false;
				 scope.$apply();
			}
		});
    }]);