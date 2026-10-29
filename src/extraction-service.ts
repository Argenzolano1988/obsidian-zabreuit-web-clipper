import { requestUrl, type App, TFile } from 'obsidian';
import { AIMarkdownEngine } from '@zabreuit/core';
import type { ZabreuitClipperSettings, WebClipRequest, WebClipResult } from './types.js';

export function sanitizePath(inputPath: string): string {
  return inputPath
    .replace(/\.\./g, '') // Strip path traversal
    .replace(/[\\:*?"<>|]/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

export function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/\.\./g, '')
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const truncated = sanitized.substring(0, 150).trim();
  return truncated || 'Untitled Clip';
}

export function formatFileNameFromTemplate(
  template: string,
  title: string,
  date: Date = new Date()
): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  const formatted = template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{date\}\}/g, `${yyyy}-${mm}-${dd}`)
    .replace(/\{\{time\}\}/g, `${hh}-${min}`)
    .replace(/\{\{year\}\}/g, yyyy)
    .replace(/\{\{month\}\}/g, mm)
    .replace(/\{\{day\}\}/g, dd);

  return sanitizeFileName(formatted);
}

export class ExtractionService {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async extractAndSave(
    request: WebClipRequest,
    settings: ZabreuitClipperSettings,
    overrideHtml?: string
  ): Promise<WebClipResult> {
    const startTime = Date.now();

    // 1. Validate Target URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url.startsWith('http') ? request.url : `https://${request.url}`);
    } catch {
      throw new Error(`Invalid URL format: ${request.url}`);
    }

    // 2. Fetch HTML via Obsidian native requestUrl (avoids CORS) or use override
    let htmlContent = overrideHtml;
    if (!htmlContent) {
      try {
        const response = await requestUrl({
          url: parsedUrl.href,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        htmlContent = response.text;
      } catch (err: unknown) {
        throw new Error(
          `Failed to fetch content from ${parsedUrl.href}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 3. Delegate transformation to AIMarkdownEngine
    const engine = new AIMarkdownEngine();
    const extraction = await engine.extract(parsedUrl.href, {
      html: htmlContent,
      cleanBoilerplate: settings.cleanBoilerplate,
      includeFrontmatter: false,
      chunking:
        settings.isPro && settings.enableRAGChunking
          ? {
              enabled: true,
              maxChunkSize: 1500,
              chunkOverlap: 100,
            }
          : undefined,
    });

    if (!extraction.success || !extraction.data) {
      throw new Error(
        extraction.error?.message || 'AIMarkdownEngine failed to parse web page content'
      );
    }

    const pageData = extraction.data;
    const finalTitle = request.customTitle || pageData.title || parsedUrl.hostname;
    const cleanTitle = sanitizeFileName(finalTitle);

    // 4. Construct YAML Frontmatter
    const frontmatterObj: Record<string, unknown> = {
      title: finalTitle,
      source: parsedUrl.href,
      clipped_at: new Date().toISOString(),
    };

    if (settings.autoTag) {
      frontmatterObj.tags = [settings.autoTag];
    }

    if (settings.isPro) {
      frontmatterObj.pro_extracted = true;
      if (pageData.chunks && pageData.chunks.length > 0) {
        frontmatterObj.chunks_count = pageData.chunks.length;
      }
    }

    const frontmatterLines: string[] = ['---'];
    for (const [key, val] of Object.entries(frontmatterObj)) {
      if (Array.isArray(val)) {
        frontmatterLines.push(`${key}:`);
        for (const item of val) {
          frontmatterLines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
        }
      } else if (typeof val === 'string') {
        frontmatterLines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
      } else {
        frontmatterLines.push(`${key}: ${val}`);
      }
    }
    frontmatterLines.push('---');
    frontmatterLines.push('');

    const fullContent = settings.includeFrontmatter
      ? `${frontmatterLines.join('\n')}${pageData.markdown}`
      : pageData.markdown;

    // 5. Compute destination file path
    const folderName = sanitizePath(request.targetFolder || settings.saveFolder || 'Clips');
    const fileName = formatFileNameFromTemplate(
      settings.fileNameTemplate || '{{title}}',
      cleanTitle
    );

    let finalFilePath = folderName ? `${folderName}/${fileName}.md` : `${fileName}.md`;

    // 6. Ensure directory exists in Obsidian Vault
    if (folderName) {
      const existingFolder = this.app.vault.getAbstractFileByPath(folderName);
      if (!existingFolder) {
        try {
          await this.app.vault.createFolder(folderName);
        } catch {
          // Folder may have been created concurrently, safe to continue
        }
      }
    }

    // 7. Prevent accidental file overwriting by appending timestamp if exists
    const existingFile = this.app.vault.getAbstractFileByPath(finalFilePath);
    if (existingFile instanceof TFile) {
      const disambiguator = Math.floor(Date.now() / 1000);
      finalFilePath = folderName
        ? `${folderName}/${fileName}-${disambiguator}.md`
        : `${fileName}-${disambiguator}.md`;
    }

    // 8. Create file in vault
    await this.app.vault.create(finalFilePath, fullContent);

    return {
      title: finalTitle,
      url: parsedUrl.href,
      markdown: pageData.markdown,
      frontmatter: frontmatterObj,
      filePath: finalFilePath,
      tokenCount: pageData.tokenEstimate,
      durationMs: Date.now() - startTime,
    };
  }
}
