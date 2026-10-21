import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true, maxlength: 100 },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:  { type: String, required: true },
  // 'hospital' role = hospital/clinic staff who can request/send patient records
  role:          { type: String, enum: ['patient', 'doctor', 'hospital', 'admin'], default: 'patient' },
  phone:         { type: String, trim: true },
  dateOfBirth:   Date,
  bloodType:     String,
  allergies:     [String],
  specialty:     String,
  credentials:   String,
  // Which hospital this user belongs to (doctors, hospital-staff)
  hospital:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
  // Brute-force protection
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     { type: Date },
  isActive:      { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: is account currently locked?
userSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

export default mongoose.model('User', userSchema);
