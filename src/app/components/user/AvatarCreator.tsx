import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Check, Shuffle } from "lucide-react";

/* ── Types ── */
export interface AvatarConfig {
  skin: number;        // 0-6
  hair: number;        // 0-7
  hairColor: number;   // 0-6
  eyes: number;        // 0-4
  top: number;         // 0-7
  topColor: number;    // 0-5
  bg: number;          // 0-7
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 2, hair: 0, hairColor: 0, eyes: 1, top: 0, topColor: 0, bg: 0,
};

/* ── Palettes ── */
const SKIN_TONES  = ["#FDDBB4","#F5CBA7","#E8A87C","#D4875A","#A0522D","#7B3F00","#4A2400"];
const HAIR_COLORS = ["#1C1C1C","#4A3728","#7B3F00","#B8860B","#D4A017","#C0392B","#8E44AD"];
const TOP_COLORS  = ["#2563EB","#16A34A","#DC2626","#D97706","#7C3AED","#0891B2"];
const BG_COLORS   = [
  "linear-gradient(135deg,#1e1b4b,#312e81)",
  "linear-gradient(135deg,#0c4a6e,#0369a1)",
  "linear-gradient(135deg,#14532d,#15803d)",
  "linear-gradient(135deg,#3f0d0d,#7f1d1d)",
  "linear-gradient(135deg,#1a1a1a,#2d2d2d)",
  "linear-gradient(135deg,#312e1b,#78350f)",
  "linear-gradient(135deg,#1b1b3a,#3b0764)",
  "linear-gradient(135deg,#0a2e1a,#065f46)",
];

