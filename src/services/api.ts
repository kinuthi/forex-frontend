import axios from 'axios';
import { history } from 'umi';
import { clearAuth, getToken } from './authStorage';

/**
 * Direct backend connection (NO proxy used anymore)
 */
export const api = axios.create({
  baseURL: 'https://forex-backend-production-fdde.up.railway.app/api',
  //baseURL: 'http://localhost:3001/api',
  withCredentials: false,
});

/**
 * Attach JWT token automatically
 */
api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Handle auth errors globally
 */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      clearAuth();

      const path = history.location?.pathname;
      if (path !== '/login' && path !== '/register') {
        history.push('/login');
      }
    }

    return Promise.reject(err);
  },
);

/* =========================
   AUTH
========================= */

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    balance: number;
    equity: number;
  };
};

export type SignupResponse = {
  message: string;
  userId: string;
};

export async function login(params: { username: string; password: string }) {
  const res = await api.post<LoginResponse>('/login', params);
  return res.data;
}

export async function signup(params: {
  username: string;
  email: string;
  password: string;
}) {
  const res = await api.post<SignupResponse>('/signup', params);
  return res.data;
}

/* =========================
   TRADING TYPES
========================= */

export type TradeAction = 'BUY' | 'SELL';

export type Signal = {
  symbol: string;
  currentPrice: number;
  action: TradeAction | 'HOLD';
  confidence: number;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  generatedAt: string;
};

export type Trade = {
  _id?: string;
  id?: string;
  symbol: string;
  action?: TradeAction;
  side?: TradeAction;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize?: number;
  volume?: number;
  status?: 'OPEN' | 'CLOSED';
  openedAt?: string;
  closedAt?: string;
  closePrice?: number;
  pnl?: number;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Portfolio = {
  balance: number;
  equity: number;
  trades?: Trade[];
};

/* =========================
   API CALLS
========================= */

export async function fetchPortfolio() {
  const res = await api.get<Portfolio>('/portfolio');
  return res.data;
}

export async function fetchPrices() {
  const res = await api.get<{ prices: Record<string, number> }>('/prices');
  return res.data;
}

export async function fetchTrades() {
  const res = await api.get<Trade[]>('/trades');
  return res.data;
}

export async function fetchActiveTrades() {
  const res = await api.get('/trades/active');
  return res.data as { trades: Trade[]; prices: Record<string, number>; time: string };
}

export async function fetchSignals() {
  const res = await api.get<{ signals: Signal[]; source: string; generatedAt: string }>(
    '/signals',
  );
  return res.data;
}

export async function addMetaAccount(payload: { accountId: string }) {
  const res = await api.post('/add-meta-account', payload);
  return res.data as { message: string };
}

/* =========================
   TRADES
========================= */

export type TradeExecutionMode = 'PAPER' | 'MT5' | 'META_API';

export type PlaceTradeResponse =
  | { message: string; mode: 'PAPER'; trade: Trade }
  | { message: string; mode: 'MT5'; taskId: string }
  | { message: string; mode: 'META_API'; trade: Trade };

export async function placeTrade(payload: {
  symbol: string;
  action: TradeAction;
  lotSize: number;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  reason?: string;
  execution?: TradeExecutionMode;
}) {
  const res = await api.post('/trades', payload);
  return res.data as PlaceTradeResponse;
}

export type CloseTradeRequest = {
  closeAt?: 'MARKET' | 'TP' | 'SL';
  closePrice?: number;
  reason?: string;
};

export type CloseTradeResponse =
  | { message: string; trade: Trade; balance?: number; equity?: number }
  | { message: string; taskId: string };

export async function closeTrade(tradeId: string, payload: CloseTradeRequest) {
  const res = await api.post(`/trades/${tradeId}/close`, payload);
  return res.data as CloseTradeResponse;
}

/* =========================
   MT5
========================= */

export type Mt5LinkInfo = {
  mt5Account: string | null;
  mt5Server: string | null;
  mt5BridgeKey: string | null;
};

export async function fetchMt5Link() {
  const res = await api.get<Mt5LinkInfo>('/mt5/link');
  return res.data;
}

export async function linkMt5(payload: { account?: string; server?: string }) {
  const res = await api.post('/mt5/link', payload);
  return res.data as {
    message: string;
    mt5BridgeKey: string;
    mt5Account: string | null;
    mt5Server: string | null;
  };
}

export async function unlinkMt5() {
  const res = await api.post('/mt5/unlink');
  return res.data as { message: string };
}

/* =========================
   META API
========================= */

export type MetaApiStatus = {
  connected: boolean;
  accountId: string | null;
  status: string;
};

export type MetaApiAccountInfo = {
  accountId: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  profit: number;
  server: string;
  currency: string;
  leverage: number;
};

export type MetaApiPosition = {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price: number;
  currentPrice: number;
  profit: number;
  swap: number;
  margin: number;
  timestamp: string;
};

export async function fetchMetaApiStatus() {
  const res = await api.get<MetaApiStatus>('/metaapi/status');
  return res.data;
}

export async function connectMetaApi(payload: { accountId: string }) {
  const res = await api.post('/metaapi/connect', payload);
  return res.data as { message: string };
}

export async function disconnectMetaApi() {
  const res = await api.post('/metaapi/disconnect');
  return res.data as { message: string };
}

export async function fetchMetaApiAccountInfo() {
  const res = await api.get<MetaApiAccountInfo>('/metaapi/account-info');
  return res.data;
}

export async function fetchMetaApiPositions() {
  const res = await api.get<{ positions: MetaApiPosition[] }>('/metaapi/positions');
  return res.data;
}