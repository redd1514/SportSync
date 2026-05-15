import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomDateTimePickerProps {
  selectedDate: string;
  selectedTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  minDate?: string;
  accentColor?: string;
  availableTimes?: string[];
  startHour?: number;
  endHour?: number;
  sessionDurationHours?: number;
}

const BG_CARD  = '#1C1E27';
const BG_DEEP  = '#252836';
const BG_INPUT = '#2E3244';
const BORDER   = 'rgba(255,255,255,0.07)';
const BORDER_HL= 'rgba(255,255,255,0.12)';
const TEXT     = '#EAEDF4';
const MUTED    = '#8891A8';

export function CustomDateTimePicker({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  minDate,
  accentColor = '#F97316',
  availableTimes,
  startHour = 7,
  endHour = 23,
  sessionDurationHours = 1,
}: CustomDateTimePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return new Date(selectedDate + 'T00:00:00');
    return new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  const daysInMonth = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const daysCount = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysCount; i++) days.push(i);
    return days;
  }, [viewMonth]);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayLabels  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const handleDayClick = (day: number) => {
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (minDate && dateStr < minDate) return;
    onDateChange(dateStr);
    setShowDatePicker(false);
  };

  const prevMonth = () => {
    setSlideDir('right');
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setSlideDir('left');
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'Select time';
    const [h] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:00 ${ampm}`;
  };

  const selectedDay = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;
  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() &&
      viewMonth.getMonth() === today.getMonth() &&
      viewMonth.getFullYear() === today.getFullYear();
  };
  const isDayDisabled = (day: number) => {
    if (!minDate) return false;
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return dateStr < minDate;
  };

  const monthKey = `${viewMonth.getFullYear()}-${viewMonth.getMonth()}`;
  const latestStartHour = Math.max(startHour, Math.floor(endHour - sessionDurationHours));
  const timeHours = Array.from({ length: latestStartHour - startHour + 1 }, (_, i) => i + startHour);

  return (
    <div className="space-y-3">
      {/* ── Date Picker ── */}
      <div className="relative">
        <label style={{ color: MUTED, fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Date
        </label>
        <button
          onClick={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
          className="w-full rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-200 focus:outline-none"
          style={{
            background: showDatePicker ? BG_INPUT : BG_DEEP,
            border: `1.5px solid ${showDatePicker ? accentColor + '55' : BORDER_HL}`,
            color: selectedDate ? TEXT : MUTED,
            fontSize: 13,
            boxShadow: showDatePicker ? `0 0 0 3px ${accentColor}12` : 'none',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={14} style={{ color: showDatePicker ? accentColor : MUTED, flexShrink: 0 }} />
            <span>{formatDate(selectedDate)}</span>
          </div>
          <motion.div animate={{ rotate: showDatePicker ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={14} style={{ color: MUTED, transform: 'rotate(90deg)' }} />
          </motion.div>
        </button>

        <AnimatePresence>
          {showDatePicker && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit ={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.4,0,0.2,1] }}
              className="absolute top-full left-0 mt-2 z-50 w-full rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: BG_CARD, border: `1px solid ${BORDER_HL}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${BORDER_HL}` }}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                <button
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/8"
                  style={{ color: MUTED }}
                >
                  <ChevronLeft size={15} />
                </button>
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>
                  {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/8"
                  style={{ color: MUTED }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="p-3">
                {/* Day labels */}
                <div className="grid grid-cols-7 mb-1">
                  {dayLabels.map(label => (
                    <div key={label} className="text-center font-black" style={{ fontSize: 10, color: '#4D5568', padding: '4px 0' }}>
                      {label}
                    </div>
                  ))}
                </div>

                {/* Days grid — animated month change */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={monthKey}
                    initial={{ opacity: 0, x: slideDir === 'left' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit ={{ opacity: 0, x: slideDir === 'left' ? -20 : 20 }}
                    transition={{ duration: 0.2, ease: [0.4,0,0.2,1] }}
                    className="grid grid-cols-7 gap-0.5"
                  >
                    {daysInMonth.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} />;
                      const isSelected  = day === selectedDay &&
                        selectedDate?.startsWith(`${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,'0')}`);
                      const isTodayDay  = isToday(day);
                      const isDisabled  = isDayDisabled(day);
                      return (
                        <motion.button
                          key={day}
                          onClick={() => !isDisabled && handleDayClick(day)}
                          disabled={isDisabled}
                          whileHover={!isDisabled && !isSelected ? { scale: 1.1 } : {}}
                          whileTap={!isDisabled ? { scale: 0.92 } : {}}
                          className="aspect-square rounded-lg flex items-center justify-center font-black transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          style={{
                            fontSize: 12,
                            backgroundColor: isSelected
                              ? accentColor
                              : isTodayDay
                              ? `${accentColor}18`
                              : 'transparent',
                            color: isSelected
                              ? '#fff'
                              : isTodayDay
                              ? accentColor
                              : MUTED,
                            border: isTodayDay && !isSelected
                              ? `1px solid ${accentColor}35`
                              : '1px solid transparent',
                            boxShadow: isSelected ? `0 4px 12px ${accentColor}50` : 'none',
                          }}
                        >
                          {day}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Time Picker ── */}
      <div className="relative">
        <label style={{ color: MUTED, fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Start Time
        </label>
        <button
          onClick={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
          className="w-full rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-200 focus:outline-none"
          style={{
            background: showTimePicker ? BG_INPUT : BG_DEEP,
            border: `1.5px solid ${showTimePicker ? accentColor + '55' : BORDER_HL}`,
            color: selectedTime ? TEXT : MUTED,
            fontSize: 13,
            boxShadow: showTimePicker ? `0 0 0 3px ${accentColor}12` : 'none',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Clock size={14} style={{ color: showTimePicker ? accentColor : MUTED, flexShrink: 0 }} />
            <span>{formatTime(selectedTime)}</span>
          </div>
          <motion.div animate={{ rotate: showTimePicker ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={14} style={{ color: MUTED, transform: 'rotate(90deg)' }} />
          </motion.div>
        </button>

        <AnimatePresence>
          {showTimePicker && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit ={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.4,0,0.2,1] }}
              className="absolute top-full left-0 mt-2 z-50 w-full rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: BG_CARD, border: `1px solid ${BORDER_HL}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${BORDER_HL}` }}
            >
              <div className="p-3 border-b" style={{ borderColor: BORDER }}>
                <p style={{ color: TEXT, fontSize: 12, fontWeight: 800 }}>Select Start Time</p>
                <p style={{ color: MUTED, fontSize: 11 }}>
                  {sessionDurationHours > 1
                    ? `${sessionDurationHours}-hour booking. Latest start is ${latestStartHour % 12 || 12}:00 ${latestStartHour >= 12 ? 'PM' : 'AM'}`
                    : 'Last booking ends at 11:00 PM'}
                </p>
              </div>
              <div className="p-3 max-h-52 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-3 gap-1.5">
                  {timeHours.map(hour => {
                    const timeStr   = `${String(hour).padStart(2,'0')}:00`;
                    const isSelected = timeStr === selectedTime;
                    const isAvailable = !availableTimes || availableTimes.includes(timeStr);
                    const displayH  = hour % 12 || 12;
                    const ampm      = hour >= 12 ? 'PM' : 'AM';
                    return (
                      <motion.button
                        key={hour}
                        onClick={() => { if(isAvailable) { onTimeChange(timeStr); setShowTimePicker(false); } }}
                        disabled={!isAvailable}
                        whileHover={isAvailable && !isSelected ? { scale: 1.04 } : {}}
                        whileTap={isAvailable ? { scale: 0.95 } : {}}
                        className={`py-2.5 rounded-xl font-black transition-all ${!isAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                        style={{
                          fontSize: 12,
                          backgroundColor: isSelected ? accentColor : BG_DEEP,
                          color: isSelected ? '#fff' : (isAvailable ? MUTED : '#555'),
                          border: `1px solid ${isSelected ? accentColor : BORDER}`,
                          boxShadow: isSelected ? `0 4px 12px ${accentColor}45` : 'none',
                        }}
                      >
                        {displayH}:00 {ampm}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click outside to close */}
      {(showDatePicker || showTimePicker) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowDatePicker(false); setShowTimePicker(false); }}
        />
      )}
    </div>
  );
}
