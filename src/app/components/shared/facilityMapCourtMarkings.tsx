import type { CourtBlock } from '../../contexts/FacilityMapContext';

function sportVisualKind(sport: string) {
  const s = sport.toLowerCase();
  if (s.includes('basket')) return 'basketball';
  if (s.includes('volley')) return 'volleyball';
  if (s.includes('badminton')) return 'badminton';
  if (s.includes('pickle')) return 'pickleball';
  if (s.includes('table') || s.includes('tennis')) return 'table_tennis';
  if (s.includes('billiard') || s.includes('pool')) return 'billiards';
  return 'custom';
}

type CourtGeom = {
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
  pad: number;
  line: string;
  thin: number;
  opacity: number;
  netVertical: boolean;
};

function courtGeom(block: CourtBlock, locked: boolean): CourtGeom {
  const { x, y, width: w, height: h } = block;
  return {
    x, y, w, h,
    cx: x + w / 2,
    cy: y + h / 2,
    pad: Math.max(8, Math.min(w, h) * 0.08),
    line: locked ? '#9ca3af' : '#ffffff',
    thin: Math.max(1, Math.min(w, h) * 0.01),
    opacity: locked ? 0.1 : 0.22,
    netVertical: w >= h,
  };
}

function boundaryRect(g: CourtGeom) {
  const { x, y, w, h, pad, line, thin } = g;
  return (
    <rect
      x={x + pad}
      y={y + pad}
      width={w - pad * 2}
      height={h - pad * 2}
      rx="3"
      fill="none"
      stroke={line}
      strokeWidth={thin}
    />
  );
}

/** Volleyball: bold net + dashed attack (3 m) lines on each side. */
function VolleyballMarkings(g: CourtGeom) {
  const { x, y, w, h, cx, cy, pad, line, thin, opacity, netVertical } = g;
  const innerL = netVertical ? w - pad * 2 : h - pad * 2;
  const attackOff = innerL * 0.22;
  const netSw = thin + 1.4;

  return (
    <g pointerEvents="none" opacity={opacity}>
      {boundaryRect(g)}
      {netVertical ? (
        <>
          <line x1={cx} y1={y + pad} x2={cx} y2={y + h - pad} stroke={line} strokeWidth={netSw} />
          <line x1={cx - attackOff} y1={y + pad} x2={cx - attackOff} y2={y + h - pad}
            stroke={line} strokeWidth={thin} strokeDasharray="5 4" opacity="0.85" />
          <line x1={cx + attackOff} y1={y + pad} x2={cx + attackOff} y2={y + h - pad}
            stroke={line} strokeWidth={thin} strokeDasharray="5 4" opacity="0.85" />
          {/* Antenna posts on net */}
          <circle cx={cx} cy={y + pad + 4} r={thin * 0.9} fill={line} />
          <circle cx={cx} cy={y + h - pad - 4} r={thin * 0.9} fill={line} />
        </>
      ) : (
        <>
          <line x1={x + pad} y1={cy} x2={x + w - pad} y2={cy} stroke={line} strokeWidth={netSw} />
          <line x1={x + pad} y1={cy - attackOff} x2={x + w - pad} y2={cy - attackOff}
            stroke={line} strokeWidth={thin} strokeDasharray="5 4" opacity="0.85" />
          <line x1={x + pad} y1={cy + attackOff} x2={x + w - pad} y2={cy + attackOff}
            stroke={line} strokeWidth={thin} strokeDasharray="5 4" opacity="0.85" />
          <circle cx={x + pad + 4} cy={cy} r={thin * 0.9} fill={line} />
          <circle cx={x + w - pad - 4} cy={cy} r={thin * 0.9} fill={line} />
        </>
      )}
    </g>
  );
}

