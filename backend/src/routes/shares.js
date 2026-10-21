import { Router } from 'express';
import Hospital from '../models/Hospital.js';
import MedicalRecord from '../models/MedicalRecord.js';
import RecordShare from '../models/RecordShare.js';
import User from '../models/User.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value || '');

// Copies records from source hospital to target hospital under the approved share
async function importHospitalRecords(share, userId) {
  const records = await MedicalRecord.find({
    patient: share.patient,
    hospital: share.sourceHospital,
    sourceRecord: { $exists: false }, // Only import original records, avoid cyclic import
  }).populate('doctor', 'name specialty hospital').lean();

  let importedCount = 0;
  for (const record of records) {
    const res = await MedicalRecord.updateOne(
      { hospital: share.targetHospital, sourceRecord: record._id },
      {
        $setOnInsert: {
          patient: record.patient,
          title: record.title,
          category: record.category,
          summary: record.summary,
          recordedAt: record.recordedAt,
          doctor: record.doctor?._id || record.doctor,
          hospital: share.targetHospital,
          sourceHospital: share.sourceHospital,
          sourceRecord: record._id,
          importedThrough: share._id,
          importedBy: userId,
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount > 0) importedCount++;
  }

  share.lastImportedAt = new Date();
  share.lastImportedBy = userId;
  await share.save();
  return importedCount;
}

// ── GET /api/shares ───────────────────────────────────────────────────────────
// STRICT ISOLATION:
// - Admin: see ALL shares across the entire system
// - Hospital / Doctor: see ONLY shares where their hospital is source OR target
//   (Cannot see any transfers between other hospitals!)
// - Patient: see ONLY transfers concerning their own records
router.get('/', async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = {};
    } else if (req.user.role === 'hospital' || req.user.role === 'doctor') {
      if (!req.user.hospital) {
        return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
      }
      filter = {
        $or: [
          { targetHospital: req.user.hospital },
          { sourceHospital: req.user.hospital },
        ],
      };
    } else {
      filter = { patient: req.user.id };
    }

    const shares = await RecordShare.find(filter)
      .populate('patient', 'name email phone')
      .populate('sourceHospital', 'name')
      .populate('targetHospital', 'name')
      .populate('requestedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ shares });
  } catch (error) { next(error); }
});

// ── POST /api/shares (Request data from another hospital) ─────────────────────
// Hospital A requests Patient X's records from Hospital B
router.post('/', allowRoles('doctor', 'hospital', 'admin'), async (req, res, next) => {
  try {
    const { patientEmail, sourceHospitalId } = req.body;
    let targetHospitalId = req.user.hospital;

    if (req.user.role === 'admin') {
      targetHospitalId = req.body.targetHospitalId;
      if (!isObjectId(targetHospitalId)) {
        return res.status(400).json({ message: 'Select the target hospital receiving records.' });
      }
    } else if (!targetHospitalId) {
      return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
    }

    if (!patientEmail?.trim() || !isObjectId(sourceHospitalId)) {
      return res.status(400).json({ message: 'Enter the patient’s account email and select the source hospital.' });
    }

    if (String(targetHospitalId) === String(sourceHospitalId)) {
      return res.status(400).json({ message: 'Source and target hospitals must be different.' });
    }

    const [patient, sourceHospital, targetHospital] = await Promise.all([
      User.findOne({ email: patientEmail.trim().toLowerCase(), role: 'patient' }).select('_id name email'),
      Hospital.findById(sourceHospitalId).select('_id name'),
      Hospital.findById(targetHospitalId).select('_id name'),
    ]);

    if (!patient) return res.status(404).json({ message: 'Patient account with that email was not found.' });
    if (!sourceHospital) return res.status(404).json({ message: 'Source hospital not found.' });
    if (!targetHospital) return res.status(404).json({ message: 'Target hospital not found.' });

    const existing = await RecordShare.findOne({
      patient: patient.id,
      sourceHospital: sourceHospital.id,
      targetHospital: targetHospital.id,
      status: { $in: ['requested', 'approved'] },
    });
    if (existing) {
      return res.status(409).json({ message: `A ${existing.status} transfer already exists for this patient between these hospitals.` });
    }

    const share = await RecordShare.create({
      patient: patient.id,
      sourceHospital: sourceHospital.id,
      targetHospital: targetHospital.id,
      requestedBy: req.user.id,
      status: 'requested',
    });

    await share.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'sourceHospital', select: 'name' },
      { path: 'targetHospital', select: 'name' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    res.status(201).json({ share });
  } catch (error) { next(error); }
});

