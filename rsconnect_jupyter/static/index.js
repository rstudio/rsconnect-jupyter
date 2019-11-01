/* global define,requirejs */

define([
  './connect',
  'jquery',
  'base/js/namespace',
  'base/js/dialog',
  'base/js/promises',
  'base/js/utils'
], function(connect, $, Jupyter, dialog, promises, utils) {
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

        connect.init($, Jupyter, dialog, utils);
      }
    });
  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});
