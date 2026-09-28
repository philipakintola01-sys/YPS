'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is Young People’s Summit (YPS 1.0)?',
      a: 'Young People’s Summit (YPS 1.0) was formerly known as the Annual Teens Summit (ATS). It has expanded its reach to serve young people from ages 13 to 25 and above with spiritual grounding, purpose, and community under the theme "A New Covenant".',
    },
    {
      q: 'What is the theme and scripture for YPS 1.0?',
      a: 'The theme is "A New Covenant", anchored on Hebrews 8:8–10 and James 1:4.',
    },
    {
      q: 'When and where is the summit taking place?',
      a: 'The summit takes place on Saturday, November 7, 2026, starting at 9:00 AM WAT. The venue is 20 Jossy Castrol Street, Bariga, Lagos.',
    },
    {
      q: 'Who can attend the summit?',
      a: 'The summit is designed for young people ages 13 to 25 and above (teenagers, students, and young adults).',
    },
    {
      q: 'How much does it cost to register?',
      a: 'Registration is 100% free. You can register directly through this website.',
    },
    {
      q: 'Is transportation provided for attendees?',
      a: 'Yes, transportation for attendees is confirmed. Designated pickup points, routes, and schedule details will be announced prior to the summit.',
    },
    {
      q: 'What is the Oratory Session?',
      a: 'There will be an Oratory Session at YPS 1.0 for young people. Specific participation criteria, guidelines, and topic details are currently being finalized and will be announced soon.',
    },
    {
      q: 'How do I check in on the summit day?',
      a: 'When you register on this website, you receive a unique Summit Pass ID (e.g. YPS26-####). Please save this ID or take a screenshot to present at the check-in desk on arrival.',
    },
    {
      q: 'What if I lose or forget my registration Pass ID?',
      a: 'You can use the "Find My ID" button on the website to look up and recover your registration code using the phone number or email address you registered with.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F24] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
      {/* Top Banner */}
      <div className="w-full bg-black border-b border-white/10 px-4 py-2 text-center text-xs font-bold text-white/90">
        <span className="text-[#E5A93C] uppercase tracking-wider font-extrabold mr-2">YPS 1.0:</span>
        Saturday, November 7, 2026 &bull; 9:00 AM &bull; 20 Jossy Castrol Street, Bariga, Lagos
      </div>

      {/* Header */}
      <header className="border-b-2 border-black bg-[#111836] px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <SiteLogo />
          </Link>

          <Link
            href="/#register"
            className="px-5 py-2.5 bg-[#E5A93C] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#EF7AD5]"
          >
            REGISTER FREE
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-16 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex border-2 border-black bg-[#F3C830] px-4 py-1 text-black font-black text-xs uppercase shadow-[3px_3px_0px_#EF7AD5]">
            COMMON QUESTIONS
          </div>
          <h1 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white">
            FREQUENTLY ASKED QUESTIONS
          </h1>
          <p className="text-white/70 text-base">
            Essential information regarding Young People’s Summit (YPS 1.0).
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="border-2 border-black bg-[#111836] shadow-[4px_4px_0px_#000] overflow-hidden"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-mortend text-base sm:text-lg font-bold uppercase text-[#E5A93C] hover:bg-black/20 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-xl font-mono text-white">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="p-6 pt-0 text-sm sm:text-base text-white/80 leading-relaxed border-t border-white/10 bg-[#0A0F24]/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-4 border-black bg-[#E5A93C] text-black p-8 text-center space-y-4 shadow-[8px_8px_0px_#EF7AD5]">
          <h3 className="font-mortend text-2xl font-black uppercase">
            HAVE MORE QUESTIONS?
          </h3>
          <p className="text-sm font-bold max-w-lg mx-auto">
            You can reach out or secure your free pass today before registration fills up.
          </p>
          <Link
            href="/#register"
            className="inline-flex items-center justify-center h-12 px-8 bg-black text-[#E5A93C] font-mortend font-bold text-xs uppercase tracking-wider border-2 border-black hover:bg-white hover:text-black transition-colors"
          >
            REGISTER FREE NOW →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-black py-8 px-6 text-center text-xs text-white/50">
        © 2026 Young People&apos;s Summit (YPS 1.0). Formerly Annual Teens Summit (ATS).
      </footer>
    </div>
  );
}
