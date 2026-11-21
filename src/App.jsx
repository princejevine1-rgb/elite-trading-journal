import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  PlusCircle,
  LogOut,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck
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
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  // --- Form States ---
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [enableMt5Sync, setEnableMt5Sync] = useState(true);
  const [mt5Login, setMt5Login] = useState('');
  const [mt5InvestorPassword, setMt5InvestorPassword] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tradeAsset, setTradeAsset] = useState('XAUUSD');
  const [tradeDirection, setTradeDirection] = useState('BUY');
  const [tradeLots, setTradeLots] = useState('0.10');
  const [tradePnl, setTradePnl] = useState('');

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

    // Realtime subscription for automatic trade inserts
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

  const handleLogTrade = async (e) => {
    e.preventDefault();
    if (!activeAccount || !session?.user) return;
    const pnlVal = parseFloat(tradePnl);
    const lotsVal = parseFloat(tradeLots);
    if (!tradeDate || !tradeAsset.trim() || isNaN(pnlVal) || isNaN(lotsVal)) return;

    const { data, error } = await supabase
      .from('trades')
      .insert([
        {
          user_id: session.user.id,
          account_id: activeAccount.id,
          date: tradeDate,
          asset: tradeAsset.trim().toUpperCase(),
          direction: tradeDirection,
          lots: lotsVal.toFixed(2),
          pnl: pnlVal
        }
      ])
      .select()
      .single();

    if (!error && data) {
      setTrades((prev) => [data, ...prev]);
      setTradePnl('');
      setIsTradeModalOpen(false);
    }
  };

  // --- Active Account & Metrics Calculations ---
  const accountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades
      .filter((t) => t.account_id === activeAccount.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [trades, activeAccount]);

  const metrics = useMemo(() => {
    const initial = activeAccount ? Number(activeAccount.initial_balance) : 0;
    const netPnl = accountTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const equity = initial + netPnl;

    const totalTrades = accountTrades.length;
    const winningTrades = accountTrades.filter((t) => Number(t.pnl) > 0).length;
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;

    const dailyMap = {};
    accountTrades.forEach((t) => {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.pnl);
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
      dailyMap
    };
  }, [activeAccount, accountTrades]);

  // --- Standard Calendar Grid Logic ---
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('en-US', { month: 'long' });

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ type: 'empty', key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      const dayPnl = metrics.dailyMap[dateStr];
      cells.push({
        type: 'day',
        key: dateStr,
        day,
        dateStr,
        pnl: dayPnl
      });
    }

    return { year, monthName, cells };
  }, [currentDate, metrics.dailyMap]);

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

        {/* ACCOUNT & MT5 AUTO-SYNC BAR */}
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
            {syncMessage && (
              <span className="text-xs text-zinc-400">{syncMessage}</span>
            )}
          </div>

          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 ml-auto">
            <select
              value={activeAccountId}
              onChange={(e) => setActiveAccountId(e.target.value)}
              className="bg-zinc-950 text-sm font-medium text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-700"
              disabled={accounts.length === 0 || dataLoading}
            >
              {accounts.length === 0 ? (
                <option value="">{dataLoading ? 'Syncing...' : 'No Account'}</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => {
                setAccountError('');
                setIsAccountModalOpen(true);
              }}
              className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-colors"
              title="Add New Account"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
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

        {/* TRADE LOG */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Trade Log</h2>
            <button
              onClick={() => setIsTradeModalOpen(true)}
              disabled={!activeAccount}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 text-sm font-semibold rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Trade</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-xs uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Lots</th>
                  <th className="py-3 px-4 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {accountTrades.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-zinc-500">
                      {dataLoading
                        ? 'Loading synced trades...'
                        : 'No trades logged for this account yet.'}
                    </td>
                  </tr>
                ) : (
                  accountTrades.map((trade) => {
                    const isProfit = Number(trade.pnl) >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-zinc-300">{trade.date}</td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{trade.asset}</span>
                            {trade.mt5_deal_id && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                MT5
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-4 font-mono text-zinc-300 tabular-nums">
                          {trade.lots}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
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
        </section>

        {/* STANDARD MONTHLY CALENDAR */}
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

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-zinc-500 pt-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarData.cells.map((cell) => {
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

              return (
                <div
                  key={cell.key}
                  className={`h-16 md:h-20 rounded-xl border p-2 flex flex-col justify-between transition-colors ${
                    isPos
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : isNeg
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-zinc-950/70 border-zinc-800/80'
                  }`}
                >
                  <span className="text-xs font-medium text-zinc-400">{cell.day}</span>
                  {hasPnl && (
                    <span
                      className={`text-xs md:text-sm font-mono font-bold truncate tabular-nums ${
                        isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-zinc-300'
                      }`}
                    >
                      {formatCompactPnl(cell.pnl)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ADD ACCOUNT MODAL (WITH MT5 AUTO-SYNC CREDENTIALS) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Trading Account</h3>
              {accounts.length > 0 && (
                <button
                  onClick={() => setIsAccountModalOpen(false)}
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

      {/* MANUAL LOG TRADE MODAL */}
      {isTradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Log Manual Trade</h3>
              <button
                onClick={() => setIsTradeModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Asset</label>
                  <input
                    type="text"
                    required
                    placeholder="XAUUSD"
                    value={tradeAsset}
                    onChange={(e) => setTradeAsset(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Direction
                  </label>
                  <select
                    value={tradeDirection}
                    onChange={(e) => setTradeDirection(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Lots</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={tradeLots}
                    onChange={(e) => setTradeLots(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Net PnL ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 240.50 or -115.00"
                  value={tradePnl}
                  onChange={(e) => setTradePnl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
              >
                Save Trade
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}