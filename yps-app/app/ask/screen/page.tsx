'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface QuestionItem {
  question_id: string;
  question_text: string;
  status: string;
  submitted_at: string;
}

export default function QuestionsScreenPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'spotlight'>('grid');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/questions?limit=100');
      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading live feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
    if (!autoRefresh) return;
    const interval = setInterval(fetchQuestions, 5000);
    return () => clearInterval(interval);
  }, [fetchQuestions, autoRefresh]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Card background color cycler
  const cardThemes = [
    { bg: 'bg-[#111836]', border: 'border-[#E5A93C]', text: 'text-white', badgeBg: 'bg-[#E5A93C]', badgeText: 'text-black', shadow: 'shadow-[6px_6px_0px_#E5A93C]' },
    { bg: 'bg-[#141b3a]', border: 'border-[#EF7AD5]', text: 'text-white', badgeBg: 'bg-[#EF7AD5]', badgeText: 'text-black', shadow: 'shadow-[6px_6px_0px_#EF7AD5]' },
    { bg: 'bg-[#0f232e]', border: 'border-[#23C1B4]', text: 'text-white', badgeBg: 'bg-[#23C1B4]', badgeText: 'text-black', shadow: 'shadow-[6px_6px_0px_#23C1B4]' },
    { bg: 'bg-[#1e1528]', border: 'border-[#F3C830]', text: 'text-white', badgeBg: 'bg-[#F3C830]', badgeText: 'text-black', shadow: 'shadow-[6px_6px_0px_#F3C830]' },
  ];

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#0A0F24] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
      {/* 1. TOP LIVE HEADER BAR */}
      <header className="bg-black/90 border-b-2 border-white/20 px-4 sm:px-8 py-3 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EF7AD5] text-black font-black text-xs uppercase tracking-wider border border-black shadow-[2px_2px_0px_#F3C830]">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
              LIVE Q&amp;A SCREEN
            </span>
            <h1 className="font-mortend text-base sm:text-xl font-black uppercase text-white tracking-wider">
              YPS 1.0 AUDIENCE QUESTIONS
            </h1>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="text-xs font-mono text-white/70">
              <span className="font-bold text-[#E5A93C]">{questions.length}</span> Questions Submitted
            </div>

            {/* View Mode Toggle */}
            <div className="flex border border-white/30 rounded overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-xs font-black uppercase transition-colors ${
                  viewMode === 'grid' ? 'bg-[#E5A93C] text-black' : 'bg-transparent text-white/70 hover:text-white'
                }`}
              >
                Cards Grid
              </button>
              <button
                onClick={() => setViewMode('spotlight')}
                className={`px-3 py-1 text-xs font-black uppercase transition-colors ${
                  viewMode === 'spotlight' ? 'bg-[#E5A93C] text-black' : 'bg-transparent text-white/70 hover:text-white'
                }`}
              >
                Spotlight
              </button>
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-2.5 py-1 border font-bold uppercase transition-colors ${
                autoRefresh ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40' : 'border-white/30 text-white/60'
              }`}
            >
              {autoRefresh ? '● Auto-Sync ON' : '○ Auto-Sync OFF'}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchQuestions()}
              className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 font-bold uppercase"
            >
              🔄 Refresh
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="text-xs px-3 py-1 bg-[#23C1B4] hover:bg-[#1fa89d] text-black font-black uppercase border border-black shadow-[2px_2px_0px_#000]"
            >
              {isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}
            </button>

            {/* Link to Submit */}
            <Link
              href="/ask"
              target="_blank"
              className="text-xs px-3 py-1 bg-white hover:bg-white/90 text-black font-black uppercase border border-black"
            >
              + Submit Question
            </Link>
          </div>
        </div>
      </header>

      {/* 2. MAIN DISPLAY AREA */}
      <main className="flex-1 p-4 sm:p-8 max-w-[1600px] mx-auto w-full flex flex-col justify-center">
        {loading && questions.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-[#E5A93C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mortend text-lg font-black uppercase text-[#E5A93C]">
              Connecting to Live Question Feed...
            </p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20 border-4 border-dashed border-white/20 p-8 sm:p-16 max-w-2xl mx-auto space-y-4">
            <span className="text-5xl block">🎤</span>
            <h2 className="font-mortend text-2xl sm:text-3xl font-black uppercase text-white">
              No Questions Yet
            </h2>
            <p className="text-sm sm:text-base text-white/70 max-w-md mx-auto">
              Attendees can submit questions anonymously by navigating to{' '}
              <strong className="text-[#E5A93C]">yps2026.org/ask</strong> on their phones.
            </p>
            <div className="pt-2">
              <Link
                href="/ask"
                className="inline-flex px-6 py-3 bg-[#E5A93C] text-black font-black uppercase text-xs tracking-wider border-2 border-black shadow-[4px_4px_0px_#EF7AD5]"
              >
                Open Question Submission Form &rarr;
              </Link>
            </div>
          </div>
        ) : viewMode === 'spotlight' && currentQuestion ? (
          /* SPOTLIGHT VIEW (ONE QUESTION MASSIVE ON SCREEN) */
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="border-4 border-black bg-[#111836] p-8 sm:p-12 shadow-[12px_12px_0px_#E5A93C] relative space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4">
                <span className="inline-block px-3 py-1 bg-[#E5A93C] text-black font-black text-xs uppercase tracking-wider">
                  QUESTION #{questions.length - currentIndex} OF {questions.length}
                </span>
                <span className="text-xs font-mono text-white/60">
                  {new Date(currentQuestion.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <blockquote className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-snug tracking-tight">
                &ldquo;{currentQuestion.question_text}&rdquo;
              </blockquote>

              <div className="pt-4 border-t-2 border-white/10 flex items-center justify-between text-xs text-white/50">
                <span className="font-bold uppercase tracking-wider text-[#23C1B4]">
                  ✓ Anonymous Attendee
                </span>
                <span>Young People&apos;s Summit 1.0</span>
              </div>
            </div>

            {/* Spotlight Controls */}
            <div className="flex items-center justify-between gap-4">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-6 py-3 bg-[#111836] hover:bg-[#1b2552] border-2 border-white/30 text-white font-black uppercase text-xs disabled:opacity-30 cursor-pointer"
              >
                &larr; Newer Question
              </button>

              <span className="text-xs font-mono text-white/60">
                Use arrows to cycle questions for stage projection
              </span>

              <button
                disabled={currentIndex >= questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-6 py-3 bg-[#111836] hover:bg-[#1b2552] border-2 border-white/30 text-white font-black uppercase text-xs disabled:opacity-30 cursor-pointer"
              >
                Older Question &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* CARDS GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {questions.map((q, idx) => {
              const theme = cardThemes[idx % cardThemes.length];
              return (
                <article
                  key={q.question_id}
                  className={`border-4 border-black ${theme.bg} ${theme.shadow} p-6 flex flex-col justify-between space-y-4 hover:translate-x-0.5 hover:translate-y-0.5 transition-transform`}
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-2">
                    <span className={`px-2.5 py-0.5 ${theme.badgeBg} ${theme.badgeText} font-black text-[10px] uppercase tracking-wider`}>
                      QUESTION #{questions.length - idx}
                    </span>
                    <span className="text-[11px] font-mono text-white/60">
                      {new Date(q.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-lg sm:text-xl font-bold text-white leading-relaxed flex-1">
                    &ldquo;{q.question_text}&rdquo;
                  </p>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
                    <span className="font-bold text-[#E5A93C] uppercase">Anonymous</span>
                    <button
                      onClick={() => {
                        setCurrentIndex(idx);
                        setViewMode('spotlight');
                      }}
                      className="text-[11px] font-bold text-white/80 hover:text-white underline cursor-pointer"
                    >
                      Focus Full Screen ↗
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* 3. PROMPT CALL-OUT FOOTER */}
      <footer className="bg-black border-t-2 border-white/20 px-6 py-3 text-center text-xs text-white/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-black text-[#E5A93C] uppercase tracking-wider">HAVE A QUESTION?</span>
          <span>Submit anonymously at:</span>
          <span className="bg-[#E5A93C] text-black px-2 py-0.5 font-mono font-bold text-xs">
            yps2026.org/ask
          </span>
        </div>

        <div className="font-mono text-[11px] text-white/50">
          Young People&apos;s Summit 2026 &bull; A New Covenant &bull; Hebrews 8:8–10
        </div>
      </footer>
    </div>
  );
}
