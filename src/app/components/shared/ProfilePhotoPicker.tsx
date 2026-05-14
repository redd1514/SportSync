import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Check, ImagePlus, Loader2, Minus, Plus, RotateCcw, X } from "lucide-react";

const PROFILE_PHOTO_EVENT = "sportsync-profile-photo-updated";

export function profilePhotoKey(userId?: string) {
  return `sportsync_profile_photo_${userId || "guest"}`;
}

export function loadProfilePhoto(userId?: string) {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(profilePhotoKey(userId)) || "";
  } catch {
    return "";
  }
}

export function saveProfilePhoto(userId: string | undefined, dataUrl: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(profilePhotoKey(userId), dataUrl);
    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT, { detail: { userId, dataUrl } }));
  } catch {
    /* local storage may be unavailable or full */
  }
}

export function onProfilePhotoUpdated(handler: (dataUrl: string, userId?: string) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ dataUrl?: string; userId?: string }>).detail;
    handler(detail?.dataUrl || "", detail?.userId);
  };
  window.addEventListener(PROFILE_PHOTO_EVENT, listener);
  return () => window.removeEventListener(PROFILE_PHOTO_EVENT, listener);
}

function initials(name?: string) {
  return String(name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export function PhotoAvatar({
  src,
  name,
  size = 64,
  rounded = 18,
}: {
  src?: string;
  name?: string;
  size?: number;
  rounded?: number;
}) {
  return (
    <div
      className="relative overflow-hidden flex items-center justify-center bg-[#252525]"
      style={{ width: size, height: size, borderRadius: rounded }}
    >
      {src ? (
        <img src={src} alt={name || "Profile"} className="block w-full h-full object-cover" />
      ) : (
        <span className="text-white font-black" style={{ fontSize: Math.max(13, size * 0.32) }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export function PhotoCropperModal({
  source,
  title = "Profile Photo",
  accentColor = "#FF8C00",
  saveLabel = "Save Photo",
  onClose,
  onSave,
}: {
  source: string;
  title?: string;
  accentColor?: string;
  saveLabel?: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void | Promise<void>;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1.08);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const buildCroppedImage = () => {
    const img = imgRef.current;
    if (!img) return source;
    const size = 640;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;

    const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const drawW = img.naturalWidth * baseScale * zoom;
    const drawH = img.naturalHeight * baseScale * zoom;
    const previewSize = cropRef.current?.clientWidth || 290;
    const panScale = size / previewSize;
    const x = (size - drawW) / 2 + panX * panScale;
    const y = (size - drawH) / 2 + panY * panScale;

    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, x, y, drawW, drawH);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const cropped = buildCroppedImage();
    await new Promise((resolve) => setTimeout(resolve, 650));
    await onSave(cropped);
    setIsSaving(false);
    onClose();
  };

  const resetCrop = () => {
    setZoom(1.08);
    setPanX(0);
    setPanY(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-5"
      onClick={(e) => e.target === e.currentTarget && !isSaving && onClose()}
    >
      <motion.div
        initial={{ y: 48, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 48, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        className="w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden border border-white/10"
        style={{ background: "#181819" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-black" style={{ fontSize: 17 }}>{title}</h3>
            <p className="text-gray-500" style={{ fontSize: 12 }}>Move, zoom, then save the preview.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex justify-center">
            <div
              ref={cropRef}
              className="relative w-[min(76vw,290px)] aspect-square overflow-hidden rounded-full border-4 border-white/10 bg-black shadow-2xl"
              style={{ boxShadow: `0 18px 60px ${accentColor}22` }}
            >
              <img
                ref={imgRef}
                src={source}
                alt="Crop preview"
                className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`,
                  transformOrigin: "center",
                }}
                draggable={false}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl px-4 py-3 border border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 font-black" style={{ fontSize: 12 }}>Zoom</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))} className="w-7 h-7 rounded-lg bg-white/7 flex items-center justify-center text-gray-300">
                    <Minus size={13} />
                  </button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))} className="w-7 h-7 rounded-lg bg-white/7 flex items-center justify-center text-gray-300">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl px-4 py-3 border border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-gray-400 font-black block mb-2" style={{ fontSize: 12 }}>Left / Right</span>
                <input type="range" min="-60" max="60" step="1" value={panX} onChange={(e) => setPanX(Number(e.target.value))} className="w-full" />
              </div>
              <div className="rounded-2xl px-4 py-3 border border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-gray-400 font-black block mb-2" style={{ fontSize: 12 }}>Up / Down</span>
                <input type="range" min="-60" max="60" step="1" value={panY} onChange={(e) => setPanY(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetCrop}
              disabled={isSaving}
              className="w-12 h-12 rounded-2xl bg-white/7 text-gray-300 flex items-center justify-center disabled:opacity-40"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-12 rounded-2xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-80"
              style={{ fontSize: 14, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
            >
              {isSaving ? <><Loader2 size={17} className="animate-spin" /> Saving photo...</> : <><Check size={17} /> {saveLabel}</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ProfilePhotoPicker({
  value,
  name,
  onChange,
  title = "Profile Photo",
  accentColor = "#FF8C00",
  size = 64,
  rounded = 18,
  buttonLabel = "Choose Photo",
}: {
  value?: string;
  name?: string;
  onChange: (dataUrl: string) => void | Promise<void>;
  title?: string;
  accentColor?: string;
  size?: number;
  rounded?: number;
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState("");

  const handleFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex items-center gap-3 text-left"
      >
        <div className="relative flex-shrink-0">
          <PhotoAvatar src={value} name={name} size={size} rounded={rounded} />
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{ background: accentColor }}
          >
            <Camera size={12} />
          </div>
        </div>
        <div className="min-w-0">
          <span className="font-black text-white block" style={{ fontSize: 13 }}>{buttonLabel}</span>
          <span className="text-gray-500 block" style={{ fontSize: 11 }}>Opens gallery or file picker</span>
        </div>
      </button>

      <AnimatePresence>
        {source && (
          <PhotoCropperModal
            source={source}
            title={title}
            accentColor={accentColor}
            onClose={() => {
              setSource("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            onSave={async (dataUrl) => {
              await onChange(dataUrl);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function EmptyPhotoButton({
  onClick,
  label = "Choose Photo",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
      <ImagePlus size={15} />
      <span className="font-black" style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
}
