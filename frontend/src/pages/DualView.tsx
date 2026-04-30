import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BrowsePage from './BrowsePage';
import MetricsPanel from '../components/failure-simulator/MetricsPanel';
import { FailureSimulatorMetrics } from '../types';

// ─── Demo credentials for each panel role ─────────────────────────────────────
type PanelType = 'customer' | 'driver' | 'restaurant' | 'admin' | 'dev';

const PANELS: Record<PanelType, {
  icon: string; label: string; color: string;
  email: string; password: string;
}> = {
  customer:   { icon: '🛒', label: 'Customer',   color: '#58a6ff', email: 'customer@example.com',   password: 'password123'  },
  driver:     { icon: '🛵', label: 'Driver',      color: '#22c55e', email: 'driver@example.com',     password: 'password123'  },
  restaurant: { icon: '🍽️', label: 'Restaurant', color: '#f0883e', email: 'restaurant@example.com', password: 'password123'  },
  admin:      { icon: '⚙️', label: 'Admin',       color: '#a78bfa', email: 'admin@example.com',      password: 'admin123'     },
  dev:        { icon: '🛠️', label: 'Dev',         color: '#ffc845', email: 'developer@example.com',  password: 'developer123' },
};

// ─── Fetch helper that uses a specific token (not the global session) ─────────
async function panelFetch<T>(token: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function panelPost<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function panelPatch<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Hook: auto-login with demo credentials, returns panel-specific token ─────
function usePanelAuth(email: string, password: string) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ first_name: string; last_name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setToken(null);
    setUser(null);
    setError('');
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(r => r.json())
      .then((data: { access_token?: string; user?: { first_name: string; last_name: string; role: string } }) => {
        if (data.access_token) {
          setToken(data.access_token);
          setUser(data.user ?? null);
        } else {
          setError(`Login failed for ${email}`);
        }
      })
      .catch(() => setError(`Network error — could not log in as ${email}`))
      .finally(() => setLoading(false));
  }, [email, password]);

  return { token, user, loading, error };
}

// ─── Panel selector row ───────────────────────────────────────────────────────
function PanelSelector({ active, onChange }: { active: PanelType; onChange: (t: PanelType) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '8px 12px', flexShrink: 0,
      background: '#161b22', borderBottom: '1px solid #30363d', overflowX: 'auto',
    }}>
      {(Object.entries(PANELS) as [PanelType, typeof PANELS[PanelType]][]).map(([type, cfg]) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          style={{
            padding: '4px 12px', borderRadius: 8, cursor: 'none', whiteSpace: 'nowrap',
            background: active === type ? `${cfg.color}18` : 'transparent',
            border: `1px solid ${active === type ? `${cfg.color}55` : 'transparent'}`,
            color: active === type ? cfg.color : '#8b949e',
            fontFamily: 'var(--font-body)', fontSize: '0.62rem', letterSpacing: 1,
            transition: 'all 0.2s',
          }}
        >
          {cfg.icon} {cfg.label}
        </button>
      ))}
    </div>
  );
}

// ─── Logged-in session banner ─────────────────────────────────────────────────
function SessionBanner({ user, type }: { user: { first_name: string; last_name: string; role: string } | null; type: PanelType }) {
  const cfg = PANELS[type];
  return (
    <div style={{
      padding: '5px 16px', flexShrink: 0,
      background: `${cfg.color}0d`,
      borderBottom: `1px solid ${cfg.color}33`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: '0.9rem' }}>{cfg.icon}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', color: cfg.color, letterSpacing: 1 }}>
        {user ? `${user.first_name} ${user.last_name}` : cfg.label}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#6e7681' }}>
        · {cfg.email}
      </span>
      <span style={{
        marginLeft: 'auto', fontSize: '0.55rem', letterSpacing: 2,
        background: `${cfg.color}18`, color: cfg.color,
        padding: '2px 8px', borderRadius: 20,
        fontFamily: 'var(--font-body)',
      }}>
        DEMO SESSION
      </span>
    </div>
  );
}