// ── POST /api/shares/send (Send patient data directly to another hospital) ────
// Hospital A actively dispatches/sends patient records to Hospital B
router.post('/send', allowRoles('doctor', 'hospital', 'admin'), async (req, res, next) => {
  try {
    const { patientEmail, targetHospitalId } = req.body;
    let sourceHospitalId = req.user.hospital;

    if (req.user.role === 'admin') {
      sourceHospitalId = req.body.sourceHospitalId;
      if (!isObjectId(sourceHospitalId)) {
        return res.status(400).json({ message: 'Select the source hospital sending the records.' });
      }
    } else if (!sourceHospitalId) {
      return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
    }

    if (!patientEmail?.trim() || !isObjectId(targetHospitalId)) {
      return res.status(400).json({ message: 'Enter the patient’s email and choose the destination hospital.' });
    }

    if (String(sourceHospitalId) === String(targetHospitalId)) {
      return res.status(400).json({ message: 'Destination hospital must be different from source hospital.' });
    }

    const [patient, sourceHospital, targetHospital] = await Promise.all([
      User.findOne({ email: patientEmail.trim().toLowerCase(), role: 'patient' }).select('_id name email'),
      Hospital.findById(sourceHospitalId).select('_id name'),
      Hospital.findById(targetHospitalId).select('_id name'),
    ]);

    if (!patient) return res.status(404).json({ message: 'Patient account with that email was not found.' });
    if (!targetHospital) return res.status(404).json({ message: 'Target hospital not found.' });

    // Find or create the share
    let share = await RecordShare.findOne({
      patient: patient.id,
      sourceHospital: sourceHospital.id,
      targetHospital: targetHospital.id,
    });

    if (share) {
      share.status = 'approved';
      share.approvedAt = new Date();
      share.requestedBy = req.user.id;
      await share.save();
    } else {
      share = await RecordShare.create({
        patient: patient.id,
        sourceHospital: sourceHospital.id,
        targetHospital: targetHospital.id,
        requestedBy: req.user.id,
        status: 'approved',
        approvedAt: new Date(),
      });
    }

    // Immediately copy the records over to the target hospital
    const importedCount = await importHospitalRecords(share, req.user.id);

    await share.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'sourceHospital', select: 'name' },
      { path: 'targetHospital', select: 'name' },
      { path: 'requestedBy', select: 'name email role' },
    ]);

    res.status(201).json({ share, importedCount, message: `Successfully transferred ${importedCount} record(s) to ${targetHospital.name}.` });
  } catch (error) { next(error); }
});

// ── PATCH /api/shares/:id/approve ─────────────────────────────────────────────
// Patient, Source Hospital staff, or Admin can approve
router.patch('/:id/approve', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer ID.' });
    const share = await RecordShare.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Transfer request not found.' });

    const isPatient = req.user.role === 'patient' && share.patient.equals(req.user.id);
    const isSourceHospital = (req.user.role === 'hospital' || req.user.role === 'doctor') &&
      req.user.hospital && share.sourceHospital.equals(req.user.hospital);
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isSourceHospital && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to authorize this transfer.' });
    }

    share.status = 'approved';
    share.approvedAt = new Date();
    await share.save();

    const importedCount = await importHospitalRecords(share, req.user.id);
    await share.populate([
      { path: 'patient', select: 'name email' },
      { path: 'sourceHospital', select: 'name' },
      { path: 'targetHospital', select: 'name' },
    ]);

    res.json({ share, importedCount });
  } catch (error) { next(error); }
});

// ── PATCH /api/shares/:id/reject ──────────────────────────────────────────────
router.patch('/:id/reject', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer ID.' });
    const share = await RecordShare.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Transfer request not found.' });

    const isPatient = req.user.role === 'patient' && share.patient.equals(req.user.id);
    const isSourceHospital = (req.user.role === 'hospital' || req.user.role === 'doctor') &&
      req.user.hospital && share.sourceHospital.equals(req.user.hospital);
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isSourceHospital && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to reject this transfer.' });
    }

    share.status = 'rejected';
    share.rejectedAt = new Date();
    await share.save();
    res.json({ share });
  } catch (error) { next(error); }
});

// ── PATCH /api/shares/:id/revoke ──────────────────────────────────────────────
router.patch('/:id/revoke', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer ID.' });
    const share = await RecordShare.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Transfer request not found.' });

    const isPatient = req.user.role === 'patient' && share.patient.equals(req.user.id);
    const isSourceHospital = (req.user.role === 'hospital' || req.user.role === 'doctor') &&
      req.user.hospital && share.sourceHospital.equals(req.user.hospital);
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isSourceHospital && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to revoke this transfer.' });
    }

    share.status = 'revoked';
    share.revokedAt = new Date();
    await share.save();
    res.json({ share, retainedCopies: true });
  } catch (error) { next(error); }
});

// ── POST /api/shares/:id/sync ─────────────────────────────────────────────────
router.post('/:id/sync', allowRoles('doctor', 'hospital', 'admin'), async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer request.' });
    const share = await RecordShare.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Transfer not found.' });

    const isAllowed = req.user.role === 'admin' ||
      (req.user.hospital && (share.targetHospital.equals(req.user.hospital) || share.sourceHospital.equals(req.user.hospital)));

    if (!isAllowed) {
      return res.status(403).json({ message: 'You do not have access to this transfer.' });
    }

    if (share.status !== 'approved') {
      return res.status(400).json({ message: 'Records can only be synchronized on approved transfers.' });
    }

    const importedCount = await importHospitalRecords(share, req.user.id);
    res.json({ share, importedCount });
  } catch (error) { next(error); }
});

export default router;
