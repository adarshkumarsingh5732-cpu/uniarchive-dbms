/**
 * API integration tests.
 *
 * Boots the Express app on an ephemeral port and exercises every route against
 * the seeded database, asserting the JSON contract the React frontend expects.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1'; // prevent app.ts from starting its own listener

const { default: app } = await import('../src/app.ts');
const { default: pool } = await import('../src/config/db.ts');

const server = app.listen(0);
await new Promise<void>(resolve => server.once('listening', () => resolve()));
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}/api`;

// Close the HTTP listener and the connection pool so the runner can exit.
after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
});

const getJson = async (path: string) => {
    const res = await fetch(base + path);
    return { status: res.status, body: await res.json().catch(() => null) };
};

const postJson = async (path: string, body?: unknown) => {
    const res = await fetch(base + path, {
        method: 'POST',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
};

test('GET /api/health reports a live database', async () => {
    const { status, body } = await getJson('/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.dbState, 'connected');
});

test('GET /api/resources returns the full seeded catalogue', async () => {
    const { status, body } = await getJson('/resources');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), 'response should be an array');
    assert.equal(body.length, 11);
    // Every seeded row points at a real stored file, not a placeholder.
    assert.ok(body.every((r: any) => /^\/files\/seed\/[a-z0-9-]+\.pdf$/.test(r.pdfUrl)));

    const first = body[0];
    for (const key of ['id', 'title', 'courseCode', 'slot', 'type', 'topics',
                       'qualityScore', 'completeness', 'upvotes', 'downloads',
                       'views', 'author', 'pdfUrl', 'createdAt']) {
        assert.ok(key in first, `missing field: ${key}`);
    }
    assert.ok(Array.isArray(first.topics), 'topics must be an array');
    assert.equal(typeof first.qualityScore, 'number');
});

test('filters narrow the result set', async () => {
    const byType = await getJson('/resources?type=Notes');
    assert.ok(byType.body.length > 0);
    assert.ok(byType.body.every((r: any) => r.type === 'Notes'));

    const bySlot = await getJson('/resources?slot=C1');
    assert.ok(bySlot.body.length > 0);
    assert.ok(bySlot.body.every((r: any) => r.slot === 'C1'));

    const byCourse = await getJson('/resources?course=BACSE');
    assert.ok(byCourse.body.length >= 4);
    assert.ok(byCourse.body.every((r: any) => r.courseCode.startsWith('BACSE')));
});

test('free-text search matches title, course, professor and topic', async () => {
    const byTitle = await getJson('/resources?search=SQL');
    assert.ok(byTitle.body.length >= 1);
    assert.ok(byTitle.body.some((r: any) => /SQL/.test(r.title)));

    const byTopic = await getJson('/resources?search=indexing');
    assert.equal(byTopic.body.length, 1);
    assert.match(byTopic.body[0].title, /Indexing/i);

    const byProfessor = await getJson('/resources?search=Chandran');
    assert.ok(byProfessor.body.length >= 1);
    assert.ok(byProfessor.body.every((r: any) => /Chandran/.test(r.professor || '')));
});

test('GET /api/resources/:id includes the comment thread', async () => {
    const { status, body } = await getJson('/resources/1');
    assert.equal(status, 200);
    assert.equal(body.id, '1');
    assert.ok(Array.isArray(body.comments));
    assert.equal(body.comments.length, 3);
    assert.equal(body.commentsCount, 3);
    assert.ok(body.comments[0].author);
});

test('GET /api/resources/:id returns 404 for unknown ids', async () => {
    const { status } = await getJson('/resources/999999');
    assert.equal(status, 404);
});

test('GET /api/stats returns course aggregates and top slots', async () => {
    const { status, body } = await getJson('/stats');
    assert.equal(status, 200);
    assert.equal(body.courseStats.length, 4);
    assert.ok(body.topSlots.length > 0 && body.topSlots.length <= 5);

    const stat = body.courseStats[0];
    assert.ok(Array.isArray(stat.topicCoverage));
    assert.equal(stat.activityGrid.length, 364);
    assert.equal(typeof stat.qualityAvg, 'number');
});

test('POST /api/resources/:id/upvote increments and persists', async () => {
    const before = (await getJson('/resources/3')).body.upvotes;
    const { status, body } = await postJson('/resources/3/upvote');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.upvotes, before + 1);

    const after = (await getJson('/resources/3')).body.upvotes;
    assert.equal(after, before + 1);
});

test('POST /api/resources/:id/view and /download increment their counters', async () => {
    const before = (await getJson('/resources/4')).body;
    const view = await postJson('/resources/4/view');
    const download = await postJson('/resources/4/download');
    assert.equal(view.body.views, before.views + 1);
    assert.equal(download.body.downloads, before.downloads + 1);
});

test('invalid interaction action is rejected with 400', async () => {
    const { status } = await postJson('/resources/1/sideways');
    assert.equal(status, 400);
});

test('POST /api/resources/:id/comments appends a comment', async () => {
    const { status, body } = await postJson('/resources/5/comments', {
        text: 'Great resource, thanks!',
        author: 'integration_tester'
    });
    assert.equal(status, 201);
    assert.equal(body.text, 'Great resource, thanks!');
    assert.equal(body.author, 'integration_tester');

    const detail = await getJson('/resources/5');
    assert.ok(detail.body.comments.some((c: any) => c.text === 'Great resource, thanks!'));
});

test('comment without text is rejected with 400', async () => {
    const { status } = await postJson('/resources/5/comments', { author: 'x' });
    assert.equal(status, 400);
});

test('commenting on a missing resource returns 404', async () => {
    const { status } = await postJson('/resources/999999/comments', { text: 'hi' });
    assert.equal(status, 404);
});

// --- File delivery: preview (inline) and download (attachment) -------------

test('the preview endpoint streams inline with a readable filename', async () => {
    const res = await fetch(`${base}/resources/1/preview/anything.pdf`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const disposition = res.headers.get('content-disposition') || '';
    assert.match(disposition, /^inline;/);
    // Chrome names a saved inline PDF after the URL, so the filename must be real.
    assert.match(disposition, /filename="[a-z0-9-]+\.pdf"/);
    assert.ok(!/filename="preview/.test(disposition));
});

test('the download endpoint sends an attachment and counts the download', async () => {
    const before = (await getJson('/resources/2')).body.downloads;

    const res = await fetch(`${base}/resources/2/download/whatever.pdf`);
    assert.equal(res.status, 200);
    const disposition = res.headers.get('content-disposition') || '';
    assert.match(disposition, /^attachment;/);
    assert.match(disposition, /filename="[a-z0-9-]+\.pdf"/);

    const after = (await getJson('/resources/2')).body.downloads;
    assert.equal(after, before + 1, 'the server must own the download counter');
});

test('downloading a missing resource returns 404', async () => {
    const res = await fetch(`${base}/resources/999999/download/x.pdf`);
    assert.equal(res.status, 404);
});

// --- AI: grounded context + request validation -----------------------------

test('the AI context is built from real matches and stays small', async () => {
    const { buildCatalogueContext, questionTerms } = await import('../src/repositories/aiRepository.ts');

    // Question words are reduced to search terms (stopwords and filler dropped).
    assert.deepEqual(questionTerms('what resources exist for BAMAT207?'), ['bamat207']);

    const { text, sources } = await buildCatalogueContext('which resources exist for BAMAT207?');
    assert.equal(sources.length, 5);
    assert.ok(sources.every(s => s.courseCode === 'BAMAT207'));
    assert.match(text, /^ARCHIVE: \d+ resources/);
    assert.ok(text.length < 1200, `context should stay light, got ${text.length} chars`);

    const none = await buildCatalogueContext('quantum chromodynamics lecture notes');
    assert.equal(none.sources.length, 0);
    assert.match(none.text, /MATCHES: none/);
});

test('AI questions are validated before reaching the provider', async () => {
    const empty = await postJson('/ai/ask', { query: '   ' });
    assert.equal(empty.status, 400);

    const tooLong = await postJson('/ai/ask', { query: 'x'.repeat(400) });
    assert.equal(tooLong.status, 400);
});

// --- Auth: normal account signup (no SMTP) --------------------------------

// Unique per run so re-running against a non-reseeded DB can't collide.
const RUN = Date.now().toString(36);
const NEW_USER = {
    username: `signup_${RUN}`,
    email: `signup_${RUN}@vitstudent.ac.in`,
    password: 'correct horse battery'
};

test('POST /api/auth/signup creates an account that can log in immediately', async () => {
    const created = await postJson('/auth/signup', NEW_USER);
    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    assert.equal(created.body.user.username, NEW_USER.username);
    assert.equal(created.body.user.email, NEW_USER.email);
    assert.equal(created.body.user.role, 'student');
    assert.equal(created.body.user.isVerified, true);
    assert.ok(!('password' in created.body.user), 'the response must not echo secrets');

    const login = await postJson('/auth/login', {
        username: NEW_USER.username,
        password: NEW_USER.password
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.username, NEW_USER.username);
});

test('signup rejects duplicate username and duplicate email', async () => {
    const sameUsername = await postJson('/auth/signup', {
        ...NEW_USER,
        email: `other_${RUN}@vitstudent.ac.in`
    });
    assert.equal(sameUsername.status, 409);

    const sameEmail = await postJson('/auth/signup', {
        ...NEW_USER,
        username: `other_${RUN}`
    });
    assert.equal(sameEmail.status, 409);
});

test('signup validates username, email and password', async () => {
    const shortPassword = await postJson('/auth/signup', {
        username: `weak_${RUN}`,
        email: `weak_${RUN}@vitstudent.ac.in`,
        password: 'short'
    });
    assert.equal(shortPassword.status, 400);

    const badEmail = await postJson('/auth/signup', {
        username: `mail_${RUN}`,
        email: 'not-an-email',
        password: 'long enough pw'
    });
    assert.equal(badEmail.status, 400);

    const badUsername = await postJson('/auth/signup', {
        username: 'no spaces allowed',
        email: `space_${RUN}@vitstudent.ac.in`,
        password: 'long enough pw'
    });
    assert.equal(badUsername.status, 400);
});

test('login rejects a wrong password and unknown users', async () => {
    const wrong = await postJson('/auth/login', {
        username: NEW_USER.username,
        password: 'definitely wrong'
    });
    assert.equal(wrong.status, 401);

    const unknown = await postJson('/auth/login', {
        username: `nobody_${RUN}`,
        password: 'whatever123'
    });
    assert.equal(unknown.status, 401);
});

test('the seeded demo account still logs in', async () => {
    const { status, body } = await postJson('/auth/login', {
        username: 'admin123',
        password: 'scse'
    });
    assert.equal(status, 200);
    assert.equal(body.user.username, 'admin123');
    assert.equal(body.user.role, 'admin');
});
