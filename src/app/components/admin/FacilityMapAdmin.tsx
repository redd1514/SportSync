import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit2, Trash2, Save, X, Move, AlertTriangle, CheckCircle, Search, Filter, CalendarDays } from "lucide-react";
import { ALL_COURTS, SPORTS_INFO } from "../sportsData";
import { useUser } from "../../contexts/UserContext";

interface CourtMapData {
  id: string;
  name: string;
  sport: string;
  x: number;
  y: number;
  width: number;
  height: number;
  available: boolean;
  maintenanceMode: boolean;
  hourlyRate: string;
  capacity?: number;
}

const INITIAL_COURTS: CourtMapData[] = [
  { id: "BASK-1", name: "Basketball 1", sport: "Basketball", x: 50, y: 100, width: 200, height: 280, available: true, maintenanceMode: false, hourlyRate: "₱800" },
  { id: "VOLL-1", name: "Volleyball 1", sport: "Volleyball", x: 270, y: 100, width: 180, height: 280, available: true, maintenanceMode: false, hourlyRate: "₱600" },
  { id: "BADM-1", name: "Badminton 1", sport: "Badminton", x: 50, y: 420, width: 140, height: 200, available: true, maintenanceMode: false, hourlyRate: "₱250" },
  { id: "BADM-2", name: "Badminton 2", sport: "Badminton", x: 210, y: 420, width: 140, height: 200, available: false, maintenanceMode: true, hourlyRate: "₱250" },
  { id: "BADM-3", name: "Badminton 3", sport: "Badminton", x: 370, y: 420, width: 140, height: 200, available: true, maintenanceMode: false, hourlyRate: "₱250" },
  { id: "PICK-1", name: "Pickleball 1", sport: "Pickleball", x: 470, y: 100, width: 120, height: 130, available: true, maintenanceMode: false, hourlyRate: "₱200" },
  { id: "PICK-2", name: "Pickleball 2", sport: "Pickleball", x: 610, y: 100, width: 120, height: 130, available: true, maintenanceMode: false, hourlyRate: "₱200" },
  { id: "PICK-3", name: "Pickleball 3", sport: "Pickleball", x: 750, y: 100, width: 120, height: 130, available: true, maintenanceMode: false, hourlyRate: "₱200" },
  { id: "BILL-1", name: "Billiards 1", sport: "Billiards", x: 530, y: 510, width: 120, height: 110, available: true, maintenanceMode: false, hourlyRate: "₱150" },
  { id: "BILL-2", name: "Billiards 2", sport: "Billiards", x: 670, y: 510, width: 120, height: 110, available: true, maintenanceMode: false, hourlyRate: "₱150" },
  { id: "BILL-3", name: "Billiards 3", sport: "Billiards", x: 810, y: 510, width: 120, height: 110, available: true, maintenanceMode: false, hourlyRate: "₱150" },
  { id: "BILL-4", name: "Billiards 4", sport: "Billiards", x: 810, y: 390, width: 120, height: 110, available: true, maintenanceMode: false, hourlyRate: "₱150" },
  { id: "TTNS-1", name: "Table Tennis 1", sport: "Table Tennis", x: 530, y: 390, width: 120, height: 100, available: true, maintenanceMode: false, hourlyRate: "₱100" },
  { id: "TTNS-2", name: "Table Tennis 2", sport: "Table Tennis", x: 670, y: 390, width: 120, height: 100, available: true, maintenanceMode: false, hourlyRate: "₱100" },
  { id: "TTNS-3", name: "Table Tennis 3", sport: "Table Tennis", x: 530, y: 270, width: 120, height: 100, available: true, maintenanceMode: false, hourlyRate: "₱100" },
  { id: "TTNS-4", name: "Table Tennis 4", sport: "Table Tennis", x: 670, y: 270, width: 120, height: 100, available: true, maintenanceMode: false, hourlyRate: "₱100" },
];

const getSportColor = (sport: string, available: boolean, maintenance: boolean) => {
  if (maintenance) return "#6b7280"; // Gray for maintenance
  if (!available) return "#7f1d1d"; // Dark red for unavailable
  
  switch (sport) {
    case "Basketball": return "#FF8C00";
    case "Volleyball": return "#0047AB";
    case "Badminton": return "#22c55e";
    case "Pickleball": return "#a855f7";
    case "Billiards": return "#ec4899";
    case "Table Tennis": return "#06b6d4";
    default: return "#4b5563";
  }
};

