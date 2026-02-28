import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API || 'http://localhost:4000';
const TYPE_OPTIONS = ['Laptop', 'Desktop', 'Monitor', 'Peripheral', 'Tablet', 'Mobile', 'Network', 'Printer', 'Scanner', 'Sim Card'];
const FALLBACK_NAMES_BY_TYPE = {
  Laptop: ['Business Laptop', 'Developer Laptop', 'Ultrabook', 'High config'],
  Desktop: ['Workstation', 'Office Desktop',],
  Monitor: ['24-inch Monitor', '27-inch Monitor', '32-inch Monitor', '40-inch Monitor', '49-inch Monitor', '55-inch Monitor', '65-inch Monitor'],
  Peripheral: ['Mouse', 'Keyboard', 'Headset', 'Docking Station', 'External hard drive', 'USB drive', 'Webcam', 'USB hub', 'USB cable'],
  Tablet: ['Business Tablet', 'Tablet'],
  Mobile: ['Corporate Mobile'],
  Network: ['Router', 'Switch', 'Access Point'],
  Printer: ['Laser Printer', 'Ink Tank Printer', 'Thermal Printer'],
  Scanner: ['Document Scanner', 'Flatbed Scanner'],
  'Sim Card': ['Airtel SIM', 'Jio SIM', 'Vi SIM', 'BSNL SIM']
};

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
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentUserFilter, setAssignmentUserFilter] = useState('all');
  const [selectedAssetType, setSelectedAssetType] = useState('Laptop');
  const [selectedAssetName, setSelectedAssetName] = useState('');

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
    fetch(`${API}/api/assets`)
      .then((r) => {
        if (!r.ok) throw new Error(`assets_${r.status}`);
        return r.json();
      })
      .then(setAssets)
      .catch(() => setMessage('Unable to load assets. Ensure backend is running on port 4000.'));
  }

  function fetchUsers() {
    fetch(`${API}/api/users`)
      .then((r) => {
        if (!r.ok) throw new Error(`users_${r.status}`);
        return r.json();
      })
      .then(setUsers)
      .catch(() => setMessage('Unable to load users from server.'));
  }

  function fetchAllocations() {
    fetch(`${API}/api/allocations`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`allocations_${r.status}`);
        return r.json();
      })
      .then(setAllocations)
      .catch(() => setMessage('Unable to load allocations from server.'));
  }

  function fetchBrands() {
    fetch(`${API}/api/brands`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`brands_${r.status}`);
        return r.json();
      })
      .then(setBrands)
      .catch(() => setMessage('Unable to load brands/models from server.'));
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
    const notes = e.target.notes?.value || '';
    const res = await fetch(`${API}/api/allocations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ asset_id, user_id, notes })
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
      setSelectedAssetType('Laptop');
      setSelectedAssetName('');
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
  const selectedBrandModelsByType = useMemo(() => {
    return selectedBrandModels.filter(
      (m) => (m.category || '').toLowerCase() === selectedAssetType.toLowerCase(),
    );
  }, [selectedBrandModels, selectedAssetType]);
  const brandsBySelectedType = useMemo(() => {
    return brands.filter((b) =>
      (b.models || []).some((m) => (m.category || '').toLowerCase() === selectedAssetType.toLowerCase()),
    );
  }, [brands, selectedAssetType]);
  const assetNameOptions = useMemo(() => {
    const modelNames = selectedBrandModelsByType.map((m) => m.name);
    if (modelNames.length > 0) return modelNames;
    return FALLBACK_NAMES_BY_TYPE[selectedAssetType] || ['Generic Asset'];
  }, [selectedBrandModelsByType, selectedAssetType]);
  useEffect(() => {
    if (!selectedBrandId) return;
    const existsForType = brandsBySelectedType.some((b) => String(b.id) === String(selectedBrandId));
    if (!existsForType) {
      setSelectedBrandId('');
      setSelectedAssetName('');
    }
  }, [brandsBySelectedType, selectedBrandId]);
  const availableAssets = useMemo(() => assets.filter((a) => a.status === 'available'), [assets]);
  const employees = useMemo(() => {
    const nonAdmins = users.filter((u) => u.role !== 'admin');
    return nonAdmins.length ? nonAdmins : users;
  }, [users]);
  const assignedUsersCount = useMemo(
    () => {
      const employeeIds = new Set(employees.map((e) => e.id));
      return new Set(activeAllocations.filter((a) => employeeIds.has(a.user_id)).map((a) => a.user_id)).size;
    },
    [activeAllocations, employees],
  );
  const assignmentRows = useMemo(() => {
    return activeAllocations
      .filter((a) => assignmentUserFilter === 'all' || String(a.user_id) === assignmentUserFilter)
      .filter((a) => {
        const q = assignmentSearch.trim().toLowerCase();
        if (!q) return true;
        const assetName = (assetById[a.asset_id]?.name || '').toLowerCase();
        const userName = (userById[a.user_id]?.name || '').toLowerCase();
        const serial = (assetById[a.asset_id]?.serial || '').toLowerCase();
        return `${assetName} ${userName} ${serial}`.includes(q);
      })
      .sort((a, b) => new Date(b.allocated_at || 0) - new Date(a.allocated_at || 0));
  }, [activeAllocations, assignmentUserFilter, assignmentSearch, assetById, userById]);
  const employeeLoad = useMemo(() => {
    return employees
      .map((e) => ({
        ...e,
        assigned: activeAllocations.filter((a) => a.user_id === e.id).length,
      }))
      .sort((a, b) => b.assigned - a.assigned);
  }, [employees, activeAllocations]);
  const inventoryTypes = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.type).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const inventoryBrands = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.brand_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const filteredSortedAssets = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    const filtered = assets.filter((a) => {
      const matchQuery = !q || `${a.name || ''} ${a.type || ''} ${a.serial || ''} ${a.brand_name || ''} ${a.model_name || ''} ${a.status || ''}`.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchBrand = filterBrand === 'all' || (a.brand_name || '') === filterBrand;
      const matchType = filterType === 'all' || (a.type || '') === filterType;
      return matchQuery && matchStatus && matchBrand && matchType;
    });

    const sorted = [...filtered].sort((a, b) => {
      const left = (a[sortBy] || '').toString().toLowerCase();
      const right = (b[sortBy] || '').toString().toLowerCase();
      if (left < right) return sortDir === 'asc' ? -1 : 1;
      if (left > right) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [assets, inventoryQuery, filterStatus, filterBrand, filterType, sortBy, sortDir]);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredSortedAssets.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSortedAssets.slice(start, start + pageSize);
  }, [filteredSortedAssets, page]);
  const inventoryStats = useMemo(() => {
    const total = filteredSortedAssets.length;
    const available = filteredSortedAssets.filter((a) => a.status === 'available').length;
    const allocated = filteredSortedAssets.filter((a) => a.status === 'allocated').length;
    const uniqueBrands = new Set(filteredSortedAssets.map((a) => a.brand_name).filter(Boolean)).size;
    return { total, available, allocated, uniqueBrands };
  }, [filteredSortedAssets]);

  useEffect(() => {
    setPage(1);
  }, [inventoryQuery, filterStatus, filterBrand, filterType, sortBy, sortDir]);

  const navItems = [
    { key: 'overview', label: 'Overview', icon: 'OV' },
    { key: 'inventory', label: 'Inventory', icon: 'IN' },
    { key: 'assignments', label: 'Assignments', icon: 'AS' },
    { key: 'insights', label: 'Insights', icon: 'IS' },
    { key: 'activity', label: 'Recent Activity', icon: 'RA' }
  ];

  function resetInventoryFilters() {
    setInventoryQuery('');
    setFilterStatus('all');
    setFilterBrand('all');
    setFilterType('all');
    setSortBy('name');
    setSortDir('asc');
  }

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
            <div className="inventory-head">
              <div>
                <h3>Asset Inventory</h3>
                <p className="hint">Structured registry for all devices across brand, model, and lifecycle state.</p>
              </div>
              <div className="inventory-head-actions">
                <button type="button" className="outline" onClick={resetInventoryFilters}>Reset Filters</button>
                <button
                  type="button"
                  className="outline"
                  onClick={() => {
                    const header = ['Asset', 'Type', 'Brand', 'Model', 'Serial', 'Status'];
                    const rows = filteredSortedAssets.map((a) => [
                      a.name || '',
                      a.type || '',
                      a.brand_name || '',
                      a.model_name || '',
                      a.serial || '',
                      a.status || ''
                    ]);
                    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'inventory_export.csv');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="inventory-filter-grid">
              <input
                className="inventory-search"
                placeholder="Search by asset, serial, brand, model, status..."
                value={inventoryQuery}
                onChange={(e) => setInventoryQuery(e.target.value)}
              />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="allocated">Allocated</option>
              </select>
              <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
                <option value="all">All Brands</option>
                {inventoryBrands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                {inventoryTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="brand_name">Sort by Brand</option>
                <option value="model_name">Sort by Model</option>
                <option value="serial">Sort by Serial</option>
                <option value="status">Sort by Status</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            <div className="inventory-mini-stats inventory-mini-stats-strong">
              <article><span>Filtered Total</span><strong>{inventoryStats.total}</strong></article>
              <article><span>Available</span><strong>{inventoryStats.available}</strong></article>
              <article><span>Allocated</span><strong>{inventoryStats.allocated}</strong></article>
              <article><span>Brands</span><strong>{inventoryStats.uniqueBrands}</strong></article>
            </div>

            <div className="inventory-table-shell">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Asset</th><th>Type</th><th>Brand</th><th>Model</th><th>Serial</th><th>Status</th></tr></thead>
                  <tbody>
                    {paginatedAssets.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td><td>{a.type}</td><td>{a.brand_name || '-'}</td><td>{a.model_name || '-'}</td><td>{a.serial}</td>
                        <td><span className={`status ${a.status}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="inventory-pager">
                <button type="button" className="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>Page {page} of {totalPages} | Showing {paginatedAssets.length} items</span>
                <button type="button" className="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
            {user.role === 'admin' && (
              <div className="create-box">
                <h4>Add New Asset</h4>
                <form onSubmit={createAsset} className="form inline-form">
                  <select
                    name="type"
                    value={selectedAssetType}
                    onChange={(e) => {
                      setSelectedAssetType(e.target.value);
                      setSelectedBrandId('');
                      setSelectedAssetName('');
                    }}
                    required
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    name="brand_id"
                    value={selectedBrandId}
                    onChange={(e) => {
                      setSelectedBrandId(e.target.value);
                      setSelectedAssetName('');
                    }}
                  >
                    <option value="">{`Select ${selectedAssetType} brand`}</option>
                    {brandsBySelectedType.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <select
                    name="name"
                    value={selectedAssetName}
                    onChange={(e) => setSelectedAssetName(e.target.value)}
                    required
                  >
                    <option value="">Select asset name</option>
                    {assetNameOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <select name="model_id" disabled={!selectedBrandId}>
                    <option value="">
                      {selectedBrandId
                        ? `Select ${selectedAssetType} model`
                        : 'Select brand first'}
                    </option>
                    {selectedBrandModelsByType.map((m) => (
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
          <>
            <section className="inventory-mini-stats assignment-stats">
              <article><span>Available To Assign</span><strong>{availableAssets.length}</strong></article>
              <article><span>Active Assignments</span><strong>{activeAllocations.length}</strong></article>
              <article><span>Employees With Devices</span><strong>{assignedUsersCount}</strong></article>
              <article><span>Total Employees</span><strong>{employees.length}</strong></article>
            </section>
            <section className="grid assignments-grid">
              <section className="panel">
                <div className="panel-head"><h3>Assign Laptop / Device</h3><span>IT handover flow</span></div>
                <p className="hint">IT personnel can assign available devices to employees. Add note for purpose or ticket.</p>
                <form onSubmit={allocate} className="form">
                  <label>Available Asset</label>
                  <select name="asset" required>
                    {availableAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serial})</option>
                    ))}
                  </select>
                  <label>Employee</label>
                  <select name="user" required>
                    {employees.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <label>Notes (optional)</label>
                  <input name="notes" placeholder="Reason, team, project, ticket..." />
                  <button type="submit">Assign Asset</button>
                </form>

                <div className="create-box">
                  <h4>Employee Load Snapshot</h4>
                  <ul className="list plain">
                    {employeeLoad.slice(0, 5).map((e) => (
                      <li key={e.id}><span>{e.name}</span><strong>{e.assigned}</strong></li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Employee Assignment Queue</h3><span>{assignmentRows.length} active</span></div>
                <div className="inventory-filter-grid assignment-filters">
                  <input
                    className="inventory-search"
                    placeholder="Search by employee, asset, serial"
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                  />
                  <select value={assignmentUserFilter} onChange={(e) => setAssignmentUserFilter(e.target.value)}>
                    <option value="all">All Employees</option>
                    {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Asset</th><th>Employee</th><th>Assigned At</th><th>Action</th></tr></thead>
                    <tbody>
                      {assignmentRows.map((a) => (
                        <tr key={a.id}>
                          <td>{assetById[a.asset_id]?.name || `Asset ${a.asset_id}`}</td>
                          <td>{userById[a.user_id]?.name || `User ${a.user_id}`}</td>
                          <td>{new Date(a.allocated_at).toLocaleString()}</td>
                          <td>
                            <button className="small" onClick={() => returnAsset(a.id)}>Return</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </>
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
