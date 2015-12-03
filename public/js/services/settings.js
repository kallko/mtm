angular.module('MTMonitor').factory('Settings', [function SettingsFactory() {
    return {
        load: function() {
            var settingsStr = localStorage['settings'];
            if (!settingsStr) return;

            return JSON.parse(settingsStr);
        }
    };
}]);