// ─── Loading / Error state ────────────────────────────────────────────────────
function PanelAuthState({ type, error }: { type: PanelType; error: string }) {
  const cfg = PANELS[type];
  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#f85149' }}>
        ⚠️ {error}
      </div>
    );
  }
  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#8b949e' }}>
      <div style={{ marginBottom: 6 }}>🔐 Logging in as {cfg.label}...</div>
      <div style={{ fontSize: '0.62rem', color: '#6e7681' }}>{cfg.email}</div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );
}

// ─── CUSTOMER PANEL ───────────────────────────────────────────────────────────
export function CustomerPanel() {
  const navigate = useNavigate();
  return <BrowsePage onSelect={(id) => navigate(`/menu/${id}`)} />;
}

// ─── DRIVER PANEL ─────────────────────────────────────────────────────────────
function DriverPanel({ token }: { token: string }) {
  const [available, setAvailable] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [avail, mine] = await Promise.all([
        panelFetch<any[]>(token, '/delivery/available'),
        panelFetch<any[]>(token, '/delivery/my-deliveries'),
      ]);
      setAvailable(avail ?? []);
      setMyDeliveries(mine ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(t);
  }, [token]);

  const acceptDelivery = async (id: number) => {
    setAccepting(id);
    try {
      await panelPost(token, `/delivery/${id}/accept`);
      await load();
    } catch { /* ignore */ }
    finally { setAccepting(null); }
  };

  if (loading) return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Available', value: available.length, color: '#ffc845' },
          { label: 'My Active', value: myDeliveries.filter((d: any) => !['delivered', 'cancelled'].includes(d.status)).length, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.8rem', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#22c55e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        📦 Available Orders
      </p>

      {available.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>🛵</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>No available deliveries right now.</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', color: '#6e7681', marginTop: 4 }}>Place an order as customer → it will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {available.map((d: any) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-accent)', fontSize: '0.9rem', letterSpacing: 2 }}>#{d.order?.order_number ?? d.order_id}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--accent-ember)', marginTop: 2 }}>🍽️ {d.order?.restaurant?.name ?? 'Restaurant'}</p>
                </div>
                <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.2rem', color: '#22c55e' }}>₹{Math.round((d.estimated_distance_km ?? 3) * 12 + 40)}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {[
                  { icon: '📍', val: `${d.estimated_distance_km ?? '~3'} km` },
                  { icon: '⏱️', val: `${d.estimated_duration_min ?? 20} min` },
                  { icon: '💰', val: `₹${d.order?.total?.toLocaleString('en-IN') ?? '—'}` },
                ].map(s => (
                  <span key={s.icon} style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 20 }}>
                    {s.icon} {s.val}
                  </span>
                ))}
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                disabled={accepting === d.id}
                onClick={() => acceptDelivery(d.id)}
                style={{ width: '100%', padding: '8px 0', background: accepting === d.id ? '#333' : 'var(--accent-fire)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'none', fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: 2, textTransform: 'uppercase' }}
              >
                {accepting === d.id ? '⏳ Accepting…' : '✓ Accept Delivery'}
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}
      <p style={{ marginTop: 14, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#6e7681', letterSpacing: 1 }}>
        🔄 Auto-refreshes every 4 seconds
      </p>
    </div>
  );
}

// ─── RESTAURANT PANEL ────────────────────────────────────────────────────────
function RestaurantPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const NEXT_STATUS: Record<string, string | null> = {
    pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: null,
  };
  const STATUS_COLOR: Record<string, string> = {
    pending: '#ffc845', confirmed: '#60a5fa', preparing: '#fb923c', ready: '#22c55e',
    picked_up: '#a78bfa', in_transit: '#22d3ee', delivered: '#22c55e', cancelled: '#f85149',
  };

  const load = async () => {
    try {
      const [o, r] = await Promise.all([
        panelFetch<any[]>(token, '/orders/restaurant-orders'),
        panelFetch<any>(token, '/restaurants/my-restaurant'),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setRestaurant(r);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [token]);

  const updateStatus = async (orderId: number, status: string) => {
    setUpdating(orderId);
    try {
      await panelPatch(token, `/orders/${orderId}/status`, { status });
      await load();
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  };

  if (loading) return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
    </div>
  );

  const activeOrders = orders.filter((o: any) => !['delivered', 'cancelled'].includes(o.status));
  const pending = orders.filter((o: any) => o.status === 'pending').length;

  return (
    <div style={{ padding: '16px' }}>
      {/* Restaurant name */}
      {restaurant && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid rgba(240,136,62,0.2)' }}>
          <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.1rem', color: '#f0883e', letterSpacing: 1 }}>{restaurant.name}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', color: '#8b949e', marginTop: 3 }}>{restaurant.cuisine_type} · {restaurant.city}</p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Active Orders', value: activeOrders.length, color: '#f0883e' },
          { label: 'Pending', value: pending, color: '#ffc845' },
          { label: 'Total Today', value: orders.length, color: '#8b949e' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.6rem', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#f0883e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        📋 Active Orders
      </p>

      {activeOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: '1.8rem', marginBottom: 6 }}>🍽️</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>No active orders right now.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeOrders.slice(0, 10).map((o: any) => {
            const nextStatus = NEXT_STATUS[o.status];
            const statusColor = STATUS_COLOR[o.status] ?? '#e6edf3';
            return (
              <div key={o.id} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-accent)', fontSize: '0.85rem', letterSpacing: 1 }}>#{o.order_number}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', background: `${statusColor}18`, color: statusColor, padding: '2px 8px', borderRadius: 10 }}>
                    {o.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', color: '#8b949e', marginBottom: 6 }}>
                  {o.items?.length ?? 0} item(s) · ₹{o.total?.toLocaleString('en-IN') ?? '—'}
                </p>
                {nextStatus && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    disabled={updating === o.id}
                    onClick={() => updateStatus(o.id, nextStatus)}
                    style={{ width: '100%', padding: '6px 0', background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 6, cursor: 'none', fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: 2, textTransform: 'uppercase' }}
                  >
                    {updating === o.id ? '⏳...' : `→ Mark ${nextStatus}`}
                  </motion.button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: 12, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#6e7681', letterSpacing: 1 }}>
        🔄 Auto-refreshes every 5 seconds
      </p>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminViewPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ROLE_COLOR: Record<string, string> = {
    customer: '#58a6ff', restaurant_owner: '#f0883e', driver: '#22c55e',
    admin: '#f85149', developer: '#ffc845',
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [u, s] = await Promise.all([
          panelFetch<any[]>(token, '/admin/users', { limit: '40' }),
          panelFetch<any[]>(token, '/admin/session-registry'),
        ]);
        setUsers(Array.isArray(u) ? u : []);
        setSessions(Array.isArray(s) ? s : []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    void load();
  }, [token]);

  if (loading) return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
    </div>
  );

  const roleCounts = users.reduce<Record<string, number>>((acc, u: any) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '16px' }}>
      {/* Role breakdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {Object.entries(roleCounts).map(([role, count]) => (
          <div key={role} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 14px', border: `1px solid ${ROLE_COLOR[role] ?? '#e6edf3'}22` }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{role.replace('_', ' ')}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.6rem', color: ROLE_COLOR[role] ?? '#e6edf3' }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Session summary */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.2)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#a78bfa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>🔌 Active Sessions</p>
          <p style={{ fontFamily: 'var(--font-accent)', fontSize: '2rem', color: '#a78bfa' }}>{sessions.length}</p>
        </div>
      )}

      {/* User list */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#a78bfa', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        👥 Users ({users.length})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {users.slice(0, 20).map((u: any) => {
          const roleColor = ROLE_COLOR[u.role] ?? '#e6edf3';
          return (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${roleColor}18`, border: `1px solid ${roleColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: roleColor, flexShrink: 0 }}>
                {u.first_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.first_name} {u.last_name}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#6e7681', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.email}
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', background: `${roleColor}18`, color: roleColor, padding: '2px 8px', borderRadius: 10, letterSpacing: 1, flexShrink: 0 }}>
                {u.role?.replace('_', ' ')}
              </span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.is_active ? '#22c55e' : '#484f58', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared log-row colors (reused across dev tabs) ──────────────────────────
const DEV_SERVICE_COLORS: Record<string, string> = {
  'crave-payments': '#a78bfa', 'crave-orders': '#58a6ff', 'crave-auth': '#22d3ee',
  'crave-restaurant': '#f0883e', 'crave-delivery': '#22c55e', 'crave-simulator': '#ffc845',
  'crave-chaos': '#f85149', 'crave-gateway': '#8b949e',
};
const devFmtTime = (ts: string | null) =>
  ts ? new Date(ts).toTimeString().slice(0, 8) : '--:--:--';

// ─── Compact log table used by Logs tab and Analysis tab ─────────────────────
function DevLogTable({ logs, maxHeight = '60vh' }: { logs: any[]; maxHeight?: string }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '65px 110px 1fr 55px 80px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {['Time', 'Service', 'Endpoint', 'Status', 'Failure'].map(h => (
          <span key={h} style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', color: '#8b949e', letterSpacing: 2, textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#8b949e', fontFamily: 'var(--font-body)', fontSize: '0.72rem' }}>
            📡 Waiting for traffic...
          </div>
        ) : (
          logs.slice(0, 150).map((log: any, i: number) => {
            const hasFailure = log.failure_type && log.failure_type !== 'none';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '65px 110px 1fr 55px 80px',
                padding: '5px 10px', fontSize: '0.6rem', alignItems: 'center',
                background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                borderLeft: hasFailure ? '2px solid rgba(248,81,73,0.4)' : '2px solid transparent',
              }}>
                <span style={{ color: '#8b949e', fontVariantNumeric: 'tabular-nums' }}>{devFmtTime(log.timestamp)}</span>
                <span style={{ color: DEV_SERVICE_COLORS[log.service_name] ?? '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.58rem' }}>{log.service_name || '—'}</span>
                <span style={{ color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4, fontSize: '0.58rem' }} title={log.endpoint}>
                  {log.endpoint?.length > 34 ? `${log.endpoint.slice(0, 34)}…` : (log.endpoint || '—')}
                </span>
                <span style={{ color: (log.status_code ?? 0) < 400 ? '#22c55e' : '#f85149', fontVariantNumeric: 'tabular-nums' }}>{log.status_code ?? '?'}</span>
                <span>
                  {hasFailure
                    ? <span style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149', padding: '1px 6px', borderRadius: 4, fontSize: '0.55rem' }}>{log.failure_type}</span>
                    : <span style={{ color: '#484f58' }}>—</span>}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── DEV TAB: Logs ────────────────────────────────────────────────────────────
function DevLogsTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failuresOnly, setFailuresOnly] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await panelFetch<any[]>(token, '/observation/logs', { limit: '200' });
        setLogs(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    void load();
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [token]);

  const filtered = failuresOnly
    ? logs.filter((l: any) => l.failure_type && l.failure_type !== 'none')
    : logs;

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 32, borderRadius: 6 }} />)}
    </div>
  );

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setFailuresOnly(p => !p)}
          style={{ padding: '4px 12px', borderRadius: 6, cursor: 'none', fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: 1, background: failuresOnly ? 'rgba(248,81,73,0.12)' : 'rgba(255,255,255,0.05)', color: failuresOnly ? '#f85149' : '#8b949e', border: `1px solid ${failuresOnly ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.08)'}` }}
        >
          {failuresOnly ? '🔥 Failures only' : 'All logs'}
        </button>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#6e7681', marginLeft: 'auto' }}>
          {filtered.length} entries · auto-refresh 5s
        </span>
      </div>
      <DevLogTable logs={filtered} />
    </div>
  );
}

