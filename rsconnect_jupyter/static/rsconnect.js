define([
    'base/js/utils'
    ], function (Utils) {
        function RSConnect(debug) {
            /* sample value of `Jupyter.notebook.metadata`:
               { version: 1,
                 previousServerId: "abc-def-ghi-jkl",
                 servers: {
                   "xyz-uvw": { server: "http://172.0.0.3:3939/", serverName: "dev" },
                   "rst-opq": { server: "http://somewhere/connect/", serverName: "prod", notebookTitle:"Meow", appId: 42, appMode: "static" },
                 },
               }
            */

            this.previousServerId = null;
            this.servers = {};
            this.apiKeys = {}

            // TODO more rigorous checking?
            var metadata = JSON.parse(JSON.stringify(Jupyter.notebook.metadata));
            if (metadata.rsconnect && metadata.rsconnect.servers) {
                // make a copy
                this.servers = metadata.rsconnect.servers;

                // if a server is present but no API key, remove it
                // since we can't successfully publish there.
                for (serverId in this.servers) {
                    if (!this.getApiKey(this.servers[serverId].server)) {
                        delete this.servers[serverId];
                    }
                }
                // previousServer may have been removed
                this.previousServerId =
                    metadata.rsconnect.previousServerId in this.servers
                        ? metadata.rsconnect.previousServerId
                        : null;
            }

            this.saveNotebookMetadata = this.saveNotebookMetadata.bind(this);
            this.updateServer = this.updateServer.bind(this);
            this.verifyServer = this.verifyServer.bind(this);
            this.addServer = this.addServer.bind(this);
            this.fetchConfig = this.fetchConfig.bind(this);
            this.saveConfig = this.saveConfig.bind(this);
            this.getApiKey = this.getApiKey.bind(this);
            this.getApp = this.getApp.bind(this);
            this.removeServer = this.removeServer.bind(this);
            this.inspectEnvironment = this.inspectEnvironment.bind(this);
            this.publishContent = this.publishContent.bind(this);
            this.getNotebookTitle = this.getNotebookTitle.bind(this);
            this.debug = debug;
        }

        RSConnect.prototype = {
            saveNotebookMetadata: function () {
                var result = $.Deferred();
                var self = this;
                // overwrite metadata (user may have changed it)
                Jupyter.notebook.metadata.rsconnect = {
                    version: 1,
                    previousServerId: self.previousServerId,
                    servers: self.servers
                };

                // save_notebook returns a native Promise while the rest of
                // the code including parts of Jupyter return jQuery.Deferred
                Jupyter.notebook
                    .save_notebook()
                    .then(function () {
                        // notebook is writable
                        result.resolve();
                    })
                    .catch(function (e) {
                        self.debug.error(e);
                        // notebook is read-only (server details will likely not be persisted)
                        result.resolve();
                    });
                return result;
            },

            verifyServer: function (server, apiKey) {
                var self = this;

                return Utils.ajax({
                    url: Jupyter.notebook.base_url + 'rsconnect_jupyter/verify_server',
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    data: JSON.stringify({
                        server_address: server,
                        api_key: apiKey
                    })
                });
            },

            addServer: function (server, serverName, apiKey) {
                var self = this;
                if (server[server.length - 1] !== '/') {
                    server += '/';
                }

                // verify the server exists, then save
                return this.verifyServer(server, apiKey).then(function (data) {
                    var id = data.address_hash;
                    self.servers[id] = {
                        server: data.server_address,
                        serverName: serverName
                    };
                    self.apiKeys[server] = apiKey;
                    return self
                        .saveConfig()
                        .then(self.saveNotebookMetadata)
                        .then(function () {
                            return id;
                        });
                });
            },

            getApiKey: function(server) {
                return this.apiKeys[server];
            },

            getApp: function (serverId, appId) {
                var self = this;
                var entry = this.servers[serverId];

                return Utils.ajax({
                    url: Jupyter.notebook.base_url + 'rsconnect_jupyter/app_get',
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    data: JSON.stringify({
                        app_id: appId,
                        server_address: entry.server,
                        api_key: self.getApiKey(entry.server)
                    })
                });
            },

            saveConfig: function () {
                var self = this;
                var toSave = {};

                for (var serverId in this.servers) {
                    var src = this.servers[serverId];

                    var dst = {
                        server: src.server,
                        serverName: src.serverName,
                        apiKey: self.getApiKey(src.server)
                    };

                    toSave[serverId] = dst;
                }
                self.debug.info('saving config:', toSave);
                return Utils.ajax({
                    url: Jupyter.notebook.base_url + 'api/config/rsconnect_jupyter',
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    data: JSON.stringify(toSave)
                });
            },

            fetchConfig: function () {
                var self = this;
                return Utils.ajax({
                    url: Jupyter.notebook.base_url + 'api/config/rsconnect_jupyter',
                    method: 'GET'
                }).then(function (data) {
                    self.debug.info('fetched config:', data);
                    if (!self.servers) {
                        self.servers = {};
                    }

                    for (var serverId in data) {
                        // Split out API keys so they're not saved into the notebook metadata.
                        var entry = data[serverId];
                        self.apiKeys[entry.server] = entry.apiKey;
                        delete entry.apiKey

                        if (!self.servers[serverId]) {
                            self.servers[serverId] = entry;
                        }
                    }
                });
            },

            updateServer: function (id, appId, notebookTitle, appMode, configUrl) {
                this.servers[id].appId = appId;
                this.servers[id].notebookTitle = notebookTitle;
                this.servers[id].appMode = appMode;
                this.servers[id].configUrl = configUrl;
                return this.saveNotebookMetadata();
            },

            removeServer: function (id) {
                delete this.servers[id];
                return this.saveConfig().then(this.saveNotebookMetadata);
            },

            inspectEnvironment: function () {
                var self = this;
                var path = Jupyter.notebook.notebook_name;

                try {
                    var cmd = [
                        '!',
                        Jupyter.notebook.kernel_selector.kernelspecs[
                            Jupyter.notebook.kernel.name
                            ].spec.argv[0],
                        ' -m rsconnect_jupyter.environment ${PWD}/',
                        path
                    ].join('');
                    console.log('executing: ' + cmd);
                } catch (e) {
                    return $.Deferred().reject(e);
                }

                var result = $.Deferred();
                var content = '';

                function count(ch, s) {
                    return s.split(ch).length - 1;
                }

                function handle_output(message) {
                    content += message.content.text;

                    if (count('{', content) === count('}', content)) {
                        try {
                            self.debug.info('environment:', content);
                            result.resolve(JSON.parse(content));
                        } catch (err) {
                            self.debug.info('environment error:', err);
                            result.reject(content);
                        }
                    }
                }

                var callbacks = {
                    iopub: {
                        output: handle_output
                    }
                };

                Jupyter.notebook.kernel.execute(cmd, callbacks);
                return result;
            },

            publishContent: function (serverId, appId, notebookTitle, appMode) {
                var self = this;
                var notebookPath = Utils.encode_uri_components(
                    Jupyter.notebook.notebook_path
                );

                var entry = this.servers[serverId];

                var $log = $('#rsc-log').attr('hidden', null);
                $log.text('Deploying...\n');
                var $deploy_err = $('#rsc-deploy-error');
                $deploy_err.text('');

                function getLogs(deployResult) {
                    function inner(lastStatus) {
                        lastStatus = lastStatus || null;
                        return Utils.ajax({
                            url: Jupyter.notebook.base_url + 'rsconnect_jupyter/get_log',
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            data: JSON.stringify({
                                server_address: entry.server,
                                api_key: self.getApiKey(entry.server),
                                task_id: deployResult['task_id'],
                                last_status: lastStatus,
                                cookies: deployResult.cookies || []
                            })
                        }).then(function (result) {
                            if (result['last_status'] != lastStatus) {
                                lastStatus = result['lastStatus'];
                                var output = result['status'].join('\n');
                                $log.text(output);
                                // scroll to bottom
                                $log.scrollTop($log.get(0).scrollHeight);
                            }
                            if (result['finished']) {
                                if (result['code'] != 0) {
                                    var msg = 'Failed to deploy successfully: ' + result['error'];
                                    addValidationMarkup(false, $deploy_err, msg);
                                    return $.Deferred().reject(msg);
                                }
                                self.debug.info('logs:', result['status'].join('\n'));
                                return $.Deferred().resolve(deployResult['app_id']);
                            }
                            var next = $.Deferred();
                            setTimeout(function () {
                                return inner(lastStatus).then(next.resolve);
                            }, 1000);
                            return next;
                        });
                    }

                    return inner();
                }

                function appConfig(receivedAppId) {                    
                    return Utils.ajax({
                        url: Jupyter.notebook.base_url + 'rsconnect_jupyter/app_config',
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        data: JSON.stringify({
                            server_address: entry.server,
                            api_key: self.getApiKey(entry.server),
                            app_id: receivedAppId
                        })
                    }).then(function (config) {
                        return {
                            appId: receivedAppId,
                            config: config
                        };
                    });
                }

                function deploy(environment) {
                    var data = {
                        notebook_path: notebookPath,
                        notebook_title: notebookTitle,
                        notebook_name: self.getNotebookName(notebookTitle),
                        app_id: appId,
                        server_address: entry.server,
                        api_key: self.getApiKey(entry.server),
                        app_mode: appMode,
                        environment: environment
                    };

                    var xhr = Utils.ajax({
                        url: Jupyter.notebook.base_url + 'rsconnect_jupyter/deploy',
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        data: JSON.stringify(data)
                    })
                        .then(getLogs)
                        .then(appConfig);

                    // update server with title and appId and set recently selected
                    // server
                    xhr.then(function (configResult) {
                        self.previousServerId = serverId;
                        return self.updateServer(
                            serverId,
                            configResult.appId,
                            notebookTitle,
                            appMode,
                            configResult.config.config_url
                        );
                    });

                    return xhr;
                }

                if (appMode === 'jupyter-static') {
                    return this.inspectEnvironment().then(deploy);
                } else {
                    return deploy(null);
                }
            },

            appSearch: function (serverId, notebookTitle, appId) {
                var self = this;
                var entry = this.servers[serverId];

                return Utils.ajax({
                    url: Jupyter.notebook.base_url + 'rsconnect_jupyter/app_search',
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    data: JSON.stringify({
                        notebook_title: notebookTitle,
                        app_id: appId,
                        server_address: entry.server,
                        api_key: self.getApiKey(entry.server)
                    })
                });
            },

            getNotebookName: function (title) {
                // slugify title and make it unique, also ensuring that it
                // fits in the 64 character limit after the timestamp is appended.
                return (
                    title.replace(/[^a-zA-Z0-9_-]+/g, '_').substring(0, 50) +
                    '-' +
                    Date.now()
                );
            },

            getNotebookTitle: function (id) {
                if (id) {
                    // it's possible the entry is gone
                    var e = this.servers[id];
                    // if title was saved then return it
                    if (e && e.notebookTitle) {
                        return e.notebookTitle;
                    }
                }
                // default title
                return Jupyter.notebook.get_notebook_name();
            }
        };

        return RSConnect
    }
);
