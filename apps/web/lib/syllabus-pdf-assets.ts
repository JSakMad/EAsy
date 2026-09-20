import 'server-only';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const requireFromHere = createRequire(import.meta.url);
const pdfAssetsRoot = dirname(requireFromHere.resolve('pdfjs-dist/package.json'));
const directories = { standardFontDataUrl: 'standard_fonts', cMapUrl: 'cmaps' } as const;

// unpdf's serverless PDF.js build may use a browser-style fetch implementation.
// Read bundled assets directly instead of fetching file:// URLs or a CDN.
export class SyllabusPdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    if (!Object.hasOwn(directories, kind) || !/^[a-z0-9_.-]+$/i.test(filename) || filename.includes('..')) {
      throw new Error('Unsupported PDF asset');
    }
    // These specific asset directories are included explicitly in next.config.ts.
    const assetPath = join(/* turbopackIgnore: true */ pdfAssetsRoot, directories[kind as keyof typeof directories], filename);
    return new Uint8Array(await readFile(/* turbopackIgnore: true */ assetPath));
  }
}

export const syllabusPdfOptions = {
  useSystemFonts: false,
  useWorkerFetch: false,
  standardFontDataUrl: pathToFileURL(join(pdfAssetsRoot, 'standard_fonts') + '/').href,
  cMapUrl: pathToFileURL(join(pdfAssetsRoot, 'cmaps') + '/').href,
  cMapPacked: true,
  BinaryDataFactory: SyllabusPdfBinaryDataFactory,
};
