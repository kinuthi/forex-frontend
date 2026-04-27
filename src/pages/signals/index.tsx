import { useEffect, useMemo, useState } from 'react';
import { history } from 'umi';
import styles from './index.less';
import {
  fetchMt5Link,
  fetchSignals,
  placeTrade,
  type PlaceTradeResponse,
  type Signal,
  type TradeAction,
  type TradeExecutionMode,
} from '@/services/api';

type RiskGrade = 'OK' | 'CHECK' | 'AVOID';

function rr(signal: Signal) {
  if (signal.stopLoss === undefined || signal.takeProfit === undefined) return null;
  const risk = Math.abs(signal.currentPrice - signal.stopLoss);
  const reward = Math.abs(signal.takeProfit - signal.currentPrice);
  if (risk === 0) return null;
  return reward / risk;
}

function riskPct(signal: Signal) {
  if (signal.stopLoss === undefined) return null;
  const risk = Math.abs(signal.currentPrice - signal.stopLoss);
  if (!signal.currentPrice) return null;
  return (risk / signal.currentPrice) * 100;
}

function grade(signal: Signal): { grade: RiskGrade; okToSuggestTrade: boolean; notes: string[] } {
  const notes: string[] = [];

  if (signal.action === 'HOLD') {
    return { grade: 'AVOID', okToSuggestTrade: false, notes: ['Signal says HOLD'] };
  }

  const confOk = signal.confidence >= 0.75;
  if (!confOk) notes.push(`Confidence low (${(signal.confidence * 100).toFixed(0)}%)`);

  const r = rr(signal);
  const rrOk = r !== null && r >= 1.5;
  if (r === null) notes.push('Missing SL/TP for R:R');
  else if (!rrOk) notes.push(`R:R too low (${r.toFixed(2)})`);

  const rp = riskPct(signal);
  // Default heuristic: stop loss within 0.5% of price is "ok" for intraday.
  const rpOk = rp !== null && rp <= 0.5;
  if (rp === null) notes.push('Missing stop loss');
  else if (!rpOk) notes.push(`Stop distance large (${rp.toFixed(2)}%)`);

  const okToSuggestTrade = confOk && rrOk && rpOk;

  if (okToSuggestTrade) return { grade: 'OK', okToSuggestTrade, notes: ['Risk checks passed'] };

  // If it’s not terrible, mark as CHECK.
  const hasSomeData = signal.stopLoss !== undefined || signal.takeProfit !== undefined;
  if (confOk && hasSomeData) return { grade: 'CHECK', okToSuggestTrade: false, notes };

  return { grade: 'AVOID', okToSuggestTrade: false, notes };
}

function actionClass(action: Signal['action']) {
  if (action === 'BUY') return styles.actionBuy;
  if (action === 'SELL') return styles.actionSell;
  return styles.actionHold;
}

