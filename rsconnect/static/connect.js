define([
  "jquery",
  "base/js/namespace",
  "base/js/notificationarea",
  "base/js/dialog",
  "base/js/utils"
], function($, Jupyter, notification, dialog, utils) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  function init() {
    // create an action that can be invoked from many places (e.g. command
    // palette, button click, keyboard shortcut, etc.)
    var actionName = Jupyter.actions.register(
      {
        icon: "fa-cloud-upload",
        help: "Publish to RStudio Connect",
        help_index: "zz",
        handler: debounce(1000, onPublishClicked)
      },
      "publish",
      "rsconnect"
    );
    // add a button that invokes the action
    Jupyter.toolbar.add_buttons_group([actionName]);

    // re-style the toolbar button to have a custom icon
    $('button[data-jupyter-action="' + actionName + '"] > i').addClass(
      "rsconnect-icon"
    );

    // wire up notification widget
    notify = Jupyter.notification_area.widget("rsconnect");
  }

  /***********************************************************************
   * Helpers
   ***********************************************************************/

  var debug = {
    info: function() {
      var args = [].slice.call(arguments);
      args.unshift("RSConnect:");
      console.info.apply(null, args);
    },
    error: function() {
      var args = [].slice.call(arguments);
      args.unshift("RSConnect:");
      console.error.apply(null, args);
    },
    log: function() {
      var args = [].slice.call(arguments);
      args.unshift("RSConnect:");
      console.log.apply(null, args);
    }
  };

  // this will be filled in by `init()` (var is hoisted)
  var notify = null;

  function debounce(delay, fn) {
    var timeoutId = null;
    return function() {
      var self = this;
      if (timeoutId === null) {
        fn.apply(self, arguments);
      }
      timeoutId = setTimeout(function() {
        timeoutId = null;
      }, delay);
    };
  }

  function getXsrfToken() {
    var cookies = document.cookie.split("; ").reduce(function(object, s) {
      var sepIdx = s.indexOf("=");
      var key = s.substring(0, sepIdx);
      var value = s.substring(sepIdx + 1);
      object[key] = value;
      return object;
    }, {});
    return cookies["_xsrf"] || "";
  }

  function identity(a) {
    // sneaky side-effect
    notify.hide();
    return a;
  }

  function showError(prefix) {
    return function(error) {
      var msg = prefix + ": " + error;
      debug.error(msg);
      notify.error("RSConnect: error", 0, alert.bind(null, msg), {
        title: msg
      });
    };
  }

  /***********************************************************************
   * XHR
   ***********************************************************************/

  function xhrGetConfig() {
    // maybe use the settings endpoint here to persist data?
    // https://github.com/jupyter/notebook/blob/5.2.2/notebook/services/config/handlers.py
    notify.info("RSConnect: fetching config...", 0);
    // force cache invalidation with Math.random (tornado web framework caches aggressively)
    return $.getJSON("/api/config/rsconnect?t=" + Math.random()).then(
      identity,
      showError("Error while retrieving config")
    );
  }

  function xhrSaveConfig() {}

  function xhrPublish() {
    var notebookPath = utils.encode_uri_components(
      Jupyter.notebook.notebook_path
    );

    return utils.ajax({
      url: "/rsconnect",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({
        notebook_path: notebookPath,
        server: "172.17.0.1",
        port: 3939,
        api_key: "tY3YklF1SQWuxoGVzhoI2rwPXun0q68w"
      })
    });
  }

  /***********************************************************************
   * Event handlers
   ***********************************************************************/

  function addServerConfig() {
    var dialogResult = $.Deferred();

    dialog.modal({
      title: "RStudio Connect Server",
      body: "<h2>Meow meow</h2><br><br>Hello!",
      sanitize: false,
      open: function() {
        // there is no _close_ event so let's improvise
        $("div[role=dialog]").on("hidden.bs.modal", function() {
          console.log("closed");
        });

        // take away the publish button's ability to trigger closing the
        // dialog until we have valid data
        $("#rsconnect-publish-dialog-btn").removeAttr("data-dismiss");
      }
    });

    return dialogResult;
  }

  function onConfigReceived(config) {
    debug.log("config", config);
    var validConfig = "host" in config && "apiKey" in config;

    if (validConfig) {
      // publish the notebook
      return xhrPublish(config);
    }

    return addServerConfig()
      .then(xhrSaveConfig)
      .then(xhrPublish);
  }

  function onPublishClicked(env, event) {
    // xhrGetConfig().then(onConfigReceived);
    xhrPublish().then(
      function(app) {
        notify.info(
          "  RSConnect: Published",
          30 * 1000,
          function() {
            window.open(app.url);
          },
          { icon: "fa fa-link" }
        );
      },
      function() {
        notify.warning("RSConnect: Failed to publish :(");
      }
    );
  }

  return {
    init: init
  };
});
