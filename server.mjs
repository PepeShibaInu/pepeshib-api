import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = normalize(__dirname);
const PORT = Number(process.env.PORT || 8080);

const CHAINS = [
  { id: "ethereum", name: "Ethereum", family: "EVM" },
  { id: "bsc", name: "BNB Smart Chain", family: "EVM" },
  { id: "polygon", name: "Polygon", family: "EVM" },
  { id: "arbitrum", name: "Arbitrum", family: "EVM" },
  { id: "optimism", name: "Optimism", family: "EVM" },
  { id: "base", name: "Base", family: "EVM" },
  { id: "avalanche", name: "Avalanche C-Chain", family: "EVM" },
  { id: "fantom", name: "Fantom", family: "EVM" },
  { id: "zksync", name: "zkSync Era", family: "EVM" },
  { id: "linea", name: "Linea", family: "EVM" },
  { id: "solana", name: "Solana", family: "SVM" },
  { id: "tron", name: "Tron", family: "TVM" },
  { id: "xrpl", name: "XRP Ledger", family: "XRPL" },
];

const TOKENS = [
  { id: "USDT", usd: 1 },
  { id: "USDC", usd: 1 },
  { id: "PSHIB", usd: 0.00002 },
  { id: "BNB", usd: 560 },
  { id: "ETH", usd: 3200 },
  { id: "MATIC", usd: 0.95 },
  { id: "AVAX", usd: 42 },
  { id: "SOL", usd: 140 },
  { id: "TRX", usd: 0.13 },
  { id: "XRP", usd: 0.62 },
];

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
    fantom: "0xTaxFtmTreasury000000000000000000000001",
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
      ["EVM", "SVM", "TVM"].includes(q.fromChain.family) &&
      ["EVM", "SVM", "TVM"].includes(q.toChain.family) &&
      q.fromChain.id !== q.toChain.id,
    url: () => "https://app.debridge.finance/",
    note: "Auto-selected route optimized for broad chain coverage. Verify route details in checkout.",
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
      ["EVM", "SVM"].includes(q.toChain.family),
    url: () => "https://jumper.exchange/",
    note: "Auto-selected aggregator route. Verify route details in checkout.",
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

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getChain(id) {
  return CHAINS.find((c) => c.id === id) || CHAINS[0];
}

function getToken(id) {
  return TOKENS.find((t) => t.id === id) || TOKENS[0];
}

function getConfig(input = {}) {
  return {
    taxPercent: Math.max(0, asNum(input.taxPercent, DEFAULT_CFG.taxPercent)),
    protocolFee: Math.max(0, asNum(input.protocolFee, DEFAULT_CFG.protocolFee)),
    bridgeFee: Math.max(0, asNum(input.bridgeFee, DEFAULT_CFG.bridgeFee)),
    taxWallets: { ...DEFAULT_CFG.taxWallets, ...(input.taxWallets || {}) },
  };
}

function computeQuote(payload = {}) {
  const config = getConfig(payload.config);
  const amountIn = Math.max(0, asNum(payload.amount, 0));
  const slippagePct = Math.max(0, asNum(payload.slippage, 0.5));

  const fromToken = getToken(payload.fromToken);
  const toToken = getToken(payload.toToken);
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
  };
}

function buildRoute(payload = {}) {
  const quote = computeQuote(payload);
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

  return {
    provider: best.label,
    key: best.key,
    estProviderFeePct: best.estFeePct,
    url: best.url(quote),
    note: best.note,
    quote,
  };
}

function buildTaxIntent(payload = {}) {
  const route = buildRoute(payload);
  const q = route.quote;
  const recipient = String(payload.recipient || "").trim();
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

function createSwapOrder(payload = {}) {
  const incomingIntent = payload?.intent && typeof payload.intent === "object" ? payload.intent : null;
  const intent = incomingIntent || buildTaxIntent(payload);
  const orderId = `psx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const order = {
    id: orderId,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    intent,
    steps: [
      { key: "tax", status: "pending", note: "Tax transfer pending user signature" },
      { key: "crosschain", status: "queued", note: "Cross-chain route queued in PepeShibDex engine" },
    ],
  };
  SWAP_ORDERS.set(orderId, order);
  return order;
}

function hydrateSwapOrder(order) {
  const createdMs = Date.parse(order.createdAt || new Date().toISOString());
  const elapsed = Math.max(0, Date.now() - createdMs);

  if (elapsed >= 12000) {
    order.status = "completed";
    order.steps = [
      {
        key: "tax",
        status: "completed",
        note: "Tax transfer confirmed",
        txHash: `tax_${order.id}`,
      },
      {
        key: "crosschain",
        status: "completed",
        note: "Cross-chain execution completed",
        txHash: `swap_${order.id}`,
      },
    ];
  } else if (elapsed >= 6000) {
    order.status = "processing";
    order.steps = [
      {
        key: "tax",
        status: "completed",
        note: "Tax transfer confirmed",
        txHash: `tax_${order.id}`,
      },
      {
        key: "crosschain",
        status: "processing",
        note: "Waiting bridge settlement",
      },
    ];
  } else if (elapsed >= 2000) {
    order.status = "processing";
    order.steps = [
      {
        key: "tax",
        status: "processing",
        note: "Tax transfer pending confirmation",
      },
      {
        key: "crosschain",
        status: "queued",
        note: "Cross-chain route queued in PepeShibDex engine",
      },
    ];
  } else {
    order.status = "submitted";
  }

  order.updatedAt = new Date().toISOString();
  return order;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
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
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = reqUrl;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      json(res, 200, { ok: true, service: "pshibdex-local-api" });
      return;
    }

    if (req.method === "POST" && pathname === "/api/quote") {
      const body = await readJsonBody(req);
      json(res, 200, { ok: true, quote: computeQuote(body) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/route") {
      const body = await readJsonBody(req);
      const route = buildRoute(body);
      json(res, 200, {
        ok: true,
        route: {
          provider: route.provider,
          key: route.key,
          estProviderFeePct: route.estProviderFeePct,
          url: route.url,
          note: route.note,
        },
        quote: route.quote,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/tax-intent") {
      const body = await readJsonBody(req);
      const intent = buildTaxIntent(body);
      json(res, 200, { ok: true, intent });
      return;
    }

    if (req.method === "POST" && pathname === "/api/execute-swap") {
      const body = await readJsonBody(req);
      const order = hydrateSwapOrder(createSwapOrder(body));
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
      hydrateSwapOrder(order);
      json(res, 200, { ok: true, swap: order });
      return;
    }

    await serveFile(req, res);
  } catch (err) {
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
