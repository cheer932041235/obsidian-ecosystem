import { App, Notice, PluginSettingTab, Setting, Platform } from 'obsidian';
import EdgeTTSPlugin from '../main';
import { APP_STORE_LINKS } from './constants';
import { detectUserLanguage } from '../utils';
import { COMPARISON_SYMBOL_TRANSLATIONS } from '../lib/translations';

// Import SVG content as strings
// eslint-disable-next-line @typescript-eslint/no-var-requires
const googlePlayIconSvg = require('../assets/google-play-icon.svg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appleAppStoreIconSvg = require('../assets/apple-app-store.svg');

// Settings interface and default settings
export interface EdgeTTSPluginSettings {
  selectedVoice: string;
  customVoice: string;
  playbackSpeed: number;
  tempAudioRetentionDays: number;

  showNotices: boolean;
  showStatusBarButton: boolean;
  showMenuItems: boolean;

  generateMP3: boolean;
  outputFolder: string;
  embedInNote: boolean;
  replaceSpacesInFilenames: boolean;

  // Text filtering settings
  textFiltering: {
    filterFrontmatter: boolean;
    filterMarkdownLinks: boolean;
    filterCodeBlocks: boolean;
    filterInlineCode: boolean;
    filterHtmlTags: boolean;
    filterTables: boolean;
    filterImages: boolean;
    filterFootnotes: boolean;
    filterComments: boolean;
    filterMathExpressions: boolean;
    filterWikiLinks: boolean;
    filterHighlights: boolean;
    filterCallouts: boolean;
    replaceComparisonSymbols: boolean;
  };

  // Symbol replacement settings
  symbolReplacement: {
    enableCustomReplacements: boolean;
    language: string; // 'auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'custom'
    customReplacements: {
      greaterThan: string;
      lessThan: string;
      greaterThanOrEqual: string;
      lessThanOrEqual: string;
    };
  };

  // overrideAmpersandEscape: boolean; // No longer needed - edge-tts-universal handles XML escaping internally
  floatingPlayerPosition: { x: number; y: number } | null;
  disablePlaybackControlPopover: boolean;
  enableReplayOption: boolean;
  enableQueueFeature: boolean;
  queueManagerPosition: { x: number; y: number } | null;
  autoPauseOnWindowBlur: boolean;

  // Experimental and mobile-specific features
  enableExperimentalFeatures: boolean;
  reducedNoticesOnMobile: boolean;
  proxyUrl: string;
}

// Top voices to be displayed in the dropdown
export const TOP_VOICES = [
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-YunyangNeural',
  'zh-CN-XiaobeiNeural',
  'en-US-AvaMultilingualNeural',
  'en-US-BrianMultilingualNeural',
  'en-US-AndrewNeural',
  'en-US-AriaNeural',
  'en-US-AvaNeural',
  'en-US-ChristopherNeural',
  'en-US-SteffanNeural',
  'en-IE-ConnorNeural',
  'en-GB-RyanNeural',
  'en-GB-SoniaNeural',
  'en-AU-NatashaNeural',
  'en-AU-WilliamNeural',
];

export const DEFAULT_SETTINGS: EdgeTTSPluginSettings = {
  selectedVoice: 'zh-CN-XiaoxiaoNeural',
  customVoice: '',
  playbackSpeed: 1.0,
  tempAudioRetentionDays: 1,

  showNotices: true,
  showStatusBarButton: true,
  showMenuItems: true,

  generateMP3: false,
  outputFolder: 'Note Narration Audio',
  embedInNote: false,
  replaceSpacesInFilenames: false,

  // Text filtering settings
  textFiltering: {
    filterFrontmatter: true,
    filterMarkdownLinks: false, // Disabled by default
    filterCodeBlocks: true,
    filterInlineCode: true,
    filterHtmlTags: true,
    filterTables: true, // This might be one the user wants to adjust
    filterImages: true,
    filterFootnotes: true,
    filterComments: true,
    filterMathExpressions: false,
    filterWikiLinks: false,
    filterHighlights: true, // (this just removes the == — the text should remain)
    filterCallouts: false, // Keep callouts by default
    replaceComparisonSymbols: true, // Enable by default to prevent XML issues
  },

  // Symbol replacement settings
  symbolReplacement: {
    enableCustomReplacements: false, // Disabled by default, uses built-in language detection
    language: 'auto', // Auto-detect based on user locale
    customReplacements: {
      greaterThan: ' greater than ',
      lessThan: ' less than ',
      greaterThanOrEqual: ' greater than or equal to ',
      lessThanOrEqual: ' less than or equal to ',
    },
  },

  // overrideAmpersandEscape: false, // No longer needed - edge-tts-universal handles XML escaping internally
  floatingPlayerPosition: null,
  disablePlaybackControlPopover: false,
  enableReplayOption: true,
  enableQueueFeature: true,
  queueManagerPosition: null,
  autoPauseOnWindowBlur: false,

  // Experimental and mobile-specific features
  enableExperimentalFeatures: false,
  reducedNoticesOnMobile: true, // Default to true for better mobile UX
  proxyUrl: 'http://127.0.0.1:7897',
}

export const defaultSelectedTextMp3Name = 'note';

export class EdgeTTSPluginSettingTab extends PluginSettingTab {
  plugin: EdgeTTSPlugin;

  constructor(app: App, plugin: EdgeTTSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    const inbetweenInfo = containerEl.createEl('div', {
      cls: 'edge-tts-info-div'
    })

    const infoText = document.createElement('p');
    const secondLink = document.createElement('a');
    secondLink.href = 'https://tts.travisvn.com';
    secondLink.text = 'tts.travisvn.com';
    infoText.append('可在这里试听和查询可用音色：');
    infoText.append(secondLink);

    inbetweenInfo.appendChild(infoText)

    // Dropdown for top voices
    new Setting(containerEl)
      .setName('常用音色')
      .setDesc('优先选择中文音色；如需更多音色，可在下方填写自定义音色名称。')
      .setClass('default-style')
      .addDropdown(dropdown => {
        TOP_VOICES.forEach(voice => {
          dropdown.addOption(voice, voice);
        });
        dropdown.setValue(this.plugin.settings.selectedVoice);
        dropdown.onChange(async (value) => {
          this.plugin.settings.selectedVoice = value;
          await this.plugin.saveSettings();
        });
      });

    const patternFragment = document.createDocumentFragment();
    const link = document.createElement('a');
    link.href = 'https://tts.travisvn.com';
    link.text = 'tts.travisvn.com';
    patternFragment.append('可选：填写自定义音色名称。可访问 ');
    patternFragment.append(link);
    patternFragment.append(' 查询音色列表。');
    patternFragment.append('留空则使用上方选择的常用音色。');

    // Text input for custom voice
    new Setting(containerEl)
      .setName('自定义音色')
      .setDesc(patternFragment)
      .addText(text => {
        text.setPlaceholder('例如：zh-CN-XiaoxiaoNeural');
        text.setValue(this.plugin.settings.customVoice);
        text.onChange(async (value) => {
          this.plugin.settings.customVoice = value;
          await this.plugin.saveSettings();
        });
      });

    // Slider for playback speed
    new Setting(containerEl)
      .setName('朗读速度')
      .setDesc('调整朗读速度倍数，例如 0.8 表示较慢，1.2 表示较快，默认 1.0。')
      .addSlider(slider => {
        slider.setLimits(0.5, 2.0, 0.1);
        slider.setValue(this.plugin.settings.playbackSpeed);
        slider.onChange(async (value) => {
          this.plugin.settings.playbackSpeed = value;
          await this.plugin.saveSettings();
        });
        slider.setDynamicTooltip();
        slider.showTooltip();
      });

    new Setting(containerEl)
      .setName('临时语音保留天数')
      .setDesc('超过该天数的朗读临时音频会自动删除，默认 1 天。')
      .addSlider(slider => {
        slider.setLimits(1, 30, 1);
        slider.setValue(this.plugin.settings.tempAudioRetentionDays);
        slider.onChange(async (value) => {
          this.plugin.settings.tempAudioRetentionDays = value;
          await this.plugin.saveSettings();
        });
        slider.setDynamicTooltip();
        slider.showTooltip();
      });

    // Notice toggle setting
    new Setting(containerEl)
      .setName('显示通知')
      .setDesc('显示语音生成状态、错误提示等通知。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showNotices);
        toggle.onChange(async (value) => {
          this.plugin.settings.showNotices = value;
          await this.plugin.saveSettings();
        });
      });

    // Status toggle setting
    new Setting(containerEl)
      .setName('显示状态栏按钮')
      .setDesc('在 Obsidian 状态栏显示语音朗读入口。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showStatusBarButton);
        toggle.onChange(async (value) => {
          this.plugin.settings.showStatusBarButton = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.uiManager.initializeStatusBar();
          } else {
            this.plugin.uiManager.removeStatusBarButton();
          }
        });
      });

    // Menu items toggle setting
    new Setting(containerEl)
      .setName('显示右键菜单项')
      .setDesc('在文件和编辑器右键菜单中显示朗读相关操作。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showMenuItems);
        toggle.onChange(async (value) => {
          this.plugin.settings.showMenuItems = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.uiManager.addPluginMenuItems();
          } else {
            new Notice('菜单项将在下次重载后移除。');
          }
        });
      });

    // New setting for disabling playback control popover
    new Setting(containerEl)
      .setName('隐藏旧版悬浮播放控件')
      .setDesc('播放时隐藏旧版悬浮小窗，推荐使用左侧的中文语音朗读面板。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.disablePlaybackControlPopover);
        toggle.onChange(async (value) => {
          this.plugin.settings.disablePlaybackControlPopover = value;
          await this.plugin.saveSettings();
          // Optionally, inform the user or trigger UI update if needed immediately
          new Notice(`旧版悬浮播放控件已${value ? '隐藏' : '显示'}。`);
        });
      });

    // New setting for enabling replay option
    new Setting(containerEl)
      .setName('启用重播选项')
      .setDesc('朗读结束后保留播放控制，方便重新播放。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableReplayOption);
        toggle.onChange(async (value) => {
          this.plugin.settings.enableReplayOption = value;
          await this.plugin.saveSettings();
          new Notice(`重播选项已${value ? '启用' : '关闭'}。`);
        });
      });

    // New setting for enabling queue feature
    new Setting(containerEl)
      .setName('启用朗读队列')
      .setDesc('启用队列管理器和队列相关命令。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableQueueFeature);
        toggle.onChange(async (value) => {
          this.plugin.settings.enableQueueFeature = value;
          await this.plugin.saveSettings();
          new Notice(`朗读队列已${value ? '启用' : '关闭'}，重启 Obsidian 后完全生效。`);
        });
      });

    // New setting for auto-pause on window blur
    new Setting(containerEl)
      .setName('窗口失焦时自动暂停')
      .setDesc('当 Obsidian 失去焦点时自动暂停，重新获得焦点后继续播放。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.autoPauseOnWindowBlur);
        toggle.onChange(async (value) => {
          this.plugin.settings.autoPauseOnWindowBlur = value;
          await this.plugin.saveSettings();
          new Notice(`失焦自动暂停已${value ? '启用' : '关闭'}。`);
        });
      });

    containerEl.createEl('h3', { text: '保存 MP3 朗读文件' });

    // Only show MP3 generation options on desktop
    if (!Platform.isMobile) {
      const chunkedInfo = containerEl.createEl('div', {
        cls: 'edge-tts-info-div'
      });

      const chunkedInfoText = document.createElement('p');
      chunkedInfoText.style.fontSize = '13px';
      chunkedInfoText.style.color = 'var(--text-muted)';
      chunkedInfoText.innerHTML = `
        <strong>提示：</strong>长笔记生成 MP3 时会自动分段处理，每段生成完成后再合并。
        生成过程中会显示进度，适合导出较长文章的朗读音频。
      `;
      chunkedInfo.appendChild(chunkedInfoText);

      new Setting(containerEl)
        .setName('启用 MP3 生成')
        .setDesc('在文件和编辑器菜单中显示“生成 MP3”选项。')
        .addToggle(toggle => {
          toggle.setValue(this.plugin.settings.generateMP3);
          toggle.onChange(async (value) => {
            this.plugin.settings.generateMP3 = value;
            await this.plugin.saveSettings();
            if (!value) {
              new Notice('菜单项将在下次重载后移除。');
            }
          });
        });

      new Setting(containerEl)
        .setName('输出文件夹')
        .setDesc('指定生成的 MP3 文件保存位置。')
        .addText(text => {
          text.setPlaceholder('例如：Note Narration Audio')
            .setValue(this.plugin.settings.outputFolder)
            .onChange(async (value) => {
              this.plugin.settings.outputFolder = value.trim();
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName('将 MP3 嵌入笔记')
        .setDesc('生成后在当前笔记中插入 MP3 文件链接。')
        .addToggle(toggle => {
          toggle.setValue(this.plugin.settings.embedInNote);
          toggle.onChange(async (value) => {
            this.plugin.settings.embedInNote = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName('替换文件名空格')
        .setDesc('将 MP3 文件名中的空格替换为下划线，提高系统兼容性。')
        .addToggle(toggle => {
          toggle.setValue(this.plugin.settings.replaceSpacesInFilenames);
          toggle.onChange(async (value) => {
            this.plugin.settings.replaceSpacesInFilenames = value;
            await this.plugin.saveSettings();
          });
        });
    } else {
      const mobileNotice = containerEl.createEl('div', {
        cls: 'edge-tts-info-div'
      });

      const mobileNoticeText = document.createElement('p');
      mobileNoticeText.style.fontSize = '13px';
      mobileNoticeText.style.color = 'var(--text-muted)';
      mobileNoticeText.innerHTML = `
        <strong>提示：</strong>移动端受文件系统限制，暂不支持生成 MP3。
        你仍然可以使用朗读播放功能收听笔记。
      `;
      mobileNotice.appendChild(mobileNoticeText);
    }

    containerEl.createEl('h3', { text: '高级设置' });

    if (!Platform.isMobile) {
      new Setting(containerEl)
        .setName('HTTP 代理地址')
        .setDesc('桌面端连接微软 TTS 服务时使用的代理地址；Clash 默认可用 http://127.0.0.1:7897。留空则直连。')
        .addText(text => {
          text
            .setPlaceholder('http://127.0.0.1:7897')
            .setValue(this.plugin.settings.proxyUrl || '')
            .onChange(async (value) => {
              this.plugin.settings.proxyUrl = value.trim();
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(containerEl)
      .setName('启用实验功能')
      .setDesc('开启尚未完全稳定的实验功能。普通使用建议保持关闭。')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableExperimentalFeatures);
        toggle.onChange(async (value) => {
          this.plugin.settings.enableExperimentalFeatures = value;
          await this.plugin.saveSettings();
          new Notice(`实验功能已${value ? '启用' : '关闭'}。`);
        });
      });

    if (Platform.isMobile) {
      new Setting(containerEl)
        .setName('移动端减少通知')
        .setDesc('减少移动端弹窗通知，降低屏幕干扰。关闭后会显示更详细反馈。')
        .addToggle(toggle => {
          toggle.setValue(this.plugin.settings.reducedNoticesOnMobile);
          toggle.onChange(async (value) => {
            this.plugin.settings.reducedNoticesOnMobile = value;
            await this.plugin.saveSettings();
            new Notice(`移动端通知已切换为${value ? '精简' : '详细'}模式。`);
          });
        });
    }

    // Create collapsible text filtering section
    const textFilteringHeader = containerEl.createEl('div', {
      cls: 'setting-item setting-item-heading edge-tts-collapsible-header',
      attr: { style: 'cursor: pointer; user-select: none;' }
    });

    const textFilteringTitle = textFilteringHeader.createEl('div', { cls: 'setting-item-info' });
    const titleContainer = textFilteringTitle.createEl('div', { cls: 'setting-item-name' });

    // Add arrow icon and title
    const arrow = titleContainer.createEl('span', {
      text: '▶ ',
      attr: { style: 'display: inline-block; transition: transform 0.2s ease; margin-right: 8px;' }
    });
    titleContainer.createSpan({ text: 'Text filtering' });

    // Add description
    textFilteringTitle.createEl('div', {
      cls: 'setting-item-description',
      text: 'Configure what content is filtered from notes before speech generation. Click to expand options.'
    });

    // Create collapsible content container
    const textFilteringContent = containerEl.createEl('div', {
      attr: {
        style: 'display: none; margin-left: 24px; border-left: 2px solid var(--background-modifier-border); padding-left: 16px; margin-top: 8px;'
      }
    });

    // Add toggle functionality
    let isExpanded = false;
    textFilteringHeader.addEventListener('click', () => {
      isExpanded = !isExpanded;
      textFilteringContent.style.display = isExpanded ? 'block' : 'none';
      arrow.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
      // arrow.textContent = isExpanded ? '▼ ' : '▶ ';
    });

    // Add information about text filtering to the collapsible content
    const filteringInfo = textFilteringContent.createEl('div', {
      cls: 'edge-tts-info-div'
    });

    const filteringInfoText = document.createElement('p');
    filteringInfoText.style.fontSize = '13px';
    filteringInfoText.style.color = 'var(--text-muted)';
    filteringInfoText.innerHTML = `
      <strong>Text filtering</strong> controls what content is removed from your notes before generating speech. 
      This helps ensure clean, readable narration by filtering out formatting elements that don't translate well to speech.
    `;
    filteringInfo.appendChild(filteringInfoText);

    // Core filtering options
    new Setting(textFilteringContent)
      .setName('Filter frontmatter')
      .setDesc('Remove YAML frontmatter (metadata between --- delimiters) from the beginning of notes.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterFrontmatter);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterFrontmatter = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter markdown links')
      .setDesc('Remove markdown links [text](url) completely. When enabled, both the link text and URL are removed.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterMarkdownLinks);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterMarkdownLinks = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter wiki links')
      .setDesc('Remove Obsidian wiki-style links [[link]] and keep only the display text.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterWikiLinks);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterWikiLinks = value;
          await this.plugin.saveSettings();
        });
      });

    // Code filtering options
    new Setting(textFilteringContent)
      .setName('Filter code blocks')
      .setDesc('Remove fenced code blocks (```code```) completely.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterCodeBlocks);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterCodeBlocks = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter inline code')
      .setDesc('Remove backtick markers from inline code (`code`) while keeping the code text.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterInlineCode);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterInlineCode = value;
          await this.plugin.saveSettings();
        });
      });

    // Content filtering options
    new Setting(textFilteringContent)
      .setName('Filter tables')
      .setDesc('Remove markdown tables completely.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterTables);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterTables = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter images')
      .setDesc('Remove image embeds ![alt](url) and attachments ![[image.png]].')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterImages);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterImages = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter callouts')
      .setDesc('Remove Obsidian callout blocks (> [!note], > [!warning], etc.) while keeping the content.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterCallouts);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterCallouts = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter highlights')
      .setDesc('Remove highlight markers ==text== while keeping the highlighted text.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterHighlights);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterHighlights = value;
          await this.plugin.saveSettings();
        });
      });

    // Advanced filtering options
    new Setting(textFilteringContent)
      .setName('Filter footnotes')
      .setDesc('Remove footnote references [^1] and footnote definitions.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterFootnotes);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterFootnotes = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter comments')
      .setDesc('Remove HTML comments <!-- comment --> and Obsidian comments %%comment%%.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterComments);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterComments = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter math expressions')
      .setDesc('Remove LaTeX math expressions ($inline$ and $$block$$).')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterMathExpressions);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterMathExpressions = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Filter HTML tags')
      .setDesc('Remove HTML tags while preserving the text content.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.filterHtmlTags);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.filterHtmlTags = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(textFilteringContent)
      .setName('Replace comparison symbols')
      .setDesc('Replace < and > symbols with words to prevent XML parsing issues with multiple symbols on the same line. Language and text can be customized in Symbol Replacement section below.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.textFiltering.replaceComparisonSymbols);
        toggle.onChange(async (value) => {
          this.plugin.settings.textFiltering.replaceComparisonSymbols = value;
          await this.plugin.saveSettings();
        });
      });


    // Create collapsible symbol replacement section
    const symbolReplacementHeader = containerEl.createEl('div', {
      cls: 'setting-item setting-item-heading edge-tts-collapsible-header',
      attr: { style: 'cursor: pointer; user-select: none;' }
    });

    const symbolReplacementTitle = symbolReplacementHeader.createEl('div', { cls: 'setting-item-info' });
    const symbolTitleContainer = symbolReplacementTitle.createEl('div', { cls: 'setting-item-name' });

    // Add arrow icon and title
    const symbolArrow = symbolTitleContainer.createEl('span', {
      text: '▶ ',
      attr: { style: 'display: inline-block; transition: transform 0.2s ease; margin-right: 8px;' }
    });
    symbolTitleContainer.createSpan({ text: 'Symbol replacement' });

    // Add description
    symbolReplacementTitle.createEl('div', {
      cls: 'setting-item-description',
      text: 'Configure how comparison symbols are replaced with words in different languages. Click to expand options.'
    });

    // Create collapsible content container
    const symbolReplacementContent = containerEl.createEl('div', {
      attr: {
        style: 'display: none; margin-left: 24px; border-left: 2px solid var(--background-modifier-border); padding-left: 16px; margin-top: 8px;'
      }
    });

    // Add toggle functionality
    let isSymbolExpanded = false;
    symbolReplacementHeader.addEventListener('click', () => {
      isSymbolExpanded = !isSymbolExpanded;
      symbolReplacementContent.style.display = isSymbolExpanded ? 'block' : 'none';
      symbolArrow.style.transform = isSymbolExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    // Add information about symbol replacement
    const symbolInfo = symbolReplacementContent.createEl('div', {
      cls: 'edge-tts-info-div'
    });

    const symbolInfoText = document.createElement('p');
    symbolInfoText.style.fontSize = '13px';
    symbolInfoText.style.color = 'var(--text-muted)';
    symbolInfoText.innerHTML = `
      <strong>Symbol replacement</strong> converts comparison symbols like &gt; and &lt; into words 
      to prevent XML parsing issues in TTS generation. You can choose from built-in languages or 
      create custom replacements.
    `;
    symbolInfo.appendChild(symbolInfoText);

    // Language selection setting
    new Setting(symbolReplacementContent)
      .setName('Language')
      .setDesc('Choose the language for symbol replacement words. "Auto" detects from your Obsidian interface language, with browser locale as fallback.')
      .addDropdown(dropdown => {
        dropdown.addOption('auto', 'Auto-detect');
        dropdown.addOption('en', 'English');
        dropdown.addOption('es', 'Español');
        dropdown.addOption('fr', 'Français');
        dropdown.addOption('de', 'Deutsch');
        dropdown.addOption('it', 'Italiano');
        dropdown.addOption('pt', 'Português');
        dropdown.addOption('ru', 'Русский');
        dropdown.addOption('ja', '日本語');
        dropdown.addOption('ko', '한국어');
        dropdown.addOption('zh', '中文');

        dropdown.setValue(this.plugin.settings.symbolReplacement.language);
        dropdown.onChange(async (value) => {
          this.plugin.settings.symbolReplacement.language = value;
          await this.plugin.saveSettings();

          // Update custom replacement fields with language defaults when changing language
          if (!this.plugin.settings.symbolReplacement.enableCustomReplacements && value !== 'custom') {
            this.display(); // Refresh settings to show new defaults
          }
        });
      });

    // Enable custom replacements toggle
    new Setting(symbolReplacementContent)
      .setName('Use custom replacements')
      .setDesc('Enable to define your own replacement text instead of using built-in language translations.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.symbolReplacement.enableCustomReplacements);
        toggle.onChange(async (value) => {
          this.plugin.settings.symbolReplacement.enableCustomReplacements = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide custom text fields
        });
      });

    // Show custom replacement fields only if enabled
    if (this.plugin.settings.symbolReplacement.enableCustomReplacements) {
      new Setting(symbolReplacementContent)
        .setName('Greater than (>)')
        .setDesc('Text to replace ">" symbols with (e.g., " greater than ", " maior que ")')
        .addText(text => {
          text.setPlaceholder(' greater than ')
            .setValue(this.plugin.settings.symbolReplacement.customReplacements.greaterThan)
            .onChange(async (value) => {
              this.plugin.settings.symbolReplacement.customReplacements.greaterThan = value;
              await this.plugin.saveSettings();
            });
        });

      new Setting(symbolReplacementContent)
        .setName('Less than (<)')
        .setDesc('Text to replace "<" symbols with (e.g., " less than ", " menor que ")')
        .addText(text => {
          text.setPlaceholder(' less than ')
            .setValue(this.plugin.settings.symbolReplacement.customReplacements.lessThan)
            .onChange(async (value) => {
              this.plugin.settings.symbolReplacement.customReplacements.lessThan = value;
              await this.plugin.saveSettings();
            });
        });

      new Setting(symbolReplacementContent)
        .setName('Greater than or equal (>=)')
        .setDesc('Text to replace ">=" symbols with (e.g., " greater than or equal to ")')
        .addText(text => {
          text.setPlaceholder(' greater than or equal to ')
            .setValue(this.plugin.settings.symbolReplacement.customReplacements.greaterThanOrEqual)
            .onChange(async (value) => {
              this.plugin.settings.symbolReplacement.customReplacements.greaterThanOrEqual = value;
              await this.plugin.saveSettings();
            });
        });

      new Setting(symbolReplacementContent)
        .setName('Less than or equal (<=)')
        .setDesc('Text to replace "<=" symbols with (e.g., " less than or equal to ")')
        .addText(text => {
          text.setPlaceholder(' less than or equal to ')
            .setValue(this.plugin.settings.symbolReplacement.customReplacements.lessThanOrEqual)
            .onChange(async (value) => {
              this.plugin.settings.symbolReplacement.customReplacements.lessThanOrEqual = value;
              await this.plugin.saveSettings();
            });
        });
    } else {
      // Show current language translations as read-only info
      let currentLang = this.plugin.settings.symbolReplacement.language;
      if (currentLang === 'auto') {
        currentLang = detectUserLanguage();
      }

      const translations = COMPARISON_SYMBOL_TRANSLATIONS[currentLang as keyof typeof COMPARISON_SYMBOL_TRANSLATIONS] || COMPARISON_SYMBOL_TRANSLATIONS.en;

      const previewSetting = new Setting(symbolReplacementContent)
        .setName('Current translations')
        .setDesc(`Preview of how symbols will be replaced in ${currentLang === 'auto' ? 'auto-detected' : currentLang} language:`);

      const previewDiv = previewSetting.settingEl.createEl('div', {
        attr: { style: 'margin-top: 8px; padding: 8px; background-color: var(--background-secondary); border-radius: 4px; font-family: monospace; font-size: 12px;' }
      });

      previewDiv.innerHTML = `
        <div>></span> → "<strong>${translations.greaterThan.trim()}</strong>"</div>
        <div>&lt; → "<strong>${translations.lessThan.trim()}</strong>"</div>
        <div>>= → "<strong>${translations.greaterThanOrEqual.trim()}</strong>"</div>
        <div>&lt;= → "<strong>${translations.lessThanOrEqual.trim()}</strong>"</div>
      `;
    }

    // containerEl.createEl('h3', { text: 'Extra settings' });

    // Legacy ampersand escaping setting removed - edge-tts-universal handles XML escaping internally
    // Legacy chunk size setting removed - chunking is now fixed at 4096 bytes due to API limits
  }
} 