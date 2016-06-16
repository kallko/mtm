// сервис для работы с настройками приложения
angular.module('MTMonitor').factory('Settings', [function SettingsFactory() {
    return {
        // выгружает настройки из локального хранилища, если они там есть, или создает новые настройки по умолчанию
        load: function() {
            var settings = localStorage['settings'] ? JSON.parse(localStorage['settings']) : undefined;

            console.log("LOCAL STORAGE !!!!", settings );
            if (!settings) {
                this.saveToLocalStorage(this.getDefaultSettings());
                settings =  JSON.parse(localStorage['settings']);
            } else {
                this.checkUndefinedSettings(settings);
            }

            settings.showDate = -1;
            return settings;
        },

        // проверяет наличие свойств у переданного объекта по отноешнию к настройкам по умолчанию
        // и дополняет переданный объект
        checkUndefinedSettings: function (comparedSettings) {
            var defaultSettings = this.getDefaultSettings(),
                updated = false;
            for(var key in defaultSettings) {
                if (defaultSettings.hasOwnProperty(key) && !comparedSettings.hasOwnProperty(key)) {
                    comparedSettings[key] = defaultSettings[key];
                    updated = true;
                }
            }

            if (updated) this.saveToLocalStorage(comparedSettings);
        },

        // настройки по умолчанию
        getDefaultSettings: function () {
            return {
                predictMinutes: 10,
                factMinutes: 15,
                volume: 0,
                weight: 0,
                value: 0,
                workingWindowType: 1,
                demoTime: 48,
                endWindowSize: 3,
                showDate: -1,
                stopRadius: 80,
                mobileRadius: 150,
                timeThreshold: 90,
                routeListOrderBy: 'nameDriver'
            };
        },

        // сохраняет настройки в локальное хранилище
        saveToLocalStorage: function (settings) {
            localStorage['settings'] = JSON.stringify(settings);
        }
    };
}]);