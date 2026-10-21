import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Visit summary', 'Lab result', 'Prescription', 'Imaging', 'Other'], default: 'Other' },
  summary: { type: String, trim: true, maxlength: 2000 },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
  sourceHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  sourceRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
  importedThrough: { type: mongoose.Schema.Types.ObjectId, ref: 'RecordShare' },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recordedAt: { type: Date, default: Date.now }
}, { timestamps: true });

recordSchema.index({ patient: 1, hospital: 1, recordedAt: -1 });
recordSchema.index({ hospital: 1, sourceRecord: 1 }, {
  unique: true,
  partialFilterExpression: { sourceRecord: { $type: 'objectId' } }
});

export default mongoose.model('MedicalRecord', recordSchema);
