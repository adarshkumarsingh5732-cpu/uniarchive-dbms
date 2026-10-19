import { query, queryOne } from '../config/db.js';

/**
 * Builds the (small) slice of the archive that gets sent to the AI model.
 *
 * The whole point is to keep the request light: the wallet is prepaid and tiny,
 * so we send a short archive summary plus at most a handful of matching rows
 * instead of the catalogue. All SQL stays in the repository layer.
 */

/** Words that carry no search value in a question. */
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'what', 'which', 'who', 'whom', 'where', 'when',
    'why', 'how', 'are', 'was', 'were', 'is', 'be', 'been', 'do', 'does', 'did', 'can', 'could',
    'should', 'would', 'give', 'gives', 'get', 'got', 'have', 'has', 'had', 'from', 'into', 'about',
    'any', 'all', 'some', 'most', 'best', 'good', 'topic', 'topics', 'notes', 'note', 'there',
    'here', 'please', 'list', 'tell', 'show', 'find', 'me', 'my', 'you', 'your', 'in', 'on', 'of',
    'to', 'a', 'an', 'it', 'its', 'or', 'not', 'no', 'yes', 'anyone', 'has', 'i', 'we',
    'archive', 'uniarchive', 'uniarchives', 'resource', 'resources', 'course', 'courses',
    'subject', 'subjects', 'module', 'modules', 'unit', 'units',
    'exist', 'exists', 'available', 'contain', 'contains', 'include', 'includes', 'study'
]);

/** Split a free-text question into meaningful search terms. */
export const questionTerms = (question: string): string[] => {
    const terms = question
        .toLowerCase()
        .replace(/[^a-z0-9._\-+ ]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2 && !STOPWORDS.has(word));

    // Course codes are the most useful signal; keep them first and de-duplicate.
    return [...new Set(terms)].slice(0, 8);
};

export interface AiSource {
    id: string;
    title: string;
    courseCode: string;
    type: string;
}

export interface AiContext {
    /** Compact text handed to the model. */
    text: string;
    /** Rows the answer was grounded in, for the client to link back. */
    sources: AiSource[];
}

const MAX_MATCHES = 6;
const TITLE_LIMIT = 90;

export const buildCatalogueContext = async (question: string): Promise<AiContext> => {
    const terms = questionTerms(question);

    const [totals, courses, matches] = await Promise.all([
        queryOne<{ resources: number; courses: number; contributors: number; comments: number }>(
            `SELECT
                (SELECT COUNT(*) FROM resources)          AS resources,
                (SELECT COUNT(DISTINCT course_id) FROM resources) AS courses,
                (SELECT COUNT(DISTINCT author_id) FROM resources) AS contributors,
                (SELECT COUNT(*) FROM comments)           AS comments`
        ),
        query<{ courseCode: string }>(
            `SELECT DISTINCT c.course_code AS courseCode
               FROM resources r JOIN courses c ON c.course_id = r.course_id
              ORDER BY c.course_code`
        ),
        terms.length
            ? query<any>(
                  `SELECT
                        r.resource_id   AS id,
                        r.title         AS title,
                        c.course_code   AS courseCode,
                        s.slot_code     AS slot,
                        rt.type_name    AS type,
                        r.quality_score AS qualityScore,
                        r.upvotes       AS upvotes,
                        r.downloads     AS downloads,
                        (SELECT GROUP_CONCAT(t.topic_name ORDER BY t.topic_name SEPARATOR ', ')
                           FROM resource_topics rtx JOIN topics t ON t.topic_id = rtx.topic_id
                          WHERE rtx.resource_id = r.resource_id) AS topics,
                        (CASE ${terms.map(() => 'WHEN r.title LIKE ? OR c.course_code LIKE ? THEN 0').join(' ')} ELSE 1 END) AS match_rank
                   FROM resources r
                   JOIN courses        c  ON c.course_id  = r.course_id
                   JOIN slots          s  ON s.slot_id    = r.slot_id
                   JOIN resource_types rt ON rt.type_id   = r.type_id
                  WHERE ${terms
                      .map(() => `(r.title LIKE ? OR c.course_code LIKE ? OR r.description LIKE ?
                                    OR EXISTS (SELECT 1 FROM resource_topics rx JOIN topics tx ON tx.topic_id = rx.topic_id
                                                WHERE rx.resource_id = r.resource_id AND tx.topic_name LIKE ?))`)
                      .join(' OR ')}
                  ORDER BY match_rank ASC, r.quality_score DESC, r.upvotes DESC
                  LIMIT ?`,
                  [
                      // CASE first, then the WHERE block, matching the SQL order above.
                      ...terms.flatMap(t => [`%${t}%`, `%${t}%`]),
                      ...terms.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`]),
                      MAX_MATCHES
                  ]
              )
            : Promise.resolve([])
    ]);

    const header =
        `ARCHIVE: ${totals?.resources ?? 0} resources · ${totals?.courses ?? 0} courses · ` +
        `${totals?.contributors ?? 0} contributors · ${totals?.comments ?? 0} comments`;
    const courseLine = `COURSES: ${courses.map(c => c.courseCode).join(', ')}`;

    const lines = matches.map(m => {
        const title = String(m.title).slice(0, TITLE_LIMIT);
        const topics = m.topics ? ` · topics: ${String(m.topics).split(', ').slice(0, 4).join(', ')}` : '';
        // Field labels are explicit so the model does not merge them ("95 questions").
        return `#${m.id} [${m.courseCode} ${m.slot} ${m.type}] "${title}"${topics}` +
            ` · quality ${Number(m.qualityScore)}/100 · ${Number(m.upvotes)} upvotes · ${Number(m.downloads)} downloads`;
    });

    const body = lines.length
        ? `MATCHES (${lines.length}):\n${lines.join('\n')}`
        : 'MATCHES: none — no resource in the archive matches this question.';

    return {
        text: [header, courseLine, body].join('\n'),
        sources: matches.map(m => ({
            id: String(m.id),
            title: String(m.title),
            courseCode: String(m.courseCode),
            type: String(m.type)
        }))
    };
};
