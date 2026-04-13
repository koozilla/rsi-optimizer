import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  BarChart3,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Stock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  rsi14: number;
  volume: string;
  week52High: number;
  week52Low: number;
}

interface StocksData {
  updatedAt: string;
  stocks: Stock[];
}

type SortKey = keyof Pick<Stock, "symbol" | "price" | "changePercent" | "rsi14" | "volume">;
type SortDir = "asc" | "desc";

// ── RSI helpers ────────────────────────────────────────────────────────────

function getRsiLabel(rsi: number): { label: string; color: string; bg: string } {
  if (rsi >= 70) return { label: "Overbought", color: "text-red-400", bg: "bg-red-500/15 border border-red-500/30" };
  if (rsi <= 30) return { label: "Oversold",   color: "text-green-400", bg: "bg-green-500/15 border border-green-500/30" };
  if (rsi >= 55) return { label: "Bullish",    color: "text-orange-400", bg: "bg-orange-500/15 border border-orange-500/30" };
  if (rsi <= 45) return { label: "Bearish",    color: "text-blue-400",   bg: "bg-blue-500/15 border border-blue-500/30" };
  return              { label: "Neutral",     color: "text-white/50",  bg: "bg-white/5 border border-white/10" };
}

// ── RSI mini-bar ──────────────────────────────────────────────────────────

function RsiBar({ rsi }: { rsi: number }) {
  const pct = Math.max(0, Math.min(100, rsi));
  const color =
    rsi >= 70 ? "#ef4444" :
    rsi <= 30 ? "#22c55e" :
    rsi >= 55 ? "#f97316" :
    rsi <= 45 ? "#3b82f6" :
    "#6b7280";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>
        {rsi.toFixed(1)}
      </span>
    </div>
  );
}

// ── 52-week range bar ─────────────────────────────────────────────────────

