import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Activity,
  DollarSign,
  Calendar as CalendarIcon,
  LogOut,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

export default function App() {
  // --- Auth & User Profile State ---
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // --- Cloud Data States ---
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [trades, setTrades] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSyncingMt5, setIsSyncingMt5] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // --- UI & Modal States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const accountDropdownRef = useRef(null);

  useEffect(() => {
    if (!isAccountDropdownOpen) return;

    const handleOutsideClick = (event) => {
      if (!accountDropdownRef.current?.contains(event.target)) {
        setIsAccountDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsAccountDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountDropdownOpen]);

  // --- Add Account Form States ---
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [enableMt5Sync, setEnableMt5Sync] = useState(true);
  const [mt5Login, setMt5Login] = useState('');
  const [mt5InvestorPassword, setMt5InvestorPassword] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountError, setAccountError] = useState('');

  // --- Clock & Calendar ---
  const [now, setNow] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // 1. Check & Listen for Auth Session across devices
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshTrades = useCallback(async () => {
    const { data: tradeData } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (tradeData) setTrades(tradeData);
  }, []);

  // 2. Fetch User's Accounts & Trades from Supabase once logged in
  useEffect(() => {
    if (!session?.user) {
      setAccounts([]);
      setTrades([]);
      setActiveAccountId('');
      return;
    }

    const fetchCloudData = async () => {
      setDataLoading(true);
      const { data: accData } = await supabase
        .from('trading_accounts')
        .select('*')
        .order('created_at', { ascending: true });

      await refreshTrades();

      const fetchedAccounts = accData || [];
      setAccounts(fetchedAccounts);

      if (fetchedAccounts.length === 0) {
        setIsAccountModalOpen(true);
      } else {
        setActiveAccountId((prev) =>
          fetchedAccounts.some((a) => a.id === prev) ? prev : fetchedAccounts[0].id
        );
      }
      setDataLoading(false);
    };

    fetchCloudData();

    // Realtime subscription for automatic MT5 trade inserts
    const channel = supabase
      .channel('trades-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        () => {
          refreshTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refreshTrades]);

  // Live 1-second EAT Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  // Trigger MT5 Cloud Sync for the active account
  const triggerMt5Sync = useCallback(
    async (targetAccountId, silent = false) => {
      if (!targetAccountId) return;
      setIsSyncingMt5(true);
      if (!silent) setSyncMessage('');

      const { data, error } = await supabase.functions.invoke('mt5-sync', {
        body: { action: 'sync', accountId: targetAccountId }
      });

      if (error || data?.error) {
        if (!silent) {
          setSyncMessage(data?.error || error?.message || 'MT5 sync pending...');
        }
      } else {
        await refreshTrades();
        if (!silent) {
          setSyncMessage(`Synced ${data?.syncedCount ?? 0} MT5 deals`);
        }
      }

      setIsSyncingMt5(false);
    },
    [refreshTrades]
  );

  // Auto-sync whenever an MT5-linked account becomes active + poll every 60s
  useEffect(() => {
    if (!activeAccount?.auto_sync_enabled || !activeAccount?.metaapi_account_id) {
      setSyncMessage('');
      return;
    }

    triggerMt5Sync(activeAccount.id, true);
    const interval = setInterval(() => {
      triggerMt5Sync(activeAccount.id, true);
    }, 60000);

    return () => clearInterval(interval);
  }, [activeAccount, triggerMt5Sync]);

  const traderName =
    session?.user?.user_metadata?.trader_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader';

  // Current EAT date string (YYYY-MM-DD) for dim green edge lighting
  const todayEatStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  }, [now]);

  const eatTimeData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '';

    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const second = getPart('second');
    const weekday = getPart('weekday');

    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0'
    )}:${second}`;

    const isWeekendClosed =
      weekday === 'Sun' ||
      (weekday === 'Sat' && hour >= 1) ||
      (weekday === 'Mon' && hour < 1);

    if (isWeekendClosed) {
      return { timeString, sessionName: 'Market Closed', isActive: false };
    }

    const isSydney = hour >= 1 && hour < 10;
    const isTokyo = hour >= 3 && hour < 12;
    const isLondon = hour >= 11 && hour < 20;
    const isNewYork = hour >= 16 || hour < 1;

    const activeList = [];
    if (isSydney) activeList.push('Sydney');
    if (isTokyo) activeList.push('Tokyo');
    if (isLondon) activeList.push('London');
    if (isNewYork) activeList.push('New York');

    if (activeList.length === 0) {
      return { timeString, sessionName: 'Inactive', isActive: false };
    }

    return {
      timeString,
      sessionName: activeList.join(' / '),
      isActive: true
    };
  }, [now]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { trader_name: email.trim().split('@')[0] }
        }
      });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) setAuthError(error.message);
    }

    setAuthSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- Profile & Data Handlers ---
  const handleSaveName = async () => {
    if (tempName.trim()) {
      const { data } = await supabase.auth.updateUser({
        data: { trader_name: tempName.trim() }
      });
      if (data?.user) {
        setSession((prev) => ({ ...prev, user: data.user }));
      }
    }
    setIsEditingName(false);
  };

  const handleCloseAccountModal = () => {
    if (accountCreating || accounts.length === 0) return;
    setIsAccountModalOpen(false);
    setAccountError('');
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount || !accountToDelete) return;
    if (!session?.user?.id) {
      setDeleteAccountError('Please sign in again before deleting this account.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteAccountError('');

    const { error: tradesDeleteError } = await supabase
      .from('trades')
      .delete()
      .eq('account_id', accountToDelete.id)
      .eq('user_id', session.user.id);

    if (tradesDeleteError) {
      setDeleteAccountError(tradesDeleteError.message);
      setIsDeletingAccount(false);
      return;
    }

    setTrades((prev) => prev.filter((trade) => trade.account_id !== accountToDelete.id));

    const { data: deletedAccount, error: accountDeleteError } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', accountToDelete.id)
      .eq('user_id', session.user.id)
      .select('id')
      .maybeSingle();

    if (accountDeleteError || !deletedAccount) {
      setDeleteAccountError(
        accountDeleteError
          ? `Trade history was deleted, but the account could not be deleted: ${accountDeleteError.message}`
          : 'Trade history was deleted, but the account could not be found or deleted.'
      );
      setIsDeletingAccount(false);
      return;
    }

    const remainingAccounts = accounts.filter((account) => account.id !== accountToDelete.id);
    setAccounts(remainingAccounts);
    if (activeAccountId === accountToDelete.id) {
      setActiveAccountId(remainingAccounts[0]?.id || '');
    }
    setShowAllTrades(false);
    setAccountToDelete(null);
    setIsDeletingAccount(false);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setAccountError('');
    const bal = parseFloat(newAccBalance);
    if (!newAccName.trim() || isNaN(bal) || bal <= 0 || !session?.user) return;

    if (enableMt5Sync && (!mt5Login.trim() || !mt5InvestorPassword || !mt5Server.trim())) {
      setAccountError('Enter MT5 Login, Investor Password, and Broker Server for auto-sync.');
      return;
    }

    setAccountCreating(true);

    const { data: createdAcc, error: insertErr } = await supabase
      .from('trading_accounts')
      .insert([
        {
          user_id: session.user.id,
          name: newAccName.trim(),
          initial_balance: bal
        }
      ])
      .select()
      .single();

    if (insertErr || !createdAcc) {
      setAccountError(insertErr?.message || 'Failed to create account.');
      setAccountCreating(false);
      return;
    }

    let finalAccount = createdAcc;

    if (enableMt5Sync) {
      const { data: connectData, error: connectErr } = await supabase.functions.invoke(
        'mt5-sync',
        {
          body: {
            action: 'connect',
            accountId: createdAcc.id,
            accountName: createdAcc.name,
            login: mt5Login.trim(),
            investorPassword: mt5InvestorPassword,
            server: mt5Server.trim()
          }
        }
      );

      if (connectErr || connectData?.error) {
        setAccountError(
          connectData?.error ||
            connectErr?.message ||
            'Account saved, but MT5 connection failed.'
        );
        setAccounts((prev) => [...prev, createdAcc]);
        setActiveAccountId(createdAcc.id);
        setAccountCreating(false);
        return;
      }

      finalAccount = {
        ...createdAcc,
        mt5_login: mt5Login.trim(),
        mt5_server: mt5Server.trim(),
        metaapi_account_id: connectData.metaapiAccountId,
        auto_sync_enabled: true
      };
    }

    setAccounts((prev) => [...prev, finalAccount]);
    setActiveAccountId(finalAccount.id);
    setNewAccName('');
    setNewAccBalance('');
    setMt5Login('');
    setMt5InvestorPassword('');
    setMt5Server('');
    setAccountCreating(false);
    setIsAccountModalOpen(false);
  };

  // --- Active Account & Metrics Calculations ---
  const accountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades
      .filter((t) => t.account_id === activeAccount.id)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.date) - new Date(a.created_at || a.date) ||
          new Date(b.date) - new Date(a.date)
      );
  }, [trades, activeAccount]);
  const visibleTrades = showAllTrades ? accountTrades : accountTrades.slice(0, 5);

  const metrics = useMemo(() => {
    const initial = activeAccount ? Number(activeAccount.initial_balance) : 0;
    const netPnl = accountTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const equity = initial + netPnl;

    const totalTrades = accountTrades.length;
    const winningTrades = accountTrades.filter((t) => Number(t.pnl) > 0).length;
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;

    const dailyMap = {};
    const dailyTradeCounts = {};
    accountTrades.forEach((t) => {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.pnl);
      dailyTradeCounts[t.date] = (dailyTradeCounts[t.date] || 0) + 1;
    });
    const dailyTotals = Object.values(dailyMap);
    const bestDay = dailyTotals.length > 0 ? Math.max(0, ...dailyTotals) : 0;

    const consistencyTarget = bestDay > 0 ? bestDay / 0.15 : 0;
    const isConsistencyMet = bestDay > 0 && netPnl >= consistencyTarget;

    let mostTraded = '—';
    if (accountTrades.length > 0) {
      const freq = {};
      let maxCount = 0;
      accountTrades.forEach((t) => {
        const sym = t.asset.toUpperCase();
        freq[sym] = (freq[sym] || 0) + 1;
        if (freq[sym] > maxCount) {
          maxCount = freq[sym];
          mostTraded = sym;
        }
      });
    }

    return {
      equity,
      netPnl,
      winRate,
      bestDay,
      consistencyTarget,
      isConsistencyMet,
      mostTraded,
      dailyMap,
      dailyTradeCounts
    };
  }, [activeAccount, accountTrades]);

  // --- Calendar Grid Grouped by Weeks (Sun-Sat + Weekly PnL Column) ---
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('en-US', { month: 'long' });

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const flatCells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      flatCells.push({ type: 'empty', key: `empty-start-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      const dayPnl = metrics.dailyMap[dateStr];
      const tradeCount = metrics.dailyTradeCounts[dateStr] || 0;
      flatCells.push({
        type: 'day',
        key: dateStr,
        day,
        dateStr,
        pnl: dayPnl,
        tradeCount
      });
    }

    // Pad trailing cells so every week row has 7 days (Sun -> Sat)
    while (flatCells.length % 7 !== 0) {
      flatCells.push({ type: 'empty', key: `empty-end-${flatCells.length}` });
    }

    const weeks = [];
    for (let i = 0; i < flatCells.length; i += 7) {
      const days = flatCells.slice(i, i + 7);
      let weekTotal = 0;
      let hasTrades = false;

      days.forEach((cell) => {
        if (cell.type === 'day' && cell.pnl !== undefined) {
          weekTotal += Number(cell.pnl);
          hasTrades = true;
        }
      });

      weeks.push({
        weekIndex: weeks.length + 1,
        days,
        weekTotal,
        hasTrades
      });
    }

    return { year, monthName, weeks };
  }, [currentDate, metrics.dailyMap, metrics.dailyTradeCounts]);

  const changeMonth = (offset) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const formatCurrency = (val) => {
    const abs = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return val < 0 ? `-$${abs}` : `$${abs}`;
  };

  const formatCompactPnl = (val) => {
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return `${sign}$${abs % 1 === 0 ? abs.toLocaleString() : abs.toFixed(2)}`;
  };

  const formatPrice = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5
    });
  };

  const selectorAccountName = activeAccount
    ? (activeAccount.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ')
    : dataLoading
    ? 'Syncing...'
    : 'No Account';

  // --- Loading Screen ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Loading Elite Trading Journal...
      </div>
    );
  }

  // --- Login / Profile Sign-Up Screen ---
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 justify-center">
              <span className="px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                PRO
              </span>
              <h1 className="text-xl font-bold text-white">Elite Trading Journal</h1>
            </div>
            <p className="text-xs text-zinc-400">
              {isSignUp
                ? 'Create a profile to sync your accounts across all devices'
                : 'Sign in to access your synced trading accounts'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
            >
              {authSubmitting ? 'Please wait...' : isSignUp ? 'Create Profile' : 'Sign In'}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              {isSignUp
                ? 'Already have a profile? Sign In'
                : "Don't have a profile? Create one"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Authenticated Journal ---
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                PRO
              </span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Elite Trading Journal
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm md:text-base font-semibold text-zinc-200 bg-zinc-900/90 border border-zinc-800 px-3 py-1 rounded-lg">
                {eatTimeData.timeString} <span className="text-xs text-zinc-500">EAT</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-sm font-medium text-zinc-300">{traderName}</span>
                  <button
                    onClick={() => {
                      setTempName(traderName);
                      setIsEditingName(true);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Edit Trader Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-zinc-300">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  eatTimeData.isActive
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                    : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                }`}
              />
              <span>{eatTimeData.sessionName}</span>
            </div>
          </div>

          <div className="border-b border-zinc-800/80 pt-1" />
        </header>

        {/* STYLED ACCOUNT SELECTOR (WITH GREEN EDGE LIGHTING) & MT5 SYNC BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeAccount?.auto_sync_enabled && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium">
                  MT5 Auto-Sync ({activeAccount.mt5_login})
                </span>
                <button
                  onClick={() => triggerMt5Sync(activeAccount.id, false)}
                  disabled={isSyncingMt5}
                  className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold transition-colors disabled:opacity-50"
                  title="Sync closed MT5 trades now"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingMt5 ? 'animate-spin' : ''}`} />
                  <span>{isSyncingMt5 ? 'Syncing' : 'Sync Now'}</span>
                </button>
              </div>
            )}
            {syncMessage && <span className="text-xs text-zinc-400">{syncMessage}</span>}
          </div>

          {/* Custom account switcher and add-account control */}
          <div className="relative ml-auto" ref={accountDropdownRef}>
            <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5">
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((open) => !open)}
                disabled={accounts.length === 0 || dataLoading}
                aria-haspopup="menu"
                aria-expanded={isAccountDropdownOpen}
                className="group inline-grid h-7 w-fit min-w-[80px] max-w-[190px] grid-cols-[12px_auto_20px] items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="col-start-2 block max-w-[150px] truncate whitespace-nowrap text-[11px] font-medium text-zinc-100">
                  {selectorAccountName}
                </span>
                <ChevronDown
                  className={`col-start-3 h-3.5 w-3.5 justify-self-end text-zinc-300 transition-transform ${
                    isAccountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountDropdownOpen(false);
                  setAccountError('');
                  setIsAccountModalOpen(true);
                }}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
                title="Add New Account"
                aria-label="Add new account"
              >
                <Plus className="h-3 w-3 stroke-[2.75]" />
              </button>
            </div>

            {isAccountDropdownOpen && accounts.length > 0 && (
              <div className="absolute right-0 z-40 mt-1.5 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Accounts
                  </p>
                  <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-zinc-400">
                    {accounts.length}
                  </span>
                </div>

                <div
                  role="menu"
                  aria-label="Trading accounts"
                  className="max-h-64 space-y-0.5 overflow-y-auto"
                >
                  {accounts.map((acc) => {
                    const isActive = acc.id === activeAccountId;
                    return (
                      <div
                        key={acc.id}
                        role="group"
                        className={`flex w-full items-center gap-1 rounded-lg border p-1 transition-colors ${
                          isActive
                            ? 'border-emerald-400/30 bg-emerald-500/[0.09]'
                            : 'border-zinc-700 bg-transparent hover:border-zinc-500'
                        }`}
                      >
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActive}
                          onClick={() => {
                            setActiveAccountId(acc.id);
                            setIsAccountDropdownOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
                            {acc.name}
                          </span>
                          {acc.auto_sync_enabled && (
                            <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1 py-0.5 text-[8px] font-semibold text-emerald-300">
                              MT5
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountDropdownOpen(false);
                            setAccountToDelete(acc);
                            setDeleteAccountError('');
                          }}
                          title={`Delete ${acc.name}`}
                          aria-label={`Delete ${acc.name}`}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2x3 METRICS GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Equity</p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                {formatCurrency(metrics.equity)}
              </p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Net PnL</p>
              <p
                className={`text-2xl font-bold mt-1 tabular-nums ${
                  metrics.netPnl > 0
                    ? 'text-emerald-400'
                    : metrics.netPnl < 0
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                {metrics.netPnl > 0
                  ? `+${formatCurrency(metrics.netPnl)}`
                  : formatCurrency(metrics.netPnl)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.netPnl >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {metrics.netPnl >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Win Rate</p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">{metrics.winRate}%</p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Best Day</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                {formatCurrency(metrics.bestDay)}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div
            className={`bg-zinc-900/80 border rounded-2xl p-5 flex items-center justify-between transition-all ${
              metrics.isConsistencyMet
                ? 'border-emerald-500/70 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                : 'border-rose-500/70 shadow-[0_0_16px_rgba(244,63,94,0.22)]'
            }`}
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                15% Consistency Score
              </p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                {formatCurrency(metrics.consistencyTarget)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.isConsistencyMet
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Most Traded
              </p>
              <p className="text-2xl font-bold text-white mt-1">{metrics.mostTraded}</p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300 font-mono text-xs font-bold">
              TOP
            </div>
          </div>
        </section>

        {/* AUTOMATED TRADE LOG (DATE, ASSET, DIRECTION, LOTS, ENP, EXP, PNL) */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-base font-semibold text-white">Trade Log</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-xs uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Lots</th>
                  <th className="py-3 px-4 text-right">ENP</th>
                  <th className="py-3 px-4 text-right">EXP</th>
                  <th className="py-3 px-4 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {accountTrades.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-zinc-500">
                      {dataLoading
                        ? 'Loading synced trades...'
                        : 'No trades synced for this account yet.'}
                    </td>
                  </tr>
                ) : (
                  visibleTrades.map((trade) => {
                    const isProfit = Number(trade.pnl) >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-zinc-300 whitespace-nowrap">
                          {trade.date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{trade.asset}</span>
                            {trade.mt5_deal_id && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                MT5
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              trade.direction === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {trade.lots}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {formatPrice(trade.enp)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {formatPrice(trade.exp)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit
                            ? `+${formatCurrency(Number(trade.pnl))}`
                            : formatCurrency(Number(trade.pnl))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {accountTrades.length > 5 && (
            <div className="flex justify-center border-t border-zinc-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAllTrades((showingAll) => !showingAll)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                {showAllTrades ? 'Show less' : 'Show more'}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showAllTrades ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        {/* MONTHLY CALENDAR WITH WEEKLY PNL COLUMN AFTER SATURDAY */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-zinc-400">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{calendarData.year}</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-white min-w-[130px] text-center">
                {calendarData.monthName}
              </h2>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[620px] space-y-1.5">
              {/* 8-Column Header: Sun - Sat + Weekly PnL */}
              <div className="grid grid-cols-8 gap-1.5 text-center text-xs font-semibold text-zinc-500 pt-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
                <div className="py-1 text-zinc-400">Week PnL</div>
              </div>

              {/* Weekly Rows */}
              {calendarData.weeks.map((week) => {
                const weekIsPos = week.hasTrades && week.weekTotal > 0;
                const weekIsNeg = week.hasTrades && week.weekTotal < 0;

                return (
                  <div key={`week-${week.weekIndex}`} className="grid grid-cols-8 gap-1.5">
                    {week.days.map((cell) => {
                      if (cell.type === 'empty') {
                        return (
                          <div
                            key={cell.key}
                            className="h-16 md:h-20 rounded-xl bg-zinc-950/30 border border-zinc-900/50"
                          />
                        );
                      }

                      const hasPnl = cell.pnl !== undefined;
                      const isPos = hasPnl && cell.pnl > 0;
                      const isNeg = hasPnl && cell.pnl < 0;
                      const isToday = cell.dateStr === todayEatStr;

                      return (
                        <div
                          key={cell.key}
                          className={`h-16 md:h-20 rounded-xl border p-2 flex flex-col justify-between transition-all ${
                            isPos
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : isNeg
                              ? 'bg-rose-500/10 border-rose-500/30'
                              : 'bg-zinc-950/70 border-zinc-800/80'
                          } ${
                            isToday
                              ? '!border-emerald-500/35 shadow-[0_0_8px_rgba(52,211,153,0.12)] ring-1 ring-emerald-500/15'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-medium ${
                                isToday ? 'text-emerald-400/80 font-semibold' : 'text-zinc-400'
                              }`}
                            >
                              {cell.day}
                            </span>
                            {cell.tradeCount > 0 && (
                              <span className="inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-emerald-500/15 px-1 text-[9px] font-semibold tabular-nums text-emerald-300">
                                {cell.tradeCount}
                              </span>
                            )}
                          </div>
                          {hasPnl && (
                            <span
                              className={`text-xs md:text-sm font-mono font-bold truncate tabular-nums ${
                                isPos
                                  ? 'text-emerald-400'
                                  : isNeg
                                  ? 'text-rose-400'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {formatCompactPnl(cell.pnl)}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Weekly PnL Summary Cell (After Saturday) */}
                    <div
                      className={`h-16 md:h-20 rounded-xl border p-2 flex flex-col justify-between transition-colors ${
                        weekIsPos
                          ? 'bg-emerald-500/15 border-emerald-500/40'
                          : weekIsNeg
                          ? 'bg-rose-500/15 border-rose-500/40'
                          : 'bg-zinc-950/90 border-zinc-800/90'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        W{week.weekIndex}
                      </span>
                      <span
                        className={`text-xs md:text-sm font-mono font-bold truncate tabular-nums ${
                          weekIsPos
                            ? 'text-emerald-400'
                            : weekIsNeg
                            ? 'text-rose-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {week.hasTrades ? formatCompactPnl(week.weekTotal) : '$0'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ADD ACCOUNT MODAL (CLICK OUTSIDE TO DISMISS) */}
      {isAccountModalOpen && (
        <div
          onClick={handleCloseAccountModal}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Trading Account</h3>
              {accounts.length > 0 && (
                <button
                  onClick={handleCloseAccountModal}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FTMO 100K"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Initial Balance ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="100000"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* MT5 Auto-Sync Toggle */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      Connect MT5 Auto-Sync
                    </span>
                    <span className="text-xs text-zinc-400">
                      Read-only investor access for automatic trade logging
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableMt5Sync}
                    onChange={(e) => setEnableMt5Sync(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                {enableMt5Sync && (
                  <div className="space-y-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        MT5 Login ID
                      </label>
                      <input
                        type="text"
                        required={enableMt5Sync}
                        placeholder="e.g. 51294810"
                        value={mt5Login}
                        onChange={(e) => setMt5Login(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Investor Password (Read-Only)
                      </label>
                      <input
                        type="password"
                        required={enableMt5Sync}
                        placeholder="Enter read-only investor password"
                        value={mt5InvestorPassword}
                        onChange={(e) => setMt5InvestorPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Broker Server
                      </label>
                      <div className="relative">
                        <Server className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required={enableMt5Sync}
                          placeholder="e.g. FTMO-Server3 or Exness-MT5Real7"
                          value={mt5Server}
                          onChange={(e) => setMt5Server(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-zinc-400 pt-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Use your <strong>Investor Password</strong> only. It grants read-only
                        history access and cannot place or modify trades.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {accountError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {accountError}
                </p>
              )}

              <button
                type="submit"
                disabled={accountCreating}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
              >
                {accountCreating
                  ? 'Connecting to MT5...'
                  : enableMt5Sync
                  ? 'Connect & Save Account'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {accountToDelete && (
        <div
          onClick={() => {
            if (!isDeletingAccount) {
              setAccountToDelete(null);
              setDeleteAccountError('');
            }
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.65)] ring-1 ring-white/5 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h3 id="delete-account-title" className="text-sm font-bold text-white">
              Delete account?
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              Delete '{accountToDelete.name}'?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              This will permanently delete the account and all of its trade history.
            </p>

            {deleteAccountError && (
              <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {deleteAccountError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountToDelete(null);
                  setDeleteAccountError('');
                }}
                disabled={isDeletingAccount}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingAccount ? 'Deleting...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}