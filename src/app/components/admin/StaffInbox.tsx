import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle,
  GraduationCap,
  Check,
  X,
  Megaphone,
  Calendar,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Send,
  Copy,
} from 'lucide-react';
import { useStaffAPI } from '../../hooks/useStaffAPI';
import { useAnnouncements } from '../../contexts/AnnouncementsContext';
import { useUser } from '../../contexts/UserContext';

const SURF = '#1E1E1F';
const BORDER = 'rgba(255,255,255,0.06)';
const TS = '#9294A0';
const DUMMY_CANCELLATIONS = [
  { id: 'demo-cx-1', customerName: 'Patricia Gomez', date: '2026-05-12', time: '19:00', court: 'Basketball 1', reason: 'Team captain is sick', isReal: false },
  { id: 'demo-cx-2', customerName: 'Eli Ramos', date: '2026-05-12', time: '20:00', court: 'Badminton 2', reason: 'Transportation issue from office', isReal: false },
];
const DUMMY_RESCHEDULES = [
  {
    id: 'demo-rs-1',
    customerName: 'Noah Lim',
    date: '2026-05-13',
    time: '18:00',
    court: 'Basketball 1',
    reason: 'Class ends late, cannot arrive on original slot.',
    requestType: 'reschedule' as const,
    requestedNewDate: '2026-05-13',
    requestedNewStartTime: '20:00:00',
    isReal: false,
  },
  {
    id: 'demo-rs-2',
    customerName: 'Arielle Cruz',
    date: '2026-05-14',
    time: '09:00',
    court: 'Badminton 2',
    reason: 'Team travel delay, requesting later schedule.',
    requestType: 'reschedule' as const,
    requestedNewDate: '2026-05-14',
    requestedNewStartTime: '11:00:00',
    isReal: false,
  },
];
const DUMMY_COACHING = [
  { id: 'demo-coach-1', userName: 'Bea Villanueva', coachName: 'Coach Marco', sport: 'Volleyball', requestedDate: '2026-05-13', requestedTime: '17:00', isReal: false },
  { id: 'demo-coach-2', userName: 'Luis Javier', coachName: 'Coach Renz', sport: 'Badminton', requestedDate: '2026-05-14', requestedTime: '09:00', isReal: false },
];

type InboxSubTab = 'cancellations' | 'coaching' | 'announcements';
type ChangeKind = 'all' | 'cancellation' | 'reschedule';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

type ChangeRequestRow = {
  id: string;
  bookingId: string;
  customerName: string;
  date: string;
  time: string;
  court: string;
  reason: string;
  requestType: 'cancellation' | 'reschedule';
  requestedNewDate?: string | null;
  requestedNewStartTime?: string | null;
  isReal?: boolean;
};

