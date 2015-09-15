angular.module('MTMonitor').controller('PointIndexController', ['$scope', function (scope) {

    setListeners();
    generateTestData();

    function Point(){
      this.number = 0;
      this.status = 0;
      this.realOrder = 0;
      this.planOrder = 0;
      this.pointID = 0;
      this.orderID = 0;
      this.pointName = 'test name';
      this.address = 'test address';
      this.timeWindow = {
        start: 0,
        finish: 0
      };
      this.planArrivalTime = 0;
      this.planServiceTime = 0;
      this.planDowntime = 0;
      this.planDeparture = 0;
      this.distance = 0;
      this.predictionArrivalTime = 0;
      this.factArrivalTime = 0;
      this.driverInPlan = true;
      this.carNumber = '0000';
      this.driverName = 'Test Name';
      this.phone = '0000';
      this.driverComment = '';
      this.managerName = '';
      this.managerComment = '';
    }

    function setListeners(){
      $(window).resize(resetHeight);
      resetHeight();
    }

    function resetHeight(){
      var tableHeight = $(window).height() - $("#menu-holder").height() - 10;
      $('#point-table').height(tableHeight);
    }

    scope.rowClick = function(id) {
      console.log('click on ' + id);
      $('.selected-row').removeClass('selected-row');
      $('#point-' + id).addClass('selected-row');
    }

    function generateTestData(){
      var testData = []
          tmpPoint = null;
      for (var i = 0; i < 77; i++) {
        tmpPoint = new Point();
        tmpPoint.number = i + 1;
        tmpPoint.pointID = i + 1;
        tmpPoint.status = i % 4;
        tmpPoint.driverName = "Driver" + i % 3;
        testData.push(tmpPoint);
      }

      scope.rowCollection = testData;
      scope.displayCollection = [].concat(scope.rowCollection);
    }
}]);
