import { query, queryOne, execute, withTransaction } from '../config/db.js';

export interface CommentDTO {
    id: string;
    author: string;
    text: string;
    timestamp: string;
    upvotes: number;
    isOp: boolean;
}

export interface ResourceDTO {
    id: number;
    title: string;
    courseCode: string;
    slot: string;
    type: string;
    topics: string[];
    qualityScore: number;
    completeness: number;
    upvotes: number;
    downloads: number;
    views: number;
    author: string;
    professor: string | null;
    semester: string | null;
    year: string | null;
    description: string | null;
    pdfUrl: string;
    createdAt: string;
    commentsCount: number;
    comments?: CommentDTO[];
}

export interface ResourceFilters {
    type?: string;
    slot?: string;
    course?: string;
    search?: string;
}

/** Base projection shared by the list and detail queries. */
const RESOURCE_SELECT = `
    SELECT
        r.resource_id   AS id,
        r.title         AS title,
        c.course_code   AS courseCode,
        s.slot_code     AS slot,
        rt.type_name    AS type,
        r.quality_score AS qualityScore,
        r.completeness  AS completeness,
        r.upvotes       AS upvotes,
        r.downloads     AS downloads,
        r.views         AS views,
        u.username      AS author,
        p.professor_name AS professor,
        sem.semester_name AS semester,
        sem.year        AS year,
        r.description   AS description,
        r.pdf_url       AS pdfUrl,
        r.created_at    AS createdAt,
        (SELECT COUNT(*) FROM comments cm WHERE cm.resource_id = r.resource_id) AS commentsCount
    FROM resources r
    JOIN courses        c   ON c.course_id   = r.course_id
    JOIN slots          s   ON s.slot_id     = r.slot_id
    JOIN resource_types rt  ON rt.type_id    = r.type_id
    JOIN users          u   ON u.user_id     = r.author_id
    LEFT JOIN professors p  ON p.professor_id = r.professor_id
    LEFT JOIN semesters  sem ON sem.semester_id = r.semester_id
`;

const mapRow = (row: any): ResourceDTO => ({
    ...row,
    // The API contract (types.ts) uses string ids; the route param is a string
    // too, so comparing `r.id === params.id` only works if we serialise as string.
    id: String(row.id),
    qualityScore: Number(row.qualityScore),
    completeness: Number(row.completeness),
    upvotes: Number(row.upvotes),
    downloads: Number(row.downloads),
    views: Number(row.views),
    commentsCount: Number(row.commentsCount),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    topics: []
});

/** Attach the topic list to each resource (one extra query, no N+1). */
const attachTopics = async (rows: ResourceDTO[]): Promise<ResourceDTO[]> => {
    if (rows.length === 0) return rows;
    const placeholders = rows.map(() => '?').join(',');
    const topicRows = await query<{ resource_id: number; topic_name: string }>(
        `SELECT rt.resource_id, t.topic_name
           FROM resource_topics rt
           JOIN topics t ON t.topic_id = rt.topic_id
          WHERE rt.resource_id IN (${placeholders})
          ORDER BY t.topic_name`,
        rows.map(r => r.id)
    );
    const byResource = new Map<string, string[]>();
    for (const t of topicRows) {
        const key = String(t.resource_id);
        if (!byResource.has(key)) byResource.set(key, []);
        byResource.get(key)!.push(t.topic_name);
    }
    return rows.map(r => ({ ...r, topics: byResource.get(String(r.id)) ?? [] }));
};

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, ch => `\\${ch}`);

/** List resources with optional type / slot / course / free-text filters. */
export const listResources = async (filters: ResourceFilters = {}): Promise<ResourceDTO[]> => {
    const where: string[] = [];
    const params: any[] = [];

    if (filters.type && filters.type !== 'ALL') {
        where.push('rt.type_name = ?');
        params.push(filters.type);
    }
    if (filters.slot && filters.slot !== 'ALL') {
        where.push('s.slot_code = ?');
        params.push(filters.slot);
    }
    if (filters.course) {
        where.push('c.course_code LIKE ?');
        params.push(`%${escapeLike(filters.course)}%`);
    }
    if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where.push(`(
            r.title LIKE ? OR
            c.course_code LIKE ? OR
            p.professor_name LIKE ? OR
            EXISTS (
                SELECT 1 FROM resource_topics rtx
                JOIN topics t ON t.topic_id = rtx.topic_id
                WHERE rtx.resource_id = r.resource_id AND t.topic_name LIKE ?
            )
        )`);
        params.push(term, term, term, term);
    }

    const sql = `${RESOURCE_SELECT}
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY r.created_at DESC, r.resource_id DESC`;

    const rows = (await query(sql, params)).map(mapRow);
    return attachTopics(rows);
};

