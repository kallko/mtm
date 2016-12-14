/**
 * Created by dev-2 on 13.12.16.
 */
angular.module('MTMonitor').controller('GeoEditingController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {



    scope.regions =[
        {value : -1 ,name: "Выберите область"},
        {value : 1  , name: "Киев"},
        {value : 164, name: "Киевская область"},
        {value : 156, name: "Винницкая область"},
        {value : 157, name: "Волынская область"},
        {value : 158, name: "Днепропетровская область"},
        {value : 159, name: "Донецкая область"},
        {value : 160, name: "Житомирская область"},
        {value : 161, name: "Закарпатская область"},
        {value : 162, name: "Запорожская область"},
        {value : 163, name: "Ивано-Франковская область"},
        {value : 165, name: "Кировоградская область"},
        {value : 166, name: "Луганская область"},
        {value : 167, name: "Львовская область"},
        {value : 118, name: "Николаевская область"},
        {value : 168, name: "Одесская область"},
        {value : 169, name: "Полтавская область"},
        {value : 170, name: "Ровненская область"},
        {value : 171, name: "Сумская область"},
        {value : 172, name: "Тернопольская область"},
        {value : 173, name: "Харьковская область"},
        {value : 174, name: "Херсонская область"},
        {value : 175, name: "Хмельницкая область"},
        {value : 176, name: "Черкаская область"},
        {value : 178, name: "Черниговская область"},
        {value : 177, name: "Черновецкая область"},
        {value : 155, name: "Автономная Республика Крым"}
    ];

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
    scope.region = -1;


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
