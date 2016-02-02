var config = {

    cashing: {
        //soap: true,
        soap: false,
        tracks: false,
        session: false
    },

    loadOnlyItineraryNew: false,

    soap: {
        login: 'soap_admin',
        password: '$o@p',
        defaultClientLogin: 'k00056.0'              // for local test
        //defaultClientLogin: 'ids.dsp'               // for local test
    },

    aggregator: {
        url: 'http://127.1:20000/',                 // local
        //url: 'http://192.168.122.247:20000/',     // outer
        login: 'admin',
        password: 'admin321'
    },

    router: {
        url: 'http://sngtrans.com.ua:5201/'
    },

    mathServer: {
        url: 'http://192.168.9.29:9000/'            // local
        //url: 'http://62.205.137.118:9000/'        // outer
    }
};

module.exports = config;