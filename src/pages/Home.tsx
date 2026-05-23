import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Activity, TrendingUp, TrendingDown, Zap, Target, BarChart3, ArrowRight, BellRing, AlertTriangle, Flame, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StockStat {
  symbol: string;
  price: number;
  change: number;
  change1p: number;
  change5p: number;
  rsi: number;
  velocity: number;
  success: boolean;
}

const POPULAR_STOCKS = [
  { symbol: "AMD", name: "Advanced Micro Devices", category: "High Volatility" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "High Volatility" },
  { symbol: "AAPL", name: "Apple Inc.", category: "Moderate Volatility" },
  { symbol: "TSLA", name: "Tesla, Inc.", category: "High Volatility" },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "Stable" },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "Moderate Volatility" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", category: "Moderate Volatility" },
  { symbol: "META", name: "Meta Platforms", category: "High Volatility" },
  { symbol: "DUOL", name: "Duolingo, Inc.", category: "High Volatility" },
  { symbol: "MU", name: "Micron Technology", category: "High Volatility" },
  { symbol: "HOOD", name: "Robinhood Markets", category: "High Volatility" },
  { symbol: "CPNG", name: "Coupang, Inc.", category: "High Volatility" },
  { symbol: "COIN", name: "Coinbase Global", category: "High Volatility" },
  { symbol: "U", name: "Unity Software Inc.", category: "High Volatility" },
  { symbol: "RIVN", name: "Rivian Automotive", category: "High Volatility" },
  { symbol: "NKE", name: "NIKE, Inc.", category: "Moderate Volatility" },
  { symbol: "ADBE", name: "Adobe Inc.", category: "Moderate Volatility" },
  { symbol: "CRM", name: "Salesforce, Inc.", category: "Moderate Volatility" },
  { symbol: "CRWD", name: "CrowdStrike", category: "High Volatility" },
  { symbol: "EWY", name: "iShares MSCI South Korea ETF", category: "Moderate Volatility" },
  { symbol: "FLKR", name: "Franklin FTSE South Korea ETF", category: "Moderate Volatility" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", category: "Moderate Volatility" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF", category: "High Volatility" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Stable" },
  { symbol: "ORCL", name: "Oracle Corporation", category: "Moderate Volatility" },
  { symbol: "NFLX", name: "Netflix, Inc.", category: "High Volatility" },
  { symbol: "AVGO", name: "Broadcom Inc.", category: "Moderate Volatility" },
  { symbol: "COST", name: "Costco Wholesale", category: "Stable" },
  { symbol: "PEP", name: "PepsiCo, Inc.", category: "Stable" },
  { symbol: "PDD", name: "PDD Holdings Inc.", category: "High Volatility" },
  { symbol: "PANW", name: "Palo Alto Networks", category: "High Volatility" },
  { symbol: "SBUX", name: "Starbucks Corp.", category: "Moderate Volatility" },
  { symbol: "MELI", name: "MercadoLibre, Inc.", category: "High Volatility" },
  { symbol: "INTC", name: "Intel Corporation", category: "Moderate Volatility" },
  { symbol: "LRCX", name: "Lam Research Corp.", category: "High Volatility" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF", category: "High Volatility" },
  { symbol: "SHOP", name: "Shopify Inc.", category: "High Volatility" },
  { symbol: "DIS", name: "The Walt Disney Company", category: "Moderate Volatility" },
  { symbol: "NOW", name: "ServiceNow, Inc.", category: "High Volatility" },
  { symbol: "SMR", name: "NuScale Power Corp.", category: "High Volatility" },
  { symbol: "BMNR", name: "Bitmine Immersion Technologies", category: "High Volatility" },
  { symbol: "CRCL", name: "Circle Internet Financial", category: "High Volatility" },
  { symbol: "ETH", name: "Ethereum", category: "High Volatility" },
  { symbol: "TEAM", name: "Atlassian Corporation", category: "High Volatility" },
  { symbol: "BTC", name: "Bitcoin", category: "High Volatility" },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [stockStats, setStockStats] = useState<Record<string, StockStat>>({});
  const navigate = useNavigate();

  const sortedStocks = React.useMemo(() => {
    return [...POPULAR_STOCKS].sort((a, b) => {
      const rsiA = stockStats[a.symbol]?.rsi ?? 100;
      const rsiB = stockStats[b.symbol]?.rsi ?? 100;
      return rsiA - rsiB;
    });
  }, [stockStats]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const symbols = POPULAR_STOCKS.map(s => s.symbol);
        const response = await fetch("/api/stocks/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        });
        if (response.ok) {
          const results: StockStat[] = await response.json();
          const statsMap: Record<string, StockStat> = {};
          results.forEach(res => {
            statsMap[res.symbol] = res;
          });
          setStockStats(statsMap);
        }
      } catch (err) {
        console.error("Failed to fetch popular stock stats:", err);
      }
    };
    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/rsi_optimizer/${search.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-orange-500/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent blur-3xl -z-10" />
        
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Zap className="w-3 h-3" /> Data-Driven Trading Simulation
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent"
          >
            RSI Strategy <br /> Optimizer
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Backtest and optimize a tiered RSI trading strategy across 3 years of historical data. Compare performance against Buy & Hold and analyze risk-adjusted returns.
          </motion.p>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleSearch} 
            className="relative max-w-md mx-auto group"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              placeholder="Enter Stock Symbol (e.g. AMD)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-lg font-medium"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-black px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-500 hover:text-white transition-all"
            >
              Analyze
            </button>
          </motion.form>
        </div>
      </div>

      {/* Popular Stocks */}
      <div className="max-w-7xl mx-auto px-4 pb-32">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" /> Popular Assets
          </h2>
          <span className="text-xs text-white/20 uppercase tracking-widest font-bold">3-Year Analysis Available</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sortedStocks.map((stock, i) => {
            const stat = stockStats[stock.symbol];
            return (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link 
                  to={`/rsi_optimizer/${stock.symbol}`}
                  className="group block bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition-all hover:bg-white/[0.07] relative overflow-hidden"
                >
                  {stat?.success && stat.rsi < 25 && (
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-green-500 text-[8px] font-black uppercase tracking-tighter rounded-bl-lg">
                      Oversold Peak
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-2xl font-black tracking-tighter group-hover:text-orange-500 transition-colors uppercase flex items-center gap-2">
                        {stock.symbol}
                        {stat?.success && stat.rsi < 25 && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                          >
                            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                          </motion.div>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-white/20 mt-0.5">{stock.category}</div>
                    </div>
                    
                    {stat?.success ? (
                      <div className="text-right relative">
                        {stat.rsi < 35 && (
                          <motion.div 
                            layoutId={`pulse-${stock.symbol}`}
                            className="absolute inset-0 bg-green-500/20 blur-xl rounded-full -z-10"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                          />
                        )}
                        <div className={`text-2xl font-mono font-black italic tracking-tighter flex flex-col items-end ${
                          stat.rsi < 25 ? "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" :
                          stat.rsi < 35 ? "text-green-400" :
                          stat.rsi > 85 ? "text-red-600 font-black" :
                          stat.rsi > 75 ? "text-red-500" :
                          stat.rsi > 65 ? "text-yellow-500" :
                          "text-blue-400"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {stat.rsi < 25 && (
                              <>
                                <DollarSign className="w-4 h-4 text-green-400 animate-bounce" />
                                <span className="text-[10px] font-black bg-green-500 text-black px-1 rounded mr-1 animate-pulse">BUY</span>
                              </>
                            )}
                            {stat.rsi >= 25 && stat.rsi < 35 && <BellRing className="w-4 h-4 text-green-400 animate-bounce" />}
                            {stat.rsi >= 35 && stat.rsi <= 65 && <Activity className="w-4 h-4 text-blue-400 opacity-50" />}
                            {stat.rsi > 65 && stat.rsi <= 75 && <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />}
                            {stat.rsi > 75 && stat.rsi <= 85 && <Zap className="w-4 h-4 text-red-500 animate-pulse fill-red-500" />}
                            {stat.rsi > 85 && (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-600 animate-bounce" />
                                <span className="text-[10px] font-black bg-red-600 text-white px-1 rounded mr-1 animate-pulse">SELL</span>
                              </>
                            )}
                            {stat.rsi.toFixed(1)}
                          </div>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest mt-0.5">
                          RSI (14)
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-white/5 rounded-lg group-hover:bg-orange-500/10 transition-colors">
                        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-orange-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-sm font-medium text-white/60 truncate max-w-[120px]">{stock.name}</div>
                      {stat?.success && (
                        <div className="space-y-1">
                          <div className={cn(
                            "text-xl font-mono font-bold transition-colors",
                            stat.change5p > 0 ? "text-green-500" : stat.change5p < 0 ? "text-red-500" : "text-white/90"
                          )}>
                            ${stat.price.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px]">
                            <div className={cn(
                              "font-mono font-black px-2 py-1 rounded-lg ring-1 ring-white/10",
                              stat.change1p > 0 ? "bg-green-500/10 text-green-400" : stat.change1p < 0 ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/40"
                            )}>
                              1D: {stat.change1p >= 0 ? "+" : ""}{stat.change1p.toFixed(1)}%
                            </div>
                            <div className={cn(
                              "font-mono font-black px-2 py-1 rounded-lg ring-1 ring-white/10",
                              stat.change5p > 0 ? "bg-green-500/10 text-green-400" : stat.change5p < 0 ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/40"
                            )}>
                              5D: {stat.change5p >= 0 ? "+" : ""}{stat.change5p.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {stat?.success && (
                      <div className="text-right">
                        <div className={cn(
                          "text-lg font-mono font-black italic",
                          stat.velocity >= 0 ? "text-purple-400" : "text-pink-400"
                        )}>
                          {stat.velocity >= 0 ? "+" : ""}{stat.velocity.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest leading-none">
                          VEL 5
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-2">
            Educational Purpose Only • Not Financial Advice
          </p>
          <p className="text-[10px] text-white/10 max-w-xl mx-auto">
            All simulations are based on historical data and do not guarantee future results. Trading involves significant risk of loss. Data provided by Yahoo Finance with a 1-hour cache.
          </p>
        </div>
      </footer>
    </div>
  );
}