function RangeBar({ price, low, high }: { price: number; low: number; high: number }) {
  const pct = ((price - low) / (high - low)) * 100;
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <span className="text-[10px] text-white/30">{low.toFixed(0)}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 border border-black"
          style={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 4px)` }}
        />
      </div>
      <span className="text-[10px] text-white/30">{high.toFixed(0)}</span>
    </div>
  );
}

// ── Sort header cell ──────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold cursor-pointer select-none whitespace-nowrap",
        active ? "text-orange-400" : "text-white/40 hover:text-white/70",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
        )}
      </span>
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface PortfolioPageProps {
  onSelectStock?: (symbol: string) => void;
}

export default function PortfolioPage({ onSelectStock }: PortfolioPageProps) {
  const [data, setData] = useState<StocksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [rsiFilter, setRsiFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Load stocks.json
  useEffect(() => {
    fetch("/data/stocks.json")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load stocks data.");
        return r.json();
      })
      .then((d: StocksData) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // Derived sectors
  const sectors = useMemo(() => {
    if (!data) return [];
    return ["All", ...Array.from(new Set(data.stocks.map((s) => s.sector))).sort()];
  }, [data]);

  // Filtered + sorted stocks
  const stocks = useMemo(() => {
    if (!data) return [];
    let list = data.stocks;

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }
    if (sectorFilter !== "All") {
      list = list.filter((s) => s.sector === sectorFilter);
    }
    if (rsiFilter !== "All") {
      list = list.filter((s) => {
        if (rsiFilter === "Overbought") return s.rsi14 >= 70;
        if (rsiFilter === "Oversold")   return s.rsi14 <= 30;
        if (rsiFilter === "Neutral")    return s.rsi14 > 30 && s.rsi14 < 70;
        return true;
      });
    }

    return [...list].sort((a, b) => {
      let av: number | string = a[sortKey];
      let bv: number | string = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, query, sectorFilter, rsiFilter, sortKey, sortDir]);

  // Summary stats
  const stats = useMemo(() => {
    if (!data) return null;
    const s = data.stocks;
    const avgRsi = s.reduce((acc, x) => acc + x.rsi14, 0) / s.length;
    const gainers = s.filter((x) => x.change > 0).length;
    const losers  = s.filter((x) => x.change < 0).length;
    const overbought = s.filter((x) => x.rsi14 >= 70).length;
    const oversold   = s.filter((x) => x.rsi14 <= 30).length;
    return { avgRsi, gainers, losers, overbought, oversold, total: s.length };
  }, [data]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
          <p className="text-white/50 text-sm">Loading market data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <Activity className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-white font-semibold">Failed to load data</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-black" />
            </div>
            <span className="text-lg font-bold tracking-tight">todaying<span className="text-orange-500">.com</span></span>
          </div>
          {data && (
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <RefreshCw className="w-3 h-3" />
              <span>Updated {data.updatedAt}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Summary cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Tracked Stocks" value={stats.total.toString()} icon={<BarChart3 className="w-4 h-4 text-orange-400" />} />
            <StatCard label="Avg RSI (14)" value={stats.avgRsi.toFixed(1)} icon={<Activity className="w-4 h-4 text-blue-400" />} />
            <StatCard
              label="Gainers"
              value={stats.gainers.toString()}
              icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              valueClass="text-green-400"
            />
            <StatCard
              label="Losers"
              value={stats.losers.toString()}
              icon={<TrendingDown className="w-4 h-4 text-red-400" />}
              valueClass="text-red-400"
            />
            <StatCard
              label="Overbought / Oversold"
              value={`${stats.overbought} / ${stats.oversold}`}
              icon={<Activity className="w-4 h-4 text-purple-400" />}
            />
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search symbol or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/60 transition-colors"
            />
          </div>

          {/* Sector filter */}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer"
          >
            {sectors.map((s) => (
              <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
            ))}
          </select>

          {/* RSI filter */}
          <div className="flex gap-1">
            {["All", "Overbought", "Neutral", "Oversold"].map((f) => (
              <button
                key={f}
                onClick={() => setRsiFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  rsiFilter === f
                    ? "bg-orange-500 text-black"
                    : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <span className="text-xs text-white/30 ml-auto">
            {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/10">
                  <SortTh label="Symbol"  sortKey="symbol"        currentKey={sortKey} dir={sortDir} onSort={handleSort} className="pl-5" />
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-white/40">Name</th>
                  <SortTh label="Price"   sortKey="price"         currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Change"  sortKey="changePercent" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="RSI 14"  sortKey="rsi14"         currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-white/40">RSI Signal</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-white/40 hidden lg:table-cell">52W Range</th>
                  <SortTh label="Volume"  sortKey="volume"        currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  {onSelectStock && (
                    <th className="px-4 py-3" />
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {stocks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-white/30 text-sm">
                      No stocks match your filters.
                    </td>
                  </tr>
                ) : (
                  stocks.map((stock) => {
                    const rsiMeta = getRsiLabel(stock.rsi14);
                    const isUp = stock.change > 0;
                    const isDown = stock.change < 0;

                    return (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Symbol */}
                        <td className="px-4 py-4 pl-5">
                          <span className="font-bold font-mono text-white tracking-wide">
                            {stock.symbol}
                          </span>
                        </td>

                        {/* Name + sector */}
                        <td className="px-4 py-4">
                          <div>
                            <span className="text-white/80 font-medium">{stock.name}</span>
                            <span className="block text-[11px] text-white/30 mt-0.5">{stock.sector}</span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-4">
                          <span className="font-mono font-semibold text-white">
                            ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Change */}
                        <td className="px-4 py-4">
                          <div className={cn(
                            "flex items-center gap-1 font-mono text-sm",
                            isUp ? "text-green-400" : isDown ? "text-red-400" : "text-white/40"
                          )}>
                            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                             isDown ? <ArrowDownRight className="w-3.5 h-3.5" /> :
                             <Minus className="w-3.5 h-3.5" />}
                            <span>
                              {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
                            </span>
                          </div>
                          <div className={cn(
                            "text-[11px] font-mono mt-0.5",
                            isUp ? "text-green-400/60" : isDown ? "text-red-400/60" : "text-white/20"
                          )}>
                            {isUp ? "+" : ""}{stock.change.toFixed(2)}
                          </div>
                        </td>

                        {/* RSI bar */}
                        <td className="px-4 py-4">
                          <RsiBar rsi={stock.rsi14} />
                        </td>

                        {/* RSI signal badge */}
                        <td className="px-4 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold",
                            rsiMeta.bg, rsiMeta.color
                          )}>
                            {rsiMeta.label}
                          </span>
                        </td>

                        {/* 52W range */}
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <RangeBar price={stock.price} low={stock.week52Low} high={stock.week52High} />
                        </td>

                        {/* Volume */}
                        <td className="px-4 py-4 hidden md:table-cell text-white/50 font-mono text-xs">
                          {stock.volume}
                        </td>

                        {/* Analyze button */}
                        {onSelectStock && (
                          <td className="px-4 py-4 pr-5">
                            <button
                              onClick={() => onSelectStock(stock.symbol)}
                              className="opacity-0 group-hover:opacity-100 px-3 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/25 transition-all"
                            >
                              Analyze →
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer note ── */}
        <p className="text-center text-xs text-white/20 pb-4">
          Data is updated daily. RSI 14 is calculated from end-of-day closing prices.
        </p>
      </main>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-wider font-medium leading-tight">{label}</span>
        <div className="p-1.5 bg-white/5 rounded-lg">{icon}</div>
      </div>
      <span className={cn("text-2xl font-bold tracking-tight", valueClass ?? "text-white")}>
        {value}
      </span>
    </div>
  );
}
