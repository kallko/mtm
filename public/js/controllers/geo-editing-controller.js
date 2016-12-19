/**
 * Created by dev-2 on 13.12.16.
 */
angular.module('MTMonitor').controller('GeoEditingController', ['$scope', '$rootScope', '$http', function (scope, rootScope, http) {

    scope.lang = "ru";
    //todo пункты меню на языке, который выбрал пользователь

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
       fullName : "Выберите улицу",
       name: "Выберите улицу",
       id : -1
    }];

    scope.houses = [{
        name: "Выберите дом",
        id : -1
    }];

    scope.searchString = "";
    scope.region = -1;
    scope.city = -1;
    scope.street = -1;
    scope.house = -1;


    scope.startSearchRegion = function() {
        scope.region = -1;
        scope.city = -1;
        scope.street = -1;
        scope.house = -1;
        scope.$emit('clearGeoMarker');
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
                    createUniqueRegions(scope.regions);

                })

        }
    };


    scope.changeRegion = function (id) {
        console.log("id of region", id);
        scope.city = id;
        scope.miniCities = getObjById(scope.cities, id).cities;
        //scope.$apply;
    };


    scope.$watch('city', function(newValue, oldValue) {
            if (newValue === oldValue) return;
            scope.streets.length = 1;
            scope.street = -1;
            scope.houses.length = 1;
            scope.house = -1;

            var cityObj = getObjById(scope.cities, scope.city);
            console.log("cityObj", cityObj);
            scope.region = findRegionById(cityObj.id);

            if (cityObj.childs) {
                scope.streets = scope.streets.concat(cityObj.childs);
                scope.streets.forEach(function(item){
                if (!item.fullName) {
                    item.fullName = item.type + " " + item.name;
                    if (item.zone) item.fullName += " (" + item.zone + ")";
                }
                });
                console.log (scope.streets);
            }
            http.post('./getObjLatLon', {obj : newValue})
                .then(function(data){
                    console.log(data.data.data.coordinates);
                    if(data.data.data.coordinates) {
                        var obj = {};
                        obj.lon = data.data.data.coordinates[0];
                        obj.lat = data.data.data.coordinates[1];
                        obj.zoom = 10;
                        rootScope.$emit('setMapCenter', obj);
                    }
                });

        }

    );


    scope.$watch('street', function(newValue, oldValue) {
        if (newValue === oldValue) return;
        if (newValue == -1) {
            scope.houses.length = 1;
            scope.house = -1;
            return;
        }

        http.post('./getObjLatLon', {obj : newValue})
            .then(function(data){
                console.log(data.data.data.coordinates);
                var obj = {};
                obj.lon = data.data.data.coordinates[0];
                obj.lat = data.data.data.coordinates[1];
                obj.zoom = 16;
                rootScope.$emit('setMapCenter', obj);

            });

        http.post('./getHouses', {street : newValue})
            .then(function(data){
                scope.houses.length = 1;
                scope.house = -1;
                scope.houses = scope.houses.concat(data.data.data[0].address);
            })

    });


    scope.$watch('house', function(newValue, oldValue) {
        console.log("House changed", newValue, oldValue);
        if (newValue === oldValue ) return;
        if (newValue == -1) {
            return;
        }

        http.post('./getObjLatLon', {obj : newValue})
            .then(function(data){
               console.log(data.data.data.coordinates);
                var lon = data.data.data.coordinates[0];
                var lat = data.data.data.coordinates[1];
                scope.$emit('addGeoMarker', lat, lon);
            })


    });

    //Универсальный метод возвращающий объект по его Id
    function getObjById(obj, objId) {
        if (!obj || !objId) return;

        var result = obj.filter(function(item){
            return item.id == objId;
        });
        return result[0];
    }


    function createUniqueRegions(regions) {
        if (!regions || regions.length < 2) return;
        console.log(regions);
        var result =[];
        var proba = [];
        console.log("Start from", regions.length);
        result.push(scope.regions[0]);
        for (var i = 1; i < regions.length; i++) {
            var flag = true;
            for (var j = 1; j < i; j++){
                console.log(i, " ",  j, " ", regions[i].level1 , regions[j].level1, regions[i].level1 == regions[j].level1);
                if (regions[i].level1 == regions[j].level1) {
                    console.log("Find duplicate");
                    if (regions[j].cities) {
                        console.log("cites", regions[j].cities.length);
                        regions[j].cities.push({id: regions[i].id, level1: regions[i].level1, name: regions[i].name});
                    }
                    //regions[i].cities = regions[i].cities || [];

                    regions.splice(i,1);
                    i--;
                    flag = false;
                    //proba.push()
                    break
                }


            }

            if(flag) {
                console.log("Create new element", regions[j].level1);
                regions[j].cities =  [];
                regions[j].cities.push({id: regions[i].id, level1: regions[i].level1, name: regions[i].name});
            }
        }

        result = result.concat(regions);
        console.log("Result", regions.length, regions);

    }

    function findRegionById(id){
        console.log("findRegion by ID", id);
        var result = -1;
        scope.regions.forEach(function(region){
            if (region.cities) {
                region.cities.forEach(function(city){
                    if (city.id == id) result = region.id;
                })
            }
        });
        return result;
    }


}]);
