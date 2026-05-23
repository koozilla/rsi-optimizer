import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchStockData } from "../_lib/stock";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { symbol: rawSymbol } = req.query;
  const symbol = (rawSymbol as string).toUpperCase();

  try {
    const data = await fetchStockData(symbol);
    res.json(data);
  } catch (error: any) {
    console.error(`Error fetching ${symbol}:`, error.message);
    res.status(500).json({
      error: `Failed to fetch data for ${symbol}. ${error.message}`,
      symbol,
    });
  }
}
