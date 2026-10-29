import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { ZabreuitClipperSettings } from './types.js';
import type ZabreuitClipperPlugin from './main.js';

export class ZabreuitClipperSettingTab extends PluginSettingTab {
  plugin: ZabreuitClipperPlugin;

  constructor(app: App, plugin: ZabreuitClipperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Zabreuit AI Web Clipper Settings' });

    // License Key Setting
    const proStatusText = this.plugin.settings.isPro ? ' (PRO Active 🚀)' : ' (Community Free Tier)';
    const licenseDesc = `Enter your Gumroad/Polar license key or Ed25519 Signed License Token (SLT)${proStatusText}.`;

    new Setting(containerEl)
      .setName('Pro License Key')
      .setDesc(licenseDesc)
      .addText((text) =>
        text
          .setPlaceholder('GUMROAD-... or SLT Token')
          .setValue(this.plugin.settings.licenseKey)
          .onChange(async (value) => {
            this.plugin.settings.licenseKey = value.trim();
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText(this.plugin.settings.isPro ? 'Re-Verify' : 'Activate')
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('Verifying...');
            try {
              const res = await this.plugin.licenseService.validateOrActivate(
                this.plugin.settings.licenseKey
              );
              if (res.isValid) {
                this.plugin.settings.isPro = res.isPro;
                this.plugin.settings.proExpiryDate = res.expiryDate;
                if (res.sltToken) {
                  this.plugin.settings.sltToken = res.sltToken;
                }
                await this.plugin.saveSettings();
                new Notice(
                  res.isPro
                    ? '🎉 Pro License verified successfully! RAG chunking unlocked.'
                    : 'Community tier verified.'
                );
              } else {
                this.plugin.settings.isPro = false;
                await this.plugin.saveSettings();
                new Notice(`❌ License verification failed: ${res.error || 'Invalid key'}`);
              }
            } catch (err: unknown) {
              new Notice(`Error during activation: ${err instanceof Error ? err.message : String(err)}`);
            } finally {
              btn.setDisabled(false);
              this.display(); // re-render to update badges
            }
          })
      );

    // Save Folder
    new Setting(containerEl)
      .setName('Default Save Folder')
      .setDesc('Folder in vault where clipped web notes will be stored.')
      .addText((text) =>
        text
          .setPlaceholder('Clips')
          .setValue(this.plugin.settings.saveFolder)
          .onChange(async (value) => {
            this.plugin.settings.saveFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // File Name Template
    new Setting(containerEl)
      .setName('Note Name Template')
      .setDesc('Template for note filename. Placeholders: {{title}}, {{date}}, {{time}}, {{year}}')
      .addText((text) =>
        text
          .setPlaceholder('{{title}}')
          .setValue(this.plugin.settings.fileNameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.fileNameTemplate = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Include Frontmatter
    new Setting(containerEl)
      .setName('Include YAML Frontmatter')
      .setDesc('Inject title, source URL, timestamp, and tags into Markdown header.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.includeFrontmatter = value;
            await this.plugin.saveSettings();
          })
      );

    // Clean Boilerplate
    new Setting(containerEl)
      .setName('Clean Boilerplate & Ads')
      .setDesc('Automatically strip navigation bars, footer slop, banners, and scripts.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.cleanBoilerplate)
          .onChange(async (value) => {
            this.plugin.settings.cleanBoilerplate = value;
            await this.plugin.saveSettings();
          })
      );

    // Auto Tag
    new Setting(containerEl)
      .setName('Default Tag')
      .setDesc('Tag automatically assigned to clipped notes (leave empty for none).')
      .addText((text) =>
        text
          .setPlaceholder('web-clip')
          .setValue(this.plugin.settings.autoTag)
          .onChange(async (value) => {
            this.plugin.settings.autoTag = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Pro Feature: RAG Chunking
    new Setting(containerEl)
      .setName('Semantic RAG Chunking (Pro Feature)')
      .setDesc('Splits article into vector-ready chunks for Obsidian Smart Connections / Copilot.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableRAGChunking)
          .setDisabled(!this.plugin.settings.isPro)
          .onChange(async (value) => {
            if (!this.plugin.settings.isPro && value) {
              new Notice('RAG Chunking requires an active Pro License.');
              toggle.setValue(false);
              return;
            }
            this.plugin.settings.enableRAGChunking = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
