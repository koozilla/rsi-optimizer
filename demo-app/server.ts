import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch stock data via direct CSV scraping
  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      const end = new Date();
      const start = new Date();
      start.setFullYear(end.getFullYear() - 3);

      // Convert to Unix timestamps (seconds)
      const period1 = Math.floor(start.getTime() / 1000);
      const period2 = Math.floor(end.getTime() / 1000);

      // Use the v8/finance/chart endpoint which is more reliable for direct scraping
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

      console.log(`Scraping data from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      const result = response.data;
      
      if (!result?.chart?.result?.[0]) {
        return res.status(404).json({ error: "No data found for this symbol" });
      }

      const chartResult = result.chart.result[0];
      const timestamps = chartResult.timestamp;
      const indicators = chartResult.indicators.quote[0];
      const adjClose = chartResult.indicators.adjclose?.[0]?.adjclose;
      
      if (!timestamps || !indicators) {
        return res.status(404).json({ error: "Incomplete data found for this symbol" });
      }

      // Map JSON response to the format expected by the frontend
      // Prefer adjClose if available for more accurate backtesting
      const formattedData = timestamps.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: indicators.open[i],
        high: indicators.high[i],
        low: indicators.low[i],
        close: adjClose ? adjClose[i] : indicators.close[i],
        volume: indicators.volume[i]
      })).filter((d: any) => d.close !== null);

      if (formattedData.length === 0) {
        return res.status(404).json({ error: "No valid price data found" });
      }

      res.json(formattedData);
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to scrape stock data. Yahoo Finance might be blocking the request or the symbol is invalid." });
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
