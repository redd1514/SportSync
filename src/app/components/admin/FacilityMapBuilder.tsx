import {
  useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Save, Trash2, X, CheckCircle, ZoomIn, ZoomOut, Grid3X3,
  RotateCcw, Layers, Copy, Minus, Plus, Undo2, Redo2,
  PanelLeftOpen, PanelLeftClose, MapPin, Building2, Maximize2,
  ChevronRight, ChevronLeft, ArrowRight, Map, Eye,
  MoreHorizontal, Pencil, Info, HelpCircle,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
} from 'lucide-react';
import {
  useFacilityMap, CourtBlock, FacilityMap, getSportMapColor,
} from '../../contexts/FacilityMapContext';
import { useAddons } from '../../contexts/AddonsContext';
import { SportIcon } from '../SportIcons';
import { ConfirmDialog, ConfirmDialogOptions } from '../shared/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingScreen } from '../shared/LoadingScreen';

/* ─── Constants ─────────────────────────────────────────────────── */
const GRID     = 40;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;
const HANDLE_PX = 8; // handle half-size, px per handle side

const SPORTS = [
  { sport: 'Basketball',   defaultW: 280, defaultH: 160, color: '#FF8C00', desc: '28×16 m' },
  { sport: 'Volleyball',   defaultW: 260, defaultH: 150, color: '#0047AB', desc: '18×9 m'  },
  { sport: 'Badminton',    defaultW: 130, defaultH: 100, color: '#22c55e', desc: '13.4×6.1 m' },
  { sport: 'Pickleball',   defaultW: 120, defaultH: 90,  color: '#a855f7', desc: '13.4×6.1 m' },
  { sport: 'Billiards',    defaultW: 110, defaultH: 70,  color: '#ec4899', desc: 'Pool table'  },
  { sport: 'Table Tennis', defaultW: 110, defaultH: 65,  color: '#06b6d4', desc: '2.74×1.52 m' },
];

const CANVAS_PRESETS = [
  { label: 'Small',  desc: 'Boutique gym',    w: 900,  h: 600  },
  { label: 'Medium', desc: 'Mid-size center', w: 1400, h: 900  },
  { label: 'Large',  desc: 'Large complex',   w: 1800, h: 1100 },
];

const CANVAS_MIN_W = 400; const CANVAS_MAX_W = 2400;
const CANVAS_MIN_H = 300; const CANVAS_MAX_H = 1600;

type HandleId = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';

const HANDLE_CURSORS: Record<HandleId,string> = {
  nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize',
  se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize',
};

const snap  = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function handlePositions(b: CourtBlock) {
  return [
    { id:'nw'as HandleId, x:b.x,            y:b.y            },
    { id:'n' as HandleId, x:b.x+b.width/2,  y:b.y            },
    { id:'ne'as HandleId, x:b.x+b.width,    y:b.y            },
    { id:'e' as HandleId, x:b.x+b.width,    y:b.y+b.height/2 },
    { id:'se'as HandleId, x:b.x+b.width,    y:b.y+b.height   },
    { id:'s' as HandleId, x:b.x+b.width/2,  y:b.y+b.height   },
    { id:'sw'as HandleId, x:b.x,            y:b.y+b.height   },
    { id:'w' as HandleId, x:b.x,            y:b.y+b.height/2 },
  ];
}

function applyResize(handle:HandleId, dx:number, dy:number, orig:CourtBlock): CourtBlock {
  let { x, y, width:w, height:h } = orig;
  const MIN = GRID;
  if (handle.includes('e')) w = Math.max(MIN, w+dx);
  if (handle.includes('s')) h = Math.max(MIN, h+dy);
  if (handle.includes('w')) { const nw=Math.max(MIN,w-dx); x=x+w-nw; w=nw; }
  if (handle.includes('n')) { const nh=Math.max(MIN,h-dy); y=y+h-nh; h=nh; }
  return { ...orig, x:snap(x), y:snap(y), width:snap(w), height:snap(h) };
}

/* ─── New-Map Wizard ─────────────────────────────────────────────── */
interface WizardState {
  name: string; branch: string; location: string;
  preset: number; customW: string; customH: string;
}

function ValidationMsg({ msg }: { msg: string }) {
  return msg ? (
    <p className="flex items-center gap-1 mt-1.5" style={{ fontSize:11, color:'#ef4444' }}>
      <Info size={10} /> {msg}
    </p>
  ) : null;
}

