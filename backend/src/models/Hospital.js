import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 150 }
}, { timestamps: true });

export default mongoose.model('Hospital', hospitalSchema);
