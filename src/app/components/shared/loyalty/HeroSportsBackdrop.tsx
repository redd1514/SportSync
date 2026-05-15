import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MARQUEE_ITEMS } from '../../user/UserHomeComponents';

const DISPLAY_TIME = 12000;
const TRANSITION_TIME = 1800;
const IMAGE_OPACITY = 0.12;

export function HeroSportsBackdrop() {
  const slides = MARQUEE_ITEMS;
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentIndex = activeIndexRef.current;
      const nextIndex = (currentIndex + 1) % slides.length;

      setPreviousIndex(currentIndex);
      setActiveIndex(nextIndex);
    }, DISPLAY_TIME);

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    if (previousIndex === null) return;

    const timeout = window.setTimeout(() => {
      setPreviousIndex(null);
    }, TRANSITION_TIME);

    return () => window.clearTimeout(timeout);
  }, [previousIndex]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {slides.map((slide, i) => {
        const isActive = i === activeIndex;
        const isPrevious = i === previousIndex;
        const isVisible = isActive || isPrevious;

        return (
          <motion.img
            key={`${slide.src}-${i}`}
            src={slide.src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={false}
            animate={{ opacity: isActive ? IMAGE_OPACITY : 0 }}
            transition={{
              duration: TRANSITION_TIME / 1000,
              ease: 'easeInOut',
            }}
            style={{
              objectPosition: 'center 35%',
              zIndex: isActive ? 2 : isPrevious ? 1 : 0,
              visibility: isVisible ? 'visible' : 'hidden',
            }}
          />
        );
      })}

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(249,115,22,0.02) 0%, transparent 40%, rgba(37,99,235,0.01) 75%, transparent 100%)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(15,15,15,0.6) 0%, rgba(10,10,10,0.75) 40%, rgba(5,5,5,0.92) 70%, #000000 95%)',
        }}
      />

      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/60"
        style={{ zIndex: 1 }}
      />

      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 0.5px, transparent 0.5px)',
          backgroundSize: '40px 40px',
          zIndex: 0,
          opacity: 0.08,
        }}
      />
    </div>
  );
}
