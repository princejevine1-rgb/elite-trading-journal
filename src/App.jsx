import React, { useState, useEffect, useMemo } from 'react';
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
  Mail
} from 'lucide-react';

const getTradingDayInfo = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    isWeekend: ['Sat', 'Sun'].includes(getPart('weekday'))
  };
};

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

  // --- UI & Modal States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isWeekendNoticeOpen, setIsWeekendNoticeOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // --- Form States ---
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');

  const [tradeDate, setTradeDate] = useState(() => getTradingDayInfo(new Date()).date);
  const [tradeAsset, setTradeAsset] = useState('XAUUSD');
  const [tradeDirection, setTradeDirection] = useState('BUY');
  const [tradeLots, setTradeLots] = useState('');
  const [tradePnl, setTradePnl] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);

  // --- Clock & Calendar ---
  const [now, setNow] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const tradingDayInfo = getTradingDayInfo(now);

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

      const { data: tradeData } = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      const fetchedAccounts = accData || [];
      setAccounts(fetchedAccounts);
      setTrades(tradeData || []);

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
  }, [session]);

  // Live 1-second EAT Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    const bal = parseFloat(newAccBalance);
    if (!newAccName.trim() || isNaN(bal) || bal <= 0 || !session?.user) return;

    const { data, error } = await supabase
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

    if (!error && data) {
      setAccounts((prev) => [...prev, data]);
      setActiveAccountId(data.id);
      setNewAccName('');
      setNewAccBalance('');
      setIsAccountModalOpen(false);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Delete "${account.name}" and all of its trades?`)) return;

    await supabase.from('trades').delete().eq('account_id', account.id);
    const { error } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', account.id);

    if (error) return;

    const remainingAccounts = accounts.filter((item) => item.id !== account.id);
    setAccounts(remainingAccounts);
    setTrades((prev) => prev.filter((trade) => trade.account_id !== account.id));
    setActiveAccountId((prev) =>
      prev === account.id
        ? remainingAccounts[0]?.id || ''
        : prev
    );
    setIsAccountDropdownOpen(false);
  };

  const handleLogTrade = async (e) => {
    e.preventDefault();
    setTradeError('');
    if (tradeSubmitting) return;
    const currentTradingDay = getTradingDayInfo(new Date());
    if (currentTradingDay.isWeekend) {
      setIsTradeModalOpen(false);
      setIsWeekendNoticeOpen(true);
      return;
    }
    if (!activeAccount || !session?.user) {
      setTradeError('You need an active account and signed-in session to save a trade.');
      return;
    }
    const lotsVal = parseFloat(tradeLots);
    const pnlVal = parseFloat(tradePnl);
    if (!tradeDate || tradeDate !== currentTradingDay.date) {
      setTradeError('Trades can only be logged for today.');
      return;
    }
    if (
      !tradeAsset.trim() ||
      !Number.isFinite(lotsVal) ||
      lotsVal <= 0 ||
      !Number.isFinite(pnlVal)
    ) {
      setTradeError('Enter an asset, positive lot size, and valid PnL amount.');
      return;
    }

    setTradeSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .insert([
          {
            user_id: session.user.id,
            account_id: activeAccount.id,
            date: tradeDate,
            asset: tradeAsset.trim().toUpperCase(),
            direction: tradeDirection,
            lots: lotsVal,
            pnl: pnlVal
          }
        ])
        .select()
        .single();

      if (error) {
        setTradeError(`Could not save trade: ${error.message}`);
        return;
      }
      if (!data) {
        setTradeError('Could not save trade: no trade record was returned.');
        return;
      }

      setTrades((prev) => [data, ...prev]);
      setTradeLots('');
      setTradePnl('');
      setIsTradeModalOpen(false);
    } catch (error) {
      setTradeError(
        `Could not save trade: ${
          error instanceof Error ? error.message : 'An unexpected error occurred.'
        }`
      );
    } finally {
      setTradeSubmitting(false);
    }
  };

  const handleOpenTradeModal = () => {
    const currentTradingDay = getTradingDayInfo(new Date());
    if (currentTradingDay.isWeekend) {
      setIsWeekendNoticeOpen(true);
      return;
    }

    setTradeDate(currentTradingDay.date);
    setTradeError('');
    setIsTradeModalOpen(true);
  };

  // --- Active Account & Metrics Calculations ---
  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

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

    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) {
      const weekCells = cells.slice(index, index + 7);
      const hasDay = weekCells.some((cell) => cell.type === 'day');
      if (!hasDay) continue;

      const pnl = weekCells.reduce(
        (sum, cell) => sum + (cell.type === 'day' && cell.pnl !== undefined ? cell.pnl : 0),
        0
      );
      const firstDay = weekCells.find((cell) => cell.type === 'day')?.day;
      const lastDay = [...weekCells].reverse().find((cell) => cell.type === 'day')?.day;
      weeks.push({
        key: `week-${index}`,
        label: firstDay === lastDay ? `${monthName} ${firstDay}` : `${monthName} ${firstDay}-${lastDay}`,
        pnl
      });
    }

    return { year, monthName, cells, weeks };
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

        {/* RIGHT-ALIGNED COMPACT ACCOUNT BAR */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((open) => !open)}
                disabled={accounts.length === 0 || dataLoading}
                className="bg-zinc-950 text-sm font-medium text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-700 min-w-[140px] text-left"
              >
                {activeAccount?.name || (dataLoading ? 'Syncing...' : 'No Account')}
              </button>
              {isAccountDropdownOpen && accounts.length > 0 && (
                <div className="absolute right-0 mt-1.5 z-30 w-56 bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-xl">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${
                        acc.id === activeAccountId ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAccountId(acc.id);
                          setIsAccountDropdownOpen(false);
                        }}
                        className="flex-1 text-left text-sm text-zinc-100 truncate"
                      >
                        {acc.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc)}
                        className="ml-2 p-0.5 text-rose-500 hover:text-rose-400"
                        title={`Delete ${acc.name}`}
                        aria-label={`Delete ${acc.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setIsAccountModalOpen(true)}
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
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(metrics.equity)}</p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Net PnL</p>
              <p
                className={`text-2xl font-bold mt-1 ${
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
              <p className="text-2xl font-bold text-white mt-1">{metrics.winRate}%</p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Best Day</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
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
              <p className="text-2xl font-bold text-white mt-1">
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
              onClick={handleOpenTradeModal}
              disabled={!activeAccount && !tradingDayInfo.isWeekend}
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
                  <th className="py-3 px-4 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {accountTrades.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-zinc-500">
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
                        <td className="py-3 px-4 font-semibold text-white">{trade.asset}</td>
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
                        <td
                          className={`py-3 px-4 text-right font-mono font-semibold ${
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

          <div className="grid grid-cols-8 gap-1.5 text-center text-xs font-semibold text-zinc-500 pt-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
            <div className="py-1 text-[10px] uppercase">Weekly PnL</div>
          </div>

          <div className="space-y-1.5">
            {Array.from({ length: Math.ceil(calendarData.cells.length / 7)}, (_, rowIndex) => {
              const weekCells = calendarData.cells.slice(rowIndex * 7, rowIndex * 7 + 7);
              const weekPnl = weekCells.reduce(
                (sum, cell) => sum + (cell.type === 'day' && cell.pnl !== undefined ? cell.pnl : 0),
                0
              );

              return (
                <div key={`week-row-${rowIndex}`} className="grid grid-cols-8 gap-1.5">
                  {weekCells.map((cell) => {
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
                            className={`text-xs md:text-sm font-mono font-bold truncate ${
                              isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-zinc-300'
                            }`}
                          >
                            {formatCompactPnl(cell.pnl)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {weekCells.length < 7 &&
                    Array.from({ length: 7 - weekCells.length }, (_, index) => (
                      <div
                        key={`week-end-empty-${index}`}
                        className="h-16 md:h-20 rounded-xl bg-zinc-950/30 border border-zinc-900/50"
                      />
                    ))}
                  <div
                    className={`h-16 md:h-20 rounded-xl border p-2 flex flex-col justify-center items-center ${
                      weekPnl > 0
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : weekPnl < 0
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-zinc-950/70 border-zinc-800/80'
                    }`}
                  >
                    <span
                      className={`text-xs md:text-sm font-mono font-bold text-center ${
                        weekPnl > 0
                          ? 'text-emerald-400'
                          : weekPnl < 0
                          ? 'text-rose-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {formatCurrency(weekPnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ADD ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5">
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

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOG TRADE MODAL */}
      {isTradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Log Trade</h3>
              <button
                onClick={() => {
                  setIsTradeModalOpen(false);
                  setTradeError('');
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogTrade} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  min={tradingDayInfo.date}
                  max={tradingDayInfo.date}
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Asset</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. XAUUSD, EURUSD, BTCUSD"
                  value={tradeAsset}
                  onChange={(e) => setTradeAsset(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeDirection('BUY')}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      tradeDirection === 'BUY'
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-950 border border-zinc-800 text-emerald-400'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeDirection('SELL')}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      tradeDirection === 'SELL'
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-950 border border-zinc-800 text-rose-400'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Lots</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="e.g. 0.10"
                  value={tradeLots}
                  onChange={(e) => setTradeLots(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">PnL ($)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 450 or -120"
                  value={tradePnl}
                  onChange={(e) => setTradePnl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {tradeError && (
                <p role="alert" className="text-sm text-rose-400">
                  {tradeError}
                </p>
              )}

              <button
                type="submit"
                disabled={tradeSubmitting}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
              >
                {tradeSubmitting ? 'Saving...' : 'Save Trade'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isWeekendNoticeOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekend-notice-title"
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <h3 id="weekend-notice-title" className="text-lg font-bold text-white">
              Enjoy Your Weekend
            </h3>
            <p className="text-sm text-zinc-400">
              Trades can only be logged Monday through Friday.
            </p>
            <button
              type="button"
              onClick={() => setIsWeekendNoticeOpen(false)}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}