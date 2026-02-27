import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API || 'http://localhost:4000';

const BRANCHES = [
  { id: 1, name: 'New York HQ', region: 'North East', entity: 'FinCore Holdings' },
  { id: 2, name: 'San Francisco', region: 'West', entity: 'FinCore Holdings' },
  { id: 3, name: 'Chicago', region: 'Midwest', entity: 'FinCore Holdings' },
  { id: 4, name: 'Austin', region: 'South', entity: 'FinCore Lending' },
  { id: 5, name: 'Miami', region: 'South East', entity: 'FinCore Payments' },
  { id: 6, name: 'Seattle', region: 'West', entity: 'FinCore Holdings' },
  { id: 7, name: 'Boston', region: 'North East', entity: 'FinCore Risk' },
  { id: 8, name: 'Denver', region: 'Mountain', entity: 'FinCore Lending' },
  { id: 9, name: 'Atlanta', region: 'South East', entity: 'FinCore Payments' },
  { id: 10, name: 'Los Angeles', region: 'West', entity: 'FinCore Holdings' },
  { id: 11, name: 'Dallas', region: 'South', entity: 'FinCore Lending' },
  { id: 12, name: 'Phoenix', region: 'South West', entity: 'FinCore Payments' },
  { id: 13, name: 'Philadelphia', region: 'North East', entity: 'FinCore Risk' },
  { id: 14, name: 'Nashville', region: 'South', entity: 'FinCore Lending' },
  { id: 15, name: 'Portland', region: 'West', entity: 'FinCore Risk' }
];

