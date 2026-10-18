import React from 'react';
import { PinnedSubject, Resource } from '../types';
import { ResourceCard } from './ResourceCard';
import { Pin, Bookmark, X, BookOpen } from 'lucide-react';

interface Props {
  pinnedSubjects: PinnedSubject[];
  savedResources: Resource[];
  onUnpinSubject: (code: string) => void;
  onUnsaveResource: (id: string) => void;
  onSelectResource: (id: string) => void;
  onSelectSubject: (code: string) => void;
}

export const Library: React.FC<Props> = ({ 
  pinnedSubjects, 
  savedResources, 
  onUnpinSubject, 
  onUnsaveResource,
  onSelectResource,
  onSelectSubject
}) => {
  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto px-6 pt-6">
      <header className="mb-10 pb-4 border-b border-uni-border">
         <h2 className="text-3xl font-display font-bold text-uni-contrast uppercase tracking-tight">My Library</h2>
         <p className="prose-read text-uni-muted text-sm">Your personal collection and shortcuts.</p>
      </header>

      {/* Pinned Subjects Section */}
      <section className="mb-12">
         <div className="flex items-center gap-2 mb-6">
            <Pin size={18} className="text-uni-neon" />
            <h3 className="text-lg font-bold text-uni-contrast uppercase">Pinned Subjects</h3>
         </div>
         
         {pinnedSubjects.length > 0 ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {pinnedSubjects.map(subject => (
                <div key={subject.code} className="group relative bg-uni-panel border border-uni-border hover:border-uni-neon transition-all p-4">
                   <button 
                     onClick={() => onUnpinSubject(subject.code)}
                     className="absolute top-1.5 right-1.5 p-1.5 text-uni-muted hover:text-uni-alert opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                     title="Unpin"
                   >
                     <X size={14} />
                   </button>
                   
                   <div onClick={() => onSelectSubject(subject.code)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                         <BookOpen size={20} className="text-uni-cyan" />
                         <span className="text-[10px] font-mono text-uni-muted bg-uni-black px-1.5 py-0.5 border border-uni-border">{subject.resourcesCount ?? 0} RES</span>
                      </div>
                      <h4 className="font-bold text-uni-contrast text-lg">{subject.code}</h4>
                      <p className="text-xs text-uni-muted truncate">{subject.name}</p>
                   </div>
                </div>
              ))}
           </div>
         ) : (
           <div className="prose-read border border-dashed border-uni-border p-8 text-center text-uni-muted text-sm">
              Pin subjects from the discover page for quick access.
           </div>
         )}
      </section>

      {/* Saved Resources Section */}
      <section>
         <div className="flex items-center gap-2 mb-6">
            <Bookmark size={18} className="text-uni-cyan" />
            <h3 className="text-lg font-bold text-uni-contrast uppercase">Saved Resources</h3>
         </div>

         {savedResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {savedResources.map(resource => (
                 <div key={resource.id} className="relative group">
                    <div onClick={() => onSelectResource(resource.id)} className="cursor-pointer h-full">
                       <ResourceCard resource={resource} />
                    </div>
                    <button 
                       onClick={() => onUnsaveResource(resource.id)}
                       className="absolute top-2 right-2 z-10 bg-uni-black/80 backdrop-blur border border-uni-border p-1.5 text-uni-muted hover:text-uni-alert opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-sm shadow-md"
                       title="Remove from library"
                    >
                       <Bookmark size={14} fill="currentColor" />
                    </button>
                 </div>
               ))}
            </div>
         ) : (
            <div className="prose-read border border-dashed border-uni-border p-12 text-center text-uni-muted text-sm">
               No saved resources yet. Use the bookmark button on resources to add them here.
            </div>
         )}
      </section>
    </div>
  );
};
