import { Request, Response } from 'express';
import {
    upsertOtp,
    secondsSinceLastOtp,
    otpResendWindowSeconds,
    verifyAndConsumeOtp,
    authenticateUser,
    findUserByUsernameOrEmail,
    createAccount
} from '../repositories/authRepository.js';
import { sendEmail } from '../utils/email.js';

/**
 * Whether the server can actually send email right now.  When SMTP is absent the
 * OTP flow is disabled (returns 503) so a demo deploy without SMTP does not crash.
 */
// `reason` is optional on the success case (rather than a discriminated union)
// so `smtp.reason` type-checks under both server/tsconfig.json (strict) and the
// root tsconfig, which turns strictNullChecks off and so cannot narrow on `ok`.
const smtpReady = (): { ok: boolean; reason?: string } => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) return { ok: false, reason: 'SMTP not configured' };
    return { ok: true };
};

/**
 * Optional university-domain restriction. Set ALLOWED_EMAIL_DOMAIN (e.g.
 * "vitstudent.ac.in") to require it; leave unset and any address is accepted.
 */
const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
const domainAllowed = (email: string) =>
    !allowedDomain || email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`);

// @desc    Send OTP to email (requires SMTP)
// @route   POST /api/auth/otp
export const sendOtp = async (req: Request, res: Response) => {
    const smtp = smtpReady();
    if (!smtp.ok) {
        res.status(503).json({ message: `OTP unavailable: ${smtp.reason}. Use /api/auth/login for the demo account.` });
        return;
    }

    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: 'Email is required' });
            return;
        }
        if (!domainAllowed(email)) {
            res.status(400).json({ message: `Please use a valid @${allowedDomain} email address` });
            return;
        }

        // Throttle: don't burn an email if one was just requested for this address.
        const age = await secondsSinceLastOtp(email);
        if (age !== null && age < otpResendWindowSeconds) {
            res.status(429).json({
                message: `Please wait ${otpResendWindowSeconds - age}s before requesting another code`
            });
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await upsertOtp(email, otp);
        await sendEmail(email, 'UniArchive Verification Code', `Your verification code is: ${otp}`);

        res.json({ message: 'OTP sent successfully' });
    } catch (error: any) {
        console.error(error);
        // Don't leak provider details (e.g. SMTP credentials) to the client.
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify
export const verifyOtp = async (req: Request, res: Response) => {
    const smtp = smtpReady();
    if (!smtp.ok) {
        res.status(503).json({ success: false, message: `OTP unavailable: ${smtp.reason}. Use /api/auth/login for the demo account.` });
        return;
    }

    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({ success: false, message: 'Email and code are required' });
            return;
        }

        const user = await verifyAndConsumeOtp(email, otp);

        if (user) {
            res.json({ success: true, message: 'Verification successful', user });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// @desc    Create a normal account (no email / OTP round-trip)
// @route   POST /api/auth/signup
//   Body: { username, email, password }
//   The account is verified immediately, so the client can treat a 201 like a
//   successful login (the response carries the same public User shape).
export const signup = async (req: Request, res: Response) => {
    try {
        const username = String(req.body?.username ?? '').trim();
        const email = String(req.body?.email ?? '').trim().toLowerCase();
        const password = String(req.body?.password ?? '');

        if (!username || !email || !password) {
            res.status(400).json({ success: false, message: 'Username, email and password are required' });
            return;
        }
        if (!USERNAME_RE.test(username)) {
            res.status(400).json({
                success: false,
                message: 'Username must be 3-30 characters and use only letters, numbers, dots, underscores or hyphens'
            });
            return;
        }
        if (!EMAIL_RE.test(email) || !domainAllowed(email)) {
            res.status(400).json({
                success: false,
                message: allowedDomain
                    ? `Please use a valid @${allowedDomain} email address`
                    : 'Please enter a valid email address'
            });
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({
                success: false,
                message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            });
            return;
        }

        // Friendly conflict messages before hitting the DB unique keys.
        const existing = await findUserByUsernameOrEmail(username, email);
        if (existing) {
            const usernameTaken = existing.username.toLowerCase() === username.toLowerCase();
            res.status(409).json({
                success: false,
                message: usernameTaken ? 'That username is already taken' : 'An account with that email already exists'
            });
            return;
        }

        const user = await createAccount(username, email, password);
        res.status(201).json({ success: true, message: 'Account created', user });
    } catch (error: any) {
        // Race between the pre-check and the INSERT still lands here.
        if (error?.code === 'ER_DUP_ENTRY') {
            const field = String(error.message).includes('uq_users_username') ? 'username' : 'email';
            res.status(409).json({ success: false, message: `That ${field} is already registered` });
            return;
        }
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
};

// @desc    Password login for the demo account
// @route   POST /api/auth/login
//   Body: { username, password }
//   Demo credential:  admin123  /  scse
//   Returns the same public User shape that /api/auth/verify returns, so the
//   frontend login overlay can switch between OTP and password without changing
//   onLogin(...).
export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ success: false, message: 'Username and password are required' });
            return;
        }

        const user = await authenticateUser(String(username), String(password));
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
            return;
        }

        res.json({ success: true, message: 'Login successful', user });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
