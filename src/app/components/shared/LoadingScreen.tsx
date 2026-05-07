import React from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';

interface LoadingScreenProps {
  label?: string;
  sub?: string;
  accentColor?: string;
}

export function LoadingScreen({ label = 'Loading…', sub, accentColor = '#FF8C00' }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[260px] gap-6 select-none">
      {/* Spinner ring */}
      <div className="relative w-16 h-16">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `3px solid ${accentColor}18` }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `3px solid transparent`, borderTopColor: accentColor, borderRightColor: `${accentColor}60` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner logo dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`, boxShadow: `0 4px 14px ${accentColor}50` }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Shield size={13} className="text-white" />
          </motion.div>
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-1">
        <motion.p
          className="text-white font-black"
          style={{ fontSize: 14 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {label}
        </motion.p>
        {sub && (
          <motion.p
            className="text-gray-500"
            style={{ fontSize: 12 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {sub}
          </motion.p>
        )}
      </div>

      {/* Dot row */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accentColor }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/** Inline card variant for dashboard sections */
export function SectionLoader({ label = 'Loading…', accentColor = '#FF8C00' }: { label?: string; accentColor?: string }) {
  return (
    <div className="flex items-center gap-3 py-6 justify-center">
      <motion.div
        className="w-5 h-5 rounded-full border-2"
        style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-gray-500 font-black" style={{ fontSize: 13 }}>{label}</p>
    </div>
  );
}
