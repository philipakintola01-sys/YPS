import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';
import MinisterCards from '@/app/components/MinisterCards';

export const metadata = {
  title: 'Ministers & Speakers | YPS 1.0',
  description: 'Meet Apostle Caleb Dada, Main Minister, and Reverend Timothy Adewuyi, Pastor of the Church, for Young People’s Summit 1.0.',
};

export default function SpeakersPage() {
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

      {/* Main Section */}
      <main className="max-w-4xl mx-auto w-full px-4 py-20 space-y-12 text-center">
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex border-2 border-black bg-[#F3C830] px-4 py-1 text-black font-black text-xs uppercase shadow-[3px_3px_0px_#EF7AD5]">
            MEET THE MINISTERS
          </div>
          <h1 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white">
            MINISTERS &amp; SPEAKERS
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Join our Main Minister and Pastor of the Church for Young People’s Summit 1.0 — A New Covenant.
          </p>
        </div>

        <MinisterCards />

        <div className="pt-6">
          <Link
            href="/#register"
            className="inline-flex items-center justify-center h-14 px-8 text-xs font-black uppercase tracking-wider bg-[#E5A93C] text-black border-2 border-black shadow-[4px_4px_0px_#EF7AD5] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            REGISTER FREE FOR YPS 1.0 &rarr;
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
