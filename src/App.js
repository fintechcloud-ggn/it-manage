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
  const [authView, setAuthView] = useState(() => (
    localStorage.getItem('token') && localStorage.getItem('user') ? 'app' : 'landing'
  ));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [landingScrollProgress, setLandingScrollProgress] = useState(0);
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

  useEffect(() => {
    if (authView !== 'landing' || user) return undefined;
    const nodes = document.querySelectorAll('.reveal-on-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [authView, user]);

  useEffect(() => {
    if (authView !== 'landing' || user) return undefined;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const vh = Math.max(window.innerHeight, 1);
        const next = Math.max(0, Math.min(window.scrollY / vh, 1.4));
        setLandingScrollProgress(next);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [authView, user]);

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
      setAuthView('app');
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
    setAuthView('landing');
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
  const branchMix = [
    { name: 'Gurgaon HQ', pct: 19 },
    { name: 'Mumbai', pct: 15 },
    { name: 'Bengaluru', pct: 13 },
    { name: 'Pune', pct: 12 },
    { name: 'Delhi', pct: 11 },
    { name: 'Hyderabad', pct: 10 },
    { name: 'Chennai', pct: 9 },
  ];

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

  const weeklySeries = useMemo(() => {
    return weeklyAssignments.map((d, i) => ({
      ...d,
      gross: d.count * 7 + (i % 3) * 4 + 10,
      revenue: d.count * 9 + ((i + 1) % 4) * 5 + 8,
    }));
  }, [weeklyAssignments]);
  const maxWeeklySeries = Math.max(
    ...weeklySeries.map((d) => Math.max(d.gross, d.revenue)),
    1
  );
  const donutColors = ['#6c63ff', '#4f7cff', '#5cb8ff', '#6de0b4', '#ff8b5c', '#f9cf58'];
  const donutTotal = Math.max(topAssetTypes.reduce((sum, [, count]) => sum + count, 0), 1);
  const donutGradient = topAssetTypes
    .map(([, count], idx) => ({ pct: Math.round((count / donutTotal) * 100), color: donutColors[idx % donutColors.length] }))
    .reduce((acc, item, idx, arr) => {
      const from = arr.slice(0, idx).reduce((s, x) => s + x.pct, 0);
      const to = from + item.pct;
      acc.push(`${item.color} ${from}% ${to}%`);
      return acc;
    }, [])
    .join(', ');
  const selectedBrandModels = useMemo(() => {
    const brand = brands.find((b) => b.id === Number(selectedBrandId));
    return brand ? brand.models : [];
  }, [brands, selectedBrandId]);
  const selectedBrandModelsByType = useMemo(() => {
    return selectedBrandModels.filter(
      (m) => (m.category || '').toLowerCase() === selectedAssetType.toLowerCase(),
    );
  }, [selectedBrandModels, selectedAssetType]);
  const selectedBrandName = useMemo(() => {
    const brand = brands.find((b) => String(b.id) === String(selectedBrandId));
    return brand?.name || '';
  }, [brands, selectedBrandId]);
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
    { key: 'overview', label: 'Overview', icon: 'DB' },
    { key: 'inventory', label: 'Inventory', icon: 'IV' },
    { key: 'assignments', label: 'Assignments', icon: 'AS' },
    { key: 'insights', label: 'Insights', icon: 'IN' },
    { key: 'activity', label: 'Recent Activity', icon: 'AC' }
  ];

  function resetInventoryFilters() {
    setInventoryQuery('');
    setFilterStatus('all');
    setFilterBrand('all');
    setFilterType('all');
    setSortBy('name');
    setSortDir('asc');
  }

  const landingMotion = useMemo(() => {
    const p = landingScrollProgress;
    return {
      copyOpacity: Math.max(0, 1 - p * 1.12),
      copyScale: 1 + p * 0.14,
      copyY: p * 170,
      visualOpacity: Math.max(0, 1 - p * 1.02),
      visualScale: 1 + p * 0.22,
      visualY: p * 145,
      visualBlur: p * 5.5
    };
  }, [landingScrollProgress]);

  const partnerLogos = [
    { name: 'Microsoft', href: 'https://www.microsoft.com', logo: 'https://cdn.simpleicons.org/microsoft/ffffff' },
    { name: 'Google', href: 'https://www.google.com', logo: 'https://cdn.simpleicons.org/google/ffffff' },
    { name: 'Amazon', href: 'https://www.amazon.com', logo: 'https://cdn.simpleicons.org/amazon/ffffff' },
    { name: 'PayPal', href: 'https://www.paypal.com', logo: 'https://cdn.simpleicons.org/paypal/ffffff' },
    { name: 'Apple', href: 'https://www.apple.com', logo: 'https://cdn.simpleicons.org/apple/ffffff' },
    { name: 'Samsung', href: 'https://www.samsung.com', logo: 'https://cdn.simpleicons.org/samsung/ffffff' },
  ];

  if (!user) {
    if (authView === 'landing') {
      return (
        <div id="wk-top" className="wk-page">
          <div className="wk-announce">Modern inventory workflow for fintech IT teams</div>
          <header className="wk-nav">
            <div className="wk-logo">BranchGrid</div>
            <nav>
              <a href="#wk-features">Product</a>
              <a href="#wk-proof">Why BranchGrid</a>
              <a href="#wk-reasons">Resources</a>
              <a href="#contact">Contact</a>
            </nav>
            <div className="wk-nav-actions">
              <button type="button" className="wk-ghost" onClick={() => setAuthView('login')}>Log in</button>
              <button type="button" onClick={() => setAuthView('login')}>Get Started</button>
            </div>
          </header>

          <section className="wk-hero">
            <span className="wk-dot dot-a" />
            <span className="wk-dot dot-b" />
            <span className="wk-dot dot-c" />
            <div className="wk-hero-copy reveal-on-scroll" style={{ opacity: landingMotion.copyOpacity }}>
              <h1>Big ideas. Amazing talent. One modern IT inventory workflow.</h1>
              <p>Find, assign, and manage assets for every person, team, and branch without operational delays.</p>
              <div className="wk-hero-actions">
                <button type="button" onClick={() => setAuthView('login')}>Book a demo</button>
                <a href="#wk-features">Learn more</a>
              </div>
            </div>
            <div
              className="wk-hero-art reveal-on-scroll"
              style={{
                opacity: landingMotion.visualOpacity,
                transform: `translateY(${landingMotion.visualY * 0.15}px) scale(${1 + landingMotion.visualScale * 0.02})`
              }}
            >
              <img
                className="wk-hero-people"
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=80"
                alt="IT team collaborating"
              />
              <div className="wk-blob wk-blob-a" />
              <div className="wk-blob wk-blob-b" />
              <div className="wk-blob wk-blob-c" />
              <div className="wk-card wk-card-a">Asset Tracking</div>
              <div className="wk-card wk-card-b">Employee Assignments</div>
            </div>
          </section>

          <section id="wk-features" className="wk-features">
            <h2 className="reveal-on-scroll">Manage your entire process from sourcing to onboarding.</h2>
            <div className="wk-feature-grid">
              <article className="wk-feature-card reveal-on-scroll">
                <img className="wk-shot" src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80" alt="Procurement dashboard" />
                <small>SOURCE & ATTRACT</small>
                <h3>Source & Attract</h3>
                <p>Maintain procurement and intake pipelines with clear branch ownership from day one.</p>
                <a href="#wk-proof">Learn more</a>
              </article>
              <article className="wk-feature-card reveal-on-scroll">
                <img className="wk-shot" src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80" alt="Collaboration workspace" />
                <small>EVALUATE & COLLABORATE</small>
                <h3>Evaluate & Collaborate</h3>
                <p>Route requests to IT approvers, managers and ops teams with shared live status.</p>
                <a href="#wk-proof">Learn more</a>
              </article>
              <article className="wk-feature-card reveal-on-scroll">
                <img className="wk-shot" src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80" alt="Automation analytics" />
                <small>AUTOMATE & HIRE</small>
                <h3>Automate & Hire</h3>
                <p>Automate standard assignment actions and reduce handover cycle time.</p>
                <a href="#wk-proof">Learn more</a>
              </article>
              <article className="wk-feature-card reveal-on-scroll">
                <img className="wk-shot" src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80" alt="Employee onboarding" />
                <small>ONBOARD & MANAGE</small>
                <h3>Onboard & Manage</h3>
                <p>Deliver devices faster and keep complete lifecycle history for every employee.</p>
                <a href="#wk-proof">Learn more</a>
              </article>
            </div>
          </section>

          <section id="wk-proof" className="wk-proof">
            <div className="wk-proof-wave" />
            <div className="wk-proof-grid">
              <div className="wk-proof-copy reveal-on-scroll">
                <h2>Where great companies run great IT operations.</h2>
                <p>From branch onboarding to return audits, teams trust one system for visibility and control.</p>
                <div className="wk-map" />
                <ul>
                  <li><strong>27,000</strong><span>Companies</span></li>
                  <li><strong>1,500,000</strong><span>Assignments</span></li>
                  <li><strong>160,000,000</strong><span>Assets Tracked</span></li>
                </ul>
              </div>
              <div className="wk-proof-panel reveal-on-scroll">
                <h3>Navarro reduces IT handover time by 50%</h3>
                <p>“BranchGrid gave us one consistent workflow across all branches. We now close assignments in hours, not days.”</p>
                <img
                  className="wk-proof-image"
                  src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=900&q=80"
                  alt="Customer success team"
                />
              </div>
            </div>
          </section>

          <section id="wk-reasons" className="wk-reasons">
            <h2 className="reveal-on-scroll">More reasons companies choose BranchGrid</h2>
            <div className="wk-reason-grid">
              <article className="reveal-on-scroll"><h4>World-class support</h4><p>High-touch onboarding and responsive support from experts.</p></article>
              <article className="reveal-on-scroll"><h4>Fast global support</h4><p>Assistance across regions for distributed teams and branch admins.</p></article>
              <article className="reveal-on-scroll"><h4>Reliable security</h4><p>Role controls and audit-ready operational records by default.</p></article>
              <article className="reveal-on-scroll"><h4>Anywhere workflow</h4><p>Operate inventory, assignments, and returns from one platform.</p></article>
              <article className="reveal-on-scroll"><h4>Expert service</h4><p>Guided configuration and migration support for IT teams.</p></article>
              <article className="reveal-on-scroll"><h4>Assisted onboarding</h4><p>Bring teams live quickly with proven rollout templates.</p></article>
            </div>
          </section>

          <section className="wk-cta">
            <h2 className="reveal-on-scroll">Let’s grow together</h2>
            <p className="reveal-on-scroll">Explore our platform and discover how to run cleaner, faster inventory operations.</p>
            <button type="button" className="reveal-on-scroll" onClick={() => setAuthView('login')}>Try it free</button>
            <img
              className="wk-cta-image reveal-on-scroll"
              src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"
              alt="IT professionals working together"
            />
          </section>

          <section className="wk-awards">
            <div className="wk-award">Top 50</div>
            <div className="wk-award">Best Support</div>
            <div className="wk-award">Customer Choice</div>
            <div className="wk-award">Top Rated</div>
            <div className="wk-award">Industry Leader</div>
          </section>

          <footer id="contact" className="wk-footer">
            <div className="wk-footer-top">
              <div className="wk-footer-brand">
                <strong>BranchGrid</strong>
                <p>IT inventory operations platform for fintech teams across branches and sub-entities.</p>
                <div className="wk-socials">
                  <a href="#contact">f</a>
                  <a href="#contact">in</a>
                  <a href="#contact">x</a>
                  <a href="#contact">ig</a>
                </div>
              </div>
              <div className="wk-footer-news">
                <h5>Join our newsletter</h5>
                <p>Get product updates, release notes, and IT operations playbooks.</p>
                <div className="wk-news-input">
                  <input type="email" placeholder="Enter work email" />
                  <button type="button">Join</button>
                </div>
              </div>
            </div>

            <div className="wk-footer-cols">
              <div>
                <h5>Product</h5>
                <a href="#wk-features">Inventory</a>
                <a href="#wk-features">Assignments</a>
                <a href="#wk-proof">Analytics</a>
              </div>
              <div>
                <h5>Platform</h5>
                <a href="#wk-proof">Security</a>
                <a href="#wk-proof">Compliance</a>
                <a href="#wk-reasons">Support</a>
              </div>
              <div>
                <h5>Company</h5>
                <a href="#wk-top">About</a>
                <a href="#contact">Contact</a>
                <a href="#wk-reasons">Resources</a>
              </div>
              <div>
                <h5>Social</h5>
                <a href="#contact">Facebook</a>
                <a href="#contact">LinkedIn</a>
                <a href="#contact">Instagram</a>
              </div>
            </div>
            <div className="wk-footer-logos">
              {partnerLogos.map((item) => (
                <a key={item.name} href={item.href} target="_blank" rel="noreferrer" title={item.name}>
                  <img src={item.logo} alt={`${item.name} logo`} />
                  <span>{item.name}</span>
                </a>
              ))}
            </div>
            <div className="wk-footer-bottom">
              <a className="wk-store" href="https://www.apple.com/app-store/" target="_blank" rel="noreferrer">
                <img src="https://img.shields.io/badge/App%20Store-Download-0A84FF?style=for-the-badge&logo=apple&logoColor=white" alt="Download on App Store" />
              </a>
              <a className="wk-store" href="https://play.google.com/store" target="_blank" rel="noreferrer">
                <img src="https://img.shields.io/badge/Google%20Play-Get%20it-34A853?style=for-the-badge&logo=googleplay&logoColor=white" alt="Get it on Google Play" />
              </a>
              <div className="wk-legal-links">
                <a href="#contact">Privacy</a>
                <a href="#contact">Terms</a>
                <a href="#contact">Security</a>
              </div>
            </div>
            <div className="wk-footer-meta">
              <p className="wk-address">Gurgaon Sector 18, Udyog Vihar Phase 4</p>
              <p className="wk-support">support@branchgrid.io | +91 124 400 2211</p>
            </div>
          </footer>
        </div>
      );
    }

    return (
      <div className="auth-screen">
        <div className="auth-shell">
          <section className="auth-brand-panel">
            <div className="shape shape-a" />
            <div className="shape shape-b" />
            <div className="shape shape-c" />
            <div className="shape shape-d" />
            <div className="auth-brand-copy">
              <p className="label">BranchGrid</p>
              <h2>IT Inventory</h2>
              <span>Stay organized</span>
            </div>
          </section>

          <section className="auth-form-panel">
            <button type="button" className="auth-back" onClick={() => setAuthView('landing')}>Back to Landing</button>
            <h3>Hello!</h3>
            <p>Sign in to get started.</p>
            <form onSubmit={login} className="form auth-form-modern">
              <div className="input-shell">
                <span>U</span>
                <input id="email" name="email" type="text" defaultValue="admin" placeholder="Username" required />
              </div>
              <div className="input-shell">
                <span>P</span>
                <input id="password" name="password" type="password" defaultValue="admin" placeholder="Password" required />
              </div>
              <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            </form>
            <p className="hint">Default credentials: admin / admin</p>
            <p className="msg">{message}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          {!sidebarCollapsed && (
            <div className="sidebar-brand">
              <p className="label">IT Inventory</p>
              <h3>Dashboard</h3>
            </div>
          )}
          <button
            type="button"
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
              type="button"
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

        <button type="button" className="sidebar-logout" onClick={logout}>
          {sidebarCollapsed ? 'X' : 'Logout'}
        </button>
      </aside>

      <div className="inventory-app">
        {section === 'overview' && (
          <div className="overview-canvas">
            <section className="overview-headline">
              <div>
                <h3>Dashboard</h3>
                <p className="hint">Real-time IT inventory analytics across branches and entities.</p>
              </div>
              <div className="overview-period">Time period: Last 7 days</div>
            </section>

            <section className="overview-kpis">
              <article><span>Total assets</span><strong>{stats.total.toLocaleString()}</strong></article>
              <article><span>Allocated</span><strong>{stats.allocated.toLocaleString()}</strong></article>
              <article><span>Active assignments</span><strong>{stats.active.toLocaleString()}</strong></article>
              <article><span>Availability</span><strong>{availabilityRate}%</strong></article>
              <article className="kpi-add">+ Add data</article>
            </section>

            <section className="overview-chart-card">
              <div className="panel-head">
                <h3>Asset movement</h3>
                <span>
                  <i className="legend-dot gross" /> Gross margin
                  <i className="legend-dot revenue" /> Revenue
                </span>
              </div>
              <div className="dual-bars">
                {weeklySeries.map((d) => (
                  <div className="dual-col" key={d.key}>
                    <div className="dual-track">
                      <span className="bar gross" style={{ height: `${Math.round((d.gross / maxWeeklySeries) * 100)}%` }} />
                      <span className="bar revenue" style={{ height: `${Math.round((d.revenue / maxWeeklySeries) * 100)}%` }} />
                    </div>
                    <small>{d.label}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="overview-bottom-split">
              <section className="panel">
                <div className="panel-head"><h3>Asset category ring</h3><span>{topAssetType[0]} leading</span></div>
                <div className="category-donut-wrap">
                  <div className="category-donut" style={{ background: `conic-gradient(${donutGradient})` }}>
                    <div>
                      <strong>{stats.total}</strong>
                      <small>Total</small>
                    </div>
                  </div>
                  <ul className="category-list">
                    {topAssetTypes.map(([type, count], idx) => (
                      <li key={type}>
                        <span><i style={{ background: donutColors[idx % donutColors.length] }} /> {type}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Assets by branches</h3><span>{busiestUser.name} busiest user</span></div>
                <ul className="branch-list">
                  {branchMix.map((b) => (
                    <li key={b.name}>
                      <span>{b.name}</span>
                      <strong>{b.pct}%</strong>
                    </li>
                  ))}
                </ul>
                <div className="branch-note">
                  <span>Top Type: {topAssetType[0]} ({topAssetType[1]})</span>
                  <span>Availability: {availabilityRate}%</span>
                </div>
                <div className="branch-map-mock" />
              </section>
            </section>
          </div>
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
                <div className="create-head">
                  <div>
                    <h4>Add New Asset</h4>
                    <p className="hint">Register device details, brand/model mapping, and serial in one flow.</p>
                  </div>
                  <div className="create-meta">
                    <span>{selectedAssetType}</span>
                    <span>{brandsBySelectedType.length} brands</span>
                    <span>{selectedBrandId ? `${selectedBrandModelsByType.length} models` : 'Select brand'}</span>
                  </div>
                </div>
                <form onSubmit={createAsset} className="form asset-create-form">
                  <label className="field">
                    <span>Asset Type</span>
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
                  </label>
                  <label className="field">
                    <span>Brand</span>
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
                  </label>
                  <label className="field">
                    <span>Asset Name</span>
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
                  </label>
                  <label className="field">
                    <span>Model</span>
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
                  </label>
                  <label className="field">
                    <span>Serial Number</span>
                    <input name="serial" placeholder="e.g. SN-AX9-22190" required />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <input name="notes" placeholder="Branch, team, procurement, warranty..." />
                  </label>
                  <div className="create-actions">
                    <small>
                      {selectedBrandId
                        ? `Adding ${selectedAssetType}${selectedBrandName ? ` / ${selectedBrandName}` : ''}`
                        : `Choose a brand for ${selectedAssetType} to map exact models`}
                    </small>
                    <button type="submit">Add Asset</button>
                  </div>
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
