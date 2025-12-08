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
        maxHeight: '54mm',
        backgroundImage: 'url(/card_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
       {/* Logo Overlay - Positioned based on the top-left circle in the design */}
       <div className="absolute top-[5mm] left-[6mm] w-[17mm] h-[17mm] bg-white rounded-full flex items-center justify-center p-1 shadow-sm z-10">
          <img src={logoUrl} className="w-full h-full object-contain rounded-full" alt="Logo" />
       </div>

       {/* User Info Box - White rounded rectangle at bottom left */}
       <div className="absolute bottom-[4mm] left-[4mm] w-[52mm] h-[20mm] bg-white rounded-xl flex flex-col justify-center px-4 z-10 shadow-sm border border-slate-100">
           <div className="text-[6px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Nombre de Usuario</div>
           <div className="font-mono text-sm font-bold text-slate-800 mb-1 truncate tracking-tight">{user.username}</div>

           <div className="w-full h-px bg-slate-100 mb-1"></div>

           <div className="text-[6px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Nombre Completo</div>
           <div className="font-display text-xs font-bold text-brand-600 truncate leading-tight">{user.firstName} {user.lastName}</div>
       </div>

       {/* QR Code - Bottom Right */}
       <div className="absolute bottom-[4mm] right-[4mm] w-[20mm] h-[20mm] bg-white rounded-lg p-1.5 flex flex-col items-center justify-center z-10 shadow-sm border border-slate-100">
           <div style={{ height: "auto", margin: "0 auto", maxWidth: "100%", width: "100%" }}>
                <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={user.username}
                    viewBox={`0 0 256 256`}
                    level="L"
                />
            </div>
            <div className="text-[4px] font-bold text-slate-500 mt-1 text-center leading-none tracking-tighter">ACCESO<br/>BIBLIOTECA</div>
       </div>

    </div>
  );
};
