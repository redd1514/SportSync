import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight, Calendar, CheckCircle, Clock, GraduationCap, QrCode, Shield,
  Star, Users, X, XCircle, AlertCircle, MessageSquare, ClipboardCheck,
  MapPin, Search, ChevronDown, Download, RefreshCw,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { downloadTicketQrPng } from "../../../shared/qrDownload";
import type { CoachingRequest } from "../../contexts/CoachingContext";
import { useCoaching } from "../../contexts/CoachingContext";
import { useUser } from "../../contexts/UserContext";
import { useBookingAPI } from "../../hooks/useBookingAPI";
import { apiFetch } from "../../utils/authenticatedFetch";
import { getSportColor, SportIcon } from "../SportIcons";
import { BookingTicketModal } from "../shared/BookingTicketModal";
import { CustomDateTimePicker } from "../shared/CustomDateTimePicker";

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
const FACILITY_OPEN_HOUR = 7;
const FACILITY_CLOSE_HOUR = 23;

type CoachingDisplayStatus = CoachingRequest["status"] | "ongoing";

function fmt12(t?: string) {
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
  return /PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(req.adminNotes || "");
}

function isCheckedOut(req: CoachingRequest) {
  return req.status === "completed" || /COACHING_CHECKED_OUT|checked_out:/i.test(req.adminNotes || "");
}

function displayStatusFor(req: CoachingRequest): CoachingDisplayStatus {
  if (isCheckedOut(req)) return "completed";
  if (isManualPaymentVerified(req)) return "ongoing";
  if (req.status === "reschedule_requested" && req.rescheduleProposal?.status && req.rescheduleProposal.status !== "pending") return "confirmed";
  if (req.status === "pending" && Number(req.downpaymentAmount || 0) > 0) return "confirmed";
  return req.status;
}

function isClearedCoachingStatus(req: CoachingRequest) {
  const status = displayStatusFor(req);
  return status === "completed" || status === "rejected";
}

