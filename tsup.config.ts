import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  target: 'es2022',
  platform: 'node',
  bundle: true,
  clean: true,
  minify: false,
  external: ['obsidian', 'got-scraping', 'apify', 'crawlee'],
  noExternal: [/@zabreuit\/core/],
  outDir: 'dist',
  outExtension() {
    return {
      js: '.js',
    };
  },
});
