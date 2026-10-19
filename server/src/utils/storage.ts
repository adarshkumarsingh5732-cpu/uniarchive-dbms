import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Local file storage for PDFs.
 *
 * Why not Cloudinary for these?  The configured Cloudinary account has PDF/ZIP
 * delivery disabled, so every asset whose URL ends in `.pdf` answers `401`
 * (a 1×1 gif).  That made both seeded previews and PDFs uploaded through the
 * app undeliverable.  PDFs are therefore written to disk and served from our own
 * origin — which the preview/download endpoints already do (correct content
 * type, inline/attachment, byte ranges, readable filename).
 *
 * Layout (both under server/):
 *   storage/seed/<file>.pdf      committed demo material (db/seed.sql points here)
 *   storage/uploads/<file>.pdf   files uploaded at runtime (gitignored)
 *
 * Images still go to Cloudinary (see utils/cloudinary.ts) — only PDFs are local.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** server/storage — `../../` works from both src/utils and dist/utils. */
export const STORAGE_ROOT = path.resolve(HERE, '../../storage');
export const SEED_DIR = path.join(STORAGE_ROOT, 'seed');
export const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');

/** URL prefix served by the app for anything in storage/. */
export const FILES_URL_PREFIX = '/files';

const BUCKETS = { seed: SEED_DIR, uploads: UPLOAD_DIR } as const;
type Bucket = keyof typeof BUCKETS;

/** Turn arbitrary text into a safe file stem. */
const safeStem = (text: string): string =>
    text
        .normalize('NFKD')
        .replace(/[^\w\s.-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 60) || 'file';

export interface StoredFile {
    body: Buffer;
    contentType: string;
    isPdf: boolean;
}

/**
 * Persist a PDF and return the same-origin URL to store in `resources.pdf_url`
 * (e.g. `/files/uploads/1792345678-bacse202-notes.pdf`).
 */
export const savePdf = async (buffer: Buffer, originalName: string): Promise<string> => {
    const base = path.basename(originalName || 'resource.pdf');
    const stem = safeStem(base.replace(/\.pdf$/i, '')) || 'resource';
    const filename = `${Date.now()}-${stem}.pdf`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return `${FILES_URL_PREFIX}/uploads/${filename}`;
};

export const isStoredFileUrl = (url: string): boolean =>
    url.startsWith(`${FILES_URL_PREFIX}/`);

/**
 * Read a `/files/<bucket>/<name>` URL from disk.
 * Returns null for anything that is not a stored URL or would escape the bucket
 * (path traversal), so callers can fall back to the network path.
 */
export const readStoredFile = async (url: string): Promise<StoredFile | null> => {
    if (!isStoredFileUrl(url)) return null;

    const [, , bucketName, ...rest] = url.split('/');
    const bucket = BUCKETS[bucketName as Bucket];
    if (!bucket) return null;

    const filename = rest.join('/');
    // basename() strips any ../ segments; reject if that changed the name.
    if (path.basename(filename) !== filename) return null;

    try {
        const body = await fs.readFile(path.join(bucket, filename));
        const isPdf = body.subarray(0, 5).toString('latin1') === '%PDF-';
        const extension = path.extname(filename).toLowerCase();
        const contentType = isPdf
            ? 'application/pdf'
            : extension === '.png' ? 'image/png'
                : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg'
                    : 'application/octet-stream';
        return { body, contentType, isPdf };
    } catch {
        return null;
    }
};
