import React from "react";

interface SportIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Basketball - classic orange ball with seam lines
export function BasketballIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.9 4.9C7 7 8 9.4 8 12s-1 5-3.1 7.1" />
      <path d="M19.1 4.9C17 7 16 9.4 16 12s1 5 3.1 7.1" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

// Volleyball - ball with curved seam lines
export function VolleyballIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2c2.4 3.5 2.4 8.5 0 12" />
      <path d="M12 2c-2.4 3.5-2.4 8.5 0 12" />
      <path d="M3.3 7c3.7 1.5 8.4 1.5 12 0" />
      <path d="M3.3 17c3.7-1.5 8.4-1.5 12 0" />
    </svg>
  );
}

// Badminton - racket with shuttlecock
export function BadmintonIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="14" cy="9" rx="5" ry="7" transform="rotate(35 14 9)" />
      <line x1="10.5" y1="13.5" x2="4" y2="20" />
      <circle cx="14" cy="9" r="1.5" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

// Pickleball - paddle with holes  
export function PickleballIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" rx="7" ry="7" />
      <circle cx="10" cy="7" r="1" fill={color} stroke="none" />
      <circle cx="14" cy="7" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="11" r="1" fill={color} stroke="none" />
      <line x1="12" y1="16" x2="12" y2="22" strokeWidth={strokeWidth + 1} />
    </svg>
  );
}

// Billiards - 8-ball
export function BilliardsIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.3" />
      <text x="12" y="16" textAnchor="middle" fill={color} stroke="none" fontSize="6" fontWeight="bold">8</text>
    </svg>
  );
}

// Table Tennis - paddle and ball
export function TableTennisIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: SportIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="11" r="7" fill={color} fillOpacity="0.2" />
      <line x1="14.5" y1="15" x2="21" y2="21.5" strokeWidth={strokeWidth + 1.5} />
      <circle cx="19" cy="4" r="2.5" fill={color} fillOpacity="0.6" stroke={color} />
    </svg>
  );
}

// Generic sport icon selector
export function SportIcon({ sport, size = 24, color = "currentColor", strokeWidth = 2 }: { sport: string } & SportIconProps) {
  const props = { size, color, strokeWidth };
  switch (sport) {
    case "Basketball": return <BasketballIcon {...props} />;
    case "Volleyball": return <VolleyballIcon {...props} />;
    case "Badminton": return <BadmintonIcon {...props} />;
    case "Pickleball": return <PickleballIcon {...props} />;
    case "Billiards": return <BilliardsIcon {...props} />;
    case "Table Tennis": return <TableTennisIcon {...props} />;
    default: return <BasketballIcon {...props} />;
  }
}

export function getSportColor(sport: string): string {
  switch (sport) {
    case "Basketball": return "#FF8C00";
    case "Volleyball": return "#0047AB";
    case "Badminton": return "#22c55e";
    case "Pickleball": return "#a855f7";
    case "Billiards": return "#ec4899";
    case "Table Tennis": return "#06b6d4";
    default: return "#6b7280";
  }
}

export function getSportBg(sport: string): string {
  switch (sport) {
    case "Basketball": return "#2A1F0A";
    case "Volleyball": return "#0A1525";
    case "Badminton": return "#0A1F0E";
    case "Pickleball": return "#1A0A25";
    case "Billiards": return "#250A15";
    case "Table Tennis": return "#0A1A20";
    default: return "#1A1A1A";
  }
}
