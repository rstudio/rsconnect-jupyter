/* global define */

define([
  'jquery',
  'base/js/namespace',
  'base/js/dialog',
  'services/contents',
  './rsconnect'
], function($, Jupyter, Dialog, Contents, RSConnect) {
  /***********************************************************************
   * Extension bootstrap (main)
   ***********************************************************************/

  var debugModeEnabled = window.localStorage
      // eslint-disable-next-line multiline-ternary
      ? window.localStorage.getItem('__RSCONNECT_JUPYTER_DEBUG_MODE__') === 'enabled' : false;
  function verbose() {
    if (debugModeEnabled) {
      console.error.apply(window, arguments);
    }
  }

  /**
   * legacyPromiseHandler applies a function to a result whether or not
   * it's a plain value or a promise.
   * @param result {Promise|any} either a promise or a plain value
   * @param callback {Function} a function that takes result as a plain value
   * @returns {Promise|any} If result was a promise, a promise. If result was a
   * plain value, a plain value.
   */
  function legacyPromiseHandler(result, callback) {
    if (result instanceof window.Promise) {
      verbose('Using legacy promise mode.');
      return result.then(callback);
    } else {
      return callback(result);
    }
  }
  // this will be filled in by `init()`
  var notify = null;

  // this will be filled in lazily
  var config = null;
  var rsconnectVersionInfo = null;

  var DeploymentLocation = {
    New: 'new',
    Canceled: 'canceled'
  };

  var ContentsManager = new Contents.Contents({ base_url: Jupyter.notebook.base_url });
  var lastSlashInNotebookPath = Jupyter.notebook.notebook_path.lastIndexOf('/');
  var notebookDirectory = '';
  if (lastSlashInNotebookPath !== -1) {
    notebookDirectory = Jupyter.notebook.notebook_path.slice(0, lastSlashInNotebookPath);
  }

  function maybeCreateConfig() {
      if (!config) {
        config = new RSConnect(debug);
        window.RSConnect = config;
        config.getVersionInfo()
            .then(function(info) {
              console.log('rsconnect-jupyter nbextension version:', info.js_version);
              console.log('rsconnect-jupyter serverextension version:', info.rsconnect_jupyter_server_extension);
              console.log('rsconnect-python version:', info.rsconnect_python_version);
              rsconnectVersionInfo = info;
              window.rsconnectVersionInfo = info;
              if (info.js_version !== info.rsconnect_jupyter_server_extension) {
                console.error('Version Mismatch: rsconnect-jupyter has been installed incorrectly.');
                setTimeout(function () {
                  Dialog.modal({
                    title: 'Error',
                    body: 'Plugin Version Mismatch: rsconnect-jupyter has been installed incorrectly. ' +
                        'The javascript extension version reports ' + info.js_version + ' but the server ' +
                        'extension reports ' + info.rsconnect_jupyter_server_extension + '.<br />' +
                        '<ul>' +
                        '<li>Refer to the <a href="https://docs.rstudio.com/rsconnect-jupyter/#installation">' +
                        'installation instructions</a> for more information.</li>' +
                        '<li>Try completely uninstalling every version of the plugin and reinstalling. ' +
                        'Your server information will be saved.</li>' +
                        '<li>Continuing to use the plugin as-is may lead to unexpected issues.</li>' +
                        '</ul>',
                    sanitize: false,
                    buttons: {Ok: {class: 'btn-primary'}}
                  });
                }, 1000);
              }
            });
      }
  }

  function init() {
    // construct notification widget
    notify = Jupyter.notification_area.widget('rsconnect_jupyter');

    // create an action that can be invoked from many places (e.g. command
    // palette, button click, keyboard shortcut, etc.)

    // avoid 'accessing "actions" on the global IPython/Jupyter is not recommended' warning
    // https://github.com/jupyter/notebook/issues/2401
    var actions = Jupyter.notebook.keyboard_manager.actions;

    var actionName = actions.register(
      {
        icon: 'fa-cloud-upload',
        help: 'Publish to RStudio Connect',
        help_index: 'zz',
        handler: debounce(1000, onPublishClicked)
      },
      'publish',
      'rsconnect_jupyter'
    );

    // add a button that invokes the action
    Jupyter.toolbar.add_buttons_group([actionName]);

    // re-style the toolbar button to have a custom icon
    var $button = $('button[data-jupyter-action="' + actionName + '"]');
    $button.addClass('dropbtn');

    var container = $button.parent();
    $button.remove();

    var $menuContainer = $('<div class="rsc-dropdown"></div>');
    var $menu = $('<div id="rsc-menu" class="rsc-dropdown-content"></div>');

    var publishItem = $('<a href="#" id="publish-to-connect">Publish to RStudio Connect</a>');
    publishItem.click(onPublishClicked);
    $menu.append(publishItem);

    var manifestItem = $('<a href="#" id="create-manifest">Create Manifest for git Publishing</a>');
    manifestItem.click(onCreateManifestClicked);
    $menu.append(manifestItem);

    $menuContainer.append($button);
    $menuContainer.append($menu);
    container.append($menuContainer);

    $button.find('i')
      .addClass('rsc-icon');
    $button.click(onMenuClicked);
  }

  /***********************************************************************
   * Helpers
   ***********************************************************************/

  var debug = {
    info: function() {
      var args = [].slice.call(arguments);
      args.unshift('RSConnect:');
      console.info.apply(null, args);
    },
    error: function() {
      var args = [].slice.call(arguments);
      args.unshift('RSConnect:');
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

  /**
    * addValidationMarkup adds validation hints to an element
    * @param {Boolean} valid when true, validation hints are not added
    * @param {jQuery} $el jQuery handle for the element to add hint to
    * @param {String} helpText String for validation message. Newlines will be transformed to HTML line breaks
    */
  function addValidationMarkup(valid, $el, helpText) {
    if (!valid) {
      var helpBlock = $el
        .closest('.form-group')
        .addClass('has-error')
        .find('.help-block');
      helpBlock.empty();
      if (helpText.match(/\n/) !== null) {
        helpText.split('\n').forEach(function(line) {
            helpBlock.append(line+'<br />');
        });
      } else {
          helpBlock.append(helpText);
      }
    }
  }

  /**
   * Like `addValidationMarkup` but is not a validation error.
   * @param $el {jQuery} element to set help text on. Must have a `.help-block` under a `.form-group`.
   * @param helpText {String} string value to set help text to.
   */
  function addWarningMarkup($el, helpText) {
    $el
        .closest('.form-group')
        .find('.help-block')
        .text(helpText);
  }

  function maybeRemoveWarningMarkup($el) {
    addWarningMarkup($el, '');
  }

  function clearValidationMessages($parent) {
    $parent.find('.form-group').removeClass('has-error');
    $parent.find('.help-block').text('');
  }

  /**
   * fileName returns the filename from a path
   * @param path {String} file path
   * @returns {String} filename
   */
  function fileName(path) {
    return path.slice(path.lastIndexOf('/')+1);
  }

  /**
   * FileListItemManager creates a manager for the file list dropdown.
   * @param $listGroup {jQuery} the file list in the publish dialog
   * @param fileList {Array<String>} object with the list of files staged for deploy
   * @param basePath {String} base path of the notebook
   * @param notebookPath {String} the notebooke path from `Jupyter.notebook.notebook_path`
   * @returns {Object}
   * @constructor
   */
  function FileListItemManager($listGroup, fileList, basePath, notebookPath) {
    return {
      $listGroup: $listGroup,
      fileList: fileList,
      stagedFiles: fileList.slice(0),
      basePath: basePath,
      notebookPath: notebookPath,
      excludedFiles: [
                  notebookPath,
                  basePath+'/requirements.txt',
                  basePath+'/manifest.json',
                  'requirements.txt',
                  'manifest.json'
              ],
      currentPath: basePath,
      /**
       * Shows the file selector widget
       * `fileList` should be initialized before this.
       * @returns {PromiseLike<Array<String>,String>} List of files or rejection message
       * @public
       */
      showAddFilesDialog: function() {
        var result = $.Deferred();
        var that = this;
        that.currentPath = that.basePath;
        this.dialog = Dialog.modal({
          // pass the existing keyboard manager so all shortcuts are disabled while
          // modal is active
          keyboard_manager: Jupyter.notebook.keyboard_manager,

          title: 'Add Files to Deploy',
          body: '<label id="file-list-label"></label>' +
              '<ul class="list-group" id="file-list-container">' +
              '</ul>',
          buttons: {
            'Cancel': {
              'id': 'add-files-dialog-cancel',
              /**
               * Reject the staged files and replace with filelist
               * Note: `.slice(0)` is how you clone arrays in JS
               */
              click: function() {
                that.stagedFiles = that.fileList.slice(0);
                result.reject('User cancelled');
              }
            },
            'Accept': {
              'id': 'add-files-dialog-accept',
              class: 'btn-primary',
              /**
               * Accept the staged files as the new file list
               */
              click: function() {
                that.fileList = that.stagedFiles.slice(0);
                that.updateListGroupItems();
                result.resolve(that.fileList);
              }
            }
          },
          sanitize: false,
          /**
           * Opens the file dialog.
           */
          open: function() {
            that.stagedFiles = that.fileList.slice(0);
            that.fillFileList();
          }
        });
        return result;
      },
      /**
       * pathSanitizer removes the basePath from the given path.
       * @param path {string} path to sanitize
       * @returns {string} path with basepath removed
       * @private
       */
      pathSanitizer: function(path) {
        if (this.basePath === '') {
          return path;
        }
        // Assumption in here is that `path` contains `this.basePath`
        return path.slice(this.basePath.length+1);
      },
      /**
       * fillFileList fills the file selection dialog based on the current
       * state of the FileListItemManager.
       * Important state variables:
       * - currentPath (where we have navigated to)
       * - stagedFiles (which files are ready to replace the `fileList`)
       * @private
       */
      fillFileList: function() {
        var that = this;
        var $container = $('#file-list-container');
        var $label = $('#file-list-label');
        $label.empty().text(that.currentPath + '/');
        $container.empty();
        ContentsManager.list_contents(that.currentPath)
            .then(function(contents) {
              verbose('got contents:', contents);
              var content = contents.content.sort(function (a, b) {
                // Directories come first
                if (a.type === 'directory' ? b.type !== 'directory' : b.type === 'directory') {
                  return a.type === 'directory' ? -1 : 1;
                }
                // There is no 0 case because we trust no name collisions in content manager.
                // If they have the same normalized-case value, capital comes first.
                if (a.name.toLowerCase() === b.name.toLowerCase()) {
                  return a.name < b.name ? -1 : 1;
                }
                return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
              });
              // If we're not on the base path, add a ".."
              if (that.currentPath !== that.basePath) {
                var li = document.createElement('li');
                var i = document.createElement('i');
                i.className = 'fa fa-folder';
                li.appendChild(i);
                li.className = 'list-group-item';
                li.appendChild(document.createTextNode(' ..'));
                li.addEventListener('click', that.directoryUp());
                $container.append(li);
              }
              content.forEach(function(item) {
                // If the file is excluded, don't show
                if (that.excludedFiles.indexOf(item.path) !== -1) {
                  return;
                }
                var li2 = document.createElement('li');
                if (item.type === 'directory') {
                  var i2 = document.createElement('i');
                  i2.className = 'fa fa-folder';
                  li2.appendChild(i2);
                  li2.addEventListener('click', that.directoryClicked(item.path));
                } else {
                  var input = document.createElement('input');
                  input.type = 'checkbox';
                  input.name = item.name;
                  input.value = item.path;
                  if (that.stagedFiles.indexOf(item.path) !== -1) {
                    input.checked = true;
                  }
                  $(input).change(function () {
                    if(input.checked) {
                      that.stagedFiles.push(item.path);
                    } else {
                      that.stagedFiles.splice(that.stagedFiles.indexOf(item.path), 1);
                    }
                  });
                  li2.appendChild(input);
                  $(li2).click(function(ev) {
                    if (ev.target !== input) {
                      input.checked = !input.checked;
                      if (input.checked) {
                        that.stagedFiles.push(item.path);
                      } else {
                        that.stagedFiles.splice(that.stagedFiles.indexOf(item.path), 1);
                      }
                    }
                  });
                }
                li2.className = 'list-group-item';
                li2.appendChild(document.createTextNode(' ' + fileName(item.path)));
                $container.append(li2);
              });
            });
      },
      /**
       * directoryUp is a factory creating a handler for clicking the `..` item in the directory list
       * @returns {function} click handler
       * @private
       */
      directoryUp: function() {
        function handler() {
          var lastSlashIndex = this.currentPath.lastIndexOf('/');
          if (lastSlashIndex === -1) {
            this.currentPath = '';
          } else {
            this.currentPath = this.currentPath.slice(0, lastSlashIndex);
          }
          this.fillFileList();
        }
        return handler.bind(this);
      },
      /**
       * directoryClicked is a factory that creates a handler for the click of a directory in the file dialog
       * @param directory {String} directory that is clicked
       * @returns {function} click handler
       * @private
       */
      directoryClicked: function(directory) {
        function handler() {
          this.currentPath = directory;
          this.fillFileList();
        }
        return handler.bind(this);
      },
      /**
       * updateListGroupItems updates the list group from the list of staged files
       */
      updateListGroupItems: function() {
        var that = this;
        that.$listGroup.empty();
        that.fileList = that.fileList.sort();
        that.fileList.forEach(function (item) {
          var li = document.createElement('li');
          var i = document.createElement('i');
          i.className = 'fa fa-times';
          li.className = 'list-group-item';
          li.appendChild(i);
          li.appendChild(document.createTextNode(' ' + that.pathSanitizer(item)));
          li.addEventListener('click', that.listGroupItemClicked(item));
          that.$listGroup.append(li);
        });
      },
      /**
       * listGroupItemClicked creates a click handler for the given item name
       * @param item {string} item name
       * @returns {function} bound click handler
       * @private
       */
      listGroupItemClicked: function(item) {
        function handler() {
          this.fileList.splice(this.fileList.indexOf(item), 1);
          this.updateListGroupItems();
        }
        return handler.bind(this);
      }
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

  /**
   * readFileToPromise reads a file but uses jquery promises rather than
   * the native callback approach.
   * This is used to load the CA data from the provided file.
   * @param file {File} file gathered from input
   */
  function readFileToPromise(file) {
    var reader = new FileReader();
    var promise = $.Deferred();
    if (!file) {
      promise.resolve('');
      return promise.promise();
    }
    reader.onload = function () {
      promise.resolve(reader.result);
    };
    reader.onerror = function (err) {
      promise.reject(err);
    };
    reader.readAsText(file);
    return promise.promise();
  }

  function notebookExecuteToPromise(cmd) {
    var promise = $.Deferred();
    var callbacks = {
      iopub: {
        output: function (res) {
          if (res.message_type === 'error') {
            promise.reject(res);
          } else {
            promise.resolve(res);
          }
        }
      }
    };
    Jupyter.notebook.kernel.execute(cmd, callbacks);
    return promise.promise();
  }

  function getCertificateUpload(ctx) {
      return $(ctx).find('#rsc-ca-file')[0];
  }

  function showAddServerDialog(_config, inServerAddress, inServerName) {
    var addServerDialog = new AddServerDialog(_config, inServerAddress, inServerName);
    addServerDialog.init();
    return addServerDialog.result();
  }

  function AddServerDialog(_config, inServerAddress, inServerName) {
    this.config = _config;

    this.inServerAddress = inServerAddress;
    this.inServerName = inServerName;

    this.dialogResult = $.Deferred();

    this.dialog = null;
    this.$txtServer = null;
    this.$txtServerName = null;
    this.$txtApiKey = null;
    this.$checkDisableTLSCertCheck = null;
    this.$btnAdd = null;
    this.$btnCancel = null;
  }

  AddServerDialog.prototype = {
    init: function() {
      this.dialog = Dialog.modal({
        // pass the existing keyboard manager so all shortcuts are disabled while
        // modal is active
        keyboard_manager: Jupyter.notebook.keyboard_manager,

        title: 'Add RStudio Connect Server',
        body: [
          '<form>',
          '    <fieldset>',
          '        <div class="form-group">',
          '            <label class="rsc-label" for="rsc-server">Server Address</label>',
          '            <input class="form-control" id="rsc-server" type="url" placeholder="https://connect.example.com/" required>',
          '            <span class="help-block"></span>',
          '        </div>',
          '        <div class="form-group">',
          '            <label class="rsc-label" for="rsc-api-key">API Key</label>',
          '            <input class="form-control" id="rsc-api-key" type="password" placeholder="API key" minlength="32" maxlength="32" autocomplete="off" required>',
          '            <span class="help-block"></span>',
          '        </div>',
          '        <div class="form-group">',
          '            <label class="rsc-label" for="rsc-servername">Server Name</label>',
          '            <input class="form-control" id="rsc-servername" type="text" placeholder="server-nickname" minlength="1" required>',
          '            <span class="help-block"></span>',
          '        </div>',
          '        <div class="form-group">',
          '            <label class="rsc-label" id="rsc-tls-options">Secure Connection Settings</label><br />',
          '            <input type="radio" name="tls-option" id="system-tls" checked />',
          '            <label for="system-tls" class="rsc-label">Use System TLS Certificates (Default)</label><br />',
          '            <span id="certificate-upload-container"><input type="radio" name="tls-option" id="upload-tls-certificates" />',
          '            <label for="upload-tls-certificates" class="rsc-label">Upload TLS Certificate Bundle</label></span><br />',
          '            <input type="radio" name="tls-option" id="disable-tls-verification" />',
          '            <label for="disable-tls-verification" class="rsc-label">Disable TLS Verification (Not Recommended)</label>',
          '            <span class="help-block"></span>',
          '        </div>',
          '        <input type="submit" hidden>',
          '    </fieldset>',
          '</form>'
        ].join(''),

        // allow raw html
        sanitize: false,

        open: this.openDialog.bind(this)
      });
    },

    openDialog: function() {
      disableKeyboardManagerIfNeeded();

      // there is no _close_ event so let's improvise.
      this.dialog.on('hide.bs.modal', this.closeDialog.bind(this));

      this.$txtServer = this.dialog.find('#rsc-server');
      this.$txtServerName = this.dialog.find('#rsc-servername');
      this.$txtApiKey = this.dialog.find('#rsc-api-key');
      this.$radioSystemTLS = this.dialog.find('#system-tls');
      this.$radioUploadTLSCertificates = this.dialog.find('#upload-tls-certificates');
      this.$radioDisableTLSVerification = this.dialog.find('#disable-tls-verification');
      this.$txtServer.val(this.inServerAddress);
      this.$txtServerName.val(this.inServerName);
      var that = this;
      function addCertificateUpload() {
        var certificateUpload = document.createElement('input');
        certificateUpload.type = 'file';
        certificateUpload.id = 'rsc-ca-file';
        certificateUpload.className = 'rsc-file-dialog';
        that.dialog.find('#certificate-upload-container')
            .append(certificateUpload);
      }
      function maybeRemoveCertificateUpload() {
        var fileDialog = that.dialog.find('#rsc-ca-file');
        if (fileDialog) {
          fileDialog.remove();
        }
      }
      function radioTLSChange() {
        if (that.$radioDisableTLSVerification.is(':checked')) {
          maybeRemoveCertificateUpload();
          var disableTLSWarning = 'Disabling TLS verification will make your connection to RStudio Connect less secure';
          addWarningMarkup(that.$radioDisableTLSVerification, disableTLSWarning);
        } else if (that.$radioUploadTLSCertificates.is(':checked')) {
          maybeRemoveWarningMarkup(that.$radioDisableTLSVerification);
          addCertificateUpload();
        } else {
          // if systemTLS is checked
          maybeRemoveCertificateUpload();
          maybeRemoveWarningMarkup(that.$radioDisableTLSVerification);
        }
      }
      this.$radioDisableTLSVerification.change(radioTLSChange);
      this.$radioSystemTLS.change(radioTLSChange);
      this.$radioUploadTLSCertificates.change(radioTLSChange);

      var form = this.dialog.find('form').on('submit', this.onSubmit.bind(this));

      // add footer buttons
      this.$btnCancel = $(
        '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
      );
      this.$btnAdd = $(
        '<a class="btn btn-primary" aria-hidden="true"><i class="fa fa-spinner fa-spin hidden"></i> Add Server</a>'
      );
      this.$btnAdd.on('click', function() {
        form.trigger('submit');
      });
      this.dialog
        .find('.modal-footer')
        .append(this.$btnCancel)
        .append(this.$btnAdd);

      // setup TLS help icon

      var msg =
        'These settings only affect connections using addresses beginning with "https". Most users should use ' +
        'System TLS Certificates. If you encounter a TLS error, ask your administrator for a certificate bundle. ' +
        'If none is available, you can disable TLS verification completely.';

      var helpIcon = $(
        [
          '<a tabindex="0" role="button" data-toggle="popover" data-trigger="focus">',
          '<i class="fa fa-question-circle rsc-fa-icon"></i>'
        ].join('')
      )
        .data('content', msg)
        .popover();

      $('#rsc-tls-options').append(helpIcon);
    },

    closeDialog: function() {
      this.dialogResult.reject('canceled');
    },

    result: function() {
      return this.dialogResult;
    },

    validate: function() {
      var server = this.$txtServer.val();
      if (server.indexOf('http') !== 0) {
        this.$txtServer.val('http://' + server);
      }

      var validServer = this.$txtServer.val().length > 0;
      // if browser supports <input type=url> then use its checkValidity function
      if (this.$txtServer.get(0).checkValidity) {
        validServer &= this.$txtServer.get(0).checkValidity();
      }
      var validServerName = this.$txtServerName.val().length > 0;
      var validApiKey = this.$txtApiKey.val().length === 32;

      addValidationMarkup(
        validServer,
        this.$txtServer,
        'This should be the location of RStudio Connect: e.g. https://connect.example.com/'
      );
      addValidationMarkup(
        validServerName,
        this.$txtServerName,
        'This should not be empty.'
      );
      addValidationMarkup(
        validApiKey,
        this.$txtApiKey,
        'API Key must be 32 characters long.'
      );

      return (validServer && validServerName && validApiKey);
    },

    toggleAddButton: function(state) {
      this.dialog.find('fieldset').attr('disabled', state ? null : true);
      this.$btnAdd
        .toggleClass('disabled', !state)
        .find('i.fa')
        .toggleClass('hidden', state);
    },

    getServerError: function(xhr) {
      var msg;

      if (xhr.status === 400) {
        if (xhr.responseJSON) {
            if (xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else {
                msg = 'Server returned an unexpected response:' + xhr.responseJSON;
            }
        } else {
            msg = 'Failed to verify that RStudio Connect is running at ' +
                this.$txtServer.val() +
                '. Please ensure the server address is valid.';
        }
      }
      else if (xhr.status === 401) {
        msg = 'The server did not accept the API key.';
      }
      else {
        msg = 'An error occurred while checking the server.';
      }
      return msg;
    },

    onSubmit: function(e) {
      var self = this;
      e.preventDefault();
      clearValidationMessages(this.dialog);

      if (this.validate()) {
        this.toggleAddButton(false);
        var that = this;
        var fileCaBundleFile = getCertificateUpload(this.dialog);
        var submit;
        if (fileCaBundleFile) {
          // if we have a file, we call `addServer` with TLS checking
          // enabled and provide CA data
          submit = readFileToPromise(fileCaBundleFile.files[0])
              .then(function (cadata) {
                return that.config
                  .addServer(
                    that.$txtServer.val(),
                    that.$txtServerName.val(),
                    that.$txtApiKey.val(),
                    false,
                    cadata
                  );
              });
        } else {
          // if not, we optionally disable TLS checking and leave CA data
          // undefined.
          submit = that.config
                .addServer(
                  that.$txtServer.val(),
                  that.$txtServerName.val(),
                  that.$txtApiKey.val(),
                  that.$radioDisableTLSVerification.is(':checked')
            );
        }
        submit
          .then(function(serverId) {
            self.dialogResult.resolve(serverId);
            self.dialog.modal('hide');
          })
          .fail(function(xhr) {
            addValidationMarkup(
              false,
              self.$txtServer,
              self.getServerError(xhr)
            );
          })
          .always(function() {
            self.toggleAddButton(true);
          });
      }
    }
  };

  /**
   * showSelectServerDialog shows the publishing dialog
   * @param serverId {String} Server Unique Identifier
   * @param fileList {Array<String>} list of file paths to be included
   * @param userEditedTitle {String} title as edited by user
   * @param selectedDeployLocation {DeploymentLocation.Canceled|DeploymentLocation.New|String} whether this is a new
   * deployment, a canceled deployment, or has an app id
   * @param selectedAppMode {'jupyter-static'|'static'|null} App mode
   * @param environmentOptions {null|"use-existing-conda"|"use-existing-pip"|"generate-new-pip"|"generate-new-conda"}
   *        Selected environment option
   */
  function showSelectServerDialog(
    // serverId, fileList, and userEditedTitle are shuttled
    // between content selection dialog and this dialog.
    serverId,
    fileList,
    userEditedTitle,
    // selectedDeployLocation is set to: DeploymentLocation.Canceled when
    // content selection was canceled, DeploymentLocation.New when user wants to
    // deploy to a new location, and a stringy appId in case the user wishes to
    // overwrite content
    selectedDeployLocation,
    selectedAppMode,
    environmentOptions
  ) {
    var dialogResult = $.Deferred();
    var files = fileList || [];
    var servers = Object.keys(config.servers);
    if (servers.length === 1) {
      serverId = servers[0];
    }

    var selectedEntryId = serverId;

    var entry = config.servers[selectedEntryId];
    var previousAppMode = entry && entry.appMode;
    var appMode = selectedAppMode || previousAppMode || 'jupyter-static';

    // will be set during modal initialization
    var btnPublish = null;

    function reselectPreviousServer() {
      // Reopen publish dialog. Only keep the current server selected
      // if it has an API key. This is needed because we previously
      // didn't save API keys, so there could be a saved server without one.
      if (selectedEntryId &&
          !config.getApiKey(config.servers[selectedEntryId].server)) {
          showSelectServerDialog(
              null,
              null,
              null,
              null,
              null,
              environmentOptions
          );
      }
      else {
        showSelectServerDialog(
            selectedEntryId,
            null,
            null,
              null,
              null,
            environmentOptions
        );
      }
    }

    function mkServerItem(id, active) {
      var btnRemove = $('<button></button>')
        .addClass('pull-right btn btn-danger btn-xs')
        .attr('type', 'button')
        .append($('<i></i>').addClass('fa fa-remove'))
        .on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          var $a = $(this).closest('a');
          config
            .removeServer(id)
            .then(function() {
              $a.remove();
              // if active server is removed, disable publish button
              if ($a.hasClass('active')) {
                btnPublish.addClass('disabled');
                selectedEntryId = null;
                updateCheckboxStates();
              }
            })
            .fail(function(err) {
              // highly unlikely this will ever be triggered
              debug.error(err);
            });
        });
      var title = $('<small></small>')
        .addClass('rsc-text-light')
        .text('— ' + config.servers[id].server);
      var a = $('<a></a>')
        .addClass('list-group-item')
        .toggleClass('active', active)
        .toggleClass('disabled', !!selectedDeployLocation)
        .attr('href', '#')
        .text(config.servers[id].serverName)
        .append(title)
        .append(btnRemove);

      if (!selectedDeployLocation) {
        a.on('click', function() {
          var $this = $(this);
          $this
            .toggleClass('active')
            .siblings()
            .removeClass('active');

          // toggle publish button disable state based on whether
          // there is a selected server
          if ($this.hasClass('active')) {
            selectedEntryId = id;
            var updatedEntry = config.servers[selectedEntryId];
            if (!config.getApiKey(updatedEntry.server)) {
              publishModal.modal('hide');
              showAddServerDialog(config, updatedEntry.server, updatedEntry.serverName)
                .fail(reselectPreviousServer);
            }

            btnPublish.removeClass('disabled');
            maybeShowConfigUrl();
            maybeUpdateAppTitle();

            // select associated appmode, if any
            appMode = selectedAppMode || (updatedEntry && updatedEntry.appMode) || 'jupyter-static';
            selectPreviousAppMode();
            updateCheckboxStates();
          } else {
            selectedEntryId = null;
            btnPublish.addClass('disabled');
            updateCheckboxStates();
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
      appModeChoices.removeClass('active').addClass(function() {
        if ($(this).data('appmode') === appMode) {
          return 'active';
        }
      });
    }

    function maybeShowConfigUrl() {
      var updatedEntry = config.servers[selectedEntryId];
      if (
        updatedEntry &&
        updatedEntry.configUrl &&
        selectedDeployLocation !== DeploymentLocation.New
      ) {
        publishModal
          .find('div[data-id=configUrl]')
          .text('Currently published at: ')
          .append(
            $('<a></a>')
              .attr('href', updatedEntry.configUrl)
              .attr('target', '_rsconnect')
              .text(updatedEntry.configUrl)
          );
      } else {
        publishModal
          .find('div[data-id=configUrl]')
          .text('')
          .find('a')
          .remove();
      }
    }

    function maybeUpdateAppTitle() {
      // Retrieve the title from the Connect server and make that the new default title.
      // only do this if the user hasn't edited the title
      if (txtTitle.val() === initialTitle && !userEditedTitle) {
        // and we have a valid API key to use for the request
        if (selectedEntryId) {
          var updatedEntry = config.servers[selectedEntryId];
          var appId = updatedEntry && updatedEntry.appId;

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

    function updateCheckboxStates() {
      var publishingWithSource = (appMode === 'jupyter-static');
      var serverSelected = !!selectedEntryId;
      var $filesBox = $('#include-files');
      var includingFiles = $filesBox.prop('checked');
      var canIncludeFiles = publishingWithSource && serverSelected;

      $filesBox.prop('disabled', !canIncludeFiles);
      if (!publishingWithSource) {
        $filesBox.prop('checked', false);
      }
      $filesBox.parent().toggleClass('rsc-text-light', !canIncludeFiles);

      var canIncludeSubdirs = canIncludeFiles && includingFiles;
      var $subdirsBox = $('#include-subdirs');
      $subdirsBox.prop('disabled', !canIncludeSubdirs);
      if (!canIncludeSubdirs) {
        $subdirsBox.prop('checked', false);
      }
      $subdirsBox.parent().toggleClass('rsc-text-light', !canIncludeSubdirs);
    }

    var publishModal = Dialog.modal({
      // pass the existing keyboard manager so all shortcuts are disabled while
      // modal is active
      keyboard_manager: Jupyter.notebook.keyboard_manager,

      title: 'Publish to RStudio Connect',
      body: [
        '<form>',
        '    <div class="form-group">',
        '        <a href="#" id="rsc-add-server" class="pull-right">Add server...</a>',
        '        <label>Publish to</label>',
        '        <div id="rsc-select-server" class="list-group">',
        '        </div>',
        '    </div>',
        '    <div class="form-group">',
        '        <label>Title</label>',
        '        <input class="form-control" id="rsc-content-title" name="title" type="text" minlength="3" maxlength="64" required>',
        '        <span class="help-block"></span>',
        '    </div>',
        '    <div class="form-group" id="rsc-publish-source">',
        '        <label>Publish Source Code</label>',
        '        <div class="list-group">',
        '            <a href="#" id="rsc-publish-with-source" class="list-group-item rsc-appmode" data-appmode="jupyter-static">',
        '                <img src="' +
          Jupyter.notebook.base_url +
          'nbextensions/rsconnect_jupyter/images/publishDocWithSource.png" class="rsc-image">',
        '                <span class="rsc-label">Publish document with source code</span><br/>',
        '                <span class="rsc-text-light">Choose this option if you want to create a scheduled report or rebuild your document on the server</span>',
        '            </a>',
        '            <a href="#" id="rsc-publish-without-source" class="list-group-item rsc-appmode" data-appmode="static">',
        '                <img src="' +
          Jupyter.notebook.base_url +
          'nbextensions/rsconnect_jupyter/images/publishDocWithoutSource.png" class="rsc-image">',
        '                <span class="rsc-label">Publish finished document only</span><br/>',
        '                <span class="rsc-text-light">Choose this option to publish a snapshot of the notebook as it appears in Jupyter</span>',
        '            </a>',
        '            <span class="help-block"></span>',
        '        </div>',
        '    </div>',
        '    <div id="add-files">',
        '      <label for="rsc-add-files" id="rsc-add-files-label" class="rsc-label">Additional Files</label>',
        '      <button id="rsc-add-files" class="btn btn-default">Select Files...</button>',
        '      <ul class="list-group" id="file-list-group">',
        '      </ul>',
        '    </div>',
        '    <div id="requirements-txt-container">',
        '    </div>',
        '    <pre id="rsc-log" hidden></pre>',
        '    <div class="form-group">',
        '    <span id="rsc-deploy-error" class="help-block"></span>',
        '    </div>',
        '    <div class="text-center" data-id="configUrl"></div>',
        '    <input type="submit" hidden>',
        '</form>',
        '<div id="version-info"></div>'
      ].join(''),

      // allow raw html
      sanitize: false,

      // triggered when dialog is visible (would be better if it was
      // post-node creation but before being visible)
      open: function() {
        // The temporary reassignment of `this` is important for the
        // content manager promise to avoid losing our broader dialog
        // scope.
        // However, we try to pass things by reference as much as
        // possible and not depend on `this` too much. For example,
        // the file list manager accepts reference arguments rather
        // than binding itself to the dialog scope.
        var that = this;
        var hasRequirementsTxt = false;
        var hasEnvironmentYml = false;
        var isCondaEnvironment = false;

        publishModal.find('#version-info').html(
            'rsconnect-jupyter server extension version: ' +
            rsconnectVersionInfo.rsconnect_jupyter_server_extension + '<br />' +
            'rsconnect-jupyter nbextension version: ' + rsconnectVersionInfo.js_version + '<br />' +
            'rsconnect-python version:' + rsconnectVersionInfo.rsconnect_python_version
        );
        that.fileListItemManager = new FileListItemManager(
            $('#file-list-group'),
            files,
            notebookDirectory,
            Jupyter.notebook.notebook_path
        );
        that.fileListItemManager.updateListGroupItems();
        disableKeyboardManagerIfNeeded();
        // TODO add ability to dismiss via escape key

        // clicking on links in the modal body prevents the default
        // behavior (i.e. changing location.hash)
        publishModal.find('a.modal-body').on('click', function(e) {
          var target = $(e.target).attr('target');
          if (target !== '_rsconnect' && target !== '_blank') {
            e.preventDefault();
          }
        });

        // there is no _close_ event so let's improvise
        publishModal.on('hide.bs.modal', function() {
          dialogResult.reject('canceled');
        });

        // add server button
        publishModal.find('#rsc-add-server').on('click', function() {
          publishModal.modal('hide');
          showAddServerDialog(config)
            .then(function(selectedServerId) {
              showSelectServerDialog(selectedServerId);
            })
            .fail(reselectPreviousServer);
        });

        // add files button
        publishModal.find('#rsc-add-files').on('click', function(ev) {
          that.fileListItemManager.showAddFilesDialog()
              .then(function(result) {
                  files = result;
              });
          // We `preventDefault` because this was causing the form to submit.
          // Possibly the default button behavior?
          ev.preventDefault();
        });

        var condaDetector = 'import os\n' +
            'print("CONDA_PREFIX\t"+str(os.environ.get("CONDA_PREFIX")))\n' +
            'print("CONDA_DEFAULT_ENV\t"+str(os.environ.get("CONDA_DEFAULT_ENV")))\n';
        // Detect if we're in a conda environment
        notebookExecuteToPromise(condaDetector)
            .then(function (response) {
              var output = response.content.text;
              var lines = output.split('\n');
              var map = {};
              lines.forEach(function (line) {
                var token = line.split('\t');
                map[token[0]] = token[1];
                if(token[1] !== 'None' && token[0] !== '') {
                  // TODO: enable when ready
                  // isCondaEnvironment = true;
                }
              });
            })
            .then(function() {
              return ContentsManager.list_contents(notebookDirectory);
            })
            .then(function (result) {
              function getRequirements(contents) {
                verbose('contents:', contents);
                for (var index in contents.content) {
                  if (contents.content[index].name === 'requirements.txt') {
                    verbose('Found requirements.txt:', contents.content[index]);
                    hasRequirementsTxt = true;
                  } else if (contents.content[index].name === 'environment.yml') {
                    // TODO: Enable when ready
                    // hasEnvironmentYml = true;
                  }
                }
              }
              return legacyPromiseHandler(result, getRequirements);
            })
            .then(function(result) {
              function doPrepare() {
                preparePublishRequirementsTxtDialog(
                    hasRequirementsTxt,
                    hasEnvironmentYml,
                    isCondaEnvironment,
                    environmentOptions
                );
              }
              return legacyPromiseHandler(result, doPrepare);
            });

        // generate server list
        var serverItems = Object.keys(config.servers).map(function(id) {
          var matchingServer = serverId === id;
          return mkServerItem(id, matchingServer);
        });
        publishModal.find('#rsc-select-server').append(serverItems);

        // add default title
        txtTitle = publishModal.find('[name=title]');
        txtTitle.val(initialTitle);

        function updateDeployNextButton() {
          var lastPublishedTitle =
            config.servers &&
            config.servers[selectedEntryId] &&
            config.servers[selectedEntryId].notebookTitle;

          if (!lastPublishedTitle || txtTitle.val() === lastPublishedTitle) {
            btnPublish.text('Publish');
          } else {
            btnPublish.text('Next');
          }
        }
        txtTitle.on('input', updateDeployNextButton);
        maybeShowConfigUrl();

        if (
          selectedDeployLocation &&
          selectedDeployLocation !== DeploymentLocation.Canceled
        ) {
          txtTitle.prop('disabled', true);
        }

        // app mode
        appModeChoices = publishModal.find('.rsc-appmode');
        selectPreviousAppMode();
        updateCheckboxStates();

        appModeChoices.on('click', function() {
          appMode = $(this).data('appmode');

          $(this)
            .addClass('active')
            .siblings()
            .removeClass('active');

          updateCheckboxStates();
        });

        /**
         * Prepares the radio buttons for requirements.txt if it
         * exists, or the verbiage to place in the field otherwise.
         * @param hasRequirements {boolean} Whether or not we have requirements.txt already
         * @param hasEnvironment {boolean} Whether or not we have environment.yml already
         * @param isConda {boolean} Whether or not we detected a running conda environment
         * @param checked {null|"use-existing-conda"|"use-existing-pip"|"generate-new-pip"|"generate-new-conda"}
         *        What the previously selected check was
         */
        function preparePublishRequirementsTxtDialog(hasRequirements, hasEnvironment, isConda, checked) {
          verbose(
              'Initializing requirements.txt dialog with arguments: [hasRequirements, hasEnvironment, isConda, checked]',
              hasRequirements,
              hasEnvironment,
              isConda,
              checked);
          var requirementsTxtContainer = $('#requirements-txt-container');
          requirementsTxtContainer.empty();

          requirementsTxtContainer.append(
              '<label for="requirements-txt" class="rsc-label">Environment Restore</label><br />'
          );
          if (!hasRequirements && !hasEnvironment && !isConda) {
            var message = '<p><i class="fa fa-question-circle"></i> ' +
                'A <span class="code">requirements.txt</span> file was ' +
                'not found in the notebook directory.';
            // var message = '<p><i class="fa fa-question-circle"></i> ' +
            //     'A <span class="code">requirements.txt</span> or <span class="code">environment.yml</span> file was ' +
            //     'not found in the notebook directory.';

            if (isConda) {
              message += ' An environment file will be generated from your current conda environment.</p>';
            } else {
              message += ' An environment file will be generated from your current pip environment.</p>';
            }
            requirementsTxtContainer.append(message);
          } else {
            // Track whether we've assigned a default already.
            if (hasEnvironment) {
              if (!checked) {
                checked = 'use-existing-conda';
              }
              requirementsTxtContainer.append(
                  '<input ' +
                  '  type="radio"' +
                  '  name="requirements-txt"' +
                  '  id="use-existing-conda" ' +
                  '  value="use-existing-conda" ' +
                  (checked === 'use-existing-conda' ? 'checked' : '') + ' />' +
                  '<label for="use-existing-conda">' +
                  ' Use the existing <span class="code">environment.yml</span> file in the notebook directory.' +
                  '</label><br />'
              );
            }
            if (hasRequirements) {
              if (!checked) {
                checked = 'use-existing-pip';
              }
              requirementsTxtContainer.append(
                  '<input ' +
                  '  type="radio"' +
                  '  name="requirements-txt"' +
                  '  id="use-existing-pip" ' +
                  '  value="use-existing-pip" ' +
                  (checked === 'use-existing-pip' ? 'checked' : '') + ' />' +
                  '<label for="use-existing-pip">' +
                  ' Use the existing <span class="code">requirements.txt</span> file in the notebook directory.' +
                  '</label><br />'
              );
            }
            if (isConda) {
              if (!checked) {
                checked = 'generate-new-conda';
              }
              requirementsTxtContainer.append(
                  '<input type="radio" name="requirements-txt" id="generate-new-conda" value="generate-new" ' +
                  (checked === 'generate-new-conda' ? 'checked' : '') + '/>' +
                  '<label for="generate-new-conda">' +
                  '  Generate an <span class="code">environment.yml</span> from the current conda environment.' +
                  '</label><br />'
              );
            }
            requirementsTxtContainer.append(
                '<input type="radio" name="requirements-txt" id="generate-new-pip" value="generate-new" ' +
                (checked === 'generate-new-pip' ? 'checked' : '') + ' />' +
                '<label for="generate-new-pip">' +
                '  Generate a <span class="code">requirements.txt</span> from the current pip environment.' +
                '</label>'
            );
          }
        }

        function bindCheckbox(id) {
          // save/restore value in server settings
          var $box = $('#' + id.replace('_', '-'));

          if (selectedEntryId) {
            var updatedEntry = config.servers[selectedEntryId];
            $box.prop('checked', updatedEntry[id]);
          }

          $box.on('change', function() {
            if (selectedEntryId) {
              var innerEntry = config.servers[selectedEntryId];
              innerEntry[id] = $box.prop('checked');
            }
            updateCheckboxStates();
          });
        }
        bindCheckbox('include_files');
        bindCheckbox('include_subdirs');

        // setup app mode choices help icon
        (function() {
          var msg =
            'To create a new deployment, change the title, ' +
            'click "Next", select "New location", and then ' +
            'you’ll be able to pick a new mode and publish.';

          var helpIcon = $(
            [
              '<a tabindex="0" role="button" data-toggle="popover" data-trigger="focus">',
              '<i class="fa fa-question-circle rsc-fa-icon"></i>'
            ].join('')
          )
            .data('content', msg)
            .popover();

          $('#rsc-publish-source > label').append(helpIcon);
        })();

        var form = publishModal.find('form').on('submit', function(e) {
          e.preventDefault();
          publishModal.find('.form-group').removeClass('has-error');
          publishModal.find('.help-block').text('');
          var $deploy_err = $('#rsc-deploy-error');
          $deploy_err.text('');
          $deploy_err.empty();

          var generateNewPip = publishModal.find('#generate-new-pip');
          var generateNewConda = publishModal.find('#generate-new-conda');
          var useExistingPip = publishModal.find('#use-existing-pip');
          var useExistingConda = publishModal.find('#use-existing-conda');
          var condaMode = false;
          var forceGenerate = false;
          if (generateNewPip && generateNewPip.is(':checked')) {
            forceGenerate = true;
            environmentOptions = 'generate-new-pip';
          }
          if (generateNewConda && generateNewConda.is(':checked')) {
            forceGenerate = true;
            condaMode = true;
            environmentOptions = 'generate-new-conda';
          }
          if (useExistingPip && useExistingPip.is(':checked')) {
            forceGenerate = false;
            environmentOptions = 'use-existing-pip';
          }
          if (useExistingConda && useExistingConda.is(':checked')) {
            forceGenerate = false;
            condaMode = true;
            environmentOptions = 'use-existing-conda';
          }
          if (!isCondaEnvironment) {
            // TODO: This is needed to force `requirements.txt` to be generated
            // TODO: until conda support is delivered
            condaMode = false;
          }

          var validTitle = txtTitle.val().length >= 3;

          addValidationMarkup(
              validTitle,
              txtTitle,
              'Title must be at least 3 characters.'
          );

          function togglePublishButton(enabled) {
            btnPublish
                .toggleClass('disabled', !enabled)
                .find('i.fa')
                .toggleClass('hidden', enabled);
          }

          function handleFailure(xhr) {
            var msg;
            if (
                typeof xhr === 'string' &&
                xhr.match(/No module named .*rsconnect.*/) !== null
            ) {
              msg = 'The rsconnect-python package is not installed in your current notebook kernel.<br />' +
                  'See the <a href="https://docs.rstudio.com/rsconnect-jupyter/#installation" target="_blank">' +
                  'Installation Section of the rsconnect-jupyter documentation</a> for more information.';
            } else if (typeof xhr === 'string') {
              msg = 'An unexpected error occurred: ' + xhr;
            } else if (xhr.responseJSON) {
              if (xhr.responseJSON.message) {
                msg = 'Error: ' + xhr.responseJSON.message;
              } else {
                msg = 'An unknown error occurred.';
              }
            } else if (xhr.responseText) {
              msg = 'Error: ' + xhr.responseText;
            } else {
              msg = 'An unknown error occurred.' + JSON.stringify(xhr);
            }
            addValidationMarkup(false, $deploy_err, msg);
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
            } else if (typeof selectedDeployLocation === 'string') {
              // parse the selected appId as an integer
              appId = parseInt(selectedDeployLocation, 10);
            }

            var normalizedFiles = [];
            if (notebookDirectory.length !== 0) {
              files.forEach(function (file) {
                normalizedFiles.push(
                    file.slice(notebookDirectory.length + 1)
                );
              });
            } else {
              normalizedFiles = files;
            }

            config
                .publishContent(
                    selectedEntryId,
                    appId,
                    txtTitle.val(),
                    appMode,
                    normalizedFiles,
                    condaMode,
                    forceGenerate
                )
                .always(function () {
                  togglePublishButton(true);
                })
                .fail(handleFailure)
                .then(function (result) {
                  notify.set_message(
                      ' Successfully published content',
                      // timeout in milliseconds after which the notification
                      // should disappear
                      15 * 1000,
                      // click handler
                      function () {
                        // note: logs_url is included in result.config
                        window.open(result.config.config_url, '');
                      },
                      // options
                      {
                        class: 'info',
                        icon: 'fa fa-link',
                        // tooltip
                        title: 'Click to open published content on RStudio Connect'
                      }
                  );
                  publishModal.modal('hide');
                });
          }

          if (selectedEntryId !== null && validTitle) {
            togglePublishButton(false);

            var currentNotebookTitle =
                config.servers[selectedEntryId].notebookTitle;
            var currentAppId = config.servers[selectedEntryId].appId;

            // FIXME: Pull this out into a higher scope
            // eslint-disable-next-line no-inner-declarations
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
                    .then(function (searchResults) {
                      if (searchResults.count === 0) {
                        // no matching content so publish to new endpoint
                        selectedDeployLocation = DeploymentLocation.New;
                        publish();
                      } else {
                        // some search results so let user choose an option.
                        // note: in case of single match we can't be 100% sure
                        // that the user wants to overwrite the content
                        publishModal.modal('hide');
                        showSearchDialog(
                            searchResults,
                            selectedEntryId,
                            txtTitle.val(),
                            currentAppId,
                            appMode,
                            that.fileListItemManager.fileList,
                            environmentOptions
                        );
                      }
                    });
              }
            }

            if (!currentNotebookTitle) {
              // never been published before (or would have notebook title)
              debug.info(
                  'publishing for the first time, user selected something: ',
                  !!selectedDeployLocation
              );

              publishOrSearch();

              // do search and allow user to pick an option
            } else if (currentNotebookTitle !== txtTitle.val()) {
              // published previously but title changed
              debug.info(
                  'title changed, user selected something: ',
                  !!selectedDeployLocation
              );

              publishOrSearch();
            } else {
              // re-deploying to the same place
              debug.info('re-deploying to previous location');
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
        btnPublish.toggleClass('disabled', serverId === null);
        btnPublish.on('click', function() {
          form.trigger('submit');
        });
        publishModal
          .find('.modal-footer')
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
          form.trigger('submit');
        }
      }
    });

    return dialogResult;
  }

  /**
   * showSearchDialog is the dialog shown if we're redeploying content
   * @param searchResults {Array<Object>} List of apps
   * @param serverId {String} Server Unique Identifier
   * @param title {String} App title
   * @param appId {Number} App ID
   * @param appMode {'static'|'jupyter-static'} App mode
   * @param files {Array<String>} list of file paths that will be included
   * @param environmentOptions {null|"use-existing-conda"|"use-existing-pip"|"generate-new"}
   *        What the selected environment options are
   */
  function showSearchDialog(
    searchResults,
    serverId,
    title,
    appId,
    appMode,
    files,
    environmentOptions
  ) {
    function getUserAppMode(mode) {
      if (mode === 'static' || mode === 4) {
        return '[document]';
      } else if (mode === 'jupyter-static' || mode === 7) {
        return '[document with source code]';
      } else {
        return '[unknown type]';
      }
    }

    var btnCancel = $('<a class="btn" aria-hidden="true">Cancel</a>');
    var btnDeploy = $(
      '<a class="btn btn-primary disabled" aria-hidden="true">Deploy</a>'
    );

    function mkRadio(value, name, configUrl, targetAppMode) {
      var input = $('<input></input>')
        .attr('type', 'radio')
        .attr('name', 'location')
        .val(value)
        .data('appmode', targetAppMode);
      var link = $('<a></a>')
        .attr('href', configUrl)
        .attr('target', '_rsconnect')
        .text(configUrl);
      var span = $('<span></span>')
        .text(name + ' - ')
        .append(link);
      var span2 = $('<span></span>').text('  ' + getUserAppMode(targetAppMode));
      var label = $('<label></label>')
        .append(input)
        .append(span)
        .append(span2);
      var div = $('<div></div>')
        .addClass('radio')
        .append(label);

      label.on('click', function() {
        btnDeploy.text('Deploy');
      });
      return div;
    }
    var newLocationRadio = $(
      '<div class="radio"><label><input type="radio" name="location" value="new"><span id="new-location"</span></label></div>'
    );

    var divider = $('<p>Or update:</p>');
    newLocationRadio
      .find('#new-location')
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

      title: 'Select deployment location',
      body: '<form><fieldset></fieldset></form>',
      // allow raw html
      sanitize: false,

      open: function() {
        disableKeyboardManagerIfNeeded();

        var form = searchDialog.find('form');
        form.find('fieldset').append(radios);

        function backToSelectServerDialog(location) {
          searchDialog.modal('hide');
          showSelectServerDialog(
            serverId,
            files,
            title,
            location,
            selectedAppMode,
            environmentOptions
          );
        }

        var selectedLocation = null;

        // add footer buttons
        btnCancel.on('click', function() {
          backToSelectServerDialog(DeploymentLocation.Canceled);
        });
        btnDeploy.on('click', function() {
          backToSelectServerDialog(selectedLocation);
        });

        newLocationRadio.find('label').on('click', function() {
          btnDeploy.text('Next');
        });
        searchDialog
          .find('.modal-footer')
          .append(btnCancel)
          .append(btnDeploy);

        form.on('change', 'input', function() {
          selectedLocation = $(this).val();
          selectedAppMode = $(this).data('appmode');
          btnDeploy.removeClass('disabled');
        });
      }
    });
  }

  function onMenuClicked() {
    // pop up publishing choices
    var $menu = $('#rsc-menu');
    $menu.toggleClass('show', !$menu.hasClass('show'));
  }

  function closeMenu() {
    $('#rsc-menu').toggleClass('show', false);
  }

  function onPublishClicked() {
    // This function will be passed (env, event) in the first two
    // positional slots. We're not using them.

    // lazily load the config when clicked since Jupyter's init
    // function is racy w.r.t. loading of notebook metadata
    maybeCreateConfig();

    closeMenu();

    // save before publishing so the server can pick up changes
    Jupyter.notebook
      .save_notebook()
      .then(config.fetchConfig())
      .then(function() {
        if (Object.keys(config.servers).length === 0) {
          showAddServerDialog(config).then(showSelectServerDialog);
        } else {
          showSelectServerDialog(
              config.previousServerId,
              null,
              null,
              null,
              null,
              null);
        }
      })
      .catch(function(err) {
        // unlikely but possible if we aren't able to save
        debug.error('Failed to save notebook:', err);
        Dialog.modal({
          title: 'rsconnect_jupyter',
          body: 'Failed to save this notebook. Error: ' + err,
          buttons: { Ok: { class: 'btn-primary' } }
        });
      });
  }

  function makeEditLink(filepath) {
    var url = Jupyter.notebook.base_url + 'edit/' + filepath;
    var parts = filepath.split('/');
    var filename = parts[parts.length - 1];
    return $('<a target="_blank" style="margin-right: 10px" href="' + url + '">' + filename + '</a>');
  }

  function onCreateManifestClicked() {
    // This function will be passed (env, event) in the first two
    // positional slots. We're not using them.

    // lazily load the config when clicked since Jupyter's init
    // function is racy w.r.t. loading of notebook metadata
    maybeCreateConfig();

    closeMenu();

    var dialog = Dialog.modal({
      // pass the existing keyboard manager so all shortcuts are disabled while
      // modal is active
      keyboard_manager: Jupyter.notebook.keyboard_manager,

      title: 'Create Manifest',
      body: [
        '<p>',
        '  Click <b>Create Manifest</b> to create the files needed ',
        '  for publishing to RStudio Connect via git:',
        '</p>',
        '<div style="margin-left: 20px">',
        '<p id="write-manifest-environment-info">',
        '  <b>requirements.txt</b> lists the set of Python packages that Connect will',
        '  make available on the server during publishing. If you add imports of new',
        '  packages, you will need to update requirements.txt to include them,',
        '  or select the option to regenerate it if it exists',
        '</p>',
        // '<p id="write-manifest-environment-info-conda">',
        // '  <b>environment.yml</b> lists the set of Conda packages that Connect will',
        // '  make available on the server during publishing. If you add imports of new',
        // '  packages, you will need to update environment.yml to include them,',
        // '  or select the option to regenerate it if it exists. You cannot use both' +
        // '  requirements.txt and environment.yml - you must choose one.',
        // '</p>',
        '<p id="write-manifest-manifest-info">',
        '  <b>manifest.json</b> specifies the version of python in use,',
        '  along with other settings needed during deployment. Update',
        '  or re-create this file if you update python.',
        '</p>',
        '</div>',
        '<p id="write-manifest-overwrite-info">',
        '  Files will be created only if needed. Existing files will not be overwritten.',
        '</p>',
        '<div id="rsc-manifest-status" style="color: red; height: 40px; margin-top: 15px;"></div>',
        '<div id="version-info"></div>'
      ].join(''),

      // allow raw html
      sanitize: false,

    open: function() {
        // TODO: Use this in the conda support branch
        var condaMode = false;
        var forceGenerate = false;
        var hasRequirementsTxt = false;
        var hasEnvironmentYml = false;
        var isCondaEnvironment = false;
        function prepareManifestRequirementsTxtDialog(hasRequirements, hasEnvironment, isConda) {
          var info = dialog.find('#write-manifest-overwrite-info');
          if (!hasRequirements && !hasEnvironment) {
            var html = '<p><i class="fa fa-question-circle"></i> Neither a <span class="code">requirements.txt</span> nor an' +
                '<span class="code">requirements.txt</span> file was found in the notebook directory.</p>';
            if (!isConda) {
              html += '<p>One will be generated automatically from your current python environment.</p>';
            } else {
              html += '<div id="requirements-txt-container">' +
                '<input type="radio" name="requirements-txt" id="generate-new-pip" value="generate-new-pip" />' +
                '<label for="generate-new-pip">' +
                '  Generate a <span class="code">requirements.txt</span> from the current python environment.' +
                '</label><br />' +
                '<input type="radio" name="requirements-txt" id="generate-new-conda" value="generate-new-conda" checked' +
                  ' />' +
                '<label for="generate-new-conda">' +
                '  Generate an <span class="code">environment.yml</span> from the current conda environment.' +
                '</label></div>';
            }
            info.html(html);
          } else {
            var requirementsContainer = '<div id="requirements-txt-container">';
            if (hasRequirements) {
              requirementsContainer += '<input type="radio" name="requirements-txt" id="use-existing-pip" value="use-existing-pip" checked />' +
                  '<label for="use-existing">' +
                  ' Use the existing <span class="code">requirements.txt</span> file in the notebook directory.' +
                  '</label><br />';
            }
            if (hasEnvironment) {
              requirementsContainer += '<input type="radio" name="requirements-txt" id="use-existing-conda" value="use-existing-conda" />' +
                  '<label for="use-existing">' +
                  ' Use the existing <span class="code">environment.yml</span> file in the notebook directory.' +
                  '</label><br />';
            }
            // Always present the option to generate requirements.txt
            requirementsContainer += '<input type="radio" name="requirements-txt" id="generate-new-pip" value="generate-new" />' +
                '<label for="generate-new">' +
                '  Generate a <span class="code">requirements.txt</span> from the current python environment.' +
                '</label><br />';
            if (isConda) {
              requirementsContainer += '<input type="radio" name="requirements-txt" id="generate-new-conda" value="generate-new" />' +
                  '<label for="generate-new">' +
                  '  Generate an <span class="code">environment.yml</span> from the current python environment.' +
                  '</label>';
            }
            requirementsContainer += '</div>';
            info.html(requirementsContainer);
          }
        }

        dialog.find('#version-info').html(
            'rsconnect-jupyter server extension version: ' +
            rsconnectVersionInfo.rsconnect_jupyter_server_extension + '<br />' +
            'rsconnect-jupyter nbextension version: ' + rsconnectVersionInfo.js_version + '<br />' +
            'rsconnect-python version:' + rsconnectVersionInfo.rsconnect_python_version
        );

        var condaDetector = 'import os\n' +
            'print("CONDA_PREFIX\t"+str(os.environ.get("CONDA_PREFIX")))\n' +
            'print("CONDA_DEFAULT_ENV\t"+str(os.environ.get("CONDA_DEFAULT_ENV")))\n';
        // Detect if we're in a conda environment
        notebookExecuteToPromise(condaDetector)
            .then(function (response) {
              var output = response.content.text;
              var lines = output.split('\n');
              var map = {};
              lines.forEach(function (line) {
                var token = line.split('\t');
                map[token[0]] = token[1];
                if(token[1] !== 'None' && token[0] !== '') {
                  // TODO: Enable when ready
                  // isCondaEnvironment = true;
                }
              });
            })
            .then(function() {
              return ContentsManager.list_contents(notebookDirectory);
            })
            .then(function (result) {
              function getRequirements(contents) {
                verbose('contents:', contents);
                for (var index in contents.content) {
                  if (contents.content[index].name === 'requirements.txt') {
                    verbose('Found requirements.txt:', contents.content[index]);
                    hasRequirementsTxt = true;
                  } else if (contents.content[index].name === 'environment.yml') {
                    // TODO: Enable when ready
                    // hasEnvironmentYml = true;
                  }
                }
              }
              return legacyPromiseHandler(result, getRequirements);
            })
            .then(function (result) {
              function doPrepare() {
                prepareManifestRequirementsTxtDialog(
                    hasRequirementsTxt,
                    hasEnvironmentYml,
                    isCondaEnvironment);
              }
              return legacyPromiseHandler(result, doPrepare);
            });

        var btnCancel = $(
          '<a class="btn" data-dismiss="modal" aria-hidden="true">Cancel</a>'
        );
        var btnCreateManifest = $(
          '<a class="btn" aria-hidden="true">Create Manifest</a>'
        );
        btnCreateManifest.on('click', function() {
          var $status = $('#rsc-manifest-status');
          var $spinner = $('<i class="fa fa-spinner fa-spin" style="margin-left: 15px"></i>');
          btnCreateManifest.append($spinner);
          btnCreateManifest.attr('disabled', true);
          $status.empty();
          $status.append($('<div>Creating manifest...</div>'));

          var generateNewPip = dialog.find('#generate-new-pip');
          var generateNewConda = dialog.find('#generate-new-conda');
          var useExistingPip = dialog.find('#use-existing-pip');
          var useExistingConda = dialog.find('#use-existing-conda');

          // The next four if blocks are made explicit for clarity.
          if (generateNewPip && generateNewPip.is(':checked')) {
            forceGenerate = true;
          }
          if (generateNewConda && generateNewConda.is(':checked')) {
            forceGenerate = true;
            condaMode = true;
          }
          if (useExistingPip && useExistingPip.is(':checked')) {
            forceGenerate = false;
          }
          if (useExistingConda && useExistingConda.is(':checked')) {
            forceGenerate = false;
            condaMode = true;
          }

          config.inspectEnvironment(condaMode, forceGenerate).then(function(environment) {
            return config.writeManifest(Jupyter.notebook.get_notebook_name(), environment).then(function(response) {
              var createdLinks = response.created.map(makeEditLink);
              $status.empty();
              if (response.created.length > 0) {
                $status.append($('<span>Successfully saved: </span>'));
                $status.append(createdLinks);
                $status.append($('<br>'));
              }

              if (response.skipped.length > 0) {
                var skippedLinks = response.skipped.map(makeEditLink);
                $status.append($('<span>Already existed: </span>'));
                $status.append(skippedLinks);
              }
            })
            .fail(function(response) {
              $status.text(response.responseJSON.message);
            });
          })
          .fail(function(response) {
            if (
              typeof response === 'string' &&
              response.match(/No module named .*rsconnect.*/) !== null
            ) {
              $status.html(
             'The rsconnect-python package is not installed in your current notebook kernel.<br />' +
                  'See the <a href="https://docs.rstudio.com/rsconnect-jupyter/#installation" target="_blank">' +
                  'Installation Section of the rsconnect-jupyter documentation</a> for more information.'
              );
            } else if (typeof response === 'string') {
              $status.html(
                  'An unexpected error occurred while inspecting the environment: ' + response
              );
            } else {
              $status.text(response.responseJSON.message);
            }
          })
          .always(function() {
            $spinner.remove();
            btnCreateManifest.attr('disabled', false);
          });
        });

        dialog
          .find('.modal-footer')
          .append(btnCancel)
          .append(btnCreateManifest);
      }
    });
  }

  return {
    init: init
  };
});
