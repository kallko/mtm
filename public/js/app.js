angular.module('MTMonitor', ['smart-table']);

var myLayout = new GoldenLayout({
    settings: {
        hasHeaders: true
    },
    content: [{
        type: 'row',
        content: [{
            type: 'column',
            content: [{
                type: 'component',
                componentName: 'template',
                componentState: {templateId: 'transparent-map-window'}
            }, {
                type: 'component',
                height: 20,
                componentName: 'template',
                componentState: {templateId: 'template2'}
            }]
        }, {
            type: 'component',
            width: 70,
            componentName: 'template',
            title: 'Точки маршрута',
            componentState: {templateId: 'template-point-table'}
        }]
    }]
});

myLayout.registerComponent('template', function (container, state) {
    var templateHtml = $('#' + state.templateId).html();
    container.getElement().html(templateHtml);
});

myLayout.on('initialised', function () {
    angular.bootstrap(document.body, ['MTMonitor']);
});

myLayout.init();
