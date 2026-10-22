import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
  date: { type: Date, required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  type: {
    type: String,
    enum: ['In person', 'Video visit', 'Consultation', 'Routine Checkup', 'Follow-up', 'Emergency'],
    default: 'In person'
  },
  status: {
    type: String,
    enum: ['upcoming', 'confirmed', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, { timestamps: true });

export default mongoose.model('Appointment', appointmentSchema);

