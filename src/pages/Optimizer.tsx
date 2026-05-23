import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  LabelList,
  BarChart,
  Bar,
  Cell
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
  Zap,
  ArrowLeft,
  BellRing,
  AlertTriangle,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { computeRSI, computeVolatility, computeBollingerBands, computeRSIVelocity, detectDivergences, type DivergenceEvent } from "../lib/indicators";
import { simulateStrategy, findBestThresholds, type SimulationResult, type Trade } from "../lib/simulator";

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
        <p>
          <span className="text-[10px] text-white/40 uppercase font-bold">Price: </span>
          <span className="text-sm font-mono text-orange-400 font-bold">${data.close.toFixed(2)}</span>
        </p>
        <p>
          <span className="text-[10px] text-white/40 uppercase font-bold">RSI (14): </span>
          <span className="text-sm font-mono text-blue-400 font-bold">{data.rsi.toFixed(2)}</span>
        </p>
        <p>
          <span className="text-[10px] text-white/40 uppercase font-bold">Momentum: </span>
          <span className={cn(
            "text-sm font-mono font-bold",
            data.rsiMomentum >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {data.rsiMomentum >= 0 ? "+" : ""}{data.rsiMomentum.toFixed(2)}
          </span>
        </p>
        <p className="mb-2">
          <span className="text-[10px] text-white/40 uppercase font-bold">Velocity: </span>
          <span className={cn(
            "text-sm font-mono font-bold",
            data.rsiVelocity >= 0 ? "text-purple-400" : "text-pink-400"
          )}>
            {data.rsiVelocity >= 0 ? "+" : ""}{data.rsiVelocity.toFixed(3)}
          </span>
        </p>
        
        {data.divergence && (
          <div className="pt-2 border-t border-white/10 mb-2">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">
              Divergence: {data.divergenceType?.replace('_', ' ')} ({data.divergence})
            </p>
          </div>
        )}
        
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

const RSITooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] border border-white/20 rounded-lg p-3 shadow-2xl backdrop-blur-md min-w-[140px]">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">{label}</p>
        <div className="space-y-1">
          <p className="text-sm font-bold text-white flex justify-between gap-4">
            <span className="text-white/40 font-normal">RSI:</span>
            <span className="text-blue-400 font-mono">{data.rsi.toFixed(2)}</span>
          </p>
          <p className="text-sm font-bold text-white flex justify-between gap-4">
            <span className="text-white/40 font-normal">Price:</span>
            <span className="text-orange-400 font-mono">${data.close.toFixed(2)}</span>
          </p>
          <p className="text-sm font-bold text-white flex justify-between gap-4">
            <span className="text-white/40 font-normal">Momentum:</span>
            <span className={cn(
              "font-mono",
              data.rsiMomentum >= 0 ? "text-green-400" : "text-red-400"
            )}>
              {data.rsiMomentum >= 0 ? "+" : ""}{data.rsiMomentum.toFixed(2)}
            </span>
          </p>
          <p className="text-sm font-bold text-white flex justify-between gap-4">
            <span className="text-white/40 font-normal">Velocity:</span>
            <span className={cn(
              "font-mono",
              data.rsiVelocity >= 0 ? "text-purple-400" : "text-pink-400"
            )}>
              {data.rsiVelocity >= 0 ? "+" : ""}{data.rsiVelocity.toFixed(3)}
            </span>
          </p>
          {data.divergence && (
            <p className="text-[10px] font-black text-purple-400 pt-2 border-t border-white/10 mt-1 uppercase">
              {data.divergenceType?.replace('_', ' ')} ({data.divergence})
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const parseMarketDate = (dateStr: string) => {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function Optimizer() {
  const { symbol: urlSymbol } = useParams();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(urlSymbol?.toUpperCase() || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockData[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [tradeLogTab, setTradeLogTab] = useState<'enhanced' | 'pure'>('enhanced');

  const fetchData = async (targetSymbol: string) => {
    if (!targetSymbol) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock/${targetSymbol}`);
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text.slice(0, 200));
        throw new Error("Server returned an invalid response. Please try again later.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      
      const rawData = result;
      
      if (!Array.isArray(rawData) || rawData.length < 20) {
        throw new Error("Insufficient historical data for accurate analysis. We need at least 20 trading days.");
      }

      const prices = rawData.map((d: any) => d.close);
      const dates = rawData.map((d: any) => parseMarketDate(d.date));
      const rsiValues = computeRSI(prices, 14);
      const volatility = computeVolatility(prices);
      const bbands = computeBollingerBands(prices, 20, 2);
      const rsiVelocity = computeRSIVelocity(rsiValues, 5);
      const divergences = detectDivergences(prices, rsiValues);

      const bestSim = findBestThresholds(prices, rsiValues, dates, volatility, rsiVelocity, divergences);
      const tradeMap = new Map<string, Trade>();
      bestSim.trades.forEach(t => {
        const dateStr = format(t.date, "MMM dd, yyyy");
        tradeMap.set(dateStr, t);
      });

      // Prepare trendlines
      const divLinePrice: (number | null)[] = new Array(rawData.length).fill(null);
      const divLineRsi: (number | null)[] = new Array(rawData.length).fill(null);

      divergences.forEach(div => {
        divLinePrice[div.priceIndices[0]] = prices[div.priceIndices[0]];
        divLinePrice[div.priceIndices[1]] = prices[div.priceIndices[1]];
        divLineRsi[div.rsiIndices[0]] = rsiValues[div.rsiIndices[0]];
        divLineRsi[div.rsiIndices[1]] = rsiValues[div.rsiIndices[1]];
      });

      const combinedData: any[] = rawData.map((d: any, i: number) => {
        const parsedDate = parseMarketDate(d.date);
        const dateStr = format(parsedDate, "MMM dd, yyyy");
        const trade = tradeMap.get(dateStr);
        const div = divergences.find(dv => dv.index === i);
        
        const rsiVal = rsiValues[i];
        const prevRsi = i > 0 ? rsiValues[i-1] : NaN;
        const prev5Rsi = i >= 5 ? rsiValues[i-5] : NaN;
        
        return {
          date: dateStr,
          shortDate: format(parsedDate, "MM-dd"),
          close: d.close,
          priceChange: i > 0 ? d.close - rawData[i-1].close : 0,
          rsi: rsiVal,
          rsiVelocity: rsiVelocity[i],
          delta1: !isNaN(rsiVal) && !isNaN(prevRsi) ? rsiVal - prevRsi : 0,
          delta5: !isNaN(rsiVal) && !isNaN(prev5Rsi) ? rsiVal - prev5Rsi : 0,
          bbUpper: bbands[i].upper,
          bbLower: bbands[i].lower,
          trade: trade,
          buySignal: trade?.type === 'buy' ? 1 : null,
          sellSignal: trade?.type === 'sell' ? 1 : null,
          divergence: div ? div.label : null,
          divergenceType: div ? div.type : null,
          divPrice: div ? d.close : null,
          divRsi: div ? rsiValues[i] : null,
          divTrendPrice: divLinePrice[i],
          divTrendRsi: divLineRsi[i],
          rsiMomentum: rsiValues[i] - 50
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
    if (urlSymbol) {
      setSymbol(urlSymbol.toUpperCase());
      fetchData(urlSymbol.toUpperCase());
    }
  }, [urlSymbol]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      navigate(`/rsi_optimizer/${symbol.toUpperCase()}`);
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
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white/90">RSI Strategy Optimizer</h1>
              <span className="hidden md:block text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                Data has 24hr delay • Educational Purpose Only
              </span>
            </div>
          </div>
          
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g. AMD)"
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-64 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-sm"
            />
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-white/60 animate-pulse">Analyzing 3 years of market data for {symbol}...</p>
          </div>
        ) : error ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Oops! Something went wrong</h2>
            <p className="text-white/60 max-w-md">{error}</p>
            <div className="flex flex-col gap-4 mt-2">
              <button 
                onClick={() => fetchData(symbol)}
                className="px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-white/90 transition-all active:scale-95"
              >
                Try To Reload {symbol}
              </button>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => navigate('/rsi_optimizer/AMD')}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Try AMD (Stable Case)
                </button>
                <Link 
                  to="/"
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Back Home
                </Link>
              </div>
            </div>
          </div>
        ) : simulation ? (
          <div className="space-y-8">
            {/* Stock Profile Header */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-bold tracking-tighter">{symbol.toUpperCase()}</h2>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                    simulation.category === "High" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    simulation.category === "Moderate" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                    "bg-green-500/20 text-green-400 border border-green-500/30"
                  )}>
                    {simulation.category} Volatility
                  </span>
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30">
                    <Zap className="w-3 h-3" /> Momentum-Gate Selling
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                    <Target className="w-3 h-3" /> Pure RSI Buy Ladder
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-white/40 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                  {simulation.category === "High" ? 
                    "This stock exhibits high price fluctuation. Strategy uses deeper RSI thresholds to capture significant pullbacks." :
                    simulation.category === "Moderate" ?
                    "This stock shows balanced movement. Strategy uses standard RSI thresholds for reliable entry points." :
                    "This stock is relatively stable. Strategy uses higher RSI thresholds as deep oversold levels are rare."
                  }
                </p>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-wider mb-2">
                    <Target className="w-3 h-3" /> Strategy Insight
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    This Momentum-Filtered strategy simplifies the entry by using a pure three-stage RSI ladder ($1k, $2k, $4k). However, it adds a "Momentum Gate" to exits: even if the RSI hits your target sell threshold, the position is held until RSI velocity turns negative, ensuring you capture more upside during strong rallies.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center gap-12">
                <div className="space-y-1">
                  <div className="text-xs text-white/40 uppercase tracking-widest font-bold">Current Price</div>
                  <div className="text-3xl font-mono font-bold text-orange-500">${simulation.currentPrice.toFixed(2)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-white/40 uppercase tracking-widest font-bold">Current RSI (14)</div>
                  <div className="relative">
                    {simulation.currentRsi < 35 && (
                      <motion.div 
                        className="absolute inset-0 bg-green-500/20 blur-xl rounded-full -z-10"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                      />
                    )}
                    <div className={cn(
                      "text-3xl font-mono font-bold flex items-center gap-2",
                      simulation.currentRsi < 25 ? "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" :
                      simulation.currentRsi < 35 ? "text-green-400" :
                      simulation.currentRsi > 85 ? "text-red-600 font-black" :
                      simulation.currentRsi > 75 ? "text-red-500" :
                      simulation.currentRsi > 65 ? "text-yellow-500" :
                      "text-blue-500"
                    )}>
                      {simulation.currentRsi < 25 && (
                        <>
                          <DollarSign className="w-6 h-6 text-green-400 animate-bounce" />
                          <span className="text-sm font-black bg-green-500 text-black px-1.5 py-0.5 rounded animate-pulse">BUY</span>
                        </>
                      )}
                      {simulation.currentRsi >= 25 && simulation.currentRsi < 35 && (
                        <BellRing className="w-5 h-5 animate-bounce" />
                      )}
                      {simulation.currentRsi >= 35 && simulation.currentRsi <= 65 && (
                        <Activity className="w-5 h-5 text-blue-500 opacity-50" />
                      )}
                      {simulation.currentRsi > 65 && simulation.currentRsi <= 75 && (
                        <AlertTriangle className="w-5 h-5 text-yellow-500 animate-pulse" />
                      )}
                      {simulation.currentRsi > 75 && simulation.currentRsi <= 85 && (
                        <Zap className="w-5 h-5 text-red-500 animate-pulse fill-red-500" />
                      )}
                      {simulation.currentRsi > 85 && (
                        <>
                          <TrendingDown className="w-6 h-6 text-red-600 animate-bounce" />
                          <span className="text-sm font-black bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">SELL</span>
                        </>
                      )}
                      {simulation.currentRsi.toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-white/40 uppercase tracking-widest font-bold">Volatility</div>
                  <div className="text-3xl font-mono font-bold text-white">{simulation.volatility.toFixed(2)}%</div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard 
                title="Momentum-Filtered RSI" 
                value={`$${simulation.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={
                  <div className="flex flex-col">
                    <span>{simulation.totalGainPercent.toFixed(2)}% ROI (Filtered)</span>
                  </div>
                }
                icon={<Zap className="w-5 h-5 text-purple-400" />}
                trend={simulation.totalGain >= 0 ? "up" : "down"}
              />
              <SummaryCard 
                title="Pure RSI Gain" 
                value={`$${simulation.pureRsiGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={`${simulation.pureRsiPercent.toFixed(2)}% ROI (Static)`}
                icon={<Activity className="w-5 h-5 text-orange-400" />}
                trend={simulation.pureRsiGain >= 0 ? "up" : "down"}
              />
              <SummaryCard 
                title="Buy & Hold" 
                value={`$${simulation.buyAndHoldGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={`${simulation.buyAndHoldPercent.toFixed(2)}% ROI`}
                icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
                trend={simulation.buyAndHoldGain >= 0 ? "up" : "down"}
              />
              <SummaryCard 
                title="Daily DCA" 
                value={`$${simulation.dcaGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subValue={`${simulation.dcaPercent.toFixed(2)}% ROI`}
                icon={<History className="w-5 h-5 text-green-400" />}
                trend={simulation.dcaGain >= 0 ? "up" : "down"}
              />
            </div>

            {/* Threshold Config Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-medium text-white/60">Buy Ladder (RSI)</span>
                </div>
                <div className="text-lg font-mono font-bold text-white tracking-widest">{simulation.buyThresholds.join(" / ")}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BellRing className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-white/60">Sell Ladder (RSI)</span>
                </div>
                <div className="text-lg font-mono font-bold text-white tracking-widest">{simulation.sellThresholds.join(" / ")}</div>
              </div>
            </div>

            {/* Comparison Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-500" /> Strategy Comparison
                  </h3>
                  <div className="text-xs text-white/40 italic">
                    *Buy & Hold assumes $7,000 invested at RSI {simulation.buyThresholds[1]}
                  </div>
                </div>
                {(() => {
                  const strategies = [
                    { name: "Momentum-Filtered RSI", gain: simulation.divStrategyGain, color: "purple" },
                    { name: "Pure RSI Strategy (No Filters)", gain: simulation.pureRsiGain, color: "blue" },
                    { name: "Buy & Hold", gain: simulation.buyAndHoldGain, color: "orange" },
                    { name: "Daily DCA (3yr)", gain: simulation.dcaGain, color: "emerald" }
                  ].sort((a, b) => b.gain - a.gain);

                  const maxAbsGain = Math.max(...strategies.map(s => Math.abs(s.gain)), 1);
                  const maxGainValue = strategies[0].gain;

                  return (
                    <div className="space-y-6">
                      {strategies.map((strat, idx) => {
                        const isBest = strat.gain === maxGainValue && strat.gain > 0;
                        const isProfit = strat.gain >= 0;
                        
                        return (
                          <div key={strat.name}>
                            <div className="flex justify-between text-sm mb-2">
                              <div className="flex items-center gap-2">
                                {idx === 0 && strat.gain > 0 && (
                                  <span className="text-white ring-1 ring-white/50 bg-white/10 px-1 rounded text-[10px] font-black">TOP</span>
                                )}
                                <span className="text-white/60">{strat.name}</span>
                              </div>
                              <span className={cn(
                                "font-mono font-bold",
                                isProfit ? "text-green-400" : "text-red-400"
                              )}>
                                {isProfit ? "+" : ""}${strat.gain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                              <div 
                                style={{ width: `${Math.max(5, (Math.abs(strat.gain) / maxAbsGain) * 100)}%` }}
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  isProfit 
                                    ? "bg-gradient-to-r from-green-600 to-green-400" 
                                    : "bg-gradient-to-r from-red-600 to-red-400"
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-4 border-t border-white/5">
                        <p className="text-sm text-white/60">
                          {simulation.divStrategyGain === maxGainValue ? (
                            <>
                              <span className="text-green-400 font-bold font-mono">Outperforming:</span> Your Momentum-Filtered strategy is currently the optimal route for {symbol}.
                            </>
                          ) : (
                            <>
                              <span className="text-orange-400 font-bold tracking-tight">Strategy Note:</span> For {symbol}, {strategies[0].name} leads by a margin of ${(strategies[0].gain - simulation.divStrategyGain).toLocaleString()}.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-500" /> Current Open Positions
                  </h3>
                  <div className="text-xs text-white/40 italic">
                    *Positions being held today
                  </div>
                </div>

                <div className="space-y-3">
                  {simulation.currentHoldings.length > 0 ? (
                    simulation.currentHoldings.map((holding) => (
                      <div key={holding.stage} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-xs">
                            B{holding.stage}
                          </div>
                          <div>
                            <div className="text-xs text-white/40 font-bold uppercase tracking-tighter">Cost Base</div>
                            <div className="text-sm font-mono font-bold text-white">${holding.cost.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/40 font-bold uppercase tracking-tighter">Current Value</div>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm font-mono font-bold text-white">${holding.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                              holding.profit >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            )}>
                              {holding.profit >= 0 ? "+" : ""}{holding.profitPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <Target className="w-6 h-6 text-white/20" />
                      </div>
                      <p className="text-sm text-white/40 font-medium">No active positions.<br/>Strategy is 100% in cash.</p>
                    </div>
                  )}
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
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbUpper"
                        stroke="none"
                        fill="#ffffff08"
                        connectNulls
                      />
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbLower"
                        stroke="none"
                        fill="#00000000"
                        connectNulls
                      />
                      <Line 
                        yAxisId="price"
                        type="monotone" 
                        dataKey="close" 
                        stroke="#f97316" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="divTrendPrice"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={true}
                        connectNulls={false}
                      />
                      <Scatter 
                        yAxisId="price"
                        dataKey="divPrice"
                        fill="#a855f7"
                      >
                        <LabelList 
                          dataKey="divergence" 
                          position="top" 
                          content={(props: any) => {
                            const { x, y, value } = props;
                            if (!value || isNaN(x) || isNaN(y)) return null;
                            return (
                              <g>
                                <rect x={x - 10} y={y - 25} width={20} height={16} rx={4} fill="#a855f7" />
                                <text x={x} y={y - 14} fill="white" fontSize={10} fontWeight="900" textAnchor="middle">
                                  {value}
                                </text>
                              </g>
                            );
                          }}
                        />
                      </Scatter>
                      <Scatter 
                        yAxisId="signals"
                        dataKey="buySignal"
                        fill="#22c55e"
                        shape={<SignalDot />}
                      />
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
                <div className="h-[250px] w-full">
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
                      <Tooltip content={<RSITooltip />} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'right', value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                      
                      {simulation.buyThresholds.map((t, i) => (
                        <ReferenceLine key={`b-${i}`} y={t} stroke="#3b82f6" strokeOpacity={0.5} strokeWidth={1} />
                      ))}
                      {simulation.sellThresholds.map((t, i) => (
                        <ReferenceLine key={`s-${i}`} y={t} stroke="#f97316" strokeOpacity={0.5} strokeWidth={1} />
                      ))}

                      <Line
                        type="monotone"
                        dataKey="divTrendRsi"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={true}
                        connectNulls={false}
                      />
                      <Scatter 
                        dataKey="divRsi"
                        fill="#a855f7"
                      />

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

              {/* RSI Velocity (Derivative) Chart */}
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    Momentum Exhaustion (RSI Velocity)
                  </h3>
                  <div className="text-xs text-white/40 max-w-sm">
                    A derivative of RSI. When this lines crosses above 0 in oversold zones, it signals price stabilization (bottoming).
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
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
                      />
                      <Tooltip content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#1A1A1A] border border-white/20 rounded-lg p-2 shadow-2xl">
                              <p className="text-[10px] text-white/40 uppercase font-bold mb-1">{label}</p>
                              <p className="text-sm font-mono text-purple-400">Velocity: {payload[0].value.toFixed(3)}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <ReferenceLine y={0} stroke="#ffffff20" strokeWidth={1} />
                      <Area 
                        type="monotone" 
                        dataKey="rsiVelocity" 
                        stroke="#a855f7" 
                        fill="#a855f720"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {/* Recent 10 Bars Table */}
            <section className="bg-black/40 border border-white/10 rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black text-orange-500 uppercase tracking-[0.2em]">
                  Recent 10 Bars
                </h3>
              </div>
              
              <div className="overflow-hidden">
                <table className="w-full text-left border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-[10px] font-black italic text-white/30 uppercase tracking-widest">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Close</th>
                      <th className="pb-2">RSI</th>
                      <th className="pb-2">Δ1</th>
                      <th className="pb-2">Vel 5</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.slice(-10).reverse().map((bar, idx) => (
                      <tr key={idx} className="group hover:bg-white/5 transition-colors">
                        <td className="py-4 text-xs font-bold text-white/60 font-mono">
                          {bar.shortDate}
                        </td>
                        <td className={cn(
                          "py-4 text-sm font-black font-mono",
                          bar.priceChange >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          ${bar.close.toFixed(2)}
                        </td>
                        <td className="py-4 text-sm font-bold text-white/80 font-mono">
                          {bar.rsi.toFixed(1)}
                        </td>
                        <td className={cn(
                          "py-4 text-sm font-black font-mono",
                          bar.delta1 >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {bar.delta1 >= 0 ? "+" : ""}{bar.delta1.toFixed(1)}
                        </td>
                        <td className={cn(
                          "py-4 text-sm font-black font-mono",
                          bar.delta5 >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {bar.delta5 >= 0 ? "+" : ""}{bar.delta5.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/30 font-medium italic">
                <span>Δ1 = 1-bar RSI change</span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span>VEL 5 = 5-bar RSI change (sell filter)</span>
              </div>
            </section>

            {/* Trade History */}
            <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-500" />
                  Trade Execution Log
                </h3>
                
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start">
                  <button 
                    onClick={() => setTradeLogTab('enhanced')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      tradeLogTab === 'enhanced' 
                        ? "bg-purple-500 text-white shadow-lg" 
                        : "text-white/40 hover:text-white/60"
                    )}
                  >
                    Momentum-Filtered
                  </button>
                  <button 
                    onClick={() => setTradeLogTab('pure')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      tradeLogTab === 'pure' 
                        ? "bg-orange-500 text-white shadow-lg" 
                        : "text-white/40 hover:text-white/60"
                    )}
                  >
                    Pure RSI
                  </button>
                </div>
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
                    {[...(tradeLogTab === 'enhanced' ? simulation.trades : simulation.pureRsiTrades), ...(tradeLogTab === 'enhanced' ? simulation.currentHoldings : []).map(h => ({
                      date: new Date(),
                      type: 'open' as const,
                      price: simulation.currentPrice,
                      amount: h.currentValue,
                      shares: h.shares,
                      rsi: simulation.currentRsi,
                      stage: h.stage,
                      profit: h.profit,
                      profitPercent: h.profitPercent
                    }))].sort((a, b) => b.date.getTime() - a.date.getTime()).map((trade, i) => (
                      <tr key={i} className={cn(
                        "hover:bg-white/5 transition-colors group",
                        trade.type === 'open' ? "bg-blue-500/5" : ""
                      )}>
                        <td className="px-6 py-4 text-sm text-white/60">
                          {trade.type === 'open' ? <span className="text-blue-400 font-bold">CURRENT</span> : format(trade.date, "MMM dd, yyyy")}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                            trade.type === 'buy' ? "bg-green-500/10 text-green-500" : 
                            trade.type === 'sell' ? "bg-red-500/10 text-red-500" :
                            "bg-blue-500/10 text-blue-500"
                          )}>
                            {trade.type === 'open' ? 'UNSOLD' : trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">${trade.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-mono">${trade.amount.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          {(trade.type === 'sell' || trade.type === 'open') && trade.profit !== undefined ? (
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
                        <td className="px-6 py-4 text-sm text-white/60">{trade.rsi ? trade.rsi.toFixed(1) : '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(s => (
                              <div 
                                key={s} 
                                className={cn(
                                  "w-3 h-1 rounded-full",
                                  s <= trade.stage ? (tradeLogTab === 'enhanced' ? "bg-purple-500" : "bg-orange-500") : "bg-white/10"
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
  subValue: React.ReactNode; 
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
        <div className="text-sm text-white/40">{subValue}</div>
      </div>
    </motion.div>
  );
}
