import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle,
  GraduationCap,
  Check,
  X,
  Megaphone,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Send,
  Sparkles,
  Bell,
  Wrench,
  Info,
} from 'lucide-react';
import { useStaffAPI } from '../../hooks/useStaffAPI';
import { useAnnouncements } from '../../contexts/AnnouncementsContext';

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
type SortOrder = 'newest' | 'oldest';
type AnnouncementTone = { active: string; idle: string };

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

function formatDateLong(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ANNOUNCEMENT_CATEGORY_TONE: Record<string, AnnouncementTone> = {
  promotion: {
    active: 'bg-orange-500/15 text-orange-200 border-orange-500/25',
    idle: 'bg-orange-500/[0.06] text-orange-300 border-orange-500/20 hover:border-orange-400/35',
  },
  maintenance: {
    active: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
    idle: 'bg-amber-500/[0.06] text-amber-300 border-amber-500/20 hover:border-amber-400/35',
  },
  reminder: {
    active: 'bg-sky-500/15 text-sky-200 border-sky-500/25',
    idle: 'bg-sky-500/[0.06] text-sky-300 border-sky-500/20 hover:border-sky-400/35',
  },
  update: {
    active: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
    idle: 'bg-emerald-500/[0.06] text-emerald-300 border-emerald-500/20 hover:border-emerald-400/35',
  },
  alert: {
    active: 'bg-red-500/15 text-red-200 border-red-500/25',
    idle: 'bg-red-500/[0.06] text-red-300 border-red-500/20 hover:border-red-400/35',
  },
};

const getCategoryIcon = (type: string) => {
  switch (type) {
    case 'promotion': return Sparkles;
    case 'maintenance': return Wrench;
    case 'reminder': return Clock;
    case 'update': return Info;
    case 'alert': return AlertTriangle;
    default: return Bell;
  }
};

const getCategoryColor = (type: string) => {
  switch (type) {
    case 'promotion': return '#F97316';
    case 'maintenance': return '#F59E0B';
    case 'reminder': return '#0EA5E9';
    case 'update': return '#10B981';
    case 'alert': return '#EF4444';
    default: return '#F97316';
  }
};

const getCategoryBg = (type: string) => {
  switch (type) {
    case 'promotion': return 'rgba(249,115,22,0.12)';
    case 'maintenance': return 'rgba(245,158,11,0.12)';
    case 'reminder': return 'rgba(14,165,233,0.12)';
    case 'update': return 'rgba(16,185,129,0.12)';
    case 'alert': return 'rgba(239,68,68,0.12)';
    default: return 'rgba(249,115,22,0.12)';
  }
};

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
  const { addAnnouncement, announcements, refresh: refreshAnnouncements, error: announceError, isLoading: announceLoading, clearAnnouncements } = useAnnouncements();

  const [sub, setSub] = useState<InboxSubTab>('cancellations');
  const [requests, setRequests] = useState<any>({ cancellations: [], reschedules: [], coaching: [] });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as const });
  const [announceSent, setAnnounceSent] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancellation' | 'reschedule' | 'coaching'; id: string; approved: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [dummyCancellations, setDummyCancellations] = useState(DUMMY_CANCELLATIONS);
  const [dummyReschedules, setDummyReschedules] = useState(DUMMY_RESCHEDULES);
  const [dummyCoaching, setDummyCoaching] = useState(DUMMY_COACHING);
  const [changeKind, setChangeKind] = useState<ChangeKind>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>('');
  const [refreshHint, setRefreshHint] = useState<'changes' | 'announcements' | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isChangeLoading, setIsChangeLoading] = useState(false);

  const openRefreshHint = (scope: 'changes' | 'announcements') => {
    setRefreshHint(scope);
    window.setTimeout(() => setRefreshHint((prev) => (prev === scope ? null : prev)), 1800);
  };

  const runListLoadingPulse = () => {
    setIsChangeLoading(true);
    window.setTimeout(() => setIsChangeLoading(false), 420);
  };

  const refreshRequestsAnimated = async () => {
    const started = Date.now();
    setIsChangeLoading(true);
    await fetchInboxData();
    const elapsed = Date.now() - started;
    const wait = Math.max(220, 520 - elapsed);
    window.setTimeout(() => setIsChangeLoading(false), wait);
    openRefreshHint('changes');
  };

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
    setPublishConfirmOpen(true);
  };

  const confirmPublish = async () => {
    setPublishConfirmOpen(false);
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
    return [
      { id: 'cancellations' as InboxSubTab, label: 'Change Requests', icon: AlertTriangle, badge: pendingCancellations, color: '#fbbf24', desc: 'Cancellations and reschedules needing approval.' },
      { id: 'coaching' as InboxSubTab, label: 'Coaching Payments', icon: GraduationCap, badge: pendingCoaching, color: '#60a5fa', desc: 'Accepted coaching tickets waiting for payment verification.' },
    ];
  }, [pendingCancellations, pendingCoaching]);

  const changeRows: ChangeRequestRow[] = useMemo(() => {
    const cancels = (visibleCancellations || []).map((r: any) => ({ ...r, requestType: 'cancellation' as const }));
    const resched = (visibleReschedules || []).map((r: any) => ({ ...r, requestType: 'reschedule' as const }));
    return [...resched, ...cancels];
  }, [visibleCancellations, visibleReschedules]);

  const filteredChangeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = changeRows.filter((r) => {
      if (changeKind !== 'all' && r.requestType !== changeKind) return false;
      if (!q) return true;
      return [r.customerName, r.court, r.reason, r.bookingId, r.id].join(' ').toLowerCase().includes(q);
    });
    return filtered.sort((a, b) => {
      const ad = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
      const bd = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
      return sortOrder === 'newest' ? bd - ad : ad - bd;
    });
  }, [changeRows, changeKind, query, sortOrder]);

  const selectedChange = useMemo(() => {
    const target = selectedId || (filteredChangeRows[0]?.id ?? null);
    if (!target) return null;
    return filteredChangeRows.find((r) => r.id === target) || filteredChangeRows[0] || null;
  }, [filteredChangeRows, selectedId]);

  const modalRequest = useMemo(() => {
    if (!confirmAction) return null;
    return changeRows.find((r) => r.id === confirmAction.id) || selectedChange || null;
  }, [confirmAction, changeRows, selectedChange]);

  const announcementErrorText = useMemo(() => {
    if (!announceError) return '';
    const normalized = announceError.toLowerCase();
    if (normalized.includes('not found') || normalized.includes('404')) {
      return 'No published announcements yet. You can post your first announcement below.';
    }
    return announceError;
  }, [announceError]);

  useEffect(() => {
    if (!selectedId && filteredChangeRows.length > 0) setSelectedId(filteredChangeRows[0].id);
  }, [filteredChangeRows.length, selectedId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-black" style={{ fontSize: 24 }}>Front Desk Inbox</h2>
        <p className="text-gray-500" style={{ fontSize: 13 }}>
          Action items for staff. Review booking changes and verify coaching payments.
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
                      <p className="text-white font-black" style={{ fontSize: 16 }}>Change Requests</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChangeKind('all');
                          runListLoadingPulse();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'all' ? 'bg-white/10 text-white border-white/15' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChangeKind('cancellation');
                          runListLoadingPulse();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'cancellation' ? 'bg-yellow-500/10 text-yellow-200 border-yellow-500/25' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        Cancellations
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChangeKind('reschedule');
                          runListLoadingPulse();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black border ${changeKind === 'reschedule' ? 'bg-blue-500/10 text-blue-200 border-blue-500/25' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/15'}`}
                        style={{ fontSize: 12 }}
                      >
                        Reschedules
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
                          runListLoadingPulse();
                        }}
                        className="px-3 py-1.5 rounded-xl font-black border bg-white/[0.03] text-gray-300 border-white/10 hover:border-white/15"
                        style={{ fontSize: 12 }}
                      >
                        {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
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
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-gray-600 font-black" style={{ fontSize: 10 }}>
                        {filteredChangeRows.length} pending
                      </p>
                      <p className="text-gray-600 font-black" style={{ fontSize: 10 }}>
                        Sort: {sortOrder === 'newest' ? 'Newest to oldest' : 'Oldest to newest'}
                      </p>
                    </div>
                  </div>

                  {isChangeLoading ? (
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-4 space-y-3">
                      {[1, 2, 3, 4].map((k) => (
                        <motion.div
                          key={`skeleton-${k}`}
                          animate={{ opacity: [0.45, 0.9, 0.45] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: k * 0.05 }}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/10" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 rounded bg-white/10 w-1/2" />
                              <div className="h-3 rounded bg-white/10 w-2/3" />
                              <div className="h-2.5 rounded bg-white/10 w-4/5" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : filteredChangeRows.length === 0 ? (
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
                            className={`w-full text-left px-4 py-3 transition-all duration-300 ${active ? 'bg-blue-500/10 ring-1 ring-blue-400/35' : 'hover:bg-white/[0.03]'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black"
                                style={{ background: active ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.06)', border: active ? '1px solid rgba(96,165,250,0.45)' : '1px solid rgba(255,255,255,0.10)', fontSize: 13 }}>
                                {initials(r.customerName || 'US')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-black truncate transition-colors ${active ? 'text-blue-100' : 'text-white'}`} style={{ fontSize: 13 }}>{r.customerName || 'Customer'}</p>
                                  <span className="px-2 py-0.5 rounded-full font-black border"
                                    style={{ fontSize: 10, background: tagColor, borderColor: tagBorder, color: tagText }}>
                                    {r.requestType === 'reschedule' ? 'RESCHEDULE' : 'CANCEL'}
                                  </span>
                                </div>
                                <p className={`font-black mt-1 truncate transition-colors ${active ? 'text-blue-200' : 'text-gray-500'}`} style={{ fontSize: 11 }}>
                                  {r.court} · {formatDateLong(r.date)} · {formatTimeShort(r.time)}
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
                              {selectedChange.court} · {formatDateLong(selectedChange.date)} · {formatTimeShort(selectedChange.time)}
                            </p>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => void refreshRequestsAnimated()}
                              className="h-9 px-3 rounded-xl flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300"
                              aria-label="Refresh requests"
                            >
                              <RefreshCw size={14} />
                              <span className="font-black" style={{ fontSize: 11 }}>Refresh</span>
                            </button>
                            {refreshHint === 'changes' ? (
                              <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg border border-emerald-500/30 bg-[#0f1d14] px-2.5 py-1.5 text-emerald-200 font-black shadow-xl z-20"
                                style={{ fontSize: 11 }}>
                                Requests updated
                              </div>
                            ) : null}
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
                              {formatDateLong(selectedChange.requestedNewDate || '')} · {selectedChange.requestedNewStartTime ? formatTimeShort(selectedChange.requestedNewStartTime) : '—'}
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
                          className="flex-1 py-3 rounded-2xl font-black text-white transition-all"
                          style={{ fontSize: 13, background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 8px 24px rgba(239,68,68,0.30)' }}
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
              <motion.div key="coaching" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3 lg:col-span-5">
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
              <motion.div key="announcements" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="lg:col-span-5">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-5 border-b border-white/5 bg-[#141820]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-black" style={{ fontSize: 17 }}>Announcement composer</p>
                          <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>
                            Publish clear updates to user notifications.
                          </p>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              void refreshAnnouncements();
                              openRefreshHint('announcements');
                            }}
                            className="h-9 px-3 rounded-xl flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300"
                            aria-label="Refresh announcements"
                          >
                            <RefreshCw size={14} />
                            <span className="font-black" style={{ fontSize: 11 }}>Refresh</span>
                          </button>
                          {refreshHint === 'announcements' ? (
                            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg border border-emerald-500/30 bg-[#0f1d14] px-2.5 py-1.5 text-emerald-200 font-black shadow-xl z-20"
                              style={{ fontSize: 11 }}>
                              Announcements updated
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                        <div className="xl:col-span-2">
                          {announcementErrorText ? (
                            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-blue-200 font-black mb-4" style={{ fontSize: 12 }}>
                              {announcementErrorText}
                            </div>
                          ) : null}
                          <form onSubmit={handleSendAnnounce} className="space-y-5">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Category</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tpl = {
                                      promotion: { title: 'Special Weekend Promo', message: 'Get 20% off court bookings today. Limited slots available.' },
                                      maintenance: { title: 'Scheduled Maintenance', message: 'Some courts will be temporarily unavailable for maintenance. Thank you for your patience.' },
                                      reminder: { title: 'Booking Reminder', message: 'Reminder: Please arrive 10 minutes early for check-in.' },
                                      update: { title: 'System Update', message: 'We have improved the booking flow and activity log for faster check-in/out.' },
                                      alert: { title: 'Important Notice', message: 'Please check the latest updates before arriving at the facility.' },
                                    }[announcementForm.type as any];
                                    if (tpl) setAnnouncementForm((p) => ({ ...p, title: tpl.title, message: tpl.message }));
                                  }}
                                  className="text-orange-400 hover:text-orange-300 font-black flex items-center gap-1 transition-colors"
                                  style={{ fontSize: 10 }}
                                >
                                  <Sparkles size={10} /> Use Template
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
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
                                    className={`px-3 py-2 rounded-xl font-black border transition-colors ${announcementForm.type === (t.id as any)
                                      ? (ANNOUNCEMENT_CATEGORY_TONE[t.id]?.active || 'bg-orange-500/15 text-orange-200 border-orange-500/25')
                                      : (ANNOUNCEMENT_CATEGORY_TONE[t.id]?.idle || 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/15')}`}
                                    style={{ fontSize: 12 }}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
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
                              <div className="flex items-center justify-between">
                                <label className="block text-gray-500 font-black uppercase mb-1.5" style={{ fontSize: 10 }}>Message</label>
                                <span className="text-gray-600 font-black" style={{ fontSize: 10 }}>
                                  {announcementForm.message.length}/280
                                </span>
                              </div>
                              <textarea
                                value={announcementForm.message}
                                onChange={(e) => setAnnouncementForm((p) => ({ ...p, message: e.target.value.slice(0, 280) }))}
                                className="w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/25 font-black min-h-[140px]"
                                style={{ fontSize: 13, lineHeight: 1.55 }}
                                placeholder="Write your announcement..."
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={announceLoading}
                              className="w-full py-3 rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', fontSize: 14, boxShadow: '0 10px 26px rgba(249,115,22,0.28)' }}
                            >
                              <Send size={16} /> Publish Announcement
                            </button>
                          </form>
                        </div>

                        <div className="xl:col-span-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 h-fit flex flex-col gap-4">
                          <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Live preview (User Notification View)</p>
                          <div className="rounded-2xl border border-white/10 bg-[#141820] overflow-hidden">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={announcementForm.type + announcementForm.title + announcementForm.message}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-start gap-3 px-5 py-4"
                              >
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: getCategoryBg(announcementForm.type) }}>
                                  {React.createElement(getCategoryIcon(announcementForm.type), { size: 15, style: { color: getCategoryColor(announcementForm.type) } })}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-[#E8E8EA]" style={{ fontSize: 13 }}>{announcementForm.title || 'Announcement title'}</p>
                                  <p className="text-[#9294A0] mt-0.5" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                    {announcementForm.message || 'Your announcement message preview appears here.'}
                                  </p>
                                </div>
                                <button type="button" className="p-1 flex-shrink-0 opacity-50" disabled>
                                  <X size={13} style={{ color: "#9294A0" }} />
                                </button>
                              </motion.div>
                            </AnimatePresence>
                          </div>
                          <AnimatePresence>
                            {announceSent ? (
                              <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="text-green-400 text-center font-black mt-2" style={{ fontSize: 12 }}>{announceSent}</motion.p>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sent list */}
                  <div className="lg:col-span-2 bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-white/5 bg-[#141820] flex items-center justify-between">
                      <div>
                        <p className="text-white font-black" style={{ fontSize: 16 }}>Recent announcements</p>
                        <p className="text-gray-500 font-black mt-1" style={{ fontSize: 12 }}>
                          Review what users currently see.
                        </p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => void clearAnnouncements()}
                        className="px-3 py-1.5 rounded-xl font-black border border-white/10 text-gray-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        style={{ fontSize: 11 }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-[74vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                      <AnimatePresence>
                        {(announcements || []).length === 0 ? (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 text-center">
                            <Bell size={26} className="mx-auto mb-3 text-gray-700 opacity-50" />
                            <p className="text-gray-500 font-black" style={{ fontSize: 12 }}>No announcements yet.</p>
                          </motion.div>
                        ) : (
                          (announcements || []).map((a: any) => (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout key={a.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02]">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: getCategoryBg(a.type) }}>
                                {React.createElement(getCategoryIcon(a.type), { size: 15, style: { color: getCategoryColor(a.type) } })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-black text-[#E8E8EA] truncate" style={{ fontSize: 13 }}>{a.title}</p>
                                  <span className="px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400 font-black uppercase flex-shrink-0" style={{ fontSize: 9 }}>
                                    {String(a.type || 'general')}
                                  </span>
                                </div>
                                <p className="text-[#9294A0]" style={{ fontSize: 12, lineHeight: 1.5 }}>{a.message}</p>
                                <p className="text-gray-600 font-black mt-2" style={{ fontSize: 10 }}>
                                  {new Date(a.createdAt || a.date || Date.now()).toLocaleString('en-PH')}
                                </p>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
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
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Request details</p>
              <span
                className="px-2 py-0.5 rounded-full border font-black uppercase"
                style={{
                  fontSize: 9,
                  borderColor: confirmAction?.approved ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
                  background: confirmAction?.approved ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: confirmAction?.approved ? '#86efac' : '#fca5a5',
                }}
              >
                {confirmAction?.approved ? 'Approve' : 'Reject'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 9 }}>Member</p>
                <p className="text-gray-100 font-black mt-1" style={{ fontSize: 12 }}>{modalRequest?.customerName || '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 9 }}>Type</p>
                <p className="text-gray-100 font-black mt-1 capitalize" style={{ fontSize: 12 }}>{modalRequest?.requestType || '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 9 }}>Current schedule</p>
                <p className="text-gray-100 font-black mt-1" style={{ fontSize: 12 }}>
                  {formatDateLong(modalRequest?.date || '')} · {formatTimeShort(modalRequest?.time || '')}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 9 }}>Court</p>
                <p className="text-gray-100 font-black mt-1" style={{ fontSize: 12 }}>{modalRequest?.court || '—'}</p>
              </div>
            </div>
            {modalRequest?.requestType === 'reschedule' ? (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
                <p className="text-blue-200 font-black uppercase" style={{ fontSize: 9 }}>Requested schedule</p>
                <p className="text-white font-black mt-1.5" style={{ fontSize: 12 }}>
                  {formatDateLong(modalRequest?.requestedNewDate || '')} · {formatTimeShort(modalRequest?.requestedNewStartTime || '')}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-gray-500 font-black uppercase" style={{ fontSize: 9 }}>Reason submitted</p>
              <p className="text-gray-200 mt-1.5" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {modalRequest?.reason || 'No reason provided.'}
              </p>
            </div>
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

      <ModalShell
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        title="Publish Announcement?"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Preview</p>
            <div className="rounded-xl border border-white/10 bg-[#141820] overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: getCategoryBg(announcementForm.type) }}>
                  {React.createElement(getCategoryIcon(announcementForm.type), { size: 14, style: { color: getCategoryColor(announcementForm.type) } })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#E8E8EA]" style={{ fontSize: 12 }}>{announcementForm.title}</p>
                  <p className="text-[#9294A0] mt-0.5" style={{ fontSize: 11, lineHeight: 1.5 }}>{announcementForm.message}</p>
                </div>
              </div>
            </div>
            <p className="text-gray-400 mt-2" style={{ fontSize: 11, lineHeight: 1.5 }}>
              This will send a notification to all users' devices immediately. Please review the contents carefully.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPublishConfirmOpen(false)}
              className="flex-1 py-3 rounded-2xl font-black border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              style={{ fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmPublish()}
              className="flex-1 py-3 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 13, background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.30)' }}
            >
              <Send size={14} /> Publish Now
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
