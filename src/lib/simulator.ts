import { computeRSI, computeVolatility, type DivergenceEvent } from "./indicators";

export interface Trade {
  date: Date;
  type: "buy" | "sell";
  amount: number;
  price: number;
  shares: number;
  rsi: number;
  stage: number;
  profit?: number;
  profitPercent?: number;
}

export interface SimulationResult {
  totalGain: number;
  totalGainPercent: number;
  trades: Trade[];
  finalValue: number;
  initialBalance: number;
  buyThresholds: [number, number, number];
  sellThresholds: [number, number, number];
  volatility: number;
  category: "High" | "Moderate" | "Low";
  buyAndHoldGain: number;
  buyAndHoldPercent: number;
  realizedGain: number;
  unrealizedGain: number;
  currentPrice: number;
  currentRsi: number;
  currentHoldings: {
    stage: number;
    shares: number;
    cost: number;
    currentValue: number;
    profit: number;
    profitPercent: number;
  }[];
  dcaGain: number;
  dcaPercent: number;
  pureRsiGain: number;
  pureRsiPercent: number;
  divStrategyGain: number;
  divStrategyPercent: number;
  pureRsiTrades: Trade[];
}

export function getStockCategory(volatility: number): "High" | "Moderate" | "Low" {
  if (volatility > 40) return "High";
  if (volatility > 25) return "Moderate";
  return "Low";
}

export function simulateStrategy(
  prices: number[],
  rsiValues: number[],
  dates: Date[],
  buyThresholds: [number, number, number],
  sellThresholds: [number, number, number],
  volatility: number,
  rsiVelocity?: number[],
  divergences?: DivergenceEvent[]
): SimulationResult {
  const initialCapital = 7000;
  
  // Momentum-Filtered RSI Strategy Logic: 
  // 1. Pure RSI for Buying (no filters)
  // 2. Sell if RSI >= Threshold AND RSI Velocity < 0 (Momentum turns negative)
  const runEnhancedSim = () => {
    let cash = initialCapital;
    const stageShares = [0, 0, 0];
    let stage = 0;
    const trades: Trade[] = [];
    const buyAmounts = [1000, 2000, 4000];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const rsi = rsiValues[i];
      if (isNaN(rsi)) continue;

      // Buy Phase (Pure RSI)
      if (stage < 3) {
        if (rsi < buyThresholds[stage]) {
          const amountToSpend = buyAmounts[stage];
          const sharesToBuy = amountToSpend / price;
          stageShares[stage] = sharesToBuy;
          cash -= amountToSpend;
          stage++;
          trades.push({
            date: dates[i],
            type: "buy",
            amount: amountToSpend,
            price,
            shares: sharesToBuy,
            rsi,
            stage,
          });
        }
      }

      // Sell Phase (Threshold + Negative Momentum)
      if (stage > 0) {
        const sellIdx = 3 - stage;
        const vel = rsiVelocity ? rsiVelocity[i] : 0;
        
        // Momentum "turns negative" means velocity < 0
        if (rsi >= sellThresholds[sellIdx] && vel < 0) {
          const sharesToSell = stageShares[stage - 1];
          const amountReceived = sharesToSell * price;
          const originalCost = buyAmounts[stage - 1];
          const profit = amountReceived - originalCost;
          const profitPercent = (profit / originalCost) * 100;

          cash += amountReceived;
          stageShares[stage - 1] = 0;
          trades.push({
            date: dates[i],
            type: "sell",
            amount: amountReceived,
            price,
            shares: sharesToSell,
            rsi,
            stage: stage,
            profit,
            profitPercent
          });
          stage--;
        }
      }
    }
    return { cash, stageShares, trades, buyAmounts };
  };

  // Pure RSI Strategy for comparison
  const runPureSim = () => {
    let cash = initialCapital;
    const stageShares = [0, 0, 0];
    let stage = 0;
    const trades: Trade[] = [];
    const buyAmounts = [1000, 2000, 4000];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const rsi = rsiValues[i];
      if (isNaN(rsi)) continue;

      if (stage < 3 && rsi < buyThresholds[stage]) {
        const amountToSpend = buyAmounts[stage];
        const sharesToBuy = amountToSpend / price;
        stageShares[stage] = sharesToBuy;
        cash -= amountToSpend;
        stage++;
        trades.push({ date: dates[i], type: "buy", amount: amountToSpend, price, shares: sharesToBuy, rsi, stage });
      }

      if (stage > 0) {
        const sellIdx = 3 - stage;
        if (rsi >= sellThresholds[sellIdx]) {
          const sharesToSell = stageShares[stage - 1];
          const amountReceived = sharesToSell * price;
          cash += amountReceived;
          stageShares[stage - 1] = 0;
          trades.push({ date: dates[i], type: "sell", amount: amountReceived, price, shares: sharesToSell, rsi, stage });
          stage--;
        }
      }
    }
    return { cash, stageShares, trades, buyAmounts };
  };

  const { cash, stageShares, trades, buyAmounts } = runEnhancedSim();
  const pureParams = runPureSim();
  const pure = {
    cash: pureParams.cash,
    stageShares: pureParams.stageShares,
    trades: pureParams.trades
  };

  const currentPrice = prices[prices.length - 1];
  const currentHoldings = stageShares.map((shares, idx) => {
    if (shares <= 0) return null;
    const cost = buyAmounts[idx];
    const currentValue = shares * currentPrice;
    const profit = currentValue - cost;
    const profitPercent = (profit / cost) * 100;
    return {
      stage: idx + 1,
      shares,
      cost,
      currentValue,
      profit,
      profitPercent
    };
  }).filter((h): h is NonNullable<typeof h> => h !== null);

  const currentSharesValue = stageShares.reduce((sum, s) => sum + (s * currentPrice), 0);
  const costOfCurrentShares = stageShares.reduce((sum, s, idx) => s > 0 ? sum + buyAmounts[idx] : sum, 0);
  const unrealizedGain = currentSharesValue - costOfCurrentShares;
  const realizedGain = trades.reduce((sum, t) => t.type === 'sell' ? sum + (t.profit || 0) : sum, 0);

  const finalValue = cash + currentSharesValue;
  const totalGain = finalValue - initialCapital;
  const totalGainPercent = (totalGain / initialCapital) * 100;

  // Buy and Hold Comparison
  let bhFinalValue = initialCapital;
  const triggerRsi = buyThresholds[1];
  
  const firstMidIdx = rsiValues.findIndex(r => !isNaN(r) && r <= triggerRsi);
  const buyIdx = firstMidIdx !== -1 ? firstMidIdx : 0;
  const buyPrice = prices[buyIdx];
  const bhShares = buyPrice > 0 ? initialCapital / buyPrice : 0;
  bhFinalValue = bhShares * currentPrice;

  const buyAndHoldGain = bhFinalValue - initialCapital;
  const buyAndHoldPercent = (buyAndHoldGain / initialCapital) * 100;

  // DCA Strategy
  let dcaShares = 0;
  if (prices.length > 0) {
    const dailyInvestment = initialCapital / prices.length;
    for (let i = 0; i < prices.length; i++) {
      if (prices[i] > 0) {
        dcaShares += dailyInvestment / prices[i];
      }
    }
  }
  const dcaFinalValue = dcaShares * currentPrice;
  const dcaGain = dcaFinalValue - initialCapital;
  const dcaPercent = (dcaGain / initialCapital) * 100;

  // Pure RSI Strategy Stats from pure sim
  const pureSharesValue = pure.stageShares.reduce((sum, s) => sum + (s * currentPrice), 0);
  const pureFinalValue = pure.cash + pureSharesValue;
  const pureRsiGain = pureFinalValue - initialCapital;
  const pureRsiPercent = (pureRsiGain / initialCapital) * 100;

  return {
    totalGain,
    totalGainPercent,
    trades,
    finalValue,
    initialBalance: initialCapital,
    buyThresholds,
    sellThresholds,
    volatility,
    category: getStockCategory(volatility),
    buyAndHoldGain,
    buyAndHoldPercent,
    realizedGain,
    unrealizedGain,
    currentPrice,
    currentRsi: rsiValues[rsiValues.length - 1],
    currentHoldings,
    dcaGain,
    dcaPercent,
    pureRsiGain,
    pureRsiPercent,
    divStrategyGain: totalGain,
    divStrategyPercent: totalGainPercent,
    pureRsiTrades: pure.trades
  };
}

