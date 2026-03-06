import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = normalize(__dirname);
const PORT = Number(process.env.PORT || 8080);
const CHANGENOW_API_KEY = String(process.env.CHANGENOW_API_KEY || "").trim();
const SIMPLESWAP_API_KEY = String(process.env.SIMPLESWAP_API_KEY || "").trim();

const CHAINS = [
  { id: "ethereum", name: "Ethereum", family: "EVM" },
  { id: "bsc", name: "BNB Smart Chain", family: "EVM" },
  { id: "polygon", name: "Polygon", family: "EVM" },
  { id: "arbitrum", name: "Arbitrum", family: "EVM" },
  { id: "optimism", name: "Optimism", family: "EVM" },
  { id: "base", name: "Base", family: "EVM" },
  { id: "avalanche", name: "Avalanche C-Chain", family: "EVM" },
  { id: "sonic", name: "Sonic", family: "EVM" },
  { id: "zksync", name: "zkSync Era", family: "EVM" },
  { id: "linea", name: "Linea", family: "EVM" },
  { id: "solana", name: "Solana", family: "SVM" },
  { id: "tron", name: "Tron", family: "TVM" },
  { id: "xrpl", name: "XRP Ledger", family: "XRPL" },
];

const TOKENS = [
  { id: "USDT", usd: 1 },
  { id: "USDC", usd: 1 },
  { id: "PEPESHIB", usd: 0.00002 },
  { id: "BNB", usd: 560 },
  { id: "ETH", usd: 3200 },
  { id: "POL", usd: 0.95 },
  { id: "AVAX", usd: 42 },
  { id: "S", usd: 0.05 },
  { id: "SOL", usd: 140 },
  { id: "TRX", usd: 0.13 },
  { id: "XRP", usd: 0.62 },
];
const MARKET_PRICE_IDS = {
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  ETH: "ethereum",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  S: "sonic-3",
  SOL: "solana",
  TRX: "tron",
  XRP: "ripple",
};
const MARKET_PRICE_TTL_MS = 300_000;
const LI_FI_QUOTE_CACHE_TTL_MS = 45_000;
const COINBASE_SPOT_PAIRS = {
  ETH: "ETH-USD",
  POL: "POL-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  AVAX: "AVAX-USD",
};
const BINANCE_SPOT_SYMBOLS = {
  BNB: "BNBUSDT",
  ETH: "ETHUSDT",
  POL: "POLUSDT",
  AVAX: "AVAXUSDT",
  SOL: "SOLUSDT",
  TRX: "TRXUSDT",
  XRP: "XRPUSDT",
};
const OKX_SPOT_PAIRS = {
  BNB: "BNB-USDT",
  ETH: "ETH-USDT",
  POL: "POL-USDT",
  AVAX: "AVAX-USDT",
  SOL: "SOL-USDT",
  TRX: "TRX-USDT",
  XRP: "XRP-USDT",
};
const KUCOIN_SPOT_PAIRS = {
  BNB: "BNB-USDT",
  ETH: "ETH-USDT",
  POL: "POL-USDT",
  AVAX: "AVAX-USDT",
  SOL: "SOL-USDT",
  TRX: "TRX-USDT",
  XRP: "XRP-USDT",
};
const KRAKEN_SPOT_PAIRS = {
  BNB: "BNBUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  XRP: "XRPUSD",
  AVAX: "AVAXUSD",
  TRX: "TRXUSD",
};
const COINCAP_ASSET_IDS = {
  BNB: "binance-coin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "xrp",
  AVAX: "avalanche",
  TRX: "tron",
  POL: "polygon",
};
const PSHIB_TOKEN_ADDRESS_BSC = "0x9d4c1d37E78A46A991854D6A71F1EEdC9f349150";
const PSHIB_PAIR_ADDRESS_BSC = "0x29ad7e9efa3c75b573ba1492b814e758f856b17f";

const DEFAULT_CFG = {
  taxPercent: 0.15,
  protocolFee: 0.05,
  bridgeFee: 0.08,
  taxWallets: {
    ethereum: "0xTaxEthTreasury000000000000000000000001",
    bsc: "0xTaxBscTreasury000000000000000000000000001",
    polygon: "0xTaxPolygonTreasury000000000000000000001",
    arbitrum: "0xTaxArbTreasury000000000000000000000001",
    optimism: "0xTaxOpTreasury0000000000000000000000001",
    base: "0xTaxBaseTreasury000000000000000000000001",
    avalanche: "0xTaxAvaxTreasury0000000000000000000001",
    sonic: "0xTaxSonicTreasury00000000000000000000001",
    zksync: "0xTaxZkTreasury00000000000000000000000001",
    linea: "0xTaxLineaTreasury00000000000000000000001",
    solana: "So1TaxWallet11111111111111111111111111111111",
    tron: "TQTaxWallet11111111111111111111111111111",
    xrpl: "rTaxWallet111111111111111111111111111111",
  },
};