/** Single resource with its full comment thread. */
export const getResourceById = async (id: number | string): Promise<ResourceDTO | null> => {
    const row = await queryOne(`${RESOURCE_SELECT} WHERE r.resource_id = ?`, [id]);
    if (!row) return null;

    const [resource] = await attachTopics([mapRow(row)]);

    const comments = await query<any>(
        `SELECT cm.comment_id AS id, u.username AS author, cm.comment_text AS text,
                cm.upvotes AS upvotes, cm.is_op AS isOp, cm.created_at AS timestamp
           FROM comments cm
           JOIN users u ON u.user_id = cm.author_id
          WHERE cm.resource_id = ?
          ORDER BY cm.created_at DESC, cm.comment_id DESC`,
        [id]
    );

    resource.comments = comments.map(c => ({
        id: String(c.id),
        author: c.author,
        text: c.text,
        upvotes: Number(c.upvotes),
        isOp: Boolean(c.isOp),
        timestamp: c.timestamp instanceof Date ? c.timestamp.toISOString() : String(c.timestamp)
    }));

    return resource;
};

/**
 * File URL plus the bits needed to name the download, used by the
 * preview/download proxy.
 */
export const getResourceFileMeta = async (
    id: number | string
): Promise<{ pdfUrl: string; title: string; courseCode: string } | null> => {
    const row = await queryOne<{ pdf_url: string; title: string; courseCode: string }>(
        `SELECT r.pdf_url AS pdf_url, r.title AS title, c.course_code AS courseCode
           FROM resources r JOIN courses c ON c.course_id = r.course_id
          WHERE r.resource_id = ?`,
        [id]
    );
    return row ? { pdfUrl: row.pdf_url, title: row.title, courseCode: row.courseCode } : null;
};

/** Increment a view / download / upvote counter and return the new value. */
export const incrementInteraction = async (
    id: number | string,
    action: 'view' | 'download' | 'upvote' | 'downvote'
): Promise<{ column: string; value: number } | null> => {
    const columns: Record<string, string> = {
        view: 'views',
        download: 'downloads',
        upvote: 'upvotes',
        downvote: 'upvotes'
    };
    const column = columns[action];
    if (!column) return null;

    const delta = action === 'downvote' ? -1 : 1;

    const result = await execute(
        `UPDATE resources SET ${column} = GREATEST(${column} + ?, 0) WHERE resource_id = ?`,
        [delta, id]
    );
    if (result.affectedRows === 0) return null;

    const row = await queryOne<{ value: number }>(
        `SELECT ${column} AS value FROM resources WHERE resource_id = ?`,
        [id]
    );
    return { column, value: Number(row?.value ?? 0) };
};

/** Append a comment to a resource. */
export const addComment = async (
    resourceId: number | string,
    text: string,
    author: string
): Promise<CommentDTO | null> => {
    const exists = await queryOne<{ resource_id: number }>(
        'SELECT resource_id FROM resources WHERE resource_id = ?',
        [resourceId]
    );
    if (!exists) return null;

    const commentId = await withTransaction(async conn => {
        const authorId = await getOrCreateUser(conn, author, author);
        const [res] = await conn.query(
            `INSERT INTO comments (resource_id, author_id, comment_text, upvotes, is_op)
             VALUES (?, ?, ?, 0, ?)`,
            [resourceId, authorId, text, 0]
        );
        return (res as any).insertId as number;
    });

    const row = await queryOne<any>(
        `SELECT cm.comment_id AS id, u.username AS author, cm.comment_text AS text,
                cm.upvotes AS upvotes, cm.is_op AS isOp, cm.created_at AS timestamp
           FROM comments cm
           JOIN users u ON u.user_id = cm.author_id
          WHERE cm.comment_id = ?`,
        [commentId]
    );

    return {
        id: String(row.id),
        author: row.author,
        text: row.text,
        upvotes: Number(row.upvotes),
        isOp: Boolean(row.isOp),
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp)
    };
};

/* ------------------------------------------------------------------------- */
/* Get-or-create helpers used during upload                                    */
/* ------------------------------------------------------------------------- */

type Conn = { query: (sql: string, params?: any[]) => Promise<any> };

