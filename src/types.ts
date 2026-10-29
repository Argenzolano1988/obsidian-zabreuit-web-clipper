export interface ZabreuitClipperSettings {
  licenseKey: string;
  isPro: boolean;
  proExpiryDate?: number;
  sltToken?: string;
  saveFolder: string;
  fileNameTemplate: string; // e.g. "{{title}} - {{date}}"
  includeFrontmatter: boolean;
  includeSummary: boolean;
  cleanBoilerplate: boolean;
  autoTag: string; // e.g. "web-clip"
  enableRAGChunking: boolean; // Pro feature
}

export const DEFAULT_SETTINGS: ZabreuitClipperSettings = {
  licenseKey: '',
  isPro: false,
  saveFolder: 'Clips',
  fileNameTemplate: '{{title}}',
  includeFrontmatter: true,
  includeSummary: true,
  cleanBoilerplate: true,
  autoTag: 'web-clip',
  enableRAGChunking: false,
};

export interface WebClipRequest {
  url: string;
  targetFolder?: string;
  customTitle?: string;
}

export interface WebClipResult {
  title: string;
  url: string;
  markdown: string;
  frontmatter: Record<string, unknown>;
  filePath: string;
  tokenCount: number;
  durationMs: number;
}
