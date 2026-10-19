import { Resource, CourseStats, Comment, ResourceType, User, AIAnswer } from '../types';

// Always call the API on a relative path: Vite proxies /api to the backend in
// dev (vite.config.ts) and vercel.json rewrites it in production. This makes the
// app work identically on localhost, a LAN address, or a deployed domain.
// Set VITE_API_URL to point at a different origin.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/**
 * Mirrors `slugify` in server/src/controllers/resourceController.ts.
 *
 * The trailing filename matters: Chrome's built-in PDF viewer names a saved
 * inline file after the URL's last path segment, which is why every download
 * used to arrive as `preview.pdf`.
 */
const fileSlug = (text: string): string =>
    text
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 60);

const fileStem = (resource: { id: string; title: string; courseCode: string }): string => {
    // Most titles already contain the course code — don't repeat it.
    const includesCode = resource.title.toLowerCase().includes(resource.courseCode.toLowerCase());
    return fileSlug(includesCode ? resource.title : `${resource.courseCode} ${resource.title}`)
        || `resource-${resource.id}`;
};

/** Inline URL for the embedded viewer (server sets `Content-Disposition: inline`). */
export const resourcePreviewUrl = (resource: { id: string; title: string; courseCode: string }): string =>
    `${API_URL}/resources/${resource.id}/preview/${fileStem(resource)}.pdf`;

/** Download URL; the server sends `attachment` with a readable filename. */
export const resourceDownloadUrl = (resource: { id: string; title: string; courseCode: string }): string =>
    `${API_URL}/resources/${resource.id}/download/${fileStem(resource)}.pdf`;

export const api = {
    // Resources
    getResources: async (params?: { type?: string; slot?: string; search?: string; course?: string }): Promise<Resource[]> => {
        const query = new URLSearchParams();
        if (params?.type && params.type !== 'ALL') query.append('type', params.type);
        if (params?.slot && params.slot !== 'ALL') query.append('slot', params.slot);
        if (params?.search) query.append('search', params.search);
        if (params?.course) query.append('course', params.course);

        const res = await fetch(`${API_URL}/resources?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch resources');
        return res.json();
    },

    getResourceById: async (id: string): Promise<Resource> => {
        const res = await fetch(`${API_URL}/resources/${id}`);
        if (!res.ok) throw new Error('Failed to fetch resource');
        return res.json();
    },

    uploadResource: async (formData: FormData): Promise<Resource> => {
        // Note: formData should contain 'file' and 'data' (JSON string)
        const res = await fetch(`${API_URL}/resources`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${errorText}`);
        }
        return res.json();
    },

    updateInteraction: async (id: string, action: 'view' | 'download' | 'upvote'): Promise<any> => {
        const res = await fetch(`${API_URL}/resources/${id}/${action}`, {
            method: 'POST',
        });
        return res.json();
    },

    addComment: async (id: string, comment: { text: string; author: string }): Promise<Comment> => {
        const res = await fetch(`${API_URL}/resources/${id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comment),
        });
        if (!res.ok) throw new Error('Failed to post comment');
        return res.json();
    },

    // Stats
    getStats: async (): Promise<{ courseStats: CourseStats[]; topSlots: any[] }> => {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },

    // Auth
    sendOtp: async (email: string): Promise<{ message: string }> => {
        const res = await fetch(`${API_URL}/auth/otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to send OTP');
        }
        return res.json();
    },

    verifyOtp: async (email: string, otp: string): Promise<{ success: boolean; message: string; user?: User }> => {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Verification failed');
        }
        return res.json();
    },

    /** Password login for the demo account.
     *  Body: { username, password }
     *  Demo credential: admin123 / scse
     *  Returns { success, message, user } on success (same shape as verifyOtp).
     */
    login: async (username: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const text = await res.text();
        if (!res.ok) {
            let message = 'Login failed';
            try {
                const body = JSON.parse(text);
                message = body.message || message;
            } catch {
                message = text || message;
            }
            throw new Error(message);
        }
        try {
            return JSON.parse(text) as { success: boolean; message: string; user?: User };
        } catch {
            throw new Error('Login response was not valid JSON');
        }
    },

    /** Create a normal account (no email verification / OTP needed).
     *  Returns { success, message, user } — same shape as login/verify.
     */
    signup: async (username: string, email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const text = await res.text();
        let body: any = null;
        try { body = JSON.parse(text); } catch { /* non-JSON error page */ }

        if (!res.ok) {
            throw new Error(body?.message || `Signup failed (${res.status})`);
        }
        if (!body) throw new Error('Signup response was not valid JSON');
        return body as { success: boolean; message: string; user?: User };
    },

    /** Ask the archive a question. The backend grounds the answer in the DB and
     *  returns the resources it used, so the UI can link back to them. */
    askAI: async (query: string): Promise<AIAnswer> => {
        const res = await fetch(`${API_URL}/ai/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const text = await res.text();
        let body: any = null;
        try { body = JSON.parse(text); } catch { /* non-JSON error page */ }

        if (!res.ok) {
            // The API sends a friendly `answer` even on failure, so prefer it.
            throw new Error(body?.answer || body?.message || `AI request failed (${res.status})`);
        }
        if (!body) throw new Error('AI response was not valid JSON');
        return {
            answer: String(body.answer ?? ''),
            sources: Array.isArray(body.sources) ? body.sources : [],
            ai: body.ai ?? null
        };
    }
};
