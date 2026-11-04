'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';
import { createClient } from '@/utils/supabase/client';

export default function CheckInLoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick fill helper for check-in stations
  const handleQuickFill = (presetEmail: string, presetPassword: string) => {
    setEmail(presetEmail);
    setPassword(presetPassword);
    setErrorMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('committee_users')
          .select('role')
          .eq('user_id', data.user.id)
          .single();

        if (profileError || !profile || !['admin', 'registration_team'].includes(profile.role)) {
          await supabase.auth.signOut();
          throw new Error('This account is registered in Auth but has not been assigned a staff role in committee_users. Please run the SQL role assignment script in your Supabase SQL editor.');
        }

        router.push('/check-in');
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F24] text-white flex flex-col justify-center items-center p-4">
      {/* Brand Logo */}
      <div className="mb-6">
        <Link href="/">
          <SiteLogo />
        </Link>
      </div>

      <div className="bg-[#111836] border-4 border-black rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0px_#E5A93C]">
        <div className="text-center mb-6">
          <div className="inline-block bg-[#E5A93C] text-black font-black text-[11px] uppercase tracking-wider px-3 py-1 mb-2">
            STAFF CHECK-IN PORTAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
            Sign In to Desk
          </h1>
          <p className="text-xs text-white/70 mt-1 leading-relaxed">
            Select your assigned desk station or enter your email and password.
          </p>
        </div>

        {/* Quick Select Buttons for Event-Day Simplicity */}
        <div className="mb-6 p-3 bg-[#0A0F24] border-2 border-white/20 rounded-xl space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#E5A93C] text-center">
            ⚡ Quick-Select Station
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('desk1@yps.ng', 'YPS2026@Desk1')}
              className="py-2.5 px-3 bg-[#E5A93C] hover:bg-[#F3C830] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] active:scale-95 transition-all text-center cursor-pointer"
            >
              Desk 1
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('desk2@yps.ng', 'YPS2026@Desk2')}
              className="py-2.5 px-3 bg-[#EF7AD5] hover:bg-[#ff8de6] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] active:scale-95 transition-all text-center cursor-pointer"
            >
              Desk 2
            </button>
          </div>
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@yps.ng', 'YPS2026@Admin')}
              className="text-[11px] font-bold text-white/60 hover:text-white underline cursor-pointer"
            >
              Or fill Admin handle (admin@yps.ng)
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-red-600/20 border-2 border-red-500 text-red-200 text-xs font-bold leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs font-black uppercase tracking-wider text-[#E5A93C] mb-1">
              Email Address
            </label>
            <input
              id="staff-email"
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="desk1@yps.ng"
              className="w-full bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="staff-password" className="block text-xs font-black uppercase tracking-wider text-[#E5A93C]">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#E5A93C] hover:underline cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="staff-password"
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0A0F24] border-2 border-white/20 focus:border-[#E5A93C] rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E5A93C] hover:bg-[#F3C830] text-black font-black text-sm uppercase tracking-wider py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_#EF7AD5] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'AUTHENTICATING...' : 'SIGN IN TO CHECK-IN PORTAL →'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-white/50 border-t border-white/10 pt-4">
          <Link href="/" className="hover:text-white transition-colors">
            &larr; Back to Summit Website
          </Link>
        </div>
      </div>
    </div>
  );
}