export default function SignalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>('');

  const [lotSizes, setLotSizes] = useState<Record<string, number>>({});
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  const [statusByKey, setStatusByKey] = useState<Record<string, { ok?: string; err?: string }>>({});

  const [execution, setExecution] = useState<TradeExecutionMode>('PAPER');
  const [mt5BridgeKey, setMt5BridgeKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, mt5] = await Promise.all([fetchSignals(), fetchMt5Link()]);
      setSignals(data.signals ?? []);
      setGeneratedAt(data.generatedAt);
      setMt5BridgeKey(mt5.mt5BridgeKey ?? null);
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
      setError(apiMsg ?? err?.message ?? 'Failed to load signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const decorated = useMemo(
    () =>
      signals.map((s) => ({
        signal: s,
        rr: rr(s),
        riskPct: riskPct(s),
        grade: grade(s),
      })),
    [signals],
  );

  const onPlaceFromSignal = async (signal: Signal, key: string) => {
    setStatusByKey((p) => ({ ...p, [key]: {} }));
    setPlacingKey(key);

    try {
      if (signal.action !== 'BUY' && signal.action !== 'SELL') {
        throw new Error('Signal action must be BUY or SELL');
      }

      const lotSize = lotSizes[signal.symbol] ?? 0.1;
      if (!lotSize || lotSize <= 0) throw new Error('Lot size must be > 0');

      if (execution === 'MT5' && !mt5BridgeKey) {
        throw new Error('MT5 is not linked. Go to Profile → MT5 demo bridge and link it first.');
      }

      const res: PlaceTradeResponse = await placeTrade({
        symbol: signal.symbol,
        action: signal.action as TradeAction,
        lotSize,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        reason: `Signal: ${signal.reason}`,
        execution,
      });

      if (res.mode === 'MT5') {
        setStatusByKey((p) => ({
          ...p,
          [key]: { ok: `Queued to MT5 bridge (task ${res.taskId}). It will appear in Dashboard after execution.` },
        }));
      } else {
        setStatusByKey((p) => ({
          ...p,
          [key]: { ok: 'Trade placed (paper). Check Dashboard → Open Positions.' },
        }));
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;

      const msg =
        status === 404
          ? 'Backend missing POST /api/trades. Add it to your API server to enable placing trades.'
          : apiMsg ?? err?.message ?? 'Failed to place trade';

      setStatusByKey((p) => ({ ...p, [key]: { err: msg } }));
    } finally {
      setPlacingKey(null);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Signals</h1>
          <div className={styles.sub}>{generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : ''}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className={styles.modeSelect}
            value={execution}
            onChange={(e) => setExecution(e.target.value as TradeExecutionMode)}
            title={execution === 'MT5' && !mt5BridgeKey ? 'MT5 not linked (go to Profile)' : 'Execution mode'}
          >
            <option value="PAPER">PAPER</option>
            <option value="MT5">MT5 (DEMO)</option>
          </select>

          <button className={styles.btnSecondary} onClick={load} type="button">
            REFRESH
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Strategy suggestions</h2>

        {loading ? (
          <div className={styles.loading}>LOADING…</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : decorated.length === 0 ? (
          <div className={styles.loading}>NO SIGNALS</div>
        ) : (
          <div className={styles.grid}>
            {decorated.map(({ signal, rr: rrVal, riskPct: rp, grade: g }, idx) => {
              const badgeClass =
                g.grade === 'OK' ? styles.badgeOk : g.grade === 'CHECK' ? styles.badgeWarn : styles.badgeBad;

              const badgeText = g.grade === 'OK' ? 'OK TO TRADE' : g.grade === 'CHECK' ? 'CHECK RISK' : 'AVOID';

              const onUse = () => {
                // Prefill the trade form on the dashboard via query params.
                const qp = new URLSearchParams();
                qp.set('symbol', signal.symbol);
                if (signal.action === 'BUY' || signal.action === 'SELL') qp.set('action', signal.action);
                if (signal.stopLoss !== undefined) qp.set('stopLoss', String(signal.stopLoss));
                if (signal.takeProfit !== undefined) qp.set('takeProfit', String(signal.takeProfit));
                history.push(`/dashboard?${qp.toString()}`);
              };

              return (
                <div className={styles.card} key={`${signal.symbol}-${signal.generatedAt}-${idx}`}>
                  <div className={styles.cardTop}>
                    <span className={styles.symbol}>{signal.symbol}</span>
                    <span className={actionClass(signal.action)}>{signal.action}</span>
                    <span className={badgeClass}>{badgeText}</span>
                  </div>

                  <div className={styles.kv}>
                    <div>
                      <span className={styles.k}>Price</span>
                      <span className={styles.v}>{signal.currentPrice}</span>
                    </div>
                    <div>
                      <span className={styles.k}>Confidence</span>
                      <span className={styles.v}>{(signal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className={styles.k}>Stop Loss</span>
                      <span className={styles.v}>{signal.stopLoss ?? '—'}</span>
                    </div>
                    <div>
                      <span className={styles.k}>Take Profit</span>
                      <span className={styles.v}>{signal.takeProfit ?? '—'}</span>
                    </div>
                    <div>
                      <span className={styles.k}>R:R</span>
                      <span className={styles.v}>{rrVal === null ? '—' : rrVal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className={styles.k}>Risk %</span>
                      <span className={styles.v}>{rp === null ? '—' : `${rp.toFixed(2)}%`}</span>
                    </div>
                  </div>

                  <p className={styles.reason}>{signal.reason}</p>

                  <div className={styles.lotRow}>
                    <div>
                      <span className={styles.lotLabel}>Lot Size</span>
                    </div>
                    <input
                      className={styles.lotInput}
                      type="number"
                      step="0.01"
                      min="0"
                      value={lotSizes[signal.symbol] ?? 0.1}
                      onChange={(e) =>
                        setLotSizes((p) => ({
                          ...p,
                          [signal.symbol]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.btn}
                      onClick={() => {
                        if (g.okToSuggestTrade) {
                          const key = `${signal.symbol}-${signal.generatedAt}-${idx}`;
                          onPlaceFromSignal(signal, key);
                        } else {
                          onUse();
                        }
                      }}
                      type="button"
                      disabled={signal.action === 'HOLD' || placingKey === `${signal.symbol}-${signal.generatedAt}-${idx}`}
                      title={
                        g.okToSuggestTrade
                          ? 'Places a trade immediately (requires backend POST /api/trades)'
                          : 'Opens dashboard with this signal prefilled'
                      }
                    >
                      {placingKey === `${signal.symbol}-${signal.generatedAt}-${idx}`
                        ? 'PLACING…'
                        : g.okToSuggestTrade
                          ? execution === 'MT5'
                            ? 'PLACE ON MT5'
                            : 'PLACE TRADE'
                          : 'USE ON DASHBOARD'}
                    </button>

                    <button className={styles.btnSecondary} onClick={load} type="button">
                      UPDATE
                    </button>
                  </div>

                  {(() => {
                    const key = `${signal.symbol}-${signal.generatedAt}-${idx}`;
                    const st = statusByKey[key];
                    if (!st) return null;
                    if (st.ok) return <div className={styles.statusOk}>{st.ok}</div>;
                    if (st.err) return <div className={styles.statusErr}>{st.err}</div>;
                    return null;
                  })()}

                  {g.notes.length > 0 && (
                    <p className={styles.reason} style={{ marginTop: 10 }}>
                      Risk notes: {g.notes.join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
