import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useBookingAPI } from '../hooks/useBookingAPI';
import { useFacilityAPI } from '../hooks/useFacilityAPI';
import {
  Send, Sparkles, RotateCcw, ChevronDown, X, MapPin, CalendarDays, Clock,
  DollarSign, Trophy, GraduationCap, XCircle, CreditCard, ArrowRight,
} from 'lucide-react';

type Msg = {
  role: 'user' | 'ai';
  text: string;
  ts: Date;
  link?: { label: string; action: 'booking' | 'coaching' | 'mybookings' };
};

const QUICK_CHIPS: { label: string; q: string; Icon: any }[] = [
  { label: 'Court Rates',     q: 'What are the court rates?',          Icon: DollarSign },
  { label: 'Hours',           q: 'What are your operating hours?',     Icon: Clock },
  { label: 'How to Book',     q: 'How do I book a court?',             Icon: CalendarDays },
  { label: 'Loyalty Points',  q: 'How do loyalty points work?',        Icon: Trophy },
  { label: 'Coaching',        q: 'Tell me about coaching services',    Icon: GraduationCap },
  { label: 'Cancel Booking',  q: 'How do I cancel my booking?',        Icon: XCircle },
  { label: 'Payment',         q: 'What payment methods do you accept?',Icon: CreditCard },
  { label: 'Location',        q: 'Where are you located?',             Icon: MapPin },
];