export function FacilityMapAdmin() {
  const { bookings } = useUser();
  const [courts, setCourts] = useState<CourtMapData[]>(INITIAL_COURTS);
  const [selectedCourt, setSelectedCourt] = useState<CourtMapData | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [draggedCourtId, setDraggedCourtId] = useState<string | null>(null);
  
  // Form State for configuration
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [formData, setFormData] = useState<Partial<CourtMapData>>({});

  const svgRef = useRef<SVGSVGElement>(null);

  // Dynamic real-time status derived from bookings
  // For demonstration, a court is unavailable if there's any active booking today
  const dynamicCourts = useMemo(() => {
    const today = "2026-03-13"; // Using static today as per instructions
    const activeBookings = bookings.filter(b => b.date === today && b.status !== "cancelled" && b.status !== "completed");
    
    return courts.map(c => {
      const isBooked = activeBookings.some(b => b.court === c.name);
      return {
        ...c,
        available: c.maintenanceMode ? false : !isBooked,
      };
    });
  }, [courts, bookings]);

  // Drag and Drop Handlers
  const handlePointerDown = (e: React.PointerEvent, courtId: string) => {
    if (!isEditingMode) return;
    e.stopPropagation();
    setDraggedCourtId(courtId);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditingMode || !draggedCourtId || !svgRef.current) return;
    
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    setCourts(prev => prev.map(c => {
      if (c.id === draggedCourtId) {
        // Snap to 10px grid
        return {
          ...c,
          x: Math.round((loc.x - c.width / 2) / 10) * 10,
          y: Math.round((loc.y - c.height / 2) / 10) * 10,
        };
      }
      return c;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedCourtId) {
      setDraggedCourtId(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  const openConfig = (court?: CourtMapData) => {
    if (court) {
      setFormData(court);
    } else {
      setFormData({
        id: `NEW-${Date.now()}`,
        name: "New Court",
        sport: "Basketball",
        x: 400,
        y: 300,
        width: 150,
        height: 200,
        available: true,
        maintenanceMode: false,
        hourlyRate: "₱500"
      });
    }
    setShowConfigModal(true);
  };

  const saveConfig = () => {
    if (formData.id) {
      setCourts(prev => {
        const exists = prev.find(c => c.id === formData.id);
        if (exists) {
          return prev.map(c => c.id === formData.id ? { ...c, ...formData } as CourtMapData : c);
        } else {
          return [...prev, formData as CourtMapData];
        }
      });
    }
    setShowConfigModal(false);
  };

  const removeCourt = (id: string) => {
    if (window.confirm("Are you sure you want to remove this court?")) {
      setCourts(prev => prev.filter(c => c.id !== id));
      if (selectedCourt?.id === id) setSelectedCourt(null);
      setShowConfigModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-white" style={{ fontSize: 26, fontWeight: 900 }}>Facility Map Management</h2>
          <p className="text-gray-500" style={{ fontSize: 13 }}>Interactive view of all courts. Drag to reposition, click to configure.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => openConfig()}
            className="flex items-center gap-2 bg-[#FF8C00] text-white px-4 py-2 rounded-xl hover:bg-[#e67e00] transition-colors"
            style={{ fontSize: 13, fontWeight: 800 }}
          >
            <Plus size={16} /> Add Court
          </button>
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              isEditingMode ? "bg-red-500 text-white" : "bg-[#252525] text-white hover:bg-[#333]"
            }`}
            style={{ fontSize: 13, fontWeight: 800 }}
          >
            <Move size={16} /> {isEditingMode ? "Done Editing" : "Edit Layout"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Side - The Map */}
        <div className="xl:col-span-3">
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span className="text-gray-400" style={{ fontSize: 12 }}>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-900 rounded-sm" />
                  <span className="text-gray-400" style={{ fontSize: 12 }}>Reserved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-sm" />
                  <span className="text-gray-400" style={{ fontSize: 12 }}>Maintenance</span>
                </div>
              </div>
              {isEditingMode && (
                <span className="text-[#FF8C00] animate-pulse font-black" style={{ fontSize: 12 }}>
                  Drag courts to reposition
                </span>
              )}
            </div>

            <div className="relative w-full overflow-x-auto">
              <svg 
                ref={svgRef}
                viewBox="0 0 950 650" 
                className="w-full h-auto min-w-[800px] touch-none"
                style={{ maxHeight: "650px", cursor: isEditingMode ? "grab" : "default" }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {/* Grid Background */}
                <rect width="950" height="650" fill="#151515" />
                <defs>
                  <pattern id="admin-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#252525" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="950" height="650" fill="url(#admin-grid)" />
                
                {/* Courts */}
                {dynamicCourts.map((court) => {
                  const isSelected = selectedCourt?.id === court.id;
                  const isDragged = draggedCourtId === court.id;
                  const color = getSportColor(court.sport, court.available, court.maintenanceMode);
                  
                  return (
                    <g key={court.id}
                      transform={`translate(${court.x}, ${court.y})`}
                      className={isEditingMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                      onPointerDown={(e) => handlePointerDown(e, court.id)}
                      onClick={() => !isEditingMode && setSelectedCourt(court)}
                    >
                      <rect
                        width={court.width}
                        height={court.height}
                        fill={color}
                        opacity={isDragged ? 0.7 : (court.maintenanceMode || !court.available) ? 0.4 : 0.8}
                        stroke={isSelected ? "#ffffff" : isEditingMode ? "#FF8C00" : "#444"}
                        strokeWidth={isSelected ? 3 : isEditingMode ? 2 : 1}
                        strokeDasharray={isEditingMode ? "4 4" : "none"}
                        rx="6"
                      />
                      <text
                        x={court.width / 2}
                        y={court.height / 2 - 10}
                        textAnchor="middle"
                        fill="white"
                        fontSize="13"
                        fontWeight="bold"
                        pointerEvents="none"
                        style={{ userSelect: "none" }}
                      >
                        {court.name}
                      </text>
                      <text
                        x={court.width / 2}
                        y={court.height / 2 + 10}
                        textAnchor="middle"
                        fill="white"
                        fontSize="11"
                        opacity="0.7"
                        pointerEvents="none"
                        style={{ userSelect: "none" }}
                      >
                        {court.sport}
                      </text>
                      
                      {court.maintenanceMode && (
                        <text x={court.width / 2} y={court.height / 2 + 30} textAnchor="middle" fill="#fca5a5" fontSize="10" fontWeight="bold" pointerEvents="none">
                          MAINTENANCE
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Right Side - Configuration Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 p-5">
            <h4 className="text-white font-black mb-4" style={{ fontSize: 15 }}>Selected Court</h4>
            
            {selectedCourt ? (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400" style={{ fontSize: 11 }}>Court Name</p>
                  <p className="text-white font-black" style={{ fontSize: 16 }}>{selectedCourt.name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-400" style={{ fontSize: 11 }}>Sport</p>
                    <p className="text-white font-bold" style={{ fontSize: 13 }}>{selectedCourt.sport}</p>
                  </div>
                  <div>
                    <p className="text-gray-400" style={{ fontSize: 11 }}>Rate / Hour</p>
                    <p className="text-green-400 font-bold" style={{ fontSize: 13 }}>{selectedCourt.hourlyRate}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 mb-2" style={{ fontSize: 11 }}>Current Status</p>
                  <div className="flex gap-2">
                    {(() => {
                      const dyn = dynamicCourts.find(c => c.id === selectedCourt.id);
                      const isAvail = dyn?.available ?? true;
                      const isMaint = dyn?.maintenanceMode ?? false;
                      
                      return (
                        <span className={`px-2 py-1 rounded-md text-xs font-black ${
                          isMaint ? 'bg-gray-500/20 text-gray-400' :
                          isAvail ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isMaint ? 'Maintenance' : isAvail ? 'Available' : 'Reserved'}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button
                    onClick={() => openConfig(selectedCourt)}
                    className="w-full flex items-center justify-center gap-2 bg-[#252525] text-white px-4 py-2 rounded-xl hover:bg-[#333] transition-colors"
                    style={{ fontSize: 13, fontWeight: 800 }}
                  >
                    <Edit2 size={15} /> Configure Court
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500" style={{ fontSize: 13 }}>
                  Click on a court on the map to view and edit its configuration.
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 p-5">
            <h4 className="text-white font-black mb-4" style={{ fontSize: 15 }}>System Status</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400" style={{ fontSize: 13 }}>Total Courts</span>
                <span className="text-white font-bold">{dynamicCourts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400" style={{ fontSize: 13 }}>Available Now</span>
                <span className="text-green-400 font-bold">
                  {dynamicCourts.filter(c => c.available && !c.maintenanceMode).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400" style={{ fontSize: 13 }}>Under Maintenance</span>
                <span className="text-orange-400 font-bold">
                  {dynamicCourts.filter(c => c.maintenanceMode).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1A] rounded-2xl w-full max-w-lg border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-white font-black" style={{ fontSize: 18 }}>
                  {formData.id?.startsWith('NEW') ? 'Create New Court' : 'Configure Court'}
                </h3>
                <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-gray-400 block mb-1.5" style={{ fontSize: 12 }}>Court Name</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  
                  <div>
                    <label className="text-gray-400 block mb-1.5" style={{ fontSize: 12 }}>Sport Type</label>
                    <select
                      value={formData.sport || ''}
                      onChange={e => setFormData({ ...formData, sport: e.target.value })}
                      className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
                      style={{ fontSize: 13 }}
                    >
                      {SPORTS_INFO.map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1.5" style={{ fontSize: 12 }}>Hourly Rate</label>
                    <input
                      type="text"
                      value={formData.hourlyRate || ''}
                      onChange={e => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {/* Dimensions */}
                  <div className="col-span-2">
                    <h4 className="text-white font-bold mb-3 border-t border-white/10 pt-3" style={{ fontSize: 14 }}>Map Dimensions</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-gray-500 block mb-1" style={{ fontSize: 11 }}>X Position</label>
                        <input type="number" value={formData.x || 0} onChange={e => setFormData({...formData, x: parseInt(e.target.value)})} className="w-full bg-[#252525] rounded-lg px-3 py-1.5 text-white" />
                      </div>
                      <div>
                        <label className="text-gray-500 block mb-1" style={{ fontSize: 11 }}>Y Position</label>
                        <input type="number" value={formData.y || 0} onChange={e => setFormData({...formData, y: parseInt(e.target.value)})} className="w-full bg-[#252525] rounded-lg px-3 py-1.5 text-white" />
                      </div>
                      <div>
                        <label className="text-gray-500 block mb-1" style={{ fontSize: 11 }}>Width</label>
                        <input type="number" value={formData.width || 0} onChange={e => setFormData({...formData, width: parseInt(e.target.value)})} className="w-full bg-[#252525] rounded-lg px-3 py-1.5 text-white" />
                      </div>
                      <div>
                        <label className="text-gray-500 block mb-1" style={{ fontSize: 11 }}>Height</label>
                        <input type="number" value={formData.height || 0} onChange={e => setFormData({...formData, height: parseInt(e.target.value)})} className="w-full bg-[#252525] rounded-lg px-3 py-1.5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 border-t border-white/10 pt-3">
                    <h4 className="text-white font-bold mb-3" style={{ fontSize: 14 }}>Availability Status</h4>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" checked={formData.available || false} onChange={e => setFormData({...formData, available: e.target.checked})} className="rounded bg-[#252525] border-white/10 text-[#FF8C00] focus:ring-[#FF8C00]" />
                        <span style={{ fontSize: 13 }}>Available for Booking</span>
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" checked={formData.maintenanceMode || false} onChange={e => setFormData({...formData, maintenanceMode: e.target.checked})} className="rounded bg-[#252525] border-white/10 text-orange-500 focus:ring-orange-500" />
                        <span style={{ fontSize: 13 }}>Under Maintenance</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex justify-between bg-[#111]">
                {!formData.id?.startsWith('NEW') ? (
                  <button
                    onClick={() => formData.id && removeCourt(formData.id)}
                    className="flex items-center gap-2 text-red-400 hover:bg-red-400/10 px-4 py-2 rounded-xl transition-colors"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    <Trash2 size={16} /> Delete Court
                  </button>
                ) : <div />}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-5 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveConfig}
                    className="flex items-center gap-2 bg-[#FF8C00] text-white px-6 py-2 rounded-xl hover:bg-[#e67e00] transition-colors"
                    style={{ fontSize: 13, fontWeight: 800 }}
                  >
                    <Save size={16} /> Save Changes
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
