import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API || 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [section, setSection] = useState('overview');

  useEffect(() => {
    if (!token) return;
    fetchAssets();
    fetchUsers();
    fetchAllocations();
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function authHeaders() {
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  function fetchAssets() {
    fetch(`${API}/api/assets`).then((r) => r.json()).then(setAssets);
  }

  function fetchUsers() {
    fetch(`${API}/api/users`).then((r) => r.json()).then(setUsers);
  }

  function fetchAllocations() {
    fetch(`${API}/api/allocations`, { headers: authHeaders() }).then((r) => r.json()).then(setAllocations);
  }

  function fetchBrands() {
    fetch(`${API}/api/brands`, { headers: authHeaders() }).then((r) => r.json()).then(setBrands);
  }

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error || 'Login failed');
        setLoading(false);
        return;
      }
      setToken(body.token);
      setUser(body.user);
      localStorage.setItem('token', body.token);
      localStorage.setItem('user', JSON.stringify(body.user));
      setMessage('');
    } catch (err) {
      setMessage('Network error while signing in');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMessage('Logged out');
  }

  async function allocate(e) {
    e.preventDefault();
    const asset_id = Number(e.target.asset.value);
    const user_id = Number(e.target.user.value);
    const res = await fetch(`${API}/api/allocations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ asset_id, user_id })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset assigned successfully' : body.error || 'Allocation failed');
    if (res.ok) {
      fetchAssets();
      fetchAllocations();
      e.target.reset();
    }
  }

  async function returnAsset(allocationId) {
    const res = await fetch(`${API}/api/allocations/${allocationId}/return`, {
      method: 'PUT',
      headers: authHeaders()
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset returned successfully' : body.error || 'Return failed');
    if (res.ok) {
      fetchAssets();
      fetchAllocations();
    }
  }

  async function createAsset(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const type = e.target.type.value;
    const serial = e.target.serial.value;
    const notes = e.target.notes.value;
    const brand_id = e.target.brand_id.value ? Number(e.target.brand_id.value) : null;
    const model_id = e.target.model_id.value ? Number(e.target.model_id.value) : null;
    const res = await fetch(`${API}/api/assets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, type, serial, notes, brand_id, model_id })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset created' : body.error || 'Create asset failed');
    if (res.ok) {
      fetchAssets();
      e.target.reset();
      setSelectedBrandId('');
    }
  }

  const activeAllocations = useMemo(() => allocations.filter((a) => !a.returned_at), [allocations]);

  const stats = useMemo(() => {
    const total = assets.length;
    const available = assets.filter((a) => a.status === 'available').length;
    const allocated = assets.filter((a) => a.status === 'allocated').length;
    const utilization = total ? Math.round((allocated / total) * 100) : 0;
    return { total, available, allocated, active: activeAllocations.length, utilization };
  }, [assets, activeAllocations]);

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const assetTypes = useMemo(() => {
    const groups = assets.reduce((acc, item) => {
      const key = item.type || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  const teamLoad = useMemo(() => {
    return users
      .map((u) => {
        const assigned = activeAllocations.filter((a) => a.user_id === u.id).length;
        return { ...u, assigned };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [users, activeAllocations]);

  const recentActivity = useMemo(() => {
    return [...allocations]
      .sort((a, b) => new Date(b.allocated_at || 0) - new Date(a.allocated_at || 0))
      .slice(0, 8);
  }, [allocations]);

  const topAssetType = assetTypes[0] || ['N/A', 0];
  const busiestUser = teamLoad[0] || { name: 'N/A', assigned: 0 };
  const availabilityRate = stats.total ? Math.round((stats.available / stats.total) * 100) : 0;
  const topAssetTypes = assetTypes.slice(0, 5);
  const maxTypeCount = topAssetTypes.length ? topAssetTypes[0][1] : 1;

  const weeklyAssignments = useMemo(() => {
    const days = [];
    const counts = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      days.push({ key, label });
      counts[key] = 0;
    }
    allocations.forEach((a) => {
      const key = new Date(a.allocated_at || '').toISOString().slice(0, 10);
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return days.map((d) => ({ ...d, count: counts[d.key] || 0 }));
  }, [allocations]);

  const maxWeeklyCount = Math.max(...weeklyAssignments.map((d) => d.count), 1);
  const selectedBrandModels = useMemo(() => {
    const brand = brands.find((b) => b.id === Number(selectedBrandId));
    return brand ? brand.models : [];
  }, [brands, selectedBrandId]);

  const navItems = [
    { key: 'overview', label: 'Overview', icon: 'OV' },
    { key: 'inventory', label: 'Inventory', icon: 'IN' },
    { key: 'assignments', label: 'Assignments', icon: 'AS' },
    { key: 'insights', label: 'Insights', icon: 'IS' },
    { key: 'activity', label: 'Recent Activity', icon: 'RA' }
  ];

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="label">IT Inventory Management</p>
          <h1>Control your devices, assignments, and lifecycle from one dashboard.</h1>
          <form onSubmit={login} className="form">
            <label htmlFor="email">Username</label>
            <input id="email" name="email" type="text" defaultValue="admin" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" defaultValue="admin" required />
            <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <p className="hint">Default credentials: admin / admin</p>
          <p className="msg">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-head">
            <div className="sidebar-brand">
              <p className="label">IT Inventory</p>
              {!sidebarCollapsed && <h3>Dashboard</h3>}
            </div>
            <button
              className="toggle-btn"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '>>' : '<<'}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="sidebar-user">
              <div className="avatar">{(user.name || 'U').slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
          )}
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${section === item.key ? 'active' : ''}`}
                onClick={() => setSection(item.key)}
                title={sidebarCollapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>
        <button className="sidebar-logout" onClick={logout}>{sidebarCollapsed ? 'X' : 'Logout'}</button>
      </aside>

      <div className="inventory-app">
        {section === 'overview' && (
          <>
            <section className="overview-hero">
              <div>
                <p className="label">Inventory Pulse</p>
                <h3>Live health snapshot for IT inventory operations</h3>
                <p className="hint">Track capacity, allocation pressure and workforce distribution in one view.</p>
              </div>
              <div className="hero-badges">
                <span>Top Type: {topAssetType[0]} ({topAssetType[1]})</span>
                <span>Busiest User: {busiestUser.name} ({busiestUser.assigned})</span>
                <span>Availability: {availabilityRate}%</span>
              </div>
            </section>

            <section className="kpis kpis-overview">
              <article><span>Total Assets</span><strong>{stats.total}</strong></article>
              <article><span>Available</span><strong>{stats.available}</strong></article>
              <article><span>Allocated</span><strong>{stats.allocated}</strong></article>
              <article><span>Active Assignments</span><strong>{stats.active}</strong></article>
              <article><span>Utilization</span><strong>{stats.utilization}%</strong></article>
            </section>

            <main className="grid overview-grid">
              <section className="panel panel-capacity">
                <div className="panel-head"><h3>Capacity Health</h3><span>Current split</span></div>
                <div className="capacity-list">
                  <div>
                    <div className="capacity-row"><span>Available</span><strong>{stats.available}</strong></div>
                    <div className="meter"><span style={{ width: `${availabilityRate}%` }} /></div>
                  </div>
                  <div>
                    <div className="capacity-row"><span>Allocated</span><strong>{stats.allocated}</strong></div>
                    <div className="meter"><span style={{ width: `${stats.utilization}%` }} /></div>
                  </div>
                  <div>
                    <div className="capacity-row"><span>Active Assignments</span><strong>{stats.active}</strong></div>
                    <div className="meter"><span style={{ width: `${Math.min(stats.active * 10, 100)}%` }} /></div>
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head"><h3>Top Team Load</h3><span>Highest active assignments</span></div>
                <ul className="list plain">
                  {teamLoad.slice(0, 5).map((u) => (
                    <li key={u.id}><span>{u.name}</span><strong>{u.assigned}</strong></li>
                  ))}
                </ul>
              </section>
              <section className="panel">
                <div className="panel-head"><h3>Asset Categories</h3><span>Distribution</span></div>
                <ul className="list plain">
                  {assetTypes.map(([type, count]) => (
                    <li key={type}><span>{type}</span><strong>{count}</strong></li>
                  ))}
                </ul>
              </section>
            </main>

            <section className="grid overview-charts">
              <section className="panel chart-panel">
                <div className="panel-head"><h3>Asset Type Graph</h3><span>Top categories</span></div>
                <div className="hbar-chart">
                  {topAssetTypes.map(([type, count]) => (
                    <div className="hbar-row" key={type}>
                      <div className="hbar-meta">
                        <span>{type}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="hbar-track">
                        <span style={{ width: `${Math.round((count / maxTypeCount) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head"><h3>7-Day Assignment Trend</h3><span>Daily volumes</span></div>
                <div className="vbar-chart">
                  {weeklyAssignments.map((d) => (
                    <div className="vbar-col" key={d.key}>
                      <strong>{d.count}</strong>
                      <div className="vbar-track">
                        <span style={{ height: `${Math.round((d.count / maxWeeklyCount) * 100)}%` }} />
                      </div>
                      <small>{d.label}</small>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}

        {section === 'inventory' && (
          <section className="panel wide">
            <div className="panel-head"><h3>Asset Inventory</h3><span>{assets.length} records</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Asset</th><th>Type</th><th>Brand</th><th>Model</th><th>Serial</th><th>Status</th></tr></thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td><td>{a.type}</td><td>{a.brand_name || '-'}</td><td>{a.model_name || '-'}</td><td>{a.serial}</td>
                      <td><span className={`status ${a.status}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {user.role === 'admin' && (
              <div className="create-box">
                <h4>Add New Asset</h4>
                <form onSubmit={createAsset} className="form inline-form">
                  <input name="name" placeholder="Asset name" required />
                  <input name="type" placeholder="Type" required />
                  <select name="brand_id" value={selectedBrandId} onChange={(e) => setSelectedBrandId(e.target.value)}>
                    <option value="">Select brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <select name="model_id" disabled={!selectedBrandId}>
                    <option value="">{selectedBrandId ? 'Select model' : 'Select brand first'}</option>
                    {selectedBrandModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input name="serial" placeholder="Serial" required />
                  <input name="notes" placeholder="Notes (optional)" />
                  <button type="submit">Add Asset</button>
                </form>
              </div>
            )}
          </section>
        )}

        {section === 'assignments' && (
          <section className="grid">
            <section className="panel">
              <div className="panel-head"><h3>Assign Asset</h3><span>Live operation</span></div>
              <form onSubmit={allocate} className="form">
                <label>Available Asset</label>
                <select name="asset" required>
                  {assets.filter((a) => a.status === 'available').map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.serial})</option>
                  ))}
                </select>
                <label>User</label>
                <select name="user" required>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button type="submit">Assign</button>
              </form>
            </section>
            <section className="panel">
              <h4>Active Assignments</h4>
              <ul className="list">
                {activeAllocations.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{assetById[a.asset_id]?.name || `Asset ${a.asset_id}`}</strong>
                      <small>{userById[a.user_id]?.name || `User ${a.user_id}`}</small>
                    </div>
                    <button className="small" onClick={() => returnAsset(a.id)}>Return</button>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {section === 'insights' && (
          <section className="grid">
            <section className="panel">
              <div className="panel-head"><h3>Asset Categories</h3><span>Distribution</span></div>
              <ul className="list plain">
                {assetTypes.map(([type, count]) => (
                  <li key={type}><span>{type}</span><strong>{count}</strong></li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <div className="panel-head"><h3>Team Load</h3><span>Assignments per user</span></div>
              <ul className="list plain">
                {teamLoad.map((u) => (
                  <li key={u.id}><span>{u.name}</span><strong>{u.assigned}</strong></li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {section === 'activity' && (
          <section className="panel wide">
            <div className="panel-head"><h3>Recent Activity</h3><span>Last 8 assignment events</span></div>
            <ul className="timeline">
              {recentActivity.map((a) => (
                <li key={a.id}>
                  <div className="dot" />
                  <div>
                    <strong>{assetById[a.asset_id]?.name || `Asset ${a.asset_id}`} assigned to {userById[a.user_id]?.name || `User ${a.user_id}`}</strong>
                    <small>{new Date(a.allocated_at).toLocaleString()} {a.returned_at ? '- Returned' : '- Active'}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {message && <div className="toast">{message}</div>}
      </div>
    </div>
  );
}

export default App;
