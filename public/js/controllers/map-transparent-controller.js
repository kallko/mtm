angular.module('MTMonitor').controller('MapTransparentController', ['$scope', function (scope) {
  var map;

  initMap();
  setTransparent(4);

  function setTransparent(depth){
    var el = $('#transparent-map-holder').parent();
    for (var i = 0; i < depth; i++) {
      console.log(el);
      el.css('opacity', '0');
      el = el.parent();
    }
  }

  function initMap(){
    // var map = $('#map');
    // if($('#map').length == 0) return;

    $('#map').height($(window).height());
    $('#map').width($(window).width());

    map = L.map('map').setView([50.4412776, 30.4671281], 11);
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        maxZoom: 18,
        id: 't4ddy.229f0f41',
        accessToken: 'pk.eyJ1IjoidDRkZHkiLCJhIjoiZDJhZDRhM2E2NmMzZWNhZWM3YTlmMWZhOTYwNmJlMGUifQ.6GBanGLBka6DNFexeC3M6g'
    }).addTo(map);
  }

}]);
