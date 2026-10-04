'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';
import MinisterCards from '@/app/components/MinisterCards';
import { createClient } from '@/utils/supabase/client';

interface FieldConfig {
  id: string;
  field_key: string;
  label: string;
  input_type: 'text' | 'select' | 'radio';
  options: string[] | null;
  is_required: boolean;
}

interface RegistrationResult {
  registration_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  church_organisation: string;
  registered_at: string;
}

export default function YPSLandingPage() {
  const supabase = createClient();

  // Dynamic field configurations from Supabase
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [church, setChurch] = useState('');
  const [ageBracket, setAgeBracket] = useState('17-19');
  const [gender, setGender] = useState('Male');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Result / Confirmation State
  const [successResult, setSuccessResult] = useState<RegistrationResult | null>(null);
  const [existingResult, setExistingResult] = useState<{ id: string; name?: string } | null>(null);

  // Lookup Drawer State
  const [showLookup, setShowLookup] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ found: boolean; id?: string; message?: string } | null>(null);

  // Countdown State for Saturday, Nov 7, 2026, 09:00 AM WAT
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const targetDate = new Date('2026-11-07T09:00:00+01:00').getTime();
    const updateCountdown = () => {
      const difference = Math.max(0, targetDate - Date.now());
      setTimeLeft({
        days: Math.floor(difference / 86400000),
        hours: Math.floor(difference / 3600000) % 24,
        minutes: Math.floor(difference / 60000) % 60,
        seconds: Math.floor(difference / 1000) % 60,
      });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from('field_config')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (data && data.length > 0) {
          setFieldConfigs(data);
          data.forEach((field) => {
            if (field.field_key === 'age_bracket' && field.options?.length) {
              setAgeBracket(field.options[0]);
            }
            if (field.field_key === 'gender' && field.options?.length) {
              setGender(field.options[0]);
            }
          });
        }
      } catch (e) {
        console.error('Error loading field config:', e);
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, [supabase]);

  // Client-side validation helper
  const validateForm = () => {
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      return 'Please enter a valid phone number (at least 8 digits).';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      return 'Please enter a valid email address.';
    }
    if (!church.trim()) return 'Please enter your church, fellowship or organisation name.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setExistingResult(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phone,
          email: email,
          church_organisation: church,
          age_bracket: ageBracket || null,
          gender: gender || null,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Registration failed');
      }

      if (resData.duplicate) {
        setExistingResult({
          id: resData.registration_id,
          name: fullName.trim(),
        });
      } else if (resData.record) {
        setSuccessResult(resData.record);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (regId: string) => {
    navigator.clipboard.writeText(regId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;

    setLookupLoading(true);
    setLookupResult(null);

    const query = lookupQuery.trim();
    const isEmail = query.includes('@');

    try {
      const { data: recoveredId, error } = await supabase.rpc('lookup_registration_id', {
        p_phone: isEmail ? null : query,
        p_email: isEmail ? query.toLowerCase() : null,
      });

      if (recoveredId) {
        setLookupResult({
          found: true,
          id: recoveredId,
        });
      } else {
        setLookupResult({
          found: false,
          message: 'No registration record was found matching that phone number or email address.',
        });
      }
    } catch (err: any) {
      setLookupResult({
        found: false,
        message: 'Unable to perform lookup. Please check your details and try again.',
      });
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0A0F24] text-white flex flex-col selection:bg-[#E5A93C] selection:text-black">
      {/* 1. TOP ANNOUNCEMENT & VENUE BANNER */}
      <div className="w-full bg-black border-b border-white/10 px-4 py-2 text-center text-[12px] sm:text-[13px] font-bold text-white/90 z-50">
        <span className="text-[#E5A93C] uppercase tracking-wider font-extrabold mr-2">Summit Venue:</span>
        <span className="text-white/85">
          20 Jossy Castrol Street, Bariga, Lagos • Saturday, Nov 7, 2026 • Starts 9:00 AM • 100% Free
        </span>
      </div>

      {/* 2. BRUTALIST STICKY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-[#0A0F24]/95 backdrop-blur-md border-b-2 border-black/40 shadow-md">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3 lg:gap-6 h-[72px] px-3 sm:px-6 lg:px-8">
          {/* Brand Logo / Sticker */}
          <Link href="/" className="group flex items-center gap-3">
            <SiteLogo />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden min-[1440px]:flex items-center justify-center gap-6 whitespace-nowrap">
            <a href="#about" className="text-[13px] font-black uppercase tracking-wider hover:text-[#E5A93C] transition-colors">
              ABOUT
            </a>
            <a href="#oratory" className="text-[13px] font-black uppercase tracking-wider hover:text-[#E5A93C] transition-colors">
              ORATORY
            </a>
            <Link href="/schedule" className="text-[13px] font-black uppercase tracking-wider hover:text-[#E5A93C] transition-colors">
              SCHEDULE
            </Link>
            <Link href="/speakers" className="text-[13px] font-black uppercase tracking-wider hover:text-[#E5A93C] transition-colors">
              SPEAKERS
            </Link>
            <Link href="/faq" className="text-[13px] font-black uppercase tracking-wider hover:text-[#E5A93C] transition-colors">
              FAQ
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setShowLookup(true);
                setLookupResult(null);
                setLookupQuery('');
              }}
              className="hidden sm:inline-flex items-center justify-center h-10 px-4 text-xs font-black uppercase tracking-wider border-2 border-white/30 text-white hover:border-[#E5A93C] hover:text-[#E5A93C] transition-all cursor-pointer"
            >
              FIND MY ID
            </button>

            <a
              href="#register"
              className="inline-flex items-center justify-center h-11 px-3 sm:px-5 text-[10px] sm:text-sm font-black uppercase tracking-wider bg-[#E5A93C] text-black border-2 border-black shadow-[4px_4px_0px_0px_#EF7AD5] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_#EF7AD5] active:scale-95 transition-all"
            >
              REGISTER FREE
            </a>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-[1440px]:hidden p-2 text-white border-2 border-white/20 hover:border-white transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div id="mobile-navigation" className="min-[1440px]:hidden max-h-[calc(100dvh-72px)] overflow-y-auto bg-[#0A0F24] border-b-2 border-black px-6 py-4 flex flex-col gap-4 animate-in fade-in duration-200">
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              ABOUT
            </a>
            <a
              href="#theme"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              THEME
            </a>
            <a
              href="#oratory"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              ORATORY SESSION
            </a>
            <Link
              href="/schedule"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              SCHEDULE
            </Link>
            <Link
              href="/speakers"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              SPEAKERS
            </Link>
            <a
              href="#transportation"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              TRANSPORTATION
            </a>
            <a
              href="#sponsors"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              PARTNERS
            </a>
            <Link
              href="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 hover:text-[#E5A93C]"
            >
              FAQ
            </Link>
            <a
              href="#register"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-black uppercase tracking-wider py-2 border-b border-white/10 text-[#E5A93C]"
            >
              REGISTER FOR FREE
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLookup(true);
              }}
              className="text-left text-sm font-bold uppercase tracking-wider py-2 text-[#E5A93C]"
            >
              FIND MY REGISTRATION ID →
            </button>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION (USING EVENT FLYER AS PROMINENT BACKGROUND) */}
      <section className="relative w-full md:min-h-[88svh] flex flex-col justify-start md:justify-end overflow-hidden pt-6 sm:pt-10 md:pt-16 pb-28 md:pb-36 bg-flyer-hero">
        {/* Layered Gradient Backdrop with Flyer Image */}
        <div className="absolute inset-0 z-0 bg-flyer bg-cover bg-center pointer-events-none" />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0A0F24]/85 via-[#0A0F24]/75 to-[#0A0F24] pointer-events-none" />
        <div className="absolute inset-0 z-0 bg-radial from-transparent via-[#0A0F24]/60 to-[#0A0F24]/95 pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-10 max-w-[1400px] mx-auto w-full px-5 sm:px-6 lg:px-8 flex flex-col gap-6">
          <div className="max-w-[950px] space-y-4 sm:space-y-5">
            {/* Tilted Sticker: Formerly ATS */}
            <div className="inline-flex -rotate-[2deg] border-2 border-black bg-[#EF7AD5] px-4 py-2 shadow-[4px_4px_0px_0px_#F3C830]">
              <p className="font-roboto text-[12px] sm:text-[14px] font-black uppercase tracking-[0.1em] text-black">
                FORMERLY ANNUAL TEENS SUMMIT (ATS)
              </p>
            </div>

            {/* Official Title */}
            <h1 className="font-mortend text-[34px] sm:text-[56px] md:text-[72px] font-black uppercase leading-[0.93] tracking-tight text-white drop-shadow-xl">
              YOUNG PEOPLE’S <br />
              <span className="text-[#E5A93C]">SUMMIT 1.0</span>
            </h1>

            {/* Theme Badge */}
            <div className="inline-block border-2 border-black bg-[#F3C830] px-4 py-2 text-black shadow-[4px_4px_0px_0px_#000]">
              <span className="font-mortend text-sm sm:text-base font-black uppercase tracking-wider">
                THEME: A NEW COVENANT
              </span>
              <span className="font-roboto text-xs sm:text-sm font-bold block text-black/80">
                Hebrews 8:8–10 &bull; James 1:4
              </span>
            </div>

            {/* Accurate Event Overview */}
            <p className="text-[16px] sm:text-[18px] md:text-[20px] font-medium text-white/90 leading-[1.55] max-w-2xl">
              Young People’s Summit (YPS 1.0) is designed for young people ages 13 to 25 and above to encounter God,
              step into divine covenant, and build purposeful lives. Admission is 100% free.
            </p>

            {/* Hero CTA Button Row */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1 sm:pt-4">
              <a
                href="#register"
                className="inline-flex items-center justify-center min-h-14 py-3 px-5 sm:px-8 text-sm sm:text-base text-center font-black tracking-wider uppercase bg-[#E5A93C] text-black border-2 border-black shadow-[5px_5px_0px_0px_#EF7AD5] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all active:scale-95"
              >
                REGISTER FOR FREE
              </a>
              <a
                href="#about"
                className="inline-flex items-center justify-center min-h-14 py-3 px-5 sm:px-8 text-sm sm:text-base text-center font-black tracking-wider uppercase bg-[#111836] text-[#E5A93C] border-2 border-[#E5A93C] shadow-[5px_5px_0px_0px_#000] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all active:scale-95"
              >
                LEARN MORE
              </a>
            </div>
          </div>
        </div>

        {/* Slanted Marquee Ribbon with Confirmed Facts */}
        <div className="absolute bottom-4 left-0 right-0 z-30 w-full overflow-visible">
          <div className="relative left-0 flex w-full overflow-x-hidden bg-[#F3C830] border-y-4 border-black py-3.5 transform -rotate-2 md:w-[150vw] md:-left-[25vw]">
            <div className="whitespace-nowrap flex items-center gap-6 animate-marquee">
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest text-black">
                SATURDAY, NOVEMBER 7, 2026 • 9:00 AM • 20 JOSSY CASTROL STREET, BARIGA, LAGOS •
              </span>
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest text-black">
                THEME: A NEW COVENANT • HEBREWS 8:8–10 &bull; JAMES 1:4 •
              </span>
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest text-black">
                TARGET AUDIENCE: AGES 13–25+ • 100% FREE ENTRY • TRANSPORTATION CONFIRMED •
              </span>
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest text-black">
                ORATORY SESSION CONFIRMED • REGISTER DIRECTLY ONLINE •
              </span>
              <span className="text-lg md:text-2xl font-black uppercase tracking-widest text-black">
                SATURDAY, NOVEMBER 7, 2026 • 9:00 AM • 20 JOSSY CASTROL STREET, BARIGA, LAGOS •
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CONFIRMED SUMMIT PILLARS (REPLACING INVENTED STATS/CARDS) */}
      <section className="relative z-20 -mt-10 md:-mt-12 w-full bg-black py-14 px-5 sm:px-6 lg:px-8 border-b-4 border-black">
        <div className="max-w-[1380px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="border-2 border-black bg-[#E5A93C] text-black p-6 shadow-[6px_6px_0px_#000] -rotate-1 hover:rotate-0 transition-transform">
              <span className="text-xs font-black uppercase bg-black text-[#E5A93C] px-2.5 py-1 inline-block mb-3">
                THEME SCRIPTURES
              </span>
              <h3 className="font-mortend text-xl font-black uppercase">A NEW COVENANT</h3>
              <p className="text-xs font-bold text-black/80 mt-2 leading-relaxed">
                Hebrews 8:8–10 &bull; James 1:4. Spiritual foundation, covenant alignment, and whole-life transformation.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="border-2 border-black bg-[#FFE08C] text-black p-6 shadow-[6px_6px_0px_#FFFFFF] rotate-1 hover:rotate-0 transition-transform">
              <span className="text-xs font-black uppercase bg-black text-[#FFE08C] px-2.5 py-1 inline-block mb-3">
                AUDIENCE
              </span>
              <h3 className="font-mortend text-xl font-black uppercase">AGES 13–25+</h3>
              <p className="text-xs font-bold text-black/80 mt-2 leading-relaxed">
                Open to teenagers, students, and young adults seeking purposeful growth and godly community.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="border-2 border-black bg-[#EF7AD5] text-black p-6 shadow-[6px_6px_0px_#000] -rotate-1 hover:rotate-0 transition-transform">
              <span className="text-xs font-black uppercase bg-black text-[#EF7AD5] px-2.5 py-1 inline-block mb-3">
                PROGRAMME FEATURE
              </span>
              <h3 className="font-mortend text-xl font-black uppercase">ORATORY SESSION</h3>
              <p className="text-xs font-bold text-black/80 mt-2 leading-relaxed">
                Submit a 2-minute video by 20 October 2026. Compete for prizes of ₦150,000, ₦100,000, and ₦50,000.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="border-2 border-black bg-[#23C1B4] text-black p-6 shadow-[6px_6px_0px_#FFFFFF] rotate-1 hover:rotate-0 transition-transform">
              <span className="text-xs font-black uppercase bg-black text-[#23C1B4] px-2.5 py-1 inline-block mb-3">
                LOGISTICS
              </span>
              <h3 className="font-mortend text-xl font-black uppercase">FREE TRANSPORT</h3>
              <p className="text-xs font-bold text-black/80 mt-2 leading-relaxed">
                Transportation for attendees is confirmed. Pickup points, routes, and timings will be announced soon.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ABOUT YPS 1.0 & THEME SECTION */}
      <section id="about" className="w-full bg-[#111836] py-20 px-5 sm:px-6 lg:px-8 border-b-2 border-black">
        <div className="max-w-[1380px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex border-2 border-black bg-[#EF7AD5] px-4 py-1.5 shadow-[3px_3px_0px_#F3C830]">
              <span className="text-xs font-black uppercase tracking-wider text-black">
                OUR JOURNEY &amp; MISSION
              </span>
            </div>

            <h2 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white leading-tight">
              FROM ANNUAL TEENS SUMMIT (ATS) <br />
              <span className="text-[#E5A93C]">TO YPS 1.0</span>
            </h2>

            <p className="text-white/80 text-base sm:text-lg leading-relaxed">
              Young People’s Summit (YPS 1.0) represents the evolution of the Annual Teens Summit (ATS).
              We are expanding the vision to support young people across vital developmental years — from ages
              13 through 25 and above.
            </p>

            <p className="text-white/80 text-base sm:text-lg leading-relaxed">
              Our desire is to see young people rooted in Christ, living with purpose, and walking in the fullness of
              divine covenant in their studies, creative work, character, and daily life.
            </p>

            <div className="pt-2">
              <a
                href="#register"
                className="inline-flex items-center justify-center h-12 px-8 text-xs font-black uppercase tracking-wider bg-[#E5A93C] text-black border-2 border-black shadow-[4px_4px_0px_#EF7AD5] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                JOIN US ON NOV 7 &bull; REGISTER FREE
              </a>
            </div>
          </div>

          {/* Theme & Scriptures Card */}
          <div id="theme" className="border-4 border-black bg-[#0A0F24] p-5 sm:p-8 shadow-[10px_10px_0px_#E5A93C] space-y-6">
            <div className="border-b-2 border-white/10 pb-4">
              <span className="text-xs font-black uppercase text-[#E5A93C] block mb-1">
                SUMMIT THEME
              </span>
              <h3 className="font-mortend text-2xl sm:text-3xl font-black uppercase text-white">
                A NEW COVENANT
              </h3>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-[#F3C830] pl-4 py-1">
                <p className="text-xs font-mono font-bold text-[#F3C830] uppercase">Hebrews 8:8–10</p>
                <p className="text-sm text-white/80 italic mt-1 leading-relaxed">
                  &ldquo;For finding fault with them, he saith, Behold, the days come, saith the Lord, when I will make a new covenant with the house of Israel and with the house of Judah... I will put my laws into their mind, and write them in their hearts: and I will be to them a God, and they shall be to me a people.&rdquo;
                </p>
              </div>

              <div className="border-l-4 border-[#EF7AD5] pl-4 py-1">
                <p className="text-xs font-mono font-bold text-[#EF7AD5] uppercase">James 1:4</p>
                <p className="text-sm text-white/80 italic mt-1 leading-relaxed">
                  &ldquo;But let patience have her perfect work, that ye may be perfect and entire, wanting nothing.&rdquo;
                </p>
              </div>
            </div>

            <div className="pt-2 text-xs font-bold uppercase tracking-wider text-white/60">
              DATE: SATURDAY, NOVEMBER 7, 2026 &bull; TIME: 9:00 AM WAT
            </div>
          </div>
        </div>
      </section>

      {/* 6. ORATORY SESSION SPOTLIGHT */}
      <section id="oratory" className="w-full bg-[#E5A93C] text-black py-16 px-5 sm:px-6 lg:px-8 border-b-2 border-black">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <p className="font-black uppercase tracking-widest text-sm">Young People’s Summit 2026</p>
          <h2 className="font-mortend text-2xl sm:text-4xl font-black uppercase">YPS 1.0 Oratory Competition</h2>
          <div className="grid md:grid-cols-3 gap-5 text-left">
            {[
              ['Stage 1', '2-minute video submission', 'Deadline: 20 October 2026'],
              ['Stage 2', 'Impromptu speaking', '7 November 2026 · 8:30 a.m. WAT'],
              ['Stage 3', 'Grand finale', '7 November 2026 · 9:20 a.m. WAT'],
            ].map(([stage, title, date]) => <article key={stage} className="bg-[#111836] text-white border-4 border-black p-5 shadow-[5px_5px_0px_#000]">
              <p className="text-[#E5A93C] font-black uppercase">{stage}</p>
              <h3 className="text-xl font-bold mt-2">{title}</h3>
              <p className="mt-3 text-sm">{date}</p>
            </article>)}
          </div>
          <div className="bg-[#0A0F24] text-white border-4 border-black p-5 sm:p-8 space-y-4">
            <p className="text-[#E5A93C] font-black uppercase">Stage 1 topic</p>
            <h3 className="text-xl sm:text-2xl font-bold">“What Does It Mean to Be a Young Christian in Today’s World?”</h3>
            <div className="flex flex-wrap justify-center gap-6 pt-4">
              <p><strong className="text-[#E5A93C] text-2xl">₦150,000</strong><br />1st place</p>
              <p><strong className="text-[#E5A93C] text-2xl">₦100,000</strong><br />2nd place</p>
              <p><strong className="text-[#E5A93C] text-2xl">₦50,000</strong><br />3rd place</p>
            </div>
          </div>
          <p className="font-bold">Great Impact Baptist Church, Bariga, Lagos. Oratory participants: Stage 2 begins at 8:30 a.m., before the summit’s 9:00 a.m. start.</p>
          <div className="bg-white/90 border-4 border-black p-5 sm:p-8 text-left space-y-3">
            <h3 className="text-xl font-black uppercase">Competition rules</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base">
              <li>Maximum of 2 contestants per church or fellowship.</li>
              <li>Submit a 2-minute Stage 1 video by 20 October 2026. No slides or visual aids at any stage.</li>
              <li>10 contestants advance to Stage 2; 5 advance to the grand finale.</li>
              <li>Keep strictly to the allocated speaking time. Stage 2 and Stage 3 information will be sent to qualifying candidates.</li>
              <li>The five grand finale topics will be released ahead of the event. Each finalist’s topic will be assigned by random draw on the day.</li>
              <li>Judges will use the published criteria for each stage. Their decision is final.</li>
            </ul>
          </div>
          <a href="https://forms.gle/gVo24PTSzS4WwDh26" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border-4 border-black bg-[#111836] text-white px-6 py-4 font-black uppercase shadow-[5px_5px_0px_#000] hover:bg-[#0A0F24]">Register &amp; submit your video →</a>
          <p className="text-sm">Oratory entries use a separate form from free summit registration.</p>
          <a href="/oratory-poster.png" target="_blank" rel="noopener noreferrer" className="inline-block font-black underline">View competition poster →</a>
        </div>
      </section>

      {/* 7. TRANSPORTATION CONFIRMATION SECTION */}
      <section id="transportation" className="w-full bg-[#020101] py-16 px-5 sm:px-6 lg:px-8 border-b-2 border-white/10">
        <div className="max-w-[1380px] mx-auto">
          <div className="border-4 border-black bg-[#111836] p-5 sm:p-12 shadow-[10px_10px_0px_#E5A93C] w-full text-center space-y-4">
            <div className="inline-flex border-2 border-black bg-[#23C1B4] px-4 py-1 text-black text-xs font-black uppercase tracking-widest shadow-[3px_3px_0px_#000]">
              LOGISTICS ANNOUNCEMENT
            </div>

            <h2 className="font-mortend text-2xl sm:text-4xl font-black uppercase text-white">
              TRANSPORTATION CONFIRMED
            </h2>

            <p className="text-base sm:text-lg font-medium text-white/85 leading-relaxed">
              Transportation for attendees to and from the venue is <strong>confirmed</strong>. We want every young person who wishes to attend to participate without barrier.
            </p>

            <div className="p-4 bg-[#0A0F24] border-2 border-white/20 text-sm font-bold text-[#E5A93C] flex items-center gap-3">
              <span className="text-xl">🚌</span>
              <span>
                Designated pickup locations, departure times, and route coordination details are currently being organized and will be communicated to all registered attendees prior to November 7.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. MINISTERS & SPEAKERS */}
      <section id="speakers" className="w-full bg-[#0A0F24] py-16 px-5 sm:px-6 lg:px-8 border-b-2 border-black">
        <div className="max-w-[1380px] mx-auto text-center space-y-6">
          <div className="inline-flex border-2 border-black bg-[#F3C830] px-4 py-1.5 shadow-[3px_3px_0px_#000]">
            <span className="text-xs font-black uppercase tracking-wider text-black">MEET THE MINISTERS</span>
          </div>

          <h2 className="font-mortend text-3xl sm:text-4xl font-black uppercase text-white">
            MINISTERS &amp; SPEAKERS
          </h2>

          <MinisterCards />
        </div>
      </section>

      {/* 9. SCHEDULE OVERVIEW */}
      <section id="schedule" className="w-full bg-[#111836] py-16 px-5 sm:px-6 lg:px-8 border-b-2 border-black">
        <div className="max-w-[1380px] mx-auto text-center space-y-6">
          <div className="inline-flex border-2 border-black bg-[#EF7AD5] px-4 py-1.5 shadow-[3px_3px_0px_#000]">
            <span className="text-xs font-black uppercase tracking-wider text-black">EVENT OUTLINE</span>
          </div>

          <h2 className="font-mortend text-3xl sm:text-4xl font-black uppercase text-white">
            SUMMIT ITINERARY
          </h2>

          <div className="max-w-2xl mx-auto border-2 border-black bg-[#0A0F24] p-5 sm:p-8 shadow-[6px_6px_0px_#E5A93C] text-left space-y-4">
            <div className="border-b border-white/10 pb-4 grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)] gap-2 sm:gap-6 items-start">
              <span className="font-mortend text-sm uppercase text-[#E5A93C]">START TIME</span>
              <span className="font-mono text-sm font-bold text-white min-w-0 leading-relaxed sm:text-right">09:00 AM WAT</span>
            </div>
            <div className="border-b border-white/10 pb-4 grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)] gap-2 sm:gap-6 items-start">
              <span className="font-mortend text-sm uppercase text-[#E5A93C]">DATE</span>
              <span className="font-mono text-sm font-bold text-white min-w-0 leading-relaxed sm:text-right">SATURDAY, NOVEMBER 7, 2026</span>
            </div>
            <div className="border-b border-white/10 pb-4 grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)] gap-2 sm:gap-6 items-start">
              <span className="font-mortend text-sm uppercase text-[#E5A93C]">VENUE</span>
              <span className="font-mono text-sm font-bold text-white min-w-0 leading-relaxed sm:text-right">20 JOSSY CASTROL STREET, BARIGA, LAGOS</span>
            </div>

            <p className="text-xs text-white/70 pt-2 leading-relaxed">
              Oratory Stage 2 starts at 8:30 a.m.; the grand finale is at 9:20 a.m. on 7 November. Further programme details will be announced.
            </p>

            <Link
              href="/schedule"
              className="inline-block mt-3 text-xs font-bold uppercase tracking-wider text-[#E5A93C] hover:underline"
            >
              VIEW SCHEDULE PAGE &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* 10. SPONSORS & PARTNERS (NEUTRAL PLACEHOLDER) */}
      <section id="sponsors" className="w-full bg-[#020101] py-16 px-5 sm:px-6 lg:px-8 border-b-2 border-white/10">
        <div className="max-w-[1380px] mx-auto text-center space-y-6">
          <div className="inline-flex border-2 border-black bg-[#F3C830] px-4 py-1.5 shadow-[3px_3px_0px_#000]">
            <span className="text-xs font-black uppercase tracking-wider text-black">SUPPORT &amp; ALLIANCES</span>
          </div>

          <h2 className="font-mortend text-3xl sm:text-4xl font-black uppercase text-white">
            OUR PARTNERS &amp; SPONSORS
          </h2>

          <div className="max-w-xl mx-auto border-2 border-white/15 bg-[#111836]/60 p-5 sm:p-8 text-center space-y-2">
            <p className="text-base text-white/80 font-medium">
              Our 2026 partners will be announced soon.
            </p>
            <p className="text-xs text-white/50">
              As partners and sponsoring fellowships are confirmed, their information will be displayed here.
            </p>
          </div>
        </div>
      </section>

      {/* 11. LIVE SUMMIT COUNTDOWN BANNER */}
      <section className="w-full bg-[#F3C830] text-black border-y-4 border-black py-6 px-4 sm:px-6">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <span className="bg-black text-[#F3C830] font-mono font-black text-xs uppercase px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#fff]">
              COUNTDOWN
            </span>
            <div>
              <span className="font-mortend text-lg sm:text-2xl font-black uppercase tracking-tight block">
                {!timeLeft ? 'COUNTDOWN LOADING…' : Object.values(timeLeft).every((value) => value === 0)
                  ? 'THE SUMMIT HAS STARTED!'
                  : `SUMMIT STARTS IN: ${timeLeft.days}D : ${String(timeLeft.hours).padStart(2, '0')}H : ${String(timeLeft.minutes).padStart(2, '0')}M : ${String(timeLeft.seconds).padStart(2, '0')}S`}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-black/75">
                Saturday, November 7, 2026 &bull; 9:00 AM &bull; 20 Jossy Castrol Street, Bariga, Lagos
              </span>
            </div>
          </div>

          <a
            href="#register"
            className="inline-flex items-center justify-center h-12 px-8 text-sm font-black uppercase tracking-wider bg-[#EF7AD5] text-black border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all shrink-0"
          >
            REGISTER FOR FREE NOW
          </a>
        </div>
      </section>

      {/* 12. FULL WORKING REGISTRATION FORM */}
      <section id="register" className="w-full bg-[#0A0F24] py-16 sm:py-24 px-5 sm:px-6 lg:px-8 relative">
        <div className="max-w-3xl mx-auto w-full">
          {/* Section Header */}
          <div className="text-center mb-12 space-y-3">
            <div className="inline-flex border-2 border-black bg-[#E5A93C] px-5 py-1.5 text-black text-xs font-black uppercase tracking-widest shadow-[4px_4px_0px_#EF7AD5]">
              ATTENDEE REGISTRATION
            </div>
            <h2 className="font-mortend text-3xl sm:text-5xl font-black uppercase text-white tracking-tight">
              REGISTER FOR YPS 1.0
            </h2>
            <p className="text-white/70 text-base sm:text-lg max-w-xl mx-auto">
              Registration is 100% free for young people ages 13 to 25 and above. Complete the form below to receive your unique Pass ID.
            </p>
          </div>

          {/* Success Result Confirmation */}
          {successResult && (
            <div className="border-4 border-black bg-[#F3C830] text-black p-5 sm:p-8 shadow-[12px_12px_0px_#EF7AD5] mb-12 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <span className="bg-black text-[#F3C830] text-[11px] font-black uppercase px-3 py-1">
                    REGISTRATION CONFIRMED ✓
                  </span>
                  <h3 className="font-mortend text-2xl font-black uppercase mt-2">
                    WELCOME, {successResult.full_name}!
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase text-black/70">EVENT DATE</p>
                  <p className="font-mortend text-sm font-bold">NOV 7, 2026</p>
                </div>
              </div>

              <div className="bg-black text-white p-6 border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#E5A93C] uppercase tracking-widest font-bold">YOUR SUMMIT PASS ID</p>
                  <p className="font-mortend text-3xl sm:text-4xl font-black text-white tracking-wider">
                    {successResult.registration_id}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(successResult.registration_id)}
                  className="w-full sm:w-auto h-12 px-6 bg-[#E5A93C] text-black font-black uppercase tracking-wider border-2 border-white hover:bg-white transition-colors cursor-pointer"
                >
                  {copied ? 'COPIED! ✓' : 'COPY PASS ID'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 break-words text-sm font-medium text-black/80">
                <div>
                  <span className="font-bold block text-black">PHONE:</span>
                  {successResult.phone_number}
                </div>
                <div>
                  <span className="font-bold block text-black">EMAIL:</span>
                  {successResult.email}
                </div>
                <div className="col-span-1">
                  <span className="font-bold block text-black">CHURCH / ORG:</span>
                  {successResult.church_organisation}
                </div>
              </div>

              <p className="text-xs font-bold text-center border-t border-black/20 pt-4">
                Please screenshot or write down your Summit Pass ID. Present it upon arrival at 20 Jossy Castrol Street, Bariga for check-in.
              </p>
            </div>
          )}

          {/* Duplicate Notice */}
          {existingResult && (
            <div className="border-4 border-black bg-[#FFE08C] text-black p-6 shadow-[8px_8px_0px_#000000] mb-8 space-y-4">
              <span className="bg-black text-white text-xs font-black uppercase px-2.5 py-1">
                ALREADY REGISTERED
              </span>
              <h3 className="font-mortend text-xl font-bold uppercase">
                A RECORD ALREADY EXISTS FOR THIS PHONE OR EMAIL
              </h3>
              <div className="p-4 bg-black text-white border-2 border-black flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#E5A93C] uppercase">YOUR PASS ID</p>
                  <p className="font-mortend text-2xl font-black">{existingResult.id}</p>
                </div>
                <button
                  onClick={() => handleCopy(existingResult.id)}
                  className="px-4 py-2 bg-[#E5A93C] text-black font-black text-xs uppercase cursor-pointer"
                >
                  {copied ? 'COPIED!' : 'COPY ID'}
                </button>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="border-4 border-black bg-[#111836] p-4 sm:p-10 shadow-[12px_12px_0px_#E5A93C]">
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-600/20 border-2 border-red-500 text-red-200 text-sm font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                  FULL NAME <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Oluwaseun Adeleke"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white placeholder:text-white/30 focus:outline-none transition-colors"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                    PHONE NUMBER <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white placeholder:text-white/30 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                    EMAIL ADDRESS <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. david@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white placeholder:text-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Church / School / Organisation */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                  CHURCH / FELLOWSHIP / SCHOOL / ORGANISATION <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Great Impact Baptist Church / UNILAG / Yaba"
                  value={church}
                  onChange={(e) => setChurch(e.target.value)}
                  className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white placeholder:text-white/30 focus:outline-none transition-colors"
                />
              </div>

              {/* Age Bracket & Gender (Targeting Ages 13–25+) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                    AGE BRACKET (TARGET: 13–25+)
                  </label>
                  <select
                    value={ageBracket}
                    onChange={(e) => setAgeBracket(e.target.value)}
                    className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white focus:outline-none transition-colors"
                  >
                    <option value="13-16">13 – 16 years (Teens)</option>
                    <option value="17-19">17 – 19 years</option>
                    <option value="20-25">20 – 25 years (Young Adults)</option>
                    <option value="25+">25+ years</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#E5A93C]">
                    GENDER
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-14 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-normal text-white focus:outline-none transition-colors"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-16 h-auto px-6 py-5 leading-relaxed bg-[#E5A93C] hover:bg-[#F3C830] text-black font-mortend text-base sm:text-lg font-black uppercase tracking-wider border-2 border-black shadow-[6px_6px_0px_#EF7AD5] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0px_#EF7AD5] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'RESERVING PASS...' : 'COMPLETE FREE REGISTRATION →'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowLookup(true)}
                  className="text-xs font-bold uppercase tracking-widest text-[#E5A93C] hover:underline cursor-pointer"
                >
                  ALREADY REGISTERED? LOOK UP YOUR SUMMIT ID →
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 13. FIND MY REGISTRATION MODAL */}
      {showLookup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-md max-h-[calc(100dvh-40px)] overflow-y-auto border-4 border-black bg-[#111836] p-6 sm:p-8 shadow-[12px_12px_0px_#E5A93C] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 mb-6">
              <h3 className="font-mortend text-lg font-black uppercase text-[#E5A93C]">
                RECOVER SUMMIT ID
              </h3>
              <button
                onClick={() => setShowLookup(false)}
                className="text-white hover:text-[#E5A93C] font-black text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLookupSubmit} className="space-y-4">
              <p className="text-xs text-white/80 leading-relaxed">
                Enter the phone number or email address used during registration:
              </p>

              <input
                type="text"
                required
                placeholder="Phone number or email"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                className="w-full h-12 bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] px-4 font-bold text-white text-sm focus:outline-none"
              />

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full h-12 bg-[#E5A93C] text-black font-black uppercase text-xs tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
              >
                {lookupLoading ? 'SEARCHING ARCHIVES...' : 'LOOK UP MY CODE'}
              </button>
            </form>

            {lookupResult && (
              <div className="mt-6 pt-4 border-t-2 border-white/10">
                {lookupResult.found ? (
                  <div className="bg-[#F3C830] text-black p-4 border-2 border-black">
                    <p className="text-[10px] font-bold uppercase text-black/70">RECOVERED PASS ID:</p>
                    <p className="font-mortend text-2xl font-black mt-1">{lookupResult.id}</p>
                    <button
                      onClick={() => handleCopy(lookupResult.id!)}
                      className="mt-3 px-3 py-1.5 bg-black text-[#F3C830] font-black text-xs uppercase"
                    >
                      {copied ? 'COPIED!' : 'COPY ID'}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-red-500/20 border border-red-400 text-red-200 text-xs">
                    {lookupResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 14. FOOTER */}
      <footer className="w-full bg-black text-white border-t-4 border-black px-5 sm:px-6 lg:px-8 pt-16 pb-20">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-white/10">
          {/* Brand & Purpose */}
          <div className="space-y-4">
            <Link href="/" className="inline-block"><SiteLogo /></Link>
            <p className="text-xs text-white/70 leading-relaxed max-w-sm">
              Young People&apos;s Summit (YPS 1.0) &bull; Formerly Annual Teens Summit (ATS).
              Theme: A New Covenant (Hebrews 8:8–10; James 1:4).
            </p>
            <p className="text-[11px] font-bold uppercase text-[#E5A93C]">
              Venue: 20 Jossy Castrol Street, Bariga, Lagos
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3">
            <h4 className="font-mortend text-sm font-black uppercase text-[#E5A93C]">SUMMIT NAVIGATION</h4>
            <ul className="space-y-2 text-xs font-bold uppercase tracking-wider text-white/75">
              <li><a href="#about" className="hover:text-[#E5A93C]">About YPS 1.0</a></li>
              <li><a href="#theme" className="hover:text-[#E5A93C]">Theme &amp; Scriptures</a></li>
              <li><a href="#oratory" className="hover:text-[#E5A93C]">Oratory Session</a></li>
              <li><Link href="/schedule" className="hover:text-[#E5A93C]">Summit Schedule</Link></li>
              <li><Link href="/speakers" className="hover:text-[#E5A93C]">Ministers &amp; Speakers</Link></li>
              <li><a href="#transportation" className="hover:text-[#E5A93C]">Transportation Details</a></li>
            </ul>
          </div>

          {/* Portals & Actions */}
          <div className="space-y-3">
            <h4 className="font-mortend text-sm font-black uppercase text-[#E5A93C]">ATTENDEE ACCESS</h4>
            <ul className="space-y-2 text-xs font-bold uppercase tracking-wider text-white/75">
              <li><a href="#register" className="hover:text-[#E5A93C]">Free Registration Form</a></li>
              <li>
                <button onClick={() => setShowLookup(true)} className="hover:text-[#E5A93C] cursor-pointer text-left uppercase tracking-wider">
                  Find Registration Pass ID
                </button>
              </li>

              <li><Link href="/faq" className="hover:text-[#E5A93C]">Frequently Asked Questions</Link></li>
            </ul>
          </div>

          {/* Information & Updates */}
          <div className="space-y-4">
            <h4 className="font-mortend text-sm font-black uppercase text-[#E5A93C]">STAY INFORMED</h4>
            <p className="text-xs text-white/70">
              Saturday, November 7, 2026 &bull; 9:00 AM WAT. Open to ages 13 to 25+.
            </p>
            <div className="p-3 bg-[#111836] border border-white/20 text-xs text-[#E5A93C] font-mono">
              20 Jossy Castrol Street, Bariga, Lagos
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>© 2026 Young People&apos;s Summit (YPS 1.0). Formerly Annual Teens Summit (ATS).</p>
          <p className="font-mono text-[11px] text-[#E5A93C]">A NEW COVENANT &bull; HEBREWS 8:8–10; JAMES 1:4</p>
        </div>
      </footer>
    </div>
  );
}
