import React, { useState, useEffect, useMemo } from "react";
import PortfolioPage from "./PortfolioPage";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  LabelList
} from "recharts";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  History, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  AlertCircle,
  BarChart3,
  Zap
} from "lucide-react";
import { format, subYears } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { computeRSI, computeVolatility } from "./lib/indicators";
import { simulateStrategy, findBestThresholds, type SimulationResult, type Trade } from "./lib/simulator";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StockData {
  date: string;
  close: number;
  rsi: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const trade = data.trade;
    
    return (
      <div className="bg-[#1A1A1A] border border-white/20 rounded-lg p-3 shadow-2xl backdrop-blur-md min-w-[160px]">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">{label}</p>
        <p className="text-sm font-bold text-white mb-2">
          Price: <span className="text-orange-400 font-mono">${data.close.toFixed(2)}</span>
        </p>
        
        {trade && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
                trade.type === 'buy' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              )}>
                {trade.type} {trade.stage}
              </span>
              <span className="text-xs font-mono text-white font-bold">${trade.amount.toFixed(0)}</span>
            </div>
            {trade.type === 'sell' && trade.profitPercent !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] text-white/40 uppercase font-bold">Profit</span>
                <span className={cn(
                  "text-xs font-mono font-bold",
                  trade.profitPercent >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {trade.profitPercent >= 0 ? "+" : ""}{trade.profitPercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// ── Root: portfolio home → RSI analyzer ───────────────────────────────────

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  if (!activeSymbol) {
    return <PortfolioPage onSelectStock={(sym) => setActiveSymbol(sym)} />;
  }

  return (
    <RSIAnalyzer
      initialSymbol={activeSymbol}
      onBack={() => setActiveSymbol(null)}
    />
  );
}

// ── RSI Analyzer (original app, wrapped with a back button) ───────────────

function RSIAnalyzer({ initialSymbol, onBack }: { initialSymbol: string; onBack: () => void }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockData[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);

  const fetchData = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock/${targetSymbol}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch data");
      }
      const rawData = await response.json();
      
      const prices = rawData.map((d: any) => d.close);
      const dates = rawData.map((d: any) => new Date(d.date));
      const rsiValues = computeRSI(prices, 14);
      const volatility = computeVolatility(prices);

      // Create a map of trades for easy lookup
      const bestSim = findBestThresholds(prices, rsiValues, dates, volatility);
      const tradeMap = new Map<string, Trade>();
      bestSim.trades.forEach(t => {
        const dateStr = format(t.date, "MMM dd, yyyy");
        tradeMap.set(dateStr, t);
      });

      const combinedData: any[] = rawData.map((d: any, i: number) => {
        const dateStr = format(new Date(d.date), "MMM dd, yyyy");
        const trade = tradeMap.get(dateStr);
        return {
          date: dateStr,
          close: d.close,
          rsi: rsiValues[i],
          trade: trade,
          buySignal: trade?.type === 'buy' ? 1 : null,
          sellSignal: trade?.type === 'sell' ? 1 : null
        };
      });

      setData(combinedData);
      setSimulation(bestSim);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(symbol);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      fetchData(symbol.toUpperCase());
    }
  };

  const chartData = useMemo(() => data, [data]);

  const SignalDot = (props: any) => {
    const { cx, cy, payload, fill } = props;
    if (!payload.trade || isNaN(cx) || isNaN(cy)) return null;
    const stage = payload.trade.stage;
    
    return (
      <g>
        {[...Array(stage)].map((_, i) => (
          <circle 
            key={i} 
            cx={cx} 
            cy={cy - (i * 8)} 
            r={3} 
            fill={fill} 
            className="drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]"
          />
        ))}
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">RSI Optimizer</h1>
            </div>
          </div>
          
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Enter symbol (e.g. AAPL)"
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-64 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-sm"
            />
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-white/60 animate-pulse">Analyzing 3 years of market data...</p>
          </div>
        ) : error ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Oops! Something went wrong</h2>
            <p className="text-white/60 max-w-md">{error}</p>
            <button 
              onClick={() => fetchData(symbol)}
              className="px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : simulation ? (
          <div className="space-y-8">
            {/* Stock Profile Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-4xl font-bold tracking-tighter">{symbol}</h2>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                    simulation.category === "High" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    simulation.category === "Moderate" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                    "bg-green-500/20 text-green-400 border border-green-500/30"
                  )}>
                    {simulation.category} Volatility
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-white/40 text-sm max-w-xl">
                    {simulation.category === "High" ? 
                      "This stock exhibits high price fluctuation. Strategy uses deeper RSI thresholds to capture significant pullbacks." :
                      simulation.category === "Moderate" ?
                      "This stock shows balanced movement. Strategy uses standard RSI thresholds for reliable entry points." :
                      "This stock is relatively stable. Strategy uses higher RSI thresholds as deep oversold levels are rare."
                    }
                  </p>
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-wider mb-1">
                      <Target className="w-3 h-3" /> Strategy Insight
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {simulation.buyThresholds[0] >= 40 ? 
                        "The optimizer chose higher thresholds because this stock is in a strong uptrend. Waiting for deep RSI levels (like 30) would have resulted in missed opportunities. Buying at 'shallow' dips maximized total profit." :
                        "The optimizer chose deep thresholds because this stock frequently experiences significant corrections. Waiting for extreme RSI levels provided the safest and most profitable entry points."
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Annualized Volatility</div>
                <div className="text-2xl font-mono font-bold text-orange-500">{simulation.volatility.toFixed(2)}%</div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard 
                title="Strategy Gain" 
                value={`$${simulation.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={`${simulation.totalGainPercent.toFixed(2)}% ROI`}
                icon={<TrendingUp className="w-5 h-5 text-green-400" />}
                trend={simulation.totalGain >= 0 ? "up" : "down"}
              />
              <SummaryCard 
                title={`Buy & Hold (RSI ${simulation.buyThresholds[1]})`} 
                value={`$${simulation.buyAndHoldGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={`${simulation.buyAndHoldPercent.toFixed(2)}% ROI`}
                icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
                trend={simulation.buyAndHoldGain >= 0 ? "up" : "down"}
              />
              <SummaryCard 
                title="Buy Ladder" 
                value={simulation.buyThresholds.join(" / ")}
                subValue="RSI Entry Levels"
                icon={<Target className="w-5 h-5 text-orange-400" />}
              />
              <SummaryCard 
                title="Sell Ladder" 
                value={simulation.sellThresholds.join(" / ")}
                subValue="RSI Exit Levels"
                icon={<History className="w-5 h-5 text-purple-400" />}
              />
            </div>

            {/* Comparison Bar */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" /> Strategy Comparison
                </h3>
                <div className="text-xs text-white/40 italic">
                  *Buy & Hold assumes $7,000 invested the first time RSI 14 hit {simulation.buyThresholds[1]}
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Tiered RSI Strategy</span>
                    <span className={cn("font-mono font-bold", simulation.totalGain >= simulation.buyAndHoldGain ? "text-green-400" : "text-white/40")}>
                      ${simulation.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(5, Math.min(100, (simulation.totalGain / Math.max(simulation.totalGain, simulation.buyAndHoldGain)) * 100))}%` }}
                      className={cn(
                        "h-full rounded-full",
                        simulation.totalGain >= simulation.buyAndHoldGain ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-white/20"
                      )}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Buy & Hold (RSI {simulation.buyThresholds[1]} Trigger)</span>
                    <span className={cn("font-mono font-bold", simulation.buyAndHoldGain > simulation.totalGain ? "text-green-400" : "text-white/40")}>
                      ${simulation.buyAndHoldGain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(5, Math.min(100, (simulation.buyAndHoldGain / Math.max(simulation.totalGain, simulation.buyAndHoldGain)) * 100))}%` }}
                      className={cn(
                        "h-full rounded-full",
                        simulation.buyAndHoldGain > simulation.totalGain ? "bg-gradient-to-r from-blue-500 to-blue-400" : "bg-white/20"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-sm text-white/60">
                    {simulation.totalGain > simulation.buyAndHoldGain ? (
                      <>
                        <span className="text-green-400 font-bold">Success!</span> The RSI strategy outperformed Buy & Hold by <span className="text-white font-mono font-bold">${(simulation.totalGain - simulation.buyAndHoldGain).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>. This suggests that active trading based on RSI levels was more effective for {symbol} than a passive approach.
                      </>
                    ) : (
                      <>
                        <span className="text-orange-400 font-bold">Note:</span> Buy & Hold outperformed the RSI strategy by <span className="text-white font-mono font-bold">${(simulation.buyAndHoldGain - simulation.totalGain).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>. This often happens in strong, parabolic bull markets where the stock doesn't dip enough to trigger all buy tiers.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-8">
              {/* Price Chart */}
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    Price Action & Trades
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" /> Buy
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" /> Sell
                    </div>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 40, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff40" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        minTickGap={50}
                      />
                      <YAxis 
                        stroke="#ffffff40" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `$${val}`}
                        yAxisId="price"
                      />
                      <YAxis 
                        yAxisId="signals"
                        hide
                        domain={[-3, 30]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        yAxisId="price"
                        type="monotone" 
                        dataKey="close" 
                        stroke="#f97316" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                      {/* Buy Markers (at the bottom) */}
                      <Scatter 
                        yAxisId="signals"
                        dataKey="buySignal"
                        fill="#22c55e"
                        shape={<SignalDot />}
                      />
                      {/* Sell Markers (at the bottom) */}
                      <Scatter 
                        yAxisId="signals"
                        dataKey="sellSignal"
                        fill="#ef4444"
                        shape={<SignalDot />}
                      >
                        <LabelList 
                          dataKey="trade" 
                          position="top" 
                          content={(props: any) => {
                            const { x, y, value } = props;
                            if (!value || value.type !== 'sell' || value.profitPercent === undefined || isNaN(x) || isNaN(y)) return null;
                            const yOffset = 15 + (value.stage * 8);
                            return (
                              <text x={x} y={y - yOffset} fill={value.profitPercent >= 0 ? "#4ade80" : "#f87171"} fontSize={10} fontWeight="bold" textAnchor="middle">
                                {value.profitPercent >= 0 ? "+" : ""}{value.profitPercent.toFixed(1)}%
                              </text>
                            );
                          }}
                        />
                      </Scatter>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* RSI Chart */}
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    RSI (14) Indicator
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRsi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff40" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        minTickGap={50}
                      />
                      <YAxis 
                        stroke="#ffffff40" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        domain={[0, 100]}
                        ticks={[0, 30, 50, 70, 100]}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #ffffff20', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'right', value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                      
                      {/* Strategy Thresholds */}
                      {simulation.buyThresholds.map((t, i) => (
                        <ReferenceLine key={`b-${i}`} y={t} stroke="#3b82f6" strokeOpacity={0.5} strokeWidth={1} />
                      ))}
                      {simulation.sellThresholds.map((t, i) => (
                        <ReferenceLine key={`s-${i}`} y={t} stroke="#f97316" strokeOpacity={0.5} strokeWidth={1} />
                      ))}

                      <Area 
                        type="monotone" 
                        dataKey="rsi" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorRsi)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {/* Trade History */}
            <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-500" />
                  Trade Execution Log
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Price</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Profit/Loss</th>
                      <th className="px-6 py-4 font-medium">RSI</th>
                      <th className="px-6 py-4 font-medium">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {simulation.trades.map((trade, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 text-sm text-white/60">{format(trade.date, "MMM dd, yyyy")}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                            trade.type === 'buy' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">${trade.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-mono">${trade.amount.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          {trade.type === 'sell' && trade.profit !== undefined ? (
                            <div className={cn(
                              "text-sm font-mono flex items-center gap-1",
                              trade.profit >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {trade.profit >= 0 ? "+" : ""}${trade.profit.toFixed(2)}
                              <span className="text-[10px] opacity-60">({trade.profitPercent?.toFixed(1)}%)</span>
                            </div>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-white/60">{trade.rsi.toFixed(1)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(s => (
                              <div 
                                key={s} 
                                className={cn(
                                  "w-3 h-1 rounded-full",
                                  s <= trade.stage ? "bg-orange-500" : "bg-white/10"
                                )} 
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function SummaryCard({ title, value, subValue, icon, trend }: { 
  title: string; 
  value: string; 
  subValue: string; 
  icon: React.ReactNode;
  trend?: "up" | "down";
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-white/40 font-medium uppercase tracking-wider">{title}</span>
        <div className="p-2 bg-white/5 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
          {value}
          {trend && (
            trend === "up" ? 
            <ArrowUpRight className="w-5 h-5 text-green-400" /> : 
            <ArrowDownRight className="w-5 h-5 text-red-400" />
          )}
        </div>
        <p className="text-sm text-white/40">{subValue}</p>
      </div>
    </motion.div>
  );
}