/** Badminton: net + short service lines + singles sidelines. */
function BadmintonMarkings(g: CourtGeom) {
  const { x, y, w, h, cx, cy, pad, line, thin, opacity, netVertical } = g;
  const inX = x + pad;
  const inY = y + pad;
  const inW = w - pad * 2;
  const inH = h - pad * 2;
  const netSw = thin + 1.2;
  const singlesInset = (netVertical ? inW : inH) * 0.12;
  const serviceOff = (netVertical ? inH : inW) * 0.18;

  return (
    <g pointerEvents="none" opacity={opacity}>
      {boundaryRect(g)}
      {netVertical ? (
        <>
          <line x1={cx} y1={inY} x2={cx} y2={inY + inH} stroke={line} strokeWidth={netSw} />
          <line x1={inX + singlesInset} y1={inY} x2={inX + singlesInset} y2={inY + inH}
            stroke={line} strokeWidth={thin * 0.85} strokeDasharray="3 3" opacity="0.75" />
          <line x1={inX + inW - singlesInset} y1={inY} x2={inX + inW - singlesInset} y2={inY + inH}
            stroke={line} strokeWidth={thin * 0.85} strokeDasharray="3 3" opacity="0.75" />
          <line x1={inX} y1={cy - serviceOff} x2={inX + inW} y2={cy - serviceOff} stroke={line} strokeWidth={thin} />
          <line x1={inX} y1={cy + serviceOff} x2={inX + inW} y2={cy + serviceOff} stroke={line} strokeWidth={thin} />
        </>
      ) : (
        <>
          <line x1={inX} y1={cy} x2={inX + inW} y2={cy} stroke={line} strokeWidth={netSw} />
          <line x1={inX} y1={inY + singlesInset} x2={inX + inW} y2={inY + singlesInset}
            stroke={line} strokeWidth={thin * 0.85} strokeDasharray="3 3" opacity="0.75" />
          <line x1={inX} y1={inY + inH - singlesInset} x2={inX + inW} y2={inY + inH - singlesInset}
            stroke={line} strokeWidth={thin * 0.85} strokeDasharray="3 3" opacity="0.75" />
          <line x1={cx - serviceOff} y1={inY} x2={cx - serviceOff} y2={inY + inH} stroke={line} strokeWidth={thin} />
          <line x1={cx + serviceOff} y1={inY} x2={cx + serviceOff} y2={inY + inH} stroke={line} strokeWidth={thin} />
        </>
      )}
    </g>
  );
}

/** Pickleball: net + non-volley (kitchen) zone lines close to net. */
function PickleballMarkings(g: CourtGeom) {
  const { x, y, w, h, cx, cy, pad, line, thin, opacity, netVertical } = g;
  const inX = x + pad;
  const inY = y + pad;
  const inW = w - pad * 2;
  const inH = h - pad * 2;
  const netSw = thin + 1.2;
  const kitchenDepth = (netVertical ? inW : inH) * 0.14;
  const kitchenStroke = thin + 0.35;

  return (
    <g pointerEvents="none" opacity={opacity}>
      {boundaryRect(g)}
      {netVertical ? (
        <>
          <line x1={cx} y1={inY} x2={cx} y2={inY + inH} stroke={line} strokeWidth={netSw} />
          <line x1={cx - kitchenDepth} y1={inY} x2={cx - kitchenDepth} y2={inY + inH}
            stroke={line} strokeWidth={kitchenStroke} strokeDasharray="2 2" />
          <line x1={cx + kitchenDepth} y1={inY} x2={cx + kitchenDepth} y2={inY + inH}
            stroke={line} strokeWidth={kitchenStroke} strokeDasharray="2 2" />
          <rect x={cx - kitchenDepth} y={inY} width={kitchenDepth} height={inH}
            fill={line} opacity="0.06" />
          <rect x={cx} y={inY} width={kitchenDepth} height={inH}
            fill={line} opacity="0.06" />
        </>
      ) : (
        <>
          <line x1={inX} y1={cy} x2={inX + inW} y2={cy} stroke={line} strokeWidth={netSw} />
          <line x1={inX} y1={cy - kitchenDepth} x2={inX + inW} y2={cy - kitchenDepth}
            stroke={line} strokeWidth={kitchenStroke} strokeDasharray="2 2" />
          <line x1={inX} y1={cy + kitchenDepth} x2={inX + inW} y2={cy + kitchenDepth}
            stroke={line} strokeWidth={kitchenStroke} strokeDasharray="2 2" />
          <rect x={inX} y={cy - kitchenDepth} width={inW} height={kitchenDepth}
            fill={line} opacity="0.06" />
          <rect x={inX} y={cy} width={inW} height={kitchenDepth}
            fill={line} opacity="0.06" />
        </>
      )}
    </g>
  );
}

