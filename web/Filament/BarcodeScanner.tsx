import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Abstand zwischen zwei Erkennungsversuchen */
const SCAN_INTERVAL_MS = 300;

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'];

// Minimale Typen für die Barcode Detection API (noch nicht in den TypeScript-DOM-Typen enthalten)
interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return candidate ?? null;
}

/** true, wenn der Browser Barcodes selbst erkennen kann (z.B. Chrome auf Android, nicht Safari) */
export function isBarcodeScanSupported(): boolean {
  return getBarcodeDetector() !== null && navigator.mediaDevices?.getUserMedia !== undefined;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDetected: (value: string) => void;
}

export function BarcodeScanner({ isOpen, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Detector = getBarcodeDetector();
    if (!isOpen || Detector === null) return;

    let stream: MediaStream | null = null;
    let interval: number | null = null;
    let isActive = true;
    setError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (mediaStream) => {
        stream = mediaStream;
        const video = videoRef.current;
        if (!isActive || video === null) return;
        video.srcObject = mediaStream;
        await video.play();

        const detector = new Detector({ formats: BARCODE_FORMATS });
        interval = window.setInterval(() => {
          detector
            .detect(video)
            .then((barcodes) => {
              const value = barcodes[0]?.rawValue;
              if (value === undefined || !isActive) return;
              isActive = false;
              onDetected(value);
              onOpenChange(false);
            })
            .catch(() => undefined);
        }, SCAN_INTERVAL_MS);
      })
      .catch(() => setError('Kein Zugriff auf die Kamera. Bitte im Browser erlauben.'));

    return () => {
      isActive = false;
      if (interval !== null) window.clearInterval(interval);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, onDetected, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Etikett scannen</DialogTitle>
          <DialogDescription>Halte den Barcode oder QR-Code vom Spulen-Etikett in die Kamera.</DialogDescription>
        </DialogHeader>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
      </DialogContent>
    </Dialog>
  );
}
