/**
 * Created by dev-2 on 13.12.16.
 */
angular.module('MTMonitor').controller('GeoEditingController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {

    scope.region = "test";

    scope.regions = [{
        name: "Выберите область",
        value : -1
    }];

    scope.cities = [{
        name: "Выберите город",
        value : -1
    }];

    scope.streets =[{
       name: "Выберите улицу",
       value : -1
    }];

    scope.houses = [{
        name: "Выберите дом",
        value : -1
    }];

    scope.searchString = "";



    scope.startSearchRegion = function() {
        if (scope.searchString.length > 3) {
            console.log("scope.searchString", scope.searchString);
            http.post('./geosearch', {data: scope.searchString})
                .then(function(data){
                    console.log("Data recieved", data);
                })

        }
    };


    scope.changeRegion = function (value) {
        console.log("Value", value);
    };

    scope.changeCity = function () {

    };


    scope.changeStreet = function () {

    };

    scope.changeHouse = function () {

    };

}]);
