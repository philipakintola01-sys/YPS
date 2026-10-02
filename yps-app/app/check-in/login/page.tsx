'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function CheckInLoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        const { data: profile, error: profileError } = await supabase.from('committee_users').select('role').eq('user_id', data.user.id).single();
        if (profileError || !profile || !['admin', 'registration_team'].includes(profile.role)) {
          await supabase.auth.signOut();
          throw new Error('This account does not have an authorized staff profile. Contact the event administrator.');
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
    <div className="min-h-screen bg-[#0A0F24] flex items-center justify-center p-4">
      <div className="bg-[#0D132A] border border-[#E5A93C]/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-xs uppercase font-display-condensed text-[#E5A93C] tracking-widest mb-1">
            YPS 2026 Committee Access
          </div>
          <h1 className="text-2xl font-serif-title font-bold text-white">
            Admin & Staff Sign In
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Enter your committee member account details to monitor registrations and manage event-day check-in.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#E63946]/10 border border-[#E63946]/40 text-[#E63946] text-xs">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs font-display-condensed text-[#9CA3AF] uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              id="staff-email"
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="committee@yps2026.org"
              className="w-full bg-[#111836] border border-white/15 rounded-lg px-4 py-3 text-white placeholder-[#9CA3AF]/40 text-sm focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-display-condensed text-[#9CA3AF] uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              id="staff-password"
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#111836] border border-white/15 rounded-lg px-4 py-3 text-white placeholder-[#9CA3AF]/40 text-sm focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E5A93C] hover:bg-[#F59E0B] text-[#0A0F24] font-display-condensed font-bold py-3 rounded-xl text-base transition-colors cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'LOG IN TO CHECK-IN PORTAL →'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#9CA3AF]/60 border-t border-white/10 pt-4">
          Strictly for authorized YPS 2026 Admin and Registration Team staff.
        </div>
      </div>
    </div>
  );
}
