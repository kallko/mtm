angular.module('MTMonitor').controller('PointIndexController', ['$scope', function (scope) {

    setListeners();
    generateTestData();
    initMap();

    var map;

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

      $("#tabs").tabs();

      $("#map-link").on('click', function() {
        map.invalidateSize(false);
      });

      $('ul.nav-pills li a').click(function (e) {
        $('ul.nav-pills li.active').removeClass('active')
        $(this).parent('li').addClass('active')
      });
    }

    function resetHeight(){
      var tableHeight = $(window).height() - $("#menu-holder").height()
                                           - $("#tab-selector").height() - 22;
      $('#point-table').height(tableHeight);
    }

    function initMap(){
      map = L.map('map').setView([50.4412776, 30.4671281], 11);
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
          attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
          maxZoom: 18,
          id: 't4ddy.229f0f41',
          accessToken: 'pk.eyJ1IjoidDRkZHkiLCJhIjoiZDJhZDRhM2E2NmMzZWNhZWM3YTlmMWZhOTYwNmJlMGUifQ.6GBanGLBka6DNFexeC3M6g'
      }).addTo(map);
    }

    scope.rowClick = function(id) {
      console.log('click on ' + id);
      $('.selected-row').removeClass('selected-row');
      $('#point-' + id).addClass('selected-row');
    }

    scope.getTextStatus = function(statusCode, pointId) {
      var newClass,
          text;
      if(statusCode == 0){
        newClass = 'row-white';
        text = 'Запланирован';
      } else if(statusCode == 1) {
        newClass = 'row-yellow';
        text = 'Выполняется';
      } else if(statusCode == 2) {
        newClass = 'row-green';
        text = 'Выполнен';
      } else if (statusCode == 3) {
        newClass = 'row-red';
        text = 'Отменен';
      }

      if(pointId != null){
        $('#point-' + pointId).addClass(newClass);
      }

      return text;
    }

    function generateTestData() {
      var testData = []
          tmpPoint = null;
      for (var i = 0; i < 77; i++) {
        tmpPoint = new Point();
        tmpPoint.number = i + 1;
        tmpPoint.pointID = i + 1;
        tmpPoint.status = Math.floor(Math.random() * 4);
        tmpPoint.driverName = "Driver" + i % 3;
        testData.push(tmpPoint);
      }

      scope.rowCollection = testData;
      scope.displayCollection = [].concat(scope.rowCollection);
    }
}]);
