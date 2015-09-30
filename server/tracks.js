module.exports = TracksManager;

var request = require("request");

function TracksManager(url, login, password) {
    this.url = url;
    this.login = login;
    this.password = password;
}

TracksManager.prototype.getTrack = function (gid, from, to, undef_t, undef_d,
                                             stop_s, stop_d, move_s, move_d, callback) {
    var url = this.url
        + '?login=' + this.login
        + '&pass=' + this.password
        + '&gid=' + gid
        + '&from=' + from
        + '&to=' + to
        + '&undef_t=' + undef_t
        + '&undef_d=' + undef_d
        + '&stop_s=' + stop_s
        + '&stop_d=' + stop_d
        + '&move_s=' + move_s
        + '&move_d=' + move_d;
    console.log(url);

    request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body);
        }
    })
};