export function findBestThresholds(
  prices: number[],
  rsiValues: number[],
  dates: Date[],
  volatility: number,
  rsiVelocity?: number[],
  divergences?: DivergenceEvent[]
): SimulationResult {
  let bestResult: SimulationResult | null = null;
  
  // Try with Velocity Filter
  const velBuyRange = [50, 45, 40, 35, 30, 25];
  const sellRange = [55, 60, 65, 70, 75, 80, 85];

  for (let b1 = 0; b1 < velBuyRange.length; b1++) {
    for (let b2 = b1 + 1; b2 < velBuyRange.length; b2++) {
      for (let b3 = b2 + 1; b3 < velBuyRange.length; b3++) {
        for (let s1 = 0; s1 < sellRange.length; s1++) {
          for (let s2 = s1 + 1; s2 < sellRange.length; s2++) {
            for (let s3 = s2 + 1; s3 < sellRange.length; s3++) {
              const bThresholds: [number, number, number] = [velBuyRange[b1], velBuyRange[b2], velBuyRange[b3]];
              const sThresholds: [number, number, number] = [sellRange[s1], sellRange[s2], sellRange[s3]];
              
              const result = simulateStrategy(prices, rsiValues, dates, bThresholds, sThresholds, volatility, rsiVelocity, divergences);
              
              if (!bestResult || result.totalGain > bestResult.totalGain) {
                bestResult = result;
              }
            }
          }
        }
      }
    }
  }

  return bestResult!;
}