const ENTITIES = [
  { id: 'fincore-holdings', name: 'FinCore Holdings', focus: 'Core infrastructure & governance' },
  { id: 'fincore-lending', name: 'FinCore Lending', focus: 'Loan origination platforms' },
  { id: 'fincore-payments', name: 'FinCore Payments', focus: 'Cards, settlements and wallets' },
  { id: 'fincore-risk', name: 'FinCore Risk', focus: 'Risk analytics and compliance tooling' }
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [page, setPage] = useState('overview');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchAssets();
    fetchUsers();
    fetchAllocations();
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
      setMessage('Logged in');
    } catch (err) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
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
    setMessage(res.ok ? 'Asset allocated' : body.error || 'Allocation failed');
    fetchAssets();
    fetchAllocations();
  }

  async function createStore(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const location = e.target.location.value;
    const res = await fetch(`${API}/api/stores`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, location })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Branch store created' : body.error || 'Create store failed');
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMessage('Logged out');
  }

  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const allocatedAssets = assets.filter((a) => a.status === 'allocated').length;
    const availableAssets = assets.filter((a) => a.status === 'available').length;
    const activeAllocations = allocations.filter((a) => !a.returned_at).length;
    const utilization = totalAssets ? Math.round((allocatedAssets / totalAssets) * 100) : 0;
    return { totalAssets, allocatedAssets, availableAssets, activeAllocations, utilization };
  }, [assets, allocations]);

  const branchMetrics = useMemo(() => {
    const mapped = BRANCHES.map((branch) => {
      const branchAssets = assets.filter((a) => {
        if (a.store_id) return Number(a.store_id) === branch.id;
        return ((Number(a.id) || 0) % BRANCHES.length) + 1 === branch.id;
      });
      const allocated = branchAssets.filter((a) => a.status === 'allocated').length;
      const total = branchAssets.length;
      return {
        ...branch,
        total,
        allocated,
        available: Math.max(total - allocated, 0),
        utilization: total ? Math.round((allocated / total) * 100) : 0
      };
    });
    return mapped;
  }, [assets]);

  const entityMetrics = useMemo(() => {
    return ENTITIES.map((entity) => {
      const branches = branchMetrics.filter((b) => b.entity === entity.name);
      const total = branches.reduce((sum, b) => sum + b.total, 0);
      const allocated = branches.reduce((sum, b) => sum + b.allocated, 0);
      return {
        ...entity,
        branches: branches.length,
        assets: total,
        utilization: total ? Math.round((allocated / total) * 100) : 0
      };
    });
  }, [branchMetrics]);

  if (!user) {
    return (
      <div className="app-shell login-shell">
        <div className="login-panel">
          <div className="login-content">
            <p className="eyebrow">IT Asset Management</p>
            <h1>Fintech Operations Control Center</h1>
            <p className="muted">Unified visibility across 15 branches and multiple fintech entities.</p>
            <form onSubmit={login} className="login-form" autoComplete="on">
              <label htmlFor="email">Username</label>
              <input id="email" name="email" type="text" defaultValue="admin" required />
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" defaultValue="admin" required />
              <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            </form>
            <p className="helper">Default: admin / admin</p>
            <p className="status">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div>
          <p className="eyebrow">Fintech IT</p>
          <h2>Asset Command</h2>
          <p className="muted">{user.name} ({user.role})</p>
        </div>
        <nav>
          <button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}>Overview</button>
          <button className={page === 'operations' ? 'active' : ''} onClick={() => setPage('operations')}>Operations</button>
          <button className={page === 'branches' ? 'active' : ''} onClick={() => setPage('branches')}>Branches (15)</button>
          <button className={page === 'entities' ? 'active' : ''} onClick={() => setPage('entities')}>Entities</button>
          {user.role === 'admin' && <button className={page === 'users' ? 'active' : ''} onClick={() => setPage('users')}>Users</button>}
        </nav>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </aside>

      <main className="dashboard">
        <header className="top-row">
          <div>
            <h1>IT Asset Dashboard</h1>
            <p className="muted">Fintech infrastructure monitoring across branches and sub-entities</p>
          </div>
          <div className="badge">{BRANCHES.length} Branches | {ENTITIES.length} Entities</div>
        </header>

        {page === 'overview' && (
          <>
            <section className="kpi-grid">
              <article className="kpi-card"><p>Total Assets</p><h3>{stats.totalAssets}</h3></article>
              <article className="kpi-card"><p>Allocated</p><h3>{stats.allocatedAssets}</h3></article>
              <article className="kpi-card"><p>Available</p><h3>{stats.availableAssets}</h3></article>
              <article className="kpi-card"><p>Utilization</p><h3>{stats.utilization}%</h3></article>
            </section>

            <section className="panel two-col">
              <div>
                <h3>Branch Utilization Snapshot</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Branch</th><th>Region</th><th>Entity</th><th>Utilization</th></tr>
                    </thead>
                    <tbody>
                      {branchMetrics.slice(0, 8).map((b) => (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>{b.region}</td>
                          <td>{b.entity}</td>
                          <td>{b.utilization}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3>Entity Portfolio</h3>
                <div className="entity-list">
                  {entityMetrics.map((e) => (
                    <div key={e.id} className="entity-card">
                      <h4>{e.name}</h4>
                      <p>{e.focus}</p>
                      <small>{e.branches} branches | {e.assets} assets | {e.utilization}% utilization</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {page === 'operations' && (
          <section className="panel two-col">
            <div>
              <h3>Allocate Asset</h3>
              <form onSubmit={allocate} className="stack-form">
                <select name="asset" required>
                  {assets.filter((a) => a.status === 'available').map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.serial})</option>
                  ))}
                </select>
                <select name="user" required>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button type="submit">Allocate</button>
              </form>

              <h3 className="space-top">Create Store</h3>
              <form onSubmit={createStore} className="stack-form">
                <input name="name" placeholder="Store name" required />
                <input name="location" placeholder="Location" required />
                <button type="submit">Create</button>
              </form>
            </div>

            <div>
              <h3>Recent Allocations</h3>
              <ul className="list">
                {allocations.slice(0, 10).map((a) => (
                  <li key={a.id}>Asset {a.asset_id} -> User {a.user_id} ({a.returned_at ? 'Returned' : 'Active'})</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {page === 'branches' && (
          <section className="panel branch-grid">
            {branchMetrics.map((b) => (
              <article key={b.id} className="branch-card">
                <h4>{b.name}</h4>
                <p>{b.region} | {b.entity}</p>
                <small>{b.total} assets | {b.allocated} allocated | {b.available} available</small>
                <div className="progress"><span style={{ width: `${b.utilization}%` }} /></div>
              </article>
            ))}
          </section>
        )}

        {page === 'entities' && (
          <section className="panel entity-grid">
            {entityMetrics.map((e) => (
              <article key={e.id} className="entity-card">
                <h4>{e.name}</h4>
                <p>{e.focus}</p>
                <small>Branches: {e.branches}</small>
                <small>Assets: {e.assets}</small>
                <small>Utilization: {e.utilization}%</small>
              </article>
            ))}
          </section>
        )}

        {page === 'users' && user.role === 'admin' && (
          <section className="panel">
            <h3>Users</h3>
            <ul className="list">
              {users.map((u) => <li key={u.id}>{u.name} - {u.email} - {u.role}</li>)}
            </ul>
          </section>
        )}

        {message && <div className="message-bar">{message}</div>}
      </main>
    </div>
  );
}

export default App;
