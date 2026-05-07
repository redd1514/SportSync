import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ChevronLeft, ChevronRight, Maximize2, DollarSign, Layers, Shield,
  CheckCircle, Play, ArrowRight, Sparkles, Clock, MapPin, Star,
  Users, Zap,
} from "lucide-react";
import { getSportColor, SportIcon } from "../SportIcons";

export const BG     = "#0F1011";
export const SURF   = "#1A1B1E";
export const SURF2  = "#242529";
export const BORDER = "rgba(255,255,255,0.06)";
export const TP     = "#E8E8EA";
export const TS     = "#9294A0";
export const ORANGE = "#F97316";
export const BLUE   = "#2563EB";

/* ═══ JRC RATES ═══ */
export interface RateData {
  rates: { label: string; time: string; price: string; note?: string }[];
  addons: { label: string; price: string }[];
  equipment: string[];
  color: string;
  image: string;
  courts: string;
  description: string;
}
export const SPORT_RATES: Record<string, RateData> = {
  Basketball: {
    image: "https://images.unsplash.com/photo-1720217262350-2dec57765d26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "1 Full-Size Court", color: "#F97316",
    description: "Professional hardwood court with arena-style LED lighting.",
    rates: [
      { label: "Weekdays",            time: "7AM – 5PM",  price: "₱450 / hr", note: "Lights: +₱300" },
      { label: "Weekdays",            time: "5PM – 12MN", price: "₱750 / hr" },
      { label: "Weekends / Holidays", time: "7AM – 5PM",  price: "₱550 / hr", note: "Lights: +₱300" },
      { label: "Weekends / Holidays", time: "5PM – 12MN", price: "₱850 / hr" },
    ],
    addons:    [{ label: "Air-Conditioned", price: "+₱1,500/hr" }, { label: "Ball Rental", price: "₱100" }, { label: "Scoreboard", price: "+₱300" }],
    equipment: ["Hardwood flooring", "Professional backboards", "LED arena lighting", "Proper boundary markings"],
  },
  Volleyball: {
    image: "https://images.unsplash.com/photo-1619472683502-8f245a2a7fce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "1 Court", color: "#2563EB",
    description: "Indoor volleyball court with professional nets, poles, and non-slip flooring.",
    rates: [
      { label: "Weekdays",            time: "7AM – 5PM",  price: "₱450 / hr", note: "Lights: +₱300" },
      { label: "Weekdays",            time: "5PM – 12MN", price: "₱750 / hr" },
      { label: "Weekends / Holidays", time: "7AM – 5PM",  price: "₱550 / hr", note: "Lights: +₱300" },
      { label: "Weekends / Holidays", time: "5PM – 12MN", price: "₱850 / hr" },
    ],
    addons:    [{ label: "Air-Conditioned", price: "+₱1,500/hr" }, { label: "Ball Rental", price: "₱100" }, { label: "Scoreboard", price: "+₱300" }],
    equipment: ["Professional nets & poles", "Non-slip flooring", "LED arena lighting", "6–12 player capacity"],
  },
  Badminton: {
    image: "https://images.unsplash.com/photo-1776999035766-9c2b5cddf613?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "3 Courts", color: "#22c55e",
    description: "JRC's most popular sport — 3 courts with excellent lighting and equipment.",
    rates: [{ label: "All Days", time: "7AM – 12MN", price: "₱300 / hr" }],
    addons:    [{ label: "Racket Rental", price: "₱50" }, { label: "Shuttlecock (Feather)", price: "₱50 for sale" }, { label: "Shuttlecock (Plastic)", price: "₱50 for rent" }],
    equipment: ["3 regulation courts", "Professional nets", "Proper lighting", "Smooth surface"],
  },
  Pickleball: {
    image: "https://images.unsplash.com/photo-1737229471661-78a6a16f33bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "2 Courts", color: "#a855f7",
    description: "2 dedicated regulation courts. Fun for all ages!",
    rates: [{ label: "All Days", time: "7AM – 12MN", price: "₱300 / hr" }],
    addons:    [{ label: "Paddle Rental", price: "₱50–100" }, { label: "Ball for Rent", price: "₱50" }, { label: "Ball for Sale", price: "₱100" }],
    equipment: ["2 regulation courts", "Proper net height", "Non-slip surface", "Beginner-friendly"],
  },
  Billiards: {
    image: "https://images.unsplash.com/photo-1774544305775-b21053b290b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "4 Premium Tables", color: "#eab308",
    description: "4 premium billiard tables in a comfortable lounge — cues, balls, chalk included.",
    rates: [{ label: "All Days", time: "7AM – 12MN", price: "₱100 / hr" }],
    addons:    [],
    equipment: ["4 premium tables", "Cues & balls included", "Chalk provided", "Lounge seating"],
  },
  "Table Tennis": {
    image: "https://images.unsplash.com/photo-1774755470060-637e42c817ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    courts: "1 Professional Table", color: "#f43f5e",
    description: "The most affordable option at JRC — professional table with paddles and balls.",
    rates: [{ label: "All Days", time: "7AM – 12MN", price: "₱100 / hr" }],
    addons:    [],
    equipment: ["Professional table", "Paddles & balls included", "Proper lighting", "Open daily"],
  },
};

