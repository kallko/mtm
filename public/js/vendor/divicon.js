function getDivIcon(param){
    param.backColor2 = (param.backColor2 != undefined) ? param.backColor2 : param.backColor;
    var width       = param.width;
    var height      = param.height;
    var bordrad     = param.bordrad || "0px";

    var style = "width: 100%; " +
                "height: 100%; " +
                "border: none; ";

    var leftStyle =     "position: absolute; " +
                        "border-radius: " + bordrad + " 0px 0px " + ((param.status == 1) ? "0px" : bordrad) + "; " +
                        "height: " + height + "px; " +
                        "left: 0px; " +
                        "top: 0px; " +
                        "width: " + (width / 2) + "px; " +
                        "float: left; " +
                        "border: none; ";
    leftStyle +=        (param.status == 1) ? "background: url(http://sngtrans.com.ua/img/left.png) 0% 100% " + param.backColor + " no-repeat; "
                        : "background: " + param.backColor + "; ";

    var rightStyle =    "position: absolute; " +
                        "border-radius: 0px " + bordrad + " " + ((param.status == 2) ? "0px" : bordrad) + " 0px; " +
                        "height: " + height + "px; " +
                        "left: " + (width / 2) + "px; " +
                        "top: 0px; " +
                        "width: " + (width / 2) + "px; " +
                        "float: left; " +
                        "border: none; ";
    rightStyle +=       (param.status == 2) ? "background: url(http://sngtrans.com.ua/img/right.png) 100% 100% " + param.backColor + " no-repeat; "
                        : "background: " + param.backColor2 + "; ";

    var textStyle =     "position: absolute; " +
                        "width: " + width + "px; " +
                        "height: " + height + "px; " +
                        "left: 0px; " +
                        "top: 0px; " +
                        "border: none; " +
                        "background: none; " +
                        "color: " + param.textColor + "; " +
                        "text-align: center; ";

    var anchorIcon =    (param.status == 2) ? [width, height] : [0, height];

    var innerHTML =
        "<div style = \"" + leftStyle + "\"></div>" +
        "<div style = \"" + rightStyle + "\"></div>" +
        "<div style =\"" + textStyle + "\">" + param.text + "</div>";
    var code = "<div style = \"" + style + "\">" + innerHTML + "</div>";

    return L.divIcon({
        iconSize    :   [width, height],
        html        :   code,
        iconAnchor  :   anchorIcon
    });
}

function getIcon(numberIcon, typeIcon, colorIcon, colorText) {
    if (typeIcon == 1) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/lorry_go.png';
        anchorIcon = [8, 16];
    } else if (typeIcon == 2) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/lorry_delete.png';
        anchorIcon = [8, 16];
    } else if (typeIcon == 3) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/box_open.png';
        anchorIcon = [8, 16];
    } else if (typeIcon == 4) {
        pathIcon = 'http://sngtrans.com.ua/img/'+colorIcon+'/flag.png';
        anchorIcon = [28, 26];
    } else if (typeIcon == 5) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/stop_blue.png';
        anchorIcon = [15, 13];
    } else if (typeIcon == 6) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/stop_red.png';
        anchorIcon = [8, 13];
    } else if (typeIcon == 7) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/car_sngt.png';
        anchorIcon = [15, 16];
    } else if (typeIcon == 8) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/single_blue.png';
        anchorIcon = [0, 26];
    } else if (typeIcon == 9) {
        fileMarker = '/blank.png';
        if (numberIcon > 0) {
            fileMarker = '/marker'+(numberIcon%100)+'.png';
        };
        pathIcon = 'http://sngtrans.com.ua/img/white'+fileMarker;
        anchorIcon = [15, 13];
    } else if (typeIcon == 10) {
        pathIcon = 'http://sngtrans.com.ua/img/google/new/big_question.png';
        anchorIcon = [15, 26];
    } else if (typeIcon == 11) {
        paranDiv = {
            textColor: "#000000",
            backColor: "#ffffff",
            backColor2: "#ffffff",
            text: numberIcon,
            width: 10*numberIcon.length,
            height: 16,
            status: 2
        };
        return getDivIcon(paramDiv);
    } else if (typeIcon == 12) {
        var newDiv = L.divIcon({
            iconSize    :   [8, 8],
            className   :   "leaflet-marker-track-points",
            iconAnchor  :   [4, 4]
        });
        return newDiv;
    } else if (typeIcon == 13) {
        pathIcon = 'http://sngtrans.com.ua/img/depot.png';
        anchorIcon = [0, 16];
    } else if (typeIcon == 14) {
        colorIcon = colorIcon || '#ffffff';
        colorText = colorText || '#000000';
        numberIcon += '';
        paramDiv = {
            textColor: colorText,
            backColor: colorIcon,
            text: numberIcon,
            width: (10+5*numberIcon.length),
            height: 16,
            status: 1
        };
        return getDivIcon(paramDiv);
    } else if (typeIcon == 15) {
        colorIcon = colorIcon || '#ffffff';
        colorText = colorText || '#000000';
        numberIcon += '';
        paramDiv = {
            textColor: colorText,
            backColor: colorIcon,
            text: numberIcon,
            width: (10+5*numberIcon.length),
            height: 16,
            status: 1,
            bordrad: (10+5*numberIcon.length)/2+"px"
        };
        return getDivIcon(paramDiv);
    } else {
        fileMarker = '/blank.png';
        if (numberIcon > 0) {
            fileMarker = '/marker'+(numberIcon%100)+'.png';
        };
        pathIcon = 'http://sngtrans.com.ua/img/'+colorIcon+fileMarker;
        anchorIcon = [0, 13];
    };

    if (typeIcon == 7) {
        return new L.icon({iconUrl: pathIcon, iconAnchor: anchorIcon, iconSize: [45, 30]});
    } else {
        return new L.icon({iconUrl: pathIcon, iconAnchor: anchorIcon});
    }
}
