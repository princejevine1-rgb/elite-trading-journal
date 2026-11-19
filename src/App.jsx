import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  Target,
  BarChart2,
  Calendar as CalendarIcon,
  Clock,
  User,
  Check,
  X
} from 'lucide-react';

export default function App() {
  // --- Persistent State ---
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_journal_accounts_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeAccountId, setActiveAccountId] = useState(() => {
    return localStorage.getItem('elite_journal_active_id_v2') || '';
  });

  const [trades, setTrades] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_journal_trades_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [traderName, setTraderName] = useState(() => {
    return localStorage.getItem('elite_journal_trader_name') || 'Prince Jevine';
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(traderName);

  // --- Modals & Calendar State ---
  const [showAccountModal, setShowAccountModal] = useState(accounts.length === 0);
  const [showTradeModal, setShowTradeModal] = useState(false);

  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');

  const [tradeDate, setTradeDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [tradeAsset, setTradeAsset] = useState('XAUUSD');
  const [tradeDirection, setTradeDirection] = useState('BUY');
  const [tradeLots, setTradeLots] = useState('0.10');
  const [tradePnl, setTradePnl] = useState('');

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [eatTimeStr, setEatTimeStr] = useState('');
  const [sessionStatus, setSessionStatus] = useState({ label: 'Closed', active: false });

  // --- Sync to LocalStorage ---
  useEffect(() => {
    localStorage.setItem('elite_journal_accounts_v2', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('elite_journal_active_id_v2', activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    localStorage.setItem('elite_journal_trades_v2', JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem('elite_journal_trader_name', traderName);
  }, [traderName]);

  // --- Live EAT Clock & Market Session Logic ---
  useEffect(() => {
    const updateClockAndSession = () => {
      const now = new Date();
      // Convert to EAT (UTC+3)
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const eatDate = new Date(utcMs + 3 * 3600000);

      const hours = eatDate.getHours();
      const minutes = eatDate.getMinutes();
      const seconds = eatDate.getSeconds();
      const dayOfWeek = eatDate.getDay(); // 0 = Sun, 6 = Sat

      const pad = (n) => String(n).padStart(2, '0');
      setEatTimeStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)} EAT`);

      // Forex weekend market closure check (Closes Sat 01:00 EAT, Opens Mon 01:00 EAT)
      const isWeekendClosed =
        dayOfWeek === 0 ||
        (dayOfWeek === 6 && hours >= 1) ||
        (dayOfWeek === 1 && hours < 1);

      if (isWeekendClosed) {
        setSessionStatus({ label: 'Closed', active: false });
        return;
      }

      // Active sessions in EAT:
      // Sydney: 01:00 - 10:00
      // Tokyo:  03:00 - 12:00
      // London: 11:00 - 20:00
      // NY:     16:00 - 01:00 (next day, i.e., hours >= 16 || hours < 1)
      const activeSessions = [];
      if (hours >= 1 && hours < 10) activeSessions.push('Sydney');
      if (hours >= 3 && hours < 12) activeSessions.push('Tokyo');
      if (hours >= 11 && hours < 20) activeSessions.push('London');
      if (hours >= 16 || hours < 1) activeSessions.push('New York');

      if (activeSessions.length === 0) {
        setSessionStatus({ label: 'Closed', active: false });
      } else {
        setSessionStatus({
          label: activeSessions.join(' / '),
          active: true
        });
      }
    };

    updateClockAndSession();
    const interval = setInterval(updateClockAndSession, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Active Account & Metrics Calculations ---
  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || accounts[0] || null,
    [accounts, activeAccountId]
  );

  const accountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades
      .filter((t) => t.accountId === activeAccount.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [trades, activeAccount]);

  const metrics = useMemo(() => {
    const initialBalance = activeAccount ? Number(activeAccount.initialBalance) : 0;
    const netPnl = accountTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const equity = initialBalance + netPnl;

    const totalTrades = accountTrades.length;
    const wins = accountTrades.filter((t) => Number(t.pnl) > 0).length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    // Group PnL by date to find Best Day
    const dailyMap = {};
    accountTrades.forEach((t) => {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.pnl);
    });

    const dailyValues = Object.values(dailyMap);
    const bestDay = dailyValues.length > 0 ? Math.max(0, ...dailyValues) : 0;

    // Consistency Score Target = Best Day / 0.15
    const consistencyTarget = bestDay > 0 ? bestDay / 0.15 : 0;
    const isConsistencyMet = bestDay > 0 && netPnl >= consistencyTarget;

    // Most Traded Commodity / Symbol
    const symbolCounts = {};
    accountTrades.forEach((t) => {
      const sym = t.asset.toUpperCase();
      symbolCounts[sym] = (symbolCounts[sym] || 0) + 1;
    });

    let mostTraded = 'N/A';
    let maxCount = 0;
    Object.entries(symbolCounts).forEach(([sym, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostTraded = sym;
      }
    });

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

  // --- Handlers ---
  const handleAddAccount = (e) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccBalance) return;

    const newAcc = {
      id: Date.now().toString(),
      name: newAccName.trim(),
      initialBalance: parseFloat(newAccBalance)
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    setActiveAccountId(newAcc.id);
    setNewAccName('');
    setNewAccBalance('');
    setShowAccountModal(false);
  };

  const handleAddTrade = (e) => {
    e.preventDefault();
    if (!activeAccount || !tradeAsset.trim() || tradePnl === '') return;

    const newTrade = {
      id: Date.now().toString(),
      accountId: activeAccount.id,
      date: tradeDate,
      asset: tradeAsset.trim().toUpperCase(),
      direction: tradeDirection,
      lots: parseFloat(tradeLots || '0.01').toFixed(2),
      pnl: parseFloat(tradePnl)
    };

    setTrades([newTrade, ...trades]);
    setTradePnl('');
    setShowTradeModal(false);
  };

  const saveTraderName = () => {
    if (tempName.trim()) {
      setTraderName(tempName.trim());
    } else {
      setTempName(traderName);
    }
    setIsEditingName(false);
  };

  // --- Calendar Grid Logic ---
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;
      cells.push({
        day,
        dateKey,
        pnl: metrics.dailyMap[dateKey] ?? null
      });
    }

    return {
      year,
      monthName: currentDate.toLocaleString('en-US', { month: 'long' }),
      cells
    };
  }, [currentDate, metrics.dailyMap]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const formatCurrency = (val) => {
    const absVal = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return val < 0 ? `-$${absVal}` : `$${absVal}`;
  };

  const formatSignedCurrency = (val) => {
    const absVal = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (val > 0) return `+$${absVal}`;
    if (val < 0) return `-$${absVal}`;
    return `$0.00`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/30 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* HEADER */}
        <header className="space-y-3">
          {/* Line 1: Title & Live Clock */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                PRO
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Elite Trading Journal
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-zinc-300 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{eatTimeStr}</span>
            </div>
          </div>

          {/* Line 2: Trader Name & Active Session */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTraderName()}
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    onClick={saveTraderName}
                    className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempName(traderName);
                    setIsEditingName(true);
                  }}
                  className="font-medium text-zinc-200 hover:text-white transition-colors"
                  title="Click to edit trader name"
                >
                  {traderName}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/70 border border-zinc-800/90 px-3 py-1 rounded-full">
              <span
                className={`w-2 h-2 rounded-full ${
                  sessionStatus.active
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                }`}
              />
              <span className="text-xs font-medium text-zinc-200">
                {sessionStatus.label}
              </span>
            </div>
          </div>

          {/* Line 3: Clean Separator */}
          <div className="border-b border-zinc-800/80 pt-1" />
        </header>

        {/* RIGHT-ALIGNED COMPACT ACCOUNT SELECTOR BAR */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
            <select
              value={activeAccount?.id || ''}
              onChange={(e) => setActiveAccountId(e.target.value)}
              className="bg-zinc-950 text-zinc-100 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {accounts.length === 0 ? (
                <option value="">No Account</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={() => setShowAccountModal(true)}
              className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-colors flex items-center justify-center"
              title="Add New Account"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 2x3 METRICS GRID (Left -> Right Sequence) */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* 1. Equity (Top Left) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Equity</span>
              <DollarSign className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.equity)}
            </div>
          </div>

          {/* 2. Net PnL (Top Right) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Net PnL</span>
              {metrics.netPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                metrics.netPnl > 0
                  ? 'text-emerald-400'
                  : metrics.netPnl < 0
                  ? 'text-rose-400'
                  : 'text-white'
              }`}
            >
              {formatSignedCurrency(metrics.netPnl)}
            </div>
          </div>

          {/* 3. Win Rate (Middle Left) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Win Rate</span>
              <Award className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.winRate}%
            </div>
          </div>

          {/* 4. Best Day (Middle Right) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Best Day</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
              {formatCurrency(metrics.bestDay)}
            </div>
          </div>

          {/* 5. Consistency Score Target (Bottom Left) */}
          <div
            className={`bg-zinc-900/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between border transition-all duration-300 ${
              metrics.isConsistencyMet
                ? 'border-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.28)]'
                : 'border-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.28)]'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>15% Consistency Target</span>
              <Target
                className={`w-4 h-4 ${
                  metrics.isConsistencyMet ? 'text-emerald-400' : 'text-rose-400'
                }`}
              />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.consistencyTarget)}
            </div>
          </div>

          {/* 6. Most Traded Commodity (Bottom Right) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Most Traded</span>
              <BarChart2 className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metrics.mostTraded}
            </div>
          </div>
        </section>

        {/* TRADE LOG SECTION (Middle: Between Metrics and Calendar) */}
        <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Trade Log
            </h2>
            <button
              onClick={() => {
                if (!activeAccount) {
                  setShowAccountModal(true);
                } else {
                  setShowTradeModal(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Log Trade</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Lots</th>
                  <th className="py-3 px-4 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs sm:text-sm">
                {accountTrades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs">
                      No trades logged for this account yet.
                    </td>
                  </tr>
                ) : (
                  accountTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        {trade.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                        {trade.asset}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                            trade.direction === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        {trade.lots}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono font-semibold text-right whitespace-nowrap ${
                          Number(trade.pnl) > 0
                            ? 'text-emerald-400'
                            : Number(trade.pnl) < 0
                            ? 'text-rose-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {formatSignedCurrency(Number(trade.pnl))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* STANDARD MONTHLY CALENDAR (Bottom) */}
        <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5">
          {/* Centered Year & Month Navigation */}
          <div className="flex flex-col items-center justify-center mb-4 space-y-1">
            <div className="text-xs font-bold tracking-widest uppercase text-zinc-500 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{calendarData.year}</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base sm:text-lg font-bold text-white min-w-[120px] text-center">
                {calendarData.monthName}
              </h3>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarData.cells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-14 sm:h-20 rounded-xl bg-zinc-950/30 border border-zinc-800/30"
                  />
                );
              }

              const hasTrades = cell.pnl !== null;
              const isProfit = hasTrades && cell.pnl > 0;
              const isLoss = hasTrades && cell.pnl < 0;

              return (
                <div
                  key={cell.dateKey}
                  className={`h-14 sm:h-20 rounded-xl p-1.5 sm:p-2 border flex flex-col justify-between transition-colors ${
                    isProfit
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : isLoss
                      ? 'bg-rose-950/30 border-rose-500/40'
                      : 'bg-zinc-950/60 border-zinc-800/80'
                  }`}
                >
                  <span className="text-[11px] sm:text-xs font-semibold text-zinc-400">
                    {cell.day}
                  </span>

                  {hasTrades && (
                    <span
                      className={`text-[10px] sm:text-xs font-mono font-bold truncate ${
                        isProfit
                          ? 'text-emerald-400'
                          : isLoss
                          ? 'text-rose-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {cell.pnl > 0
                        ? `+$${Math.round(cell.pnl)}`
                        : cell.pnl < 0
                        ? `-$${Math.abs(Math.round(cell.pnl))}`
                        : '$0'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ADD ACCOUNT MODAL (Tag/Type Removed, Save Button Only) */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add Trading Account</h3>
              {accounts.length > 0 && (
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., FTMO 100K"
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

      {/* LOG TRADE MODAL (No Entry/Exit Price, Dedicated Lots Field) */}
      {showTradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Log Trade</h3>
              <button
                onClick={() => setShowTradeModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTrade} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Asset
                </label>
                <input
                  type="text"
                  required
                  placeholder="XAUUSD"
                  value={tradeAsset}
                  onChange={(e) => setTradeAsset(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
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
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Lots
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.10"
                    value={tradeLots}
                    onChange={(e) => setTradeLots(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  PnL ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g., 250 or -120"
                  value={tradePnl}
                  onChange={(e) => setTradePnl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition-colors mt-2"
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