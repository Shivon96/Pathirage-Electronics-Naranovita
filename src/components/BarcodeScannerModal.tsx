import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Keyboard, RefreshCw, X } from 'lucide-react';

interface BarcodeScannerModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}

interface NativeBarcodeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  title = 'Scan Barcode or QR Code',
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let rafId = 0;

    const stopAll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (zxingControlsRef.current) {
        try {
          zxingControlsRef.current.stop();
        } catch {
          // ignore
        }
        zxingControlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    };

    const startScanner = async () => {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is unavailable in this browser. Use manual barcode entry below.');
        return;
      }

      const BarcodeDetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector;
        }
      ).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play();
            setCameraActive(true);
            const detector = new BarcodeDetectorCtor({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
            });
            const tick = async () => {
              if (cancelled || !videoRef.current) return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const codes = await detector.detect(videoRef.current);
                  const val = codes[0]?.rawValue?.trim();
                  if (val) {
                    stopAll();
                    onDetected(val);
                    return;
                  }
                }
              } catch {
                // ignore frame errors
              }
              rafId = requestAnimationFrame(() => void tick());
            };
            rafId = requestAnimationFrame(() => void tick());
            return;
          }
        } catch {
          // Fallback to ZXing below
        }
      }

      // ZXing fallback
      try {
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: facingMode } }, audio: false },
          video,
          (result) => {
            if (cancelled) return;
            const text = result?.getText()?.trim();
            if (text) {
              stopAll();
              onDetected(text);
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
        setCameraActive(true);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error
              ? `Camera unavailable (${err.message}). Enter or paste barcode manually below.`
              : 'Camera unavailable. Enter or paste barcode manually below.'
          );
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open, facingMode, onDetected]);

  if (!open) return null;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    setManualCode('');
    onDetected(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white rounded-[10px] border border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              className="min-h-[40px] px-2.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-[8px] flex items-center gap-1.5 cursor-pointer"
              title="Switch Camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[8px] hover:bg-slate-700 cursor-pointer"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative bg-slate-950 rounded-[10px] overflow-hidden aspect-video flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {cameraActive && (
              <div className="pointer-events-none absolute inset-6 border-2 border-blue-400/80 rounded-[10px]" />
            )}
            {!cameraActive && !cameraError && (
              <p className="absolute text-sm text-slate-300">Starting camera...</p>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 p-5 flex flex-col items-center justify-center text-center text-slate-200 text-sm">
                <Camera className="w-8 h-8 text-slate-400 mb-2" />
                <p>{cameraError}</p>
              </div>
            )}
          </div>

          <form onSubmit={submitManual} className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" />
              <span>Manual Barcode / USB Scanner Input</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Type or scan barcode / ticket no..."
                autoFocus
                className="flex-1 min-h-[48px] px-3 border border-slate-300 rounded-[10px] text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="min-h-[48px] px-5 bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold text-sm rounded-[10px] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Use Code
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
