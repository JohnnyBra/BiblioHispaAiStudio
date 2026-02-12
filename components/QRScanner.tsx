
import React from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import '../types';
import { X, Camera, AlertTriangle, Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanFailure, onClose }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-widget";

  React.useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      // 1. Security Check
      if (!window.isSecureContext) {
        if (isMounted) {
            setError("🔒 SEGURIDAD: La cámara requiere conexión segura (HTTPS) o localhost. Tu navegador ha bloqueado el acceso.");
            setLoading(false);
        }
        return;
      }

      // 2. Initialize
      try {
        // Clean up previous instance if any
        if (scannerRef.current) {
            await scannerRef.current.clear();
        }

        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        // 3. Start Camera
        // We prefer 'environment' (back camera)
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
             // On Success
             if (isMounted) {
                 // Stop scanning immediately to prevent duplicate reads
                 html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                    onScanSuccess(decodedText);
                 }).catch(console.error);
             }
          },
          (errorMessage) => {
             // Frame read error (common, ignore)
             if (onScanFailure) onScanFailure(errorMessage);
          }
        );
        
        if (isMounted) setLoading(false);

      } catch (err: any) {
        console.error("Error starting QR scanner:", err);
        if (isMounted) {
            setLoading(false);
            let msg = "No se pudo iniciar la cámara.";
            
            if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes("permission")) {
                msg = "⚠️ Permiso denegado. Debes permitir el acceso a la cámara en el navegador.";
            } else if (err?.name === 'NotFoundError') {
                msg = "⚠️ No se encontró ninguna cámara disponible.";
            } else if (err?.name === 'NotReadableError') {
                msg = "⚠️ La cámara está en uso por otra aplicación.";
            } else if (typeof err === 'string') {
                msg = err;
            }
            
            setError(msg);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(startScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
          scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-end sm:items-center justify-center animate-fade-in">
      <div className="modal-glass rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-md relative shadow-glass-xl flex flex-col items-center animate-slide-up sm:animate-modal-in">
        <button
            onClick={onClose}
            className="absolute top-4 right-4 text-themed-muted hover:text-themed-secondary z-10 bg-[var(--surface-raised)] rounded-xl p-2 hover:bg-[var(--surface-overlay)] transition-all press-effect"
        >
            <X size={20} />
        </button>

        <div className="text-center mb-6">
            <h3 className="text-xl font-display font-bold text-themed flex items-center justify-center gap-2">
                <Camera className="text-brand-500" /> Escanear Carnet
            </h3>
            <p className="text-xs text-themed-muted mt-1">Enfoca el código QR de tu carnet</p>
        </div>

        <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden ring-4 ring-[var(--glass-border)] shadow-inner">
            {/* The library mounts the video element here */}
            <div id={readerId} className="w-full h-full"></div>

            {/* Loading State */}
            {loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/50 backdrop-blur-sm z-10">
                    <Loader2 size={48} className="animate-spin mb-4 text-brand-400" />
                    <p className="font-display font-bold text-sm">Iniciando cámara...</p>
                    <p className="text-xs text-white/60 mt-2">Por favor, acepta los permisos.</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-base)] p-6 z-20 text-center">
                    <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center mb-4">
                        <AlertTriangle className="text-accent-coral" size={32} />
                    </div>
                    <h4 className="font-display font-bold text-themed mb-2">Error de Cámara</h4>
                    <p className="text-sm text-accent-coral font-medium">{error}</p>
                    <button
                        onClick={onClose}
                        className="mt-6 bg-gradient-to-b from-brand-500 to-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold press-effect shadow-brand"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Overlay Guides (Only show when active and no error) */}
            {!loading && !error && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 border-2 border-white/30 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 -mt-1 -ml-1 rounded-tl-lg animate-pulse-slow"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 -mt-1 -mr-1 rounded-tr-lg animate-pulse-slow"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 -mb-1 -ml-1 rounded-bl-lg animate-pulse-slow"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 -mb-1 -mr-1 rounded-br-lg animate-pulse-slow"></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent" style={{animation: 'scanLine 2s ease-in-out infinite'}}></div>
                    </div>
                </div>
            )}
        </div>

        <p className="mt-5 text-[10px] text-themed-muted text-center max-w-xs">
            Si tienes problemas, asegúrate de estar accediendo mediante <strong className="text-themed-secondary">HTTPS</strong> y de haber dado permisos al navegador.
        </p>
      </div>
    </div>
  );
};
