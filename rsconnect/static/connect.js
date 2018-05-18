define([
  "jquery",
  "base/js/namespace",
  "base/js/dialog",
  "base/js/utils"
], function($, Jupyter, Dialog, Utils) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  // this will be filled in by `init()`
  var notify = null;

  // this will be filled in lazily
  var config = null;

  function init() {
    // construct notification widget
    notify = Jupyter.notification_area.widget("rsconnect");

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
  }

  /***********************************************************************
   * Server interop
   ***********************************************************************/

  function RSConnect(c) {
    /* sample value of `Jupyter.notebook.metadata`:
       { previousServerId: "abc-def-ghi-jkl"
         servers: [
           {id: "xyz-uvw", server: "http://172.0.0.3:3939/", serverName: "dev"}
           {id: "rst-opq", server: "http://somewhere/connect/", serverName: "prod", notebookTitle:"Meow", appId: 42}
         ]
       }
    */

    this.previousServerId = null;
    this.servers = [];

    // TODO more rigorous checking?
    var metadata = JSON.parse(JSON.stringify(Jupyter.notebook.metadata));
    if (metadata.rsconnect && metadata.rsconnect.servers) {
      // make a copy
      this.servers = metadata.rsconnect.servers;
      this.previousServerId = metadata.rsconnect.previousServerId;
    }

    this.save = this.save.bind(this);
    this.updateServer = this.updateServer.bind(this);
    this.verifyServer = this.verifyServer.bind(this);
    this.addServer = this.addServer.bind(this);
    this.removeServer = this.removeServer.bind(this);
    this.publishContent = this.publishContent.bind(this);
    this.getNotebookTitle = this.getNotebookTitle.bind(this);
  }

  RSConnect.prototype = {
    save: function() {
      var result = $.Deferred();
      // save_notebook returns a native Promise while the rest of
      // the code including parts of Jupyter return jQuery.Deferred
      Jupyter.notebook
        .save_notebook()
        .then(function() {
          // notebook is writable
          // overwrite metadata (user may have changed it)
          Jupyter.notebook.metadata.rsconnect = {
            previousServerId: this.previousServerId,
            servers: this.servers
          };

          result.resolve();
        })
        ["catch"](function() {
          // notebook is read-only (server details will likely not be persisted)
          result.resolve();
        });
      return result;
    },

    verifyServer: function(server) {
      return Utils.ajax({
        url: "/rsconnect_jupyter/verify_server",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          server_address: server
        })
      });
    },

    addServer: function(server, serverName) {
      var self = this;
      var id = uuidv4();

      // verify the server exists, then save
      return this.verifyServer(server)
        .then(function() {
          self.servers.push({
            id: id,
            server: server,
            serverName: serverName
          });
          return self.save();
        })
        .then(function() {
          return id;
        });
    },

    updateServer: function(id, appId, notebookTitle) {
      var idx = this.servers.findIndex(function(s) {
        return s.id === id;
      });
      if (idx < 0) {
        return $.Deferred().reject("Server (" + id + ") not found");
      }
      this.servers[idx].appId = appId;
      this.servers[idx].notebookTitle = notebookTitle;
      return this.save();
    },

    removeServer: function(id) {
      this.servers = this.servers.filter(function(s) {
        return s.id !== id;
      });
      return this.save();
    },

    publishContent: function(id, apiKey, notebookTitle) {
      var self = this;
      var notebookPath = Utils.encode_uri_components(
        Jupyter.notebook.notebook_path
      );

      var server = this.servers.find(function(s) {
        return s.id === id;
      });
      if (!server) {
        return new $.Deferred().reject("Server (" + id + ") not found");
      }

      var xhr = Utils.ajax({
        url: "/rsconnect_jupyter/deploy",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          notebook_path: notebookPath,
          notebook_title: notebookTitle,
          app_id: server.appId,
          server_address: server.server,
          api_key: apiKey
        })
      });

      // update server with title and appId and set recently selected
      // server
      xhr.then(function(app) {
        self.previousServerId = server.id;
        return self.updateServer(id, app.Id, notebookTitle);
      });

      return xhr;
    },

    getNotebookTitle: function(entry) {
      if (entry) {
        var e = this.servers.find(function(s) {
          return s.id === entry.id;
        });
        // if title was saved then return it
        if (e.notebookTitle) {
          return e.notebookTitle;
        }
      }
      // default title - massage the title so it validates
      var title = Jupyter.notebook
        .get_notebook_name()
        .split("")
        .map(function(c) {
          if (/[a-zA-Z0-9_-]/.test(c)) return c;
          else return "_";
        })
        .join("");
      return title;
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

  // source: https://stackoverflow.com/a/2117523
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function addValidationMarkup(valid, $el, helpText) {
    if (!valid) {
      $el
        .closest(".form-group")
        .addClass("has-error")
        .find(".help-block")
        .text(helpText);
    }
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

  function showAddServerDialog(cancelToPublishDialog, publishToServerId) {
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
        '        <input type="submit" hidden>',
        "    </fieldset>",
        "</form>"
      ].join(""),

      // allow raw html
      sanitize: false,

      open: function() {
        disableKeyboardManagerIfNeeded();

        // there is no _close_ event so let's improvise.
        serverModal.on("hide.bs.modal", function() {
          dialogResult.reject("canceled");
          if (cancelToPublishDialog) {
            showSelectServerDialog(publishToServerId);
          }
        });

        var $txtServer = serverModal.find("#rsc-server");
        var $txtServerName = serverModal.find("#rsc-servername");

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

          addValidationMarkup(
            validServer,
            $txtServer,
            "This should be the location of RStudio Connect: e.g. https://connect.example.com/"
          );
          addValidationMarkup(
            validServerName,
            $txtServerName,
            "This should not be empty."
          );

          if (validServer && validServerName) {
            serverModal.find("fieldset").attr("disabled", true);
            serverModal
              .find(".modal-footer .btn:last")
              .addClass("disabled")
              .find("i.fa")
              .removeClass("hidden");

            config
              .addServer($txtServer.val(), $txtServerName.val())
              .then(function(id) {
                dialogResult.resolve(id);
                serverModal.modal("hide");
              })
              .fail(function(xhr) {
                $txtServer.closest(".form-group").addClass("has-error");
                $txtServer
                  .siblings(".help-block")
                  .text(
                    "Failed to verify RSConnect Connect is running at " +
                      $txtServer.val() +
                      ". Please ensure the server address is valid."
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
        btnAdd.on("click", function() {
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

  function showSelectServerDialog(id) {
    var dialogResult = $.Deferred();
    var selectedEntry = null;
    // will be set during modal initialization
    var btnPublish = null;

    function mkServerItem(server, active) {
      var btnRemove = $("<button></button>")
        .addClass("pull-right btn btn-danger btn-xs")
        .attr("type", "button")
        .append($("<i></i>").addClass("fa fa-remove"))
        .on("click", function(e) {
          e.stopPropagation();

          const $a = $(this).closest("a");
          config
            .removeServer(server.id)
            .then(function() {
              $a.remove();
              // if active server is removed, disable publish button
              if ($a.hasClass("active")) {
                btnPublish.addClass("disabled");
              }
              selectedEntry = null;
            })
            .fail(function(err) {
              debug.error(err);
            });
        });
      var title = $("<small></small>")
        .addClass("rsc-text-light")
        .text("— " + server.server);
      var a = $("<a></a>")
        .addClass("list-group-item")
        .toggleClass("active", active)
        .attr("href", "#")
        .text(server.serverName)
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
          if ($this.hasClass("active")) {
            selectedEntry = server;
            btnPublish.removeClass("disabled");
          } else {
            selectedEntry = null;
            btnPublish.addClass("disabled");
          }
        });

      return a;
    }

    // will be filled during dialog open
    var txtApiKey = null;
    var txtTitle = null;

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
        "        <label>API Key</label>",
        '        <input class="form-control" name="api-key" type="text" maxlength="32" required>',
        '        <span class="help-block"></span>',
        "    </div>",
        '    <div class="form-group">',
        "        <label>Title</label>",
        '        <input class="form-control" name="title" type="text" minlength="3" maxlength="64" required>',
        '        <span class="help-block"></span>',
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

        // add server button
        publishModal.find("#rsc-add-server").on("click", function() {
          publishModal.modal("hide");
          showAddServerDialog(true, (selectedEntry || {}).id);
        });

        // generate server list
        var serverItems = config.servers.map(function(s) {
          var matchingServer = s.id === id;
          if (matchingServer) {
            selectedEntry = s;
          }
          return mkServerItem(s, matchingServer);
        });
        publishModal.find(".list-group").append(serverItems);

        // add default title
        txtTitle = publishModal.find("[name=title]");
        txtTitle.val(config.getNotebookTitle(selectedEntry));

        txtApiKey = publishModal.find("[name=api-key]");

        var form = publishModal.find("form").on("submit", function(e) {
          e.preventDefault();
          publishModal.find(".form-group").removeClass("has-error");
          publishModal.find(".help-block").text("");

          var validApiKey = txtApiKey.val().length === 32;
          var validTitle = /^[a-zA-Z0-9_-]{3,64}$/.test(txtTitle.val());

          addValidationMarkup(
            validApiKey,
            txtApiKey,
            "API Key must be 32 characters long."
          );
          addValidationMarkup(
            validTitle,
            txtTitle,
            "Title must be between 3 and 64 alphanumeric characters, dashes, and underscores."
          );

          if (selectedEntry !== null && validApiKey && validTitle) {
            btnPublish
              .addClass("disabled")
              .find("i.fa")
              .removeClass("hidden");

            config
              .publishContent(selectedEntry.id, txtApiKey.val(), txtTitle.val())
              .then(function() {
                publishModal.modal("hide");
              })
              .fail(function(xhr) {
                txtTitle.closest(".form-group").addClass("has-error");
                txtTitle
                  .siblings(".help-block")
                  .text("Failed to publish. " + xhr.responseJSON.message);
              })
              .always(function() {
                btnPublish
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
        btnPublish = $(
          '<a class="btn btn-primary" aria-hidden="true"><i class="fa fa-spinner fa-spin hidden"></i> Publish</a>'
        );
        btnPublish.toggleClass("disabled", id === null);
        btnPublish.on("click", function() {
          form.trigger("submit");
        });
        publishModal
          .find(".modal-footer")
          .append(btnCancel)
          .append(btnPublish);
      }
    });

    return dialogResult;
  }

  function onPublishClicked(env, event) {
    // lazily load the config when clicked since Jupyter's init
    // function is racy w.r.t. loading of notebook metadata
    if (!config) {
      config = new RSConnect();
      window.RSConnect = config;
    }

    if (config.servers.length === 0) {
      showAddServerDialog(false).then(showSelectServerDialog);
    } else {
      showSelectServerDialog(config.previousServerId);
    }
  }

  return {
    init: init
  };
});
