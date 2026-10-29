import { App, Modal, Setting, Notice } from 'obsidian';
import type ZabreuitClipperPlugin from './main.js';

export class ClipModal extends Modal {
  private plugin: ZabreuitClipperPlugin;
  private targetUrl: string = '';

  constructor(app: App, plugin: ZabreuitClipperPlugin, initialUrl: string = '') {
    super(app);
    this.plugin = plugin;
    this.targetUrl = initialUrl;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('zabreuit-clipper-modal');

    contentEl.createEl('h2', { text: 'Clip Web Page to Note', cls: 'modal-title' });

    let submitButton: HTMLButtonElement;

    new Setting(contentEl)
      .setName('Web Page URL')
      .setDesc('Enter full URL to extract and convert to structured Markdown.')
      .addText((text) => {
        text
          .setPlaceholder('https://example.com/blog/article')
          .setValue(this.targetUrl)
          .onChange((value) => {
            this.targetUrl = value.trim();
          });

        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void this.handleSubmit(submitButton);
          }
        });

        // Auto-focus input
        window.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl).addButton((btn) => {
      submitButton = btn.buttonEl;
      btn
        .setButtonText('Clip to Vault')
        .setCta()
        .onClick(() => this.handleSubmit(submitButton));
    });
  }

  private async handleSubmit(button?: HTMLButtonElement): Promise<void> {
    if (!this.targetUrl) {
      new Notice('Please enter a valid web URL.');
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Clipping...';
    }

    new Notice('Extracting web content with AI Markdown Engine...');

    try {
      const result = await this.plugin.clipUrl(this.targetUrl);
      new Notice(`✅ Clipped note created: ${result.title}`);
      this.close();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice(`❌ Failed to clip URL: ${message}`);
      if (button) {
        button.disabled = false;
        button.textContent = 'Clip to Vault';
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
