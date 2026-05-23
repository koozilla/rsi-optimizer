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

/**
 * Computes Bollinger Bands.
 * @returns Array of { upper, middle, lower } values
 */
export function computeBollingerBands(prices: number[], period: number = 20, multiplier: number = 2): { upper: number, middle: number, lower: number }[] {
  const bands = new Array(prices.length).fill({ upper: NaN, middle: NaN, lower: NaN });
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    
    const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    bands[i] = {
      upper: middle + (multiplier * stdDev),
      middle: middle,
      lower: middle - (multiplier * stdDev)
    };
  }
  
  return bands;
}

/**
 * Computes the "velocity" or derivative of RSI to detect momentum exhaustion.
 */
export function computeRSIVelocity(rsi: number[], period: number = 5): number[] {
  const velocity = new Array(rsi.length).fill(NaN);
  
  for (let i = period; i < rsi.length; i++) {
    const valNow = rsi[i];
    const valPrev = rsi[i - period];
    if (!isNaN(valNow) && !isNaN(valPrev)) {
      velocity[i] = valNow - valPrev;
    }
  }
  
  return velocity;
}

export interface Pivot {
  index: number;
  type: 'high' | 'low';
  value: number;
}

/**
 * Finds local technical pivots (peaks and valleys) in a series.
 * @param data Array of numbers (Price or RSI)
 * @param window Number of bars on each side required to be a pivot
 */
export function findPivots(data: number[], window: number = 5): Pivot[] {
  const pivots: Pivot[] = [];
  
  for (let i = window; i < data.length - window; i++) {
    const current = data[i];
    if (isNaN(current)) continue;

    const slice = data.slice(i - window, i + window + 1);
    const validSlice = slice.filter(v => !isNaN(v));
    if (validSlice.length < window * 2 + 1) continue;

    const max = Math.max(...validSlice);
    const min = Math.min(...validSlice);

    if (current === max) {
      pivots.push({ index: i, type: 'high', value: current });
    } else if (current === min) {
      pivots.push({ index: i, type: 'low', value: current });
    }
  }
  
  return pivots;
}

export interface DivergenceEvent {
  index: number;
  type: 'bullish' | 'bearish' | 'hidden_bullish';
  label: 'B' | 'S' | 'HB';
  priceIndices: [number, number];
  rsiIndices: [number, number];
}

/**
 * Detects divergences between Price and RSI using Pivot Points.
 */
export function detectDivergences(prices: number[], rsi: number[]): DivergenceEvent[] {
  const events: DivergenceEvent[] = [];
  const pricePivots = findPivots(prices, 3);
  const rsiPivots = findPivots(rsi, 3);

  // Group pivots by type
  const priceLows = pricePivots.filter(p => p.type === 'low');
  const priceHighs = pricePivots.filter(p => p.type === 'high');
  const rsiLows = rsiPivots.filter(p => p.type === 'low');
  const rsiHighs = rsiPivots.filter(p => p.type === 'high');

  // Bullish Divergence Detection (Lows)
  for (let i = 1; i < priceLows.length; i++) {
    const p1 = priceLows[i-1];
    const p2 = priceLows[i];
    
    // Find corresponding RSI lows near these price pivots
    const r1 = rsiLows.find(r => Math.abs(r.index - p1.index) <= 5);
    const r2 = rsiLows.find(r => Math.abs(r.index - p2.index) <= 5);

    if (r1 && r2) {
      // Regular Bullish: Lower Low in Price, Higher Low in RSI
      if (p2.value < p1.value && r2.value > r1.value) {
        events.push({
          index: p2.index,
          type: 'bullish',
          label: 'B',
          priceIndices: [p1.index, p2.index],
          rsiIndices: [r1.index, r2.index]
        });
      }
      // Hidden Bullish: Higher Low in Price, Lower Low in RSI (Continuation)
      else if (p2.value > p1.value && r2.value < r1.value) {
        events.push({
          index: p2.index,
          type: 'hidden_bullish',
          label: 'HB',
          priceIndices: [p1.index, p2.index],
          rsiIndices: [r1.index, r2.index]
        });
      }
    }
  }

  // Bearish Divergence Detection (Highs)
  for (let i = 1; i < priceHighs.length; i++) {
    const p1 = priceHighs[i-1];
    const p2 = priceHighs[i];
    
    const r1 = rsiHighs.find(r => Math.abs(r.index - p1.index) <= 5);
    const r2 = rsiHighs.find(r => Math.abs(r.index - p2.index) <= 5);

    if (r1 && r2) {
      // Regular Bearish: Higher High in Price, Lower High in RSI
      if (p2.value > p1.value && r2.value < r1.value) {
        events.push({
          index: p2.index,
          type: 'bearish',
          label: 'S',
          priceIndices: [p1.index, p2.index],
          rsiIndices: [r1.index, r2.index]
        });
      }
    }
  }

  return events;
}
