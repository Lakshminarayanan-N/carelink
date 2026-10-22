import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Hospital from './src/models/Hospital.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import Appointment from './src/models/Appointment.js';
import RecordShare from './src/models/RecordShare.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env before seeding.');
await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });

console.log('Seeding hospitals and clinical entities...');
const hospitalNames = [
  'Northstar General Hospital',
  'Lakeview Medical Center',
  'Apex Health Institute',
  'St. Jude Wellness Center'
];

for (const name of hospitalNames) {
  await Hospital.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}

const [northstar, lakeview, apex, stjude] = await Promise.all(
  hospitalNames.map((name) => Hospital.findOne({ name }))
);

const passwordHash = await bcrypt.hash('CareLink123!', 12);

// ── 1. Super Admin Accounts ───────────────────────────────────────────────────
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

// ── 2. Hospital / Clinical Staff Accounts ─────────────────────────────────────
const hospitalStaff = [
  { name: 'Northstar Records Dept', email: 'records@northstarhealth.org', altEmail: 'staff.northstar@carelink.demo', hospital: northstar._id },
  { name: 'Lakeview Clinical Office', email: 'clinical@lakeviewhealth.org', altEmail: 'staff.lakeview@carelink.demo', hospital: lakeview._id },
  { name: 'Apex Health Records Dept', email: 'records@apexhealth.org', altEmail: 'staff.apex@carelink.demo', hospital: apex._id },
  { name: 'St. Jude Clinical Intake', email: 'intake@stjudewellness.org', altEmail: 'staff.stjude@carelink.demo', hospital: stjude._id },
];

for (const staff of hospitalStaff) {
  for (const mail of [staff.email, staff.altEmail].filter(Boolean)) {
    await User.updateOne(
      { email: mail },
      {
        $set: {
          name: staff.name,
          role: 'hospital',
          hospital: staff.hospital,
          passwordHash,
          isActive: true,
          loginAttempts: 0,
        },
      },
      { upsert: true }
    );
  }
}

// ── 3. Clinicians / Doctors ───────────────────────────────────────────────────
const doctorsData = [
  // Northstar
  { name: 'Dr. Maya Chen', email: 'dr.chen@northstarhealth.org', altEmail: 'maya.chen@carelink.demo', specialty: 'Cardiology', credentials: 'MD, FACC', phone: '+1 (555) 301-4401', hospital: northstar._id },
  { name: 'Dr. James Wilson', email: 'dr.wilson@northstarhealth.org', altEmail: 'james.wilson@carelink.demo', specialty: 'Internal Medicine', credentials: 'MD', phone: '+1 (555) 301-4402', hospital: northstar._id },
  { name: 'Dr. Elena Rostova', email: 'dr.rostova@northstarhealth.org', altEmail: 'elena.rostova@carelink.demo', specialty: 'Pulmonology', credentials: 'MD, FCCP', phone: '+1 (555) 301-4403', hospital: northstar._id },

  // Lakeview
  { name: 'Dr. Priya Nair', email: 'dr.nair@lakeviewhealth.org', altEmail: 'priya.nair@carelink.demo', specialty: 'Dermatology', credentials: 'MD, FAAD', phone: '+1 (555) 402-5501', hospital: lakeview._id },
  { name: 'Dr. Sofia Martinez', email: 'dr.martinez@lakeviewhealth.org', altEmail: 'sofia.martinez@carelink.demo', specialty: 'Pediatrics', credentials: 'MD, FAAP', phone: '+1 (555) 402-5502', hospital: lakeview._id },
  { name: 'Dr. Marcus Vance', email: 'dr.vance@lakeviewhealth.org', altEmail: 'marcus.vance@carelink.demo', specialty: 'Family Medicine', credentials: 'MD', phone: '+1 (555) 402-5503', hospital: lakeview._id },

  // Apex
  { name: 'Dr. Aris Thorne', email: 'dr.thorne@apexhealth.org', altEmail: 'aris.thorne@carelink.demo', specialty: 'Neurology', credentials: 'MD, PhD', phone: '+1 (555) 503-6601', hospital: apex._id },
  { name: 'Dr. Leanne Zhao', email: 'dr.zhao@apexhealth.org', altEmail: 'leanne.zhao@carelink.demo', specialty: 'Oncology', credentials: 'MD', phone: '+1 (555) 503-6602', hospital: apex._id },

  // St. Jude
  { name: 'Dr. Gabriel Ortiz', email: 'dr.ortiz@stjudewellness.org', altEmail: 'gabriel.ortiz@carelink.demo', specialty: 'Orthopedics', credentials: 'MD, FAAOS', phone: '+1 (555) 604-7701', hospital: stjude._id },
  { name: 'Dr. Chloe Bennett', email: 'dr.bennett@stjudewellness.org', altEmail: 'chloe.bennett@carelink.demo', specialty: 'Endocrinology', credentials: 'MD', phone: '+1 (555) 604-7702', hospital: stjude._id },
];

