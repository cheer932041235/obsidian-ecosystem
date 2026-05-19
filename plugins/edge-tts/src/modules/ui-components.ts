import { EdgeTTSPluginSettings } from './settings';
import { setIcon, setTooltip, Platform } from 'obsidian';
import { AudioPlaybackManager } from './audio-playback';
import { TTSEngine, TTSTaskStatus } from './tts-engine';
import EdgeTTSPlugin from 'src/main';

/**
 * Manages UI components for the Edge TTS plugin
 */
export class UIManager {
  private plugin: EdgeTTSPlugin;
  private settings: EdgeTTSPluginSettings;
  private statusBarEl: HTMLElement | null = null;
  private ribbonIconEl: HTMLElement | null = null;
  private audioManager: AudioPlaybackManager;
  private ttsEngine?: TTSEngine;

  constructor(plugin: EdgeTTSPlugin, settings: EdgeTTSPluginSettings, audioManager: AudioPlaybackManager, ttsEngine?: TTSEngine) {
    this.plugin = plugin;
    this.settings = settings;
    this.audioManager = audioManager;
    this.ttsEngine = ttsEngine;
  }

  /**
   * Initialize the status bar with TTS controls
   */
  initializeStatusBar(): void {
    this.statusBarEl = this.plugin.addStatusBarItem();
    this.updateStatusBar();
  }

  /**
   * Remove the status bar button
   */
  removeStatusBarButton(): void {
    if (this.statusBarEl) {
      this.statusBarEl.remove();
      this.statusBarEl = null;
    }
  }

  /**
   * Update the status bar with appropriate controls
   */
  updateStatusBar(withControls = false): void {
    if (!this.statusBarEl) return;
    if (!this.settings.showStatusBarButton) {
      this.removeStatusBarButton();
      return;
    }

    this.statusBarEl.empty();

    // Check if we have background tasks in progress
    const hasActiveTasks = this.hasActiveTasks();

    if (hasActiveTasks) {
      // Show background task indicator with progress
      this.renderTaskProgressIndicator();
    }
    else if (withControls) {
      // Add pause/play button
      const pausePlayButton = createEl('span', { cls: 'edge-tts-status-bar-control' });
      setTooltip(pausePlayButton, this.audioManager.isPlaybackPaused() ? '继续' : '暂停', { placement: 'top' })
      setIcon(pausePlayButton, this.audioManager.isPlaybackPaused() ? 'circle-play' : 'circle-pause');
      pausePlayButton.onclick = () => (this.audioManager.isPlaybackPaused() ? this.audioManager.resumePlayback() : this.audioManager.pausePlayback());
      this.statusBarEl.appendChild(pausePlayButton);

      // Add stop button
      const stopButton = createEl('span', { cls: 'edge-tts-status-bar-control' });
      setTooltip(stopButton, '停止', { placement: 'top' })
      setIcon(stopButton, 'square');
      stopButton.onclick = () => this.audioManager.stopPlayback();
      this.statusBarEl.appendChild(stopButton);
    } else {
      // Add icon to read note aloud
      const readAloudStatusBar = createEl('span', { cls: 'edge-tts-status-bar-control' });
      setTooltip(readAloudStatusBar, '打开语音朗读面板', { placement: 'top' })
      setIcon(readAloudStatusBar, 'audio-lines');
      readAloudStatusBar.onclick = () => this.plugin.activatePlaybackPanel();
      this.statusBarEl.appendChild(readAloudStatusBar);
    }
  }

  /**
   * Render a progress indicator for background tasks
   */
  private renderTaskProgressIndicator(): void {
    if (!this.statusBarEl || !this.ttsEngine) return;

    const tasks = this.ttsEngine.getAllTasks();
    const processingTasks = tasks.filter(t => t.status === TTSTaskStatus.PROCESSING);
    const pendingTasks = tasks.filter(t => t.status === TTSTaskStatus.PENDING);

    // Container for the status elements
    const container = createEl('div', { cls: 'edge-tts-status-bar-progress-container' });

    // Icon for TTS processing
    const icon = createEl('span', { cls: 'edge-tts-status-bar-icon' });
    setIcon(icon, 'cpu');
    container.appendChild(icon);

    if (processingTasks.length > 0) {
      // Show progress for the current task
      const task = processingTasks[0];
      const progressText = createEl('span', {
        cls: 'edge-tts-status-bar-text',
        text: `${task.progress}%`
      });
      container.appendChild(progressText);

      // Add tooltip with details
      const taskCount = processingTasks.length + pendingTasks.length;
      const taskText = `${taskCount} 个任务`;
      setTooltip(container, `正在生成语音：${taskText}`, { placement: 'top' });
    } else if (pendingTasks.length > 0) {
      // Show waiting status for pending tasks
      const progressText = createEl('span', {
        cls: 'edge-tts-status-bar-text',
        text: '等待中...'
      });
      container.appendChild(progressText);

      // Add tooltip with details
      const taskCount = pendingTasks.length;
      const taskText = `${taskCount} 个任务`;
      setTooltip(container, `等待处理：${taskText}`, { placement: 'top' });
    }

    this.statusBarEl.appendChild(container);
  }

