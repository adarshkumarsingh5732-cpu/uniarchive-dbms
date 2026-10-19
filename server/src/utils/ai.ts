/**
 * Minimal OpenAI-compatible chat client.
 *
 * Default provider is **Velona** (`https://velona.in/v1`, prepaid INR gateway),
 * used with the cheapest DeepSeek model by default because the demo wallet is
 * small — see `docs/improvements.md` and the AI section of `AGENTS.md`.
 *
 * Configuration (server/.env):
 *   AI_API_KEY   / VELONA_API_KEY   the gateway key
 *   AI_BASE_URL  / VELONA_BASE_URL  e.g. https://velona.in/v1
 *   AI_MODEL                        e.g. deepseek/deepseek-v4-flash-0731
 *
 * The legacy `NVIDIA_*` trio still works as a fallback so an existing checkout
 * does not break, but anything new should use the `AI_*` names.
 */

const DEFAULT_BASE_URL = 'https://velona.in/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731';

/**
 * Velona sits behind Cloudflare, which answers an obviously non-browser client
 * with `403 error code 1010`. Node's fetch sends `user-agent: node`, so send a
 * browser-like one. (The provider docs hit exactly this; see
 * `~/docs/systems/ai-sidebar-models.md`.)
 */
const USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

/** Hard ceiling on a single request; the gateway can be slow under load. */
const TIMEOUT_MS = 30_000;

export interface AiConfig {
    endpoint: string;
    key: string;
    model: string;
    provider: string;
}

/** Build the chat-completions URL from a base URL that may already include it. */
const completionsUrl = (base: string): string => {
    const trimmed = base.replace(/\/+$/, '');
    return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
};

export const resolveAiConfig = (): AiConfig | null => {
    const key = process.env.AI_API_KEY || process.env.VELONA_API_KEY;
    if (key) {
        const base = process.env.AI_BASE_URL || process.env.VELONA_BASE_URL || DEFAULT_BASE_URL;
        return {
            endpoint: completionsUrl(base),
            key,
            model: process.env.AI_MODEL || DEFAULT_MODEL,
            provider: new URL(base.startsWith('http') ? base : `https://${base}`).host
        };
    }

    // Legacy fallback: the NVIDIA NIM endpoint the app used before.
    if (process.env.NVIDIA_API_KEY) {
        return {
            endpoint: process.env.NVIDIA_API_ENDPOINT || 'https://integrate.api.nvidia.com/v1/chat/completions',
            key: process.env.NVIDIA_API_KEY,
            model: process.env.NVIDIA_MODEL || 'meta/llama3-70b-instruct',
            provider: 'integrate.api.nvidia.com'
        };
    }

    return null;
};

export const aiConfigured = (): boolean => resolveAiConfig() !== null;

/** Model + host, for logs and the `/api/health` payload. Never includes the key. */
export const aiInfo = (): { model: string; provider: string } | null => {
    const cfg = resolveAiConfig();
    return cfg ? { model: cfg.model, provider: cfg.provider } : null;
};

export interface ChatRequest {
    system: string;
    user: string;
    /** Kept small on purpose: this is a demo budget, not a chatbot. */
    maxTokens?: number;
    temperature?: number;
}

/**
 * One-shot chat completion. Deliberately non-streaming (the gateway's SSE
 * frames carry no `usage`, and we want a single small JSON response).
 *
 * Note: DeepSeek "thinking" tokens are billed as output and cannot be disabled
 * on Velona's `/v1` surface, so `maxTokens` must leave room for them — a cap of
 * ~24 tokens truncates the answer before it starts.
 */
export const chatComplete = async ({
    system,
    user,
    maxTokens = 420,
    temperature = 0.3
}: ChatRequest): Promise<string> => {
    const cfg = resolveAiConfig();
    if (!cfg) throw new Error('AI provider is not configured');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(cfg.endpoint, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${cfg.key}`,
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT
            },
            body: JSON.stringify({
                model: cfg.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                max_tokens: maxTokens,
                temperature
            })
        });

        if (!response.ok) {
            const detail = (await response.text()).slice(0, 300);
            throw new Error(`AI provider ${response.status}: ${detail}`);
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('AI provider returned no content');

        return String(content).trim();
    } finally {
        clearTimeout(timer);
    }
};