function NewMapWizard({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (meta: { name:string; branch:string; location:string; canvasW:number; canvasH:number }) => void;
}) {
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1);
  const [form, setForm] = useState<WizardState>({
    name:'', branch:'', location:'', preset:1, customW:'1400', customH:'900',
  });
  const [errors, setErrors] = useState<Partial<WizardState>>({});
  const [editingStep, setEditingStep] = useState<number|null>(null);

  const totalSteps = 4;

  const validate = (s: number): boolean => {
    const e: Partial<WizardState> = {};
    if (s === 0) {
      if (form.name.trim().length < 2) e.name = 'Map name must be at least 2 characters';
      if (form.branch.trim().length < 2) e.branch = 'Branch name must be at least 2 characters';
    }
    if (s === 1) {
      if (form.location.trim().length < 3) e.location = 'Please enter a valid location';
    }
    if (s === 2 && form.preset === 3) {
      const w = parseInt(form.customW); const h = parseInt(form.customH);
      if (!w || w < CANVAS_MIN_W || w > CANVAS_MAX_W) e.customW = `Width must be ${CANVAS_MIN_W}–${CANVAS_MAX_W}`;
      if (!h || h < CANVAS_MIN_H || h > CANVAS_MAX_H) e.customH = `Height must be ${CANVAS_MIN_H}–${CANVAS_MAX_H}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (d: number, skipValidate = false) => {
    if (d > 0 && !skipValidate && !validate(step)) return;
    setErrors({});
    setDir(d);
    setStep(s => s + d);
  };

  const goToStep = (s: number) => {
    setErrors({});
    setDir(s > step ? 1 : -1);
    setStep(s);
  };

  const resolveCanvas = () => {
    if (form.preset < 3) return { canvasW: CANVAS_PRESETS[form.preset].w, canvasH: CANVAS_PRESETS[form.preset].h };
    const w = clamp(parseInt(form.customW)||1400, CANVAS_MIN_W, CANVAS_MAX_W);
    const h = clamp(parseInt(form.customH)||900, CANVAS_MIN_H, CANVAS_MAX_H);
    return { canvasW: w, canvasH: h };
  };

  const { canvasW, canvasH } = resolveCanvas();

  const STEP4_ROWS = [
    { label:'Map Name',    value:form.name,    icon:Building2, color:'#FF8C00', goStep:0 },
    { label:'Branch',      value:form.branch,  icon:Building2, color:'#0047AB', goStep:0 },
    { label:'Location',    value:form.location,icon:MapPin,    color:'#22c55e', goStep:1 },
    { label:'Canvas Size', value:form.preset<3?`${CANVAS_PRESETS[form.preset].label} (${CANVAS_PRESETS[form.preset].w}×${CANVAS_PRESETS[form.preset].h})`:`Custom (${canvasW}×${canvasH})`, icon:Maximize2, color:'#a855f7', goStep:2 },
  ];

  const STEPS = [
    /* Step 0 – Identity */
    <div key="s0">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background:'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
        <Building2 size={28} className="text-white" />
      </div>
      <h2 className="text-white text-center mb-1" style={{ fontSize:20, fontWeight:900 }}>Name your facility map</h2>
      <p className="text-gray-400 text-center mb-6" style={{ fontSize:13, lineHeight:1.6 }}>
        Give this map a clear name. You can create separate maps for each branch or location.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-gray-400 block mb-1.5 flex items-center gap-1.5" style={{ fontSize:11, fontWeight:800, letterSpacing:.5 }}>
            MAP NAME <span className="text-red-400">*</span>
          </label>
          <input autoFocus value={form.name} onChange={e=>{ setForm(f=>({...f,name:e.target.value})); setErrors(er=>({...er,name:undefined})); }}
            placeholder="e.g. JRC Main Facility"
            className="w-full rounded-xl px-4 py-3 text-white focus:outline-none transition-colors"
            style={{ fontSize:14, background:'rgba(255,255,255,0.06)', border:`1px solid ${errors.name?'#ef4444':'rgba(255,255,255,0.1)'}` }} />
          <ValidationMsg msg={errors.name||''} />
        </div>
        <div>
          <label className="text-gray-400 block mb-1.5 flex items-center gap-1.5" style={{ fontSize:11, fontWeight:800, letterSpacing:.5 }}>
            BRANCH NAME <span className="text-red-400">*</span>
          </label>
          <input value={form.branch} onChange={e=>{ setForm(f=>({...f,branch:e.target.value})); setErrors(er=>({...er,branch:undefined})); }}
            placeholder="e.g. Main Branch"
            className="w-full rounded-xl px-4 py-3 text-white focus:outline-none transition-colors"
            style={{ fontSize:14, background:'rgba(255,255,255,0.06)', border:`1px solid ${errors.branch?'#ef4444':'rgba(255,255,255,0.1)'}` }} />
          <ValidationMsg msg={errors.branch||''} />
          <p className="flex items-center gap-1 mt-2 text-gray-600" style={{ fontSize:11 }}>
            <Info size={11} /> This name appears to customers and staff when browsing maps.
          </p>
        </div>
      </div>
    </div>,

    /* Step 1 – Location */
    <div key="s1">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background:'linear-gradient(135deg,#0047AB,#003a8c)' }}>
        <MapPin size={28} className="text-white" />
      </div>
      <h2 className="text-white text-center mb-1" style={{ fontSize:20, fontWeight:900 }}>Where is this facility?</h2>
      <p className="text-gray-400 text-center mb-6" style={{ fontSize:13, lineHeight:1.6 }}>
        Location helps customers and staff identify which branch they are viewing.
      </p>
      <div>
        <label className="text-gray-400 block mb-1.5 flex items-center gap-1.5" style={{ fontSize:11, fontWeight:800, letterSpacing:.5 }}>
          ADDRESS / LOCATION <span className="text-red-400">*</span>
        </label>
        <input autoFocus value={form.location} onChange={e=>{ setForm(f=>({...f,location:e.target.value})); setErrors(er=>({...er,location:undefined})); }}
          placeholder="e.g. 123 McKinley St, Valenzuela City"
          className="w-full rounded-xl px-4 py-3 text-white focus:outline-none transition-colors"
          style={{ fontSize:14, background:'rgba(255,255,255,0.06)', border:`1px solid ${errors.location?'#ef4444':'rgba(255,255,255,0.1)'}` }} />
        <ValidationMsg msg={errors.location||''} />
        <p className="flex items-center gap-1 mt-2 text-gray-600" style={{ fontSize:11 }}>
          <Info size={11} /> Shown as a subtitle below the map name in the viewer.
        </p>
      </div>
    </div>,

    /* Step 2 – Canvas size */
    <div key="s2">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)' }}>
        <Maximize2 size={28} className="text-white" />
      </div>
      <h2 className="text-white text-center mb-1" style={{ fontSize:20, fontWeight:900 }}>Choose your canvas size</h2>
      <p className="text-gray-400 text-center mb-5" style={{ fontSize:13, lineHeight:1.5 }}>
        Pick a canvas that fits your facility. Courts can be arranged after creation.
      </p>
      <div className="space-y-2">
        {CANVAS_PRESETS.map((p, i) => (
          <button key={p.label} onClick={()=>setForm(f=>({...f,preset:i}))}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left"
            style={{
              background: form.preset===i?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.03)',
              borderColor: form.preset===i?'#22c55e50':'rgba(255,255,255,0.08)',
            }}>
            <div className="relative flex-shrink-0 w-12 h-8 rounded-md" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-sm" style={{
                  width: i===0?'50%':i===1?'76%':'92%',
                  height: i===0?'50%':i===1?'70%':'85%',
                  background: form.preset===i?'#22c55e28':'rgba(255,255,255,0.06)',
                  border: `1px solid ${form.preset===i?'#22c55e60':'rgba(255,255,255,0.12)'}`,
                }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-black" style={{ fontSize:13 }}>{p.label}</span>
                {i===1 && <span className="px-2 py-0.5 rounded-full text-white font-black" style={{ fontSize:9, background:'#22c55e', letterSpacing:.8 }}>RECOMMENDED</span>}
              </div>
              <p className="text-gray-500" style={{ fontSize:10 }}>{p.desc} · {p.w}×{p.h} units</p>
            </div>
            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor:form.preset===i?'#22c55e':'rgba(255,255,255,0.2)' }}>
              {form.preset===i && <div className="w-2 h-2 rounded-full bg-[#22c55e]" />}
            </div>
          </button>
        ))}
        {/* Custom */}
        <button onClick={()=>setForm(f=>({...f,preset:3}))}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left"
          style={{ background:form.preset===3?'rgba(168,85,247,0.08)':'rgba(255,255,255,0.03)', borderColor:form.preset===3?'#a855f750':'rgba(255,255,255,0.08)' }}>
          <div className="relative flex-shrink-0 w-12 h-8 rounded-md flex items-center justify-center" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-gray-500 font-black" style={{ fontSize:11 }}>?</span>
          </div>
          <div className="flex-1">
            <span className="text-white font-black" style={{ fontSize:13 }}>Custom</span>
            {form.preset===3 && (
              <div className="flex items-center gap-2 mt-2" onClick={e=>e.stopPropagation()}>
                <div className="flex flex-col flex-1">
                  <input type="number" value={form.customW}
                    onChange={e=>{ setForm(f=>({...f,customW:e.target.value})); setErrors(er=>({...er,customW:undefined})); }}
                    placeholder="Width"
                    className="w-full rounded-lg px-2 py-1.5 text-white focus:outline-none"
                    style={{ fontSize:12, background:'rgba(255,255,255,0.08)', border:`1px solid ${errors.customW?'#ef4444':'rgba(255,255,255,0.15)'}` }} />
                  <p className="text-gray-700 mt-0.5" style={{ fontSize:9 }}>{CANVAS_MIN_W}–{CANVAS_MAX_W}px</p>
                  <ValidationMsg msg={errors.customW||''} />
                </div>
                <span className="text-gray-600 flex-shrink-0">×</span>
                <div className="flex flex-col flex-1">
                  <input type="number" value={form.customH}
                    onChange={e=>{ setForm(f=>({...f,customH:e.target.value})); setErrors(er=>({...er,customH:undefined})); }}
                    placeholder="Height"
                    className="w-full rounded-lg px-2 py-1.5 text-white focus:outline-none"
                    style={{ fontSize:12, background:'rgba(255,255,255,0.08)', border:`1px solid ${errors.customH?'#ef4444':'rgba(255,255,255,0.15)'}` }} />
                  <p className="text-gray-700 mt-0.5" style={{ fontSize:9 }}>{CANVAS_MIN_H}–{CANVAS_MAX_H}px</p>
                  <ValidationMsg msg={errors.customH||''} />
                </div>
              </div>
            )}
          </div>
          <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
            style={{ borderColor:form.preset===3?'#a855f7':'rgba(255,255,255,0.2)' }}>
            {form.preset===3 && <div className="w-2 h-2 rounded-full" style={{ background:'#a855f7' }} />}
          </div>
        </button>
      </div>
    </div>,

    /* Step 3 – Review */
    <div key="s3">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background:'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
        <CheckCircle size={28} className="text-white" />
      </div>
      <h2 className="text-white text-center mb-1" style={{ fontSize:20, fontWeight:900 }}>Ready to build!</h2>
      <p className="text-gray-400 text-center mb-5" style={{ fontSize:13 }}>
        Review your map details. Click any row to edit it.
      </p>
      <div className="space-y-2">
        {STEP4_ROWS.map(row => (
          <button key={row.label} onClick={()=>goToStep(row.goStep)}
            className="w-full flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-white/5 hover:border-white/15 transition-all text-left group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:`${row.color}18` }}>
              <row.icon size={13} style={{ color:row.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500" style={{ fontSize:10, fontWeight:800, letterSpacing:.5 }}>{row.label.toUpperCase()}</p>
              <p className="text-white font-black truncate" style={{ fontSize:13 }}>{row.value}</p>
            </div>
            <Pencil size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)' }}>
      <motion.div
        initial={{ opacity:0, scale:0.92, y:20 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.92 }}
        transition={{ type:'spring', stiffness:420, damping:32 }}
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{ background:'linear-gradient(145deg,#1a1a1a,#131313)', border:'1px solid rgba(255,255,255,0.09)' }}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/8 transition-all">
          <X size={15} />
        </button>

        {/* Progress */}
        <div className="flex justify-center pt-5 pb-2 gap-2">
          {Array.from({length:totalSteps}).map((_,i)=>(
            <button key={i} onClick={()=>goToStep(i)}
              className="rounded-full transition-all duration-300"
              style={{ width:i===step?20:6, height:6, background:i<=step?'#FF8C00':'rgba(255,255,255,0.12)' }} />
          ))}
        </div>

        {/* Content */}
        <div className="px-7 pt-5 pb-2" style={{ minHeight:340 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step}
              initial={{ opacity:0, x:dir*24 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-dir*24 }}
              transition={{ duration:0.18, ease:[0.4,0,0.2,1] }}
            >
              {STEPS[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className="px-7 py-5 flex gap-3">
          <button onClick={()=> step > 0 ? go(-1, true) : onClose()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all font-black"
            style={{ fontSize:13 }}>
            {step > 0 ? <><ChevronLeft size={15}/> Back</> : 'Cancel'}
          </button>
          <button
            onClick={() => {
              if (step < totalSteps-1) { go(1); return; }
              if (!validate(step)) return;
              onCreate({ name:form.name.trim(), branch:form.branch.trim(), location:form.location.trim(), canvasW, canvasH });
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-black transition-all text-white"
            style={{
              fontSize:13,
              background:'linear-gradient(135deg,#FF8C00,#e67e00)',
              boxShadow:'0 6px 20px rgba(255,140,0,0.3)',
            }}
          >
            {step < totalSteps-1 ? <><span>Next</span><ArrowRight size={15}/></> : <><Map size={15}/><span>Create Map</span></>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Edit Map Details Modal ─────────────────────────────────────── */
function EditMapModal({ map, onSave, onClose }: {
  map: FacilityMap;
  onSave: (meta: {name:string;branch:string;location:string}) => void;
  onClose: () => void;
}) {
  const [name,     setName]     = useState(map.name);
  const [branch,   setBranch]   = useState(map.branch);
  const [location, setLocation] = useState(map.location);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)' }}>
      <motion.div initial={{ opacity:0, scale:.94 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.94 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <p className="text-white font-black" style={{ fontSize:15 }}>Edit Map Details</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label:'Map Name', val:name, set:setName, placeholder:'e.g. JRC Main Facility' },
            { label:'Branch',   val:branch, set:setBranch, placeholder:'e.g. Main Branch' },
            { label:'Location', val:location, set:setLocation, placeholder:'e.g. Valenzuela City' },
          ].map(f=>(
            <div key={f.label}>
              <label className="text-gray-500 block mb-1" style={{ fontSize:11, fontWeight:800 }}>{f.label.toUpperCase()}</label>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder}
                className="w-full rounded-xl px-3 py-2 text-white focus:outline-none"
                style={{ fontSize:13, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }} />
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all font-black" style={{ fontSize:13 }}>Cancel</button>
          <button onClick={()=>onSave({ name:name.trim()||map.name, branch:branch.trim()||map.branch, location:location.trim()||map.location })}
            className="flex-1 py-2.5 rounded-xl text-white font-black transition-all" style={{ fontSize:13, background:'linear-gradient(135deg,#FF8C00,#e67e00)' }}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────── */
function EmptyMapState({ onNew }: { onNew:()=>void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#0A0A0A] p-8">
      <motion.div initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }} transition={{ duration:.4 }}
        className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background:'rgba(255,140,0,0.08)', border:'1px solid rgba(255,140,0,0.2)' }}>
          <Map size={36} style={{ color:'#FF8C00' }} />
        </div>
        <div>
          <h2 className="text-white" style={{ fontSize:21, fontWeight:900 }}>No Facility Maps Yet</h2>
          <p className="text-gray-500 mt-2" style={{ fontSize:13, lineHeight:1.7 }}>
            Design your courts using our drag-and-drop builder.<br/>
            Create separate maps for each branch or location.
          </p>
        </div>
        <div className="w-full bg-[#141414] rounded-2xl p-4 border border-white/5 text-left space-y-2.5 mt-1">
          {[
            { n:'1', t:'Create a map', d:'Set the facility name and branch' },
            { n:'2', t:'Pick canvas size', d:'Choose how large your map canvas is' },
            { n:'3', t:'Drag courts onto canvas', d:'Place and resize each court' },
            { n:'4', t:'Publish to go live', d:'Users and staff see it instantly' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background:'rgba(255,140,0,0.15)', border:'1px solid rgba(255,140,0,0.3)' }}>
                <span style={{ fontSize:9, fontWeight:900, color:'#FF8C00' }}>{s.n}</span>
              </div>
              <div>
                <p className="text-white font-black" style={{ fontSize:12 }}>{s.t}</p>
                <p className="text-gray-600" style={{ fontSize:11 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }} onClick={onNew}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-white font-black mt-1"
          style={{ background:'linear-gradient(135deg,#FF8C00,#e67e00)', fontSize:14, boxShadow:'0 8px 24px rgba(255,140,0,0.35)' }}>
          <Plus size={17} /> Create Your First Map
        </motion.button>
      </motion.div>
    </div>
  );
}

/* ─── Inspector Panel ────────────────────────────────────────────── */
function InspectorPanel({ block, canvasW, canvasH, allBlocks, onUpdate, onDelete, onDuplicate, onClose,
  onBringToFront, onBringForward, onSendBackward, onSendToBack, customSports,
}: {
  block: CourtBlock; canvasW:number; canvasH:number; allBlocks: CourtBlock[];
  onUpdate:(p:Partial<CourtBlock>)=>void;
  onDelete:()=>void; onDuplicate:()=>void; onClose:()=>void;
  onBringToFront:()=>void; onBringForward:()=>void; onSendBackward:()=>void; onSendToBack:()=>void;
  customSports: { name:string; color:string }[];
}) {
  const isBuiltIn = SPORTS.some(s => s.sport === block.sport);
  const isCustom  = !isBuiltIn;
  const color = isCustom ? (customSports.find(c=>c.name===block.sport)?.color ?? '#6b7280') : getSportMapColor(block.sport);
  const [localName, setLocalName] = useState(block.name);
  const [localSport, setLocalSport] = useState(block.sport);
  useEffect(()=>{ setLocalName(block.name); setLocalSport(block.sport); },[block.id, block.name, block.sport]);

  const NumField = ({ label, valKey, min, max }: { label:string; valKey:'x'|'y'|'width'|'height'; min:number; max:number }) => (
    <div>
      <p className="text-gray-600 mb-1" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>{label}</p>
      <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5">
        <button onClick={()=>onUpdate({ [valKey]: Math.max(min, block[valKey]-GRID) })}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/8 transition-all flex-shrink-0 font-black" style={{ fontSize:13 }}>−</button>
        <input type="number" value={block[valKey]}
          onChange={e=>onUpdate({ [valKey]:clamp(parseInt(e.target.value)||min, min, max) })}
          className="flex-1 text-center text-white focus:outline-none bg-transparent"
          style={{ fontSize:11, fontWeight:700, minWidth:0 }} />
        <button onClick={()=>onUpdate({ [valKey]: Math.min(max, block[valKey]+GRID) })}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/8 transition-all flex-shrink-0 font-black" style={{ fontSize:13 }}>+</button>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ x:16, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:16, opacity:0 }}
      transition={{ type:'spring', stiffness:420, damping:34 }}
      className="absolute right-3 top-3 bottom-3 z-20 flex flex-col rounded-2xl"
      style={{ width:252, background:'rgba(15,15,15,0.97)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 16px 48px rgba(0,0,0,0.7)', overflow:'hidden' }}
      onClick={e=>e.stopPropagation()}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/6 flex-shrink-0"
        style={{ background:`${color}0d` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:`${color}22` }}>
          {isCustom
            ? <span style={{fontSize:10,fontWeight:900,color}}>{block.sport.slice(0,2).toUpperCase()}</span>
            : <SportIcon sport={block.sport} size={13} color={color} strokeWidth={2.5} />}
        </div>
        <span className="text-white font-black flex-1 truncate" style={{ fontSize:12 }}>Court Config</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-all">
          <X size={11} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 p-3.5 space-y-4 palette-scroll" style={{overflowY:'auto'}} onWheel={e => e.stopPropagation()}>

        {/* Name */}
        <div>
          <p className="text-gray-600 mb-1.5" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>NAME</p>
          <input value={localName} onChange={e=>setLocalName(e.target.value)}
            onBlur={()=>onUpdate({ name:localName })}
            onKeyDown={e=>{ if(e.key==='Enter'){ onUpdate({ name:localName }); (e.target as HTMLElement).blur(); } }}
            className="w-full rounded-xl px-3 py-2.5 text-white focus:outline-none"
            style={{ fontSize:13, fontWeight:700, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }} />
        </div>

        {/* Sport – built-in shows icon grid; custom shows text input */}
        <div>
          <p className="text-gray-600 mb-2" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>
            {isCustom ? 'SPORT NAME' : 'SPORT TYPE'}
          </p>
          {isCustom ? (
            <input
              value={localSport}
              onChange={e=>setLocalSport(e.target.value)}
              onBlur={()=>{ if(localSport.trim()) onUpdate({ sport:localSport.trim() }); }}
              onKeyDown={e=>{ if(e.key==='Enter'&&localSport.trim()){ onUpdate({ sport:localSport.trim() }); (e.target as HTMLElement).blur(); } }}
              placeholder="e.g. Squash, Archery..."
              className="w-full rounded-xl px-3 py-2.5 text-white focus:outline-none"
              style={{ fontSize:13, fontWeight:700, background:'rgba(255,255,255,0.06)', border:`1px solid ${color}40` }}
            />
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {SPORTS.map(t => {
                const count = allBlocks.filter(b => b.sport === t.sport && b.id !== block.id).length + 1;
                return (
                  <button key={t.sport} onClick={()=>{
                    if (block.sport !== t.sport) onUpdate({ sport:t.sport, name:`${t.sport} ${count}` });
                  }}
                    className="rounded-xl p-2 flex flex-col items-center gap-1 transition-all"
                    style={{
                      background:block.sport===t.sport?`${t.color}20`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${block.sport===t.sport?t.color+'50':'rgba(255,255,255,0.06)'}`,
                    }} title={t.sport}>
                    <SportIcon sport={t.sport} size={15} color={block.sport===t.sport?t.color:'#444'} strokeWidth={2}/>
                    <span style={{ fontSize:8, color:block.sport===t.sport?t.color:'#444', fontWeight:900 }}>{t.sport.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <p className="text-gray-600 mb-2" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>STATUS</p>
          <div className="flex gap-1.5">
            {(['available','maintenance'] as const).map(s=>{
              const sc=s==='available'?'#22c55e':'#f97316';
              const active=block.status===s;
              return (
                <button key={s} onClick={()=>onUpdate({ status:s })}
                  className="flex-1 py-2 rounded-xl font-black transition-all capitalize"
                  style={{ fontSize:11, background:active?`${sc}18`:'rgba(255,255,255,0.04)', color:active?sc:'#555', border:`1px solid ${active?sc+'45':'rgba(255,255,255,0.06)'}` }}>
                  {s==='available'?'Open':'Maintenance'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Layer order */}
        <div>
          <p className="text-gray-600 mb-2" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>LAYER ORDER</p>
          <div className="grid grid-cols-4 gap-1">
            {[
              { icon:ChevronsUp,   label:'Front',    action:onBringToFront,  title:'Bring to Front' },
              { icon:ChevronUp,    label:'Fwd',      action:onBringForward,  title:'Bring Forward' },
              { icon:ChevronDown,  label:'Back',     action:onSendBackward,  title:'Send Backward' },
              { icon:ChevronsDown, label:'Bkmost',   action:onSendToBack,    title:'Send to Back' },
            ].map(btn=>(
              <button key={btn.label} onClick={btn.action} title={btn.title}
                className="flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all hover:bg-white/10 text-gray-500 hover:text-white"
                style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <btn.icon size={13}/>
                <span style={{ fontSize:7, fontWeight:800, letterSpacing:.3 }}>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Position */}
        <div>
          <p className="text-gray-600 mb-2" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>POSITION (px)</p>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="X" valKey="x" min={0} max={canvasW - block.width} />
            <NumField label="Y" valKey="y" min={0} max={canvasH - block.height} />
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="text-gray-600 mb-2" style={{ fontSize:9, fontWeight:800, letterSpacing:.6 }}>SIZE (px)</p>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="WIDTH"  valKey="width"  min={GRID} max={canvasW - block.x} />
            <NumField label="HEIGHT" valKey="height" min={GRID} max={canvasH - block.y} />
          </div>
          <p className="text-gray-700 mt-1.5" style={{ fontSize:9 }}>Grid: {GRID}px · {block.width}×{block.height}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3.5 py-3 border-t border-white/6 flex gap-2 flex-shrink-0">
        <button onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-gray-400 hover:text-white transition-all"
          style={{ fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <Copy size={12}/> Clone
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-red-400 hover:text-white hover:bg-red-500 transition-all"
          style={{ fontSize:11, fontWeight:700, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
          <Trash2 size={12}/> Delete
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main Builder ───────────────────────────────────────────────── */
export function FacilityMapBuilder() {
  const { maps, createMap, updateMapBlocks, publishMap, deleteMap, updateMapMeta } = useFacilityMap();
  const { allSportNames, customSports, addCustomSport, deleteCustomSport } = useAddons();

  /* ── which map is being edited ── */
  const [editingMapId, setEditingMapId] = useState<string|null>(null);
  const editingMap = maps.find(m=>m.id===editingMapId) ?? null;

  /* Auto-select first map */
  useEffect(()=>{
    if (!editingMapId && maps.length>0) setEditingMapId(maps[0].id);
    if (editingMapId && !maps.find(m=>m.id===editingMapId) && maps.length>0) setEditingMapId(maps[0].id);
  },[maps]);

  /* ── wizard / meta edit ── */
  const [showWizard,    setShowWizard]    = useState(false);
  const [mapMenuData,   setMapMenuData]   = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingMeta,   setEditingMeta]   = useState<FacilityMap|null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* ── Custom sport palette input ── */
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSportInput, setCustomSportInput] = useState('');
  
  /* ── Clipboard ── */
  const clipboardRef = useRef<CourtBlock | null>(null);

  /* ── editor state ── */
  const [blocks,     setBlocks]     = useState<CourtBlock[]>([]);
  const [history,    setHistory]    = useState<CourtBlock[][]>([[]]);
  const [histIdx,    setHistIdx]    = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  /* Sync blocks when map changes */
  useEffect(()=>{
    if (!editingMap) { setBlocks([]); return; }
    setIsLoadingMap(true);
    const b = [...editingMap.blocks];
    const t = setTimeout(()=>{
      setBlocks(b);
      setHistory([b]);
      setHistIdx(0);
      setHasChanges(false);
      setIsLoadingMap(false);
      requestAnimationFrame(fitView);
    }, 200);
    return ()=>clearTimeout(t);
  },[editingMapId]); // eslint-disable-line

  const pushHistory = useCallback((b:CourtBlock[])=>{
    setHistory(h=>{ const n=[...h.slice(0,histIdx+1), b]; if(n.length>40)n.shift(); return n; });
    setHistIdx(i=>Math.min(i+1,39));
  },[histIdx]);

  const mutate = useCallback((fn:(p:CourtBlock[])=>CourtBlock[], doSnap=true)=>{
    setBlocks(prev=>{
      const next=fn(prev);
      if(doSnap) pushHistory(next);
      setHasChanges(true);
      return next;
    });
  },[pushHistory]);

  /* ── selection ── */
  const [selectedId,  setSelectedId]  = useState<string|null>(null);
  const [dragState,   setDragState]   = useState<{id:string;ox:number;oy:number}|null>(null);
  const [resizeState, setResizeState] = useState<{id:string;handle:HandleId;sx:number;sy:number;orig:CourtBlock}|null>(null);
  /** Pending drag – stored in a ref to avoid re-renders; promoted to dragState after threshold */
  const dragInitRef = useRef<{id:string;clientX:number;clientY:number;ox:number;oy:number}|null>(null);
  const DRAG_THRESHOLD = 5; // screen pixels before drag activates

  /* ── zoom / pan ── */
  const [zoom,      setZoom]      = useState(0.65);
  const [pan,       setPan]       = useState({ x:32, y:32 });
  const [isPanning, setIsPanning] = useState(false);
  const [panAnchor, setPanAnchor] = useState({ cx:0,cy:0,px:0,py:0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [, forceResize] = useState(0); // just for triggering re-renders on resize

  /* ── UI ── */
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [showGrid,    setShowGrid]    = useState(true);
  const [dropPreview, setDropPreview] = useState<{x:number;y:number;sport:string;w:number;h:number}|null>(null);
  const [ctxMenu,     setCtxMenu]     = useState<{id:string;px:number;py:number}|null>(null);

  /* ── confirm dialog ── */
  const [confirm, setConfirm] = useState<{open:boolean;opts:ConfirmDialogOptions|null}>({open:false,opts:null});
  const showConfirm = useCallback((opts:Omit<ConfirmDialogOptions,'onCancel'>)=>{
    setConfirm({ open:true, opts:{ ...opts, onCancel:()=>setConfirm({open:false,opts:null}) } });
  },[]);

  /* ── refs ── */
  const containerRef   = useRef<HTMLDivElement>(null);
  const lastPinchDist  = useRef(0);

  /* ResizeObserver – just trigger re-render so viewBox stays in sync */
  useEffect(()=>{
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(()=>forceResize(n=>n+1));
    ro.observe(el);
    return ()=>ro.disconnect();
  },[editingMapId]);

  /* ViewBox computed directly from DOM – always crisp */
  const getViewBox = (): string => {
    const el = containerRef.current;
    const cw = el ? el.getBoundingClientRect().width  : 800;
    const ch = el ? el.getBoundingClientRect().height : 500;
    return `${-pan.x/zoom} ${-pan.y/zoom} ${cw/zoom} ${ch/zoom}`;
  };

  /* toCanvas – screen → SVG canvas coords */
  const toCanvas = useCallback((cx:number,cy:number)=>{
    const el = containerRef.current;
    if (!el) return {x:0,y:0};
    const r = el.getBoundingClientRect();
    return { x:(cx-r.left-pan.x)/zoom, y:(cy-r.top-pan.y)/zoom };
  },[pan,zoom]);

  /* fitView */
  const fitView = useCallback(()=>{
    const el = containerRef.current;
    if (!el || !editingMap) return;
    const { width:cw, height:ch } = el.getBoundingClientRect();
    if (!cw || !ch) return;
    const pad = 48;
    const scaleX = (cw-pad*2) / editingMap.canvasW;
    const scaleY = (ch-pad*2) / editingMap.canvasH;
    const nz = clamp(Math.min(scaleX,scaleY), MIN_ZOOM, MAX_ZOOM);
    setZoom(nz);
    setPan({ x:(cw-editingMap.canvasW*nz)/2, y:(ch-editingMap.canvasH*nz)/2 });
  },[editingMap]);

  /* Wheel zoom – re-attach when editing map changes */
  useEffect(()=>{
    const el = containerRef.current;
    if (!el) return;
    const onWheel=(e:WheelEvent)=>{
      // Don't hijack scroll when cursor is over a scrollable side panel
      const target = e.target as HTMLElement;
      if (target.closest('.palette-scroll')) return;
      e.preventDefault();
      const r=el.getBoundingClientRect();
      const mx=e.clientX-r.left;
      const my=e.clientY-r.top;
      const f=e.deltaY<0?1.12:1/1.12;
      setZoom(z=>{
        const nz=clamp(z*f,MIN_ZOOM,MAX_ZOOM);
        setPan(p=>({ x:mx-(mx-p.x)*(nz/z), y:my-(my-p.y)*(nz/z) }));
        return nz;
      });
    };
    el.addEventListener('wheel',onWheel,{passive:false});
    return ()=>el.removeEventListener('wheel',onWheel);
  },[editingMapId]); // Re-attach when map (and canvas div) changes

  /* Keyboard shortcuts */
  useEffect(()=>{
    const kd=(e:KeyboardEvent)=>{
      if(e.code==='Space'&&e.target===document.body){ e.preventDefault(); setSpaceHeld(true); }
      if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){
        e.preventDefault();
        setHistIdx(i=>{ const ni=Math.max(0,i-1); setBlocks(history[ni]??blocks); return ni; });
      }
      if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='z'))){
        e.preventDefault();
        setHistIdx(i=>{ const ni=Math.min(history.length-1,i+1); setBlocks(history[ni]??blocks); return ni; });
      }
      if((e.ctrlKey||e.metaKey)&&e.key==='s'){ e.preventDefault(); handlePublish(); }
      if((e.ctrlKey||e.metaKey)&&e.key==='c'&&selectedId&&e.target===document.body){
        e.preventDefault();
        const b = blocks.find(x=>x.id===selectedId);
        if(b) clipboardRef.current = b;
      }
      if((e.ctrlKey||e.metaKey)&&e.key==='v'&&clipboardRef.current&&e.target===document.body){
        e.preventDefault();
        const src = clipboardRef.current;
        const dup:CourtBlock={...src,id:`${src.id}-cp-${Date.now()}`,x:src.x+GRID,y:src.y+GRID,name:`${src.name} (Copy)`};
        mutate(prev=>[...prev,dup], true);
        setSelectedId(dup.id);
        setCtxMenu(null);
        clipboardRef.current = dup; // subsequent pastes will offset further
      }
      if((e.key==='Delete'||e.key==='Backspace')&&selectedId&&e.target===document.body){
        e.preventDefault(); requestDelete(selectedId);
      }
      if(e.key==='Escape'){ setSelectedId(null); setCtxMenu(null); setShowShortcuts(false); }
      if(e.key==='f'&&!e.ctrlKey&&!e.metaKey&&e.target===document.body){ fitView(); }
      // Arrow keys - move selected court by 1px
      if(selectedId&&e.target===document.body&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
        e.preventDefault();
        const canvasW = editingMap?.canvasW ?? 1400;
        const canvasH = editingMap?.canvasH ?? 900;
        mutate(prev=>prev.map(b=>{
          if(b.id!==selectedId) return b;
          let {x,y}=b;
          if(e.key==='ArrowUp')y=Math.max(0,y-1);
          if(e.key==='ArrowDown')y=Math.min(canvasH-b.height,y+1);
          if(e.key==='ArrowLeft')x=Math.max(0,x-1);
          if(e.key==='ArrowRight')x=Math.min(canvasW-b.width,x+1);
          return {...b,x,y};
        }),false);
      }
    };
    const ku=(e:KeyboardEvent)=>{ if(e.code==='Space') setSpaceHeld(false); };
    window.addEventListener('keydown',kd);
    window.addEventListener('keyup',ku);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  },[selectedId,history,histIdx,blocks,fitView,mutate,editingMap]);

  /* Save draft */
  const handleSave = useCallback(()=>{
    if(!editingMapId) return;
    setIsSaving(true);
    setTimeout(()=>{
      updateMapBlocks(editingMapId, blocks);
      setHasChanges(false); setSavedFlash(true);
      setIsSaving(false);
      setTimeout(()=>setSavedFlash(false),2200);
    }, 900);
  },[editingMapId,blocks,updateMapBlocks]);

  /* Publish */
  const handlePublish = useCallback(()=>{
    if(!editingMapId) return;
    showConfirm({
      title:'Publish Map',
      message:'Publishing makes this layout visible to all customers and staff in real-time. Continue?',
      confirmLabel:'Publish Now',
      variant:'info',
      onConfirm:()=>{
        setConfirm({open:false,opts:null});
        setIsPublishing(true);
        setTimeout(()=>{
          publishMap(editingMapId,blocks);
          setHasChanges(false); setSavedFlash(true);
          setIsPublishing(false);
          setTimeout(()=>setSavedFlash(false),2200);
        }, 1500);
      },
    });
  },[editingMapId,blocks,publishMap,showConfirm]);

  /* Delete court */
  const requestDelete = useCallback((id:string)=>{
    const b=blocks.find(b=>b.id===id);
    showConfirm({
      title:'Delete Court',
      message:`Remove "${b?.name||'this court'}" from the map? This cannot be undone.`,
      confirmLabel:'Delete Court', variant:'danger',
      onConfirm:()=>{
        mutate(prev=>prev.filter(b=>b.id!==id));
        setSelectedId(null); setCtxMenu(null);
        setConfirm({open:false,opts:null});
      },
    });
  },[blocks,showConfirm,mutate]);

  /* Delete map */
  const requestDeleteMap = useCallback((id:string)=>{
    const m=maps.find(m=>m.id===id);
    showConfirm({
      title:'Delete Map',
      message:`Delete "${m?.name||'this map'}"? All courts on this map will be permanently removed.`,
      confirmLabel:'Delete Map', variant:'danger',
      onConfirm:()=>{
        deleteMap(id); setMapMenuData(null); setConfirm({open:false,opts:null});
        if(editingMapId===id) setEditingMapId(null);
      },
    });
  },[maps,deleteMap,showConfirm,editingMapId]);

  const requestRevert = useCallback(()=>{
    if(!editingMap) return;
    showConfirm({
      title:'Revert Changes',
      message:'Discard all unsaved changes and restore the last saved version?',
      confirmLabel:'Revert', variant:'warning',
      onConfirm:()=>{ setBlocks([...editingMap.blocks]); setHasChanges(false); setConfirm({open:false,opts:null}); },
    });
  },[editingMap,showConfirm]);

  const requestClear = useCallback(()=>{
    showConfirm({
      title:'Clear Canvas',
      message:'Remove all courts from this map? This cannot be undone.',
      confirmLabel:'Clear All', variant:'danger',
      onConfirm:()=>{ mutate(()=>[]); setSelectedId(null); setConfirm({open:false,opts:null}); },
    });
  },[showConfirm,mutate]);

  const duplicateBlock=(id:string)=>{
    const src=blocks.find(b=>b.id===id); if(!src) return;
    const dup:CourtBlock={...src,id:`${src.id}-cp-${Date.now()}`,x:src.x+GRID*2,y:src.y+GRID*2,name:`${src.name} (Copy)`};
    mutate(prev=>[...prev,dup]); setSelectedId(dup.id); setCtxMenu(null);
  };

  /* ── Layer ordering ─────────────────────────────────────────────── */
  const reorder=(id:string,fn:(arr:CourtBlock[],idx:number)=>CourtBlock[])=>{
    mutate(prev=>{
      const idx=prev.findIndex(b=>b.id===id); if(idx<0) return prev;
      return fn([...prev],idx);
    });
  };
  const bringToFront=(id:string)=>reorder(id,(arr,i)=>{ const [b]=arr.splice(i,1); arr.push(b); return arr; });
  const bringForward=(id:string)=>reorder(id,(arr,i)=>{ if(i<arr.length-1){ [arr[i],arr[i+1]]=[arr[i+1],arr[i]]; } return arr; });
  const sendBackward=(id:string)=>reorder(id,(arr,i)=>{ if(i>0){ [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; } return arr; });
  const sendToBack=(id:string)=>reorder(id,(arr,i)=>{ const [b]=arr.splice(i,1); arr.unshift(b); return arr; });

  /* ── Container pointer (pan) ── */
  const handleContainerPointerDown=(e:React.PointerEvent)=>{
    if(e.button===1||spaceHeld){
      e.preventDefault(); setIsPanning(true);
      setPanAnchor({cx:e.clientX,cy:e.clientY,px:pan.x,py:pan.y});
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const handleContainerPointerMove=(e:React.PointerEvent)=>{
    if(!isPanning) return;
    setPan({ x:panAnchor.px+(e.clientX-panAnchor.cx), y:panAnchor.py+(e.clientY-panAnchor.cy) });
  };
  const handleContainerPointerUp=(e:React.PointerEvent)=>{
    if(isPanning){ setIsPanning(false); (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }
  };

  /* Touch pinch */
  const handleTouchMove=(e:React.TouchEvent)=>{
    if(e.touches.length===2){ e.preventDefault();
      const t=e.touches; const dx=t[0].clientX-t[1].clientX; const dy=t[0].clientY-t[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(lastPinchDist.current>0){
        const f=dist/lastPinchDist.current;
        const mx=(t[0].clientX+t[1].clientX)/2; const my=(t[0].clientY+t[1].clientY)/2;
        const r=containerRef.current!.getBoundingClientRect();
        const lx=mx-r.left; const ly=my-r.top;
        setZoom(z=>{ const nz=clamp(z*f,MIN_ZOOM,MAX_ZOOM); setPan(p=>({x:lx-(lx-p.x)*(nz/z),y:ly-(ly-p.y)*(nz/z)})); return nz; });
      }
      lastPinchDist.current=dist;
    }
  };
  const handleTouchEnd=()=>{ lastPinchDist.current=0; };

  /* SVG court drag+resize – NO snap during drag, snap on release */
  const cW = editingMap?.canvasW??1400;
  const cH = editingMap?.canvasH??900;

  const handleSVGPointerMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    // Promote pending drag to active once threshold exceeded
    if(!dragState && dragInitRef.current){
      const dx=e.clientX-dragInitRef.current.clientX;
      const dy=e.clientY-dragInitRef.current.clientY;
      if(Math.sqrt(dx*dx+dy*dy)>DRAG_THRESHOLD){
        const init=dragInitRef.current;
        dragInitRef.current=null;
        setDragState({id:init.id, ox:init.ox, oy:init.oy});
      }
      return; // don't move yet – wait for state to update
    }
    if(dragState){
      const {x,y}=toCanvas(e.clientX,e.clientY);
      // Smooth pixel-precise movement – no snap during drag
      setBlocks(prev=>prev.map(b=>b.id===dragState.id?{
        ...b,
        x:clamp(Math.round(x-dragState.ox), 0, cW-b.width),
        y:clamp(Math.round(y-dragState.oy), 0, cH-b.height),
      }:b));
      setHasChanges(true);
    }
    if(resizeState){
      const {x,y}=toCanvas(e.clientX,e.clientY);
      const updated=applyResize(resizeState.handle,x-resizeState.sx,y-resizeState.sy,resizeState.orig);
      setBlocks(prev=>prev.map(b=>b.id===resizeState.id?updated:b));
      setHasChanges(true);
    }
  };

  const handleSVGPointerUp=(e:React.PointerEvent<SVGSVGElement>)=>{
    // Clear pending drag (click without drag – just selection, no move)
    dragInitRef.current=null;
    if(dragState||resizeState){
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      if(dragState){
        // Keep exact drop position – no snap magnetism
        pushHistory(blocks);
      }
      if(resizeState) pushHistory(blocks);
      setDragState(null); setResizeState(null);
    }
  };

  const handleCourtPointerDown=(e:React.PointerEvent,id:string)=>{
    if(spaceHeld||e.button===1) return;
    e.stopPropagation(); setCtxMenu(null); setSelectedId(id);
    const {x,y}=toCanvas(e.clientX,e.clientY);
    const b=blocks.find(b=>b.id===id)!;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    // Store in ref only – promote to dragState after threshold (prevents click-move)
    dragInitRef.current = { id, clientX:e.clientX, clientY:e.clientY, ox:x-b.x, oy:y-b.y };
  };

  const handleHandlePointerDown=(e:React.PointerEvent,id:string,handle:HandleId)=>{
    e.stopPropagation();
    const {x,y}=toCanvas(e.clientX,e.clientY);
    const orig=blocks.find(b=>b.id===id)!;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    setResizeState({id,handle,sx:x,sy:y,orig}); setDragState(null);
  };

  /* Palette drag */
  const handleCanvasDragOver=(e:React.DragEvent)=>{
    e.preventDefault();
    const raw=e.dataTransfer.getData('courtTemplate'); if(!raw) return;
    try {
      const t=JSON.parse(raw);
      const {x,y}=toCanvas(e.clientX,e.clientY);
      setDropPreview({x:snap(x-t.defaultW/2),y:snap(y-t.defaultH/2),sport:t.sport,w:t.defaultW,h:t.defaultH});
    } catch{}
  };
  const handleCanvasDrop=(e:React.DragEvent)=>{
    e.preventDefault(); setDropPreview(null);
    const raw=e.dataTransfer.getData('courtTemplate'); if(!raw) return;
    try {
      const t=JSON.parse(raw);
      const {x,y}=toCanvas(e.clientX,e.clientY);
      const bx=clamp(snap(x-t.defaultW/2),0,cW-t.defaultW);
      const by=clamp(snap(y-t.defaultH/2),0,cH-t.defaultH);
      const cnt=blocks.filter(b=>b.sport===t.sport).length+1;
      const csColor=customSports.find(cs=>cs.name===t.sport)?.color;
      const nb:CourtBlock={ id:`${t.sport.replace(/ /g,'')}-${Date.now()}`, sport:t.sport, name:`${t.sport} ${cnt}`, x:bx, y:by, width:t.defaultW, height:t.defaultH, status:'available', ...(csColor?{customColor:csColor}:{}) };
      mutate(prev=>[...prev,nb]); setSelectedId(nb.id);
    } catch{}
  };

  const selectedBlock = blocks.find(b=>b.id===selectedId)??null;
  const getCursor=()=>{
    if(spaceHeld||isPanning) return 'grabbing';
    if(resizeState) return HANDLE_CURSORS[resizeState.handle];
    if(dragState) return 'grabbing';
    return 'default';
  };
  const hsV = HANDLE_PX / zoom; // handle size in SVG units (constant on screen)

  /* ── No maps state ── */
  if(maps.length===0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <EmptyMapState onNew={()=>setShowWizard(true)}/>
        <AnimatePresence>
          {showWizard&&<NewMapWizard onClose={()=>setShowWizard(false)} onCreate={meta=>{ const id=createMap(meta); setEditingMapId(id); setShowWizard(false); }}/>}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0A0A0A]">

      {/* ══ Map Selector Bar ══════════════════════════════════════════ */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0E0E0E] border-b border-white/[0.06] flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
        {maps.map(m=>(
          <div key={m.id} className="relative flex-shrink-0 group">
            <button onClick={()=>setEditingMapId(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-black"
              style={{
                fontSize:11,
                background:editingMapId===m.id?'rgba(255,140,0,0.12)':'transparent',
                color:editingMapId===m.id?'#FF8C00':'#666',
                border:editingMapId===m.id?'1px solid rgba(255,140,0,0.25)':'1px solid transparent',
              }}>
              <Map size={11}/>
              <span className="truncate max-w-[120px]">{m.name}</span>
              {m.isPublished&&<div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" title="Published"/>}
            </button>
            {/* 3-dot menu – uses fixed positioning to escape overflow:hidden */}
            <button
              onClick={e=>{ e.stopPropagation(); const rect=(e.currentTarget as HTMLElement).getBoundingClientRect(); setMapMenuData(prev=>prev?.id===m.id?null:{ id:m.id, x:rect.left, y:rect.bottom+4 }); }}
              className="absolute -top-0.5 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-gray-700 hover:text-gray-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
              <MoreHorizontal size={10}/>
            </button>
          </div>
        ))}
        <button onClick={()=>setShowWizard(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all font-black flex-shrink-0"
          style={{fontSize:11}}>
          <Plus size={11}/> New Map
        </button>
      </div>

      {/* ══ Map 3-dot dropdown (fixed-positioned to escape overflow:hidden) ══ */}
      <AnimatePresence>
        {mapMenuData&&(
          <>
            <div className="fixed inset-0 z-[9990]" onClick={()=>setMapMenuData(null)}/>
            <motion.div initial={{opacity:0,scale:.9,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.9}} transition={{duration:.1}}
              className="fixed z-[9991] rounded-xl overflow-hidden py-1 min-w-[150px]"
              style={{ left:mapMenuData.x, top:mapMenuData.y, background:'rgba(20,20,20,0.97)', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 12px 40px rgba(0,0,0,0.6)' }}
              onClick={e=>e.stopPropagation()}>
              {(()=>{ const m=maps.find(mm=>mm.id===mapMenuData.id); if(!m) return null; return (<>
                <button onClick={()=>{ setEditingMeta(m); setMapMenuData(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2 text-gray-300 font-black" style={{fontSize:12}}>
                  <Pencil size={12} className="text-gray-500"/> Edit Details
                </button>
                <div className="h-px bg-white/6 my-0.5"/>
                <button onClick={()=>requestDeleteMap(m.id)}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-500/10 flex items-center gap-2 text-red-400 font-black" style={{fontSize:12}}>
                  <Trash2 size={12}/> Delete Map
                </button>
              </>); })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ Toolbar ══════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] border-b border-white/[0.06] flex-shrink-0">
        {/* Palette toggle */}
        <button onClick={()=>setPaletteOpen(o=>!o)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all font-black ${paletteOpen?'bg-[#FF8C00]/15 text-[#FF8C00]':'bg-white/5 text-gray-500 hover:text-gray-300'}`}
          style={{fontSize:11}} title="Toggle Palette (P)">
          {paletteOpen?<PanelLeftClose size={13}/>:<PanelLeftOpen size={13}/>}
          <span className="hidden sm:block">Palette</span>
        </button>

        <div className="w-px h-4 bg-white/10"/>

        {/* Zoom */}
        <div className="flex items-center bg-[#1A1A1A] rounded-xl p-0.5 border border-white/6">
          <button onClick={()=>setZoom(z=>clamp(z/1.2,MIN_ZOOM,MAX_ZOOM))} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors"><Minus size={12}/></button>
          <button onClick={()=>requestAnimationFrame(fitView)} className="px-2 py-1 rounded-lg hover:bg-white/8 text-gray-300 font-black min-w-[42px] text-center transition-colors" style={{fontSize:11}} title="Fit to screen (F)">{Math.round(zoom*100)}%</button>
          <button onClick={()=>setZoom(z=>clamp(z*1.2,MIN_ZOOM,MAX_ZOOM))} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors"><Plus size={12}/></button>
        </div>

        {/* Grid */}
        <button onClick={()=>setShowGrid(g=>!g)}
          className={`p-1.5 rounded-xl transition-all ${showGrid?'bg-[#FF8C00]/15 text-[#FF8C00]':'bg-white/5 text-gray-500 hover:text-gray-300'}`} title="Toggle Grid">
          <Grid3X3 size={13}/>
        </button>

        {/* Undo/Redo */}
        <div className="flex bg-[#1A1A1A] rounded-xl p-0.5 border border-white/6">
          <button onClick={()=>{ const ni=Math.max(0,histIdx-1); setBlocks(history[ni]); setHistIdx(ni); setHasChanges(true); }} disabled={histIdx===0}
            className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Undo (Ctrl+Z)"><Undo2 size={12}/></button>
          <button onClick={()=>{ const ni=Math.min(history.length-1,histIdx+1); setBlocks(history[ni]); setHistIdx(ni); setHasChanges(true); }} disabled={histIdx===history.length-1}
            className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Redo (Ctrl+Y)"><Redo2 size={12}/></button>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-2.5 ml-1">
          {[{v:blocks.length,c:'#aaa',l:'Courts'},{v:blocks.filter(b=>b.status==='available').length,c:'#22c55e',l:'Open'},{v:blocks.filter(b=>b.status==='maintenance').length,c:'#f97316',l:'Maint.'}].map(s=>(
            <div key={s.l} className="flex items-center gap-1">
              <span className="font-black" style={{fontSize:13,color:s.c}}>{s.v}</span>
              <span className="text-gray-600" style={{fontSize:10}}>{s.l}</span>
            </div>
          ))}
        </div>

        <div className="flex-1"/>

        {/* Shortcuts help */}
        <div className="relative">
          <button onClick={()=>setShowShortcuts(s=>!s)}
            className={`p-1.5 rounded-xl transition-all ${showShortcuts?'bg-white/10 text-gray-300':'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`} title="Keyboard Shortcuts">
            <HelpCircle size={14}/>
          </button>
          <AnimatePresence>
            {showShortcuts&&(
              <>
                <div className="fixed inset-0 z-30" onClick={()=>setShowShortcuts(false)}/>
                <motion.div initial={{opacity:0,scale:.9,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.9}} transition={{duration:.12}}
                  className="fixed z-[9999] rounded-2xl p-3 min-w-[200px]"
                  style={{ right:16, top:56, background:'rgba(18,18,18,0.98)', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 16px 48px rgba(0,0,0,0.7)' }}
                  onClick={e=>e.stopPropagation()}>
                  <p className="text-gray-500 font-black mb-2" style={{fontSize:9,letterSpacing:1}}>KEYBOARD SHORTCUTS</p>
                  {[
                    ['Scroll','Zoom in/out'],
                    ['Space + Drag','Pan canvas'],
                    ['Ctrl+Z / Ctrl+Y','Undo / Redo'],
                    ['Ctrl+C / Ctrl+V','Copy / Paste'],
                    ['Ctrl+S','Publish map'],
                    ['F','Fit to screen'],
                    ['Arrow Keys','Move court 1px'],
                    ['Delete','Delete selected court'],
                    ['Escape','Deselect'],
                  ].map(([k,v])=>(
                    <div key={k} className="flex items-center justify-between py-1 gap-4">
                      <span className="text-gray-500" style={{fontSize:11}}>{v}</span>
                      <span className="px-2 py-0.5 rounded-md text-gray-300 font-black flex-shrink-0" style={{fontSize:10,background:'rgba(255,255,255,0.08)'}}>{k}</span>
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-0.5">
          <AnimatePresence>
            {savedFlash&&(
              <motion.span initial={{opacity:0,x:6}} animate={{opacity:1,x:0}} exit={{opacity:0}}
                className="flex items-center gap-1 text-green-400 font-black" style={{fontSize:11}}>
                <CheckCircle size={12}/> {editingMap?.isPublished?'Published':'Saved'}
              </motion.span>
            )}
          </AnimatePresence>
          {hasChanges&&(
            <button onClick={requestRevert} title="Revert changes"
              className="p-1.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all">
              <RotateCcw size={12}/>
            </button>
          )}
          {blocks.length>0&&(
            <button onClick={requestClear} title="Clear canvas"
              className="p-1.5 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 size={12}/>
            </button>
          )}
          <button onClick={handleSave} disabled={!hasChanges || blocks.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all ${hasChanges && blocks.length > 0 ?'bg-[#1A1A1A] text-gray-400 border border-white/8 hover:text-white cursor-pointer':'bg-[#1A1A1A] text-gray-600 border border-white/5 cursor-not-allowed opacity-50'}`}
            style={{fontSize:12}}
            title={blocks.length === 0 ? 'Add courts before saving' : undefined}>
            <Save size={12}/> Save
          </button>
          <button onClick={handlePublish} disabled={(!hasChanges && editingMap?.isPublished) || blocks.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all ${(hasChanges || !editingMap?.isPublished) && blocks.length > 0 ?'bg-[#FF8C00] text-white shadow-lg shadow-orange-500/20 hover:bg-[#e67e00] cursor-pointer':'bg-[#1A1A1A] text-gray-600 border border-white/5 cursor-not-allowed opacity-50'}`}
            style={{fontSize:12}}
            title={blocks.length === 0 ? 'Add courts before publishing' : undefined}>
            <Eye size={12}/> {editingMap?.isPublished?'Re-Publish':'Publish'}
          </button>
        </div>
      </div>

      {/* ══ Canvas Area ══════════════════════════════════════════════ */}
      {!editingMap ? (
        <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
          <div className="text-center">
            <Map size={28} className="text-gray-700 mx-auto mb-2"/>
            <p className="text-gray-500 font-black" style={{fontSize:13}}>Select a map to edit</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden min-h-0"
          ref={containerRef}
          style={{ cursor:getCursor(), background:'#0A0A0A' }}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={()=>{ setSelectedId(null); setCtxMenu(null); setMapMenuData(null); setShowShortcuts(false); }}>

          {/* Empty hint */}
          {blocks.length===0&&(
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 gap-3">
              <Layers size={36} className="text-gray-800"/>
              <p className="text-gray-600 font-black" style={{fontSize:14}}>Canvas is empty</p>
              <p className="text-gray-700" style={{fontSize:12}}>Open the palette and drag courts here</p>
            </div>
          )}

          {/* ─ SVG Canvas – crisp viewBox rendering ─ */}
          <svg
            width="100%" height="100%"
            viewBox={getViewBox()}
            style={{ display:'block', touchAction:'none', userSelect:'none' }}
            onPointerMove={handleSVGPointerMove}
            onPointerUp={handleSVGPointerUp}
            onPointerLeave={handleSVGPointerUp}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onDragLeave={()=>setDropPreview(null)}
            onClick={(e)=>{ e.stopPropagation(); setSelectedId(null); setCtxMenu(null); }}
          >
            <defs>
              {blocks.map(b=>(
                <clipPath key={`clip-${b.id}`} id={`clip-${b.id}`}>
                  <rect x={b.x+4} y={b.y+4} width={Math.max(0,b.width-8)} height={Math.max(0,b.height-8)}/>
                </clipPath>
              ))}
            </defs>

            {/* Floor */}
            <rect width={cW} height={cH} fill="#111"/>

            {/* Grid */}
            {showGrid&&(
              <>
                <defs>
                  <pattern id="mg-sm" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                    <circle cx={GRID} cy={GRID} r="0.9" fill="#1e1e1e"/>
                  </pattern>
                  <pattern id="mg-lg" width={GRID*5} height={GRID*5} patternUnits="userSpaceOnUse">
                    <rect width={GRID*5} height={GRID*5} fill="url(#mg-sm)"/>
                    <path d={`M ${GRID*5} 0 L 0 0 0 ${GRID*5}`} fill="none" stroke="#191919" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width={cW} height={cH} fill="url(#mg-lg)"/>
              </>
            )}

            {/* Canvas border */}
            <rect x={1} y={1} width={cW-2} height={cH-2} fill="none" stroke="#252525" strokeWidth="1.5" rx="6" strokeDasharray="10 5"/>

            {/* Ruler labels */}
            {showGrid&&[0,200,400,600,800,1000,1200,1400,1600,1800].filter(v=>v<=cW).map(v=>(
              <text key={`rx${v}`} x={v+3} y={13} fill="#282828" fontSize={9} fontWeight="600" style={{userSelect:'none',pointerEvents:'none'}}>{v}</text>
            ))}
            {showGrid&&[0,200,400,600,800,1000].filter(v=>v<=cH).map(v=>(
              <text key={`ry${v}`} x={3} y={v+13} fill="#282828" fontSize={9} fontWeight="600" style={{userSelect:'none',pointerEvents:'none'}}>{v}</text>
            ))}

            {/* Drop preview */}
            {dropPreview&&(
              <>
                <rect x={dropPreview.x} y={dropPreview.y} width={dropPreview.w} height={dropPreview.h}
                  fill={`${getSportMapColor(dropPreview.sport)}15`} stroke={getSportMapColor(dropPreview.sport)}
                  strokeWidth={2/zoom} strokeDasharray={`${8/zoom} ${4/zoom}`} rx="8"/>
                <text x={dropPreview.x+dropPreview.w/2} y={dropPreview.y+dropPreview.h/2}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={getSportMapColor(dropPreview.sport)} fontSize={12} fontWeight="900" opacity="0.7"
                  style={{userSelect:'none',pointerEvents:'none'}}>{dropPreview.sport}
                </text>
              </>
            )}

            {/* Courts */}
            {blocks.map(b=>{
              // Use customColor if set, or look up from customSports, else default sport color
              const color = b.customColor
                || customSports.find(cs=>cs.name===b.sport)?.color
                || getSportMapColor(b.sport);
              const isSel=selectedId===b.id;
              const isDrag=dragState?.id===b.id;
              const isMaint=b.status==='maintenance';
              const handles=isSel?handlePositions(b):[];
              const showText=b.width>=50&&b.height>=36;
              const showSub=b.width>=70&&b.height>=60;

              return (
                <g key={b.id} style={{cursor:isDrag?'grabbing':isSel?'grab':'pointer'}}
                  onClick={e=>e.stopPropagation()}>
                  {isSel&&<rect x={b.x-4} y={b.y-4} width={b.width+8} height={b.height+8} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5/zoom} rx="13"/>}
                  <rect x={b.x} y={b.y} width={b.width} height={b.height}
                    fill={isMaint?'#374151':color} opacity={isDrag?.6:isMaint?.35:.82}
                    stroke={isSel?'white':`${color}55`} strokeWidth={isSel?2/zoom:1/zoom} rx="8"
                    onPointerDown={e=>handleCourtPointerDown(e,b.id)}
                    onContextMenu={e=>{ e.preventDefault(); e.stopPropagation(); setSelectedId(b.id); setCtxMenu({id:b.id,px:e.clientX,py:e.clientY}); }}
                  />
                  {b.width>=180&&!isMaint&&(
                    <>
                      <line x1={b.x+b.width/2} y1={b.y+12} x2={b.x+b.width/2} y2={b.y+b.height-12} stroke="white" strokeWidth={1.5/zoom} opacity="0.09"/>
                      <circle cx={b.x+b.width/2} cy={b.y+b.height/2} r={Math.min(b.width,b.height)*0.2} fill="none" stroke="white" strokeWidth={1.5/zoom} opacity="0.09"/>
                    </>
                  )}
                  {/* Clipped text – never overflows court */}
                  {showText&&(
                    <text x={b.x+b.width/2} y={b.y+b.height/2-(showSub?8:0)}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={11} fontWeight="800"
                      clipPath={`url(#clip-${b.id})`}
                      style={{userSelect:'none',pointerEvents:'none'}}>
                      {b.name}
                    </text>
                  )}
                  {showSub&&(
                    <text x={b.x+b.width/2} y={b.y+b.height/2+9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={9} opacity="0.5"
                      clipPath={`url(#clip-${b.id})`}
                      style={{userSelect:'none',pointerEvents:'none'}}>
                      {isMaint?'MAINTENANCE':b.sport}
                    </text>
                  )}
                  {handles.map(h=>(
                    <rect key={h.id} x={h.x-hsV/2} y={h.y-hsV/2} width={hsV} height={hsV}
                      fill="white" stroke="#111" strokeWidth={1/zoom} rx={hsV*0.25}
                      style={{cursor:HANDLE_CURSORS[h.id]}}
                      onPointerDown={e=>{ e.stopPropagation(); handleHandlePointerDown(e,b.id,h.id); }}/>
                  ))}
                </g>
              );
            })}
          </svg>

          {/* ─ Map switching loading overlay ─ */}
          <AnimatePresence>
            {isLoadingMap && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="absolute inset-0 z-30 flex items-center justify-center"
                style={{background:'rgba(13,13,14,0.75)',backdropFilter:'blur(4px)'}}>
                <LoadingScreen label="Loading map…" sub="Setting up canvas" accentColor="#FF8C00"/>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─ Palette overlay (does NOT affect canvas size) ─ */}
          <div className="absolute left-3 top-3 bottom-3 z-20 flex flex-col rounded-2xl transition-all duration-200"
            style={{
              width:paletteOpen?176:0,
              opacity:paletteOpen?1:0,
              pointerEvents:paletteOpen?'auto':'none',
              overflow:'hidden',
              background:'rgba(14,14,14,0.96)',
              border:paletteOpen?'1px solid rgba(255,255,255,0.08)':'none',
              backdropFilter:'blur(12px)',
              boxShadow:paletteOpen?'0 8px 28px rgba(0,0,0,0.5)':'none',
            }}>
            <div className="px-3 pt-3 pb-1.5 flex-shrink-0">
              <p className="text-gray-500 font-black" style={{fontSize:9,letterSpacing:1}}>COURT TYPES</p>
              <p className="text-gray-700" style={{fontSize:8,marginTop:1}}>Drag onto canvas</p>
            </div>
            <div className="flex-1 min-h-0 px-2 pb-2 space-y-1.5 palette-scroll" style={{overflowY:'auto',overscrollBehavior:'contain'}} onWheel={e => e.stopPropagation()}>
              {/* Built-in sports */}
              {SPORTS.map(t=>(
                <div key={t.sport} draggable
                  onDragStart={e=>{ e.dataTransfer.setData('courtTemplate',JSON.stringify(t)); e.dataTransfer.effectAllowed='copy'; }}
                  className="group rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none transition-colors"
                  style={{background:`${t.color}0d`,border:`1px solid ${t.color}22`}}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:`${t.color}22`}}>
                      <SportIcon sport={t.sport} size={15} color={t.color} strokeWidth={2}/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black truncate" style={{fontSize:11}}>{t.sport}</p>
                      <p className="text-gray-500" style={{fontSize:9}}>{t.desc}</p>
                    </div>
                  </div>
                  <div className="w-full h-4 rounded-md flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{background:`${t.color}14`,border:`1px dashed ${t.color}50`}}>
                    <span style={{fontSize:8,color:t.color,fontWeight:900,letterSpacing:.8}}>DRAG TO CANVAS</span>
                  </div>
                </div>
              ))}
              {/* Custom sports from AddonsContext */}
              {customSports.map(cs=>{
                const csTemplate={sport:cs.name,defaultW:130,defaultH:100,color:cs.color,desc:'Custom court'};
                return (
                  <div key={cs.name} className="group relative">
                    <div draggable
                      onDragStart={e=>{ e.dataTransfer.setData('courtTemplate',JSON.stringify(csTemplate)); e.dataTransfer.effectAllowed='copy'; }}
                      className="rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none transition-colors"
                      style={{background:`${cs.color}0d`,border:`1px solid ${cs.color}22`}}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:`${cs.color}22`}}>
                          <span style={{fontSize:11,fontWeight:900,color:cs.color}}>{cs.name.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-black truncate" style={{fontSize:11}}>{cs.name}</p>
                          <p className="text-gray-500" style={{fontSize:9}}>Custom · {cs.priceLabel}</p>
                        </div>
                        {/* Delete custom sport */}
                        <button
                          draggable={false}
                          onClick={e=>{ e.stopPropagation(); deleteCustomSport(cs.name); }}
                          title="Delete sport type"
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                          style={{color:'#ef4444'}}>
                          <Trash2 size={10}/>
                        </button>
                      </div>
                      <div className="w-full h-4 rounded-md flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
                        style={{background:`${cs.color}14`,border:`1px dashed ${cs.color}50`}}>
                        <span style={{fontSize:8,color:cs.color,fontWeight:900,letterSpacing:.8}}>DRAG TO CANVAS</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Add custom sport button */}
              <div className="pt-1">
                {!showCustomInput ? (
                  <button onClick={()=>setShowCustomInput(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all hover:bg-white/5"
                    style={{border:'1px dashed rgba(255,255,255,0.15)',fontSize:10,color:'#666',fontWeight:800}}>
                    <Plus size={11}/> New Sport Type
                  </button>
                ) : (
                  <div className="space-y-1.5 bg-white/3 rounded-xl p-2" style={{border:'1px solid rgba(255,255,255,0.1)'}}>
                    <p className="text-gray-500 font-black" style={{fontSize:9,letterSpacing:.8}}>NEW SPORT TYPE</p>
                    <input
                      type="text"
                      value={customSportInput}
                      onChange={e=>setCustomSportInput(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==='Enter'&&customSportInput.trim()){
                          addCustomSport({name:customSportInput.trim(),color:'#8b5cf6',pricingType:'flat',flatPrice:300,priceLabel:'₱300/hr'});
                          setCustomSportInput(''); setShowCustomInput(false);
                        }
                        if(e.key==='Escape'){setCustomSportInput('');setShowCustomInput(false);}
                      }}
                      placeholder="e.g. Squash, Archery..."
                      autoFocus
                      className="w-full rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                      style={{fontSize:11,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)'}}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={()=>{ if(customSportInput.trim()){addCustomSport({name:customSportInput.trim(),color:'#8b5cf6',pricingType:'flat',flatPrice:300,priceLabel:'₱300/hr'});setCustomSportInput('');setShowCustomInput(false); }}}
                        className="flex-1 py-1 rounded-lg text-white font-black transition-all"
                        style={{fontSize:9,background:'#8b5cf6',letterSpacing:.5}}>ADD</button>
                      <button onClick={()=>{setCustomSportInput('');setShowCustomInput(false);}}
                        className="px-2 py-1 rounded-lg text-gray-500 hover:text-white transition-all"
                        style={{fontSize:9,background:'rgba(255,255,255,0.04)'}}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/6 px-3 py-2 flex-shrink-0 space-y-1">
              <p className="text-gray-700 font-black mb-0.5" style={{fontSize:8,letterSpacing:1}}>ON CANVAS</p>
              {allSportNames.map(sName=>{ const cnt=blocks.filter(b=>b.sport===sName).length; if(!cnt) return null;
                const color=getSportMapColor(sName);
                return (<div key={sName} className="flex items-center justify-between">
                  <span className="text-gray-500" style={{fontSize:10}}>{sName}</span>
                  <span className="font-black" style={{fontSize:11,color}}>{cnt}</span>
                </div>);
              })}
              {blocks.length===0&&<p className="text-gray-700" style={{fontSize:9}}>None yet</p>}
            </div>
          </div>

          {/* ─ Inspector ─ */}
          <AnimatePresence>
            {selectedBlock&&(
              <InspectorPanel key={selectedBlock.id}
                block={selectedBlock} canvasW={cW} canvasH={cH} allBlocks={blocks}
                onUpdate={partial=>mutate(prev=>prev.map(b=>b.id===selectedBlock.id?{...b,...partial}:b))}
                onDelete={()=>requestDelete(selectedBlock.id)}
                onDuplicate={()=>duplicateBlock(selectedBlock.id)}
                onClose={()=>setSelectedId(null)}
                onBringToFront={()=>bringToFront(selectedBlock.id)}
                onBringForward={()=>bringForward(selectedBlock.id)}
                onSendBackward={()=>sendBackward(selectedBlock.id)}
                onSendToBack={()=>sendToBack(selectedBlock.id)}
                customSports={customSports}
              />
            )}
          </AnimatePresence>

          {/* Zoom HUD - positioned to avoid overlapping palette */}
          <div className="absolute bottom-3 z-10 flex flex-col items-center gap-1 transition-all duration-200"
            style={{ left: paletteOpen ? '196px' : '12px' }}>
            <button onClick={()=>setZoom(z=>clamp(z*1.2,MIN_ZOOM,MAX_ZOOM))} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all" style={{background:'rgba(18,18,18,0.9)',border:'1px solid rgba(255,255,255,0.1)'}}><ZoomIn size={12}/></button>
            <button onClick={()=>requestAnimationFrame(fitView)} className="w-7 rounded-xl py-1 text-center font-black hover:text-white transition-all" style={{fontSize:9,color:'#555',background:'rgba(18,18,18,0.9)',border:'1px solid rgba(255,255,255,0.1)'}}>FIT</button>
            <button onClick={()=>setZoom(z=>clamp(z/1.2,MIN_ZOOM,MAX_ZOOM))} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all" style={{background:'rgba(18,18,18,0.9)',border:'1px solid rgba(255,255,255,0.1)'}}><ZoomOut size={12}/></button>
          </div>

          {/* Canvas info pill */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full pointer-events-none"
            style={{background:'rgba(14,14,14,0.8)',border:'1px solid rgba(255,255,255,0.06)'}}>
            <p className="text-gray-600 font-black text-center" style={{fontSize:10}}>
              {editingMap.name} · {editingMap.branch} · {cW}×{cH}
            </p>
          </div>
        </div>
      )}

      {/* ── Context Menu ── */}
      <AnimatePresence>
        {ctxMenu&&(
          <>
            <div className="fixed inset-0 z-40" onClick={()=>setCtxMenu(null)}/>
            <motion.div initial={{opacity:0,scale:.88,y:-6}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.88}} transition={{duration:.1}}
              className="fixed z-50 rounded-2xl overflow-hidden py-1.5 min-w-[175px]"
              style={{left:ctxMenu.px,top:ctxMenu.py,background:'rgba(18,18,18,0.97)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(16px)',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}
              onClick={e=>e.stopPropagation()}>
              <div className="px-3 py-1.5 border-b border-white/6 mb-1">
                <p className="text-gray-400 font-black" style={{fontSize:10}}>{blocks.find(b=>b.id===ctxMenu.id)?.name??'Court'}</p>
              </div>
              {[
                {label:'Mark Available',color:'#22c55e',action:()=>{ mutate(p=>p.map(b=>b.id===ctxMenu.id?{...b,status:'available'as const}:b)); setCtxMenu(null); }},
                {label:'Mark Maintenance',color:'#f97316',action:()=>{ mutate(p=>p.map(b=>b.id===ctxMenu.id?{...b,status:'maintenance'as const}:b)); setCtxMenu(null); }},
              ].map(item=>(
                <button key={item.label} onClick={item.action} className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2 font-black" style={{fontSize:12,color:item.color}}>
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor:item.color}}/>{item.label}
                </button>
              ))}
              <div className="h-px bg-white/6 my-0.5"/>
              <button onClick={()=>{ setSelectedId(ctxMenu.id); setCtxMenu(null); }} className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2 text-gray-300 font-black" style={{fontSize:12}}>
                <Pencil size={12} className="text-gray-500"/> Configure
              </button>
              <button onClick={()=>duplicateBlock(ctxMenu.id)} className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2 text-gray-300 font-black" style={{fontSize:12}}>
                <Copy size={12} className="text-gray-500"/> Duplicate
              </button>
              <div className="h-px bg-white/6 my-0.5"/>
              <button onClick={()=>requestDelete(ctxMenu.id)} className="w-full text-left px-3.5 py-2 hover:bg-red-500/10 flex items-center gap-2 text-red-400 font-black" style={{fontSize:12}}>
                <Trash2 size={12}/> Delete Court
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Wizard ── */}
      <AnimatePresence>
        {showWizard&&<NewMapWizard onClose={()=>setShowWizard(false)} onCreate={meta=>{ const id=createMap(meta); setEditingMapId(id); setShowWizard(false); }}/>}
      </AnimatePresence>

      {/* ── Edit Map Details ── */}
      <AnimatePresence>
        {editingMeta&&(
          <EditMapModal
            map={editingMeta}
            onSave={(meta)=>{ updateMapMeta(editingMeta.id,meta); setEditingMeta(null); }}
            onClose={()=>setEditingMeta(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Confirm Dialog ── */}
      <ConfirmDialog open={confirm.open} options={confirm.opts}/>

      {/* ── Save Loading Overlay ── */}
      <AnimatePresence>
        {isSaving && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{background:'rgba(10,10,10,0.85)',backdropFilter:'blur(8px)'}}>
            <motion.div initial={{scale:.9,y:10}} animate={{scale:1,y:0}} exit={{scale:.9,y:10}}
              className="flex flex-col items-center gap-5 rounded-3xl px-12 py-10 border"
              style={{background:'rgba(20,20,20,0.97)',borderColor:'rgba(255,255,255,0.1)',boxShadow:'0 32px 80px rgba(0,0,0,0.8)'}}>
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-white/10"/>
                <motion.div className="absolute inset-0 rounded-full border-4 border-t-[#FF8C00] border-r-transparent border-b-transparent border-l-transparent"
                  animate={{rotate:360}} transition={{duration:.8,repeat:Infinity,ease:'linear'}}/>
                <Save size={20} className="absolute inset-0 m-auto text-[#FF8C00]"/>
              </div>
              <div className="text-center">
                <p className="text-white font-black" style={{fontSize:16}}>Saving Map…</p>
                <p className="text-gray-500" style={{fontSize:12,marginTop:4}}>Writing court layout to storage</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Publish Loading Overlay ── */}
      <AnimatePresence>
        {isPublishing && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{background:'rgba(5,10,20,0.9)',backdropFilter:'blur(10px)'}}>
            <motion.div initial={{scale:.9,y:16}} animate={{scale:1,y:0}} exit={{scale:.9,y:16}} transition={{type:'spring',stiffness:320,damping:28}}
              className="flex flex-col items-center gap-6 rounded-3xl px-14 py-12 border relative overflow-hidden"
              style={{background:'rgba(10,15,25,0.98)',borderColor:'rgba(0,71,171,0.3)',boxShadow:'0 0 60px rgba(0,71,171,0.2), 0 40px 100px rgba(0,0,0,0.9)'}}>
              {/* Background glow */}
              <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse at top, rgba(0,71,171,0.15), transparent 70%)'}}/>
              {/* Animated pulse ring */}
              <div className="relative w-20 h-20">
                <motion.div className="absolute inset-0 rounded-full border-2 border-[#0047AB]/30"
                  animate={{scale:[1,1.5],opacity:[0.6,0]}} transition={{duration:1.2,repeat:Infinity,ease:'easeOut'}}/>
                <motion.div className="absolute inset-0 rounded-full border-2 border-[#0047AB]/20"
                  animate={{scale:[1,1.8],opacity:[0.4,0]}} transition={{duration:1.2,repeat:Infinity,ease:'easeOut',delay:.4}}/>
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(0,71,171,0.3),rgba(0,102,255,0.15))'}}>
                  <motion.div className="absolute inset-0 rounded-full border-4 border-t-[#0047AB] border-r-[#0066ff] border-b-transparent border-l-transparent"
                    animate={{rotate:360}} transition={{duration:.9,repeat:Infinity,ease:'linear'}}/>
                  <Eye size={24} className="text-[#60a5fa] relative z-10"/>
                </div>
              </div>
              <div className="text-center relative z-10">
                <p className="text-white font-black" style={{fontSize:18}}>Publishing Map…</p>
                <p className="text-blue-300/70" style={{fontSize:13,marginTop:6,lineHeight:1.5}}>Making your layout live<br/>for customers and staff</p>
                {/* Animated dots */}
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {[0,1,2].map(i=>(
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#0047AB]"
                      animate={{opacity:[0.3,1,0.3],scale:[0.8,1.2,0.8]}} transition={{duration:1,repeat:Infinity,delay:i*0.25}}/>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
