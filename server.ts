import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const CACHE_DIR = path.join(process.cwd(), "data_cache");
  const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour

  // Ensure cache directory exists
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create cache directory:", err);
  }

  // RSI calculation helper for the server
  function calculateRSI(prices: number[], period: number = 14): number[] {
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

  function computeVelocity(rsi: number[], period: number = 5): number {
    if (rsi.length < period + 1) return 0;
    const i = rsi.length - 1;
    const valNow = rsi[i];
    const valPrev = rsi[i - period];
    if (isNaN(valNow) || isNaN(valPrev)) return 0;
    return valNow - valPrev;
  }

  // Common function to fetch and process stock data
  async function fetchStockData(symbol: string) {
    console.log(`Fetching data for: ${symbol}`);
    const cachePath = path.join(CACHE_DIR, `${symbol}.json`);

    // 1. Try to read from disk cache
    try {
      const cacheData = await fs.readFile(cachePath, "utf-8");
      const { timestamp, data } = JSON.parse(cacheData);
      const age = Date.now() - timestamp;

      if (age < CACHE_TTL) {
        return data;
      }
    } catch (err) {
      // Cache doesn't exist or is invalid
    }

    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 3);

    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    
    // Using query2 which is sometimes more lenient than query1
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://finance.yahoo.com',
          'Referer': 'https://finance.yahoo.com/'
        },
        timeout: 10000
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

      const formattedData = timestamps.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        close: adjClose ? adjClose[i] : (indicators.close ? indicators.close[i] : null),
      })).filter((d: any) => d.close !== null && d.close !== undefined);

      if (formattedData.length === 0) throw new Error("No valid price data returned from API");

      // 2. Save to disk cache
      try {
        await fs.writeFile(cachePath, JSON.stringify({
          timestamp: Date.now(),
          data: formattedData
        }), "utf-8");
      } catch (err) {
        console.error(`Failed to save cache for ${symbol}:`, err);
      }

      return formattedData;
    } catch (error: any) {
      console.error(`Yahoo Finance Error for ${symbol}:`, error.message);
      throw error;
    }
  }

  // API Route for batch stock info (Price + RSI)
  app.post("/api/stocks/batch", async (req, res) => {
    try {
      const { symbols } = req.body;
      if (!Array.isArray(symbols)) {
        return res.status(400).json({ error: "symbols must be an array" });
      }

      const results = await Promise.all(
        symbols.map(async (s: string) => {
          try {
            const data = await fetchStockData(s.toUpperCase());
            const prices = data.map((d: any) => d.close);
            const rsiValues = calculateRSI(prices);
            const currentPrice = prices[prices.length - 1];
            const prevPrice = prices.length >= 2 ? prices[prices.length - 2] : currentPrice;
            const prev5Price = prices.length >= 6 ? prices[prices.length - 6] : prices[0];
            const change5p = ((currentPrice - prev5Price) / prev5Price) * 100;
            const change1p = prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
            
            return {
              symbol: s.toUpperCase(),
              price: currentPrice,
              change: currentPrice - prevPrice,
              change1p: change1p,
              change5p: change5p,
              rsi: rsiValues[rsiValues.length - 1],
              velocity: computeVelocity(rsiValues, 5),
              success: true
            };
          } catch (err) {
            return { symbol: s.toUpperCase(), success: false };
          }
        })
      );

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Batch fetch failed" });
    }
  });

  app.get("/api/stock/:symbol", async (req, res) => {
    const { symbol: rawSymbol } = req.params;
    const symbol = rawSymbol.toUpperCase();
    try {
      console.log(`API Request for: ${symbol}`);
      const data = await fetchStockData(symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Scraping error for ${symbol}:`, error.message);
      res.status(500).json({ 
        error: `Failed to fetch data for ${symbol}. ${error.message}`,
        symbol
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
