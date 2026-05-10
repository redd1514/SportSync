import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity, Calendar, Inbox, Shield, Menu, X, LogOut,
  MapPin, AlertTriangle, Check, Plus, Bell, Users,
  DollarSign, Clock, UserCheck, Map, ChevronLeft, ChevronRight, CheckCircle,
  QrCode, Search, ShieldCheck, ScanLine, Building2, GraduationCap,
  Megaphone, XCircle, MessageSquare, User, Layers, Phone, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '../../contexts/UserContext';
import { useCoaching } from '../../contexts/CoachingContext';
import { useAnnouncements } from '../../contexts/AnnouncementsContext';
import { AdminBookingCalendar } from './AdminBookingCalendar';
import { useStaffAPI } from '../../hooks/useStaffAPI';
import { useBookingAPI } from '../../hooks/useBookingAPI';
import { ALL_COURTS, SPORTS_INFO } from '../sportsData';
import { useFacilityMap, getSportMapColor } from '../../contexts/FacilityMapContext';
import type { CourtBlock } from '../../contexts/FacilityMapContext';
import { getSportColor, SportIcon } from '../SportIcons';
import { FacilityMapViewer } from '../shared/FacilityMapViewer';
import { CustomDateTimePicker } from '../shared/CustomDateTimePicker';
import { StaffInbox } from './StaffInbox';

type StaffTab = 'operations' | 'calendar' | 'inbox';

const STAFF_TABS: { id: StaffTab; icon: any; label: string; sub: string }[] = [
  { id: 'operations', icon: Activity,  label: 'Live Operations',   sub: 'Courts, Real-time status' },
  { id: 'calendar',   icon: Calendar,  label: 'Master Calendar',   sub: 'Bookings, Scheduling' },
  { id: 'inbox',      icon: Inbox,     label: 'Front Desk Inbox',  sub: 'Requests, Coaching, Alerts' },
];

