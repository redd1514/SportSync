import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock, Calendar, CheckCircle, XCircle, ArrowRight,
  Users, GraduationCap, Star, Shield, ChevronRight, QrCode, X, AlertCircle
} from "lucide-react";
import type { CoachingRequest } from "../../contexts/CoachingContext";
import { useCoaching } from "../../contexts/CoachingContext";
import { useUser } from "../../contexts/UserContext";
import { apiFetch } from "../../utils/authenticatedFetch";
import { getSportColor, SportIcon } from "../SportIcons";
import { format } from "date-fns";
import { SectionLoader } from "../shared/LoadingScreen";
import { QRCodeSVG } from "qrcode.react";

const SURF  = "#1E1E1F";
const SURF2 = "#252525";
const BORDER = "rgba(255,255,255,0.06)";
const TP    = "#E8E8EA";
const TS    = "#9294A0";
const ORANGE = "#F97316";
const BLUE   = "#2563EB";
const GREEN  = "#22c55e";
const RED    = "#ef4444";

function fmt12(t: string) {
  const parts = t.replace(/:\d\d$/, "").split(":").map(Number);
  const h = parts[0] ?? 9, m = parts[1] ?? 0;
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}

function StatusBadge({ status }: { status: CoachingRequest["status"] }) {
  const MAP = {
    pending:   { label: "Awaiting Coach", color: "#eab308", bg: "rgba(234,179,8,0.12)" },
    confirmed: { label: "Confirmed",      color: GREEN,     bg: "rgba(34,197,94,0.12)"  },
    rejected:  { label: "Declined",       color: RED,       bg: "rgba(239,68,68,0.12)"  },
  } as const;
  const { label, color, bg } = MAP[status] || MAP.pending;
  return (
    <span className="px-2.5 py-1 rounded-full font-black flex-shrink-0 flex items-center gap-1.5"
      style={{ fontSize: 11, color, background: bg }}>
      {status === "pending"   && <Clock size={10} />}
      {status === "confirmed" && <CheckCircle size={10} />}
      {status === "rejected"  && <XCircle size={10} />}
      {label}
    </span>
  );
}