export const MARQUEE_ITEMS = [
  { src: "https://images.unsplash.com/photo-1720217262350-2dec57765d26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Basketball" },
  { src: "https://images.unsplash.com/photo-1619472683502-8f245a2a7fce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Volleyball" },
  { src: "https://images.unsplash.com/photo-1776999035766-9c2b5cddf613?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Badminton" },
  { src: "https://images.unsplash.com/photo-1737229471661-78a6a16f33bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Pickleball" },
  { src: "https://images.unsplash.com/photo-1774544305775-b21053b290b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Billiards" },
  { src: "https://images.unsplash.com/photo-1774755470060-637e42c817ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Table Tennis" },
  { src: "https://images.unsplash.com/flagged/photo-1568407371446-a239664fb4f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "Community" },
  { src: "https://images.unsplash.com/photo-1768152860036-904a1b65df3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600", label: "JRC Arena" },
];

/* ═══ FloatingOrbs ═══ */
export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="mesh-blob-1 absolute rounded-full opacity-20" style={{ width: 700, height: 700, top: -250, left: -150, background: `radial-gradient(circle,${ORANGE}38 0%,transparent 65%)`, filter: "blur(80px)" }} />
      <div className="mesh-blob-2 absolute rounded-full opacity-12" style={{ width: 550, height: 550, top: -80, right: -100, background: `radial-gradient(circle,${BLUE}42 0%,transparent 65%)`, filter: "blur(70px)" }} />
      <div className="mesh-blob-3 absolute rounded-full opacity-8"  style={{ width: 400, height: 400, bottom: 0, left: "40%", background: `radial-gradient(circle,#a855f738 0%,transparent 65%)`, filter: "blur(60px)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.012) 1px,transparent 1px)`, backgroundSize: "28px 28px" }} />
    </div>
  );
}

/* ═══ TickerBar ═══ */
export function TickerBar() {
  const items = ["Basketball", "Volleyball", "Badminton", "Pickleball", "Billiards", "Table Tennis", "Open 7AM–12MN", "Valenzuela City"];
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden flex items-center" style={{ background: `${ORANGE}0d`, borderTop: `1px solid ${ORANGE}20`, borderBottom: `1px solid ${ORANGE}20`, height: 32 }}>
      <div className="flex marquee-track">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-3 flex-shrink-0 px-5" style={{ color: TS, fontSize: 11, fontWeight: 700 }}>
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: ORANGE }} />
            {item.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══ SportRateModal ═══ */
export function SportRateModal({ sport, onClose, onBook }: { sport: string | null; onClose: () => void; onBook: () => void }) {
  const data = sport ? SPORT_RATES[sport] : null;
  if (!data || !sport) return null;
  return (
    <AnimatePresence>
      {sport && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
          onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto"
            style={{ background: SURF, border: `1px solid ${data.color}22`, maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}>
            <div className="relative h-44 overflow-hidden flex-shrink-0">
              <img src={data.image} alt={sport} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top,${SURF} 0%,rgba(0,0,0,0.3) 60%,transparent 100%)` }} />
              <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                <X size={16} className="text-white" />
              </button>
              <div className="absolute bottom-4 left-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${data.color}22`, border: `1px solid ${data.color}44` }}>
                  <SportIcon sport={sport} size={22} color={data.color} />
                </div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 20 }}>{sport}</p>
                  <p style={{ color: TS, fontSize: 12 }}>{data.courts}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <p style={{ color: TS, fontSize: 13, lineHeight: 1.6 }}>{data.description}</p>
              <div>
                <div className="flex items-center gap-2 mb-3"><DollarSign size={14} style={{ color: data.color }} /><p style={{ color: TP, fontSize: 13, fontWeight: 800 }}>Rental Rates</p></div>
                <div className="space-y-2">
                  {data.rates.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: SURF2, border: `1px solid ${BORDER}` }}>
                      <div>
                        <p style={{ color: TP, fontSize: 13, fontWeight: 700 }}>{r.label}</p>
                        <p style={{ color: TS, fontSize: 11 }}>{r.time}{r.note ? ` · ${r.note}` : ""}</p>
                      </div>
                      <p style={{ color: data.color, fontSize: 16, fontWeight: 900 }}>{r.price}</p>
                    </div>
                  ))}
                </div>
              </div>
              {data.addons.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3"><Layers size={14} style={{ color: data.color }} /><p style={{ color: TP, fontSize: 13, fontWeight: 800 }}>Optional Add-ons</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.addons.map((a, i) => (
                      <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: SURF2, border: `1px solid ${BORDER}` }}>
                        <p style={{ color: TS, fontSize: 11 }}>{a.label}</p>
                        <p style={{ color: data.color, fontSize: 13, fontWeight: 800 }}>{a.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-3"><Shield size={14} style={{ color: data.color }} /><p style={{ color: TP, fontSize: 13, fontWeight: 800 }}>What's Included</p></div>
                <div className="grid grid-cols-2 gap-2">
                  {data.equipment.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />
                      <span style={{ color: TS, fontSize: 12 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${data.color}44` }} whileTap={{ scale: 0.97 }}
                onClick={onBook} className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg,${data.color},${data.color}cc)`, fontSize: 15, fontWeight: 800 }}>
                <Play size={14} fill="white" /> Book {sport} Now
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══ Lightbox ═══ */
export function Lightbox({ images, index, onClose }: { images: typeof MARQUEE_ITEMS; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  const prev = () => setCurrent(c => (c - 1 + images.length) % images.length);
  const next = () => setCurrent(c => (c + 1) % images.length);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex flex-col" style={{ background: "rgba(0,0,0,0.96)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: ORANGE }} />
          <p style={{ color: TP, fontSize: 14, fontWeight: 800 }}>{images[current].label}</p>
          <span style={{ color: TS, fontSize: 12 }}>{current + 1} / {images.length}</span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all" style={{ border: `1px solid ${BORDER}` }}>
          <X size={18} style={{ color: TP }} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-16 relative overflow-hidden">
        <button onClick={prev} className="absolute left-4 z-10 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all"
          style={{ background: "rgba(0,0,0,0.7)", border: `1px solid ${BORDER}`, backdropFilter: "blur(8px)" }}>
          <ChevronLeft size={20} style={{ color: TP }} />
        </button>
        <AnimatePresence mode="wait">
          <motion.img key={current} src={images[current].src.replace("w=600", "w=1400")} alt={images[current].label}
            initial={{ opacity: 0, scale: 0.94, x: 30 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.94, x: -30 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-full max-h-full object-contain rounded-2xl"
            style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.8)", maxHeight: "calc(100vh - 180px)" }} />
        </AnimatePresence>
        <button onClick={next} className="absolute right-4 z-10 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all"
          style={{ background: "rgba(0,0,0,0.7)", border: `1px solid ${BORDER}`, backdropFilter: "blur(8px)" }}>
          <ChevronRight size={20} style={{ color: TP }} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 py-3 flex-shrink-0">
        {images.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all"
            style={{ width: i === current ? 24 : 6, height: 6, background: i === current ? ORANGE : "rgba(255,255,255,0.2)" }} />
        ))}
      </div>
      <div className="flex gap-2 justify-center pb-5 px-4 flex-shrink-0">
        {images.map((img, i) => (
          <button key={i} onClick={() => setCurrent(i)} className="rounded-xl overflow-hidden transition-all"
            style={{ width: 56, height: 40, opacity: i === current ? 1 : 0.38, border: `2px solid ${i === current ? ORANGE : "transparent"}` }}>
            <img src={img.src} alt={img.label} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}