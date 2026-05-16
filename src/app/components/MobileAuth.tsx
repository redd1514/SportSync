import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle, Eye, EyeOff, User, Shield, Lock, Mail, ArrowRight,
  Sparkles, Play, GraduationCap, Trophy, Zap, Star,
} from "lucide-react";
import img from "figma:asset/3c72242160182623c7af77022e5fe780472ce13b.png";
import { useUser } from "../contexts/UserContext";

interface MobileAuthProps {
  onLoginSuccess: () => void;
  onAdminLogin?: () => void;
}

const BG     = "#0F1011";
const SURF   = "#1A1B1E";
const SURF2  = "#242529";
const BORDER = "rgba(255,255,255,0.07)";
const TP     = "#E8E8EA";
const TS     = "#9294A0";
const ORANGE = "#F97316";
const BLUE   = "#2563EB";

function detectRecoveryFromUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hashRaw);

  return searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

const DEMO_ACCOUNTS = [
  { role: "User Account",  email: "user@jrc.com",  password: "user123",     color: ORANGE,  bg: "rgba(249,115,22,0.08)",  Icon: User },
  { role: "Staff Account", email: "staff@jrc.com", password: "password123", color: "#22c55e", bg: "rgba(34,197,94,0.08)", Icon: Shield },
  { role: "Admin Account", email: "admin@jrc.com", password: "admin123",    color: BLUE,    bg: "rgba(37,99,235,0.08)",    Icon: Shield },
  { role: "Coach Account", email: "coach@jrc.com", password: "coach123",    color: "#a855f7", bg: "rgba(168,85,247,0.08)",  Icon: GraduationCap },
];

/* ── Floating sport particles ── */
const PARTICLES = [
  { icon: Trophy,       color: "#FBBF24", x: "8%",  y: "15%", size: 18, delay: 0    },
  { icon: Star,         color: ORANGE,    x: "85%", y: "10%", size: 16, delay: 0.8  },
  { icon: GraduationCap,color: BLUE,      x: "92%", y: "55%", size: 20, delay: 1.4  },
  { icon: Zap,          color: "#22c55e", x: "5%",  y: "70%", size: 16, delay: 0.5  },
  { icon: Play,         color: ORANGE,    x: "78%", y: "82%", size: 14, delay: 1.1  },
  { icon: Sparkles,     color: BLUE,      x: "20%", y: "88%", size: 15, delay: 1.7  },
];

function FloatingParticle({ icon: Icon, color, x, y, size, delay }: typeof PARTICLES[0]) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 0.5, 0.3, 0.5, 0], scale: [0, 1, 1, 1, 0], y: [0, -8, 0, -6, 0] }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="rounded-2xl flex items-center justify-center"
        style={{ width: size * 2.2, height: size * 2.2, background: `${color}14`, border: `1px solid ${color}28`, backdropFilter: "blur(8px)" }}>
        <Icon size={size} style={{ color }} />
      </div>
    </motion.div>
  );
}

/* ── Input field ── */
function AuthInput({ icon: Icon, type, value, onChange, placeholder, onKeyDown, rightElement, autoComplete, name }: {
  icon: any; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; onKeyDown?: (e: React.KeyboardEvent) => void; rightElement?: React.ReactNode;
  autoComplete?: string; name?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200" style={{ color: focused ? ORANGE : TS }}>
        <Icon size={15} />
      </div>
      <input
        type={type} value={value}
        name={name}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full rounded-xl pl-11 pr-12 py-3.5 transition-all duration-200 focus:outline-none"
        style={{
          background: focused ? "#2E3244" : SURF2,
          border: `1.5px solid ${focused ? ORANGE + "55" : "rgba(255,255,255,0.09)"}`,
          color: TP,
          fontSize: 14,
          boxShadow: focused ? `0 0 0 3px ${ORANGE}12, 0 2px 8px rgba(0,0,0,0.2)` : "none",
        }}
      />
      {rightElement && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightElement}</div>
      )}
    </div>
  );
}

