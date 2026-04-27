import React, { Suspense } from 'react';
import { Link, Outlet, history, useLocation } from 'umi';
import styles from './index.less';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { clearAuth, getToken } from '@/services/authStorage';

export default function Layout() {
  const location = useLocation();
  const token = getToken();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const onLogout = () => {
    clearAuth();
    history.push('/login');
  };

  return (
    <div className={styles.layout}>
      {!isAuthPage && (
        <header className={styles.topbar}>
          <Link className={styles.brand} to="/dashboard">
            Trading Bot
          </Link>

          <nav className={styles.nav}>
            <Link
              className={`${styles.link} ${location.pathname === '/dashboard' ? styles.linkActive : ''}`}
              to="/dashboard"
            >
              Dashboard
            </Link>

            {!token ? (
              <>
                <Link
                  className={`${styles.link} ${location.pathname === '/login' ? styles.linkActive : ''}`}
                  to="/login"
                >
                  Login
                </Link>
                <Link
                  className={`${styles.link} ${location.pathname === '/register' ? styles.linkActive : ''}`}
                  to="/register"
                >
                  Register
                </Link>
              </>
            ) : (
              <>
                <Link
                  className={`${styles.link} ${location.pathname === '/signals' ? styles.linkActive : ''}`}
                  to="/signals"
                >
                  Signals
                </Link>
                <Link
                  className={`${styles.link} ${location.pathname === '/profile' ? styles.linkActive : ''}`}
                  to="/profile"
                >
                  Profile
                </Link>
                <button className={styles.logout} onClick={onLogout} type="button">
                  Logout
                </button>
              </>
            )}
          </nav>
        </header>
      )}

      <main className={styles.content}>
        <div
          style={{
            padding: '8px 20px',
            borderBottom: '1px solid #111',
            color: '#aaa',
            fontSize: 11,
            letterSpacing: 2,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        >
          APP RENDER CHECK · path: {location.pathname} · token: {token ? 'yes' : 'no'}
        </div>

        <ErrorBoundary>
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: '60vh',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#666',
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  letterSpacing: 2,
                  fontSize: 12,
                }}
              >
                LOADING…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
