/**
 * Save a booking-ticket QR as PNG: Web Share with file (mobile) when available,
 * otherwise `<a download>` with a blob URL (desktop / most Android).
 */
function sanitizeFileBase(name: string): string {
  const s = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim().slice(0, 72);
  return s || 'JRC-ticket-qr';
}

export async function downloadTicketQrPng(options: { value: string; fileBaseName: string }): Promise<void> {
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

  const filename = `${sanitizeFileBase(options.fileBaseName)}.png`;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Booking QR',
          text: 'Save this QR for check-in at the front desk.',
        });
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      /* fall through to download */
    }
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