const AUTO_PROVIDERS = [
  {
    key: "across",
    label: "Across",
    estFeePct: 0.03,
    supports: (q) =>
      q.fromChain.family === "EVM" &&
      q.toChain.family === "EVM" &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://app.across.to/",
    note: "Auto-selected low-fee EVM bridge route. Verify route details in checkout.",
  },
  {
    key: "debridge",
    label: "deBridge",
    estFeePct: 0.04,
    supports: (q) =>
      q.fromChain.family === "EVM" &&
      q.toChain.family === "EVM" &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://app.debridge.finance/",
    note: "Auto-selected deBridge route for EVM bridge flow. Verify route details in checkout.",
  },
  {
    key: "mayan",
    label: "Mayan",
    estFeePct: 0.08,
    supports: (q) =>
      ["EVM", "SVM"].includes(q.fromChain.family) &&
      ["EVM", "SVM"].includes(q.toChain.family) &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://swap.mayan.finance/",
    note: "Auto-selected route for EVM/Solana flow. Verify route details in checkout.",
  },
  {
    key: "relay",
    label: "Relay",
    estFeePct: 0.1,
    supports: (q) =>
      q.fromChain.family === "EVM" &&
      q.toChain.family === "EVM" &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://relay.link/bridge",
    note: "Auto-selected route with EVM bridge aggregation. Verify route details in checkout.",
  },
  {
    key: "jumper",
    label: "Jumper (LI.FI)",
    estFeePct: 0.2,
    supports: (q) =>
      ["EVM", "SVM"].includes(q.fromChain.family) &&
      ["EVM", "SVM"].includes(q.toChain.family) &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://jumper.exchange/",
    note: "Auto-selected LI.FI aggregator route for EVM/Solana flow. Verify route details in checkout.",
  },
  {
    key: "changenow",
    label: "ChangeNOW",
    estFeePct: 0.35,
    supports: () => true,
    url: (quote) => {
      const fromSym = quote.fromToken.id.toLowerCase();
      const toSym = quote.toToken.id.toLowerCase();
      const amount = Number(quote.amountAfterTaxOnly.toFixed(8));
      return `https://changenow.io/exchange?from=${encodeURIComponent(fromSym)}&to=${encodeURIComponent(toSym)}&amount=${encodeURIComponent(amount)}`;
    },
    note: "Verify chain/network selection and destination address inside provider checkout.",
  },
  {
    key: "simpleswap",
    label: "SimpleSwap",
    estFeePct: 0.55,
    supports: () => true,
    url: (quote) => {
      const fromSym = quote.fromToken.id.toLowerCase();
      const toSym = quote.toToken.id.toLowerCase();
      const amount = Number(quote.amountAfterTaxOnly.toFixed(8));
      return `https://simpleswap.io/?from=${encodeURIComponent(fromSym)}&to=${encodeURIComponent(toSym)}&amount=${encodeURIComponent(amount)}`;
    },
    note: "Set source/destination networks to match selected chains before confirming.",
  },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
const SWAP_ORDERS = new Map();
const MARKET_PRICE_CACHE = {
  updatedAt: 0,
  source: "uninitialized",
  prices: {},
  providers: [],
};
const LI_FI_QUOTE_CACHE = new Map();
const LI_FI_BASE_URL = "https://li.quest/v1";
const DEBRIDGE_BASE_URL = "https://dln.debridge.finance";
const DEBRIDGE_STATUS_BASE_URL = "https://stats-api.dln.trade/api/Orders";
const ACROSS_BASE_URL = "https://app.across.to/api";
const EVM_CHAIN_IDS = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  sonic: 146,
  zksync: 324,
  linea: 59144,
};
const LI_FI_CHAIN_IDS = {
  ...EVM_CHAIN_IDS,
  solana: 1151111081099710,
};
const TOKEN_META = {
  ethereum: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  },
  bsc: {
    BNB: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  },
  polygon: {
    POL: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    USDC: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  },
  arbitrum: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebe478A1C0b69FCbb9", decimals: 6 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  },
  optimism: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CaF62653d097Ff85", decimals: 6 },
  },
  base: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
  avalanche: {
    AVAX: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    USDC: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  },
  sonic: {
    S: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0x6047828dc181963ba44974801ff68e538da5eaf9", decimals: 6 },
    USDC: { address: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", decimals: 6 },
  },
  solana: {
    SOL: { address: "11111111111111111111111111111111", decimals: 9 },
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  },
};
const BRIDGE_KEY_MAP = {
  across: "across",
  relay: "relay",
  jumper: "",
  mayan: "mayan",
  debridge: "debridge",
};

function applyCors(req, res, extra = {}) {
  const requestedHeaders = String(req.headers["access-control-request-headers"] || "").trim();
  const allowHeaders = requestedHeaders || "Content-Type, Authorization, X-Requested-With, Accept, Origin";
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
    ...extra,
  };
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getChain(id) {
  return CHAINS.find((c) => c.id === id) || CHAINS[0];
}

function getToken(id, prices = null) {
  const token = TOKENS.find((t) => t.id === id) || TOKENS[0];
  const usd = prices && prices[token.id] != null ? asNum(prices[token.id], 0) : 0;
  return { ...token, usd };
}

function getConfig(input = {}) {
  return {
    taxPercent: Math.max(0, asNum(input.taxPercent, DEFAULT_CFG.taxPercent)),
    protocolFee: Math.max(0, asNum(input.protocolFee, DEFAULT_CFG.protocolFee)),
    bridgeFee: Math.max(0, asNum(input.bridgeFee, DEFAULT_CFG.bridgeFee)),
    taxWallets: { ...DEFAULT_CFG.taxWallets, ...(input.taxWallets || {}) },
  };
}

