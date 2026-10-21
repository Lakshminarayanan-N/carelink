import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Hospital from './src/models/Hospital.js';
import MedicalRecord from './src/models/MedicalRecord.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env before seeding.');
await mongoose.connect(process.env.MONGODB_URI);
const hospitalNames = ['Northstar General Hospital', 'Lakeview Medical Center'];
for (const name of hospitalNames) {
  await Hospital.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}
const [northstar, lakeview] = await Promise.all(hospitalNames.map((name) => Hospital.findOne({ name })));

const doctors = [
  { name: 'Maya Chen', email: 'maya.chen@carelink.demo', specialty: 'Cardiology', credentials: 'MD, FACC', hospital: northstar.id },
  { name: 'James Wilson', email: 'james.wilson@carelink.demo', specialty: 'Primary care', credentials: 'MD', hospital: northstar.id },
  { name: 'Priya Nair', email: 'priya.nair@carelink.demo', specialty: 'Dermatology', credentials: 'MD, FAAD', hospital: lakeview.id },
  { name: 'Sofia Martinez', email: 'sofia.martinez@carelink.demo', specialty: 'Pediatrics', credentials: 'MD, FAAP', hospital: lakeview.id }
];
for (const doctor of doctors) {
  const { hospital, ...profile } = doctor;
  await User.updateOne(
    { email: doctor.email },
    { $set: { hospital }, $setOnInsert: { ...profile, role: 'doctor', passwordHash: await bcrypt.hash('CareLinkDemo123!', 12) } },
    { upsert: true }
  );
}

const patientEmail = 'alex.morgan@carelink.demo';
await User.updateOne(
  { email: patientEmail },
  { $setOnInsert: { name: 'Alex Morgan', email: patientEmail, role: 'patient', passwordHash: await bcrypt.hash('CareLinkDemo123!', 12) } },
  { upsert: true }
);
const patient = await User.findOne({ email: patientEmail }).select('_id');
const demoClinicians = await User.find({ email: { $in: doctors.map((doctor) => doctor.email) } }).select('_id email');
const clinicianIds = new Map(demoClinicians.map((doctor) => [doctor.email, doctor.id]));
const demoRecords = [
  { title: 'Annual wellness visit', category: 'Visit summary', summary: 'Routine annual check-up.', doctor: doctors[0], recordedAt: new Date('2026-10-09T16:00:00Z') },
  { title: 'Complete blood count', category: 'Lab result', summary: 'Sample laboratory result for the CareLink demonstration.', doctor: doctors[0], recordedAt: new Date('2026-09-28T14:00:00Z') },
  { title: 'Vitamin D supplement', category: 'Prescription', summary: 'Sample prescription for the CareLink demonstration.', doctor: doctors[1], recordedAt: new Date('2026-09-14T11:00:00Z') }
];
for (const record of demoRecords) {
  await MedicalRecord.updateOne(
    { patient: patient.id, hospital: northstar.id, title: record.title },
    { $setOnInsert: { ...record, patient: patient.id, doctor: clinicianIds.get(record.doctor.email), hospital: northstar.id } },
    { upsert: true }
  );
}

console.log('Demo hospitals and clinicians are ready.');
console.log('Demo patient: alex.morgan@carelink.demo / CareLinkDemo123!');
console.log('Demo clinician password: CareLinkDemo123!');
await mongoose.disconnect();
