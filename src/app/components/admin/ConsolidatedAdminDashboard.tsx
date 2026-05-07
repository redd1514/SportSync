import { FacilityMapBuilder } from './FacilityMapBuilder';
import React, { useState, useMemo } from 'react';
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
  XCircle, Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '../../contexts/UserContext';
import { useCoaching } from '../../contexts/CoachingContext';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { AdminCoachingManagement } from './AdminCoachingManagement';
import { AdminAddonsManagement } from './AdminAddonsManagement';
import { RoleManagementAdmin } from './RoleManagementAdmin';
import { ALL_COURTS, RATE_CARD, SPORTS_INFO } from '../sportsData';
import { getSportColor, SportIcon } from '../SportIcons';
import { CustomDateTimePicker } from '../shared/CustomDateTimePicker';
import { useAddons } from '../../contexts/AddonsContext';
import { useFacilityMap } from '../../contexts/FacilityMapContext';
import { useAnnouncements, type Announcement } from '../../contexts/AnnouncementsContext';

type AdminTab = 'executive' | 'facility' | 'calendar' | 'settings';

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
  { id: 'executive', icon: TrendingUp,  label: 'Executive Overview',   sub: 'KPIs, Analytics, Users, Payments'  },
  { id: 'facility',  icon: MapPin,      label: 'Facility Management',  sub: 'Courts, Map Layout, Add-ons'        },
  { id: 'calendar',  icon: Calendar,    label: 'Master Calendar',      sub: 'Bookings, Schedule, Requests'       },
  { id: 'settings',  icon: Settings,    label: 'System Settings',      sub: 'Business Config, Staff, Coaching'   },
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
  const { bookings, transactions, allUsers, updateUser, cancellationRequests } = useUser();
  const [sub, setSub] = useState<ExecSubTab>('overview');
  const [userConfirm, setUserConfirm] = useState<{ id: string; name: string; action: 'suspend' | 'activate' } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === todayStr);
  const totalRevToday = todayBookings.reduce((s, b) => s + b.amount, 0);
  const openCourts = 9;
  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;

  const REVENUE_DATA = [
    { day: 'Mon', revenue: 3800 }, { day: 'Tue', revenue: 4200 },
    { day: 'Wed', revenue: 3100 }, { day: 'Thu', revenue: 5600 },
    { day: 'Fri', revenue: 6800 }, { day: 'Sat', revenue: 9200 },
    { day: 'Sun', revenue: 7400 },
  ];

  const sportPie = Object.entries(
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
        <p className="text-gray-500" style={{ fontSize: 13 }}>Real-time visibility across all operations</p>
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
              { label: 'Total Bookings', value: bookings.length, icon: Calendar, color: '#22c55e', sub: 'All time' },
              { label: 'Courts Open', value: `${openCourts}/12`, icon: MapPin, color: '#0047AB', sub: `${12 - openCourts} currently occupied` },
              { label: 'Pending Requests', value: pendingCancellations, icon: AlertTriangle, color: '#a855f7', sub: 'Awaiting review' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl p-5 border border-white/5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${kpi.color}10 0%, ${kpi.color}05 100%)`, borderColor: `${kpi.color}15` }}>
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
              </div>
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
                  {bookings.slice(0, 6).map(b => (
                    <tr key={b.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-gray-600 font-black" style={{ fontSize: 11 }}>#{(b.refCode || b.id).slice(-8).toUpperCase()}</td>
                      <td className="px-5 py-3 text-white font-black" style={{ fontSize: 13 }}>{b.customerName}</td>
                      <td className="px-5 py-3 text-gray-300" style={{ fontSize: 13 }}>{b.court}</td>
                      <td className="px-5 py-3 text-gray-300" style={{ fontSize: 13 }}>{b.date}</td>
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
      {sub === 'analytics' && <AnalyticsDashboard />}

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
                  {allUsers.map(u => (
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
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5">
            <h4 className="text-white font-black mb-3" style={{ fontSize: 15 }}>Current Reward Rule</h4>
            <div className="bg-[#252525] rounded-xl p-4 flex items-center gap-4">
              <Award size={24} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-white font-black" style={{ fontSize: 14 }}>Book 10 sessions, get 1 free!</p>
                <p className="text-gray-400" style={{ fontSize: 12 }}>Users earn 1 point per booking. 10 points = 1 free session discount.</p>
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
                  <tr>{['User', 'Points', 'Progress', 'Rewards'].map(h => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User suspend/activate confirmation */}
      <AnimatePresence>
        {userConfirm && (
          <ConfirmModal opts={{
            title: userConfirm.action === 'suspend' ? 'Suspend Account?' : 'Activate Account?',
            body: `${userConfirm.name}\n${userConfirm.action === 'suspend' ? 'This user will be unable to log in until reactivated.' : 'This user will regain full access to their account.'}`,
            confirmLabel: userConfirm.action === 'suspend' ? 'Yes, Suspend' : 'Yes, Activate',
            confirmColor: userConfirm.action === 'suspend' ? '#ef4444' : '#22c55e',
            icon: userConfirm.action === 'suspend' ? <UserX size={28} className="text-red-400" /> : <UserCheck size={28} className="text-green-400" />,
            onConfirm: () => { updateUser(userConfirm.id, { accountStatus: userConfirm.action === 'suspend' ? 'suspended' : 'active' }); setUserConfirm(null); },
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
  const [sub, setSub] = useState<FacilitySubTab>('map');
  const { maps, updateBlockStatus, deleteCourtBlock } = useFacilityMap();
  const { addCustomSport, customSports } = useAddons();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddSportModal, setShowAddSportModal] = useState(false);
  const [newSportName, setNewSportName] = useState('');
  const [newSportColor, setNewSportColor] = useState('#FF8C00');
  const COLOR_PRESETS = ['#FF8C00','#0047AB','#22c55e','#a855f7','#ec4899','#06b6d4','#f59e0b','#10b981'];

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
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0E0E] border-b border-white/[0.05] flex-shrink-0">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all font-black ${t.id === sub ? 'bg-[#FF8C00] text-white' : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-white/5'}`}
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
                                onClick={() => updateBlockStatus(court.id, court.status === 'maintenance' ? 'available' : 'maintenance')}
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
                <button onClick={() => { deleteCourtBlock(confirmDeleteId); setConfirmDeleteId(null); }}
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
  const { addBooking, cancellationRequests, updateCancellationRequest, updateBooking, bookings } = useUser();
  const { requests, updateRequestStatus } = useCoaching();
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [showBulkBooking, setShowBulkBooking] = useState(false);
  const [manualForm, setManualForm] = useState({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
  const [bulkForm, setBulkForm] = useState({ sport: 'Basketball', court: '', time: '', startDate: '', endDate: '', recurringPattern: 'weekly' });
  const [bulkEndTime, setBulkEndTime] = useState('00:00');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<{ id: string; approved: boolean } | null>(null);

  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;

  const handleManualBooking = () => {
    const name = manualForm.customerName || 'Walk-in Customer';
    addBooking({ id: `BK${Date.now()}`, sport: manualForm.sport, date: manualForm.date, time: manualForm.time, duration: manualForm.duration, court: manualForm.court, status: 'confirmed', amount: 500 * manualForm.duration, paymentStatus: 'pending', createdAt: new Date().toISOString(), customerName: name, customerPhone: manualForm.contactNumber, addOns: 'Manual (Walk-in)' });
    setShowManualBooking(false);
    setManualForm({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
    setManualSuccess(`✓ Manual booking confirmed for ${name} — ${manualForm.sport} on ${manualForm.date} at ${manualForm.time}.`);
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
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setShowManualBooking(true)} className="flex items-center gap-2 bg-[#0047AB] text-white px-4 py-2 rounded-xl hover:bg-[#003a8c] transition-colors font-black" style={{ fontSize: 13 }}>
            <Plus size={16} /> Manual Booking
          </button>
          <button onClick={() => setShowBulkBooking(true)} className="flex items-center gap-2 bg-[#FF8C00] text-white px-4 py-2 rounded-xl hover:bg-[#e67e00] transition-colors font-black" style={{ fontSize: 13 }}>
            <Calendar size={16} /> Liga/Bulk Booking
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
          <div className="bg-[#1A1A1A] rounded-3xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-black" style={{ fontSize: 18 }}>Liga/Bulk Booking</h3>
              <button onClick={() => setShowBulkBooking(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Court</label>
                <input type="text" placeholder="e.g. Basketball 1" value={bulkForm.court} onChange={e => setBulkForm({ ...bulkForm, court: e.target.value })} className={INPUT} style={{ fontSize: 13 }} />
              </div>
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
                <p className="text-gray-500 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>END DATE</p>
                <CustomDateTimePicker
                  selectedDate={bulkForm.endDate}
                  selectedTime={bulkEndTime}
                  onDateChange={d => setBulkForm(f => ({ ...f, endDate: d }))}
                  onTimeChange={setBulkEndTime}
                  minDate={bulkForm.startDate || new Date().toISOString().split('T')[0]}
                  accentColor="#FF8C00"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Sport</label>
                <select value={bulkForm.sport} onChange={e => setBulkForm({ ...bulkForm, sport: e.target.value })} className={INPUT} style={{ fontSize: 13 }}>
                  {['Basketball', 'Volleyball', 'Badminton', 'Pickleball', 'Billiards', 'Table Tennis'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Pattern</label>
                <select value={bulkForm.recurringPattern} onChange={e => setBulkForm({ ...bulkForm, recurringPattern: e.target.value })} className={INPUT} style={{ fontSize: 13 }}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>
              <button
                onClick={() => {
                  const start = new Date(bulkForm.startDate);
                  const end = new Date(bulkForm.endDate);
                  let current = new Date(start);
                  let count = 0;
                  while (current <= end && count < 20) {
                    addBooking({ id: `BK${Date.now()}_${count}`, sport: bulkForm.sport, date: current.toISOString().split('T')[0], time: bulkForm.time, duration: 2, court: bulkForm.court, status: 'confirmed', amount: 1000, paymentStatus: 'paid', createdAt: new Date().toISOString(), customerName: 'Liga Booking', addOns: 'Bulk/Liga booking' });
                    const inc = bulkForm.recurringPattern === 'weekly' ? 7 : 14;
                    current = new Date(current.setDate(current.getDate() + inc));
                    count++;
                  }
                  setShowBulkBooking(false);
                  setBulkSuccess(`✓ ${count} recurring booking${count !== 1 ? 's' : ''} created for ${bulkForm.sport}!`);
                  setTimeout(() => setBulkSuccess(''), 6000);
                }}
                className="w-full bg-[#FF8C00] text-white py-3 rounded-xl font-black hover:bg-[#e67e00] transition-colors"
                style={{ fontSize: 14 }}
              >
                Create Bulk Bookings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── System Settings ──────────────────────────────────────────────────────────
type SettingsSubTab = 'business' | 'pricing' | 'roles' | 'announcements' | 'coaching';

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-black" style={{ fontSize: 18 }}>Pricing & Rates</h3>
        <p className="text-gray-500" style={{ fontSize: 13 }}>Changes apply immediately to all new bookings.</p>
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
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}
          className="px-6 py-2.5 rounded-xl text-white font-black transition-all flex items-center gap-2"
          style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg,#FF8C00,#e67e00)', fontSize: 14 }}>
          {saved ? <><Check size={15} /> Saved!</> : 'Save All Pricing'}
        </button>
        {saved && <p className="text-green-400" style={{ fontSize: 12 }}>Changes apply to all new bookings immediately.</p>}
      </div>
    </div>
  );
}

function SystemSettingsTab() {
  const { systemSettings, updateSystemSettings } = useUser();
  const { addAnnouncement, announcements } = useAnnouncements();
  const { customSports } = useAddons();
  const [sub, setSub] = useState<SettingsSubTab>('business');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as Announcement['type'] });
  const [announceSent, setAnnounceSent] = useState('');
  const [savedBiz, setSavedBiz] = useState(false);

  const SETTINGS_TABS: { id: SettingsSubTab; icon: any; label: string; desc: string }[] = [
    { id: 'business',      icon: Building,      label: 'Business Config', desc: 'Hours & policies'       },
    { id: 'pricing',       icon: DollarSign,    label: 'Pricing & Rates', desc: 'Court & add-on pricing' },
    { id: 'roles',         icon: Users,         label: 'Staff & Roles',   desc: 'Accounts & access'     },
    { id: 'announcements', icon: Megaphone,     label: 'Announcements',   desc: 'Send to users'         },
    { id: 'coaching',      icon: GraduationCap, label: 'Coaching Mgmt',   desc: 'Coaches & sessions'    },
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
              <Calendar size={14} className="text-[#0047AB]" />
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
              <DollarSign size={14} className="text-green-400" />
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Payment Settings</h4>
            </div>
            <div>
              <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>Downpayment %</label>
              <input type="number" min={0} max={100} value={systemSettings.downpaymentPercentage} onChange={e => updateSystemSettings({ downpaymentPercentage: parseInt(e.target.value) })} className={INPUT} style={{ fontSize: 13 }} />
              <p className="text-gray-500 mt-2" style={{ fontSize: 12 }}>{systemSettings.downpaymentPercentage}% required upfront</p>
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
            <button onClick={() => { setSavedBiz(true); setTimeout(() => setSavedBiz(false), 2500); }}
              className="px-6 py-2.5 rounded-xl text-white font-black transition-all flex items-center gap-2"
              style={{ background: savedBiz ? '#22c55e' : 'linear-gradient(135deg,#FF8C00,#e67e00)', fontSize: 14 }}>
              {savedBiz ? <><Check size={15} /> Saved!</> : 'Save Configuration'}
            </button>
            {savedBiz && <p className="text-green-400" style={{ fontSize: 12 }}>Settings saved successfully.</p>}
          </div>
        </div>
      )}

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
                onClick={() => {
                  if (!announcementForm.title.trim()) return;
                  addAnnouncement({ title: announcementForm.title, message: announcementForm.message, type: announcementForm.type });
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
            <div className="px-5 py-4 border-b border-white/5">
              <h4 className="text-white font-black" style={{ fontSize: 15 }}>Sent Announcements ({announcements.length})</h4>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sub === 'coaching' && <AdminCoachingManagement />}
    </div>
  );
}

// ── Main Dashboard Shell ─────────────────────────────────────────────────────
export function ConsolidatedAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<AdminTab>('executive');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'executive': return <ExecutiveOverview />;
      case 'facility':  return <FacilityMapBuilderTab />;
      case 'calendar':  return <MasterCalendarTab />;
      case 'settings':  return <SystemSettingsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row h-screen overflow-hidden">

      {/* ── MOBILE layout: status + content + bottom nav ── */}
      <div className="md:hidden flex flex-col h-screen w-full overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 h-10 flex-shrink-0" style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#FF8C00,#e67e00)" }}>
              <Shield size={11} className="text-white" />
            </div>
            <span className="font-black" style={{ fontSize: 13, color: "#E8E8EA" }}>JRC <span style={{ color: "#FF8C00" }}>Admin</span></span>
          </div>
          <button onClick={onLogout} className="px-3 py-1 rounded-lg font-black" style={{ fontSize: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            Sign Out
          </button>
        </div>
        {/* Content */}
        <main className={`flex-1 overflow-x-hidden bg-[#0D0D0D] ${activeTab === 'facility' ? 'overflow-hidden' : 'overflow-y-auto p-4'}`}>
          {renderContent()}
        </main>
        {/* Mobile bottom nav */}
        <div className="flex-shrink-0 flex items-stretch" style={{ background: "#141414", borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
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
          className="bg-[#0E0E0E] border-r border-white/[0.05] flex-col flex-shrink-0 overflow-hidden flex"
          style={{ minWidth: sidebarCollapsed ? 72 : 236, maxWidth: sidebarCollapsed ? 72 : 236, width: sidebarCollapsed ? 72 : 236 }}
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
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#3a3a3a', letterSpacing: 1.5 }}>ADMIN PORTAL</p>
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
          {!sidebarCollapsed && <p className="text-gray-700 mb-2 pl-2 font-black" style={{ fontSize: 9, letterSpacing: 1.5 }}>ADMIN SECTIONS</p>}
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
                  background: isActive ? 'rgba(255,140,0,0.1)' : 'transparent',
                }}
              >
                {isActive && !sidebarCollapsed && (
                  <motion.div layoutId="adminActiveBar" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[#FF8C00]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all" style={{
                  background: isActive ? 'linear-gradient(135deg,#FF8C00,#e67e00)' : 'rgba(255,255,255,0.05)',
                  boxShadow: isActive ? '0 4px 12px rgba(255,140,0,0.3)' : 'none',
                }}>
                  <tab.icon size={15} color={isActive ? 'white' : '#555'} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <p style={{ fontSize: 12, fontWeight: 800, color: isActive ? '#F8FAFC' : '#777' }}>{tab.label}</p>
                    <p style={{ fontSize: 10, color: '#444' }} className="truncate">{tab.sub}</p>
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
            <div className="rounded-2xl p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
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
            <div className="hidden md:flex h-14 bg-[#0E0E0E] border-b border-white/[0.05] items-center px-6 flex-shrink-0 gap-3">
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
        <main className={`flex-1 overflow-x-hidden bg-[#0D0D0D] custom-scrollbar ${
          activeTab === 'facility' ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-8'
        }`}>
          {renderContent()}
        </main>
      </div>
      </div>{/* end desktop flex */}
    </div>
  );
}