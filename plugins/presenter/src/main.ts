import { Plugin, Notice } from 'obsidian';
import { PresenterView } from './PresenterView';
import { PresenterSettings, DEFAULT_SETTINGS } from './types';

export default class PresenterPlugin extends Plugin {
  settings: PresenterSettings = DEFAULT_SETTINGS;
  private view: PresenterView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Clean up any leftover state from previous session
    document.body.classList.remove('presenter-active');
    document.body.classList.remove('presenter-tool-pen', 'presenter-tool-highlighter', 'presenter-tool-eraser');
    document.body.style.cursor = '';

    // ribbon icon
    this.addRibbonIcon('pencil', 'Toggle Presenter Mode', () => {
      this.togglePresenter();
    });

    // commands
    this.addCommand({
      id: 'toggle-presenter',
      name: 'Toggle annotation mode',
      hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'd' }],
      callback: () => this.togglePresenter(),
    });

    this.addCommand({
      id: 'presenter-pen',
      name: 'Switch to Pen',
      callback: () => this.switchTool('pen'),
    });

    this.addCommand({
      id: 'presenter-highlighter',
      name: 'Switch to Highlighter',
      callback: () => this.switchTool('highlighter'),
    });

    this.addCommand({
      id: 'presenter-eraser',
      name: 'Switch to Eraser',
      callback: () => this.switchTool('eraser'),
    });

    this.addCommand({
      id: 'presenter-clear',
      name: 'Clear all annotations',
      callback: () => {
        if (this.view) {
          this.view.clearAll();
          new Notice('Annotations cleared');
        }
      },
    });

    this.addCommand({
      id: 'presenter-undo',
      name: 'Undo last stroke',
      callback: () => this.view?.undo(),
    });

    this.addCommand({
      id: 'presenter-redo',
      name: 'Redo last stroke',
      callback: () => this.view?.redo(),
    });

    // clean up annotations when switching files
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        if (this.view && this.view.isActive()) {
          this.view.deactivate();
        }
      })
    );
  }

  onunload(): void {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    document.body.classList.remove('presenter-active');
    document.body.classList.remove('presenter-tool-pen', 'presenter-tool-highlighter', 'presenter-tool-eraser');
    document.body.style.cursor = '';
  }

  private togglePresenter(): void {
    if (!this.view) {
      this.view = new PresenterView(this.settings);
    }

    this.view.toggle();
  }

  private switchTool(tool: 'pen' | 'highlighter' | 'eraser'): void {
    if (!this.view || !this.view.isActive()) {
      // auto-activate if not active
      if (!this.view) {
        this.view = new PresenterView(this.settings);
      }
      this.view.activate();
    }
    this.view.setTool(tool);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    if (this.view) {
      this.view.updateSettings(this.settings);
    }
  }
}
