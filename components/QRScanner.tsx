
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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md relative shadow-2xl flex flex-col items-center">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 bg-slate-100 rounded-full p-2 hover:bg-slate-200 transition-colors"
        >
            <X size={20} />
        </button>
        
        <div className="text-center mb-6">
            <h3 className="text-xl font-display font-bold text-slate-800 flex items-center justify-center gap-2">
                <Camera className="text-brand-600" /> Escanear Carnet
            </h3>
            <p className="text-xs text-slate-400 mt-1">Enfoca el código QR de tu carnet</p>
        </div>
        
        <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-100 shadow-inner">
            {/* The library mounts the video element here */}
            <div id={readerId} className="w-full h-full"></div>

            {/* Loading State */}
            {loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/50 backdrop-blur-sm z-10">
                    <Loader2 size={48} className="animate-spin mb-4 text-brand-500" />
                    <p className="font-bold text-sm">Iniciando cámara...</p>
                    <p className="text-xs text-slate-300 mt-2">Por favor, acepta los permisos.</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 z-20 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-2">Error de Cámara</h4>
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                    <button 
                        onClick={onClose}
                        className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-xl text-sm font-bold"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Overlay Guides (Only show when active and no error) */}
            {!loading && !error && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 border-2 border-white/50 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-500 -mt-1 -ml-1 rounded-tl"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-500 -mt-1 -mr-1 rounded-tr"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-500 -mb-1 -ml-1 rounded-bl"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-500 -mb-1 -mr-1 rounded-br"></div>
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-brand-500/50 -translate-y-1/2"></div>
                    </div>
                </div>
            )}
        </div>

        <p className="mt-4 text-[10px] text-slate-400 text-center max-w-xs">
            Si tienes problemas, asegúrate de estar accediendo mediante <strong>HTTPS</strong> y de haber dado permisos al navegador.
        </p>
      </div>
    </div>
  );
};
