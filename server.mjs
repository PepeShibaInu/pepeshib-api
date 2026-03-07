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
const RELAY_API_KEY = String(process.env.RELAY_API_KEY || "").trim();

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
  { id: "neon", name: "Neon", family: "EVM" },
  { id: "gnosis", name: "Gnosis", family: "EVM" },
  { id: "zilliqa", name: "Zilliqa EVM", family: "EVM" },
  { id: "flow", name: "Flow EVM", family: "EVM" },
  { id: "story", name: "Story", family: "EVM" },
  { id: "abstract", name: "Abstract", family: "EVM" },
  { id: "cronos", name: "Cronos", family: "EVM" },
  { id: "berachain", name: "Berachain", family: "EVM" },
  { id: "bob", name: "BOB", family: "EVM" },
  { id: "hyperevm", name: "HyperEVM", family: "EVM" },
  { id: "mantle", name: "Mantle", family: "EVM" },
  { id: "sophon", name: "Sophon", family: "EVM" },
  { id: "sei", name: "Sei", family: "EVM" },
  { id: "plasma", name: "Plasma", family: "EVM" },
  { id: "injective", name: "Injective EVM", family: "EVM" },
  { id: "monad", name: "Monad", family: "EVM" },
  { id: "solana", name: "Solana", family: "SVM" },
  { id: "tron", name: "Tron", family: "TVM" },
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
  { id: "NEON", usd: 0.4 },
  { id: "XDAI", usd: 1 },
  { id: "ZIL", usd: 0.03 },
  { id: "FLOW", usd: 0.8 },
  { id: "IP", usd: 3 },
  { id: "CRO", usd: 0.15 },
  { id: "BERA", usd: 8 },
  { id: "HYPE", usd: 20 },
  { id: "MNT", usd: 1 },
  { id: "SOPH", usd: 0.1 },
  { id: "SEI", usd: 0.5 },
  { id: "XPL", usd: 0.1 },
  { id: "INJ", usd: 25 },
  { id: "MON", usd: 1 },
  { id: "SOL", usd: 140 },
  { id: "TRX", usd: 0.13 },
];
const MARKET_PRICE_IDS = {
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  ETH: "ethereum",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  S: "sonic-3",
  NEON: "neon-evm",
  ZIL: "zilliqa",
  FLOW: "flow",
  IP: "story-2",
  CRO: "crypto-com-chain",
  BERA: "berachain-bera",
  HYPE: "hyperliquid",
  MNT: "mantle",
  SOPH: "sophon",
  SEI: "sei-network",
  XPL: "plasma",
  INJ: "injective-protocol",
  MON: "monad",
  SOL: "solana",
  TRX: "tron",
};
const MARKET_PRICE_TTL_MS = 300_000;
const LI_FI_QUOTE_CACHE_TTL_MS = 45_000;
const MIN_SLIPPAGE = 0.01;
const COINBASE_SPOT_PAIRS = {
  ETH: "ETH-USD",
  POL: "POL-USD",
  SOL: "SOL-USD",
  AVAX: "AVAX-USD",
};
const BINANCE_SPOT_SYMBOLS = {
  BNB: "BNBUSDT",
  ETH: "ETHUSDT",
  POL: "POLUSDT",
  AVAX: "AVAXUSDT",
  SOL: "SOLUSDT",
  TRX: "TRXUSDT",
};
const OKX_SPOT_PAIRS = {
  BNB: "BNB-USDT",
  ETH: "ETH-USDT",
  POL: "POL-USDT",
  AVAX: "AVAX-USDT",
  SOL: "SOL-USDT",
  TRX: "TRX-USDT",
};
const KUCOIN_SPOT_PAIRS = {
  BNB: "BNB-USDT",
  ETH: "ETH-USDT",
  POL: "POL-USDT",
  AVAX: "AVAX-USDT",
  SOL: "SOL-USDT",
  TRX: "TRX-USDT",
};
const KRAKEN_SPOT_PAIRS = {
  BNB: "BNBUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  AVAX: "AVAXUSD",
  TRX: "TRXUSD",
};
const COINCAP_ASSET_IDS = {
  BNB: "binance-coin",
  ETH: "ethereum",
  SOL: "solana",
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
    ethereum: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    bsc: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    polygon: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    arbitrum: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    optimism: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    base: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    avalanche: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    sonic: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    zksync: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    linea: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    neon: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    gnosis: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    zilliqa: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    flow: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    story: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    abstract: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    cronos: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    berachain: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    bob: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    hyperevm: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    mantle: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    sophon: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    sei: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    plasma: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    injective: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    monad: "0x2F455Df5188595CFaC96DA82dd31F3E73b6F2e09",
    solana: "DaQ6hn3FUunch65aCy747fQviJynoPEz7Dsdu79sgxRe",
    tron: "TXrA6LPuPwU5Ntid6Tpzdvtv5C35v3UQgo",
  },
};

