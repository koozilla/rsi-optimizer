import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchStockData,
  calculateRSI,
  computeVelocity,
} from "../_lib/stock.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
        const prevPrice =
          prices.length >= 2 ? prices[prices.length - 2] : currentPrice;
        const prev5Price =
          prices.length >= 6 ? prices[prices.length - 6] : prices[0];
        const change5p = ((currentPrice - prev5Price) / prev5Price) * 100;
        const change1p =
          prevPrice !== 0
            ? ((currentPrice - prevPrice) / prevPrice) * 100
            : 0;

        return {
          symbol: s.toUpperCase(),
          price: currentPrice,
          change: currentPrice - prevPrice,
          change1p,
          change5p,
          rsi: rsiValues[rsiValues.length - 1],
          velocity: computeVelocity(rsiValues, 5),
          success: true,
        };
      } catch (err) {
        return { symbol: s.toUpperCase(), success: false };
      }
    })
  );

  res.json(results);
}
