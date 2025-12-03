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
    <div className="w-[85.6mm] h-[53.98mm] bg-white border-2 border-slate-200 rounded-xl overflow-hidden relative shadow-sm print:shadow-none print:border-slate-300 flex flex-row print:break-inside-avoid page-break-inside-avoid">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-full bg-brand-600 transform skew-x-[-20deg] translate-x-10"></div>
      <div className="absolute top-0 right-0 w-2 h-full bg-fun-yellow transform skew-x-[-20deg] translate-x-[-50px]"></div>

      {/* Left Content */}
      <div className="flex-1 p-4 flex flex-col justify-between relative z-10">
        <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            <div className="leading-none">
                <h3 className="font-bold text-[10px] uppercase text-brand-700 tracking-wider">Biblioteca</h3>
                <h2 className="font-bold text-xs text-slate-800 leading-tight w-32 truncate">{schoolName}</h2>
            </div>
        </div>

        <div className="mt-2">
            <span className="block text-[8px] text-slate-400 uppercase font-bold">Nombre</span>
            <h1 className="font-display font-bold text-lg text-slate-800 leading-none mb-1">{user.firstName}</h1>
            <h2 className="font-display font-medium text-sm text-slate-600 leading-none">{user.lastName}</h2>
        </div>

        <div className="mt-auto">
            <span className="inline-block bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-md">
                Clase {user.className}
            </span>
        </div>
      </div>

      {/* Right Content (QR) */}
      <div className="w-24 p-2 flex flex-col items-center justify-center relative z-10 bg-white/90 m-2 rounded-lg">
        <div style={{ height: "auto", margin: "0 auto", maxWidth: 64, width: "100%" }}>
            <QRCode
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={user.username}
                viewBox={`0 0 256 256`}
            />
        </div>
        <p className="text-[8px] font-mono text-slate-500 mt-1 text-center break-all leading-tight">{user.username}</p>
      </div>
    </div>
  );
};