for (const doc of doctorsData) {
  const { hospital, altEmail, phone, specialty, credentials, name } = doc;
  for (const mail of [doc.email, altEmail].filter(Boolean)) {
    await User.updateOne(
      { email: mail },
      {
        $set: {
          name,
          role: 'doctor',
          specialty,
          credentials,
          phone,
          hospital,
          passwordHash,
          isActive: true,
          loginAttempts: 0,
        },
      },
      { upsert: true }
    );
  }
}

// ── 4. Patients ───────────────────────────────────────────────────────────────
const patientsData = [
  {
    name: 'Alex Morgan',
    email: 'alex.morgan@carelink.org',
    altEmail: 'alex.morgan@carelink.demo',
    phone: '+1 (555) 234-5678',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Peanuts'],
    dateOfBirth: new Date('1992-06-14'),
  },
  {
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@carelink.org',
    altEmail: 'sarah.jenkins@carelink.demo',
    phone: '+1 (555) 876-5432',
    bloodType: 'A+',
    allergies: ['Sulfa drugs', 'Aspirin'],
    dateOfBirth: new Date('1988-11-20'),
  },
  {
    name: 'David Kim',
    email: 'david.kim@carelink.org',
    altEmail: 'david.kim@carelink.demo',
    phone: '+1 (555) 345-6789',
    bloodType: 'B+',
    allergies: ['Latex'],
    dateOfBirth: new Date('1995-03-08'),
  },
  {
    name: 'Maria Santos',
    email: 'maria.santos@carelink.org',
    altEmail: 'maria.santos@carelink.demo',
    phone: '+1 (555) 987-6543',
    bloodType: 'AB-',
    allergies: [],
    dateOfBirth: new Date('2001-08-25'),
  },
];

for (const p of patientsData) {
  const { altEmail, ...info } = p;
  for (const mail of [p.email, altEmail].filter(Boolean)) {
    await User.updateOne(
      { email: mail },
      {
        $set: {
          ...info,
          email: mail,
          role: 'patient',
          passwordHash,
          isActive: true,
          loginAttempts: 0,
        },
      },
      { upsert: true }
    );
  }
}

// Fetch references
const patientAlex = await User.findOne({ email: 'alex.morgan@carelink.org' });
const patientSarah = await User.findOne({ email: 'sarah.jenkins@carelink.org' });
const patientDavid = await User.findOne({ email: 'david.kim@carelink.org' });
const patientMaria = await User.findOne({ email: 'maria.santos@carelink.org' });

const docUsers = await User.find({ role: 'doctor' });
const docMap = new Map(docUsers.map(d => [d.email, d._id]));

const mayaId = docMap.get('dr.chen@northstarhealth.org');
const wilsonId = docMap.get('dr.wilson@northstarhealth.org');
const rostovaId = docMap.get('dr.rostova@northstarhealth.org');

const nairId = docMap.get('dr.nair@lakeviewhealth.org');
const martinezId = docMap.get('dr.martinez@lakeviewhealth.org');
const vanceId = docMap.get('dr.vance@lakeviewhealth.org');

const thorneId = docMap.get('dr.thorne@apexhealth.org');
const zhaoId = docMap.get('dr.zhao@apexhealth.org');

const ortizId = docMap.get('dr.ortiz@stjudewellness.org');
const bennettId = docMap.get('dr.bennett@stjudewellness.org');

