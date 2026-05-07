import { useState, useMemo } from "react";
import { useCoaching, Coach, CoachingRequest } from "../../contexts/CoachingContext";
import { useUser } from "../../contexts/UserContext";
import { useAddons } from "../../contexts/AddonsContext";
import {
  Plus, Edit2, Trash2, CheckCircle, XCircle, User, Link as LinkIcon,
  Clock, Calendar, ChevronDown, Check, X, DollarSign, Star, Users,
  GraduationCap, Award, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSportColor } from "../SportIcons";
import type { CoachApplication } from "../user/CoachApplicationForm";

type Tab = "coaches" | "requests" | "applications";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Custom styled select for hours
function HourSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const slots: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue; // Facility closes at 11:00 PM (23:00)
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
  };
  return (
    <div>
      <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#131314] border border-white/10 rounded-xl px-3 py-2.5 text-white appearance-none focus:outline-none focus:border-[#F97316] pr-8"
          style={{ fontSize: 13 }}
        >
          {slots.map(t => <option key={t} value={t}>{fmt(t)}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

// Mini calendar for picking dates
function MiniDatePicker({ onSelect, selected }: { onSelect: (d: string) => void; selected: string[] }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const todayStr = today.toISOString().split('T')[0];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayLabels = ['S','M','T','W','T','F','S'];

  return (
    <div className="bg-[#131314] rounded-xl border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewMonth(new Date(y, m - 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400">
          <ChevronDown size={12} className="rotate-90" />
        </button>
        <span className="text-white font-black" style={{ fontSize: 12 }}>{monthNames[m]} {y}</span>
        <button type="button" onClick={() => setViewMonth(new Date(y, m + 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400">
          <ChevronDown size={12} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayLabels.map((d, i) => <div key={i} className="text-center text-gray-600 font-black" style={{ fontSize: 8 }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = dStr < todayStr;
          const isSel = selected.includes(dStr);
          return (
            <button key={day} type="button" disabled={isPast} onClick={() => onSelect(dStr)}
              className="aspect-square rounded-md flex items-center justify-center font-black transition-all disabled:opacity-20"
              style={{ fontSize: 9, background: isSel ? '#F97316' : 'transparent', color: isSel ? 'white' : '#aaa', border: `1px solid ${isSel ? '#F97316' : 'transparent'}` }}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminCoachingManagement() {
  const { coaches, requests, updateRequestStatus, addCoach, updateCoach, deleteCoach } = useCoaching();
  const { updateBooking } = useUser();
  const { allSportNames } = useAddons();
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [verifyingRequest, setVerifyingRequest] = useState<CoachingRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ req: CoachingRequest; action: 'confirmed' | 'rejected' } | null>(null);
  const [appConfirm, setAppConfirm] = useState<{ app: CoachApplication; action: 'approved' | 'rejected' } | null>(null);
  const [applications, setApplications] = useState<CoachApplication[]>(() => {
    try { return JSON.parse(localStorage.getItem("jrc_coach_applications") || "[]"); } catch { return []; }
  });
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Form state
  const [name, setName] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [rate, setRate] = useState("");
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isAvail, setIsAvail] = useState(true);
  const [dateMode, setDateMode] = useState<'specific' | 'recurring'>('recurring');

  const resetForm = () => {
    setName(""); setSport("Basketball"); setRate(""); setDesc("");
    setDays([]); setRecurringDays([]); setStartTime("08:00"); setEndTime("17:00");
    setIsAvail(true); setDateMode('recurring');
  };

  const openAddModal = () => { resetForm(); setEditingCoach(null); setShowCoachModal(true); };
  const openEditModal = (coach: Coach) => {
    setEditingCoach(coach);
    setName(coach.name); setSport(coach.sport);
    setRate(coach.hourlyRate.toString()); setDesc(coach.description);
    setDays(coach.availableDays); setIsAvail(coach.isAvailable);
    setDateMode('specific');
    const [start, end] = coach.timeRange.split(' - ');
    // Convert 12h to 24h
    const to24 = (s: string) => {
      const match = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return '08:00';
      let h = parseInt(match[1]); const m = match[2]; const p = match[3].toUpperCase();
      if (p === 'PM' && h < 12) h += 12; if (p === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${m}`;
    };
    setStartTime(to24(start)); setEndTime(to24(end));
    setShowCoachModal(true);
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hr}:${String(m).padStart(2,'0')} ${ap}`;
  };

  const handleSaveCoach = (e: React.FormEvent) => {
    e.preventDefault();
    const timeRange = `${fmt12(startTime)} - ${fmt12(endTime)}`;
    let availableDays = days;
    if (dateMode === 'recurring') {
      // Generate next 4 weeks of selected weekdays
      const result: string[] = [];
      const today = new Date();
      for (let i = 0; i < 28; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        if (recurringDays.includes(d.getDay())) {
          result.push(d.toISOString().split('T')[0]);
        }
      }
      availableDays = result;
    }
    const data = { name, sport, hourlyRate: parseInt(rate) || 0, description: desc, availableDays, timeRange, isAvailable: isAvail };
    if (editingCoach) updateCoach(editingCoach.id, data); else addCoach(data);
    setShowCoachModal(false);
  };

  const handleDateSelect = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const INPUT = "w-full bg-[#131314] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#F97316]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-white font-black" style={{ fontSize: 20 }}>Coaching Management</h3>
          <p className="text-gray-500" style={{ fontSize: 13 }}>Manage coaches and review coaching session requests</p>
        </div>
        {activeTab === "coaches" && (
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-[#F97316] text-white px-4 py-2.5 rounded-xl font-black hover:bg-[#EA580C] transition-colors"
            style={{ fontSize: 13 }}>
            <Plus size={15} /> Add Coach
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#131314] p-1 rounded-xl border border-white/5 w-fit">
        {(['requests', 'coaches', 'applications'] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-2 rounded-lg font-black transition-all capitalize"
            style={{ fontSize: 12, background: activeTab === t ? '#F97316' : 'transparent', color: activeTab === t ? 'white' : '#666' }}>
            {t === 'requests' ? 'Coaching Requests' : t === 'coaches' ? 'Coach Directory' : 'Coach Applications'}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {activeTab === "requests" && (
        <div className="bg-[#1E1E1F] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-gray-400 font-black" style={{ fontSize: 12 }}>{requests.length} total requests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-[#131314]">
                <tr>{['User', 'Coach & Sport', 'Schedule', 'Message', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-gray-600 font-black uppercase" style={{ fontSize: 10 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-600" style={{ fontSize: 13 }}>No coaching requests yet.</td></tr>
                ) : requests.map(req => (
                  <tr key={req.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#252525] flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-gray-500" />
                        </div>
                        <span className="text-white font-black" style={{ fontSize: 13 }}>{req.userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white font-black" style={{ fontSize: 13 }}>{req.coachName}</p>
                      <p className="font-black" style={{ fontSize: 11, color: getSportColor(req.sport) }}>{req.sport}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-gray-300" style={{ fontSize: 12 }}>
                        <Calendar size={11} className="text-gray-500" />
                        {req.requestedDate}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 mt-0.5" style={{ fontSize: 11 }}>
                        <Clock size={10} className="text-gray-600" />
                        {req.requestedTime}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-500 truncate max-w-[180px]" style={{ fontSize: 12 }}>{req.message || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-lg font-black ${
                        req.status === 'pending' ? 'bg-gray-500/10 text-gray-400' :
                        req.status === 'confirmed' ? 'bg-green-500/10 text-green-400' :
                        'bg-red-500/10 text-red-400'
                      }`} style={{ fontSize: 10 }}>
                        {req.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        {req.status === 'pending' && (
                          <button onClick={() => setConfirmAction({ req, action: 'rejected' })}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Reject">
                            <XCircle size={15} />
                          </button>
                        )}
                        {req.status === 'confirmed' && !req.linkedBookingId && (
                          <button className="px-3 py-1.5 rounded-lg bg-[#2563EB]/15 text-blue-400 font-black hover:bg-[#2563EB]/25 transition-colors flex items-center gap-1"
                            style={{ fontSize: 11 }}>
                            <LinkIcon size={11} /> Link Booking
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COACHES TAB ── */}
      {activeTab === "coaches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {coaches.map(coach => {
            const sc = getSportColor(coach.sport);
            return (
              <div key={coach.id} className="bg-[#1E1E1F] rounded-2xl border border-white/5 overflow-hidden group relative">
                {/* Sport color bar */}
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${sc}, ${sc}80)` }} />

                {/* Action buttons */}
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={() => openEditModal(coach)}
                    className="p-1.5 rounded-lg bg-[#252525] text-gray-400 hover:text-white hover:bg-[#333] transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteCoach(coach.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="p-5">
                  {/* Coach info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ background: `${sc}15`, border: `1.5px solid ${sc}30` }}>
                      {coach.image ? (
                        <img src={coach.image} alt={coach.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={22} style={{ color: sc, opacity: 0.8 }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black truncate" style={{ fontSize: 15 }}>{coach.name}</p>
                      <p className="font-black" style={{ fontSize: 12, color: sc }}>{coach.sport}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${coach.isAvailable ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className={`font-black ${coach.isAvailable ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: 10 }}>
                          {coach.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${sc}15` }}>
                        <DollarSign size={12} style={{ color: sc }} />
                      </div>
                      <span className="text-white font-black" style={{ fontSize: 13 }}>₱{coach.hourlyRate.toLocaleString()}/hr</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${sc}15` }}>
                        <Clock size={12} style={{ color: sc }} />
                      </div>
                      <span className="text-gray-300" style={{ fontSize: 12 }}>{coach.timeRange}</span>
                    </div>
                    {coach.availableDays.length > 0 && (
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${sc}15` }}>
                          <Calendar size={12} style={{ color: sc }} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {coach.availableDays.slice(0, 3).map(d => (
                            <span key={d} className="px-2 py-0.5 rounded-md font-black" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#aaa' }}>
                              {isNaN(Date.parse(d)) ? d : new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                          {coach.availableDays.length > 3 && (
                            <span className="px-2 py-0.5 rounded-md font-black" style={{ fontSize: 10, background: `${sc}20`, color: sc }}>
                              +{coach.availableDays.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {coach.description && (
                      <p className="text-gray-500 mt-2 line-clamp-2" style={{ fontSize: 11 }}>{coach.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {coaches.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-600">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-black" style={{ fontSize: 14 }}>No coaches yet</p>
              <p style={{ fontSize: 12 }}>Add your first coach to get started</p>
            </div>
          )}
        </div>
      )}

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(["all","pending","approved","rejected"] as const).map(f => (
              <button key={f} onClick={() => setAppFilter(f)}
                className="px-3 py-1.5 rounded-xl border font-black capitalize transition-all"
                style={{ fontSize: 12, background: appFilter === f ? "#F97316" : "#1E1E1F", borderColor: appFilter === f ? "#F97316" : "rgba(255,255,255,0.1)", color: appFilter === f ? "white" : "#666" }}>
                {f} {f === "all" ? `(${applications.length})` : `(${applications.filter(a => a.status === f).length})`}
              </button>
            ))}
            <button onClick={() => setApplications(JSON.parse(localStorage.getItem("jrc_coach_applications") || "[]"))}
              className="ml-auto px-3 py-1.5 rounded-xl border font-black text-gray-400 hover:text-white transition-all"
              style={{ fontSize: 12, background: "#1E1E1F", borderColor: "rgba(255,255,255,0.1)" }}>
              Refresh
            </button>
          </div>

          {applications.filter(a => appFilter === "all" || a.status === appFilter).length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/5" style={{ background: "#131314" }}>
              <GraduationCap size={36} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 font-black" style={{ fontSize: 15 }}>No applications yet</p>
              <p className="text-gray-700 mt-1" style={{ fontSize: 13 }}>Applications from users will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.filter(a => appFilter === "all" || a.status === appFilter).map((app, i) => {
                const sportColor = getSportColor(app.sport);
                return (
                  <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border overflow-hidden" style={{ background: "#131314", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${sportColor}18`, border: `1px solid ${sportColor}30` }}>
                            <span style={{ color: sportColor, fontSize: 13, fontWeight: 900 }}>{app.sport.slice(0,2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-white font-black" style={{ fontSize: 15 }}>{app.userName}</p>
                            <p className="text-gray-500" style={{ fontSize: 12 }}>{app.userEmail} · {app.sport}</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full font-black flex-shrink-0" style={{
                          fontSize: 11,
                          background: app.status === "pending" ? "rgba(234,179,8,0.15)" : app.status === "approved" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                          color: app.status === "pending" ? "#eab308" : app.status === "approved" ? "#22c55e" : "#ef4444",
                          border: `1px solid ${app.status === "pending" ? "rgba(234,179,8,0.3)" : app.status === "approved" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                        }}>
                          {app.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {[
                          { label: "Sport",         value: app.sport },
                          { label: "Experience",    value: app.experience || "Not specified" },
                          { label: "Desired Rate",  value: `₱${app.requestedRate?.toLocaleString()}/hr` },
                          { label: "Availability",  value: `${app.availability?.length || 0} days/wk` },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl px-3 py-2" style={{ background: "#1E1E1F" }}>
                            <p className="text-gray-600" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{item.label.toUpperCase()}</p>
                            <p className="text-white font-black" style={{ fontSize: 13 }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "#1E1E1F" }}>
                        <p className="text-gray-600 font-black mb-1" style={{ fontSize: 10, letterSpacing: 0.5 }}>BIO</p>
                        <p className="text-gray-300" style={{ fontSize: 13, lineHeight: 1.6 }}>{app.bio}</p>
                      </div>
                      {app.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => setAppConfirm({ app, action: 'approved' })}
                            className="flex-1 py-2.5 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-all hover:brightness-110"
                            style={{ fontSize: 13, background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                            <CheckCircle size={14} /> Approve & Create Coach
                          </button>
                          <button onClick={() => setAppConfirm({ app, action: 'rejected' })}
                            className="flex-1 py-2.5 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-all hover:brightness-110"
                            style={{ fontSize: 13, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                            <XCircle size={14} /> Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Action Dialog ── */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1E1E1F] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${confirmAction.action === 'confirmed' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                {confirmAction.action === 'confirmed' ? <CheckCircle size={24} className="text-green-400" /> : <XCircle size={24} className="text-red-400" />}
              </div>
              <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>
                {confirmAction.action === 'confirmed' ? 'Confirm Request?' : 'Reject Request?'}
              </h3>
              <p className="text-gray-400 text-center mb-5" style={{ fontSize: 12 }}>
                {confirmAction.req.userName}'s request for {confirmAction.req.coachName}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors"
                  style={{ fontSize: 13 }}>Cancel</button>
                <button
                  onClick={() => { updateRequestStatus(confirmAction.req.id, confirmAction.action); setConfirmAction(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-white font-black transition-colors ${confirmAction.action === 'confirmed' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                  style={{ fontSize: 13 }}>
                  {confirmAction.action === 'confirmed' ? 'Yes, Confirm' : 'Yes, Reject'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Add/Edit Coach Modal ── */}
      <AnimatePresence>
        {showCoachModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1E1E1F] w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                <h3 className="text-white font-black" style={{ fontSize: 17 }}>{editingCoach ? 'Edit Coach' : 'Add New Coach'}</h3>
                <button onClick={() => setShowCoachModal(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveCoach} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6 space-y-5">

                  {/* Basic Info */}
                  <div className="space-y-4">
                    <p className="text-gray-600 font-black" style={{ fontSize: 10, letterSpacing: 1 }}>BASIC INFO</p>
                    <div>
                      <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>COACH NAME</label>
                      <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                        className={INPUT} style={{ fontSize: 13 }} />
                    </div>

                    {/* Sport picker */}
                    <div>
                      <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>SPORT</label>
                      <div className="flex flex-wrap gap-1.5">
                        {allSportNames.map(s => {
                          const sc = getSportColor(s);
                          const isActive = sport === s;
                          return (
                            <button key={s} type="button" onClick={() => setSport(s)}
                              className="px-3 py-1.5 rounded-xl font-black transition-all"
                              style={{ fontSize: 12, background: isActive ? `${sc}20` : 'rgba(255,255,255,0.05)', color: isActive ? sc : '#666', border: `1.5px solid ${isActive ? `${sc}60` : 'rgba(255,255,255,0.08)'}` }}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>HOURLY RATE (₱)</label>
                        <input required type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 500"
                          className={INPUT} style={{ fontSize: 13 }} />
                      </div>
                      <div className="flex flex-col justify-end">
                        <button type="button" onClick={() => setIsAvail(!isAvail)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all"
                          style={{ background: isAvail ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isAvail ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isAvail ? 'bg-green-400 border-green-400' : 'bg-transparent border-red-400'}`}>
                            {isAvail && <Check size={9} className="text-white" />}
                          </div>
                          <span className="font-black" style={{ fontSize: 12, color: isAvail ? '#22c55e' : '#ef4444' }}>
                            {isAvail ? 'Available' : 'Unavailable'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>DESCRIPTION</label>
                      <textarea required value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Coach bio, specializations..."
                        className={`${INPUT} resize-none`} style={{ fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="space-y-4">
                    <p className="text-gray-600 font-black" style={{ fontSize: 10, letterSpacing: 1 }}>SCHEDULE</p>

                    <div className="grid grid-cols-2 gap-4">
                      <HourSelect value={startTime} onChange={setStartTime} label="START TIME" />
                      <HourSelect value={endTime} onChange={setEndTime} label="END TIME" />
                    </div>

                    {/* Date mode toggle */}
                    <div>
                      <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>AVAILABILITY MODE</label>
                      <div className="flex gap-1 bg-[#131314] p-1 rounded-xl border border-white/5">
                        {(['recurring', 'specific'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setDateMode(m)}
                            className="flex-1 py-2 rounded-lg font-black transition-all capitalize"
                            style={{ fontSize: 12, background: dateMode === m ? '#F97316' : 'transparent', color: dateMode === m ? 'white' : '#666' }}>
                            {m === 'recurring' ? 'Weekly (Recurring)' : 'Specific Dates'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {dateMode === 'recurring' && (
                      <div>
                        <label className="block text-gray-500 mb-2 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>AVAILABLE DAYS OF WEEK</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {DAY_LABELS.map((d, i) => {
                            const isActive = recurringDays.includes(i);
                            return (
                              <button key={i} type="button"
                                onClick={() => setRecurringDays(prev => isActive ? prev.filter(x => x !== i) : [...prev, i])}
                                className="w-10 h-10 rounded-xl font-black transition-all"
                                style={{ fontSize: 12, background: isActive ? '#F97316' : 'rgba(255,255,255,0.05)', color: isActive ? 'white' : '#666', border: `1.5px solid ${isActive ? '#F97316' : 'rgba(255,255,255,0.08)'}` }}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {dateMode === 'specific' && (
                      <div>
                        <label className="block text-gray-500 mb-2 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>SELECT AVAILABLE DATES ({days.length} selected)</label>
                        <MiniDatePicker onSelect={handleDateSelect} selected={days} />
                        {days.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {days.slice(0, 5).map(d => (
                              <div key={d} className="flex items-center gap-1 bg-[#252525] rounded-lg px-2 py-1">
                                <span className="text-gray-300" style={{ fontSize: 10 }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <button type="button" onClick={() => handleDateSelect(d)} className="text-gray-600 hover:text-red-400 transition-colors">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            {days.length > 5 && <span className="text-gray-500 py-1" style={{ fontSize: 11 }}>+{days.length - 5} more</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </form>

              <div className="px-6 py-4 flex gap-3 border-t border-white/5 flex-shrink-0">
                <button type="button" onClick={() => setShowCoachModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors" style={{ fontSize: 13 }}>
                  Cancel
                </button>
                <button
                  onClick={handleSaveCoach}
                  className="flex-1 py-2.5 rounded-xl text-white font-black transition-colors"
                  style={{ fontSize: 13, background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
                  {editingCoach ? 'Save Changes' : 'Add Coach'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Application Confirm Dialog ── */}
      <AnimatePresence>
        {appConfirm && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1E1E1F] rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${appConfirm.action === 'approved' ? 'bg-green-500/15' : 'bg-red-500/15'}`}
                style={{ border: `1.5px solid ${appConfirm.action === 'approved' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {appConfirm.action === 'approved' ? <CheckCircle size={28} className="text-green-400" /> : <XCircle size={28} className="text-red-400" />}
              </div>
              <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>
                {appConfirm.action === 'approved' ? 'Approve Application?' : 'Decline Application?'}
              </h3>
              <p className="text-gray-400 text-center mb-2" style={{ fontSize: 13 }}>{appConfirm.app.userName}</p>
              <p className="text-gray-500 text-center mb-6" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {appConfirm.action === 'approved'
                  ? `A coach profile will be created for ${appConfirm.app.userName} under ${appConfirm.app.sport}. They will appear in the Coach Directory.`
                  : `${appConfirm.app.userName}'s application for ${appConfirm.app.sport} coaching will be declined.`}
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => setAppConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#2e2e2e] transition-colors border border-white/5"
                  style={{ fontSize: 13 }}>Cancel</button>
                <button onClick={() => {
                  if (appConfirm.action === 'approved') {
                    addCoach({ name: appConfirm.app.userName, email: appConfirm.app.userEmail, sport: appConfirm.app.sport, hourlyRate: appConfirm.app.requestedRate || 800, description: appConfirm.app.bio, availableDays: appConfirm.app.availability || [], timeRange: '08:00 AM - 06:00 PM', isAvailable: true });
                  }
                  const updated = applications.map(a => a.id === appConfirm.app.id ? { ...a, status: appConfirm.action } : a);
                  setApplications(updated);
                  localStorage.setItem('jrc_coach_applications', JSON.stringify(updated));
                  setAppConfirm(null);
                }}
                  className="flex-1 py-3 rounded-xl text-white font-black transition-all hover:brightness-110"
                  style={{ fontSize: 13, background: appConfirm.action === 'approved' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                  {appConfirm.action === 'approved' ? 'Yes, Approve' : 'Yes, Decline'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}