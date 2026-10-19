import { Request, Response } from 'express';
import {
    listResources,
    getResourceById,
    getResourceFileMeta,
    createResource,
    incrementInteraction,
    addComment
} from '../repositories/resourceRepository.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { readStoredFile, savePdf } from '../utils/storage.js';

// @desc    Get all resources
// @route   GET /api/resources
export const getResources = async (req: Request, res: Response) => {
    try {
        const { type, slot, course, search } = req.query;
        const resources = await listResources({
            type: type as string,
            slot: slot as string,
            course: course as string,
            search: search as string
        });
        res.json(resources);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Stream a resource's file inline so the browser previews it
// @route   GET /api/resources/:id/preview
//
// Uploads live on Cloudinary (and seeded rows point at external hosts).  Those
// hosts serve files with `Content-Disposition: attachment`, so embedding the
// URL directly makes the browser download it.  We re-serve the bytes from our
// own origin with `Content-Disposition: inline` instead.
interface PreviewEntry {
    body: Buffer;
    contentType: string;
    isPdf: boolean;
    expires: number;
}

/**
 * Tiny in-process cache so repeatedly opening the same resource does not
 * re-download it from Cloudinary every time.  Bounded by entry count and TTL;
 * a demo-scale trade-off, not a CDN.
 */
const PREVIEW_TTL_MS = 5 * 60 * 1000;
const PREVIEW_MAX_ENTRIES = 64;
const previewCache = new Map<string, PreviewEntry>();

const loadPreview = async (id: string, fileUrl: string): Promise<PreviewEntry> => {
    const cached = previewCache.get(id);
    if (cached && cached.expires > Date.now()) return cached;

    const upstream = await fetch(fileUrl);
    if (!upstream.ok) {
        const err: any = new Error(`Upstream responded ${upstream.status}`);
        err.status = 502;
        throw err;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    const upstreamType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    // Cloudinary serves `raw` assets -- which is how PDFs are uploaded here --
    // as `application/octet-stream` with no extension in the URL.  Passed
    // through unchanged, that makes the browser download the file instead of
    // previewing it.  Sniff the magic bytes so real PDFs are labelled
    // correctly no matter what the host claims.
    const isPdf = upstreamType === 'application/pdf'
        || body.subarray(0, 5).toString('latin1') === '%PDF-';

    const entry: PreviewEntry = {
        body,
        contentType: isPdf ? 'application/pdf' : (upstreamType || 'application/octet-stream'),
        isPdf,
        expires: Date.now() + PREVIEW_TTL_MS
    };

    if (previewCache.size >= PREVIEW_MAX_ENTRIES) {
        const oldest = previewCache.keys().next().value;
        if (oldest !== undefined) previewCache.delete(oldest);
    }
    previewCache.set(id, entry);
    return entry;
};

/** URL-safe stem for the saved file, e.g. `cse2004-database-management-sql-queries`. */
export const slugify = (text: string): string =>
    text
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 60);

/** Extension to save under, based on what the bytes actually are. */
const fileExtension = (contentType: string, isPdf: boolean): string => {
    if (isPdf) return 'pdf';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('msword')) return 'doc';
    if (contentType.includes('wordprocessingml')) return 'docx';
    if (contentType.includes('text/plain')) return 'txt';
    return 'bin';
};

/**
 * Build the file name a browser should save this resource as.
 *
 * Chrome's built-in PDF viewer ignores `Content-Disposition` for files it shows
 * inline and names the saved file after the URL's last path segment — which is
 * why downloads used to arrive as `preview`. Two fixes, both applied here:
 * `attachment` responses carry an explicit name, and the inline preview URL now
 * ends in `/<slug>.pdf` so even "Save as" from the viewer is sensible.
 */
const resourceFileName = (title: string, courseCode: string, id: string, extension: string): string => {
    // Most seed titles already start with the course code — don't repeat it.
    const includesCode = title.toLowerCase().includes(courseCode.toLowerCase());
    const stem = slugify(includesCode ? title : `${courseCode} ${title}`);
    return `${stem || `resource-${slugify(id) || 'file'}`}.${extension}`;
};

const contentDisposition = (type: 'inline' | 'attachment', filename: string): string => {
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

/**
 * Shared streaming path for `.../preview` (inline) and `.../download`
 * (attachment).  Both re-serve the upstream bytes from our own origin so the
 * browser previews them and so the saved file has a readable name.
 */
const streamResourceFile = async (
    req: Request,
    res: Response,
    disposition: 'inline' | 'attachment'
) => {
    try {
        const id = String(req.params.id);
        const meta = await getResourceFileMeta(id);
        if (!meta) {
            res.status(404).json({ message: 'Resource not found' });
            return;
        }

        // PDFs live in server/storage and are read straight off disk; anything
        // else (images / legacy rows) is proxied from its URL.
        const stored = await readStoredFile(meta.pdfUrl);
        if (!stored && meta.pdfUrl.startsWith('/')) {
            res.redirect(meta.pdfUrl);
            return;
        }

        const entry = stored ?? await loadPreview(id, meta.pdfUrl);
        const { body, contentType, isPdf } = entry;
        const filename = resourceFileName(meta.title, meta.courseCode, id, fileExtension(contentType, isPdf));

        // The counter is incremented by the server for real downloads, so the
        // client does not have to (and cannot double-count).
        if (disposition === 'attachment') {
            await incrementInteraction(id, 'download').catch(() => {});
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', contentDisposition(disposition, filename));
        res.setHeader('Accept-Ranges', 'bytes');
        // The bytes come from a third party and our headers are authoritative;
        // never let a browser reuse an earlier response for this URL (a stale
        // `application/octet-stream` would silently go back to downloading).
        res.setHeader('Cache-Control', 'no-store');

        // Honour a single byte range: the browser's PDF viewer uses one to
        // stream and seek instead of pulling the whole document first.
        const rangeHeader = req.headers.range;
        const match = typeof rangeHeader === 'string'
            ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
            : null;

        if (match) {
            const [, startRaw, endRaw] = match;
            const suffixLength = startRaw === '' ? Number(endRaw) : NaN;
            let start = startRaw === '' ? body.length - suffixLength : Number(startRaw);
            let end = startRaw === '' || endRaw === '' ? body.length - 1 : Number(endRaw);

            const invalid = !Number.isFinite(start) || !Number.isFinite(end)
                || start < 0 || end < start || start >= body.length;
            if (invalid) {
                res.status(416);
                res.setHeader('Content-Range', `bytes */${body.length}`);
                res.end();
                return;
            }

            end = Math.min(end, body.length - 1);
            const chunk = body.subarray(start, end + 1);
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`);
            res.setHeader('Content-Length', String(chunk.length));
            res.end(chunk);
            return;
        }

        res.setHeader('Content-Length', String(body.length));
        res.end(body);
    } catch (error: any) {
        if (error?.status === 502) {
            res.status(502).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: error.message });
    }
};

export const previewResourceHandler = (req: Request, res: Response) =>
    streamResourceFile(req, res, 'inline');

// @desc    Download a resource with a readable filename
// @route   GET /api/resources/:id/download/:filename?
export const downloadResourceHandler = (req: Request, res: Response) =>
    streamResourceFile(req, res, 'attachment');

// @desc    Get single resource
// @route   GET /api/resources/:id
export const getResourceByIdHandler = async (req: Request, res: Response) => {
    try {
        const resource = await getResourceById(req.params.id);
        if (resource) {
            res.json(resource);
        } else {
            res.status(404).json({ message: 'Resource not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new resource
// @route   POST /api/resources
export const createResourceHandler = async (req: Request, res: Response) => {
    try {
        // req.file holds the uploaded file; req.body.data is the JSON metadata.
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const metadata = JSON.parse(req.body.data);

        // PDFs are stored on our own origin: Cloudinary accounts can have PDF
        // delivery disabled (ours does — every `.pdf` URL answers 401), which
        // made uploads unopenable. Images still go to Cloudinary.
        let fileUrl: string;
        try {
            const isPdf = req.file.mimetype === 'application/pdf'
                || req.file.originalname.toLowerCase().endsWith('.pdf')
                || (req.file.buffer && req.file.buffer.subarray(0, 5).toString('latin1') === '%PDF-');

            if (isPdf) {
                fileUrl = await savePdf(req.file.buffer, req.file.originalname);
                console.log('[Upload] stored PDF:', fileUrl);
            } else {
                const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
                const result = await uploadToCloudinary(req.file.buffer, 'uniarchive', resourceType);
                fileUrl = result.secure_url;
                console.log('[Upload] Cloudinary success:', fileUrl);
            }
        } catch (uploadError: any) {
            console.error('[Upload] Failed:', uploadError);
            res.status(500).json({ message: 'Upload failed: ' + (uploadError.message || uploadError) });
            return;
        }

        // Attribute the upload to the signed-in user when the client sends one.
        const created = await createResource(metadata, fileUrl, metadata.author || 'You');
        res.status(201).json(created);
    } catch (error: any) {
        console.error('[CreateResource] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Increment interaction counters
// @route   POST /api/resources/:id/:action
export const updateInteractionHandler = async (req: Request, res: Response) => {
    try {
        const { id, action } = req.params;
        const valid = ['view', 'download', 'upvote', 'downvote'];
        if (!valid.includes(action)) {
            res.status(400).json({ message: 'Invalid action' });
            return;
        }

        const result = await incrementInteraction(id, action as any);
        if (!result) {
            res.status(404).json({ message: 'Resource not found' });
            return;
        }

        res.json({ success: true, [action + 's']: result.value });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add comment
// @route   POST /api/resources/:id/comments
export const addCommentHandler = async (req: Request, res: Response) => {
    try {
        const { text, author } = req.body;
        if (!text || !String(text).trim()) {
            res.status(400).json({ message: 'Comment text is required' });
            return;
        }

        const comment = await addComment(req.params.id, String(text).trim(), author || 'Anonymous');
        if (!comment) {
            res.status(404).json({ message: 'Resource not found' });
            return;
        }
        res.status(201).json(comment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
