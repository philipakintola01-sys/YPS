import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';

export const metadata = {
  title: 'Summit Pass & Registration | YPS 1.0',
  description: 'Reserve your admission pass for Young People’s Summit (YPS 1.0) on Saturday, November 7, 2026.',
};

export default function TicketsPage() {
  return (
    <div className="min-h-screen bg-[#0A0F24] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
      {/* Top Banner */}
      <div className="w-full bg-black border-b border-white/10 px-4 py-2 text-center text-xs font-bold text-white/90">
        <span className="text-[#E5A93C] uppercase tracking-wider font-extrabold mr-2">YPS 1.0:</span>
        Saturday, November 7, 2026 &bull; 9:00 AM &bull; 20 Jossy Castrol Street, Bariga, Lagos
      </div>

      {/* Header */}
      <header className="border-b-2 border-black bg-[#111836] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <SiteLogo />
          </Link>

          <Link
            href="/#register"
            className="px-3 sm:px-5 py-3 bg-[#E5A93C] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#EF7AD5]"
          >
            REGISTER FREE
          </Link>
        </div>
      </header>

      {/* Main Section */}
      <main className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-12 sm:py-16">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex border-2 border-black bg-[#EF7AD5] px-4 py-1 text-black font-black text-xs uppercase shadow-[3px_3px_0px_#F3C830]">
            REGISTRATION
          </div>
          <h1 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white">
            RESERVE YOUR SUMMIT PASS
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-base">
            Young People&apos;s Summit 1.0 &bull; Formerly Annual Teens Summit (ATS).
            Saturday, November 7, 2026 &bull; 9:00 AM WAT &bull; 20 Jossy Castrol Street, Bariga, Lagos.
          </p>
        </div>

        {/* Pass Card */}
        <div className="border-4 border-black bg-[#111836] p-5 sm:p-8 shadow-[12px_12px_0px_#E5A93C] space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-white/10 pb-6 gap-4">
            <div>
              <span className="bg-[#F3C830] text-black font-black text-xs uppercase px-3 py-1 border border-black inline-block mb-2">
                SUMMIT PASS
              </span>
              <h2 className="font-mortend text-2xl font-black text-white uppercase">
                YPS 1.0 GENERAL ADMISSION
              </h2>
              <p className="text-xs text-[#E5A93C] uppercase font-bold mt-1">
                A NEW COVENANT &bull; AGES 13–25+
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm font-medium text-white/90">
            <div className="flex items-center gap-3">
              <span className="text-[#E5A93C] font-black text-lg">✓</span>
              <span>Full Summit Admission starting at 9:00 AM</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#E5A93C] font-black text-lg">✓</span>
              <span>Access to all Word Ministrations &amp; Prayer Sessions</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#E5A93C] font-black text-lg">✓</span>
              <span>Access to the Oratory Session</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#E5A93C] font-black text-lg">✓</span>
              <span>Transportation for attendees is confirmed (details to be announced)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#E5A93C] font-black text-lg">✓</span>
              <span>Unique Summit Pass ID generated instantly upon registration</span>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/#register"
              className="w-full sm:w-auto min-h-14 py-3 px-5 sm:px-8 text-center bg-[#E5A93C] hover:bg-[#F3C830] text-black font-mortend font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#EF7AD5] flex items-center justify-center transition-all"
            >
              REGISTER ON HOMEPAGE →
            </Link>
            <Link
              href="/check-in"
              className="text-xs font-bold uppercase tracking-wider text-[#E5A93C] hover:underline"
            >
              ALREADY REGISTERED? CHECK-IN PORTAL →
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
