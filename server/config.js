var config = {

    //cashing: {
    //    soap: false,
    //    tracks: false
    //},
    //
    //defaultSoapLogin: 'k00056.0',
    //defaultMonitoringLogin: 'k00056.0',
    //
    //loadOnlyItineraryNew: false,

    cashing: {
        soap: false,
        tracks: false
    },

    defaultSoapLogin: 'ids.dsp',
    defaultMonitoringLogin: 'ids.dsp',
    loadOnlyItineraryNew: true,


    aggregator: {
        url: 'http://62.205.137.118:9001/',
        //url: 'http://192.168.9.29:9001/',

        //url: 'http://127.1:20000/', // local
        //url: 'http://192.168.122.247:20000/', // outer
        login: 'admin',
        password: 'admin321'
    },

    router: {
        url: 'http://sngtrans.com.ua:5201/'
    },

    mathServer: {
        url: 'http://192.168.9.29:9000/'
    }
};

module.exports = config;