define([
  "jquery",
  "base/js/namespace",
  "base/js/dialog",
  "./rsconnect"
], function($, Jupyter, Dialog, RSConnect) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  // this will be filled in by `init()`
  var notify = null;

  // this will be filled in lazily
  var config = null;

  var DeploymentLocation = {
    New: "new",
    Canceled: "canceled"
  };

  function init() {
    // construct notification widget
    notify = Jupyter.notification_area.widget("rsconnect_jupyter");

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
      "rsconnect_jupyter"
    );

    // add a button that invokes the action
    Jupyter.toolbar.add_buttons_group([actionName]);

    // re-style the toolbar button to have a custom icon
    $('button[data-jupyter-action="' + actionName + '"] > i').addClass(
      "rsc-icon"
    );
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
        '            <label class="rsc-label" for="rsc-api-key">API Key</label>',
        '            <input class="form-control" id="rsc-api-key" type="text" placeholder="API key" minlength="32" maxlength="32" required>',
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
        var $txtApiKey = serverModal.find("#rsc-api-key");

        function toggleAddButton(state) {
          serverModal.find("fieldset").attr("disabled", state ? null : true);
          serverModal
            .find(".modal-footer .btn:last")
            .toggleClass("disabled", !state)
            .find("i.fa")
            .toggleClass("hidden", state);
        }

        var form = serverModal.find("form").on("submit", function(e) {
          e.preventDefault();
          serverModal.find(".form-group").removeClass("has-error");
          serverModal.find(".help-block").text("");

          var server = $txtServer.val();
          if (server.indexOf("http") !== 0) {
            $txtServer.val("http://" + server);
          }

          var validServer = $txtServer.val().length > 0;
          // if browser supports <input type=url> then use its checkValidity function
          if ($txtServer.get(0).checkValidity) {
            validServer &= $txtServer.get(0).checkValidity();
          }
          var validServerName = $txtServerName.val().length > 0;
          var validApiKey = $txtApiKey.val().length === 32;

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
          addValidationMarkup(
            validApiKey,
            $txtApiKey,
            "API Key must be 32 characters long."
          );

          if (validServer && validServerName && validApiKey) {
            toggleAddButton(false);

            config
              .addServer($txtServer.val(), $txtServerName.val(), $txtApiKey.val())
              .then(function(id) {
                dialogResult.resolve(id);
                serverModal.modal("hide");
              })
              .fail(function(xhr) {
                addValidationMarkup(
                  false,
                  $txtServer,
                  "Failed to verify RSConnect Connect is running at " +
                    $txtServer.val() +
                    ". Please ensure the server address is valid."
                );
              })
              .always(function() {
                toggleAddButton(true);
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

  function showSelectServerDialog(
    // serverId and userEditedTitle are shuttled
    // between content selection dialog and this dialog.
    serverId,
    userEditedTitle,
    // selectedDeployLocation is set to: DeploymentLocation.Canceled when
    // content selection was canceled, DeploymentLocation.New when user wants to
    // deploy to a new location, and a stringy appId in case the user wishes to
    // overwrite content
    selectedDeployLocation,
    selectedAppMode
  ) {
    var dialogResult = $.Deferred();

    var servers = Object.keys(config.servers);
    if (servers.length == 1) {
      serverId = servers[0];
    }

    var selectedEntryId = serverId;

    var entry = config.servers[selectedEntryId];
    var previousAppMode = entry && entry.appMode;
    var appMode = selectedAppMode || previousAppMode || "static";

    // will be set during modal initialization
    var btnPublish = null;

    function mkServerItem(id, active) {
      var btnRemove = $("<button></button>")
        .addClass("pull-right btn btn-danger btn-xs")
        .attr("type", "button")
        .append($("<i></i>").addClass("fa fa-remove"))
        .on("click", function(e) {
          e.preventDefault();
          e.stopPropagation();

          var $a = $(this).closest("a");
          config
            .removeServer(id)
            .then(function() {
              $a.remove();
              // if active server is removed, disable publish button
              if ($a.hasClass("active")) {
                btnPublish.addClass("disabled");
                selectedEntryId = null;
              }
            })
            .fail(function(err) {
              // highly unlikely this will ever be triggered
              debug.error(err);
            });
        });
      var title = $("<small></small>")
        .addClass("rsc-text-light")
        .text("— " + config.servers[id].server);
      var a = $("<a></a>")
        .addClass("list-group-item")
        .toggleClass("active", active)
        .toggleClass("disabled", !!selectedDeployLocation)
        .attr("href", "#")
        .text(config.servers[id].serverName)
        .append(title)
        .append(btnRemove);

      if (!selectedDeployLocation) {
        a.on("click", function() {
          var $this = $(this);
          $this
            .toggleClass("active")
            .siblings()
            .removeClass("active");

          // toggle publish button disable state based on whether
          // there is a selected server
          if ($this.hasClass("active")) {
            selectedEntryId = id;
            btnPublish.removeClass("disabled");
            maybeShowConfigUrl();
            maybeUpdateAppTitle();

            // select associated appmode, if any
            var entry = config.servers[selectedEntryId];
            appMode = selectedAppMode || (entry && entry.appMode) || "jupyter-static";
            selectPreviousAppMode();
          } else {
            selectedEntryId = null;
            btnPublish.addClass("disabled");
          }
        });
      }
      return a;
    }

    // will be filled during dialog open
    var appModeChoices = null;
    var txtTitle = null;
    var initialTitle =
      userEditedTitle || config.getNotebookTitle(selectedEntryId);

    function selectPreviousAppMode() {
      appModeChoices.removeClass("active").addClass(function() {
        if ($(this).data("appmode") === appMode) {
          return "active";
        }
      });
    }

    function maybeShowConfigUrl() {
      var entry = config.servers[selectedEntryId];
      if (
        entry &&
        entry.configUrl &&
        selectedDeployLocation !== DeploymentLocation.New
      ) {
        publishModal
          .find("div[data-id=configUrl]")
          .text("Currently published at: ")
          .append(
            $("<a></a>")
              .attr("href", entry.configUrl)
              .attr("target", "_rsconnect")
              .text(entry.configUrl)
          );
      } else {
        publishModal
          .find("div[data-id=configUrl]")
          .text("")
          .find("a")
          .remove();
      }
    }

    function maybeUpdateAppTitle() {
      // Retrieve the title from the Connect server and make that the new default title.
      // only do this if the user hasn't edited the title
      if (txtTitle.val() === initialTitle && !userEditedTitle) {
        // and we have a valid API key to use for the request
        if (selectedEntryId) {
          var entry = config.servers[selectedEntryId];
          var appId = entry && entry.appId;

          if (appId) {
            config.getApp(selectedEntryId, appId).then(function(app) {
              if (app.title) {
                txtTitle.val(app.title);
              }
            });
          }
        }
      }
    }

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
        '        <div id="rsc-select-server" class="list-group">',
        "        </div>",
        "    </div>",
        '    <div class="form-group">',
        "        <label>Title</label>",
        '        <input class="form-control" name="title" type="text" minlength="3" maxlength="64" required>',
        '        <span class="help-block"></span>',
        "    </div>",
        '    <div class="form-group" id="rsc-publish-source">',
        "        <label>Publish Source Code</label>",
        '        <div class="list-group">',
        '            <a href="#" id="rsc-publish-with-source" class="list-group-item rsc-appmode" data-appmode="jupyter-static">',
        '                <img src="' +
          Jupyter.notebook.base_url +
          'nbextensions/rsconnect_jupyter/images/publishDocWithSource.png" class="rsc-image">',
        '                <span class="rsc-label">Publish document with source code</span><br/>',
        '                <span class="rsc-text-light">Choose this option if you want to create a scheduled report or rebuild your document on the server</span>',
        "            </a>",
        '            <a href="#" id="rsc-publish-without-source" class="list-group-item rsc-appmode" data-appmode="static">',
        '                <img src="' +
          Jupyter.notebook.base_url +
          'nbextensions/rsconnect_jupyter/images/publishDocWithoutSource.png" class="rsc-image">',
        '                <span class="rsc-label">Publish finished document only</span><br/>',
        '                <span class="rsc-text-light">Choose this option to publish a snapshot of the notebook as it appears in Jupyter</span>',
        "            </a>",
        '            <span class="help-block"></span>',
        "        </div>",
        "    </div>",
        '    <pre id="rsc-log" hidden></pre>',
        '    <div class="form-group">',
        '    <span id="rsc-deploy-error" class="help-block"></span>',
        '    </div>',
        '    <div class="text-center" data-id="configUrl"></div>',
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
          if ($(e.target).attr("target") !== "_rsconnect") {
            e.preventDefault();
          }
        });

        // there is no _close_ event so let's improvise
        publishModal.on("hide.bs.modal", function() {
          dialogResult.reject("canceled");
        });

        // add server button
        publishModal.find("#rsc-add-server").on("click", function() {
          publishModal.modal("hide");
          showAddServerDialog(true, selectedEntryId);
        });

        // generate server list
        var serverItems = Object.keys(config.servers).map(function(id) {
          var matchingServer = serverId === id;
          return mkServerItem(id, matchingServer);
        });
        publishModal.find("#rsc-select-server").append(serverItems);

        // add default title
        txtTitle = publishModal.find("[name=title]");
        txtTitle.val(initialTitle);

        function updateDeployNextButton() {
          var lastPublishedTitle =
            config.servers &&
            config.servers[selectedEntryId] &&
            config.servers[selectedEntryId].notebookTitle;

          if (!lastPublishedTitle || txtTitle.val() === lastPublishedTitle) {
            btnPublish.text("Publish");
          } else {
            btnPublish.text("Next");
          }
        }
        txtTitle.on("input", updateDeployNextButton);
        maybeShowConfigUrl();

        if (
          selectedDeployLocation &&
          selectedDeployLocation !== DeploymentLocation.Canceled
        ) {
          txtTitle.prop("disabled", true);
        }

        // app mode
        appModeChoices = publishModal.find(".rsc-appmode");
        selectPreviousAppMode();

        appModeChoices.on("click", function() {
          appMode = $(this).data("appmode");

          $(this)
            .addClass("active")
            .siblings()
            .removeClass("active");
        });

        // setup app mode choices help icon
        (function() {
          var msg =
            "To deploy a new deployment, change the title, " +
            'click "Next", select "New location", and then ' +
            "you’ll be able to pick a new mode and publish.";

          var helpIcon = $(
            [
              '<a tabindex="0" role="button" data-toggle="popover" data-trigger="focus">',
              '<i class="fa fa-question-circle rsc-fa-icon"></i>'
            ].join("")
          )
            .data("content", msg)
            .popover();

          $("#rsc-publish-source > label").append(helpIcon);
        })();

        var form = publishModal.find("form").on("submit", function(e) {
          e.preventDefault();
          publishModal.find(".form-group").removeClass("has-error");
          publishModal.find(".help-block").text("");

          var validTitle = txtTitle.val().length >= 3;

          addValidationMarkup(
            validTitle,
            txtTitle,
            "Title must be at least 3 characters."
          );

          function togglePublishButton(enabled) {
            btnPublish
              .toggleClass("disabled", !enabled)
              .find("i.fa")
              .toggleClass("hidden", enabled);
          }

          function handleFailure(xhr) {
            addValidationMarkup(false, txtTitle, xhr.responseJSON.message);
            togglePublishButton(true);
          }

          function publish() {
            // assume the user is re-deploying to the same location
            var appId = config.servers[selectedEntryId].appId;

            // check if the user actually came from content selection,
            // in which case we'll either create a new app or deploy
            // to an existing one
            if (selectedDeployLocation === DeploymentLocation.Canceled) {
              // no-op
            } else if (selectedDeployLocation === DeploymentLocation.New) {
              // we want to create a new app
              appId = null;
            } else if (typeof selectedDeployLocation === "string") {
              // parse the selected appId as an integer
              appId = parseInt(selectedDeployLocation, 10);
            }

            config
              .publishContent(
                selectedEntryId,
                appId,
                txtTitle.val(),
                appMode
              )
              .always(function() {
                togglePublishButton(true);
              })
              .fail(handleFailure)
              .then(function(result) {
                notify.set_message(
                  " Successfully published content",
                  // timeout in milliseconds after which the notification
                  // should disappear
                  15 * 1000,
                  // click handler
                  function() {
                    // note: logs_url is included in result.config
                    window.open(result.config.config_url, "");
                  },
                  // options
                  {
                    class: "info",
                    icon: "fa fa-link",
                    // tooltip
                    title: "Click to open published content on RStudio Connect"
                  }
                );
                publishModal.modal("hide");
              });
          }

          if (selectedEntryId !== null && validTitle) {
            togglePublishButton(false);

            var currentNotebookTitle =
              config.servers[selectedEntryId].notebookTitle;
            var currentAppId = config.servers[selectedEntryId].appId;

            function publishOrSearch() {
              if (selectedDeployLocation) {
                // user selected where to publish: new/existing
                publish();
              } else {
                // no selection, show content selection dialog
                config
                  .appSearch(
                    selectedEntryId,
                    txtTitle.val(),
                    currentAppId
                  )
                  .fail(handleFailure)
                  .then(function(searchResults) {
                    if (searchResults.length === 0) {
                      // no matching content so publish to new endpoint
                      selectedDeployLocation = DeploymentLocation.New;
                      publish();
                    } else {
                      // some search results so let user choose an option.
                      // note: in case of single match we can't be 100% sure
                      // that the user wants to overwrite the content
                      publishModal.modal("hide");
                      showSearchDialog(
                        searchResults,
                        selectedEntryId,
                        txtTitle.val(),
                        currentAppId,
                        appMode
                      );
                    }
                  });
              }
            }

            if (!currentNotebookTitle) {
              // never been published before (or would have notebook title)
              debug.info(
                "publishing for the first time, user selected something: ",
                !!selectedDeployLocation
              );

              publishOrSearch();

              // do search and allow user to pick an option
            } else if (currentNotebookTitle !== txtTitle.val()) {
              // published previously but title changed
              debug.info(
                "title changed, user selected something: ",
                !!selectedDeployLocation
              );

              publishOrSearch();
            } else {
              // re-deploying to the same place
              debug.info("re-deploying to previous location");
              publish();
            }
          }
        });

        // add footer buttons
        var btnCancel = $(
          '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
        );
        btnPublish = $(
          '<a class="btn btn-primary" aria-hidden="true"><i class="fa fa-spinner fa-spin hidden"></i> Publish</a>'
        );
        btnPublish.toggleClass("disabled", serverId === null);
        btnPublish.on("click", function() {
          form.trigger("submit");
        });
        publishModal
          .find(".modal-footer")
          .append(btnCancel)
          .append(btnPublish);
        updateDeployNextButton();

        // if we came back from content selection dialog we should take some
        // action (if not canceled)
        if (selectedDeployLocation === DeploymentLocation.Canceled) {
          // pretend like nothing happened since Canceled is a no-op
          selectedDeployLocation = null;
        } else if (
          selectedDeployLocation &&
          selectedDeployLocation !== DeploymentLocation.New
        ) {
          form.trigger("submit");
        }
      }
    });

    return dialogResult;
  }

  function showSearchDialog(
    searchResults,
    serverId,
    title,
    appId,
    appMode
  ) {
    function getUserAppMode(mode) {
      if (mode === "static") {
        return "[document]";
      } else if (mode === "jupyter-static") {
        return "[document with source code]";
      } else {
        return "[unknown type]";
      }
    }

    var btnCancel = $('<a class="btn" aria-hidden="true">Cancel</a>');
    var btnDeploy = $(
      '<a class="btn btn-primary disabled" aria-hidden="true">Deploy</a>'
    );

    function mkRadio(value, name, configUrl, appMode) {
      var input = $("<input></input>")
        .attr("type", "radio")
        .attr("name", "location")
        .val(value)
        .data("appmode", appMode);
      var link = $("<a></a>")
        .attr("href", configUrl)
        .attr("target", "_rsconnect")
        .text(configUrl);
      var span = $("<span></span>")
        .text(name + " - ")
        .append(link);
      var span2 = $("<span></span>").text("  " + getUserAppMode(appMode));
      var label = $("<label></label>")
        .append(input)
        .append(span)
        .append(span2);
      var div = $("<div></div>")
        .addClass("radio")
        .append(label);

      label.on("click", function() {
        btnDeploy.text("Deploy");
      });
      return div;
    }
    var newLocationRadio = $(
      '<div class="radio"><label><input type="radio" name="location" value="new"><span id="new-location"</span></label></div>'
    );

    var divider = $("<p>Or update:</p>");
    newLocationRadio
      .find("#new-location")
      .text('New location with title "' + title + '"');

    var radios = searchResults.map(function(app) {
      return mkRadio(
        app.id,
        app.title || app.name,
        app.config_url,
        app.app_mode
      );
    });
    if (radios.length > 0) {
      radios.unshift(divider);
    }
    radios.unshift(newLocationRadio);

    var selectedAppMode = appMode;

    var searchDialog = Dialog.modal({
      // pass the existing keyboard manager so all shortcuts are disabled while
      // modal is active
      keyboard_manager: Jupyter.notebook.keyboard_manager,

      title: "Select deployment location",
      body: "<form><fieldset></fieldset></form>",
      // allow raw html
      sanitize: false,

      open: function() {
        disableKeyboardManagerIfNeeded();

        var form = searchDialog.find("form");
        form.find("fieldset").append(radios);

        function backToSelectServerDialog(location) {
          searchDialog.modal("hide");
          showSelectServerDialog(
            serverId,
            title,
            location,
            selectedAppMode
          );
        }

        var selectedLocation = null;

        // add footer buttons
        btnCancel.on("click", function() {
          backToSelectServerDialog(DeploymentLocation.Canceled);
        });
        btnDeploy.on("click", function() {
          backToSelectServerDialog(selectedLocation);
        });

        newLocationRadio.find("label").on("click", function() {
          btnDeploy.text("Next");
        });
        searchDialog
          .find(".modal-footer")
          .append(btnCancel)
          .append(btnDeploy);

        form.on("change", "input", function() {
          selectedLocation = $(this).val();
          selectedAppMode = $(this).data("appmode");
          btnDeploy.removeClass("disabled");
        });
      }
    });
  }

  function onPublishClicked(env, event) {
    // lazily load the config when clicked since Jupyter's init
    // function is racy w.r.t. loading of notebook metadata
    if (!config) {
      config = new RSConnect(debug);
      window.RSConnect = config;
    }

    // save before publishing so the server can pick up changes
    Jupyter.notebook
      .save_notebook()
      .then(config.fetchConfig())
      .then(function() {
        if (Object.keys(config.servers).length === 0) {
          showAddServerDialog(false).then(showSelectServerDialog);
        } else {
          showSelectServerDialog(config.previousServerId);
        }
      })
      .catch(function(err) {
        // unlikely but possible if we aren't able to save
        debug.error("Failed to save notebook:", err);
        Dialog.modal({
          title: "rsconnect_jupyter",
          body: "Failed to save this notebook. Error: " + err,
          buttons: { Ok: { class: "btn-primary" } }
        });
      });
  }

  return {
    init: init
  };
});