  /**
   * Check if there are any active TTS tasks
   */
  private hasActiveTasks(): boolean {
    if (!this.ttsEngine) return false;

    const tasks = this.ttsEngine.getAllTasks();
    return tasks.some(t =>
      t.status === TTSTaskStatus.PENDING ||
      t.status === TTSTaskStatus.PROCESSING
    );
  }

  /**
   * Add the plugin ribbon icon
   */
  addPluginRibbonIcon(): void {
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
    }

    this.ribbonIconEl = this.plugin.addRibbonIcon('audio-lines', '打开语音朗读面板', () => {
      this.plugin.activatePlaybackPanel();
    });
  }

  /**
   * Remove the plugin ribbon icon
   */
  removePluginRibbonIcon(): void {
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  /**
   * Add plugin menu items to file and editor menus
   */
  addPluginMenuItems(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-menu', (menu: any, file: any) => {
        menu.addItem((item: any) => {
          item
            .setTitle('朗读当前笔记')
            .setIcon('audio-lines')
            .onClick(async () => {
              this.plugin.activatePlaybackPanel();
              this.plugin.readNoteAloud(undefined, undefined, file.path);
            });
        });

        if (this.settings.enableQueueFeature) {
          menu.addItem((item: any) => {
            item
              .setTitle('加入朗读队列')
              .setIcon('list-plus')
              .onClick(async () => {
                const content = await this.plugin.fileManager.extractFileContent(file.path);
                if (content) {
                  this.audioManager.addToQueue(content, file.basename);
                  // Show queue manager if it's not visible
                  if (this.plugin.queueUIManager && !this.plugin.queueUIManager.getIsQueueVisible()) {
                    this.plugin.queueUIManager.showQueue();
                  }
                }
              });
          });
        }

        // Only show MP3 generation on desktop
        if (this.settings.generateMP3 && !Platform.isMobile) {
          menu.addItem((item: any) => {
            item
              .setTitle('生成 MP3 音频')
              .setIcon('microphone')
              .onClick(async () => {
                await this.plugin.generateMP3(undefined, undefined, file.path);
              });
          });
        }
      })
    );

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-menu', (menu: any, editor: any, view: any) => {
        menu.addItem((item: any) => {
          item
            .setTitle('朗读当前笔记/选区')
            .setIcon('audio-lines')
            .onClick(async () => {
              this.plugin.activatePlaybackPanel();
              this.plugin.readNoteAloud(editor, view);
            });
        });

        if (this.settings.enableQueueFeature) {
          menu.addItem((item: any) => {
            item
              .setTitle('加入朗读队列')
              .setIcon('list-plus')
              .onClick(async () => {
                const selectedText = editor.getSelection();
                const noteTitle = view.file?.basename || 'Untitled';
                if (selectedText.trim()) {
                  this.audioManager.addToQueue(selectedText, `${noteTitle} (selection)`);
                } else {
                  this.audioManager.addToQueue(editor.getValue(), noteTitle);
                }
                // Show queue manager if it's not visible
                if (this.plugin.queueUIManager && !this.plugin.queueUIManager.getIsQueueVisible()) {
                  this.plugin.queueUIManager.showQueue();
                }
              });
          });
        }

        menu.addItem((item: any) => {
          item
            .setTitle('从光标处朗读')
            .setIcon('cursor')
            .onClick(async () => {
              this.plugin.readFromCursor(editor, view);
            });
        });

        // Only show MP3 generation on desktop
        if (this.settings.generateMP3 && !Platform.isMobile) {
          menu.addItem((item: any) => {
            item
              .setTitle('生成 MP3 音频')
              .setIcon('microphone')
              .onClick(async () => {
                await this.plugin.generateMP3(editor, view);
              });
          });
        }
      })
    );
  }

  /**
   * Set the TTS engine reference
   */
  setTTSEngine(ttsEngine: TTSEngine): void {
    this.ttsEngine = ttsEngine;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: EdgeTTSPluginSettings): void {
    this.settings = settings;
  }
} 