function isAcrossChain(chainId) {
  return Boolean(ACROSS_EVM_CHAIN_IDS[chainId]);
}

function isLifiChain(chainId) {
  return Boolean(LI_FI_CHAIN_IDS[chainId]);
}

function isRelayChain(chainId) {
  return Boolean(RELAY_CHAIN_IDS[chainId]);
}

function debridgeChainId(chainId) {
  return DEBRIDGE_CHAIN_IDS[chainId] || 0;
}

function isDebridgeDirectChain(chainId) {
  return DEBRIDGE_DIRECT_CHAIN_KEYS.has(chainId);
}

function shouldUseDirectDebridge(intent = {}) {
  const fromChain = String(intent?.from?.chain || "");
  const toChain = String(intent?.to?.chain || "");
  return (
    getChain(fromChain).family === "EVM" &&
    getChain(toChain).family === "EVM" &&
    Boolean(debridgeChainId(fromChain) && debridgeChainId(toChain)) &&
    (isDebridgeDirectChain(fromChain) || isDebridgeDirectChain(toChain))
  );
}

function shouldPreferDirectDebridgeRoute(quote) {
  return quote?.fromChain?.family === "EVM" &&
    quote?.toChain?.family === "EVM" &&
    (isDebridgeDirectChain(quote?.fromChain?.id) || isDebridgeDirectChain(quote?.toChain?.id));
}

