import { motion, AnimatePresence } from "motion/react";
import { X, CalendarDays, CheckCircle, Users, Wind, Zap, Shield, Layers, Clock, MapPin } from "lucide-react";
import { SportIcon, getSportColor, getSportBg } from "./SportIcons";
import { RATE_CARD } from "./sportsData";

const SPORT_INFO: Record<string, {
  description: string;
  features: string[];
  priceLabel: string;
  courts: string;
  image: string;
  longDesc: string;
}> = {
  Basketball: {
    description: "1 full-size regulation hardwood court — perfect for 5v5 games, scrimmages, and training.",
    longDesc: "Our basketball court features professional hardwood flooring, proper boundary markings, backboards, and arena-style LED lighting. Whether you're running drills, a pickup game, or a tournament — JRC delivers. Lights, aircon, scoreboard, and ball rental are available as optional add-ons.",
    features: ["1 full-size regulation court", "Ball rental ₱100", "Aircon available +₱1,500/hr", "Scoreboard +₱300"],
    priceLabel: "From ₱450/hr",
    courts: "1 Court",
    image: "https://images.unsplash.com/photo-1741940513798-4ce04b95ffda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXNrZXRiYWxsJTIwY291cnQlMjBhY3Rpb24lMjBkcmFtYXRpYyUyMGxpZ2h0aW5nfGVufDF8fHx8MTc2OTk1NTE4Mnww&ixlib=rb-4.1.0&q=80&w=800",
  },
  Volleyball: {
    description: "1 indoor volleyball court with professional nets, poles, and non-slip flooring.",
    longDesc: "Spike, set, and serve on our indoor volleyball court. Equipped with professional-grade nets, poles, and non-slip flooring — perfect for competitive leagues, casual play, or team training. Great for groups of 6 to 12 players. Lights, aircon, scoreboard and ball rental available as add-ons.",
    features: ["1 full volleyball court", "Nets & poles included", "Ball rental ₱100", "Aircon available +₱1,500/hr"],
    priceLabel: "From ₱450/hr",
    courts: "1 Court",
    image: "https://images.unsplash.com/photo-1513028738826-f000cded30a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2b2xsZXliYWxsJTIwcGxheWVyJTIwc3Bpa2luZyUyMGJhbGwlMjBpbmRvb3J8ZW58MXx8fHwxNzY5OTU1MTgyfDA&ixlib=rb-4.1.0&q=80&w=800",
  },
  Badminton: {
    description: "3 courts with excellent lighting, ventilation, and equipment — JRC's most popular sport!",
    longDesc: "Badminton is JRC's busiest sport! Our 3 courts offer top-tier conditions with professional nets, proper lighting, and smooth flooring. Whether you're a beginner or an advanced player, we have a court for you. Rackets and shuttlecocks are available for rent or purchase on-site.",
    features: ["3 courts available", "Racket rental ₱50", "Shuttlecock (Feather) ₱50", "Shuttlecock (Plastic) rent ₱50"],
    priceLabel: "₱300/hr flat",
    courts: "3 Courts",
    image: "https://images.unsplash.com/photo-1617696618050-b0fef0c666af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWRtaW50b24lMjByYWNrZXQlMjBzaHV0dGxlY29jayUyMGNvdXJ0fGVufDF8fHx8MTc2OTk1NTE4M3ww&ixlib=rb-4.1.0&q=80&w=800",
  },
  Pickleball: {
    description: "2 dedicated courts for the fastest-growing paddle sport in the Philippines!",
    longDesc: "Pickleball combines tennis, badminton, and ping-pong into one fast, addictive game. Our 2 dedicated courts feature regulation dimensions and proper net heights. Perfect for beginners — easy to learn and incredibly fun for all ages. Paddles and balls available for rent or sale on-site.",
    features: ["2 dedicated courts", "Paddle rental ₱50–100", "Ball for rent ₱50", "Ball for sale ₱100"],
    priceLabel: "₱300/hr flat",
    courts: "2 Courts",
    image: "https://images.unsplash.com/photo-1749578291886-44a514bd12a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWNrbGViYWxsJTIwZ2FtZSUyMHBhZGRsZSUyMGNvdXJ0fGVufDF8fHx8MTc2OTk1NDE4M3ww&ixlib=rb-4.1.0&q=80&w=800",
  },
  Billiards: {
    description: "4 premium billiard tables in a comfortable lounge setting — cues and balls included.",
    longDesc: "Unwind or compete on our 4 premium billiard tables set in a comfortable lounge area — perfect for socializing and friendly competition. All cues, balls, and chalk are provided at no extra cost. Our most social sport at just ₱100/hr, open all week from 7AM to 12MN.",
    features: ["4 premium tables", "Cues & balls included", "Chalk provided", "Open 7AM–12MN daily"],
    priceLabel: "₱100/hr flat",
    courts: "4 Tables",
    image: "https://images.unsplash.com/photo-1556329754-9420aeb663c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaWxsaWFyZHMlMjBwb29sJTIwdGFibGUlMjBiYWxscyUyMGN1ZXxlbnwxfHx8fDE3Njk5NTUxODJ8MA&ixlib=rb-4.1.0&q=80&w=800",
  },
  "Table Tennis": {
    description: "1 professional table — the most affordable option at JRC. Paddles and balls included!",
    longDesc: "Table tennis is perfect for everyone — quick reflexes, fun rallies, no experience needed. Our dedicated table features proper lighting and ample space. All paddles and balls are included in the rental at just ₱100/hr. Great for families, friends, and competitive players. Open all week 7AM to 12MN.",
    features: ["1 professional table", "Paddles & balls included", "Most affordable sport", "Open 7AM–12MN daily"],
    priceLabel: "₱100/hr flat",
    courts: "1 Table",
    image: "https://images.unsplash.com/photo-1708268418738-4863baa9cf72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWJsZSUyMHRlbm5pcyUyMHBpbmclMjBwb25nJTIwYWN0aW9uJTIwbWF0Y2h8ZW58MXx8fHwxNzY5OTU1MTgzfDA&ixlib=rb-4.1.0&q=80&w=800",
  },
};

