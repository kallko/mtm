angular.module('MTMonitor', ['smart-table']);

var myLayout = new GoldenLayout({
  settings:{
    hasHeaders: true
  },
  content:[{
    type: 'row',
    content: [{
              type: 'component',
              componentName: 'template',
              componentState: { templateId: 'transparent-map-window' }
          },{
              type: 'column',
              content:[{
                  type: 'component',
                  componentName: 'template',
                  componentState: { templateId: 'template-point-table' }
              },{
                  type: 'component',
                  componentName: 'template',
                  componentState: { templateId: 'template2' }
              }]
          }]
  }]
});

myLayout.registerComponent( 'template', function( container, state ){
  var templateHtml = $( '#' + state.templateId ).html();
  container.getElement().html( templateHtml );
});

myLayout.on( 'initialised', function(){
  angular.bootstrap( document.body, [ 'MTMonitor' ]);
});

myLayout.init();