function formatTimeShort(raw: string): string {
  const s = String(raw || '');
  if (!s) return '—';
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = s.slice(3, 5) || '00';
  const mod = hh % 12 || 12;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${mod}:${mm} ${ampm}`;
}

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose} role="presentation">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141824] shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/8">
              <div className="min-w-0">
                <p className="text-white font-black" style={{ fontSize: 16 }}>{title}</p>
                <p className="text-gray-500 font-black mt-1" style={{ fontSize: 11 }}>Review details before confirming.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function StaffInbox() {
  const {
    getPendingRequests,
    approveCancellationRequest,
    rejectCancellationRequest,
    approveRescheduleRequest,
    rejectRescheduleRequest,
    verifyCoachingPayment,
    rejectCoachingPayment,
  } = useStaffAPI();
  const { addAnnouncement, announcements, refresh: refreshAnnouncements, error: announceError, isLoading: announceLoading } = useAnnouncements();
  const { user } = useUser();
  
  const [sub, setSub] = useState<InboxSubTab>('cancellations');
  const [requests, setRequests] = useState<any>({ cancellations: [], reschedules: [], coaching: [] });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as const });
  const [announceSent, setAnnounceSent] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancellation' | 'reschedule' | 'coaching'; id: string; approved: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [dummyCancellations, setDummyCancellations] = useState(DUMMY_CANCELLATIONS);
  const [dummyReschedules, setDummyReschedules] = useState(DUMMY_RESCHEDULES);
  const [dummyCoaching, setDummyCoaching] = useState(DUMMY_COACHING);
  const [changeKind, setChangeKind] = useState<ChangeKind>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>('');

  const fetchInboxData = async () => {
    try {
      const data = await getPendingRequests();
      if (data) {
        setRequests({
          cancellations: data.cancellations || [],
          reschedules: data.reschedules || [],
          coaching: data.coaching || []
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInboxData();
    const int = setInterval(fetchInboxData, 15000);
    return () => clearInterval(int);
  }, []);

  const handleApprove = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction.type === 'cancellation') {
        const isDummy = dummyCancellations.some(d => d.id === confirmAction.id);
        if (isDummy) {
          setDummyCancellations(prev => prev.filter(d => d.id !== confirmAction.id));
          setNotice(confirmAction.approved ? 'Dummy cancellation approved.' : 'Dummy cancellation rejected.');
        } else {
          if (confirmAction.approved) {
            await approveCancellationRequest(confirmAction.id);
            setNotice('Cancellation approved.');
          } else {
            await rejectCancellationRequest(confirmAction.id, rejectReason || "Request declined by staff.");
            setNotice('Cancellation rejected.');
          }
        }
      } else if (confirmAction.type === 'reschedule') {
        const isDummy = dummyReschedules.some(d => d.id === confirmAction.id);
        if (isDummy) {
          setDummyReschedules(prev => prev.filter(d => d.id !== confirmAction.id));
          setNotice(confirmAction.approved ? 'Dummy reschedule approved.' : 'Dummy reschedule rejected.');
        } else if (confirmAction.approved) {
          await approveRescheduleRequest(confirmAction.id);
          setNotice('Reschedule approved.');
        } else {
          await rejectRescheduleRequest(confirmAction.id, rejectReason || "Request declined by staff.");
          setNotice('Reschedule rejected.');
        }
      } else if (confirmAction.type === 'coaching') {
        const isDummy = dummyCoaching.some(d => d.id === confirmAction.id);
        if (isDummy) {
          setDummyCoaching(prev => prev.filter(d => d.id !== confirmAction.id));
          setNotice(confirmAction.approved ? 'Dummy coaching request approved.' : 'Dummy coaching request rejected.');
        } else {
          if (confirmAction.approved) {
            await verifyCoachingPayment(confirmAction.id);
            setNotice('Coaching request approved.');
          } else {
            await rejectCoachingPayment(confirmAction.id, rejectReason || "Payment verification failed.");
            setNotice('Coaching request rejected.');
          }
        }
      }
      setConfirmAction(null);
      setRejectReason('');
      setModalOpen(false);
      fetchInboxData();
      window.setTimeout(() => setNotice(''), 1800);
    } catch (e: any) {
      setNotice(e?.message || 'Action failed.');
      window.setTimeout(() => setNotice(''), 2600);
    } finally {
      setBusy(false);
    }
  };

  const handleSendAnnounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.message) return;
    await addAnnouncement({ title: announcementForm.title, message: announcementForm.message, type: announcementForm.type as any });
    setAnnounceSent('Announcement published!');
    setAnnouncementForm({ title: '', message: '', type: 'promotion' });
    setTimeout(() => setAnnounceSent(''), 3000);
  };

  const visibleCancellations = requests.cancellations.length > 0 ? requests.cancellations : dummyCancellations;
  const visibleReschedules = requests.reschedules?.length > 0 ? requests.reschedules : dummyReschedules;
  const visibleCoaching = requests.coaching.length > 0 ? requests.coaching : dummyCoaching;
  const pendingCancellations = visibleCancellations.length + visibleReschedules.length;
  const pendingCoaching = visibleCoaching.length;

  const tabs = useMemo(() => {
    const base: { id: InboxSubTab; label: string; icon: any; badge: number; color: string; desc: string }[] = [
      { id: 'cancellations', label: 'Change Requests', icon: AlertTriangle, badge: pendingCancellations, color: '#fbbf24', desc: 'Cancellations and reschedules needing approval.' },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, badge: 0, color: '#f97316', desc: 'Send updates that appear in user notifications.' },
    ];
    const allowCoaching = user?.role === 'admin' || user?.role === 'coach';
    if (allowCoaching) {
      base.splice(1, 0, { id: 'coaching', label: 'Coaching', icon: GraduationCap, badge: pendingCoaching, color: '#60a5fa', desc: 'Coach-side requests & payment checks.' });
    }
    return base;
  }, [pendingCancellations, pendingCoaching, user?.role]);

  const changeRows: ChangeRequestRow[] = useMemo(() => {
    const cancels = (visibleCancellations || []).map((r: any) => ({ ...r, requestType: 'cancellation' as const }));
    const resched = (visibleReschedules || []).map((r: any) => ({ ...r, requestType: 'reschedule' as const }));
    return [...resched, ...cancels];
  }, [visibleCancellations, visibleReschedules]);

  const filteredChangeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return changeRows.filter((r) => {
      if (changeKind !== 'all' && r.requestType !== changeKind) return false;
      if (!q) return true;
      return [r.customerName, r.court, r.reason, r.bookingId, r.id].join(' ').toLowerCase().includes(q);
    });
  }, [changeRows, changeKind, query]);

  const selectedChange = useMemo(() => {
    const target = selectedId || (filteredChangeRows[0]?.id ?? null);
    if (!target) return null;
    return filteredChangeRows.find((r) => r.id === target) || filteredChangeRows[0] || null;
  }, [filteredChangeRows, selectedId]);

  useEffect(() => {
    if (!selectedId && filteredChangeRows.length > 0) setSelectedId(filteredChangeRows[0].id);
  }, [filteredChangeRows.length, selectedId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-black" style={{ fontSize: 24 }}>Front Desk Inbox</h2>
        <p className="text-gray-500" style={{ fontSize: 13 }}>
          Action items for staff. Review requests and publish updates for all users.
        </p>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#141820] p-2">
        <div className={`grid gap-2 ${tabs.length >= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className="rounded-2xl px-4 py-3 border transition-all text-left"
              style={{
                background: sub === t.id ? `${t.color}18` : 'rgba(255,255,255,0.02)',
                borderColor: sub === t.id ? `${t.color}35` : 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}18`, border: `1px solid ${t.color}30` }}
                  >
                    <t.icon size={18} style={{ color: t.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-black truncate" style={{ fontSize: 14 }}>{t.label}</p>
                    <p className="text-gray-500 font-black mt-0.5" style={{ fontSize: 11 }}>{t.desc}</p>
                  </div>
                </div>
                {t.badge > 0 ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="rounded-full px-2.5 py-1 font-black text-white" style={{ fontSize: 11, background: t.color }}>
                      {t.badge}
                    </span>
                    <ArrowRight size={14} className="text-gray-500" />
                  </div>
                ) : (
                  <ArrowRight size={14} className="text-gray-700 flex-shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {notice ? (
        <div className="fixed top-4 right-4 z-[1300] rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-200 font-black" style={{ fontSize: 12 }}>
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <AnimatePresence mode="wait">
          {sub === 'cancellations' && (
            <motion.div key="change-requests" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="lg:col-span-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left: list */}
                <div className="lg:col-span-2 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-[#141820]">
                        <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-black" style={{ fontSize: 16 }}>Change requests</p>
                      <button
                        type="button"
                            onClick={() => {
                              void fetchInboxData();
                              setNotice('Requests refreshed.');
                              window.setTimeout(() => setNotice(''), 1400);
                            }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                        aria-label="Refresh requests"
                            title="Refresh requests"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChangeKind('all')}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'all' ? 'bg-white/10 text-white border-white/15' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangeKind('cancellation')}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'cancellation' ? 'bg-yellow-500/10 text-yellow-200 border-yellow-500/25' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        Cancellations
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangeKind('reschedule')}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'reschedule' ? 'bg-blue-500/10 text-blue-200 border-blue-500/25' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        Reschedules
                      </button>
                      <div className="relative flex-1 min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search name, court, reason…"
                          className="w-full rounded-xl pl-10 pr-3 py-2 bg-white/[0.06] border border-white/10 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-black"
                          style={{ fontSize: 12 }}
                        />
                      </div>
                    </div>
                    <p className="text-gray-600 font-black mt-2" style={{ fontSize: 10 }}>
                      {filteredChangeRows.length} pending
                    </p>
                  </div>

                  {filteredChangeRows.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle size={36} className="mx-auto mb-3 text-green-400" />
                      <p className="text-white font-black" style={{ fontSize: 15 }}>All caught up</p>
                      <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>No pending requests.</p>
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                      {filteredChangeRows.map((r) => {
                        const active = r.id === selectedChange?.id;
                        const tagColor = r.requestType === 'reschedule' ? 'rgba(59,130,246,0.18)' : 'rgba(251,191,36,0.18)';
                        const tagBorder = r.requestType === 'reschedule' ? 'rgba(59,130,246,0.28)' : 'rgba(251,191,36,0.28)';
                        const tagText = r.requestType === 'reschedule' ? '#bfdbfe' : '#fde68a';
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={`w-full text-left px-4 py-3 transition-colors ${active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 13 }}>
                                {initials(r.customerName || 'US')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-white font-black truncate" style={{ fontSize: 13 }}>{r.customerName || 'Customer'}</p>
                                  <span className="px-2 py-0.5 rounded-full font-black border"
                                    style={{ fontSize: 10, background: tagColor, borderColor: tagBorder, color: tagText }}>
                                    {r.requestType === 'reschedule' ? 'RESCHEDULE' : 'CANCEL'}
                                  </span>
                                </div>
                                <p className="text-gray-500 font-black mt-1 truncate" style={{ fontSize: 11 }}>
                                  {r.court} · {r.date} · {formatTimeShort(r.time)}
                                </p>
                                <p className="text-gray-600 font-black mt-1 truncate" style={{ fontSize: 10 }}>
                                  {r.reason || '—'}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: detail */}
                <div className="lg:col-span-3 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                  {!selectedChange ? (
                    <div className="p-10 text-center">
                      <Filter size={26} className="mx-auto mb-3 text-gray-700" />
                      <p className="text-white font-black" style={{ fontSize: 15 }}>Select a request</p>
                      <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>Pick an item on the left to review details.</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="p-5 border-b border-white/5 bg-[#141820]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Request</p>
                            <p className="text-white font-black truncate" style={{ fontSize: 18 }}>
                              {selectedChange.requestType === 'reschedule' ? 'Reschedule' : 'Cancellation'} · {selectedChange.customerName}
                            </p>
                            <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>
                              {selectedChange.court} · {selectedChange.date} · {formatTimeShort(selectedChange.time)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(selectedChange.bookingId).catch(() => {});
                                setNotice('Booking ID copied.');
                                window.setTimeout(() => setNotice(''), 1400);
                              }}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                              aria-label="Copy booking id"
                              title="Copy booking id"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void fetchInboxData();
                                setNotice('Requests refreshed.');
                                window.setTimeout(() => setNotice(''), 1400);
                              }}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                              aria-label="Refresh"
                              title="Refresh"
                            >
                              <RefreshCw size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-5 space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                          <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Reason</p>
                          <p className="text-gray-200 mt-2" style={{ fontSize: 13, lineHeight: 1.55 }}>
                            {selectedChange.reason || '—'}
                          </p>
                        </div>

                        {selectedChange.requestType === 'reschedule' ? (
                          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                            <p className="text-blue-200 font-black uppercase" style={{ fontSize: 10 }}>Requested schedule</p>
                            <p className="text-white font-black mt-2" style={{ fontSize: 14 }}>
                              {selectedChange.requestedNewDate || '—'} · {selectedChange.requestedNewStartTime ? formatTimeShort(selectedChange.requestedNewStartTime) : '—'}
                            </p>
                            <p className="text-blue-200/70 font-black mt-1" style={{ fontSize: 11 }}>
                              Approving will update the booking date/time.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                            <p className="text-yellow-200 font-black uppercase" style={{ fontSize: 10 }}>Cancellation note</p>
                            <p className="text-yellow-100/80 font-black mt-2" style={{ fontSize: 12, lineHeight: 1.55 }}>
                              Approving will cancel the booking. Rejecting keeps it active.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-5 border-t border-white/5 bg-[#141820] flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({ type: selectedChange.requestType, id: selectedChange.id, approved: false });
                            setModalOpen(true);
                          }}
                          className="flex-1 py-3 rounded-2xl font-black border border-red-500/20 text-red-200 hover:bg-red-500/10 transition-colors"
                          style={{ fontSize: 13 }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({ type: selectedChange.requestType, id: selectedChange.id, approved: true });
                            setModalOpen(true);
                          }}
                          className="flex-1 py-3 rounded-2xl font-black text-white transition-all"
                          style={{ fontSize: 13, background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 8px 24px rgba(34,197,94,0.28)' }}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

            {sub === 'coaching' && (
              <motion.div key="coaching" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                {requests.coaching.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
                    <p className="text-white font-black" style={{ fontSize: 16 }}>All caught up</p>
                    <p style={{ color: TS, fontSize: 13 }}>No pending coaching items</p>
                  </div>
                ) : (
                  visibleCoaching.map((r: any) => (
                    <motion.div key={r.id} whileHover={{ y: -2 }} className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: '#1A1E29', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black"
                          style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', fontSize: 13 }}>
                          {initials(r.userName || 'US')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-black" style={{ fontSize: 15 }}>{r.userName}</span>
                            <span className="px-2 py-0.5 rounded text-blue-400 font-bold" style={{ fontSize: 10, background: 'rgba(96,165,250,0.1)' }}>VERIFY PAYMENT</span>
                            {!r.isReal && <span className="px-2 py-0.5 rounded text-blue-300 font-bold" style={{ fontSize: 10, background: 'rgba(96,165,250,0.15)' }}>DEMO</span>}
                          </div>
                          <p style={{ color: TS, fontSize: 13 }}>Coach: {r.coachName} · {r.sport}</p>
                          <p style={{ color: TS, fontSize: 12 }}>{r.requestedDate} · {r.requestedTime}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                        {confirmAction?.id === r.id ? (
                          <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => handleApprove()} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-green-500 transition-all text-xs">Verify Real?</button>
                            <button onClick={() => setConfirmAction(null)} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-gray-600 transition-all text-xs">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setConfirmAction({ type: 'coaching', id: r.id, approved: true })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                              <Check size={14} /> Verify
                            </button>
                            <button onClick={() => setConfirmAction({ type: 'coaching', id: r.id, approved: false })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {sub === 'announcements' && (
              <motion.div key="announcements" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Composer */}
                  <div className="lg:col-span-3 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden min-h-[520px]">
                    <div className="p-5 border-b border-white/5 bg-[#141820] flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-black" style={{ fontSize: 16 }}>Send announcement</p>
                        <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>
                          This appears in the user notification bell.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshAnnouncements()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                        aria-label="Refresh announcements"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>

                    {announceError ? (
                      <div className="px-5 pt-4">
                        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-amber-200 font-black" style={{ fontSize: 12 }}>
                          {announceError}
                        </div>
                      </div>
                    ) : null}

                    <form onSubmit={handleSendAnnounce} className="p-5 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'promotion', label: 'Promo' },
                          { id: 'maintenance', label: 'Maintenance' },
                          { id: 'reminder', label: 'Reminder' },
                          { id: 'update', label: 'Update' },
                          { id: 'alert', label: 'Alert' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAnnouncementForm((p) => ({ ...p, type: t.id as any }))}
                            className={`px-3 py-1.5 rounded-xl font-black border transition-colors ${announcementForm.type === (t.id as any) ? 'bg-orange-500/15 text-orange-200 border-orange-500/25' : 'bg-white/[0.03] text-gray-500 border-white/10 hover:border-white/15'}`}
                            style={{ fontSize: 12 }}
                          >
                            {t.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const tpl = {
                              promotion: { title: 'Special Weekend Promo', message: 'Get 20% off court bookings today. Limited slots available.' },
                              maintenance: { title: 'Scheduled Maintenance', message: 'Some courts will be temporarily unavailable for maintenance. Thank you for your patience.' },
                              reminder: { title: 'Booking Reminder', message: 'Reminder: Please arrive 10 minutes early for check-in.' },
                              update: { title: 'System Update', message: 'We’ve improved the booking flow and activity log for faster check-in/out.' },
                              alert: { title: 'Important Notice', message: 'Please check the latest updates before arriving at the facility.' },
                            }[announcementForm.type as any];
                            if (tpl) setAnnouncementForm((p) => ({ ...p, title: tpl.title, message: tpl.message }));
                          }}
                          className="ml-auto px-3 py-1.5 rounded-xl font-black border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                          style={{ fontSize: 12 }}
                        >
                          Use template
                        </button>
                      </div>

                      <div>
                        <label className="block text-gray-500 font-black uppercase mb-1.5" style={{ fontSize: 10 }}>Title</label>
                        <input
                          type="text"
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm((p) => ({ ...p, title: e.target.value }))}
                          className="w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/25 font-black"
                          style={{ fontSize: 13 }}
                          placeholder="e.g. Special Weekend Promo"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-500 font-black uppercase mb-1.5" style={{ fontSize: 10 }}>Message</label>
                        <textarea
                          value={announcementForm.message}
                          onChange={(e) => setAnnouncementForm((p) => ({ ...p, message: e.target.value }))}
                          className="w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/25 font-black min-h-[120px]"
                          style={{ fontSize: 13, lineHeight: 1.5 }}
                          placeholder="Write your announcement…"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={announceLoading}
                        className="w-full py-3 rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', fontSize: 14, boxShadow: '0 10px 26px rgba(249,115,22,0.28)' }}
                      >
                        <Send size={16} /> Publish announcement
                      </button>

                      {announceSent ? (
                        <p className="text-green-400 text-center font-black" style={{ fontSize: 12 }}>{announceSent}</p>
                      ) : null}
                    </form>
                  </div>

                  {/* Sent list */}
                  <div className="lg:col-span-2 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden min-h-[520px]">
                    <div className="p-5 border-b border-white/5 bg-[#141820]">
                      <p className="text-white font-black" style={{ fontSize: 16 }}>Sent</p>
                      <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>
                        Latest published announcements.
                      </p>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                      {(announcements || []).length === 0 ? (
                        <div className="p-8 text-center">
                          <Megaphone size={26} className="mx-auto mb-3 text-gray-700" />
                          <p className="text-gray-500 font-black" style={{ fontSize: 12 }}>No announcements yet.</p>
                        </div>
                      ) : (
                        (announcements || []).map((a: any) => (
                          <div key={a.id} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.20)' }}>
                                <Megaphone size={16} className="text-orange-300" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-white font-black truncate" style={{ fontSize: 13 }}>{a.title}</p>
                                <p className="text-gray-600 font-black mt-1" style={{ fontSize: 10 }}>
                                  <Clock size={12} className="inline mr-1" />
                                  {new Date(a.createdAt || a.date || Date.now()).toLocaleString('en-PH')}
                                </p>
                                <p className="text-gray-300 mt-2" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                  {a.message}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

        </AnimatePresence>
      </div>

      <ModalShell
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setConfirmAction(null);
          setRejectReason('');
        }}
        title={confirmAction?.approved ? 'Approve request?' : 'Reject request?'}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Summary</p>
            <p className="text-gray-200 font-black mt-2" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {selectedChange
                ? `${selectedChange.requestType === 'reschedule' ? 'Reschedule' : 'Cancellation'} · ${selectedChange.customerName} · ${selectedChange.court}`
                : 'Review this request before confirming.'}
            </p>
            {selectedChange?.requestType === 'reschedule' ? (
              <p className="text-blue-200/90 font-black mt-2" style={{ fontSize: 12 }}>
                Requested: {selectedChange.requestedNewDate || '—'} · {selectedChange.requestedNewStartTime ? formatTimeShort(selectedChange.requestedNewStartTime) : '—'}
              </p>
            ) : null}
          </div>

          {!confirmAction?.approved ? (
            <div>
              <label className="block text-gray-500 font-black uppercase mb-1.5" style={{ fontSize: 10 }}>Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/25 font-black min-h-[90px]"
                style={{ fontSize: 13, lineHeight: 1.5 }}
                placeholder="Write a short reason to help the user…"
              />
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setConfirmAction(null);
                setRejectReason('');
              }}
              className="flex-1 py-3 rounded-2xl font-black border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              style={{ fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={busy}
              className="flex-1 py-3 rounded-2xl font-black text-white transition-all"
              style={{
                fontSize: 13,
                background: confirmAction?.approved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
                opacity: busy ? 0.65 : 1,
              }}
            >
              {busy ? 'Processing...' : (confirmAction?.approved ? 'Approve' : 'Reject')}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}