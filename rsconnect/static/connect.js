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
      "rsc-icon"
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
    notify.info("RSConnect: fetching config...", 0);
    // force cache invalidation with Math.random (tornado web framework caches aggressively)
    return $.getJSON("/api/config/rsconnect_jupyter?t=" + Math.random())
      .fail(function(err) {
        showError("Error while retrieving config");
        debug.error(err);
      })
      .always(function() {
        notify.hide();
      });
  }

  function xhrSaveConfig(config) {
    notify.info("RSConnect: saving config...");
    return $.ajax({
      url: "/api/config/rsconnect_jupyter",
      headers: {
        "X-XSRFToken": getXsrfToken(),
        "Content-Type": "application/json"
      },
      data: JSON.stringify(config)
    })
      .fail(function(err) {
        showError("RSConnect: failed to save config");
        debug.error(err);
      })
      .always(function() {
        notify.hide();
      });
  }

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
    var notebookTitle = Jupyter.notebook.notebook_name.replace(".ipynb", "");

    var publishModal = dialog.modal({
      title: "Publish to RStudio Connect",
      body: [
        '<div class="form-group">',
        '    <a href="#" class="pull-right">Add server...</a>',
        "    <label>Publish to</label>",
        '    <div class="list-group">',
        '        <a href="#" class="list-group-item active">',
        '            somewhere <small class="rsc-text-light">&mdash; https://somewhere/</small>',
        '            <button type="button" class="pull-right btn btn-danger btn-xs">',
        '                <i class="fa fa-remove"></i>',
        "            </button>",
        "        </a>",
        '        <a href="#" class="list-group-item">',
        '            elsewhere <small class="rsc-text-light">&mdash; https://elsewhere/</small>',
        '            <button type="button" class="pull-right btn btn-danger btn-xs">',
        '                <i class="fa fa-remove"></i>',
        "            </button>",
        "        </a>",
        "    </div>",
        "</div>",
        '<div class="form-group">',
        "    <label>Title</label>",
        '    <input class="form-control" name="title" type="text">',
        "</div>"
      ].join(""),
      sanitize: false,
      open: function() {
        // TODO add ability to dismiss via escape key

        // clicking on links in the modal body prevents the default behavior (i.e. changing location.hash)
        publishModal.find(".modal-body").on("click", function(e) {
          e.preventDefault();
        });

        // there is no _close_ event so let's improvise
        publishModal.on("hidden.bs.modal", function() {
          debug.info("closed");
          dialogResult.resolve("closed");
        });

        // add footer buttons
        publishModal
          .find(".modal-footer")
          .append(
            '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
          )
          .append(
            '<a class="btn btn-primary" data-dismiss="modal" aria-hidden="true">Publish</a>'
          );

        // add default title
        publishModal.find("[name=title]").val(notebookTitle);
      }
    });

    return dialogResult;
  }

  function onConfigReceived(config) {
    debug.info("config", config);

    var sampleConfig = {
      servers: [
        {
          uri: "https://somewhere/",
          name: "somewhere",
          apiKey: "abcdefghij"
        },
        {
          uri: "https://elsewhere/",
          name: "elsewhere",
          apiKey: "klmnopqrst"
        }
      ],
      content: {
        "/path/to/Title 123.ipynb": {
          title: "Title 123",
          appId: 42,
          publishedTo: "somewhere"
        },
        "/path/to/Title 456.ipynb": {
          title: "Title XYZ",
          appId: 84,
          publishedTo: "elsewhere"
        }
      }
    };

    var emptyConfig = {
      servers: [],
      content: {}
    };

    if (Object.values(config).length === 0) {
      // empty config
    } else {
      // some config
    }

    addServerConfig().then(function(data) {
      debug.info(data);
    });

    return;

    if (validConfig) {
      // publish the notebook
      return xhrPublish(config);
    }

    return addServerConfig()
      .then(xhrSaveConfig)
      .then(xhrPublish);
  }

  function onPublishClicked(env, event) {
    xhrGetConfig().then(onConfigReceived);
    /*
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
    */
  }

  return {
    init: init
  };
});
