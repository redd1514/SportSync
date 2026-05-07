import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Package, Tag, PlusCircle, Clock, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAddons } from "../../contexts/AddonsContext";
import { getSportColor } from "../SportIcons";
import { SectionLoader } from "../shared/LoadingScreen";

const COLOR_PRESETS = ['#FF8C00', '#0047AB', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export function AdminAddonsManagement() {
  const { addonsBySport, addAddon, updateAddon, deleteAddon, allSportNames, customSports, addCustomSport, deleteCustomSport } = useAddons();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeSport, setActiveSport] = useState("Basketball");

  // Add-on slide-in form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [perHour, setPerHour] = useState(false);

  // Add sport modal
  const [showSportModal, setShowSportModal] = useState(false);
  const [sportName, setSportName] = useState("");
  const [sportColor, setSportColor] = useState('#FF8C00');
  const [sportPricingType, setSportPricingType] = useState<'flat' | 'tiered'>('flat');
  const [sportFlatPrice, setSportFlatPrice] = useState('300');

  const openAddForm = () => { setEditingId(null); setLabel(""); setPrice(""); setNote(""); setPerHour(false); setShowForm(true); };
  const openEditForm = (addon: any) => { setEditingId(addon.id); setLabel(addon.label); setPrice(addon.price.toString()); setNote(addon.note || ""); setPerHour(!!addon.perHour); setShowForm(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { label, price: parseInt(price) || 0, note, perHour };
    if (editingId) updateAddon(activeSport, editingId, data);
    else addAddon(activeSport, { id: `addon-${Date.now()}`, ...data });
    setShowForm(false);
  };

  const handleAddSport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sportName.trim()) return;
    addCustomSport({ name: sportName.trim(), color: sportColor, pricingType: sportPricingType, flatPrice: parseInt(sportFlatPrice) || 300, priceLabel: `₱${sportFlatPrice}/hr` });
    setActiveSport(sportName.trim());
    setSportName(""); setSportColor('#FF8C00'); setSportPricingType('flat'); setSportFlatPrice('300');
    setShowSportModal(false);
  };

  const INPUT = "w-full bg-[#0D0D0D] text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF8C00] transition-colors";
  const accentColor = getSportColor(activeSport) || '#FF8C00';

  return (
    <div className="space-y-5">
      {/* Sport selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex overflow-x-auto gap-1.5 flex-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {allSportNames.map(sport => {
            const isActive = sport === activeSport;
            const color = getSportColor(sport);
            const isCustom = !!customSports.find(s => s.name === sport);
            return (
              <button key={sport} onClick={() => setActiveSport(sport)}
                className="px-3.5 py-1.5 rounded-xl whitespace-nowrap font-black transition-all border flex-shrink-0 flex items-center gap-1.5"
                style={{ fontSize: 12, background: isActive ? `${color}20` : 'rgba(255,255,255,0.03)', color: isActive ? color : '#666', borderColor: isActive ? `${color}50` : 'rgba(255,255,255,0.07)' }}>
                {sport}
                {isCustom && <span className="px-1 py-0.5 rounded text-gray-600" style={{ fontSize: 8, background: 'rgba(255,255,255,0.06)' }}>CUSTOM</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowSportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-white/15 text-gray-500 hover:text-white hover:border-white/30 transition-all flex-shrink-0"
          style={{ fontSize: 12, fontWeight: 800 }}>
          <PlusCircle size={13} /> New Sport
        </button>
      </div>

      {/* Custom sport info bar */}
      {customSports.find(s => s.name === activeSport) && (
        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-xl px-4 py-2.5 border border-white/5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getSportColor(activeSport) }} />
          <span className="text-gray-300 font-black" style={{ fontSize: 13 }}>{activeSport}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/5 font-black text-gray-600" style={{ fontSize: 9 }}>CUSTOM SPORT</span>
          <button onClick={() => { deleteCustomSport(activeSport); setActiveSport('Basketball'); }}
            className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300 font-black transition-colors"
            style={{ fontSize: 11 }}>
            <Trash2 size={11} /> Remove
          </button>
        </div>
      )}

      {/* Add-on grid + inline form */}
      <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5" style={{ background: `${accentColor}08` }}>
          <Tag size={14} style={{ color: accentColor }} />
          <h4 className="text-white font-black flex-1" style={{ fontSize: 14 }}>{activeSport} Add-ons</h4>
          <span className="text-gray-600 font-black" style={{ fontSize: 11 }}>{(addonsBySport[activeSport] || []).length} item(s)</span>
          <button onClick={openAddForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-black transition-all hover:opacity-90"
            style={{ fontSize: 11, background: accentColor }}>
            <Plus size={12} /> Add
          </button>
        </div>

        {/* Inline slide-down form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden border-b border-white/5"
            >
              <form onSubmit={handleSave} className="p-5 space-y-3" style={{ background: `${accentColor}06` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-black" style={{ fontSize: 13 }}>{editingId ? 'Edit Add-on' : 'New Add-on'}</p>
                  <button type="button" onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <X size={13} className="text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 mb-1 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>ITEM NAME</label>
                    <input required value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Ball Rental" className={INPUT} style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>PRICE (₱)</label>
                    <input type="number" required value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 100" className={INPUT} style={{ fontSize: 13 }} />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>NOTE (Optional)</label>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Evening only" className={INPUT} style={{ fontSize: 13 }} />
                </div>

                {/* Per-hour toggle */}
                <button type="button" onClick={() => setPerHour(!perHour)}
                  className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl border transition-all text-left"
                  style={{ background: perHour ? `${accentColor}12` : 'rgba(255,255,255,0.03)', borderColor: perHour ? `${accentColor}40` : 'rgba(255,255,255,0.08)' }}>
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${perHour ? '' : 'border-gray-600'}`}
                    style={perHour ? { background: accentColor, borderColor: accentColor } : {}}>
                    {perHour && <CheckCircle size={10} className="text-white" />}
                  </div>
                  <div>
                    <p className="font-black" style={{ fontSize: 12, color: perHour ? accentColor : '#777' }}>Charge per hour</p>
                    <p className="text-gray-600" style={{ fontSize: 10 }}>Price × session duration</p>
                  </div>
                  <Clock size={13} className="ml-auto" style={{ color: perHour ? accentColor : '#444' }} />
                </button>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors" style={{ fontSize: 13 }}>
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-xl text-white font-black transition-all hover:opacity-90"
                    style={{ fontSize: 13, background: `linear-gradient(135deg,${accentColor},${accentColor}cc)` }}>
                    {editingId ? 'Save Changes' : 'Add Item'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add-on cards */}
        <div className="p-4">
          {(addonsBySport[activeSport] || []).length === 0 ? (
            <div className="py-10 text-center">
              <Package size={32} className="mx-auto text-gray-700 mb-2" />
              <p className="text-gray-500 font-black" style={{ fontSize: 13 }}>No add-ons for {activeSport}</p>
              <p className="text-gray-600" style={{ fontSize: 12 }}>Booking step will be skipped when none exist</p>
              <button onClick={openAddForm} className="mt-3 px-4 py-2 rounded-xl font-black hover:opacity-90 transition-opacity"
                style={{ fontSize: 12, background: `${accentColor}18`, color: accentColor }}>
                <Plus size={12} className="inline mr-1" /> Add first add-on
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(addonsBySport[activeSport] || []).map(addon => (
                <div key={addon.id} className="bg-[#0D0D0D] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black truncate" style={{ fontSize: 14 }}>{addon.label}</p>
                      {addon.note && <p className="text-gray-500" style={{ fontSize: 11 }}>{addon.note}</p>}
                      {addon.perHour && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={10} style={{ color: accentColor }} />
                          <p style={{ fontSize: 10, fontWeight: 700, color: accentColor }}>Per hour</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditForm(addon)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => deleteAddon(activeSport, addon.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                    <span className="text-gray-600 font-black" style={{ fontSize: 10 }}>PRICE</span>
                    <span className="text-white font-black" style={{ fontSize: 16 }}>₱{addon.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add New Sport Modal ── */}
      <AnimatePresence>
        {showSportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h3 className="text-white font-black" style={{ fontSize: 16 }}>Add New Sport</h3>
                <button onClick={() => setShowSportModal(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleAddSport} className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>SPORT NAME</label>
                  <input required value={sportName} onChange={e => setSportName(e.target.value)} placeholder="e.g. Squash, Archery..."
                    className={INPUT} style={{ fontSize: 13 }} autoFocus />
                </div>
                <div>
                  <label className="block text-gray-500 mb-2 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>ACCENT COLOR</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(c => (
                      <button key={c} type="button" onClick={() => setSportColor(c)}
                        className="w-8 h-8 rounded-xl transition-all relative"
                        style={{ background: c, border: `2px solid ${sportColor === c ? 'white' : 'transparent'}`, boxShadow: sportColor === c ? `0 0 0 2px ${c}` : 'none' }}>
                        {sportColor === c && <CheckCircle size={14} className="text-white absolute inset-0 m-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>PRICING TYPE</label>
                  <div className="flex gap-1 bg-[#111] p-1 rounded-xl border border-white/5">
                    {(['flat', 'tiered'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setSportPricingType(t)}
                        className="flex-1 py-2 rounded-lg font-black transition-all capitalize"
                        style={{ fontSize: 12, background: sportPricingType === t ? '#FF8C00' : 'transparent', color: sportPricingType === t ? 'white' : '#666' }}>
                        {t === 'flat' ? 'Flat Rate' : 'Day / Evening'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 mb-1.5 font-black" style={{ fontSize: 10, letterSpacing: 0.5 }}>BASE PRICE (₱/hr)</label>
                  <input type="number" value={sportFlatPrice} onChange={e => setSportFlatPrice(e.target.value)} className={INPUT} style={{ fontSize: 13 }} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowSportModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 font-black hover:bg-[#303030] transition-colors" style={{ fontSize: 13 }}>
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-xl text-white font-black transition-all hover:opacity-90"
                    style={{ fontSize: 13, background: `linear-gradient(135deg,#FF8C00,#e67e00)` }}>
                    Add Sport
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
