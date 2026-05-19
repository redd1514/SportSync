import { FacilityMapBuilder } from './FacilityMapBuilder';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AdminBookingCalendar } from './AdminBookingCalendar';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, MapPin, Calendar, Settings, Shield, Bell, DollarSign,
  Users, AlertTriangle, Plus, Award, Check, X, UserX, UserCheck,
  Menu, LogOut, ChevronRight, ChevronLeft, ChevronDown, Clock, CheckCircle, BarChart2,
  Building, Tag, GraduationCap, Megaphone, Wrench, PlusCircle, Trash2,
  XCircle, Phone, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '../../contexts/UserContext';
import { useCoaching } from '../../contexts/CoachingContext';
import { useRealtimeAdminDashboard } from '../../hooks/useRealtimeData';
import { ConnectionStatus } from '../shared/ConnectionStatus';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { AdminCoachingManagement } from './AdminCoachingManagement';
import { AdminAddonsManagement } from './AdminAddonsManagement';
import { RoleManagementAdmin } from './RoleManagementAdmin';
import { ALL_COURTS, RATE_CARD, SPORTS_INFO } from '../sportsData';
import { getSportColor, SportIcon } from '../SportIcons';
import { CustomDateTimePicker } from '../shared/CustomDateTimePicker';
import { useAddons } from '../../contexts/AddonsContext';
import { useFacilityMap, bookingAppliesToPublishedMap } from '../../contexts/FacilityMapContext';
import { useAnnouncements, type Announcement } from '../../contexts/AnnouncementsContext';
import { useAdminAPI } from '../../hooks/useAdminAPI';
import { useBookingAPI } from '../../hooks/useBookingAPI';
import { parseBookingNotes } from '../../../api/utils/bookingMap.ts';

type AdminTab = 'executive' | 'facility' | 'calendar' | 'coaching' | 'settings';

/* ─── Reusable Confirm Modal ─────────────────────────────────────── */
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
        className="bg-[#1A1A1A] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `${opts.confirmColor}15`, border: `1.5px solid ${opts.confirmColor}30` }}>
          {opts.icon}
        </div>
        <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>{opts.title}</h3>
        <p className="text-gray-400 text-center mb-6" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{opts.body}</p>
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
function PhoneInput({ value, onChange, accentColor = '#FF8C00', placeholder = '9XX XXX XXXX' }: {
  value: string; onChange: (v: string) => void; accentColor?: string; placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const trimmed = raw.startsWith('09') ? raw.slice(2) : raw.startsWith('9') ? raw.slice(1) : raw;
    onChange(`09${trimmed.slice(0, 9)}`);
  };
  const displayValue = value.startsWith('09') ? value.slice(2) : value;
  return (
    <div className="relative flex items-center">
      <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none">
        <span className="text-white font-black" style={{ fontSize: 13 }}>🇵🇭</span>
        <span className="font-black" style={{ fontSize: 13, color: accentColor }}>09</span>
        <div className="w-px h-4 bg-white/15 ml-1" />
      </div>
      <input type="tel" placeholder={placeholder} value={displayValue} onChange={handleChange} maxLength={9}
        className="w-full rounded-xl py-2.5 text-white focus:outline-none"
        style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.12)`, paddingLeft: 88, paddingRight: 12 }} />
      {value.length === 11 && (
        <div className="absolute right-3 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check size={9} className="text-green-400" />
        </div>
      )}
    </div>
  );
}

const ADMIN_TABS: { id: AdminTab; icon: any; label: string; sub: string }[] = [
  { id: 'executive', icon: TrendingUp,    label: 'Executive Overview',   sub: 'KPIs, Analytics, Users, Payments'  },
  { id: 'facility',  icon: MapPin,        label: 'Facility Management',  sub: 'Courts, Map Layout, Add-ons'        },
  { id: 'calendar',  icon: Calendar,      label: 'Master Calendar',      sub: 'Bookings, Schedule, Requests'       },
  { id: 'coaching',  icon: GraduationCap, label: 'Coaching Management',  sub: 'Coaches, Requests, Applications'   },
  { id: 'settings',  icon: Settings,      label: 'System Settings',      sub: 'Business Config, Staff, Notices'    },
];

const SPORT_COLORS: Record<string, string> = {
  Basketball: '#FF8C00', Volleyball: '#0047AB', Badminton: '#22c55e',
  Pickleball: '#a855f7', Billiards: '#ec4899', 'Table Tennis': '#06b6d4',
};

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: 'bg-green-500/15', text: 'text-green-400' },
    pending: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
    completed: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
    cancelled: { bg: 'bg-red-500/15', text: 'text-red-400' },
    rescheduled: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  };
  const c = cfg[status] || cfg.pending;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-black ${c.bg} ${c.text} capitalize`}>
      {status}
    </span>
  );
}

// ── Executive Overview ──────────────────────────────────────────────────────
type ExecSubTab = 'overview' | 'analytics' | 'users' | 'payments' | 'loyalty';

