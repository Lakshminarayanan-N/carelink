import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  hospitalId: user.hospital?._id?.toString() || user.hospital?.toString(),
  hospitalName: user.hospital?.name,
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  bloodType: user.bloodType,
  allergies: user.allergies || [],
  isActive: user.isActive,
});

const JWT_SECRET = process.env.JWT_SECRET || '89b8b40ee7b5dab7b568c02322751c7720d487decb5d67418335ee90b0dd3ecce04b6fff260fe884f03b1356cb792129';

const issueToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, hospitalId: user.hospital?.toString() },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, role, hospitalId } = req.body;

    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter your name, a valid email, and a password with at least 8 characters.' });
    }

    // Only allow patient self-registration; hospital/doctor/admin created by admin
    const allowedSelfRoles = ['patient'];
    const chosenRole = allowedSelfRoles.includes(role) ? role : 'patient';

    if (await User.exists({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ message: 'An account already exists with that email.' });
    }

    let hospital = undefined;
    if (hospitalId && chosenRole !== 'patient') {
      hospital = await Hospital.findById(hospitalId).select('_id');
      if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: chosenRole,
      hospital: hospital?._id,
    });

    res.status(201).json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

// ── Login (with brute-force protection) ──────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const rawEmail = req.body.email?.toLowerCase().trim();
    const password = req.body.password || '';

    const aliases = [rawEmail];
    if (rawEmail === 'alex.morgan@carelink.org') aliases.push('alex.morgan@carelink.demo');
    if (rawEmail === 'records@northstarhealth.org') aliases.push('staff.northstar@carelink.demo');
    if (rawEmail === 'clinical@lakeviewhealth.org') aliases.push('staff.lakeview@carelink.demo');
    if (rawEmail === 'records@apexhealth.org') aliases.push('staff.apex@carelink.demo');
    if (rawEmail === 'intake@stjudewellness.org') aliases.push('staff.stjude@carelink.demo');
    if (rawEmail === 'dr.chen@northstarhealth.org') aliases.push('maya.chen@carelink.demo');
    if (rawEmail === 'dr.nair@lakeviewhealth.org') aliases.push('priya.nair@carelink.demo');
    if (rawEmail === 'admin@carelink.org') aliases.push('admin@carelink.com');

    const user = await User.findOne({ email: { $in: aliases } }).populate('hospital', 'name');
    if (!user) {
      // Generic message — don't reveal whether email exists
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }

    // Account disabled
    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated. Contact your administrator.' });
    }

    // Account locked?
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Increment attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.loginAttempts = 0;
        await user.save();
        return res.status(429).json({ message: `Too many failed attempts. Account locked for 15 minutes.` });
      }
      await user.save();
      const remaining = MAX_ATTEMPTS - user.loginAttempts;
      return res.status(401).json({ message: `Email or password is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.` });
    }

    // Success — reset lockout counters
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

// ── Current user ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  await req.user.populate('hospital', 'name');
  res.json({ user: safeUser(req.user) });
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'dateOfBirth', 'bloodType', 'allergies'];
    for (const key of allowed) if (key in req.body) req.user[key] = req.body[key];
    // Password change
    if (req.body.newPassword) {
      if (!req.body.currentPassword) return res.status(400).json({ message: 'Enter your current password to set a new one.' });
      const ok = await bcrypt.compare(req.body.currentPassword, req.user.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Current password is incorrect.' });
      if (req.body.newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
      req.user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    }
    await req.user.save();
    await req.user.populate('hospital', 'name');
    res.json({ user: safeUser(req.user) });
  } catch (error) { next(error); }
});

export default router;
