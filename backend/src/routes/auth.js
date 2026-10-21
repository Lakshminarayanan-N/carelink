import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const safeUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospital?.toString(), phone: user.phone, dateOfBirth: user.dateOfBirth, bloodType: user.bloodType, allergies: user.allergies || [] });
const issueToken = (user) => jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter your name, a valid email, and a password with at least 8 characters.' });
    }
    if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account already exists with that email.' });
    const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 12), role: 'patient' });
    res.status(201).json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
    if (!user || !await bcrypt.compare(req.body.password || '', user.passwordHash)) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: safeUser(req.user) }));
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'dateOfBirth', 'bloodType', 'allergies'];
    for (const key of allowed) if (key in req.body) req.user[key] = req.body[key];
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  } catch (error) { next(error); }
});

export default router;
