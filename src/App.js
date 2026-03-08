import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import LandingPage from './components/LandingPage';
import nextgenLogo from './assets/nextgen-logo.svg';


const API = process.env.REACT_APP_API || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '');
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

const ADMIN_PERMISSION_OPTIONS = [
  { key: 'overview.view', label: 'Overview' },
  { key: 'inventory.view', label: 'Inventory View' },
  { key: 'inventory.manage', label: 'Inventory Manage' },
  { key: 'assignments.view', label: 'Assignments View' },
  { key: 'assignments.manage', label: 'Assignments Manage' },
  { key: 'insights.view', label: 'Insights View' },
  { key: 'activity.view', label: 'Recent Activity View' },
  { key: 'accounts.manage', label: 'Account Management' }
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [authView, setAuthView] = useState(() => (
    localStorage.getItem('token') && localStorage.getItem('user') ? 'app' : 'landing'
  ));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stores, setStores] = useState([]);
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
  const [assignmentSearchDraft, setAssignmentSearchDraft] = useState('');
  const [assignmentUserFilter, setAssignmentUserFilter] = useState('all');
  const [quickAssignForm, setQuickAssignForm] = useState({
    userId: '',
    assetId: '',
    assetType: 'all',
    assetSearch: '',
    notes: ''
  });
  const [accountSearch, setAccountSearch] = useState('');
  const [createAdminPopupOpen, setCreateAdminPopupOpen] = useState(false);
  const [selectedAdminPermissionId, setSelectedAdminPermissionId] = useState(null);
  const [adminCreateForm, setAdminCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    permissions: ADMIN_PERMISSION_OPTIONS.map((item) => item.key)
  });
  const [adminPermissionDrafts, setAdminPermissionDrafts] = useState({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [employeeEditForm, setEmployeeEditForm] = useState({
    name: '',
    email: '',
    role: 'user',
    employmentStatus: 'active',
    leavingReason: ''
  });
  const [replacementForm, setReplacementForm] = useState({
    allocationId: '',
    replacementType: 'all',
    newAssetId: '',
    reason: 'Damaged',
    reasonDetail: ''
  });
  const [selectedAssetType, setSelectedAssetType] = useState('Laptop');
  const [selectedAssetName, setSelectedAssetName] = useState('');

  const isSuperAdmin = useMemo(
    () => !!user && String(user.email || '').toLowerCase() === 'admin',
    [user]
  );
  const userPermissions = useMemo(
    () => new Set(Array.isArray(user?.permissions) ? user.permissions : []),
    [user]
  );

  function hasAdminPermission(permissionKey) {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if ((user.role || '').toLowerCase() !== 'admin') return false;
    if (!userPermissions.size) return true;
    return userPermissions.has(permissionKey);
  }

  function canAccessSection(sectionKey) {
    const sectionPermissionMap = {
      overview: 'overview.view',
      inventory: 'inventory.view',
      assignments: 'assignments.view',
      insights: 'insights.view',
      activity: 'activity.view',
      accounts: 'accounts.manage'
    };
    const required = sectionPermissionMap[sectionKey];
    if (!required) return true;
    if ((user?.role || '').toLowerCase() !== 'admin') return true;
    return hasAdminPermission(required);
  }

  function normalizeAdminPermissions(inputPermissions) {
    const next = new Set((inputPermissions || []).map(String));
    if (next.has('inventory.manage')) next.add('inventory.view');
    if (next.has('assignments.manage')) next.add('assignments.view');
    return Array.from(next);
  }

  useEffect(() => {
    if (!token) return;
    fetchAssets();
    fetchUsers();
    fetchAllocations();
    fetchAuditLogs();
    fetchStores();
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
    if (authView !== 'login' || user) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setAuthView('landing');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authView, user]);

  function authHeaders() {
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  function handleUnauthorized(status) {
    if (status !== 401) return false;
    setToken('');
    setUser(null);
    setAuditLogs([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthView('login');
    setMessage('Session expired or unauthorized. Please login again as admin.');
    return true;
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
    fetch(`${API}/api/users`, { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`users_${r.status}`);
        return r.json();
      })
      .then(setUsers)
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setMessage('Unable to load users from server.');
      });
  }

  function fetchAllocations() {
    fetch(`${API}/api/allocations`, { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`allocations_${r.status}`);
        return r.json();
      })
      .then(setAllocations)
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setMessage('Unable to load allocations from server.');
      });
  }

  function fetchAuditLogs() {
    fetch(`${API}/api/audit-logs?limit=150`, { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`audit_${r.status}`);
        return r.json();
      })
      .then(setAuditLogs)
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setAuditLogs([]);
      });
  }

  function fetchStores() {
    fetch(`${API}/api/stores`, { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`stores_${r.status}`);
        return r.json();
      })
      .then(setStores)
      .catch(() => setStores([]));
  }

  function fetchBrands() {
    fetch(`${API}/api/brands`, { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`brands_${r.status}`);
        return r.json();
      })
      .then(setBrands)
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setMessage('Unable to load brands/models from server.');
      });
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
    setAuditLogs([]);
    setAuthView('landing');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMessage('');
  }

  async function allocate(e) {
    e.preventDefault();
    const asset_id = Number(quickAssignForm.assetId);
    const user_id = Number(quickAssignForm.userId);
    const notes = quickAssignForm.notes.trim();
    if (!asset_id || !user_id) {
      setMessage('Select employee and available asset to assign');
      return;
    }
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
      fetchAuditLogs();
      setQuickAssignForm((prev) => ({
        ...prev,
        assetId: '',
        assetType: 'all',
        assetSearch: '',
        notes: ''
      }));
    }
  }

  async function returnAsset(allocationId, returnContext = null) {
    const res = await fetch(`${API}/api/allocations/${allocationId}/return`, {
      method: 'PUT',
      headers: authHeaders(),
      body: returnContext ? JSON.stringify(returnContext) : undefined
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset returned successfully' : body.error || 'Return failed');
    if (res.ok) {
      fetchAssets();
      fetchAllocations();
      fetchAuditLogs();
    }
  }

  async function replaceEmployeeAsset(e) {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!replacementForm.allocationId || !replacementForm.newAssetId) {
      setMessage('Select current and replacement assets');
      return;
    }
    if (replacementForm.reason === 'Other' && !replacementForm.reasonDetail.trim()) {
      setMessage('Please provide a reason for Other');
      return;
    }
    const res = await fetch(`${API}/api/allocations/${replacementForm.allocationId}/replace`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        new_asset_id: Number(replacementForm.newAssetId),
        reason: replacementForm.reason,
        reason_detail: replacementForm.reasonDetail.trim() || null
      })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset replaced successfully' : body.error || 'Asset replacement failed');
    if (res.ok) {
      fetchAssets();
      fetchAllocations();
      fetchAuditLogs();
      setReplacementForm((prev) => ({
        ...prev,
        replacementType: 'all',
        newAssetId: '',
        reason: 'Damaged',
        reasonDetail: ''
      }));
    }
  }

  async function createAsset(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const type = e.target.type.value;
    const serial = e.target.serial.value;
    const vendor = e.target.vendor.value;
    const notes = e.target.notes.value;
    const brand_id = e.target.brand_id.value ? Number(e.target.brand_id.value) : null;
    const model_id = e.target.model_id.value ? Number(e.target.model_id.value) : null;
    const res = await fetch(`${API}/api/assets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, type, serial, vendor, notes, brand_id, model_id })
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken('');
      setUser(null);
      setAuditLogs([]);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setAuthView('login');
      setMessage('Session expired or unauthorized. Please login again as admin.');
      return;
    }
    if (res.status === 403) {
      setMessage('Only admin can create assets.');
      return;
    }
    setMessage(res.ok ? 'Asset created' : body.error || 'Create asset failed');
    if (res.ok) {
      fetchAssets();
      fetchAuditLogs();
      e.target.reset();
      setSelectedBrandId('');
      setSelectedAssetType('Laptop');
      setSelectedAssetName('');
    }
  }

  function buildAssetQrData(asset) {
    return JSON.stringify({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      serial: asset.serial
    });
  }

  function buildAssignedAssetQrData(asset, employee, assignmentAuditLog = null) {
    return JSON.stringify({
      allocationId: asset.id,
      employeeName: employee?.name || '-',
      employeeEmail: employee?.email || '-',
      assetName: asset.assetName,
      assetType: asset.type,
      serialNumber: asset.serial,
      assignedAt: asset.allocatedAt ? new Date(asset.allocatedAt).toISOString() : null,
      assignedByAdmin: assignmentAuditLog?.actor_name || 'Unknown',
      assignedByAdminId: assignmentAuditLog?.actor_user_id || null,
      assignedByRole: assignmentAuditLog?.actor_role || null
    });
  }

  function getQrImageUrl(data) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&margin=6&data=${encodeURIComponent(data)}`;
  }

  function printAssetQr(asset) {
    const qrData = buildAssetQrData(asset);
    const qrUrl = getQrImageUrl(qrData);
    const popup = window.open('', '_blank', 'width=420,height=520');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Asset QR Label</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; }
            .label { border: 2px solid #222; border-radius: 12px; padding: 16px; width: 280px; }
            h2 { margin: 0 0 6px; font-size: 18px; }
            p { margin: 4px 0; font-size: 13px; }
            img { margin-top: 12px; width: 128px; height: 128px; }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>${asset.name}</h2>
            <p><strong>Serial:</strong> ${asset.serial}</p>
            <p><strong>Type:</strong> ${asset.type || '-'}</p>
            <p><strong>Asset ID:</strong> ${asset.id}</p>
            <img src="${qrUrl}" alt="Asset QR code" />
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function printAssignedAssetQr(asset, employee, assignmentAuditLog = null) {
    const qrData = buildAssignedAssetQrData(asset, employee, assignmentAuditLog);
    const qrUrl = getQrImageUrl(qrData);
    const assignedAtText = asset.allocatedAt ? new Date(asset.allocatedAt).toLocaleString() : '-';
    const assignedBy = assignmentAuditLog?.actor_name || 'Unknown';
    const popup = window.open('', '_blank', 'width=780,height=360');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Assigned Asset QR</title>
          <style>
            @page { margin: 4mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 8px; color: #1d3247; }
            .label {
              border: 1.8px solid #1f3850;
              border-radius: 10px;
              padding: 8px;
              width: fit-content;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .qr-wrap { display: grid; place-items: center; min-width: 122px; }
            img { width: 118px; height: 118px; border: 1px solid #d5e2ee; border-radius: 6px; background: #fff; }
            .info { min-width: 300px; max-width: 460px; }
            h2 { margin: 0 0 4px; font-size: 16px; line-height: 1.2; }
            p { margin: 2px 0; font-size: 12px; line-height: 1.35; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr-wrap">
              <img src="${qrUrl}" alt="Assigned asset QR code" />
            </div>
            <div class="info">
              <h2>${asset.assetName}</h2>
              <p><strong>Serial:</strong> ${asset.serial || '-'}</p>
              <p><strong>Type:</strong> ${asset.type || '-'}</p>
              <p><strong>Assigned To:</strong> ${employee?.name || '-'} (${employee?.email || '-'})</p>
              <p><strong>Assigned At:</strong> ${assignedAtText}</p>
              <p><strong>Assigned By:</strong> ${assignedBy}</p>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function printEmployeeDetails() {
    if (!selectedEmployee) return;
    const popup = window.open('', '_blank', 'width=960,height=760');
    if (!popup) return;
    const assetRows = selectedEmployee.assignedAssets
      .map((asset) => `<tr><td>${asset.assetName}</td><td>${asset.type}</td><td>${asset.serial}</td><td>${asset.allocatedAt ? new Date(asset.allocatedAt).toLocaleString() : '-'}</td><td>${asset.notes || '-'}</td></tr>`)
      .join('');
    popup.document.write(`
      <html>
        <head>
          <title>Employee Assignment Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1a2e40; }
            h1 { margin-bottom: 6px; }
            p { margin: 4px 0; }
            .meta { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin: 16px 0; }
            .meta div { border: 1px solid #ccdbe7; border-radius: 10px; padding: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d8e3ec; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #f4f8fc; }
          </style>
        </head>
        <body>
          <h1>${selectedEmployee.name}</h1>
          <p>${selectedEmployee.email || '-'} | ${selectedEmployee.role || '-'}</p>
          <div class="meta">
            <div><strong>Current Assets</strong><p>${selectedEmployee.assignedCount}</p></div>
            <div><strong>Last Updated</strong><p>${selectedEmployeeLastUpdated}</p></div>
            <div><strong>Asset Types</strong><p>${selectedEmployeeAssetBreakdown.length}</p></div>
          </div>
          <h3>Assigned Assets</h3>
          <table>
            <thead><tr><th>Asset</th><th>Type</th><th>Serial</th><th>Assigned At</th><th>Notes</th></tr></thead>
            <tbody>${assetRows || '<tr><td colspan="5">No active assets assigned.</td></tr>'}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  async function updateEmployee(e) {
    e.preventDefault();
    if (!selectedEmployee) return;
    const payload = {
      name: employeeEditForm.name.trim(),
      email: employeeEditForm.email.trim(),
      role: (employeeEditForm.role || 'user').trim()
    };
    if (!payload.name || !payload.email) {
      setMessage('Name and email are required');
      return;
    }
    const res = await fetch(`${API}/api/users/${selectedEmployee.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Employee updated' : body.error || 'Employee update failed');
    if (res.ok) {
      const updatedUser = {
        id: body.id ?? selectedEmployee.id,
        name: body.name ?? payload.name,
        email: body.email ?? payload.email,
        role: body.role ?? payload.role,
        profile_image_url: body.profile_image_url ?? selectedEmployee.profile_image_url ?? null,
        permissions: Array.isArray(body.permissions) ? body.permissions : (selectedEmployee.permissions || []),
        is_super_admin: !!body.is_super_admin
      };
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
      if (user && Number(user.id) === Number(updatedUser.id)) {
        const mergedCurrentUser = { ...user, ...updatedUser };
        setUser(mergedCurrentUser);
        localStorage.setItem('user', JSON.stringify(mergedCurrentUser));
      }

      if (employeeEditForm.employmentStatus === 'leaving' && selectedEmployee.assignedAssets.length > 0) {
        const leavingDetail = employeeEditForm.leavingReason.trim() || 'Employee marked as leaving company';
        await Promise.all(
          selectedEmployee.assignedAssets.map((asset) =>
            fetch(`${API}/api/allocations/${asset.id}/return`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ reason: 'User Leaving', reason_detail: leavingDetail })
            })
          )
        );
        setMessage('Employee updated and active assets returned (User Leaving)');
      }

      setIsEditingEmployee(false);
      fetchUsers();
      fetchAssets();
      fetchAllocations();
      fetchAuditLogs();
    }
  }

  async function createAdminAccount(e) {
    e.preventDefault();
    if (!isSuperAdmin) {
      setMessage('Only super admin can create admin accounts.');
      return false;
    }
    const normalizedPermissions = normalizeAdminPermissions(adminCreateForm.permissions);
    if (!normalizedPermissions.length) {
      setMessage('Select at least one permission for admin account.');
      return false;
    }
    const payload = {
      name: adminCreateForm.name.trim(),
      email: adminCreateForm.email.trim(),
      password: adminCreateForm.password.trim() || 'password',
      permissions: normalizedPermissions
    };
    if (!payload.name || !payload.email) {
      setMessage('Admin name and email are required.');
      return;
    }
    const res = await fetch(`${API}/api/users/admin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken('');
      setUser(null);
      setAuditLogs([]);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setAuthView('login');
      setMessage('Session expired. Please login again.');
      return false;
    }
    setMessage(res.ok ? 'Admin account created successfully.' : body.error || 'Admin creation failed');
    if (res.ok) {
      setAdminCreateForm({
        name: '',
        email: '',
        password: '',
        permissions: ADMIN_PERMISSION_OPTIONS.map((item) => item.key)
      });
      fetchUsers();
      fetchAuditLogs();
      setCreateAdminPopupOpen(false);
    }
    return res.ok;
  }

  async function saveAdminPermissions(targetUserId) {
    if (!isSuperAdmin) {
      setMessage('Only super admin can update permissions.');
      return false;
    }
    const permissions = normalizeAdminPermissions(adminPermissionDrafts[targetUserId] || []);
    if (!permissions.length) {
      setMessage('Select at least one permission before saving.');
      return false;
    }
    const res = await fetch(`${API}/api/users/${targetUserId}/permissions`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ permissions })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Admin permissions updated.' : body.error || 'Permission update failed');
    if (res.ok) {
      fetchUsers();
      fetchAuditLogs();
    }
    return res.ok;
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
    const toMs = (msValue, dateValue) => {
      const fromMs = Number(msValue);
      if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
      const parsed = new Date(dateValue || '').getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const events = [];
    allocations.forEach((a) => {
      const assetName = assetById[a.asset_id]?.name || `Asset ${a.asset_id}`;
      const userName = userById[a.user_id]?.name || `User ${a.user_id}`;
      const allocatedMs = toMs(a.allocated_at_ms, a.allocated_at);
      if (allocatedMs > 0) {
        events.push({
          id: `alloc-${a.id}`,
          action: 'Allocated',
          allocationId: a.id,
          assetName,
          userName,
          timestampMs: allocatedMs
        });
      }
      const returnedMs = toMs(a.returned_at_ms, a.returned_at);
      if (returnedMs > 0) {
        events.push({
          id: `return-${a.id}`,
          action: 'Returned',
          allocationId: a.id,
          assetName,
          userName,
          timestampMs: returnedMs
        });
      }
    });
    return events.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 12);
  }, [allocations, assetById, userById]);
  const recentAuditLogs = useMemo(() => auditLogs.slice(0, 50), [auditLogs]);
  const allocationAssignAuditById = useMemo(() => {
    const byAllocation = {};
    auditLogs.forEach((log) => {
      if (log.entity_type !== 'allocation' || log.action !== 'ALLOCATE_ASSET' || !log.entity_id) return;
      if (!byAllocation[log.entity_id]) byAllocation[log.entity_id] = log;
    });
    return byAllocation;
  }, [auditLogs]);
  const activitySummary = useMemo(() => {
    const allocatedCount = recentActivity.filter((item) => item.action === 'Allocated').length;
    const returnedCount = recentActivity.filter((item) => item.action === 'Returned').length;
    const latestEvent = recentActivity[0] || null;
    const criticalActions = recentAuditLogs.filter((log) =>
      ['DELETE_ASSET', 'REPLACE_ASSET', 'RETURN_FOR_REPLACEMENT'].includes(log.action)
    ).length;
    return {
      allocatedCount,
      returnedCount,
      latestEvent,
      criticalActions,
      auditCount: recentAuditLogs.length
    };
  }, [recentActivity, recentAuditLogs]);

  function formatAuditAction(action) {
    return (action || '').replaceAll('_', ' ').trim() || 'UNKNOWN';
  }

  const topAssetType = assetTypes[0] || ['N/A', 0];
  const busiestUser = teamLoad[0] || { name: 'N/A', assigned: 0 };
  const availabilityRate = stats.total ? Math.round((stats.available / stats.total) * 100) : 0;
  const topAssetTypes = assetTypes.slice(0, 5);
  const storeCoverage = useMemo(() => {
    const byStore = {};
    assets.forEach((asset) => {
      const key = asset.store_id || 'unassigned';
      if (!byStore[key]) byStore[key] = 0;
      byStore[key] += 1;
    });
    const total = Math.max(assets.length, 1);
    return Object.entries(byStore)
      .map(([key, count]) => {
        const id = key === 'unassigned' ? null : Number(key);
        const storeName = id
          ? (stores.find((store) => store.id === id)?.name || `Store ${id}`)
          : 'Unassigned Store';
        return {
          id: key,
          name: storeName,
          count,
          pct: Math.round((count / total) * 100)
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [assets, stores]);

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

  const weeklyReturns = useMemo(() => {
    const days = [];
    const counts = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key });
      counts[key] = 0;
    }
    allocations.forEach((a) => {
      if (!a.returned_at) return;
      const parsed = new Date(a.returned_at || '');
      if (Number.isNaN(parsed.getTime())) return;
      const key = parsed.toISOString().slice(0, 10);
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return days.map((d) => ({ ...d, count: counts[d.key] || 0 }));
  }, [allocations]);
  const weeklySeries = useMemo(() => {
    return weeklyAssignments.map((d) => {
      const returnDay = weeklyReturns.find((r) => r.key === d.key);
      return {
        ...d,
        assigned: d.count,
        returned: returnDay?.count || 0
      };
    });
  }, [weeklyAssignments, weeklyReturns]);
  const maxWeeklySeries = Math.max(
    ...weeklySeries.map((d) => Math.max(d.assigned, d.returned)),
    1
  );
  const sevenDayAssignments = useMemo(
    () => weeklyAssignments.reduce((sum, day) => sum + day.count, 0),
    [weeklyAssignments]
  );
  const previousSevenDayAssignments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prevWindowStart = new Date(today);
    prevWindowStart.setDate(prevWindowStart.getDate() - 14);
    const prevWindowEnd = new Date(today);
    prevWindowEnd.setDate(prevWindowEnd.getDate() - 7);
    return allocations.filter((a) => {
      const allocatedAt = new Date(a.allocated_at || '');
      if (Number.isNaN(allocatedAt.getTime())) return false;
      return allocatedAt >= prevWindowStart && allocatedAt < prevWindowEnd;
    }).length;
  }, [allocations]);
  const weeklyDeltaPct = previousSevenDayAssignments
    ? Math.round(((sevenDayAssignments - previousSevenDayAssignments) / previousSevenDayAssignments) * 100)
    : (sevenDayAssignments > 0 ? 100 : 0);
  const averageDailyAssignments = Math.round((sevenDayAssignments / 7) * 10) / 10;
  const allocationCompletionRate = allocations.length
    ? Math.round((allocations.filter((a) => a.returned_at).length / allocations.length) * 100)
    : 0;
  const typeDistribution = topAssetTypes.map(([type, count]) => ({
    type,
    count,
    pct: stats.total ? Math.round((count / stats.total) * 100) : 0
  }));
  const topAssignees = teamLoad.slice(0, 5);
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
  const quickAssignTypeOptions = useMemo(
    () => Array.from(new Set(availableAssets.map((asset) => asset.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [availableAssets]
  );
  const quickAssignAssetOptions = useMemo(() => {
    const q = quickAssignForm.assetSearch.trim().toLowerCase();
    return availableAssets
      .filter((asset) => quickAssignForm.assetType === 'all' || (asset.type || '') === quickAssignForm.assetType)
      .filter((asset) => {
        if (!q) return true;
        const haystack = `${asset.name || ''} ${asset.serial || ''} ${asset.type || ''} ${asset.brand_name || ''} ${asset.model_name || ''}`;
        return haystack.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '') || (a.serial || '').localeCompare(b.serial || ''));
  }, [availableAssets, quickAssignForm.assetSearch, quickAssignForm.assetType]);
  const managedAdmins = useMemo(
    () => users.filter((u) => (u.role || '').toLowerCase() === 'admin' && !u.is_super_admin),
    [users]
  );
  const filteredManagedAdmins = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return managedAdmins;
    return managedAdmins.filter((admin) =>
      `${admin.name || ''} ${admin.email || ''}`.toLowerCase().includes(q)
    );
  }, [managedAdmins, accountSearch]);
  const selectedAdminPermissionUser = useMemo(
    () => managedAdmins.find((admin) => admin.id === selectedAdminPermissionId) || null,
    [managedAdmins, selectedAdminPermissionId]
  );
  const accountSummary = useMemo(() => {
    const totalAdmins = users.filter((u) => (u.role || '').toLowerCase() === 'admin').length;
    const totalManaged = managedAdmins.length;
    const fullyPrivileged = managedAdmins.filter((u) =>
      ADMIN_PERMISSION_OPTIONS.every((perm) => (u.permissions || []).includes(perm.key))
    ).length;
    const permissionCounts = managedAdmins.map((u) => (u.permissions || []).length);
    const maxPermissions = permissionCounts.length ? Math.max(...permissionCounts) : 0;
    const avgPermissions = permissionCounts.length
      ? Math.round((permissionCounts.reduce((sum, n) => sum + n, 0) / permissionCounts.length) * 10) / 10
      : 0;
    return { totalAdmins, totalManaged, fullyPrivileged, maxPermissions, avgPermissions };
  }, [users, managedAdmins]);
  const assignedUsersCount = useMemo(
    () => {
      const employeeIds = new Set(employees.map((e) => e.id));
      return new Set(activeAllocations.filter((a) => employeeIds.has(a.user_id)).map((a) => a.user_id)).size;
    },
    [activeAllocations, employees],
  );
  const employeeDirectory = useMemo(() => {
    return employees
      .map((emp) => {
        const assignedAssets = activeAllocations
          .filter((a) => a.user_id === emp.id)
          .map((a) => ({
            id: a.id,
            assetId: a.asset_id,
            allocatedAt: a.allocated_at,
            notes: a.notes || '',
            assetName: assetById[a.asset_id]?.name || `Asset ${a.asset_id}`,
            serial: assetById[a.asset_id]?.serial || '-',
            type: assetById[a.asset_id]?.type || '-'
          }));
        const latestAllocatedAt = assignedAssets.length
          ? assignedAssets
            .map((item) => new Date(item.allocatedAt || '').getTime())
            .filter((v) => !Number.isNaN(v))
            .sort((a, b) => b - a)[0]
          : null;
        return {
          ...emp,
          assignedAssets,
          assignedCount: assignedAssets.length,
          latestAllocatedAt: latestAllocatedAt ? new Date(latestAllocatedAt) : null
        };
      })
      .filter((emp) => assignmentUserFilter === 'all' || String(emp.id) === assignmentUserFilter)
      .filter((emp) => {
        const q = assignmentSearch.trim().toLowerCase();
        if (!q) return true;
        const assetsText = emp.assignedAssets.map((a) => `${a.assetName} ${a.serial} ${a.type}`).join(' ');
        return `${emp.name || ''} ${emp.email || ''} ${emp.role || ''} ${assetsText}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.assignedCount - a.assignedCount || (a.name || '').localeCompare(b.name || ''));
  }, [employees, activeAllocations, assetById, assignmentUserFilter, assignmentSearch]);
  const selectedEmployee = useMemo(
    () => employeeDirectory.find((emp) => emp.id === selectedEmployeeId) || null,
    [employeeDirectory, selectedEmployeeId]
  );
  const selectedEmployeeHistory = useMemo(() => {
    if (!selectedEmployee) return [];
    return allocations
      .filter((a) => a.user_id === selectedEmployee.id)
      .map((a) => ({
        ...a,
        assetName: assetById[a.asset_id]?.name || `Asset ${a.asset_id}`,
        serial: assetById[a.asset_id]?.serial || '-',
        type: assetById[a.asset_id]?.type || '-',
        status: a.returned_at ? 'Returned' : 'Allocated'
      }))
      .sort((a, b) => new Date(b.allocated_at || 0) - new Date(a.allocated_at || 0));
  }, [selectedEmployee, allocations, assetById]);
  const replacementAssetOptions = useMemo(() => {
    if (replacementForm.replacementType === 'all') return availableAssets;
    return availableAssets.filter((asset) => (asset.type || '') === replacementForm.replacementType);
  }, [availableAssets, replacementForm.replacementType]);
  useEffect(() => {
    if (employees.length === 0) {
      setQuickAssignForm((prev) => (prev.userId ? { ...prev, userId: '' } : prev));
      return;
    }
    setQuickAssignForm((prev) => {
      if (prev.userId && employees.some((emp) => String(emp.id) === String(prev.userId))) return prev;
      return { ...prev, userId: String(employees[0].id) };
    });
  }, [employees]);
  useEffect(() => {
    setQuickAssignForm((prev) => {
      if (!prev.assetId) return prev;
      const stillAvailable = quickAssignAssetOptions.some((asset) => String(asset.id) === String(prev.assetId));
      return stillAvailable ? prev : { ...prev, assetId: '' };
    });
  }, [quickAssignAssetOptions]);
  useEffect(() => {
    if (!selectedEmployee) return;
    setEmployeeEditForm({
      name: selectedEmployee.name || '',
      email: selectedEmployee.email || '',
      role: selectedEmployee.role || 'user',
      employmentStatus: 'active',
      leavingReason: ''
    });
    setIsEditingEmployee(false);
    setReplacementForm({
      allocationId: selectedEmployee.assignedAssets[0]?.id ? String(selectedEmployee.assignedAssets[0].id) : '',
      replacementType: 'all',
      newAssetId: '',
      reason: 'Damaged',
      reasonDetail: ''
    });
  }, [selectedEmployee]);
  useEffect(() => {
    const drafts = {};
    managedAdmins.forEach((admin) => {
      drafts[admin.id] = Array.isArray(admin.permissions) ? admin.permissions : [];
    });
    setAdminPermissionDrafts(drafts);
  }, [managedAdmins]);

  function hasDraftChanges(adminUser) {
    const current = new Set(Array.isArray(adminUser.permissions) ? adminUser.permissions : []);
    const draft = new Set(Array.isArray(adminPermissionDrafts[adminUser.id]) ? adminPermissionDrafts[adminUser.id] : []);
    if (current.size !== draft.size) return true;
    for (const key of current) if (!draft.has(key)) return true;
    return false;
  }

  function openAdminPermissionPopup(adminUser) {
    setAdminPermissionDrafts((prev) => ({
      ...prev,
      [adminUser.id]: Array.isArray(adminUser.permissions) ? adminUser.permissions : []
    }));
    setSelectedAdminPermissionId(adminUser.id);
  }
  function startQuickAssignForEmployee(employeeId) {
    setQuickAssignForm((prev) => ({ ...prev, userId: String(employeeId) }));
    const quickAssignPanel = document.getElementById('assignment-quick-form');
    if (quickAssignPanel) {
      quickAssignPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  const selectedEmployeeAssetBreakdown = useMemo(() => {
    if (!selectedEmployee) return [];
    const grouped = selectedEmployee.assignedAssets.reduce((acc, asset) => {
      const key = asset.type || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [selectedEmployee]);
  const selectedEmployeeLastUpdated = useMemo(() => {
    if (!selectedEmployee?.latestAllocatedAt) return '-';
    return selectedEmployee.latestAllocatedAt.toLocaleString();
  }, [selectedEmployee]);
  const selectedEmployeeReturnHistory = useMemo(
    () => selectedEmployeeHistory.filter((item) => item.returned_at),
    [selectedEmployeeHistory]
  );
  const selectedEmployeeReasonBreakdown = useMemo(() => {
    const bucket = {
      damaged: 0,
      notWorking: 0,
      userLeaving: 0,
      other: 0
    };
    selectedEmployeeReturnHistory.forEach((item) => {
      const note = (item.notes || '').toLowerCase();
      if (note.includes('damaged')) bucket.damaged += 1;
      else if (note.includes('not working')) bucket.notWorking += 1;
      else if (note.includes('user leaving')) bucket.userLeaving += 1;
      else bucket.other += 1;
    });
    return bucket;
  }, [selectedEmployeeReturnHistory]);
  const selectedEmployeeReplacementCount = useMemo(
    () => selectedEmployeeHistory.filter((item) => (item.notes || '').includes('Replacement for allocation')).length,
    [selectedEmployeeHistory]
  );
  const selectedEmployeeLatestNote = useMemo(() => {
    if (!selectedEmployee) return '-';
    const noted = selectedEmployee.assignedAssets.find((asset) => asset.notes);
    return noted?.notes || '-';
  }, [selectedEmployee]);
  const inventoryTypes = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.type).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const inventoryBrands = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.brand_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const filteredSortedAssets = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    const filtered = assets.filter((a) => {
      const matchQuery = !q || `${a.name || ''} ${a.type || ''} ${a.serial || ''} ${a.vendor || ''} ${a.brand_name || ''} ${a.model_name || ''} ${a.status || ''}`.toLowerCase().includes(q);
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
  const pageSize = 8;
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
  const assignmentKpiCards = useMemo(() => {
    const totalAssets = Math.max(stats.total, 1);
    const totalEmployees = Math.max(employees.length, 1);
    const availableCount = availableAssets.length;
    const activeCount = activeAllocations.length;
    const coveredCount = assignedUsersCount;
    return [
      {
        key: 'available',
        label: 'Available To Assign',
        value: availableCount.toLocaleString(),
        pct: Math.round((availableCount / totalAssets) * 100),
        hint: `${stats.total ? Math.round((availableCount / totalAssets) * 100) : 0}% of assets`
      },
      {
        key: 'active',
        label: 'Active Assignments',
        value: activeCount.toLocaleString(),
        pct: Math.round((activeCount / totalAssets) * 100),
        hint: `${stats.total ? Math.round((activeCount / totalAssets) * 100) : 0}% of assets`
      },
      {
        key: 'covered',
        label: 'Employees With Devices',
        value: coveredCount.toLocaleString(),
        pct: Math.round((coveredCount / totalEmployees) * 100),
        hint: `${totalEmployees ? Math.round((coveredCount / totalEmployees) * 100) : 0}% coverage`
      },
      {
        key: 'employees',
        label: 'Total Employees',
        value: employees.length.toLocaleString(),
        pct: 100,
        hint: 'Directory baseline'
      }
    ];
  }, [stats.total, availableAssets.length, activeAllocations.length, assignedUsersCount, employees.length]);

  useEffect(() => {
    setPage(1);
  }, [inventoryQuery, filterStatus, filterBrand, filterType, sortBy, sortDir]);

  const navItems = [
    { key: 'overview', label: 'Overview', icon: 'DB' },
    { key: 'inventory', label: 'Inventory', icon: 'IV' },
    { key: 'assignments', label: 'Assignments', icon: 'AS' },
    { key: 'insights', label: 'Insights', icon: 'IN' },
    { key: 'activity', label: 'Recent Activity', icon: 'AC' },
    { key: 'accounts', label: 'Account Management', icon: 'AM' }
  ].filter((item) => canAccessSection(item.key));

  useEffect(() => {
    if (!navItems.length) return;
    if (!navItems.some((item) => item.key === section)) {
      setSection(navItems[0].key);
    }
  }, [navItems, section]);

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
      <>
        {authView === 'landing' ? (
          <LandingPage onLogin={() => setAuthView('login')} />
        ) : (
          <div className="wk-page">
            <header className="wk-nav">
              <div className="wk-logo" onClick={() => setAuthView('landing')} style={{ cursor: 'pointer' }}>
                <img src={nextgenLogo} alt="NEXTGEN" className="wk-logo-image" />
              </div>
              <div className="wk-nav-actions">
                <button type="button" onClick={() => setAuthView('landing')}>Back to Home</button>
              </div>
            </header>
            <div className="auth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title">
              <div className="auth-modal-frame">
                <div className="auth-shell">
                  <section className="auth-brand-panel">
                    <div className="shape shape-a" />
                    <div className="shape shape-b" />
                    <div className="shape shape-c" />
                    <div className="shape shape-d" />
                    <div className="auth-brand-copy">
                      <img src={nextgenLogo} alt="NEXTGEN" className="auth-brand-logo" />
                      <h2>IT Inventory</h2>
                      <span>Stay organized</span>
                    </div>
                  </section>

                  <section className="auth-form-panel">
                    <button type="button" className="auth-back" onClick={() => setAuthView('landing')}>Back to Landing</button>
                    <h3 id="login-title">Hello!</h3>
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
                    <p className="msg">{message}</p>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
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
              <div className="overview-search">
                <input type="text" placeholder="Quick search assets, users, serial..." />
                <div className="overview-period">Time period: Last 7 days</div>
              </div>
            </section>

            <section className="overview-kpis kpis-overview">
              <article>
                <span>Total assets</span>
                <strong>{stats.total.toLocaleString()}</strong>
                <small className="kpi-trend neutral">{topAssetType[0]} is top category</small>
              </article>
              <article>
                <span>Active assignments</span>
                <strong>{stats.active.toLocaleString()}</strong>
                <small className={`kpi-trend ${weeklyDeltaPct >= 0 ? 'up' : 'down'}`}>
                  {weeklyDeltaPct >= 0 ? '+' : ''}{weeklyDeltaPct}% vs previous 7d
                </small>
              </article>
              <article>
                <span>Utilization</span>
                <strong>{stats.utilization}%</strong>
                <small className="kpi-trend neutral">{stats.allocated} of {stats.total} allocated</small>
              </article>
              <article>
                <span>Availability</span>
                <strong>{availabilityRate}%</strong>
                <small className="kpi-trend neutral">{stats.available} assets ready</small>
              </article>
              <article>
                <span>Avg/day assignments</span>
                <strong>{averageDailyAssignments}</strong>
                <small className="kpi-trend neutral">{sevenDayAssignments} in last 7 days</small>
              </article>
            </section>

            <section className="overview-main-grid">
              <section className="overview-chart-card panel chart-panel">
                <div className="panel-head">
                  <h3>Assignments vs Returns</h3>
                  <span>
                    <i className="legend-dot gross" /> Assignments
                    <i className="legend-dot revenue" /> Returns
                  </span>
                </div>
                <div className="dual-bars">
                  {weeklySeries.map((d) => (
                    <div className="dual-col" key={d.key}>
                      <div className="dual-track">
                        <span className="bar gross" style={{ height: `${Math.round((d.assigned / maxWeeklySeries) * 100)}%` }} />
                        <span className="bar revenue" style={{ height: `${Math.round((d.returned / maxWeeklySeries) * 100)}%` }} />
                      </div>
                      <small>{d.label}</small>
                    </div>
                  ))}
                </div>
                <div className="chart-meta">
                  <span>7-day assignments: {sevenDayAssignments}</span>
                  <span>Completion rate: {allocationCompletionRate}%</span>
                </div>
              </section>

              <section className="panel panel-capacity">
                <div className="panel-head"><h3>Operations snapshot</h3><span>Real-time load</span></div>
                <div className="capacity-list">
                  <div>
                    <div className="capacity-row">
                      <span>Assignment completion</span>
                      <strong>{allocationCompletionRate}%</strong>
                    </div>
                    <div className="meter"><span style={{ width: `${allocationCompletionRate}%` }} /></div>
                  </div>
                  <div>
                    <div className="capacity-row">
                      <span>Current utilization</span>
                      <strong>{stats.utilization}%</strong>
                    </div>
                    <div className="meter"><span style={{ width: `${stats.utilization}%` }} /></div>
                  </div>
                  <div>
                    <div className="capacity-row">
                      <span>Asset availability</span>
                      <strong>{availabilityRate}%</strong>
                    </div>
                    <div className="meter"><span style={{ width: `${availabilityRate}%` }} /></div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Recent assignment activity</h3><span>Latest 6 actions</span></div>
                <ul className="list plain overview-activity-list">
                  {recentActivity.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.assetName}</strong>
                        <small>{a.userName}</small>
                      </div>
                      <div className="activity-meta">
                        <span>{a.action}</span>
                        <small>{new Date(a.timestampMs).toLocaleString()}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </section>

            <section className="overview-bottom-grid">
              <section className="panel">
                <div className="panel-head"><h3>Asset mix by type</h3><span>Top categories</span></div>
                <div className="hbar-chart">
                  {typeDistribution.map((item) => (
                    <div className="hbar-row" key={item.type}>
                      <div className="hbar-meta">
                        <span>{item.type}</span>
                        <strong>{item.count} ({item.pct}%)</strong>
                      </div>
                      <div className="hbar-track"><span style={{ width: `${item.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Top assignees</h3><span>{busiestUser.name} busiest user</span></div>
                <div className="capacity-list">
                  {topAssignees.map((member) => {
                    const pct = stats.active ? Math.round((member.assigned / stats.active) * 100) : 0;
                    return (
                      <div key={member.id}>
                        <div className="capacity-row">
                          <span>{member.name}</span>
                          <strong>{member.assigned} devices</strong>
                        </div>
                        <div className="meter"><span style={{ width: `${Math.max(pct, 4)}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Branch coverage</h3><span>Operational spread</span></div>
                <ul className="branch-list">
                  {storeCoverage.length === 0 && (
                    <li>
                      <span>No store mapping yet</span>
                      <strong>0%</strong>
                    </li>
                  )}
                  {storeCoverage.map((store) => (
                    <li key={store.id}>
                      <span>{store.name}</span>
                      <strong>{store.count} ({store.pct}%)</strong>
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
          <section className="panel wide inventory-panel">
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
                    const header = ['Asset', 'Type', 'Brand', 'Model', 'Vendor', 'Serial', 'Status'];
                    const rows = filteredSortedAssets.map((a) => [
                      a.name || '',
                      a.type || '',
                      a.brand_name || '',
                      a.model_name || '',
                      a.vendor || '',
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

            {hasAdminPermission('inventory.manage') && (
              <div className="create-box inventory-create-top">
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
                    <span>Vendor (optional)</span>
                    <input name="vendor" placeholder="e.g. Dell Partner, Amazon, Local Supplier" />
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

            <div className="inventory-filter-grid">
              <input
                className="inventory-search"
                placeholder="Search by asset, serial, vendor, brand, model, status..."
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
                  <thead><tr><th>Asset</th><th>Type</th><th>Brand</th><th>Model</th><th>Vendor</th><th>Serial</th><th>Status</th><th>QR</th></tr></thead>
                  <tbody>
                    {paginatedAssets.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td><td>{a.type}</td><td>{a.brand_name || '-'}</td><td>{a.model_name || '-'}</td><td>{a.vendor || '-'}</td><td>{a.serial}</td>
                        <td><span className={`status ${a.status}`}>{a.status}</span></td>
                        <td>
                          <div className="asset-qr-cell">
                            <img src={getQrImageUrl(buildAssetQrData(a))} alt={`${a.name} QR`} />
                            <button type="button" className="small" onClick={() => printAssetQr(a)}>Print QR</button>
                          </div>
                        </td>
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
          </section>
        )}

        {section === 'assignments' && (
          <>
            <section className="inventory-mini-stats assignment-stats">
              {assignmentKpiCards.map((item) => (
                <article key={item.key} className="metric-card donut-card" style={{ '--metric-pct': `${item.pct}%` }}>
                  <p className="metric-title">{item.label}</p>
                  <div className="metric-donut">
                    <div className="metric-center">
                      <strong>{item.value}</strong>
                      <span>{item.pct}%</span>
                    </div>
                  </div>
                  <small>{item.hint}</small>
                </article>
              ))}
            </section>
            <section className="panel wide assignment-directory-panel">
              <div className="panel-head">
                <h3>Employee Assignment Directory</h3>
                <span>{employeeDirectory.length} employees in view</span>
              </div>

              <form
                className="assignment-search-top"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAssignmentSearch(assignmentSearchDraft.trim());
                }}
              >
                <input
                  className="inventory-search"
                  placeholder="Search by employee, email, asset, serial"
                  value={assignmentSearchDraft}
                  onChange={(e) => setAssignmentSearchDraft(e.target.value)}
                />
                <select value={assignmentUserFilter} onChange={(e) => setAssignmentUserFilter(e.target.value)}>
                  <option value="all">All Employees</option>
                  {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="submit" className="small">Search</button>
              </form>

              {hasAdminPermission('assignments.manage') && (
                <div className="create-box assignment-quick-assign">
                  <h4>Quick Assign Asset</h4>
                  <form id="assignment-quick-form" onSubmit={allocate} className="form assignment-inline-form">
                    <select
                      name="user"
                      required
                      value={quickAssignForm.userId}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, userId: e.target.value }))}
                    >
                      <option value="">{employees.length ? 'Select employee' : 'No employees available'}</option>
                      {employees.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                    <select
                      value={quickAssignForm.assetType}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, assetType: e.target.value }))}
                    >
                      <option value="all">All asset types</option>
                      {quickAssignTypeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      value={quickAssignForm.assetSearch}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, assetSearch: e.target.value }))}
                      placeholder="Search available asset by name, serial, brand..."
                    />
                    <select
                      name="asset"
                      required
                      value={quickAssignForm.assetId}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, assetId: e.target.value }))}
                    >
                      <option value="">{quickAssignAssetOptions.length ? 'Select available asset' : 'No matching available asset'}</option>
                      {quickAssignAssetOptions.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.serial || '-'})</option>
                      ))}
                    </select>
                    <input
                      name="notes"
                      value={quickAssignForm.notes}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Reason, team, project, ticket..."
                    />
                    <button type="submit" disabled={!quickAssignForm.userId || !quickAssignForm.assetId}>Assign Asset</button>
                  </form>
                  <p className="assignment-inline-meta">
                    {quickAssignAssetOptions.length} matching available assets
                    {quickAssignForm.assetType !== 'all' ? ` in ${quickAssignForm.assetType}` : ''}
                  </p>
                </div>
              )}

              <div className="table-wrap assignment-employee-table">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Assigned Assets</th>
                      <th>Latest Assignment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeDirectory.map((emp) => (
                      <tr key={emp.id}>
                        <td className="employee-cell">
                          <span className="employee-avatar">{(emp.name || 'U').slice(0, 1).toUpperCase()}</span>
                          <div>
                            <strong>{emp.name}</strong>
                            <small>ID: {emp.id}</small>
                          </div>
                        </td>
                        <td>{emp.email || '-'}</td>
                        <td><span className={`role-pill role-${(emp.role || 'user').toLowerCase()}`}>{emp.role || '-'}</span></td>
                        <td><span className="count-pill">{emp.assignedCount}</span></td>
                        <td>{emp.latestAllocatedAt ? emp.latestAllocatedAt.toLocaleString() : '-'}</td>
                        <td>
                          <div className="assignment-row-actions">
                            <button type="button" className="small assignment-view-btn" onClick={() => setSelectedEmployeeId(emp.id)}>View</button>
                            {hasAdminPermission('assignments.manage') && (
                              <button type="button" className="small assignment-assign-btn" onClick={() => startQuickAssignForEmployee(emp.id)}>Assign</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {section === 'accounts' && (
          <section className="panel wide account-management-panel">

            {/* ── Hero Banner ── */}
            <div className="acct-hero-banner">
              <div className="acct-hero-glow acct-hero-glow-1" />
              <div className="acct-hero-glow acct-hero-glow-2" />
              <div className="acct-hero-inner">
                <div className="acct-hero-text">
                  <div className="acct-hero-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                    Admin Console
                  </div>
                  <h2 className="acct-hero-title">Account Management</h2>
                  <p className="acct-hero-sub">Control admin access, permissions, and account lifecycle from one place.</p>
                </div>
                {isSuperAdmin && (
                  <button type="button" className="acct-hero-cta" onClick={() => setCreateAdminPopupOpen(true)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    Create Admin
                  </button>
                )}
              </div>

              {/* ── Metric Cards inside hero ── */}
              <div className="acct-metric-row">
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Managed Admins</span>
                    <strong>{accountSummary.totalManaged}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-indigo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Total Admins</span>
                    <strong>{accountSummary.totalAdmins}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-emerald">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Full Access</span>
                    <strong>{accountSummary.fullyPrivileged}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-amber">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Avg Permissions</span>
                    <strong>{accountSummary.avgPermissions}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-rose">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Max Permissions</span>
                    <strong>{accountSummary.maxPermissions}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Content ── */}
            {!isSuperAdmin ? (
              <div className="acct-restricted">
                <div className="acct-restricted-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <div>
                  <h4>Restricted Area</h4>
                  <p>Only the super admin can create admin accounts and change permissions.</p>
                </div>
              </div>
            ) : (
              <section className="acct-table-section">
                <div className="acct-table-header">
                  <div className="acct-table-title-group">
                    <h4>Admin Permission Control</h4>
                    <span className="acct-count-badge">{filteredManagedAdmins.length} accounts</span>
                  </div>
                  <div className="acct-search-wrap">
                    <svg className="acct-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                      className="acct-search-input"
                      placeholder="Search by name or email…"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="acct-table-wrap">
                  <table className="acct-table">
                    <thead>
                      <tr>
                        <th>Admin</th>
                        <th>Permission Access</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManagedAdmins.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="acct-empty-row">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                            <span>No managed admin accounts found.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredManagedAdmins.map((adminUser) => {
                          const permissionCount = (adminUser.permissions || []).length;
                          const hasFullAccess = permissionCount === ADMIN_PERMISSION_OPTIONS.length;
                          const pct = Math.round((permissionCount / ADMIN_PERMISSION_OPTIONS.length) * 100);
                          return (
                            <tr key={adminUser.id} className="acct-admin-row">
                              <td>
                                <div className="acct-admin-cell">
                                  <span className="acct-admin-avatar">{(adminUser.name || 'A').slice(0, 1).toUpperCase()}</span>
                                  <div className="acct-admin-info">
                                    <strong>{adminUser.name}</strong>
                                    <small>{adminUser.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="acct-perm-cell">
                                  <div className="acct-perm-bar-wrap">
                                    <div className="acct-perm-bar"><div className="acct-perm-fill" style={{ width: `${pct}%`, background: hasFullAccess ? '#10b981' : '#f59e0b' }} /></div>
                                    <span className="acct-perm-fraction">{permissionCount}/{ADMIN_PERMISSION_OPTIONS.length}</span>
                                  </div>
                                  <span className={`acct-access-chip ${hasFullAccess ? 'chip-full' : 'chip-limited'}`}>
                                    {hasFullAccess ? '✦ Full Access' : 'Limited'}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <button type="button" className="acct-manage-btn" onClick={() => openAdminPermissionPopup(adminUser)}>
                                  Manage
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        )}

        {createAdminPopupOpen && (
          <div className="account-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="create-admin-title" onClick={() => setCreateAdminPopupOpen(false)}>
            <section className="account-permission-modal" onClick={(e) => e.stopPropagation()}>
              <header className="account-permission-header">
                <div>
                  <h3 id="create-admin-title">Create Admin Account</h3>
                  <p>Create account and allocate permissions in one popup.</p>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="small outline" onClick={() => setCreateAdminPopupOpen(false)}>Close</button>
                </div>
              </header>
              <form className="form account-create-form" onSubmit={createAdminAccount}>
                <div className="account-form-row">
                  <input
                    placeholder="Admin name"
                    value={adminCreateForm.name}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Admin email"
                    value={adminCreateForm.email}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <input
                  type="text"
                  placeholder="Password (default: password)"
                  value={adminCreateForm.password}
                  onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <div className="permission-actions">
                  <button
                    type="button"
                    className="small outline"
                    onClick={() => setAdminCreateForm((prev) => ({ ...prev, permissions: ADMIN_PERMISSION_OPTIONS.map((item) => item.key) }))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="small outline"
                    onClick={() => setAdminCreateForm((prev) => ({ ...prev, permissions: [] }))}
                  >
                    Clear
                  </button>
                  <small>{adminCreateForm.permissions.length} selected</small>
                </div>
                <div className="permission-grid permission-popup-grid">
                  {ADMIN_PERMISSION_OPTIONS.map((perm) => (
                    <label key={`create-${perm.key}`} className="permission-item">
                      <input
                        type="checkbox"
                        checked={adminCreateForm.permissions.includes(perm.key)}
                        onChange={(e) => {
                          setAdminCreateForm((prev) => {
                            const nextSet = new Set(prev.permissions);
                            if (e.target.checked) nextSet.add(perm.key);
                            else nextSet.delete(perm.key);
                            return { ...prev, permissions: Array.from(nextSet) };
                          });
                        }}
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
                <div className="employee-edit-actions">
                  <button type="submit" className="small">Create Account</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedAdminPermissionUser && (
          <div
            className="account-permission-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-permission-title"
            onClick={() => setSelectedAdminPermissionId(null)}
          >
            <section className="account-permission-modal" onClick={(e) => e.stopPropagation()}>
              <header className="account-permission-header">
                <div>
                  <h3 id="admin-permission-title">{selectedAdminPermissionUser.name}</h3>
                  <p>{selectedAdminPermissionUser.email}</p>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="small outline" onClick={() => setSelectedAdminPermissionId(null)}>Close</button>
                </div>
              </header>

              <div className="permission-actions">
                <button
                  type="button"
                  className="small outline"
                  onClick={() => setAdminPermissionDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: ADMIN_PERMISSION_OPTIONS.map((item) => item.key)
                  }))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="small outline"
                  onClick={() => setAdminPermissionDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: []
                  }))}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="small outline"
                  onClick={() => setAdminPermissionDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: Array.isArray(selectedAdminPermissionUser.permissions)
                      ? selectedAdminPermissionUser.permissions
                      : []
                  }))}
                >
                  Reset
                </button>
                <small>{(adminPermissionDrafts[selectedAdminPermissionUser.id] || []).length} selected</small>
              </div>

              <div className="permission-grid permission-popup-grid">
                {ADMIN_PERMISSION_OPTIONS.map((perm) => (
                  <label key={`${selectedAdminPermissionUser.id}-${perm.key}`} className="permission-item">
                    <input
                      type="checkbox"
                      checked={(adminPermissionDrafts[selectedAdminPermissionUser.id] || []).includes(perm.key)}
                      onChange={(e) => {
                        setAdminPermissionDrafts((prev) => {
                          const next = new Set(prev[selectedAdminPermissionUser.id] || []);
                          if (e.target.checked) next.add(perm.key);
                          else next.delete(perm.key);
                          return { ...prev, [selectedAdminPermissionUser.id]: Array.from(next) };
                        });
                      }}
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>

              <div className="employee-edit-actions">
                <button
                  type="button"
                  className="small"
                  disabled={!hasDraftChanges(selectedAdminPermissionUser)}
                  onClick={async () => {
                    const ok = await saveAdminPermissions(selectedAdminPermissionUser.id);
                    if (ok) setSelectedAdminPermissionId(null);
                  }}
                >
                  {hasDraftChanges(selectedAdminPermissionUser) ? 'Save Permissions' : 'Saved'}
                </button>
              </div>
            </section>
          </div>
        )}

        {selectedEmployee && (
          <div className="employee-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="employee-view-title" onClick={() => setSelectedEmployeeId(null)}>
            <section className="employee-modal" onClick={(e) => e.stopPropagation()}>
              <header className="employee-modal-hero">
                <img
                  className="employee-modal-photo"
                  src={selectedEmployee.profile_image_url || `https://i.pravatar.cc/180?img=${(selectedEmployee.id % 70) + 1}`}
                  alt={`${selectedEmployee.name} profile`}
                />
                <div className="employee-modal-headcopy">
                  <div className="employee-modal-title-row">
                    <h3 id="employee-view-title">{selectedEmployee.name}</h3>
                    <div className="employee-modal-actions">
                      <button type="button" className="small outline" onClick={printEmployeeDetails}>Print</button>
                      {hasAdminPermission('assignments.manage') && (
                        <button type="button" className="small outline" onClick={() => setIsEditingEmployee((v) => !v)}>{isEditingEmployee ? 'Cancel Edit' : 'Edit'}</button>
                      )}
                      <button type="button" className="small outline" onClick={() => setSelectedEmployeeId(null)}>Close</button>
                    </div>
                  </div>
                  <p>{selectedEmployee.email || '-'} | {selectedEmployee.role || 'user'} | Employee ID #{selectedEmployee.id}</p>
                  <div className="employee-modal-pill-row">
                    <span className="soft-pill">Status: {selectedEmployee.assignedCount > 0 ? 'Assigned' : 'Available'}</span>
                    <span className="soft-pill">Top Asset: {selectedEmployeeAssetBreakdown[0]?.[0] || '-'}</span>
                    <span className="soft-pill">Joined: {selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </header>

              <div className="employee-modal-updated">
                <span>Last updated on {selectedEmployeeLastUpdated}</span>
              </div>

              <div className="employee-modal-stats">
                <article><span>Details</span><strong>{selectedEmployee.role || '-'}</strong></article>
                <article><span>Items</span><strong>{selectedEmployee.assignedCount}</strong></article>
                <article><span>Asset Types</span><strong>{selectedEmployeeAssetBreakdown.length}</strong></article>
                <article><span>Latest Update</span><strong>{selectedEmployee.latestAllocatedAt ? selectedEmployee.latestAllocatedAt.toLocaleDateString() : '-'}</strong></article>
                <article><span>Total Replacements</span><strong>{selectedEmployeeReplacementCount}</strong></article>
              </div>

              <div className="employee-modal-ops-grid">
                <section className="employee-info-card">
                  <h4>Lifecycle Summary</h4>
                  <div className="employee-modal-meta">
                    <article><span>Total Allocations</span><strong>{selectedEmployeeHistory.length}</strong></article>
                    <article><span>Currently Active</span><strong>{selectedEmployee.assignedCount}</strong></article>
                    <article><span>Returned Assets</span><strong>{selectedEmployeeReturnHistory.length}</strong></article>
                    <article><span>Replacement Events</span><strong>{selectedEmployeeReplacementCount}</strong></article>
                  </div>
                </section>

                <section className="employee-info-card">
                  <h4>Return Cause Breakdown</h4>
                  <div className="cause-grid">
                    <article><span>Damaged</span><strong>{selectedEmployeeReasonBreakdown.damaged}</strong></article>
                    <article><span>Not Working</span><strong>{selectedEmployeeReasonBreakdown.notWorking}</strong></article>
                    <article><span>User Leaving</span><strong>{selectedEmployeeReasonBreakdown.userLeaving}</strong></article>
                    <article><span>Other</span><strong>{selectedEmployeeReasonBreakdown.other}</strong></article>
                  </div>
                </section>
              </div>

              <div className="employee-modal-detail-grid">
                <section className="employee-info-card">
                  <h4>Client Details</h4>
                  {isEditingEmployee && hasAdminPermission('assignments.manage') ? (
                    <form className="employee-edit-form" onSubmit={updateEmployee}>
                      <label>
                        <span>Name</span>
                        <input
                          value={employeeEditForm.name}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          value={employeeEditForm.email}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        <span>Role</span>
                        <select
                          value={employeeEditForm.role}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </label>
                      <label>
                        <span>Employment Status</span>
                        <select
                          value={employeeEditForm.employmentStatus}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, employmentStatus: e.target.value }))}
                        >
                          <option value="active">Active</option>
                          <option value="leaving">Leaving Company</option>
                        </select>
                      </label>
                      {employeeEditForm.employmentStatus === 'leaving' && (
                        <label className="replacement-wide">
                          <span>Leaving Reason</span>
                          <input
                            value={employeeEditForm.leavingReason}
                            onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, leavingReason: e.target.value }))}
                            placeholder="Reason for leaving / handover note"
                            required
                          />
                        </label>
                      )}
                      <div className="employee-edit-actions">
                        <button type="submit" className="small">Save Changes</button>
                        <button type="button" className="small outline" onClick={() => setIsEditingEmployee(false)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="employee-field-grid">
                      <div><label>First Name</label><p>{(selectedEmployee.name || '').split(' ')[0] || '-'}</p></div>
                      <div><label>Last Name</label><p>{(selectedEmployee.name || '').split(' ').slice(1).join(' ') || '-'}</p></div>
                      <div><label>Email</label><p>{selectedEmployee.email || '-'}</p></div>
                      <div><label>Role</label><p>{selectedEmployee.role || '-'}</p></div>
                      <div><label>Company</label><p>NEXTGEN</p></div>
                      <div><label>Last Note</label><p>{selectedEmployeeLatestNote}</p></div>
                    </div>
                  )}
                </section>

                <section className="employee-info-card">
                  <h4>Assignment Insights</h4>
                  <div className="employee-type-list">
                    {selectedEmployeeAssetBreakdown.length === 0 ? (
                      <p className="hint">No active assignments yet.</p>
                    ) : (
                      selectedEmployeeAssetBreakdown.map(([type, count]) => {
                        const pct = selectedEmployee.assignedCount ? Math.round((count / selectedEmployee.assignedCount) * 100) : 0;
                        return (
                          <div key={type} className="employee-type-row">
                            <div className="employee-type-meta">
                              <span>{type}</span>
                              <strong>{count} ({pct}%)</strong>
                            </div>
                            <div className="meter"><span style={{ width: `${Math.max(pct, 5)}%` }} /></div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <section className="employee-modal-assets">
                <h4>Assigned Assets</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Asset</th><th>Type</th><th>Serial</th><th>Assigned At</th><th>Notes</th><th>QR</th><th>Action</th></tr></thead>
                    <tbody>
                      {selectedEmployee.assignedAssets.length === 0 ? (
                        <tr><td colSpan={7}>No active assets assigned.</td></tr>
                      ) : (
                        selectedEmployee.assignedAssets.map((asset) => (
                          <tr key={asset.id}>
                            <td><strong>{asset.assetName}</strong></td>
                            <td>{asset.type}</td>
                            <td>{asset.serial}</td>
                            <td>{asset.allocatedAt ? new Date(asset.allocatedAt).toLocaleString() : '-'}</td>
                            <td>{asset.notes ? <span className="note-pill">{asset.notes}</span> : '-'}</td>
                            <td>
                              <div className="inline-asset-qr-cell">
                                <img
                                  className="inline-asset-qr"
                                  src={getQrImageUrl(buildAssignedAssetQrData(asset, selectedEmployee, allocationAssignAuditById[asset.id]))}
                                  alt={`${asset.assetName} QR`}
                                />
                                <button
                                  type="button"
                                  className="small outline"
                                  onClick={() => printAssignedAssetQr(asset, selectedEmployee, allocationAssignAuditById[asset.id])}
                                >
                                  Print QR
                                </button>
                              </div>
                            </td>
                            <td>
                              {hasAdminPermission('assignments.manage')
                                ? <button type="button" className="small" onClick={() => returnAsset(asset.id)}>Return</button>
                                : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {hasAdminPermission('assignments.manage') && (
                <section className="employee-info-card">
                  <h4>Replace Assigned Asset</h4>
                  <form className="replacement-form" onSubmit={replaceEmployeeAsset}>
                    <label>
                      <span>Current Assigned Asset</span>
                      <select
                        value={replacementForm.allocationId}
                        onChange={(e) => setReplacementForm((prev) => ({ ...prev, allocationId: e.target.value }))}
                        required
                      >
                        <option value="">Select active allocation</option>
                        {selectedEmployee.assignedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.assetName} ({asset.serial})</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Replacement Asset Type</span>
                      <select
                        value={replacementForm.replacementType}
                        onChange={(e) => setReplacementForm((prev) => ({ ...prev, replacementType: e.target.value, newAssetId: '' }))}
                      >
                        <option value="all">All Types</option>
                        {TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Replacement Asset</span>
                      <select
                        value={replacementForm.newAssetId}
                        onChange={(e) => setReplacementForm((prev) => ({ ...prev, newAssetId: e.target.value }))}
                        required
                      >
                        <option value="">Select available asset</option>
                        {replacementAssetOptions.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name} ({asset.serial})</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Reason</span>
                      <select
                        value={replacementForm.reason}
                        onChange={(e) => setReplacementForm((prev) => ({ ...prev, reason: e.target.value }))}
                        required
                      >
                        <option value="Damaged">Damaged Product</option>
                        <option value="Not Working">Not Working Product</option>
                        <option value="User Leaving">User Leaving</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    {replacementForm.reason === 'Other' && (
                      <label className="replacement-wide">
                        <span>Reason Detail</span>
                        <input
                          value={replacementForm.reasonDetail}
                          onChange={(e) => setReplacementForm((prev) => ({ ...prev, reasonDetail: e.target.value }))}
                          placeholder="Explain why asset is being replaced"
                          required
                        />
                      </label>
                    )}
                    <div className="employee-edit-actions">
                      <button type="submit" className="small">Replace Asset</button>
                    </div>
                  </form>
                </section>
              )}

              <section className="employee-modal-assets">
                <h4>Allocation History</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Asset</th><th>Type</th><th>Serial</th><th>Allocated At</th><th>Returned At</th><th>Status</th><th>Reason/Notes</th></tr></thead>
                    <tbody>
                      {selectedEmployeeHistory.length === 0 ? (
                        <tr><td colSpan={7}>No history found.</td></tr>
                      ) : (
                        selectedEmployeeHistory.map((item) => (
                          <tr key={item.id}>
                            <td>{item.assetName}</td>
                            <td>{item.type}</td>
                            <td>{item.serial}</td>
                            <td>{item.allocated_at ? new Date(item.allocated_at).toLocaleString() : '-'}</td>
                            <td>{item.returned_at ? new Date(item.returned_at).toLocaleString() : '-'}</td>
                            <td><span className={`status-pill ${item.returned_at ? 'returned' : 'allocated'}`}>{item.status}</span></td>
                            <td>{item.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </div>
        )}

        {section === 'insights' && (
          <section className="insights-v2">
            <section className="insights-v2-top">
              <article><span>Total Assets</span><strong>{stats.total}</strong></article>
              <article><span>Active Assignments</span><strong>{stats.active}</strong></article>
              <article><span>Utilization</span><strong>{stats.utilization}%</strong></article>
              <article><span>Return Rate</span><strong>{allocations.length ? Math.round((allocations.filter((a) => a.returned_at).length / allocations.length) * 100) : 0}%</strong></article>
            </section>

            <section className="insights-v2-main">
              <section className="panel">
                <div className="panel-head"><h3>Weekly Assignment Trend</h3><span>Last 7 days</span></div>
                <div className="vbar-chart insights-vbars">
                  {weeklyAssignments.map((d) => {
                    const max = Math.max(...weeklyAssignments.map((x) => x.count), 1);
                    const h = Math.round((d.count / max) * 100);
                    return (
                      <div key={d.key} className="vbar-col">
                        <strong>{d.count}</strong>
                        <div className="vbar-track"><span style={{ height: `${Math.max(h, 6)}%` }} /></div>
                        <small>{d.label}</small>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Category Mix</h3><span>{topAssetType[0]} leads</span></div>
                <div className="insight-bars">
                  {assetTypes.slice(0, 8).map(([type, count]) => {
                    const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={type} className="insight-bar-row">
                        <div className="insight-bar-meta">
                          <span>{type}</span>
                          <strong>{count} ({pct}%)</strong>
                        </div>
                        <div className="hbar-track"><span style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h3>Actionable Signals</h3><span>What to do next</span></div>
                <ul className="list plain">
                  <li><span>Top utilized category</span><strong>{topAssetType[0]} ({topAssetType[1]})</strong></li>
                  <li><span>Most loaded user</span><strong>{busiestUser.name} ({busiestUser.assigned})</strong></li>
                  <li><span>Employees with devices</span><strong>{assignedUsersCount} / {employees.length}</strong></li>
                  <li><span>Available inventory</span><strong>{stats.available} ready</strong></li>
                </ul>
              </section>
            </section>

            <section className="panel">
              <div className="panel-head"><h3>Recent Allocation Events</h3><span>Latest 8</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Asset</th><th>Employee</th><th>Event Time</th><th>Action</th></tr></thead>
                  <tbody>
                    {recentActivity.map((a) => (
                      <tr key={a.id}>
                        <td>{a.assetName}</td>
                        <td>{a.userName}</td>
                        <td>{new Date(a.timestampMs).toLocaleString()}</td>
                        <td><span className={`status-pill ${a.action === 'Returned' ? 'returned' : 'allocated'}`}>{a.action}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {section === 'activity' && (
          <section className="activity-page">
            <section className="activity-hero">
              <div>
                <h3>Recent Activity & Audit Trail</h3>
                <p>Track assignment movement, user actions, and operational changes in one timeline.</p>
              </div>
              <div className="activity-hero-cards">
                <article>
                  <span>Allocated Events</span>
                  <strong>{activitySummary.allocatedCount}</strong>
                </article>
                <article>
                  <span>Returned Events</span>
                  <strong>{activitySummary.returnedCount}</strong>
                </article>
                <article>
                  <span>Audit Rows</span>
                  <strong>{activitySummary.auditCount}</strong>
                </article>
                <article>
                  <span>High Impact Actions</span>
                  <strong>{activitySummary.criticalActions}</strong>
                </article>
              </div>
              <div className="activity-last-seen">
                <span>Latest Event</span>
                <strong>
                  {activitySummary.latestEvent
                    ? `${activitySummary.latestEvent.action} • ${activitySummary.latestEvent.assetName}`
                    : 'No activity yet'}
                </strong>
              </div>
            </section>

            <section className="activity-grid">
              <section className="panel activity-panel timeline-panel">
                <div className="panel-head"><h3>Timeline</h3><span>Latest assignment events</span></div>
                <ul className="timeline">
                  {recentActivity.map((a) => (
                    <li key={a.id} className={`timeline-item ${a.action === 'Returned' ? 'is-returned' : 'is-allocated'}`}>
                      <div className="dot" />
                      <div>
                        <strong>{a.assetName} {a.action.toLowerCase()} for {a.userName}</strong>
                        <small>{new Date(a.timestampMs).toLocaleString()} • Allocation #{a.allocationId}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel activity-panel">
                <div className="panel-head"><h3>Audit Log</h3><span>Persisted with timestamp</span></div>
                <div className="table-wrap audit-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAuditLogs.length === 0 && (
                        <tr><td colSpan={5}>No audit entries yet.</td></tr>
                      )}
                      {recentAuditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.event_at_ms ? new Date(Number(log.event_at_ms)).toLocaleString() : (log.event_at ? new Date(log.event_at).toLocaleString() : '-')}</td>
                          <td>{log.actor_name || 'System'}{log.actor_role ? ` (${log.actor_role})` : ''}</td>
                          <td>
                            <span className={`activity-action-badge action-${(log.action || '').toLowerCase()}`}>
                              {formatAuditAction(log.action)}
                            </span>
                          </td>
                          <td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                          <td>{log.details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </section>
        )}

        {message && <div className="toast">{message}</div>}
      </div>
    </div>
  );
}

export default App;