// ─── DEV TAB: Failure Simulator ───────────────────────────────────────────────
function DevFailureSimTab({ token }: { token: string }) {
  const [metrics, setMetrics]     = useState<FailureSimulatorMetrics | null>(null);
  const [scenarios, setScenarios] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, s] = await Promise.all([
          panelFetch<FailureSimulatorMetrics>(token, '/failure-simulator/metrics'),
          panelFetch<Record<string, any>>(token, '/failure-simulator/scenarios'),
        ]);
        setMetrics(m);
        setScenarios(s ?? {});
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    void load();
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [token]);

  const toggle = async (name: string, currentlyEnabled: boolean) => {
    setToggling(name);
    try {
      const action = currentlyEnabled ? 'disable' : 'enable';
      await panelPost(token, `/failure-simulator/scenarios/${name}/${action}`);
      const s = await panelFetch<Record<string, any>>(token, '/failure-simulator/scenarios');
      setScenarios(s ?? {});
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
    </div>
  );

  return (
    <div style={{ padding: '12px' }}>
      {/* Metrics charts */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#f0883e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        📊 Metrics
      </p>
      <MetricsPanel metrics={metrics} />

      {/* Scenario list */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#f85149', letterSpacing: 3, textTransform: 'uppercase', margin: '16px 0 10px' }}>
        💥 Scenarios
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(scenarios).map(([name, s]: [string, any]) => (
          <div key={name} style={{
            background: 'var(--bg-elevated)', borderRadius: 8, padding: '9px 12px',
            border: `1px solid ${s.enabled ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.05)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.63rem', color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.57rem', color: '#8b949e', marginTop: 2 }}>
                {s.failure_type} · {Math.round((s.probability ?? 0) * 100)}%
              </p>
            </div>
            <button
              onClick={() => void toggle(name, s.enabled)}
              disabled={toggling === name}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'none',
                fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: 1, flexShrink: 0,
                background: s.enabled ? 'rgba(248,81,73,0.15)' : 'rgba(34,197,94,0.1)',
                color:      s.enabled ? '#f85149' : '#22c55e',
                border:    `1px solid ${s.enabled ? 'rgba(248,81,73,0.3)' : 'rgba(34,197,94,0.25)'}`,
              }}
            >
              {toggling === name ? '...' : s.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        {Object.keys(scenarios).length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#6e7681', textAlign: 'center', padding: '16px 0' }}>
            No scenarios found
          </p>
        )}
      </div>
    </div>
  );
}

// ─── DEV TAB: Chaos Engineer ──────────────────────────────────────────────────
function DevChaosTab({ token }: { token: string }) {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [impactLog, setImpactLog]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState<string | null>(null);

  const CHAOS_CATEGORY_META: Record<string, { icon: string; color: string }> = {
    A: { icon: '🚫', color: '#f85149' },
    B: { icon: '⏱️', color: '#d29922' },
    C: { icon: '⚡', color: '#f0883e' },
    D: { icon: '🔀', color: '#a78bfa' },
    E: { icon: '🔥', color: '#ff6b6b' },
    F: { icon: '🌊', color: '#58a6ff' },
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [exps, log] = await Promise.all([
          panelFetch<any[]>(token, '/chaos/experiments'),
          panelFetch<any[]>(token, '/chaos/impact-log', { limit: '20' }),
        ]);
        setExperiments(Array.isArray(exps) ? exps : []);
        setImpactLog(Array.isArray(log) ? log : []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    void load();
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [token]);

  const toggle = async (id: string) => {
    setToggling(id);
    try {
      await panelPost(token, `/chaos/experiments/${id}/toggle`);
      const exps = await panelFetch<any[]>(token, '/chaos/experiments');
      setExperiments(Array.isArray(exps) ? exps : []);
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 8 }} />)}
    </div>
  );

  const activeCount = experiments.filter((e: any) => e.enabled).length;

  return (
    <div style={{ padding: '12px' }}>
      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total',    value: experiments.length,                                   color: '#ffc845' },
          { label: 'Active',   value: activeCount, color: activeCount > 0 ? '#f85149' : '#22c55e' },
          { label: 'Impact',   value: impactLog.length,                                     color: '#58a6ff' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Experiment list */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#58a6ff', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        ⚡ Experiments
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {experiments.map((exp: any) => {
          const meta = CHAOS_CATEGORY_META[exp.category] ?? { icon: '🔧', color: '#8b949e' };
          return (
            <div key={exp.id} style={{
              background: 'var(--bg-elevated)', borderRadius: 8, padding: '9px 12px',
              border: `1px solid ${exp.enabled ? `${meta.color}44` : 'rgba(255,255,255,0.05)'}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.name}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.56rem', color: '#8b949e', marginTop: 1 }}>
                  {exp.category_label ?? exp.category} · {exp.failure_type}
                </p>
              </div>
              <button
                onClick={() => void toggle(exp.id)}
                disabled={toggling === exp.id}
                style={{
                  padding: '4px 10px', borderRadius: 6, cursor: 'none', flexShrink: 0,
                  fontFamily: 'var(--font-body)', fontSize: '0.58rem', letterSpacing: 1,
                  background: exp.enabled ? `${meta.color}18` : 'rgba(255,255,255,0.05)',
                  color:      exp.enabled ? meta.color : '#8b949e',
                  border:    `1px solid ${exp.enabled ? `${meta.color}44` : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {toggling === exp.id ? '...' : exp.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
        {experiments.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#6e7681', textAlign: 'center', padding: '16px 0' }}>
            No experiments found
          </p>
        )}
      </div>

      {/* Impact log */}
      {impactLog.length > 0 && (
        <>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#f85149', letterSpacing: 3, textTransform: 'uppercase', margin: '16px 0 8px' }}>
            💥 Recent Impact
          </p>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            {impactLog.slice(0, 10).map((entry: any, i: number) => (
              <div key={entry.id ?? i} style={{
                display: 'flex', gap: 8, padding: '6px 10px', alignItems: 'center', fontSize: '0.6rem',
                borderBottom: i < Math.min(impactLog.length, 10) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ color: '#8b949e', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {entry.timestamp ? new Date(entry.timestamp).toTimeString().slice(0, 8) : '--:--'}
                </span>
                <span style={{ color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {entry.endpoint}
                </span>
                <span style={{ color: '#f85149', flexShrink: 0 }}>{entry.failure_type}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── DEV TAB: Analysis ───────────────────────────────────────────────────────
function DevAnalysisTab({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<FailureSimulatorMetrics | null>(null);
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, l] = await Promise.all([
          panelFetch<FailureSimulatorMetrics>(token, '/failure-simulator/metrics'),
          panelFetch<any[]>(token, '/observation/logs', { limit: '200' }),
        ]);
        setMetrics(m);
        setLogs(Array.isArray(l) ? l : []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    void load();
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [token]);

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
    </div>
  );

  // Stats derived from metrics (same source as AnalysisPage)
  const totalReqs   = metrics?.total_requests  ?? 0;
  const failedReqs  = metrics?.failed_requests ?? 0;
  const failureRate = metrics?.failure_rate    ?? 0;
  const healthyReqs = totalReqs - failedReqs;

  return (
    <div style={{ padding: '12px' }}>
      {/* Compact stats from metrics */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#f0883e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
        ⚡ Simulator Metrics
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Total',     value: totalReqs.toLocaleString(),         color: '#e6edf3' },
          { label: 'Failures',  value: failedReqs.toLocaleString(),        color: failedReqs  > 0 ? '#f85149' : '#22c55e' },
          { label: 'Healthy',   value: healthyReqs.toLocaleString(),       color: '#22c55e' },
          { label: 'Fail %',    value: `${failureRate.toFixed(1)}%`,       color: failureRate > 10 ? '#f85149' : failureRate > 0 ? '#ffc845' : '#22c55e' },
          { label: 'Scenarios', value: `${metrics?.active_scenarios ?? 0}/${metrics?.total_scenarios ?? 0}`, color: '#f0883e' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.05)', flex: '1 1 80px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.52rem', color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontSize: '1.2rem', color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Observation logs */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#58a6ff', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
        📡 Observation Logs
      </p>
      <DevLogTable logs={logs} maxHeight="45vh" />
    </div>
  );
}

// ─── DEV PANEL (tabbed shell) ─────────────────────────────────────────────────
type DevTab = 'logs' | 'failsim' | 'chaos' | 'analysis';

const DEV_TABS: { id: DevTab; icon: string; label: string; color: string }[] = [
  { id: 'logs',     icon: '📡', label: 'Logs',     color: '#58a6ff' },
  { id: 'failsim',  icon: '💥', label: 'Fail Sim', color: '#f85149' },
  { id: 'chaos',    icon: '⚡', label: 'Chaos',    color: '#f0883e' },
  { id: 'analysis', icon: '🔬', label: 'Analysis', color: '#a78bfa' },
];

function DevPanel({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<DevTab>('logs');

  return (
    <>
      {/* Sticky tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 10px', flexShrink: 0,
        background: '#1c2128', borderBottom: '1px solid #30363d',
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        {DEV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '4px 10px', borderRadius: 6, cursor: 'none', whiteSpace: 'nowrap',
              background: activeTab === tab.id ? `${tab.color}18` : 'transparent',
              border:     `1px solid ${activeTab === tab.id ? `${tab.color}55` : 'transparent'}`,
              color:      activeTab === tab.id ? tab.color : '#8b949e',
              fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: 1,
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'logs'     && <DevLogsTab      token={token} />}
      {activeTab === 'failsim'  && <DevFailureSimTab token={token} />}
      {activeTab === 'chaos'    && <DevChaosTab      token={token} />}
      {activeTab === 'analysis' && <DevAnalysisTab   token={token} />}
    </>
  );
}

// ─── Panel content switcher ───────────────────────────────────────────────────
function PanelContent({
  type, token, loading: authLoading, error, user,
}: {
  type: PanelType;
  token: string | null;
  loading: boolean;
  error: string;
  user: { first_name: string; last_name: string; role: string } | null;
}) {
  const navigate = useNavigate();

  if (type === 'customer') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <SessionBanner user={{ first_name: 'John', last_name: 'Doe', role: 'customer' }} type={type} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <BrowsePage onSelect={(id) => navigate(`/menu/${id}`)} />
        </div>
      </div>
    );
  }

  if (authLoading || (!token && !error)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PanelAuthState type={type} error="" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PanelAuthState type={type} error={error || 'Login failed'} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SessionBanner user={user} type={type} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {type === 'driver'     && <DriverPanel token={token} />}
        {type === 'restaurant' && <RestaurantPanel token={token} />}
        {type === 'admin'      && <AdminViewPanel token={token} />}
        {type === 'dev'        && <DevPanel token={token} />}
      </div>
    </div>
  );
}

// ─── Main DualView ────────────────────────────────────────────────────────────
export default function DualView() {
  const navigate = useNavigate();
  const [leftPanel, setLeftPanel]   = useState<PanelType>('customer');
  const [rightPanel, setRightPanel] = useState<PanelType>('driver');

  const leftCfg  = PANELS[leftPanel];
  const rightCfg = PANELS[rightPanel];

  const leftAuth  = usePanelAuth(leftCfg.email,  leftCfg.password);
  const rightAuth = usePanelAuth(rightCfg.email, rightCfg.password);

  // For customer panel we skip auto-login (BrowsePage is public)
  const leftToken  = leftPanel  === 'customer' ? 'n/a' : (leftAuth.token  ?? null);
  const rightToken = rightPanel === 'customer' ? 'n/a' : (rightAuth.token ?? null);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#0d1117',
      paddingTop: 64,
    }}>
      {/* Tool header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '8px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#8b949e', letterSpacing: 2, textTransform: 'uppercase' }}>
            🖥️ Dual View — Dev Mode
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: `${leftCfg.color}12`, color: leftCfg.color, border: `1px solid ${leftCfg.color}44`, borderRadius: 12, padding: '2px 10px', fontSize: '0.58rem', letterSpacing: 1, fontFamily: 'var(--font-body)' }}>
              {leftCfg.icon} {leftCfg.label} (Left)
            </span>
            <span style={{ background: `${rightCfg.color}12`, color: rightCfg.color, border: `1px solid ${rightCfg.color}44`, borderRadius: 12, padding: '2px 10px', fontSize: '0.58rem', letterSpacing: 1, fontFamily: 'var(--font-body)' }}>
              {rightCfg.icon} {rightCfg.label} (Right)
            </span>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/developer')}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #30363d', borderRadius: 6, padding: '6px 14px', cursor: 'none', color: '#8b949e', fontSize: '0.65rem', letterSpacing: 1, fontFamily: 'var(--font-body)' }}
        >
          ← Dashboard
        </motion.button>
      </div>

      {/* Split panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ─ Left panel ─ */}
        <div style={{ width: '50%', borderRight: '2px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelSelector active={leftPanel} onChange={setLeftPanel} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PanelContent
              type={leftPanel}
              token={leftToken}
              loading={leftPanel !== 'customer' && leftAuth.loading}
              error={leftAuth.error}
              user={leftAuth.user}
            />
          </div>
        </div>

        {/* ─ Right panel ─ */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelSelector active={rightPanel} onChange={setRightPanel} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PanelContent
              type={rightPanel}
              token={rightToken}
              loading={rightPanel !== 'customer' && rightAuth.loading}
              error={rightAuth.error}
              user={rightAuth.user}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
