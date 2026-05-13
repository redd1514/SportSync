// ── JRC Ballpark 2026 Rental Rates (effective Jan 19, 2026) ──────────────────

export interface SportInfo {
  name: string;
  courts: string;
  color: string;
  /** Starting / base price label shown on cards */
  priceLabel: string;
  image: string;
}

export const SPORTS_INFO: SportInfo[] = [
  {
    name: "Basketball",
    courts: "1 court",
    color: "#FF8C00",
    priceLabel: "From ₱450/hr",
    image: "/assets/basketball.jpg",
  },
  {
    name: "Volleyball",
    courts: "1 court",
    color: "#0047AB",
    priceLabel: "From ₱450/hr",
    image: "/assets/volleyball.jpg",
  },
  {
    name: "Badminton",
    courts: "3 courts",
    color: "#22c55e",
    priceLabel: "₱300/hr",
    image: "/assets/badminton.jpg",
  },
  {
    name: "Pickleball",
    courts: "3 courts",
    color: "#a855f7",
    priceLabel: "₱300/hr",
    image: "/assets/pickleball.jpg",
  },
  {
    name: "Billiards",
    courts: "4 tables",
    color: "#ec4899",
    priceLabel: "₱100/hr",
    image: "/assets/billiards.jpg",
  },
  {
    name: "Table Tennis",
    courts: "4 tables",
    color: "#06b6d4",
    priceLabel: "₱100/hr",
    image: "/assets/pingpong.jpg",
  },
];

// ── Pricing logic ─────────────────────────────────────────────────────────────
// Basketball & Volleyball:
//   Weekdays  7AM-5PM  : ₱450  |  5PM-12MN : ₱750
//   Weekends  7AM-5PM  : ₱550  |  5PM-12MN : ₱850
//   (Lights fee: add ₱300 when applicable)
// Pickleball & Badminton : ₱300/hr flat (all days, 7AM-12MN)
// Billiards & Table Tennis: ₱100/hr flat (all days, 7AM-12MN)

export function getDynamicPrice(sport: string, date: Date, timeSlot: string): number {
  const day = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  // Parse hour from slot string like "08:00 AM", "05:00 PM"
  const [timePart, period] = timeSlot.split(" ");
  const [hourStr] = timePart.split(":");
  let hour = parseInt(hourStr, 10);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const isEvening = hour >= 17; // 5 PM or later

  if (sport === "Basketball" || sport === "Volleyball") {
    if (isWeekend) return isEvening ? 850 : 550;
    return isEvening ? 750 : 450;
  }
  if (sport === "Pickleball" || sport === "Badminton") return 300;
  if (sport === "Billiards" || sport === "Table Tennis") return 100;
  return 300;
}

/** Formatted rate card rows shown in booking confirm / sport detail */
export const RATE_CARD: Record<string, { label: string; rate: string }[]> = {
  Basketball: [
    { label: "Weekday 7AM–5PM", rate: "₱450/hr" },
    { label: "Weekday 5PM–12MN", rate: "₱750/hr" },
    { label: "Weekend 7AM–5PM", rate: "₱550/hr" },
    { label: "Weekend 5PM–12MN", rate: "₱850/hr" },
    { label: "Lights fee", rate: "+₱300" },
    { label: "Ball rental", rate: "₱100" },
    { label: "Scoreboard", rate: "+₱300" },
    { label: "Aircon", rate: "+₱1,500/hr" },
  ],
  Volleyball: [
    { label: "Weekday 7AM–5PM", rate: "₱450/hr" },
    { label: "Weekday 5PM–12MN", rate: "₱750/hr" },
    { label: "Weekend 7AM–5PM", rate: "₱550/hr" },
    { label: "Weekend 5PM–12MN", rate: "₱850/hr" },
    { label: "Lights fee", rate: "+₱300" },
    { label: "Ball rental", rate: "₱100" },
    { label: "Scoreboard", rate: "+₱300" },
    { label: "Aircon", rate: "+₱1,500/hr" },
  ],
  Badminton: [
    { label: "All days 7AM–12MN", rate: "₱300/hr" },
    { label: "Racket rent", rate: "₱50" },
    { label: "Shuttlecock (Feather) sale", rate: "₱50" },
    { label: "Shuttlecock (Plastic) rent", rate: "₱50" },
  ],
  Pickleball: [
    { label: "All days 7AM–12MN", rate: "₱300/hr" },
    { label: "Paddle rent", rate: "₱50–100" },
    { label: "Ball for rent", rate: "₱50" },
    { label: "Ball for sale", rate: "₱100" },
  ],
  Billiards: [
    { label: "All days 7AM–12MN", rate: "₱100/hr" },
  ],
  "Table Tennis": [
    { label: "All days 7AM–12MN", rate: "₱100/hr" },
  ],
};