// ── 5. Medical Records Across Hospitals ───────────────────────────────────────
const sampleRecords = [
  // Northstar Records (Cardiology & Internal Med)
  {
    patient: patientAlex._id,
    hospital: northstar._id,
    doctor: mayaId,
    title: 'Comprehensive Cardiology Assessment & ECG',
    category: 'Visit summary',
    summary: 'Sinus rhythm confirmed, resting blood pressure 118/76 mmHg. Mild sinus tachycardia on exertion. Recommended 30 mins cardio daily and follow-up in 6 months.',
    recordedAt: new Date('2026-10-10T14:30:00Z'),
  },
  {
    patient: patientAlex._id,
    hospital: northstar._id,
    doctor: mayaId,
    title: 'Lipid Panel & Complete Metabolic Screen',
    category: 'Lab result',
    summary: 'Total cholesterol 182 mg/dL, HDL 54 mg/dL, LDL 106 mg/dL, Triglycerides 110 mg/dL. Fasting glucose 92 mg/dL. Normal renal and hepatic parameters.',
    recordedAt: new Date('2026-09-28T09:15:00Z'),
  },
  {
    patient: patientAlex._id,
    hospital: northstar._id,
    doctor: wilsonId,
    title: 'Daily Low-Dose Aspirin (81mg)',
    category: 'Prescription',
    summary: 'Cardioprotective maintenance therapy; take one tablet daily with morning meal. Advised on GI precautions.',
    recordedAt: new Date('2026-09-12T11:00:00Z'),
  },
  {
    patient: patientSarah._id,
    hospital: northstar._id,
    doctor: rostovaId,
    title: 'Pulmonary Function Test (Spirometry)',
    category: 'Lab result',
    summary: 'FEV1/FVC ratio 78%. Mild reversible airway reactivity noted. Responsive to short-acting bronchodilators.',
    recordedAt: new Date('2026-10-02T13:45:00Z'),
  },

  // Lakeview Records (Dermatology, Pediatrics & Family)
  {
    patient: patientAlex._id,
    hospital: lakeview._id,
    doctor: nairId,
    title: 'Dermatology Skin Biopsy Consultation',
    category: 'Visit summary',
    summary: 'Benign seborrheic keratosis on left shoulder excised. Margins clear, histopathology benign. Sutures removed, wound clean.',
    recordedAt: new Date('2026-08-15T10:00:00Z'),
  },
  {
    patient: patientSarah._id,
    hospital: lakeview._id,
    doctor: nairId,
    title: 'Topical Desonide Cream 0.05%',
    category: 'Prescription',
    summary: 'Apply thin layer to affected erythematous patches twice daily for 7 days. Avoid ocular area.',
    recordedAt: new Date('2026-09-19T15:20:00Z'),
  },
  {
    patient: patientMaria._id,
    hospital: lakeview._id,
    doctor: martinezId,
    title: 'Annual Adolescent Wellness & Immunization Review',
    category: 'Visit summary',
    summary: 'Growth curve 55th percentile. Tdap booster administered without adverse reaction. Vision 20/20 bilateral.',
    recordedAt: new Date('2026-10-05T11:30:00Z'),
  },
  {
    patient: patientDavid._id,
    hospital: lakeview._id,
    doctor: vanceId,
    title: 'Seasonal Allergy & Environmental IgE Panel',
    category: 'Lab result',
    summary: 'Elevated IgE for cedar and ragweed pollen. Negative for mold spores. Antihistamine regimen recommended.',
    recordedAt: new Date('2026-09-04T16:00:00Z'),
  },

  // Apex Health Institute Records (Neurology & Advanced)
  {
    patient: patientAlex._id,
    hospital: apex._id,
    doctor: thorneId,
    title: 'Cranial MRI Diffusion & Flair Imaging',
    category: 'Lab result',
    summary: 'High-resolution 3T MRI of the brain. No intracranial mass, acute ischemia, or vascular malformation identified. Intact ventricular system.',
    recordedAt: new Date('2026-07-22T08:30:00Z'),
  },
  {
    patient: patientDavid._id,
    hospital: apex._id,
    doctor: thorneId,
    title: 'Neurological Reflex & Nerve Conduction Study',
    category: 'Visit summary',
    summary: 'Symmetric upper and lower extremity motor responses. Normal sensory latency. No peripheral neuropathy indicated.',
    recordedAt: new Date('2026-09-30T10:15:00Z'),
  },
  {
    patient: patientSarah._id,
    hospital: apex._id,
    doctor: zhaoId,
    title: 'Preventive Oncology Biomarker Screening',
    category: 'Lab result',
    summary: 'Comprehensive biomarker screen negative for genetic variants. Regular routine mammography and screening schedule maintained.',
    recordedAt: new Date('2026-08-11T14:00:00Z'),
  },

  // St. Jude Wellness Center Records (Orthopedics & Physical Health)
  {
    patient: patientDavid._id,
    hospital: stjude._id,
    doctor: ortizId,
    title: 'Right Knee Arthroscopy & Meniscus Repair Summary',
    category: 'Visit summary',
    summary: 'Post-operative 6-week review. Full extension achieved, flexion to 125 degrees. Minimal effusion. Cleared for light weight-bearing exercise.',
    recordedAt: new Date('2026-09-15T09:45:00Z'),
  },
  {
    patient: patientDavid._id,
    hospital: stjude._id,
    doctor: ortizId,
    title: 'Meloxicam 15mg Anti-Inflammatory',
    category: 'Prescription',
    summary: 'Take once daily with food for joint inflammation. Monitor gastric tolerability.',
    recordedAt: new Date('2026-09-15T10:00:00Z'),
  },
  {
    patient: patientMaria._id,
    hospital: stjude._id,
    doctor: bennettId,
    title: 'Hemoglobin A1c & Thyroid Stimulating Hormone (TSH)',
    category: 'Lab result',
    summary: 'HbA1c 5.3% (normal glycemic range). TSH 1.85 uIU/mL (euthyroid). Normal metabolic baseline.',
    recordedAt: new Date('2026-10-12T08:00:00Z'),
  },
];

