import { Request, Response } from 'express';
import { buildCatalogueContext } from '../repositories/aiRepository.js';
import { aiConfigured, aiInfo, chatComplete } from '../utils/ai.js';

/**
 * Answers are grounded in the archive instead of being open-ended chat: the
 * repository sends a small summary + the resources that actually match the
 * question, and the model is told to answer from that block only.
 *
 * The prompt is deliberately tiny — the demo runs on a prepaid wallet, so both
 * the context and the output budget are capped (see server/src/utils/ai.ts).
 */
const SYSTEM_PROMPT = [
    'You are the UniArchives assistant for a university course-resource archive.',
    'Answer ONLY from the DATA block; never invent resources, courses or numbers.',
    'Cite the resources you use as [#id].',
    'Be concise: plain text, no markdown headings, at most 120 words.',
    'If the DATA does not answer the question, say so in one sentence and suggest 1-2 concrete search terms.'
].join(' ');

const MAX_QUESTION_LENGTH = 300;

// @desc    Ask the archive a question (grounded in the database)
// @route   POST /api/ai/ask
//   Body: { query }
//   Returns { answer, sources: [{ id, title, courseCode, type }], ai: { model, provider } }
export const askAI = async (req: Request, res: Response): Promise<void> => {
    const question = String(req.body?.query ?? '').trim();

    if (!question) {
        res.status(400).json({ message: 'Query is required' });
        return;
    }
    if (question.length > MAX_QUESTION_LENGTH) {
        res.status(400).json({ message: `Question is too long (${MAX_QUESTION_LENGTH} characters max)` });
        return;
    }

    const info = aiInfo();
    if (!aiConfigured() || !info) {
        console.error('[AI] No AI_API_KEY / VELONA_API_KEY configured');
        res.status(503).json({
            answer: 'The AI assistant is not configured on the server (missing AI_API_KEY).',
            sources: [],
            ai: null
        });
        return;
    }

    try {
        const { text, sources } = await buildCatalogueContext(question);
        console.log(`[AI] ${info.model} @ ${info.provider}: "${question.slice(0, 60)}" (${sources.length} sources)`);

        const answer = await chatComplete({
            system: SYSTEM_PROMPT,
            user: `DATA:\n${text}\n\nQUESTION: ${question}`
        });

        res.json({ answer, sources, ai: info });
    } catch (error: any) {
        console.error('[AI] Request failed:', error?.message || error);
        const timeout = error?.name === 'AbortError';
        res.status(502).json({
            answer: timeout
                ? 'The AI service timed out. Please try again.'
                : 'The AI service is unavailable right now. Please try again in a moment.',
            sources: [],
            ai: info
        });
    }
};
