import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'umi';
import styles from './index.less';
import {
    closeTrade,
    fetchMt5Link,
    fetchPortfolio,
    fetchPrices,
    fetchTrades,
    placeTrade,
    type PlaceTradeResponse,
    type Portfolio,
    type Trade,
    type TradeAction,
    type TradeExecutionMode,
} from '@/services/api';
import { getToken } from '@/services/authStorage';

const INITIAL_BALANCE = 10000;

function tradeKey(trade: Trade, index: number) {
    return trade.id ?? trade._id ?? `${trade.symbol}-${trade.openedAt ?? trade.createdAt ?? index}`;
}

function tradeAction(trade: Trade): TradeAction {
    return trade.action ?? trade.side ?? 'BUY';
}

function tradeLots(trade: Trade): number {
    return trade.lotSize ?? trade.volume ?? 0;
}

function tradeId(trade: Trade): string | null {
    return trade._id ?? trade.id ?? null;
}

function tradeStatus(trade: Trade): 'OPEN' | 'CLOSED' {
    return trade.status ?? (trade.closedAt ? 'CLOSED' : 'OPEN');
}

export default function Dashboard() {
    const location = useLocation();

    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [priceDirections, setPriceDirections] = useState<Record<string, 'up' | 'down'>>({});

    const [placing, setPlacing] = useState(false);
    const [placeError, setPlaceError] = useState<string | null>(null);
    const [placeOk, setPlaceOk] = useState<string | null>(null);

    const [mt5BridgeKey, setMt5BridgeKey] = useState<string | null>(null);

    const [closingId, setClosingId] = useState<string | null>(null);
    const [closeStatus, setCloseStatus] = useState<Record<string, { ok?: string; err?: string }>>({});

    const [tradeForm, setTradeForm] = useState<{
        symbol: string;
        action: TradeAction;
        lotSize: number;
        stopLoss?: number;
        takeProfit?: number;
        execution: TradeExecutionMode;
    }>({
        symbol: 'EURUSD',
        action: 'BUY',
        lotSize: 0.1,
        stopLoss: undefined,
        takeProfit: undefined,
        execution: 'PAPER',
    });

    const [prefillApplied, setPrefillApplied] = useState(false);

    const loadData = async () => {
        setError(null);
        setLoading(true);

        const [portfolioRes, pricesRes, tradesRes, mt5Res] = await Promise.allSettled([
            fetchPortfolio(),
            fetchPrices(),
            fetchTrades(),
            fetchMt5Link(),
        ]);

        try {
            if (portfolioRes.status === 'fulfilled') {
                setPortfolio(portfolioRes.value);
                setTrades(portfolioRes.value.trades ?? (tradesRes.status === 'fulfilled' ? tradesRes.value : []));
            } else {
                // If /portfolio isn't implemented on the backend yet, still try /trades.
                if (tradesRes.status === 'fulfilled') {
                    setPortfolio({ balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, trades: [] });
                    setTrades(tradesRes.value);
                } else {
                    throw portfolioRes.reason;
                }
            }

            if (pricesRes.status === 'fulfilled') {
                const newPrices: Record<string, number> = pricesRes.value.prices ?? {};

                setPriceDirections((prev) => {
                    const directions: Record<string, 'up' | 'down'> = { ...prev };
                    for (const [symbol, price] of Object.entries(newPrices)) {
                        const prevPrice = livePrices[symbol];
                        if (prevPrice !== undefined) {
                            directions[symbol] = price > prevPrice ? 'up' : 'down';
                        }
                    }
                    return directions;
                });

                setLivePrices(newPrices);
            }

            if (mt5Res.status === 'fulfilled') {
                setMt5BridgeKey(mt5Res.value.mt5BridgeKey ?? null);
            }

            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err: any) {
            const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
            setError(apiMsg ?? err?.message ?? 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // If the user is not logged in, don't spam the API with 401s.
        if (!getToken()) {
            setLoading(false);
            return;
        }

        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Prefill trade form from /dashboard?symbol=...&action=...&stopLoss=...&takeProfit=...
    // (Used by the Signals page).
    useEffect(() => {
        if (prefillApplied) return;

        const sp = new URLSearchParams(location.search);
        const symbol = sp.get('symbol');
        const action = sp.get('action');
        const stopLoss = sp.get('stopLoss');
        const takeProfit = sp.get('takeProfit');

        const next: Partial<typeof tradeForm> = {};

        if (symbol) next.symbol = symbol;
        if (action === 'BUY' || action === 'SELL') next.action = action;

        const slNum = stopLoss ? Number(stopLoss) : NaN;
        const tpNum = takeProfit ? Number(takeProfit) : NaN;

        if (Number.isFinite(slNum)) next.stopLoss = slNum;
        if (Number.isFinite(tpNum)) next.takeProfit = tpNum;

        if (Object.keys(next).length > 0) {
            setTradeForm((p) => ({ ...p, ...next }));
        }

        setPrefillApplied(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, prefillApplied]);

    const closedTrades = useMemo(() => trades.filter((t) => tradeStatus(t) === 'CLOSED'), [trades]);
    const openTrades = useMemo(() => trades.filter((t) => tradeStatus(t) === 'OPEN'), [trades]);

    const balance = portfolio?.balance ?? INITIAL_BALANCE;

    const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter((t) => (t.pnl ?? 0) <= 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const pnlPercent = ((balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

    const totalUnrealized = openTrades.reduce((sum, trade) => {
        const price = livePrices[trade.symbol];
        const entry = trade.entryPrice;
        const lots = tradeLots(trade);
        const action = tradeAction(trade);

        if (!price || entry === undefined || !lots) return sum;

        const diff = action === 'BUY' ? price - entry : entry - price;
        return sum + diff * 10000 * 10 * lots;
    }, 0);

    const onPlaceTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setPlaceError(null);
        setPlaceOk(null);
        setPlacing(true);

        try {
            if (!tradeForm.symbol.trim()) throw new Error('Symbol is required');
            if (!tradeForm.lotSize || tradeForm.lotSize <= 0) throw new Error('Lot size must be > 0');

            if (tradeForm.execution === 'MT5' && !mt5BridgeKey) {
                throw new Error('MT5 is not linked. Go to Profile → MT5 demo bridge and link it first.');
            }

            const res: PlaceTradeResponse = await placeTrade({
                symbol: tradeForm.symbol.trim(),
                action: tradeForm.action,
                lotSize: tradeForm.lotSize,
                stopLoss: tradeForm.stopLoss,
                takeProfit: tradeForm.takeProfit,
                execution: tradeForm.execution,
                reason: 'Manual trade from dashboard',
            });

            if (res.mode === 'MT5') {
                setPlaceOk(`Queued to MT5 bridge (task ${res.taskId}). It will show in Open Positions after execution.`);
            } else {
                setPlaceOk('Trade placed (paper).');
            }

            await loadData();
        } catch (err: any) {
            const status = err?.response?.status;
            const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;

            if (status === 404) {
                setPlaceError('Backend endpoint missing: POST /api/trades (implement this on your API server)');
            } else {
                setPlaceError(apiMsg ?? err?.message ?? 'Failed to place trade');
            }
        } finally {
            setPlacing(false);
        }
    };

    const onCloseTrade = async (trade: Trade, closeAt: 'MARKET' | 'TP' | 'SL') => {
        const id = tradeId(trade);
        if (!id) return;

        setCloseStatus((p) => ({ ...p, [id]: {} }));
        setClosingId(id);

        try {
            const res = await closeTrade(id, { closeAt });
            if ('taskId' in (res as any)) {
                setCloseStatus((p) => ({ ...p, [id]: { ok: `Close queued to MT5 bridge (task ${(res as any).taskId})` } }));
            } else {
                setCloseStatus((p) => ({ ...p, [id]: { ok: `Closed (${closeAt})` } }));
            }
            await loadData();
        } catch (err: any) {
            const apiMsg = err?.response?.data?.error ?? err?.response?.data?.message;
            setCloseStatus((p) => ({
                ...p,
                [id]: { err: apiMsg ?? err?.message ?? 'Failed to close trade' },
            }));
        } finally {
            setClosingId(null);
        }
    };

    const token = getToken();

    if (!token) {
        return (
            <div className={styles.loading}>
                <div>
                    <div style={{ marginBottom: 10 }}>You are not logged in.</div>
                    <Link to="/login" style={{ color: '#00ff88', letterSpacing: 2, fontSize: 12, textDecoration: 'none' }}>
                        GO TO LOGIN
                    </Link>
                </div>
            </div>
        );
    }

    if (loading && !portfolio) return <div className={styles.loading}>LOADING...</div>;

    if (error) {
        return (
            <div className={styles.loading}>
                <div>
                    <div style={{ marginBottom: 10 }}>{error}</div>
                    <button className={styles.retryBtn} onClick={loadData} type="button">
                        RETRY
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.dot} />
                    <span className={styles.botLabel}>BOT ACTIVE</span>
                </div>
                <h1 className={styles.title}>Trading Dashboard</h1>
                <div className={styles.headerRight}>
                    <div className={styles.livePrices}>
                        {Object.entries(livePrices).map(([symbol, price]) => (
                            <span
                                key={symbol}
                                className={`${styles.livePriceItem} ${priceDirections[symbol] === 'up'
                                    ? styles.livePriceUp
                                    : priceDirections[symbol] === 'down'
                                        ? styles.livePriceDown
                                        : ''
                                    }`}
                            >
                                {symbol} {price.toFixed(symbol.includes('JPY') ? 3 : 5)}
                                {priceDirections[symbol] === 'up' ? ' ▲' : priceDirections[symbol] === 'down' ? ' ▼' : ''}
                            </span>
                        ))}
                    </div>
                    <span className={styles.updated}>Updated {lastUpdated}</span>
                </div>
            </header>

            <div className={styles.metrics}>
                <MetricCard
                    label="Balance"
                    value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    sub={`${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% from start`}
                    positive={pnlPercent >= 0}
                />
                <MetricCard
                    label="Total P&L"
                    value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
                    sub={`${closedTrades.length} closed trades`}
                    positive={totalPnl >= 0}
                />
                <MetricCard
                    label="Unrealized P&L"
                    value={`${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`}
                    sub={`${openTrades.length} open trades`}
                    positive={totalUnrealized >= 0}
                />
                <MetricCard
                    label="Win Rate"
                    value={`${winRate.toFixed(1)}%`}
                    sub={`${wins.length}W / ${losses.length}L`}
                    positive={winRate >= 60}
                />
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Place Trade</h2>
                <form className={styles.tradeForm} onSubmit={onPlaceTrade}>
                    <div className={styles.formGrid}>
                        <div>
                            <span className={styles.formLabel}>Symbol</span>
                            <input
                                className={styles.formInput}
                                value={tradeForm.symbol}
                                onChange={(e) => setTradeForm((p) => ({ ...p, symbol: e.target.value }))}
                                placeholder="EURUSD"
                            />
                        </div>
                        <div>
                            <span className={styles.formLabel}>Action</span>
                            <select
                                className={styles.formInput}
                                value={tradeForm.action}
                                onChange={(e) => setTradeForm((p) => ({ ...p, action: e.target.value as TradeAction }))}
                            >
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                        </div>
                        <div>
                            <span className={styles.formLabel}>Lot Size</span>
                            <input
                                className={styles.formInput}
                                type="number"
                                step="0.01"
                                min="0"
                                value={tradeForm.lotSize}
                                onChange={(e) => setTradeForm((p) => ({ ...p, lotSize: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <span className={styles.formLabel}>Stop Loss</span>
                            <input
                                className={styles.formInput}
                                type="number"
                                step="0.00001"
                                value={tradeForm.stopLoss ?? ''}
                                onChange={(e) =>
                                    setTradeForm((p) => ({ ...p, stopLoss: e.target.value === '' ? undefined : Number(e.target.value) }))
                                }
                                placeholder="Optional"
                            />
                        </div>
                        <div>
                            <span className={styles.formLabel}>Take Profit</span>
                            <input
                                className={styles.formInput}
                                type="number"
                                step="0.00001"
                                value={tradeForm.takeProfit ?? ''}
                                onChange={(e) =>
                                    setTradeForm((p) => ({
                                        ...p,
                                        takeProfit: e.target.value === '' ? undefined : Number(e.target.value),
                                    }))
                                }
                                placeholder="Optional"
                            />
                        </div>

                        <div>
                            <span className={styles.formLabel}>Execution</span>
                            <select
                                className={styles.formInput}
                                value={tradeForm.execution}
                                onChange={(e) => setTradeForm((p) => ({ ...p, execution: e.target.value as TradeExecutionMode }))}
                                title={tradeForm.execution === 'MT5' && !mt5BridgeKey ? 'MT5 not linked (go to Profile)' : ''}
                            >
                                <option value="PAPER">PAPER</option>
                                <option value="MT5">MT5 (DEMO)</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button className={styles.formButton} type="submit" disabled={placing}>
                            {placing ? 'PLACING…' : 'PLACE TRADE'}
                        </button>
                        <button className={styles.formSecondary} type="button" onClick={loadData} disabled={placing}>
                            REFRESH
                        </button>
                    </div>

                    {placeOk && <div className={styles.closeMsgOk}>{placeOk}</div>}
                    {placeError && <div className={styles.formError}>{placeError}</div>}
                </form>
            </section>

            {openTrades.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Open Positions</h2>
                    <div className={styles.tradeList}>
                        {openTrades.map((trade, idx) => {
                            const id = tradeId(trade);
                            return (
                                <OpenCard
                                    key={tradeKey(trade, idx)}
                                    trade={trade}
                                    livePrice={livePrices[trade.symbol] ?? null}
                                    closing={!!id && closingId === id}
                                    closeMsg={id ? closeStatus[id] ?? null : { err: 'Trade is missing an id (_id)' }}
                                    onClose={(closeAt) => onCloseTrade(trade, closeAt)}
                                />
                            );
                        })}
                    </div>
                </section>
            )}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Trade History</h2>
                {closedTrades.length === 0 ? (
                    <p className={styles.empty}>No closed trades yet.</p>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Action</th>
                                    <th>Entry</th>
                                    <th>Close</th>
                                    <th>Lots</th>
                                    <th>P&L</th>
                                    <th>Result</th>
                                    <th>Opened</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closedTrades
                                    .slice()
                                    .reverse()
                                    .map((trade, idx) => {
                                        const action = tradeAction(trade);
                                        const lots = tradeLots(trade);
                                        return (
                                            <tr key={tradeKey(trade, idx)}>
                                                <td className={styles.symbol}>{trade.symbol}</td>
                                                <td>
                                                    <span className={action === 'BUY' ? styles.buy : styles.sell}>{action}</span>
                                                </td>
                                                <td>{trade.entryPrice !== undefined ? trade.entryPrice.toFixed(5) : '—'}</td>
                                                <td>{trade.closePrice !== undefined ? trade.closePrice.toFixed(5) : '—'}</td>
                                                <td>{lots || '—'}</td>
                                                <td className={(trade.pnl ?? 0) >= 0 ? styles.profit : styles.loss}>
                                                    {(trade.pnl ?? 0) >= 0 ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}
                                                </td>
                                                <td>
                                                    <span className={(trade.pnl ?? 0) >= 0 ? styles.winBadge : styles.lossBadge}>
                                                        {(trade.pnl ?? 0) >= 0 ? 'WIN' : 'LOSS'}
                                                    </span>
                                                </td>
                                                <td className={styles.time}>
                                                    {trade.openedAt || trade.createdAt ? new Date(trade.openedAt ?? trade.createdAt!).toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>P&L Chart</h2>
                <PnLChart trades={closedTrades} initialBalance={INITIAL_BALANCE} />
            </section>
        </div>
    );
}

function MetricCard({
    label,
    value,
    sub,
    positive,
    neutral,
}: {
    label: string;
    value: string;
    sub: string;
    positive: boolean;
    neutral?: boolean;
}) {
    return (
        <div className={styles.metricCard}>
            <span className={styles.metricLabel}>{label}</span>
            <span
                className={`${styles.metricValue} ${neutral ? styles.metricNeutral : positive ? styles.metricPos : styles.metricNeg
                    }`}
            >
                {value}
            </span>
            <span className={styles.metricSub}>{sub}</span>
        </div>
    );
}

function OpenCard({
    trade,
    livePrice,
    onClose,
    closing,
    closeMsg,
}: {
    trade: Trade;
    livePrice: number | null;
    onClose: (closeAt: 'MARKET' | 'TP' | 'SL') => void;
    closing: boolean;
    closeMsg: { ok?: string; err?: string } | null;
}) {
    const isJpy = trade.symbol.includes('JPY');
    const multiplier = isJpy ? 100 : 10000;

    const action = tradeAction(trade);
    const lots = tradeLots(trade);
    const entry = trade.entryPrice;

    const unrealizedPnl = livePrice && entry !== undefined && lots
        ? action === 'BUY'
            ? (livePrice - entry) * multiplier * 10 * lots
            : (entry - livePrice) * multiplier * 10 * lots
        : null;

    const decimals = isJpy ? 3 : 5;

    const canCloseAtTp = trade.takeProfit !== undefined && trade.takeProfit !== null;
    const canCloseAtSl = trade.stopLoss !== undefined && trade.stopLoss !== null;

    return (
        <div className={styles.openCard}>
            <div className={styles.openTop}>
                <span className={styles.symbol}>{trade.symbol}</span>
                <span className={action === 'BUY' ? styles.buy : styles.sell}>{action}</span>
                <span className={styles.openBadge}>OPEN</span>
                {unrealizedPnl !== null && (
                    <span className={`${styles.unrealizedPnl} ${unrealizedPnl >= 0 ? styles.profit : styles.loss}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                    </span>
                )}
            </div>
            <div className={styles.openGrid}>
                <div>
                    <span className={styles.openLabel}>Entry</span>
                    <span className={styles.openVal}>{entry !== undefined ? entry.toFixed(decimals) : '—'}</span>
                </div>
                <div>
                    <span className={styles.openLabel}>Live Price</span>
                    <span className={styles.openVal}>{livePrice !== null ? livePrice.toFixed(decimals) : '—'}</span>
                </div>
                <div>
                    <span className={styles.openLabel}>Stop Loss</span>
                    <span className={styles.openVal}>
                        {trade.stopLoss !== undefined ? trade.stopLoss.toFixed(decimals) : '—'}
                    </span>
                </div>
                <div>
                    <span className={styles.openLabel}>Take Profit</span>
                    <span className={styles.openVal}>
                        {trade.takeProfit !== undefined ? trade.takeProfit.toFixed(decimals) : '—'}
                    </span>
                </div>
            </div>
            {trade.reason && <p className={styles.openReason}>{trade.reason}</p>}

            <div className={styles.closeActions}>
                <button
                    className={`${styles.closeBtn} ${styles.closeBtnPrimary}`}
                    type="button"
                    onClick={() => onClose('MARKET')}
                    disabled={closing}
                >
                    {closing ? 'CLOSING…' : 'CLOSE (MARKET)'}
                </button>

                <button
                    className={`${styles.closeBtn} ${styles.closeBtnOk}`}
                    type="button"
                    onClick={() => onClose('TP')}
                    disabled={!canCloseAtTp || closing}
                    title={!canCloseAtTp ? 'No take profit set' : ''}
                >
                    CLOSE @ TP
                </button>

                <button
                    className={styles.closeBtn}
                    type="button"
                    onClick={() => onClose('SL')}
                    disabled={!canCloseAtSl || closing}
                    title={!canCloseAtSl ? 'No stop loss set' : ''}
                >
                    CLOSE @ SL
                </button>
            </div>

            {closeMsg?.ok && <div className={styles.closeMsgOk}>{closeMsg.ok}</div>}
            {closeMsg?.err && <div className={styles.closeMsgErr}>{closeMsg.err}</div>}
        </div>
    );
}

function PnLChart({ trades, initialBalance }: { trades: Trade[]; initialBalance: number }) {
    const points = trades
        .filter((t) => !!t.closedAt)
        .reduce(
            (acc, trade) => {
                const last = acc[acc.length - 1];
                acc.push({
                    time: new Date(trade.closedAt!).toLocaleDateString(),
                    balance: last.balance + (trade.pnl ?? 0),
                });
                return acc;
            },
            [{ time: 'Start', balance: initialBalance }],
        );

    const max = Math.max(...points.map((p) => p.balance));
    const min = Math.min(...points.map((p) => p.balance));
    const range = max - min || 1;
    const w = 800;
    const h = 200;
    const pad = 40;

    const toX = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
    const toY = (val: number) => h - pad - ((val - min) / range) * (h - pad * 2);

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.balance)}`).join(' ');

    const areaD = `${pathD} L ${toX(points.length - 1)} ${h - pad} L ${toX(0)} ${h - pad} Z`;
    const isProfit = points[points.length - 1].balance >= initialBalance;
    const color = isProfit ? '#00ff88' : '#ff4466';

    return (
        <div className={styles.chartWrap}>
            {trades.length === 0 ? (
                <p className={styles.empty}>No closed trades to chart yet.</p>
            ) : (
                <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaD} fill="url(#areaGrad)" />
                    <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
                    {points.map((p, i) => (
                        <circle key={i} cx={toX(i)} cy={toY(p.balance)} r="3" fill={color} />
                    ))}
                    {points.map((p, i) => (
                        <text key={i} x={toX(i)} y={h - 8} textAnchor="middle" fontSize="9" fill="#333">
                            {p.time}
                        </text>
                    ))}
                    <text x={pad - 4} y={toY(max) + 4} textAnchor="end" fontSize="9" fill="#333">
                        ${max.toFixed(0)}
                    </text>
                    <text x={pad - 4} y={toY(min) + 4} textAnchor="end" fontSize="9" fill="#333">
                        ${min.toFixed(0)}
                    </text>
                </svg>
            )}
        </div>
    );
}