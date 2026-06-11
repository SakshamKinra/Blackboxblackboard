import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';

export function ShareModal({ isOpen, onClose, link, title }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-[var(--card)] border border-[#C9A84C]/20 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#C9A84C]/10">
          <h3 className="text-lg font-bold text-[#C9A84C]">Share {title || 'Board'}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-6">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-xl shadow-inner">
            <QRCodeSVG 
              value={link} 
              size={180}
              bgColor={"#ffffff"}
              fgColor={"#0d0d1a"}
              level={"M"}
            />
          </div>
          
          <p className="text-sm text-center text-gray-400">
            Scan with a phone to join instantly
          </p>

          {/* Copy Link Input */}
          <div className="w-full relative">
            <input 
              type="text" 
              readOnly 
              value={link}
              className="w-full bg-[var(--bg)] border border-[var(--input-border)] rounded-xl py-3 pl-4 pr-12 text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]/50"
            />
            <button 
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition-colors"
              title="Copy Link"
            >
              {copied ? <Check size={18} className="text-[#1D9E75]" /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
