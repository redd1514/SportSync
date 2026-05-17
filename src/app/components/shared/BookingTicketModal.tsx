import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { SportIcon, getSportColor } from '../SportIcons';
import { downloadTicketQrPng } from '../../../shared/qrDownload';
import { resolveBookingTicketToken } from '../../../shared/ticketRef';

export type BookingTicketData = {
  id?: string;
  refCode?: string;
  sport: string;
  court: string;
  date: string;
  time: string;
  duration: number;
  amount: number;
  totalAmount?: number;
  downpaymentAmount?: number;
  downpaymentPercentage?: number;
  balanceDue?: number;
  status?: string;
  frontDeskInstructions?: string;
};

function formatTicketDate(date: string) {
  if (!date) return '—';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTicketTime(time: string) {
  if (!time) return '—';
  const [h] = time.split(':').map(Number);
  return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
}

export function BookingTicketModal({
  booking,
  onClose,
}: {
  booking: BookingTicketData;
  onClose: () => void;
}) {
  const { scanValue, displayCode } = resolveBookingTicketToken(booking.refCode, booking.id);
  const color = getSportColor(booking.sport);
  const [downloading, setDownloading] = useState(false);
  const totalAmount = Number(booking.totalAmount ?? booking.amount ?? 0);
  const balanceSettled = /checked|ongoing|completed/i.test(String(booking.status || ''));
  const downpaymentAmount =
    booking.downpaymentAmount != null ? Number(booking.downpaymentAmount) : null;
  const balanceDue =
    booking.balanceDue != null
      ? Number(booking.balanceDue)
      : downpaymentAmount != null
        ? Math.max(0, totalAmount - downpaymentAmount)
        : null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadTicketQrPng({
        value: scanValue,
        fileBaseName: displayCode.replace(/\s+/g, '_'),
        displayCode,
        subline: `${booking.court} · ${formatTicketDate(booking.date)}`,
      });
      toast.success('Ticket downloaded!');
    } catch {
      toast.error('Could not download ticket');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-sm overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-stretch gap-3 w-full max-w-[min(100%,22rem)] my-auto"
      >
        <motion.div
          className="w-full rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]"
          style={{ background: '#111' }}
        >
          <div
            className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4"
            style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderBottom: `1px solid ${color}30` }}
          >
            <motion.div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
              >
                <SportIcon sport={booking.sport} size={20} color={color} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-black truncate" style={{ fontSize: 17 }}>
                  {booking.sport || 'Court Booking'}
                </p>
                <p className="text-gray-400 font-medium truncate" style={{ fontSize: 12 }}>
                  {booking.court} · JRC Facility
                </p>
              </div>
            </motion.div>
            <div className="flex items-center gap-1.5">
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-black uppercase" style={{ fontSize: 9, letterSpacing: 1, color }}>
                {booking.status?.toUpperCase() || 'RESERVED'}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 space-y-3 border-b border-white/5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500 font-bold uppercase flex-shrink-0" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                Date
              </span>
              <span className="text-white font-black text-right" style={{ fontSize: 13 }}>
                {formatTicketDate(booking.date)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500 font-bold uppercase flex-shrink-0" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                Time
              </span>
              <span className="text-white font-black text-right" style={{ fontSize: 13 }}>
                {formatTicketTime(booking.time)} · {booking.duration || 1}hr
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500 font-bold uppercase flex-shrink-0" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                Total
              </span>
              <span className="font-black" style={{ fontSize: 13, color: '#FF8C00' }}>
                ₱{totalAmount.toLocaleString()}
              </span>
            </div>
            {downpaymentAmount != null && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-500 font-bold uppercase flex-shrink-0" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                  Downpayment paid
                </span>
                <span className="text-green-300 font-black" style={{ fontSize: 13 }}>
                  ₱{downpaymentAmount.toLocaleString()}
                </span>
              </div>
            )}
            {balanceDue != null && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-500 font-bold uppercase flex-shrink-0" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                  {balanceSettled ? 'Balance paid' : 'Balance due'}
                </span>
                <span className={`${balanceSettled ? 'text-green-300' : 'text-white'} font-black`} style={{ fontSize: 13 }}>
                  {balanceSettled ? 'Paid' : `₱${balanceDue.toLocaleString()}`}
                </span>
              </div>
            )}
          </div>

          <div className="relative flex items-center">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/95 -ml-2.5 sm:-ml-3 flex-shrink-0" />
            <div className="flex-1 border-t-2 border-dashed border-white/10" />
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/95 -mr-2.5 sm:-mr-3 flex-shrink-0" />
          </div>

          <div className="px-4 sm:px-6 pt-4 pb-5 sm:pb-6 flex flex-col items-center">
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl shadow-lg mb-3">
              <QRCodeSVG value={scanValue} size={128} level="H" includeMargin={false} className="w-[min(72vw,8.5rem)] h-auto" />
            </div>
            <p className="text-gray-500 font-bold uppercase mb-1" style={{ fontSize: 9, letterSpacing: 1 }}>
              Show at front desk
            </p>
            <p className="text-white font-black text-center break-all" style={{ fontSize: 14, letterSpacing: 0.5 }}>
              {displayCode}
            </p>
          </div>

          <div
            className="px-4 py-2.5 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <p className="text-gray-700 font-bold uppercase" style={{ fontSize: 8, letterSpacing: 1.2 }}>
              JRC Sports Complex · Valenzuela City
            </p>
          </div>
        </motion.div>

        {booking.frontDeskInstructions && (
          <div className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.24)' }}>
            <p className="text-green-300 font-black" style={{ fontSize: 12 }}>Front desk instructions</p>
            <p className="mt-1 text-gray-300" style={{ fontSize: 11, lineHeight: 1.5 }}>{booking.frontDeskInstructions}</p>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3 w-full">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownload()}
            className="flex-1 bg-white text-black py-3 sm:py-3.5 rounded-2xl font-black text-sm hover:bg-gray-100 transition-colors disabled:opacity-60"
          >
            {downloading ? 'Preparing…' : 'Download Ticket'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
