import mongoose from 'mongoose';

const recordShareSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  targetHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'revoked'], default: 'requested', index: true },
  approvedAt: Date,
  rejectedAt: Date,
  revokedAt: Date,
  lastImportedAt: Date,
  lastImportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

recordShareSchema.index({ patient: 1, sourceHospital: 1, targetHospital: 1, status: 1 });

export default mongoose.model('RecordShare', recordShareSchema);
