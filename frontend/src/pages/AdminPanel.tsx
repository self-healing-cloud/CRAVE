import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { adminApi, failureSimulatorApi } from '../services/api';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────────
interface RegistryEntry {
    user_id: number;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    is_verified: boolean;
    last_login: string | null;
    session_status: 'active' | 'inactive';
    restaurant_id: number | null;
    restaurant_name: string | null;
    active_delivery_id: number | null;
    active_order_id: number | null;
    account_created: string | null;
}

const ROLE_INFO: Record<string, { label: string; color: string; emoji: string }> = {
    admin:            { label: 'Admin',            color: '#a78bfa', emoji: '⚙️' },
    restaurant_owner: { label: 'Restaurant Owner', color: '#fb923c', emoji: '🍽️' },
    driver:           { label: 'Driver',           color: '#60a5fa', emoji: '🛵' },
    customer:         { label: 'Customer',         color: '#22c55e', emoji: '🛒' },
};

// ── Stat Pill ──────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '16px 20px', border: `1px solid ${color}22`, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '2.2rem', color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</p>
        </div>
    );
}

// ── Registry Row ───────────────────────────────────────────────────────────
function RegistryRow({ entry, onDeactivate, onActivate }: {
    entry: RegistryEntry;
    onDeactivate: (id: number) => void;
    onActivate: (id: number) => void;
}) {
    const roleInfo = ROLE_INFO[entry.role] ?? { label: entry.role, color: '#9ca3af', emoji: '👤' };
    const isActive = entry.session_status === 'active';
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        setLoading(true);
        try {
            if (entry.is_active) {
                await adminApi.deactivateUser(entry.user_id);
                onDeactivate(entry.user_id);
                toast.success(`${entry.full_name} deactivated`);
            } else {
                await adminApi.activateUser(entry.user_id);
                onActivate(entry.user_id);
                toast.success(`${entry.full_name} activated`);
            }
        } catch {
            // handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.tr
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
            {/* User */}
            <td style={{ padding: '14px 16px', minWidth: 200 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cream)' }}>{entry.full_name}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{entry.email}</p>
            </td>

            {/* Role */}
            <td style={{ padding: '14px 16px' }}>
                <span style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: 1, textTransform: 'uppercase',
                    color: roleInfo.color, background: `${roleInfo.color}18`,
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${roleInfo.color}44`, whiteSpace: 'nowrap',
                }}>
                    {roleInfo.emoji} {roleInfo.label}
                </span>
            </td>

            {/* Session */}
            <td style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isActive ? '#22c55e' : '#6b7280',
                        boxShadow: isActive ? '0 0 6px #22c55e' : 'none',
                        display: 'inline-block',
                        animation: isActive ? 'pulse2 2s infinite' : 'none',
                    }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: isActive ? '#22c55e' : 'var(--text-muted)' }}>
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </td>

            {/* Last Login */}
            <td style={{ padding: '14px 16px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {entry.last_login
                        ? new Date(entry.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                </p>
            </td>

            {/* Association */}
            <td style={{ padding: '14px 16px' }}>
                {entry.restaurant_name && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#fb923c' }}>
                        🍽️ {entry.restaurant_name}
                    </span>
                )}
                {entry.active_order_id && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#60a5fa' }}>
                        🛵 Order #{entry.active_order_id}
                    </span>
                )}
                {!entry.restaurant_name && !entry.active_order_id && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                )}
            </td>

            {/* Account Status */}
            <td style={{ padding: '14px 16px' }}>
                <button
                    onClick={handleToggle}
                    disabled={loading}
                    style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'none',
                        background: entry.is_active ? 'rgba(248,113,113,0.1)' : 'rgba(34,197,94,0.1)',
                        color: entry.is_active ? '#f87171' : '#22c55e',
                        border: `1px solid ${entry.is_active ? 'rgba(248,113,113,0.25)' : 'rgba(34,197,94,0.25)'}`,
                        fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: 1,
                        opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
                    }}
                >
                    {entry.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </td>
        </motion.tr>
    );
}

// ── Simulator Panel ────────────────────────────────────────────────────────
export function SimulatorPanel() {
    const [simEnabled, setSimEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState<{ total_requests: number; failed_requests: number; success_rate: number; active_scenarios: number } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [statusRes, metricsRes] = await Promise.all([
                    failureSimulatorApi.getStatus(),
                    failureSimulatorApi.getMetrics(),
                ]);
                setSimEnabled(statusRes.data?.enabled ?? false);
                setMetrics(metricsRes.data);
            } catch {
                // backend not running
            }
        })();
    }, []);

    const toggleSim = async (val: boolean) => {
        setLoading(true);
        try {
            await failureSimulatorApi.toggle(val);
            setSimEnabled(val);
            toast.success(`Failure Simulator ${val ? 'enabled' : 'disabled'}`);
        } catch {
            // handled
        } finally {
            setLoading(false);
        }
    };

    const resetAll = async () => {
        try {
            await failureSimulatorApi.resetAll();
            toast.success('All scenarios reset');
        } catch {
            // handled
        }
    };

    return (
        <div className="glass" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', border: '1px solid rgba(167,139,250,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#a78bfa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Failure Simulator</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Control API failure injection globally</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => toggleSim(!simEnabled)}
                        disabled={loading}
                        style={{
                            width: 52, height: 28, borderRadius: 14, cursor: 'none',
                            background: simEnabled ? '#a78bfa' : 'var(--bg-elevated)',
                            border: simEnabled ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            position: 'relative', transition: 'background 0.25s', flexShrink: 0,
                            boxShadow: simEnabled ? '0 0 12px rgba(167,139,250,0.5)' : 'none',
                        }}
                    >
                        <motion.span
                            animate={{ x: simEnabled ? 24 : 4 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            style={{ position: 'absolute', top: 4, width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }}
                        />
                    </button>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: simEnabled ? '#a78bfa' : 'var(--text-muted)' }}>
                        {simEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>

            {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                        { label: 'Total Requests', val: metrics.total_requests },
                        { label: 'Failed', val: metrics.failed_requests },
                        { label: 'Success Rate', val: `${(metrics.success_rate * 100).toFixed(1)}%` },
                        { label: 'Active Scenarios', val: metrics.active_scenarios },
                    ].map(({ label, val }) => (
                        <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center' }}>
                            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.2rem', color: 'var(--accent-cream)' }}>{val}</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: 1 }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            <button onClick={resetAll} style={{ padding: '8px 20px', background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', letterSpacing: 1, cursor: 'none' }}>
                Reset All Scenarios
            </button>
        </div>
    );
}

// ── Main Admin Panel ───────────────────────────────────────────────────────
export default function AdminPanel() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [registry, setRegistry] = useState<RegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [sessionFilter, setSessionFilter] = useState('');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'registry'>('registry');
    const [exporting, setExporting] = useState(false);

    // Auth guard
    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (user.role !== 'admin') { toast.error('Admin access required'); navigate('/'); }
    }, [user, navigate]);

    const fetchRegistry = useCallback(async () => {
        try {
            const params: Record<string, string> = {};
            if (roleFilter) params.role = roleFilter;
            if (sessionFilter) params.session_status = sessionFilter;
            const res = await adminApi.getSessionRegistry(params);
            setRegistry(res.data);
            setError('');
        } catch {
            setError('Failed to load session registry.');
        } finally {
            setLoading(false);
        }
    }, [roleFilter, sessionFilter]);

    useEffect(() => {
        fetchRegistry();
        const interval = setInterval(fetchRegistry, 30000);
        return () => clearInterval(interval);
    }, [fetchRegistry]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await adminApi.exportRegistry();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `session_registry_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Registry exported as CSV');
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleDeactivate = (userId: number) => {
        setRegistry(prev => prev.map(r => r.user_id === userId ? { ...r, is_active: false } : r));
    };

    const handleActivate = (userId: number) => {
        setRegistry(prev => prev.map(r => r.user_id === userId ? { ...r, is_active: true } : r));
    };

    const filtered = registry.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.email.toLowerCase().includes(q) ||
            r.full_name.toLowerCase().includes(q) ||
            (r.restaurant_name?.toLowerCase().includes(q) ?? false);
    });

    const activeSessions = registry.filter(r => r.session_status === 'active').length;
    const restaurantOwners = registry.filter(r => r.role === 'restaurant_owner').length;
    const drivers = registry.filter(r => r.role === 'driver').length;
    const customers = registry.filter(r => r.role === 'customer').length;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 80, paddingBottom: 60 }}>
            <div style={{ position: 'fixed', top: -300, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', filter: 'blur(200px)', opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />

            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 var(--space-lg)', position: 'relative', zIndex: 1 }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
                    <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#a78bfa', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Admin Panel</p>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3rem)', lineHeight: 1 }}>
                            Control Center
                        </h1>
                        <p style={{ fontFamily: 'var(--font-sub)', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 6 }}>
                            Live session registry • Auto-refreshes every 30s
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExport}
                        disabled={exporting}
                        style={{
                            padding: '12px 24px', background: 'rgba(167,139,250,0.12)',
                            color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)',
                            borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)',
                            fontSize: '0.75rem', letterSpacing: 1, cursor: 'none',
                            opacity: exporting ? 0.6 : 1,
                        }}
                    >
                        {exporting ? 'Exporting...' : '↓ Export CSV'}
                    </motion.button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    <StatPill label="Active Sessions" value={activeSessions} color="#22c55e" />
                    <StatPill label="Total Users" value={registry.length} color="#a78bfa" />
                    <StatPill label="Restaurants" value={restaurantOwners} color="#fb923c" />
                    <StatPill label="Drivers" value={drivers} color="#60a5fa" />
                    <StatPill label="Customers" value={customers} color="#22c55e" />
                </div>

                {/* Tabs — registry only for admin */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)' }}>
                    <button
                        onClick={() => setTab('registry')}
                        style={{
                            padding: '10px 28px', borderRadius: 'var(--radius-sm)', cursor: 'none',
                            background: '#a78bfa',
                            color: '#fff',
                            fontFamily: 'var(--font-body)', fontSize: '0.72rem', letterSpacing: 2, textTransform: 'uppercase',
                            border: 'none',
                            boxShadow: '0 0 20px rgba(167,139,250,0.3)',
                            transition: 'all 0.25s',
                        }}
                    >
                        👥 Session Registry
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {tab === 'registry' && (
                        <motion.div key="registry" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            {/* Filters */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name or email..."
                                    style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-cream)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', outline: 'none' }}
                                />
                                <select
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                    style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', outline: 'none', cursor: 'none' }}
                                >
                                    <option value="">All Roles</option>
                                    <option value="customer">Customer</option>
                                    <option value="restaurant_owner">Restaurant Owner</option>
                                    <option value="driver">Driver</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <select
                                    value={sessionFilter}
                                    onChange={e => setSessionFilter(e.target.value)}
                                    style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', outline: 'none', cursor: 'none' }}
                                >
                                    <option value="">All Sessions</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                </select>
                                <button onClick={fetchRegistry} style={{ padding: '10px 18px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', cursor: 'none' }}>
                                    ↻ Refresh
                                </button>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        style={{ width: 40, height: 40, border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', margin: '0 auto' }}
                                    />
                                </div>
                            ) : error ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</p>
                                    <p>{error}</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: 8 }}>Make sure the backend is running.</p>
                                </div>
                            ) : (
                                <div className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {['User', 'Role', 'Session', 'Last Login', 'Association', 'Actions'].map(h => (
                                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <AnimatePresence>
                                                    {filtered.map(entry => (
                                                        <RegistryRow
                                                            key={entry.user_id}
                                                            entry={entry}
                                                            onDeactivate={handleDeactivate}
                                                            onActivate={handleActivate}
                                                        />
                                                    ))}
                                                </AnimatePresence>
                                            </tbody>
                                        </table>
                                    </div>
                                    {filtered.length === 0 && (
                                        <div style={{ padding: 'var(--space-lg)', textAlign: 'center', fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            No users match the current filters.
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.5} }
            `}</style>
        </div>
    );
}
