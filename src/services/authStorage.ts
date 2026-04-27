export const TOKEN_STORAGE_KEY = 'trading_bot_jwt';
export const USER_STORAGE_KEY = 'trading_bot_user';

export type StoredUser = {
  id: string;
  username: string;
  email: string;
  balance?: number;
  equity?: number;
  metaAccountId?: string;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function setStoredUser(user: StoredUser) {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function clearAuth() {
  clearToken();
  clearStoredUser();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
