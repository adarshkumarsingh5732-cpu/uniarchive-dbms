import React from 'react';
import { FOOTER_CONFIG } from '../constants';
import { Github, Twitter, Mail, Code, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-uni-border bg-uni-panel mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-2">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-uni-neon flex items-center justify-center text-uni-black font-bold font-display text-sm">
                  U
                </div>
                <span className="text-lg font-display font-bold text-uni-contrast">UNIARCHIVES</span>
             </div>
             <p className="prose-read text-uni-muted text-sm max-w-sm mb-6">
               Open-source academic resource commons. Breaking down knowledge silos one slot at a time.
             </p>
             <div className="flex gap-4">
                <a href={FOOTER_CONFIG.githubUrl} target="_blank" rel="noreferrer" className="text-uni-muted hover:text-uni-neon transition-colors">
                  <Github size={20} />
                </a>
                {FOOTER_CONFIG.twitterUrl && (
                  <a href={FOOTER_CONFIG.twitterUrl} target="_blank" rel="noreferrer" className="text-uni-muted hover:text-uni-cyan transition-colors">
                    <Twitter size={20} />
                  </a>
                )}
                <a href={`mailto:${FOOTER_CONFIG.email}`} className="text-uni-muted hover:text-uni-contrast transition-colors">
                  <Mail size={20} />
                </a>
             </div>
          </div>

          {/* Links Column */}
          <div>
            <h3 className="font-bold text-uni-contrast uppercase text-xs mb-4">Project</h3>
            <ul className="space-y-2 text-xs font-mono text-uni-muted">
               <li><a href="#" className="hover:text-uni-neon transition-colors">About</a></li>
               <li><a href="#" className="hover:text-uni-neon transition-colors">Manifesto</a></li>
               <li><a href="#" className="hover:text-uni-neon transition-colors">Roadmap</a></li>
               <li><a href="#" className="hover:text-uni-neon transition-colors">API Docs</a></li>
            </ul>
          </div>

          {/* Meta Column */}
          <div>
            <h3 className="font-bold text-uni-contrast uppercase text-xs mb-4">Meta</h3>
            <div className="text-xs font-mono text-uni-muted space-y-2">
               <div className="flex items-center gap-2">
                 <Terminal size={14} />
                 <span>{FOOTER_CONFIG.version}</span>
               </div>
               <div className="flex items-center gap-2">
                 <Code size={14} />
                 <span>Maintained by <span className="text-uni-contrast">{FOOTER_CONFIG.maintainer}</span></span>
               </div>
            </div>
          </div>
        </div>

        <div className="border-t border-uni-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-mono text-uni-muted uppercase tracking-[0.08em]">
           <p>© {new Date().getFullYear()} UniArchives Open Collective.</p>
           <p>Not affiliated with VIT.</p>
        </div>
      </div>
    </footer>
  );
};
