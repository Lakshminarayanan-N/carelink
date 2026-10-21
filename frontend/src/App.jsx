import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, Bell, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3,
  FileHeart, FileText, Heart, HeartPulse, LayoutDashboard, LogOut, Menu,
  MessageCircle, MoreHorizontal, Plus, RefreshCw, Search, Settings, Share2,
  ShieldCheck, Sparkles, Stethoscope, UserRound, Users, Video, X
} from 'lucide-react';

const doctors = [
  { id: 'd1', name: 'Dr. Maya Chen', specialty: 'Cardiology', credentials: 'MD, FACC', rating: '4.9', reviews: 128, initials: 'MC', tint: 'lavender', next: 'Today, 2:30 PM', available: true },
  { id: 'd2', name: 'Dr. James Wilson', specialty: 'Primary care', credentials: 'MD', rating: '4.8', reviews: 96, initials: 'JW', tint: 'blue', next: 'Tomorrow, 9:00 AM', available: true },
  { id: 'd3', name: 'Dr. Priya Nair', specialty: 'Dermatology', credentials: 'MD, FAAD', rating: '5.0', reviews: 84, initials: 'PN', tint: 'peach', next: 'Oct 24, 11:15 AM', available: true },
  { id: 'd4', name: 'Dr. Sofia Martinez', specialty: 'Pediatrics', credentials: 'MD, FAAP', rating: '4.9', reviews: 112, initials: 'SM', tint: 'mint', next: 'Oct 25, 10:30 AM', available: false }
];
const baseAppointments = [
  { id: 'a1', doctor: 'Dr. Maya Chen', specialty: 'Cardiology', date: '2026-10-23', time: '10:30 AM', type: 'In person', status: 'upcoming', initials: 'MC', tint: 'lavender' },
  { id: 'a2', doctor: 'Dr. James Wilson', specialty: 'Primary care', date: '2026-10-28', time: '2:00 PM', type: 'Video visit', status: 'upcoming', initials: 'JW', tint: 'blue' },
  { id: 'a3', doctor: 'Dr. Priya Nair', specialty: 'Dermatology', date: '2026-10-09', time: '9:15 AM', type: 'In person', status: 'completed', initials: 'PN', tint: 'peach' }
];
const records = [
  { title: 'Annual wellness visit', category: 'Visit summary', date: 'Oct 09, 2026', detail: 'Dr. Priya Nair', icon: 'visit', color: 'purple' },
  { title: 'Complete blood count', category: 'Lab result', date: 'Sep 28, 2026', detail: 'Northstar Diagnostics', icon: 'lab', color: 'green' },
  { title: 'Vitamin D supplement', category: 'Prescription', date: 'Sep 14, 2026', detail: 'Dr. James Wilson', icon: 'rx', color: 'orange' },
  { title: 'Chest X-ray', category: 'Imaging', date: 'Aug 21, 2026', detail: 'Northstar Imaging', icon: 'image', color: 'blue' }
];
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, count: '2' },
  { id: 'doctors', label: 'Find a doctor', icon: Stethoscope },
  { id: 'records', label: 'Health records', icon: FileHeart },
  { id: 'sharing', label: 'Record sharing', icon: Share2 }
];
const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const apiRequest = (path, session, options = {}) => fetch(`${API_ROOT}${path}`, {
  ...options,
  headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) }
});

