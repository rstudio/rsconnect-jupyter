/* global define,requirejs */

define([
  './connect',
  'jquery',
  'base/js/events',
  'base/js/namespace',
  'base/js/promises'
], function(connect, $, events, Jupyter, promises) {
  function load_ipython_extension() {
    promises.app_initialized.then(function(app) {
      if (app === 'NotebookApp') {
        // add custom css
        $('<link/>')
          .attr({
            href: requirejs.toUrl('nbextensions/rsconnect_jupyter/main.css'),
            rel: 'stylesheet',
            type: 'text/css'
          })
          .appendTo('head');

        connect.init();
      }
    });
  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});
