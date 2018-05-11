define([
  "jquery",
  "base/js/namespace",
  "base/js/dialog",
  "base/js/utils"
], function($, Jupyter, Dialog, Utils) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  // these will be filled in by `init()`
  var notify = null;
  var config = null;

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

    // construct notification widget
    notify = Jupyter.notification_area.widget("rsconnect");

    notify.info("RSConnect: fetching configuration");
    RSConnect.get()
      .then(function(c) {
        config = c;
        notify.hide();

        // add a button that invokes the action
        Jupyter.toolbar.add_buttons_group([actionName]);

        // re-style the toolbar button to have a custom icon
        $('button[data-jupyter-action="' + actionName + '"] > i').addClass(
          "rsc-icon"
        );
      })
      .fail(function() {
        notify.error("RSConnect: failed to retrieve configuration");
        debug.error(err);
      });
  }

  var sampleConfig = {
    servers: [
      {
        uri: "https://somewhere/",
        name: "somewhere",
        api_key: "abcdefghij"
      },
      {
        uri: "https://elsewhere/",
        name: "elsewhere",
        api_key: "klmnopqrst"
      }
    ],
    content: [
      {
        notebookPath: "/path/to/Title 123.ipynb",
        title: "Title 123",
        appId: 42,
        publishedTo: "somewhere"
      },
      {
        notebookPath: "/path/to/Title 456.ipynb",
        title: "Title XYZ",
        appId: 84,
        publishedTo: "elsewhere"
      }
    ]
  };

  /***********************************************************************
   * Server interop
   ***********************************************************************/

  function RSConnect(c) {
    if (c.servers && c.content) {
      this.servers = c.servers;
      this.content = c.content;
    } else {
      this.servers = [];
      this.content = [];
    }
  }

  RSConnect.get = function() {
    // force cache invalidation with Math.random (tornado web framework caches aggressively)
    return $.getJSON("/api/config/rsconnect_jupyter?t=" + Math.random()).then(
      function(c) {
        return new RSConnect(c);
      }
    );
  };

  RSConnect.prototype = {
    save: function() {
      var self = this;
      return Utils.ajax({
        url: "/api/config/rsconnect_jupyter",
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(self)
      });
    },

    verifyServer: function(uri, apiKey) {
      return Utils.ajax({
        url: "/rsconnect_jupyter/verify_server",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          uri: uri,
          api_key: apiKey
        })
      });
    },

    addServer: function(uri, name, apiKey) {
      // TODO check for duplicate name
      var self = this;
      return this.verifyServer(uri, apiKey)
        .then(function() {
          self.servers.push({ uri: uri, name: name, api_key: apiKey });
        })
        .then(self.save.bind(self))
        .then(function() {
          return name;
        });
    },

    removeServer: function(name) {
      this.servers = this.servers.filter(function(s) {
        return s.name !== name;
      });
      return this.save();
    },

    publishContent: function(title, server) {
      // path to current notebook (TODO di this)
      var notebookPath = Utils.encode_uri_components(
        Jupyter.notebook.notebook_path
      );

      var xhr = Utils.ajax({
        url: "/rsconnect_jupyter",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          notebook_path: notebookPath,
          notebook_title: title,
          server: server.uri,
          api_key: server.apiKey
        })
      });

      // save config
      xhr.then(function(content) {
        var index = this.content.find(function(c) {
          return c.notebookPath === notebookPath;
        });

        if (index > -1) {
          this.content[index].publishedTo = server.name;
          this.content[index].appId = content.id;
        } else {
          this.content.push({
            notebookPath: notebookPath,
            title: title,
            appId: content.id,
            publishedTo: server.name
          });
        }

        return content;
      });

      return xhr;
    },

    getNotebookTitle: function() {
      var nbTitle = Jupyter.notebook.notebook_name.replace(".ipynb", "");
      var nbPath = Jupyter.notebook.notebookPath;

      var idx = this.content.find(function(c) {
        return c.notebookPath === nbPath;
      });

      if (idx > -1) {
        return this.content[idx].title;
      } else {
        return nbTitle;
      }
    }
  };

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

  // Disable the keyboard shortcut manager if it is enabled. This
  // function should be called at the beginning of every modal open so
  // input events are received in text boxes and not hijacked by the
  // keyboard shortcut manager. (This function works around a
  // race-condition around disabling the keyboard shortcut manager
  // when presenting dialogs sequentially - related to promises and
  // the event loop).
  function disableKeyboardManagerIfNeeded() {
    if (Jupyter.keyboard_manager.enabled) {
      Jupyter.keyboard_manager.disable();
    }
  }
  /***********************************************************************
   * Dialogs
   ***********************************************************************/

  function showAddServerDialog(cancelToPublishDialog) {
    var dialogResult = $.Deferred();

    var serverModal = Dialog.modal({
      // pass the existing keyboard manager so all shortcuts are disabled while
      // modal is active
      keyboard_manager: Jupyter.notebook.keyboard_manager,

      title: "Add RStudio Connect Server",
      body: [
        "<form>",
        "    <fieldset>",
        '        <div class="form-group">',
        '            <label class="rsc-label" for="rsc-server">Server Address</label>',
        '            <input class="form-control" id="rsc-server" type="url" placeholder="https://connect.example.com/" required>',
        '            <span class="help-block"></span>',
        "        </div>",
        '        <div class="form-group">',
        '            <label class="rsc-label" for="rsc-servername">Server Name</label>',
        '            <input class="form-control" id="rsc-servername" type="text" placeholder="server-nickname" minlength="1" required>',
        '            <span class="help-block"></span>',
        "        </div>",
        '        <div class="form-group">',
        '            <label class="rsc-label" for="rsc-apikey">API Key</label>',
        '            <input class="form-control" id="rsc-apikey" type="text" placeholder="abcdefghijlmnopqrstuvwxyz1234567" minlength="32" maxlength="32" required>',
        '            <span class="help-block"></span>',
        "        </div>",
        '        <input type="submit" hidden>',
        "    </fieldset>",
        "</form>"
      ].join(""),
      // P5pSP4xgUCnfSwulFYwO5NJFL3bgHYFo

      // allow raw html
      sanitize: false,

      open: function() {
        disableKeyboardManagerIfNeeded();

        // there is no _close_ event so let's improvise.
        serverModal.on("hide.bs.modal", function() {
          dialogResult.reject("canceled");
          if (cancelToPublishDialog) {
            showPublishDialog();
          }
        });

        var $txtServer = serverModal.find("#rsc-server");
        var $txtServerName = serverModal.find("#rsc-servername");
        var $txtApiKey = serverModal.find("#rsc-apikey");

        var form = serverModal.find("form").on("submit", function(e) {
          e.preventDefault();
          serverModal.find(".form-group").removeClass("has-error");
          serverModal.find(".help-block").text("");

          var validServer = $txtServer.val().length > 0;
          // if browser supports <input type=url> then use its checkValidity function
          if ($txtServer.get(0).checkValidity) {
            validServer &= $txtServer.get(0).checkValidity();
          }
          var validServerName = $txtServerName.val().length > 0;
          var validApiKey = $txtApiKey.val().length === 32;

          var addValidationMarkup = function(valid, $el, helpText) {
            if (!valid) {
              $el
                .closest(".form-group")
                .addClass("has-error")
                .find(".help-block")
                .text(helpText);
            }
          };

          addValidationMarkup(
            validServer,
            $txtServer,
            "This should be the location of RStudio Connect: e.g. https://connect.example.com/"
          );
          addValidationMarkup(
            validServerName,
            $txtServerName,
            "This should not be empty"
          );
          addValidationMarkup(
            validApiKey,
            $txtApiKey,
            "This should be 32 characters long"
          );

          if (validServer && validServerName && validApiKey) {
            serverModal.find("fieldset").attr("disabled", true);
            serverModal
              .find(".modal-footer .btn:last")
              .addClass("disabled")
              .find("i.fa")
              .removeClass("hidden");

            config
              .addServer(
                $txtServer.val(),
                $txtServerName.val(),
                $txtApiKey.val()
              )
              .then(function(serverName) {
                dialogResult.resolve(serverName);
                serverModal.modal("hide");
              })
              .fail(function(err) {
                debug.error(err);

                $txtServer.closest(".form-group").addClass("has-error");
                $txtServer
                  .siblings(".help-block")
                  .text(
                    "Failed to verify RSConnect Connect is running at " +
                      $txtServer.val() +
                      ". Please ensure the server address and api key are valid."
                  );
              })
              .always(function() {
                serverModal.find("fieldset").removeAttr("disabled");
                serverModal
                  .find(".modal-footer .btn:last")
                  .removeClass("disabled")
                  .find("i.fa")
                  .addClass("hidden");
              });
          }
        });

        // add footer buttons
        var btnCancel = $(
          '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
        );
        var btnAdd = $(
          '<a class="btn btn-primary" aria-hidden="true"><i class="fa fa-spinner fa-spin hidden"></i> Add Server</a>'
        );
        btnAdd.on("click", function(e) {
          form.trigger("submit");
        });
        serverModal
          .find(".modal-footer")
          .append(btnCancel)
          .append(btnAdd);
      }
    });

    return dialogResult;
  }

  function showPublishDialog(serverName) {
    var dialogResult = $.Deferred();

    function mkServerItem(server, active) {
      var btnRemove = $("<button></button>")
        .addClass("pull-right btn btn-danger btn-xs")
        .attr("type", "button")
        .append($("<i></i>").addClass("fa fa-remove"))
        .on("click", function(e) {
          e.stopPropagation();

          const $a = $(this).closest("a");
          // if active server is removed, disable publish button
          if ($a.hasClass("active")) {
            btnPublish.addClass("disabled");
          }
          config
            .removeServer(server.name)
            .then(function() {
              $a.remove();
            })
            .fail(function(err) {
              debug.error(err);
            });
          // TODO check if empty list
        });
      var title = $("<small></small>")
        .addClass("rsc-text-light")
        .text("— " + server.uri);
      var a = $("<a></a>")
        .addClass("list-group-item")
        .toggleClass("active", active)
        .attr("href", "#")
        .text(server.name)
        .append(title)
        .append(btnRemove)
        .on("click", function() {
          var $this = $(this);
          $this
            .toggleClass("active")
            .siblings()
            .removeClass("active");

          // toggle publish button disable state based on whether
          // there is a selected server
          btnPublish.toggleClass("disabled", !$this.hasClass("active"));
        });

      return a;
    }

    var serverItems = config.servers.map(function(s) {
      return mkServerItem(s, s.name === serverName);
    });

    // add footer buttons
    var btnCancel = $(
      '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
    );
    btnCancel.on("click", function() {
      dialogResult.reject("canceled");
    });
    var btnPublish = $(
      '<a class="btn btn-primary disabled" data-dismiss="modal" aria-hidden="true">Publish</a>'
    );
    btnPublish.on("click", function() {
      // TODO actually publish
      dialogResult.reject("TODO publish");
    });

    var publishModal = Dialog.modal({
      // pass the existing keyboard manager so all shortcuts are disabled while
      // modal is active
      keyboard_manager: Jupyter.notebook.keyboard_manager,

      title: "Publish to RStudio Connect",
      body: [
        "<form>",
        '    <div class="form-group">',
        '        <a href="#" id="rsc-add-server" class="pull-right">Add server...</a>',
        "        <label>Publish to</label>",
        '        <div class="list-group">',
        "        </div>",
        "    </div>",
        '    <div class="form-group">',
        "        <label>Title</label>",
        '        <input class="form-control" name="title" type="text">',
        "    </div>",
        '    <input type="submit" hidden>',
        "</form>"
      ].join(""),

      // allow raw html
      sanitize: false,

      // triggered when dialog is visible (would be better if it was
      // post-node creation but before being visible)
      open: function() {
        disableKeyboardManagerIfNeeded();
        // TODO add ability to dismiss via escape key

        // clicking on links in the modal body prevents the default
        // behavior (i.e. changing location.hash)
        publishModal.find(".modal-body").on("click", function(e) {
          e.preventDefault();
        });

        // there is no _close_ event so let's improvise
        publishModal.on("hide.bs.modal", function() {
          dialogResult.reject("canceled");
        });

        publishModal.find("#rsc-add-server").on("click", function() {
          publishModal.modal("hide");
          showAddServerDialog(true);
        });

        publishModal.find(".list-group").append(serverItems);

        publishModal
          .find(".modal-footer")
          .append(btnCancel)
          .append(btnPublish);

        // add default title
        publishModal.find("[name=title]").val(config.getNotebookTitle());
      }
    });

    return dialogResult;
  }

  function onPublishClicked(env, event) {
    if (!config) return;

    if (config.servers.length === 0) {
      showAddServerDialog(false).then(function(serverName) {
        showPublishDialog(serverName);
      });
    } else {
      showPublishDialog().then(function(result) {
        debug.info(result);
      });
    }
  }

  return {
    init: init
  };
});