function App() {
  const [page, setPage] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All specialties');
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [toast, setToast] = useState('');
  const [careDoctors, setCareDoctors] = useState(doctors);
  const [healthRecords, setHealthRecords] = useState(records);
  const [shareRequests, setShareRequests] = useState([]);
  const [shareHospitals, setShareHospitals] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('carelink-session')) || null; } catch { return null; }
  });
  const [appointments, setAppointments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('carelink-appointments')) || baseAppointments; } catch { return baseAppointments; }
  });

  const filteredDoctors = useMemo(() => careDoctors.filter((doctor) =>
    (doctor.name.toLowerCase().includes(query.toLowerCase()) || doctor.specialty.toLowerCase().includes(query.toLowerCase())) &&
    (specialty === 'All specialties' || doctor.specialty === specialty)), [query, specialty, careDoctors]);
  const upcoming = appointments.filter((item) => item.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date));
  const visibleAppointments = appointments.filter((item) => page === 'appointments' ? true : item.status === 'upcoming');

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const persistAppointments = (next) => { setAppointments(next); localStorage.setItem('carelink-appointments', JSON.stringify(next)); };
  const hydrateFromApi = async (currentSession) => {
    try {
      const [doctorResponse, appointmentResponse, recordResponse, shareResponse, hospitalResponse] = await Promise.all([
        apiRequest('/doctors', currentSession),
        apiRequest('/appointments', currentSession),
        apiRequest('/records', currentSession),
        apiRequest('/shares', currentSession),
        fetch(`${API_ROOT}/hospitals`)
      ]);
      if (doctorResponse.ok) {
        const result = await doctorResponse.json();
        if (result.doctors?.length) setCareDoctors(result.doctors.map((doctor, index) => ({ ...doctor, id: doctor.id, credentials: doctor.credentials || 'MD', rating: '4.9', reviews: 0, initials: doctor.name.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase(), tint: ['lavender', 'blue', 'peach', 'mint'][index % 4], next: 'Schedule a visit', available: true })));
      }
      if (appointmentResponse.ok) {
        const result = await appointmentResponse.json();
        const mapped = (result.appointments || []).map((item) => ({ id: item._id, isApi: true, doctorId: item.doctor?._id, doctor: item.doctor?.name || 'Your clinician', specialty: item.doctor?.specialty || 'Care team', date: item.date?.slice(0, 10), time: new Date(item.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), type: item.type, status: item.status, initials: (item.doctor?.name || 'CL').split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase(), tint: 'mint' }));
        persistAppointments(mapped);
      }
      if (recordResponse.ok) {
        const result = await recordResponse.json();
        if (result.records) setHealthRecords(result.records.map((record) => ({ title: record.title, category: record.category, date: new Date(record.recordedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), detail: record.doctor?.name || 'CareLink record', sourceHospital: record.sourceHospital?.name, icon: record.category === 'Lab result' ? 'lab' : record.category === 'Prescription' ? 'rx' : record.category === 'Imaging' ? 'image' : 'visit', color: record.category === 'Lab result' ? 'green' : record.category === 'Prescription' ? 'orange' : record.category === 'Imaging' ? 'blue' : 'purple' })));
      }
      if (shareResponse.ok) {
        const result = await shareResponse.json();
        setShareRequests(result.shares || []);
      } else {
        notify('Your record-sharing requests could not be loaded.');
      }
      if (hospitalResponse.ok) {
        const result = await hospitalResponse.json();
        setShareHospitals(result.hospitals || []);
      }
    } catch { notify('Your account is connected, but some details could not be loaded.'); }
  };
  const sessionToken = session?.token;
  useEffect(() => { if (sessionToken) hydrateFromApi(session); }, [sessionToken]);
  const book = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosen = bookingDoctor || careDoctors.find((doctor) => doctor.id === form.get('doctor'));
    if (!chosen) return;
    const day = form.get('date');
    const time = form.get('time');
    const finish = () => {
      const next = [{ id: `a${Date.now()}`, doctor: chosen.name, specialty: chosen.specialty, date: day, time, type: form.get('type'), status: 'upcoming', initials: chosen.initials, tint: chosen.tint }, ...appointments];
      persistAppointments(next); setShowBooking(false); setBookingDoctor(null); notify('Your appointment is booked. We’ll send you a reminder.'); setPage('appointments');
    };
    if (session?.token) {
      const clock = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      let hour = Number(clock?.[1] || 9) % 12; if (clock?.[3]?.toUpperCase() === 'PM') hour += 12;
      const dateTime = new Date(`${day}T${String(hour).padStart(2, '0')}:${clock?.[2] || '00'}:00`);
      apiRequest('/appointments', session, { method: 'POST', body: JSON.stringify({ doctorId: chosen.id, date: dateTime.toISOString(), reason: form.get('reason'), type: form.get('type') }) })
        .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to book this visit.'); notify('Your appointment is booked.'); setShowBooking(false); setBookingDoctor(null); setPage('appointments'); hydrateFromApi(session); })
        .catch((error) => notify(error.message));
    } else finish();
  };
  const cancel = (id) => {
    if (session?.token && appointments.find((item) => item.id === id)?.isApi) {
      apiRequest(`/appointments/${id}/cancel`, session, { method: 'PATCH' }).then(async (response) => {
        const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to cancel this visit.');
        notify('Appointment cancelled.'); hydrateFromApi(session);
      }).catch((error) => notify(error.message));
      return;
    }
    persistAppointments(appointments.map((item) => item.id === id ? { ...item, status: 'cancelled' } : item));
    notify('Appointment cancelled.');
  };
  const startBooking = (doctor = null) => { setBookingDoctor(doctor); setShowBooking(true); };
  const go = (id) => { setPage(id); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const updateShare = async (id, action) => {
    try {
      const method = action === 'sync' ? 'POST' : 'PATCH';
      const response = await apiRequest(`/shares/${id}/${action}`, session, { method });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to update this record transfer.');
      if (action === 'approve') notify(`Approved. ${result.importedCount} record${result.importedCount === 1 ? '' : 's'} imported from the source hospital.`);
      else if (action === 'sync') notify(`${result.importedCount} new record${result.importedCount === 1 ? '' : 's'} imported.`);
      else if (action === 'revoke') notify('Access revoked. Copies already imported by this hospital remain in its chart.');
      else if (action === 'reject') notify('Transfer request declined.');
      await hydrateFromApi(session);
    } catch (error) { notify(error.message); }
  };
  const requestShare = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await apiRequest('/shares', session, {
        method: 'POST',
        body: JSON.stringify({ patientEmail: form.get('patientEmail'), sourceHospitalId: form.get('sourceHospitalId') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to request these records.');
      formElement.reset();
      notify('Request sent. Records are transferred only if the patient approves.');
      await hydrateFromApi(session);
    } catch (error) { notify(error.message); }
  };
  const visibleNav = nav.filter((item) => item.id !== 'sharing' || ['patient', 'doctor'].includes(session?.user?.role));

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><HeartPulse size={21} strokeWidth={2.5} /></div><span>carelink</span><button className="mobile-close icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
      <div className="workspace-label">YOUR SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {visibleNav.map(({ id, label, icon: Icon, count }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18} /><span>{label}</span>{count && <span className="nav-count">{count}</span>}</button>)}
      </nav>
      <div className="sidebar-divider" />
      <div className="workspace-label">YOUR CARE TEAM</div>
      <button className="team-link" onClick={() => go('doctors')}><div className="tiny-avatars"><span className="mini-face lavender">MC</span><span className="mini-face blue">JW</span><span className="mini-face peach">PN</span></div><span>My care team</span><ChevronRight size={15} /></button>
      <div className="sidebar-bottom">
        <div className="support-card"><div className="support-orb"><Heart size={17} /></div><p>Here for your health.</p><span>Questions? Our care team is one tap away.</span><button onClick={() => notify('Your care team will be in touch soon.')}>Get support <ArrowRight size={14} /></button></div>
        <button className="nav-item quiet" onClick={() => notify('Help center is coming soon.')}><CircleHelp size={18} /><span>Help center</span></button>
        <button className="profile-mini" onClick={() => session ? (localStorage.removeItem('carelink-session'), setSession(null), setPage('overview'), setShareRequests([]), setHealthRecords(records), notify('You’re signed out.')) : setShowAuth(true)}><div className="patient-avatar">{(session?.user?.name || 'Alex Morgan').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="profile-copy"><b>{session?.user?.name || 'Alex Morgan'}</b><span>{session?.user?.role || 'Demo patient'} · {session ? 'Sign out' : 'Sign in to sync'}</span></div><MoreHorizontal size={19} /></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb">CareLink <ChevronRight size={14} /> <strong>{nav.find((item) => item.id === page)?.label || 'My health'}</strong></div><div className="top-actions"><div className="secure-label"><ShieldCheck size={15} /> Your health data is private</div><div className="notification-wrap"><button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18} /><i /></button>{showNotifications && <div className="notification-pop"><div className="pop-title">Notifications <span>2 new</span></div><div className="notice"><div className="notice-icon green-bg"><CalendarDays size={16} /></div><div><b>Appointment confirmed</b><p>Dr. Maya Chen · Oct 23 at 10:30 AM</p><small>Today · 9:14 AM</small></div></div><div className="notice"><div className="notice-icon purple-bg"><FileText size={16} /></div><div><b>New health record</b><p>Your blood work is ready to view.</p><small>Yesterday · 4:20 PM</small></div></div></div>}</div><button className="top-avatar" onClick={() => notify('Profile settings are coming soon.')}>AL</button></div></header>

      <div className="page-content">
        {page === 'overview' && <Overview appointments={upcoming} onBook={() => startBooking()} onGo={go} onCancel={cancel} />}
        {page === 'appointments' && <Appointments appointments={visibleAppointments} onBook={() => startBooking()} onCancel={cancel} />}
        {page === 'doctors' && <Doctors query={query} setQuery={setQuery} specialty={specialty} setSpecialty={setSpecialty} doctors={filteredDoctors} onBook={startBooking} />}
        {page === 'records' && <Records records={healthRecords} />}
        {page === 'sharing' && <ShareRecords role={session?.user?.role} hospitalId={session?.user?.hospitalId} requests={shareRequests} hospitals={shareHospitals} onAction={updateShare} onRequest={requestShare} />}
      </div>
    </main>

    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    {showBooking && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowBooking(false); }}><form className="booking-modal" onSubmit={book}><div className="modal-head"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>Book an appointment</h2><p>Find a time that works for you.</p></div><button type="button" className="icon-btn" onClick={() => setShowBooking(false)} aria-label="Close"><X size={20} /></button></div><label>Choose a clinician<select name="doctor" defaultValue={bookingDoctor?.id || ''} required><option value="" disabled>Select a doctor</option>{careDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}</select></label><div className="form-grid"><label>Date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue="2026-10-23" required /></label><label>Time<select name="time" defaultValue="10:30 AM"><option>9:00 AM</option><option>10:30 AM</option><option>11:15 AM</option><option>1:00 PM</option><option>2:30 PM</option><option>3:45 PM</option></select></label></div><label>Visit type<select name="type"><option>In person</option><option>Video visit</option></select></label><label>What would you like to discuss?<textarea name="reason" placeholder="Share anything that will help your care team prepare…" rows="3" /></label><div className="modal-note"><ShieldCheck size={16} /> Your appointment details are kept private.</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setShowBooking(false)}>Cancel</button><button type="submit" className="btn primary">Confirm appointment <ArrowRight size={16} /></button></div></form></div>}
    {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(value) => { localStorage.setItem('carelink-session', JSON.stringify(value)); setSession(value); setShowAuth(false); notify(`Welcome to CareLink, ${value.user.name.split(' ')[0]}.`); }} />}
    {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
  </div>;
}

