import React, { useEffect, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API || '';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [page, setPage] = useState('home');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const carouselImages = [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=60',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=60',
    'https://images.unsplash.com/photo-1545235617-9465f9f5b4e6?auto=format&fit=crop&w=1400&q=60'
  ];
  const [carouselIndex, setCarouselIndex] = useState(0);

    useEffect(() => {
      if (token) {
        fetchAssets();
        fetchUsers();
        fetchAllocations();
      }
      // carousel rotation when not logged in
      if (!user) {
        const t = setInterval(() => setCarouselIndex(i => (i + 1) % carouselImages.length), 4000);
        return () => clearInterval(t);
      }
    }, [token]);

    function authHeaders() {
      return token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    function fetchAssets() {
      fetch(API + '/api/assets').then(r => r.json()).then(setAssets);
    }

    function fetchUsers() {
      fetch(API + '/api/users').then(r => r.json()).then(setUsers);
    }

    function fetchAllocations() {
      fetch(API + '/api/allocations', { headers: authHeaders() }).then(r => r.json()).then(setAllocations);
    }

    async function login(e) {
      e.preventDefault();
      setLoading(true);
      const email = e.target.email.value;
      const password = e.target.password.value;
      try {
        const res = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
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
      const res = await fetch(API + '/api/allocations', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ asset_id, user_id }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(body.error || 'Allocation failed'); else setMessage('Allocated');
      fetchAssets();
      fetchAllocations();
    }

    async function createStore(e) {
      e.preventDefault();
      const name = e.target.name.value; const location = e.target.location.value;
      const res = await fetch(API + '/api/stores', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, location }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(body.error || 'Create store failed'); else setMessage('Store created');
      fetchAssets();
    }

    function logout() {
      setToken(''); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setMessage('Logged out');
    }

    if (!user) {
    return (
      <div className="App">
        <div className="App-header login-mode">
          <div className="login-container">
            <div className="login-card card">
              <div className="card-inner">
                <div className="login-left">
                  <img src={carouselImages[carouselIndex]} alt="carousel" />
                  <div className="carousel-caption">
                    <h3>Company IT Assets</h3>
                    <p>Track devices, allocate to users, and manage stores efficiently.</p>
                  </div>
                </div>
                <div className="login-right">
                  <div className="login-card-inner">
                    <h2>Welcome back</h2>
                    <p className="small">Sign in to access the asset dashboard</p>
                    <form onSubmit={login} className="form-modern" autoComplete="on">
                      <div className="form-row">
                        <div className="form-field">
                          <input id="email" name="email" type="email" placeholder=" " defaultValue="alice@example.com" required />
                          <label htmlFor="email">Email</label>
                          <svg className="form-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.5L12 13l9-4.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-field">
                          <input id="password" name="password" type="password" placeholder=" " defaultValue="password" required />
                          <label htmlFor="password">Password</label>
                          <svg className="form-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="10" rx="2" stroke="#6b7280" strokeWidth="1.5"/><path d="M7 11V8a5 5 0 0110 0v3" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>

                      <div className="form-row flex-between">
                        <label className="remember"><input type="checkbox" name="remember" defaultChecked /> Remember me</label>
                        <a className="forgot" href="#">Forgot?</a>
                      </div>

                      <div className="form-row">
                        <button type="submit" className="btn-primary" disabled={loading}>
                          {loading ? (
                            <span className="btn-spinner" aria-hidden="true"></span>
                          ) : (
                            <svg style={{verticalAlign:'middle',marginRight:8}} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 11v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="11" width="18" height="10" rx="2" stroke="#fff" strokeWidth="1.5"/><path d="M7 11V8a5 5 0 0110 0v3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                          <span style={{verticalAlign:'middle'}}>{loading ? 'Signing in...' : 'Sign in'}</span>
                        </button>
                      </div>
                    </form>
                    <p className="small">Use seeded accounts: alice@example.com / password</p>
                    <p>{message}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

    return (
    <div className="App">
      <div className="App-header">
          <div className="sidebar">
            <h2>Dashboard</h2>
            <div className="small">Signed in as {user.name} ({user.role})</div>
            <button onClick={() => setPage('home')}>Overview</button>
            <button onClick={() => setPage('allocate')}>Allocate</button>
            <button onClick={() => setPage('history')}>Allocations</button>
            <button onClick={() => setPage('stores')}>Stores</button>
            {user.role === 'admin' && <button onClick={() => setPage('users')}>Users</button>}
            <div style={{marginTop:12}}><button onClick={logout}>Logout</button></div>
          </div>

          <div className="main">
            {page === 'home' && (
              <div className="card">
                <h3>Overview</h3>
                <p className="small">Assets: {assets.length} — Allocations: {allocations.length}</p>
                <ul className="list">{assets.map(a => <li key={a.id}>{a.name} — {a.type} — {a.status}</li>)}</ul>
              </div>
            )}

            {page === 'allocate' && (
              <div className="card">
                <h3>Allocate Asset</h3>
                <form onSubmit={allocate}>
                  <div><select name="asset">{assets.filter(a => a.status === 'available').map(a => <option key={a.id} value={a.id}>{a.name} ({a.serial})</option>)}</select></div>
                  <div><select name="user">{users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
                  <div style={{marginTop:8}}><button>Allocate</button></div>
                </form>
              </div>
            )}

            {page === 'history' && (
              <div className="card">
                <h3>Allocations</h3>
                <ul className="list">{allocations.map(a => <li key={a.id}>Asset {a.asset_id} → User {a.user_id} at {a.allocated_at} {a.returned_at ? `(returned ${a.returned_at})` : ''}</li>)}</ul>
              </div>
            )}

            {page === 'stores' && (
              <div className="card">
                <h3>Stores</h3>
                <form onSubmit={createStore}><div><input name="name" placeholder="name"/></div><div><input name="location" placeholder="location"/></div><div style={{marginTop:8}}><button>Create store</button></div></form>
                <p className="small">(List of stores will appear here)</p>
              </div>
            )}

            {page === 'users' && user.role === 'admin' && (
              <div className="card">
                <h3>Users</h3>
                <ul className="list">{users.map(u => <li key={u.id}>{u.name} — {u.email} — {u.role}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  export default App;
