import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Hospital from './src/models/Hospital.js';
import MedicalRecord from './src/models/MedicalRecord.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env before seeding.');
await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });

console.log('Seeding hospitals and clinical entities...');
const hospitalNames = ['Northstar General Hospital', 'Lakeview Medical Center', 'Apex Health Institute'];
for (const name of hospitalNames) {
  await Hospital.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}
const [northstar, lakeview, apex] = await Promise.all(hospitalNames.map((name) => Hospital.findOne({ name })));

const passwordHash = await bcrypt.hash('CareLink123!', 12);

// 1. Super Admin accounts
for (const email of ['admin@carelink.org', 'admin@carelink.com']) {
  await User.updateOne(
    { email },
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
}

// 2. Hospital / Clinic Staff Accounts
for (const email of ['records@northstarhealth.org', 'staff.northstar@carelink.demo']) {
  await User.updateOne(
    { email },
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
}

for (const email of ['clinical@lakeviewhealth.org', 'staff.lakeview@carelink.demo']) {
  await User.updateOne(
    { email },
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
}

// 3. Clinicians
const doctors = [
  { name: 'Dr. Maya Chen', email: 'dr.chen@northstarhealth.org', altEmail: 'maya.chen@carelink.demo', specialty: 'Cardiology', credentials: 'MD, FACC', hospital: northstar.id },
  { name: 'Dr. James Wilson', email: 'dr.wilson@northstarhealth.org', altEmail: 'james.wilson@carelink.demo', specialty: 'Primary Care', credentials: 'MD', hospital: northstar.id },
  { name: 'Dr. Priya Nair', email: 'dr.nair@lakeviewhealth.org', altEmail: 'priya.nair@carelink.demo', specialty: 'Dermatology', credentials: 'MD, FAAD', hospital: lakeview.id },
  { name: 'Dr. Sofia Martinez', email: 'dr.martinez@lakeviewhealth.org', altEmail: 'sofia.martinez@carelink.demo', specialty: 'Pediatrics', credentials: 'MD, FAAP', hospital: lakeview.id },
];
for (const doc of doctors) {
  const { hospital, altEmail, ...profile } = doc;
  for (const mail of [doc.email, altEmail]) {
    await User.updateOne(
      { email: mail },
      {
        $set: { hospital, role: 'doctor', isActive: true, loginAttempts: 0 },
        $setOnInsert: { ...profile, email: mail, passwordHash },
      },
      { upsert: true }
    );
  }
}

// 4. Patient accounts
for (const email of ['alex.morgan@carelink.org', 'alex.morgan@carelink.demo']) {
  await User.updateOne(
    { email },
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
}

const patient1 = await User.findOne({ email: 'alex.morgan@carelink.org' });
const patient2 = await User.findOne({ email: 'alex.morgan@carelink.demo' });
const doctorUsers = await User.find({ role: 'doctor' });
const docMap = new Map(doctorUsers.map(d => [d.email, d._id]));
const mayaId = docMap.get('dr.chen@northstarhealth.org') || docMap.get('maya.chen@carelink.demo');
const wilsonId = docMap.get('dr.wilson@northstarhealth.org') || docMap.get('james.wilson@carelink.demo');
const nairId = docMap.get('dr.nair@lakeviewhealth.org') || docMap.get('priya.nair@carelink.demo');

// 5. Medical records for Northstar
const northstarRecords = [
  { title: 'Comprehensive Cardiology Assessment', category: 'Visit summary', summary: 'Resting ECG normal, sinus rhythm, blood pressure 118/76 mmHg. Mild tachycardia on exertion.', doctor: mayaId, recordedAt: new Date('2026-10-10T14:30:00Z') },
  { title: 'Lipid Panel & Metabolic Screen', category: 'Lab result', summary: 'Total cholesterol 182 mg/dL, HDL 54 mg/dL, LDL 106 mg/dL, Triglycerides 110 mg/dL. Fasting glucose 92 mg/dL.', doctor: mayaId, recordedAt: new Date('2026-09-28T09:15:00Z') },
  { title: 'Daily Low-Dose Aspirin (81mg)', category: 'Prescription', summary: 'Cardioprotective therapy; take one tablet daily with morning meal. Monitor for bruising.', doctor: wilsonId, recordedAt: new Date('2026-09-12T11:00:00Z') },
];

for (const p of [patient1, patient2].filter(Boolean)) {
  for (const rec of northstarRecords) {
    await MedicalRecord.updateOne(
      { patient: p._id, hospital: northstar._id, title: rec.title },
      { $set: { ...rec, patient: p._id, hospital: northstar._id } },
      { upsert: true }
    );
  }
}

// 6. Medical records for Lakeview (isolated to Lakeview)
const lakeviewRecords = [
  { title: 'Dermatology Skin Biopsy Consultation', category: 'Visit summary', summary: 'Benign seborrheic keratosis on left shoulder excised. Margins clear, wound healed cleanly.', doctor: nairId, recordedAt: new Date('2026-08-15T10:00:00Z') },
];

for (const p of [patient1, patient2].filter(Boolean)) {
  for (const rec of lakeviewRecords) {
    await MedicalRecord.updateOne(
      { patient: p._id, hospital: lakeview._id, title: rec.title },
      { $set: { ...rec, patient: p._id, hospital: lakeview._id } },
      { upsert: true }
    );
  }
}

console.log('✅ Production initialization complete!');
console.log('Active verified accounts:');
console.log('1. Patient:   alex.morgan@carelink.org');
console.log('2. Hospital 1 (Northstar): records@northstarhealth.org');
console.log('3. Hospital 2 (Lakeview):  clinical@lakeviewhealth.org');
console.log('4. Doctor:    dr.chen@northstarhealth.org');
console.log('5. Admin:     admin@carelink.org');

await mongoose.disconnect();
