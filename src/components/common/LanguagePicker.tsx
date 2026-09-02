import React from 'react';
import { Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LanguageCode } from '../../types/user';

const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
];

export const LanguagePicker: React.FC = () => {
  const { language, setLanguage } = useApp();

  return (
    <div className="relative inline-flex items-center">
      <Globe className="w-4 h-4 text-sky-400 absolute left-2.5 pointer-events-none" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        aria-label="Select Language"
        className="bg-slate-800/90 text-slate-100 text-xs font-medium pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer appearance-none transition-colors"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100">
            {lang.native} ({lang.label})
          </option>
        ))}
      </select>
    </div>
  );
};