/** All 13 physical courts/tables at JRC Ballpark */
export const ALL_COURTS = [
  // Basketball
  { id: "BASK-1", name: "Basketball 1", sport: "Basketball" },
  // Volleyball
  { id: "VOLL-1", name: "Volleyball 1", sport: "Volleyball" },
  // Badminton
  { id: "BADM-1", name: "Badminton 1", sport: "Badminton" },
  { id: "BADM-2", name: "Badminton 2", sport: "Badminton" },
  { id: "BADM-3", name: "Badminton 3", sport: "Badminton" },
  // Pickleball
  { id: "PICK-1", name: "Pickleball 1", sport: "Pickleball" },
  { id: "PICK-2", name: "Pickleball 2", sport: "Pickleball" },
  { id: "PICK-3", name: "Pickleball 3", sport: "Pickleball" },
  // Billiards
  { id: "BILL-1", name: "Billiards 1", sport: "Billiards" },
  { id: "BILL-2", name: "Billiards 2", sport: "Billiards" },
  { id: "BILL-3", name: "Billiards 3", sport: "Billiards" },
  { id: "BILL-4", name: "Billiards 4", sport: "Billiards" },
  // Table Tennis
  { id: "TTNS-1", name: "Table Tennis 1", sport: "Table Tennis" },
  { id: "TTNS-2", name: "Table Tennis 2", sport: "Table Tennis" },
  { id: "TTNS-3", name: "Table Tennis 3", sport: "Table Tennis" },
  { id: "TTNS-4", name: "Table Tennis 4", sport: "Table Tennis" },
];

/** Add-on fees per sport shown as checkboxes on booking confirm */
export interface AddOn {
  id: string;
  label: string;
  price: number;
  note?: string;
  perHour?: boolean; // if true, price is multiplied by session duration
}

/** Treat as hourly add-on when flag is set or note implies per-hour (KV-loaded add-ons may omit `perHour`). */
export function isAddonPerHourPricing(a: Pick<AddOn, 'perHour' | 'note'>): boolean {
  if (a.perHour === true) return true;
  const n = (a.note || '').toLowerCase();
  return /\bper\s*hour\b|\b\/\s*hr\b|\bhourly\b|\bper\s*hr\b/.test(n);
}

export function formatAddonLinePeso(a: AddOn, durationHours: number): { left: string; amount: number } {
  const hourly = isAddonPerHourPricing(a);
  const amount = hourly ? a.price * durationHours : a.price;
  const left = hourly
    ? `${a.label} (₱${a.price.toLocaleString()}/hr × ${durationHours}h = ₱${amount.toLocaleString()})`
    : `${a.label} (flat ₱${a.price.toLocaleString()})`;
  return { left, amount };
}

export const SPORT_ADDONS: Record<string, AddOn[]> = {
  Basketball: [
    { id: "lights",     label: "Lights",      price: 300,  note: "Evening sessions" },
    { id: "aircon",     label: "Aircon",       price: 1500, note: "per hour", perHour: true },
    { id: "ball",       label: "Ball Rental",  price: 100 },
    { id: "scoreboard", label: "Scoreboard",   price: 300 },
  ],
  Volleyball: [
    { id: "lights",     label: "Lights",      price: 300,  note: "Evening sessions" },
    { id: "aircon",     label: "Aircon",       price: 1500, note: "per hour", perHour: true },
    { id: "ball",       label: "Ball Rental",  price: 100 },
    { id: "scoreboard", label: "Scoreboard",   price: 300 },
  ],
  Badminton: [
    { id: "racket",      label: "Racket Rental",              price: 50  },
    { id: "shuttle_f",   label: "Shuttlecock (Feather, sale)", price: 50  },
    { id: "shuttle_p",   label: "Shuttlecock (Plastic, rent)", price: 50  },
  ],
  Pickleball: [
    { id: "paddle",   label: "Paddle Rental",  price: 75,  note: "₱50–100" },
    { id: "ball_r",   label: "Ball (rent)",     price: 50  },
    { id: "ball_s",   label: "Ball (sale)",     price: 100 },
  ],
  Billiards: [],
  "Table Tennis": [],
};