const AUTO_PROVIDERS = [
  {
    key: "across",
    label: "Across",
    estFeePct: 0.03,
    supports: (q) =>
      q.fromChain.family === "EVM" &&
      q.toChain.family === "EVM" &&
      q.fromChain.id !== q.toChain.id &&
      isAcrossChain(q.fromChain.id) &&
      isAcrossChain(q.toChain.id),
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
      q.fromChain.id !== q.toChain.id &&
      isLifiChain(q.fromChain.id) &&
      isLifiChain(q.toChain.id),
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
      q.fromChain.id !== q.toChain.id &&
      isLifiChain(q.fromChain.id) &&
      isLifiChain(q.toChain.id),
    url: () => "https://swap.mayan.finance/",
    note: "Auto-selected route for EVM/Solana flow. Verify route details in checkout.",
  },
  {
    key: "relay",
    label: "Relay",
    estFeePct: 0.1,
    supports: (q) =>
      ["EVM", "TVM"].includes(q.fromChain.family) &&
      ["EVM", "TVM"].includes(q.toChain.family) &&
      q.fromChain.id !== q.toChain.id &&
      isRelayChain(q.fromChain.id) &&
      isRelayChain(q.toChain.id),
    url: () => "https://relay.link/bridge",
    note: "Auto-selected Relay route for EVM/Tron bridge flow. Verify route details in checkout.",
  },
  {
    key: "jumper",
    label: "Jumper (LI.FI)",
    estFeePct: 0.2,
    supports: (q) =>
      ["EVM", "SVM"].includes(q.fromChain.family) &&
      ["EVM", "SVM"].includes(q.toChain.family) &&
      q.fromChain.id !== q.toChain.id &&
      isLifiChain(q.fromChain.id) &&
      isLifiChain(q.toChain.id),
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
const RELAY_QUOTE_CACHE = new Map();
const DEBRIDGE_QUOTE_CACHE = new Map();
const LI_FI_BASE_URL = "https://li.quest/v1";
const RELAY_BASE_URL = "https://api.relay.link";
const DEBRIDGE_BASE_URL = "https://dln.debridge.finance";
const DEBRIDGE_STATUS_BASE_URL = "https://dln.debridge.finance/v1.0/dln/order";
const ACROSS_BASE_URL = "https://app.across.to/api";
const ACROSS_EVM_CHAIN_IDS = {
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
const EVM_CHAIN_IDS = {
  ...ACROSS_EVM_CHAIN_IDS,
  neon: 245022934,
  gnosis: 100,
  zilliqa: 32769,
  flow: 747,
  story: 1514,
  abstract: 2741,
  cronos: 25,
  berachain: 80094,
  bob: 60808,
  hyperevm: 999,
  mantle: 5000,
  sophon: 50104,
  sei: 1329,
  plasma: 9745,
  injective: 1776,
  monad: 143,
};
const LI_FI_CHAIN_IDS = {
  ...ACROSS_EVM_CHAIN_IDS,
  solana: 1151111081099710,
};
const RELAY_CHAIN_IDS = {
  ...ACROSS_EVM_CHAIN_IDS,
  gnosis: 100,
  flow: 747,
  story: 1514,
  abstract: 2741,
  cronos: 25,
  berachain: 80094,
  bob: 60808,
  hyperevm: 999,
  mantle: 5000,
  sei: 1329,
  plasma: 9745,
  monad: 143,
  solana: 792703809,
  tron: 728126428,
};
const DEBRIDGE_CHAIN_IDS = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  linea: 59144,
  sonic: 100000014,
  neon: 100000001,
  gnosis: 100000002,
  zilliqa: 100000008,
  flow: 100000009,
  story: 100000013,
  abstract: 100000017,
  cronos: 100000019,
  berachain: 100000020,
  bob: 100000021,
  hyperevm: 100000022,
  mantle: 100000023,
  sophon: 100000025,
  sei: 100000027,
  plasma: 100000028,
  injective: 100000029,
  monad: 100000030,
  tron: 100000026,
};
const DEBRIDGE_DIRECT_CHAIN_KEYS = new Set(["neon", "zilliqa", "sophon", "injective"]);
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
  neon: {
    NEON: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xEA6B04272f9f62F997F666F07D3a974134f7FFb9", decimals: 6 },
    USDT: { address: "0x5f0155d08eF4aaE2B500AefB64A3419dA8bB611a", decimals: 6 },
  },
  gnosis: {
    XDAI: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x2a22f9c3b484c3629090feed35f17ff8f88f76f0", decimals: 6 },
  },
  zilliqa: {
    ZIL: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xd8b73ced1b16c047048f2c5ea42233da33168198", decimals: 6 },
  },
  flow: {
    FLOW: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xf1815bd50389c46847f0bda824ec8da914045d14", decimals: 6 },
  },
  story: {
    IP: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xf1815bd50389c46847f0bda824ec8da914045d14", decimals: 6 },
  },
  abstract: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1", decimals: 6 },
  },
  cronos: {
    CRO: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xc21223249ca28397b4b6541dffaecc539bff0c59", decimals: 6 },
  },
  berachain: {
    BERA: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x549943e04f40284185054145c6e4e9568c1d3241", decimals: 6 },
  },
  bob: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  },
  hyperevm: {
    HYPE: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0xb88339cb7199b77e23db6e890353e22632ba630f", decimals: 6 },
  },
  mantle: {
    MNT: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9", decimals: 6 },
  },
  sophon: {
    SOPH: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F", decimals: 6 },
  },
  sei: {
    SEI: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  },
  plasma: {
    XPL: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  },
  injective: {
    INJ: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDT: { address: "0x88f7f2b685f9692caf8c478f5badf09ee9b1cc13", decimals: 6 },
    USDC: { address: "0x2a25fbd67b3ae485e461fe55d9dbef302b7d3989", decimals: 6 },
  },
  monad: {
    MON: { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    USDC: { address: "0x754704bc059f8c67012fed69bc8a327a5aafb603", decimals: 6 },
  },
  solana: {
    SOL: { address: "11111111111111111111111111111111", decimals: 9 },
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  },
  tron: {
    TRX: { address: "0x0000000000000000000000000000000000000000", decimals: 6 },
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
    XDAI: 1,
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
  const slippagePct = Math.max(MIN_SLIPPAGE, asNum(payload.slippage, 0.5));
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
  const forcedDirectDebridge = shouldPreferDirectDebridgeRoute(quote)
    ? candidates.find((provider) => provider.key === "debridge")
    : null;
  const best = candidates.reduce((prev, curr) =>
    curr.estFeePct < prev.estFeePct ? curr : prev
  );

  const route = {
    provider: (forcedDirectDebridge || best).label,
    key: (forcedDirectDebridge || best).key,
    estProviderFeePct: (forcedDirectDebridge || best).estFeePct,
    url: (forcedDirectDebridge || best).url(quote),
    note: (forcedDirectDebridge || best).note,
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
  const executionSupport = realExecutionSupport({
    from: { chain: q.fromChain.id, token: q.fromToken.id },
    to: { chain: q.toChain.id, token: q.toToken.id },
    execution: { providerKey: route.key },
  });
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

function relayChainId(chainId) {
  return RELAY_CHAIN_IDS[chainId] || 0;
}

function evmChainId(chainId) {
  return EVM_CHAIN_IDS[chainId] || 0;
}

function acrossChainId(chainId) {
  return ACROSS_EVM_CHAIN_IDS[chainId] || 0;
}

function isRelayRoute(intent = {}) {
  return String(intent?.execution?.providerKey || "").toLowerCase() === "relay";
}

function relayHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (RELAY_API_KEY) headers["x-relay-api-key"] = RELAY_API_KEY;
  return headers;
}

function pickRelayExecutionStep(steps = []) {
  for (const step of Array.isArray(steps) ? steps : []) {
    const items = Array.isArray(step?.items) ? step.items : [];
    for (const item of items) {
      if (item?.data && typeof item.data === "object") {
        return { step, item };
      }
    }
    if (step?.request && typeof step.request === "object") return { step, item: { data: step.request } };
    if (step?.data && typeof step.data === "object") return { step, item: { data: step.data } };
  }
  return null;
}

function normalizeRelayCheckUrl(url, requestId = "") {
  if (typeof url === "string" && url) {
    try {
      return new URL(url, RELAY_BASE_URL).toString();
    } catch {
      return url;
    }
  }
  if (requestId) return `${RELAY_BASE_URL}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`;
  return "";
}

function relayAmountToNumber(value, decimals = 0) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value);
  if (/^\d+$/.test(raw) && Number.isFinite(decimals) && decimals > 0) {
    return formatUnitsHuman(raw, decimals);
  }
  return asNum(raw, 0);
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

function hasIntentTokenMeta(intent = {}) {
  return Boolean(
    tokenMeta(intent?.from?.chain || "", intent?.from?.token || "") &&
    tokenMeta(intent?.to?.chain || "", intent?.to?.token || "")
  );
}

function realExecutionSupport(intent = {}) {
  const fromChain = getChain(intent?.from?.chain || "");
  const toChain = getChain(intent?.to?.chain || "");
  const providerKey = String(intent?.execution?.providerKey || "").toLowerCase();
  if (!providerKey) {
    return {
      supported: false,
      reason: "No execution provider is selected for this route.",
    };
  }
  if (providerKey === "across") {
    if (
      fromChain.family === "EVM" &&
      toChain.family === "EVM" &&
      isAcrossChain(intent?.from?.chain) &&
      isAcrossChain(intent?.to?.chain) &&
      hasIntentTokenMeta(intent)
    ) {
      return { supported: true, reason: "" };
    }
    return {
      supported: false,
      reason: "Across execution is available only on the current core EVM set with mapped tokens.",
    };
  }
  if (providerKey === "relay") {
    if (isRelayChain(intent?.from?.chain) && isRelayChain(intent?.to?.chain) && hasIntentTokenMeta(intent)) {
      if (fromChain.family === "TVM") {
        return {
          supported: true,
          reason: "Experimental Tron source execution path enabled via Relay quote transaction payloads.",
        };
      }
      return { supported: true, reason: "" };
    }
    return {
      supported: false,
      reason: "Relay execution is only enabled for chains and tokens currently exposed by Relay's executable quote API.",
    };
  }
  if (providerKey === "debridge") {
    if (fromChain.family === "EVM" && toChain.family === "EVM" && hasIntentTokenMeta(intent)) {
      if (shouldUseDirectDebridge(intent)) {
        return {
          supported: true,
          reason: "Direct deBridge execution is enabled for this EVM route.",
        };
      }
      if (isLifiChain(intent?.from?.chain) && isLifiChain(intent?.to?.chain)) {
        return { supported: true, reason: "" };
      }
    }
    return {
      supported: false,
      reason: "deBridge execution is only enabled for mapped EVM routes and the direct adapters currently wired in the backend.",
    };
  }
  if (fromChain.family === "SVM" && ["jumper", "mayan"].includes(providerKey) && isLifiChain(intent?.from?.chain) && isLifiChain(intent?.to?.chain) && hasIntentTokenMeta(intent)) {
    return {
      supported: true,
      reason: "Experimental Solana source execution path enabled via LI.FI-compatible Solana transaction payloads.",
    };
  }
  if (fromChain.family === "EVM" && ["jumper", "mayan"].includes(providerKey) && isLifiChain(intent?.from?.chain) && isLifiChain(intent?.to?.chain) && hasIntentTokenMeta(intent)) {
    return { supported: true, reason: "" };
  }
  return {
    supported: false,
    reason: `${fromChain.name} -> ${toChain.name} is quote-only with the current provider adapter set.`,
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
    slippage: String(Math.max(MIN_SLIPPAGE, Number(payload?.slippage || 0.5))),
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
  if (!tx) throw new Error("LI.FI quote did not return transactionRequest");
  if (tx?.to) {
    return {
      provider: "LI.FI",
      providerKey: intent.execution?.providerKey || "jumper",
      kind: "evm",
      routeId: quote?.id || quote?.transactionId || "",
      tx,
      raw: quote,
    };
  }
  if (getChain(intent.from.chain).family === "SVM" && typeof tx?.data === "string" && tx.data) {
    return {
      provider: "LI.FI",
      providerKey: intent.execution?.providerKey || "jumper",
      kind: "solana",
      routeId: quote?.id || quote?.transactionId || "",
      serializedTransaction: tx.data,
      tx,
      raw: quote,
    };
  }
  return {
    provider: "LI.FI",
    providerKey: intent.execution?.providerKey || "jumper",
    kind: "unknown",
    routeId: quote?.id || quote?.transactionId || "",
    tx,
    raw: quote,
  };
}

async function prepareAcrossSwap(intent, payload) {
  const fromChainId = acrossChainId(intent.from.chain);
  const toChainId = acrossChainId(intent.to.chain);
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

async function prepareRelaySwap(intent, payload) {
  const fromChainId = relayChainId(intent.from.chain);
  const toChainId = relayChainId(intent.to.chain);
  if (!fromChainId || !toChainId) {
    throw new Error(`Relay does not support ${intent.from.chain} -> ${intent.to.chain}`);
  }
  const fromToken = tokenMeta(intent.from.chain, intent.from.token);
  const toToken = tokenMeta(intent.to.chain, intent.to.token);
  if (!fromToken || !toToken) {
    throw new Error(`Relay token mapping missing for ${intent.from.chain}:${intent.from.token} or ${intent.to.chain}:${intent.to.token}`);
  }
  const fromAddress = requireSourceAddress(payload);
  const amount = parseUnitsHuman(intent.execution?.swapAmountAfterTax ?? intent.from.amount, fromToken.decimals);
  const requestBody = {
    user: fromAddress,
    recipient: String(intent.to.recipient || "").trim() || fromAddress,
    originChainId: fromChainId,
    destinationChainId: toChainId,
    originCurrency: fromToken.address,
    destinationCurrency: toToken.address,
    amount,
    tradeType: "EXACT_INPUT",
    referrer: "pepeshibdex",
  };
  const quote = await fetchJson(`${RELAY_BASE_URL}/quote`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify(requestBody),
  });
  const selected = pickRelayExecutionStep(quote?.steps);
  const tx = selected?.item?.data || null;
  if (!tx || typeof tx !== "object") {
    throw new Error("Relay quote did not return executable transaction data");
  }
  const sourceFamily = getChain(intent.from.chain).family;
  const requestId = String(
    selected?.item?.requestId ||
    selected?.step?.requestId ||
    quote?.requestId ||
    quote?.details?.requestId ||
    ""
  ).trim();
  const statusUrl = normalizeRelayCheckUrl(
    selected?.item?.check?.endpoint ||
    selected?.step?.check?.endpoint ||
    quote?.check?.endpoint ||
    "",
    requestId
  );
  return {
    provider: "Relay",
    providerKey: "relay",
    kind: sourceFamily === "TVM" ? "tron" : "evm",
    tx,
    routeId: String(quote?.details?.requestId || quote?.requestId || requestId || ""),
    requestId,
    statusUrl,
    raw: quote,
  };
}

function debridgeHeaders() {
  return {
    Accept: "application/json",
  };
}

function summarizeDebridgeQuote(intent, quote) {
  const outputMeta = tokenMeta(intent.to.chain, intent.to.token);
  const inputUsd = asNum(
    quote?.estimation?.srcChainTokenIn?.approximateUsdValue ??
    quote?.estimation?.srcChainTokenInAmountUsd ??
    0,
    0
  );
  const outputUsd = asNum(
    quote?.estimation?.dstChainTokenOut?.recommendedApproximateUsdValue ??
    quote?.estimation?.dstChainTokenOut?.approximateUsdValue ??
    quote?.estimation?.dstChainTokenOutAmountUsd ??
    0,
    0
  );
  const expectedOutput = outputMeta
    ? formatUnitsHuman(
        quote?.estimation?.dstChainTokenOut?.recommendedAmount ??
        quote?.estimation?.dstChainTokenOut?.amount ??
        0,
        outputMeta.decimals
      )
    : 0;
  const minOutput = outputMeta
    ? formatUnitsHuman(
        quote?.estimation?.dstChainTokenOut?.amount ??
        quote?.estimation?.dstChainTokenOut?.recommendedAmount ??
        0,
        outputMeta.decimals
      )
    : 0;
  const providerFeeUsd = Math.max(0, inputUsd - outputUsd);
  return {
    provider: "deBridge",
    providerKey: "debridge",
    providerFeeUsd,
    providerFeePct: inputUsd > 0 ? (providerFeeUsd / inputUsd) * 100 : 0,
    expectedOutput,
    minOutput,
    estimatedDurationSec: asNum(quote?.estimation?.recommendedOrderTTL ?? 0, 0),
  };
}

async function prepareDebridgeSwap(intent, payload) {
  const srcChainId = debridgeChainId(intent.from.chain);
  const dstChainId = debridgeChainId(intent.to.chain);
  if (!srcChainId || !dstChainId) {
    throw new Error(`deBridge direct adapter does not support ${intent.from.chain} -> ${intent.to.chain}`);
  }
  const srcToken = tokenMeta(intent.from.chain, intent.from.token);
  const dstToken = tokenMeta(intent.to.chain, intent.to.token);
  if (!srcToken || !dstToken) {
    throw new Error(`deBridge token mapping missing for ${intent.from.chain}:${intent.from.token} or ${intent.to.chain}:${intent.to.token}`);
  }
  const fromAddress = requireSourceAddress(payload);
  const recipient = String(intent.to.recipient || "").trim() || fromAddress;
  const amount = parseUnitsHuman(intent.execution?.swapAmountAfterTax ?? intent.from.amount, srcToken.decimals);
  const params = new URLSearchParams({
    srcChainId: String(srcChainId),
    srcChainTokenIn: srcToken.address,
    srcChainTokenInAmount: amount,
    dstChainId: String(dstChainId),
    dstChainTokenOut: dstToken.address,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,
    srcChainOrderAuthorityAddress: fromAddress,
    dstChainOrderAuthorityAddress: recipient,
    srcChainRefundAddress: fromAddress,
    senderAddress: fromAddress,
    enableEstimate: "true",
    prependOperatingExpenses: "true",
    affiliateFeePercent: "0",
  });
  const quote = await fetchJsonCached(
    `${DEBRIDGE_BASE_URL}/v1.0/dln/order/create-tx?${params.toString()}`,
    LI_FI_QUOTE_CACHE_TTL_MS,
    DEBRIDGE_QUOTE_CACHE
  );
  const tx = quote?.tx;
  if (!tx?.to) throw new Error("deBridge create-tx did not return executable transaction");
  return {
    provider: "deBridge",
    providerKey: "debridge",
    kind: "evm",
    tx,
    routeId: String(quote?.orderId || quote?.estimation?.orderId || "").trim(),
    orderId: String(quote?.orderId || quote?.estimation?.orderId || "").trim(),
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

function summarizeRelayQuote(intent, quote) {
  const toMeta = tokenMeta(intent.to.chain, intent.to.token);
  const outputDecimals = Number(
    quote?.details?.currencyOut?.decimals ??
    quote?.currencyOut?.decimals ??
    toMeta?.decimals ??
    0
  );
  const outputRaw =
    quote?.details?.currencyOut?.amount ??
    quote?.currencyOut?.amount ??
    quote?.details?.amountOut ??
    quote?.amountOut ??
    0;
  const minOutputRaw =
    quote?.details?.currencyOut?.amountReceived ??
    quote?.details?.currencyOut?.minAmount ??
    quote?.details?.amountOutMin ??
    quote?.amountOutMin ??
    outputRaw;
  const expectedOutput = relayAmountToNumber(outputRaw, outputDecimals);
  const minOutput = relayAmountToNumber(minOutputRaw, outputDecimals);
  const fees = quote?.fees && typeof quote.fees === "object" ? Object.values(quote.fees) : [];
  const providerFeeUsd = fees.reduce((sum, fee) => {
    if (!fee || typeof fee !== "object") return sum;
    return sum + asNum(fee.amountUsd ?? fee.usd ?? fee.amount?.usd, 0);
  }, 0);
  const inputUsd = asNum(
    quote?.details?.currencyIn?.amountUsd ??
    quote?.details?.amountInUsd ??
    quote?.currencyIn?.amountUsd,
    0
  );
  return {
    provider: "Relay",
    providerKey: "relay",
    providerFeeUsd,
    providerFeePct: inputUsd > 0 ? (providerFeeUsd / inputUsd) * 100 : 0,
    expectedOutput,
    minOutput,
    estimatedDurationSec: asNum(
      quote?.details?.timeEstimate ??
      quote?.details?.duration ??
      quote?.timeEstimate,
      0
    ),
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
  if (route.key === "debridge" && shouldUseDirectDebridge(intent)) {
    const prepared = await prepareDebridgeSwap(intent, { ...payload, fromAddress });
    return summarizeDebridgeQuote(intent, prepared.raw);
  }
  if (route.key === "relay") {
    const prepared = await prepareRelaySwap(intent, { ...payload, fromAddress });
    return summarizeRelayQuote(intent, prepared.raw);
  }
  if (["jumper", "mayan", "debridge"].includes(route.key)) {
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
  if (providerKey === "relay") {
    const execution = await prepareRelaySwap(intent, payload);
    if (!["evm", "tron"].includes(execution?.kind || "")) {
      throw new Error(`Provider ${providerKey} did not return an executable payload for ${intent.from.chain} source`);
    }
    return { intent, execution };
  }
  if (providerKey === "debridge" && shouldUseDirectDebridge(intent)) {
    return { intent, execution: await prepareDebridgeSwap(intent, payload) };
  }
  if (providerKey === "jumper" || providerKey === "mayan" || providerKey === "debridge") {
    const execution = await prepareLifiSwap(intent, payload);
    if (!["evm", "solana"].includes(execution?.kind || "")) {
      throw new Error(`Provider ${providerKey} did not return an executable payload for ${intent.from.chain} source`);
    }
    return { intent, execution };
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
  if (providerKey === "debridge" && order?.preparedExecution?.orderId) {
    try {
      const status = await fetchJson(`${DEBRIDGE_STATUS_BASE_URL}/${encodeURIComponent(order.preparedExecution.orderId)}/status`, {
        headers: debridgeHeaders(),
      });
      const bridgeStatus = String(status?.orderState || status?.status || "").toLowerCase();
      if (["fulfilled", "sentunlock", "claimedunlock"].includes(bridgeStatus)) {
        order.status = "completed";
        order.steps = [
          { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
          { key: "crosschain", status: "completed", note: "deBridge order completed on-chain", txHash: order.sourceTxHash },
        ];
        return order;
      }
      if (["cancelled", "canceled", "refunded", "failed", "sentcancel"].includes(bridgeStatus)) {
        order.status = "failed";
        order.steps = [
          { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
          { key: "crosschain", status: "failed", note: status?.orderState || status?.status || "deBridge reported failure", txHash: order.sourceTxHash },
        ];
        return order;
      }
      order.status = "processing";
      order.steps = [
        { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
        { key: "crosschain", status: "processing", note: status?.orderState || status?.status || "Waiting deBridge settlement", txHash: order.sourceTxHash },
      ];
      return order;
    } catch (err) {
      order.status = "processing";
      order.steps = [
        { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
        { key: "crosschain", status: "processing", note: `deBridge status check pending: ${err.message}`, txHash: order.sourceTxHash },
      ];
      return order;
    }
  }
  if (providerKey === "relay") {
    try {
      const statusUrl = normalizeRelayCheckUrl(
        order?.preparedExecution?.statusUrl || "",
        order?.preparedExecution?.requestId || ""
      );
      if (statusUrl) {
        const status = await fetchJson(statusUrl, { headers: relayHeaders() });
        const relayStatus = String(
          status?.status ||
          status?.details?.status ||
          status?.data?.status ||
          ""
        ).toLowerCase();
        if (["success", "completed", "done"].includes(relayStatus)) {
          order.status = "completed";
          order.steps = [
            { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
            { key: "crosschain", status: "completed", note: "Relay bridge completed on-chain", txHash: order.sourceTxHash },
          ];
          return order;
        }
        if (["failed", "refund", "refunded", "cancelled", "canceled"].includes(relayStatus)) {
          order.status = "failed";
          order.steps = [
            { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
            { key: "crosschain", status: "failed", note: status?.details?.message || status?.message || "Relay reported failure", txHash: order.sourceTxHash },
          ];
          return order;
        }
        order.status = "processing";
        order.steps = [
          { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
          { key: "crosschain", status: "processing", note: status?.details?.message || status?.message || relayStatus || "Waiting Relay settlement", txHash: order.sourceTxHash },
        ];
        return order;
      }
    } catch (err) {
      order.status = "processing";
      order.steps = [
        { key: "tax", status: order.taxTxHash ? "completed" : "pending", note: "Tax transfer status stored", txHash: order.taxTxHash || "" },
        { key: "crosschain", status: "processing", note: `Relay status check pending: ${err.message}`, txHash: order.sourceTxHash },
      ];
      return order;
    }
  }
  if (providerKey === "across" || providerKey === "jumper" || providerKey === "mayan" || providerKey === "debridge") {
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
          relay: Boolean(RELAY_API_KEY),
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