/* ── SVG face pieces ── */
function AvatarSVG({ cfg, size = 120 }: { cfg: AvatarConfig; size?: number }) {
  const skin = SKIN_TONES[cfg.skin];
  const hair = HAIR_COLORS[cfg.hairColor];
  const topC = TOP_COLORS[cfg.topColor];

  // Hair shapes
  const hairPaths = [
    // 0 Short
    `<ellipse cx="50" cy="26" rx="21" ry="15" fill="${hair}" />
     <rect x="29" y="26" width="42" height="10" rx="4" fill="${hair}" />`,
    // 1 Medium
    `<ellipse cx="50" cy="26" rx="21" ry="15" fill="${hair}" />
     <rect x="29" y="26" width="8" height="24" rx="4" fill="${hair}" />
     <rect x="63" y="26" width="8" height="24" rx="4" fill="${hair}" />`,
    // 2 Long
    `<ellipse cx="50" cy="26" rx="21" ry="16" fill="${hair}" />
     <rect x="29" y="26" width="8" height="38" rx="4" fill="${hair}" />
     <rect x="63" y="26" width="8" height="38" rx="4" fill="${hair}" />`,
    // 3 Curly
    `<ellipse cx="50" cy="25" rx="22" ry="17" fill="${hair}" />
     <circle cx="32" cy="28" r="8" fill="${hair}" />
     <circle cx="68" cy="28" r="8" fill="${hair}" />
     <circle cx="38" cy="20" r="7" fill="${hair}" />
     <circle cx="62" cy="20" r="7" fill="${hair}" />`,
    // 4 Spiky
    `<polygon points="30,32 36,10 42,32" fill="${hair}" />
     <polygon points="40,32 47,8 54,32" fill="${hair}" />
     <polygon points="50,32 57,8 64,32" fill="${hair}" />
     <polygon points="60,32 67,10 74,32" fill="${hair}" />`,
    // 5 Bun
    `<ellipse cx="50" cy="26" rx="18" ry="12" fill="${hair}" />
     <circle cx="50" cy="14" r="10" fill="${hair}" />`,
    // 6 Mohawk
    `<rect x="44" y="8" width="12" height="26" rx="6" fill="${hair}" />`,
    // 7 Bald
    ``,
  ];

  // Eye shapes
  const eyeSets = [
    // 0 Simple dots
    `<circle cx="40" cy="47" r="3.5" fill="#222" />
     <circle cx="60" cy="47" r="3.5" fill="#222" />`,
    // 1 Almond
    `<ellipse cx="40" cy="47" rx="5" ry="3.5" fill="#222" />
     <ellipse cx="60" cy="47" rx="5" ry="3.5" fill="#222" />
     <circle cx="41" cy="46" r="1.5" fill="white" />
     <circle cx="61" cy="46" r="1.5" fill="white" />`,
    // 2 Sleepy
    `<path d="M35 46 Q40 50 45 46" stroke="#222" stroke-width="2.5" fill="none" stroke-linecap="round" />
     <path d="M55 46 Q60 50 65 46" stroke="#222" stroke-width="2.5" fill="none" stroke-linecap="round" />`,
    // 3 Wide
    `<circle cx="40" cy="47" r="5.5" fill="#222" />
     <circle cx="60" cy="47" r="5.5" fill="#222" />
     <circle cx="41" cy="45" r="2" fill="white" />
     <circle cx="61" cy="45" r="2" fill="white" />`,
    // 4 Wink
    `<ellipse cx="40" cy="47" rx="5" ry="3.5" fill="#222" />
     <path d="M55 46 Q60 50 65 46" stroke="#222" stroke-width="2.5" fill="none" stroke-linecap="round" />`,
  ];

  // Top / outfit
  const topPaths = [
    // 0 T-Shirt
    `<path d="M20 80 L30 70 L50 76 L70 70 L80 80 L75 100 L25 100 Z" fill="${topC}" />
     <path d="M30 70 L20 60 L35 55 L50 76 L65 55 L80 60 L70 70" fill="${topC}" />`,
    // 1 Hoodie
    `<path d="M18 80 L28 68 L50 74 L72 68 L82 80 L80 100 L20 100 Z" fill="${topC}" />
     <path d="M28 68 L18 56 L34 52 L40 68 L50 74 L60 68 L66 52 L82 56 L72 68" fill="${topC}" />
     <circle cx="50" cy="72" r="6" fill="${topC}" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>`,
    // 2 Jersey
    `<path d="M22 80 L32 70 L50 76 L68 70 L78 80 L76 100 L24 100 Z" fill="${topC}" />
     <path d="M32 70 L22 60 L36 54 L50 76 L64 54 L78 60 L68 70" fill="${topC}" />
     <line x1="50" y1="70" x2="50" y2="100" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`,
    // 3 Polo
    `<path d="M20 82 L30 70 L44 72 L50 80 L56 72 L70 70 L80 82 L78 100 L22 100 Z" fill="${topC}" />
     <path d="M30 70 L20 60 L34 54 L44 72 L50 80 L56 72 L66 54 L80 60 L70 70" fill="${topC}" />
     <path d="M44 72 L50 76 L56 72 L54 82 L46 82 Z" fill="rgba(255,255,255,0.15)" />`,
    // 4 Tank Top
    `<path d="M28 100 L28 72 L50 76 L72 72 L72 100 Z" fill="${topC}" />`,
    // 5 Jacket
    `<path d="M18 80 L28 68 L50 74 L72 68 L82 80 L80 100 L20 100 Z" fill="${topC}" />
     <path d="M28 68 L18 56 L32 52 L40 68 L50 74 L60 68 L68 52 L82 56 L72 68" fill="${topC}" />
     <path d="M50 74 L50 100" stroke="rgba(0,0,0,0.2)" stroke-width="3"/>
     <rect x="47" y="78" width="6" height="4" rx="2" fill="rgba(255,255,255,0.4)" />`,
    // 6 Sweater
    `<path d="M20 80 L30 70 L50 76 L70 70 L80 80 L78 100 L22 100 Z" fill="${topC}" />
     <path d="M30 70 L20 60 L35 54 L50 76 L65 54 L80 60 L70 70" fill="${topC}" />
     <path d="M35 54 L50 58 L65 54" stroke="rgba(255,255,255,0.2)" stroke-width="4" stroke-linecap="round" fill="none"/>`,
    // 7 Suit
    `<path d="M18 80 L28 68 L50 74 L72 68 L82 80 L80 100 L20 100 Z" fill="${topC}" />
     <path d="M28 68 L18 56 L32 52 L40 68 L50 74 L60 68 L68 52 L82 56 L72 68" fill="${topC}" />
     <path d="M50 74 L50 100" stroke="rgba(0,0,0,0.3)" stroke-width="3"/>
     <path d="M44 68 L50 74 L56 68" fill="white" />`,
  ];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="circ"><circle cx="50" cy="50" r="50"/></clipPath>
      </defs>
      <g clipPath="url(#circ)">
        {/* Top / outfit */}
        <g dangerouslySetInnerHTML={{ __html: topPaths[cfg.top] }} />
        {/* Neck */}
        <rect x="43" y="62" width="14" height="14" rx="3" fill={skin} />
        {/* Face */}
        <ellipse cx="50" cy="46" rx="21" ry="23" fill={skin} />
        {/* Hair */}
        <g dangerouslySetInnerHTML={{ __html: hairPaths[cfg.hair] }} />
        {/* Ears */}
        <ellipse cx="29" cy="48" rx="4" ry="5.5" fill={skin} />
        <ellipse cx="71" cy="48" rx="4" ry="5.5" fill={skin} />
        {/* Nose */}
        <ellipse cx="50" cy="54" rx="3" ry="2" fill={`${skin}bb`} />
        {/* Eyes */}
        <g dangerouslySetInnerHTML={{ __html: eyeSets[cfg.eyes] }} />
        {/* Mouth */}
        <path d="M43 60 Q50 65 57 60" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Cheeks */}
        <ellipse cx="36" cy="54" rx="5" ry="3" fill="rgba(255,150,120,0.25)" />
        <ellipse cx="64" cy="54" rx="5" ry="3" fill="rgba(255,150,120,0.25)" />
      </g>
    </svg>
  );
}

