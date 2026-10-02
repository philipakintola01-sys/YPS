'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface RegistrationRecord {
  id: string;
  registration_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  church_organisation: string;
  age_bracket: string | null;
  gender: string | null;
  registration_status: string;
  checkin_status: 'not_checked_in' | 'checked_in';
  checked_in_at: string | null;
  checked_in_by: string | null;
}

interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  role?: 'admin' | 'registration_team';
}

export default function CheckInPage() {
  const supabase = createClient();
  const router = useRouter();

  // Auth & Role state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Live Counter state
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalCheckedIn, setTotalCheckedIn] = useState(0);

  // Primary Check-in (4-digit ID) state
  const [suffix, setSuffix] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);
  const [activeRecord, setActiveRecord] = useState<RegistrationRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Backup Search state
  const [activeTab, setActiveTab] = useState<'id' | 'search'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegistrationRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [countsReady, setCountsReady] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const listRequest = useRef(0);
  const pageSize = 25;
  const loadAttendees = useCallback(async () => {
    if (!currentUser) return;
    const request = ++listRequest.current;
    setSearchLoading(true);
    setListError(null);
    try {
      let query = supabase.from('registrations').select('*', { count: 'exact' });
      const text = filter.replace(/[^a-zA-Z0-9 @.+-]/g, ' ').trim();
      if (text) query = query.or(`full_name.ilike.%${text}%,phone_number.ilike.%${text}%,email.ilike.%${text}%,registration_id.ilike.%${text}%`);
      const { data, count, error } = await query.order('registered_at', { ascending: false }).order('id').range(page * pageSize, (page + 1) * pageSize - 1);
      if (request !== listRequest.current) return;
      if (error) throw error;
      setSearchResults(data || []);
      setResultCount(count ?? 0);
    } catch (error) {
      if (request !== listRequest.current) return;
      setSearchResults([]);
      setListError(error instanceof Error ? error.message : 'Unable to load attendees. Check your staff permissions and connection.');
    } finally {
      if (request === listRequest.current) setSearchLoading(false);
    }
  }, [supabase, currentUser, filter, page]);
  useEffect(() => {
    void loadAttendees();
    const timer = setInterval(() => void loadAttendees(), 30000);
    return () => { clearInterval(timer); listRequest.current++; };
  }, [loadAttendees]);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Verify User Authentication & Load Profile
  useEffect(() => {
    async function checkAuth() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/check-in/login');
          return;
        }

        // Fetch committee user role
        const { data: commUser, error: profileError } = await supabase
          .from('committee_users')
          .select('name, role')
          .eq('user_id', user.id)
          .single();

        if (profileError || !commUser || !['admin', 'registration_team'].includes(commUser.role)) {
          await supabase.auth.signOut();
          router.replace('/check-in/login');
          return;
        }
        setCurrentUser({
          id: user.id,
          email: user.email,
          name: commUser?.name || user.email?.split('@')[0] || 'Staff Member',
          role: commUser.role,
        });
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/check-in/login');
      } finally {
        setAuthLoading(false);
      }
    }

    checkAuth();
  }, [supabase, router]);

  // 2. Fetch Initial Counts & Subscribe to Realtime Updates
  useEffect(() => {
    async function fetchCounts() {
      const { count: total, error: totalError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true });

      const { count: checkedIn, error: checkedError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('checkin_status', 'checked_in');

      if (totalError || checkedError) {
        setCountError('Attendance totals could not be loaded. Check your staff permissions and connection.');
        setCountsReady(false);
        return;
      }
      setCountError(null);
      setCountsReady(true);
      setTotalRegistered(total || 0);
      setTotalCheckedIn(checkedIn || 0);
    }

    if (!currentUser) return;
    fetchCounts();
    const refreshInterval = setInterval(fetchCounts, 30000);

    // Setup Supabase Realtime Subscription on registrations table
    const channel = supabase
      .channel('realtime:registrations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        (payload) => {
          // Refresh live counts on any update or insert
          fetchCounts();

          // If the currently displayed record in 4-digit search was updated, refresh it
          if (activeRecord && payload.new && (payload.new as RegistrationRecord).registration_id === activeRecord.registration_id) {
            setActiveRecord(payload.new as RegistrationRecord);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [supabase, activeRecord, currentUser]);

  // 3. Auto-trigger Primary Lookup on 4th Character Entry
  useEffect(() => {
    if (suffix.trim().length === 4) {
      handlePrimaryLookup(suffix.trim());
    } else {
      setActiveRecord(null);
      setNotFound(false);
      setActionError(null);
    }
  }, [suffix]);

  const handlePrimaryLookup = async (codeSuffix: string) => {
    const fullId = `YPS26-${codeSuffix.toUpperCase()}`;
    setSearchingCode(true);
    setNotFound(false);
    setActionError(null);

    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', fullId)
        .single();

      if (error || !data) {
        setActiveRecord(null);
        setNotFound(true);
      } else {
        setActiveRecord(data as RegistrationRecord);
      }
    } catch (err) {
      setActiveRecord(null);
      setNotFound(true);
    } finally {
      setSearchingCode(false);
    }
  };

  // 4. Perform Check-in / Override Action
  const handleCheckInAction = async (regId: string, actionType: 'checkin' | 'reopen') => {
    setActionLoading(true);
    setActionError(null);

    try {
      const response = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: regId,
          action: actionType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Action failed');
      }

      if (result.record) {
        setActiveRecord(result.record);
        void loadAttendees();
        // Also update in backup search results if open
        setSearchResults((prev) =>
          prev.map((item) => (item.registration_id === regId ? result.record : item))
        );
      }
    } catch (err: any) {
      setActionError(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackupSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setFilter(searchQuery.trim());
    if (page === 0 && filter === searchQuery.trim()) void loadAttendees();
  };

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/check-in/login');
  };

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-gray-600 font-medium text-sm">Verifying staff credentials...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col">
      {/* Top Utility Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-xs sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-blue-900">YPS 2026</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
              Check-in Portal
            </span>
          </div>

          {/* Committee Member Info & Logout */}
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="font-semibold text-gray-800">{currentUser?.name}</span>{' '}
              <span className="text-gray-500 uppercase">({currentUser?.role?.replace('_', ' ')})</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800 font-medium underline cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        {/* Real-time Live Attendance Counter Card (REQ-6.4) */}
        <div className="bg-blue-900 text-white rounded-xl p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">
              Live Event Attendance Counter
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {countsReady ? totalCheckedIn : "—"} <span className="text-xl sm:text-2xl font-normal text-blue-200">/ {countsReady ? totalRegistered : "—"} Checked In</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-amber-400">
              {countsReady ? `${totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0}%` : '—'}
            </div>
            <div className="text-xs text-blue-200">Attendance Rate</div>
          </div>
        </div>

        {countError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{countError}</p>}
        {actionError && activeTab === 'search' && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{actionError}</p>}
        {/* Tab Navigation (Primary 4-Digit Code vs Backup Search) */}
        <div className="flex border-b border-gray-300 gap-2">
          <button
            onClick={() => setActiveTab('id')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 cursor-pointer transition-colors ${
              activeTab === 'id'
                ? 'border-blue-900 text-blue-900 bg-white rounded-t-lg'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🔑 4-Digit Code Lookup (Primary)
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 cursor-pointer transition-colors ${
              activeTab === 'search'
                ? 'border-blue-900 text-blue-900 bg-white rounded-t-lg'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Attendees & Search
          </button>
        </div>

        {/* 1. PRIMARY CHECK-IN METHOD: FIXED YPS26- PREFIX + 4 CHARACTERS */}
        {activeTab === 'id' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Enter Registration ID (Last 4 Digits)
              </label>

              <div className="flex items-center gap-2 max-w-sm">
                <span className="bg-gray-100 border border-gray-300 text-gray-700 font-mono font-bold text-xl px-4 py-3 rounded-lg select-none">
                  YPS26-
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={4}
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value.toUpperCase())}
                  placeholder="4821"
                  autoFocus
                  className="min-w-0 w-full bg-white border-2 border-blue-900 rounded-lg px-4 py-3 text-2xl font-mono font-bold text-blue-950 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Ask the attendee for the last 4 characters of their Registration ID.
              </p>
            </div>

            {/* Searching State */}
            {searchingCode && (
              <div className="p-4 text-center text-gray-600 text-sm animate-pulse">
                Looking up code YPS26-{suffix}...
              </div>
            )}

            {/* Error / Not Found Message */}
            {notFound && !searchingCode && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                ⚠️ No attendee found matching <strong>YPS26-{suffix}</strong>. Check for typos or use the <strong>Backup Search</strong> tab to look up by name or phone.
              </div>
            )}

            {actionError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                ❌ {actionError}
              </div>
            )}

            {/* Attendee Found Card & Check-in Action (REQ-6.1.2) */}
            {activeRecord && !searchingCode && (
              <div className="border-2 border-blue-800 rounded-xl p-6 bg-blue-50/50 space-y-4 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-blue-200 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-200 px-2.5 py-1 rounded">
                      {activeRecord.registration_id}
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900 mt-1">
                      {activeRecord.full_name}
                    </h2>
                  </div>

                  <div>
                    {activeRecord.checkin_status === 'checked_in' ? (
                      <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                        ✓ CHECKED IN
                      </span>
                    ) : (
                      <span className="bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                        NOT CHECKED IN
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div><strong>Church / Org:</strong> {activeRecord.church_organisation}</div>
                  <div><strong>Phone:</strong> {activeRecord.phone_number}</div>
                  <div><strong>Email:</strong> {activeRecord.email}</div>
                  <div><strong>Age / Gender:</strong> {activeRecord.age_bracket || 'N/A'} / {activeRecord.gender || 'N/A'}</div>
                </div>

                {/* Check-in Action Button / Status Display (REQ-6.3.2) */}
                <div className="pt-2 border-t border-blue-200">
                  {activeRecord.checkin_status === 'not_checked_in' ? (
                    <button
                      onClick={() => handleCheckInAction(activeRecord.registration_id, 'checkin')}
                      disabled={actionLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? 'Confirming Check-in...' : '✓ CONFIRM CHECK IN'}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-bold text-base text-center">
                        ✓ Checked in at {new Date(activeRecord.checked_in_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      {/* Admin Override Option */}
                      {currentUser?.role === 'admin' && (
                        <div className="text-right">
                          <button
                            onClick={() => handleCheckInAction(activeRecord.registration_id, 'reopen')}
                            disabled={actionLoading}
                            className="text-xs text-red-600 hover:text-red-800 underline font-semibold cursor-pointer"
                          >
                            [Admin Override: Re-open Check-in]
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. BACKUP CHECK-IN METHOD: SEARCH BY NAME OR PHONE (REQ-6.2) */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Attendees</h2>
              <button onClick={() => void loadAttendees()} disabled={searchLoading} className="text-blue-900 underline disabled:opacity-50">Refresh list</button>
            </div>
            <p className="text-sm text-gray-600">All registrations appear here automatically. Refreshes every 30 seconds.</p>
            <form onSubmit={handleBackupSearch} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by attendee name, phone number, or email..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-900"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="bg-blue-900 hover:bg-blue-950 text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors cursor-pointer shrink-0"
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {listError && <p role="alert" className="bg-red-50 p-4 text-red-800 rounded-lg">{listError}</p>}
            {searchLoading && <p role="status">Loading attendees…</p>}
            {/* Results Table */}
            {searchResults.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700 text-xs font-bold uppercase border-b border-gray-200">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Church</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {searchResults.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-bold text-blue-900">{rec.registration_id}</td>
                        <td className="p-3 font-semibold text-gray-900">{rec.full_name}</td>
                        <td className="p-3 text-gray-600">{rec.phone_number}</td>
                        <td className="p-3 text-gray-600">{rec.church_organisation}</td>
                        <td className="p-3">
                          {rec.checkin_status === 'checked_in' ? (
                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              Checked In
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
                              Not Checked In
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {rec.checkin_status === 'not_checked_in' ? (
                            <button
                              onClick={() => handleCheckInAction(rec.registration_id, 'checkin')}
                              disabled={actionLoading || rec.registration_status !== 'registered'}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
                            >
                              Check In
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">
                              {rec.checked_in_at ? new Date(rec.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Checked In'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !listError && !searchLoading && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  {filter ? `No attendees match "${filter}".` : "No registrations yet."}
                </div>
              )
            )}
            {!listError && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>{resultCount} attendee{resultCount === 1 ? '' : 's'} · Page {page + 1}</span>
              <div className="flex gap-4">
                <button disabled={page === 0 || searchLoading} onClick={() => setPage(p => p - 1)} className="underline disabled:opacity-40">Previous</button>
                <button disabled={(page + 1) * pageSize >= resultCount || searchLoading} onClick={() => setPage(p => p + 1)} className="underline disabled:opacity-40">Next</button>
              </div>
            </div>}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 p-4 text-center text-xs text-gray-500">
        YPS 2026 Committee Check-in Utility &bull; Realtime Event Attendance System
      </footer>
    </div>
  );
}
