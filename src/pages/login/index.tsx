import { useState } from 'react';
import { Link, history, useLocation } from 'umi';
import styles from './index.less';
import { login } from '@/services/api';
import { setStoredUser, setToken } from '@/services/authStorage';

export default function LoginPage() {
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login({ username, password });
      const token = data.token;

      setToken(token);
      setStoredUser(data.user);

      const sp = new URLSearchParams(location.search);
      const next = sp.get('next');
      history.push(next ? decodeURIComponent(next) : '/dashboard');
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setError(apiMsg ?? err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Trading Bot</h1>
        <p className={styles.sub}>Log in to place trades and view history</p>

        <form onSubmit={onSubmit}>
          <div className={styles.row}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? 'LOGGING IN…' : 'LOGIN'}
            </button>
            <Link className={styles.link} to="/register">
              Create account
            </Link>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
