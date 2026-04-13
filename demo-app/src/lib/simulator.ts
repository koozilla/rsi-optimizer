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
  volatility: number
): SimulationResult {
  const initialCapital = 7000;
  let cash = initialCapital;
  const stageShares = [0, 0, 0];
  let stage = 0; // 0, 1, 2, 3
  const trades: Trade[] = [];

  const buyAmounts = [1000, 2000, 4000];

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const rsi = rsiValues[i];
    if (isNaN(rsi)) continue;

    // Buying logic (Sequential B1 -> B2 -> B3)
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

    // Selling logic (LIFO: S3 -> S2 -> S1)
    if (stage > 0) {
      const currentStageIdx = stage - 1;
      if (rsi > sellThresholds[currentStageIdx]) {
        const sharesToSell = stageShares[currentStageIdx];
        const amountReceived = sharesToSell * price;
        const originalCost = buyAmounts[currentStageIdx];
        
        const profit = amountReceived - originalCost;
        const profitPercent = (profit / originalCost) * 100;

        cash += amountReceived;
        stageShares[currentStageIdx] = 0;
        
        trades.push({
          date: dates[i],
          type: "sell",
          amount: amountReceived,
          price,
          shares: sharesToSell,
          rsi,
          stage: stage, // Sell the current stage
          profit,
          profitPercent
        });

        stage--;
      }
    }
  }

  const currentSharesValue = stageShares.reduce((sum, s) => sum + (s * prices[prices.length - 1]), 0);
  const finalValue = cash + currentSharesValue;
  const totalGain = finalValue - initialCapital;
  const totalGainPercent = (totalGain / initialCapital) * 100;

  // Buy and Hold Comparison (Buy $7,000 at the first time RSI hits the middle threshold B2)
  let bhFinalValue = initialCapital;
  const triggerRsi = buyThresholds[1];
  
  const firstMidIdx = rsiValues.findIndex(r => !isNaN(r) && r <= triggerRsi);
  const buyIdx = firstMidIdx !== -1 ? firstMidIdx : 0;
  const bhShares = initialCapital / prices[buyIdx];
  bhFinalValue = bhShares * prices[prices.length - 1];

  const buyAndHoldGain = bhFinalValue - initialCapital;
  const buyAndHoldPercent = (buyAndHoldGain / initialCapital) * 100;

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
    buyAndHoldPercent
  };
}

export function findBestThresholds(
  prices: number[],
  rsiValues: number[],
  dates: Date[],
  volatility: number
): SimulationResult {
  let bestResult: SimulationResult | null = null;

  // Search space for thresholds
  // Buy thresholds: typically 20-45
  const buyRange = [45, 40, 35, 30, 25, 20];
  const sellRange = [60, 65, 70, 75, 80, 85];

  // To keep it performant, we'll try a subset of combinations
  // B1 > B2 > B3
  // S1 < S2 < S3
  
  for (let b1 = 0; b1 < buyRange.length; b1++) {
    for (let b2 = b1 + 1; b2 < buyRange.length; b2++) {
      for (let b3 = b2 + 1; b3 < buyRange.length; b3++) {
        for (let s1 = 0; s1 < sellRange.length; s1++) {
          for (let s2 = s1 + 1; s2 < sellRange.length; s2++) {
            for (let s3 = s2 + 1; s3 < sellRange.length; s3++) {
              const bThresholds: [number, number, number] = [buyRange[b1], buyRange[b2], buyRange[b3]];
              const sThresholds: [number, number, number] = [sellRange[s1], sellRange[s2], sellRange[s3]];
              
              const result = simulateStrategy(prices, rsiValues, dates, bThresholds, sThresholds, volatility);
              
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
