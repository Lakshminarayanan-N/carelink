import { Router } from 'express';
import Hospital from '../models/Hospital.js';
import MedicalRecord from '../models/MedicalRecord.js';
import RecordShare from '../models/RecordShare.js';
import User from '../models/User.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value || '');

async function importHospitalRecords(share, userId) {
  const records = await MedicalRecord.find({
    patient: share.patient,
    hospital: { $in: [share.sourceHospital, null] },
    sourceRecord: { $exists: false }
  }).populate('doctor', 'hospital').lean();
  const sourceHospitalId = String(share.sourceHospital);
  const sourceRecords = records.filter((record) =>
    String(record.hospital || record.doctor?.hospital || '') === sourceHospitalId);

  for (const record of sourceRecords) {
    await MedicalRecord.updateOne(
      { hospital: share.targetHospital, sourceRecord: record._id },
      {
        $setOnInsert: {
          patient: record.patient,
          doctor: record.doctor,
          title: record.title,
          category: record.category,
          summary: record.summary,
          recordedAt: record.recordedAt,
          doctor: record.doctor?._id || record.doctor,
          hospital: share.targetHospital,
          sourceHospital: share.sourceHospital,
          sourceRecord: record._id,
          importedThrough: share._id,
          importedBy: userId
        }
      },
      { upsert: true }
    );
  }

  share.lastImportedAt = new Date();
  share.lastImportedBy = userId;
  await share.save();
  return sourceRecords.length;
}

router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === 'patient'
      ? { patient: req.user.id }
      : req.user.role === 'doctor' && req.user.hospital
        ? { targetHospital: req.user.hospital }
        : req.user.role === 'admin'
          ? {}
          : { _id: null };
    const shares = await RecordShare.find(filter)
      .populate('sourceHospital', 'name')
      .populate('targetHospital', 'name')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ shares });
  } catch (error) { next(error); }
});

router.post('/', allowRoles('doctor'), async (req, res, next) => {
  try {
    if (!req.user.hospital) return res.status(403).json({ message: 'Your clinician account is not assigned to a hospital.' });
    const patientEmail = req.body.patientEmail?.trim().toLowerCase();
    const sourceHospitalId = req.body.sourceHospitalId;
    if (!patientEmail || !isObjectId(sourceHospitalId)) {
      return res.status(400).json({ message: 'Enter the patient’s account email and select the hospital holding their records.' });
    }
    if (String(req.user.hospital) === sourceHospitalId) {
      return res.status(400).json({ message: 'Choose a different hospital as the source of these records.' });
    }

    const [patient, sourceHospital] = await Promise.all([
      User.findOne({ email: patientEmail, role: 'patient' }).select('_id'),
      Hospital.findById(sourceHospitalId).select('_id name')
    ]);
    if (!patient || !sourceHospital) {
      return res.status(404).json({ message: 'We could not create a request with those details. Check the patient account and source hospital.' });
    }

    const existing = await RecordShare.findOne({
      patient: patient.id,
      sourceHospital: sourceHospital.id,
      targetHospital: req.user.hospital,
      status: { $in: ['requested', 'approved'] }
    });
    if (existing) return res.status(409).json({ message: 'A request or active transfer for this patient and hospital already exists.' });

    const share = await RecordShare.create({
      patient: patient.id,
      sourceHospital: sourceHospital.id,
      targetHospital: req.user.hospital,
      requestedBy: req.user.id
    });
    await share.populate([
      { path: 'sourceHospital', select: 'name' },
      { path: 'targetHospital', select: 'name' },
      { path: 'requestedBy', select: 'name email' }
    ]);
    res.status(201).json({ share });
  } catch (error) { next(error); }
});

router.patch('/:id/approve', allowRoles('patient'), async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer request.' });
    const share = await RecordShare.findOneAndUpdate(
      { _id: req.params.id, patient: req.user.id, status: 'requested' },
      { $set: { status: 'approved', approvedAt: new Date() } },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'This pending request could not be found.' });
    const importedCount = await importHospitalRecords(share, req.user.id);
    res.json({ share, importedCount });
  } catch (error) { next(error); }
});

router.patch('/:id/reject', allowRoles('patient'), async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer request.' });
    const share = await RecordShare.findOneAndUpdate(
      { _id: req.params.id, patient: req.user.id, status: 'requested' },
      { $set: { status: 'rejected', rejectedAt: new Date() } },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'This pending request could not be found.' });
    res.json({ share });
  } catch (error) { next(error); }
});

router.patch('/:id/revoke', allowRoles('patient'), async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer request.' });
    const share = await RecordShare.findOneAndUpdate(
      { _id: req.params.id, patient: req.user.id, status: 'approved' },
      { $set: { status: 'revoked', revokedAt: new Date() } },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'This active transfer could not be found.' });
    res.json({ share, retainedCopies: true });
  } catch (error) { next(error); }
});

router.post('/:id/sync', allowRoles('doctor'), async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transfer request.' });
    if (!req.user.hospital) return res.status(403).json({ message: 'Your clinician account is not assigned to a hospital.' });
    const share = await RecordShare.findOne({
      _id: req.params.id,
      targetHospital: req.user.hospital,
      status: 'approved'
    });
    if (!share) return res.status(404).json({ message: 'No active transfer was found. It may have been revoked by the patient.' });
    const importedCount = await importHospitalRecords(share, req.user.id);
    res.json({ share, importedCount });
  } catch (error) { next(error); }
});

export default router;
