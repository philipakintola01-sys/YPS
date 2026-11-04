'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';

export default function AskQuestionPage() {
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const charLimit = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = questionText.trim();
    if (trimmed.length < 5) {
      setErrorMsg('Please type a question with at least 5 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit question.');
      }

      setSubmitted(true);
      setQuestionText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F24] text-white flex flex-col selection:bg-[#E5A93C] selection:text-black">
      {/* Top Banner */}
      <div className="w-full bg-black border-b border-white/10 px-4 py-2 text-center text-xs font-bold text-white/90">
        <span className="text-[#E5A93C] uppercase tracking-wider font-extrabold mr-2">YPS 1.0 — Ask YPS:</span>
        <span className="text-white/80">
          Anonymous Interactive Q&amp;A &bull; Your identity is never stored or displayed
        </span>
      </div>

      {/* Header */}
      <header className="w-full bg-[#0A0F24]/95 border-b-2 border-black px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SiteLogo />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/ask/screen"
              className="text-xs font-black uppercase tracking-wider px-3 py-2 border-2 border-[#E5A93C] text-[#E5A93C] hover:bg-[#E5A93C] hover:text-black transition-all"
            >
              🖥️ Projector Screen &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-8 sm:py-12 flex flex-col justify-center">
        {/* Title Badge */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex border-2 border-black bg-[#EF7AD5] px-4 py-1.5 shadow-[3px_3px_0px_#F3C830]">
            <span className="text-xs font-black uppercase tracking-wider text-black">
              100% ANONYMOUS Q&amp;A
            </span>
          </div>

          <h1 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white leading-tight">
            ASK A QUESTION
          </h1>

          <p className="text-sm sm:text-base text-white/80 max-w-md mx-auto leading-relaxed">
            Have a question on faith, life, relationships, purpose, or doctrine?
            Submit it freely — no name, email, or identity is attached.
          </p>
        </div>

        {/* Success Confirmation Card */}
        {submitted && (
          <div className="border-4 border-black bg-[#23C1B4] text-black p-6 sm:p-8 shadow-[8px_8px_0px_#000] mb-8 animate-in fade-in zoom-in-95 duration-200 space-y-4 text-center">
            <span className="text-4xl block">✨</span>
            <h2 className="font-mortend text-2xl font-black uppercase">
              Question Submitted!
            </h2>
            <p className="text-sm font-bold text-black/85 max-w-md mx-auto">
              Your question has been received anonymously and will be displayed on the screen for the panel session.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                onClick={() => setSubmitted(false)}
                className="w-full sm:w-auto px-6 py-3 bg-black text-white font-black text-xs uppercase tracking-wider border-2 border-black hover:bg-white hover:text-black transition-colors cursor-pointer"
              >
                Ask Another Question
              </button>
              <Link
                href="/ask/screen"
                className="w-full sm:w-auto px-6 py-3 bg-[#E5A93C] text-black font-black text-xs uppercase tracking-wider border-2 border-black hover:bg-[#F3C830] transition-colors"
              >
                View Live Screen Cards &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Question Submission Card */}
        {!submitted && (
          <div className="border-4 border-black bg-[#111836] p-6 sm:p-8 shadow-[10px_10px_0px_#E5A93C]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="p-3 bg-red-600/20 border-2 border-red-500 text-red-200 text-xs font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#E5A93C] mb-2">
                  What is on your heart? <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={questionText}
                  maxLength={charLimit}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. How do I maintain consistency in my prayer life when school and work get overwhelming?"
                  className="w-full bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] p-4 text-white placeholder-white/30 text-sm sm:text-base leading-relaxed focus:outline-none transition-colors resize-none rounded-none"
                />
                <div className="flex justify-between items-center text-xs text-white/50 mt-1.5">
                  <span>No login required &bull; 100% Anonymous</span>
                  <span className={questionText.length >= charLimit ? 'text-red-400 font-bold' : ''}>
                    {questionText.length} / {charLimit}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !questionText.trim()}
                className="w-full py-4 px-6 bg-[#E5A93C] hover:bg-[#F3C830] text-black font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#EF7AD5] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-40"
              >
                {submitting ? 'SENDING ANONYMOUSLY...' : 'SUBMIT QUESTION TO SCREEN →'}
              </button>
            </form>
          </div>
        )}

        {/* Live Screen Link Banner */}
        <div className="mt-8 text-center">
          <Link
            href="/ask/screen"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E5A93C] hover:underline"
          >
            <span>📺 Are you displaying on a projector or TV? Open Live Cards View</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-black border-t-2 border-white/10 p-6 text-center text-xs text-white/50">
        Young People&apos;s Summit 2026 &bull; Ask YPS &bull; Saturday, November 7, 2026
      </footer>
    </div>
  );
}
