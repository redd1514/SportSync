/**
 * Save a booking-ticket QR as PNG (QR + human-readable code on the same image).
 * - Mobile / PWA: Web Share with file first when supported.
 * - Desktop: Save File picker when available.
 * - Fallback: `<a download>` blob URL.
 */
function sanitizeFileBase(name: string): string {
  const s = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim().slice(0, 72);
  return s || 'JRC-ticket-qr';
}

function isCoarseMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

async function trySaveWithFilePicker(blob: Blob, suggestedName: string): Promise<boolean> {
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };
  if (typeof w.showSaveFilePicker !== 'function') return false;
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return true;
    return false;
  }
}

async function trySharePngFile(file: File, shareText: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Booking QR',
        text: shareText,
      });
      return true;
    }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return true;
  }
  return false;
}

/** Draw QR + caption into one PNG blob. */
async function compositeQrWithCaptionPng(
  qrDataUrl: string,
  codeLine: string,
  subline?: string,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not load QR image'));
    i.src = qrDataUrl;
  });

  const pad = 28;
  const targetQrW = Math.min(520, img.naturalWidth || img.width);
  const scale = targetQrW / (img.naturalWidth || img.width);
  const qrW = targetQrW;
  const qrH = (img.naturalHeight || img.height) * scale;
  const subH = subline ? 26 : 0;
  const captionBlock = 56 + subH;
  const W = Math.round(qrW + pad * 2);
  const H = Math.round(qrH + pad * 2 + captionBlock);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, pad, pad, qrW, qrH);

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 28px system-ui, "Segoe UI", Roboto, sans-serif';
  const codeY = pad + qrH + 20;
  ctx.fillText(codeLine, W / 2, codeY);

  if (subline) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 14px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subline, W / 2, codeY + 34);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG export failed'))),
      'image/png',
      0.95,
    );
  });
}

export async function downloadTicketQrPng(options: {
  value: string;
  fileBaseName: string;
  /** Shown under the QR (defaults to same as encoded value) */
  displayCode?: string;
  subline?: string;
}): Promise<void> {
  const trimmed = options.value.trim();
  if (!trimmed) {
    throw new Error('Nothing to encode in the QR code.');
  }

  const QRCode = (await import('qrcode')).default;
  const dataUrl = await QRCode.toDataURL(trimmed, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000ff', light: '#ffffffff' },
  });

  const display = (options.displayCode ?? trimmed).trim() || trimmed;
  const sub = options.subline ?? 'Show at front desk for check-in';
  const blob = await compositeQrWithCaptionPng(dataUrl, display, sub);

  const filename = `${sanitizeFileBase(options.fileBaseName)}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const shareText = `Booking code: ${display}`;

  const mobile = isCoarseMobile() || isStandalonePwa();

  if (mobile) {
    const shared = await trySharePngFile(file, shareText);
    if (shared) return;
  }

  if (!mobile && typeof window !== 'undefined') {
    const picked = await trySaveWithFilePicker(blob, filename);
    if (picked) return;
  }

  if (!mobile) {
    const shared = await trySharePngFile(file, shareText);
    if (shared) return;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
