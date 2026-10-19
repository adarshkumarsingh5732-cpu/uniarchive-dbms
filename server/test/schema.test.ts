/**
 * Database-level validation.
 *
 * Asserts the physical schema matches the designed (3NF) model and that the
 * data satisfies the integrity / normalization constraints.  Run with:
 *     npm test          (resets the DB via `pretest`, then runs these checks)
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'test_uniarchive'
});

after(async () => { await conn.end(); });

const rows = async (sql: string, params: any[] = []): Promise<any[]> => {
    const [r] = await conn.query(sql, params);
    return r as any[];
};

const EXPECTED_TABLES = [
    'users', 'courses', 'slots', 'resource_types', 'topics', 'professors',
    'semesters', 'resources', 'resource_topics', 'comments',
    'course_stats', 'course_topic_coverage', 'course_activity', 'otp_requests'
];

test('every expected relation exists', async () => {
    const names = (await rows('SHOW TABLES')).map(r => Object.values(r)[0] as string);
    for (const table of EXPECTED_TABLES) {
        assert.ok(names.includes(table), `missing table: ${table}`);
    }
});

test('repeating groups are decomposed (1NF)', async () => {
    // topics are atomic values, not comma-joined strings
    const multiValued = await rows(`SELECT topic_name FROM topics WHERE topic_name LIKE '%,%'`);
    assert.equal(multiValued.length, 0, 'found a non-atomic topic value');

    // junction tables have a composite primary key with no duplicate pairs
    const dupTopics = await rows(
        'SELECT resource_id, topic_id, COUNT(*) c FROM resource_topics GROUP BY resource_id, topic_id HAVING c > 1'
    );
    assert.equal(dupTopics.length, 0, 'resource_topics contains duplicate pairs');

    const dupCoverage = await rows(
        'SELECT course_id, topic_id, COUNT(*) c FROM course_topic_coverage GROUP BY course_id, topic_id HAVING c > 1'
    );
    assert.equal(dupCoverage.length, 0, 'course_topic_coverage contains duplicate pairs');

    // activity grid is stored as rows, not an array column
    const orphanActivity = await rows(
        `SELECT COUNT(*) c FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'course_activity' AND column_name = 'activity_grid'`
    );
    assert.equal(Number(orphanActivity[0].c), 0, 'course_activity still has an array column');
});

test('junction tables carry no partial dependency (2NF)', async () => {
    const pkColumns = async (table: string) => (await rows(
        `SELECT column_name FROM information_schema.key_column_usage
          WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = 'PRIMARY'`,
        [table]
    )).map(r => (r.column_name ?? r.COLUMN_NAME) as string).sort();

    // resource_topics is a pure junction: both columns are the key.
    assert.deepEqual(await pkColumns('resource_topics'), ['resource_id', 'topic_id']);

    // course_topic_coverage is keyed by (course_id, topic_id) and carries the
    // non-key attribute `coverage`.
    assert.deepEqual(await pkColumns('course_topic_coverage'), ['course_id', 'topic_id']);

    // 2NF holds when the composite key is minimal: a non-key attribute must
    // depend on the WHOLE key, so no proper subset of the key may itself be
    // unique.  Every unique index on these tables must therefore span >= 2
    // columns.
    const uniqueIndexWidths = async (table: string): Promise<number[]> => {
        const r = await rows(
            `SELECT COUNT(*) AS cols FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = ? AND non_unique = 0
              GROUP BY index_name`,
            [table]
        );
        return r.map(x => Number(x.cols));
    };

    for (const table of ['resource_topics', 'course_topic_coverage']) {
        const widths = await uniqueIndexWidths(table);
        assert.ok(widths.length > 0, `${table} has no unique key`);
        assert.ok(
            widths.every(w => w >= 2),
            `${table} has a single-column unique key (partial dependency → not 2NF)`
        );
    }
});

test('every resource is fully linked to its lookup rows', async () => {
    const broken = await rows(`
        SELECT r.resource_id
          FROM resources r
          LEFT JOIN courses        c   ON c.course_id     = r.course_id
          LEFT JOIN slots          s   ON s.slot_id       = r.slot_id
          LEFT JOIN resource_types rt  ON rt.type_id      = r.type_id
          LEFT JOIN users          u   ON u.user_id       = r.author_id
         WHERE c.course_id IS NULL OR s.slot_id IS NULL OR rt.type_id IS NULL OR u.user_id IS NULL
    `);
    assert.equal(broken.length, 0, 'resource with a missing lookup reference');
});

test('no resource is left without at least one topic', async () => {
    const lonely = await rows(`
        SELECT r.resource_id FROM resources r
          LEFT JOIN resource_topics rt ON rt.resource_id = r.resource_id
         WHERE rt.resource_id IS NULL
    `);
    assert.equal(lonely.length, 0, 'resource without topics');
});

test('comments reference a real resource and author', async () => {
    const orphans = await rows(`
        SELECT c.comment_id FROM comments c
          LEFT JOIN resources r ON r.resource_id = c.resource_id
          LEFT JOIN users     u ON u.user_id     = c.author_id
         WHERE r.resource_id IS NULL OR u.user_id IS NULL
    `);
    assert.equal(orphans.length, 0, 'orphan comment found');
});

test('maintained counters and activity intensities stay in range', async () => {
    const badCounters = await rows(
        'SELECT resource_id FROM resources WHERE upvotes < 0 OR downloads < 0 OR views < 0'
    );
    assert.equal(badCounters.length, 0, 'negative counter found');

    const badIntensity = await rows(
        'SELECT course_id FROM course_activity WHERE intensity < 0 OR intensity > 4'
    );
    assert.equal(badIntensity.length, 0, 'activity intensity outside 0..4');
});

test('each course has a complete 364-day activity series', async () => {
    const partial = await rows(
        'SELECT course_id, COUNT(*) c FROM course_activity GROUP BY course_id HAVING c <> 364'
    );
    assert.equal(partial.length, 0, 'course with an incomplete activity series');
});

test('CHECK constraints reject invalid data', async () => {
    // completeness must be within 0..100
    await assert.rejects(
        () => conn.query(
            `INSERT INTO resources (title, course_id, slot_id, type_id, author_id, pdf_url, completeness)
             VALUES ('invalid', 1, 1, 1, 1, 'http://x', 150)`
        ),
        /CONSTRAINT|constraint/
    );

    // resource_types is restricted to the known set
    await assert.rejects(
        () => conn.query(`INSERT INTO resource_types (type_name) VALUES ('Nonsense')`),
        /CONSTRAINT|constraint/
    );

    // OTP codes must be 6 digits
    await assert.rejects(
        () => conn.query(
            `INSERT INTO otp_requests (email, otp_code, expires_at) VALUES ('a@b.co', 'abc', NOW())`
        ),
        /CONSTRAINT|constraint/
    );
});

test('UNIQUE constraints prevent duplicate keys', async () => {
    // Create the colliding rows first rather than assuming a specific seed
    // value exists: the seed's course/user set changes with the dataset, and a
    // hard-coded code silently turned this into "first insert wins".
    await conn.query(`INSERT INTO courses (course_code, course_name) VALUES ('UNIQ_PROBE', 'probe')`);
    await assert.rejects(
        () => conn.query(`INSERT INTO courses (course_code, course_name) VALUES ('UNIQ_PROBE', 'dup')`),
        /Duplicate entry/
    );

    await conn.query(
        `INSERT INTO users (username, email) VALUES ('uniq_probe', 'uniq_probe@test.local')`
    );
    await assert.rejects(
        () => conn.query(`INSERT INTO users (username, email) VALUES ('uniq_probe', 'other@test.local')`),
        /Duplicate entry/
    );
});

test('foreign keys reject references to missing rows', async () => {
    await assert.rejects(
        () => conn.query(
            `INSERT INTO resources (title, course_id, slot_id, type_id, author_id, pdf_url)
             VALUES ('orphan', 99999, 1, 1, 1, 'http://x')`
        ),
        /foreign key|FOREIGN KEY/
    );
});