const getOrCreate = async (
    conn: Conn,
    selectSql: string,
    selectParams: any[],
    insertSql: string,
    insertParams: any[],
    idColumn: string
): Promise<number> => {
    const [rows] = await conn.query(selectSql, selectParams);
    if ((rows as any[]).length) return (rows as any[])[0][idColumn];
    const [res] = await conn.query(insertSql, insertParams);
    return (res as any).insertId as number;
};

export const getOrCreateCourse = (conn: Conn, code: string, name?: string) =>
    getOrCreate(conn,
        'SELECT course_id FROM courses WHERE course_code = ?', [code],
        'INSERT INTO courses (course_code, course_name) VALUES (?, ?)', [code, name || code],
        'course_id');

export const getOrCreateSlot = (conn: Conn, code: string) =>
    getOrCreate(conn,
        'SELECT slot_id FROM slots WHERE slot_code = ?', [code],
        'INSERT INTO slots (slot_code) VALUES (?)', [code],
        'slot_id');

export const getOrCreateType = (conn: Conn, name: string) =>
    getOrCreate(conn,
        'SELECT type_id FROM resource_types WHERE type_name = ?', [name],
        'INSERT INTO resource_types (type_name) VALUES (?)', [name],
        'type_id');

export const getOrCreateTopic = (conn: Conn, name: string) =>
    getOrCreate(conn,
        'SELECT topic_id FROM topics WHERE topic_name = ?', [name],
        'INSERT INTO topics (topic_name) VALUES (?)', [name],
        'topic_id');

export const getOrCreateProfessor = (conn: Conn, name: string) =>
    getOrCreate(conn,
        'SELECT professor_id FROM professors WHERE professor_name = ?', [name],
        'INSERT INTO professors (professor_name) VALUES (?)', [name],
        'professor_id');

export const getOrCreateSemester = (conn: Conn, name: string, year: string) =>
    getOrCreate(conn,
        'SELECT semester_id FROM semesters WHERE semester_name = ? AND year = ?', [name, year],
        'INSERT INTO semesters (semester_name, year) VALUES (?, ?)', [name, year],
        'semester_id');

export const getOrCreateUser = (conn: Conn, username: string, email?: string) => {
    const safe = username && username.trim() ? username.trim() : 'Anonymous';
    const mail = email && email.includes('@') ? email : `${safe.replace(/[^a-z0-9._-]/gi, '_')}@vitstudent.ac.in`;
    return getOrCreate(conn,
        'SELECT user_id FROM users WHERE username = ?', [safe],
        'INSERT INTO users (username, email, role, is_verified) VALUES (?, ?, ?, 0)', [safe, mail, 'student'],
        'user_id');
};

/** Full insert path for an uploaded resource, run in a transaction. */
export const createResource = async (metadata: any, pdfUrl: string, author: string): Promise<ResourceDTO | null> => {
    const resourceId = await withTransaction(async conn => {
        const courseId = await getOrCreateCourse(conn, String(metadata.courseCode || '').toUpperCase());
        const slotId = await getOrCreateSlot(conn, String(metadata.slot || '').toUpperCase());
        const typeId = await getOrCreateType(conn, metadata.type || 'Notes');
        const authorId = await getOrCreateUser(conn, author, author);
        const professorId = metadata.professor ? await getOrCreateProfessor(conn, metadata.professor) : null;
        const semesterId = (metadata.semester && metadata.year)
            ? await getOrCreateSemester(conn, metadata.semester, String(metadata.year))
            : null;

        const [res] = await conn.query(
            `INSERT INTO resources
                (title, course_id, slot_id, type_id, author_id, professor_id, semester_id,
                 quality_score, completeness, upvotes, downloads, views, description, pdf_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
            [
                metadata.title ?? 'Untitled',
                courseId, slotId, typeId, authorId, professorId, semesterId,
                metadata.qualityScore ?? 0,
                metadata.completeness ?? 50,
                metadata.description ?? null,
                pdfUrl
            ]
        );
        const newId = (res as any).insertId as number;

        const topics: string[] = Array.isArray(metadata.topics) ? metadata.topics : [];
        for (const topic of topics) {
            if (!topic || !String(topic).trim()) continue;
            const topicId = await getOrCreateTopic(conn, String(topic).trim());
            await conn.query(
                'INSERT IGNORE INTO resource_topics (resource_id, topic_id) VALUES (?, ?)',
                [newId, topicId]
            );
        }
        return newId;
    });

    return getResourceById(resourceId);
};