/* ── Rendered avatar circle (used externally) ── */
export function AvatarDisplay({ config, size = 48 }: { config: AvatarConfig; size?: number }) {
  const bg = BG_COLORS[config.bg];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, overflow: "hidden", flexShrink: 0 }}>
      <AvatarSVG cfg={config} size={size} />
    </div>
  );
}

/* ── Storage ── */
const STORAGE_KEY = "jrc_avatar_config";
export function loadAvatarConfig(): AvatarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_AVATAR, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_AVATAR };
}
export function saveAvatarConfig(cfg: AvatarConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

/* ── Picker row ── */
function PickerRow<T>({
  label, value, options, onChange, renderOption,
}: {
  label: string; value: T; options: T[]; onChange: (v: T) => void;
  renderOption: (o: T, selected: boolean) => React.ReactNode;
}) {
  return (
    <div>
      <p className="text-gray-500 font-black mb-2" style={{ fontSize: 10, letterSpacing: 0.8 }}>{label.toUpperCase()}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((o, i) => (
          <button key={i} onClick={() => onChange(o)} className="transition-all" style={{ outline: "none" }}>
            {renderOption(o, o === value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── IndexPicker: arrows through an index ── */
function IndexPicker({ label, value, max, onChange, preview }: {
  label: string; value: number; max: number; onChange: (v: number) => void; preview: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-gray-400 font-black" style={{ fontSize: 12 }}>{label}</p>
      <div className="flex items-center gap-3">
        {preview}
        <button onClick={() => onChange((value - 1 + max) % max)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 transition-all">
          <ChevronLeft size={14} />
        </button>
        <span className="text-white font-black" style={{ fontSize: 12, minWidth: 16, textAlign: "center" }}>{value + 1}</span>
        <button onClick={() => onChange((value + 1) % max)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 transition-all">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Main Avatar Creator Modal ── */
interface AvatarCreatorProps { onClose: () => void; onSave: (cfg: AvatarConfig) => void; initialConfig: AvatarConfig; }

export function AvatarCreator({ onClose, onSave, initialConfig }: AvatarCreatorProps) {
  const [cfg, setCfg] = useState<AvatarConfig>({ ...initialConfig });
  const set = useCallback(<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v })), []);

  const randomize = () => {
    setCfg({
      skin:      Math.floor(Math.random() * SKIN_TONES.length),
      hair:      Math.floor(Math.random() * 8),
      hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
      eyes:      Math.floor(Math.random() * 5),
      top:       Math.floor(Math.random() * 8),
      topColor:  Math.floor(Math.random() * TOP_COLORS.length),
      bg:        Math.floor(Math.random() * BG_COLORS.length),
    });
  };

  const handleSave = () => { saveAvatarConfig(cfg); onSave(cfg); };

  const SECTION_H = "rgba(255,255,255,0.04)";

  const ColorSwatch = (color: string, selected: boolean) => (
    <div style={{
      width: 26, height: 26, borderRadius: "50%", background: color,
      border: selected ? "2.5px solid white" : "2.5px solid transparent",
      boxShadow: selected ? "0 0 0 2px rgba(255,255,255,0.4)" : "none",
      transition: "all 0.15s",
    }} />
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm p-0 md:p-6"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h2 className="text-white font-black" style={{ fontSize: 18 }}>Avatar Creator</h2>
            <p className="text-gray-500" style={{ fontSize: 12 }}>Customize your profile character</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.93 }} onClick={randomize}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black transition-all"
              style={{ fontSize: 12, background: "rgba(255,255,255,0.07)", color: "#aaa" }}>
              <Shuffle size={13} /> Random
            </motion.button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>
          {/* Preview */}
          <div className="flex justify-center py-6" style={{ background: BG_COLORS[cfg.bg] }}>
            <motion.div
              animate={{ rotate: [0, -3, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="rounded-full shadow-2xl"
              style={{ background: BG_COLORS[cfg.bg], border: "3px solid rgba(255,255,255,0.15)" }}
            >
              <AvatarSVG cfg={cfg} size={120} />
            </motion.div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Background */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: SECTION_H, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-white font-black" style={{ fontSize: 13 }}>Background</p>
              <div className="flex gap-2 flex-wrap">
                {BG_COLORS.map((bg, i) => (
                  <button key={i} onClick={() => set("bg", i)}
                    className="rounded-xl transition-all overflow-hidden"
                    style={{ width: 36, height: 36, background: bg, border: cfg.bg === i ? "2.5px solid white" : "2.5px solid transparent",
                      boxShadow: cfg.bg === i ? "0 0 0 2px rgba(255,255,255,0.3)" : "none" }}
                  />
                ))}
              </div>
            </div>

            {/* Skin */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: SECTION_H, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-white font-black" style={{ fontSize: 13 }}>Skin Tone</p>
              <div className="flex gap-2 flex-wrap">
                {SKIN_TONES.map((color, i) => (
                  <button key={i} onClick={() => set("skin", i)}>{ColorSwatch(color, cfg.skin === i)}</button>
                ))}
              </div>
            </div>

            {/* Hair */}
            <div className="rounded-2xl p-4 space-y-4" style={{ background: SECTION_H, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-white font-black" style={{ fontSize: 13 }}>Hair</p>
              <IndexPicker label="Style" value={cfg.hair} max={8} onChange={v => set("hair", v)}
                preview={
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: BG_COLORS[cfg.bg] }}>
                    <AvatarSVG cfg={cfg} size={32} />
                  </div>
                }
              />
              <div>
                <p className="text-gray-500 font-black mb-2" style={{ fontSize: 10, letterSpacing: 0.8 }}>COLOR</p>
                <div className="flex gap-2 flex-wrap">
                  {HAIR_COLORS.map((color, i) => (
                    <button key={i} onClick={() => set("hairColor", i)}>{ColorSwatch(color, cfg.hairColor === i)}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Eyes */}
            <div className="rounded-2xl p-4" style={{ background: SECTION_H, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-white font-black mb-3" style={{ fontSize: 13 }}>Eyes</p>
              <IndexPicker label="Shape" value={cfg.eyes} max={5} onChange={v => set("eyes", v)}
                preview={
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: BG_COLORS[cfg.bg] }}>
                    <AvatarSVG cfg={cfg} size={32} />
                  </div>
                }
              />
            </div>

            {/* Outfit */}
            <div className="rounded-2xl p-4 space-y-4" style={{ background: SECTION_H, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-white font-black" style={{ fontSize: 13 }}>Outfit</p>
              <IndexPicker label="Style" value={cfg.top} max={8} onChange={v => set("top", v)}
                preview={
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: BG_COLORS[cfg.bg] }}>
                    <AvatarSVG cfg={cfg} size={32} />
                  </div>
                }
              />
              <div>
                <p className="text-gray-500 font-black mb-2" style={{ fontSize: 10, letterSpacing: 0.8 }}>COLOR</p>
                <div className="flex gap-2 flex-wrap">
                  {TOP_COLORS.map((color, i) => (
                    <button key={i} onClick={() => set("topColor", i)}>{ColorSwatch(color, cfg.topColor === i)}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2"
              style={{ fontSize: 16, background: "linear-gradient(135deg,#FF8C00,#e67e00)", boxShadow: "0 8px 24px rgba(255,140,0,0.35)" }}
            >
              <Check size={18} /> Save Avatar
            </motion.button>
            <div style={{ height: 16 }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
