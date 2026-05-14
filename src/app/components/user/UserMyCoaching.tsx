import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight, Calendar, CheckCircle, Clock, GraduationCap, QrCode, Shield,
  Star, Users, X, XCircle, AlertCircle, MessageSquare, ClipboardCheck,
  MapPin, CreditCard, Search,
} from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import type { CoachingRequest } from "../../contexts/CoachingContext";
import { useCoaching } from "../../contexts/CoachingContext";
import { useUser } from "../../contexts/UserContext";
import { getSportColor, SportIcon } from "../SportIcons";
import { SectionLoader } from "../shared/LoadingScreen";

const BG = "#131314";
const SURF = "#1E1E1F";
const SURF2 = "#252525";
const BORDER = "rgba(255,255,255,0.08)";
const TP = "#F5F5F6";
const TS = "#9CA0AD";
const ORANGE = "#F97316";
const BLUE = "#2563EB";
const GREEN = "#22c55e";
const RED = "#ef4444";

function fmt12(t: string) {
  const raw = String(t || "09:00").trim();
  const match12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2] || "0", 10);
    const ap = match12[3].toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
  }
  const match24 = raw.match(/^(\d{1,2})(?::(\d{2}))?/);
  const h = match24 ? parseInt(match24[1], 10) : 9;
  const m = match24 ? parseInt(match24[2] || "0", 10) : 0;
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}

function dateLabel(date: string) {
  try {
    return format(new Date(date + "T00:00:00"), "EEE, MMM d, yyyy");
  } catch {
    return date || "Date pending";
  }
}

function isManualPaymentVerified(req: CoachingRequest) {
  return /PAYMENT_VERIFIED|Manual coaching payment verified/i.test(req.adminNotes || "");
}

function amountLabel(value?: number) {
  return `₱${Math.max(0, Number(value || 0)).toLocaleString()}`;
}

