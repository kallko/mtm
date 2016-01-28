angular.module('MTMonitor').factory('Settings', [function SettingsFactory() {
    return {
        load: function() {
            var settings = localStorage['settings'] ? JSON.parse(localStorage['settings']) : undefined;
            if (!settings) {
                this.saveToLocalStorage(this.getDefaultSettings());
                settings =  JSON.parse(localStorage['settings']);
            } else {
                this.checkUndefinedSettings(settings);
            }

            settings.showDate = -1;
            return settings;
        },

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
                stopRadius: 150,
                mobileRadius: 150
            };
        },

        saveToLocalStorage: function (settings) {
            localStorage['settings'] = JSON.stringify(settings);
        }
    };
}]);