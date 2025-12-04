
import React from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import '../types';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanFailure, onClose }) => {
  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 1. SECURITY CHECK (Critical for Mobile)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    
    if (!isHttps && !isLocalhost) {
        setPermissionError("🔒 Bloqueo de Seguridad: Los navegadores móviles NO permiten usar la cámara en sitios web sin candado (HTTP). Para usar el escáner, necesitas configurar HTTPS en tu servidor o acceder desde localhost.");
        return;
    }

    // 2. Prevent Double Init
    if (scannerRef.current) return;

    // 3. Scanner Config
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true
    };
    
    try {
        const html5QrcodeScanner = new Html5QrcodeScanner(
          "reader", 
          config, 
          /* verbose= */ false
        );
        
        scannerRef.current = html5QrcodeScanner;

        html5QrcodeScanner.render(
            (decodedText) => {
                html5QrcodeScanner.clear().then(() => {
                    onScanSuccess(decodedText);
                }).catch(console.error);
            }, 
            (errorMessage) => {
                // Ignore scanning errors, only report critical failures if needed
                if (errorMessage?.includes("permission")) {
                   setPermissionError("Permiso de cámara denegado. Revisa la configuración del navegador.");
                }
            }
        );
    } catch (e) {
        console.error("Error initializing scanner", e);
        setPermissionError("No se pudo iniciar la cámara.");
    }

    // Cleanup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md relative shadow-2xl">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 bg-slate-100 rounded-full p-2 hover:bg-slate-200 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        
        <h3 className="text-xl font-display font-bold text-center mb-2 text-slate-800">Escanea tu Carnet</h3>
        <p className="text-center text-xs text-slate-400 mb-4">Coloca el código QR frente a la cámara</p>
        
        {permissionError ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg my-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-bold text-red-800">Error de Cámara</h3>
                        <p className="text-sm text-red-700 mt-1">{permissionError}</p>
                    </div>
                </div>
            </div>
        ) : (
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-square shadow-inner border-4 border-slate-100">
                <div id="reader" className="w-full h-full"></div>
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/30 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/50 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-500 -mt-1 -ml-1 rounded-tl"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-500 -mt-1 -mr-1 rounded-tr"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-500 -mb-1 -ml-1 rounded-bl"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-500 -mb-1 -mr-1 rounded-br"></div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
