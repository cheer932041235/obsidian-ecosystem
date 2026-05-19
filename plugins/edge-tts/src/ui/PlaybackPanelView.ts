import { ItemView, MarkdownView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import type EdgeTTSPlugin from '../main';

export const VIEW_TYPE_EDGE_TTS_PLAYBACK_PANEL = 'edge-tts-playback-panel';

interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
}

export class PlaybackPanelView extends ItemView {
  private plugin: EdgeTTSPlugin;
  private playbackState: PlaybackState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
  };

  constructor(leaf: WorkspaceLeaf, plugin: EdgeTTSPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_EDGE_TTS_PLAYBACK_PANEL;
  }

  getDisplayText(): string {
    return '语音朗读';
  }

  getIcon(): string {
    return 'audio-lines';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  updatePlaybackState(state: PlaybackState): void {
    this.playbackState = state;
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes.toString().padStart(2, '0')}:${rest}`;
  }

  private formatSpeed(speed: number): string {
    return `${speed.toFixed(1)}x`;
  }

  private getStatusText(): string {
    if (this.playbackState.isLoading) return '正在生成语音...';
    if (this.playbackState.isPlaying) return '正在播放';
    if (this.plugin.audioManager.isPlaybackPaused()) return '已暂停';
    return '待机';
  }

  private getTargetMarkdownView(): MarkdownView | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file) return activeView;

    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view instanceof MarkdownView && leaf.view.file) {
        return leaf.view;
      }
    }

    let fallbackView: MarkdownView | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!fallbackView && leaf.view instanceof MarkdownView && leaf.view.file) {
        fallbackView = leaf.view;
      }
    });
    return fallbackView;
  }

  private getActiveNoteName(): string {
    const view = this.getTargetMarkdownView();
    return view?.file?.basename || '当前没有打开的笔记';
  }

  private createIconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void | Promise<void>, cls = ''): HTMLButtonElement {
    const button = parent.createEl('button', { cls: `edge-tts-panel-button ${cls}`.trim() });
    const iconEl = button.createSpan({ cls: 'edge-tts-panel-button-icon' });
    setIcon(iconEl, icon);
    button.createSpan({ text: label });
    button.onclick = async () => {
      try {
        await onClick();
        this.render();
      } catch (error) {
        console.error('[Edge TTS] Panel action failed:', error);
        new Notice('语音朗读操作失败，请打开控制台查看错误。');
      }
    };
    return button;
  }

  private async readCurrentNote(): Promise<void> {
    const view = this.getTargetMarkdownView();
    if (!view) {
      new Notice('当前没有可朗读的 Markdown 笔记。');
      return;
    }
    this.playbackState = { currentTime: 0, duration: 0, isPlaying: false, isLoading: true };
    this.render();
    await this.plugin.readNoteAloud(view.editor, view);
  }

  private async readFromCursor(): Promise<void> {
    const view = this.getTargetMarkdownView();
    if (!view) {
      new Notice('当前没有可朗读的 Markdown 笔记。');
      return;
    }
    this.playbackState = { currentTime: 0, duration: 0, isPlaying: false, isLoading: true };
    this.render();
    await this.plugin.readFromCursor(view.editor, view);
  }

  private togglePauseResume(): void {
    if (this.plugin.audioManager.isPlaybackPaused()) {
      this.plugin.audioManager.resumePlayback();
    } else {
      this.plugin.audioManager.pausePlayback();
    }
  }

  private async updatePlaybackSpeed(speed: number): Promise<void> {
    const nextSpeed = Math.min(2, Math.max(0.5, Math.round(speed * 10) / 10));
    this.plugin.settings.playbackSpeed = nextSpeed;
    this.plugin.audioManager.setPlaybackSpeed(nextSpeed);
    await this.plugin.saveSettings();
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('edge-tts-panel-container');

    const root = container.createDiv({ cls: 'edge-tts-panel' });
    const header = root.createDiv({ cls: 'edge-tts-panel-header' });
    const titleWrap = header.createDiv();
    titleWrap.createEl('h2', { text: '语音朗读面板' });
    titleWrap.createEl('p', { text: '疏锦行定制版 · Edge TTS' });
    const badge = header.createDiv({ cls: 'edge-tts-panel-badge', text: this.getStatusText() });
    if (this.playbackState.isPlaying) badge.addClass('is-playing');
    if (this.playbackState.isLoading) badge.addClass('is-loading');

    const noteCard = root.createDiv({ cls: 'edge-tts-panel-card' });
    noteCard.createEl('div', { cls: 'edge-tts-panel-label', text: '当前笔记' });
    noteCard.createEl('div', { cls: 'edge-tts-panel-note-title', text: this.getActiveNoteName() });

    const progressCard = root.createDiv({ cls: 'edge-tts-panel-card' });
    const progressHeader = progressCard.createDiv({ cls: 'edge-tts-panel-row' });
    progressHeader.createSpan({ text: this.formatTime(this.playbackState.currentTime) });
    progressHeader.createSpan({ text: this.playbackState.duration === Infinity ? '实时流式播放' : this.formatTime(this.playbackState.duration) });
    const progress = progressCard.createEl('progress', { cls: 'edge-tts-panel-progress' });
    const duration = this.playbackState.duration;
    progress.max = Number.isFinite(duration) && duration > 0 ? duration : 100;
    progress.value = Number.isFinite(duration) && duration > 0 ? Math.min(this.playbackState.currentTime, duration) : (this.playbackState.isLoading ? 35 : 0);

    const speedCard = root.createDiv({ cls: 'edge-tts-panel-card' });
    const speedHeader = speedCard.createDiv({ cls: 'edge-tts-panel-row' });
    speedHeader.createSpan({ text: '语速' });
    const speedValue = speedHeader.createSpan({ text: this.formatSpeed(this.plugin.settings.playbackSpeed) });
    const speedInput = speedCard.createEl('input', { cls: 'edge-tts-panel-speed' });
    speedInput.type = 'range';
    speedInput.min = '0.5';
    speedInput.max = '2';
    speedInput.step = '0.1';
    speedInput.value = String(this.plugin.settings.playbackSpeed);
    speedInput.oninput = () => {
      speedValue.setText(this.formatSpeed(Number(speedInput.value)));
    };
    speedInput.onchange = async () => {
      await this.updatePlaybackSpeed(Number(speedInput.value));
      speedValue.setText(this.formatSpeed(this.plugin.settings.playbackSpeed));
    };

    const mainActions = root.createDiv({ cls: 'edge-tts-panel-actions' });
    this.createIconButton(mainActions, 'play', '朗读当前笔记/选区', () => this.readCurrentNote(), 'primary');
    this.createIconButton(mainActions, 'text-cursor-input', '从光标处朗读', () => this.readFromCursor());

    const controls = root.createDiv({ cls: 'edge-tts-panel-controls' });
    this.createIconButton(controls, this.plugin.audioManager.isPlaybackPaused() ? 'play' : 'pause', this.plugin.audioManager.isPlaybackPaused() ? '继续' : '暂停', () => this.togglePauseResume());
    this.createIconButton(controls, 'rotate-ccw', '后退 10 秒', () => this.plugin.audioManager.jumpBackward());
    this.createIconButton(controls, 'rotate-cw', '前进 10 秒', () => this.plugin.audioManager.jumpForward());
    this.createIconButton(controls, 'square', '停止', () => this.plugin.audioManager.stopPlayback(), 'danger');

    const tips = root.createDiv({ cls: 'edge-tts-panel-tips' });
    tips.createEl('div', { text: '使用提示' });
    tips.createEl('p', { text: '选中文字后点击“朗读当前笔记/选区”会优先朗读选区；没有选区时朗读整篇笔记。' });
  }
}