for (const rec of sampleRecords) {
  await MedicalRecord.updateOne(
    { patient: rec.patient, hospital: rec.hospital, title: rec.title },
    { $set: rec },
    { upsert: true }
  );
}

// ── 6. Seeding Comprehensive Appointments (Hospital Schedules) ────────────────
const sampleAppointments = [
  // Northstar General Hospital Schedules
  {
    patient: patientAlex._id,
    doctor: mayaId,
    hospital: northstar._id,
    date: new Date('2026-10-25T10:30:00Z'),
    reason: 'Follow-up for exercise-induced tachycardia and routine ECG check',
    type: 'In person',
    status: 'upcoming',
  },
  {
    patient: patientSarah._id,
    doctor: wilsonId,
    hospital: northstar._id,
    date: new Date('2026-10-26T14:15:00Z'),
    reason: 'Annual comprehensive physical exam and preventive lab work',
    type: 'Routine Checkup',
    status: 'confirmed',
  },
  {
    patient: patientDavid._id,
    doctor: rostovaId,
    hospital: northstar._id,
    date: new Date('2026-10-28T11:00:00Z'),
    reason: 'Mild shortness of breath following gym workouts; spirometry review',
    type: 'Consultation',
    status: 'upcoming',
  },
  {
    patient: patientMaria._id,
    doctor: mayaId,
    hospital: northstar._id,
    date: new Date('2026-10-14T09:00:00Z'),
    reason: 'Pre-athletic sports cardiac clearance',
    type: 'In person',
    status: 'completed',
  },

  // Lakeview Medical Center Schedules
  {
    patient: patientAlex._id,
    doctor: nairId,
    hospital: lakeview._id,
    date: new Date('2026-10-24T09:15:00Z'),
    reason: 'Dermatology wound healing assessment post biopsy',
    type: 'In person',
    status: 'confirmed',
  },
  {
    patient: patientMaria._id,
    doctor: martinezId,
    hospital: lakeview._id,
    date: new Date('2026-10-25T13:30:00Z'),
    reason: 'Adolescent seasonal booster & pediatric wellness check',
    type: 'Video visit',
    status: 'upcoming',
  },
  {
    patient: patientSarah._id,
    doctor: vanceId,
    hospital: lakeview._id,
    date: new Date('2026-10-27T15:45:00Z'),
    reason: 'Review seasonal allergy medications and prescription refills',
    type: 'Follow-up',
    status: 'upcoming',
  },
  {
    patient: patientDavid._id,
    doctor: nairId,
    hospital: lakeview._id,
    date: new Date('2026-10-15T11:30:00Z'),
    reason: 'Contact dermatitis review following latex exposure',
    type: 'In person',
    status: 'completed',
  },

  // Apex Health Institute Schedules
  {
    patient: patientAlex._id,
    doctor: thorneId,
    hospital: apex._id,
    date: new Date('2026-10-29T15:00:00Z'),
    reason: 'Specialist neurological review of cranial MRI imaging',
    type: 'Consultation',
    status: 'upcoming',
  },
  {
    patient: patientDavid._id,
    doctor: thorneId,
    hospital: apex._id,
    date: new Date('2026-11-02T10:00:00Z'),
    reason: 'Spinal reflex assessment and posture mechanics consult',
    type: 'In person',
    status: 'confirmed',
  },
  {
    patient: patientSarah._id,
    doctor: zhaoId,
    hospital: apex._id,
    date: new Date('2026-11-04T14:30:00Z'),
    reason: 'Genetic health screening consultation and family risk mapping',
    type: 'Video visit',
    status: 'upcoming',
  },

  // St. Jude Wellness Center Schedules
  {
    patient: patientDavid._id,
    doctor: ortizId,
    hospital: stjude._id,
    date: new Date('2026-10-24T14:00:00Z'),
    reason: 'Post-operative right knee mobility evaluation & physical therapy progression',
    type: 'In person',
    status: 'confirmed',
  },
  {
    patient: patientMaria._id,
    doctor: bennettId,
    hospital: stjude._id,
    date: new Date('2026-10-30T09:30:00Z'),
    reason: 'Routine endocrinology review of thyroid function tests',
    type: 'Video visit',
    status: 'upcoming',
  },
];

