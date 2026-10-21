import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Hospital from './src/models/Hospital.js';
import MedicalRecord from './src/models/MedicalRecord.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env before seeding.');
await mongoose.connect(process.env.MONGODB_URI);

console.log('Seeding hospitals...');
const hospitalNames = ['Northstar General Hospital', 'Lakeview Medical Center', 'Apex Health Institute'];
for (const name of hospitalNames) {
  await Hospital.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}
const [northstar, lakeview, apex] = await Promise.all(hospitalNames.map((name) => Hospital.findOne({ name })));

const passwordHash = await bcrypt.hash('CareLink123!', 12);

// 1. Admin account
await User.updateOne(
  { email: 'admin@carelink.com' },
  {
    $set: {
      name: 'System Administrator',
      role: 'admin',
      passwordHash,
      isActive: true,
      loginAttempts: 0,
    },
  },
  { upsert: true }
);

// 2. Hospital / Clinic Staff Accounts
await User.updateOne(
  { email: 'staff.northstar@carelink.demo' },
  {
    $set: {
      name: 'Northstar Records Dept',
      role: 'hospital',
      hospital: northstar.id,
      passwordHash,
      isActive: true,
      loginAttempts: 0,
    },
  },
  { upsert: true }
);

await User.updateOne(
  { email: 'staff.lakeview@carelink.demo' },
  {
    $set: {
      name: 'Lakeview Clinical Office',
      role: 'hospital',
      hospital: lakeview.id,
      passwordHash,
      isActive: true,
      loginAttempts: 0,
    },
  },
  { upsert: true }
);

// 3. Doctors
const doctors = [
  { name: 'Dr. Maya Chen', email: 'maya.chen@carelink.demo', specialty: 'Cardiology', credentials: 'MD, FACC', hospital: northstar.id },
  { name: 'Dr. James Wilson', email: 'james.wilson@carelink.demo', specialty: 'Primary Care', credentials: 'MD', hospital: northstar.id },
  { name: 'Dr. Priya Nair', email: 'priya.nair@carelink.demo', specialty: 'Dermatology', credentials: 'MD, FAAD', hospital: lakeview.id },
  { name: 'Dr. Sofia Martinez', email: 'sofia.martinez@carelink.demo', specialty: 'Pediatrics', credentials: 'MD, FAAP', hospital: lakeview.id },
];
for (const doctor of doctors) {
  const { hospital, ...profile } = doctor;
  await User.updateOne(
    { email: doctor.email },
    {
      $set: { hospital, role: 'doctor', isActive: true, loginAttempts: 0 },
      $setOnInsert: { ...profile, passwordHash },
    },
    { upsert: true }
  );
}

// 4. Patient accounts
await User.updateOne(
  { email: 'alex.morgan@carelink.demo' },
  {
    $set: {
      name: 'Alex Morgan',
      role: 'patient',
      phone: '+1 (555) 234-5678',
      bloodType: 'O+',
      allergies: ['Penicillin', 'Peanuts'],
      dateOfBirth: new Date('1992-06-14'),
      passwordHash,
      isActive: true,
      loginAttempts: 0,
    },
  },
  { upsert: true }
);

const patient = await User.findOne({ email: 'alex.morgan@carelink.demo' });
const doctorUsers = await User.find({ email: { $in: doctors.map(d => d.email) } });
const docMap = new Map(doctorUsers.map(d => [d.email, d._id]));

// 5. Sample medical records for Northstar
const northstarRecords = [
  { title: 'Comprehensive Cardiology Assessment', category: 'Visit summary', summary: 'Resting ECG normal, sinus rhythm, blood pressure 118/76 mmHg. Mild tachycardia on exertion.', doctor: docMap.get('maya.chen@carelink.demo'), recordedAt: new Date('2026-10-10T14:30:00Z') },
  { title: 'Lipid Panel & Metabolic Screen', category: 'Lab result', summary: 'Total cholesterol 182 mg/dL, HDL 54 mg/dL, LDL 106 mg/dL, Triglycerides 110 mg/dL. Fasting glucose 92 mg/dL.', doctor: docMap.get('maya.chen@carelink.demo'), recordedAt: new Date('2026-09-28T09:15:00Z') },
  { title: 'Daily Low-Dose Aspirin (81mg)', category: 'Prescription', summary: 'Cardioprotective therapy; take one tablet daily with morning meal. Monitor for bruising.', doctor: docMap.get('james.wilson@carelink.demo'), recordedAt: new Date('2026-09-12T11:00:00Z') },
];

for (const rec of northstarRecords) {
  await MedicalRecord.updateOne(
    { patient: patient._id, hospital: northstar._id, title: rec.title },
    { $set: { ...rec, patient: patient._id, hospital: northstar._id } },
    { upsert: true }
  );
}

// 6. Sample medical record for Lakeview (isolated to Lakeview)
const lakeviewRecords = [
  { title: 'Dermatology Skin Biopsy Consultation', category: 'Visit summary', summary: 'Benign seborrheic keratosis on left shoulder excised. Margins clear, wound healed cleanly.', doctor: docMap.get('priya.nair@carelink.demo'), recordedAt: new Date('2026-08-15T10:00:00Z') },
];

for (const rec of lakeviewRecords) {
  await MedicalRecord.updateOne(
    { patient: patient._id, hospital: lakeview._id, title: rec.title },
    { $set: { ...rec, patient: patient._id, hospital: lakeview._id } },
    { upsert: true }
  );
}

console.log('✅ Seeding complete!');
console.log('Accounts available (password for all: CareLink123!):');
console.log('1. Patient:   alex.morgan@carelink.demo');
console.log('2. Hospital 1 (Northstar): staff.northstar@carelink.demo');
console.log('3. Hospital 2 (Lakeview):  staff.lakeview@carelink.demo');
console.log('4. Doctor:    maya.chen@carelink.demo');
console.log('5. Admin:     admin@carelink.com');

await mongoose.disconnect();
