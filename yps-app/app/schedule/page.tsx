import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';

export const metadata = {
  title: 'Summit Schedule | YPS 1.0',
  description: 'Schedule outline for Young People’s Summit (YPS 1.0) on Saturday, November 7, 2026.',
};

export default function SchedulePage() {
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
            PROGRAMME OUTLINE
          </div>
          <h1 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white">
            SUMMIT SCHEDULE
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Saturday, November 7, 2026 &bull; Doors open for check-in prior to the 9:00 AM start.
          </p>
        </div>

        {/* Schedule Outline Container */}
        <div className="border-4 border-black bg-[#111836] p-6 sm:p-10 shadow-[10px_10px_0px_#E5A93C] space-y-6">
          <div className="border-b-2 border-white/10 pb-4">
            <span className="text-xs font-black uppercase text-[#E5A93C]">
              OFFICIAL EVENT OUTLINE
            </span>
            <h2 className="font-mortend text-2xl font-bold uppercase text-white mt-1">
              SATURDAY, NOVEMBER 7, 2026
            </h2>
          </div>

          <div className="space-y-4">
            {/* Outline Item 1 */}
            <div className="border-2 border-black bg-[#0A0F24] p-5 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#E5A93C] uppercase block mb-1">
                  MORNING
                </span>
                <h3 className="font-mortend text-lg font-bold uppercase text-white">
                  Summit Check-in &amp; Arrival
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  Attendee arrival at 20 Jossy Castrol Street, Bariga and Pass ID check-in.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#F3C830] bg-black px-3 py-1 border border-white/20 self-start sm:self-center">
                PRIOR TO 9:00 AM
              </span>
            </div>

            {/* Outline Item 2 */}
            <div className="border-2 border-black bg-[#0A0F24] p-5 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#E5A93C] uppercase block mb-1">
                  START TIME: 9:00 AM
                </span>
                <h3 className="font-mortend text-lg font-bold uppercase text-white">
                  Summit Opening &amp; Sessions
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  Opening worship, theme exhortation on A New Covenant (Hebrews 8:8–10; James 1:4), and main ministrations.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#EF7AD5] bg-black px-3 py-1 border border-white/20 self-start sm:self-center">
                09:00 AM WAT
              </span>
            </div>

            {/* Outline Item 3 - Oratory */}
            <div className="border-2 border-black bg-[#0A0F24] p-5 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#23C1B4] uppercase block mb-1">
                  FEATURED SESSION
                </span>
                <h3 className="font-mortend text-lg font-bold uppercase text-white">
                  Oratory Session
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  Special oratory segment for young voices. Session details and speaker guidelines to be announced.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#23C1B4] bg-black px-3 py-1 border border-white/20 self-start sm:self-center">
                DETAILS PENDING
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-center space-y-3">
            <p className="text-xs text-white/60">
              The full minute-by-minute programme and session facilitators will be published as they are finalized.
            </p>
            <Link
              href="/#register"
              className="inline-flex items-center justify-center h-12 px-8 bg-[#E5A93C] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#EF7AD5]"
            >
              REGISTER FOR FREE NOW &rarr;
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-black py-8 px-6 text-center text-xs text-white/50">
        © 2026 Young People&apos;s Summit (YPS 1.0). Formerly Annual Teens Summit (ATS).
      </footer>
    </div>
  );
}
