import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanFailure, onClose }) => {
  useEffect(() => {
    // Configuración del escáner
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
    };
    
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "reader", 
      config, 
      /* verbose= */ false
    );

    html5QrcodeScanner.render(
        (decodedText) => {
            // Detener el escaneo tras el éxito para evitar lecturas múltiples
            html5QrcodeScanner.clear().then(() => {
                onScanSuccess(decodedText);
            });
        }, 
        (errorMessage) => {
            if (onScanFailure) onScanFailure(errorMessage);
        }
    );

    // Limpieza al desmontar
    return () => {
      html5QrcodeScanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md relative">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 bg-white rounded-full p-1"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <h3 className="text-xl font-bold text-center mb-4">Escanea tu Carnet</h3>
        <div id="reader" className="w-full overflow-hidden rounded-xl bg-slate-100"></div>
        <p className="text-center text-sm text-slate-500 mt-4">Coloca tu código QR frente a la cámara</p>
      </div>
    </div>
  );
};