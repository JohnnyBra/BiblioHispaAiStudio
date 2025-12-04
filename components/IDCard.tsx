import React from 'react';
import QRCode from 'react-qr-code';
import { User } from '../types';

interface IDCardProps {
  user: User;
  schoolName: string;
  logoUrl: string;
}

export const IDCard: React.FC<IDCardProps> = ({ user, schoolName, logoUrl }) => {
  return (
    // Standard ID-1 Format: 85.6mm x 53.98mm
    <div className="id-card-print w-[85.6mm] h-[54mm] bg-white border border-slate-300 rounded-lg overflow-hidden relative shadow-sm flex break-inside-avoid">
      
      {/* Left Decoration Bar */}
      <div className="w-6 bg-brand-600 h-full relative flex items-center justify-center flex-shrink-0">
         {/* Absolute positioning ensures the rotated text is centered and not clipped by the narrow container width */}
         <div className="absolute text-[5px] font-bold text-white uppercase -rotate-90 whitespace-nowrap tracking-wider min-w-max">
            Cooperativa de Enseñanza La Hispanidad
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
           <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
           <div className="overflow-hidden">
              <h2 className="font-bold text-xs text-slate-800 leading-none truncate uppercase w-32">{schoolName}</h2>
              <span className="text-[8px] text-slate-400 font-medium">Carnet de Lector</span>
           </div>
        </div>

        {/* Student Info */}
        <div className="mt-1">
           <h1 className="font-display font-bold text-lg text-slate-900 leading-none mb-0.5 truncate">{user.firstName}</h1>
           <h2 className="font-medium text-sm text-slate-600 leading-none truncate">{user.lastName}</h2>
           <div className="mt-2 inline-block bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded border border-brand-100">
              Clase {user.className}
           </div>
        </div>
      </div>

      {/* QR Code Area */}
      <div className="w-[32mm] bg-slate-50 border-l border-slate-100 p-2 flex flex-col items-center justify-center flex-shrink-0">
         <div className="bg-white p-1 rounded border border-slate-200 shadow-sm w-full aspect-square flex items-center justify-center">
            <div style={{ height: "auto", margin: "0 auto", maxWidth: "100%", width: "100%" }}>
                <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={user.username}
                    viewBox={`0 0 256 256`}
                    level="M" // Less error correction = less dense dots = easier to scan
                />
            </div>
         </div>
         <p className="text-[7px] font-mono text-slate-400 mt-1 text-center w-full truncate">{user.username}</p>
      </div>

    </div>
  );
};