function ExecutiveOverview() {
  const { cancellationRequests } = useUser();
  const { getAnalytics, getAllBookings, getAllUsers, updateUser, getPaymentTransactions, getLoyaltyProgram } = (useAdminAPI as any)();
  const [sub, setSub] = useState<ExecSubTab>('overview');
  const [userConfirm, setUserConfirm] = useState<{ id: string; name: string; action: 'suspend' | 'activate' } | null>(null);
  const [loyaltyConfirm, setLoyaltyConfirm] = useState<{ id: string; name: string; points: number } | null>(null);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [apiBookings, setApiBookings] = useState<any[]>([]);
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [apiPayments, setApiPayments] = useState<any[]>([]);
  const [apiLoyalty, setApiLoyalty] = useState<any>(null);

  const analyticsSummary = analyticsData?.summary || {};
  const analyticsBookings = Array.isArray(analyticsData?.bookings) ? analyticsData.bookings : [];
  const { bookings: realtimeBookings } = useRealtimeAdminDashboard();

  const bookingSortTs = (row: any) => {
    const datePart = row?.date || row?.booking_date || '';
    const startTimePart = row?.startTime || row?.start_time || (typeof row?.time === 'string' ? row.time.split(' - ')[0] : '00:00') || '00:00';
    const createdAt = row?.createdAt || row?.created_at || '';
    const dt = datePart ? new Date(`${datePart}T${startTimePart}:00`) : null;
    const dtMs = dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0;
    const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
    return Math.max(dtMs, Number.isNaN(createdMs) ? 0 : createdMs);
  };

  const sortBookingsNewestFirst = (rows: any[]) => {
    return [...rows].sort((a: any, b: any) => {
      const tsDiff = bookingSortTs(b) - bookingSortTs(a);
      if (tsDiff !== 0) return tsDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
  };

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const users = await getAllUsers();
      setApiUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
      setApiUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [getAllUsers]);

  const resetUserLoyalty = async (targetUserId: string) => {
    await updateUser(targetUserId, { loyalty_points: 0 });
    await fetchUsers();
    setLoyaltyConfirm(null);
  };

  // Map realtime booking rows (DB shape) to client-shaped rows used in the table
  const mapDbBookingToClient = (row: any) => {
    const fromNotes = parseBookingNotes(row.notes).customerName;
    return {
    id: row.id,
    refCode: row.id,
    customerName:
      row.customerName ||
      row.users?.full_name ||
      row.customer_name ||
      fromNotes ||
      row.users?.email ||
      'Customer',
    court: row.courts?.name || row.court_id || row.court || 'Court',
    date: row.booking_date || row.session_date || row.requestedDate || '',
    startTime: row.start_time || (typeof row.time === 'string' ? row.time.split(' - ')[0] : ''),
    time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : row.time || '',
    amount: row.total_price ?? row.amount ?? 0,
    status: row.status || 'pending',
    createdAt: row.created_at || row.createdAt || '',
  };
  };

  // Keep apiBookings in sync with realtime feed when available
  useEffect(() => {
    if (!Array.isArray(realtimeBookings) || realtimeBookings.length === 0) return;
    try {
      setApiBookings((prev) => {
        const prevById = Object.fromEntries((prev || []).filter(Boolean).map((b: any) => [b.id, b]));
        const mapped = realtimeBookings.map(mapDbBookingToClient);
        const byId: Record<string, any> = {};
        for (const b of mapped) {
          const prior = prevById[b.id];
          const priorName = prior?.customerName;
          const hasGoodPrior =
            typeof priorName === 'string' && priorName.trim() !== '' && priorName !== 'Customer';
          byId[b.id] = hasGoodPrior ? { ...b, customerName: priorName } : b;
        }
        for (const b of prev || []) {
          if (!byId[b.id]) byId[b.id] = b;
        }
        return sortBookingsNewestFirst(Object.values(byId));
      });
    } catch {
      // ignore realtime merge errors
    }
  }, [realtimeBookings]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (sub === 'overview' || sub === 'analytics') {
          const now = new Date();
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const start = startDate.toISOString().split('T')[0];
          const end = endDate.toISOString().split('T')[0];
          const data = await getAnalytics({ start, end });
          setAnalyticsData(data);
          // Fetch full booking list (no date filter) so we can show the 6 most recent bookings
          const allBookings = await getAllBookings();
          setApiBookings(sortBookingsNewestFirst(allBookings || []));
        } else if (sub === 'users') {
          await fetchUsers();
        } else if (sub === 'payments') {
          const payments = await getPaymentTransactions();
          setApiPayments(payments || []);
        } else if (sub === 'loyalty') {
          const loyalty = await getLoyaltyProgram();
          setApiLoyalty(loyalty || null);
        }
      } catch (err) {
        console.error("Failed to fetch admin data:", err);
      }
    };
    fetchData();
  }, [sub, getAnalytics, getAllBookings, fetchUsers, getPaymentTransactions, getLoyaltyProgram]);

  useEffect(() => {
    if (sub !== 'users') return;

    void fetchUsers();
    const refreshTimer = window.setInterval(() => {
      void fetchUsers();
    }, 30000);

    return () => window.clearInterval(refreshTimer);
  }, [sub, fetchUsers]);

  // Format date for display: "May 25, 2026"
  const formatDisplayDate = (isoDateStr: string) => {
    try {
      const d = new Date(isoDateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return isoDateStr;
    }
  };

  const bookings = sortBookingsNewestFirst(
    [...analyticsBookings, ...apiBookings]
      .filter(Boolean)
      .reduce((acc: any[], row: any) => {
        const id = row?.id;
        if (!id) return acc;
        const existingIndex = acc.findIndex((item) => item.id === id);
        if (existingIndex === -1) {
          acc.push(row);
          return acc;
        }
        const existing = acc[existingIndex];
        const rowTs = bookingSortTs(row);
        const exTs = bookingSortTs(existing);
        const fresher = rowTs >= exTs ? row : existing;
        const older = rowTs >= exTs ? existing : row;
        const freshName = fresher.customerName;
        const oldName = older.customerName;
        const merged =
          (freshName === 'Customer' || !freshName) && oldName && oldName !== 'Customer'
            ? { ...fresher, customerName: oldName }
            : fresher;
        acc[existingIndex] = merged;
        return acc;
      }, [])
  );
  const recentBookings = bookings.slice(0, 6);
  const allUsers = apiUsers;
  const transactions = apiPayments;

  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const todayBookings = bookings.filter(b => b.date === todayStr);
  const totalRevToday = todayBookings.reduce((s, b) => {
    if (b.status === 'cancelled' || b.status === 'rejected') return s;
    return s + Number(b.amount || 0);
  }, 0);
  const openCourts = analyticsSummary.openCourts ?? 9;
  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;

  const REVENUE_DATA = Array.isArray(analyticsData?.weeklyRevenue) && analyticsData.weeklyRevenue.length > 0
    ? analyticsData.weeklyRevenue.map((row: any) => ({ day: row.day, revenue: row.amount }))
    : [
        { day: 'Mon', revenue: 0 }, { day: 'Tue', revenue: 0 },
        { day: 'Wed', revenue: 0 }, { day: 'Thu', revenue: 0 },
        { day: 'Fri', revenue: 0 }, { day: 'Sat', revenue: 0 },
        { day: 'Sun', revenue: 0 },
      ];

  const sportPie: Array<{ name: string; value: number }> = Array.isArray(analyticsData?.revenueBySport) && analyticsData.revenueBySport.length > 0
    ? analyticsData.revenueBySport
    : Object.entries(
        bookings.reduce((acc: Record<string, number>, b) => {
          acc[b.sport] = (acc[b.sport] || 0) + b.amount;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }));

  const SUB_TABS: { id: ExecSubTab; icon: any; label: string }[] = [
    { id: 'overview',  icon: BarChart2,  label: 'Overview'  },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
    { id: 'users',     icon: Users,      label: 'Users'     },
    { id: 'payments',  icon: DollarSign, label: 'Payments'  },
    { id: 'loyalty',   icon: Award,      label: 'Loyalty'   },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-black" style={{ fontSize: 24 }}>Executive Overview</h2>
        <p className="text-gray-400" style={{ fontSize: 13 }}>Real-time visibility across all operations</p>
      </div>

      {/* Sub-tab pills with icons */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all font-black ${
              sub === t.id ? 'bg-[#FF8C00] text-white' : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-white/5'
            }`}
            style={{ fontSize: 13 }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {sub === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Today's Revenue", value: `₱${totalRevToday.toLocaleString()}`, icon: DollarSign, color: '#FF8C00', sub: `${todayBookings.length} bookings today` },
              { label: 'Total Bookings', value: analyticsSummary.totalBookings ?? bookings.length, icon: Calendar, color: '#22c55e', sub: 'From selected analytics range' },
              { label: 'Courts Open', value: `${openCourts}/${analyticsSummary.totalCourts ?? 12}`, icon: MapPin, color: '#fb923c', sub: `${Math.max((analyticsSummary.totalCourts ?? 12) - openCourts, 0)} currently unavailable` },
              { label: 'Pending Requests', value: pendingCancellations, icon: AlertTriangle, color: '#a855f7', sub: 'Awaiting review' },
            ].map(kpi => (
              <motion.div key={kpi.label} whileHover={{ y: -3 }} className="rounded-2xl p-5 border border-white/10 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.32)]" style={{ background: `linear-gradient(135deg, ${kpi.color}12 0%, ${kpi.color}06 100%)`, borderColor: `${kpi.color}20` }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5" style={{ background: kpi.color, filter: 'blur(20px)', transform: 'translate(30%, -30%)' }} />
                <div className="flex items-start justify-between mb-3 relative">
                  <div>
                    <p className="text-gray-500 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>{kpi.label.toUpperCase()}</p>
                    <p className="text-white font-black" style={{ fontSize: 26, marginTop: 4, lineHeight: 1 }}>{kpi.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}25` }}>
                    <kpi.icon size={18} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: kpi.color, fontWeight: 700 }}>{kpi.sub}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
              <h3 className="text-white font-black mb-4" style={{ fontSize: 15 }}>Revenue This Week</h3>
              <div className="w-full h-[200px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <BarChart id="admin-bar-revenue" data={REVENUE_DATA} barSize={26}>
                    <CartesianGrid key="bar-grid" strokeDasharray="3 3" stroke="#222" />
                    <XAxis key="bar-xaxis" dataKey="day" stroke="#555" tick={{ fontSize: 12 }} />
                    <YAxis key="bar-yaxis" stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip key="bar-tooltip" contentStyle={{ backgroundColor: '#252525', border: 'none', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`₱${v.toLocaleString()}`, 'Revenue']} />
                    <Bar key="bar-data" isAnimationActive={false} dataKey="revenue" fill="#FF8C00" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
              <h3 className="text-white font-black mb-4" style={{ fontSize: 15 }}>Revenue by Sport</h3>
              <div className="w-full h-[200px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart id="admin-pie-revenue">
                    <Pie key="pie-data" isAnimationActive={false} data={sportPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" labelLine={false}>
                      {sportPie.map((entry, i) => <Cell key={`pie-cell-${entry.name}-${i}`} fill={SPORT_COLORS[entry.name] || '#888'} />)}
                    </Pie>
                    <Tooltip key="pie-tooltip" contentStyle={{ backgroundColor: '#252525', border: 'none', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`₱${v.toLocaleString()}`, 'Revenue']} />
                    <Legend key="pie-legend" wrapperStyle={{ fontSize: 12 }} payload={sportPie.map((e, i) => ({ id: `pie-legend-${e.name}-${i}`, value: e.name, type: 'square' as const, color: SPORT_COLORS[e.name] || '#888' }))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-black" style={{ fontSize: 15 }}>Recent Bookings</h3>
              <span className="text-gray-600 font-black" style={{ fontSize: 11 }}>Showing {Math.min(bookings.length, 6)} of {bookings.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-[#111]">
                  <tr>{['Ref', 'Customer', 'Court', 'Date', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-gray-600 uppercase font-black" style={{ fontSize: 10 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentBookings.map((b: any) => (
                    <tr key={b.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-gray-600 font-black" style={{ fontSize: 11 }}>#{(b.refCode || b.id).slice(-8).toUpperCase()}</td>
                      <td className="px-5 py-3 text-white font-black" style={{ fontSize: 13 }}>{b.customerName}</td>
                      <td className="px-5 py-3 text-gray-300" style={{ fontSize: 13 }}>{b.court}</td>
                      <td className="px-5 py-3 text-gray-300" style={{ fontSize: 13 }}>{formatDisplayDate(b.date)}</td>
                      <td className="px-5 py-3 text-green-400 font-black" style={{ fontSize: 13 }}>₱{b.amount.toLocaleString()}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics */}
      {sub === 'analytics' && <AnalyticsDashboard analyticsData={analyticsData} />}

      {/* Users */}
      {sub === 'users' && (
        <div className="space-y-4">
          <h3 className="text-white font-black" style={{ fontSize: 18 }}>User Account Management</h3>
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-x-auto">
            <div className="min-w-[700px]">
              <table className="w-full text-left">
                <thead className="bg-[#222]">
                  <tr>{['Name', 'Email', 'Phone', 'Bookings', 'Points', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-gray-500 uppercase" style={{ fontSize: 11, fontWeight: 800 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersLoading && allUsers.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-gray-400" colSpan={7} style={{ fontSize: 13 }}>Refreshing users from Supabase…</td>
                    </tr>
                  ) : allUsers.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-gray-400" colSpan={7} style={{ fontSize: 13 }}>No users found in Supabase.</td>
                    </tr>
                  ) : allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3 text-white font-black" style={{ fontSize: 13 }}>{u.name}</td>
                      <td className="px-5 py-3 text-gray-400" style={{ fontSize: 12 }}>{u.email}</td>
                      <td className="px-5 py-3 text-gray-400" style={{ fontSize: 12 }}>{u.phone}</td>
                      <td className="px-5 py-3 text-gray-300" style={{ fontSize: 13 }}>{u.totalBookings}</td>
                      <td className="px-5 py-3 text-yellow-400 font-black" style={{ fontSize: 13 }}>{u.loyaltyPoints}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-black ${u.accountStatus === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} capitalize`}>
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setUserConfirm({ id: u.id, name: u.name, action: u.accountStatus === 'active' ? 'suspend' : 'activate' })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${u.accountStatus === 'active' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                        >
                          {u.accountStatus === 'active' ? <><UserX size={12} className="inline mr-1" />Suspend</> : <><UserCheck size={12} className="inline mr-1" />Activate</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments */}
      {sub === 'payments' && (
        <div className="space-y-4">
          <h3 className="text-white font-black" style={{ fontSize: 18 }}>Payment & Transaction Monitoring</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: DollarSign, color: 'text-green-400', value: `₱${transactions.reduce((s, t) => s + t.amount, 0).toLocaleString()}`, label: 'Total Revenue' },
              { icon: CheckCircle, color: 'text-blue-400', value: transactions.filter(t => t.paymentStatus === 'paid').length, label: 'Completed' },
              { icon: Clock, color: 'text-yellow-400', value: transactions.filter(t => t.paymentStatus === 'pending').length, label: 'Pending' },
            ].map(c => (
              <div key={c.label} className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
                <c.icon size={20} className={`${c.color} mb-2`} />
                <p className="text-white font-black" style={{ fontSize: 22 }}>{c.value}</p>
                <p className="text-gray-400" style={{ fontSize: 13 }}>{c.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-x-auto">
            <div className="min-w-[750px]">
              <table className="w-full text-left">
                <thead className="bg-[#222]">
                  <tr>{['Txn ID', 'Customer', 'Booking', 'Amount', 'Method', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-gray-500 uppercase" style={{ fontSize: 11, fontWeight: 800 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3 text-gray-500" style={{ fontSize: 12 }}>#{t.id}</td>
                      <td className="px-5 py-3 text-white font-black" style={{ fontSize: 13 }}>{t.customerName}</td>
                      <td className="px-5 py-3 text-gray-400" style={{ fontSize: 12 }}>#{t.bookingId}</td>
                      <td className="px-5 py-3 text-green-400 font-black" style={{ fontSize: 13 }}>₱{t.amount.toLocaleString()}</td>
                      <td className="px-5 py-3"><span className="px-2 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 capitalize">{t.paymentMethod.replace('_', ' ')}</span></td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-black capitalize ${
                          t.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
                          t.paymentStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          t.paymentStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                          t.paymentStatus === 'refunded' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{t.paymentStatus}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400" style={{ fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty */}
      {sub === 'loyalty' && (
        <div className="space-y-4">
          <h3 className="text-white font-black" style={{ fontSize: 18 }}>Loyalty & Rewards Management</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: 'Reward rule', value: '10 pts → 25% off', desc: '1 completed booking earns 1 point; redeem for 25% court discount', color: '#fbbf24' },
              { label: 'Rewards ready', value: allUsers.reduce((sum, u) => sum + Math.floor((u.loyaltyPoints || 0) / 10), 0), desc: 'Redeemable user rewards', color: '#22c55e' },
              { label: 'Tracked users', value: allUsers.length, desc: 'Admins and staff are visible but do not earn from desk-only work', color: '#60a5fa' },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/8 bg-[#1A1A1A] p-4">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10, letterSpacing: 0.8 }}>{card.label}</p>
                <p className="font-black mt-1" style={{ color: card.color, fontSize: 22 }}>{card.value}</p>
                <p className="text-gray-400 mt-1" style={{ fontSize: 12 }}>{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-yellow-400/10 border border-yellow-400/25">
                <Award size={24} className="text-yellow-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-black" style={{ fontSize: 15 }}>Current Reward Rule</h4>
                <p className="text-gray-400 mt-1" style={{ fontSize: 12, lineHeight: 1.55 }}>A signed-in user earns 1 point only when their booking is checked out and marked completed. Cancelled, rejected, pending, staff-created walk-ins without a user, and admin/staff accounts do not earn customer rewards.</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-x-auto">
            <div className="px-5 py-4 border-b border-white/5">
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>User Loyalty Progress</h4>
            </div>
            <div className="min-w-[500px]">
              <table className="w-full text-left">
                <thead className="bg-[#222]">
                  <tr>{['User', 'Points', 'Progress', 'Rewards', 'Action'].map(h => (
                    <th key={h} className="px-5 py-3 text-gray-500 uppercase" style={{ fontSize: 11, fontWeight: 800 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/3">
                      <td className="px-5 py-3 text-white font-black" style={{ fontSize: 13 }}>{u.name}</td>
                      <td className="px-5 py-3 text-yellow-400 font-black" style={{ fontSize: 13 }}>{u.loyaltyPoints} pts</td>
                      <td className="px-5 py-3 w-36">
                        <div className="w-full bg-[#252525] rounded-full h-2">
                          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full" style={{ width: `${Math.min((u.loyaltyPoints / 10) * 100, 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-400" style={{ fontSize: 13 }}>{Math.floor(u.loyaltyPoints / 10)} reward(s)</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setLoyaltyConfirm({ id: u.id, name: u.name, points: u.loyaltyPoints || 0 })}
                          className="rounded-xl border border-white/10 px-3 py-2 text-gray-300 hover:text-white hover:bg-white/5 font-black"
                          style={{ fontSize: 11 }}
                        >
                          Reset points
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty reset confirmation */}
      <AnimatePresence>
        {loyaltyConfirm && (
          <ConfirmModal opts={{
            title: 'Reset loyalty points?',
            body: `${loyaltyConfirm.name}\nThis will set their balance from ${loyaltyConfirm.points} pts to 0. Redeemed rewards cannot be recovered.`,
            confirmLabel: 'Yes, reset points',
            confirmColor: '#f97316',
            icon: <Award size={28} className="text-yellow-400" />,
            onConfirm: () => void resetUserLoyalty(loyaltyConfirm.id),
            onCancel: () => setLoyaltyConfirm(null),
          }} />
        )}
      </AnimatePresence>

      {/* User suspend/activate confirmation */}
      <AnimatePresence>
        {userConfirm && (
          <ConfirmModal opts={{
            title: userConfirm.action === 'suspend' ? 'Suspend Account?' : 'Activate Account?',
            body: `${userConfirm.name}\n${userConfirm.action === 'suspend' ? 'This user will be unable to log in until reactivated.' : 'This user will regain full access to their account.'}`,
            confirmLabel: userConfirm.action === 'suspend' ? 'Yes, Suspend' : 'Yes, Activate',
            confirmColor: userConfirm.action === 'suspend' ? '#ef4444' : '#22c55e',
            icon: userConfirm.action === 'suspend' ? <UserX size={28} className="text-red-400" /> : <UserCheck size={28} className="text-green-400" />,
            onConfirm: async () => {
              try {
                await updateUser(userConfirm.id, { accountStatus: userConfirm.action === 'suspend' ? 'suspended' : 'active' });
                await fetchUsers();
              } catch (error) {
                console.error('Failed to update user status:', error);
              } finally {
                setUserConfirm(null);
              }
            },
            onCancel: () => setUserConfirm(null),
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Facility Map Builder ─────────────────────────────────────────────────────
type FacilitySubTab = 'map' | 'courts' | 'addons';

function FacilityMapBuilderTab() {
  const { bookings } = useUser();
  const [sub, setSub] = useState<FacilitySubTab>('map');
  const { maps, updateBlockStatus, deleteCourtBlock } = useFacilityMap();
  const { addCustomSport, customSports } = useAddons();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [maintenancePrompt, setMaintenancePrompt] = useState<{
    court: any;
    target: 'available' | 'maintenance';
    blockedCount: number;
  } | null>(null);
  const [showAddSportModal, setShowAddSportModal] = useState(false);
  const [newSportName, setNewSportName] = useState('');
  const [newSportColor, setNewSportColor] = useState('#FF8C00');
  const COLOR_PRESETS = ['#FF8C00','#fb923c','#f59e0b','#22c55e','#a855f7','#ec4899','#06b6d4','#10b981'];

  // Get all published maps for the selector
  const publishedMaps = maps.filter(m => m.isPublished);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  // Determine which map to show courts from
  const activeMap = selectedMapId
    ? publishedMaps.find(m => m.id === selectedMapId)
    : publishedMaps[0];
  const activeCourts = activeMap?.blocks ?? [];

  const getColor = (sport: string) => {
    const cs = customSports.find(s => s.name === sport);
    return cs ? cs.color : getSportColor(sport);
  };

  const courtsBySport = activeCourts.reduce<Record<string, typeof activeCourts>>((acc, b) => {
    if (!acc[b.sport]) acc[b.sport] = [];
    acc[b.sport].push(b);
    return acc;
  }, {});
  const hasBlockingBookings = (courtName: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (!activeMap?.id) return 0;
    return bookings.filter(b =>
      bookingAppliesToPublishedMap(b, courtName, activeMap.id, publishedMaps) &&
      b.date >= today &&
      b.status !== 'cancelled' &&
      b.status !== 'completed' &&
      b.status !== 'rejected'
    ).length;
  };
  const openMaintenancePrompt = (court: any) => {
    const target = court.status === 'maintenance' ? 'available' : 'maintenance';
    setMaintenancePrompt({
      court,
      target,
      blockedCount: target === 'maintenance' ? hasBlockingBookings(court.name) : 0,
    });
  };
  const confirmMaintenance = () => {
    if (!maintenancePrompt || !activeMap?.id) return;
    const { court, target, blockedCount } = maintenancePrompt;
    if (target === 'maintenance' && blockedCount > 0) {
      setMaintenancePrompt(null);
      return;
    }
    updateBlockStatus(activeMap.id, court.id, target);
    setMaintenancePrompt(null);
  };

  const SUB_TABS = [
    { id: 'map' as const, icon: MapPin, label: 'Facility Map' },
    { id: 'courts' as const, icon: Building, label: 'Court Management' },
    { id: 'addons' as const, icon: Tag, label: 'Add-ons & Rates' },
  ];

  const subHeaders: Record<FacilitySubTab, { title: string; sub: string }> = {
    map: { title: 'Facility Map Builder', sub: 'Drag & drop courts to design your facility layout' },
    courts: { title: 'Court Management', sub: 'Control availability, maintenance, and add or remove courts — changes reflect immediately for users' },
    addons: { title: 'Add-ons & Rates', sub: 'Manage booking extras and per-sport add-on pricing shown to users at booking' },
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#141018] border-b border-white/[0.08] flex-shrink-0">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all font-black ${t.id === sub ? 'bg-[#FF8C00] text-white' : 'bg-transparent text-gray-500 hover:text-gray-300 border border-white/10'}`}
            style={{ fontSize: 12 }}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {sub === 'map' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <FacilityMapBuilder />
        </div>
      )}

      {sub !== 'map' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-white font-black" style={{ fontSize: 24 }}>{subHeaders[sub].title}</h2>
                <p className="text-gray-500" style={{ fontSize: 13 }}>{subHeaders[sub].sub}</p>
              </div>

            </div>

            {sub === 'courts' && (
              <div className="space-y-4">
                {/* Map selector */}
                {publishedMaps.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500 font-black flex-shrink-0" style={{ fontSize: 11 }}>MAP:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {publishedMaps.map(m => (
                        <button key={m.id}
                          onClick={() => setSelectedMapId(m.id === activeMap?.id ? null : m.id)}
                          className="px-3 py-1.5 rounded-xl font-black transition-all border"
                          style={{
                            fontSize: 11,
                            background: m.id === activeMap?.id ? 'rgba(255,140,0,0.15)' : 'rgba(255,255,255,0.04)',
                            color: m.id === activeMap?.id ? '#FF8C00' : '#666',
                            borderColor: m.id === activeMap?.id ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.08)',
                          }}>
                          {m.name}
                          {m.branch && <span className="ml-1 opacity-50">· {m.branch}</span>}
                        </button>
                      ))}
                    </div>
                    <span className="text-gray-700 font-black" style={{ fontSize: 10 }}>
                      {activeCourts.length} court(s)
                    </span>
                  </div>
                )}

                {Object.keys(courtsBySport).length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <Building size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-black" style={{ fontSize: 14 }}>
                      {publishedMaps.length === 0 ? 'No published maps' : 'No courts in this map'}
                    </p>
                    <p style={{ fontSize: 12 }}>Add courts in the Facility Map tab, then publish</p>
                  </div>
                ) : Object.entries(courtsBySport).map(([sport, courts]) => {
                  const color = getColor(sport);
                  return (
                    <div key={sport} className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5" style={{ backgroundColor: `${color}08` }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                          <SportIcon sport={sport} size={16} color={color} strokeWidth={2} />
                        </div>
                        <div>
                          <p className="text-white font-black" style={{ fontSize: 14 }}>{sport}</p>
                          <p className="text-gray-500" style={{ fontSize: 11 }}>{courts.length} court(s) · changes visible to users instantly</p>
                        </div>
                        <div className="ml-auto w-3 h-3 rounded-full" style={{ background: color }} />
                      </div>
                      <div className="divide-y divide-white/5">
                        {courts.map(court => (
                          <div key={court.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors">
                            <div className="flex-1">
                              <p className="text-white font-black" style={{ fontSize: 14 }}>{court.name}</p>
                              {court.status === 'maintenance' ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Wrench size={10} className="text-amber-400" />
                                  <p className="text-amber-400 font-black" style={{ fontSize: 11 }}>Under Maintenance — hidden from booking</p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                  <p className="text-green-400 font-black" style={{ fontSize: 11 }}>Available for booking</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openMaintenancePrompt(court)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${court.status === 'maintenance' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'}`}>
                                {court.status === 'maintenance' ? 'Clear Maintenance' : 'Set Maintenance'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(court.id)}
                                className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sub === 'addons' && <AdminAddonsManagement />}
          </div>
        </div>
      )}

      {/* Confirm delete court */}
      <AnimatePresence>
        {maintenancePrompt && (
          <ConfirmModal opts={{
            title: maintenancePrompt.target === 'maintenance' ? 'Set Court to Maintenance?' : 'Clear Maintenance?',
            body: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0
                ? `${maintenancePrompt.court.name} has ${maintenancePrompt.blockedCount} active/upcoming booking(s).\n\nTo prevent conflicts, you must reschedule or cancel those bookings first.`
                : `${maintenancePrompt.court.name} will be hidden from booking immediately for users and staff.`
              : `${maintenancePrompt.court.name} will be available for booking again immediately.`,
            confirmLabel: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0 ? 'Understood' : 'Yes, Set Maintenance'
              : 'Yes, Clear',
            confirmColor: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0 ? '#a855f7' : '#f97316'
              : '#22c55e',
            icon: maintenancePrompt.target === 'maintenance'
              ? <Wrench size={26} className={maintenancePrompt.blockedCount > 0 ? 'text-purple-400' : 'text-amber-400'} />
              : <CheckCircle size={26} className="text-green-400" />,
            onConfirm: confirmMaintenance,
            onCancel: () => setMaintenancePrompt(null),
          }} />
        )}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A1A] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>Remove Court?</h3>
              <p className="text-gray-400 text-center mb-5" style={{ fontSize: 12 }}>
                This removes the court from the facility map. Users will no longer see it as a booking option.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors" style={{ fontSize: 13 }}>Cancel</button>
                <button onClick={() => {
                  if (activeMap?.id && confirmDeleteId) {
                    deleteCourtBlock(activeMap.id, confirmDeleteId);
                  }
                  setConfirmDeleteId(null);
                }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-black hover:bg-red-600 transition-colors" style={{ fontSize: 13 }}>
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add new sport modal */}
      <AnimatePresence>
        {showAddSportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A1A] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black" style={{ fontSize: 17 }}>Add New Sport</h3>
                <button onClick={() => setShowAddSportModal(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>SPORT NAME</label>
                  <input value={newSportName} onChange={e => setNewSportName(e.target.value)} placeholder="e.g. Tennis"
                    className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#FF8C00]"
                    style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="block text-gray-500 mb-2 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>COLOR</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(c => (
                      <button key={c} type="button" onClick={() => setNewSportColor(c)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: c, border: `2px solid ${newSportColor === c ? 'white' : 'transparent'}` }}>
                        {newSportColor === c && <Check size={12} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowAddSportModal(false)} className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black" style={{ fontSize: 13 }}>Cancel</button>
                  <button
                    onClick={() => {
                      if (!newSportName.trim()) return;
                      addCustomSport({ name: newSportName.trim(), color: newSportColor, pricingType: 'flat', flatPrice: 300, priceLabel: '₱300/hr' });
                      setNewSportName(''); setShowAddSportModal(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-white font-black" style={{ fontSize: 13, background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
                    Add Sport
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Master Calendar ──────────────────────────────────────────────────────────
function MasterCalendarTab() {
  const { addBooking, cancellationRequests, updateCancellationRequest, updateBooking, bookings, user, calcCourtPrice } = useUser();
  const { requests, updateRequestStatus } = useCoaching();
  const { maps } = useFacilityMap();
  const { createDeskBooking } = (useBookingAPI as any)();
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [showBulkBooking, setShowBulkBooking] = useState(false);
  const [manualForm, setManualForm] = useState({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
  const [bulkForm, setBulkForm] = useState({ sport: 'Basketball', court: '', time: '', startDate: '', endDate: '', recurringPattern: 'weekly', duration: 2 });
  const [bulkEndTime, setBulkEndTime] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<{ id: string; approved: boolean } | null>(null);

  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;
  const publishedCourtOptions = useMemo(() => {
    const courts: { id: string; name: string; sport: string; mapId?: string }[] = [];
    maps.filter(m => m.isPublished).forEach(m => {
      m.blocks.forEach(block => {
        if (block.status === 'maintenance') return;
        if (!courts.some(c => c.name === block.name)) {
          courts.push({ id: block.id, name: block.name, sport: block.sport, mapId: m.id });
        }
      });
    });
    return courts.length ? courts : ALL_COURTS;
  }, [maps]);
  const sportOptions = useMemo(
    () => Array.from(new Set(publishedCourtOptions.map(court => court.sport))),
    [publishedCourtOptions],
  );
  const courtOptions = publishedCourtOptions.filter((court) => court.sport === bulkForm.sport);
  const selectedBulkCourt = courtOptions.find(court => court.name === bulkForm.court);
  const timeToMinutes = (time: string) => {
    const [h = '0', m = '0'] = String(time || '').slice(0, 5).split(':');
    return Number(h) * 60 + Number(m);
  };
  const derivedBulkDuration = bulkForm.time && bulkEndTime
    ? Math.max(0, (timeToMinutes(bulkEndTime) - timeToMinutes(bulkForm.time)) / 60)
    : 0;

  useEffect(() => {
    if (!sportOptions.includes(bulkForm.sport) && sportOptions[0]) {
      const firstCourt = publishedCourtOptions.find(court => court.sport === sportOptions[0]);
      setBulkForm(f => ({ ...f, sport: sportOptions[0], court: firstCourt?.name || '' }));
      return;
    }
    if (bulkForm.sport && !courtOptions.some(court => court.name === bulkForm.court)) {
      setBulkForm(f => ({ ...f, court: courtOptions[0]?.name || '' }));
    }
  }, [bulkForm.sport, bulkForm.court, courtOptions, publishedCourtOptions, sportOptions]);

  const handleManualBooking = () => {
    const name = manualForm.customerName || 'Walk-in Customer';
    addBooking({ id: `BK${Date.now()}`, sport: manualForm.sport, date: manualForm.date, time: manualForm.time, duration: manualForm.duration, court: manualForm.court, status: 'confirmed', amount: 500 * manualForm.duration, paymentStatus: 'pending', createdAt: new Date().toISOString(), customerName: name, customerPhone: manualForm.contactNumber, addOns: 'Manual (Walk-in)' });
    setShowManualBooking(false);
    setManualForm({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
    setManualSuccess(`✓ Manual booking confirmed for ${name} — ${manualForm.sport} on ${manualForm.date} at ${manualForm.time}.`);
    setTimeout(() => setManualSuccess(''), 6000);
  };

  const handleBulkBooking = async () => {
    if (!bulkForm.startDate || !bulkForm.endDate || !bulkForm.time || !bulkEndTime || !bulkForm.court) {
      setBulkError('Choose a court, start date, end date, start time, and end time.');
      return;
    }
    const start = new Date(`${bulkForm.startDate}T00:00:00`);
    const end = new Date(`${bulkForm.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setBulkError('Use a valid date range.');
      return;
    }
    if (derivedBulkDuration <= 0) {
      setBulkError('End time must be later than start time.');
      return;
    }

    setBulkBusy(true);
    setBulkError('');
    let current = new Date(start);
    let count = 0;
    let skipped = 0;
    let attempts = 0;
    const inc = bulkForm.recurringPattern === 'weekly' ? 7 : 14;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const staffId = user?.id && uuidRe.test(user.id) ? user.id : undefined;

    try {
      while (current <= end && attempts < 20) {
        attempts++;
        const date = current.toISOString().split('T')[0];
        const amount = Math.round(calcCourtPrice(bulkForm.sport, date, bulkForm.time.slice(0, 5)) * derivedBulkDuration);
        try {
          const out = await createDeskBooking({
            court: bulkForm.court,
            sport: bulkForm.sport,
            booking_date: date,
            start_time: bulkForm.time,
            duration_hours: derivedBulkDuration,
            total_price: amount,
            customer_name: 'Liga Booking',
            payment_method: 'cash',
            source: 'bulk_liga',
            add_ons: `Bulk/Liga booking (${bulkForm.recurringPattern}, ${bulkForm.time.slice(0, 5)}-${bulkEndTime.slice(0, 5)})`,
            staff_id: staffId,
            facility_map_id: selectedBulkCourt?.mapId,
          });
          if (out?.booking) addBooking(out.booking as any);
          count++;
        } catch (err) {
          console.warn('[AdminCalendar] bulk desk booking skipped', err);
          skipped++;
        }
        current = new Date(current.setDate(current.getDate() + inc));
      }
      if (count === 0) {
        setBulkError(skipped > 0 ? 'No bulk bookings were created. The selected recurring slots may already be booked or unavailable.' : 'No dates matched this recurrence.');
        return;
      }
      setShowBulkBooking(false);
      setBulkSuccess(`Created ${count} recurring booking${count !== 1 ? 's' : ''} for ${bulkForm.sport}${skipped ? ` (${skipped} skipped)` : ''}.`);
      window.dispatchEvent(new Event('sportsync:bookings-refresh'));
      setTimeout(() => setBulkSuccess(''), 6000);
    } finally {
      setBulkBusy(false);
    }
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
    setPendingAction(null);
  };

  const INPUT = "w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF8C00]";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white" style={{ fontSize: 26, fontWeight: 900 }}>Master Calendar</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>Manage all bookings and schedules</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualBooking(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-2.5 text-white font-black hover:bg-white/5 transition-colors"
            style={{ fontSize: 13 }}
          >
            <Plus size={16} />
            Manual Booking
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkError('');
              setShowBulkBooking(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-black hover:brightness-110 transition-all"
            style={{ fontSize: 13, background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}
          >
            <Calendar size={16} />
            Liga Booking
          </button>
        </div>
      </div>

      {/* Manual booking success flash */}
      <AnimatePresence>
        {manualSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/25 rounded-2xl px-5 py-3"
          >
            <CheckCircle size={17} className="text-blue-400 flex-shrink-0" />
            <p className="text-blue-300 font-black flex-1" style={{ fontSize: 13 }}>{manualSuccess}</p>
            <button onClick={() => setManualSuccess('')} className="text-blue-700 hover:text-blue-400 transition-colors"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk booking success flash */}
      <AnimatePresence>
        {bulkSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-green-500/12 border border-green-500/25 rounded-2xl px-5 py-3"
          >
            <CheckCircle size={17} className="text-green-400 flex-shrink-0" />
            <p className="text-green-300 font-black flex-1" style={{ fontSize: 13 }}>{bulkSuccess}</p>
            <button onClick={() => setBulkSuccess('')} className="text-green-700 hover:text-green-400 transition-colors"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancellation requests */}
      {pendingCancellations > 0 && (
        <div className="bg-[#1A1A1A] rounded-2xl border border-yellow-500/20 p-5">
          <h3 className="text-white font-black mb-4" style={{ fontSize: 15 }}>Pending Cancellation Requests ({pendingCancellations})</h3>
          <div className="space-y-3">
            {cancellationRequests.filter(r => r.status === 'pending').map(request => {
              const booking = bookings.find(b => b.id === request.bookingId);
              return (
                <div key={request.id} className="bg-[#252525] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{booking?.customerName} — {booking?.court}</p>
                    <p className="text-gray-400" style={{ fontSize: 12 }}>{booking?.date} at {booking?.time} · {request.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPendingAction({ id: request.id, approved: true })} className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-xs font-black hover:bg-green-500/30 transition-colors flex items-center gap-1"><Check size={14} /> Approve</button>
                    <button onClick={() => setPendingAction({ id: request.id, approved: false })} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs font-black hover:bg-red-500/30 transition-colors flex items-center gap-1"><X size={14} /> Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AdminBookingCalendar />

      {/* Confirm Cancellation Action */}
      <AnimatePresence>
        {pendingAction && (() => {
          const req = cancellationRequests.find(r => r.id === pendingAction.id);
          const booking = req ? bookings.find(b => b.id === req.bookingId) : null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#1A1A1A] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${pendingAction.approved ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                  {pendingAction.approved ? <CheckCircle size={24} className="text-green-400" /> : <X size={24} className="text-red-400" />}
                </div>
                <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>
                  {pendingAction.approved ? 'Approve Cancellation?' : 'Reject Cancellation?'}
                </h3>
                {booking && <p className="text-gray-400 text-center mb-1" style={{ fontSize: 12 }}>{booking.customerName} — {booking.court}</p>}
                <p className="text-gray-500 text-center mb-5" style={{ fontSize: 12 }}>
                  {pendingAction.approved ? 'Booking will be marked as cancelled.' : 'The cancellation request will be dismissed.'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPendingAction(null)} className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors" style={{ fontSize: 13 }}>Cancel</button>
                  <button onClick={() => executeCancellation(pendingAction.id, pendingAction.approved)}
                    className={`flex-1 py-2.5 rounded-xl text-white font-black transition-colors ${pendingAction.approved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                    style={{ fontSize: 13 }}>
                    {pendingAction.approved ? 'Yes, Approve' : 'Yes, Reject'}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Manual Booking Modal */}
      {showManualBooking && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-3xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-black" style={{ fontSize: 18 }}>Manual Booking</h3>
              <button onClick={() => setShowManualBooking(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
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
                accentColor="#FF8C00"
              />
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Sport</label>
                <select value={manualForm.sport} onChange={e => setManualForm({ ...manualForm, sport: e.target.value })} className={INPUT} style={{ fontSize: 13 }}>
                  {['Basketball', 'Volleyball', 'Badminton', 'Pickleball', 'Billiards', 'Table Tennis'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Duration (hours)</label>
                <input type="number" min={1} max={4} value={manualForm.duration} onChange={e => setManualForm({ ...manualForm, duration: parseInt(e.target.value) })} className={INPUT} style={{ fontSize: 13 }} />
              </div>
              <button onClick={handleManualBooking} className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black hover:bg-[#e67e00] transition-colors" style={{ fontSize: 14 }}>
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Booking Modal */}
      {showBulkBooking && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#181819] rounded-3xl max-w-3xl w-full border border-white/10 max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-4 p-6 border-b border-white/8" style={{ background: 'linear-gradient(135deg,rgba(255,140,0,0.12),rgba(34,197,94,0.06),transparent)' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-400/25 flex items-center justify-center">
                  <Calendar size={22} className="text-orange-300" />
                </div>
                <div>
                  <h3 className="text-white font-black" style={{ fontSize: 20 }}>Liga/Bulk Booking</h3>
                  <p className="text-gray-500" style={{ fontSize: 12 }}>Create recurring league reservations on the published facility map.</p>
                </div>
              </div>
              <button onClick={() => setShowBulkBooking(false)} className="w-10 h-10 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Sport</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sportOptions.map(s => {
                    const active = bulkForm.sport === s;
                    const color = getSportColor(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const firstCourt = publishedCourtOptions.find(court => court.sport === s)?.name || '';
                          setBulkForm(f => ({ ...f, sport: s, court: firstCourt }));
                        }}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all"
                        style={{ background: active ? `${color}18` : 'rgba(255,255,255,0.04)', borderColor: active ? `${color}70` : 'rgba(255,255,255,0.08)' }}>
                        <SportIcon sport={s} size={14} color={active ? color : '#777'} />
                        <span className="font-black truncate" style={{ fontSize: 12, color: active ? '#fff' : '#888' }}>{s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Court</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {courtOptions.map(court => {
                    const active = bulkForm.court === court.name;
                    const color = getSportColor(bulkForm.sport);
                    return (
                      <button key={court.id || court.name} type="button" onClick={() => setBulkForm(f => ({ ...f, court: court.name }))}
                        className="rounded-xl border px-3 py-2 text-left transition-all"
                        style={{ background: active ? `${color}18` : 'rgba(255,255,255,0.04)', borderColor: active ? `${color}70` : 'rgba(255,255,255,0.08)' }}>
                        <span className="block text-white font-black truncate" style={{ fontSize: 12 }}>{court.name}</span>
                        <span className="block text-gray-600" style={{ fontSize: 10 }}>{bulkForm.sport}</span>
                      </button>
                    );
                  })}
                  {courtOptions.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-yellow-100 font-black" style={{ fontSize: 12 }}>
                      No published courts found for this sport.
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>START DATE & TIME</p>
                  <CustomDateTimePicker
                    selectedDate={bulkForm.startDate}
                    selectedTime={bulkForm.time}
                    onDateChange={d => setBulkForm(f => ({ ...f, startDate: d }))}
                    onTimeChange={t => setBulkForm(f => ({ ...f, time: t }))}
                    minDate={new Date().toISOString().split('T')[0]}
                    accentColor="#FF8C00"
                  />
                </div>
                <div>
                  <p className="text-gray-500 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>END DATE & TIME</p>
                  <CustomDateTimePicker
                    selectedDate={bulkForm.endDate}
                    selectedTime={bulkEndTime}
                    onDateChange={d => setBulkForm(f => ({ ...f, endDate: d }))}
                    onTimeChange={setBulkEndTime}
                    minDate={bulkForm.startDate || new Date().toISOString().split('T')[0]}
                    accentColor="#FF8C00"
                    timeLabel="End Time"
                    timePickerTitle="Select End Time"
                    sessionDurationHours={0}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Pattern</label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#101010] p-1 border border-white/8">
                  {[
                    { value: 'weekly', label: 'Weekly', desc: 'Every 7 days' },
                    { value: 'biweekly', label: 'Bi-weekly', desc: 'Every 14 days' },
                  ].map(pattern => {
                    const active = bulkForm.recurringPattern === pattern.value;
                    return (
                      <button key={pattern.value} type="button" onClick={() => setBulkForm(f => ({ ...f, recurringPattern: pattern.value }))}
                        className="rounded-xl px-3 py-2 text-left transition-all"
                        style={{ background: active ? 'linear-gradient(135deg,#FF8C00,#e67e00)' : 'transparent' }}>
                        <span className="block font-black" style={{ fontSize: 12, color: active ? '#fff' : '#aaa' }}>{pattern.label}</span>
                        <span className="block" style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.75)' : '#555' }}>{pattern.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Duration</label>
                <div className="flex items-center gap-2 rounded-2xl bg-[#101010] border border-white/8 p-2 min-h-[57px]">
                  <div className="flex-1 text-center">
                    <p className="text-white font-black" style={{ fontSize: 18 }}>{derivedBulkDuration > 0 ? `${derivedBulkDuration}h` : '--'}</p>
                    <p className="text-gray-600" style={{ fontSize: 10 }}>from start/end time</p>
                  </div>
                </div>
              </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#101011] p-4">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Preview</p>
                <p className="text-white font-black mt-1" style={{ fontSize: 14 }}>{bulkForm.court || 'Choose a court'} · {bulkForm.sport}</p>
                <p className="text-gray-400 mt-1" style={{ fontSize: 12 }}>
                  {bulkForm.startDate || 'Start date'} to {bulkForm.endDate || 'End date'} · {bulkForm.time || 'Start time'}-{bulkEndTime || 'End time'} · {bulkForm.recurringPattern === 'weekly' ? 'Every week' : 'Every 2 weeks'}
                </p>
              </div>
              {bulkError && <p className="text-red-400 font-black" style={{ fontSize: 12 }}>{bulkError}</p>}
              <button
                onClick={() => void handleBulkBooking()}
                disabled={bulkBusy || !bulkForm.court || !bulkForm.startDate || !bulkForm.endDate || !bulkForm.time || !bulkEndTime}
                className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black hover:bg-[#e67e00] transition-colors disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
                style={{ fontSize: 14 }}
              >
                {bulkBusy ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Bulk Bookings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coaching Management ─────────────────────────────────────────────────────
function CoachingManagementTab() {
  return <AdminCoachingManagement />;
}

// ── System Settings ──────────────────────────────────────────────────────────
type SettingsSubTab = 'business' | 'pricing' | 'roles' | 'announcements';

/* ── Custom Time Picker (no native <select> or <input type=time>) ── */
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ap = h < 12 ? 'AM' : 'PM';
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hr}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll to selected item when opening
  React.useEffect(() => {
    if (open && listRef.current) {
      const idx = slots.indexOf(value);
      if (idx >= 0) listRef.current.scrollTop = idx * 40 - 80;
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all font-black text-left"
        style={{ background: '#1E1E1E', borderColor: open ? '#FF8C00' : 'rgba(255,255,255,0.1)', fontSize: 13, color: value ? 'white' : '#666', boxShadow: open ? '0 0 0 2px rgba(255,140,0,0.2)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <Clock size={13} style={{ color: open ? '#FF8C00' : '#555' }} />
          <span>{value ? fmt(value) : 'Select time'}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} style={{ color: '#555' }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-2xl border overflow-hidden"
            style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}
          >
            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 220, scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {slots.map(t => {
                const isSelected = t === value;
                const isHour = t.endsWith(':00');
                return (
                  <button key={t} type="button"
                    onClick={() => { onChange(t); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? 900 : isHour ? 700 : 500,
                      background: isSelected ? 'rgba(255,140,0,0.12)' : 'transparent',
                      color: isSelected ? '#FF8C00' : isHour ? '#ccc' : '#888',
                      borderLeft: isSelected ? '2px solid #FF8C00' : '2px solid transparent',
                    }}>
                    <span className="w-16 tabular-nums">{fmt(t)}</span>
                    {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF8C00]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PricingRatesTab() {
  const { systemSettings, updateSystemSettings } = useUser();
  const { addonsBySport, updateAddon, customSports } = useAddons();
  const [saved, setSaved] = useState(false);
  const [pricingConfirmOpen, setPricingConfirmOpen] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState<'percent' | 'fixed'>('percent');
  const [bulkDirection, setBulkDirection] = useState<'increase' | 'decrease'>('increase');
  const [bulkValue, setBulkValue] = useState(10);
  const [bulkSelected, setBulkSelected] = useState<string[]>(['basketball', 'volleyball', 'badminton', 'pickleball', 'billiards', 'tableTennis']);

  const updateCourtRate = (sport: string, field: string, val: number) => {
    updateSystemSettings({
      courtRates: {
        ...systemSettings.courtRates,
        [sport]: { ...(systemSettings.courtRates[sport as keyof typeof systemSettings.courtRates] as any), [field]: val },
      },
    } as any);
  };

  const tieredSports = [
    { key: 'basketball', label: 'Basketball', color: '#FF8C00' },
    { key: 'volleyball',  label: 'Volleyball',  color: '#0047AB' },
  ];
  const flatSports = [
    { key: 'badminton',   label: 'Badminton',    color: '#22c55e' },
    { key: 'pickleball',  label: 'Pickleball',   color: '#a855f7' },
    { key: 'billiards',   label: 'Billiards',    color: '#ec4899' },
    { key: 'tableTennis', label: 'Table Tennis', color: '#06b6d4' },
  ];
  const allRateSports = [...tieredSports, ...flatSports];
  const selectedLabels = allRateSports.filter(s => bulkSelected.includes(s.key)).map(s => s.label);
  const toggleBulkSport = (key: string) => {
    setBulkSelected(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  };
  const applyBulkRates = () => {
    if (bulkSelected.length === 0 || !Number.isFinite(bulkValue)) return;
    const sign = bulkDirection === 'increase' ? 1 : -1;
    const transform = (value: number) => {
      const next = bulkMode === 'percent'
        ? value * (1 + sign * (bulkValue / 100))
        : value + sign * bulkValue;
      return Math.max(0, Math.round(next / 10) * 10);
    };
    const nextRates: any = { ...systemSettings.courtRates };
    bulkSelected.forEach((key) => {
      const current = nextRates[key];
      if (!current) return;
      nextRates[key] = Object.fromEntries(
        Object.entries(current).map(([field, value]) => [field, transform(Number(value || 0))])
      );
    });
    updateSystemSettings({ courtRates: nextRates } as any);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-black" style={{ fontSize: 18 }}>Pricing & Rates</h3>
        <p className="text-gray-500" style={{ fontSize: 13 }}>Changes apply immediately to all new bookings.</p>
      </div>

      <div className="rounded-2xl border border-orange-500/20 p-4" style={{ background: 'rgba(255,140,0,0.06)' }}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <p className="text-white font-black mb-1" style={{ fontSize: 14 }}>Bulk price adjustment</p>
            <p className="text-gray-500" style={{ fontSize: 12 }}>Use this for promos or price increases, then fine-tune individual sports below.</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {allRateSports.map((sport) => {
                const active = bulkSelected.includes(sport.key);
                return (
                  <button key={sport.key} type="button" onClick={() => toggleBulkSport(sport.key)}
                    className="px-3 py-1.5 rounded-xl border font-black transition-all"
                    style={{ fontSize: 11, background: active ? `${sport.color}18` : 'rgba(255,255,255,0.04)', borderColor: active ? `${sport.color}55` : 'rgba(255,255,255,0.08)', color: active ? sport.color : '#777' }}>
                    {sport.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:w-[38rem]">
            <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#1A1A1A] p-1">
              {(['increase', 'decrease'] as const).map((option) => {
                const active = bulkDirection === option;
                return (
                  <button key={option} type="button" onClick={() => setBulkDirection(option)}
                    className="rounded-lg px-2 py-1.5 font-black transition-all"
                    style={{ fontSize: 11, background: active ? '#FF8C00' : 'transparent', color: active ? 'white' : '#8b8b8b' }}>
                    {option === 'increase' ? 'Increase' : 'Decrease'}
                  </button>
                );
              })}
            </div>
            <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#1A1A1A] p-1">
              {([
                { value: 'percent' as const, label: 'Percent' },
                { value: 'fixed' as const, label: 'Peso' },
              ]).map((option) => {
                const active = bulkMode === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => setBulkMode(option.value)}
                    className="rounded-lg px-2 py-1.5 font-black transition-all"
                    style={{ fontSize: 11, background: active ? 'rgba(255,140,0,0.18)' : 'transparent', color: active ? '#FFB347' : '#8b8b8b', border: active ? '1px solid rgba(255,140,0,0.35)' : '1px solid transparent' }}>
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2">
              <input type="number" min={0} step={bulkMode === 'percent' ? 1 : 10} value={bulkValue}
                onChange={e => setBulkValue(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent text-white font-black outline-none" style={{ fontSize: 12 }} />
              <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>{bulkMode === 'percent' ? '%' : '₱'}</span>
            </div>
            <button type="button" onClick={applyBulkRates} disabled={bulkSelected.length === 0}
              className="rounded-xl bg-[#FF8C00] text-white font-black disabled:opacity-40"
              style={{ fontSize: 12 }}>
              Apply
            </button>
          </div>
        </div>
        <p className="text-gray-600 mt-3" style={{ fontSize: 11 }}>
          Target: {bulkSelected.length === allRateSports.length ? 'All sports' : selectedLabels.join(', ') || 'None selected'}
        </p>
      </div>

      {/* Tiered sports */}
      <div>
        <h4 className="text-gray-300 font-black mb-1" style={{ fontSize: 14 }}>Tiered Rates — Weekday/Weekend × Day/Evening</h4>
        <p className="text-gray-600 mb-3" style={{ fontSize: 11 }}>Evening = 6:00 PM onward</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tieredSports.map(({ key, label, color }) => {
            const r = systemSettings.courtRates[key as keyof typeof systemSettings.courtRates] as any;
            return (
              <div key={key} className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-white font-black" style={{ fontSize: 14 }}>{label}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { field: 'weekdayDay',     label: 'Weekday · Day' },
                    { field: 'weekdayEvening', label: 'Weekday · Eve' },
                    { field: 'weekendDay',     label: 'Weekend · Day' },
                    { field: 'weekendEvening', label: 'Weekend · Eve' },
                  ].map(({ field, label: fl }) => (
                    <div key={field}>
                      <label className="text-gray-500 block mb-1" style={{ fontSize: 10 }}>{fl}</label>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500" style={{ fontSize: 12 }}>₱</span>
                        <input type="number" min={0} step={50} value={r[field] ?? 0}
                          onChange={e => updateCourtRate(key, field, parseInt(e.target.value) || 0)}
                          className="flex-1 bg-[#252525] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-[#FF8C00]"
                          style={{ fontSize: 13 }} />
                        <span className="text-gray-600" style={{ fontSize: 10 }}>/hr</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flat rate sports */}
      <div>
        <h4 className="text-gray-300 font-black mb-3" style={{ fontSize: 14 }}>Flat Rates (Same all day)</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {flatSports.map(({ key, label, color }) => {
            const r = systemSettings.courtRates[key as keyof typeof systemSettings.courtRates] as any;
            return (
              <div key={key} className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-white font-black" style={{ fontSize: 13 }}>{label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500" style={{ fontSize: 12 }}>₱</span>
                  <input type="number" min={0} step={50} value={r.flat ?? 0}
                    onChange={e => updateCourtRate(key, 'flat', parseInt(e.target.value) || 0)}
                    className="flex-1 bg-[#252525] border border-white/10 rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#FF8C00]"
                    style={{ fontSize: 13 }} />
                  <span className="text-gray-600" style={{ fontSize: 10 }}>/hr</span>
                </div>
              </div>
            );
          })}
          {/* Custom sports */}
          {customSports.map(cs => (
            <div key={cs.name} className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: cs.color }} />
                <span className="text-white font-black" style={{ fontSize: 13 }}>{cs.name}</span>
                <span className="text-gray-600 ml-auto font-black" style={{ fontSize: 9 }}>CUSTOM</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500" style={{ fontSize: 12 }}>₱</span>
                <input type="number" min={0} step={50} defaultValue={cs.flatPrice || 300}
                  className="flex-1 bg-[#252525] border border-white/10 rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#FF8C00]"
                  style={{ fontSize: 13 }} />
                <span className="text-gray-600" style={{ fontSize: 10 }}>/hr</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add-on prices */}
      <div>
        <h4 className="text-gray-300 font-black mb-3" style={{ fontSize: 14 }}>Add-On Prices</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(addonsBySport).filter(([, ads]) => ads.length > 0).map(([sport, addons]) => (
            <div key={sport} className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/5">
              <p className="text-gray-300 font-black mb-3" style={{ fontSize: 13 }}>{sport}</p>
              <div className="space-y-2">
                {addons.map(addon => (
                  <div key={addon.id} className="flex items-center gap-3">
                    <span className="text-gray-400 flex-1 min-w-0 truncate" style={{ fontSize: 12 }}>{addon.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-gray-500" style={{ fontSize: 11 }}>₱</span>
                      <input type="number" min={0} step={10} value={addon.price}
                        onChange={e => updateAddon(sport, addon.id, { price: parseInt(e.target.value) || 0 })}
                        className="w-20 bg-[#252525] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-[#FF8C00] text-center"
                        style={{ fontSize: 12 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setPricingConfirmOpen(true)} disabled={pricingSaving}
          className="px-6 py-2.5 rounded-xl text-white font-black transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg,#FF8C00,#e67e00)', fontSize: 14 }}>
          {pricingSaving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : saved ? <><Check size={15} /> Saved!</> : 'Save All Pricing'}
        </button>
        {saved && <p className="text-green-400" style={{ fontSize: 12 }}>Changes apply to all new bookings immediately.</p>}
      </div>
      <AnimatePresence>
        {pricingConfirmOpen && (
          <ConfirmModal opts={{
            title: 'Save Pricing?',
            body: 'Apply these rates to new bookings, add-ons, and admin pricing tools.',
            confirmLabel: pricingSaving ? 'Saving...' : 'Save Pricing',
            confirmColor: '#FF8C00',
            icon: pricingSaving ? <Loader2 size={24} className="text-white animate-spin" /> : <DollarSign size={24} className="text-white" />,
            onCancel: () => setPricingConfirmOpen(false),
            onConfirm: () => {
              setPricingSaving(true);
              setTimeout(() => {
                setPricingConfirmOpen(false);
                setPricingSaving(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              }, 700);
            },
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SystemSettingsTab() {
  const { systemSettings, updateSystemSettings } = useUser();
  const { addAnnouncement, announcements, clearAnnouncement, clearAnnouncements, refresh: refreshAnnouncements } = useAnnouncements();
  const { customSports } = useAddons();
  const [sub, setSub] = useState<SettingsSubTab>('business');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as Announcement['type'] });
  const [announceSent, setAnnounceSent] = useState('');
  const [savedBiz, setSavedBiz] = useState(false);
  const [bizConfirmOpen, setBizConfirmOpen] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);
  const [announcementClear, setAnnouncementClear] = useState<{ mode: 'one' | 'all'; id?: string; title?: string } | null>(null);

  const SETTINGS_TABS: { id: SettingsSubTab; icon: any; label: string; desc: string }[] = [
    { id: 'business',      icon: Building,   label: 'Business Config', desc: 'Hours & policies'       },
    { id: 'pricing',       icon: DollarSign, label: 'Pricing & Rates', desc: 'Court & add-on pricing' },
    { id: 'roles',         icon: Users,      label: 'Staff & Roles',   desc: 'Accounts & access'     },
    { id: 'announcements', icon: Megaphone,  label: 'Announcements',   desc: 'Send to users'         },
  ];

  const INPUT = "w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF8C00]";
  const ANN_TYPES: { value: Announcement['type']; label: string; color: string }[] = [
    { value: 'promotion',   label: 'Promotion',          color: '#FF8C00' },
    { value: 'maintenance', label: 'Maintenance Notice', color: '#fbbf24' },
    { value: 'reminder',    label: 'Booking Reminder',   color: '#60a5fa' },
    { value: 'update',      label: 'System Update',      color: '#22c55e' },
    { value: 'alert',       label: 'Alert',              color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-black" style={{ fontSize: 24 }}>System Settings</h2>
        <p className="text-gray-500" style={{ fontSize: 13 }}>Configure business rules, staff access, and announcements</p>
      </div>

      {/* Tab grid with icons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {SETTINGS_TABS.map(t => {
          const isActive = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)}
              className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all text-center"
              style={{ background: isActive ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.02)', borderColor: isActive ? 'rgba(255,140,0,0.3)' : 'rgba(255,255,255,0.05)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: isActive ? 'linear-gradient(135deg,#FF8C00,#e67e00)' : 'rgba(255,255,255,0.05)' }}>
                <t.icon size={15} style={{ color: isActive ? 'white' : '#555' }} />
              </div>
              <div>
                <p className="font-black" style={{ fontSize: 11, color: isActive ? '#FF8C00' : '#999' }}>{t.label}</p>
                <p className="text-gray-600" style={{ fontSize: 9 }}>{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {sub === 'pricing' && <PricingRatesTab />}

      {sub === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-[#FF8C00]" />
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Business Hours</h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Opening Time</label>
                <TimeSelect value={systemSettings.businessHours.start} onChange={v => updateSystemSettings({ businessHours: { ...systemSettings.businessHours, start: v } })} />
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Closing Time</label>
                <TimeSelect value={systemSettings.businessHours.end} onChange={v => updateSystemSettings({ businessHours: { ...systemSettings.businessHours, end: v } })} />
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-[#FF8C00]" />
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Booking Limits</h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Min Duration (hrs)</label>
                <input type="number" min={1} max={4} value={systemSettings.bookingDurationMin} onChange={e => updateSystemSettings({ bookingDurationMin: parseInt(e.target.value) })} className={INPUT} style={{ fontSize: 13 }} />
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Max Duration (hrs)</label>
                <input type="number" min={1} max={8} value={systemSettings.bookingDurationMax} onChange={e => updateSystemSettings({ bookingDurationMax: parseInt(e.target.value) })} className={INPUT} style={{ fontSize: 13 }} />
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-amber-400" />
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Cancellation Policy</h4>
            </div>
            <textarea value={systemSettings.cancellationPolicy} onChange={e => updateSystemSettings({ cancellationPolicy: e.target.value })} rows={4} className={INPUT} style={{ fontSize: 13 }} />
          </div>
          <div className="lg:col-span-2 flex items-center gap-3">
            <button onClick={() => setBizConfirmOpen(true)} disabled={bizSaving}
              className="px-6 py-2.5 rounded-xl text-white font-black transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
              style={{ background: savedBiz ? '#22c55e' : 'linear-gradient(135deg,#FF8C00,#e67e00)', fontSize: 14 }}>
              {bizSaving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : savedBiz ? <><Check size={15} /> Saved!</> : 'Save Configuration'}
            </button>
            {savedBiz && <p className="text-green-400" style={{ fontSize: 12 }}>Settings saved successfully.</p>}
          </div>
        </div>
      )}
      <AnimatePresence>
        {bizConfirmOpen && (
          <ConfirmModal opts={{
            title: 'Save Business Config?',
            body: 'Opening hours and booking limits affect the dates and times users can book.',
            confirmLabel: bizSaving ? 'Saving...' : 'Save Config',
            confirmColor: '#FF8C00',
            icon: bizSaving ? <Loader2 size={24} className="text-white animate-spin" /> : <Settings size={24} className="text-white" />,
            onCancel: () => setBizConfirmOpen(false),
            onConfirm: () => {
              setBizSaving(true);
              setTimeout(() => {
                setBizConfirmOpen(false);
                setBizSaving(false);
                setSavedBiz(true);
                setTimeout(() => setSavedBiz(false), 2500);
              }, 700);
            },
          }} />
        )}
      </AnimatePresence>

      {sub === 'roles' && <RoleManagementAdmin />}

      {sub === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-5">
              <Megaphone size={14} className="text-[#FF8C00]" />
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Send Announcement</h4>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {ANN_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setAnnouncementForm(f => ({ ...f, type: t.value }))}
                      className="px-3 py-1.5 rounded-xl font-black transition-all"
                      style={{ fontSize: 11, background: announcementForm.type === t.value ? `${t.color}20` : 'rgba(255,255,255,0.04)', color: announcementForm.type === t.value ? t.color : '#666', border: `1.5px solid ${announcementForm.type === t.value ? `${t.color}50` : 'rgba(255,255,255,0.07)'}` }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Title</label>
                <input type="text" value={announcementForm.title} onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" className={INPUT} style={{ fontSize: 13 }} />
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Message</label>
                <textarea value={announcementForm.message} onChange={e => setAnnouncementForm(f => ({ ...f, message: e.target.value }))} rows={4} placeholder="Type your message..." className={INPUT} style={{ fontSize: 13 }} />
              </div>
              <AnimatePresence>
                {announceSent && (
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
                    <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-300 font-black flex-1" style={{ fontSize: 12 }}>{announceSent}</span>
                    <button onClick={() => setAnnounceSent('')} className="text-green-700 hover:text-green-400"><X size={13} /></button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={async () => {
                  if (!announcementForm.title.trim()) return;
                  await addAnnouncement({ title: announcementForm.title, message: announcementForm.message, type: announcementForm.type });
                  const tLabel = ANN_TYPES.find(t => t.value === announcementForm.type)?.label || '';
                  setAnnounceSent(`"${announcementForm.title}" sent as ${tLabel} — visible in user notifications.`);
                  setAnnouncementForm({ title: '', message: '', type: 'promotion' });
                  setTimeout(() => setAnnounceSent(''), 5000);
                }}
                className="w-full bg-[#FF8C00] text-white py-2.5 rounded-xl font-black hover:bg-[#e67e00] transition-colors flex items-center justify-center gap-2"
                style={{ fontSize: 14 }}>
                <Bell size={16} /> Send to All Users
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Sent Announcements ({announcements.length})</h4>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void refreshAnnouncements()}
                  className="px-3 py-1.5 rounded-xl border border-white/10 text-gray-400 hover:text-white font-black"
                  style={{ fontSize: 11 }}>
                  Refresh
                </button>
                <button type="button" disabled={announcements.length === 0} onClick={() => setAnnouncementClear({ mode: 'all' })}
                  className="px-3 py-1.5 rounded-xl border font-black disabled:opacity-40"
                  style={{ fontSize: 11, borderColor: 'rgba(239,68,68,0.24)', color: '#fca5a5', background: 'rgba(239,68,68,0.08)' }}>
                  Clear All
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto custom-scrollbar">
              {announcements.length === 0 ? (
                <p className="text-center text-gray-600 py-10" style={{ fontSize: 13 }}>No announcements yet</p>
              ) : announcements.map(ann => {
                const typeCfg = ANN_TYPES.find(t => t.value === ann.type);
                return (
                  <div key={ann.id} className="px-5 py-4 hover:bg-white/2 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${typeCfg?.color}15` }}>
                        <Megaphone size={13} style={{ color: typeCfg?.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-white font-black truncate" style={{ fontSize: 13 }}>{ann.title}</p>
                          <span className="px-2 py-0.5 rounded-full font-black flex-shrink-0" style={{ fontSize: 9, background: `${typeCfg?.color}20`, color: typeCfg?.color }}>{ann.type.toUpperCase()}</span>
                        </div>
                        <p className="text-gray-400 line-clamp-2" style={{ fontSize: 12 }}>{ann.message}</p>
                        <p className="text-gray-600 mt-1" style={{ fontSize: 10 }}>{new Date(ann.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button type="button" onClick={() => setAnnouncementClear({ mode: 'one', id: ann.id, title: ann.title })}
                        className="w-8 h-8 rounded-xl border border-white/10 text-gray-500 hover:text-red-300 hover:border-red-500/25 hover:bg-red-500/10 flex items-center justify-center">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {announcementClear && (
          <ConfirmModal opts={{
            title: announcementClear.mode === 'all' ? 'Clear all announcements?' : 'Clear announcement?',
            body: announcementClear.mode === 'all'
              ? 'This removes sent announcements from the admin list and published user announcement feed.'
              : `Remove "${announcementClear.title}" from sent announcements?`,
            confirmLabel: announcementClear.mode === 'all' ? 'Clear All' : 'Clear',
            confirmColor: '#ef4444',
            icon: <Trash2 size={24} className="text-white" />,
            onCancel: () => setAnnouncementClear(null),
            onConfirm: async () => {
              if (announcementClear.mode === 'all') await clearAnnouncements();
              else if (announcementClear.id) await clearAnnouncement(announcementClear.id);
              setAnnouncementClear(null);
            },
          }} />
        )}
      </AnimatePresence>

    </div>
  );
}

// ── Main Dashboard Shell ─────────────────────────────────────────────────────
export function ConsolidatedAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { user } = useUser();
  const { isConnected } = useRealtimeAdminDashboard();
  const [activeTab, setActiveTab] = useState<AdminTab>('executive');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onOpenCalendar = () => setActiveTab('calendar');
    const onOpenInbox = () => setActiveTab('calendar');
    window.addEventListener('sportsync:open-master-calendar', onOpenCalendar);
    window.addEventListener('sportsync:open-staff-inbox', onOpenInbox);
    return () => {
      window.removeEventListener('sportsync:open-master-calendar', onOpenCalendar);
      window.removeEventListener('sportsync:open-staff-inbox', onOpenInbox);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'executive': return <ExecutiveOverview />;
      case 'facility':  return <FacilityMapBuilderTab />;
      case 'calendar':  return <MasterCalendarTab />;
      case 'coaching':  return <CoachingManagementTab />;
      case 'settings':  return <SystemSettingsTab />;
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col md:flex-row h-screen overflow-hidden"
      style={{
        // Copy Staff’s exact glow recipe; just change hue to orange.
        background: 'radial-gradient(1200px 520px at 18% -10%, rgba(255,140,0,0.26), transparent), #090A0F',
      }}>

      {/* ── MOBILE layout: status + content + bottom nav ── */}
      <div className="md:hidden flex flex-col h-screen w-full overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 h-10 flex-shrink-0"
          style={{
            background: "rgba(12,10,16,0.72)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#FF8C00,#e67e00)" }}>
              <Shield size={11} className="text-white" />
            </div>
            <span className="font-black" style={{ fontSize: 13, color: "#E8E8EA" }}>JRC <span style={{ color: "#FF8C00" }}>Admin</span></span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus isConnected={isConnected} showLabel={false} size="sm" />
            <button onClick={onLogout} className="px-3 py-1 rounded-lg font-black" style={{ fontSize: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              Sign Out
            </button>
          </div>
        </div>
        {/* Content */}
        <main className={`flex-1 overflow-x-hidden ${activeTab === 'facility' ? 'overflow-hidden' : 'overflow-y-auto p-4'}`} style={{ background: 'transparent' }}>
          {renderContent()}
        </main>
        {/* Mobile bottom nav */}
        <div className="flex-shrink-0 flex items-stretch"
          style={{
            background: "rgba(12,10,16,0.82)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "env(safe-area-inset-bottom,0px)",
            backdropFilter: "blur(10px)",
          }}>
          {ADMIN_TABS.map(tab => {
            const on = activeTab === tab.id;
            return (
              <motion.button key={tab.id} whileTap={{ scale: 0.88 }} onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative">
                {on && <motion.div layoutId="adminNavLine" className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 2.5, background: "#FF8C00" }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />}
                <div className="w-10 h-7 rounded-xl flex items-center justify-center" style={{ background: on ? "rgba(255,140,0,0.18)" : "transparent" }}>
                  <tab.icon size={17} style={{ color: on ? "#FF8C00" : "rgba(255,255,255,0.35)", strokeWidth: on ? 2.5 : 1.8 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: on ? 800 : 600, color: on ? "#FF8C00" : "rgba(255,255,255,0.35)" }}>{tab.label.split(" ")[0]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP layout: sidebar + main ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 72 : 236 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="border-r border-white/[0.07] flex-col flex-shrink-0 overflow-hidden flex"
          style={{
            minWidth: sidebarCollapsed ? 72 : 236,
            maxWidth: sidebarCollapsed ? 72 : 236,
            width: sidebarCollapsed ? 72 : 236,
            // Simple, readable solid dark-orange base (no fancy overlays)
            background: '#1A1008',
          }}
        >
        {/* Logo */}
        <div className="flex items-center px-4 py-5 flex-shrink-0" style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FF8C00,#e67e00)', boxShadow: '0 4px 12px rgba(255,140,0,0.3)' }}>
              <Shield size={16} className="text-white" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <p className="font-black" style={{ fontSize: 15, lineHeight: 1.1 }}>
                    <span style={{ color: 'white' }}>JRC </span>
                    <span style={{ color: '#FF8C00' }}>Admin</span>
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5 }}>ADMIN PORTAL</p>
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
          {!sidebarCollapsed && <p className="mb-2 pl-2 font-black" style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.42)' }}>ADMIN SECTIONS</p>}
          {ADMIN_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const item = (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl transition-all relative"
                style={{
                  padding: sidebarCollapsed ? '10px 0' : '9px 10px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(255,140,0,0.10)' : 'transparent',
                }}
              >
                {isActive && !sidebarCollapsed && (
                  <motion.div layoutId="adminActiveBar" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[#FF8C00]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all" style={{
                  background: isActive ? 'linear-gradient(135deg,#FF8C00,#e67e00)' : 'rgba(255,255,255,0.05)',
                  boxShadow: isActive ? '0 4px 12px rgba(255,140,0,0.3)' : 'none',
                }}>
                  <tab.icon size={15} color={isActive ? 'white' : 'rgba(255,255,255,0.55)'} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <p style={{ fontSize: 12, fontWeight: 800, color: isActive ? '#F8FAFC' : '#777' }}>{tab.label}</p>
                    <p style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.55)' : '#444' }} className="truncate">{tab.sub}</p>
                  </div>
                )}
              </button>
            );
            if (sidebarCollapsed) {
              return (
                <div key={tab.id} className="relative group">
                  {item}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                    <div className="whitespace-nowrap rounded-xl px-3 py-2 font-black shadow-xl" style={{ fontSize: 12, background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                      {tab.label}
                    </div>
                  </div>
                </div>
              );
            }
            return item;
          })}
        </nav>

        <div className="h-px bg-white/[0.04] flex-shrink-0" />

        <div className="flex-shrink-0 p-3">
          {sidebarCollapsed ? (
            <div className="relative group">
              <button onClick={onLogout} className="w-full flex justify-center py-2 rounded-xl hover:bg-red-500/10 transition-all text-gray-600 hover:text-red-400">
                <LogOut size={16} />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all">
                <div className="whitespace-nowrap rounded-xl px-3 py-2 font-black shadow-xl text-red-400" style={{ fontSize: 12, background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(239,68,68,0.2)' }}>Sign Out</div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
                  <span className="text-white font-black" style={{ fontSize: 13 }}>{user?.name?.charAt(0) || 'A'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black truncate" style={{ fontSize: 12 }}>{user?.name || 'Admin'}</p>
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

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Desktop header bar */}
        {(() => {
          const activeTabData = ADMIN_TABS.find(t => t.id === activeTab);
          return (
            <div className="hidden md:flex h-14 border-b border-white/[0.08] items-center px-6 flex-shrink-0 gap-3"
              style={{ background: 'rgba(12,10,16,0.72)', backdropFilter: 'blur(10px)' }}>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,140,0,0.15)' }}>
                  {activeTabData && <activeTabData.icon size={13} style={{ color: '#FF8C00' }} strokeWidth={2.5} />}
                </div>
                <span className="text-white font-black truncate" style={{ fontSize: 13 }}>{activeTabData?.label || 'Dashboard'}</span>
                <span className="text-gray-700 flex-shrink-0" style={{ fontSize: 12 }}>·</span>
                <span className="text-gray-500 truncate" style={{ fontSize: 11 }}>{activeTabData?.sub}</span>
              </div>

              <div className="flex-1" />

              {/* Connection Status */}
              <ConnectionStatus isConnected={isConnected} showLabel={false} size="sm" />

              {/* Admin role chip */}
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 border border-white/5 flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
                  <span className="text-white font-black" style={{ fontSize: 10 }}>{user?.name?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
                <span className="text-gray-300 font-black" style={{ fontSize: 12 }}>{user?.name || 'Admin'}</span>
                <span className="rounded-full px-1.5 py-0.5 font-black flex-shrink-0" style={{ fontSize: 9, background: 'rgba(255,140,0,0.15)', color: '#FF8C00' }}>ADMIN</span>
              </div>
            </div>
          );
        })()}

        {/* Content */}
        <main className={`flex-1 overflow-x-hidden custom-scrollbar ${
          activeTab === 'facility' ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-8'
        }`} style={{ background: 'transparent' }}>
          {renderContent()}
        </main>
      </div>
      </div>{/* end desktop flex */}
    </div>
  );
}
