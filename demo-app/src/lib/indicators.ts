/**
 * Computes Relative Strength Index (RSI) for a given period.
 * @param prices Array of closing prices
 * @param period RSI period (default 14)
 * @returns Array of RSI values (same length as prices, first 'period' values will be null/NaN)
 */
export function computeRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const calculateRSI = (avgG: number, avgL: number) => {
    if (avgL === 0) return 100;
    const rs = avgG / avgL;
    return 100 - 100 / (1 + rs);
  };

  rsi[period] = calculateRSI(avgGain, avgLoss);

  // Subsequent values using Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    let currentGain = 0;
    let currentLoss = 0;

    if (diff >= 0) currentGain = diff;
    else currentLoss = -diff;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rsi[i] = calculateRSI(avgGain, avgLoss);
  }

  return rsi;
}

/**
 * Computes annualized volatility based on daily log returns.
 */
export function computeVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  // Annualize (assuming 252 trading days)
  return stdDev * Math.sqrt(252) * 100;
}
