import axios from "axios";

// In-memory cache (lives for the duration of a warm serverless instance)
const memCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour

export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const getRSI = (g: number, l: number) => {
    if (l === 0) return 100;
    return 100 - 100 / (1 + g / l);
  };

  rsi[period] = getRSI(avgGain, avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    rsi[i] = getRSI(avgGain, avgLoss);
  }
  return rsi;
}

export function computeVelocity(rsi: number[], period: number = 5): number {
  if (rsi.length < period + 1) return 0;
  const i = rsi.length - 1;
  const valNow = rsi[i];
  const valPrev = rsi[i - period];
  if (isNaN(valNow) || isNaN(valPrev)) return 0;
  return valNow - valPrev;
}

export async function fetchStockData(symbol: string): Promise<any[]> {
  // Check in-memory cache
  const cached = memCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 3);

  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Origin: "https://finance.yahoo.com",
      Referer: "https://finance.yahoo.com/",
    },
    timeout: 10000,
  });

  const result = response.data;
  if (!result?.chart?.result?.[0]) {
    throw new Error(`Data format error for ${symbol}`);
  }

  const chartResult = result.chart.result[0];
  const timestamps = chartResult.timestamp;
  const indicators = chartResult.indicators.quote[0];
  const adjClose = chartResult.indicators.adjclose?.[0]?.adjclose;

  if (!timestamps || !indicators) {
    throw new Error(`Incomplete historical data for ${symbol}`);
  }

  const formattedData = timestamps
    .map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString().split("T")[0],
      close: adjClose
        ? adjClose[i]
        : indicators.close
        ? indicators.close[i]
        : null,
    }))
    .filter((d: any) => d.close !== null && d.close !== undefined);

  if (formattedData.length === 0) {
    throw new Error("No valid price data returned from API");
  }

  // Store in memory cache
  memCache.set(symbol, { timestamp: Date.now(), data: formattedData });

  return formattedData;
}