export function MobileAuth({ onLoginSuccess }: MobileAuthProps) {
  const [recoveryMode, setRecoveryMode] = useState(() => detectRecoveryFromUrl());
  const [authStep, setAuthStep]         = useState<"signin" | "signup" | "verify-email" | "forgot-password" | "reset-sent" | "update-password">(
    () => detectRecoveryFromUrl() ? "update-password" : "signin"
  );
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirm]   = useState("");
  const [name, setName]                 = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTargetEmail, setVerificationTargetEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [showPassword, setShowPw]       = useState(false);
  const [showDemos, setShowDemos]       = useState(false);
  const [loading, setLoading]           = useState(false);

  const isSignUp = authStep === "signup";
  const isSignIn = authStep === "signin";
  const isVerifyStep = authStep === "verify-email";
  const isForgotPasswordStep = authStep === "forgot-password";
  const isResetSentStep = authStep === "reset-sent";
  const isUpdatePasswordStep = authStep === "update-password";

  const { login, signUp, verifyEmailCode, resendVerificationCode, resetPassword, updatePassword, logout, isLoggedIn, authFlow, clearAuthFlow } = useUser();

  const bgImage = "https://images.unsplash.com/photo-1720217262350-2dec57765d26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXNrZXRiYWxsJTIwY291cnQlMjBpbmRvb3IlMjBhY3Rpb24lMjBwbGF5ZXJzfGVufDF8fHx8MTc3NzkxMDU2Mnww&ixlib=rb-4.1.0&q=80&w=1080";

  useEffect(() => {
    if (isLoggedIn && !recoveryMode && !isUpdatePasswordStep) {
      onLoginSuccess();
    }
  }, [isLoggedIn, onLoginSuccess, recoveryMode, isUpdatePasswordStep]);

  useEffect(() => {
    if (authFlow === "password_recovery") {
      setRecoveryMode(true);
      setAuthStep("update-password");
      setError("");
      setSuccess("Reset token verified. Create your new password.");
    }
  }, [authFlow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (detectRecoveryFromUrl()) {
      setRecoveryMode(true);
      setAuthStep("update-password");
      setError("");
      setSuccess("Reset token verified. Create your new password.");
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  }, []);

  const fill = (a: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(a.email); setPassword(a.password); setError(""); setSuccess(""); setAuthStep("signin"); setShowDemos(false);
  };

  const handleSignIn = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Please fill in all fields"); return; }
    
    setLoading(true);
    
    // Call the hybrid login
    const { error: authError } = await login(email, password);
    
    setLoading(false);

    if (authError) {
      setError(authError); 
    } else {
      setSuccess("Welcome back! Loading your dashboard…"); 
      setTimeout(onLoginSuccess, 700);
    }
  };

  const handleSignUp = async () => {
    setError(""); setSuccess("");
    if (!name || !email || !password || !confirmPassword) { setError("Please fill in all fields"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    
    setLoading(true);
    
    const { error: authError } = await signUp(email, password, name);

    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      setVerificationTargetEmail(email);
      setPendingPassword(password);
      setVerificationCode("");
      setAuthStep("verify-email");
      setSuccess("Account created. Enter the code sent to your email to verify your account.");
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setSuccess("");
    if (!verificationCode.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await verifyEmailCode(verificationTargetEmail, verificationCode);
    if (verifyError) {
      setLoading(false);
      setError(verifyError);
      return;
    }

    const { error: loginError } = await login(verificationTargetEmail, pendingPassword);
    setLoading(false);

    if (loginError) {
      setError(loginError);
      return;
    }

    setSuccess("Email verified. Redirecting to your dashboard...");
    setTimeout(onLoginSuccess, 800);
  };

  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    if (!verificationTargetEmail) {
      setError("No email found for verification. Please sign up again.");
      return;
    }

    setLoading(true);
    const { error: resendError } = await resendVerificationCode(verificationTargetEmail);
    setLoading(false);
    if (resendError) {
      setError(resendError);
      return;
    }

    setSuccess("A new verification code was sent to your email.");
  };

  const handleResetPassword = async () => {
    setError("");
    setSuccess("");
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await resetPassword(email);
    setLoading(false);
    
    if (resetError) setError(resetError);
    else {
      setAuthStep("reset-sent");
      setSuccess("Password reset link sent! Check your email.");
    }
  };

  const handleUpdatePassword = async () => {
    setError("");
    setSuccess("");

    if (!newPassword || !confirmNewPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(newPassword);
    setLoading(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setSuccess("Password updated successfully. You can now sign in.");
    setNewPassword("");
    setConfirmNewPassword("");
    await logout();
    clearAuthFlow();
    setRecoveryMode(false);
    setTimeout(() => {
      setAuthStep("signin");
      setSuccess("");
    }, 2200);
  };

  return (
    <div className="h-screen w-full overflow-hidden flex" style={{ background: BG, fontFamily: "'Outfit','Inter',sans-serif" }}>

      {/* ──────────── LEFT PANEL (desktop only) ──────────── */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden flex-col justify-between">
        {/* Background photo */}
        <div className="absolute inset-0">
          <img src={bgImage} alt="JRC" className="w-full h-full object-cover" style={{ filter: "brightness(0.55) saturate(1.1)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(15,16,17,0.92) 0%, rgba(15,16,17,0.65) 60%, rgba(15,16,17,0.4) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,16,17,1) 0%, transparent 50%)" }} />
        </div>

        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div className="absolute rounded-full opacity-25"
            style={{ width: 500, height: 500, top: -150, left: -100, background: `radial-gradient(circle, ${ORANGE}50, transparent 65%)`, filter: "blur(60px)" }}
            animate={{ scale: [1, 1.08, 1], x: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute rounded-full opacity-15"
            style={{ width: 400, height: 400, bottom: 100, right: -80, background: `radial-gradient(circle, ${BLUE}60, transparent 65%)`, filter: "blur(50px)" }}
            animate={{ scale: [1, 1.12, 1], y: [0, -15, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center gap-3 p-10">
          <div className="flex items-center gap-2.5" style={{ overflow: "hidden" }}>
            {/* Replaced the div logo with an img tag */}
            <img 
              src="/pwa-icons/icon-72x72.png" // Update this path and filename
              alt="JRC Logo"
              className="w-9 h-9 rounded-xl flex-shrink-0 object-cover shadow-lg"
            />
          </div>
          <div>
            <p className="font-black" style={{ fontSize: 20 }}>
              <span style={{ color: TP }}>JRC </span>
              <span style={{ color: ORANGE }}>Sport</span>
              <span style={{ color: BLUE }}>Sync</span>
            </p>
            <p style={{ color: TS, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>SPORTS COMPLEX</p>
          </div>
        </div>

        <div className="relative z-10 p-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4"
              style={{ background: `${ORANGE}12`, borderColor: `${ORANGE}30` }}>
              <Sparkles size={11} style={{ color: ORANGE }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: ORANGE }}>JRC BALLPARK · VALENZUELA</span>
            </div>
            <h2 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.08, marginBottom: 16, color: TP }}>
              Book Your<br />Court in<br />
              <span style={{ background: `linear-gradient(135deg, ${ORANGE}, #fb923c)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Seconds.
              </span>
            </h2>
            <p style={{ color: TS, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
              6 sports · 12 courts · Open daily<br />7:00 AM – 12:00 MN
            </p>
            {/* Sport pills */}
            <div className="flex flex-wrap gap-2">
              {["Basketball", "Volleyball", "Badminton", "Pickleball", "Billiards", "Table Tennis"].map(s => (
                <motion.div key={s} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + ["Basketball","Volleyball","Badminton","Pickleball","Billiards","Table Tennis"].indexOf(s) * 0.06 }}
                  className="px-3 py-1.5 rounded-full border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: BORDER, fontSize: 12, fontWeight: 700, color: TS }}>
                  {s}
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <div className="flex -space-x-2">
                {[ORANGE, BLUE, "#22c55e"].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                    style={{ background: c, borderColor: BG }}>
                    <User size={14} className="text-white" />
                  </div>
                ))}
              </div>
              <p style={{ color: TS, fontSize: 13 }}>
                <span style={{ color: TP, fontWeight: 800 }}>1,200+</span> athletes monthly
              </p>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 p-10 pt-0">
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>© 2026 JRC SportSync · Valenzuela City</p>
        </div>
      </div>

      {/* ──────────── RIGHT PANEL ──────────── */}
      <div className="w-full lg:w-1/2 h-full flex flex-col relative overflow-hidden">
        {/* Mobile bg */}
        <div className="lg:hidden absolute inset-0">
          <img src={bgImage} alt="bg" className="w-full h-full object-cover" style={{ filter: "brightness(0.12) blur(8px)", transform: "scale(1.1)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(15,16,17,0.85), rgba(15,16,17,0.97))" }} />
        </div>

        {/* Subtle background animations (behind the form) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div className="absolute rounded-full"
            style={{ width: 360, height: 360, top: -120, right: -80, background: `radial-gradient(circle, ${ORANGE}30, transparent 65%)`, filter: "blur(70px)", opacity: 0.18 }}
            animate={{ scale: [1, 1.1, 1], x: [0, -12, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute rounded-full"
            style={{ width: 280, height: 280, bottom: 60, left: -60, background: `radial-gradient(circle, ${BLUE}40, transparent 65%)`, filter: "blur(60px)", opacity: 0.12 }}
            animate={{ scale: [1, 1.08, 1], y: [0, -10, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 4 }} />
          {PARTICLES.map((p, i) => <FloatingParticle key={i} {...p} />)}
        </div>

        {/* ── Scrollable form area ── */}
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide flex flex-col justify-center">
          <div className="px-6 py-8 lg:px-12 max-w-[480px] mx-auto w-full">
            {/* Mobile logo */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-7 lg:hidden">
              <div className="relative inline-block mb-3">
                <motion.div className="absolute inset-[-8px] rounded-full border-2 border-dashed"
                  style={{ borderColor: `${ORANGE}40` }}
                  animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
                <img src={img} alt="JRC" className="w-16 h-16 rounded-full object-cover" style={{ border: `3px solid ${ORANGE}` }} />
              </div>
              <h1 className="font-black" style={{ fontSize: 24, letterSpacing: -0.5 }}>
                <span style={{ color: TP }}>JRC </span>
                <span style={{ color: ORANGE }}>Sport</span>
                <span style={{ color: BLUE }}>Sync</span>
              </h1>
              <p style={{ color: TS, fontSize: 12 }}>Where Every Game Comes to Life</p>
            </motion.div>

            {/* Desktop heading */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="hidden lg:block mb-7">
              <h2 style={{ color: TP, fontSize: 30, fontWeight: 900 }}>
                {isSignUp ? "Create Account" : isVerifyStep ? "Verify Email" : isForgotPasswordStep ? "Forgot Password" : isResetSentStep ? "Reset Link Sent" : isUpdatePasswordStep ? "Set New Password" : "Welcome Back"}
              </h2>
              <p style={{ color: TS, fontSize: 14, marginTop: 6 }}>
                {isSignUp
                  ? "Join JRC SportSync today"
                  : isVerifyStep
                    ? "Confirm your account using the code from your email"
                    : isForgotPasswordStep
                      ? "Request a secure password reset link"
                      : isResetSentStep
                        ? "Check your inbox to continue"
                        : isUpdatePasswordStep
                          ? "Set a new password for your account"
                        : "Sign in to your dashboard"}
              </p>
            </motion.div>

            {/* Demo accounts (sign in only) */}
            <AnimatePresence>
              {isSignIn && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-5">
                  <button
                    onClick={() => setShowDemos(!showDemos)}
                    className="w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all"
                    style={{ background: `${ORANGE}0e`, border: `1.5px solid ${ORANGE}28` }}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} style={{ color: ORANGE }} />
                      <span style={{ color: ORANGE, fontSize: 13, fontWeight: 800 }}>Demo Accounts</span>
                      <span style={{ color: TS, fontSize: 12 }}>— tap to fill</span>
                    </div>
                    <motion.div animate={{ rotate: showDemos ? 180 : 0 }}>
                      <ArrowRight size={14} style={{ color: TS, transform: "rotate(90deg)" }} />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {showDemos && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-2 space-y-2">
                          {DEMO_ACCOUNTS.map(a => (
                            <motion.button key={a.email} whileTap={{ scale: 0.98 }} onClick={() => fill(a)}
                              className="w-full rounded-2xl p-3.5 border text-left flex items-center gap-3 transition-all hover:brightness-110"
                              style={{ background: a.bg, borderColor: `${a.color}30` }}>
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20`, border: `1px solid ${a.color}30` }}>
                                <a.Icon size={16} style={{ color: a.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{a.role}</p>
                                <p style={{ color: TS, fontSize: 12 }} className="truncate">{a.email} · {a.password}</p>
                              </div>
                              <div className="rounded-full px-2.5 py-1 font-black" style={{ fontSize: 11, background: `${a.color}20`, color: a.color }}>Fill</div>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form card */}
            <motion.div
              key={authStep}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="rounded-3xl border p-6 shadow-2xl"
              style={{ background: `${SURF}cc`, borderColor: BORDER, backdropFilter: "blur(24px)" }}
            >
              <AnimatePresence mode="wait">
                {isSignUp ? (
                  <motion.div key="su" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <div className="text-center mb-1 lg:hidden">
                      <h2 style={{ color: TP, fontSize: 20, fontWeight: 900 }}>Create Account</h2>
                      <p style={{ color: TS, fontSize: 13 }}>Join JRC SportSync today</p>
                    </div>

                    {[
                      { icon: User, placeholder: "Full name", value: name, onChange: setName, type: "text", name: "name", autoComplete: "name" },
                      { icon: Mail, placeholder: "Email address", value: email, onChange: setEmail, type: "email", name: "email", autoComplete: "email" },
                    ].map((f, i) => (
                      <motion.div key={f.placeholder} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                        <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                          {f.placeholder}
                        </label>
                        <AuthInput {...f} onKeyDown={undefined} />
                      </motion.div>
                    ))}

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Password</label>
                      <AuthInput icon={Lock} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="Min. 6 characters"
                        name="new-password" autoComplete="new-password"
                        rightElement={<button type="button" onClick={() => setShowPw(!showPassword)} style={{ color: TS }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Confirm Password</label>
                      <AuthInput icon={Lock} type="password" value={confirmPassword} onChange={setConfirm} placeholder="Re-enter password"
                        name="confirm-new-password" autoComplete="new-password"
                        onKeyDown={e => e.key === "Enter" && handleSignUp()} />
                    </motion.div>

                    {error   && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>{error}</motion.div>}
                    {success && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: 13 }}><CheckCircle size={14} />{success}</motion.div>}

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${ORANGE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={handleSignUp} disabled={loading}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: loading ? "#333" : `linear-gradient(135deg, ${ORANGE}, #ea6b00)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${ORANGE}40` }}>
                      {loading ? (
                        <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      ) : (
                        <><ArrowRight size={16} /> Create Account</>
                      )}
                    </motion.button>

                    <p className="text-center" style={{ fontSize: 14, color: TS }}>
                      Already have an account?{" "}
                      <button onClick={() => { setAuthStep("signin"); setError(""); setSuccess(""); }} style={{ color: ORANGE, fontWeight: 800 }}>Sign In</button>
                    </p>
                  </motion.div>
                ) : isSignIn ? (
                  <motion.div key="si" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className="text-center mb-1 lg:hidden">
                      <h2 style={{ color: TP, fontSize: 20, fontWeight: 900 }}>Welcome Back</h2>
                      <p style={{ color: TS, fontSize: 13 }}>Sign in to your account</p>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Email</label>
                      <AuthInput icon={Mail} type="email" value={email} onChange={setEmail} placeholder="your@email.com" name="email" autoComplete="username" onKeyDown={e => e.key === "Enter" && handleSignIn()} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Password</label>
                      <AuthInput icon={Lock} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="Your password"
                        name="current-password" autoComplete="current-password"
                        onKeyDown={e => e.key === "Enter" && handleSignIn()}
                        rightElement={<button type="button" onClick={() => setShowPw(!showPassword)} style={{ color: TS }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
                        
                      <div className="flex justify-end mt-2">
                        <button 
                          type="button" 
                          onClick={() => { setAuthStep("forgot-password"); setError(""); setSuccess(""); }}
                          style={{ color: TS, fontSize: 11, fontWeight: 700 }}
                          className="hover:text-white transition-colors"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </motion.div>

                    {error   && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>{error}</motion.div>}
                    {success && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: 13 }}><CheckCircle size={14} />{success}</motion.div>}

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${ORANGE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={handleSignIn} disabled={loading}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: loading ? "#333" : `linear-gradient(135deg, ${ORANGE}, #ea6b00)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${ORANGE}40` }}>
                      {loading ? (
                        <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      ) : (
                        <><Play size={14} fill="white" /> Sign In</>
                      )}
                    </motion.button>

                    <p className="text-center" style={{ fontSize: 14, color: TS }}>
                      Don't have an account?{" "}
                      <button onClick={() => { setAuthStep("signup"); setError(""); setSuccess(""); }} style={{ color: ORANGE, fontWeight: 800 }}>Sign Up</button>
                    </p>
                  </motion.div>
                ) : isVerifyStep ? (
                  <motion.div key="verify" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className="text-center mb-1 lg:hidden">
                      <h2 style={{ color: TP, fontSize: 20, fontWeight: 900 }}>Verify Your Email</h2>
                      <p style={{ color: TS, fontSize: 13 }}>Enter the code sent to {verificationTargetEmail}</p>
                    </div>

                    <div className="rounded-2xl px-4 py-3" style={{ background: `${BLUE}14`, border: `1px solid ${BLUE}30` }}>
                      <p style={{ color: TP, fontSize: 13 }}>
                        A verification code has been sent to <span style={{ color: ORANGE, fontWeight: 700 }}>{verificationTargetEmail}</span>.
                      </p>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Verification Code</label>
                      <AuthInput icon={Mail} type="text" value={verificationCode} onChange={setVerificationCode} placeholder="Enter 6-digit code"
                        onKeyDown={e => e.key === "Enter" && handleVerifyCode()} />
                    </motion.div>

                    {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>{error}</motion.div>}
                    {success && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: 13 }}><CheckCircle size={14} />{success}</motion.div>}

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${BLUE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={handleVerifyCode} disabled={loading}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: loading ? "#333" : `linear-gradient(135deg, ${BLUE}, #1d4ed8)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${BLUE}40` }}>
                      {loading ? (
                        <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      ) : (
                        <><CheckCircle size={16} /> Verify Code</>
                      )}
                    </motion.button>

                    <div className="flex items-center justify-between">
                      <button onClick={handleResendCode} style={{ color: ORANGE, fontWeight: 800, fontSize: 13 }}>
                        Resend Code
                      </button>
                      <button onClick={() => { setAuthStep("signin"); setError(""); setSuccess(""); }} style={{ color: TS, fontWeight: 700, fontSize: 13 }}>
                        Back to Sign In
                      </button>
                    </div>
                  </motion.div>
                ) : isForgotPasswordStep ? (
                  <motion.div key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className="text-center mb-1 lg:hidden">
                      <h2 style={{ color: TP, fontSize: 20, fontWeight: 900 }}>Forgot Password</h2>
                      <p style={{ color: TS, fontSize: 13 }}>We will send a reset link to your email</p>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Email</label>
                      <AuthInput icon={Mail} type="email" value={email} onChange={setEmail} placeholder="your@email.com" name="email" autoComplete="username" onKeyDown={e => e.key === "Enter" && handleResetPassword()} />
                    </motion.div>

                    {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>{error}</motion.div>}
                    {success && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: 13 }}><CheckCircle size={14} />{success}</motion.div>}

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${ORANGE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={handleResetPassword} disabled={loading}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: loading ? "#333" : `linear-gradient(135deg, ${ORANGE}, #ea6b00)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${ORANGE}40` }}>
                      {loading ? (
                        <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      ) : (
                        <><Mail size={15} /> Send Reset Link</>
                      )}
                    </motion.button>

                    <p className="text-center" style={{ fontSize: 14, color: TS }}>
                      Remembered your password?{" "}
                      <button onClick={() => { setAuthStep("signin"); setError(""); setSuccess(""); }} style={{ color: ORANGE, fontWeight: 800 }}>Back to Sign In</button>
                    </p>
                  </motion.div>
                ) : isUpdatePasswordStep ? (
                  <motion.div key="update-password" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className="text-center mb-1 lg:hidden">
                      <h2 style={{ color: TP, fontSize: 20, fontWeight: 900 }}>Set New Password</h2>
                      <p style={{ color: TS, fontSize: 13 }}>Choose a new secure password</p>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>New Password</label>
                      <AuthInput icon={Lock} type={showPassword ? "text" : "password"} value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters"
                        name="new-password" autoComplete="new-password"
                        rightElement={<button type="button" onClick={() => setShowPw(!showPassword)} style={{ color: TS }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <label style={{ color: TS, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Confirm New Password</label>
                      <AuthInput icon={Lock} type="password" value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Re-enter new password"
                        name="confirm-new-password" autoComplete="new-password"
                        onKeyDown={e => e.key === "Enter" && handleUpdatePassword()} />
                    </motion.div>

                    {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>{error}</motion.div>}
                    {success && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: 13 }}><CheckCircle size={14} />{success}</motion.div>}

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${BLUE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={handleUpdatePassword} disabled={loading}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: loading ? "#333" : `linear-gradient(135deg, ${BLUE}, #1d4ed8)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${BLUE}40` }}>
                      {loading ? (
                        <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      ) : (
                        <><CheckCircle size={16} /> Update Password</>
                      )}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="reset-sent" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className="text-center py-4">
                      <motion.div
                        className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: [0.8, 1.06, 1], opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <CheckCircle size={30} color="#4ade80" />
                      </motion.div>
                      <h3 style={{ color: TP, fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Reset Link Sent</h3>
                      <p style={{ color: TS, fontSize: 14 }}>
                        We sent a password reset link to <span style={{ color: ORANGE, fontWeight: 700 }}>{email}</span>.
                      </p>
                    </div>

                    <motion.button whileHover={{ scale: 1.02, boxShadow: `0 12px 32px ${ORANGE}50` }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setAuthStep("signin"); setError(""); setSuccess(""); }}
                      className="w-full rounded-2xl py-4 text-white flex items-center justify-center gap-2"
                      style={{ background: `linear-gradient(135deg, ${ORANGE}, #ea6b00)`, fontSize: 15, fontWeight: 800, boxShadow: `0 8px 24px ${ORANGE}40` }}>
                      <Play size={14} fill="white" /> Back to Sign In
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Bottom note */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-center mt-5" style={{ color: TS, fontSize: 11 }}>
              Payment first policy · GCash/Bank Transfer only
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}