function getAIResponse(input: string, facilityInfo?: any, courtStatuses?: any[]): { text: string; link?: Msg['link'] } {
  const q = input.toLowerCase();

  if (/basketball/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Basketball rates:\n\n• Weekday 7AM–5PM: ₱450/hr (Lights +₱300)\n• Weekday 5PM–12MN: ₱750/hr\n• Weekend/Holiday 7AM–5PM: ₱550/hr\n• Weekend/Holiday 5PM–12MN: ₱850/hr\n\nAdd-ons: AC +₱1,500/hr · Ball ₱100 · Scoreboard +₱300', link: { label: 'Book Basketball', action: 'booking' } };
  if (/volleyball/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Volleyball rates:\n\n• Weekday 7AM–5PM: ₱450/hr\n• Weekday 5PM–12MN: ₱750/hr\n• Weekend/Holiday 7AM–5PM: ₱550/hr\n• Weekend/Holiday 5PM–12MN: ₱850/hr', link: { label: 'Book Volleyball', action: 'booking' } };
  if (/badminton/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Badminton is a flat ₱300/hr — any time, any day. Racket rental ₱50, shuttlecocks available on-site.', link: { label: 'Book Badminton', action: 'booking' } };
  if (/pickleball/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Pickleball is ₱300/hr flat, any day. Paddle rental ₱50–100, ball for rent ₱50.', link: { label: 'Book Pickleball', action: 'booking' } };
  if (/billiard|pool/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Billiards is ₱100/hr flat. Cues, balls, and chalk are all included.', link: { label: 'Book Billiards', action: 'booking' } };
  if (/table tennis|ping/.test(q) && /rate|price|cost|how much/.test(q))
    return { text: 'Table Tennis is ₱100/hr flat. Paddles and balls included. Open daily 7AM–12MN.', link: { label: 'Book Table Tennis', action: 'booking' } };

  if (/price|rate|cost|fee|how much/.test(q))
    return {
      text: '2026 Rates at JRC Ballpark:\n\nBasketball / Volleyball\n• Weekday Day (7AM–5PM): ₱450/hr\n• Weekday Evening (5PM–12MN): ₱750/hr\n• Weekend Day: ₱550/hr\n• Weekend Evening: ₱850/hr\n\nBadminton / Pickleball: ₱300/hr flat\nBilliards / Table Tennis: ₱100/hr flat\n\nAll rates include facility access. Add-ons available at booking.',
      link: { label: 'Book a Court Now', action: 'booking' },
    };
  if (/available|avail|court/.test(q))
    return {
      text: courtStatuses && courtStatuses.length > 0
        ? `Available courts right now:\n\n${courtStatuses.filter((c: any) => c.status === 'available').map((c: any) => `• ${c.name} — ${c.sport}`).join('\n')}\n\nTap below to book immediately.`
        : 'Loading court availability... Check back in a moment.',
      link: { label: 'View Courts', action: 'booking' },
    };
  if (/book|reserve|court|slot/.test(q))
    return {
      text: 'Booking is easy!\n\n1. Go to the Facility Map tab\n2. Select your preferred date & time\n3. Tap any available (green) court\n4. Choose your session length\n5. Add optional extras\n6. Pay via GCash and get your QR ticket\n\nYour QR ticket is required for check-in at the front desk.',
      link: { label: 'Open Facility Map', action: 'booking' },
    };
  if (/cancel|cancell/.test(q))
    return {
      text: 'To cancel a booking:\n\n1. Go to "My Bookings" in Profile\n2. Find the booking you want to cancel\n3. Tap "Request Cancellation"\n4. Select your reason and submit\n\nStaff will review within 24 hours.',
      link: { label: 'Go to My Bookings', action: 'mybookings' },
    };
  if (/reschedule|change.*date|move.*booking/.test(q))
    return {
      text: 'To reschedule:\n\n1. Go to "My Bookings" in Profile\n2. Find your upcoming booking\n3. Tap "Reschedule"\n4. Pick a new date and time\n\nRescheduling is allowed up to 24 hours before your session.',
      link: { label: 'Go to My Bookings', action: 'mybookings' },
    };
  if (/hour|time|open|close|schedule|operating/.test(q))
    return { 
      text: facilityInfo?.hours 
        ? `JRC Sports Complex hours:\n\n${facilityInfo.hours}\n\nPeak hours are 5–9 PM on weekdays. Book in advance to secure your court!`
        : 'JRC Sports Complex is open daily:\n\n7:00 AM – 12:00 MN\n\nPeak hours are 5–9 PM on weekdays. Book in advance to secure your court!' 
    };
  if (/loyalty|point|reward|free/.test(q))
    return { text: 'Loyalty Rewards:\n\n• Earn 1 point per booking\n• 10 points = 1 FREE session\n• Points never expire\n• Valid on any sport, any day\n\nCheck your points in Profile → Loyalty Rewards.' };
  if (/coach|train|lesson/.test(q))
    return {
      text: 'Professional coaching is available for all sports!\n\n• Basketball, Volleyball, Badminton, Pickleball & more\n• Certified coaches\n• Individual or group sessions\n• Flexible scheduling',
      link: { label: 'Browse Coaching Hub', action: 'coaching' },
    };
  if (/location|where|address|direction/.test(q))
    return { 
      text: facilityInfo?.address 
        ? `JRC Sports Complex\n${facilityInfo.address}\n\nOpen 7AM – 12MN daily. Check the Facility Map for details.`
        : 'JRC Sports Complex\nValenzuela City, Metro Manila\n\nOpen 7AM – 12MN daily. Check the Facility Map for details.' 
    };
  if (/payment|pay|gcash|card|cash/.test(q))
    return { text: 'Payment methods:\n\nGCash — online bookings (full payment required)\nCash on-site — walk-in bookings (pay at front desk)\n\nYou\'ll receive a digital QR ticket after payment.' };
  if (/equipment|racket|ball|paddle|rent/.test(q))
    return { text: 'Equipment add-ons at booking:\n\n• Ball Rental (Basketball/Volleyball): ₱100\n• Racket Rental (Badminton): ₱50\n• Paddle Rental (Pickleball): ₱50–100\n• Shuttlecock — Feather: ₱50 / Plastic: ₱50\n• Lighting (evening): +₱300' };
  if (/hi|hello|hey|good|help|start/.test(q))
    return { text: 'Hello! I\'m your JRC AI Concierge. I can help with:\n\n• Court bookings & availability\n• Pricing & add-ons\n• Loyalty rewards\n• Operating hours\n• Coaching services\n• Cancellations & rescheduling\n\nWhat can I help you with today?' };
  if (/qr|ticket|check.?in/.test(q))
    return { text: 'After booking, you\'ll receive a digital QR ticket. Show it to our staff at the front desk for check-in.\n\nFind your ticket in My Bookings — tap any confirmed booking.', link: { label: 'View My Bookings', action: 'mybookings' } };

  return { text: 'I\'m trained for JRC Ballpark queries only. For that question, our front desk can help.\n\nJRC Sports Complex, Valenzuela City — Open 7AM–12MN daily.\n\nCan I help with booking, rates, coaching, or anything sports-related?' };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

export function FloatingAIChat({ onNavigate, forceOpen, onClose }: { onNavigate?: (tab: string) => void; forceOpen?: boolean; onClose?: () => void }) {
  const { checkAvailability } = useBookingAPI();
  const { getCourtStatuses, getFacilityInfo } = useFacilityAPI();
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [facilityInfo, setFacilityInfo] = useState<any>(null);
  const [courtStatuses, setCourtStatuses] = useState<any[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Hello! I\'m your JRC AI Concierge. Ask me about court bookings, pricing, coaching, hours, or anything else. How can I help?', ts: new Date() },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch facility info and court statuses on mount
  useEffect(() => {
    const loadFacilityData = async () => {
      try {
        const info = await getFacilityInfo();
        const courts = await getCourtStatuses();
        setFacilityInfo(info);
        setCourtStatuses(courts || []);
      } catch (error) {
        console.error('Error loading facility data:', error);
      }
    };
    loadFacilityData();
  }, []);

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [messages, isExpanded]);

  // Controlled open from parent (header AI button)
  useEffect(() => {
    if (forceOpen !== undefined) setIsExpanded(forceOpen);
  }, [forceOpen]);

  const handleClose = () => {
    setIsExpanded(false);
    onClose?.();
  };

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: text.trim(), ts: new Date() }]);
    setMessage('');
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      // Use facility info in AI response if available
      const resp = getAIResponse(text, facilityInfo, courtStatuses);
      setMessages(prev => [...prev, { role: 'ai', text: resp.text, ts: new Date(), link: resp.link }]);
    }, 800 + Math.random() * 600);
  }, [facilityInfo, courtStatuses]);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const chatContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#0047AB,#1d4ed8)', borderBottom: '1px solid rgba(0,0,0,0.2)' }}>
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black" style={{ fontSize: 14, lineHeight: 1.2 }}>JRC AI Concierge</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: '0 0 6px #22c55e' }} />
            <p className="text-blue-200 font-black" style={{ fontSize: 10 }}>Online · Read-only support</p>
          </div>
        </div>
        <button onClick={() => setMessages([{ role: 'ai', text: 'Chat reset! How can I help you today?', ts: new Date() }])}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-white" title="Reset">
          <RotateCcw size={13} />
        </button>
        <button onClick={handleClose} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-white">
          {isMobile ? <ChevronDown size={16} /> : <X size={14} />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ background: '#0A0A0A' }}>
        {messages.map((msg, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg,#0047AB,#1d4ed8)', boxShadow: '0 3px 8px rgba(0,71,171,0.4)' }}>
                <Sparkles size={13} className="text-white" />
              </div>
            )}
            <div className="max-w-[82%] space-y-1.5">
              <div className="rounded-2xl px-3.5 py-2.5"
                style={{
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#F97316,#e67e00)' : 'rgba(255,255,255,0.07)',
                  color: msg.role === 'user' ? 'white' : '#E5E7EB',
                  fontSize: 13, lineHeight: 1.65,
                  border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  whiteSpace: 'pre-line',
                }}>
                {msg.text}
              </div>
              {msg.role === 'ai' && msg.link && onNavigate && (
                <button onClick={() => { onNavigate(msg.link!.action); setIsExpanded(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-black hover:opacity-90 transition-opacity"
                  style={{ fontSize: 11, background: 'linear-gradient(135deg,#0047AB,#1d4ed8)', boxShadow: '0 2px 8px rgba(0,71,171,0.3)' }}>
                  {msg.link.label} <ArrowRight size={11} />
                </button>
              )}
              <p style={{ fontSize: 9, color: '#4b5563', textAlign: msg.role === 'user' ? 'right' : 'left' }}>{formatTime(msg.ts)}</p>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#0047AB,#1d4ed8)' }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <motion.div key={i} animate={{ y: [0, -6, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay, ease: 'easeInOut' }}
                  className="w-2 h-2 rounded-full bg-blue-400" />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips */}
      <div className="px-3 py-2.5 border-t border-white/5 flex-shrink-0" style={{ background: '#0D0D0D' }}>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {QUICK_CHIPS.map(chip => (
            <button key={chip.label} onClick={() => sendMessage(chip.q)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-black transition-all hover:bg-blue-500/20 active:scale-95"
              style={{ fontSize: 11, background: 'rgba(0,71,171,0.12)', color: '#93c5fd', border: '1px solid rgba(0,71,171,0.25)', whiteSpace: 'nowrap' }}>
              <chip.Icon size={10} />
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-3 pb-4 pt-2 flex-shrink-0 flex gap-2" style={{ background: '#0D0D0D' }}>
        <input ref={inputRef} value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(message); } }}
          placeholder="Ask about courts, rates, coaching..."
          className="flex-1 rounded-xl px-4 py-2.5 text-white focus:outline-none"
          style={{ fontSize: 13, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <button onClick={() => sendMessage(message)} disabled={!message.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg,#0047AB,#1d4ed8)', boxShadow: '0 4px 12px rgba(0,71,171,0.35)' }}>
          <Send size={15} />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Floating trigger — HIDDEN on mobile (accessed via header button) */}
      <AnimatePresence>
        {!isExpanded && !forceOpen && !isMobile && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            className="fixed z-[40]" style={{ bottom: 24, right: 20 }}>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={() => { setIsExpanded(true); setUnreadCount(0); }}
              className="rounded-2xl shadow-2xl flex items-center justify-center relative"
              style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#0047AB,#1d4ed8)', boxShadow: '0 8px 28px rgba(0,71,171,0.5),0 0 0 1px rgba(0,71,171,0.3)' }}>
              <Sparkles size={24} className="text-white" strokeWidth={2.5} />
              <motion.span className="absolute inset-0 rounded-2xl border-2 border-[#0047AB]"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.6, repeat: Infinity }} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white font-black"
                    style={{ fontSize: 10, background: '#ef4444' }}>
                    {unreadCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop panel */}
      {!isMobile && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 32 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: 32 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="fixed flex flex-col rounded-3xl overflow-hidden"
              style={{ bottom: 24, right: 24, width: 360, height: 'min(600px,calc(100vh - 48px))', background: '#111', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', zIndex: 40 }}>
              {chatContent}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <AnimatePresence>
          {isExpanded && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 39 }}
                onClick={handleClose} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden"
                style={{ height: '82vh', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', boxShadow: '0 -16px 60px rgba(0,0,0,0.7)', zIndex: 40 }}>
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                {chatContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  );
}