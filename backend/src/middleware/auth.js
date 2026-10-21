import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || '89b8b40ee7b5dab7b568c02322751c7720d487decb5d67418335ee90b0dd3ecce04b6fff260fe884f03b1356cb792129';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(payload.sub).select('-passwordHash -loginAttempts -lockUntil');
    if (!req.user) return res.status(401).json({ message: 'Your session is no longer valid.' });
    if (!req.user.isActive) return res.status(403).json({ message: 'This account has been deactivated.' });
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'You do not have permission to perform this action.' });
}

// Middleware: hospital staff can only access their own hospital's data
export function requireSameHospital() {
  return (req, res, next) => {
    const user = req.user;
    if (user.role === 'admin') return next(); // admins bypass
    if (!user.hospital) return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
    next();
  };
}
