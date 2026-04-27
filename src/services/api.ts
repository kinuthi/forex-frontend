import axios from 'axios';
import { history } from 'umi';
import { clearAuth, getToken } from './authStorage';

/**
 * Axios client configured for the backend.
 *
 * By default this uses the Umi proxy in .umirc.ts:
 *   /api -> http://localhost:3001
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    // Most JWT backends use this format.
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      clearAuth();
      // Avoid redirect loops on auth pages.
      const path = history.location?.pathname;
      if (path !== '/login' && path !== '/register') {
        history.push('/login');
      }
    }

    return Promise.reject(err);
  },
);

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

// Backend routes (per your server.ts)
//   POST /api/login  { username, password }
//   POST /api/signup { username, email, password }
export async function login(params: { username: string; password: string }) {
  const res = await api.post<LoginResponse>('/login', params);
  return res.data;
}

export async function signup(params: { username: string; email: string; password: string }) {
  const res = await api.post<SignupResponse>('/signup', params);
  return res.data;
}

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

export async function addMetaAccount(payload: { accountId: string }) {
  const res = await api.post('/add-meta-account', payload);
  return res.data as { message: string };
}

export async function fetchSignals() {
  const res = await api.get<{ signals: Signal[]; source: string; generatedAt: string }>('/signals');
  return res.data;
}

export type TradeExecutionMode = 'PAPER' | 'MT5';

export type PlaceTradeResponse =
  | {
    message: string;
    mode: 'PAPER';
    trade: Trade;
  }
  | {
    message: string;
    mode: 'MT5';
    taskId: string;
  };

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
  | {
    message: string;
    trade: Trade;
    balance?: number;
    equity?: number;
  }
  | {
    message: string;
    taskId: string;
  };

export async function closeTrade(tradeId: string, payload: CloseTradeRequest) {
  const res = await api.post(`/trades/${tradeId}/close`, payload);
  return res.data as CloseTradeResponse;
}

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