async function fetchLiveMarketPrices() {
  const ids = Array.from(new Set(Object.values(MARKET_PRICE_IDS)));
  const params = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: "usd",
  });
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?${params.toString()}`);
  const prices = {};
  Object.entries(MARKET_PRICE_IDS).forEach(([symbol, id]) => {
    const usd = asNum(data?.[id]?.usd, 0);
    if (usd > 0) prices[symbol] = usd;
  });
  return prices;
}

async function fetchCoinbaseMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(COINBASE_SPOT_PAIRS).map(async ([symbol, pair]) => {
    const data = await fetchJson(`https://api.coinbase.com/v2/prices/${pair}/spot`);
    const usd = asNum(data?.data?.amount, 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchBinanceMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(BINANCE_SPOT_SYMBOLS).map(async ([symbol, pair]) => {
    const data = await fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`);
    const usd = asNum(data?.price, 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchOkxMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(OKX_SPOT_PAIRS).map(async ([symbol, pair]) => {
    const data = await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(pair)}`);
    const ticker = Array.isArray(data?.data) ? data.data[0] : null;
    const usd = asNum(ticker?.last, 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchKuCoinMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(KUCOIN_SPOT_PAIRS).map(async ([symbol, pair]) => {
    const data = await fetchJson(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${encodeURIComponent(pair)}`);
    const usd = asNum(data?.data?.price, 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchKrakenMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(KRAKEN_SPOT_PAIRS).map(async ([symbol, pair]) => {
    const data = await fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pair)}`);
    const result = data?.result && typeof data.result === "object" ? Object.values(data.result)[0] : null;
    const usd = asNum(result?.c?.[0], 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchCoinCapMarketPrices() {
  const prices = {};
  await Promise.all(Object.entries(COINCAP_ASSET_IDS).map(async ([symbol, assetId]) => {
    const data = await fetchJson(`https://api.coincap.io/v2/assets/${encodeURIComponent(assetId)}`);
    const usd = asNum(data?.data?.priceUsd, 0);
    if (usd > 0) prices[symbol] = usd;
  }));
  return prices;
}

async function fetchGeckoTerminalMarketPrices() {
  const prices = {};
  const data = await fetchJson(`https://api.geckoterminal.com/api/v2/simple/networks/bsc/token_price/${PSHIB_TOKEN_ADDRESS_BSC}`);
  const tokenPrices = data?.data?.attributes?.token_prices || {};
  const usd = asNum(tokenPrices?.[PSHIB_TOKEN_ADDRESS_BSC] ?? tokenPrices?.[PSHIB_TOKEN_ADDRESS_BSC.toLowerCase()] ?? 0, 0);
  if (usd > 0) prices.PEPESHIB = usd;
  return prices;
}

async function fetchDexScreenerMarketPrices() {
  const prices = {};
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/pairs/bsc/${PSHIB_PAIR_ADDRESS_BSC}`);
  const pair = Array.isArray(data?.pairs) ? data.pairs[0] : null;
  const usd = asNum(pair?.priceUsd, 0);
  if (usd > 0) prices.PEPESHIB = usd;
  return prices;
}

function stablecoinMarketPrices() {
  return {
    USDT: 1,
    USDC: 1,
  };
}

async function fetchAggregatedMarketPrices() {
  const providerFetchers = [
    { key: "stable", fetcher: async () => stablecoinMarketPrices() },
    { key: "coingecko", fetcher: fetchLiveMarketPrices },
    { key: "coinbase", fetcher: fetchCoinbaseMarketPrices },
    { key: "binance", fetcher: fetchBinanceMarketPrices },
    { key: "okx", fetcher: fetchOkxMarketPrices },
    { key: "kucoin", fetcher: fetchKuCoinMarketPrices },
    { key: "kraken", fetcher: fetchKrakenMarketPrices },
    { key: "coincap", fetcher: fetchCoinCapMarketPrices },
    { key: "geckoterminal", fetcher: fetchGeckoTerminalMarketPrices },
    { key: "dexscreener", fetcher: fetchDexScreenerMarketPrices },
  ];
  const prices = {};
  const activeProviders = [];

  for (const provider of providerFetchers) {
    try {
      const next = await provider.fetcher();
      let merged = false;
      Object.entries(next || {}).forEach(([symbol, usd]) => {
        const value = asNum(usd, 0);
        if (value > 0) {
          prices[symbol] = value;
          merged = true;
        }
      });
      if (merged) activeProviders.push(provider.key);
    } catch (err) {
      console.warn(`[PepeShibDex] Market price provider failed: ${provider.key}: ${err?.message || err}`);
    }
  }

  return {
    prices,
    source: activeProviders.length ? activeProviders.join("+") : "unavailable",
    providers: activeProviders,
  };
}

async function getMarketPrices(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && MARKET_PRICE_CACHE.updatedAt && now - MARKET_PRICE_CACHE.updatedAt < MARKET_PRICE_TTL_MS) {
    return { ...MARKET_PRICE_CACHE.prices };
  }
  try {
    const result = await fetchAggregatedMarketPrices();
    if (!Object.keys(result.prices).length) {
      throw new Error("No live market prices available from configured providers");
    }
    MARKET_PRICE_CACHE.prices = result.prices;
    MARKET_PRICE_CACHE.updatedAt = now;
    MARKET_PRICE_CACHE.source = result.source;
    MARKET_PRICE_CACHE.providers = result.providers;
  } catch (err) {
    console.warn(`[PepeShibDex] No live market price snapshot available: ${err?.message || err}`);
    if (!MARKET_PRICE_CACHE.updatedAt) {
      MARKET_PRICE_CACHE.updatedAt = now;
      MARKET_PRICE_CACHE.prices = {};
    }
    MARKET_PRICE_CACHE.source = MARKET_PRICE_CACHE.source || "unavailable";
    MARKET_PRICE_CACHE.providers = Array.isArray(MARKET_PRICE_CACHE.providers) ? MARKET_PRICE_CACHE.providers : [];
  }
  return { ...MARKET_PRICE_CACHE.prices };
}

async function computeQuote(payload = {}) {
  const config = getConfig(payload.config);
  const amountIn = Math.max(0, asNum(payload.amount, 0));
  const slippagePct = Math.max(0, asNum(payload.slippage, 0.5));
  const prices = await getMarketPrices(Boolean(payload.forcePriceRefresh));

  const fromToken = getToken(payload.fromToken, prices);
  const toToken = getToken(payload.toToken, prices);
  const fromChain = getChain(payload.fromChain);
  const toChain = getChain(payload.toChain);

  const crossFamilyPenalty = fromChain.family === toChain.family ? 0 : 0.05;
  const sameChainDiscount = fromChain.id === toChain.id ? 0.04 : 0;
  const dynamicBridgePct = Math.max(0, config.bridgeFee + crossFamilyPenalty - sameChainDiscount);
  const taxAmount = (amountIn * config.taxPercent) / 100;
  const protocolAmount = (amountIn * config.protocolFee) / 100;
  const bridgeAmount = (amountIn * dynamicBridgePct) / 100;

  const amountAfterTaxOnly = Math.max(0, amountIn - taxAmount);
  const amountAfterFees = Math.max(0, amountIn - taxAmount - protocolAmount - bridgeAmount);
  if (!(fromToken.usd > 0)) {
    throw new Error(`Live price unavailable for source token ${fromToken.id}`);
  }
  if (!(toToken.usd > 0)) {
    throw new Error(`Live price unavailable for destination token ${toToken.id}`);
  }
  const usdValue = amountAfterFees * fromToken.usd;
  const grossOut = toToken.usd > 0 ? usdValue / toToken.usd : 0;
  const minOut = Math.max(0, grossOut - (grossOut * slippagePct) / 100);

  return {
    amountIn,
    slippagePct,
    fromChain,
    toChain,
    fromToken,
    toToken,
    taxPct: config.taxPercent,
    protocolPct: config.protocolFee,
    bridgePct: dynamicBridgePct,
    taxAmount,
    protocolAmount,
    bridgeAmount,
    amountAfterTaxOnly,
    amountAfterFees,
    grossOut,
    minOut,
    totalInternalPct: config.taxPercent + config.protocolFee + dynamicBridgePct,
    taxWallet: config.taxWallets[fromChain.id] || "Not configured",
    config,
    marketPrices: prices,
    pricesUpdatedAt: MARKET_PRICE_CACHE.updatedAt,
    priceSource: MARKET_PRICE_CACHE.source,
  };
}

async function buildRoute(payload = {}) {
  const quote = await computeQuote(payload);
  const supported = AUTO_PROVIDERS.filter((provider) => {
    try {
      return provider.supports(quote);
    } catch {
      return false;
    }
  });
  const candidates = supported.length ? supported : AUTO_PROVIDERS;
  const best = candidates.reduce((prev, curr) =>
    curr.estFeePct < prev.estFeePct ? curr : prev
  );

  const route = {
    provider: best.label,
    key: best.key,
    estProviderFeePct: best.estFeePct,
    url: best.url(quote),
    note: best.note,
    quote,
  };
  try {
    route.live = await buildLiveRoutePreview(route, payload);
  } catch (_) {
    route.live = null;
  }
  return route;
}

async function buildTaxIntent(payload = {}) {
  const route = await buildRoute(payload);
  const q = route.quote;
  const recipient = String(payload.recipient || "").trim();
  const executionSupport = q.fromChain.family === "EVM"
    ? { supported: true, reason: "" }
    : {
        supported: false,
        reason: `Real execution is currently available only for EVM source chains. ${q.fromChain.name} source routes are quote-only right now.`,
      };
  const taxStep = [
    "STEP 1 - TAX TRANSFER",
    `From Chain: ${q.fromChain.name}`,
    `Token: ${q.fromToken.id}`,
    `Tax Percent: ${q.taxPct.toFixed(2)}%`,
    `Tax Amount: ${Number(q.taxAmount.toFixed(8))} ${q.fromToken.id}`,
    `Tax Wallet: ${q.taxWallet}`,
    "",
    "STEP 2 - SWAP",
    `Net Amount to Swap: ${Number(q.amountAfterTaxOnly.toFixed(8))} ${q.fromToken.id}`,
    `Destination Chain: ${q.toChain.name}`,
    `Destination Token: ${q.toToken.id}`,
    `Recipient: ${recipient || "(to fill)"}`,
  ].join("\n");

  return {
    version: "1.1",
    mode: "cross-chain-swap",
    createdAt: new Date().toISOString(),
    from: {
      chain: q.fromChain.id,
      token: q.fromToken.id,
      amount: q.amountIn,
    },
    to: {
      chain: q.toChain.id,
      token: q.toToken.id,
      recipient,
      minAmountOut: Number(q.minOut.toFixed(8)),
    },
    fees: {
      taxPercent: q.taxPct,
      protocolPercent: q.protocolPct,
      bridgePercent: q.bridgePct,
      taxAmount: Number(q.taxAmount.toFixed(8)),
      protocolAmount: Number(q.protocolAmount.toFixed(8)),
      bridgeAmount: Number(q.bridgeAmount.toFixed(8)),
      taxWallet: q.taxWallet,
    },
    execution: {
      provider: route.provider,
      providerKey: route.key,
      providerEstimatedFeePct: route.estProviderFeePct,
      url: route.url,
      note: route.note,
      realExecutionSupported: executionSupport.supported,
      realExecutionReason: executionSupport.reason,
      swapAmountAfterTax: Number(q.amountAfterTaxOnly.toFixed(8)),
      taxStep,
    },
    routing: {
      familyFrom: q.fromChain.family,
      familyTo: q.toChain.family,
      crossFamily: q.fromChain.family !== q.toChain.family,
    },
  };
}

function parseUnitsHuman(value, decimals) {
  const [wholeRaw, fracRaw = ""] = String(value ?? "0").trim().split(".");
  const whole = (wholeRaw || "0").replace(/[^\d]/g, "") || "0";
  const frac = fracRaw.replace(/[^\d]/g, "").slice(0, decimals).padEnd(decimals, "0");
  return (BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(frac || "0")).toString();
}

function formatUnitsHuman(value, decimals) {
  try {
    const raw = BigInt(String(value ?? "0"));
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return Number(frac ? `${whole}.${frac}` : whole.toString());
  } catch {
    return 0;
  }
}

function tokenMeta(chainId, tokenId) {
  return TOKEN_META[chainId]?.[tokenId] || null;
}

function lifiChainId(chainId) {
  return LI_FI_CHAIN_IDS[chainId] || 0;
}

function evmChainId(chainId) {
  return EVM_CHAIN_IDS[chainId] || 0;
}

function bridgeAllowList(providerKey) {
  const mapped = BRIDGE_KEY_MAP[providerKey] || "";
  return mapped ? [mapped] : [];
}

function shouldRetryUnrestrictedLifi(intent) {
  const fromFamily = getChain(intent?.from?.chain).family;
  const toFamily = getChain(intent?.to?.chain).family;
  return fromFamily !== "EVM" || toFamily !== "EVM";
}

function realExecutionSupport(intent = {}) {
  const fromChain = getChain(intent?.from?.chain || "");
  if (fromChain.family === "EVM") return { supported: true, reason: "" };
  return {
    supported: false,
    reason: `Real execution is currently available only for EVM source chains. ${fromChain.name} source routes are quote-only right now.`,
  };
}

function requireSourceAddress(payload) {
  const fromAddress = String(payload?.fromAddress || payload?.sourceAddress || payload?.intent?.execution?.sourceAddress || "").trim();
  if (!fromAddress) throw new Error("Source wallet address is required for real cross-chain execution");
  return fromAddress;
}

function sourceAddressOrEmpty(payload) {
  return String(payload?.fromAddress || payload?.sourceAddress || payload?.intent?.execution?.sourceAddress || "").trim();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${url} failed: ${res.status}${text ? ` ${text.slice(0, 220)}` : ""}`);
  }
  return await res.json();
}

function getCachedJson(map, key, ttlMs) {
  const cached = map.get(key);
  if (!cached) return null;
  if ((Date.now() - cached.at) > ttlMs) return null;
  return structuredClone(cached.data);
}

function setCachedJson(map, key, data) {
  map.set(key, { at: Date.now(), data: structuredClone(data) });
}

async function fetchJsonCached(url, ttlMs, cacheMap) {
  const fresh = getCachedJson(cacheMap, url, ttlMs);
  if (fresh) return fresh;
  try {
    const data = await fetchJson(url);
    setCachedJson(cacheMap, url, data);
    return structuredClone(data);
  } catch (err) {
    const stale = cacheMap.get(url);
    if (stale && /429/.test(String(err?.message || ""))) {
      console.warn("[PepeShibDex] Using stale cached response after rate limit", { url });
      return structuredClone(stale.data);
    }
    throw err;
  }
}

async function prepareLifiSwap(intent, payload) {
  const fromChainId = lifiChainId(intent.from.chain);
  const toChainId = lifiChainId(intent.to.chain);
  if (!fromChainId || !toChainId) {
    throw new Error(`LI.FI does not support ${intent.from.chain} -> ${intent.to.chain}`);
  }
  const fromToken = tokenMeta(intent.from.chain, intent.from.token);
  const toToken = tokenMeta(intent.to.chain, intent.to.token);
  if (!fromToken || !toToken) {
    throw new Error(`LI.FI token mapping missing for ${intent.from.chain}:${intent.from.token} or ${intent.to.chain}:${intent.to.token}`);
  }
  const fromAddress = requireSourceAddress(payload);
  const amountRaw = parseUnitsHuman(intent.execution?.swapAmountAfterTax ?? intent.from.amount, fromToken.decimals);
  const params = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken: fromToken.address,
    toToken: toToken.address,
    fromAmount: amountRaw,
    fromAddress,
    toAddress: String(intent.to.recipient || "").trim() || fromAddress,
    slippage: String(Math.max(0.1, Number(payload?.slippage || 0.5))),
  });
  const allowed = bridgeAllowList(intent.execution?.providerKey);
  if (allowed.length) params.set("allowBridges", allowed.join(","));
  let quote;
  try {
    quote = await fetchJsonCached(`${LI_FI_BASE_URL}/quote?${params.toString()}`, LI_FI_QUOTE_CACHE_TTL_MS, LI_FI_QUOTE_CACHE);
  } catch (err) {
    console.error("[PepeShibDex] LI.FI quote failed", {
      fromChain: intent?.from?.chain,
      toChain: intent?.to?.chain,
      fromToken: intent?.from?.token,
      toToken: intent?.to?.token,
      providerKey: intent?.execution?.providerKey || "",
      allowedBridges: allowed,
      error: err?.message || String(err),
    });
    if (!allowed.length || !shouldRetryUnrestrictedLifi(intent)) throw err;
    params.delete("allowBridges");
    console.warn("[PepeShibDex] Retrying LI.FI quote without allowBridges", {
      fromChain: intent?.from?.chain,
      toChain: intent?.to?.chain,
      fromToken: intent?.from?.token,
      toToken: intent?.to?.token,
      providerKey: intent?.execution?.providerKey || "",
    });
    quote = await fetchJsonCached(`${LI_FI_BASE_URL}/quote?${params.toString()}`, LI_FI_QUOTE_CACHE_TTL_MS, LI_FI_QUOTE_CACHE);
    quote._pshibdexBridgeFallback = "unrestricted";
  }
  const tx = quote?.transactionRequest;
  if (!tx?.to) throw new Error("LI.FI quote did not return transactionRequest");
  return {
    provider: "LI.FI",
    providerKey: intent.execution?.providerKey || "jumper",
    kind: "evm",
    routeId: quote?.id || quote?.transactionId || "",
    tx,
    raw: quote,
  };
}

async function prepareAcrossSwap(intent, payload) {
  const fromChainId = evmChainId(intent.from.chain);
  const toChainId = evmChainId(intent.to.chain);
  if (!fromChainId || !toChainId) throw new Error("Across supports only EVM routes");
  const fromToken = tokenMeta(intent.from.chain, intent.from.token);
  const toToken = tokenMeta(intent.to.chain, intent.to.token);
  if (!fromToken || !toToken) throw new Error("Across token mapping missing for selected route");
  const fromAddress = requireSourceAddress(payload);
  const amount = parseUnitsHuman(intent.execution?.swapAmountAfterTax ?? intent.from.amount, fromToken.decimals);
  const params = new URLSearchParams({
    tradeType: "exactInput",
    originChainId: String(fromChainId),
    destinationChainId: String(toChainId),
    inputToken: fromToken.address,
    outputToken: toToken.address,
    amount,
    depositor: fromAddress,
    recipient: String(intent.to.recipient || "").trim() || fromAddress,
  });
  const quote = await fetchJson(`${ACROSS_BASE_URL}/swap/approval?${params.toString()}`);
  const swapTx = quote?.swapTx || quote?.swapTxn || null;
  if (!swapTx?.to) throw new Error("Across did not return executable swap transaction");
  return {
    provider: "Across",
    providerKey: "across",
    kind: "evm",
    approvalTxs: Array.isArray(quote?.approvalTxns) ? quote.approvalTxns : [],
    tx: swapTx,
    raw: quote,
  };
}

function summarizeLifiQuote(intent, quote) {
  const feeCosts = Array.isArray(quote?.estimate?.feeCosts) ? quote.estimate.feeCosts : [];
  const gasCosts = Array.isArray(quote?.estimate?.gasCosts) ? quote.estimate.gasCosts : [];
  const providerFeeUsd = [...feeCosts, ...gasCosts].reduce((sum, item) => sum + asNum(item?.amountUSD, 0), 0);
  const toMeta = tokenMeta(intent.to.chain, intent.to.token);
  const expectedOutput = toMeta ? formatUnitsHuman(quote?.estimate?.toAmount || 0, toMeta.decimals) : 0;
  const minOutput = toMeta ? formatUnitsHuman(quote?.estimate?.toAmountMin || 0, toMeta.decimals) : 0;
  const fromAmountUsd = asNum(quote?.estimate?.fromAmountUSD, 0);
  return {
    provider: "LI.FI",
    providerKey: intent.execution?.providerKey || "jumper",
    bridgeFallback: quote?._pshibdexBridgeFallback || "",
    providerFeeUsd,
    providerFeePct: fromAmountUsd > 0 ? (providerFeeUsd / fromAmountUsd) * 100 : 0,
    expectedOutput,
    minOutput,
    estimatedDurationSec: asNum(quote?.estimate?.executionDuration, 0),
  };
}

function summarizeAcrossQuote(intent, quote) {
  const toMeta = tokenMeta(intent.to.chain, intent.to.token);
  const expectedOutput = toMeta
    ? formatUnitsHuman(
        quote?.expectedOutputAmount || quote?.expectedOutputTokenAmount || quote?.outputAmount || 0,
        toMeta.decimals
      )
    : 0;
  const minOutput = toMeta
    ? formatUnitsHuman(
        quote?.minOutputAmount || quote?.minDepositOutputAmount || quote?.expectedOutputAmount || 0,
        toMeta.decimals
      )
    : 0;
  const feeUsd = asNum(quote?.totalRelayFee?.totalUsd, 0)
    || asNum(quote?.fees?.total?.usd, 0)
    || asNum(quote?.fees?.relayerCapital?.usd, 0)
    || asNum(quote?.fees?.lp?.usd, 0);
  const inputUsd = asNum(quote?.inputAmountUsd, 0) || asNum(quote?.expectedInputAmountUsd, 0);
  return {
    provider: "Across",
    providerKey: "across",
    providerFeeUsd: feeUsd,
    providerFeePct: inputUsd > 0 ? (feeUsd / inputUsd) * 100 : 0,
    expectedOutput,
    minOutput,
    estimatedDurationSec: asNum(quote?.expectedFillTimeSec, 0) || asNum(quote?.estimatedFillTimeSec, 0),
  };
}

async function buildLiveRoutePreview(route, payload) {
  const fromAddress = sourceAddressOrEmpty(payload);
  if (!fromAddress) return null;
  const q = route.quote;
  const recipient = String(payload.recipient || "").trim() || fromAddress;
  const intent = {
    from: {
      chain: q.fromChain.id,
      token: q.fromToken.id,
      amount: q.amountIn,
    },
    to: {
      chain: q.toChain.id,
      token: q.toToken.id,
      recipient,
      minAmountOut: Number(q.minOut.toFixed(8)),
    },
    execution: {
      providerKey: route.key,
      swapAmountAfterTax: Number(q.amountAfterTaxOnly.toFixed(8)),
    },
  };
  if (route.key === "across") {
    const prepared = await prepareAcrossSwap(intent, { ...payload, fromAddress });
    return summarizeAcrossQuote(intent, prepared.raw);
  }
  if (["relay", "jumper", "mayan", "debridge"].includes(route.key)) {
    const prepared = await prepareLifiSwap(intent, { ...payload, fromAddress });
    return summarizeLifiQuote(intent, prepared.raw);
  }
  return null;
}

async function prepareRealExecution(payload = {}) {
  const incomingIntent = payload?.intent && typeof payload.intent === "object" ? payload.intent : null;
  const intent = incomingIntent || await buildTaxIntent(payload);
  const executionSupport = realExecutionSupport(intent);
  if (!executionSupport.supported) throw new Error(executionSupport.reason);
  const providerKey = String(intent.execution?.providerKey || "").toLowerCase();
  if (!providerKey) throw new Error("Missing execution provider");
  if (providerKey === "across") return { intent, execution: await prepareAcrossSwap(intent, payload) };
  if (providerKey === "relay" || providerKey === "jumper" || providerKey === "mayan" || providerKey === "debridge") {
    return { intent, execution: await prepareLifiSwap(intent, payload) };
  }
  throw new Error(`Provider ${providerKey} is not wired for real execution yet`);
}

function createSwapOrder(intent, execution) {
  const orderId = `psx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const order = {
    id: orderId,
    status: "awaiting_source_execution",
    createdAt: now,
    updatedAt: now,
    intent,
    preparedExecution: execution,
    steps: [
      { key: "tax", status: "pending", note: "Tax transfer pending wallet signature" },
      { key: "crosschain", status: "awaiting_wallet", note: `${execution.provider} source transaction ready for wallet confirmation` },
    ],
  };
  SWAP_ORDERS.set(orderId, order);
  return order;
}

async function refreshOrderStatus(order) {
  order.updatedAt = new Date().toISOString();
  if (!order?.sourceTxHash) return order;

  const providerKey = String(order?.preparedExecution?.providerKey || "").toLowerCase();
  if (providerKey === "across" || providerKey === "relay" || providerKey === "jumper" || providerKey === "mayan" || providerKey === "debridge") {
    try {
      const fromChain = lifiChainId(order.intent?.from?.chain);
      const toChain = lifiChainId(order.intent?.to?.chain);
      if (fromChain && toChain) {
        const statusUrl = `${LI_FI_BASE_URL}/status?txHash=${encodeURIComponent(order.sourceTxHash)}&fromChain=${fromChain}&toChain=${toChain}`;
        const status = await fetchJson(statusUrl);
        const bridgeStatus = String(status?.status || "").toLowerCase();
        if (bridgeStatus === "done") {
          order.status = "completed";
          order.steps = [
            { key: "tax", status: "completed", note: "Tax transfer submitted", txHash: order.taxTxHash || "" },
            { key: "crosschain", status: "completed", note: "Bridge completed on-chain", txHash: order.sourceTxHash },
          ];
          return order;
        }
        if (bridgeStatus === "failed") {
          order.status = "failed";
          order.steps = [
            { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
            { key: "crosschain", status: "failed", note: status?.substatus || "Provider reported failure", txHash: order.sourceTxHash },
          ];
          return order;
        }
        order.status = "processing";
        order.steps = [
          { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
          { key: "crosschain", status: "processing", note: status?.substatus || "Waiting provider settlement", txHash: order.sourceTxHash },
        ];
        return order;
      }
    } catch (err) {
      order.status = "processing";
      order.steps = [
        { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
        { key: "crosschain", status: "processing", note: `Status check pending: ${err.message}`, txHash: order.sourceTxHash },
      ];
      return order;
    }
  }

  order.status = "processing";
  order.steps = [
    { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
    { key: "crosschain", status: "processing", note: "Source transaction submitted", txHash: order.sourceTxHash },
  ];
  return order;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sanitizePath(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  return safePath;
}

async function serveFile(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = reqUrl.pathname;
  if (pathname.endsWith("/")) pathname += "index.html";
  if (pathname === "") pathname = "/index.html";

  const relative = sanitizePath(pathname).replace(/^[\\/]+/, "");
  const fullPath = normalize(join(ROOT, relative));
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const st = await stat(fullPath);
    if (!st.isFile()) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": st.size,
      "Cache-Control": "no-cache",
    });
    createReadStream(fullPath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = reqUrl;
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    if (pathname.startsWith("/api/")) {
      applyCors(req, res);
      console.log("[PepeShibDex] API request", { requestId, method: req.method, pathname });
    }

    if (req.method === "GET" && pathname === "/api/health") {
      json(res, 200, {
        ok: true,
        service: "pshibdex-local-api",
        marketPricesUpdatedAt: MARKET_PRICE_CACHE.updatedAt || null,
        marketPriceSource: MARKET_PRICE_CACHE.source,
        marketPriceProviders: MARKET_PRICE_CACHE.providers,
        providerKeys: {
          changenow: Boolean(CHANGENOW_API_KEY),
          simpleswap: Boolean(SIMPLESWAP_API_KEY),
        },
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/market-prices") {
      const prices = await getMarketPrices(reqUrl.searchParams.get("refresh") === "1");
      json(res, 200, {
        ok: true,
        source: MARKET_PRICE_CACHE.source,
        updatedAt: MARKET_PRICE_CACHE.updatedAt,
        providers: MARKET_PRICE_CACHE.providers,
        prices,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/quote") {
      const body = await readJsonBody(req);
      json(res, 200, { ok: true, quote: await computeQuote(body) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/route") {
      const body = await readJsonBody(req);
      const route = await buildRoute(body);
      json(res, 200, {
        ok: true,
        route: {
          provider: route.provider,
          key: route.key,
          estProviderFeePct: route.estProviderFeePct,
          url: route.url,
          note: route.note,
          live: route.live || null,
        },
        quote: route.quote,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/tax-intent") {
      const body = await readJsonBody(req);
      const intent = await buildTaxIntent(body);
      json(res, 200, { ok: true, intent });
      return;
    }

    if (req.method === "POST" && pathname === "/api/execute-swap") {
      const body = await readJsonBody(req);
      console.log("[PepeShibDex] execute-swap:start", {
        requestId,
        fromChain: body?.intent?.from?.chain || body?.fromChain || "",
        toChain: body?.intent?.to?.chain || body?.toChain || "",
        fromToken: body?.intent?.from?.token || body?.fromToken || "",
        toToken: body?.intent?.to?.token || body?.toToken || "",
        fromAddress: String(body?.fromAddress || "").trim(),
      });
      try {
        const { intent, execution } = await prepareRealExecution(body);
        const order = createSwapOrder(intent, execution);
        console.log("[PepeShibDex] execute-swap:success", {
          requestId,
          orderId: order.id,
          providerKey: execution?.providerKey || "",
          kind: execution?.kind || "",
        });
        json(res, 200, { ok: true, swap: order });
      } catch (err) {
        console.error("[PepeShibDex] execute-swap:failed", {
          requestId,
          error: err?.message || String(err),
          stack: err?.stack || "",
        });
        throw err;
      }
      return;
    }

    if (req.method === "POST" && pathname.startsWith("/api/swap/") && pathname.endsWith("/source-tx")) {
      const id = pathname.split("/")[3] || "";
      const order = id ? SWAP_ORDERS.get(id) : null;
      if (!order) {
        json(res, 404, { ok: false, error: "NOT_FOUND", message: "Swap order not found" });
        return;
      }
      const body = await readJsonBody(req);
      order.sourceTxHash = String(body?.sourceTxHash || "").trim();
      order.taxTxHash = String(body?.taxTxHash || "").trim();
      order.status = order.sourceTxHash ? "processing" : order.status;
      order.updatedAt = new Date().toISOString();
      await refreshOrderStatus(order);
      json(res, 200, { ok: true, swap: order });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/swap/")) {
      const id = pathname.split("/").pop();
      const order = id ? SWAP_ORDERS.get(id) : null;
      if (!order) {
        json(res, 404, { ok: false, error: "NOT_FOUND", message: "Swap order not found" });
        return;
      }
      await refreshOrderStatus(order);
      json(res, 200, { ok: true, swap: order });
      return;
    }

    await serveFile(req, res);
  } catch (err) {
    console.error("[PepeShibDex] request failed", {
      requestId,
      method: req.method,
      pathname,
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : "",
    });
    json(res, 500, {
      ok: false,
      error: "SERVER_ERROR",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PepeShib local server running on http://127.0.0.1:${PORT}`);
});