function StatusBadge({ status }: { status: CoachingRequest["status"] }) {
  const map = {
    pending: { label: "Awaiting coach", color: "#eab308", bg: "rgba(234,179,8,0.13)", icon: Clock },
    confirmed: { label: "Confirmed", color: GREEN, bg: "rgba(34,197,94,0.13)", icon: CheckCircle },
    rejected: { label: "Declined", color: RED, bg: "rgba(239,68,68,0.13)", icon: XCircle },
  } as const;
  const item = map[status] || map.pending;
  return (
    <span className="px-2.5 py-1 rounded-full font-black flex items-center gap-1.5" style={{ color: item.color, background: item.bg, fontSize: 11 }}>
      <item.icon size={11} />
      {item.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="rounded-2xl p-4 border" style={{ background: SURF, borderColor: BORDER }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black" style={{ color: TP, fontSize: 24 }}>{value}</p>
          <p style={{ color: TS, fontSize: 12 }}>{label}</p>
        </div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  req,
  mode,
  onTicket,
  onBookCourt,
  onDecision,
}: {
  req: CoachingRequest;
  mode: "student" | "coach";
  onTicket: (req: CoachingRequest) => void;
  onBookCourt: (req: CoachingRequest) => void;
  onDecision: (req: CoachingRequest, action: "confirmed" | "rejected") => void;
}) {
  const color = getSportColor(req.sport);
  const name = mode === "coach" ? req.userName : req.coachName;
  const subtitle = mode === "coach" ? `Requested ${req.sport} coaching` : req.sport;
  const paymentVerified = isManualPaymentVerified(req);
  const showCourtDetails = !!req.courtName || !!req.totalAmount || !!req.coachFee;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: SURF, borderColor: BORDER }}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${mode === "coach" ? BLUE : color}, transparent)` }} />
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            {mode === "coach" ? <Users size={21} color={BLUE} /> : <SportIcon sport={req.sport} size={22} color={color} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-white font-black truncate" style={{ fontSize: 16 }}>{name || "Coaching session"}</p>
                <p className="font-black" style={{ color: mode === "coach" ? BLUE : color, fontSize: 12 }}>{subtitle}</p>
              </div>
              <StatusBadge status={req.status} />
            </div>

            <div className="grid sm:grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                  <Calendar size={13} />
                  <span>{dateLabel(req.requestedDate)}</span>
                </div>
              </div>
              <div className="rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                  <Clock size={13} />
                  <span>{fmt12(req.requestedTime)}{req.endTime ? ` - ${fmt12(req.endTime)}` : ""}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-3" style={{ color: TS, fontSize: 12 }}>
                <span>{mode === "coach" ? "Coaching fee student will pay" : "Coaching fee"}</span>
                <span className="font-black text-white">{amountLabel(req.totalAmount || req.coachFee)}</span>
              </div>
            </div>

            {req.message && (
              <div className="mt-3 rounded-xl p-3 border flex gap-2" style={{ background: "rgba(255,255,255,0.035)", borderColor: BORDER }}>
                <MessageSquare size={14} color={TS} className="mt-0.5 flex-shrink-0" />
                <p style={{ color: TS, fontSize: 12, lineHeight: 1.55 }}>{req.message}</p>
              </div>
            )}

            <div className="mt-4">
              {mode === "coach" && req.status === "pending" && (
                <>
                <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.22)" }}>
                  <p className="font-black" style={{ color: "#93c5fd", fontSize: 12 }}>Reserve a court to accept</p>
                  <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>Choose an available {req.sport} court from the facility map. You pay the court fee reservation, and the student pays the coaching fee only.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => onBookCourt(req)}
                    className="flex-1 py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", fontSize: 13 }}>
                    <MapPin size={15} /> Reserve Court & Accept
                  </button>
                  <button onClick={() => onDecision(req, "rejected")}
                    className="sm:w-40 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "rgba(239,68,68,0.11)", border: "1px solid rgba(239,68,68,0.32)", color: RED, fontSize: 13 }}>
                    <XCircle size={15} /> Decline
                  </button>
                </div>
                </>
              )}

              {mode === "student" && req.status === "confirmed" && (
                <>
                <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
                  <p className="font-black" style={{ color: "#86efac", fontSize: 12 }}>{paymentVerified ? "Payment verified. You are cleared." : "Coach accepted. Payment is next."}</p>
                  <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                    {paymentVerified
                      ? "Front desk has verified your manual payment. Show the coaching ticket at check-in."
                      : "Your coach has secured the court. Pay only the coaching fee through JRC staff or the official GCash QR, then show the ticket at check-in."}
                  </p>
                </div>
                {showCourtDetails && (
                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                      <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                        <MapPin size={13} />
                        <span>{req.courtName || "Court reserved by coach"}</span>
                      </div>
                    </div>
                    <div className="rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                      <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                        <CreditCard size={13} />
                        <span>Coaching fee: {amountLabel(req.totalAmount || req.coachFee)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex">
                  <button onClick={() => onTicket(req)}
                    className="w-full py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", fontSize: 13 }}>
                    <QrCode size={15} /> View Coaching Ticket
                  </button>
                </div>
                </>
              )}

              {mode === "coach" && req.status === "confirmed" && (
                <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
                  <p className="font-black" style={{ color: "#86efac", fontSize: 12 }}>{paymentVerified ? "Accepted session - payment verified" : "Accepted session"}</p>
                  <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                    {paymentVerified
                      ? "Front desk has verified the student's manual payment, so this coaching session is cleared to proceed."
                      : `Court: ${req.courtName || "reserved"}. You handle the court reservation payment; the student pays the coaching fee only.`}
                  </p>
                </div>
              )}

              {req.status === "pending" && mode === "student" && (
                <div className="rounded-xl py-3 px-4 flex items-center gap-2" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.22)" }}>
                  <Clock size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 font-black" style={{ fontSize: 13 }}>Waiting for coach confirmation</span>
                </div>
              )}

              {req.status === "rejected" && (
                <div className="rounded-xl py-3 px-4 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}>
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-red-400 font-black" style={{ fontSize: 13 }}>This session was declined</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ isCoach, onBrowse }: { isCoach: boolean; onBrowse: () => void }) {
  return (
    <div className="rounded-3xl border p-10 text-center" style={{ background: SURF, borderColor: BORDER }}>
      <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${isCoach ? BLUE : ORANGE}15` }}>
        {isCoach ? <Users size={28} color={BLUE} /> : <Calendar size={28} color={ORANGE} />}
      </div>
      <p className="text-white font-black mb-1" style={{ fontSize: 17 }}>{isCoach ? "No coach inbox items yet" : "No coaching sessions yet"}</p>
      <p className="mb-6" style={{ color: TS, fontSize: 13 }}>
        {isCoach ? "New student requests will appear here with accept and decline controls." : "Book a session with a certified coach and track it here."}
      </p>
      {!isCoach && (
        <button onClick={onBrowse} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black" style={{ background: `linear-gradient(135deg,${ORANGE},#EA580C)`, fontSize: 13 }}>
          Browse Coaches <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function DecisionModal({
  req,
  action,
  onClose,
  onConfirm,
}: {
  req: CoachingRequest;
  action: "confirmed" | "rejected";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const accepting = action === "confirmed";
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 18 }}
        className="relative w-full max-w-md rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white"><X size={16} /></button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: accepting ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)" }}>
          {accepting ? <ClipboardCheck size={28} className="text-green-400" /> : <XCircle size={28} className="text-red-400" />}
        </div>
        <h3 className="text-white font-black mb-2" style={{ fontSize: 20 }}>{accepting ? "Accept this session?" : "Decline this session?"}</h3>
        <p style={{ color: TS, fontSize: 13, lineHeight: 1.6 }}>
          {accepting
            ? `This confirms ${req.userName}'s ${req.sport} coaching session on ${dateLabel(req.requestedDate)}.`
            : `This will notify ${req.userName} that you cannot take this ${req.sport} session.`}
        </p>
        <div className="mt-5 rounded-2xl p-4" style={{ background: SURF2 }}>
          <p className="text-white font-black" style={{ fontSize: 14 }}>{fmt12(req.requestedTime)}{req.endTime ? ` - ${fmt12(req.endTime)}` : ""}</p>
          <p style={{ color: TS, fontSize: 12 }}>{dateLabel(req.requestedDate)}</p>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-300" style={{ background: "rgba(255,255,255,0.07)", fontSize: 13 }}>Cancel</button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onClose();
            }}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-60"
            style={{ background: accepting ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#ef4444,#dc2626)", fontSize: 13 }}>
            {busy ? "Saving..." : accepting ? "Accept" : "Decline"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TicketModal({ req, onClose }: { req: CoachingRequest; onClose: () => void }) {
  const color = getSportColor(req.sport);
  const paymentVerified = isManualPaymentVerified(req);
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 18 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden border shadow-2xl" style={{ background: "#101011", borderColor: `${color}45` }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-black/35 flex items-center justify-center text-white/70 hover:text-white"><X size={16} /></button>
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${color}35, rgba(255,255,255,0.03))` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${color}24`, border: `1px solid ${color}45` }}>
            <SportIcon sport={req.sport} size={24} color={color} />
          </div>
          <p className="text-white font-black" style={{ fontSize: 22 }}>Coaching Ticket</p>
          <p style={{ color: "#cbd5e1", fontSize: 13 }}>{req.coachName} · {req.sport}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>DATE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{dateLabel(req.requestedDate)}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>TIME</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{fmt12(req.requestedTime)}</p>
            </div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: SURF }}>
            <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COURT</p>
            <p className="text-white font-black" style={{ fontSize: 12 }}>{req.courtName || "Reserved by coach"}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COACH FEE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.coachFee)}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COURT BY COACH</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.courtAmount)}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p style={{ color: "#86efac", fontSize: 10, fontWeight: 800 }}>STUDENT DUE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.totalAmount || req.coachFee)}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-4 flex flex-col items-center">
            <QRCodeSVG value={JSON.stringify({ type: "coaching", reqId: req.id, coach: req.coachName, date: req.requestedDate })} size={178} level="H" />
            <p className="mt-3 text-gray-500 font-black" style={{ fontSize: 10 }}>{paymentVerified ? "PAYMENT VERIFIED BY FRONT DESK" : "SHOW AFTER MANUAL PAYMENT"}</p>
            <p className="text-gray-900 font-black" style={{ fontSize: 14 }}>{req.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <p className="font-black text-green-300" style={{ fontSize: 12 }}>{paymentVerified ? "Payment verified" : "Payment instructions"}</p>
            <p style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>
              {paymentVerified
                ? "Front desk has marked this coaching session as manually paid. Show this ticket when you arrive."
                : "Pay the coaching fee at the front desk or use the official JRC GCash QR on site. Staff will verify before check-in."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function UserMyCoaching({ onNavigate }: { onNavigate: (tab: any, params?: any) => void }) {
  const { user } = useUser();
  const { requests, coaches, updateRequestStatus, findCoachByEmail, isLoading } = useCoaching();
  const [activeTab, setActiveTab] = useState<"student" | "coach">("student");
  const [ticketReq, setTicketReq] = useState<CoachingRequest | null>(null);
  const [decision, setDecision] = useState<{ req: CoachingRequest; action: "confirmed" | "rejected" } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CoachingRequest["status"]>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const coachDefaultTabApplied = useRef(false);

  const myCoachProfile = user?.email ? findCoachByEmail(user.email) : undefined;

  const studentSessions = useMemo(() => requests.filter((r) =>
    r.viewerIsStudent === true ||
    (r.viewerIsStudent === undefined && !!(user?.id && r.userId === user.id))
  ), [requests, user?.id]);

  const coachSessions = useMemo(() => requests.filter((r) => {
    if (r.viewerIsCoachForThisSession === true) return true;
    return !!myCoachProfile && String(r.coachId) === String(myCoachProfile.id);
  }), [requests, myCoachProfile]);

  const isCoach = !!(myCoachProfile || requests.some((r) => r.viewerIsCoachForThisSession === true));

  useEffect(() => { coachDefaultTabApplied.current = false; }, [user?.id]);
  useEffect(() => {
    if (isLoading || !isCoach || coachDefaultTabApplied.current) return;
    if (coachSessions.length > 0 && studentSessions.length === 0) {
      setActiveTab("coach");
      coachDefaultTabApplied.current = true;
    }
  }, [isLoading, isCoach, coachSessions.length, studentSessions.length]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: BG }}>
        <SectionLoader label="Loading coaching dashboard..." accentColor={ORANGE} />
      </div>
    );
  }

  const currentList = activeTab === "coach" ? coachSessions : studentSessions;
  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return currentList
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        return [r.userName, r.coachName, r.sport, r.requestedDate, r.requestedTime, r.message]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const av = new Date(`${a.requestedDate}T${a.requestedTime || "00:00"}`).getTime();
        const bv = new Date(`${b.requestedDate}T${b.requestedTime || "00:00"}`).getTime();
        return sortOrder === "newest" ? bv - av : av - bv;
      });
  }, [currentList, query, sortOrder, statusFilter]);
  const pendingCount = coachSessions.filter((r) => r.status === "pending").length;
  const confirmedCount = [...studentSessions, ...coachSessions].filter((r) => r.status === "confirmed").length;

  return (
    <div className="h-full overflow-y-auto pb-24 md:pb-8" style={{ background: BG }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="rounded-3xl border p-5 md:p-6" style={{ background: SURF, borderColor: BORDER }}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center" style={{ background: `${ORANGE}18`, border: `1px solid ${ORANGE}35` }}>
                <GraduationCap size={24} color={ORANGE} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-black" style={{ fontSize: 26 }}>My Coaching</h2>
                <p style={{ color: TS, fontSize: 13 }}>
                  {isCoach ? "Manage booked lessons, student requests, and coach actions in one workspace." : "Track coaching bookings and tickets from here."}
                </p>
              </div>
              <button onClick={() => onNavigate("coaches")} className="px-4 py-2.5 rounded-2xl text-white font-black flex items-center gap-2" style={{ background: `linear-gradient(135deg,${ORANGE},#EA580C)`, fontSize: 13 }}>
                Find Coaches <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="rounded-3xl border p-4 flex items-center min-h-[96px]" style={{ background: myCoachProfile ? `${BLUE}10` : SURF, borderColor: myCoachProfile ? `${BLUE}35` : BORDER }}>
            {myCoachProfile ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${BLUE}20` }}><Shield size={20} color={BLUE} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-black" style={{ color: BLUE, fontSize: 13 }}>Coach profile active</p>
                  <p className="truncate" style={{ color: TS, fontSize: 12 }}>{myCoachProfile.sport} · ₱{myCoachProfile.hourlyRate?.toLocaleString()}/hr</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${ORANGE}16` }}><Star size={20} color={ORANGE} /></div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 13 }}>Student view</p>
                  <p style={{ color: TS, fontSize: 12 }}>Book and manage your coaching sessions.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <StatCard label="My sessions" value={studentSessions.length} icon={Calendar} color={ORANGE} />
          <StatCard label="Confirmed" value={confirmedCount} icon={CheckCircle} color={GREEN} />
          <StatCard label={isCoach ? "Pending coach requests" : "Available coaches"} value={isCoach ? pendingCount : coaches.length} icon={Users} color={BLUE} />
        </div>

        {isCoach && (
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
            {([
              { id: "student", label: "My Sessions", count: studentSessions.length, icon: Star, color: ORANGE },
              { id: "coach", label: "Coach Inbox", count: pendingCount, icon: Shield, color: BLUE },
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all"
                  style={{ background: active ? tab.color : "transparent", color: active ? "white" : TS, fontSize: 13 }}>
                  <tab.icon size={14} />
                  {tab.label}
                  {tab.count > 0 && <span className="px-1.5 py-0.5 rounded-full" style={{ background: active ? "rgba(255,255,255,0.25)" : `${tab.color}24`, fontSize: 10 }}>{tab.count}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black" style={{ fontSize: 17 }}>{activeTab === "coach" ? "Coach Inbox" : "My Sessions"}</h3>
              <p style={{ color: TS, fontSize: 12 }}>{visibleList.length} item{visibleList.length === 1 ? "" : "s"}</p>
            </div>
            <div className="grid md:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
              <label className="rounded-xl border flex items-center gap-2 px-3 py-2" style={{ background: SURF2, borderColor: BORDER }}>
                <Search size={14} color={TS} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeTab === "coach" ? "Search student, sport, note..." : "Search coach, sport, date..."}
                  className="bg-transparent outline-none text-white flex-1 min-w-0"
                  style={{ fontSize: 12 }}
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="rounded-xl px-3 py-2 text-white font-black outline-none"
                style={{ background: SURF2, border: `1px solid ${BORDER}`, fontSize: 12 }}
              >
                <option value="all">All status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Declined</option>
              </select>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}
                className="rounded-xl px-3 py-2 text-white font-black outline-none"
                style={{ background: SURF2, border: `1px solid ${BORDER}`, fontSize: 12 }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            {currentList.length === 0 ? (
              <EmptyState isCoach={activeTab === "coach"} onBrowse={() => onNavigate("coaches")} />
            ) : visibleList.length === 0 ? (
              <div className="rounded-3xl border p-8 text-center" style={{ background: SURF, borderColor: BORDER }}>
                <p className="text-white font-black" style={{ fontSize: 15 }}>No matching coaching items</p>
                <p style={{ color: TS, fontSize: 12 }}>Try a different search, status, or sort option.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleList.map((req) => {
                  const coachForReq = coaches.find((coach) => String(coach.id) === String(req.coachId));
                  const computedCoachFee = Math.max(0, Number(req.coachFee ?? (coachForReq?.hourlyRate || myCoachProfile?.hourlyRate || 0) * (req.durationHours || 1)));
                  const enrichedReq = {
                    ...req,
                    coachFee: computedCoachFee,
                    totalAmount: req.totalAmount ?? computedCoachFee,
                  };
                  return (
                    <SessionCard
                      key={req.id}
                      req={enrichedReq}
                      mode={activeTab === "coach" ? "coach" : "student"}
                      onTicket={setTicketReq}
                      onBookCourt={(r) => onNavigate("book_court", {
                        sport: r.sport,
                        date: r.requestedDate,
                        time: r.requestedTime,
                        coachingSessionId: r.id,
                        coachingStudentName: r.userName,
                        coachingStudentId: r.userId,
                        coachName: r.coachName,
                        coachHourlyRate: coachForReq?.hourlyRate || myCoachProfile?.hourlyRate || (computedCoachFee / Math.max(1, r.durationHours || 1)),
                        durationHours: r.durationHours || 1,
                      })}
                      onDecision={(r, action) => setDecision({ req: r, action })}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <aside className="rounded-2xl border p-4 space-y-3 xl:sticky xl:top-4" style={{ background: SURF, borderColor: BORDER }}>
            <div>
              <p className="text-white font-black" style={{ fontSize: 15 }}>Session Guide</p>
              <p style={{ color: TS, fontSize: 12, lineHeight: 1.55 }}>Coaching is request-first. The coach reserves and pays for the court while accepting. The student pays only the coaching fee through JRC staff or the official GCash QR.</p>
            </div>
            <div className="space-y-2">
              {[
                ["Pending", "Waiting for coach action", "#eab308"],
                ["Confirmed", "Court reserved and coaching fee ticket available", GREEN],
                ["Declined", "Session will not proceed", RED],
              ].map(([label, desc, color]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: SURF2 }}>
                  <p className="font-black" style={{ color, fontSize: 12 }}>{label}</p>
                  <p style={{ color: TS, fontSize: 11 }}>{desc}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {ticketReq && <TicketModal req={ticketReq} onClose={() => setTicketReq(null)} />}
        {decision && (
          <DecisionModal
            req={decision.req}
            action={decision.action}
            onClose={() => setDecision(null)}
            onConfirm={() => updateRequestStatus(decision.req.id, decision.action)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
