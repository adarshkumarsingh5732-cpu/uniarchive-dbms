import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Zap, ArrowRight, Hash, BookOpen } from 'lucide-react';
import { AVAILABLE_TOPICS } from '../constants';
import { Resource, AIAnswer } from '../types';
import { api } from '../services/api';
import { searchResources, highlightParts, tokenize } from '../services/search';

interface Props {
  onClose: () => void;
  onSelectResource: (id: string) => void;
  onSelectSubject: (code: string) => void;
  /** The already-loaded catalogue: search filters it in memory (see Dashboard). */
  catalogue: Resource[];
}

/** Bolds the first query token found in the text, so hits are obvious. */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const [before, match, after] = highlightParts(text, query);
  if (!match) return <>{text}</>;
  return (
    <>
      {before}
      <mark className="bg-uni-neon/30 text-uni-contrast">{match}</mark>
      {after}
    </>
  );
};

export const SearchOverlay: React.FC<Props> = ({ onClose, onSelectResource, onSelectSubject, catalogue }) => {
  const [query, setQuery] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<AIAnswer | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ranked, in-memory search — same index for the list and the subject chips.
  const results = useMemo(() => searchResources(catalogue, query), [catalogue, query]);
  const topResults = results.slice(0, 6);
  const subjects = useMemo(
    () => [...new Set(results.map(r => r.courseCode))].slice(0, 3),
    [results]
  );

  /** Everything ↑/↓ can land on, in render order. */
  const items = useMemo(
    () => [
      ...subjects.map(code => ({ kind: 'subject' as const, id: code })),
      ...topResults.map(r => ({ kind: 'resource' as const, id: r.id }))
    ],
    [subjects, topResults]
  );

  useEffect(() => {
    inputRef.current?.focus();
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Reset the cursor whenever the result set changes shape.
  useEffect(() => { setActiveIndex(0); }, [query, aiMode]);

  const openItem = (item: { kind: 'subject' | 'resource'; id: string }) => {
    if (item.kind === 'subject') onSelectSubject(item.id);
    else onSelectResource(item.id);
    onClose();
  };

  const askAi = async (question: string) => {
    setIsAiLoading(true);
    setAiAnswer(null);
    try {
      setAiAnswer(await api.askAI(question));
    } catch (err: any) {
      setAiAnswer({ answer: err.message || 'Failed to reach the AI service', sources: [], ai: null });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;

    if (aiMode) {
      void askAi(term);
      return;
    }
    // Enter with a cursor on a result opens it; otherwise jump to the archive
    // view filtered by the query (which is live on the Discover page).
    const active = items[activeIndex];
    if (active && (active.kind === 'resource' || active.kind === 'subject')) openItem(active);
    else if (topResults[0]) openItem({ kind: 'resource', id: topResults[0].id });
    else onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(index => (index + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(index => (index - 1 + items.length) % items.length);
    }
  };

  const hasQuery = query.trim().length > 0;
  const tokens = tokenize(query);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-uni-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="w-full max-w-2xl bg-uni-panel border border-uni-border shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">

        {/* Search Input Area */}
        <form onSubmit={handleSubmit} className="flex items-center p-4 border-b border-uni-border bg-uni-dark relative gap-2">
          {aiMode ? (
            <Zap className="text-uni-neon shrink-0" size={22} />
          ) : (
            <Search className="text-uni-muted shrink-0" size={22} />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={aiMode ? 'Ask about the archive, e.g. “what is in the k-map notes?”' : 'Search title, course, slot, professor or topic…'}
            aria-label={aiMode ? 'Ask the archive a question' : 'Search the archive'}
            className="flex-1 bg-transparent text-base text-uni-contrast outline-none placeholder:text-uni-muted/60 font-sans min-w-0"
          />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setAiMode(mode => !mode); setAiAnswer(null); }}
              aria-pressed={aiMode}
              className={`text-[10px] px-2 py-1 border transition-colors ${aiMode ? 'border-uni-neon text-uni-neon bg-uni-neon/10' : 'border-uni-border text-uni-muted hover:text-uni-contrast hover:border-uni-neon'}`}
            >
              {aiMode ? 'AI ON' : 'AI'}
            </button>
            <button type="button" onClick={onClose} aria-label="Close search" className="text-uni-muted p-1 hover:text-uni-contrast">✕</button>
          </div>
        </form>

        {/* Results Area */}
        <div className="overflow-y-auto p-2">

          {aiMode ? (
            <div className="p-4">
              {!aiAnswer && !isAiLoading && (
                <div className="text-center text-uni-muted py-8">
                  <Zap size={44} className="mx-auto mb-4 opacity-20" />
                  <p className="prose-read text-sm">
                    Ask a question about the archive — the assistant answers from the
                    resources here and links the ones it used.
                  </p>
                </div>
              )}
              {isAiLoading && (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-uni-border animate-pulse rounded"></div>
                  <div className="h-4 w-1/2 bg-uni-border animate-pulse rounded"></div>
                </div>
              )}
              {aiAnswer && (
                <div>
                  <h4 className="text-uni-neon font-bold mb-2 uppercase text-xs">Answer</h4>
                  <p className="prose-read text-uni-contrast text-sm">{aiAnswer.answer}</p>

                  {aiAnswer.sources.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-uni-muted font-bold mb-2 uppercase text-[10px]">
                        Sources ({aiAnswer.sources.length})
                      </h4>
                      <div className="space-y-1">
                        {aiAnswer.sources.map(source => (
                          <button
                            key={source.id}
                            onClick={() => { onSelectResource(source.id); onClose(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-uni-border/50 transition-colors rounded"
                          >
                            <Hash size={14} className="text-uni-cyan shrink-0" />
                            <span className="text-uni-contrast text-xs truncate">{source.title}</span>
                            <span className="ml-auto text-[10px] text-uni-muted shrink-0">{source.courseCode} · {source.type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnswer.ai && (
                    <p className="mt-4 text-[10px] text-uni-muted border-t border-uni-border pt-2">
                      {aiAnswer.ai.model} via {aiAnswer.ai.provider} · answers are grounded in {catalogue.length} archived resources
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {hasQuery && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-uni-muted uppercase tabular">
                    {results.length} {results.length === 1 ? 'match' : 'matches'}
                    {tokens.length > 1 ? ` for ${tokens.join(' + ')}` : ''}
                  </div>

                  {subjects.length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-2 text-xs font-bold text-uni-muted uppercase">Subjects</div>
                      {subjects.map((code, index) => {
                        const active = activeIndex === index;
                        return (
                          <button
                            key={code}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => { onSelectSubject(code); onClose(); }}
                            className={`w-full flex items-center px-3 py-3 rounded group transition-colors text-left ${active ? 'bg-uni-border/60' : 'hover:bg-uni-border/50'}`}
                          >
                            <BookOpen size={16} className="text-uni-cyan mr-3 shrink-0" />
                            <span className="text-uni-contrast group-hover:text-uni-cyan font-bold">
                              <Highlight text={code} query={query} />
                            </span>
                            <ArrowRight size={14} className="ml-auto text-uni-muted" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {topResults.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-bold text-uni-muted uppercase">Resources</div>
                      {topResults.map((res, index) => {
                        const itemIndex = subjects.length + index;
                        const active = activeIndex === itemIndex;
                        return (
                          <button
                            key={res.id}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => { onSelectResource(res.id); onClose(); }}
                            className={`w-full flex items-center px-3 py-3 rounded group transition-colors text-left ${active ? 'bg-uni-border/60' : 'hover:bg-uni-border/50'}`}
                          >
                            <Hash size={16} className="text-uni-muted mr-3 group-hover:text-uni-contrast shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-uni-contrast truncate text-sm font-medium">
                                <Highlight text={res.title} query={query} />
                              </div>
                              <div className="text-[11px] text-uni-muted flex gap-2 truncate">
                                <span>{res.courseCode}</span>
                                <span>•</span>
                                <span>{res.slot}</span>
                                <span>•</span>
                                <span className="uppercase">{res.type}</span>
                                {res.topics.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">#{res.topics.slice(0, 2).join(' #')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {results.length === 0 && (
                    <div className="text-center py-10 px-4 text-uni-muted">
                      <p className="prose-read text-sm">Nothing matches “{query.trim()}”.</p>
                      <p className="prose-read text-xs mt-2">
                        Try a course code (CSE2004), a slot (B1) or a topic — or switch AI on and ask instead.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!hasQuery && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-uni-muted uppercase mb-2">Suggested topics</h4>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TOPICS.slice(0, 8).map(topic => (
                      <button
                        key={topic}
                        className="px-2 py-1 bg-uni-border/30 rounded text-xs text-uni-contrast hover:bg-uni-border transition-colors"
                        onClick={() => setQuery(topic)}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-2 border-t border-uni-border bg-uni-black text-[10px] text-uni-muted flex justify-between">
          <span>{aiMode ? 'Enter to ask · Esc to close' : '↑ ↓ to move · Enter to open · Esc to close'}</span>
          <span>Ctrl+K to open</span>
        </div>
      </div>
    </div>
  );
};
