import express from 'express';
import { sendOtp, verifyOtp, login, signup } from '../controllers/authController.js';

const router = express.Router();

router.post('/otp', sendOtp);
router.post('/verify', verifyOtp);
router.post('/login', login);
router.post('/signup', signup);

export default router;
