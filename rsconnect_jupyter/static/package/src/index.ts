import {
  IDisposable
} from '@phosphor/disposable';

import {
  JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ToolbarButton
} from '@jupyterlab/apputils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  NotebookPanel, INotebookModel
} from '@jupyterlab/notebook';

import '../style/index.css';


class RSConnectExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {

  constructor(app: JupyterFrontEnd) {
    console.log(app);
    this.app = app;
  }

  readonly app: JupyterFrontEnd;

  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
    // Create the on-click callback for the toolbar button.
    let openPluginDialog = () => {
      alert('publishing would happen now if it was implemented!');
      //this.app.commands.execute('notebook:run-all-cells');
    };

    // Create the toolbar button
    let button = new ToolbarButton({
      iconClassName: 'rsc-icon',
      onClick: openPluginDialog,
      tooltip: 'Publish to RStudio Connect'
    });

    // Add the toolbar button to the notebook
    panel.toolbar.addItem('openPluginDialog', button);

    // The ToolbarButton class implements `IDisposable`, so the
    // button *is* the extension for the purposes of this method.
    return button;
  }
}


function activate(app: JupyterFrontEnd): void {
  let buttonExtension = new RSConnectExtension(app);
  app.docRegistry.addWidgetExtension('Notebook', buttonExtension);
  // app.contextMenu.addItem({
  //   selector: '.jp-Notebook',
  //   command: 'notebook:run-all-cells',
  //   rank: -0.5
  // });
}


const extension: JupyterFrontEndPlugin<void> = {
  id: 'rsconnect-jupyterlab',
  autoStart: true,
  activate
};


export default extension;
