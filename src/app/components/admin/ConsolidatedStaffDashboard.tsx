import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import {
  Activity, Calendar, Inbox, Shield, Menu, X, LogOut,
  MapPin, AlertTriangle, AlertCircle, Check, Bell, Users,
  DollarSign, Clock, UserCheck, Map, ChevronLeft, ChevronRight, CheckCircle,
  QrCode, Search, ShieldCheck, ScanLine, Building2, GraduationCap, Camera,
  Megaphone, XCircle, MessageSquare, User, Layers, Phone, Loader2,
  Wrench,
  History,
  ArrowUpDown,
  Trash2,
  Eye,
  RotateCcw,
  Filter,
  Download,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '../../contexts/UserContext';
import { useCoaching } from '../../contexts/CoachingContext';
import type { CoachingRequest } from '../../contexts/CoachingContext';
import { useAnnouncements } from '../../contexts/AnnouncementsContext';
import { AdminBookingCalendar } from './AdminBookingCalendar';
import { useBookingAPI } from '../../hooks/useBookingAPI';
import { ALL_COURTS, SPORTS_INFO } from '../sportsData';
import { useFacilityMap, getSportMapColor, bookingAppliesToPublishedMap } from '../../contexts/FacilityMapContext';
import type { CourtBlock } from '../../contexts/FacilityMapContext';
import { getSportColor, SportIcon } from '../SportIcons';
import { FacilityMapViewer } from '../shared/FacilityMapViewer';
import { CustomDateTimePicker } from '../shared/CustomDateTimePicker';
import { StaffInbox } from './StaffInbox';
import { normalizeTicketScanInput, genRefCode, isUuidString } from '../../../shared/ticketRef';
import { apiFetch } from '../../utils/authenticatedFetch';

type StaffTab = 'operations' | 'calendar' | 'inbox' | 'activity';

const STAFF_TABS: { id: StaffTab; icon: any; label: string; sub: string }[] = [
  { id: 'operations', icon: Activity,  label: 'Live Operations',   sub: 'Courts, Real-time status' },
  { id: 'calendar',   icon: Calendar,  label: 'Master Calendar',   sub: 'Bookings, Scheduling' },
  { id: 'inbox',      icon: Inbox,     label: 'Front Desk Inbox',  sub: 'Requests, Coaching, Alerts' },
  { id: 'activity',   icon: History,   label: 'Activity Log',      sub: 'Walk-ins, check-ins, desk' },
];

const LIVE_OPERATIONS_TZ = 'Asia/Manila';

function toMinutesOfDay(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function getManilaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LIVE_OPERATIONS_TZ }).format(date);
}

function getManilaTimeKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LIVE_OPERATIONS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatLiveOpsTime(value: string | Date): string {
  const ms = value instanceof Date ? value.getTime() : parseActivityUtcMillis(value);
  if (Number.isNaN(ms)) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: LIVE_OPERATIONS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

/* ─── Confirm Dialog ─────────────────────────────────────────────── */
interface ConfirmOptions {
  title: string; body: string; confirmLabel: string;
  confirmColor: string; icon: React.ReactNode;
  onConfirm: () => void; onCancel: () => void;
  /** e.g. z-[1100] so nested confirmations sit above other overlays */
  stackZ?: string;
}
function ConfirmModal({ opts }: { opts: ConfirmOptions }) {
  return (
    <div className={`fixed inset-0 ${opts.stackZ || 'z-[999]'} flex items-center justify-center bg-black/80 backdrop-blur-sm p-4`}>
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

type PillSelectOption<T extends string> = {
  id: T;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

function PillSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: PillSelectOption<T>[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 border border-white/10 bg-white/[0.06] hover:bg-white/[0.08] transition-colors font-black text-gray-100"
        style={{ fontSize: 12 }}
      >
        <span className="text-gray-400">{selected?.icon}</span>
        <span className="whitespace-nowrap">{selected?.label}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="absolute left-0 mt-2 z-[1200] min-w-[220px] rounded-2xl border border-white/10 bg-[#141824] shadow-2xl overflow-hidden"
            role="menu"
          >
            <div className="p-2 space-y-1">
              {options.map((o) => {
                const active = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl transition-colors flex items-start gap-2"
                    style={{
                      background: active ? 'rgba(0,71,171,0.25)' : 'transparent',
                      border: active ? '1px solid rgba(0,71,171,0.35)' : '1px solid transparent',
                    }}
                  >
                    <span className="mt-0.5 text-blue-300">{o.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-white font-black" style={{ fontSize: 12 }}>{o.label}</span>
                      {o.hint ? (
                        <span className="block text-gray-500 font-black mt-0.5" style={{ fontSize: 10 }}>{o.hint}</span>
                      ) : null}
                    </span>
                    {active ? <Check size={14} className="ml-auto mt-0.5 text-blue-400" /> : null}
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

type TicketPayloadKind = 'empty' | 'jrc_ref' | 'uuid' | 'legacy_json' | 'coaching_json' | 'http_url' | 'wifi' | 'other';

function parseCoachingTicketPayload(raw: string): { reqId: string } | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    const reqId = typeof parsed.reqId === 'string' ? parsed.reqId : typeof parsed.id === 'string' ? parsed.id : '';
    if ((parsed.type === 'coaching' || reqId) && reqId) return { reqId };
  } catch {
    /* not a JSON coaching ticket */
  }
  const normalized = normalizeTicketScanInput(t);
  const match = normalized.match(/^COACH-?([A-Z0-9-]{6,})$/i);
  return match ? { reqId: match[1] } : null;
}

function classifyTicketPayload(raw: string): TicketPayloadKind {
  const t = raw.trim();
  if (!t) return 'empty';
  if (/^https?:\/\//i.test(t)) return 'http_url';
  if (/^WIFI:/i.test(t)) return 'wifi';
  if (parseCoachingTicketPayload(t)) return 'coaching_json';
  if (t.startsWith('{') && t.includes('"ref"')) return 'legacy_json';
  const norm = normalizeTicketScanInput(t);
  if (isUuidString(norm)) return 'uuid';
  if (/^JRC-/i.test(norm)) return 'jrc_ref';
  return 'other';
}

function ticketNotFoundMessage(kind: TicketPayloadKind): string {
  switch (kind) {
    case 'http_url':
      return 'This QR code is a web link, not a JRC SportSync court ticket. Ask the guest for their SportSync receipt QR or type the reference (JRC-XXXXXX).';
    case 'wifi':
      return 'This QR code is for a Wi-Fi network, not a booking ticket.';
    case 'empty':
      return 'Nothing was read from the camera. Center the ticket QR in the frame and hold steady.';
    case 'coaching_json':
      return 'This looks like a coaching ticket, but no matching session is loaded. Ask the guest to refresh My Coaching or find it in Front Desk Inbox.';
    case 'legacy_json':
    case 'jrc_ref':
    case 'uuid':
    case 'other':
    default:
      return 'No booking matches this code. It may be a random QR, a menu, or another app — not a JRC SportSync booking ticket.';
  }
}

async function safeDisposeHtml5Scanner(h: Html5Qrcode | null | undefined): Promise<void> {
  if (!h) return;
  try {
    if (h.isScanning) {
      await h.stop();
    }
  } catch {
    /* e.g. "Cannot stop, scanner is not running or paused" */
  }
  try {
    h.clear();
  } catch {
    /* element may already be detached */
  }
}

// ── Ticket Verification ──────────────────────────────────────────────────────
function TicketVerification() {
  const { bookings, updateBooking, addBooking, user } = useUser();
  const { lookupBookingByRef, checkInBooking, checkOutBooking, cancelBooking } = useBookingAPI();
  const { requests: coachingRequests, updateRequestStatus } = useCoaching();
  type BookingTicketResult = (typeof bookings)[0];
  type CoachingTicketResult = {
    ticketType: 'coaching';
    id: string;
    refCode: string;
    customerName: string;
    coachName: string;
    sport: string;
    date: string;
    time: string;
    endTime?: string;
    durationHours?: number;
    courtName?: string;
    courtAmount?: number;
    coachFee?: number;
    totalAmount?: number;
    downpaymentAmount?: number;
    downpaymentPercentage?: number;
    balanceDue?: number;
    status: CoachingRequest['status'];
    adminNotes?: string;
    req: CoachingRequest;
  };
  type VerificationResult = BookingTicketResult | CoachingTicketResult | null | 'notfound';
  const isCoachingResult = (value: VerificationResult): value is CoachingTicketResult =>
    !!value && value !== 'notfound' && (value as CoachingTicketResult).ticketType === 'coaching';
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<VerificationResult>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: 'check_in' | 'check_out' | 'reject' | 'coaching_check_in' | 'coaching_check_out' | 'coaching_reject', title: string, desc: string} | null>(null);
  const [scanMode, setScanMode] = useState<'check_in' | 'check_out'>('check_in');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notFoundHint, setNotFoundHint] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** Fresh element id each time the scanner opens so html5-qrcode never reuses a stale DOM node. */
  const [scannerMountKey, setScannerMountKey] = useState(0);
  const readerId = `ticket-qr-${scannerMountKey}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanHandlerRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const decodeLock = useRef(false);

  const buildCoachingTicket = useCallback((req: CoachingRequest): CoachingTicketResult => ({
    ticketType: 'coaching',
    id: req.id,
    refCode: `COACH-${req.id.slice(0, 8).toUpperCase()}`,
    customerName: req.userName || 'Student',
    coachName: req.coachName || 'Coach',
    sport: req.sport || 'Sports',
    date: req.requestedDate,
    time: req.requestedTime,
    endTime: req.endTime,
    durationHours: req.durationHours,
    courtName: req.courtName,
    courtAmount: req.courtAmount,
    coachFee: req.coachFee,
    totalAmount: req.totalAmount,
    downpaymentAmount: req.downpaymentAmount,
    downpaymentPercentage: req.downpaymentPercentage,
    balanceDue: req.balanceDue,
    status: req.status,
    adminNotes: req.adminNotes,
    req,
  }), []);

  const resolveTicket = useCallback(
    async (rawInput: string) => {
      const raw = rawInput.trim();
      if (!raw) return { found: null as VerificationResult, norm: '', kind: 'empty' as TicketPayloadKind };
      const norm = normalizeTicketScanInput(raw);
      const upper = norm.toUpperCase();
      const kind = classifyTicketPayload(raw);
      const coachingPayload = parseCoachingTicketPayload(raw);
      if (coachingPayload) {
        const shortId = coachingPayload.reqId.replace(/^COACH-?/i, '').toUpperCase();
        const coaching = coachingRequests.find((r) =>
          r.id === coachingPayload.reqId ||
          r.id.toUpperCase() === coachingPayload.reqId.toUpperCase() ||
          r.id.slice(0, 8).toUpperCase() === shortId
        );
        if (coaching) return { found: buildCoachingTicket(coaching), norm: `COACH-${coaching.id.slice(0, 8).toUpperCase()}`, kind: 'coaching_json' as TicketPayloadKind };
      }
      let found =
        bookings.find(
          (b) =>
            b.refCode?.toUpperCase() === upper ||
            b.refCode?.toUpperCase().endsWith(upper) ||
            b.id.toUpperCase() === upper ||
            b.id.toLowerCase() === norm
        ) ?? null;
      if (!found) {
        const remote = await lookupBookingByRef(norm);
        if (remote && typeof remote === 'object' && 'id' in remote) {
          const rb = remote as (typeof bookings)[0];
          const existing = bookings.find((b) => b.id === rb.id);
          if (existing) updateBooking(rb.id, rb);
          else addBooking(rb);
          found = rb;
        }
      }
      return { found, norm, kind };
    },
    [bookings, coachingRequests, lookupBookingByRef, addBooking, updateBooking, buildCoachingTicket]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    setNotFoundHint(null);
    const { found, kind } = await resolveTicket(query);
    if (!found) {
      setResult('notfound');
      setNotFoundHint(ticketNotFoundMessage(kind));
      return;
    }
    setResult(found);
  };

  const applyScanOrPaste = async (raw: string) => {
    setNotFoundHint(null);
    const display = raw.trim().length > 56 ? `${raw.trim().slice(0, 56)}…` : raw.trim();
    setQuery(display || raw.trim());
    const { found, norm, kind } = await resolveTicket(raw);
    if (norm) setQuery(norm.length > 56 ? `${norm.slice(0, 56)}...` : norm);
    if (!found) {
      setResult('notfound');
      setNotFoundHint(ticketNotFoundMessage(kind));
      return;
    }
    setResult(found);
  };

  scanHandlerRef.current = applyScanOrPaste;

  const clearVerification = useCallback(() => {
    setQuery('');
    setResult(null);
    setNotFoundHint(null);
    setCameraError(null);
    setActionError(null);
    decodeLock.current = false;
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const h = scannerRef.current;
      decodeLock.current = false;
      void safeDisposeHtml5Scanner(h).finally(() => {
        scannerRef.current = null;
        setCameraOpen(false);
        setCameraError(
          'Scanner closed while this tab was in the background (the camera feed pauses). Tap Scan QR again when you are ready.'
        );
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [cameraOpen]);

  useEffect(() => {
    if (!cameraOpen) {
      decodeLock.current = false;
      const orphan = scannerRef.current;
      scannerRef.current = null;
      void safeDisposeHtml5Scanner(orphan);
      return;
    }
    setCameraError(null);
    decodeLock.current = false;
    let cancelled = false;
    const run = async () => {
      let h: Html5Qrcode | null = null;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
          setCameraError('Camera scanning requires HTTPS. Use the deployed HTTPS site or type the reference code manually.');
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('This browser does not expose camera access. Try Chrome/Safari on a phone, or type the reference code manually.');
          return;
        }
        try {
          await navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            stream.getTracks().forEach((track) => track.stop());
          });
        } catch (permissionErr: any) {
          const msg = String(permissionErr?.name || permissionErr?.message || permissionErr);
          if (/NotAllowed|Permission|Security/i.test(msg)) {
            setCameraError('Camera permission is blocked. Allow camera access for this site, then tap Scan QR again.');
          } else if (/NotFound|DevicesNotFound|Overconstrained/i.test(msg)) {
            setCameraError('No usable camera was found. Try another device or type the reference code manually.');
          } else {
            setCameraError('Camera could not start. Close other camera apps, then tap Scan QR again.');
          }
          return;
        }
        h = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = h;
        const config = {
          fps: 10,
          aspectRatio: 1.0,
          qrbox: (vw: number, vh: number) => {
            const m = Math.min(vw, vh);
            const s = Math.max(180, Math.floor(m * 0.72));
            return { width: s, height: s };
          },
        };
        const onOk = async (decodedText: string) => {
          if (decodeLock.current || cancelled) return;
          decodeLock.current = true;
          const scanner = h;
          scannerRef.current = null;
          h = null;
          if (cancelled) return;
          setCameraOpen(false);
          try {
            await scanHandlerRef.current(decodedText);
          } catch (scanErr) {
            console.error(scanErr);
            setResult('notfound');
            setNotFoundHint('Something went wrong after the scan. Try again or type the reference code.');
          } finally {
            decodeLock.current = false;
            void safeDisposeHtml5Scanner(scanner);
          }
        };
        const onFail = () => {};
        try {
          await h.start({ facingMode: 'environment' }, config, onOk, onFail);
        } catch {
          if (cancelled) return;
          await h.start({ facingMode: 'user' }, config, onOk, onFail);
        }
      } catch (e: unknown) {
        await safeDisposeHtml5Scanner(h);
        scannerRef.current = null;
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(msg)) {
          setCameraError(
            'The scanner module is from an older app version. Refresh this page once, then open Scan QR again.'
          );
        } else if (/NotAllowed|Permission/i.test(msg)) {
          setCameraError('Camera access was blocked. Allow camera for this site in your browser, then open Scan again.');
        } else if (/NotFound|DevicesNotFound|no device/i.test(msg)) {
          setCameraError('No camera was found. Try another device or type the reference code manually.');
        } else if (/stop.*not running|not running or paused|AbortError|Track ended|video source|feed/i.test(msg)) {
          setCameraError(
            'The camera was interrupted (common after switching tabs). Close this dialog and tap Scan QR again.'
          );
        } else {
          setCameraError(msg.length > 160 ? `${msg.slice(0, 160)}…` : msg);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      const h = scannerRef.current;
      scannerRef.current = null;
      void safeDisposeHtml5Scanner(h);
    };
  }, [cameraOpen, readerId]);

  const performCheckIn = async () => {
    if (!result || result === 'notfound' || isCoachingResult(result)) return;
    setActionError(null);
    setCheckingIn(true);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const staffId = user?.id && uuidRe.test(user.id) ? user.id : undefined;
    const t = new Date().toISOString();
    try {
      const updated = await checkInBooking(result.id, staffId);
      updateBooking(result.id, updated);
      setResult({ ...result, ...updated, checkInStatus: 'checked_in', checkInTime: updated.checkInTime || t, status: 'checked_in' as any });
    } catch (e: any) {
      setActionError(e?.message || 'Check-in failed. Please try again.');
      setCheckingIn(false);
      return;
    }
    setCheckingIn(false);
  };

  const performReject = async () => {
    if (!result || result === 'notfound' || isCoachingResult(result)) return;
    setActionError(null);
    setRejecting(true);
    try {
      await cancelBooking(result.id, 'Rejected at desk (no payment/no show)');
    } catch (e: any) {
      setActionError(e?.message || 'Rejection failed. Please try again.');
      setRejecting(false);
      return;
    }
    updateBooking(result.id, { status: 'cancelled' as any });
    setResult({ ...result, status: 'cancelled' as any });
    setRejecting(false);
  };

  const performCheckOut = async () => {
    if (!result || result === 'notfound' || isCoachingResult(result)) return;
    setActionError(null);
    setCheckingOut(true);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const staffId = user?.id && uuidRe.test(user.id) ? user.id : undefined;
    const t = new Date().toISOString();
    try {
      const updated = await checkOutBooking(result.id, staffId);
      updateBooking(result.id, updated);
      setResult({ ...result, ...updated, checkOutStatus: 'checked_out', checkOutTime: updated.checkOutTime || t, status: 'completed' } as any);
    } catch (e: any) {
      setActionError(e?.message || 'Check-out failed. Please try again.');
      setCheckingOut(false);
      return;
    }
    setCheckingOut(false);
  };

  const performCoachingCheckIn = async () => {
    if (!isCoachingResult(result)) return;
    setActionError(null);
    setCheckingIn(true);
    const t = new Date().toISOString();
    const staffName = user?.name || user?.email || 'Front desk';
    const note = [
      'PAYMENT_VERIFIED_MANUAL',
      'COACHING_CHECKED_IN',
      `checked_in:${t}`,
      `staff:${staffName}`,
      'Coaching payment verified at the front desk before session check-in.',
    ].join('\n');
    try {
      await updateRequestStatus(result.id, 'confirmed', note);
      setResult({ ...result, status: 'confirmed', adminNotes: note, req: { ...result.req, status: 'confirmed', adminNotes: note } });
    } catch (e: any) {
      setActionError(e?.message || 'Could not verify this coaching payment. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const performCoachingCheckOut = async () => {
    if (!isCoachingResult(result)) return;
    setActionError(null);
    setCheckingOut(true);
    const t = new Date().toISOString();
    const note = [
      result.adminNotes || '',
      'COACHING_CHECKED_OUT',
      `checked_out:${t}`,
    ].filter(Boolean).join('\n');
    try {
      await updateRequestStatus(result.id, 'completed' as any, note);
      setResult({ ...result, status: 'completed' as any, adminNotes: note, req: { ...result.req, status: 'completed' as any, adminNotes: note } });
      window.dispatchEvent(new Event('sportsync:coaching-refresh'));
    } catch (e: any) {
      setActionError(e?.message || 'Could not check out this coaching ticket. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const performCoachingReject = async () => {
    if (!isCoachingResult(result)) return;
    setActionError(null);
    setRejecting(true);
    const t = new Date().toISOString();
    const note = [
      result.adminNotes || '',
      'COACHING_REJECTED_AT_DESK',
      `rejected_at:${t}`,
      'Front desk rejected this coaching ticket.',
    ].filter(Boolean).join('\n');
    try {
      await updateRequestStatus(result.id, 'rejected', note);
      setResult({ ...result, status: 'rejected', adminNotes: note, req: { ...result.req, status: 'rejected', adminNotes: note } });
    } catch (e: any) {
      setActionError(e?.message || 'Could not reject this coaching ticket. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type } = confirmAction;
    setConfirmAction(null);
    if (type === 'check_in') await performCheckIn();
    if (type === 'reject') await performReject();
    if (type === 'check_out') await performCheckOut();
    if (type === 'coaching_check_in') await performCoachingCheckIn();
    if (type === 'coaching_check_out') await performCoachingCheckOut();
    if (type === 'coaching_reject') await performCoachingReject();
  };

  const bookingStatus = (result && result !== 'notfound' ? (result as any).status : null) as string | null;
  const coachingPaymentVerified = isCoachingResult(result) && /PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(result.adminNotes || '');
  const coachingCheckedOut = isCoachingResult(result) && (/COACHING_CHECKED_OUT|checked_out:/i.test(result.adminNotes || '') || result.status === 'completed');
  const isCompleted = bookingStatus === 'completed';
  const isCheckedIn = bookingStatus === 'checked_in' || coachingPaymentVerified || (result && result !== 'notfound' && (result as any).checkInStatus === 'checked_in');

  const canCheckIn = !!result && result !== 'notfound' && !isCoachingResult(result) && !isCompleted && !isCheckedIn && bookingStatus !== 'cancelled';
  const canCheckOut = !!result && result !== 'notfound' && !isCoachingResult(result) && !isCompleted && isCheckedIn;
  const canCoachingCheckOut = isCoachingResult(result) && coachingPaymentVerified && !coachingCheckedOut;

  const formatTime = (t: string) => {
    const raw = String(t || '').trim();
    if (!raw) return 'Time TBD';
    const ampm = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i);
    if (ampm) return `${Number(ampm[1]) % 12 || 12}:${String(Number(ampm[2] || 0)).padStart(2, '0')} ${ampm[3].toUpperCase()}`;
    const [hRaw, mRaw = '0'] = raw.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h)) return raw.replace(/NaN/i, '00');
    return `${h % 12 || 12}:${String(Number.isFinite(m) ? m : 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const money = (value: unknown) => `₱${Math.max(0, Number(value || 0)).toLocaleString()}`;
  const resultAny = result && result !== 'notfound' ? (result as any) : null;
  const ticketTotal = Number(resultAny?.totalAmount ?? resultAny?.amount ?? 0);
  const ticketDownpayment =
    resultAny?.downpaymentAmount != null ? Number(resultAny.downpaymentAmount) : null;
  const ticketBalance =
    resultAny?.balanceDue != null
      ? Number(resultAny.balanceDue)
      : ticketDownpayment != null
        ? Math.max(0, ticketTotal - ticketDownpayment)
        : null;

  return (
    <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0047AB]/20 border border-[#0047AB]/30">
          <ScanLine size={17} className="text-[#60a5fa]" />
        </div>
        <div>
          <p className="text-white font-black" style={{ fontSize: 15 }}>Ticket Verification</p>
          <p className="text-gray-500" style={{ fontSize: 11 }}>Scan receipt → verify details → check-in or check-out. Works on phone and desktop (HTTPS).</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setScanMode('check_in')}
          className="px-3 py-1.5 rounded-xl font-black border transition-colors"
          style={{
            fontSize: 12,
            background: scanMode === 'check_in' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
            color: scanMode === 'check_in' ? '#bbf7d0' : '#9ca3af',
            borderColor: scanMode === 'check_in' ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.10)',
          }}
        >
          Check-in
        </button>
        <button
          type="button"
          onClick={() => setScanMode('check_out')}
          className="px-3 py-1.5 rounded-xl font-black border transition-colors"
          style={{
            fontSize: 12,
            background: scanMode === 'check_out' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
            color: scanMode === 'check_out' ? '#bfdbfe' : '#9ca3af',
            borderColor: scanMode === 'check_out' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.10)',
          }}
        >
          Check-out
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFoundHint(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          placeholder="Enter code e.g. JRC-AB12CD"
          className="flex-1 rounded-xl px-4 py-2.5 text-white focus:outline-none"
          style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', letterSpacing: 1 }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSearch()}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-white transition-all"
            style={{ fontSize: 13, background: 'linear-gradient(135deg,#0047AB,#0066ff)' }}
          >
            <Search size={14} /> Search
          </button>
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setScannerMountKey((k) => k + 1);
              setCameraOpen(true);
            }}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-white border border-blue-400/40 transition-all hover:bg-blue-500/15"
            style={{ fontSize: 13 }}
          >
            <Camera size={15} /> Scan QR
          </button>
          {(query.trim().length > 0 || result !== null) && (
            <button
              type="button"
              onClick={() => clearVerification()}
              className="flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-gray-300 border border-white/10 transition-all hover:bg-white/5"
              style={{ fontSize: 13 }}
            >
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {result === 'notfound' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border overflow-hidden"
            style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}
          >
            <div className="flex gap-3 p-4">
              <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-black" style={{ fontSize: 13 }}>Ticket not recognized</p>
                <p className="text-red-200/90 mt-1 leading-relaxed" style={{ fontSize: 12 }}>
                  {notFoundHint || `No booking found for "${query}".`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && result !== 'notfound' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-2xl border overflow-hidden"
            style={{
              background: isCheckedIn ? 'rgba(34,197,94,0.05)' : 'rgba(0,71,171,0.05)',
              borderColor: isCheckedIn ? 'rgba(34,197,94,0.2)' : 'rgba(0,71,171,0.2)',
            }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              {scanMode === 'check_out' && (result as any).checkOutStatus === 'checked_out' ? (
                <CheckCircle size={15} className="text-blue-400" />
              ) : isCheckedIn ? (
                <CheckCircle size={15} className="text-green-400" />
              ) : (
                <QrCode size={15} className="text-[#60a5fa]" />
              )}
              <span className="text-white font-black" style={{ fontSize: 13 }}>
                {isCoachingResult(result)
                  ? 'Coaching Ticket Verification'
                  : scanMode === 'check_out'
                  ? (result as any).checkOutStatus === 'checked_out'
                    ? 'Already Checked Out'
                    : 'Booking verified'
                  : (result as any).checkInStatus === 'checked_in'
                    ? 'Already Checked In'
                    : 'Booking verified'}
              </span>
              <span className="ml-auto text-gray-500 font-black" style={{ fontSize: 11 }}>{result.refCode}</span>
            </div>
            {isCoachingResult(result) ? (
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: 'STUDENT', value: result.customerName || 'Student' },
                { label: 'COACH', value: result.coachName },
                { label: 'SPORT', value: result.sport },
                { label: 'DATE', value: result.date },
                { label: 'TIME', value: `${formatTime(result.time)}${result.endTime ? ` - ${formatTime(result.endTime)}` : ''}` },
                { label: 'STATUS', value: coachingCheckedOut ? 'Checked out' : coachingPaymentVerified ? 'Checked in' : 'Ready for payment' },
                { label: 'TOTAL', value: money(ticketTotal) },
                ...(ticketDownpayment != null ? [{ label: 'DOWNPAYMENT PAID', value: money(ticketDownpayment) }] : []),
                ...(ticketBalance != null ? [{ label: 'BALANCE DUE', value: money(ticketBalance) }] : []),
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-gray-600 font-black" style={{ fontSize: 9, letterSpacing: 0.5 }}>{f.label}</p>
                  <p className="text-white font-black" style={{ fontSize: 12 }}>{f.value}</p>
                </div>
              ))}
            </div>
            ) : (
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: 'CUSTOMER', value: result.customerName || 'Customer' },
                { label: 'COURT', value: result.court },
                { label: 'DATE', value: result.date },
                { label: 'TIME', value: `${formatTime(result.time)} · ${result.duration}h` },
                { label: 'TOTAL', value: money(ticketTotal) },
                ...(ticketDownpayment != null ? [{ label: 'DOWNPAYMENT PAID', value: money(ticketDownpayment) }] : []),
                ...(ticketBalance != null ? [{ label: 'BALANCE DUE', value: money(ticketBalance) }] : []),
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-gray-600 font-black" style={{ fontSize: 9, letterSpacing: 0.5 }}>{f.label}</p>
                  <p className="text-white font-black" style={{ fontSize: 12 }}>{f.value}</p>
                </div>
              ))}
            </div>
            )}

            {actionError ? (
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-amber-200 font-black" style={{ fontSize: 12 }}>
                  {actionError}
                </div>
              </div>
            ) : null}

            {isCoachingResult(result) && (
              <div className="px-4 pb-4 space-y-3">
                {result.status !== 'confirmed' && result.status !== 'completed' ? (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                    <p className="text-amber-200 font-black" style={{ fontSize: 12 }}>Coaching ticket is not ready for desk processing.</p>
                    <p className="text-amber-100/80 mt-1" style={{ fontSize: 11, lineHeight: 1.45 }}>Ask the student to confirm the downpayment status before check-in.</p>
                  </div>
                ) : coachingCheckedOut ? (
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-center">
                    <p className="text-blue-300 font-black" style={{ fontSize: 12 }}>Coaching session checked out.</p>
                    <p className="text-blue-100/75 mt-1" style={{ fontSize: 11 }}>This coaching ticket is completed.</p>
                  </div>
                ) : coachingPaymentVerified && scanMode === 'check_in' ? (
                  <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-center">
                    <p className="text-green-300 font-black" style={{ fontSize: 12 }}>Coaching ticket checked in.</p>
                    <p className="text-green-100/75 mt-1" style={{ fontSize: 11 }}>Switch to Check-out when the coaching session ends.</p>
                  </div>
                ) : coachingPaymentVerified && scanMode === 'check_out' ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({
                      type: 'coaching_check_out',
                      title: 'Confirm Coaching Check-out',
                      desc: `Mark ${result.customerName || 'the student'}'s ${result.sport} coaching session as completed?`
                    })}
                    disabled={checkingOut || !canCoachingCheckOut}
                    className="w-full py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', fontSize: 14, opacity: (checkingOut || !canCoachingCheckOut) ? 0.55 : 1 }}
                  >
                    {checkingOut ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</> : <><ShieldCheck size={16} /> Mark as Checked-Out</>}
                  </button>
                ) : (
                  <>
                    <p className="text-gray-500 text-center leading-relaxed" style={{ fontSize: 11 }}>
                      Confirm the student paid at the front desk before allowing coaching check-in.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmAction({
                          type: 'coaching_check_in',
                          title: 'Verify & Check In',
                          desc: `Mark ${result.customerName || 'the student'}'s ${result.sport} coaching session as paid and checked in?`
                        })}
                        disabled={checkingIn || scanMode === 'check_out'}
                        className="flex-1 py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', fontSize: 14, opacity: (checkingIn || scanMode === 'check_out') ? 0.55 : 1 }}
                      >
                        {checkingIn ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</> : <><ShieldCheck size={16} /> Verify & Check In</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isCoachingResult(result) && scanMode === 'check_in' && result.checkInStatus !== 'checked_in' && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-gray-500 text-center leading-relaxed" style={{ fontSize: 11 }}>
                  Details match the guest in front of you? Use check-in only after you have accepted them at the desk.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmAction({
                      type: 'check_in',
                      title: 'Confirm Check-in',
                      desc: `Are you sure you want to check in ${result.customerName || 'the guest'}? Make sure you have collected ${money(ticketBalance ?? ticketTotal)}.`
                    })}
                    disabled={checkingIn || rejecting || !canCheckIn}
                    className="flex-1 py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', fontSize: 14, opacity: (checkingIn || rejecting || !canCheckIn) ? 0.55 : 1 }}
                  >
                    {checkingIn ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
                    ) : (
                      <><ShieldCheck size={16} /> Mark as Checked-In</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({
                      type: 'reject',
                      title: 'Reject Ticket',
                      desc: `Are you sure you want to reject this ticket for ${result.customerName || 'the guest'}? This action will permanently cancel the booking.`
                    })}
                    disabled={checkingIn || rejecting || !canCheckIn}
                    className="px-4 py-3 rounded-xl text-red-300 font-black bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                    style={{ fontSize: 14, opacity: (checkingIn || rejecting || !canCheckIn) ? 0.55 : 1 }}
                  >
                    {rejecting ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><XCircle size={16} /> Reject</>
                    )}
                  </button>
                </div>
                {!canCheckIn && bookingStatus === 'cancelled' ? (
                  <p className="text-red-400 text-center font-black" style={{ fontSize: 11 }}>This booking has been cancelled or rejected.</p>
                ) : null}
                {!canCheckIn && isCompleted ? (
                  <p className="text-gray-600 text-center font-black" style={{ fontSize: 11 }}>This ticket is already checked out (completed).</p>
                ) : null}
                {!canCheckIn && isCheckedIn && !isCompleted && bookingStatus !== 'cancelled' ? (
                  <p className="text-gray-600 text-center font-black" style={{ fontSize: 11 }}>Already checked in — switch to Check-out to finish.</p>
                ) : null}
              </div>
            )}
            {!isCoachingResult(result) && scanMode === 'check_out' && (result as any).checkOutStatus !== 'checked_out' && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-gray-500 text-center leading-relaxed" style={{ fontSize: 11 }}>
                  Guest finished their session? Use check-out to record the end time in the activity log.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmAction({
                    type: 'check_out',
                    title: 'Confirm Check-out',
                    desc: `Are you sure you want to check out ${result.customerName || 'the guest'}? This will mark the session as completed.`
                  })}
                  disabled={checkingOut || !canCheckOut}
                  className="w-full py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', fontSize: 14, opacity: (checkingOut || !canCheckOut) ? 0.55 : 1 }}
                >
                  {checkingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Mark as Checked-Out
                    </>
                  )}
                </button>
                {!canCheckOut && !isCheckedIn && !isCompleted ? (
                  <div className="text-center space-y-1">
                    <p className="text-amber-200/80 font-black" style={{ fontSize: 11 }}>Not checked in yet — check-in first to avoid mistakes.</p>
                    <button
                      type="button"
                      onClick={() => setScanMode('check_in')}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-xl font-black text-emerald-200 border border-emerald-500/25 hover:bg-emerald-500/10 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Switch to Check-in
                    </button>
                  </div>
                ) : null}
                {!canCheckOut && isCompleted ? (
                  <p className="text-gray-600 text-center font-black" style={{ fontSize: 11 }}>This ticket is already checked out (completed).</p>
                ) : null}
              </div>
            )}
            {!isCoachingResult(result) && scanMode === 'check_in' && result.checkInStatus === 'checked_in' && result.checkInTime && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-green-400 font-black text-center" style={{ fontSize: 12 }}>
                  Checked in at{' '}
                  {formatLiveOpsTime(result.checkInTime)}
                </p>
                <button
                  type="button"
                  onClick={() => clearVerification()}
                  className="w-full py-3 rounded-xl font-black text-gray-200 border border-white/12 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                  style={{ fontSize: 13 }}
                >
                  <RotateCcw size={15} /> Verify next guest
                </button>
              </div>
            )}
            {!isCoachingResult(result) && scanMode === 'check_out' && (result as any).checkOutStatus === 'checked_out' && (result as any).checkOutTime && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-blue-400 font-black text-center" style={{ fontSize: 12 }}>
                  Checked out at{' '}
                  {formatLiveOpsTime((result as any).checkOutTime)}
                </p>
                <button
                  type="button"
                  onClick={() => clearVerification()}
                  className="w-full py-3 rounded-xl font-black text-gray-200 border border-white/12 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                  style={{ fontSize: 13 }}
                >
                  <RotateCcw size={15} /> Verify next guest
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(0,71,171,0.06)', border: '1px solid rgba(0,71,171,0.15)' }}>
          <p className="text-blue-300 font-black mb-1" style={{ fontSize: 11 }}>Desk flow</p>
          <p className="text-gray-500" style={{ fontSize: 11, lineHeight: 1.55 }}>
            <span className="text-gray-400 font-black">1.</span> Scan receipt QR or search by code (guests can save the QR from their receipt to this device).
            <br />
            <span className="text-gray-400 font-black">2.</span> Confirm name, court, and time with the guest.
            <br />
            <span className="text-gray-400 font-black">3.</span> Tap <span className="text-gray-400 font-black">Mark as Checked-In</span> when they are at the desk.
            <br />
            <span className="text-gray-400 font-black">Tip:</span> If you switch browser tabs while scanning, tap <span className="text-gray-400 font-black">Scan QR</span> again. Use <span className="text-gray-400 font-black">Clear</span> to reset the field and result.
          </p>
        </div>
      )}

      <AnimatePresence>
        {cameraOpen && (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setCameraOpen(false)}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141824] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div>
                  <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10, letterSpacing: 1 }}>Scan ticket</p>
                  <p className="text-white font-black" style={{ fontSize: 17 }}>Point camera at QR</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                  aria-label="Close scanner"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-gray-500 text-center leading-relaxed" style={{ fontSize: 12 }}>
                  Align the <span className="text-blue-300 font-black">JRC SportSync</span> receipt QR inside the square. Other QR codes will show an error after scan.
                </p>
                {cameraError ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 font-black space-y-3" style={{ fontSize: 12 }}>
                    <p>{cameraError}</p>
                    {/older app version|Refresh this page/i.test(cameraError) && (
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full rounded-xl bg-amber-400 px-3 py-2 text-black font-black hover:bg-amber-300 transition-colors"
                        style={{ fontSize: 12 }}
                      >
                        Refresh scanner
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    id={readerId}
                    className="rounded-2xl overflow-hidden bg-black border border-white/10 min-h-[260px] w-full"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="w-full py-3 rounded-2xl font-black text-gray-300 border border-white/10 hover:bg-white/5"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[#1A1A1A] rounded-2xl border border-white/10 p-5 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: (confirmAction.type === 'check_in' || confirmAction.type === 'coaching_check_in') ? 'rgba(34,197,94,0.1)' :
                                (confirmAction.type === 'reject' || confirmAction.type === 'coaching_reject') ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                  }}
                >
                  <AlertCircle size={24} className={
                    (confirmAction.type === 'check_in' || confirmAction.type === 'coaching_check_in') ? 'text-green-400' :
                    (confirmAction.type === 'reject' || confirmAction.type === 'coaching_reject') ? 'text-red-400' : 'text-blue-400'
                  } />
                </div>
                <h3 className="text-white font-black text-lg mb-2">{confirmAction.title}</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">{confirmAction.desc}</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-3 rounded-xl font-black text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void executeConfirmAction()}
                    className="flex-1 py-3 rounded-xl font-black text-white transition-colors"
                    style={{
                      background: (confirmAction.type === 'check_in' || confirmAction.type === 'coaching_check_in') ? 'linear-gradient(135deg,#22c55e,#16a34a)' :
                                  (confirmAction.type === 'reject' || confirmAction.type === 'coaching_reject') ? 'linear-gradient(135deg,#ef4444,#dc2626)' :
                                  'linear-gradient(135deg,#3b82f6,#2563eb)'
                    }}
                  >
                    Confirm
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

// ── Activity log: Manila time + rich fields (staff_operations → bookings) ───
const ACTIVITY_TZ = 'Asia/Manila';

/**
 * Supabase often returns `timestamptz` as ISO with `Z`, but some paths return
 * `YYYY-MM-DDTHH:mm:ss` without offset (UTC instant stored naïvely). Parsing the latter
 * as local time shifts Manila wall clocks by 8h — treat naive strings as UTC.
 */
function parseActivityUtcMillis(iso: string | number | null | undefined): number {
  if (iso == null) return NaN;
  if (typeof iso === 'number' && Number.isFinite(iso)) return iso;
  if (typeof iso !== 'string') return NaN;
  const s = iso.trim();
  if (!s) return NaN;
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s).getTime();
  }
  const norm = s.includes('T') ? s : s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(norm)) {
    const asUtc = new Date(`${norm}Z`);
    if (!Number.isNaN(asUtc.getTime())) return asUtc.getTime();
  }
  return new Date(norm).getTime();
}

