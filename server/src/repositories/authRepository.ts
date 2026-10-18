import { queryOne, execute } from '../config/db.js';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const OTP_TTL_SECONDS = 600;      // a code is valid for 10 minutes
const OTP_RESEND_SECONDS = 60;    // ...and a new one can be requested after 1 minute

/**
 * Password storage.
 *
 * New accounts are salted + stretched with scrypt and stored as
 *   `scrypt$<salt hex>$<hash hex>`
 * (~103 chars, fits `users.password_hash VARCHAR(128)`).
 *
 * The seeded demo account predates this and uses an unsalted SHA-256 hex
 * digest (see `db/seed.sql`), so verification falls back to that format for
 * legacy rows.  Never use the legacy format for new accounts.
 */
const SCRYPT_PREFIX = 'scrypt';

export const hashPassword = (password: string): string => {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 32).toString('hex');
    return `${SCRYPT_PREFIX}$${salt}$${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
    if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
        const [, salt, hash] = stored.split('$');
        if (!salt || !hash) return false;
        const expected = Buffer.from(hash, 'hex');
        if (!expected.length) return false;
        const actual = scryptSync(password, salt, expected.length);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    // Legacy demo row: unsalted SHA-256.
    return stored === createHash('sha256').update(password).digest('hex');
};

/**
 * Authenticate a username + password pair.  Returns the public user shape on
 * success or null on failure.  The password arrives in plaintext in the login
 * request body — the server is the only place that hashes it.
 */
export const authenticateUser = async (
    username: string,
    password: string
): Promise<{ email: string; username: string; role: string; isVerified: boolean } | null> => {
    const row = await queryOne<{
        user_id: number; username: string; email: string;
        password_hash: string; role: string
    }>(
        'SELECT user_id, username, email, password_hash, role FROM users WHERE username = ? AND password_hash <> \'\'',
        [username.trim()]
    );

    if (!row) return null;
    if (!verifyPassword(password, row.password_hash)) return null;

    return { email: row.email, username: row.username, role: row.role, isVerified: true };
};

/** The public user shape returned to the client on signup/login/verify. */
export type PublicUser = { email: string; username: string; role: string; isVerified: boolean };

/** Look up a user by username or email (both are unique). */
export const findUserByUsernameOrEmail = async (
    username: string,
    email: string
): Promise<{ user_id: number; username: string; email: string } | null> =>
    queryOne<{ user_id: number; username: string; email: string }>(
        'SELECT user_id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username, email]
    );

/**
 * Create a student account.  No email round-trip: accounts created here are
 * immediately usable (the OTP flow is optional and only exists for SMTP setups).
 * Uniqueness is enforced by the DB; callers translate ER_DUP_ENTRY into a 409.
 */
export const createAccount = async (
    username: string,
    email: string,
    password: string
): Promise<PublicUser> => {
    await execute(
        'INSERT INTO users (username, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, 1)',
        [username, email, hashPassword(password), 'student']
    );
    return { email, username, role: 'student', isVerified: true };
};

/** Create or refresh the OTP for an email address (single live OTP per email). */
export const upsertOtp = async (email: string, otp: string): Promise<void> => {
    await execute(
        `INSERT INTO otp_requests (email, otp_code, created_at, expires_at)
         VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
         ON DUPLICATE KEY UPDATE
             otp_code   = VALUES(otp_code),
             created_at = NOW(),
             expires_at = VALUES(expires_at)`,
        [email, otp, OTP_TTL_SECONDS]
    );
};

/**
 * Seconds since the last code was issued for this email, or null if none.
 * Lets the controller throttle repeated sends (and the email cost that implies).
 */
export const secondsSinceLastOtp = async (email: string): Promise<number | null> => {
    const row = await queryOne<{ age: number }>(
        'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM otp_requests WHERE email = ?',
        [email]
    );
    return row ? Number(row.age) : null;
};

export const otpResendWindowSeconds = OTP_RESEND_SECONDS;

/**
 * Check an OTP.  A correct, unexpired code is consumed (deleted) so it cannot
 * be replayed.  Returns the verified user on success, or null.
 */
export const verifyAndConsumeOtp = async (
    email: string,
    otp: string
): Promise<{ email: string; username: string; role: string; isVerified: boolean } | null> => {
    const row = await queryOne<{ email: string }>(
        `SELECT email FROM otp_requests
          WHERE email = ? AND otp_code = ? AND expires_at > NOW()`,
        [email, otp]
    );
    if (!row) return null;

    await execute('DELETE FROM otp_requests WHERE email = ?', [email]);

    // Successful verification promotes the address to a real, verified user row.
    const user = await upsertVerifiedUser(email);
    return user;
};

/**
 * Get-or-create the user for a verified email address.  Keeps usernames unique
 * by suffixing on collision (two people can share the local part of an email).
 */
export const upsertVerifiedUser = async (
    email: string
): Promise<{ email: string; username: string; role: string; isVerified: boolean }> => {
    const existing = await queryOne<{ user_id: number; username: string; role: string }>(
        'SELECT user_id, username, role FROM users WHERE email = ?',
        [email]
    );

    if (existing) {
        await execute('UPDATE users SET is_verified = 1 WHERE user_id = ?', [existing.user_id]);
        return { email, username: existing.username, role: existing.role, isVerified: true };
    }

    const base = (email.split('@')[0] || 'student').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
    let username = base || 'student';
    let suffix = 1;
    while (await queryOne('SELECT user_id FROM users WHERE username = ?', [username])) {
        username = `${base}${suffix++}`;
    }

    await execute(
        'INSERT INTO users (username, email, role, is_verified) VALUES (?, ?, ?, 1)',
        [username, email, 'student']
    );
    return { email, username, role: 'student', isVerified: true };
};