/* ─── Confirm Dialog ─────────────────────────────────────────────── */
interface ConfirmOptions {
  title: string; body: string; confirmLabel: string;
  confirmColor: string; icon: React.ReactNode;
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({ opts }: { opts: ConfirmOptions }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1C1E27] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] shadow-2xl">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `${opts.confirmColor}15`, border: `1.5px solid ${opts.confirmColor}30` }}>
          {opts.icon}
        </div>
        <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>{opts.title}</h3>
        <p className="text-gray-400 text-center mb-6" style={{ fontSize: 13, lineHeight: 1.5 }}>{opts.body}</p>
        <div className="flex gap-2.5">
          <button onClick={opts.onCancel}
            className="flex-1 py-3 rounded-xl bg-[#252836] text-gray-300 font-black hover:bg-[#2E3244] transition-colors border border-white/[0.07]"
            style={{ fontSize: 13 }}>Cancel</button>
          <button onClick={opts.onConfirm}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all hover:brightness-110"
            style={{ fontSize: 13, background: `linear-gradient(135deg, ${opts.confirmColor}, ${opts.confirmColor}cc)` }}>
            {opts.confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Philippines Phone Input ─────────────────────────────────────── */
function PhoneInput({ value, onChange, accentColor = '#0047AB', placeholder = '9XX XXX XXXX' }: {
  value: string; onChange: (v: string) => void; accentColor?: string; placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const trimmed = raw.startsWith('09') ? raw.slice(2) : raw.startsWith('9') ? raw.slice(1) : raw;
    const limited = trimmed.slice(0, 9); // 9 digits after "09" = 11 total
    onChange(`09${limited}`);
  };
  const displayValue = value.startsWith('09') ? value.slice(2) : value;
  return (
    <div className="relative flex items-center">
      <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none">
        <span className="text-white font-black" style={{ fontSize: 13 }}>🇵🇭</span>
        <span className="font-black" style={{ fontSize: 13, color: accentColor }}>09</span>
        <div className="w-px h-4 bg-white/15 ml-1" />
      </div>
      <input
        type="tel"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        maxLength={9}
        className="w-full rounded-xl py-2.5 text-white focus:outline-none"
        style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.12)`, paddingLeft: 88, paddingRight: 12 }}
      />
      {value.length === 11 && (
        <div className="absolute right-3 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check size={9} className="text-green-400" />
        </div>
      )}
    </div>
  );
}

// ── Ticket Verification ──────────────────────────────────────────────────────
function TicketVerification() {
  const { bookings, updateBooking } = useUser();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<typeof bookings[0] | null | 'notfound'>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    const q = query.trim().toUpperCase();
    const found = bookings.find(b =>
      b.refCode?.toUpperCase() === q ||
      b.refCode?.toUpperCase().endsWith(q) ||
      b.id.toUpperCase() === q
    );
    setResult(found ?? 'notfound');
  };

  const handleCheckIn = () => {
    if (!result || result === 'notfound') return;
    setCheckingIn(true);
    setTimeout(() => {
      updateBooking(result.id, { checkInStatus: 'checked_in', checkInTime: new Date().toISOString() });
      setResult({ ...result, checkInStatus: 'checked_in', checkInTime: new Date().toISOString() });
      setCheckingIn(false);
    }, 800);
  };

  const formatTime = (t: string) => {
    const h = parseInt(t.split(':')[0]);
    return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0047AB]/20 border border-[#0047AB]/30">
          <ScanLine size={17} className="text-[#60a5fa]" />
        </div>
        <div>
          <p className="text-white font-black" style={{ fontSize: 15 }}>Ticket Verification</p>
          <p className="text-gray-500" style={{ fontSize: 11 }}>Search by reference code to check in a customer</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Enter code e.g. JRC-AB12CD"
          className="flex-1 rounded-xl px-4 py-2.5 text-white focus:outline-none"
          style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', letterSpacing: 1 }}
        />
        <button onClick={handleSearch}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-white transition-all"
          style={{ fontSize: 13, background: 'linear-gradient(135deg,#0047AB,#0066ff)' }}>
          <Search size={14} /> Search
        </button>
      </div>

      <AnimatePresence>
        {result === 'notfound' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 flex items-center gap-3 bg-red-500/8 border border-red-500/20 rounded-xl p-4">
            <XCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 font-black" style={{ fontSize: 13 }}>No booking found for "{query}"</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && result !== 'notfound' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 rounded-2xl border overflow-hidden"
            style={{ background: result.checkInStatus === 'checked_in' ? 'rgba(34,197,94,0.05)' : 'rgba(0,71,171,0.05)', borderColor: result.checkInStatus === 'checked_in' ? 'rgba(34,197,94,0.2)' : 'rgba(0,71,171,0.2)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              {result.checkInStatus === 'checked_in'
                ? <CheckCircle size={15} className="text-green-400" />
                : <QrCode size={15} className="text-[#60a5fa]" />}
              <span className="text-white font-black" style={{ fontSize: 13 }}>
                {result.checkInStatus === 'checked_in' ? 'Already Checked In' : 'Booking Found'}
              </span>
              <span className="ml-auto text-gray-500 font-black" style={{ fontSize: 11 }}>{result.refCode}</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: 'CUSTOMER', value: result.customerName || 'Customer' },
                { label: 'COURT', value: result.court },
                { label: 'DATE', value: result.date },
                { label: 'TIME', value: `${formatTime(result.time)} · ${result.duration}h` },
                { label: 'AMOUNT', value: `₱${result.amount.toLocaleString()}` },
                { label: 'PAYMENT', value: result.paymentStatus === 'paid' ? 'Paid' : result.paymentStatus },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-gray-600 font-black" style={{ fontSize: 9, letterSpacing: 0.5 }}>{f.label}</p>
                  <p className="text-white font-black" style={{ fontSize: 12 }}>{f.value}</p>
                </div>
              ))}
            </div>
            {result.checkInStatus !== 'checked_in' && (
              <div className="px-4 pb-4">
                <button onClick={handleCheckIn} disabled={checkingIn}
                  className="w-full py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', fontSize: 14, opacity: checkingIn ? 0.7 : 1 }}>
                  {checkingIn ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</> : <><ShieldCheck size={16} /> Mark as Checked-In</>}
                </button>
              </div>
            )}
            {result.checkInStatus === 'checked_in' && result.checkInTime && (
              <div className="px-4 pb-4 text-center">
                <p className="text-green-400 font-black" style={{ fontSize: 12 }}>
                  Checked in at {new Date(result.checkInTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(0,71,171,0.06)', border: '1px solid rgba(0,71,171,0.15)' }}>
          <p className="text-blue-300 font-black mb-1" style={{ fontSize: 11 }}>How to verify</p>
          <p className="text-gray-500" style={{ fontSize: 11 }}>1. Ask the customer for their booking QR code<br />2. Type the reference (e.g. JRC-AB12CD) and press Enter<br />3. Confirm the booking details then tap Check-In</p>
        </div>
      )}
    </div>
  );
}

// ── Live Operations ──────────────────────────────────────────────────────────
function LiveOperations() {
  const { maps } = useFacilityMap();
  const [view, setView] = useState<'map' | 'list' | 'verify'>('map');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  const { getStaffOperations, loading: apiLoading } = (useStaffAPI as any)();
  const [operationsData, setOperationsData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await getStaffOperations(todayStr);
        setOperationsData(res);
      } catch (err) {
        console.error("Failed to fetch staff operations:", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 45000); // refresh every 45s
    return () => clearInterval(interval);
  }, [getStaffOperations]);

  const publishedMaps = useMemo(() => maps.filter(m => m.isPublished), [maps]);
  const activeMap = selectedMapId
    ? publishedMaps.find(m => m.id === selectedMapId) ?? publishedMaps[0]
    : publishedMaps[0];
  const publishedLayout = activeMap?.blocks ?? [];

  const todayBookingsCount = operationsData?.bookingsCount || 0;
  const totalRevToday = operationsData?.revenue || 0;
  const openCourts = operationsData?.activeCourts || 0;
  const pendingCancellations = operationsData?.pendingRequests || 0;

  const sportGroups = publishedLayout
    .filter(c => c.status !== 'maintenance') // hide maintenance courts from list
    .reduce<Record<string, typeof publishedLayout>>((acc, court) => {
      (acc[court.sport] = acc[court.sport] || []).push(court);
      return acc;
    }, {});
  const allSports = Object.keys(sportGroups);

  const KPIs = [
    { label: "Today's Revenue", value: `₱${totalRevToday.toLocaleString()}`, icon: DollarSign, color: '#FF8C00', bg: '#2A1F0A' },
    { label: "Today's Bookings", value: todayBookingsCount, icon: Calendar, color: '#22c55e', bg: '#0A2010' },
    { label: 'Courts Active', value: `${openCourts}/${publishedLayout.length}`, icon: MapPin, color: '#0047AB', bg: '#0A1525' },
    { label: 'Pending Requests', value: pendingCancellations, icon: AlertTriangle, color: '#a855f7', bg: '#1A0A25' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white" style={{ fontSize: 26, fontWeight: 900 }}>Live Operations</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>Real-time court status and today's overview</p>
        </div>
        <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-xl p-1 border border-white/8">
          {([['map','Live Map',Map],['list','Court List',Activity],['verify','Verify',ScanLine]] as [string,string,any][]).map(([id,label,Icon]) => (
            <button key={id} onClick={() => setView(id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black transition-all ${view === id ? 'bg-[#0047AB] text-white' : 'text-gray-400 hover:text-white'}`}
              style={{ fontSize: 12 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIs.map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4 border border-white/5" style={{ backgroundColor: kpi.bg }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-gray-400" style={{ fontSize: 12 }}>{kpi.label}</p>
                <p className="text-white font-black" style={{ fontSize: 22, marginTop: 2 }}>{kpi.value}</p>
              </div>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}25` }}>
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Map selector (when multiple maps) */}
      {publishedMaps.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Layers size={13} className="text-gray-500 flex-shrink-0" />
          <p className="text-gray-500 font-black" style={{ fontSize: 11 }}>FACILITY:</p>
          {publishedMaps.map(m => (
            <button key={m.id} onClick={() => setSelectedMapId(m.id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-black transition-all"
              style={{
                fontSize: 11,
                background: (activeMap?.id === m.id) ? 'rgba(0,71,171,0.15)' : 'rgba(255,255,255,0.04)',
                color: (activeMap?.id === m.id) ? '#60a5fa' : '#666',
                border: `1px solid ${(activeMap?.id === m.id) ? 'rgba(0,71,171,0.35)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              <Building2 size={10} /> {m.name}
              <span className="text-gray-600" style={{ fontSize: 9 }}>· {m.branch}</span>
            </button>
          ))}
        </div>
      )}

      {view === 'map' && (
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden" style={{ height: 600 }}>
          <FacilityMapViewer mode="staff" compact />
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-4">
          {publishedLayout.length === 0 && (
            <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-white/5 text-center">
              <MapPin size={28} className="text-gray-700 mx-auto mb-3" />
              <p className="text-white font-black" style={{ fontSize: 15 }}>No courts in published map</p>
              <p className="text-gray-500" style={{ fontSize: 13 }}>Publish a facility map in the Admin dashboard to see courts here.</p>
            </div>
          )}
          {allSports.map(sport => {
            const courts = sportGroups[sport];
            const color = getSportMapColor(sport);
            const availCount = courts.filter(c => c.status === 'available').length;
            return (
              <div key={sport} className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5" style={{ backgroundColor: `${color}08` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                    <SportIcon sport={sport} size={16} color={color} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{sport}</p>
                    <p className="text-gray-500" style={{ fontSize: 11 }}>{SPORTS_INFO.find(s => s.name === sport)?.priceLabel || 'Custom'} · {courts.length} court(s)</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: availCount === 0 ? '#ef4444' : '#22c55e' }} />
                    <span className="text-gray-400" style={{ fontSize: 11 }}>{availCount}/{courts.length} open</span>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {courts.map(court => (
                    <div key={court.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1">
                        <p className="text-white font-black" style={{ fontSize: 13 }}>{court.name}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${court.status === 'available' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${court.status === 'available' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className={`font-black ${court.status === 'available' ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: 11 }}>
                          {court.status === 'available' ? 'Available' : 'Occupied'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'verify' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <TicketVerification />
        </motion.div>
      )}
    </div>
  );
}

// ── Master Calendar (Staff) ──────────────────────────────────────────────────
function StaffCalendar() {
  const { addBooking, cancellationRequests, updateCancellationRequest, updateBooking, bookings } = useUser();
  const { requests, updateRequestStatus } = useCoaching();
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualForm, setManualForm] = useState({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
  const [manualSuccess, setManualSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; approved: boolean } | null>(null);

  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;

  const handleManualBooking = () => {
    const name = manualForm.customerName || 'Walk-in Customer';
    addBooking({ id: `BK${Date.now()}`, sport: manualForm.sport, date: manualForm.date, time: manualForm.time, duration: manualForm.duration, court: manualForm.court, status: 'confirmed', amount: 500 * manualForm.duration, paymentStatus: 'pending', createdAt: new Date().toISOString(), customerName: name, customerPhone: manualForm.contactNumber, addOns: 'Staff Walk-in' });
    setShowManualBooking(false);
    setManualForm({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
    setManualSuccess(`Walk-in booking confirmed for ${name} — ${manualForm.sport} on ${manualForm.date} at ${manualForm.time}.`);
    setTimeout(() => setManualSuccess(''), 6000);
  };

  const executeCancellation = (id: string, approved: boolean) => {
    const req = cancellationRequests.find(r => r.id === id);
    if (!req) return;
    updateCancellationRequest(id, { status: approved ? 'approved' : 'rejected' });
    if (approved) {
      updateBooking(req.bookingId, { status: 'cancelled', cancellationRequested: false });
      const linked = requests.find(r => r.linkedBookingId === req.bookingId);
      if (linked) updateRequestStatus(linked.id, 'rejected');
    } else {
      updateBooking(req.bookingId, { cancellationRequested: false });
    }
    setConfirmAction(null);
  };

  const INPUT = "w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#0047AB]";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white" style={{ fontSize: 26, fontWeight: 900 }}>Master Calendar</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>View and manage bookings</p>
        </div>
        <button onClick={() => setShowManualBooking(true)} className="flex items-center gap-2 bg-[#0047AB] text-white px-4 py-2 rounded-xl hover:bg-[#003a8c] transition-colors font-black" style={{ fontSize: 13 }}>
          <Plus size={16} /> Manual Booking
        </button>
      </div>

      <AnimatePresence>
        {manualSuccess && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/25 rounded-2xl px-5 py-3">
            <CheckCircle size={17} className="text-blue-400 flex-shrink-0" />
            <p className="text-blue-300 font-black flex-1" style={{ fontSize: 13 }}>{manualSuccess}</p>
            <button onClick={() => setManualSuccess('')} className="text-blue-700 hover:text-blue-400"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {pendingCancellations > 0 && (
        <div className="bg-[#1A1A1A] rounded-2xl border border-yellow-500/20 p-5">
          <h3 className="text-white font-black mb-4" style={{ fontSize: 15 }}>Pending Cancellations ({pendingCancellations})</h3>
          <div className="space-y-3">
            {cancellationRequests.filter(r => r.status === 'pending').map(request => {
              const booking = bookings.find(b => b.id === request.bookingId);
              return (
                <div key={request.id} className="bg-[#252525] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black" style={{ fontSize: 13 }}>{booking?.customerName} — {booking?.court}</p>
                    <p className="text-gray-400" style={{ fontSize: 12 }}>{booking?.date} at {booking?.time} · {request.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmAction({ id: request.id, approved: true })} className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-xs font-black hover:bg-green-500/30 flex items-center gap-1"><Check size={13} /> Approve</button>
                    <button onClick={() => setConfirmAction({ id: request.id, approved: false })} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs font-black hover:bg-red-500/30 flex items-center gap-1"><X size={13} /> Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AdminBookingCalendar />

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmAction && (() => {
          const req = cancellationRequests.find(r => r.id === confirmAction.id);
          const booking = req ? bookings.find(b => b.id === req.bookingId) : null;
          return (
            <ConfirmModal opts={{
              title: confirmAction.approved ? 'Approve Cancellation?' : 'Reject Cancellation?',
              body: `${booking?.customerName ?? 'Customer'} — ${booking?.court ?? 'Court'}\n${confirmAction.approved ? 'The booking will be cancelled and the slot freed.' : 'The cancellation request will be dismissed.'}`,
              confirmLabel: confirmAction.approved ? 'Yes, Approve' : 'Yes, Reject',
              confirmColor: confirmAction.approved ? '#22c55e' : '#ef4444',
              icon: confirmAction.approved ? <CheckCircle size={26} className="text-green-400" /> : <XCircle size={26} className="text-red-400" />,
              onConfirm: () => executeCancellation(confirmAction.id, confirmAction.approved),
              onCancel: () => setConfirmAction(null),
            }} />
          );
        })()}
      </AnimatePresence>

      {/* Manual Booking Modal */}
      <AnimatePresence>
        {showManualBooking && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              className="bg-[#1A1A1A] rounded-3xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black" style={{ fontSize: 18 }}>Manual Booking (Walk-in)</h3>
                <button onClick={() => setShowManualBooking(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><X size={16} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Customer Name</label>
                  <input type="text" placeholder="Full name" value={manualForm.customerName} onChange={e => setManualForm({ ...manualForm, customerName: e.target.value })} className={INPUT} style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Contact Number</label>
                  <PhoneInput value={manualForm.contactNumber} onChange={v => setManualForm({ ...manualForm, contactNumber: v })} />
                </div>
                <div>
                  <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Court</label>
                  <input type="text" placeholder="e.g. Basketball 1" value={manualForm.court} onChange={e => setManualForm({ ...manualForm, court: e.target.value })} className={INPUT} style={{ fontSize: 13 }} />
                </div>
                <CustomDateTimePicker
                  selectedDate={manualForm.date}
                  selectedTime={manualForm.time}
                  onDateChange={date => setManualForm(f => ({ ...f, date }))}
                  onTimeChange={time => setManualForm(f => ({ ...f, time }))}
                  minDate={new Date().toISOString().split('T')[0]}
                  accentColor="#0047AB"
                />
                <div>
                  <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Sport</label>
                  <select value={manualForm.sport} onChange={e => setManualForm({ ...manualForm, sport: e.target.value })} className={INPUT} style={{ fontSize: 13 }}>
                    {['Basketball', 'Volleyball', 'Badminton', 'Pickleball', 'Billiards', 'Table Tennis'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Duration (hrs)</label>
                  <input type="number" min={1} max={4} value={manualForm.duration} onChange={e => setManualForm({ ...manualForm, duration: parseInt(e.target.value) })} className={INPUT} style={{ fontSize: 13 }} />
                </div>
                <button onClick={handleManualBooking} className="w-full bg-[#0047AB] text-white py-3 rounded-xl font-black hover:bg-[#003a8c] transition-colors flex items-center justify-center gap-2" style={{ fontSize: 14 }}>
                  <UserCheck size={16} /> Confirm Walk-In Booking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dummy inbox data ─────────────────────────────────────────────────────────
const DUMMY_CANCELLATIONS = [
  { id: 'd1', customerName: 'Mia Santos', court: 'Basketball 2', date: '2026-05-06', time: '09:00', reason: 'Family emergency came up', status: 'pending' as const, createdAt: '2026-05-05T14:22:00Z' },
  { id: 'd2', customerName: 'Carlo Reyes', court: 'Volleyball A', date: '2026-05-07', time: '14:00', reason: 'Work schedule conflict', status: 'pending' as const, createdAt: '2026-05-05T10:05:00Z' },
];
const DUMMY_COACHING: any[] = [];

// ── Front Desk Inbox ─────────────────────────────────────────────────────────
type InboxSubTab = 'cancellations' | 'coaching' | 'announcements';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function FrontDeskInbox() {
  const { cancellationRequests, updateCancellationRequest, updateBooking, bookings } = useUser();
  const { requests: coachingRequests, updateRequestStatus } = useCoaching();
  const { addAnnouncement, announcements } = useAnnouncements();
  const [sub, setSub] = useState<InboxSubTab>('cancellations');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as const });
  const [announceSent, setAnnounceSent] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancellation' | 'coaching'; id: string; approved: boolean } | null>(null);

  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length + DUMMY_CANCELLATIONS.filter(d => d.status === 'pending').length;
  const pendingCoaching = coachingRequests.filter(r => r.status === 'pending').length + DUMMY_COACHING.filter(d => d.status === 'pending').length;

  const [verifyingRequest, setVerifyingRequest] = useState<any>(null);

  const allCancellations = [
    ...cancellationRequests.map(r => {
      const b = bookings.find(bk => bk.id === r.bookingId);
      return { id: r.id, customerName: b?.customerName ?? '—', court: b?.court ?? '—', date: b?.date ?? '', time: b?.time ?? '', reason: r.reason, status: r.status, createdAt: r.id, isReal: true as const };
    }),
    ...DUMMY_CANCELLATIONS.map(d => ({ ...d, isReal: false as const })),
  ];
  const allCoaching = [
    ...coachingRequests.map(r => ({ id: r.id, customerName: r.userName ?? (r as any).customerName ?? '—', sport: r.sport, coachName: r.coachName, status: r.status as any, requestedAt: r.requestedAt, requestedDate: r.requestedDate, requestedTime: r.requestedTime, paymentProofUrl: r.paymentProofUrl, linkedBookingId: r.linkedBookingId, notes: '', isReal: true as const })),
    ...DUMMY_COACHING.map(d => ({ ...d, isReal: false as const })),
  ];

  const executeRealCancellation = (id: string, approved: boolean) => {
    const req = cancellationRequests.find(r => r.id === id);
    if (!req) return;
    updateCancellationRequest(id, { status: approved ? 'approved' : 'rejected' });
    if (approved) updateBooking(req.bookingId, { status: 'cancelled', cancellationRequested: false });
    else updateBooking(req.bookingId, { cancellationRequested: false });
  };
  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'cancellation') {
      const item = allCancellations.find(c => c.id === confirmAction.id);
      if (item?.isReal) executeRealCancellation(confirmAction.id, confirmAction.approved);
    } else {
      const item = allCoaching.find(c => c.id === confirmAction.id);
      if (item?.isReal) updateRequestStatus(confirmAction.id, confirmAction.approved ? 'confirmed' : 'rejected');
    }
    setConfirmAction(null);
  };

  const ANN_TYPES = [
    { value: 'promotion',   label: 'Promo',       color: '#FF8C00', bg: 'rgba(255,140,0,0.12)'   },
    { value: 'maintenance', label: 'Maintenance',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
    { value: 'reminder',    label: 'Reminder',     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
    { value: 'update',      label: 'Update',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
    { value: 'alert',       label: 'Alert',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  ] as const;

  const SPORT_COLORS: Record<string,string> = { Basketball:'#FF8C00', Volleyball:'#0047AB', Badminton:'#22c55e', Pickleball:'#a855f7', Billiards:'#ec4899', 'Table Tennis':'#06b6d4' };
  const INPUT = 'w-full bg-[#1E1E1E] border border-white/8 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0047AB] transition-colors';

  const fmtTime = (t: string) => { if (!t) return ''; const h = parseInt(t.split(':')[0]); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; };
  const timeSince = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const SUB_TABS = [
    { id: 'cancellations' as InboxSubTab, label: 'Cancellations',   icon: AlertTriangle, badge: pendingCancellations, color: '#fbbf24' },
    { id: 'coaching'      as InboxSubTab, label: 'Coaching',        icon: GraduationCap, badge: pendingCoaching,       color: '#60a5fa' },
    { id: 'announcements' as InboxSubTab, label: 'Announcements',   icon: Megaphone,     badge: 0,                    color: '#FF8C00' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-black" style={{ fontSize: 24 }}>Front Desk Inbox</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>Customer requests, coaching inquiries, and announcements</p>
        </div>
        {(pendingCancellations + pendingCoaching) > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border flex-shrink-0" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-black" style={{ fontSize: 12 }}>{pendingCancellations + pendingCoaching} pending</span>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 bg-[#111] rounded-2xl p-1.5 border border-white/5">
        {SUB_TABS.map(t => {
          const isActive = sub === t.id;
          return (
            <motion.button key={t.id} onClick={() => setSub(t.id)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all font-black"
              style={{ fontSize: 12, background: isActive ? `${t.color}18` : 'transparent', color: isActive ? t.color : '#555', border: `1.5px solid ${isActive ? `${t.color}40` : 'transparent'}` }}>
              <t.icon size={13} />
              <span className="hidden sm:inline">{t.label}</span>
              {t.badge > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white font-black px-1"
                  style={{ fontSize: 9, background: '#ef4444', boxShadow: '0 2px 6px rgba(239,68,68,0.4)' }}>
                  {t.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ── CANCELLATIONS ── */}
        {sub === 'cancellations' && (
          <motion.div key="canc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {allCancellations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/5" style={{ background: '#111' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <Check size={24} className="text-green-400" />
                </div>
                <p className="text-white font-black mb-1" style={{ fontSize: 15 }}>All clear!</p>
                <p className="text-gray-500" style={{ fontSize: 13 }}>No pending cancellation requests.</p>
              </div>
            ) : allCancellations.map((req, idx) => {
              const isPending = req.status === 'pending';
              return (
                <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl border overflow-hidden" style={{ background: '#111', borderColor: isPending ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)' }}>
                  {isPending && <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#fbbf24,transparent)' }} />}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-white"
                        style={{ fontSize: 13, background: isPending ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'rgba(255,255,255,0.08)' }}>
                        {initials(req.customerName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-white font-black" style={{ fontSize: 14 }}>{req.customerName}</p>
                          <span className="px-2 py-0.5 rounded-full font-black"
                            style={{ fontSize: 10, background: isPending ? 'rgba(251,191,36,0.15)' : req.status === 'approved' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isPending ? '#fbbf24' : req.status === 'approved' ? '#22c55e' : '#ef4444' }}>
                            {req.status.toUpperCase()}
                          </span>
                          {!req.isReal && <span className="px-1.5 py-0.5 rounded-full font-black text-blue-400" style={{ fontSize: 9, background: 'rgba(96,165,250,0.1)' }}>SAMPLE</span>}
                        </div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="flex items-center gap-1 text-gray-400" style={{ fontSize: 12 }}><MapPin size={11} />{req.court}</span>
                          <span className="flex items-center gap-1 text-gray-400" style={{ fontSize: 12 }}><Calendar size={11} />{req.date}{req.time ? ` · ${fmtTime(req.time)}` : ''}</span>
                          <span className="text-gray-600" style={{ fontSize: 11 }}>{timeSince(req.createdAt)}</span>
                        </div>
                        {req.reason && (
                          <div className="rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-gray-400" style={{ fontSize: 12, lineHeight: 1.5 }}>"{req.reason}"</p>
                          </div>
                        )}
                        {isPending && (
                          <div className="flex gap-2">
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                              onClick={() => setConfirmAction({ type: 'cancellation', id: req.id, approved: true })}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black"
                              style={{ fontSize: 12, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                              <Check size={12} /> Approve
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                              onClick={() => setConfirmAction({ type: 'cancellation', id: req.id, approved: false })}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black"
                              style={{ fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                              <X size={12} /> Reject
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── COACHING ── */}
        {sub === 'coaching' && (
          <motion.div key="coach" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {allCoaching.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/5" style={{ background: '#111' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <GraduationCap size={24} className="text-blue-400" />
                </div>
                <p className="text-white font-black mb-1" style={{ fontSize: 15 }}>No coaching requests</p>
                <p className="text-gray-500" style={{ fontSize: 13 }}>Customer inquiries will appear here.</p>
              </div>
            ) : allCoaching.map((req, idx) => {
              const isPending = req.status === 'pending';
              const sportColor = SPORT_COLORS[req.sport] || '#60a5fa';
              return (
                <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl border overflow-hidden" style={{ background: '#111', borderColor: isPending ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)' }}>
                  {isPending && <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg,${sportColor},transparent)` }} />}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-white"
                        style={{ fontSize: 13, background: `linear-gradient(135deg,${sportColor},${sportColor}99)` }}>
                        {initials(req.customerName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-white font-black" style={{ fontSize: 14 }}>{req.customerName}</p>
                          <span className="px-2 py-0.5 rounded-full font-black" style={{ fontSize: 10, background: `${sportColor}20`, color: sportColor }}>{req.sport}</span>
                          <span className="px-2 py-0.5 rounded-full font-black"
                            style={{ fontSize: 10, background: isPending ? 'rgba(251,191,36,0.15)' : req.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isPending ? '#fbbf24' : req.status === 'confirmed' ? '#22c55e' : '#ef4444' }}>
                            {req.status.toUpperCase()}
                          </span>
                          {!req.isReal && <span className="px-1.5 py-0.5 rounded-full font-black text-blue-400" style={{ fontSize: 9, background: 'rgba(96,165,250,0.1)' }}>SAMPLE</span>}
                        </div>
                        <p className="text-gray-400 mb-2" style={{ fontSize: 12 }}>
                          Coach: <span className="text-gray-300 font-black">{req.coachName}</span>
                          <span className="text-gray-600 ml-2">{timeSince(req.requestedAt)}</span>
                        </p>
                        {req.notes && (
                          <div className="rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-gray-400" style={{ fontSize: 12, lineHeight: 1.5 }}>"{req.notes}"</p>
                          </div>
                        )}
                        {isPending && (
                          <div className="flex gap-2">
                              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => setConfirmAction({ type: 'coaching', id: req.id, approved: false })}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black"
                                style={{ fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <X size={12} /> Reject
                              </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {sub === 'announcements' && (
          <motion.div key="ann" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111' }}>
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,140,0,0.12)' }}><Megaphone size={14} className="text-[#FF8C00]" /></div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 14 }}>Send Announcement</p>
                  <p className="text-gray-500" style={{ fontSize: 11 }}>Broadcast to all active users</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-gray-500 font-black mb-2" style={{ fontSize: 10, letterSpacing: 0.8 }}>TYPE</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ANN_TYPES.map(t => (
                      <motion.button key={t.value} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setAnnouncementForm(f => ({ ...f, type: t.value as any }))}
                        className="px-3 py-1.5 rounded-xl font-black transition-all"
                        style={{ fontSize: 11, background: announcementForm.type === t.value ? t.bg : 'rgba(255,255,255,0.04)', color: announcementForm.type === t.value ? t.color : '#666', border: `1.5px solid ${announcementForm.type === t.value ? `${t.color}50` : 'rgba(255,255,255,0.07)'}` }}>
                        {t.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 font-black mb-1.5" style={{ fontSize: 10, letterSpacing: 0.8 }}>TITLE</p>
                  <input type="text" value={announcementForm.title} onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Special Weekend Promo — 20% Off!" className={INPUT} style={{ fontSize: 13 }} />
                </div>
                <div>
                  <p className="text-gray-500 font-black mb-1.5" style={{ fontSize: 10, letterSpacing: 0.8 }}>MESSAGE</p>
                  <textarea value={announcementForm.message} onChange={e => setAnnouncementForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Write your message to all users..." className={INPUT} style={{ fontSize: 13, resize: 'none' }} />
                </div>
                <AnimatePresence>
                  {announceSent && (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                      <span className="text-green-300 font-black flex-1" style={{ fontSize: 12 }}>{announceSent}</span>
                      <button onClick={() => setAnnounceSent('')}><X size={12} className="text-green-700" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!announcementForm.title.trim()) return;
                    addAnnouncement({ title: announcementForm.title, message: announcementForm.message, type: announcementForm.type });
                    setAnnounceSent(`"${announcementForm.title}" sent to all users.`);
                    setAnnouncementForm({ title: '', message: '', type: 'promotion' });
                    setTimeout(() => setAnnounceSent(''), 5000);
                  }}
                  disabled={!announcementForm.title.trim()}
                  className="w-full py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ fontSize: 14, background: 'linear-gradient(135deg,#0047AB,#003a99)', boxShadow: '0 4px 16px rgba(0,71,171,0.3)' }}>
                  <Bell size={15} /> Send to All Users
                </motion.button>
              </div>
            </div>
            <div className="lg:col-span-2 rounded-2xl border border-white/5 overflow-hidden flex flex-col" style={{ background: '#111' }}>
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2"><MessageSquare size={13} className="text-gray-500" /><p className="text-white font-black" style={{ fontSize: 13 }}>Sent</p></div>
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-black" style={{ fontSize: 10 }}>{announcements.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {announcements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2"><Megaphone size={24} className="text-gray-700" /><p className="text-gray-600" style={{ fontSize: 13 }}>No announcements yet</p></div>
                ) : announcements.map(ann => {
                  const typeCfg = ANN_TYPES.find(t => t.value === ann.type);
                  return (
                    <div key={ann.id} className="px-5 py-3.5 border-b border-white/4 hover:bg-white/2 transition-colors last:border-0">
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: typeCfg?.bg }}><Megaphone size={11} style={{ color: typeCfg?.color }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-white font-black truncate" style={{ fontSize: 12 }}>{ann.title}</p>
                            <span className="px-1.5 py-0.5 rounded-full font-black flex-shrink-0" style={{ fontSize: 8, background: typeCfg?.bg, color: typeCfg?.color }}>{ann.type.toUpperCase()}</span>
                          </div>
                          <p className="text-gray-400 line-clamp-2" style={{ fontSize: 11, lineHeight: 1.5 }}>{ann.message}</p>
                          <p className="text-gray-600 mt-1" style={{ fontSize: 10 }}>{new Date(ann.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (() => {
          const isCancellation = confirmAction.type === 'cancellation';
          const item = isCancellation ? allCancellations.find(c => c.id === confirmAction.id) : allCoaching.find(c => c.id === confirmAction.id);
          return (
            <ConfirmModal opts={{
              title: confirmAction.approved ? (isCancellation ? 'Approve Cancellation?' : 'Accept Coaching Request?') : (isCancellation ? 'Reject Cancellation?' : 'Reject Coaching Request?'),
              body: isCancellation
                ? `${(item as any)?.customerName ?? '—'} — ${(item as any)?.court ?? '—'}.\n${confirmAction.approved ? 'The booking will be cancelled and the slot freed up.' : 'The request will be dismissed.'}`
                : `${(item as any)?.customerName ?? '—'} → ${(item as any)?.coachName ?? '—'}.\n${confirmAction.approved ? 'This coaching session will be confirmed.' : 'This request will be declined.'}`,
              confirmLabel: confirmAction.approved ? (isCancellation ? 'Yes, Approve' : 'Yes, Accept') : 'Yes, Reject',
              confirmColor: confirmAction.approved ? '#22c55e' : '#ef4444',
              icon: confirmAction.approved ? <CheckCircle size={28} className="text-green-400" /> : <XCircle size={28} className="text-red-400" />,
              onConfirm: handleConfirm,
              onCancel: () => setConfirmAction(null),
            }} />
          );
        })()}
      </AnimatePresence>

    </div>
  );
}

// ── Main Staff Shell ─────────────────────────────────────────────────────────
export function ConsolidatedStaffDashboard({ onLogout }: { onLogout: () => void }) {
  const { user, cancellationRequests } = useUser();
  const { requests: coachingRequests } = useCoaching();
  const [activeTab, setActiveTab] = useState<StaffTab>('operations');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const inboxBadge = cancellationRequests.filter(r => r.status === 'pending').length +
    coachingRequests.filter(r => r.status === 'pending').length;

  const renderContent = () => {
    switch (activeTab) {
      case 'operations': return <LiveOperations />;
      case 'calendar':   return <StaffCalendar />;
      case 'inbox':      return <StaffInbox />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row h-screen overflow-hidden">

      {/* ── MOBILE layout ── */}
      <div className="md:hidden flex flex-col h-screen w-full overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 h-10 flex-shrink-0" style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0047AB,#0066ff)" }}>
              <Shield size={11} className="text-white" />
            </div>
            <span className="font-black" style={{ fontSize: 13, color: "#E8E8EA" }}>JRC <span style={{ color: "#60a5fa" }}>Staff</span></span>
          </div>
          <button onClick={onLogout} className="px-3 py-1 rounded-lg font-black" style={{ fontSize: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            Sign Out
          </button>
        </div>
        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#0D0D0D]">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
        {/* Mobile bottom nav */}
        <div className="flex-shrink-0 flex items-stretch" style={{ background: "#141414", borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
          {STAFF_TABS.map(tab => {
            const on = activeTab === tab.id;
            return (
              <motion.button key={tab.id} whileTap={{ scale: 0.88 }} onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative">
                {on && <motion.div layoutId="staffNavLine" className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 2.5, background: "#2563EB" }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />}
                <div className="w-10 h-7 rounded-xl flex items-center justify-center" style={{ background: on ? "rgba(37,99,235,0.18)" : "transparent" }}>
                  <tab.icon size={17} style={{ color: on ? "#60a5fa" : "rgba(255,255,255,0.35)", strokeWidth: on ? 2.5 : 1.8 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: on ? 800 : 600, color: on ? "#60a5fa" : "rgba(255,255,255,0.35)" }}>{tab.label.split(" ")[0]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

      {/* Sidebar (desktop) */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 72 : 236 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="bg-[#0E0E0E] border-r border-white/[0.05] flex-col flex-shrink-0 overflow-hidden flex"
        style={{ minWidth: sidebarCollapsed ? 72 : 236, maxWidth: sidebarCollapsed ? 72 : 236 }}
      >
        <div className="flex items-center px-4 py-5 flex-shrink-0" style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0047AB,#0066ff)', boxShadow: '0 4px 12px rgba(0,71,171,0.3)' }}>
              <Shield size={16} className="text-white" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <p className="font-black" style={{ fontSize: 15, lineHeight: 1.1 }}>
                    <span style={{ color: 'white' }}>JRC </span>
                    <span style={{ color: '#0047AB' }}>Staff</span>
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#3a3a3a', letterSpacing: 1.5 }}>STAFF PORTAL</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(true)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-600 hover:text-gray-300 transition-all flex-shrink-0">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <div className="flex justify-center mb-2">
            <button onClick={() => setSidebarCollapsed(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-600 hover:text-gray-300 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="h-px bg-white/[0.04] flex-shrink-0 mx-3" />

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5" style={{ padding: sidebarCollapsed ? '12px 8px' : '12px 10px' }}>
          {!sidebarCollapsed && <p className="text-gray-700 mb-2 pl-2 font-black" style={{ fontSize: 9, letterSpacing: 1.5 }}>STAFF SECTIONS</p>}
          {STAFF_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const item = (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl transition-all relative"
                style={{ padding: sidebarCollapsed ? '10px 0' : '9px 10px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', background: isActive ? 'rgba(0,71,171,0.15)' : 'transparent' }}>
                {isActive && !sidebarCollapsed && <motion.div layoutId="staffActiveBar" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[#0047AB]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all" style={{ background: isActive ? 'linear-gradient(135deg,#0047AB,#0066ff)' : 'rgba(255,255,255,0.05)', boxShadow: isActive ? '0 4px 12px rgba(0,71,171,0.3)' : 'none' }}>
                  <tab.icon size={15} color={isActive ? 'white' : '#555'} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <p style={{ fontSize: 12, fontWeight: 800, color: isActive ? '#F8FAFC' : '#777' }}>{tab.label}</p>
                    <p style={{ fontSize: 10, color: '#444' }} className="truncate">{tab.sub}</p>
                  </div>
                )}
                {tab.id === 'inbox' && inboxBadge > 0 && !sidebarCollapsed && (
                  <span className="bg-red-500 text-white rounded-full flex-shrink-0 font-black" style={{ fontSize: 9, padding: '2px 6px' }}>{inboxBadge}</span>
                )}
                {tab.id === 'inbox' && inboxBadge > 0 && sidebarCollapsed && (
                  <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full" />
                )}
              </button>
            );
            if (sidebarCollapsed) return (
              <div key={tab.id} className="relative group">{item}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                  <div className="whitespace-nowrap rounded-xl px-3 py-2 font-black shadow-xl" style={{ fontSize: 12, background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC' }}>{tab.label}</div>
                </div>
              </div>
            );
            return item;
          })}
        </nav>

        <div className="h-px bg-white/[0.04] flex-shrink-0" />

        <div className="flex-shrink-0 p-3">
          {sidebarCollapsed ? (
            <div className="relative group">
              <button onClick={onLogout} className="w-full flex justify-center py-2 rounded-xl hover:bg-red-500/10 transition-all text-gray-600 hover:text-red-400"><LogOut size={16} /></button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all">
                <div className="whitespace-nowrap rounded-xl px-3 py-2 font-black shadow-xl text-red-400" style={{ fontSize: 12, background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(239,68,68,0.2)' }}>Sign Out</div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0047AB,#0066ff)' }}>
                  <span className="text-white font-black" style={{ fontSize: 13 }}>{user?.name?.charAt(0) || 'S'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black truncate" style={{ fontSize: 12 }}>{user?.name || 'Staff'}</p>
                  <p className="text-gray-600 truncate" style={{ fontSize: 10 }}>{user?.email}</p>
                </div>
              </div>
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/8 py-1.5 rounded-xl transition-all" style={{ fontSize: 12, fontWeight: 700 }}>
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Desktop header */}
        {(() => {
          const tab = STAFF_TABS.find(t => t.id === activeTab);
          return (
            <div className="hidden md:flex h-14 bg-[#0E0E0E] border-b border-white/[0.05] items-center px-6 flex-shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,71,171,0.18)' }}>
                  {tab && <tab.icon size={13} style={{ color: '#0047AB' }} strokeWidth={2.5} />}
                </div>
                <span className="text-white font-black truncate" style={{ fontSize: 13 }}>{tab?.label}</span>
                <span className="text-gray-700" style={{ fontSize: 12 }}>·</span>
                <span className="text-gray-500 truncate" style={{ fontSize: 11 }}>{tab?.sub}</span>
                {activeTab === 'inbox' && inboxBadge > 0 && (
                  <span className="bg-red-500 text-white rounded-full font-black" style={{ fontSize: 9, padding: '2px 7px' }}>{inboxBadge} pending</span>
                )}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 border border-white/5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0047AB,#0066ff)' }}>
                  <span className="text-white font-black" style={{ fontSize: 10 }}>{user?.name?.charAt(0).toUpperCase() || 'S'}</span>
                </div>
                <span className="text-gray-300 font-black" style={{ fontSize: 12 }}>{user?.name || 'Staff'}</span>
                <span className="rounded-full px-1.5 py-0.5 font-black" style={{ fontSize: 9, background: 'rgba(0,71,171,0.2)', color: '#6699ff' }}>STAFF</span>
              </div>
            </div>
          );
        })()}

        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: 'none' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      </div>{/* end desktop flex */}
    </div>
  );
}
