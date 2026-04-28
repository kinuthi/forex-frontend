import { useEffect, useState } from 'react';
import styles from './index.less';
import { 
  addMetaAccount, 
  fetchMt5Link, 
  fetchPortfolio, 
  linkMt5, 
  unlinkMt5,
  fetchMetaApiStatus,
  connectMetaApi,
  disconnectMetaApi,
  fetchMetaApiAccountInfo,
  fetchMetaApiPositions
} from '@/services/api';
import { getStoredUser, setStoredUser } from '@/services/authStorage';

export default function ProfilePage() {
  const stored = getStoredUser();

  const [balance, setBalance] = useState<number | null>(stored?.balance ?? null);
  const [equity, setEquity] = useState<number | null>(stored?.equity ?? null);

  const [metaAccountId, setMetaAccountId] = useState(stored?.metaAccountId ?? '');
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [mt5Account, setMt5Account] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [mt5BridgeKey, setMt5BridgeKey] = useState<string | null>(null);
  const [mt5Loading, setMt5Loading] = useState(false);
  const [mt5Msg, setMt5Msg] = useState<{ ok?: string; err?: string }>({});

  // MetaApi state
  const [metaApiAccountId, setMetaApiAccountId] = useState('');
  const [metaApiStatus, setMetaApiStatus] = useState<any>(null);
  const [metaApiAccountInfo, setMetaApiAccountInfo] = useState<any>(null);
  const [metaApiPositions, setMetaApiPositions] = useState<any[]>([]);
  const [metaApiLoading, setMetaApiLoading] = useState(false);
  const [metaApiMsg, setMetaApiMsg] = useState<{ ok?: string; err?: string }>({});

  const load = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setMetaApiMsg({});

    try {
      const [p, mt5, metaApi] = await Promise.all([
        fetchPortfolio(), 
        fetchMt5Link(),
        fetchMetaApiStatus()
      ]);

      setBalance(p.balance);
      setEquity(p.equity);

      setMt5Account(mt5.mt5Account ?? '');
      setMt5Server(mt5.mt5Server ?? '');
      setMt5BridgeKey(mt5.mt5BridgeKey ?? null);

      // Set MetaApi status
      console.log('MetaApi status from backend:', metaApi);
      setMetaApiStatus(metaApi);
      if (metaApi.accountId) {
        setMetaApiAccountId(metaApi.accountId);
      }

      // Load MetaApi account info if connected
      if (metaApi.connected) {
        try {
          console.log('Loading MetaApi account info...');
          const [accountInfo, positions] = await Promise.all([
            fetchMetaApiAccountInfo(),
            fetchMetaApiPositions()
          ]);
          console.log('MetaApi account info loaded:', accountInfo);
          console.log('MetaApi positions loaded:', positions);
          
          setMetaApiAccountInfo(accountInfo);
          setMetaApiPositions(positions.positions || []);
        } catch (err) {
          console.error('Failed to load MetaApi details:', err);
          setMetaApiAccountInfo({
            accountId: metaApi.accountId || 'Error loading',
            balance: 0,
            equity: 0,
            server: 'Error loading',
            currency: 'USD',
            leverage: 0
          });
          setMetaApiPositions([]);
        }
      }

      // Keep a cached copy for the profile page header.
      if (stored) {
        setStoredUser({ ...stored, balance: p.balance, equity: p.equity });
      }
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setErrMsg(apiMsg ?? err?.message ?? 'Failed to load profile');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveMeta = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setSaving(true);

    try {
      if (!metaAccountId.trim()) throw new Error('Meta account ID is required');
      const res = await addMetaAccount({ accountId: metaAccountId.trim() });
      setOkMsg(res.message ?? 'Saved');

      if (stored) {
        setStoredUser({ ...stored, metaAccountId: metaAccountId.trim() });
      }
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setErrMsg(apiMsg ?? err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const onLinkMt5 = async () => {
    setMt5Msg({});
    setMt5Loading(true);

    try {
      const res = await linkMt5({ account: mt5Account.trim() || undefined, server: mt5Server.trim() || undefined });
      setMt5BridgeKey(res.mt5BridgeKey);
      setMt5Account(res.mt5Account ?? '');
      setMt5Server(res.mt5Server ?? '');
      setMt5Msg({ ok: res.message ?? 'MT5 linked' });
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setMt5Msg({ err: apiMsg ?? err?.message ?? 'Failed to link MT5' });
    } finally {
      setMt5Loading(false);
    }
  };

  const onUnlinkMt5 = async () => {
    setMt5Msg({});
    setMt5Loading(true);

    try {
      const res = await unlinkMt5();
      setMt5BridgeKey(null);
      setMt5Msg({ ok: res.message ?? 'MT5 unlinked' });
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setMt5Msg({ err: apiMsg ?? err?.message ?? 'Failed to unlink MT5' });
    } finally {
      setMt5Loading(false);
    }
  };

  const onConnectMetaApi = async () => {
    setMetaApiMsg({});
    setMetaApiLoading(true);

    try {
      if (!metaApiAccountId.trim()) throw new Error('MetaApi Account ID is required');
      const res = await connectMetaApi({ accountId: metaApiAccountId.trim() });
      setMetaApiMsg({ ok: res.message ?? 'MetaApi connected successfully' });
      
      // Wait a moment for backend to update, then reload status
      await new Promise(resolve => setTimeout(resolve, 1000));
      await load();
    } catch (err: any) {
      console.error('MetaApi connect error:', err);
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setMetaApiMsg({ err: apiMsg ?? err?.message ?? 'Failed to connect MetaApi' });
    } finally {
      setMetaApiLoading(false);
    }
  };

  const onDisconnectMetaApi = async () => {
    setMetaApiMsg({});
    setMetaApiLoading(true);

    try {
      const res = await disconnectMetaApi();
      setMetaApiMsg({ ok: res.message ?? 'MetaApi disconnected successfully' });
      setMetaApiAccountId('');
      setMetaApiAccountInfo(null);
      setMetaApiPositions([]);
      
      // Reload to get updated status
      await load();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setMetaApiMsg({ err: apiMsg ?? err?.message ?? 'Failed to disconnect MetaApi' });
    } finally {
      setMetaApiLoading(false);
    }
  };

  const onSyncBalance = async () => {
    setMetaApiMsg({});
    setMetaApiLoading(true);

    try {
      if (!metaApiAccountInfo?.balance || !metaApiAccountInfo?.equity) {
        setMetaApiMsg({ err: 'No MetaApi balance data available to sync' });
        return;
      }

      // Update portfolio balance with MetaApi balance
      setBalance(metaApiAccountInfo.balance);
      setEquity(metaApiAccountInfo.equity);
      
      // Update stored user data
      if (stored) {
        const updatedUser = { ...stored, balance: metaApiAccountInfo.balance, equity: metaApiAccountInfo.equity };
        setStoredUser(updatedUser);
      }

      setMetaApiMsg({ ok: `Balance synced: $${metaApiAccountInfo.balance.toFixed(2)} from MetaApi` });
    } catch (err: any) {
      setMetaApiMsg({ err: 'Failed to sync balance' });
    } finally {
      setMetaApiLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <button className={styles.btnSecondary} onClick={load} type="button">
          REFRESH
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Personal details</h2>
        <div className={styles.card}>
          <div className={styles.grid}>
            <div>
              <span className={styles.k}>Username</span>
              <span className={styles.v}>
                {stored?.username && stored?.username !== stored?.email 
                  ? stored.username 
                  : stored?.email?.split('@')[0] || '—'}
              </span>
            </div>
            <div>
              <span className={styles.k}>Email</span>
              <span className={styles.v}>{stored?.email ?? '—'}</span>
            </div>
            <div>
              <span className={styles.k}>Balance</span>
              <span className={styles.v}>{balance === null ? '—' : `$${balance.toFixed(2)}`}</span>
            </div>
            <div>
              <span className={styles.k}>Equity</span>
              <span className={styles.v}>{equity === null ? '—' : `$${equity.toFixed(2)}`}</span>
            </div>
          </div>

          <p className={styles.note}>
            Note: at the moment, the backend only returns username/email on login. This page caches those values in the
            browser. If you want fully accurate profile data across devices, add an authenticated GET /api/me endpoint.
          </p>

          {errMsg && <div className={styles.msgErr}>{errMsg}</div>}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Meta API / MT5 connection</h2>
        <div className={styles.card}>
          <span className={styles.k}>MetaTrader Account ID</span>
          <input
            className={styles.input}
            value={metaAccountId}
            onChange={(e) => setMetaAccountId(e.target.value)}
            placeholder="e.g. 12345678"
          />

          <div className={styles.actions}>
            <button className={styles.btn} onClick={onSaveMeta} type="button" disabled={saving}>
              {saving ? 'SAVING…' : 'SAVE'}
            </button>
          </div>

          {okMsg && <div className={styles.msgOk}>{okMsg}</div>}
          {errMsg && <div className={styles.msgErr}>{errMsg}</div>}

          <p className={styles.note}>This frontend uses your existing backend endpoint: POST /api/add-meta-account.</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>MetaApi Cloud Connection</h2>
        <div className={styles.card}>
          <p className={styles.note}>
            Connect to MetaApi.cloud for real-time trading integration with supported brokers.
            This provides direct API access to your trading account.
          </p>

          <div className={styles.formRow}>
            <span className={styles.k}>Connection Status</span>
            <span className={styles.v}>
              {metaApiStatus?.connected ? (
                <span style={{ color: '#52c41a' }}>
                  ✅ Connected ({metaApiStatus.status})
                </span>
              ) : (
                <span style={{ color: '#ff4d4f' }}>
                  ❌ Disconnected
                </span>
              )}
            </span>
          </div>

          {metaApiStatus?.connected && metaApiAccountInfo && (
            <div className={styles.grid}>
              <div>
                <span className={styles.k}>Account ID</span>
                <span className={styles.v}>{metaApiAccountInfo.accountId || 'N/A'}</span>
              </div>
              <div>
                <span className={styles.k}>Balance</span>
                <span className={styles.v}>${(metaApiAccountInfo.balance ?? 0).toFixed(2)}</span>
              </div>
              <div>
                <span className={styles.k}>Equity</span>
                <span className={styles.v}>${(metaApiAccountInfo.equity ?? 0).toFixed(2)}</span>
              </div>
              <div>
                <span className={styles.k}>Server</span>
                <span className={styles.v}>{metaApiAccountInfo.server || 'N/A'}</span>
              </div>
            </div>
          )}

          {!metaApiStatus?.connected && (
            <>
              <span className={styles.k}>MetaApi Account ID</span>
              <input
                className={styles.input}
                value={metaApiAccountId}
                onChange={(e) => setMetaApiAccountId(e.target.value)}
                placeholder="Enter your MetaApi Account ID"
              />
            </>
          )}

          <div className={styles.actions}>
            {!metaApiStatus?.connected ? (
              <button 
                className={styles.btn} 
                onClick={onConnectMetaApi} 
                type="button" 
                disabled={metaApiLoading}
              >
                {metaApiLoading ? 'CONNECTING…' : 'CONNECT'}
              </button>
            ) : (
              <>
                <button 
                  className={styles.btnSecondary} 
                  onClick={onDisconnectMetaApi} 
                  type="button" 
                  disabled={metaApiLoading}
                >
                  {metaApiLoading ? 'DISCONNECTING…' : 'DISCONNECT'}
                </button>
                <button 
                  className={styles.btnSecondary} 
                  onClick={load} 
                  type="button" 
                  disabled={metaApiLoading}
                  style={{ marginLeft: '10px' }}
                >
                  REFRESH STATUS
                </button>
                {metaApiAccountInfo?.balance > 0 && (
                  <button 
                    className={styles.btn} 
                    onClick={onSyncBalance} 
                    type="button" 
                    disabled={metaApiLoading}
                    style={{ marginLeft: '10px' }}
                  >
                    SYNC BALANCE
                  </button>
                )}
              </>
            )}
          </div>

          {metaApiMsg.ok && <div className={styles.msgOk}>{metaApiMsg.ok}</div>}
          {metaApiMsg.err && <div className={styles.msgErr}>{metaApiMsg.err}</div>}

          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', fontSize: '11px', fontFamily: 'monospace' }}>
              <strong>Debug - MetaApi Status:</strong>
              <pre>{JSON.stringify(metaApiStatus, null, 2)}</pre>
            </div>
          )}

          {metaApiStatus?.connected && metaApiPositions && metaApiPositions.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Open Positions ({metaApiPositions.length})</h4>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                {metaApiPositions.map((pos, idx) => (
                  <div key={idx} style={{ marginBottom: '5px' }}>
                    {pos.type || 'UNKNOWN'} {pos.symbol || 'N/A'} - {(pos.volume ?? 0)} lots @ {(pos.price ?? 0)} 
                    <span style={{ color: (pos.profit ?? 0) >= 0 ? '#52c41a' : '#ff4d4f', marginLeft: '10px' }}>
                      P&L: ${(pos.profit ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={styles.note}>
            MetaApi endpoints used: GET /api/metaapi/status, POST /api/metaapi/connect, 
            POST /api/metaapi/disconnect, GET /api/metaapi/account-info, GET /api/metaapi/positions
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>MT5 demo bridge (free)</h2>
        <div className={styles.card}>
          <p className={styles.note}>
            This does not connect to MT5 directly from the browser. It links a "bridge key" so a local bridge script
            (running on the machine with your MT5 terminal) can poll tasks from this API.
          </p>

          <div className={styles.grid}>
            <div>
              <span className={styles.k}>MT5 Account</span>
              <input
                className={styles.input}
                value={mt5Account}
                onChange={(e) => setMt5Account(e.target.value)}
                placeholder="Demo account number"
              />
            </div>
            <div>
              <span className={styles.k}>MT5 Server</span>
              <input
                className={styles.input}
                value={mt5Server}
                onChange={(e) => setMt5Server(e.target.value)}
                placeholder="Broker demo server"
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btn} onClick={onLinkMt5} type="button" disabled={mt5Loading}>
              {mt5Loading ? 'LINKING…' : 'LINK / REFRESH KEY'}
            </button>
            <button className={styles.btnSecondary} onClick={onUnlinkMt5} type="button" disabled={mt5Loading}>
              UNLINK
            </button>
          </div>

          <div className={styles.formRow}>
            <span className={styles.k}>Bridge Key</span>
            <span className={styles.v}>{mt5BridgeKey ?? '— (not linked)'}</span>
          </div>

          {mt5Msg.ok && <div className={styles.msgOk}>{mt5Msg.ok}</div>}
          {mt5Msg.err && <div className={styles.msgErr}>{mt5Msg.err}</div>}

          <p className={styles.note}>
            Bridge polling endpoint: <span className={styles.v}>GET /api/mt5/tasks?key=&lt;bridgeKey&gt;</span>
          </p>
        </div>
      </section>
    </div>
  );
}
