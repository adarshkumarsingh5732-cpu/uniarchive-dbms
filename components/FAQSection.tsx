import React, { useState } from 'react';
import { FAQ_DATA } from '../constants';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="max-w-3xl mx-auto mt-20 mb-10 p-6 border border-uni-border bg-uni-panel relative">
      <div className="absolute -top-3 left-6 bg-uni-black px-2 border border-uni-border text-uni-neon font-mono text-xs font-bold uppercase flex items-center gap-2">
        <HelpCircle size={14} /> Frequently Asked Questions
      </div>

      <div className="space-y-4 pt-4">
        {FAQ_DATA.map((item, idx) => (
          <div key={idx} className="border-b border-uni-border last:border-0 pb-4 last:pb-0">
            <button 
              onClick={() => toggle(idx)}
              className="w-full flex justify-between items-center text-left focus:outline-none group"
            >
              <span className={`font-display font-semibold text-xs sm:text-sm uppercase tracking-tight transition-colors ${openIndex === idx ? 'text-uni-neon' : 'text-uni-contrast group-hover:text-uni-neon'}`}>
                {item.question}
              </span>
              {openIndex === idx ? <ChevronUp size={16} className="text-uni-neon shrink-0" /> : <ChevronDown size={16} className="text-uni-muted group-hover:text-uni-neon shrink-0" />}
            </button>
            
            {openIndex === idx && (
              <div className="mt-3 prose-read text-sm text-uni-muted animate-in fade-in slide-in-from-top-1 duration-200">
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
