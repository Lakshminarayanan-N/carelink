import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, Bell, Building2, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3,
  Eye, EyeOff, FileHeart, FileText, Filter, Heart, HeartPulse, KeyRound,
  LayoutDashboard, Lock, LogOut, Menu, MessageCircle, MoreHorizontal, Plus,
  RefreshCw, Search, Send, Share2, Shield, ShieldAlert, ShieldCheck, Sparkles,
  Stethoscope, UserCheck, UserRound, Users, Video, X
} from 'lucide-react';

const API_ROOT = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://backend-nine-beta-29.vercel.app/api'
  : 'http://localhost:4000/api');

const apiRequest = (path, session, options = {}) => fetch(`${API_ROOT}${path}`, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers || {})
  }
});

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('carelink-session')) || null; } catch { return null; }
  });
  const [page, setPage] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Patient / General data
  const [careDoctors, setCareDoctors] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [shareRequests, setShareRequests] = useState([]);
  const [shareHospitals, setShareHospitals] = useState([]);

  // Admin data
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminHospitals, setAdminHospitals] = useState([]);
  const [adminHospitalFilter, setAdminHospitalFilter] = useState('');

  // Modals & form state
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All specialties');

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const logout = () => {
    localStorage.removeItem('carelink-session');
    setSession(null);
    setPage('overview');
    setHealthRecords([]);
    setAppointments([]);
    setShareRequests([]);
    notify('You have been securely signed out.');
  };

  // Data fetching based on role
  const hydrate = async (currSession) => {
    if (!currSession?.token) return;
    try {
      const role = currSession.user?.role;

      // Common fetches
      const [hospRes, docRes, apptRes, recRes, shareRes] = await Promise.all([
        fetch(`${API_ROOT}/hospitals`),
        apiRequest('/doctors', currSession),
        apiRequest('/appointments', currSession),
        apiRequest('/records', currSession),
        apiRequest('/shares', currSession),
      ]);

      if (hospRes.ok) {
        const hData = await hospRes.json();
        setShareHospitals(hData.hospitals || []);
      }
      if (docRes.ok) {
        const dData = await docRes.json();
        setCareDoctors(dData.doctors || []);
      }
      if (apptRes.ok) {
        const aData = await apptRes.json();
        setAppointments((aData.appointments || []).map((item) => ({
          id: item._id,
          doctorId: item.doctor?._id,
          doctor: item.doctor?.name || 'Assigned Clinician',
          specialty: item.doctor?.specialty || 'General Practice',
          patientName: item.patient?.name,
          date: item.date ? item.date.slice(0, 10) : '2026-10-23',
          time: item.date ? new Date(item.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '10:00 AM',
          type: item.type || 'Consultation',
          status: item.status || 'upcoming',
          initials: (item.doctor?.name || 'DR').split(' ').slice(-2).map(p => p[0]).join('').toUpperCase(),
          tint: 'mint'
        })));
      }
      if (recRes.ok) {
        const rData = await recRes.json();
        setHealthRecords(rData.records || []);
      }
      if (shareRes.ok) {
        const sData = await shareRes.json();
        setShareRequests(sData.shares || []);
      }

      // Admin-only data
      if (role === 'admin') {
        const [statsRes, usersRes, adminHospRes] = await Promise.all([
          apiRequest('/admin/stats', currSession),
          apiRequest('/admin/users', currSession),
          apiRequest('/admin/hospitals', currSession),
        ]);
        if (statsRes.ok) {
          const s = await statsRes.json();
          setAdminStats(s.stats);
        }
        if (usersRes.ok) {
          const u = await usersRes.json();
          setAdminUsers(u.users || []);
        }
        if (adminHospRes.ok) {
          const ah = await adminHospRes.json();
          setAdminHospitals(ah.hospitals || []);
        }
      }
    } catch {
      notify('Could not load some data from the secure API.');
    }
  };

  useEffect(() => {
    if (session?.token) {
      hydrate(session);
    }
  }, [session?.token]);

  // Appointment booking
  const bookAppointment = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const doctorId = bookingDoctor?.id || form.get('doctor');
    const date = form.get('date');
    const time = form.get('time');
    const reason = form.get('reason');
    const type = form.get('type');

    if (!doctorId || !date) return;

    const clock = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    let hour = Number(clock?.[1] || 9) % 12;
    if (clock?.[3]?.toUpperCase() === 'PM') hour += 12;
    const dateTime = new Date(`${date}T${String(hour).padStart(2, '0')}:${clock?.[2] || '00'}:00`);

    try {
      const res = await apiRequest('/appointments', session, {
        method: 'POST',
        body: JSON.stringify({ doctorId, date: dateTime.toISOString(), reason, type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to book appointment.');
      notify('Appointment successfully scheduled.');
      setShowBooking(false);
      setBookingDoctor(null);
      setPage('appointments');
      hydrate(session);
    } catch (err) {
      notify(err.message);
    }
  };

  const cancelAppointment = async (id) => {
    try {
      const res = await apiRequest(`/appointments/${id}/cancel`, session, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to cancel appointment.');
      notify('Appointment cancelled.');
      hydrate(session);
    } catch (err) {
      notify(err.message);
    }
  };

  // Cross-Hospital Transfer Actions
  const handleTransferAction = async (id, action) => {
    try {
      const method = action === 'sync' ? 'POST' : 'PATCH';
      const res = await apiRequest(`/shares/${id}/${action}`, session, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to process transfer.');
      if (action === 'approve') notify(`Transfer approved! ${data.importedCount || 0} record(s) transferred.`);
      else if (action === 'reject') notify('Transfer request declined.');
      else if (action === 'revoke') notify('Transfer consent revoked.');
      else if (action === 'sync') notify(`Synchronized: ${data.importedCount || 0} record(s) updated.`);
      hydrate(session);
    } catch (err) {
      notify(err.message);
    }
  };

  const requestPatientRecords = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const res = await apiRequest('/shares', session, {
        method: 'POST',
        body: JSON.stringify({
          patientEmail: form.get('patientEmail'),
          sourceHospitalId: form.get('sourceHospitalId'),
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to submit request.');
      notify('Record request sent. Awaiting patient or facility authorization.');
      event.currentTarget.reset();
      hydrate(session);
    } catch (err) {
      notify(err.message);
    }
  };

  const sendPatientRecords = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const res = await apiRequest('/shares/send', session, {
        method: 'POST',
        body: JSON.stringify({
          patientEmail: form.get('patientEmail'),
          targetHospitalId: form.get('targetHospitalId'),
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to send records.');
      notify(data.message || 'Records successfully dispatched to destination facility!');
      event.currentTarget.reset();
      hydrate(session);
    } catch (err) {
      notify(err.message);
    }
  };

  // If NOT authenticated, show the High-Security Login Screen!
  if (!session) {
    return (
      <SecurityLoginPage
        onLoginSuccess={(newSession) => {
          localStorage.setItem('carelink-session', JSON.stringify(newSession));
          setSession(newSession);
          notify(`Welcome back, ${newSession.user.name}. Authenticated as ${newSession.user.role.toUpperCase()}.`);
        }}
        notify={notify}
        toast={toast}
      />
    );
  }

  const role = session.user?.role;
  const isPatient = role === 'patient';
  const isHospital = role === 'hospital' || role === 'doctor';
  const isAdmin = role === 'admin';

  // Navigation Items per role
  const navigationItems = [
    { id: 'overview', label: isHospital ? 'Facility Hub' : isAdmin ? 'Admin Console' : 'Overview', icon: LayoutDashboard },
    ...(isPatient ? [
      { id: 'appointments', label: 'Appointments', icon: CalendarDays, count: String(appointments.filter(a => a.status === 'upcoming').length || '') },
      { id: 'doctors', label: 'Find a Doctor', icon: Stethoscope },
      { id: 'records', label: 'My Health Records', icon: FileHeart, count: String(healthRecords.length || '') },
      { id: 'transfers', label: 'Sharing & Consents', icon: Share2, count: String(shareRequests.filter(s => s.status === 'requested').length || '') },
    ] : []),
    ...(isHospital ? [
      { id: 'records', label: 'Hospital Records', icon: FileHeart, count: String(healthRecords.length || '') },
      { id: 'transfers', label: 'Data Transfers', icon: Share2, count: String(shareRequests.length || '') },
      { id: 'appointments', label: 'Facility Visits', icon: CalendarDays, count: String(appointments.length || '') },
      { id: 'doctors', label: 'Our Clinicians', icon: Stethoscope },
    ] : []),
    ...(isAdmin ? [
      { id: 'records', label: 'All Health Records', icon: FileHeart, count: String(healthRecords.length || '') },
      { id: 'transfers', label: 'Transfer Audit Logs', icon: Share2, count: String(shareRequests.length || '') },
      { id: 'hospitals', label: 'Hospital Directory', icon: Building2, count: String(adminHospitals.length || '') },
      { id: 'users', label: 'User Accounts', icon: Users, count: String(adminUsers.length || '') },
    ] : [])
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><HeartPulse size={21} strokeWidth={2.5} /></div>
          <span>carelink</span>
          <button className="mobile-close icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <div className="workspace-label">
          {isPatient ? 'PATIENT PORTAL' : isHospital ? 'HOSPITAL CLINICAL SYSTEM' : 'SYSTEM ADMINISTRATION'}
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {navigationItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => { setPage(id); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count && count !== '0' && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-orb"><ShieldCheck size={17} /></div>
            <p>High Security Active</p>
            <span>Session verified · 256-bit TLS · Role: <strong>{role.toUpperCase()}</strong></span>
          </div>

          <div className="profile-mini" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="patient-avatar">
                {session.user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="profile-copy">
                <b>{session.user.name}</b>
                <span>{session.user.hospitalName || session.user.email}</span>
              </div>
            </div>

            {/* Logout Option in Sidebar */}
            <button className="profile-logout-btn" onClick={logout} title="Sign out of CareLink">
              <LogOut size={13} /> Secure Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        {/* Universal Topbar with visible Logout option */}
        <header className="topbar">
          <button className="mobile-menu icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            CareLink <ChevronRight size={14} /> <strong>{navigationItems.find(i => i.id === page)?.label || 'Workspace'}</strong>
          </div>

          <div className="top-actions">
            <div className="secure-label">
              <ShieldCheck size={15} /> Authenticated as <strong>{session.user.role.toUpperCase()}</strong>
            </div>

            {/* Prominent Ubiquitous Topbar Logout Option */}
            <button className="topbar-logout-btn" onClick={logout} title="Securely Sign Out of CareLink">
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="page-content">
          {/* Hospital Isolation Notice Banner */}
          {isHospital && (
            <div className="hospital-badge-banner">
              <div className="hospital-badge-left">
                <div className="hospital-badge-icon"><Building2 size={24} /></div>
                <div className="hospital-badge-info">
                  <h2>{session.user.hospitalName || 'Affiliated Clinical Center'}</h2>
                  <span>Licensed Clinical Organization · Facility ID: {session.user.hospitalId || 'Active'}</span>
                </div>
              </div>
              <div className="hospital-isolation-tag">
                <Lock size={12} /> Strict Isolation Active: Other hospital charts locked
              </div>
            </div>
          )}

          {/* Admin Banner */}
          {isAdmin && (
            <div className="admin-badge-banner">
              <div>
                <h2>Super Administrator Command Center</h2>
                <span>Full System Access: Cross-Hospital Oversight, Central Audit Logs & Facility Management</span>
              </div>
              <span className="user-role-badge admin">ALL HOSPITALS ACCESS</span>
            </div>
          )}

          {/* View Routing */}
          {page === 'overview' && (
            isAdmin ? (
              <AdminDashboardView
                stats={adminStats}
                records={healthRecords}
                transfers={shareRequests}
                hospitals={adminHospitals}
                onGo={setPage}
              />
            ) : isHospital ? (
              <HospitalDashboardView
                hospitalName={session.user.hospitalName}
                records={healthRecords}
                transfers={shareRequests}
                appointments={appointments}
                hospitals={shareHospitals}
                onRequestRecords={requestPatientRecords}
                onSendRecords={sendPatientRecords}
                onTransferAction={handleTransferAction}
                onGo={setPage}
              />
            ) : (
              <PatientOverviewView
                user={session.user}
                appointments={appointments.filter(a => a.status === 'upcoming')}
                records={healthRecords}
                onBook={() => setShowBooking(true)}
                onGo={setPage}
                onCancel={cancelAppointment}
              />
            )
          )}

          {page === 'records' && (
            <HealthRecordsView
              records={healthRecords}
              role={role}
              hospitalName={session.user.hospitalName}
              hospitals={shareHospitals}
              adminFilter={adminHospitalFilter}
              onAdminFilterChange={setAdminHospitalFilter}
            />
          )}

          {page === 'transfers' && (
            <TransfersView
              role={role}
              requests={shareRequests}
              hospitals={shareHospitals}
              currentHospitalId={session.user.hospitalId}
              currentHospitalName={session.user.hospitalName}
              onAction={handleTransferAction}
              onRequest={requestPatientRecords}
              onSend={sendPatientRecords}
            />
          )}

          {page === 'appointments' && (
            <AppointmentsView
              appointments={appointments}
              role={role}
              onBook={() => setShowBooking(true)}
              onCancel={cancelAppointment}
            />
          )}

          {page === 'doctors' && (
            <DoctorsView
              doctors={careDoctors}
              query={query}
              setQuery={setQuery}
              specialty={specialty}
              setSpecialty={setSpecialty}
              onBook={(doc) => { setBookingDoctor(doc); setShowBooking(true); }}
            />
          )}

          {page === 'hospitals' && isAdmin && (
            <AdminHospitalsView
              hospitals={adminHospitals}
              session={session}
              notify={notify}
              onRefresh={() => hydrate(session)}
            />
          )}

          {page === 'users' && isAdmin && (
            <AdminUsersView users={adminUsers} />
          )}
        </div>
      </main>

      {/* Booking Modal */}
      {showBooking && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowBooking(false); }}>
          <form className="booking-modal" onSubmit={bookAppointment}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">SCHEDULING</span>
                <h2>Book Clinician Appointment</h2>
                <p>Select your provider, date, and visit requirements.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowBooking(false)} aria-label="Close"><X size={20} /></button>
            </div>

            <label>
              Choose Clinician
              <select name="doctor" defaultValue={bookingDoctor?.id || ''} required>
                <option value="" disabled>Select provider</option>
                {careDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.name} · {doc.specialty} ({doc.hospitalName || 'Affiliated Hospital'})</option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <label>
                Date
                <input name="date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue="2026-10-23" required />
              </label>
              <label>
                Time
                <select name="time" defaultValue="10:30 AM">
                  <option>9:00 AM</option>
                  <option>10:30 AM</option>
                  <option>11:15 AM</option>
                  <option>1:00 PM</option>
                  <option>2:30 PM</option>
                  <option>3:45 PM</option>
                </select>
              </label>
            </div>

            <label>
              Visit Type
              <select name="type">
                <option>In person</option>
                <option>Video visit</option>
                <option>Routine Checkup</option>
              </select>
            </label>

            <label>
              Reason / Medical Notes
              <textarea name="reason" placeholder="Describe symptoms or reasons for visit..." rows="3" />
            </label>

            <div className="modal-note">
              <ShieldCheck size={16} /> Encrypted appointment request dispatched to assigned clinician.
            </div>

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowBooking(false)}>Cancel</button>
              <button type="submit" className="btn primary">Confirm Visit <ArrowRight size={15} /></button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// High-Security Login Screen with Brute-Force Defense & Role Selector
// ══════════════════════════════════════════════════════════════════════════════
function SecurityLoginPage({ onLoginSuccess, notify, toast }) {
  const [selectedRole, setSelectedRole] = useState('patient'); // patient, hospital, admin
  const [email, setEmail] = useState('alex.morgan@carelink.org');
  const [password, setPassword] = useState('CareLink123!');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutAlert, setLockoutAlert] = useState('');

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (password.length >= 12) score += 25;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;
    return Math.min(score, 100);
  }, [password]);

  const strengthColor = passwordStrength > 70 ? '#3f9a72' : passwordStrength > 40 ? '#d49b38' : '#c94a38';
  const strengthLabel = passwordStrength > 70 ? 'Strong' : passwordStrength > 40 ? 'Moderate' : 'Weak';

  // Authorized system role accounts
  const authorizedAccounts = [
    { label: 'Patient (Alex Morgan)', role: 'patient', email: 'alex.morgan@carelink.org', pass: 'CareLink123!' },
    { label: 'Northstar Records Dept', role: 'hospital', email: 'records@northstarhealth.org', pass: 'CareLink123!' },
    { label: 'Lakeview Clinical Office', role: 'hospital', email: 'clinical@lakeviewhealth.org', pass: 'CareLink123!' },
    { label: 'Super Administrator', role: 'admin', email: 'admin@carelink.org', pass: 'CareLink123!' },
  ];

  const fillAccount = (acc) => {
    setSelectedRole(acc.role);
    setEmail(acc.email);
    setPassword(acc.pass);
    setErrorMsg('');
    setLockoutAlert('');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLockoutAlert('');
    setBusy(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email, password }
        : { name, email, password, phone, role: selectedRole };

      const res = await fetch(`${API_ROOT}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setLockoutAlert(data.message || 'Account temporarily locked due to excessive failed attempts.');
        } else {
          setErrorMsg(data.message || 'Authentication failed. Please verify credentials.');
        }
        return;
      }

      // Check role match recommendation
      if (mode === 'login' && data.user.role !== selectedRole && !(selectedRole === 'hospital' && data.user.role === 'doctor')) {
        notify(`Note: Signed in with account role [${data.user.role.toUpperCase()}].`);
      }

      onLoginSuccess(data);
    } catch (err) {
      setErrorMsg(err.message?.includes('Failed to fetch')
        ? 'Could not connect to the CareLink security server. Verify the API is online.'
        : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Top Banner */}
      <header className="login-top-nav">
        <div className="brand" style={{ margin: 0 }}>
          <div className="brand-mark"><HeartPulse size={21} strokeWidth={2.5} /></div>
          <span>carelink</span>
        </div>
        <div className="login-security-badge">
          <ShieldCheck size={16} /> 256-Bit TLS · End-to-End Encrypted Care System
        </div>
      </header>

      {/* Main Grid */}
      <div className="login-container">
        {/* Left Information Column */}
        <div className="login-hero">
          <div className="login-hero-pill">
            <Lock size={12} /> ZERO-TRUST ACCESS CONTROL
          </div>
          <h1>
            Secure Healthcare Coordination for <span>Patients</span>, <span>Hospitals</span> & <span>Admins</span>.
          </h1>
          <p className="login-hero-desc">
            CareLink enforces strict hospital-level data isolation. One hospital cannot access another hospital's charts without patient authorization or certified inter-facility data transfer.
          </p>

          <div className="security-highlights">
            <div className="security-highlight-item">
              <div className="security-highlight-icon"><Shield size={18} /></div>
              <div className="security-highlight-text">
                <b>Strict Facility Data Isolation</b>
                <span>Hospitals can only see records generated by their clinical staff or transferred with verified consent.</span>
              </div>
            </div>
            <div className="security-highlight-item">
              <div className="security-highlight-icon"><Share2 size={18} /></div>
              <div className="security-highlight-text">
                <b>Cross-Hospital Transfer Protocol</b>
                <span>Hospital A can request or securely transfer patient charts directly to Hospital B.</span>
              </div>
            </div>
            <div className="security-highlight-item">
              <div className="security-highlight-icon"><Lock size={18} /></div>
              <div className="security-highlight-text">
                <b>Brute-Force & Lockout Defense</b>
                <span>Automated defense locks accounts after 5 failed attempts for 15 minutes to thwart unauthorized intrusion.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Security Card */}
        <div className="login-card">
          <div className="login-card-head">
            <h2>{mode === 'login' ? 'Secure Authentication' : 'Create Patient Account'}</h2>
            <p>Select your authorized portal to sign in.</p>
          </div>

          {/* Portal / Role Tabs */}
          <div className="role-tabs">
            <button
              type="button"
              className={`role-tab-btn ${selectedRole === 'patient' ? 'active' : ''}`}
              onClick={() => {
                setSelectedRole('patient');
                if (mode === 'login') {
                  setEmail('alex.morgan@carelink.org');
                  setPassword('CareLink123!');
                }
              }}
            >
              <UserRound size={16} />
              <span>Patient</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${selectedRole === 'hospital' ? 'active' : ''}`}
              onClick={() => {
                setSelectedRole('hospital');
                if (mode === 'login') {
                  setEmail('records@northstarhealth.org');
                  setPassword('CareLink123!');
                }
              }}
            >
              <Building2 size={16} />
              <span>Hospital / Clinic</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${selectedRole === 'admin' ? 'active' : ''}`}
              onClick={() => {
                setSelectedRole('admin');
                if (mode === 'login') {
                  setEmail('admin@carelink.org');
                  setPassword('CareLink123!');
                }
              }}
            >
              <ShieldCheck size={16} />
              <span>Super Admin</span>
            </button>
          </div>

          {/* Role Helper Banner */}
          <div className="role-banner-hint">
            <Lock size={14} />
            <span>
              {selectedRole === 'patient' && 'Patient Portal: Manage personal health charts, visits, and hospital transfer consents.'}
              {selectedRole === 'hospital' && 'Clinical Facility Portal: Isolated hospital charts, patient data requests & outbound transfers.'}
              {selectedRole === 'admin' && 'Administrator Console: Full-system audit, all hospitals, all records, and account controls.'}
            </span>
          </div>

          {/* Quick Access Credentials Shelf */}
          <div className="quick-access-shelf">
            <div className="quick-access-title">
              <span>Quick Role Access Credentials</span>
              <Sparkles size={12} />
            </div>
            <div className="quick-pill-grid">
              {authorizedAccounts.map((acc) => (
                <button
                  key={acc.label}
                  type="button"
                  className={`quick-fill-btn ${email === acc.email ? 'active' : ''}`}
                  onClick={() => fillAccount(acc)}
                >
                  <KeyRound size={11} /> {acc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lockout Warning */}
          {lockoutAlert && (
            <div className="auth-alert-box danger">
              <ShieldAlert size={18} />
              <div>
                <strong>Security Lockout Engaged</strong>
                <div>{lockoutAlert}</div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="auth-alert-box danger">
              <ShieldAlert size={16} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleAuthSubmit}>
            {mode === 'register' && (
              <div className="security-input-group">
                <label>Full Legal Name</label>
                <div className="security-input-wrap">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    required
                  />
                </div>
              </div>
            )}

            <div className="security-input-group">
              <label>Authorized Email Address</label>
              <div className="security-input-wrap">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@carelink.org"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="security-input-group">
              <label>Password</label>
              <div className="security-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="security-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="password-meter-wrap">
                  <div className="password-meter-bar">
                    <div
                      className="password-meter-fill"
                      style={{ width: `${passwordStrength}%`, backgroundColor: strengthColor }}
                    />
                  </div>
                  <div className="password-meter-text">
                    <span>Security Strength: <strong>{strengthLabel}</strong></span>
                    <span>Min. 8 characters</span>
                  </div>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div className="security-input-group">
                <label>Phone Number (Optional)</label>
                <div className="security-input-wrap">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 012-3456"
                  />
                </div>
              </div>
            )}

            <button type="submit" className="btn-security-submit" disabled={busy}>
              {busy ? (
                <>Verifying Credentials...</>
              ) : mode === 'login' ? (
                <>Authenticate & Enter {selectedRole.toUpperCase()} Portal <ArrowRight size={16} /></>
              ) : (
                <>Create Secure Account <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="login-card-foot">
            {mode === 'login' ? (
              <>
                <span>New patient to CareLink?</span>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setSelectedRole('patient'); setErrorMsg(''); }}
                >
                  Register as Patient
                </button>
              </>
            ) : (
              <>
                <span>Already registered?</span>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setErrorMsg(''); }}
                >
                  Return to Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="login-footer-strip">
        CareLink Healthcare Systems · All transmissions protected with TLS 1.3 & SHA-256 signatures.
      </footer>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Hospital / Clinic Staff Dashboard View (Data Isolation + Transfer Tools)
// ══════════════════════════════════════════════════════════════════════════════
function HospitalDashboardView({
  hospitalName,
  records,
  transfers,
  appointments,
  hospitals,
  onRequestRecords,
  onSendRecords,
  onTransferAction,
  onGo
}) {
  const [transferMode, setTransferMode] = useState('request'); // 'request' or 'send'

  const pendingIncoming = transfers.filter(t => t.status === 'requested');

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">CLINICAL FACILITY DASHBOARD</div>
          <h1>{hospitalName || 'Clinical Center'} Operations</h1>
          <p className="welcome-sub">
            Review your facility's isolated health charts, initiate patient data transfers, or approve incoming record requests.
          </p>
        </div>
        <button className="btn primary" onClick={() => onGo('transfers')}>
          <Share2 size={16} /> Inter-Hospital Transfers
        </button>
      </section>

      {/* KPI Stats */}
      <section className="stat-grid">
        <StatCard
          icon={FileHeart}
          label="Hospital Charts"
          value={String(records.length).padStart(2, '0')}
          note="Isolated to this facility"
          tone="mint"
          trend="Secure"
        />
        <StatCard
          icon={Share2}
          label="Inter-Hospital Transfers"
          value={String(transfers.length).padStart(2, '0')}
          note="Across healthcare network"
          tone="lavender"
          trend={`${pendingIncoming.length} pending`}
        />
        <StatCard
          icon={CalendarDays}
          label="Facility Visits"
          value={String(appointments.length).padStart(2, '0')}
          note="Upcoming consultations"
          tone="peach"
          trend="Active"
        />
      </section>

      {/* Interactive Transfer Hub: Request Data & Send Data */}
      <section className="transfer-hub-card">
        <div className="transfer-hub-head">
          <h3>
            <Share2 size={18} /> Cross-Hospital Patient Data Transfer Hub
          </h3>
          <div className="transfer-mode-selector">
            <button
              className={`transfer-mode-btn ${transferMode === 'request' ? 'active' : ''}`}
              onClick={() => setTransferMode('request')}
            >
              <Search size={14} /> Request Patient Data
            </button>
            <button
              className={`transfer-mode-btn ${transferMode === 'send' ? 'active' : ''}`}
              onClick={() => setTransferMode('send')}
            >
              <Send size={14} /> Send Patient Data
            </button>
          </div>
        </div>

        {transferMode === 'request' ? (
          <form onSubmit={onRequestRecords}>
            <p style={{ fontSize: '11px', color: '#687e74', margin: '0 0 14px' }}>
              Request access to a patient's medical records held at another hospital or clinic. Once requested, the patient or originating hospital can authorize the transmission.
            </p>
            <div className="transfer-form-grid">
              <div className="transfer-form-field">
                <label>Patient Email</label>
                <input
                  name="patientEmail"
                  type="email"
                  defaultValue="alex.morgan@carelink.org"
                  placeholder="patient@carelink.org"
                  required
                />
              </div>
              <div className="transfer-form-field">
                <label>Source Hospital (Holding Records)</label>
                <select name="sourceHospitalId" defaultValue="" required>
                  <option value="" disabled>Select source facility</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn primary" style={{ height: '40px' }}>
                <Share2 size={15} /> Request Records
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSendRecords}>
            <p style={{ fontSize: '11px', color: '#687e74', margin: '0 0 14px' }}>
              Dispatch a patient's medical records from <strong>{hospitalName}</strong> directly to another destination hospital or clinic. Records will be copied immediately upon dispatch.
            </p>
            <div className="transfer-form-grid">
              <div className="transfer-form-field">
                <label>Patient Email</label>
                <input
                  name="patientEmail"
                  type="email"
                  defaultValue="alex.morgan@carelink.org"
                  placeholder="patient@carelink.org"
                  required
                />
              </div>
              <div className="transfer-form-field">
                <label>Destination Hospital (Receiving Records)</label>
                <select name="targetHospitalId" defaultValue="" required>
                  <option value="" disabled>Select receiving hospital</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn primary" style={{ height: '40px', background: '#255843' }}>
                <Send size={15} /> Send Records Now
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Pending Incoming Requests needing authorization */}
      {pendingIncoming.length > 0 && (
        <section className="share-list" style={{ marginBottom: '24px' }}>
          <div className="share-list-heading">
            <h2>Pending Transfer Requests Requiring Authorization</h2>
            <span style={{ color: '#a27742', fontWeight: 700 }}>{pendingIncoming.length} Action Needed</span>
          </div>
          {pendingIncoming.map(share => (
            <article className="share-item" key={share._id}>
              <div className="share-item-icon"><Share2 size={18} /></div>
              <div className="share-item-copy">
                <b>{share.requestedBy?.name || 'Medical Staff'} at {share.targetHospital?.name} requests records</b>
                <span>Patient: {share.patient?.name} ({share.patient?.email}) · From: {share.sourceHospital?.name}</span>
              </div>
              <span className="share-status requested">Awaiting Decision</span>
              <div className="share-item-actions">
                <button className="btn secondary" onClick={() => onTransferAction(share._id, 'reject')}>
                  Decline
                </button>
                <button className="btn primary" onClick={() => onTransferAction(share._id, 'approve')}>
                  Authorize & Send
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Recent Records at this Facility */}
      <section className="section-heading">
        <div>
          <span className="eyebrow">FACILITY CHART ARCHIVE</span>
          <h2>Current Hospital Medical Records</h2>
        </div>
        <button className="text-link" onClick={() => onGo('records')}>
          View all facility records <ArrowRight size={15} />
        </button>
      </section>

      <div className="records-list">
        {records.slice(0, 4).map(record => (
          <div className="record-row" key={record._id || record.title}>
            <div className={`record-icon ${record.category === 'Lab result' ? 'green' : record.category === 'Prescription' ? 'orange' : 'purple'}`}>
              {record.category === 'Lab result' ? <Activity size={18} /> : <FileText size={18} />}
            </div>
            <div className="record-main">
              <b>{record.title}</b>
              <span>
                Patient: <strong>{record.patient?.name || 'Alex Morgan'}</strong> · {record.doctor?.name || 'Staff Clinician'}
                {record.sourceHospital && ` (Imported from ${record.sourceHospital?.name})`}
              </span>
            </div>
            <span className="record-type">{record.category}</span>
            <span className="record-date">{new Date(record.recordedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Super Admin Dashboard View (Full System-Wide Oversight)
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboardView({ stats, records, transfers, hospitals, onGo }) {
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">CENTRAL SYSTEM OVERSIGHT</div>
          <h1>System-Wide Health Network Dashboard</h1>
          <p className="welcome-sub">
            Super Administrator view: Live metrics, cross-facility audits, and medical records across all registered hospitals.
          </p>
        </div>
      </section>

      {/* Admin KPI Stats */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard
          icon={Building2}
          label="Registered Hospitals"
          value={String(stats?.hospitals || hospitals.length || 0).padStart(2, '0')}
          note="Healthcare organizations"
          tone="mint"
          trend="Verified"
        />
        <StatCard
          icon={Users}
          label="Registered Patients"
          value={String(stats?.patients || 1).padStart(2, '0')}
          note="Active patient charts"
          tone="peach"
          trend="+100%"
        />
        <StatCard
          icon={Stethoscope}
          label="Clinicians & Staff"
          value={String(stats?.doctors || 4).padStart(2, '0')}
          note="Assigned to facilities"
          tone="lavender"
          trend="Active"
        />
        <StatCard
          icon={FileHeart}
          label="All Medical Records"
          value={String(stats?.records || records.length || 0).padStart(2, '0')}
          note="System-wide total"
          tone="mint"
          trend="Audited"
        />
        <StatCard
          icon={Share2}
          label="Network Transfers"
          value={String(transfers.length || 0).padStart(2, '0')}
          note="Cross-hospital exchanges"
          tone="lavender"
          trend="Tracked"
        />
      </section>

      {/* Quick Action Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button className="btn outline" onClick={() => onGo('records')}>
          <FileHeart size={16} /> View All Records Across Hospitals
        </button>
        <button className="btn outline" onClick={() => onGo('transfers')}>
          <Share2 size={16} /> Inspect Transfer Audit Trail
        </button>
        <button className="btn outline" onClick={() => onGo('hospitals')}>
          <Building2 size={16} /> Manage Hospitals & Facilities
        </button>
        <button className="btn outline" onClick={() => onGo('users')}>
          <Users size={16} /> Inspect User Accounts
        </button>
      </div>

      {/* Cross-Hospital Transfer Audit Table */}
      <section className="list-panel" style={{ marginBottom: '24px' }}>
        <div className="share-list-heading">
          <h2>Network Data Transfer Audit Feed</h2>
          <span>{transfers.length} Total Cross-Facility Exchanges</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Originating Facility</th>
              <th>Receiving Facility</th>
              <th>Initiated By</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#8c9c93' }}>
                  No cross-hospital data transfers recorded yet.
                </td>
              </tr>
            ) : (
              transfers.map(t => (
                <tr key={t._id}>
                  <td><strong>{t.patient?.name || 'Patient'}</strong><br /><small style={{ color: '#889890' }}>{t.patient?.email}</small></td>
                  <td><span className="hospital-tag-pill">{t.sourceHospital?.name || 'Source Facility'}</span></td>
                  <td><span className="hospital-tag-pill">{t.targetHospital?.name || 'Target Facility'}</span></td>
                  <td>{t.requestedBy?.name || 'Staff'}<br /><small style={{ color: '#889890' }}>{t.requestedBy?.role?.toUpperCase()}</small></td>
                  <td>
                    <span className={`share-status ${t.status}`}>{t.status.toUpperCase()}</span>
                  </td>
                  <td>{new Date(t.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Patient Overview View
// ══════════════════════════════════════════════════════════════════════════════
function PatientOverviewView({ user, appointments, records, onBook, onGo, onCancel }) {
  const next = appointments[0];
  const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">PATIENT DASHBOARD ✦ {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div>
          <h1>Good day, {user.name.split(' ')[0]} <span className="wave">✦</span></h1>
          <p className="welcome-sub">Your personal healthcare coordination center. Appointments, records, and data privacy.</p>
        </div>
        <button className="btn primary book-top" onClick={onBook}>
          <Plus size={17} /> Book Appointment
        </button>
      </section>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> YOUR HEALTH, IN ONE PLACE</div>
          <h2>Care that moves<br />with <em>you.</em></h2>
          <p>Your care team, visits, and clinical records—all organized with patient-controlled consent.</p>
          <button className="hero-link" onClick={() => onGo('records')}>
            Explore your medical records <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-visual">
          <div className="hero-sun" />
          <div className="hero-arc arc-one" />
          <div className="hero-arc arc-two" />
          <div className="hero-heart"><HeartPulse size={44} strokeWidth={1.4} /></div>
          <div className="floating-note note-a"><span className="note-check"><Check size={12} /></span><span>Private & Encrypted</span></div>
          <div className="floating-note note-b"><span className="note-wave">↗</span><span>Consent Protected</span></div>
          <div className="hero-star star-a">✳</div>
          <div className="hero-star star-b">✦</div>
          <div className="hero-dot dot-a" />
          <div className="hero-dot dot-b" />
        </div>
      </section>

      <section className="section-heading">
        <div><span className="eyebrow">HEALTH SUMMARY</span><h2>Overview</h2></div>
        <button className="text-link" onClick={() => onGo('records')}>View all records <ArrowRight size={15} /></button>
      </section>

      <section className="stat-grid">
        <StatCard icon={CalendarDays} label="Upcoming visits" value={String(appointments.length).padStart(2, '0')} note="Right on track" tone="mint" trend="↗" />
        <StatCard icon={Activity} label="Health records" value={String(records.length).padStart(2, '0')} note="Securely stored" tone="lavender" trend="Verified" />
        <StatCard icon={Heart} label="Care team" value="04" note="Clinicians in your corner" tone="peach" trend="Active" />
      </section>

      <section className="content-grid">
        <div className="panel appointment-panel">
          <div className="panel-header">
            <div><div className="panel-eyebrow">COMING UP</div><h3>Your next appointment</h3></div>
            <button className="more-button" onClick={() => onGo('appointments')} aria-label="View all appointments">···</button>
          </div>
          {next ? (
            <div className="next-appointment">
              <div className="date-tile">
                <b>{dateLabel(next.date).split(' ')[0]}</b>
                <strong>{dateLabel(next.date).split(' ')[1]}</strong>
                <span>{new Date(`${next.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
              <div className="doctor-summary">
                <div className={`doctor-avatar ${next.tint}`}>{next.initials}</div>
                <div>
                  <h4>{next.doctor}</h4>
                  <span>{next.specialty}</span>
                  <div className="appointment-meta">
                    <span><Clock3 size={13} /> {next.time}</span>
                    <span>{next.type === 'Video visit' ? <Video size={13} /> : <Users size={13} />} {next.type}</span>
                  </div>
                </div>
              </div>
              <button className="icon-btn appointment-arrow" onClick={() => onGo('appointments')} aria-label="View visit">
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <CalendarDays size={25} />
              <p>No upcoming visits scheduled.</p>
              <button className="text-link" onClick={onBook}>Schedule visit <ArrowRight size={14} /></button>
            </div>
          )}
          <div className="panel-footer">
            <button onClick={() => onGo('appointments')}>See all appointments <ArrowRight size={14} /></button>
            <span className="footer-status"><i /> Private medical records</span>
          </div>
        </div>

        <div className="panel care-panel">
          <div className="panel-header">
            <div><div className="panel-eyebrow">RECORD SHARING CONTROL</div><h3>Patient Data Sovereignty</h3></div>
            <div className="care-icon"><ShieldCheck size={17} /></div>
          </div>
          <p className="care-copy">
            Hospitals cannot access your records without your permission. You control which hospitals receive your health records and can revoke access anytime.
          </p>
          <button className="care-action" onClick={() => onGo('transfers')}>
            Manage Hospital Access <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Health Records View (Scoped by Hospital / Patient / Admin)
// ══════════════════════════════════════════════════════════════════════════════
function HealthRecordsView({ records, role, hospitalName, hospitals, adminFilter, onAdminFilterChange }) {
  const [filter, setFilter] = useState('All records');

  const filtered = records.filter(r => {
    const matchCat = filter === 'All records' || r.category === filter;
    const matchHosp = !adminFilter || r.hospital?._id === adminFilter || r.hospital === adminFilter;
    return matchCat && matchHosp;
  });

  return (
    <>
      <PageTitle
        eyebrow={role === 'admin' ? 'MASTER RECORD REGISTRY' : role === 'hospital' ? 'FACILITY CHARTS' : 'YOUR STORY, WELL KEPT'}
        title={role === 'admin' ? 'System Medical Records' : role === 'hospital' ? `${hospitalName} Records` : 'My Health Records'}
        subtitle={
          role === 'admin'
            ? 'Super Admin oversight across all hospital records in the network.'
            : role === 'hospital'
              ? `Strict Isolation Active: Displays records generated at ${hospitalName} or transferred with patient authorization.`
              : 'Your personal health information, securely stored and controlled by you.'
        }
      />

      {/* Admin Hospital Filter Bar */}
      {role === 'admin' && (
        <div className="admin-filter-bar">
          <Filter size={15} />
          <label>Filter Records by Hospital:</label>
          <select value={adminFilter} onChange={(e) => onAdminFilterChange(e.target.value)}>
            <option value="">All Registered Hospitals (System-Wide)</option>
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <span style={{ fontSize: '11px', color: '#6a7d74', marginLeft: 'auto' }}>
            Showing {filtered.length} of {records.length} records
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-row record-filter-row">
        <div className="filter-tabs">
          {['All records', 'Visit summary', 'Lab result', 'Prescription', 'Imaging'].map(cat => (
            <button
              key={cat}
              className={filter === cat ? 'selected' : ''}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '10px', color: '#889890' }}>
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Records Table / List */}
      <div className="records-list">
        {filtered.length === 0 ? (
          <div className="empty-state large">
            <FileHeart size={28} />
            <h3>No medical records found</h3>
            <p>Records associated with this view will appear here.</p>
          </div>
        ) : (
          filtered.map(record => (
            <div className="record-row" key={record._id || record.title}>
              <div className={`record-icon ${record.category === 'Lab result' ? 'green' : record.category === 'Prescription' ? 'orange' : record.category === 'Imaging' ? 'blue' : 'purple'}`}>
                {record.category === 'Lab result' ? <Activity size={18} /> : record.category === 'Prescription' ? <Plus size={18} /> : record.category === 'Imaging' ? <FileText size={18} /> : <ClipboardList size={18} />}
              </div>
              <div className="record-main">
                <b>{record.title}</b>
                <span>
                  Patient: <strong>{record.patient?.name || 'Alex Morgan'}</strong> ({record.patient?.email}) · Clinician: {record.doctor?.name || 'Staff'} · Facility: <strong>{record.hospital?.name || hospitalName || 'Hospital'}</strong>
                  {record.sourceHospital && (
                    <em style={{ color: '#2d6a50', marginLeft: '6px' }}>
                      (Transferred from {record.sourceHospital?.name})
                    </em>
                  )}
                </span>
                {record.summary && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#5f7369' }}>{record.summary}</p>}
              </div>
              <span className="record-type">{record.category}</span>
              <span className="record-date">
                {new Date(record.recordedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Transfers & Record Sharing View
// ══════════════════════════════════════════════════════════════════════════════
function TransfersView({
  role,
  requests,
  hospitals,
  currentHospitalId,
  currentHospitalName,
  onAction,
  onRequest,
  onSend
}) {
  const isPatient = role === 'patient';
  const isHospital = role === 'hospital' || role === 'doctor';
  const isAdmin = role === 'admin';

  return (
    <>
      <PageTitle
        eyebrow="CROSS-HOSPITAL DATA PROTOCOL"
        title="Inter-Hospital Medical Record Transfers"
        subtitle={
          isPatient
            ? 'Authorize or revoke hospital access to your health history. Your consent is required before records leave any hospital.'
            : isHospital
              ? 'Request patient records from another facility, or securely dispatch records to a partner hospital.'
              : 'System-wide audit trail of all cross-hospital requests, transfers, and revocations.'
        }
      />

      <div className="share-disclosure">
        <ShieldCheck size={20} />
        <div>
          <b>Security & Isolation Enforced</b>
          <span>
            Hospitals cannot access another hospital’s records without an approved transfer. Transferred copies retain originating facility attribution and timestamps for clinical provenance.
          </span>
        </div>
      </div>

      {/* Hospital Transfer Initiation Tools */}
      {isHospital && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px' }}>
          {/* Request Form */}
          <form className="share-request-form" onSubmit={onRequest} style={{ margin: 0 }}>
            <div>
              <h2>Request Patient Data from Hospital</h2>
              <p>Request charts for a patient from another hospital.</p>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#4d6156' }}>
                Patient Account Email
                <input name="patientEmail" type="email" placeholder="alex.morgan@carelink.org" defaultValue="alex.morgan@carelink.org" required style={{ height: '36px', padding: '0 10px', border: '1px solid #d8e4dd', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'grid', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#4d6156' }}>
                Source Hospital
                <select name="sourceHospitalId" defaultValue="" required style={{ height: '36px', padding: '0 10px', border: '1px solid #d8e4dd', borderRadius: '6px' }}>
                  <option value="" disabled>Select source facility</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <button className="btn primary" type="submit">
                <Search size={14} /> Send Transfer Request
              </button>
            </div>
          </form>

          {/* Send Form */}
          <form className="share-request-form" onSubmit={onSend} style={{ margin: 0 }}>
            <div>
              <h2>Send Patient Data to Hospital</h2>
              <p>Directly transfer charts to a receiving facility.</p>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#4d6156' }}>
                Patient Account Email
                <input name="patientEmail" type="email" placeholder="alex.morgan@carelink.org" defaultValue="alex.morgan@carelink.org" required style={{ height: '36px', padding: '0 10px', border: '1px solid #d8e4dd', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'grid', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#4d6156' }}>
                Destination Hospital
                <select name="targetHospitalId" defaultValue="" required style={{ height: '36px', padding: '0 10px', border: '1px solid #d8e4dd', borderRadius: '6px' }}>
                  <option value="" disabled>Select destination hospital</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <button className="btn primary" type="submit" style={{ background: '#225540' }}>
                <Send size={14} /> Dispatch Records Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer History / Status List */}
      <section className="share-list">
        <div className="share-list-heading">
          <h2>{isPatient ? 'Your Data Permissions & Transfer Requests' : 'Network Transfer Requests & Transfers'}</h2>
          <span>{requests.length} Total</span>
        </div>

        {requests.length === 0 ? (
          <div className="share-empty">No active transfer requests or exchanges found.</div>
        ) : (
          requests.map(share => {
            const sourceName = share.sourceHospital?.name || 'Source Hospital';
            const targetName = share.targetHospital?.name || 'Target Hospital';
            const requestorName = share.requestedBy?.name || 'Medical Staff';

            return (
              <article className="share-item" key={share._id}>
                <div className="share-item-icon"><Share2 size={18} /></div>
                <div className="share-item-copy">
                  <b>
                    {isPatient
                      ? `${targetName} requested records from ${sourceName}`
                      : `${sourceName} ➔ ${targetName}`}
                  </b>
                  <span>
                    Patient: <strong>{share.patient?.name || 'Alex Morgan'}</strong> ({share.patient?.email}) · Requested by {requestorName}
                  </span>
                  {share.status === 'approved' && (
                    <small>
                      ✓ Transfer authorized. Records copied to receiving hospital chart.
                    </small>
                  )}
                </div>

                <span className={`share-status ${share.status}`}>{share.status.toUpperCase()}</span>

                <div className="share-item-actions">
                  {/* Patient Action Buttons */}
                  {isPatient && share.status === 'requested' && (
                    <>
                      <button className="btn secondary" onClick={() => onAction(share._id, 'reject')}>
                        Decline
                      </button>
                      <button className="btn primary" onClick={() => onAction(share._id, 'approve')}>
                        Approve Transfer
                      </button>
                    </>
                  )}
                  {isPatient && share.status === 'approved' && (
                    <button className="btn secondary" onClick={() => onAction(share._id, 'revoke')}>
                      Revoke Consent
                    </button>
                  )}

                  {/* Hospital Action Buttons */}
                  {isHospital && share.status === 'requested' && (
                    <>
                      <button className="btn secondary" onClick={() => onAction(share._id, 'reject')}>
                        Decline
                      </button>
                      <button className="btn primary" onClick={() => onAction(share._id, 'approve')}>
                        Authorize & Send
                      </button>
                    </>
                  )}
                  {isHospital && share.status === 'approved' && (
                    <button className="btn outline" onClick={() => onAction(share._id, 'sync')}>
                      <RefreshCw size={13} /> Re-sync
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Appointments View
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentsView({ appointments, role, onBook, onCancel }) {
  const [filter, setFilter] = useState('All visits');
  const filtered = appointments.filter(a => filter === 'All visits' || a.status === filter.toLowerCase());

  return (
    <>
      <PageTitle
        eyebrow="CLINICAL VISITS"
        title="Appointments"
        subtitle="Scheduled consultations, in-person visits, and specialist reviews."
        action={
          role === 'patient' && (
            <button className="btn primary" onClick={onBook}>
              <Plus size={16} /> Book Appointment
            </button>
          )
        }
      />

      <div className="filter-row">
        <div className="filter-tabs">
          {['All visits', 'Upcoming', 'Completed', 'Cancelled'].map(item => (
            <button
              key={item}
              className={filter === item ? 'selected' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="list-panel">
        {filtered.length === 0 ? (
          <div className="empty-state large">
            <CalendarDays size={28} />
            <h3>No visits found</h3>
            <p>Visits scheduled in the care network will be listed here.</p>
          </div>
        ) : (
          filtered.map(item => {
            const date = new Date(`${item.date}T12:00:00`);
            return (
              <div className="appointment-row" key={item.id}>
                <div className="row-date">
                  <b>{date.toLocaleDateString('en-US', { day: '2-digit' })}</b>
                  <span>{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
                <div className={`doctor-avatar ${item.tint}`}>{item.initials}</div>
                <div className="row-doctor">
                  <b>{item.doctor}</b>
                  <span>{item.specialty} {item.patientName && `· Patient: ${item.patientName}`}</span>
                </div>
                <div className="row-when">
                  <b>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</b>
                  <span><Clock3 size={13} /> {item.time} · {item.type}</span>
                </div>
                <span className={`status-pill ${item.status}`}>{item.status}</span>
                {item.status === 'upcoming' && (
                  <button className="row-action" onClick={() => onCancel(item.id)}>
                    Cancel Visit
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Doctors Directory View
// ══════════════════════════════════════════════════════════════════════════════
function DoctorsView({ doctors, query, setQuery, specialty, setSpecialty, onBook }) {
  const specialties = ['All specialties', ...new Set(doctors.map(d => d.specialty).filter(Boolean))];

  const filtered = doctors.filter(d => {
    const matchQ = (d.name || '').toLowerCase().includes(query.toLowerCase()) ||
                   (d.specialty || '').toLowerCase().includes(query.toLowerCase()) ||
                   (d.hospitalName || '').toLowerCase().includes(query.toLowerCase());
    const matchS = specialty === 'All specialties' || d.specialty === specialty;
    return matchQ && matchS;
  });

  return (
    <>
      <PageTitle
        eyebrow="HEALTHCARE PROVIDERS"
        title="Find a Clinician"
        subtitle="Network clinicians and specialists across registered hospitals."
      />

      <div className="doctor-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by physician name, specialty, or hospital facility…"
          aria-label="Search clinicians"
        />
      </div>

      <div className="filter-row doctor-filters">
        <div className="filter-tabs specialty-tabs">
          {specialties.map(s => (
            <button
              key={s}
              className={specialty === s ? 'selected' : ''}
              onClick={() => setSpecialty(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="results-count">{filtered.length} Clinicians</span>
      </div>

      <div className="doctor-grid">
        {filtered.map(doc => (
          <article className="doctor-card" key={doc.id}>
            <div className="doctor-card-top">
              <div className="doctor-portrait lavender">
                {(doc.name || 'DR').split(' ').slice(-2).map(p => p[0]).join('').toUpperCase()}
              </div>
            </div>
            <div className="doctor-info">
              <h3>{doc.name}</h3>
              <span className="doctor-specialty">{doc.specialty} · {doc.credentials || 'MD'}</span>
              <div style={{ fontSize: '10px', color: '#316952', fontWeight: 600, marginTop: '4px' }}>
                🏥 {doc.hospitalName || 'Affiliated Hospital'}
              </div>
              <div className="availability">
                <i /> Available for Consultations
              </div>
              <button className="btn outline full" onClick={() => onBook(doc)}>
                Book Appointment <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Admin: Hospital Directory & Registration
// ══════════════════════════════════════════════════════════════════════════════
function AdminHospitalsView({ hospitals, session, notify, onRefresh }) {
  const [newHospitalName, setNewHospitalName] = useState('');
  const [busy, setBusy] = useState(false);

  const addHospital = async (e) => {
    e.preventDefault();
    if (!newHospitalName.trim()) return;
    setBusy(true);
    try {
      const res = await apiRequest('/hospitals', session, {
        method: 'POST',
        body: JSON.stringify({ name: newHospitalName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to register hospital.');
      notify(`Registered hospital: ${data.hospital.name}`);
      setNewHospitalName('');
      onRefresh();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="FACILITY MANAGEMENT"
        title="Hospital & Clinic Directory"
        subtitle="Manage participating healthcare facilities in the CareLink network."
      />

      {/* Add New Hospital Form */}
      <form className="share-request-form" onSubmit={addHospital} style={{ marginBottom: '24px' }}>
        <h2>Register New Hospital or Clinic</h2>
        <p>Enroll a new healthcare organization with separate isolated chart vaults.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newHospitalName}
            onChange={(e) => setNewHospitalName(e.target.value)}
            placeholder="e.g. St. Jude Regional Hospital"
            required
            style={{ flex: 1, height: '38px', padding: '0 12px', border: '1px solid #d4e0d9', borderRadius: '7px' }}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            <Plus size={15} /> {busy ? 'Registering...' : 'Add Hospital'}
          </button>
        </div>
      </form>

      {/* Hospitals List */}
      <div className="list-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Hospital / Clinic Name</th>
              <th>Facility ID</th>
              <th>Registered Staff / Doctors</th>
              <th>Enrolled Date</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td>
                  <strong>🏥 {h.name}</strong>
                </td>
                <td><code>{h.id}</code></td>
                <td>
                  <span className="user-role-badge hospital">{h.memberCount || 0} Staff Members</span>
                </td>
                <td>{new Date(h.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Admin: User Accounts Directory
// ══════════════════════════════════════════════════════════════════════════════
function AdminUsersView({ users }) {
  return (
    <>
      <PageTitle
        eyebrow="IDENTITY & ACCESS"
        title="User Account Directory"
        subtitle="All registered accounts across patients, hospital staff, clinicians, and administrators."
      />

      <div className="list-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Assigned Hospital</th>
              <th>Account Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>
                  <span className={`user-role-badge ${u.role}`}>{u.role.toUpperCase()}</span>
                </td>
                <td>
                  {u.hospitalName ? (
                    <span className="hospital-tag-pill">🏥 {u.hospitalName}</span>
                  ) : (
                    <span style={{ color: '#97a69e' }}>—</span>
                  )}
                </td>
                <td>
                  <span style={{ color: u.isActive !== false ? '#2d6d4e' : '#b23d2e', fontWeight: 600 }}>
                    {u.isActive !== false ? '● Active' : '✕ Disabled'}
                  </span>
                </td>
                <td>{new Date(u.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════════════════════════════════════
function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <section className="page-title-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, note, tone, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
        <span className="stat-trend">{trend}</span>
      </div>
      <div className="stat-number">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export default App;