const featureIcons = [CheckCircle, Users, Wind, Shield, Layers, Zap];

interface SportDetailModalProps {
  sport: string | null;
  onClose: () => void;
  onBook: () => void;
}

export function SportDetailModal({ sport, onClose, onBook }: SportDetailModalProps) {
  if (!sport) return null;
  const info = SPORT_INFO[sport];
  if (!info) return null;
  const color = getSportColor(sport);
  const rateRows = RATE_CARD[sport] || [];

  return (
    <AnimatePresence>
      {sport && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#1A1A1A] sm:rounded-3xl rounded-t-3xl overflow-hidden border border-white/10 max-h-[90vh] flex flex-col"
          >
            {/* Hero Image */}
            <div className="relative h-[180px] flex-shrink-0">
              <img src={info.image} alt={sport} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-black/40 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
              >
                <X size={17} className="text-white" />
              </button>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}25`, border: `1px solid ${color}60` }}
                >
                  <SportIcon sport={sport} size={22} color={color} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-white font-black" style={{ fontSize: 20 }}>{sport}</h2>
                  <div className="flex items-center gap-2">
                    <span style={{ color, fontSize: 13, fontWeight: 700 }}>{info.priceLabel}</span>
                    <span className="text-gray-500" style={{ fontSize: 12 }}>· {info.courts}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
              <p className="text-gray-300 leading-relaxed mb-4" style={{ fontSize: 14 }}>
                {info.longDesc}
              </p>

              {/* Features */}
              <div className="mb-4">
                <p className="text-white font-black mb-2.5" style={{ fontSize: 13 }}>What's Included / Available</p>
                <div className="grid grid-cols-2 gap-2">
                  {info.features.map((feat, i) => {
                    const Icon = featureIcons[i % featureIcons.length];
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-xl p-2.5"
                        style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}
                      >
                        <Icon size={13} style={{ color, flexShrink: 0 }} />
                        <span className="text-gray-300" style={{ fontSize: 11, fontWeight: 600 }}>{feat}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rate Card */}
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock size={13} style={{ color }} />
                  <p className="font-black uppercase tracking-widest" style={{ fontSize: 10, color }}>2026 Rental Rates</p>
                </div>
                <div className="space-y-2">
                  {rateRows.map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-gray-400" style={{ fontSize: 12 }}>{row.label}</span>
                      <span className="font-black" style={{ fontSize: 12, color }}>{row.rate}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy note */}
              <div className="flex items-start gap-2 bg-[#111] rounded-xl p-3 border border-white/5">
                <MapPin size={13} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-500" style={{ fontSize: 11 }}>
                  GCash / Bank Transfer only. Payment first — strictly no cancellation. Reservations via Facebook page.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 pb-6 pt-3 border-t border-white/5 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { onClose(); onBook(); }}
                className="w-full text-white rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 8px 24px ${color}40`,
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                <CalendarDays size={19} />
                Book {sport} Now
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}