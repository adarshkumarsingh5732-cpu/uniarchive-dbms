import { Resource, ResourceType } from '../types';

/**
 * Ranked in-memory search over the loaded catalogue.
 *
 * The API's `?search=` parameter is a plain substring match (title, course code,
 * professor, topics) — fine for a single term, useless for "sql indexing notes"
 * and it gives no ranking. The whole catalogue is already in memory, so search
 * happens here instead: every token must match somewhere (with an OR fallback
 * when that is too strict) and results are ordered by how well they match.
 *
 * Matching is case-insensitive and treats the query as a literal substring, the
 * same way the SQL `LIKE` does.
 */

/** Break a query into lower-cased tokens. */
export const tokenize = (query: string): string[] =>
    query
        .toLowerCase()
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean);

/** Does this resource contain the token anywhere that a student would expect? */
const tokenMatches = (resource: Resource, token: string): boolean =>
    resource.title.toLowerCase().includes(token) ||
    resource.courseCode.toLowerCase().includes(token) ||
    (resource.professor ?? '').toLowerCase().includes(token) ||
    (resource.description ?? '').toLowerCase().includes(token) ||
    resource.type.toLowerCase().includes(token) ||
    resource.slot.toLowerCase().includes(token) ||
    resource.topics.some(topic => topic.toLowerCase().includes(token));

/**
 * Relevance score for one token. Weighted so the fields students actually search
 * by (course code, title, topics) dominate, and a word-boundary hit (the token
 * starting a word) beats a match in the middle of a word.
 */
const tokenScore = (resource: Resource, token: string): number => {
    let score = 0;

    const course = resource.courseCode.toLowerCase();
    if (course === token) score += 120;
    else if (course.includes(token)) score += 60;

    const title = resource.title.toLowerCase();
    if (title.startsWith(token)) score += 80;
    else if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) score += 50;
    else if (title.includes(token)) score += 24;

    if (resource.slot.toLowerCase() === token) score += 45;
    if (resource.type.toLowerCase().includes(token)) score += 30;

    if (resource.topics.some(topic => topic.toLowerCase().includes(token))) score += 34;

    if ((resource.professor ?? '').toLowerCase().includes(token)) score += 20;
    if ((resource.description ?? '').toLowerCase().includes(token)) score += 8;

    return score;
};

/**
 * Rank the catalogue against a query.
 *
 * All tokens must match (AND); if that yields nothing we retry with any token
 * (OR) so a single stray word still returns something useful. Ties break on
 * quality score, then upvotes.
 */
export const searchResources = (
    resources: Resource[],
    query: string,
    options: { type?: ResourceType | 'ALL'; slot?: string | 'ALL'; limit?: number } = {}
): Resource[] => {
    const tokens = tokenize(query);
    const { type = 'ALL', slot = 'ALL' } = options;

    const candidates = resources.filter(
        resource =>
            (type === 'ALL' || resource.type === type) &&
            (slot === 'ALL' || resource.slot === slot)
    );

    if (tokens.length === 0) {
        return typeof options.limit === 'number' ? candidates.slice(0, options.limit) : candidates;
    }

    const rank = (pool: Resource[], requireAll: boolean): { resource: Resource; score: number }[] => {
        const scored: { resource: Resource; score: number }[] = [];
        for (const resource of pool) {
            let score = 0;
            let matched = 0;
            for (const token of tokens) {
                if (tokenMatches(resource, token)) {
                    matched += 1;
                    score += tokenScore(resource, token);
                }
            }
            const hit = requireAll ? matched === tokens.length : matched > 0;
            if (hit) scored.push({ resource, score });
        }
        return scored;
    };

    let scored = rank(candidates, true);
    if (scored.length === 0) scored = rank(candidates, false); // OR fallback

    const ordered = scored
        .sort(
            (a, b) =>
                b.score - a.score ||
                b.resource.qualityScore - a.resource.qualityScore ||
                b.resource.upvotes - a.resource.upvotes ||
                a.resource.title.localeCompare(b.resource.title)
        )
        .map(entry => entry.resource);

    return typeof options.limit === 'number' ? ordered.slice(0, options.limit) : ordered;
};

/** Simple predicate for callers that only need a boolean (kept for reuse). */
export const matchesAnyToken = (resource: Resource, query: string): boolean =>
    tokenize(query).some(token => tokenMatches(resource, token));

/** Split a title into [before, match, after] so a result can highlight the hit. */
export const highlightParts = (text: string, query: string): [string, string, string] => {
    const tokens = tokenize(query).sort((a, b) => b.length - a.length);
    const lower = text.toLowerCase();

    for (const token of tokens) {
        const index = lower.indexOf(token);
        if (index >= 0) {
            return [text.slice(0, index), text.slice(index, index + token.length), text.slice(index + token.length)];
        }
    }
    return [text, '', ''];
};
