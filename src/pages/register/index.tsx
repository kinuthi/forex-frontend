import { useState } from 'react';
import { Link, history } from 'umi';
import styles from './index.less';
import { signup } from '@/services/api';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signup({ username, email, password });
      // Your backend /api/signup does not return a JWT, so redirect to login.
      history.push('/login');
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setError(apiMsg ?? err?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.sub}>Sign up to start trading</p>

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
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? 'CREATING…' : 'CREATE'}
            </button>
            <Link className={styles.link} to="/login">
              Back to login
            </Link>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
