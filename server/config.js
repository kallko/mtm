var config = {

    cashing: {
        //soap: true, // загрузка данных из локального json, а не из соапа (для отладки)
        soap: false,
        tracks: true, // кеширование трека
        session: true // использования сессии для кеширование данных получвемых из соапа
    },

    loadOnlyItineraryNew: true, // загружать только решения нового типа GET_ITINERARY_NEW
    //loadOnlyItineraryNew: false,

    soap: {
        login: 'soap_admin', // админский логин для клиента соапа
        password: '$o@p', // админский пароль для клиента соапа
        //defaultClientLogin: 'k00056.0' // логин для прогрузки интерфейса при запуске вне окна 1С
        //defaultClientLogin: 'ids.dsp'
    },

    aggregator: {
        //url: 'http://192.168.9.29:20000/', // локальный путь к аггрегатору
        url: 'https://gps.s2.sngtrans.com.ua/', // путь к агрегатору на хосте
        login: 'admin',
        password: 'admin321'
    },

    router: {
        url: 'https://router.s2.sngtrans.com.ua/'
    },

    mathServer: {
        //url: 'http://192.168.9.29:12035/' // локальный путь к матсерверу
        url: 'http://math-all:9000/' // путь к матсерверу на хосте
        //url: 'http://192.168.122.108:9000'        // новый путь к матсерверу
        //url: 'http://localhost:9000/' // путь к матсерверу на хосте
    }
};

module.exports = config;