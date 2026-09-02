import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DisclaimerBanner: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200/90 flex items-center justify-between gap-3 shadow-inner">
      <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="leading-tight">
          <strong className="font-semibold text-amber-300">Safety Notice:</strong> {t.disclaimerShort}{' '}
          <span className="hidden sm:inline text-amber-300/70">
            LifeShield is an assistive health companion and does not diagnose disease or replace emergency medical care.
          </span>
        </p>
      </div>
      <div className="hidden md:flex items-center gap-1 text-[11px] text-amber-400/80 shrink-0 font-mono bg-amber-900/30 px-2 py-0.5 rounded border border-amber-700/40">
        <Info className="w-3 h-3" />
        <span>100% On-Device AI</span>
      </div>
    </div>
  );
};