/* ── Client session card ── */
function ClientSessionCard({
  req, onViewTicket, onBookCourt,
}: { req: CoachingRequest; onViewTicket: (r: CoachingRequest) => void; onBookCourt: (r: CoachingRequest) => void }) {
  const color = getSportColor(req.sport);
  const dateStr = (() => {
    try { return format(new Date(req.requestedDate + "T00:00:00"), "MMM d, yyyy"); }
    catch { return req.requestedDate; }
  })();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: BORDER }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg,${color},${color}60)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1.5px solid ${color}30` }}>
              <SportIcon sport={req.sport} size={22} color={color} />
            </div>
            <div>
              <p className="text-white font-black" style={{ fontSize: 15 }}>{req.coachName}</p>
              <p className="font-black" style={{ fontSize: 12, color }}>{req.sport}</p>
            </div>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: SURF2, border: `1px solid ${BORDER}` }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5" style={{ color: TS, fontSize: 12 }}>
              <Calendar size={11} /><span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: TS, fontSize: 12 }}>
              <Clock size={11} />
              <span>{fmt12(req.requestedTime)}{req.endTime ? ` – ${fmt12(req.endTime)}` : ""}</span>
            </div>
          </div>
          {req.durationHours != null && (
            <p className="font-black" style={{ fontSize: 11, color: TS }}>{req.durationHours}h session</p>
          )}
          {req.message && (
            <div className="pt-2 border-t" style={{ borderColor: BORDER }}>
              <p className="italic" style={{ color: TS, fontSize: 12 }}>"{req.message}"</p>
            </div>
          )}
        </div>

        {req.status === "pending" && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
            <Clock size={14} className="text-yellow-400" />
            <span className="text-yellow-400 font-black" style={{ fontSize: 13 }}>Waiting for coach to accept</span>
          </div>
        )}
        {req.status === "confirmed" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl mb-1"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-green-400 font-black" style={{ fontSize: 13 }}>Session confirmed — see you there!</span>
            </div>
            {req.adminNotes && (
              <p className="text-center italic" style={{ color: TS, fontSize: 12 }}>{req.adminNotes}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => onViewTicket(req)}
                className="flex-1 py-2.5 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", fontSize: 13 }}>
                <QrCode size={14} /> Ticket
              </button>
              <button onClick={() => onBookCourt(req)}
                className="flex-1 py-2.5 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)", fontSize: 13 }}>
                <Calendar size={14} /> Book Court
              </button>
            </div>
          </div>
        )}
        {req.status === "rejected" && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle size={14} className="text-red-400" />
            <span className="text-red-400 font-black" style={{ fontSize: 13 }}>Session was declined by the coach</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Coach incoming request card ── */
function CoachRequestCard({
  req, onAccept, onDecline,
}: { req: CoachingRequest; onAccept: (id: string) => Promise<void>; onDecline: (id: string) => Promise<void> }) {
  const color = getSportColor(req.sport);
  const [busy, setBusy] = useState(false);
  const dateStr = (() => {
    try { return format(new Date(req.requestedDate + "T00:00:00"), "MMM d, yyyy"); }
    catch { return req.requestedDate; }
  })();

  const handle = async (fn: (id: string) => Promise<void>) => {
    setBusy(true);
    try { await fn(req.id); } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ background: SURF, borderColor: BORDER }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg,${BLUE},${BLUE}60)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(37,99,235,0.12)", border: "1.5px solid rgba(37,99,235,0.25)" }}>
              <Users size={20} color={BLUE} />
            </div>
            <div>
              <p className="text-white font-black" style={{ fontSize: 15 }}>{req.userName}</p>
              <p className="font-black" style={{ fontSize: 12, color }}>Wants {req.sport} coaching</p>
            </div>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: SURF2, border: `1px solid ${BORDER}` }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5" style={{ color: TS, fontSize: 12 }}>
              <Calendar size={11} /><span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: TS, fontSize: 12 }}>
              <Clock size={11} />
              <span>{fmt12(req.requestedTime)}{req.endTime ? ` – ${fmt12(req.endTime)}` : ""}</span>
            </div>
          </div>
          {req.durationHours != null && (
            <p className="font-black" style={{ fontSize: 11, color: TS }}>{req.durationHours}h session</p>
          )}
          {req.message && (
            <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: BORDER }}>
              <p className="italic" style={{ color: TS, fontSize: 12 }}>"{req.message}"</p>
            </div>
          )}
        </div>

        {req.status === "pending" && (
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              disabled={busy} onClick={() => handle(onAccept)}
              className="flex-1 py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ fontSize: 13, background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 4px 16px rgba(34,197,94,0.25)" }}>
              <CheckCircle size={15} /> Accept
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              disabled={busy} onClick={() => handle(onDecline)}
              className="py-3 px-5 rounded-xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ fontSize: 13, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: RED }}>
              <XCircle size={15} /> Decline
            </motion.button>
          </div>
        )}
        {req.status === "confirmed" && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-green-400 font-black" style={{ fontSize: 13 }}>You accepted — session is on!</span>
          </div>
        )}
        {req.status === "rejected" && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle size={14} className="text-red-400" />
            <span className="text-red-400 font-black" style={{ fontSize: 13 }}>You declined this session</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── QR Ticket Modal ── */
function QRModal({ req, onClose }: { req: CoachingRequest; onClose: () => void }) {
  const dateStr = (() => {
    try { return format(new Date(req.requestedDate + "T00:00:00"), "MMMM d, yyyy"); }
    catch { return req.requestedDate; }
  })();
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-2xl">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
          <X size={16} />
        </button>
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={24} className="text-green-500" />
        </div>
        <div>
          <p className="text-gray-900 font-black" style={{ fontSize: 20 }}>Coaching Ticket</p>
          <p className="text-gray-500" style={{ fontSize: 13 }}>{req.coachName} · {req.sport}</p>
          <p className="text-gray-500" style={{ fontSize: 13 }}>{dateStr} · {fmt12(req.requestedTime)}</p>
          {req.durationHours != null && (
            <p className="text-gray-400 font-black" style={{ fontSize: 12 }}>{req.durationHours}h session</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 w-full flex flex-col items-center gap-3">
          <p className="text-gray-400 font-black" style={{ fontSize: 10, letterSpacing: 1.5 }}>SCAN FOR ENTRY</p>
          <QRCodeSVG
            value={JSON.stringify({ type: "coaching", reqId: req.id, coach: req.coachName, date: req.requestedDate })}
            size={180} level="H" includeMargin={false} />
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-gray-200 shadow-sm mt-2">
            <QrCode size={13} className="text-gray-500" />
            <span className="text-gray-800 font-black" style={{ fontSize: 14, letterSpacing: 1 }}>
              {req.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main Component ── */
export function UserMyCoaching({ onNavigate }: { onNavigate: (tab: any, params?: any) => void }) {
  const { user } = useUser();
  const { requests, coaches, updateRequestStatus, isLoading } = useCoaching();
  const [selectedTicketReq, setSelectedTicketReq] = useState<CoachingRequest | null>(null);
  const [activeTab, setActiveTab] = useState<"client" | "coach">("client");
  const coachDefaultTabApplied = useRef(false);

  // Find if logged-in user is a coach
  const myCoachProfile = user?.email ? coaches.find(c => c.email?.toLowerCase() === user.email?.toLowerCase()) : undefined;

  // My sessions as a student (user booked a coach)
  const clientSessions = requests.filter(r =>
    r.viewerIsStudent === true ||
    (r.viewerIsStudent === undefined && !!(user?.id && r.userId === user.id))
  );

  // My sessions as a coach (people who booked me)
  const coachSessions = requests.filter(r => {
    if (r.viewerIsCoachForThisSession === true) return true;
    return !!myCoachProfile && String(r.coachId) === String(myCoachProfile.id);
  });

  const isCoach = !!(myCoachProfile || requests.some(r => r.viewerIsCoachForThisSession === true));

  // Auto-switch to coach tab if only have coach sessions
  useEffect(() => { coachDefaultTabApplied.current = false; }, [user?.id]);
  useEffect(() => {
    if (isLoading) return;
    if (!isCoach || coachDefaultTabApplied.current) return;
    if (coachSessions.length > 0 && clientSessions.length === 0) {
      setActiveTab("coach");
      coachDefaultTabApplied.current = true;
    }
  }, [isLoading, isCoach, coachSessions.length, clientSessions.length]);

  const handleAccept = async (sessionId: string) => {
    await updateRequestStatus(sessionId, "confirmed");
  };

  const handleDecline = async (sessionId: string) => {
    await updateRequestStatus(sessionId, "rejected");
  };

  const handleCancelSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/coaching-sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      await updateRequestStatus(sessionId, "rejected");
    } catch (e) {
      console.error("Cancel failed:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#131314]">
        <SectionLoader label="Loading coaching dashboard…" accentColor={ORANGE} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24 md:pb-6" style={{ background: "#131314" }}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `${ORANGE}18`, border: `1px solid ${ORANGE}30` }}>
              <GraduationCap size={20} color={ORANGE} />
            </div>
            <div>
              <h2 className="text-white font-black" style={{ fontSize: 22 }}>My Coaching</h2>
              <p style={{ color: TS, fontSize: 13 }}>
                {isCoach ? "Manage your sessions — as student and coach" : "Track your coaching sessions"}
              </p>
            </div>
          </div>

          {/* Coach badge */}
          {isCoach && myCoachProfile && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}25` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${BLUE}20` }}>
                <Shield size={18} color={BLUE} />
              </div>
              <div>
                <p className="font-black" style={{ color: BLUE, fontSize: 13 }}>
                  Accepted Coach — {myCoachProfile.sport}
                </p>
                <p style={{ color: TS, fontSize: 12 }}>
                  ₱{myCoachProfile.hourlyRate?.toLocaleString()}/hr · {myCoachProfile.timeRange || "Flexible hours"}
                </p>
              </div>
              <div className="ml-auto px-2.5 py-1 rounded-full font-black"
                style={{ fontSize: 10, background: "rgba(34,197,94,0.15)", color: GREEN }}>
                ACTIVE
              </div>
            </motion.div>
          )}
        </div>

        {/* Tab switcher — only if user is also a coach */}
        {isCoach && (
          <div className="flex gap-1 p-1 rounded-2xl mb-5"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
            {([
              { id: "client", label: "My Sessions", icon: Star, count: clientSessions.length },
              { id: "coach",  label: "Coach Inbox", icon: Shield,
                count: coachSessions.filter(r => r.status === "pending").length },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black transition-all"
                style={{
                  fontSize: 13,
                  background: activeTab === t.id ? (t.id === "coach" ? BLUE : ORANGE) : "transparent",
                  color: activeTab === t.id ? "white" : TS,
                }}>
                <t.icon size={14} />
                {t.label}
                {t.count > 0 && (
                  <span className="w-4 h-4 rounded-full text-white flex items-center justify-center"
                    style={{ fontSize: 9, background: activeTab === t.id ? "rgba(255,255,255,0.3)" : (t.id === "coach" ? BLUE : ORANGE) }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── COACH INBOX TAB ── */}
          {isCoach && activeTab === "coach" && (
            <motion.div key="coach" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Pending",   value: coachSessions.filter(r => r.status === "pending").length,   color: "#eab308" },
                  { label: "Confirmed", value: coachSessions.filter(r => r.status === "confirmed").length, color: GREEN },
                  { label: "Total",     value: coachSessions.length,                                        color: BLUE },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-4 text-center"
                    style={{ background: SURF, border: `1px solid ${BORDER}` }}>
                    <p className="font-black" style={{ fontSize: 24, color: stat.color }}>{stat.value}</p>
                    <p style={{ color: TS, fontSize: 11, fontWeight: 700 }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {coachSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}25` }}>
                    <Users size={28} color={BLUE} />
                  </div>
                  <p className="font-black text-white mb-1" style={{ fontSize: 16 }}>No requests yet</p>
                  <p style={{ color: TS, fontSize: 13 }}>Students who book you will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachSessions.map(req => (
                    <CoachRequestCard key={req.id} req={req}
                      onAccept={handleAccept} onDecline={handleDecline} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── MY SESSIONS TAB (client view) ── */}
          {(!isCoach || activeTab === "client") && (
            <motion.div key="client" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              {clientSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${ORANGE}12`, border: `1px solid ${ORANGE}25` }}>
                    <Calendar size={28} color={ORANGE} />
                  </div>
                  <p className="font-black text-white mb-1" style={{ fontSize: 16 }}>No coaching sessions yet</p>
                  <p className="mb-6" style={{ color: TS, fontSize: 13 }}>Book a session with one of our certified coaches</p>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => onNavigate("coaches")}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black"
                    style={{ fontSize: 14, background: `linear-gradient(135deg,${ORANGE},#EA580C)`, boxShadow: `0 6px 20px ${ORANGE}35` }}>
                    Browse Coaches <ArrowRight size={16} />
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <button onClick={() => onNavigate("coaches")}
                      className="flex items-center gap-1.5 font-black transition-all hover:opacity-80"
                      style={{ fontSize: 13, color: ORANGE }}>
                      Find More Coaches <ChevronRight size={14} />
                    </button>
                  </div>
                  {clientSessions.map(req => (
                    <ClientSessionCard key={req.id} req={req}
                      onViewTicket={r => setSelectedTicketReq(r)}
                      onBookCourt={r => onNavigate("book_court", { sport: r.sport, date: r.requestedDate, time: r.requestedTime })} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QR Ticket Modal */}
      <AnimatePresence>
        {selectedTicketReq && (
          <QRModal req={selectedTicketReq} onClose={() => setSelectedTicketReq(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