function addHoursToTime(time: string, hours: number): string {
  const [h = "0", m = "0"] = String(time || "09:00").slice(0, 5).split(":");
  const total = Number(h) * 60 + Number(m) + Math.round(Math.max(1, hours || 1) * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function durationFromTimes(start?: string, end?: string) {
  const parse = (value?: string) => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin == null || endMin == null || endMin <= startMin) return undefined;
  return (endMin - startMin) / 60;
}

function amountLabel(value?: number) {
  return `₱${Math.max(0, Number(value || 0)).toLocaleString()}`;
}

function coachingTicketCode(req: CoachingRequest) {
  return `COACH-${req.id.slice(0, 8).toUpperCase()}`;
}

function CompactMenu<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value) || options[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="rounded-xl px-3 py-2 text-white font-black outline-none flex items-center justify-between gap-2 min-w-[130px]"
        style={{ background: SURF2, border: `1px solid ${BORDER}`, fontSize: 12 }}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={13} color="#a855f7" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="absolute left-0 top-full z-40 mt-2 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#151515] shadow-2xl"
          >
            {options.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left font-black hover:bg-white/8"
                style={{ fontSize: 12, color: item.value === value ? "#c084fc" : "#f5f5f5", background: item.value === value ? "rgba(168,85,247,0.16)" : "transparent" }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: CoachingDisplayStatus }) {
  const map = {
    pending: { label: "Processing", color: "#eab308", bg: "rgba(234,179,8,0.13)", icon: Clock },
    confirmed: { label: "Confirmed", color: GREEN, bg: "rgba(34,197,94,0.13)", icon: CheckCircle },
    ongoing: { label: "Ongoing", color: "#60a5fa", bg: "rgba(96,165,250,0.13)", icon: ClipboardCheck },
    reschedule_requested: { label: "Reschedule requested", color: "#38bdf8", bg: "rgba(56,189,248,0.13)", icon: RefreshCw },
    rejected: { label: "Declined", color: RED, bg: "rgba(239,68,68,0.13)", icon: XCircle },
    completed: { label: "Completed", color: BLUE, bg: "rgba(37,99,235,0.13)", icon: ClipboardCheck },
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

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse" style={{ background: SURF, borderColor: BORDER }}>
      <div className="h-1 bg-white/10" />
      <div className="p-3 md:p-4">
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-36 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/5" />
              </div>
              <div className="h-6 w-24 rounded-full bg-white/8" />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="h-10 rounded-lg bg-white/[0.06]" />
              <div className="h-10 rounded-lg bg-white/[0.06]" />
            </div>
            <div className="h-10 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  req,
  mode,
  onTicket,
  onDecision,
  onReview,
  onReviewDetails,
  onRescheduleResponse,
}: {
  req: CoachingRequest;
  mode: "student" | "coach";
  onTicket: (req: CoachingRequest) => void;
  onDecision: (req: CoachingRequest, action: "reschedule_requested") => void;
  onReview: (req: CoachingRequest) => void;
  onReviewDetails: (req: CoachingRequest) => void;
  onRescheduleResponse: (req: CoachingRequest, action: "accepted" | "rejected") => void;
}) {
  const color = getSportColor(req.sport);
  const name = mode === "coach" ? req.userName : req.coachName;
  const subtitle = mode === "coach" ? `Requested ${req.sport} coaching` : req.sport;
  const showCourtDetails = !!req.courtName || !!req.totalAmount || !!req.coachFee;
  const displayStatus = displayStatusFor(req);
  const showPaymentBreakdownOnly = mode === "student" && (req.downpaymentAmount != null || req.balanceDue != null);
  const balanceSettled = displayStatus === "ongoing" || displayStatus === "completed";
  const balanceDue =
    req.balanceDue != null
      ? req.balanceDue
      : req.downpaymentAmount != null
        ? Math.max(0, Number(req.totalAmount || req.coachFee || 0) - Number(req.downpaymentAmount || 0))
        : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{ background: SURF, borderColor: BORDER }}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${mode === "coach" ? BLUE : color}, transparent)` }} />
      <div className="p-3 md:p-4">
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            {mode === "coach" ? <Users size={18} color={BLUE} /> : <SportIcon sport={req.sport} size={19} color={color} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-white font-black truncate" style={{ fontSize: 14 }}>{name || "Coaching session"}</p>
                <p className="font-black" style={{ color: mode === "coach" ? BLUE : color, fontSize: 11 }}>{subtitle}</p>
              </div>
              <StatusBadge status={displayStatus} />
            </div>

            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg p-2.5 border" style={{ background: SURF2, borderColor: BORDER }}>
                <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                  <Calendar size={13} />
                  <span>{dateLabel(req.requestedDate)}</span>
                </div>
              </div>
              <div className="rounded-lg p-2.5 border" style={{ background: SURF2, borderColor: BORDER }}>
                <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                  <Clock size={13} />
                  <span>{fmt12(req.requestedTime ?? "")}{req.endTime ? ` - ${fmt12(req.endTime ?? "")}` : ""}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-lg p-2.5 border" style={{ background: SURF2, borderColor: BORDER }}>
              {!showPaymentBreakdownOnly && (
                <div className="grid grid-cols-[minmax(0,170px)_auto] justify-start gap-x-4" style={{ color: TS, fontSize: 12 }}>
                  <span>{mode === "coach" ? "Total student will pay" : "Total amount"}</span>
                  <span className="font-black text-white">{amountLabel(req.totalAmount || req.coachFee)}</span>
                </div>
              )}
              {req.downpaymentAmount != null && (
                <div className={`grid grid-cols-[minmax(0,170px)_auto] justify-start gap-x-4 ${showPaymentBreakdownOnly ? "" : "mt-1"}`} style={{ color: TS, fontSize: 12 }}>
                  <span>Downpayment paid</span>
                  <span className="font-black text-green-300">{amountLabel(req.downpaymentAmount)}</span>
                </div>
              )}
              {balanceDue != null && (
                <div className="grid grid-cols-[minmax(0,170px)_auto] justify-start gap-x-4 mt-1" style={{ color: TS, fontSize: 12 }}>
                  <span>{balanceSettled ? "Balance paid at front desk" : "Balance due at front desk"}</span>
                  <span className={`font-black ${balanceSettled ? "text-green-300" : "text-orange-300"}`}>{balanceSettled ? "Paid" : amountLabel(balanceDue)}</span>
                </div>
              )}
            </div>

            {req.message && (
              <div className="mt-2 rounded-lg p-2.5 border flex gap-2" style={{ background: "rgba(255,255,255,0.035)", borderColor: BORDER }}>
                <MessageSquare size={14} color={TS} className="mt-0.5 flex-shrink-0" />
                <p style={{ color: TS, fontSize: 12, lineHeight: 1.55 }}>{req.message}</p>
              </div>
            )}

            {req.pendingLinkedBookingChange && (
              <div className="mt-2 rounded-lg p-2.5 border flex gap-2" style={{ background: "rgba(56,189,248,0.08)", borderColor: "rgba(56,189,248,0.24)" }}>
                <RefreshCw size={14} color="#7dd3fc" className="mt-0.5 flex-shrink-0" />
                <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
                  {req.pendingLinkedBookingChange.type === "reschedule"
                    ? `A reschedule request is pending front desk approval${req.pendingLinkedBookingChange.requestedDate ? ` for ${dateLabel(req.pendingLinkedBookingChange.requestedDate)}` : ""}${req.pendingLinkedBookingChange.requestedStartTime ? ` at ${fmt12(req.pendingLinkedBookingChange.requestedStartTime)}` : ""}.`
                    : "A cancellation request is pending front desk approval. The coaching ticket will update once staff processes it."}
                </p>
              </div>
            )}

            <div className="mt-3">
              {mode === "coach" && (displayStatus === "confirmed" || displayStatus === "reschedule_requested") && (
                <>
                {req.courtName && (
                  <div className="rounded-xl p-3 mb-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                    <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                      <MapPin size={13} />
                      <span>{req.courtName}</span>
                    </div>
                  </div>
                )}
                {displayStatus === "reschedule_requested" && req.rescheduleProposal?.status === "pending" ? (
                  <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.22)" }}>
                    <p className="font-black" style={{ color: "#7dd3fc", fontSize: 12 }}>Reschedule requested</p>
                    <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                      The student has been notified. The schedule changes only if they accept the proposed date and time.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
                    <p className="font-black" style={{ color: "#86efac", fontSize: 12 }}>Coaching request confirmed</p>
                    <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                      {req.userName || "The student"} has an active paid coaching ticket. Request a reschedule only if you need to propose a different slot.
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => onDecision(req, "reschedule_requested")}
                    disabled={displayStatus === "reschedule_requested"}
                    className="flex-1 py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#38bdf8,#2563eb)", fontSize: 13 }}>
                    <RefreshCw size={15} /> {displayStatus === "reschedule_requested" ? "Reschedule Requested" : "Request Reschedule"}
                  </button>
                </div>
                </>
              )}

              {mode === "student" && (displayStatus === "confirmed" || displayStatus === "ongoing" || displayStatus === "reschedule_requested" || displayStatus === "completed") && (
                <>
                {showCourtDetails && (
                  <div className="grid gap-2 mb-3">
                    <div className="rounded-xl p-3 border" style={{ background: SURF2, borderColor: BORDER }}>
                      <div className="flex items-center gap-2" style={{ color: TS, fontSize: 12 }}>
                        <MapPin size={13} />
                        <span>{req.courtName || "Reserved court"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {req.rescheduleProposal?.status === "pending" ? (
                  <div className="rounded-xl p-3 mb-3 border" style={{ background: "rgba(56,189,248,0.08)", borderColor: "rgba(56,189,248,0.24)" }}>
                    <p className="font-black" style={{ color: "#7dd3fc", fontSize: 12 }}>Coach requested a new schedule</p>
                    <p className="mt-1" style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                      Proposed: {dateLabel(req.rescheduleProposal.requestedDate)} at {fmt12(req.rescheduleProposal.requestedTime)}
                      {req.rescheduleProposal.reason ? ` · ${req.rescheduleProposal.reason}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onRescheduleResponse(req, "accepted")}
                        className="flex-1 py-2.5 rounded-xl text-white font-black"
                        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", fontSize: 12 }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onRescheduleResponse(req, "rejected")}
                        className="flex-1 py-2.5 rounded-xl font-black border"
                        style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.28)", color: "#fca5a5", fontSize: 12 }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 mb-3" style={{ background: displayStatus === "reschedule_requested" ? "rgba(56,189,248,0.08)" : displayStatus === "completed" ? "rgba(37,99,235,0.08)" : "rgba(34,197,94,0.08)", border: displayStatus === "reschedule_requested" ? "1px solid rgba(56,189,248,0.22)" : displayStatus === "completed" ? "1px solid rgba(37,99,235,0.22)" : "1px solid rgba(34,197,94,0.22)" }}>
                    <p className="font-black" style={{ color: displayStatus === "reschedule_requested" ? "#7dd3fc" : displayStatus === "completed" ? "#93c5fd" : "#86efac", fontSize: 12 }}>{displayStatus === "completed" ? "Completed" : displayStatus === "reschedule_requested" ? "Reschedule requested" : displayStatus === "ongoing" ? "Ongoing" : "Booking confirmed"}</p>
                    <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                      {displayStatus === "completed"
                        ? "The session has been finished."
                        : displayStatus === "reschedule_requested"
                        ? "A schedule change is waiting for review."
                        : displayStatus === "ongoing"
                        ? "Front desk has checked in this coaching session."
                        : `Present this ticket at the front desk and settle the remaining balance of ${amountLabel(balanceDue ?? req.totalAmount ?? req.coachFee)} to start.`}
                    </p>
                  </div>
                )}
                <div className="flex">
                  <button onClick={() => onTicket(req)}
                    className="w-full py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", fontSize: 13 }}>
                    <QrCode size={15} /> View Coaching Ticket
                  </button>
                </div>
                {displayStatus === "completed" && !req.rating && (
                  <button onClick={() => onReview(req)}
                    className="w-full py-3 mt-3 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)", fontSize: 13 }}>
                    <Star size={15} /> Rate Coach
                  </button>
                )}
                {displayStatus === "completed" && req.rating && (
                  <button
                    type="button"
                    onClick={() => onReviewDetails(req)}
                    className="w-full mt-3 rounded-xl border px-3 py-2.5 text-left hover:bg-yellow-400/15 transition-all"
                    style={{ color: "#fde68a", borderColor: "rgba(251,191,36,0.28)", background: "rgba(251,191,36,0.09)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={13} fill={n <= (req.rating || 0) ? "#fbbf24" : "transparent"} color="#fbbf24" />
                      ))}
                      <span className="ml-1 font-black" style={{ fontSize: 12 }}>{req.rating}/5</span>
                    </div>
                    {req.reviewComment && (
                      <p className="mt-1 truncate" style={{ color: "#d6d3d1", fontSize: 11 }}>{req.reviewComment}</p>
                    )}
                  </button>
                )}
                </>
              )}

              {mode === "coach" && displayStatus === "ongoing" && (
                <div className="rounded-xl p-3" style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.22)" }}>
                  <p className="font-black" style={{ color: "#93c5fd", fontSize: 12 }}>Ongoing session</p>
                  <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                    Front desk has checked in this coaching session.
                  </p>
                </div>
              )}

              {mode === "coach" && displayStatus === "completed" && (
                <div className="rounded-xl p-3 relative" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.22)" }}>
                  <p className="font-black" style={{ color: "#93c5fd", fontSize: 12 }}>Completed session</p>
                  <p className="pr-24" style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>
                    You have finished the coaching session with {req.userName || "this student"}.
                  </p>
                  {req.rating && (
                    <button
                      type="button"
                      onClick={() => onReviewDetails(req)}
                      className="absolute right-3 bottom-3 px-2.5 py-1.5 rounded-lg border font-black flex items-center gap-1.5 hover:bg-yellow-400/15 transition-colors"
                      style={{ color: "#fde68a", borderColor: "rgba(251,191,36,0.28)", background: "rgba(251,191,36,0.09)", fontSize: 11 }}
                    >
                      <Star size={12} fill="#fbbf24" color="#fbbf24" /> {req.rating}/5
                    </button>
                  )}
                </div>
              )}

              {displayStatus === "pending" && mode === "student" && (
                <div className="rounded-xl py-3 px-4 flex items-center gap-2" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.22)" }}>
                  <Clock size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 font-black" style={{ fontSize: 13 }}>Payment is being processed</span>
                </div>
              )}

              {displayStatus === "rejected" && (
                <div className="rounded-xl py-3 px-4 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}>
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-red-400 font-black" style={{ fontSize: 13 }}>This coaching booking was cancelled</span>
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
  action: "reschedule_requested";
  onClose: () => void;
  onConfirm: (payload: { requestedDate: string; requestedTime: string; requestedEndTime: string; reason: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [requestedDate, setRequestedDate] = useState(req.requestedDate || "");
  const [requestedTime, setRequestedTime] = useState(String(req.requestedTime || "").slice(0, 5));
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [checkingTimes, setCheckingTimes] = useState(false);
  const { checkAvailability } = useBookingAPI();
  const durationHours = Math.max(1, Number(durationFromTimes(req.requestedTime, req.endTime) || req.durationHours || 1));
  const requestedEndTime = addHoursToTime(requestedTime, durationHours);

  useEffect(() => {
    let mounted = true;
    const courtId = String(req.courtId || "");
    const latestStartHour = FACILITY_CLOSE_HOUR - durationHours;
    const possibleTimes = Array.from(
      { length: Math.max(0, Math.floor(latestStartHour) - FACILITY_OPEN_HOUR + 1) },
      (_, i) => `${String(i + FACILITY_OPEN_HOUR).padStart(2, "0")}:00`,
    );
    if (!requestedDate || !courtId) {
      setAvailableTimes(possibleTimes);
      return;
    }

    setCheckingTimes(true);
    Promise.all(
      possibleTimes.map(async (time) => {
        const available = await checkAvailability(courtId, requestedDate, time, addHoursToTime(time, durationHours), req.linkedBookingId);
        return available ? time : null;
      }),
    ).then((results) => {
      if (!mounted) return;
      setAvailableTimes(results.filter((time): time is string => Boolean(time)));
      setCheckingTimes(false);
    });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationHours, req.courtId, req.linkedBookingId, requestedDate]);
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 18 }}
        className="relative w-full max-w-md rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white"><X size={16} /></button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ background: "rgba(56,189,248,0.14)" }}>
          <RefreshCw size={28} className="text-sky-300" />
        </div>
        <h3 className="text-white font-black mb-2 text-center" style={{ fontSize: 20 }}>Request reschedule?</h3>
        <p className="text-center" style={{ color: TS, fontSize: 13, lineHeight: 1.6 }}>
          Propose a new date and time. The student can accept or reject it from My Coaching.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {[
            ["Student", req.userName],
            ["Sport", req.sport],
            ["Date", dateLabel(req.requestedDate)],
            ["Time", `${fmt12(req.requestedTime ?? "")}${req.endTime ? ` - ${fmt12(req.endTime ?? "")}` : ""}`],
            ["Court", req.courtName || "Reserved court"],
            ["Total", amountLabel(req.totalAmount || req.coachFee)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: SURF2 }}>
              <p className="font-black uppercase" style={{ color: TS, fontSize: 9 }}>{label}</p>
              <p className="text-white font-black mt-1" style={{ fontSize: 12 }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <CustomDateTimePicker
            selectedDate={requestedDate}
            selectedTime={requestedTime}
            onDateChange={(date) => {
              setRequestedDate(date);
              setRequestedTime("");
            }}
            onTimeChange={setRequestedTime}
            minDate={new Date().toISOString().split("T")[0]}
            accentColor="#38bdf8"
            availableTimes={availableTimes}
            startHour={FACILITY_OPEN_HOUR}
            endHour={FACILITY_CLOSE_HOUR}
            sessionDurationHours={durationHours}
          />
          {checkingTimes && (
            <p className="mt-2 text-center font-black" style={{ color: "#7dd3fc", fontSize: 11 }}>Checking available times...</p>
          )}
        </div>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 240))}
          placeholder="Reason or preferred replacement time..."
          className="mt-4 w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 outline-none focus:ring-2 focus:ring-sky-500/25"
          style={{ fontSize: 13, lineHeight: 1.5, minHeight: 92 }}
        />
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-300" style={{ background: "rgba(255,255,255,0.07)", fontSize: 13 }}>Cancel</button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm({ requestedDate, requestedTime: `${requestedTime}:00`, requestedEndTime, reason });
              setBusy(false);
              onClose();
            }}
            disabled={busy || !requestedDate || !requestedTime || !availableTimes.includes(requestedTime)}
            className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#38bdf8,#2563eb)", fontSize: 13 }}>
            {busy ? "Saving..." : "Send Request"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TicketModal({ req, onClose }: { req: CoachingRequest; onClose: () => void }) {
  const color = getSportColor(req.sport);
  const paymentVerified = isManualPaymentVerified(req);
  const ticketCode = coachingTicketCode(req);
  const balanceDue =
    req.balanceDue != null
      ? req.balanceDue
      : req.downpaymentAmount != null
        ? Math.max(0, Number(req.totalAmount || req.coachFee || 0) - Number(req.downpaymentAmount || 0))
        : undefined;
  const totalAmount = Number(req.totalAmount || req.coachFee || 0);
  const ticketDuration = Math.max(1, Number(durationFromTimes(req.requestedTime, req.endTime) || req.durationHours || 1));
  return (
    <BookingTicketModal
      booking={{
        id: req.linkedBookingId || req.id,
        refCode: req.coachCourtQr,
        sport: req.sport,
        court: req.courtName || "Reserved court",
        date: req.requestedDate,
        time: req.endTime ? `${req.requestedTime}|${req.endTime}` : req.requestedTime,
        endTime: req.endTime,
        duration: ticketDuration,
        amount: totalAmount,
        totalAmount,
        downpaymentAmount: req.downpaymentAmount,
        downpaymentPercentage: req.downpaymentPercentage,
        balanceDue,
        status: req.status === "completed" ? "completed" : isManualPaymentVerified(req) ? "checked in" : "confirmed",
        frontDeskInstructions: req.status === "completed"
          ? "This coaching session has been completed."
          : isManualPaymentVerified(req)
            ? "Front desk has verified this coaching ticket. Proceed to the assigned court for your session."
            : `Please proceed to the front desk before your session, present this ticket, and settle the remaining balance of ${amountLabel(balanceDue ?? totalAmount)} to start.`,
      }}
      onClose={onClose}
    />
  );
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 18 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden border shadow-2xl max-h-[calc(100dvh-2rem)] flex flex-col" style={{ background: "#101011", borderColor: `${color}45` }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-black/35 flex items-center justify-center text-white/70 hover:text-white"><X size={16} /></button>
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${color}35, rgba(255,255,255,0.03))` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${color}24`, border: `1px solid ${color}45` }}>
            <SportIcon sport={req.sport} size={24} color={color} />
          </div>
          <p className="text-white font-black" style={{ fontSize: 22 }}>Coaching Ticket</p>
          <p style={{ color: "#cbd5e1", fontSize: 13 }}>{req.coachName} · {req.sport}</p>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>DATE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{dateLabel(req.requestedDate)}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>TIME</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{fmt12(req.requestedTime ?? "")}{req.endTime ? ` - ${fmt12(req.endTime ?? "")}` : ""}</p>
            </div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: SURF }}>
            <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COURT</p>
            <p className="text-white font-black" style={{ fontSize: 12 }}>{req.courtName || "Reserved by coach"}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3 min-h-[76px] text-center flex flex-col items-center justify-center" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COACH FEE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.coachFee)}</p>
            </div>
            <div className="rounded-2xl p-3 min-h-[76px] text-center flex flex-col items-center justify-center" style={{ background: SURF }}>
              <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>COURT FEE</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.courtAmount)}</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p style={{ color: "#86efac", fontSize: 10, fontWeight: 800 }}>TOTAL AMOUNT</p>
              <p className="text-white font-black" style={{ fontSize: 12 }}>{amountLabel(req.totalAmount || req.coachFee)}</p>
            </div>
          </div>
          {(req.downpaymentAmount != null || balanceDue != null) && (
            <div className="rounded-2xl p-3 space-y-2" style={{ background: SURF, border: `1px solid ${BORDER}` }}>
              {req.downpaymentAmount != null && (
                <div className="flex items-center justify-between gap-3">
                  <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>DOWNPAYMENT PAID</p>
                  <p className="text-green-300 font-black" style={{ fontSize: 12 }}>{amountLabel(req.downpaymentAmount)}</p>
                </div>
              )}
              {balanceDue != null && (
                <div className="flex items-center justify-between gap-3">
                  <p style={{ color: TS, fontSize: 10, fontWeight: 800 }}>BALANCE DUE</p>
                  <p className="text-orange-300 font-black" style={{ fontSize: 12 }}>{amountLabel(balanceDue)}</p>
                </div>
              )}
            </div>
          )}
          <div className="rounded-3xl bg-white p-4 flex flex-col items-center">
            <QRCodeSVG value={ticketCode} size={178} level="H" />
            <p className="mt-3 text-gray-500 font-black" style={{ fontSize: 10 }}>{req.status === "completed" ? "CHECKED OUT" : paymentVerified ? "CHECKED IN BY FRONT DESK" : "SHOW AT FRONT DESK"}</p>
            <p className="text-gray-900 font-black" style={{ fontSize: 14 }}>{ticketCode}</p>
            <button
              type="button"
              onClick={() => void downloadTicketQrPng({ value: ticketCode, fileBaseName: `${ticketCode}-Coaching-Ticket`, displayCode: ticketCode })}
              className="mt-3 w-full py-2.5 rounded-xl font-black text-gray-800 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 12 }}
            >
              <Download size={14} /> Download QR
            </button>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <p className="font-black text-green-300" style={{ fontSize: 12 }}>{req.status === "completed" ? "Checked out" : paymentVerified ? "Checked in" : "Front desk instructions"}</p>
            <p style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>
              {req.status === "completed"
                ? "The session has been finished."
                : paymentVerified
                ? "Front desk has verified this coaching session."
                : `Please proceed to the front desk before your session, present this ticket, and settle the remaining balance of ${amountLabel(balanceDue ?? req.totalAmount ?? req.coachFee)} to start.`}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ReviewModal({ req, onClose, onSubmit }: { req: CoachingRequest; onClose: () => void; onSubmit: (rating: number, comment: string) => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 18 }}
        className="relative w-full max-w-md rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white"><X size={16} /></button>
        <h3 className="text-white font-black text-center" style={{ fontSize: 20 }}>Rate {req.coachName}</h3>
        <p className="text-center mt-1" style={{ color: TS, fontSize: 13 }}>How did the coaching session feel?</p>
        <div className="flex justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} type="button" whileTap={{ scale: 0.82, rotate: -8 }} whileHover={{ y: -3 }}
              onClick={() => setRating(n)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: n <= rating ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.06)", border: `1px solid ${n <= rating ? "rgba(251,191,36,0.42)" : BORDER}` }}>
              <Star size={24} fill={n <= rating ? "#fbbf24" : "transparent"} color={n <= rating ? "#fbbf24" : TS} />
            </motion.button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 240))}
          placeholder="Optional review..."
          className="w-full rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/10 text-white placeholder:text-gray-600 outline-none focus:ring-2 focus:ring-orange-500/25"
          style={{ fontSize: 13, lineHeight: 1.5, minHeight: 100 }}
        />
        {error && (
          <p className="mt-3 rounded-xl px-3 py-2 text-red-200 font-black" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12 }}>
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-300" style={{ background: "rgba(255,255,255,0.07)", fontSize: 13 }}>Cancel</button>
          <button
            onClick={async () => {
              if (busy) return;
              setError("");
              setBusy(true);
              try {
                await onSubmit(rating, comment);
                onClose();
              } catch (err: any) {
                setError(err?.message || "Could not save rating. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)", fontSize: 13 }}>
            {busy ? "Saving..." : "Submit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ReviewDetailsModal({ req, onClose }: { req: CoachingRequest; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
        className="relative w-full max-w-sm rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white"><X size={16} /></button>
        <p className="text-white font-black text-center" style={{ fontSize: 20 }}>Session Review</p>
        <div className="flex justify-center gap-1.5 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={24} fill={n <= (req.rating || 0) ? "#fbbf24" : "transparent"} color={n <= (req.rating || 0) ? "#fbbf24" : TS} />
          ))}
        </div>
        <p className="text-center text-white font-black" style={{ fontSize: 14 }}>{req.rating || 0}/5 stars</p>
        <div className="mt-5 rounded-2xl border p-4" style={{ background: SURF2, borderColor: BORDER }}>
          <p className="font-black uppercase" style={{ color: TS, fontSize: 10 }}>Review</p>
          <p className="mt-2" style={{ color: req.reviewComment ? TP : TS, fontSize: 13, lineHeight: 1.6 }}>
            {req.reviewComment || "No written review was left."}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RescheduleResponseModal({
  req,
  action,
  onClose,
  onConfirm,
}: {
  req: CoachingRequest;
  action: "accepted" | "rejected";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const proposal = req.rescheduleProposal;
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
        className="relative w-full max-w-md rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white"><X size={16} /></button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ background: action === "accepted" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)" }}>
          {action === "accepted" ? <CheckCircle size={28} className="text-green-400" /> : <XCircle size={28} className="text-red-400" />}
        </div>
        <h3 className="text-white font-black text-center" style={{ fontSize: 20 }}>{action === "accepted" ? "Accept new schedule?" : "Reject reschedule?"}</h3>
        <p className="mt-2 text-center" style={{ color: TS, fontSize: 13, lineHeight: 1.6 }}>
          {action === "accepted"
            ? "Your coaching ticket and linked booking will move to the proposed schedule."
            : "Your current booking schedule will remain unchanged."}
        </p>
        {proposal && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl p-3 text-center" style={{ background: SURF2 }}>
              <p className="font-black uppercase" style={{ color: TS, fontSize: 9 }}>Proposed date</p>
              <p className="text-white font-black mt-1" style={{ fontSize: 12 }}>{dateLabel(proposal.requestedDate)}</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: SURF2 }}>
              <p className="font-black uppercase" style={{ color: TS, fontSize: 9 }}>Proposed time</p>
              <p className="text-white font-black mt-1" style={{ fontSize: 12 }}>{fmt12(proposal.requestedTime)}</p>
            </div>
          </div>
        )}
        {proposal?.reason && (
          <div className="mt-3 rounded-2xl p-3 border" style={{ background: "rgba(255,255,255,0.035)", borderColor: BORDER }}>
            <p className="font-black uppercase" style={{ color: TS, fontSize: 9 }}>Coach reason</p>
            <p className="mt-1" style={{ color: TP, fontSize: 13, lineHeight: 1.5 }}>{proposal.reason}</p>
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-300" style={{ background: "rgba(255,255,255,0.07)", fontSize: 13 }}>Cancel</button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onClose();
            }}
            className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-60"
            style={{ background: action === "accepted" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#ef4444,#dc2626)", fontSize: 13 }}
          >
            {busy ? "Saving..." : action === "accepted" ? "Accept" : "Reject"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function UserMyCoaching({ onNavigate }: { onNavigate: (tab: any, params?: any) => void }) {
  const { user, bookings } = useUser();
  const { requests, coaches, updateRequestStatus, submitCoachReview, findCoachByEmail, refreshRequests, isLoading } = useCoaching();
  const [activeTab, setActiveTab] = useState<"student" | "coach">("student");
  const [ticketReq, setTicketReq] = useState<CoachingRequest | null>(null);
  const [decision, setDecision] = useState<{ req: CoachingRequest; action: "reschedule_requested" } | null>(null);
  const [rescheduleResponse, setRescheduleResponse] = useState<{ req: CoachingRequest; action: "accepted" | "rejected" } | null>(null);
  const [reviewReq, setReviewReq] = useState<CoachingRequest | null>(null);
  const [reviewDetailsReq, setReviewDetailsReq] = useState<CoachingRequest | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CoachingRequest["status"]>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [hiddenCompletedIds, setHiddenCompletedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("sportsync_hidden_completed_coaching") || "[]"); } catch { return []; }
  });
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
    setActiveTab("coach");
    coachDefaultTabApplied.current = true;
  }, [isLoading, isCoach]);

  const currentList = activeTab === "coach" ? coachSessions : studentSessions;
  const bookingByIdOrRef = useMemo(() => {
    const map = new Map<string, any>();
    for (const booking of bookings || []) {
      if (booking.id) map.set(String(booking.id), booking);
      if (booking.refCode) map.set(String(booking.refCode), booking);
    }
    return map;
  }, [bookings]);
  const activeStudentSessions = studentSessions.filter((r) => !hiddenCompletedIds.includes(r.id) && !isClearedCoachingStatus(r));
  const activeCoachSessions = coachSessions.filter((r) => !hiddenCompletedIds.includes(r.id) && !isClearedCoachingStatus(r));
  const activeCurrentList = activeTab === "coach" ? activeCoachSessions : activeStudentSessions;
  const clearableSessionIds = currentList.filter(isClearedCoachingStatus).map((r) => r.id);
  useEffect(() => {
    localStorage.setItem("sportsync_hidden_completed_coaching", JSON.stringify(hiddenCompletedIds));
  }, [hiddenCompletedIds]);
  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return currentList
      .filter((r) => !hiddenCompletedIds.includes(r.id))
      .filter((r) => statusFilter === "all" || displayStatusFor(r) === statusFilter)
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
  }, [currentList, hiddenCompletedIds, query, sortOrder, statusFilter]);
  const pendingCount = activeCoachSessions.filter((r) => r.status === "pending").length;
  const confirmedCount = [...activeStudentSessions, ...activeCoachSessions].filter((r) => ["confirmed", "ongoing"].includes(displayStatusFor(r))).length;

  const handleClearTerminalSessions = async () => {
    const ids = [...new Set(clearableSessionIds)];
    if (ids.length === 0) {
      setShowClearModal(false);
      return;
    }
    setHiddenCompletedIds((prev) => [...new Set([...prev, ...ids])]);
    await Promise.all(ids.map((id) => apiFetch(`/api/coaching-sessions/${encodeURIComponent(id)}`, { method: "DELETE" })));
    await refreshRequests();
    setShowClearModal(false);
  };

  return (
    <div className="h-full overflow-y-auto pb-24 md:pb-8" style={{ background: BG }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
          <div className="rounded-3xl border p-5 md:p-6" style={{ background: SURF, borderColor: BORDER }}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center" style={{ background: `${ORANGE}18`, border: `1px solid ${ORANGE}35` }}>
                <GraduationCap size={24} color={ORANGE} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-black" style={{ fontSize: 26 }}>My Coaching</h2>
                <p style={{ color: TS, fontSize: 13 }}>
                  {isCoach ? "Manage coaching requests and tickets." : "Track coaching requests, approvals, and tickets."}
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
          <StatCard label="My sessions" value={activeStudentSessions.length} icon={Calendar} color={ORANGE} />
          <StatCard label="Confirmed" value={confirmedCount} icon={CheckCircle} color={GREEN} />
          <StatCard label={isCoach ? "Pending coach requests" : "Available coaches"} value={isCoach ? pendingCount : coaches.length} icon={Users} color={BLUE} />
        </div>

        {isCoach && (
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
            {([
              { id: "student", label: "My Sessions", count: activeStudentSessions.length, icon: Star, color: ORANGE },
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

        <div className="grid gap-5 items-start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-black" style={{ fontSize: 17 }}>{activeTab === "coach" ? "Coach Inbox" : "My Sessions"}</h3>
              <div className="flex items-center gap-2">
                <p style={{ color: TS, fontSize: 12 }}>{visibleList.length} item{visibleList.length === 1 ? "" : "s"}</p>
                {clearableSessionIds.length > 0 && (
                  <button onClick={() => setShowClearModal(true)} className="px-3 py-1.5 rounded-xl font-black border flex items-center gap-1.5"
                    style={{ color: "#cbd5e1", borderColor: BORDER, background: SURF2, fontSize: 11 }}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                { id: "all", label: "All", count: activeCurrentList.length, color: TS },
                { id: "pending", label: "Processing", count: activeCurrentList.filter((item) => item.status === "pending").length, color: "#eab308" },
                { id: "confirmed", label: "Confirmed", count: activeCurrentList.filter((item) => displayStatusFor(item) === "confirmed").length, color: GREEN },
                { id: "ongoing", label: "Ongoing", count: activeCurrentList.filter((item) => displayStatusFor(item) === "ongoing").length, color: "#60a5fa" },
                { id: "reschedule_requested", label: "Reschedule", count: currentList.filter((item) => displayStatusFor(item) === "reschedule_requested").length, color: "#38bdf8" },
                { id: "rejected", label: "Declined", count: currentList.filter((item) => displayStatusFor(item) === "rejected" && !hiddenCompletedIds.includes(item.id)).length, color: RED },
                { id: "completed", label: "Completed", count: currentList.filter((item) => displayStatusFor(item) === "completed" && !hiddenCompletedIds.includes(item.id)).length, color: BLUE },
              ] as const).map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className="flex items-center gap-2 rounded-2xl border px-3 py-2 font-black whitespace-nowrap"
                    style={{
                      background: active ? `${chip.color}20` : SURF,
                      borderColor: active ? `${chip.color}55` : BORDER,
                      color: active ? chip.color : TS,
                      fontSize: 12,
                    }}
                  >
                    {chip.label}
                    <span className="rounded-full px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.08)", color: TP, fontSize: 10 }}>
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-2">
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
              <CompactMenu
                value={sortOrder}
                onChange={setSortOrder}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
              />
            </div>
            {isLoading ? (
              <div className="grid gap-3">
                {[0, 1, 2, 3].map((i) => <SessionCardSkeleton key={i} />)}
              </div>
            ) : currentList.length === 0 ? (
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
                  const linkedBooking =
                    (req.linkedBookingId ? bookingByIdOrRef.get(String(req.linkedBookingId)) : undefined) ||
                    (req.coachCourtQr ? bookingByIdOrRef.get(String(req.coachCourtQr)) : undefined);
                  const linkedStartTime = linkedBooking?.time || req.requestedTime;
                  const linkedDuration = Number(linkedBooking?.duration || 0);
                  const linkedEndTime =
                    linkedBooking && linkedDuration > 0
                      ? addHoursToTime(String(linkedStartTime || "09:00"), linkedDuration)
                      : req.endTime;
                  const computedDuration = Math.max(1, Number(durationFromTimes(linkedStartTime, linkedEndTime) || linkedDuration || durationFromTimes(req.requestedTime, req.endTime) || req.durationHours || 1));
                  const fallbackCoachFee = (coachForReq?.hourlyRate || myCoachProfile?.hourlyRate || 0) * computedDuration;
                  const computedCoachFee = Math.max(0, Number(req.coachFee || fallbackCoachFee || 0));
                  const computedTotal = Math.max(0, Number(req.totalAmount || computedCoachFee || 0));
                  const enrichedReq = {
                    ...req,
                    linkedBookingId: req.linkedBookingId || linkedBooking?.id,
                    coachCourtQr: req.coachCourtQr || linkedBooking?.refCode,
                    requestedDate: linkedBooking?.date || req.requestedDate,
                    requestedTime: linkedStartTime,
                    endTime: linkedEndTime,
                    courtName: req.courtName || linkedBooking?.court,
                    courtId: req.courtId || linkedBooking?.courtId,
                    coachFee: computedCoachFee,
                    courtAmount: req.courtAmount != null ? req.courtAmount : Math.max(0, computedTotal - computedCoachFee),
                    totalAmount: computedTotal,
                    durationHours: computedDuration,
                    status: req.status === "pending" && Number(req.downpaymentAmount || 0) > 0 ? "confirmed" as const : req.status,
                  };
                  return (
                    <SessionCard
                      key={req.id}
                      req={enrichedReq}
                      mode={activeTab === "coach" ? "coach" : "student"}
                      onTicket={setTicketReq}
                      onDecision={(r, action) => setDecision({ req: r, action })}
                      onReview={setReviewReq}
                      onReviewDetails={setReviewDetailsReq}
                      onRescheduleResponse={(r, action) => setRescheduleResponse({ req: r, action })}
                    />
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <AnimatePresence>
        {ticketReq && <TicketModal req={ticketReq} onClose={() => setTicketReq(null)} />}
        {decision && (
          <DecisionModal
            req={decision.req}
            action={decision.action}
            onClose={() => setDecision(null)}
            onConfirm={(proposal) => {
              const note = [
                decision.req.adminNotes || "",
                `COACHING_RESCHEDULE_PROPOSED:${JSON.stringify({
                  requestedDate: proposal.requestedDate,
                  requestedTime: proposal.requestedTime,
                  requestedEndTime: proposal.requestedEndTime,
                  reason: proposal.reason.trim() || "Coach requested a new schedule.",
                  requestedAt: new Date().toISOString(),
                })}`,
              ].filter(Boolean).join("\n");
              return updateRequestStatus(decision.req.id, "confirmed", note);
            }}
          />
        )}
        {rescheduleResponse && (
          <RescheduleResponseModal
            req={rescheduleResponse.req}
            action={rescheduleResponse.action}
            onClose={() => setRescheduleResponse(null)}
            onConfirm={() => {
              const note = [
                rescheduleResponse.req.adminNotes || "",
                `COACHING_RESCHEDULE_${rescheduleResponse.action === "accepted" ? "ACCEPTED" : "REJECTED"}:${JSON.stringify({
                  decidedAt: new Date().toISOString(),
                })}`,
              ].filter(Boolean).join("\n");
              return updateRequestStatus(rescheduleResponse.req.id, "confirmed", note);
            }}
          />
        )}
        {reviewReq && (
          <ReviewModal
            req={reviewReq}
            onClose={() => setReviewReq(null)}
            onSubmit={(rating, comment) => submitCoachReview(reviewReq.id, rating, comment)}
          />
        )}
        {reviewDetailsReq && <ReviewDetailsModal req={reviewDetailsReq} onClose={() => setReviewDetailsReq(null)} />}
        {showClearModal && (
          <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowClearModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
              className="relative w-full max-w-sm rounded-3xl border p-6" style={{ background: SURF, borderColor: BORDER }}>
              <h3 className="text-white font-black" style={{ fontSize: 18 }}>Clear completed sessions?</h3>
              <p className="mt-2" style={{ color: TS, fontSize: 13, lineHeight: 1.5 }}>Completed and cancelled coaching sessions will be removed from the database and from this tab.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={() => setShowClearModal(false)} className="flex-1 py-3 rounded-xl font-black text-gray-300" style={{ background: "rgba(255,255,255,0.07)", fontSize: 13 }}>Cancel</button>
                <button onClick={() => void handleClearTerminalSessions()} className="flex-1 py-3 rounded-xl text-white font-black" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", fontSize: 13 }}>Clear</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
