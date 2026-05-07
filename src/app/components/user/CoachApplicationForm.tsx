import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, CheckCircle, X, Send, Award, Clock, DollarSign, Users, ChevronRight } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { SectionLoader } from "../shared/LoadingScreen";

export interface CoachApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  sport: string;
  experience: string;
  bio: string;
  availability: string[];
  requestedRate: number;
  certifications: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}

const SPORTS = ["Basketball", "Volleyball", "Badminton", "Pickleball", "Billiards", "Table Tennis"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BG = "#131314";
const SURFACE = "#1E1F20";
const SURFACE2 = "#26272B";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_PRIMARY = "#E3E3E3";
const TEXT_SECONDARY = "#A0A0A5";
const ACCENT_BLUE = "#2563EB";

function ProgressStep({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
        style={{ background: done ? "#22c55e" : active ? ACCENT_BLUE : SURFACE2, border: `2px solid ${done ? "#22c55e" : active ? ACCENT_BLUE : BORDER}` }}>
        {done ? <CheckCircle size={16} className="text-white" /> : <span style={{ color: active ? "white" : TEXT_SECONDARY, fontSize: 13, fontWeight: 800 }}>{num}</span>}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: active ? TEXT_PRIMARY : TEXT_SECONDARY, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

export function CoachApplicationForm() {
  const { user } = useUser();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [step, setStep] = useState(0); // 0=intro, 1=sport, 2=profile, 3=done
  const [sport, setSport] = useState("");
  const [experience, setExperience] = useState("");
  const [bio, setBio] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [requestedRate, setRequestedRate] = useState("800");
  const [certifications, setCertifications] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggleDay = (d: string) => setAvailability(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSubmit = () => {
    if (!sport || !bio || availability.length === 0) return;
    const app: CoachApplication = {
      id: `app-${Date.now()}`,
      userId: user?.id || "guest",
      userName: user?.name || "User",
      userEmail: user?.email || "",
      sport, experience, bio, availability,
      requestedRate: parseInt(requestedRate) || 800,
      certifications,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    // Store in localStorage so admin can see it
    const existing = JSON.parse(localStorage.getItem("jrc_coach_applications") || "[]");
    existing.push(app);
    localStorage.setItem("jrc_coach_applications", JSON.stringify(existing));
    setSubmitted(true);
    setStep(3);
  };

  const INPUT = `w-full rounded-xl px-4 py-3 text-sm border transition-colors focus:outline-none`;
  const inputStyle = { background: SURFACE2, borderColor: BORDER, color: TEXT_PRIMARY, fontSize: 13 };

  useEffect(() => {
    const t = setTimeout(() => setIsInitialLoad(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isInitialLoad) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#131314]">
        <SectionLoader label="Loading application…" accentColor="#2563EB" />
      </div>
    );
  }

  if (submitted || step === 3) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-16 px-8" style={{ background: BG, fontFamily: "'Outfit','Inter',sans-serif" }}>
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-w-md w-full rounded-3xl border p-10 text-center" style={{ background: SURFACE, borderColor: "#22c55e25" }}>
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h2 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 900, marginBottom: 10 }}>Application Submitted!</h2>
          <p style={{ color: TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Your coaching application for <strong style={{ color: TEXT_PRIMARY }}>{sport}</strong> has been received. 
            Our admin team will review it and respond within 24 hours via your account notifications.
          </p>
          <div className="rounded-2xl p-4 border mb-6" style={{ background: SURFACE2, borderColor: BORDER }}>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div>
                <p style={{ color: TEXT_SECONDARY, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>SPORT</p>
                <p style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 800 }}>{sport}</p>
              </div>
              <div>
                <p style={{ color: TEXT_SECONDARY, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>RATE</p>
                <p style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 800 }}>₱{parseInt(requestedRate).toLocaleString()}/hr</p>
              </div>
              <div>
                <p style={{ color: TEXT_SECONDARY, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>AVAILABILITY</p>
                <p style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 800 }}>{availability.length} days/week</p>
              </div>
              <div>
                <p style={{ color: TEXT_SECONDARY, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>STATUS</p>
                <span className="px-2 py-0.5 rounded-full text-yellow-400 font-black" style={{ fontSize: 10, background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)" }}>PENDING REVIEW</span>
              </div>
            </div>
          </div>
          <button onClick={() => { setStep(0); setSubmitted(false); setSport(""); setBio(""); setAvailability([]); }}
            style={{ color: ACCENT_BLUE, fontSize: 13, fontWeight: 700 }}>
            Submit another application
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: BG, fontFamily: "'Outfit','Inter',sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT_BLUE}, #1d4ed8)`, boxShadow: `0 6px 20px ${ACCENT_BLUE}40` }}>
              <GraduationCap size={22} className="text-white" />
            </div>
            <div>
              <h1 style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: 900 }}>Apply to be a Coach</h1>
              <p style={{ color: TEXT_SECONDARY, fontSize: 13 }}>Join the JRC SportsSync coaching team</p>
            </div>
          </div>

          {/* Benefits row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Clock,       label: "Flexible Hours",       color: "#F97316" },
              { icon: DollarSign,  label: "Competitive Pay",      color: "#22c55e" },
              { icon: Users,       label: "Grow Your Clientele",  color: "#a855f7" },
              { icon: Award,       label: "Pro Facility",         color: ACCENT_BLUE },
            ].map(b => (
              <div key={b.label} className="rounded-xl p-3 border flex flex-col items-center gap-1.5 text-center" style={{ background: SURFACE, borderColor: BORDER }}>
                <b.icon size={16} style={{ color: b.color }} />
                <span style={{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: 700 }}>{b.label}</span>
              </div>
            ))}
          </div>

          {/* Progress steps */}
          {step > 0 && (
            <div className="flex items-center gap-2 justify-center">
              {[["1", "Sport"], ["2", "Profile"], ["3", "Availability"]].map(([n, label], i) => (
                <div key={n} className="flex items-center gap-2">
                  <ProgressStep num={parseInt(n)} label={label} active={step === i + 1} done={step > i + 1} />
                  {i < 2 && <div className="w-8 h-px" style={{ background: step > i + 1 ? "#22c55e" : BORDER }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Intro */}
          {step === 0 && (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="rounded-3xl border overflow-hidden" style={{ background: SURFACE, borderColor: BORDER }}>
              <div className="p-8">
                <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Ready to coach at JRC?</h2>
                <p style={{ color: TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  We're always looking for passionate, skilled sports coaches to join our growing team. 
                  Complete this short application and our admin team will review it within 24 hours. 
                  Once approved, your profile will appear in the Coaching Hub for users to book sessions with you.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    "Tell us about your sport and experience level",
                    "Set your own availability and desired hourly rate",
                    "Admin reviews and approves your profile",
                    "Start receiving session bookings from users",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${ACCENT_BLUE}20`, border: `1px solid ${ACCENT_BLUE}40` }}>
                        <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                      </div>
                      <p style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.5 }}>{step}</p>
                    </div>
                  ))}
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setStep(1)}
                  className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${ACCENT_BLUE}, #1d4ed8)`, fontSize: 15, fontWeight: 800, boxShadow: `0 6px 20px ${ACCENT_BLUE}40` }}>
                  Start Application <ChevronRight size={17} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Sport selection */}
          {step === 1 && (
            <motion.div key="sport" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-4">
              <div className="rounded-3xl border p-6" style={{ background: SURFACE, borderColor: BORDER }}>
                <h3 style={{ color: TEXT_PRIMARY, fontSize: 17, fontWeight: 900, marginBottom: 4 }}>Which sport will you coach?</h3>
                <p style={{ color: TEXT_SECONDARY, fontSize: 13, marginBottom: 20 }}>Select your primary coaching sport</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SPORTS.map((s, idx) => {
                    const selected = sport === s;
                    const SPORT_COLORS: Record<string,string> = {
                      Basketball:'#F97316', Volleyball:'#2563EB', Badminton:'#22c55e',
                      Pickleball:'#a855f7', Billiards:'#ec4899', 'Table Tennis':'#06b6d4',
                    };
                    const color = SPORT_COLORS[s] || ACCENT_BLUE;
                    return (
                      <motion.button
                        key={s}
                        onClick={() => setSport(s)}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06, type: 'spring', stiffness: 340, damping: 26 }}
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative rounded-2xl p-4 border text-left overflow-hidden"
                        style={{
                          background: selected ? `${color}15` : SURFACE2,
                          borderColor: selected ? color : BORDER,
                          boxShadow: selected ? `0 0 20px ${color}30, 0 4px 16px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                        {/* Glow blob */}
                        {selected && (
                          <motion.div
                            layoutId="sportGlow"
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: `radial-gradient(circle at 50% 50%, ${color}20, transparent 70%)` }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          />
                        )}
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                              style={{ background: selected ? `${color}25` : 'rgba(255,255,255,0.06)' }}>
                              <motion.div animate={{ rotate: selected ? 360 : 0 }} transition={{ duration: 0.4 }}>
                                <span style={{ fontSize: 16 }}>
                                  {s === 'Basketball' ? '🏀' : s === 'Volleyball' ? '🏐' : s === 'Badminton' ? '🏸' : s === 'Pickleball' ? '🎾' : s === 'Billiards' ? '🎱' : '🏓'}
                                </span>
                              </motion.div>
                            </div>
                            {selected && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: color }}>
                                <CheckCircle size={12} className="text-white" />
                              </motion.div>
                            )}
                          </div>
                          <p style={{ color: selected ? color : TEXT_PRIMARY, fontSize: 14, fontWeight: 800 }}>{s}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <label style={{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>EXPERIENCE LEVEL</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["Beginner-friendly", "Intermediate", "Advanced", "Elite / Pro"].map(e => (
                      <button key={e} onClick={() => setExperience(e)}
                        className="px-3 py-1.5 rounded-xl border font-black transition-all"
                        style={{ fontSize: 12, background: experience === e ? `${ACCENT_BLUE}18` : SURFACE2, borderColor: experience === e ? ACCENT_BLUE : BORDER, color: experience === e ? "#60a5fa" : TEXT_SECONDARY }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-2xl border font-black transition-all"
                  style={{ fontSize: 14, background: SURFACE2, borderColor: BORDER, color: TEXT_SECONDARY }}>Back</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { if (sport) setStep(2); }}
                  disabled={!sport}
                  className="flex-1 py-3 rounded-2xl text-white font-black transition-all"
                  style={{ fontSize: 14, background: sport ? `linear-gradient(135deg, ${ACCENT_BLUE}, #1d4ed8)` : SURFACE2, color: sport ? "white" : TEXT_SECONDARY, opacity: sport ? 1 : 0.5 }}>
                  Continue →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-4">
              <div className="rounded-3xl border p-6" style={{ background: SURFACE, borderColor: BORDER }}>
                <h3 style={{ color: TEXT_PRIMARY, fontSize: 17, fontWeight: 900, marginBottom: 4 }}>Your Coach Profile</h3>
                <p style={{ color: TEXT_SECONDARY, fontSize: 13, marginBottom: 20 }}>This is what users will see when browsing coaches</p>
                <div className="space-y-4">
                  <div>
                    <label style={{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>BIO / COACHING STYLE</label>
                    <textarea rows={4} value={bio} onChange={e => setBio(e.target.value)}
                      placeholder="e.g. I'm a competitive basketball coach with 5 years experience training youth and adult teams. My sessions focus on..."
                      className={INPUT} style={{ ...inputStyle, marginTop: 6, resize: "none" }} />
                  </div>
                  <div>
                    <label style={{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>CERTIFICATIONS (Optional)</label>
                    <input value={certifications} onChange={e => setCertifications(e.target.value)}
                      placeholder="e.g. PAABA Level 1, PSC Certified Coach..."
                      className={INPUT} style={{ ...inputStyle, marginTop: 6 }} />
                  </div>
                  <div>
                    <label style={{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>DESIRED HOURLY RATE (₱)</label>
                    <input type="number" value={requestedRate} onChange={e => setRequestedRate(e.target.value)}
                      className={INPUT} style={{ ...inputStyle, marginTop: 6 }} min={300} max={5000} />
                    <p style={{ color: TEXT_SECONDARY, fontSize: 11, marginTop: 4 }}>Recommended: ₱500–₱2,000/hr. Admin may adjust during onboarding.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-6" style={{ background: SURFACE, borderColor: BORDER }}>
                <h3 style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>Weekly Availability</h3>
                <p style={{ color: TEXT_SECONDARY, fontSize: 13, marginBottom: 16 }}>Which days are you available to coach?</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(d => {
                    const sel = availability.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)}
                        className="px-3 py-2 rounded-xl border font-black transition-all"
                        style={{ fontSize: 12, background: sel ? `${ACCENT_BLUE}18` : SURFACE2, borderColor: sel ? ACCENT_BLUE : BORDER, color: sel ? "#60a5fa" : TEXT_SECONDARY }}>
                        {d.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-2xl border font-black"
                  style={{ fontSize: 14, background: SURFACE2, borderColor: BORDER, color: TEXT_SECONDARY }}>Back</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={!bio || availability.length === 0}
                  className="flex-1 py-3 rounded-2xl text-white font-black flex items-center justify-center gap-2"
                  style={{ fontSize: 14, background: (bio && availability.length > 0) ? `linear-gradient(135deg, ${ACCENT_BLUE}, #1d4ed8)` : SURFACE2, color: (bio && availability.length > 0) ? "white" : TEXT_SECONDARY, opacity: (bio && availability.length > 0) ? 1 : 0.5, boxShadow: (bio && availability.length > 0) ? `0 6px 20px ${ACCENT_BLUE}40` : "none" }}>
                  <Send size={15} /> Submit Application
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}