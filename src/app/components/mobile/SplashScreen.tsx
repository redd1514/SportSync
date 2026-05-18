import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { APP_LOGO_SRC } from "../../constants/branding";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [showTagline, setShowTagline] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return p + 1.8;
      });
    }, 40);

    // Show tagline after logo
    const taglineTimer = setTimeout(() => setShowTagline(true), 900);

    // Start exit animation
    const exitTimer = setTimeout(() => setExiting(true), 2400);

    // Complete
    const completeTimer = setTimeout(() => onComplete(), 2800);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(taglineTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!exiting ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0D0D0D] overflow-hidden"
        >
          {/* Ambient glow blobs */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute w-[300px] h-[300px] rounded-full bg-[#FF8C00]/18 blur-[100px]"
              style={{ top: "10%", left: "50%", transform: "translateX(-50%)" }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-[200px] h-[200px] rounded-full bg-[#0047AB]/15 blur-[80px]"
              style={{ bottom: "20%", left: "20%" }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
            <motion.div
              className="absolute w-[150px] h-[150px] rounded-full bg-[#FF8C00]/10 blur-[60px]"
              style={{ bottom: "30%", right: "10%" }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
          </div>

          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle, #FF8C00 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo ring + image */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
              className="relative mb-6"
            >
              {/* Rotating ring */}
              <motion.div
                className="absolute inset-[-12px] rounded-full border-2 border-dashed border-[#FF8C00]/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              {/* Outer glow ring */}
              <div className="absolute inset-[-4px] rounded-full bg-[#FF8C00]/20 blur-md" />
              {/* Logo */}
              <div className="relative w-24 h-24 rounded-full border-4 border-[#FF8C00] overflow-hidden shadow-2xl shadow-orange-500/40">
                <img src={APP_LOGO_SRC} alt="JRC SportSync" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            {/* App name */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center mb-2"
            >
              <h1 className="text-white font-black italic tracking-widest" style={{ fontSize: 36 }}>
                JRC{" "}
                <span style={{ color: "#FF8C00" }} className="drop-shadow-[0_0_20px_rgba(255,140,0,0.6)]">
                  Sport
                </span>
                <span style={{ color: "#0047AB" }} className="drop-shadow-[0_0_20px_rgba(0,71,171,0.6)]">
                  Sync
                </span>
              </h1>
            </motion.div>

            {/* Tagline */}
            <AnimatePresence>
              {showTagline && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-gray-400 text-sm tracking-widest uppercase mb-12"
                >
                  Where Every Game Comes to Life
                </motion.p>
              )}
            </AnimatePresence>

            {/* Loading bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="w-48 flex flex-col items-center gap-3"
            >
              <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FF8C00] to-[#FFB347] rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-[#FF8C00]"
                />
                <span className="text-xs text-gray-500 tracking-widest uppercase">
                  Loading
                </span>
              </div>
            </motion.div>
          </div>

          {/* Bottom brand text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1 }}
            className="absolute bottom-8 text-xs text-gray-600 tracking-[0.3em] uppercase"
          >
            JRC Ballpark · Valenzuela City
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}