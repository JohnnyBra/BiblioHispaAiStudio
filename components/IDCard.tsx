import React from 'react';
import QRCode from 'react-qr-code';
import { User } from '../types';

interface IDCardProps {
  user: User;
  schoolName: string;
  logoUrl: string;
  side?: 'front' | 'back';
}

export const IDCard: React.FC<IDCardProps> = ({ user, schoolName, logoUrl, side = 'front' }) => {
  if (side === 'back') {
      return (
        <div className="id-card-print relative overflow-hidden bg-white border border-slate-300 rounded-lg shadow-sm flex flex-col items-center justify-center text-center p-6 break-inside-avoid"
            style={{
                width: '85.6mm',
                height: '54mm',
                minWidth: '85.6mm',
                minHeight: '54mm',
                maxWidth: '85.6mm',
                maxHeight: '54mm'
            }}>
             <img src={logoUrl} className="w-12 h-12 object-contain mb-3" alt="Logo" />
             <h3 className="text-[10px] font-bold text-slate-700 uppercase mb-3 px-4 leading-tight">{schoolName}</h3>

             <div className="text-[7px] text-slate-600 space-y-1.5 text-left w-full px-8 list-disc">
                 <p className="font-bold border-b border-slate-100 pb-1 mb-1 text-center text-slate-400 uppercase tracking-widest text-[6px]">Normas de uso</p>
                 <p>• Cuida los libros, son un tesoro de todos.</p>
                 <p>• Devuélvelos a tiempo para que otros lean.</p>
                 <p>• Mantén silencio y respeto en la biblioteca.</p>
                 <p>• Disfruta de la lectura y aprende mucho.</p>
             </div>
        </div>
      );
  }

  return (
    <div 
      className="id-card-print relative overflow-hidden bg-white border border-slate-300 rounded-lg shadow-sm break-inside-avoid"
      style={{
        width: '85.6mm',
        height: '54mm',
        minWidth: '85.6mm',
        minHeight: '54mm',
        maxWidth: '85.6mm',
        maxHeight: '54mm'
      }}
    >
       {/* Mobile print fix: use img tag instead of background-image for consistent scaling */}
       <img
         src="/card_bg_v2.jpg"
         alt="Card Background"
         className="absolute inset-0 w-full h-full object-fill z-0 pointer-events-none"
       />

       {/* Logo Overlay - Positioned based on the top-left circle in the design */}
       <div className="absolute top-[5mm] left-[6mm] w-[17mm] h-[17mm] bg-white rounded-full flex items-center justify-center p-1 shadow-sm z-10">
          <img src={logoUrl} className="w-full h-full object-contain rounded-full" alt="Logo" />
       </div>

       {/* User Info - Bottom Center (shifted left) */}
       <div className="absolute bottom-[5mm] left-[15mm] w-[45mm] flex flex-col items-center justify-center z-10">
           <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-white/50 flex flex-col items-center w-full">
               <div className="font-display text-xs font-bold text-slate-900 leading-tight text-center w-full truncate">{user.firstName} {user.lastName}</div>
               <div className="font-mono text-[10px] font-medium text-slate-600 mt-0.5">{user.username}</div>
           </div>
       </div>

       {/* QR Code & Text - Bottom Right */}
       <div className="absolute bottom-[4mm] right-[4mm] flex flex-row items-end space-x-1.5 z-10">
           <div className="text-[5px] font-bold text-slate-800 leading-tight text-right mb-1 bg-white/80 px-1 rounded backdrop-blur-sm">
               ACCESO<br/>BIBLIOTECA
           </div>
           <div className="w-[18mm] h-[18mm] bg-white rounded-lg p-1 flex items-center justify-center shadow-sm border border-slate-100">
                <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={user.username}
                    viewBox={`0 0 256 256`}
                    level="L"
                />
           </div>
       </div>

    </div>
  );
};