function Overview({ appointments, onBook, onGo, onCancel }) {
  const next = appointments[0];
  const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return <>
    <section className="welcome-row"><div><div className="eyebrow">WEDNESDAY, OCTOBER 21, 2026 <span className="sun-dot">✦</span></div><h1>Good morning, Alex <span className="wave">✦</span></h1><p className="welcome-sub">A little check-in can go a long way. How are you feeling today?</p></div><button className="btn primary book-top" onClick={onBook}><Plus size={17} /> Book appointment</button></section>
    <section className="hero-card"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={15} /> YOUR HEALTH, IN ONE PLACE</div><h2>Care that moves<br />with <em>you.</em></h2><p>Your care team, appointments, and health records—all connected in one calm, easy space.</p><button className="hero-link" onClick={() => onGo('records')}>Explore your health records <ArrowRight size={16} /></button></div><div className="hero-visual"><div className="hero-sun" /><div className="hero-arc arc-one" /><div className="hero-arc arc-two" /><div className="hero-heart"><HeartPulse size={44} strokeWidth={1.4} /></div><div className="floating-note note-a"><span className="note-check"><Check size={12} /></span><span>Care, all connected</span></div><div className="floating-note note-b"><span className="note-wave">↗</span><span>Feeling better, daily</span></div><div className="hero-star star-a">✳</div><div className="hero-star star-b">✦</div><div className="hero-dot dot-a" /><div className="hero-dot dot-b" /></div></section>
    <section className="section-heading"><div><span className="eyebrow">YOUR HEALTH AT A GLANCE</span><h2>A healthier picture</h2></div><button className="text-link" onClick={() => onGo('records')}>View health summary <ArrowRight size={15} /></button></section>
    <section className="stat-grid"><StatCard icon={CalendarDays} label="Upcoming visits" value={String(appointments.length).padStart(2, '0')} note="You’re right on track" tone="mint" trend="↗" /><StatCard icon={Activity} label="Health records" value="12" note="Updated this month" tone="lavender" trend="+2" /><StatCard icon={Heart} label="Care team" value="04" note="People in your corner" tone="peach" trend={<span className="stat-avatars"><i>MC</i><i>JW</i><i>+2</i></span>} /></section>
    <section className="content-grid"><div className="panel appointment-panel"><div className="panel-header"><div><div className="panel-eyebrow">COMING UP</div><h3>Your next appointment</h3></div><button className="more-button" onClick={() => onGo('appointments')} aria-label="View all appointments">···</button></div>{next ? <div className="next-appointment"><div className="date-tile"><b>{dateLabel(next.date).split(' ')[0]}</b><strong>{dateLabel(next.date).split(' ')[1]}</strong><span>{new Date(`${next.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span></div><div className="doctor-summary"><div className={`doctor-avatar ${next.tint}`}>{next.initials}</div><div><h4>{next.doctor}</h4><span>{next.specialty}</span><div className="appointment-meta"><span><Clock3 size={13} /> {next.time}</span><span>{next.type === 'Video visit' ? <Video size={13} /> : <Users size={13} />} {next.type}</span></div></div></div><button className="icon-btn appointment-arrow" onClick={() => onGo('appointments')} aria-label="View appointment"><ArrowRight size={18} /></button></div> : <div className="empty-state"><CalendarDays size={25} /><p>No visits scheduled just yet.</p><button className="text-link" onClick={onBook}>Find a time <ArrowRight size={14} /></button></div>}<div className="panel-footer"><button onClick={() => onGo('appointments')}>See all appointments <ArrowRight size={14} /></button><span className="footer-status"><i /> All caught up</span></div></div>
      <div className="panel care-panel"><div className="panel-header"><div><div className="panel-eyebrow">A GENTLE NUDGE</div><h3>Small steps, big care</h3></div><div className="care-icon"><Heart size={17} /></div></div><p className="care-copy">Your annual wellness visit is coming up. It’s a good moment to check in, ask questions, and celebrate how far you’ve come.</p><div className="care-progress"><div className="progress-label"><span>Yearly check-in</span><b>1 of 2 visits</b></div><div className="progress-track"><i /></div></div><button className="care-action" onClick={onBook}>Schedule a wellness visit <ArrowRight size={15} /></button></div></section>
    <section className="bottom-callout"><div className="callout-icon"><MessageCircle size={19} /></div><div><b>Need a hand with something?</b><span>Your care team is here to help you feel your best.</span></div><button onClick={() => window.alert('Your care team will be in touch soon.')}>Message the team <ArrowRight size={14} /></button></section>
  </>;
}

function StatCard({ icon: Icon, label, value, note, tone, trend }) {
  return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><span className="stat-trend">{trend}</span></div><div className="stat-number">{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></div>;
}

function Appointments({ appointments, onBook, onCancel }) {
  const [filter, setFilter] = useState('All visits');
  const filtered = appointments.filter((item) => filter === 'All visits' || item.status === filter.toLowerCase());
  return <><PageTitle eyebrow="YOUR CARE, ON YOUR TIME" title="Appointments" subtitle="Keep your visits in view and make room for what matters." action={<button className="btn primary" onClick={onBook}><Plus size={17} /> Book appointment</button>} /><div className="filter-row"><div className="filter-tabs">{['All visits', 'Upcoming', 'Completed', 'Cancelled'].map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="date-filter"><CalendarDays size={15} /> All dates <ChevronDown size={14} /></button></div><div className="list-panel">{filtered.length ? filtered.map((item) => <AppointmentRow key={item.id} item={item} onCancel={onCancel} />) : <div className="empty-state large"><CalendarDays size={28} /><h3>Nothing on the calendar</h3><p>When you book a visit, you’ll find it here.</p><button className="btn primary" onClick={onBook}><Plus size={16} /> Book a visit</button></div>}</div><div className="appointment-tip"><div className="tip-icon"><Bell size={17} /></div><span><b>A friendly reminder</b> We’ll give you a heads-up before each upcoming visit.</span><CheckCircle2 size={17} /></div></>;
}

function AppointmentRow({ item, onCancel }) {
  const date = new Date(`${item.date}T12:00:00`);
  return <div className="appointment-row"><div className="row-date"><b>{date.toLocaleDateString('en-US', { day: '2-digit' })}</b><span>{date.toLocaleDateString('en-US', { month: 'short' })}</span></div><div className={`doctor-avatar ${item.tint}`}>{item.initials}</div><div className="row-doctor"><b>{item.doctor}</b><span>{item.specialty}</span></div><div className="row-when"><b>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</b><span><Clock3 size={13} /> {item.time} <i /> {item.type}</span></div><span className={`status-pill ${item.status}`}>{item.status}</span>{item.status === 'upcoming' && <button className="row-action" onClick={() => onCancel(item.id)}>Cancel visit</button>}{item.status !== 'upcoming' && <button className="row-action muted-action">View details</button>}</div>;
}

function Doctors({ query, setQuery, specialty, setSpecialty, doctors: visibleDoctors, onBook }) {
  const specialties = ['All specialties', ...new Set(doctors.map((doctor) => doctor.specialty))];
  return <><PageTitle eyebrow="PEOPLE WHO CARE" title="Find your doctor" subtitle="Meet your care team and find the right person for you." /><div className="doctor-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or specialty…" aria-label="Search doctors" /><kbd>⌘ K</kbd></div><div className="filter-row doctor-filters"><div className="filter-tabs specialty-tabs">{specialties.map((item) => <button key={item} className={specialty === item ? 'selected' : ''} onClick={() => setSpecialty(item)}>{item}</button>)}</div><span className="results-count">{visibleDoctors.length} clinicians</span></div><div className="doctor-grid">{visibleDoctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} onBook={onBook} />)}</div>{visibleDoctors.length === 0 && <div className="empty-state large"><Search size={27} /><h3>No clinicians found</h3><p>Try a different name or specialty.</p></div>}<div className="care-match"><div className="match-icon"><Sparkles size={19} /></div><div><b>Not sure where to start?</b><span>Our care coordinators can help you find the right specialist.</span></div><button onClick={() => window.alert('A care coordinator will be in touch soon.')}>Talk to a coordinator <ArrowRight size={15} /></button></div></>;
}

function DoctorCard({ doctor, onBook }) {
  return <article className="doctor-card"><div className="doctor-card-top"><div className={`doctor-portrait ${doctor.tint}`}>{doctor.initials}</div><button className="save-doctor" aria-label={`Save ${doctor.name}`} onClick={(event) => { event.currentTarget.classList.toggle('saved'); event.currentTarget.textContent = event.currentTarget.classList.contains('saved') ? '♥' : '♡'; }}>♡</button></div><div className="doctor-info"><h3>{doctor.name}</h3><span className="doctor-specialty">{doctor.specialty} <i /> {doctor.credentials}</span><div className="doctor-rating"><span>★ {doctor.rating}</span><small>({doctor.reviews} patient reviews)</small></div><div className="availability"><i /> Next available <b>{doctor.next}</b></div><button className="btn outline full" onClick={() => onBook(doctor)}>View availability <ArrowRight size={15} /></button></div></article>;
}

function Records({ records: visibleRecords }) {
  const [recordFilter, setRecordFilter] = useState('All records');
  const filtered = visibleRecords.filter((record) => recordFilter === 'All records' || record.category === recordFilter);
  const colorClass = (color) => `record-icon ${color}`;
  return <><PageTitle eyebrow="YOUR STORY, WELL KEPT" title="Health records" subtitle="Your health information, organized and always within reach." action={<button className="btn outline" onClick={() => window.alert('Record uploads are available after connecting your CareLink account.')}><Plus size={16} /> Add a record</button>} /><div className="record-summary"><div className="record-summary-icon"><FileHeart size={21} /></div><div><b>Your health, in one place</b><span>12 records securely stored and ready whenever you need them.</span></div><div className="record-summary-right"><ShieldCheck size={15} /> Private & secure</div></div><div className="filter-row record-filter-row"><div className="filter-tabs">{['All records', 'Visit summary', 'Lab result', 'Prescription', 'Imaging'].map((item) => <button key={item} className={recordFilter === item ? 'selected' : ''} onClick={() => setRecordFilter(item)}>{item === 'Visit summary' ? 'Visits' : item === 'Lab result' ? 'Lab results' : item === 'Prescription' ? 'Prescriptions' : item === 'All records' ? 'All records' : item}</button>)}</div><button className="date-filter"><ArrowDown size={14} /> Newest first</button></div><div className="records-list">{filtered.map((record) => <div className="record-row" key={record.title}><div className={colorClass(record.color)}>{record.icon === 'lab' ? <Activity size={18} /> : record.icon === 'rx' ? <Plus size={18} /> : record.icon === 'image' ? <FileText size={18} /> : <ClipboardList size={18} />}</div><div className="record-main"><b>{record.title}</b><span>{record.sourceHospital ? `Imported from ${record.sourceHospital}` : record.detail}</span></div><span className="record-type">{record.category}</span><span className="record-date">{record.date}</span><button className="record-open" onClick={() => window.alert(`${record.title}\n${record.category} · ${record.date}\n\nThis demo record is available as a sample.`)} aria-label={`Open ${record.title}`}><ArrowRight size={17} /></button></div>)}</div><div className="records-note"><ShieldCheck size={17} /><span>Your records are only shared with the clinicians you choose.</span><button onClick={() => window.alert('Sharing preferences are coming soon.')}>Manage sharing <ArrowRight size={14} /></button></div></>;
}

function ShareRecords({ role, hospitalId, requests, hospitals, onAction, onRequest }) {
  const isPatient = role === 'patient';
  const availableHospitals = hospitals.filter((hospital) => hospital.id !== hospitalId);
  const statusLabel = { requested: 'Awaiting your decision', approved: 'Active', rejected: 'Declined', revoked: 'Revoked' };

  return <>
    <PageTitle
      eyebrow="YOUR RECORDS, YOUR CHOICE"
      title="Record sharing"
      subtitle={isPatient ? 'Review hospital requests and control who can receive your records.' : 'Request patient-approved records from another hospital.'}
    />
    <div className="share-disclosure">
      <ShieldCheck size={19} />
      <div><b>Patient approval is required</b><span>Only records from the hospital selected in a request are copied. Copies already received remain in the receiving hospital’s chart if access is later revoked.</span></div>
    </div>
    {!isPatient && <form className="share-request-form" onSubmit={onRequest}>
      <div><h2>Request records</h2><p>The patient will receive a request in CareLink and must approve before any records are transferred.</p></div>
      {!hospitalId
        ? <p className="share-empty">This clinician account is not assigned to a hospital yet. Ask an administrator to update the account.</p>
        : <div className="share-form-fields">
          <label>Patient CareLink email<input name="patientEmail" type="email" autoComplete="email" placeholder="patient@example.com" required /></label>
          <label>Hospital holding the records<select name="sourceHospitalId" defaultValue="" required><option value="" disabled>Select a hospital</option>{availableHospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select></label>
          <button className="btn primary" type="submit">Send request <ArrowRight size={15} /></button>
          {availableHospitals.length === 0 && <span className="share-empty">No other hospitals are registered yet.</span>}
        </div>}
    </form>}
    <section className="share-list">
      <div className="share-list-heading"><h2>{isPatient ? 'Requests and permissions' : 'Hospital transfer requests'}</h2><span>{requests.length} total</span></div>
      {requests.length === 0
        ? <div className="share-empty">No record-sharing requests yet.</div>
        : requests.map((share) => {
          const sourceName = share.sourceHospital?.name || 'Source hospital';
          const targetName = share.targetHospital?.name || 'Receiving hospital';
          const requestorName = share.requestedBy?.name || 'A clinician';
          return <article className="share-item" key={share._id}>
            <div className="share-item-icon"><Share2 size={18} /></div>
            <div className="share-item-copy">
              <b>{isPatient ? `${requestorName} at ${targetName} requests your records` : `${sourceName} → ${targetName}`}</b>
              <span>{isPatient ? `All records from ${sourceName}` : `All records from ${sourceName} · Requested by ${requestorName}`}</span>
              {share.status === 'approved' && <small>Access stays active until you revoke it. Copies already imported remain in the receiving hospital’s chart.</small>}
            </div>
            <span className={`share-status ${share.status}`}>{statusLabel[share.status] || share.status}</span>
            <div className="share-item-actions">
              {isPatient && share.status === 'requested' && <>
                <button className="btn secondary" onClick={() => onAction(share._id, 'reject')}>Decline</button>
                <button className="btn primary" onClick={() => onAction(share._id, 'approve')}>Approve & import</button>
              </>}
              {isPatient && share.status === 'approved' && <button className="btn secondary" onClick={() => onAction(share._id, 'revoke')}>Revoke access</button>}
              {!isPatient && share.status === 'approved' && <button className="btn outline" onClick={() => onAction(share._id, 'sync')}><RefreshCw size={14} /> Import new records</button>}
            </div>
          </article>;
        })}
    </section>
  </>;
}

function PageTitle({ eyebrow, title, subtitle, action }) {
  return <section className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</section>;
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to sign in right now.');
      onSuccess(result);
    } catch (err) {
      setError(err.message.includes('Failed to fetch') ? 'CareLink API is not connected yet. You can keep exploring in demo mode.' : err.message);
    } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="booking-modal auth-modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">CARE, CONNECTED</span><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Sign in to sync your care across devices.' : 'Start keeping your care in one place.'}</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{mode === 'register' && <label>Your name<input name="name" placeholder="Alex Morgan" autoComplete="name" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength="8" placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>{mode === 'register' && <label>Phone (optional)<input name="phone" type="tel" placeholder="Your phone number" autoComplete="tel" /></label>}{error && <div className="auth-error">{error}</div>}<div className="modal-actions"><button type="button" className="text-link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'I already have an account'}</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></button></div><div className="modal-note"><ShieldCheck size={16} /> Your health information is protected by your account.</div></form></div>;
}

export default App;
