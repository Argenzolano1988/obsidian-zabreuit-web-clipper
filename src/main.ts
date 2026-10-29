import { Plugin, Notice, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, type ZabreuitClipperSettings, type WebClipResult } from './types.js';
import { LicenseService } from './license-service.js';
import { ExtractionService } from './extraction-service.js';
import { ZabreuitClipperSettingTab } from './settings-tab.js';
import { ClipModal } from './clip-modal.js';

export default class ZabreuitClipperPlugin extends Plugin {
  settings: ZabreuitClipperSettings = DEFAULT_SETTINGS;
  licenseService: LicenseService = new LicenseService();
  extractionService!: ExtractionService;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.licenseService = new LicenseService();
    this.extractionService = new ExtractionService(this.app);

    // Auto-verify offline token on startup if present
    if (this.settings.sltToken) {
      try {
        const verifyRes = await this.licenseService.verifyOfflineToken(this.settings.sltToken);
        if (verifyRes.isValid) {
          this.settings.isPro = verifyRes.isPro;
        } else {
          this.settings.isPro = false;
        }
      } catch {
        // Safe fallback in offline mode
      }
    }

    // Add ribbon icon to open clip modal
    this.addRibbonIcon('scissors', 'Clip Web Page to Note', () => {
      new ClipModal(this.app, this).open();
    });

    // Register command 1: Open Clip Modal
    this.addCommand({
      id: 'clip-url-to-note',
      name: 'Clip URL to Note',
      callback: () => {
        new ClipModal(this.app, this).open();
      },
    });

    // Register command 2: Clip Active Clipboard URL directly
    this.addCommand({
      id: 'clip-clipboard-url',
      name: 'Clip URL from Clipboard',
      callback: async () => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          const trimmed = (clipboardText || '').trim();

          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            new Notice('Clipboard does not contain a valid HTTP/HTTPS URL.');
            new ClipModal(this.app, this).open();
            return;
          }

          new Notice(`Clipping URL from clipboard: ${trimmed}`);
          const res = await this.clipUrl(trimmed);
          new Notice(`✅ Successfully clipped: ${res.title}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          new Notice(`Failed to clip clipboard: ${msg}`);
        }
      },
    });

    // Register settings tab
    this.addSettingTab(new ZabreuitClipperSettingTab(this.app, this));
  }

  async clipUrl(url: string, overrideHtml?: string): Promise<WebClipResult> {
    const result = await this.extractionService.extractAndSave(
      { url },
      this.settings,
      overrideHtml
    );

    // Open newly created note in active workspace leaf
    const file = this.app.vault.getAbstractFileByPath(result.filePath);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }

    return result;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
