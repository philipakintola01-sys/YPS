'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLogo from '@/app/components/SiteLogo';
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

  // Edit Attendee Name & Delete Attendee state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const listRequest = useRef(0);
  const pageSize = 25;
  const loadAttendees = useCallback(async () => {
    if (!currentUser) return;
    const request = ++listRequest.current;
    setSearchLoading(true);
    setListError(null);
    try {
      let query = supabase
        .from('registrations')
        .select('*', { count: 'exact' })
        .eq('registration_status', 'registered');
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
    const timeout = setTimeout(() => {
      void loadAttendees();
    }, 0);
    const timer = setInterval(() => {
      void loadAttendees();
    }, 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [loadAttendees]);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Verify User Authentication & Load Profile
  useEffect(() => {
    async function checkAuth() {
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('preview') === 'admin') {
            setCurrentUser({
              id: 'mock-admin-id',
              email: 'admin@yps2026.org',
              name: 'Summit Administrator',
              role: 'admin',
            });
            setCountsReady(true);
            setTotalRegistered(1450);
            setTotalCheckedIn(620);
            setSearchResults([
              {
                id: '1',
                registration_id: 'YPS26-4821',
                full_name: 'David Adeleke',
                phone_number: '08012345678',
                email: 'david.adeleke@example.com',
                church_organisation: 'Grace Baptist Church',
                age_bracket: '18-24',
                gender: 'Male',
                registration_status: 'registered',
                checkin_status: 'not_checked_in',
                checked_in_at: null,
                checked_in_by: null,
              },
              {
                id: '2',
                registration_id: 'YPS26-9132',
                full_name: 'Grace Okafor',
                phone_number: '08098765432',
                email: 'grace.okafor@example.com',
                church_organisation: 'First Baptist Bariga',
                age_bracket: '13-17',
                gender: 'Female',
                registration_status: 'registered',
                checkin_status: 'checked_in',
                checked_in_at: new Date().toISOString(),
                checked_in_by: 'mock-admin-id',
              },
            ]);
            setResultCount(2);
            setSearchLoading(false);
            setAuthLoading(false);
            return;
          }
        }

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
        .select('*', { count: 'exact', head: true })
        .eq('registration_status', 'registered');

      const { count: checkedIn, error: checkedError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('registration_status', 'registered')
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

  const handlePrimaryLookup = useCallback(async (codeSuffix: string) => {
    const fullId = `YPS26-${codeSuffix.toUpperCase()}`;
    setSearchingCode(true);
    setNotFound(false);
    setActionError(null);

    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', fullId)
        .eq('registration_status', 'registered')
        .single();

      if (error || !data) {
        setActiveRecord(null);
        setNotFound(true);
      } else {
        setActiveRecord(data as RegistrationRecord);
      }
    } catch {
      setActiveRecord(null);
      setNotFound(true);
    } finally {
      setSearchingCode(false);
    }
  }, [supabase]);

  // 3. Auto-trigger Primary Lookup on 4th Character Entry
  useEffect(() => {
    const trimmed = suffix.trim();
    if (trimmed.length === 4) {
      const timeout = setTimeout(() => {
        void handlePrimaryLookup(trimmed);
      }, 0);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setActiveRecord(null);
        setNotFound(false);
        setActionError(null);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [suffix, handlePrimaryLookup]);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Update Attendee Name Action
  const handleUpdateAttendeeName = async (regId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setActionError('Attendee name cannot be empty.');
      return;
    }

    setEditLoading(true);
    setActionError(null);

    try {
      const response = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: regId,
          action: 'update_name',
          full_name: trimmed,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update attendee name');
      }

      if (result.record) {
        if (activeRecord && activeRecord.registration_id === regId) {
          setActiveRecord(result.record);
        }
        setSearchResults((prev) =>
          prev.map((item) => (item.registration_id === regId ? result.record : item))
        );
        setEditingId(null);
        setEditingName('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update attendee name';
      setActionError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  // 6. Cancel Attendee Registration Action (Admin Only)
  const handleCancelAttendee = async (regId: string) => {
    setDeleteLoadingId(regId);
    setActionError(null);

    try {
      const response = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: regId,
          action: 'cancel',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel attendee registration');
      }

      if (activeRecord && activeRecord.registration_id === regId) {
        setActiveRecord(null);
        setSuffix('');
      }

      setSearchResults((prev) => prev.filter((item) => item.registration_id !== regId));
      setResultCount((prev) => Math.max(0, prev - 1));
      void loadAttendees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel attendee registration';
      setActionError(msg);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // 7. Export Registrations to CSV (Admin Only, REQ-5.4.2)
  const handleExportCSV = async () => {
    setExportLoading(true);
    setActionError(null);
    try {
      const response = await fetch('/api/check-in/export');
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to export registrations');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yps_registrations_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export CSV';
      setActionError(msg);
    } finally {
      setExportLoading(false);
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
      <header className="bg-[#0A0F24] border-b-2 border-black px-4 sm:px-6 py-2.5 shadow-md sticky top-0 z-30">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0 flex items-center">
              <SiteLogo />
            </Link>
            <span className="text-xs bg-[#E5A93C] text-black font-black uppercase px-2.5 py-1 border border-black shadow-[2px_2px_0px_#000] hidden sm:inline-block">
              Check-in Portal
            </span>
          </div>

          {/* Committee Member Info & Logout */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="font-bold text-white block sm:inline">{currentUser?.name}</span>{' '}
              <span className="text-white/60 uppercase font-mono text-[11px]">({currentUser?.role?.replace('_', ' ')})</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
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
        {actionError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{actionError}</p>}
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

            {/* Attendee Found Card & Check-in Action (REQ-6.1.2) */}
            {activeRecord && !searchingCode && (
              <div className="border-2 border-blue-800 rounded-xl p-6 bg-blue-50/50 space-y-4 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-blue-200 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-200 px-2.5 py-1 rounded">
                      {activeRecord.registration_id}
                    </span>
                    {editingId === activeRecord.registration_id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="bg-white border-2 border-blue-900 rounded px-3 py-1 font-bold text-lg text-gray-900 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={editLoading}
                          onClick={() => handleUpdateAttendeeName(activeRecord.registration_id, editingName)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded cursor-pointer disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName('');
                          }}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs px-3 py-1.5 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <h2 className="text-2xl font-bold text-gray-900">
                          {activeRecord.full_name}
                        </h2>
                        {currentUser?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(activeRecord.registration_id);
                              setEditingName(activeRecord.full_name);
                            }}
                            className="text-xs text-blue-800 hover:underline font-semibold cursor-pointer"
                            title="Edit Attendee Name"
                          >
                            [Edit Name]
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRecord.checkin_status === 'checked_in' ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        ✓ CHECKED IN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                        NOT CHECKED IN
                      </span>
                    )}

                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        disabled={deleteLoadingId === activeRecord.registration_id}
                        onClick={() => setConfirmDeleteTarget({ id: activeRecord.registration_id, name: activeRecord.full_name })}
                        className="text-xs bg-red-100 border border-red-300 text-red-800 hover:bg-red-200 font-bold px-3 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
                        title="Cancel this attendee registration"
                      >
                        {deleteLoadingId === activeRecord.registration_id ? 'Cancelling...' : 'Cancel Registration'}
                      </button>
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
              <div className="flex items-center gap-3">
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={handleExportCSV}
                    disabled={exportLoading}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Export attendee registrations to CSV"
                  >
                    {exportLoading ? 'Exporting...' : '📥 Export CSV'}
                  </button>
                )}
                <button onClick={() => void loadAttendees()} disabled={searchLoading} className="text-blue-900 underline text-sm disabled:opacity-50">Refresh list</button>
              </div>
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
                      <th className="p-3 whitespace-nowrap">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3 whitespace-nowrap">Phone</th>
                      <th className="p-3">Church</th>
                      <th className="p-3 whitespace-nowrap">Status</th>
                      <th className="p-3 text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {searchResults.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-bold text-blue-900 whitespace-nowrap">{rec.registration_id}</td>
                        <td className="p-3">
                          {editingId === rec.registration_id ? (
                            <div className="flex items-center gap-1.5 min-w-[200px]">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="w-full bg-white border border-blue-900 rounded px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={editLoading}
                                onClick={() => handleUpdateAttendeeName(rec.registration_id, editingName)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2 py-1 rounded cursor-pointer disabled:opacity-50"
                                title="Save"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName('');
                                }}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs px-2 py-1 rounded cursor-pointer"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{rec.full_name}</span>
                              {currentUser?.role === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(rec.registration_id);
                                    setEditingName(rec.full_name);
                                  }}
                                  className="text-gray-400 hover:text-blue-900 text-xs cursor-pointer p-0.5"
                                  title="Edit Name"
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">{rec.phone_number}</td>
                        <td className="p-3 text-gray-600">{rec.church_organisation}</td>
                        <td className="p-3 whitespace-nowrap">
                          {rec.checkin_status === 'checked_in' ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs bg-amber-50 text-amber-800 border border-amber-300 font-semibold px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Not Checked In
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
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

                            {currentUser?.role === 'admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(rec.registration_id);
                                    setEditingName(rec.full_name);
                                  }}
                                  className="border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold text-xs px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                                  title="Edit attendee name"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  disabled={deleteLoadingId === rec.registration_id}
                                  onClick={() => setConfirmDeleteTarget({ id: rec.registration_id, name: rec.full_name })}
                                  className="border border-red-300 hover:border-red-500 bg-red-50 text-red-700 font-semibold text-xs px-2.5 py-1.5 rounded transition-colors cursor-pointer disabled:opacity-50"
                                  title="Cancel attendee registration"
                                >
                                  {deleteLoadingId === rec.registration_id ? 'Cancelling...' : 'Cancel'}
                                </button>
                              </>
                            )}
                          </div>
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

      {/* Explicit Cancel Confirmation Dialog Modal */}
      {confirmDeleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-200 space-y-5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xl font-bold">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Confirm Registration Cancellation</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Are you sure you want to cancel the registration for{' '}
                  <strong className="text-gray-900">{confirmDeleteTarget.name}</strong> (
                  <span className="font-mono font-bold text-blue-900">{confirmDeleteTarget.id}</span>)?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
              <strong>Audit Trail Notice:</strong> This action will mark registration status as cancelled and exclude the attendee from live attendance. An immutable audit record will be logged with your administrator account (<strong>{currentUser?.name}</strong>).
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={Boolean(deleteLoadingId)}
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold text-sm cursor-pointer disabled:opacity-50"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={Boolean(deleteLoadingId)}
                onClick={async () => {
                  const target = confirmDeleteTarget;
                  setConfirmDeleteTarget(null);
                  await handleCancelAttendee(target.id);
                }}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteLoadingId === confirmDeleteTarget.id ? 'Cancelling...' : 'Yes, Cancel Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-gray-200 p-4 text-center text-xs text-gray-500">
        YPS 2026 Committee Check-in Utility &bull; Realtime Event Attendance System
      </footer>
    </div>
  );
}