function formatPersonDisplayName(raw: string): string {
  if (!raw || raw === '—') return '—';
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]{2,3}$/.test(part)) return part;
      if (part.includes('-')) {
        return part
          .split('-')
          .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : ''))
          .join('-');
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function buildDemoStaffActivity(): any[] {
  const today = new Date().toISOString().split('T')[0];
  const iso = (h: number) => `${String(h).padStart(2, '0')}:00:00`;
  const sportForCourt = (court: string) =>
    court.includes('Badminton') ? 'Badminton' : court.includes('Pickleball') ? 'Pickleball' : court.includes('Volleyball') ? 'Volleyball' : 'Basketball';
  const mk = (
    id: string,
    action: string,
    name: string,
    phone: string,
    court: string,
    startH: number,
    ref: string,
    minsAgo: number,
  ) => {
    const endH = startH + 3;
    return {
      id,
      action,
      notes: 'Demo row — replace when the API returns live staff_operations from Supabase.',
      created_at: new Date(Date.now() - minsAgo * 60_000).toISOString(),
      staff_id: null,
      booking_id: `demo-booking-${id}`,
      bookings: {
        id: `demo-booking-${id}`,
        booking_date: today,
        start_time: iso(startH),
        end_time: iso(endH),
        status: 'confirmed',
        total_price: 1350,
        qr_code_token: ref,
        notes: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          addOns: 'Lights (evening) | Aircon (₱1,500/hr × 3h)',
          source: action === 'walk_in_booking' ? 'walk_in' : 'map_staff',
          paymentMethod: 'cash',
          sport: sportForCourt(court),
        }),
        courts: { name: court, sports: { name: sportForCourt(court) } },
      },
    };
  };
  return [
    mk('demo-op-1', 'walk_in_booking', 'Rico Mendoza', '09171234567', 'Basketball 1', 18, 'JRC-DEMO1A', 12),
    mk('demo-op-2', 'check_in', 'Aira Dela Cruz', '09981239876', 'Badminton 2', 19, 'JRC-DEMO1B', 45),
    mk('demo-op-3', 'desk_booking', 'Kenji Flores', '09158881234', 'Pickleball 1', 16, 'JRC-DEMO1C', 120),
  ];
}