/** Table tennis: inset table surface + net + center line. */
function TableTennisMarkings(g: CourtGeom) {
  const { x, y, w, h, cx, cy, pad, line, thin, opacity, netVertical } = g;
  const tablePadX = w * 0.12;
  const tablePadY = h * 0.18;
  const tx = x + tablePadX;
  const ty = y + tablePadY;
  const tw = w - tablePadX * 2;
  const th = h - tablePadY * 2;
  const netSw = thin + 1.5;
  const tableRx = Math.min(6, tw * 0.08);

  return (
    <g pointerEvents="none" opacity={opacity}>
      {boundaryRect(g)}
      <rect x={tx} y={ty} width={tw} height={th} rx={tableRx}
        fill={line} opacity="0.05" stroke={line} strokeWidth={thin + 0.5} />
      {netVertical ? (
        <>
          <line x1={cx} y1={ty + 2} x2={cx} y2={ty + th - 2} stroke={line} strokeWidth={netSw} />
          <line x1={tx + tw * 0.22} y1={cy} x2={tx + tw * 0.78} y2={cy}
            stroke={line} strokeWidth={thin * 0.9} opacity="0.7" />
        </>
      ) : (
        <>
          <line x1={tx + 2} y1={cy} x2={tx + tw - 2} y2={cy} stroke={line} strokeWidth={netSw} />
          <line x1={cx} y1={ty + th * 0.22} x2={cx} y2={ty + th * 0.78}
            stroke={line} strokeWidth={thin * 0.9} opacity="0.7" />
        </>
      )}
      {/* Net posts */}
      {netVertical ? (
        <>
          <circle cx={cx} cy={ty + 3} r={thin * 1.1} fill={line} />
          <circle cx={cx} cy={ty + th - 3} r={thin * 1.1} fill={line} />
        </>
      ) : (
        <>
          <circle cx={tx + 3} cy={cy} r={thin * 1.1} fill={line} />
          <circle cx={tx + tw - 3} cy={cy} r={thin * 1.1} fill={line} />
        </>
      )}
    </g>
  );
}

/** White court lines — shared by staff/user map and admin map builder. */
export function FacilityMapCourtMarkings({ block, locked = false }: { block: CourtBlock; locked?: boolean }) {
  const { x, y, width: w, height: h } = block;
  const kind = sportVisualKind(block.sport);

  if (w < 54 || h < 42) return null;

  const g = courtGeom(block, locked);
  const { cx, cy, line, thin, opacity } = g;

  if (kind === 'basketball') {
    return (
      <g pointerEvents="none" opacity={opacity}>
        <line x1={cx} y1={y + 8} x2={cx} y2={y + h - 8} stroke={line} strokeWidth={thin} />
        <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.18} fill="none" stroke={line} strokeWidth={thin} />
        <rect x={x + 8} y={cy - h * 0.16} width={w * 0.16} height={h * 0.32} fill="none" stroke={line} strokeWidth={thin} />
        <rect x={x + w - 8 - w * 0.16} y={cy - h * 0.16} width={w * 0.16} height={h * 0.32} fill="none" stroke={line} strokeWidth={thin} />
        <circle cx={x + w * 0.2} cy={cy} r={Math.min(w, h) * 0.09} fill="none" stroke={line} strokeWidth={thin} />
        <circle cx={x + w * 0.8} cy={cy} r={Math.min(w, h) * 0.09} fill="none" stroke={line} strokeWidth={thin} />
      </g>
    );
  }

  if (kind === 'volleyball') return <VolleyballMarkings {...g} />;
  if (kind === 'badminton') return <BadmintonMarkings {...g} />;
  if (kind === 'pickleball') return <PickleballMarkings {...g} />;
  if (kind === 'table_tennis') return <TableTennisMarkings {...g} />;

  if (kind === 'billiards') {
    const pocket = Math.max(4, Math.min(w, h) * 0.06);
    return (
      <g pointerEvents="none" opacity={locked ? 0.14 : 0.28}>
        <rect x={x + 10} y={y + 10} width={w - 20} height={h - 20} rx="6" fill="none" stroke={line} strokeWidth={thin + 1} />
        {[ [x+12,y+12], [cx,y+10], [x+w-12,y+12], [x+12,y+h-12], [cx,y+h-10], [x+w-12,y+h-12] ].map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={pocket} fill="#050505" stroke={line} strokeWidth={0.8} />
        ))}
        <circle cx={cx - w * 0.13} cy={cy} r={Math.max(2, pocket * 0.45)} fill={line} />
        <circle cx={cx + w * 0.1} cy={cy - h * 0.08} r={Math.max(2, pocket * 0.45)} fill={line} />
        <circle cx={cx + w * 0.16} cy={cy + h * 0.08} r={Math.max(2, pocket * 0.45)} fill={line} />
      </g>
    );
  }

  return (
    <g pointerEvents="none" opacity={opacity}>
      <path d={`M ${x + 10} ${y + h - 10} L ${x + w - 10} ${y + 10} M ${x + 10} ${y + 10} L ${x + w - 10} ${y + h - 10}`} stroke={line} strokeWidth={thin} strokeDasharray="6 5" />
      <rect x={x + 12} y={y + 12} width={w - 24} height={h - 24} rx="8" fill="none" stroke={line} strokeWidth={thin} strokeDasharray="4 6" />
    </g>
  );
}

/** SVG gradient id + stops — same sheen as FacilityMapViewer courts. */
export const FACILITY_COURT_SHEEN_GRADIENT = (
  <linearGradient id="facilityCourtSheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
    <stop offset="52%" stopColor="#ffffff" stopOpacity="0.03" />
    <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
  </linearGradient>
);
