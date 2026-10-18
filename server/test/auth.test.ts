/**
 * Auth / OTP validation.
 *
 * Exercises the repository layer directly (no SMTP needed): issuing a code,
 * the resend window, rejection of wrong codes, and promotion of a verified
 * address to a real user row.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import {
    upsertOtp,
    secondsSinceLastOtp,
    verifyAndConsumeOtp,
    createAccount,
    authenticateUser,
    findUserByUsernameOrEmail
} from '../src/repositories/authRepository.ts';

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

// Unique per run so a re-run without reseeding can't collide.
const EMAIL = `auth_probe_${Date.now()}@vitstudent.ac.in`;

test('a code can be issued and reports a fresh age (throttle window)', async () => {
    await upsertOtp(EMAIL, '123456');
    const age = await secondsSinceLastOtp(EMAIL);
    assert.ok(age !== null, 'age should be reported once an OTP exists');
    assert.ok(age! < 5, `a freshly issued code should be ~0s old, got ${age}`);

    const stored = await rows('SELECT otp_code FROM otp_requests WHERE email = ?', [EMAIL]);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].otp_code, '123456');
});

test('re-issuing replaces the previous code rather than adding a row', async () => {
    await upsertOtp(EMAIL, '654321');
    const stored = await rows('SELECT otp_code FROM otp_requests WHERE email = ?', [EMAIL]);
    assert.equal(stored.length, 1, 'one live OTP per email');
    assert.equal(stored[0].otp_code, '654321');
});

test('unknown emails have no OTP age and never verify', async () => {
    assert.equal(await secondsSinceLastOtp('nobody@vitstudent.ac.in'), null);
    assert.equal(await verifyAndConsumeOtp('nobody@vitstudent.ac.in', '000000'), null);
});

test('a wrong code is rejected and leaves the OTP intact', async () => {
    await upsertOtp(EMAIL, '111111');
    assert.equal(await verifyAndConsumeOtp(EMAIL, '222222'), null);

    const still = await rows('SELECT 1 FROM otp_requests WHERE email = ?', [EMAIL]);
    assert.equal(still.length, 1, 'a failed attempt must not consume the code');
});

test('a correct code verifies the user, promotes it, and consumes the OTP', async () => {
    await upsertOtp(EMAIL, '424242');
    const user = await verifyAndConsumeOtp(EMAIL, '424242');

    assert.ok(user, 'verification should return the user');
    assert.equal(user!.email, EMAIL);
    assert.equal(user!.isVerified, true);
    assert.ok(user!.username && user!.username.length > 0);

    // The address is now a real, verified row in users.
    const created = await rows('SELECT username, is_verified FROM users WHERE email = ?', [EMAIL]);
    assert.equal(created.length, 1, 'verification must create the user row');
    assert.equal(Number(created[0].is_verified), 1);

    // Consumed: the row is gone and the same code cannot be replayed.
    const gone = await rows('SELECT 1 FROM otp_requests WHERE email = ?', [EMAIL]);
    assert.equal(gone.length, 0);
    assert.equal(await verifyAndConsumeOtp(EMAIL, '424242'), null);
});

// --- Password accounts (normal signup, no SMTP) ---------------------------

// Unique per run so a re-run without reseeding can't collide.
const RUN = Date.now().toString(36);
const ACCOUNT = {
    username: `acct_${RUN}`,
    email: `acct_${RUN}@vitstudent.ac.in`,
    password: 'a long enough password'
};

test('createAccount stores a salted scrypt hash, never the plaintext', async () => {
    const user = await createAccount(ACCOUNT.username, ACCOUNT.email, ACCOUNT.password);
    assert.equal(user.username, ACCOUNT.username);
    assert.equal(user.isVerified, true);

    const stored = await rows('SELECT password_hash FROM users WHERE username = ?', [ACCOUNT.username]);
    assert.equal(stored.length, 1);
    const hash: string = stored[0].password_hash;
    assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.ok(!hash.includes(ACCOUNT.password), 'the plaintext password must not be stored');
});

test('authenticateUser accepts the right password and rejects a wrong one', async () => {
    const ok = await authenticateUser(ACCOUNT.username, ACCOUNT.password);
    assert.ok(ok);
    assert.equal(ok!.email, ACCOUNT.email);

    assert.equal(await authenticateUser(ACCOUNT.username, 'wrong password'), null);
    assert.equal(await authenticateUser(`missing_${RUN}`, ACCOUNT.password), null);
});

test('findUserByUsernameOrEmail detects both uniqueness conflicts', async () => {
    assert.ok(await findUserByUsernameOrEmail(ACCOUNT.username, 'unused@example.com'));
    assert.ok(await findUserByUsernameOrEmail('unused_username', ACCOUNT.email));
    assert.equal(await findUserByUsernameOrEmail(`free_${RUN}`, `free_${RUN}@example.com`), null);
});
