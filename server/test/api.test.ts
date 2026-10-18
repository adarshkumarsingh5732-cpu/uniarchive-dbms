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
    assert.equal(body.length, 10);

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
    assert.ok(bySlot.body.every((r: any) => r.slot === 'C1'));

    const byCourse = await getJson('/resources?course=CSE');
    assert.ok(byCourse.body.length >= 4);
    assert.ok(byCourse.body.every((r: any) => r.courseCode.startsWith('CSE')));
});

test('free-text search matches title, course, professor and topic', async () => {
    const byTitle = await getJson('/resources?search=SQL');
    assert.ok(byTitle.body.length >= 1);

    const byTopic = await getJson('/resources?search=k-map');
    assert.equal(byTopic.body.length, 1);
    assert.match(byTopic.body[0].title, /Karnaugh/i);

    const byProfessor = await getJson('/resources?search=Roberts');
    assert.ok(byProfessor.body.length >= 1);
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
    assert.equal(body.courseStats.length, 7);
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