for (const appt of sampleAppointments) {
  await Appointment.updateOne(
    { patient: appt.patient, doctor: appt.doctor, date: appt.date },
    { $set: appt },
    { upsert: true }
  );
}

// ── 7. Inter-Hospital Transfer Requests & Record Shares ───────────────────────
const sampleTransfers = [
  // 1. Lakeview requested Alex Morgan's cardiology records from Northstar (Pending Authorization)
  {
    patient: patientAlex._id,
    sourceHospital: northstar._id,
    targetHospital: lakeview._id,
    requestedBy: nairId,
    status: 'requested',
    createdAt: new Date('2026-10-20T11:00:00Z'),
  },
  // 2. Apex requested and received Alex Morgan's Northstar records (Approved & Transferred)
  {
    patient: patientAlex._id,
    sourceHospital: northstar._id,
    targetHospital: apex._id,
    requestedBy: thorneId,
    status: 'approved',
    approvedAt: new Date('2026-10-18T16:20:00Z'),
    lastImportedAt: new Date('2026-10-18T16:25:00Z'),
    lastImportedBy: thorneId,
  },
  // 3. St. Jude requested David Kim's Lakeview allergy records (Approved)
  {
    patient: patientDavid._id,
    sourceHospital: lakeview._id,
    targetHospital: stjude._id,
    requestedBy: ortizId,
    status: 'approved',
    approvedAt: new Date('2026-10-19T09:40:00Z'),
    lastImportedAt: new Date('2026-10-19T09:45:00Z'),
    lastImportedBy: ortizId,
  },
];

for (const tr of sampleTransfers) {
  await RecordShare.updateOne(
    { patient: tr.patient, sourceHospital: tr.sourceHospital, targetHospital: tr.targetHospital },
    { $set: tr },
    { upsert: true }
  );
}

console.log('✅ Enterprise Seed Complete!');
console.log('═══════════════════════════════════════════════════════════════');
console.log('Verified Test Accounts:');
console.log('👤 Patient:              alex.morgan@carelink.org');
console.log('🏥 Northstar Hospital:   records@northstarhealth.org');
console.log('🏥 Lakeview Hospital:    clinical@lakeviewhealth.org');
console.log('🏥 Apex Health:          records@apexhealth.org');
console.log('🏥 St. Jude Wellness:    intake@stjudewellness.org');
console.log('🩺 Cardiologist Doctor:  dr.chen@northstarhealth.org');
console.log('🩺 Dermatologist Doctor: dr.nair@lakeviewhealth.org');
console.log('🛡️ Super Administrator: admin@carelink.org');
console.log('Password for all:        CareLink123!');
console.log('═══════════════════════════════════════════════════════════════');

await mongoose.disconnect();