function parseActivityBookingNotes(notes: string | null | undefined): Record<string, unknown> {
  if (!notes) return {};
  try {
    const o = JSON.parse(notes) as Record<string, unknown>;
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

function formatActivityTime12(t: string | null | undefined): string {
  if (!t) return '—';
  const p = t.toString().split(':').map((x) => parseInt(x, 10));
  const h = p[0] ?? 0;
  const m = p[1] ?? 0;
  const mod = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${mod}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Wall-clock in Philippines */
function formatActivityLoggedAt(iso: string | number | null | undefined): string {
  const ms = parseActivityUtcMillis(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString('en-PH', {
    timeZone: ACTIVITY_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatActivityLoggedDate(iso: string | number | null | undefined): string {
  const ms = parseActivityUtcMillis(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-PH', {
    timeZone: ACTIVITY_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatActivityLoggedTime(iso: string | number | null | undefined): string {
  const ms = parseActivityUtcMillis(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleTimeString('en-PH', {
    timeZone: ACTIVITY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function manilaDateKeyFromIso(iso: string | number | null | undefined): string {
  const ms = parseActivityUtcMillis(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: ACTIVITY_TZ });
}

function manilaTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ACTIVITY_TZ });
}

function formatRelativeShort(iso: string | number | null | undefined): string {
  const t = parseActivityUtcMillis(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const ACTIVITY_ACTION_META: Record<string, { title: string; blurb: string }> = {
  walk_in_booking: {
    title: 'Walk-in booking',
    blurb: 'Staff recorded a new walk-in reservation at the front desk.',
  },
  desk_booking: {
    title: 'Desk / map booking',
    blurb: 'Staff or customer completed a booking through the facility map or desk flow.',
  },
  check_in: {
    title: 'Check-in',
    blurb: 'Guest checked in with a ticket or QR code.',
  },
  coaching_check_in: {
    title: 'Coaching check-in',
    blurb: 'Front desk verified payment and checked in a coaching ticket.',
  },
  check_out: {
    title: 'Check-out',
    blurb: 'Guest checked out at the desk after finishing their session.',
  },
  coaching_check_out: {
    title: 'Coaching check-out',
    blurb: 'Front desk completed a coaching session ticket.',
  },
  coaching_reschedule_requested: {
    title: 'Coaching reschedule requested',
    blurb: 'Coach asked the front desk to coordinate a new slot or refund path.',
  },
};

function formatActivityAction(action: string | undefined): string {
  const k = String(action || '').toLowerCase();
  return ACTIVITY_ACTION_META[k]?.title || String(action || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeBookingStatus(s: string | undefined): string {
  if (!s) return '—';
  const m: Record<string, string> = {
    confirmed: 'Reserved',
    checked_in: 'Checked in',
    pending: 'Pending payment',
    pending_payment: 'Pending',
    pending_verification: 'Pending review',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };
  return m[s] || s.replace(/_/g, ' ');
}

function formatSourceChannel(raw: unknown): string {
  const s = String(raw || '').toLowerCase();
  if (s.includes('walk')) return 'Walk-in (desk)';
  if (s.includes('map_staff')) return 'Facility map (staff)';
  if (s.includes('map_customer')) return 'Facility map (customer app)';
  if (s.includes('ai') || s.includes('concierge')) return 'Customer app';
  if (s.includes('desk')) return 'Desk';
  if (s.includes('staff')) return 'Staff dashboard';
  return s ? s.replace(/_/g, ' ') : '—';
}

type ActivitySortKey = 'loggedAt' | 'action' | 'customer' | 'court' | 'ref';
type ActivityPeriod = 'today' | '7d' | '30d' | 'all';

function activityTone(actionKey: string) {
  if (actionKey.includes('check_in')) return { fg: '#86efac', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.24)' };
  if (actionKey.includes('check_out')) return { fg: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.24)' };
  if (actionKey.includes('reject') || actionKey.includes('cancel')) return { fg: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.24)' };
  if (actionKey.includes('approved')) return { fg: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.24)' };
  return { fg: '#fdba74', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.24)' };
}

function flattenActivityRow(row: any) {
  const b = row.bookings;
  const meta = b?.notes ? parseActivityBookingNotes(b.notes) : {};
  const loggedAtMsRaw = parseActivityUtcMillis(row.created_at);
  const loggedAtMs = Number.isNaN(loggedAtMsRaw) ? 0 : loggedAtMsRaw;
  const customerRaw =
    (meta.customerName as string) ||
    (meta.customer_name as string) ||
    '';
  const customer = customerRaw ? formatPersonDisplayName(customerRaw) : '—';
  const sportMeta = (meta.sport as string) || b?.courts?.sports?.name || '—';
  const actionKey = String(row.action || '').toLowerCase();
  const metaBlurb = ACTIVITY_ACTION_META[actionKey]?.blurb || '';
  const amount = b?.total_price != null ? Number(b.total_price) : null;
  const payMethod = (meta.paymentMethod as string) || (meta.payment_method as string) || '—';
  const addOns = (meta.addOns as string) || (meta.add_ons as string) || '';
  const facilityMapId = (meta.facilityMapId as string) || (meta.facility_map_id as string) || '';
  const timeRange =
    b?.start_time && b?.end_time
      ? `${formatActivityTime12(b.start_time)} – ${formatActivityTime12(b.end_time)}`
      : formatActivityTime12(b?.start_time);

  const summaryLine = b
    ? `${formatActivityAction(row.action)} · ${b.courts?.name || 'Court'} · ${customer !== '—' ? customer : 'Guest'}`
    : `${formatActivityAction(row.action)} · ${row.notes ? String(row.notes).slice(0, 80) : 'No booking'}`;

  return {
    raw: row,
    id: String(row.id),
    loggedAtMs,
    loggedAtLabel: formatActivityLoggedAt(row.created_at),
    loggedDateLabel: formatActivityLoggedDate(row.created_at),
    loggedTimeLabel: formatActivityLoggedTime(row.created_at),
    loggedManilaDate: manilaDateKeyFromIso(row.created_at),
    relativeLabel: formatRelativeShort(row.created_at),
    actionKey,
    actionLabel: formatActivityAction(row.action),
    actionBlurb: metaBlurb,
    customer,
    phone: (meta.customerPhone as string) || (meta.customer_phone as string) || '—',
    court: b?.courts?.name || '—',
    sport: sportMeta,
    bookingDate: b?.booking_date || '—',
    bookingDateLabel:
      b?.booking_date && b.booking_date !== '—'
        ? new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-PH', {
            timeZone: ACTIVITY_TZ,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '—',
    startLabel: formatActivityTime12(b?.start_time),
    endLabel: formatActivityTime12(b?.end_time),
    timeRange,
    bookingStatus: humanizeBookingStatus(b?.status),
    amount,
    paymentMethod: payMethod,
    addOns,
    facilityMapId: facilityMapId || '—',
    sourceChannel: formatSourceChannel(meta.source),
    ref: b?.qr_code_token || (meta.refCode as string) || '—',
    bookingId: b?.id || row.booking_id || '—',
    staffNotes: row.notes ? String(row.notes) : '',
    staffId: row.staff_id ? String(row.staff_id) : '—',
    summaryLine,
    customerRaw: customerRaw || '',
  };
}

type FlatActivityRow = ReturnType<typeof flattenActivityRow>;

function escapeCsvCell(v: string): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function activityLogToCsv(rows: FlatActivityRow[]): string {
  const headers = ['When_PH', 'What', 'Summary', 'Customer', 'Court', 'Ticket', 'Booking_ID', 'Staff_ID'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.loggedAtLabel),
        escapeCsvCell(r.actionLabel),
        escapeCsvCell(r.summaryLine),
        escapeCsvCell(r.customer),
        escapeCsvCell(r.court),
        escapeCsvCell(r.ref),
        escapeCsvCell(r.bookingId),
        escapeCsvCell(r.staffId),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

function triggerTextDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Staff activity (desk + check-ins from Supabase) ─────────────────────────
function StaffActivityLog() {
  const [ops, setOps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listCleared, setListCleared] = useState(false);
  const [sortKey, setSortKey] = useState<ActivitySortKey>('loggedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [period, setPeriod] = useState<ActivityPeriod>('7d');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setListCleared(false);
    const date = getManilaDateKey();
    try {
      const ac = new AbortController();
      const timer = window.setTimeout(() => ac.abort(), 8000);
      const res = await apiFetch(`/api/staff/operations?date=${encodeURIComponent(date)}`, {
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      window.clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const list = Array.isArray(d?.operations) ? d.operations : [];
      if (list.length > 0) {
        setOps(list);
        setUsingDemo(false);
      } else {
        setOps(buildDemoStaffActivity());
        setUsingDemo(true);
      }
    } catch (e: any) {
      setLoadError(e?.name === 'AbortError' ? 'Request timed out — is the API running?' : (e?.message || 'Could not load'));
      setOps(buildDemoStaffActivity());
      setUsingDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => ops.map(flattenActivityRow), [ops]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'loggedAt':
          cmp = a.loggedAtMs - b.loggedAtMs;
          break;
        case 'action':
          cmp = a.actionLabel.localeCompare(b.actionLabel);
          break;
        case 'customer':
          cmp = a.customer.localeCompare(b.customer);
          break;
        case 'court':
          cmp = a.court.localeCompare(b.court);
          break;
        case 'ref':
          cmp = a.ref.localeCompare(b.ref);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((r) => {
      if (period === 'today' && r.loggedManilaDate !== manilaTodayKey()) return false;
      if (period === '7d' && Date.now() - r.loggedAtMs > 7 * 86400_000) return false;
      if (period === '30d' && Date.now() - r.loggedAtMs > 30 * 86400_000) return false;
      if (actionFilter !== 'all' && r.actionKey !== actionFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = [r.customer, r.customerRaw, r.court, r.ref, r.summaryLine, r.bookingId, r.sport, r.phone, r.actionLabel]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedRows, period, actionFilter, searchQuery]);

  const toggleSort = (key: ActivitySortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'loggedAt' ? 'desc' : 'asc');
    }
  };

  const SortHead = ({ k, label, className = '' }: { k: ActivitySortKey; label: string; className?: string }) => {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 font-black text-left uppercase tracking-wide text-gray-500 hover:text-gray-300 transition-colors ${className}`}
        style={{ fontSize: 10 }}
      >
        {label}
        <ArrowUpDown size={11} className={active ? 'text-blue-400' : 'opacity-40'} />
        {active && <span className="text-blue-500 font-black normal-case" style={{ fontSize: 9 }}>({sortDir})</span>}
      </button>
    );
  };

  const handleClearList = () => {
    setOps([]);
    setDetailRow(null);
    setListCleared(true);
    setShowClearModal(false);
  };

  const runExport = () => {
    if (filteredRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (exportFormat === 'csv') {
      triggerTextDownload(`activity-log-${stamp}.csv`, activityLogToCsv(filteredRows), 'text/csv;charset=utf-8');
    } else {
      const payload = filteredRows.map((r) => ({
        when_ph: r.loggedAtLabel,
        what: r.actionLabel,
        summary: r.summaryLine,
        customer: r.customer,
        court: r.court,
        ticket: r.ref,
        booking_id: r.bookingId,
        staff_id: r.staffId,
      }));
      triggerTextDownload(`activity-log-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
    setShowExportModal(false);
  };

  const detailFlat = detailRow ? flattenActivityRow(detailRow) : null;
  const rawNotesForDetails = detailRow?.bookings?.notes
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(detailRow.bookings.notes), null, 2);
        } catch {
          return String(detailRow.bookings.notes);
        }
      })()
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-white font-black" style={{ fontSize: 24 }}>Activity Log</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>
            Walk-ins, desk bookings, and check-ins. Times are shown in Philippines (Manila).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={filteredRows.length === 0 || isLoading || listCleared}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-emerald-200 border border-emerald-500/25 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
            style={{ fontSize: 12 }}
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            disabled={ops.length === 0 || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-red-300 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            style={{ fontSize: 12 }}
          >
            <Trash2 size={14} /> Clear
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-white border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
            style={{ fontSize: 12 }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Refresh
          </button>
        </div>
      </div>

      {listCleared && (
        <div
          className="rounded-xl px-4 py-3 border font-black flex flex-wrap items-center gap-3"
          style={{ fontSize: 12, background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}
        >
          <span>Table cleared for this tab only.</span>
          <button type="button" onClick={() => void load()} className="underline font-black hover:text-white">Reload</button>
        </div>
      )}

      {(usingDemo || loadError) && !listCleared && (
        <div
          className="rounded-xl px-4 py-3 border font-black"
          style={{ fontSize: 12, background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.25)', color: '#fcd34d' }}
        >
          {usingDemo && <span>Showing sample rows until the server returns real activity.</span>}
          {loadError && <span className="text-amber-200/90"> {loadError}</span>}
        </div>
      )}

      {!listCleared && ops.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-[#1a1f2e] px-3 py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
            <div className="flex items-center gap-1.5 text-gray-500 flex-shrink-0">
              <Filter size={13} className="text-blue-400" />
              <span className="font-black" style={{ fontSize: 10 }}>FILTER</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <PillSelect<ActivityPeriod>
                ariaLabel="Filter by period"
                value={period}
                onChange={setPeriod}
                options={[
                  { id: 'today', label: 'Today', icon: <Clock size={14} /> },
                  { id: '7d', label: 'Last 7 days', icon: <Calendar size={14} />, hint: 'Rolling window' },
                  { id: '30d', label: 'Last 30 days', icon: <Calendar size={14} />, hint: 'Rolling window' },
                  { id: 'all', label: 'All loaded', icon: <Layers size={14} /> },
                ]}
              />
              <PillSelect<string>
                ariaLabel="Filter by activity type"
                value={actionFilter}
                onChange={setActionFilter}
                options={[
                  { id: 'all', label: 'All types', icon: <Filter size={14} /> },
                  { id: 'walk_in_booking', label: 'Walk-in', icon: <Users size={14} /> },
                  { id: 'desk_booking', label: 'Desk / map', icon: <Map size={14} /> },
                  { id: 'check_in', label: 'Check-in', icon: <ShieldCheck size={14} /> },
                  { id: 'check_out', label: 'Check-out', icon: <LogOut size={14} /> },
                ]}
              />
              <div className="relative flex-1 min-w-[160px] max-w-md">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg pl-8 pr-3 py-1.5 bg-white/[0.06] text-gray-100 placeholder:text-gray-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-black"
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>
            <span className="text-gray-600 font-black whitespace-nowrap lg:ml-auto" style={{ fontSize: 10 }}>
              {filteredRows.length} / {sortedRows.length}
            </span>
          </div>
        </div>
      )}

      <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
        {isLoading && ops.length === 0 && !listCleared ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-400" size={28} /></div>
        ) : ops.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-gray-500 font-black" style={{ fontSize: 14 }}>No activity in this view.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-xl font-black text-blue-300 border border-blue-500/30 hover:bg-blue-500/10"
              style={{ fontSize: 12 }}
            >
              Reload from server
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-gray-500 font-black" style={{ fontSize: 14 }}>No entries match your filters.</p>
            <button
              type="button"
              onClick={() => {
                setPeriod('all');
                setActionFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl font-black text-blue-300 border border-blue-500/30 hover:bg-blue-500/10"
              style={{ fontSize: 12 }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
            <table className="w-full text-left min-w-[880px]">
              <thead className="sticky top-0 z-10 bg-[#141820] border-b border-white/8">
                <tr>
                  <th className="px-4 py-2.5 w-10 align-middle" />
                  <th className="px-3 py-2.5 align-middle"><SortHead k="loggedAt" label="When (PH)" /></th>
                  <th className="px-3 py-2.5 align-middle"><SortHead k="action" label="What" /></th>
                  <th className="px-3 py-2.5 min-w-[200px] align-middle"><span className="font-black uppercase tracking-wide text-gray-500" style={{ fontSize: 10 }}>Summary</span></th>
                  <th className="px-3 py-2.5 align-middle"><SortHead k="customer" label="Customer" /></th>
                  <th className="px-3 py-2.5 align-middle"><SortHead k="court" label="Court" /></th>
                  <th className="px-3 py-2.5 align-middle"><SortHead k="ref" label="Ticket" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredRows.map((r, idx) => {
                  const tone = activityTone(r.actionKey);
                  return (
                  <tr
                    key={r.id}
                    onClick={() => setDetailRow(r.raw)}
                    className={`cursor-pointer transition-colors group ${idx % 2 === 0 ? 'bg-white/[0.025]' : 'bg-transparent'} hover:bg-blue-500/[0.07]`}
                  >
                    <td className="px-4 py-3 text-gray-600 align-middle">
                      <Eye size={14} className="opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="rounded-lg bg-white/[0.06] border border-white/10 text-gray-200 px-2.5 py-1.5 inline-block min-w-0">
                        <p className="font-black whitespace-nowrap" style={{ fontSize: 12 }}>{r.loggedDateLabel}</p>
                        <p className="text-gray-300 font-black mt-0.5 whitespace-nowrap" style={{ fontSize: 11 }}>{r.loggedTimeLabel}</p>
                        <p className="text-gray-500 font-black mt-0.5" style={{ fontSize: 10 }}>{r.relativeLabel}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="rounded-full border px-2.5 py-1.5 font-black inline-flex" style={{ fontSize: 12, color: tone.fg, background: tone.bg, borderColor: tone.border }}>
                        {r.actionLabel}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[320px]">
                      <div className="text-gray-200 leading-snug font-medium" style={{ fontSize: 12 }}>
                        {r.summaryLine}
                      </div>
                      <div className="mt-1 text-gray-500 font-black" style={{ fontSize: 10 }}>{r.sourceChannel}</div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="text-gray-100 font-black" style={{ fontSize: 12 }}>
                        {r.customer}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="text-gray-300" style={{ fontSize: 12 }}>
                        {r.court}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="rounded-lg bg-white/[0.06] border border-white/10 text-gray-300 px-2.5 py-2 font-mono" style={{ fontSize: 11 }}>
                        {r.ref}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {detailRow && detailFlat && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setDetailRow(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[min(88vh,680px)] flex flex-col rounded-3xl border border-white/10 shadow-2xl bg-[#1A1D26] overflow-hidden"
            >
              <div className="flex-shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.07] bg-gradient-to-r from-[#0047AB]/20 to-transparent">
                <div className="min-w-0">
                  <p className="text-blue-300/90 font-black uppercase tracking-wider" style={{ fontSize: 10 }}>Activity</p>
                  <p className="text-white font-black truncate" style={{ fontSize: 20 }}>{detailFlat.actionLabel}</p>
                  <p className="text-gray-500 font-black mt-1" style={{ fontSize: 11 }}>{detailFlat.loggedAtLabel} · {detailFlat.relativeLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
                <p className="text-gray-300 leading-relaxed" style={{ fontSize: 13 }}>
                  {detailFlat.actionBlurb || 'Recorded from the staff dashboard or check-in flow.'}
                </p>

                <div className="rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
                  <p className="px-4 py-2 text-gray-500 font-black uppercase border-b border-white/[0.06]" style={{ fontSize: 10 }}>At a glance</p>
                  <div className="px-4 py-1 divide-y divide-white/[0.06]">
                    {detailRow.bookings ? (
                      <>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Guest</span>
                          <span className="text-white font-black text-right" style={{ fontSize: 13 }}>{detailFlat.customer}</span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Court & sport</span>
                          <span className="text-white font-black text-right" style={{ fontSize: 13 }}>{detailFlat.court} · {detailFlat.sport}</span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Play schedule</span>
                          <span className="text-white font-black text-right" style={{ fontSize: 13 }}>{detailFlat.bookingDateLabel}</span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Session time</span>
                          <span className="text-white font-black text-right" style={{ fontSize: 13 }}>{detailFlat.timeRange}</span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Ticket code</span>
                          <span className="text-blue-300 font-mono font-black" style={{ fontSize: 13 }}>{detailFlat.ref}</span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Booking status</span>
                          <span className="text-emerald-300 font-black" style={{ fontSize: 13 }}>{detailFlat.bookingStatus}</span>
                        </div>
                        {detailFlat.amount != null && Number.isFinite(detailFlat.amount) && (
                          <div className="py-2.5 flex justify-between gap-3">
                            <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Amount</span>
                            <span className="text-white font-black" style={{ fontSize: 13 }}>₱{detailFlat.amount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="py-2.5 flex justify-between gap-3">
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Recorded from</span>
                          <span className="text-gray-200 font-black text-right" style={{ fontSize: 12 }}>{detailFlat.sourceChannel}</span>
                        </div>
                        {detailFlat.paymentMethod && detailFlat.paymentMethod !== '—' && (
                          <div className="py-2.5 flex justify-between gap-3">
                            <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Payment</span>
                            <span className="text-gray-200 font-black uppercase" style={{ fontSize: 12 }}>{detailFlat.paymentMethod}</span>
                          </div>
                        )}
                        {detailFlat.addOns ? (
                          <div className="py-2.5">
                            <span className="text-gray-500 font-black block mb-1" style={{ fontSize: 11 }}>Add-ons & extras</span>
                            <span className="text-gray-300 leading-snug block" style={{ fontSize: 12 }}>{detailFlat.addOns}</span>
                          </div>
                        ) : null}
                        {detailFlat.facilityMapId && detailFlat.facilityMapId !== '—' ? (
                          <div className="py-2.5 flex justify-between gap-3">
                            <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>Facility map</span>
                            <span className="text-gray-400 font-mono text-right text-xs break-all">{detailFlat.facilityMapId}</span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="py-4 text-gray-500 font-black" style={{ fontSize: 12 }}>No booking row linked — this may be a staff-only note.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 space-y-2">
                  <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Technical reference</p>
                  <div className="grid gap-1.5 text-xs font-mono text-gray-500 break-all">
                    <div><span className="text-gray-600">Operation</span> {detailFlat.id}</div>
                    <div><span className="text-gray-600">Booking</span> {detailFlat.bookingId}</div>
                    <div><span className="text-gray-600">Staff user</span> {detailFlat.staffId}</div>
                  </div>
                  {detailFlat.staffNotes && !detailFlat.staffNotes.startsWith('Demo row') && (
                    <p className="text-gray-400 pt-2 border-t border-white/[0.06]" style={{ fontSize: 12 }}>
                      <span className="text-gray-600 font-black uppercase block mb-1" style={{ fontSize: 9 }}>Desk note</span>
                      {detailFlat.staffNotes}
                    </p>
                  )}
                  {rawNotesForDetails ? (
                    <details className="pt-2 border-t border-white/[0.06] group">
                      <summary className="cursor-pointer text-gray-500 font-black hover:text-gray-400" style={{ fontSize: 11 }}>
                        Raw booking metadata (advanced)
                      </summary>
                      <pre className="mt-2 rounded-xl p-3 bg-black/50 border border-white/[0.06] text-gray-500 overflow-x-auto font-mono whitespace-pre-wrap" style={{ fontSize: 10, lineHeight: 1.5 }}>
                        {rawNotesForDetails}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </div>

              <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.07] bg-[#151821]">
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="w-full py-3 rounded-2xl font-black text-white bg-[#0047AB] hover:brightness-110 transition-all"
                  style={{ fontSize: 14 }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearModal && (
          <ConfirmModal
            opts={{
              title: 'Clear this table?',
              body: 'Rows disappear only in this browser tab. Use Refresh to load them again from the server. Nothing is deleted in the database.',
              confirmLabel: 'Clear',
              confirmColor: '#ef4444',
              stackZ: 'z-[1100]',
              icon: <Trash2 size={26} className="text-red-400" />,
              onConfirm: handleClearList,
              onCancel: () => setShowClearModal(false),
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <div
            role="presentation"
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1E27] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.28)' }}
              >
                <Download size={26} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-black text-center mb-1" style={{ fontSize: 17 }}>Export activity</h3>
              <p className="text-gray-400 text-center mb-5" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Save <span className="text-white font-black">{filteredRows.length}</span> row{filteredRows.length === 1 ? '' : 's'} currently shown (filters apply).
              </p>
              <label className="block text-gray-500 font-black uppercase mb-1.5" style={{ fontSize: 10 }}>Format</label>
              <div className="mb-5">
                <PillSelect<'csv' | 'json'>
                  ariaLabel="Export format"
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={[
                    { id: 'csv', label: 'CSV (Excel / Sheets)', icon: <Download size={14} /> },
                    { id: 'json', label: 'JSON', icon: <Layers size={14} /> },
                  ]}
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#252836] text-gray-300 font-black hover:bg-[#2E3244] transition-colors border border-white/[0.07]"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runExport}
                  disabled={filteredRows.length === 0}
                  className="flex-1 py-3 rounded-xl text-white font-black transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ fontSize: 13, background: 'linear-gradient(135deg, #059669, #047857)' }}
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Live Operations ──────────────────────────────────────────────────────────
function LiveOperations() {
  const { bookings, refreshBookingsFromApi } = useUser();
  const { maps, updateBlockStatus } = useFacilityMap();
  const [view, setView] = useState<'map' | 'list' | 'verify'>('map');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [maintenancePrompt, setMaintenancePrompt] = useState<{
    court: CourtBlock;
    target: 'available' | 'maintenance';
    blockedCount: number;
  } | null>(null);
  const [operationsData, setOperationsData] = useState<{
    bookingsCount: number;
    revenue: number;
    activeCourts: number;
    pendingRequests: number;
  } | null>(null);
  const [opsHydrated, setOpsHydrated] = useState(false);

  const publishedMaps = useMemo(() => maps.filter((m) => m.isPublished), [maps]);
  const activeMap = selectedMapId
    ? publishedMaps.find((m) => m.id === selectedMapId) ?? publishedMaps[0]
    : publishedMaps[0];
  const publishedLayout = activeMap?.blocks ?? [];

  const loadLiveOperations = useCallback(async () => {
    const todayStr = getManilaDateKey();
    const currentMinutes = toMinutesOfDay(getManilaTimeKey());
    try {
      const res = await apiFetch(`/api/staff/operations?date=${encodeURIComponent(todayStr)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as {
        bookingsCount?: number;
        revenue?: number;
        pendingRequests?: number;
      };
      const bookingsCount = Number(d.bookingsCount ?? 0);
      const revenue = Number(d.revenue ?? 0);
      const pendingRequests = Number(d.pendingRequests ?? 0);

      const activeCourtNames = new Set<string>();
      for (const booking of bookings) {
        if (booking.date !== todayStr) continue;
        if (booking.status !== 'confirmed') continue;
        const startMinutes = toMinutesOfDay(booking.time || '00:00');
        const durationMins = Math.max(1, Math.round(Number(booking.duration ?? 1) * 60));
        const endMinutes = startMinutes + durationMins;
        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) continue;
        const courtName = String(booking.court || '').trim();
        if (!courtName) continue;
        if (
          !bookingAppliesToPublishedMap(
            { court: courtName, facilityMapId: booking.facilityMapId },
            courtName,
            activeMap?.id,
            publishedMaps,
          )
        ) {
          continue;
        }
        activeCourtNames.add(courtName);
      }

      setOperationsData({
        bookingsCount,
        revenue,
        activeCourts: activeCourtNames.size,
        pendingRequests,
      });
      setOpsHydrated(true);
    } catch (err) {
      console.error('Failed to load live operations:', err);
      setOperationsData({ bookingsCount: 0, revenue: 0, activeCourts: 0, pendingRequests: 0 });
      setOpsHydrated(true);
    }
  }, [activeMap?.id, publishedMaps, bookings]);

  useEffect(() => {
    void refreshBookingsFromApi();
  }, [refreshBookingsFromApi]);

  useEffect(() => {
    void loadLiveOperations();
    const id = window.setInterval(() => {
      void loadLiveOperations();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [loadLiveOperations]);

  const todayBookingsCount = opsHydrated ? (operationsData?.bookingsCount ?? 0) : null;
  const totalRevToday = opsHydrated ? (operationsData?.revenue ?? 0) : null;
  const openCourts = opsHydrated ? (operationsData?.activeCourts ?? 0) : null;
  const pendingCancellations = opsHydrated ? (operationsData?.pendingRequests ?? 0) : null;

  const sportGroups = publishedLayout
    .reduce<Record<string, typeof publishedLayout>>((acc, court) => {
      (acc[court.sport] = acc[court.sport] || []).push(court);
      return acc;
    }, {});
  const allSports = Object.keys(sportGroups);

  const KPIs = [
    { label: "Today's Revenue", value: totalRevToday === null ? '—' : `₱${Number(totalRevToday).toLocaleString()}`, icon: DollarSign, color: '#FF8C00', bg: '#2A1F0A' },
    { label: "Today's Bookings", value: todayBookingsCount === null ? '—' : todayBookingsCount, icon: Calendar, color: '#22c55e', bg: '#0A2010' },
    { label: 'Courts Active', value: openCourts === null ? '—' : `${openCourts}/${publishedLayout.length}`, icon: MapPin, color: '#0047AB', bg: '#0A1525' },
    { label: 'Pending Requests', value: pendingCancellations === null ? '—' : pendingCancellations, icon: AlertTriangle, color: '#a855f7', bg: '#1A0A25' },
  ];
  const hasBlockingBookings = (courtName: string) => {
    const today = getManilaDateKey();
    return bookings.filter(b =>
      bookingAppliesToPublishedMap(b, courtName, activeMap?.id, publishedMaps) &&
      b.date >= today &&
      b.status !== 'cancelled' &&
      b.status !== 'completed' &&
      b.status !== 'rejected'
    ).length;
  };
  const openMaintenancePrompt = (court: CourtBlock) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white" style={{ fontSize: 26, fontWeight: 900 }}>Live Operations</h2>
          <p className="text-gray-400" style={{ fontSize: 13 }}>Real-time court status and today's overview</p>
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
          <motion.div key={kpi.label} whileHover={{ y: -3 }} className="rounded-2xl p-4 border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.28)]" style={{ backgroundColor: kpi.bg }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-gray-300" style={{ fontSize: 12 }}>{kpi.label}</p>
                <p className="text-white font-black" style={{ fontSize: 22, marginTop: 2 }}>{kpi.value}</p>
              </div>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}25` }}>
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
            </div>
          </motion.div>
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
          <FacilityMapViewer mode="staff" compact selectedMapId={selectedMapId} onMapChange={setSelectedMapId} />
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
              <div key={sport} className="bg-[#15171F] rounded-2xl border border-white/10 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.32)]">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5" style={{ backgroundColor: `${color}08` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                    <SportIcon sport={sport} size={16} color={color} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{sport}</p>
                    <p className="text-gray-400" style={{ fontSize: 11 }}>{SPORTS_INFO.find(s => s.name === sport)?.priceLabel || 'Custom'} · {courts.length} court(s)</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: availCount === 0 ? '#ef4444' : '#22c55e' }} />
                    <span className="text-gray-400" style={{ fontSize: 11 }}>{availCount}/{courts.length} open</span>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {courts.map(court => (
                    <motion.div key={court.id} layout className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex-1">
                        <p className="text-white font-black" style={{ fontSize: 13 }}>{court.name}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${court.status === 'maintenance' ? 'bg-orange-500/15' : 'bg-green-500/15'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${court.status === 'maintenance' ? 'bg-orange-400' : 'bg-green-400'}`} />
                        <span className={`font-black ${court.status === 'maintenance' ? 'text-orange-300' : 'text-green-400'}`} style={{ fontSize: 11 }}>
                          {court.status === 'maintenance' ? 'Maintenance' : 'Available'}
                        </span>
                      </div>
                      <button
                        onClick={() => openMaintenancePrompt(court)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                        style={{
                          background: court.status === 'maintenance' ? 'rgba(34,197,94,0.16)' : 'rgba(251,146,60,0.16)',
                          color: court.status === 'maintenance' ? '#4ade80' : '#fdba74',
                          border: `1px solid ${court.status === 'maintenance' ? 'rgba(34,197,94,0.35)' : 'rgba(251,146,60,0.35)'}`,
                        }}
                      >
                        <Wrench size={12} />
                        {court.status === 'maintenance' ? 'Clear Maintenance' : 'Set Maintenance'}
                      </button>
                    </motion.div>
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
      <AnimatePresence>
        {maintenancePrompt && (
          <ConfirmModal opts={{
            title: maintenancePrompt.target === 'maintenance' ? 'Set Court to Maintenance?' : 'Clear Maintenance?',
            body: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0
                ? `${maintenancePrompt.court.name} has ${maintenancePrompt.blockedCount} active/upcoming booking(s).\n\nTo avoid booking conflicts, this court cannot be set to maintenance until bookings are rescheduled or cancelled.`
                : `${maintenancePrompt.court.name} will be hidden from booking immediately for users and staff.`
              : `${maintenancePrompt.court.name} will be available for booking again immediately.`,
            confirmLabel: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0 ? 'Understood' : 'Yes, Set Maintenance'
              : 'Yes, Clear',
            confirmColor: maintenancePrompt.target === 'maintenance'
              ? maintenancePrompt.blockedCount > 0 ? '#a855f7' : '#f97316'
              : '#22c55e',
            icon: maintenancePrompt.target === 'maintenance'
              ? <Wrench size={26} className={maintenancePrompt.blockedCount > 0 ? 'text-purple-400' : 'text-orange-400'} />
              : <CheckCircle size={26} className="text-green-400" />,
            onConfirm: confirmMaintenance,
            onCancel: () => setMaintenancePrompt(null),
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Master Calendar (Staff) ──────────────────────────────────────────────────
function StaffCalendar() {
  const { addBooking, cancellationRequests, updateCancellationRequest, updateBooking, bookings, user, calcCourtPrice, refreshBookingsFromApi } = useUser();
  const { createDeskBooking } = useBookingAPI();
  const { requests, updateRequestStatus } = useCoaching();
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualForm, setManualForm] = useState({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
  const [manualSuccess, setManualSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; approved: boolean } | null>(null);

  const pendingCancellations = cancellationRequests.filter(r => r.status === 'pending').length;

  const handleManualBooking = async () => {
    const name = manualForm.customerName || 'Walk-in Customer';
    const sport = manualForm.sport;
    const date = manualForm.date;
    const court = manualForm.court;
    const duration = manualForm.duration;
    const timeStr = manualForm.time || '12:00';
    const amount = Math.round(
      calcCourtPrice(sport, date, timeStr.slice(0, 5)) * duration
    );
    const ref = genRefCode();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const staffId = user?.id && uuidRe.test(user.id) ? user.id : undefined;
    try {
      const out = await createDeskBooking({
        court,
        sport,
        booking_date: date,
        start_time: timeStr,
        duration_hours: duration,
        total_price: amount,
        customer_name: name,
        customer_phone: manualForm.contactNumber,
        payment_method: 'cash',
        source: 'walk_in',
        ref_code: ref,
        add_ons: 'Staff Walk-in',
        staff_id: staffId,
      });
      addBooking(out.booking as any);
      await refreshBookingsFromApi();
    } catch (err) {
      console.error('[StaffCalendar] desk walk-in failed, local only', err);
      addBooking({
        id: `BK${Date.now()}`,
        sport,
        date,
        time: timeStr,
        duration,
        court,
        status: 'confirmed',
        amount,
        paymentStatus: 'paid',
        createdAt: new Date().toISOString(),
        customerName: name,
        customerPhone: manualForm.contactNumber,
        addOns: 'Staff Walk-in',
        refCode: ref,
        checkInStatus: 'none',
      });
    }
    setShowManualBooking(false);
    setManualForm({ customerName: '', contactNumber: '09', sport: 'Basketball', court: '', date: '', time: '', duration: 1 });
    setManualSuccess(`Walk-in booking confirmed for ${name} — ${sport} on ${date} at ${timeStr}.`);
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
  const pendingCoaching = 0;

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
              const liveReq = coachingRequests.find((r) => r.id === req.id);
              const paymentVerified = /PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(liveReq?.adminNotes || '');
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
                        <div className="flex flex-wrap gap-2 mb-3">
                          {req.requestedDate && (
                            <span className="px-2.5 py-1 rounded-lg text-gray-300 border border-white/8 bg-white/[0.03]" style={{ fontSize: 11 }}>
                              {req.requestedDate}{req.requestedTime ? ` · ${fmtTime(req.requestedTime)}` : ''}
                            </span>
                          )}
                          {req.status === 'confirmed' && (
                            <span className="px-2.5 py-1 rounded-lg font-black border" style={{
                              fontSize: 11,
                              color: paymentVerified ? '#86efac' : '#bfdbfe',
                              background: paymentVerified ? 'rgba(34,197,94,0.10)' : 'rgba(59,130,246,0.10)',
                              borderColor: paymentVerified ? 'rgba(34,197,94,0.24)' : 'rgba(59,130,246,0.24)',
                            }}>
                              {paymentVerified ? 'Payment verified' : 'Scan ticket to verify payment'}
                            </span>
                          )}
                        </div>
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
  const { user, bookings, addBooking, cancellationRequests, addCancellationRequest } = useUser();
  const { requests: coachingRequests } = useCoaching();
  const [activeTab, setActiveTab] = useState<StaffTab>('operations');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onOpenCalendar = () => setActiveTab('calendar');
    const onOpenInbox = () => setActiveTab('inbox');
    window.addEventListener('sportsync:open-master-calendar', onOpenCalendar);
    window.addEventListener('sportsync:open-staff-inbox', onOpenInbox);
    return () => {
      window.removeEventListener('sportsync:open-master-calendar', onOpenCalendar);
      window.removeEventListener('sportsync:open-staff-inbox', onOpenInbox);
    };
  }, []);

  const inboxBadge = cancellationRequests.filter(r => r.status === 'pending').length +
    coachingRequests.filter(r => r.status === 'pending').length;

  useEffect(() => {
    if (user?.role !== 'staff') return;
    const seedKey = 'staff_demo_seed_v2';
    if (localStorage.getItem(seedKey) === '1') return;
    if (bookings.length > 0) {
      localStorage.setItem(seedKey, '1');
      return;
    }

    const today = new Date();
    const iso = (offset: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      return d.toISOString().split('T')[0];
    };

    const samples = [
      { id: 'DEMO-BK-1', sport: 'Basketball', court: 'Basketball 1', date: iso(0), time: '19:00', duration: 2, status: 'confirmed' as const, paymentStatus: 'paid' as const, customerName: 'Aira Dela Cruz', refCode: 'JRC-AB12CD', checkInStatus: 'checked_in' as const, checkInTime: new Date().toISOString(), amount: 1500 },
      { id: 'DEMO-BK-2', sport: 'Volleyball', court: 'Volleyball 1', date: iso(0), time: '21:00', duration: 1, status: 'confirmed' as const, paymentStatus: 'paid' as const, customerName: 'Noel Rivera', refCode: 'JRC-VB99KQ', checkInStatus: 'none' as const, amount: 750 },
      { id: 'DEMO-BK-3', sport: 'Badminton', court: 'Badminton 2', date: iso(1), time: '10:00', duration: 2, status: 'confirmed' as const, paymentStatus: 'pending' as const, customerName: 'Mika Santos', refCode: 'JRC-BD55PQ', checkInStatus: 'none' as const, amount: 600 },
      { id: 'DEMO-BK-4', sport: 'Pickleball', court: 'Pickleball 1', date: iso(2), time: '16:00', duration: 2, status: 'pending_verification' as const, paymentStatus: 'pending_verification' as const, customerName: 'Kenji Flores', refCode: 'JRC-PK44TT', checkInStatus: 'none' as const, amount: 600 },
      { id: 'DEMO-BK-5', sport: 'Billiards', court: 'Billiards 3', date: iso(0), time: '14:00', duration: 3, status: 'confirmed' as const, paymentStatus: 'paid' as const, customerName: 'Jules Tan', refCode: 'JRC-BL08LA', checkInStatus: 'none' as const, amount: 300 },
    ];

    samples.forEach((b) => {
      addBooking({
        ...b,
        createdAt: new Date().toISOString(),
        customerPhone: '09171234567',
        addOns: 'Demo Scenario',
      });
    });

    addCancellationRequest({
      id: 'DEMO-CANCEL-1',
      bookingId: 'DEMO-BK-3',
      reason: 'Schedule conflict due to exam week',
      status: 'pending',
      customerName: 'Mika Santos',
      court: 'Badminton 2',
      date: iso(1),
      time: '10:00',
      createdAt: new Date().toISOString(),
    });

    localStorage.setItem(seedKey, '1');
  }, [user?.role, bookings.length, addBooking, addCancellationRequest]);

  const renderContent = () => {
    switch (activeTab) {
      case 'operations': return <LiveOperations />;
      case 'calendar':   return <StaffCalendar />;
      case 'inbox':      return <StaffInbox />;
      case 'activity':   return <StaffActivityLog />;
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col md:flex-row h-screen overflow-hidden"
      style={{ background: 'radial-gradient(1200px 520px at 18% -10%, rgba(37,99,235,0.22), transparent), #090A0F' }}>

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
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#0B0E16]">
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
        className="bg-[#0C1019] border-r border-white/[0.07] flex-col flex-shrink-0 overflow-hidden flex"
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
            <div className="rounded-2xl p-3 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
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
            <div className="hidden md:flex h-14 bg-[#0C1019] border-b border-white/[0.08] items-center px-6 flex-shrink-0 gap-3">
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
