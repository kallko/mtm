/**
 * Created by dev-2 on 13.12.16.
 */
angular.module('MTMonitor').controller('GeoEditingController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {

    scope.lang = "ru";

    scope.regions =[
            {id : -1 , level1: "Выберите область/Сброс"}];

    //scope.regions =[
    //    {value : -1 , name: "Выберите область"},
    //    {value : 1  , name: "Киев"},
    //    {value : 164, name: "Киевская область"},
    //    {value : 156, name: "Винницкая область"},
    //    {value : 157, name: "Волынская область"},
    //    {value : 158, name: "Днепропетровская область"},
    //    {value : 159, name: "Донецкая область"},
    //    {value : 160, name: "Житомирская область"},
    //    {value : 161, name: "Закарпатская область"},
    //    {value : 162, name: "Запорожская область"},
    //    {value : 163, name: "Ивано-Франковская область"},
    //    {value : 165, name: "Кировоградская область"},
    //    {value : 166, name: "Луганская область"},
    //    {value : 167, name: "Львовская область"},
    //    {value : 118, name: "Николаевская область"},
    //    {value : 168, name: "Одесская область"},
    //    {value : 169, name: "Полтавская область"},
    //    {value : 170, name: "Ровненская область"},
    //    {value : 171, name: "Сумская область"},
    //    {value : 172, name: "Тернопольская область"},
    //    {value : 173, name: "Харьковская область"},
    //    {value : 174, name: "Херсонская область"},
    //    {value : 175, name: "Хмельницкая область"},
    //    {value : 176, name: "Черкаская область"},
    //    {value : 178, name: "Черниговская область"},
    //    {value : 177, name: "Черновицкая область"},
    //    {value : 155, name: "Автономная Республика Крым"}
    //];

    scope.cities = [{
        name: "Выберите нас. пункт",
        id : -1
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
    scope.city = -1;
    scope.street = -1;
    scope.house = -1;


    scope.startSearchRegion = function() {
        if (scope.searchString.length > 3) {
            console.log("scope.searchString", scope.searchString, scope.lang);
            http.post('./geosearch', {data: scope.searchString, lang: scope.lang})
                .then(function(data){
                    console.log("Data recieved", data);
                    scope.regions.length = 1;
                    scope.region = -1;
                    scope.city = -1;
                    scope.street = -1;
                    scope.house = -1;
                    scope.regions = scope.regions.concat(data.data);

                    var cities = [].concat(data.data);
                    cities.sort(function(a, b){
                        return a.name == b.name ? 0 : (a.name < b.name || a.level1 == undefined)? -1 : 1;
                    });
                    scope.cities.length = 1;
                    scope.cities = scope.cities.concat(cities);

                })

        }
    };


    scope.changeRegion = function (id) {
        console.log("id of region", id);
        scope.city = id;
        //scope.$apply;
    };

    scope.changeCity = function () {

    };


    scope.changeStreet = function () {

    };

    scope.changeHouse = function () {

    };

    scope.$watch('city', function(newValue, oldValue) {console.log("City was Changed", newValue)}

    )


}]);
