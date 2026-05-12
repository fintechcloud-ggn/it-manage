import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import LandingPage from './components/LandingPage';
import nextgenLogo from './assets/image.png';
import AssetTrackingPage from './pages/AssetTrackingPage';
import EnterprisePage from './pages/EnterprisePage';
import GlobalFleetPage from './pages/GlobalFleetPage';
import PlatformPage from './pages/PlatformPage';
import PricingPage from './pages/PricingPage';
import ResourcesPage from './pages/ResourcesPage';
import SecurityOpsPage from './pages/SecurityOpsPage';
import SolutionsPage from './pages/SolutionsPage';
import { MARKETING_HOME_PATH, normalizeMarketingPath } from './pages/marketingPages';


const DEV_API_PORTS = Array.from({ length: 20 }, (_, index) => 4000 + index);
const API_BASE_STORAGE_KEY = 'itmanage.apiBase';

function readStoredApiBase() {
  try {
    return String(window.sessionStorage.getItem(API_BASE_STORAGE_KEY) || '').trim().replace(/\/$/, '');
  } catch (_error) {
    return '';
  }
}

function persistApiBase(base) {
  try {
    if (!base) {
      window.sessionStorage.removeItem(API_BASE_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(API_BASE_STORAGE_KEY, base);
  } catch (_error) {
    // Ignore storage issues in restricted browser contexts.
  }
}

const API_CANDIDATES = (() => {
  const configuredApi = String(process.env.REACT_APP_API || '').trim().replace(/\/$/, '');
  const storedApi = readStoredApiBase();
  if (process.env.NODE_ENV !== 'development') {
    return [storedApi, '', configuredApi].filter((value, index, list) => value || value === '' ? list.indexOf(value) === index : false);
  }

  const hostname = window.location.hostname || 'localhost';
  const candidates = [storedApi, `http://${hostname}:4000`, configuredApi].filter(Boolean);
  DEV_API_PORTS.forEach((port) => {
    const candidate = `http://${hostname}:${port}`;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  });
  candidates.push('');
  return candidates;
})();
let resolvedApiBase = '';
let apiBaseResolutionPromise = null;

async function resolveApiBase(forceRefresh = false) {
  if (!forceRefresh && resolvedApiBase) return resolvedApiBase;
  if (!forceRefresh && apiBaseResolutionPromise) return apiBaseResolutionPromise;

  apiBaseResolutionPromise = (async () => {
    let lastError = null;

    for (const base of API_CANDIDATES) {
      try {
        const response = await fetch(`${base}/api/health`);
        if (!response.ok) {
          lastError = new Error(`health_${response.status}`);
          continue;
        }
        resolvedApiBase = base;
        persistApiBase(base);
        return base;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to resolve API base');
  })();

  try {
    return await apiBaseResolutionPromise;
  } finally {
    apiBaseResolutionPromise = null;
  }
}

async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = await resolveApiBase();

  try {
    const response = await fetch(`${base}${normalizedPath}`, options);
    resolvedApiBase = base;
    persistApiBase(base);
    if (
      process.env.NODE_ENV === 'development' &&
      normalizedPath === '/api/auth/login' &&
      response.status >= 500
    ) {
      for (const fallbackBase of API_CANDIDATES) {
        if (fallbackBase === base) continue;
        try {
          const retryResponse = await fetch(`${fallbackBase}${normalizedPath}`, options);
          if (retryResponse.status < 500) {
            resolvedApiBase = fallbackBase;
            persistApiBase(fallbackBase);
            return retryResponse;
          }
        } catch (_retryError) {
          // Try the next development API candidate.
        }
      }
    }
    return response;
  } catch (error) {
    const fallbackBase = await resolveApiBase(true);
    if (fallbackBase === base) throw error;
    const retryResponse = await fetch(`${fallbackBase}${normalizedPath}`, options);
    resolvedApiBase = fallbackBase;
    persistApiBase(fallbackBase);
    return retryResponse;
  }
}
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

const INVOICE_SUBCATEGORIES_BY_CATEGORY = {
  'Assets Bill': ['Laptops', 'Phone', 'SIM', 'Printer', 'Camira', 'BIOMATRIX', 'Other'],
  'Utility Bill': ['Wifi Bill', 'Leased Line Bill', 'Electricity Bill', 'Water Bill', 'Pantry Supplies', 'Cleaning Supplies', 'Marketing', 'Petty Cash', 'Other'],
  'Maintenance Bill': ['Office Maintenance', 'Cleaning & Maintenance', 'Reparing & Maintenance', 'Other'],
  'Rental Bill': ['Office Rent', 'Other'],
  'Other Bill': ['Other----']
};

const ADMIN_PERMISSION_OPTIONS = [
  { key: 'overview.view', label: 'Dashboard / Overview' },
  { key: 'inventory.view', label: 'Inventory - View Assets' },
  { key: 'inventory.manage', label: 'Inventory - Add, Edit, Delete Assets' },
  { key: 'assignments.view', label: 'Assignments - View Employee Assets' },
  { key: 'assignments.manage', label: 'Assignments - Assign, Return, Replace Assets' },
  { key: 'insights.view', label: 'Insights View' },
  { key: 'invoices.view', label: 'Invoices - View Bills' },
  { key: 'invoices.manage', label: 'Invoices - Add Bills' },
  { key: 'activity.view', label: 'Recent Activity View' },
  { key: 'accounts.manage', label: 'Role Account Management' }
];
const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSION_OPTIONS.map((item) => item.key);

const MARKETING_PAGE_COMPONENTS = {
  '/platform': PlatformPage,
  '/platform/asset-tracking': AssetTrackingPage,
  '/platform/global-fleet': GlobalFleetPage,
  '/platform/security-ops': SecurityOpsPage,
  '/solutions': SolutionsPage,
  '/enterprise': EnterprisePage,
  '/resources': ResourcesPage,
  '/pricing': PricingPage
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label || ''} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`searchable-select ${className}`.trim()}>
      <button
        type="button"
        className={`searchable-select__trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={`searchable-select__value${selectedOption ? '' : ' is-placeholder'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="searchable-select__caret" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="searchable-select__menu">
          <input
            ref={searchInputRef}
            className="searchable-select__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="searchable-select__list">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  className={`searchable-select__option${String(option.value) === String(value) ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="searchable-select__empty">{emptyMessage}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getNameInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function buildAssignmentSelectionValue(userOption) {
  if (userOption?.selection_value) return String(userOption.selection_value);
  if (userOption?.local_user_id) return String(userOption.local_user_id);
  return `external:${userOption?.external_employee_id || userOption?.employee_code || userOption?.name || 'unknown'}`;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [marketingPath, setMarketingPath] = useState(() => normalizeMarketingPath(window.location.pathname));
  const [authView, setAuthView] = useState(() => (
    localStorage.getItem('token') && localStorage.getItem('user') ? 'app' : 'landing'
  ));
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [quickAssignUsers, setQuickAssignUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoaded, setAuditLogsLoaded] = useState(false);
  const [invoices, setInvoices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('invoices') || '[]');
    } catch {
      return [];
    }
  });
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    vendor: '',
    billNo: '',
    category: 'Assets Bill',
    subcategory: 'Laptops',
    amount: '',
    dueDate: '',
    status: 'unpaid',
    notes: '',
    invoiceFileName: '',
    invoiceFileData: ''
  });
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginUsername, setShowLoginUsername] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
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

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [message]);
  const [accountSearch, setAccountSearch] = useState('');
  const [createAdminPopupOpen, setCreateAdminPopupOpen] = useState(false);
  const [selectedAdminPermissionId, setSelectedAdminPermissionId] = useState(null);
  const [adminCreateForm, setAdminCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    domain_name: '',
    employee_code_prefix: '',
    permissions: ADMIN_PERMISSION_OPTIONS.map((item) => item.key)
  });
  const [adminPermissionDrafts, setAdminPermissionDrafts] = useState({});
  const [adminDetailDrafts, setAdminDetailDrafts] = useState({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [employeeEditForm, setEmployeeEditForm] = useState({
    name: '',
    email: '',
    role: 'user',
    domain_name: '',
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
  const [selectedModelId, setSelectedModelId] = useState('');
  const [assetDomainName, setAssetDomainName] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);

  const isSuperAdmin = useMemo(
    () => !!user && String(user.email || '').toLowerCase() === 'admin',
    [user]
  );
  const userPermissions = useMemo(
    () => new Set(Array.isArray(user?.permissions) ? user.permissions : []),
    [user]
  );
  const currentUserDomain = useMemo(
    () => String(user?.domain_name || '').trim().toLowerCase(),
    [user]
  );

  function hasAdminPermission(permissionKey) {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const normalizedRole = (user.role || '').toLowerCase();
    if (!userPermissions.size) return normalizedRole === 'admin';
    return userPermissions.has(permissionKey);
  }

  function canAccessSection(sectionKey) {
    const sectionPermissionMap = {
      overview: 'overview.view',
      inventory: 'inventory.view',
      assignments: 'assignments.view',
      insights: 'insights.view',
      invoices: 'invoices.view',
      activity: 'activity.view',
      accounts: 'accounts.manage'
    };
    if (sectionKey === 'accounts') {
      return hasAdminPermission('accounts.manage');
    }
    const required = sectionPermissionMap[sectionKey];
    if (!required) return true;
    if (isSuperAdmin) return true;
    if (userPermissions.size) return hasAdminPermission(required);
    return (user?.role || '').toLowerCase() === 'user';
  }

  function normalizeAdminPermissions(inputPermissions) {
    const allowed = new Set(ADMIN_PERMISSION_KEYS);
    const next = new Set((inputPermissions || []).map(String).filter((key) => allowed.has(key)));
    if (next.has('inventory.manage')) next.add('inventory.view');
    if (next.has('assignments.manage')) next.add('assignments.view');
    if (next.has('invoices.manage')) next.add('invoices.view');
    return Array.from(next);
  }

  function navigateMarketing(path) {
    const nextPath = normalizeMarketingPath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setMarketingPath(nextPath);
    setAuthView('landing');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  useEffect(() => {
    if (!token) {
      setSessionChecked(true);
      return;
    }
    setSessionChecked(false);
    apiFetch('/api/users', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`session_${r.status}`);
        return r.json();
      })
      .then((rows) => {
        setUsers(Array.isArray(rows) ? rows : []);
        setAuthView('app');
        setSessionChecked(true);
      })
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setSessionChecked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !sessionChecked || authView !== 'app') return;
    fetchAssets();
    fetchQuickAssignUsers();
    fetchAllocations();
    fetchStores();
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionChecked, authView]);

  useEffect(() => {
    if (!currentUserDomain) return;
    setAssetDomainName((prev) => prev || currentUserDomain);
    setAdminCreateForm((prev) => (
      prev.domain_name ? prev : { ...prev, domain_name: currentUserDomain }
    ));
  }, [currentUserDomain]);

  useEffect(() => {
    if (!token || section !== 'activity' || auditLogsLoaded) return;
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, section, auditLogsLoaded]);

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [authView, user]);

  useEffect(() => {
    const handlePopState = () => {
      setMarketingPath(normalizeMarketingPath(window.location.pathname));
      setAuthView('landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    setAuditLogsLoaded(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthView('login');
    setMessage('Session expired or unauthorized. Please login again as admin.');
    return true;
  }

  function fetchAssets() {
    apiFetch('/api/assets', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`assets_${r.status}`);
        return r.json();
      })
      .then(setAssets)
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setMessage('Unable to load assets. Ensure the backend is running.');
      });
  }

  function fetchUsers() {
    apiFetch('/api/users', { headers: authHeaders() })
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

  function fetchQuickAssignUsers() {
    apiFetch('/api/users?assignment_options=1', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`assignment_options_${r.status}`);
        return r.json();
      })
      .then((rows) => {
        const nextRows = Array.isArray(rows)
          ? rows.map((row) => ({ ...row, selection_value: buildAssignmentSelectionValue(row) }))
          : [];
        setQuickAssignUsers(nextRows);
      })
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setQuickAssignUsers([]);
      });
  }

  function fetchAllocations() {
    apiFetch('/api/allocations', { headers: authHeaders() })
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
    apiFetch('/api/audit-logs?limit=150', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`audit_${r.status}`);
        return r.json();
      })
      .then((rows) => {
        setAuditLogs(rows);
        setAuditLogsLoaded(true);
      })
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setAuditLogs([]);
        setAuditLogsLoaded(true);
      });
  }

  function fetchStores() {
    apiFetch('/api/stores', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`stores_${r.status}`);
        return r.json();
      })
      .then(setStores)
      .catch(() => setStores([]));
  }

  function fetchBrands() {
    apiFetch('/api/brands', { headers: authHeaders() })
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
      const res = await apiFetch('/api/auth/login', {
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
    setAuditLogsLoaded(false);
    setAuthView('landing');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMessage('');
  }

  async function allocate(e) {
    e.preventDefault();
    const asset_id = Number(quickAssignForm.assetId);
    const selectedEmployeeOption = quickAssignUsers.find((item) => String(item.selection_value || item.local_user_id || item.id) === String(quickAssignForm.userId));
    const notes = quickAssignForm.notes.trim();
    if (!asset_id || !selectedEmployeeOption) {
      setMessage('Select employee and available asset to assign');
      return;
    }
    const payload = {
      asset_id,
      notes,
      user_id: selectedEmployeeOption.local_user_id ? Number(selectedEmployeeOption.local_user_id) : null,
      employee_code: selectedEmployeeOption.employee_code || null,
      employee_name: selectedEmployeeOption.name || null,
      employee_email: selectedEmployeeOption.employee_email || null
    };
    const res = await apiFetch('/api/allocations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
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
    const res = await apiFetch(`/api/allocations/${allocationId}/return`, {
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
    const res = await apiFetch(`/api/allocations/${replacementForm.allocationId}/replace`, {
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
    const name = selectedAssetName.trim();
    const type = selectedAssetType;
    const serial = e.target.serial.value;
    const vendor = e.target.vendor.value;
    const notes = e.target.notes.value;
    const domain_name = (assetDomainName || currentUserDomain || '').trim().toLowerCase();
    const brand_id = selectedBrandId ? Number(selectedBrandId) : null;
    const model_id = selectedModelId ? Number(selectedModelId) : null;
    if (!name) {
      setMessage('Select asset name.');
      return;
    }
    if (!domain_name) {
      setMessage('Asset domain is required.');
      return;
    }
    const res = await apiFetch('/api/assets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, type, serial, vendor, notes, brand_id, model_id, domain_name })
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
      setMessage('You do not have permission to create assets for this domain.');
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
      setSelectedModelId('');
      setAssetDomainName(currentUserDomain || '');
    }
  }

  function parseAssetCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"' && inQuotes && nextChar === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];

    const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rows.slice(1).map((values) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      return record;
    });
  }

  async function uploadBulkAssets(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!hasAdminPermission('inventory.manage')) {
      setMessage('You do not have permission to upload assets.');
      e.target.value = '';
      return;
    }

    const text = await file.text();
    const rows = parseAssetCsv(text);
    if (!rows.length) {
      setMessage('CSV must include a header row and at least one asset row.');
      e.target.value = '';
      return;
    }

    const fallbackDomain = (assetDomainName || currentUserDomain || '').trim().toLowerCase();
    let created = 0;
    let failed = 0;

    for (const [index, row] of rows.entries()) {
      const name = row.asset || row.assetname || row.name || selectedAssetName || `Bulk Asset ${index + 1}`;
      const type = row.type || selectedAssetType || 'Laptop';
      const serial = row.serial || row.serialnumber || `BULK-${Date.now()}-${index + 1}`;
      const domain_name = (row.domain || row.domainname || fallbackDomain || 'global').trim().toLowerCase();

      const res = await apiFetch('/api/assets', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          type,
          serial,
          domain_name,
          vendor: row.vendor || '',
          notes: row.notes || '',
          brand_id: null,
          model_id: null
        })
      });

      if (res.ok) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    fetchAssets();
    fetchAuditLogs();
    e.target.value = '';
    setMessage(`Bulk upload complete: ${created} assets added${failed ? `, ${failed} failed` : ''}.`);
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
      role: (employeeEditForm.role || 'user').trim(),
      domain_name: (employeeEditForm.domain_name || '').trim().toLowerCase()
    };
    if (!payload.name || !payload.email) {
      setMessage('Name and email are required');
      return;
    }
    const res = await apiFetch(`/api/users/${selectedEmployee.id}`, {
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
        domain_name: body.domain_name ?? payload.domain_name,
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
            apiFetch(`/api/allocations/${asset.id}/return`, {
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
      setMessage('Only super admin can create role accounts.');
      return false;
    }
    const normalizedPermissions = normalizeAdminPermissions(adminCreateForm.permissions);
    if (!normalizedPermissions.length) {
      setMessage('Select at least one permission for this role account.');
      return false;
    }
    const payload = {
      name: adminCreateForm.name.trim(),
      email: adminCreateForm.email.trim(),
      password: adminCreateForm.password.trim() || 'password',
      role: (adminCreateForm.role || 'admin').trim(),
      domain_name: adminCreateForm.domain_name.trim().toLowerCase(),
      employee_code_prefix: adminCreateForm.employee_code_prefix.trim().toLowerCase(),
      permissions: normalizedPermissions
    };
    if (!payload.name || !payload.email || !payload.domain_name) {
      setMessage('Role account name, email, and domain are required.');
      return;
    }
    const res = await apiFetch('/api/users/admin', {
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
    setMessage(res.ok ? 'Role account created successfully.' : body.error || 'Role account creation failed');
    if (res.ok) {
      setAdminCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'admin',
        domain_name: currentUserDomain || '',
        employee_code_prefix: '',
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
      setMessage('Only super admin can update role permissions.');
      return false;
    }
    const permissions = normalizeAdminPermissions(adminPermissionDrafts[targetUserId] || []);
    if (!permissions.length) {
      setMessage('Select at least one permission before saving.');
      return false;
    }
    const res = await apiFetch(`/api/users/${targetUserId}/permissions`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ permissions })
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Role permissions updated.' : body.error || 'Permission update failed');
    if (res.ok) {
      fetchUsers();
      fetchAuditLogs();
    }
    return res.ok;
  }

  async function saveRoleAccountDetails(targetUserId) {
    if (!isSuperAdmin) {
      setMessage('Only super admin can update role account details.');
      return false;
    }
    const draft = adminDetailDrafts[targetUserId] || {};
    const payload = {
      name: String(draft.name || '').trim(),
      email: String(draft.email || '').trim(),
      role: String(draft.role || 'admin').trim(),
      domain_name: String(draft.domain_name || '').trim().toLowerCase(),
      employee_code_prefix: String(draft.employee_code_prefix || '').trim().toLowerCase()
    };
    if (!payload.name || !payload.email || !payload.role || !payload.domain_name) {
      setMessage('Name, email, role, and domain are required.');
      return false;
    }
    const res = await apiFetch(`/api/users/${targetUserId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Role account details updated.' : body.error || 'Role account update failed');
    if (res.ok) {
      fetchUsers();
      fetchAuditLogs();
    }
    return res.ok;
  }

  async function deleteRoleAccount(targetUserId) {
    if (!isSuperAdmin) {
      setMessage('Only super admin can delete role accounts.');
      return false;
    }
    const res = await apiFetch(`/api/users/${targetUserId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Role account deleted.' : body.error || 'Role account delete failed');
    if (res.ok) {
      fetchUsers();
      fetchAuditLogs();
      if (selectedAdminPermissionId === targetUserId) setSelectedAdminPermissionId(null);
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
  const activityLogRows = useMemo(() => {
    const auditRows = recentAuditLogs.map((log) => {
      const timeMs = log.event_at_ms ? Number(log.event_at_ms) : new Date(log.event_at || '').getTime();
      return {
        key: `audit-${log.id}`,
        timeMs: Number.isFinite(timeMs) ? timeMs : 0,
        timeLabel: log.event_at_ms ? new Date(Number(log.event_at_ms)).toLocaleString() : (log.event_at ? new Date(log.event_at).toLocaleString() : '-'),
        actor: `${log.actor_name || 'System'}${log.actor_role ? ` (${log.actor_role})` : ''}`,
        action: log.action || 'AUDIT_EVENT',
        entity: `${log.entity_type || 'Audit'}${log.entity_id ? ` #${log.entity_id}` : ''}`,
        details: log.details || '-'
      };
    });
    const timelineRows = recentActivity.map((event) => ({
      key: `timeline-${event.id}`,
      timeMs: event.timestampMs || 0,
      timeLabel: event.timestampMs ? new Date(event.timestampMs).toLocaleString() : '-',
      actor: event.userName || 'System',
      action: event.action === 'Allocated' ? 'ALLOCATE_ASSET' : 'RETURN_ASSET',
      entity: `Allocation #${event.allocationId}`,
      details: `${event.assetName} ${event.action.toLowerCase()} for ${event.userName}`
    }));
    return [...auditRows, ...timelineRows]
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, 60);
  }, [recentAuditLogs, recentActivity]);

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
  const allModelsBySelectedType = useMemo(() => {
    return brands
      .flatMap((brand) => brand.models || [])
      .filter((m) => (m.category || '').toLowerCase() === selectedAssetType.toLowerCase());
  }, [brands, selectedAssetType]);
  const modelOptionsByType = selectedBrandId ? selectedBrandModelsByType : allModelsBySelectedType;
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
    const modelNames = modelOptionsByType.map((m) => m.name);
    if (modelNames.length > 0) return modelNames;
    return FALLBACK_NAMES_BY_TYPE[selectedAssetType] || ['Generic Asset'];
  }, [modelOptionsByType, selectedAssetType]);
  useEffect(() => {
    if (!selectedBrandId) return;
    const existsForType = brandsBySelectedType.some((b) => String(b.id) === String(selectedBrandId));
    if (!existsForType) {
      setSelectedBrandId('');
      setSelectedAssetName('');
      setSelectedModelId('');
    }
  }, [brandsBySelectedType, selectedBrandId]);
  useEffect(() => {
    setSelectedModelId((prev) => (
      prev && modelOptionsByType.some((model) => String(model.id) === String(prev)) ? prev : ''
    ));
  }, [modelOptionsByType]);
  const availableAssets = useMemo(() => assets.filter((a) => a.status === 'available'), [assets]);
  const employees = useMemo(() => {
    return users.filter((u) => (u.role || '').toLowerCase() === 'user');
  }, [users]);
  const quickAssignTypeOptions = useMemo(
    () => Array.from(new Set(availableAssets.map((asset) => asset.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [availableAssets]
  );
  const employeeDropdownOptions = useMemo(
    () => quickAssignUsers,
    [quickAssignUsers]
  );
  const quickAssignEmployeeOptions = useMemo(
    () => employeeDropdownOptions
      .map((user) => ({
        value: buildAssignmentSelectionValue(user),
        label: user.label || user.name,
        searchText: `${user.name || ''} ${user.employee_code || ''} ${user.employee_email || ''}`,
      })),
    [employeeDropdownOptions]
  );
  const assetNameDropdownOptions = useMemo(
    () => assetNameOptions.map((name) => ({
      value: name,
      label: name,
      searchText: name,
    })),
    [assetNameOptions]
  );
  const modelDropdownOptions = useMemo(
    () => modelOptionsByType.map((model) => ({
      value: String(model.id),
      label: model.name,
      searchText: `${model.name || ''} ${model.category || ''}`,
    })),
    [modelOptionsByType]
  );
  const assignmentFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Employees', searchText: 'all employees' },
      ...employeeDropdownOptions
        .map((user) => ({
          value: buildAssignmentSelectionValue(user),
          label: user.label || user.name,
          searchText: `${user.name || ''} ${user.employee_code || ''} ${user.employee_email || ''}`,
        })),
    ],
    [employeeDropdownOptions]
  );
  const quickAssignAssetOptions = useMemo(() => {
    return availableAssets
      .filter((asset) => quickAssignForm.assetType === 'all' || (asset.type || '') === quickAssignForm.assetType)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '') || (a.serial || '').localeCompare(b.serial || ''));
  }, [availableAssets, quickAssignForm.assetType]);
  const quickAssignAssetSelectOptions = useMemo(
    () => quickAssignAssetOptions.map((asset) => ({
      value: String(asset.id),
      label: `${asset.name || 'Asset'} (${asset.serial || '-'})`,
      searchText: `${asset.name || ''} ${asset.serial || ''} ${asset.type || ''} ${asset.brand_name || ''} ${asset.model_name || ''}`,
    })),
    [quickAssignAssetOptions]
  );
  const managedAdmins = useMemo(
    () => users.filter((u) => (u.role || '').toLowerCase() !== 'user' && !u.is_super_admin),
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
    const totalAdmins = users.filter((u) => (u.role || '').toLowerCase() !== 'user').length;
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
      if (!prev.userId) return prev;
      return employees.some((emp) => String(emp.id) === String(prev.userId))
        ? prev
        : { ...prev, userId: '' };
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
      domain_name: selectedEmployee.domain_name || currentUserDomain || '',
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
  }, [selectedEmployee, currentUserDomain]);
  useEffect(() => {
    const drafts = {};
    const detailDrafts = {};
    managedAdmins.forEach((admin) => {
      drafts[admin.id] = Array.isArray(admin.permissions) ? admin.permissions : [];
      detailDrafts[admin.id] = {
        name: admin.name || '',
        email: admin.email || '',
        role: admin.role || 'admin',
        domain_name: admin.domain_name || '',
        employee_code_prefix: admin.employee_code_prefix || ''
      };
    });
    setAdminPermissionDrafts(drafts);
    setAdminDetailDrafts(detailDrafts);
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
      const matchQuery = !q || `${a.name || ''} ${a.type || ''} ${a.serial || ''} ${a.vendor || ''} ${a.brand_name || ''} ${a.model_name || ''} ${a.domain_name || ''} ${a.status || ''}`.toLowerCase().includes(q);
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
  const filteredInvoices = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    return invoices
      .filter((invoice) => invoiceStatusFilter === 'all' || invoice.status === invoiceStatusFilter)
      .filter((invoice) => {
        if (!q) return true;
        return `${invoice.vendor || ''} ${invoice.billNo || ''} ${invoice.category || ''} ${invoice.subcategory || ''} ${invoice.notes || ''} ${invoice.status || ''}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const left = a.dueDate || '';
        const right = b.dueDate || '';
        if (left === right) return (b.createdAt || 0) - (a.createdAt || 0);
        return left.localeCompare(right);
      });
  }, [invoices, invoiceQuery, invoiceStatusFilter]);
  const invoiceStats = useMemo(() => {
    const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const paidAmount = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const unpaidAmount = invoices
      .filter((invoice) => invoice.status === 'unpaid')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const overdueCount = invoices.filter((invoice) => {
      if (invoice.status === 'paid' || !invoice.dueDate) return false;
      return new Date(`${invoice.dueDate}T23:59:59`).getTime() < Date.now();
    }).length;
    return {
      total: invoices.length,
      paid: invoices.filter((invoice) => invoice.status === 'paid').length,
      unpaid: invoices.filter((invoice) => invoice.status === 'unpaid').length,
      overdue: overdueCount,
      totalAmount,
      paidAmount,
      unpaidAmount
    };
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    setPage(1);
  }, [inventoryQuery, filterStatus, filterBrand, filterType, sortBy, sortDir]);

  const navItems = [
    { key: 'overview', label: 'Overview', icon: 'DB' },
    { key: 'inventory', label: 'Inventory', icon: 'IV' },
    { key: 'assignments', label: 'Assignments', icon: 'AS' },
    { key: 'insights', label: 'Insights', icon: 'IN' },
    { key: 'invoices', label: 'Invoices', icon: 'BI' },
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

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function createInvoice(e) {
    e.preventDefault();
    if (!hasAdminPermission('invoices.manage')) {
      setMessage('You do not have permission to add invoices.');
      return;
    }
    const amount = Number(invoiceForm.amount);
    if (!invoiceForm.vendor.trim() || !invoiceForm.billNo.trim() || !amount) {
      setMessage('Vendor, bill number, and amount are required.');
      return;
    }
    setInvoices((prev) => [
      {
        id: Date.now(),
        vendor: invoiceForm.vendor.trim(),
        billNo: invoiceForm.billNo.trim(),
        category: invoiceForm.category,
        subcategory: invoiceForm.subcategory,
        amount,
        dueDate: invoiceForm.dueDate,
        status: invoiceForm.status,
        notes: invoiceForm.notes.trim(),
        invoiceFileName: invoiceForm.invoiceFileName,
        invoiceFileData: invoiceForm.invoiceFileData,
        createdAt: Date.now()
      },
      ...prev
    ]);
    setInvoiceForm({
      vendor: '',
      billNo: '',
      category: 'Assets Bill',
      subcategory: 'Laptops',
      amount: '',
      dueDate: '',
      status: 'unpaid',
      notes: '',
      invoiceFileName: '',
      invoiceFileData: ''
    });
    setMessage('Invoice saved.');
  }

  function readInvoiceFile(file, onReady) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onReady({
      invoiceFileName: file.name,
      invoiceFileData: String(reader.result || '')
    });
    reader.readAsDataURL(file);
  }

  function toggleInvoiceStatus(invoiceId) {
    if (!hasAdminPermission('invoices.manage')) {
      setMessage('You do not have permission to update invoices.');
      return;
    }
    setInvoices((prev) => prev.map((invoice) => (
      invoice.id === invoiceId
        ? { ...invoice, status: invoice.status === 'paid' ? 'unpaid' : 'paid' }
        : invoice
    )));
  }

  function updateInvoiceUpload(invoiceId, file) {
    if (!file) return;
    if (!hasAdminPermission('invoices.manage')) {
      setMessage('You do not have permission to update invoices.');
      return;
    }
    readInvoiceFile(file, (filePayload) => {
      setInvoices((prev) => prev.map((invoice) => (
        invoice.id === invoiceId
          ? { ...invoice, ...filePayload }
          : invoice
      )));
    });
  }

  function showInvoice(invoice) {
    if (!invoice.invoiceFileData) {
      setMessage('Upload an invoice before viewing it.');
      return;
    }
    setInvoicePreview(invoice);
  }

  if (!user) {
    const SelectedMarketingPage = MARKETING_PAGE_COMPONENTS[marketingPath] || null;
    const marketingScreen = SelectedMarketingPage ? (
      <SelectedMarketingPage
        currentPath={marketingPath}
        navigate={navigateMarketing}
        onLogin={() => setAuthView('login')}
      />
    ) : (
      <LandingPage
        currentPath={MARKETING_HOME_PATH}
        navigate={navigateMarketing}
        onLogin={() => setAuthView('login')}
      />
    );

    return (
      <>
        {authView === 'landing' ? (
          marketingScreen
        ) : (
          <>
            <div className="auth-page-underlay" aria-hidden="true">
              {marketingScreen}
            </div>
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
                    <button
                      type="button"
                      className="auth-close"
                      aria-label="Close login"
                      onClick={() => setAuthView('landing')}
                    >
                      ×
                    </button>
                    <h3 id="login-title">Hello!</h3>
                    <p>Sign in to get started.</p>
                    <form onSubmit={login} className="form auth-form-modern" autoComplete="off">
                      <div className="input-shell">
                        <span>U</span>
                        <input
                          id="email"
                          name="email"
                          type={showLoginUsername ? 'text' : 'password'}
                          placeholder="Username"
                          autoComplete="off"
                          required
                        />
                        <button
                          type="button"
                          className="auth-visibility-toggle"
                          aria-label={showLoginUsername ? 'Hide username' : 'Show username'}
                          aria-pressed={showLoginUsername}
                          onClick={() => setShowLoginUsername((v) => !v)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                            <circle cx="12" cy="12" r="3" />
                            {!showLoginUsername && <path d="M4 4l16 16" />}
                          </svg>
                        </button>
                      </div>
                      <div className="input-shell">
                        <span>P</span>
                        <input
                          id="password"
                          name="password"
                          type={showLoginPassword ? 'text' : 'password'}
                          placeholder="Password"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          className="auth-visibility-toggle"
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showLoginPassword}
                          onClick={() => setShowLoginPassword((v) => !v)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                            <circle cx="12" cy="12" r="3" />
                            {!showLoginPassword && <path d="M4 4l16 16" />}
                          </svg>
                        </button>
                      </div>
                      <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
                    </form>
                    <p className="msg">{message}</p>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }


  return (
    <div className="app-layout dashboard-shell">
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
                    const header = ['Asset', 'Type', 'Brand', 'Model', 'Domain', 'Vendor', 'Serial', 'Status'];
                    const rows = filteredSortedAssets.map((a) => [
                      a.name || '',
                      a.type || '',
                      a.brand_name || '',
                      a.model_name || '',
                      a.domain_name || '',
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
                    <span>{modelOptionsByType.length} models</span>
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
                        setSelectedModelId('');
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
                        setSelectedModelId('');
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
                    <SearchableSelect
                      value={selectedAssetName}
                      onChange={setSelectedAssetName}
                      options={assetNameDropdownOptions}
                      placeholder="Select asset name"
                      searchPlaceholder="Search asset name..."
                      emptyMessage="No asset name found"
                    />
                  </label>
                  <label className="field">
                    <span>Model</span>
                    <SearchableSelect
                      value={selectedModelId}
                      onChange={setSelectedModelId}
                      options={modelDropdownOptions}
                      placeholder={`Select ${selectedAssetType} model`}
                      searchPlaceholder={`Search ${selectedAssetType.toLowerCase()} model...`}
                      emptyMessage="No model found"
                    />
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
                    <span>Domain</span>
                    <input
                      name="domain_name"
                      placeholder="e.g. finance"
                      value={assetDomainName}
                      onChange={(e) => setAssetDomainName(e.target.value.toLowerCase())}
                      required
                      disabled={!isSuperAdmin}
                    />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <input name="notes" placeholder="Branch, team, procurement, warranty..." />
                  </label>
                  <label className="field asset-bulk-upload">
                    <span>Bulk Upload Assets</span>
                    <input type="file" accept=".csv,text/csv" onChange={uploadBulkAssets} />
                  </label>
                  <div className="create-actions">
                    <small>
                      {selectedBrandId
                        ? `Adding ${selectedAssetType}${selectedBrandName ? ` / ${selectedBrandName}` : ''}`
                        : `Choose any ${selectedAssetType} model or narrow by brand`}
                    </small>
                    <button type="submit">Add Asset</button>
                  </div>
                </form>
              </div>
            )}

            <div className="inventory-filter-grid">
              <input
                className="inventory-search"
                placeholder="Search by asset, serial, vendor, brand, model, domain, status..."
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
                <option value="domain_name">Sort by Domain</option>
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
                  <thead><tr><th>Asset</th><th>Type</th><th>Brand</th><th>Model</th><th>Domain</th><th>Vendor</th><th>Serial</th><th>Status</th><th>QR</th></tr></thead>
                  <tbody>
                    {paginatedAssets.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td><td>{a.type}</td><td>{a.brand_name || '-'}</td><td>{a.model_name || '-'}</td><td>{a.domain_name || '-'}</td><td>{a.vendor || '-'}</td><td>{a.serial}</td>
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
                <SearchableSelect
                  value={assignmentUserFilter}
                  onChange={setAssignmentUserFilter}
                  options={assignmentFilterOptions}
                  placeholder="All Employees"
                  searchPlaceholder="Search employee..."
                  emptyMessage="No employee found"
                />
                <button type="submit" className="small">Search</button>
              </form>

              {hasAdminPermission('assignments.manage') && (
                <div className="create-box assignment-quick-assign">
                  <h4>Quick Assign Asset</h4>
                  <form id="assignment-quick-form" onSubmit={allocate} className="form assignment-inline-form">
                    <SearchableSelect
                      value={quickAssignForm.userId}
                      onChange={(nextValue) => setQuickAssignForm((prev) => ({ ...prev, userId: nextValue }))}
                      options={quickAssignEmployeeOptions}
                      placeholder={quickAssignEmployeeOptions.length ? 'Select employee' : 'No employees available'}
                      searchPlaceholder="Search employee..."
                      emptyMessage="No employee found"
                    />
                    <select
                      value={quickAssignForm.assetType}
                      onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, assetType: e.target.value }))}
                    >
                      <option value="all">All asset types</option>
                      {quickAssignTypeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <SearchableSelect
                      value={quickAssignForm.assetId}
                      onChange={(nextValue) => setQuickAssignForm((prev) => ({ ...prev, assetId: nextValue }))}
                      options={quickAssignAssetSelectOptions}
                      placeholder={quickAssignAssetSelectOptions.length ? 'Select available asset' : 'No available assets'}
                      searchPlaceholder="Search asset by name, serial, brand..."
                      emptyMessage="No asset found"
                    />
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
                    Create Role Account
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
                    <span>Managed Roles</span>
                    <strong>{accountSummary.totalManaged}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-indigo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>Total Role Accounts</span>
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
                  <p>Only the super admin can create role accounts, assign domains, and change permissions.</p>
                </div>
              </div>
            ) : (
              <section className="acct-table-section">
                <div className="acct-table-header">
                  <div className="acct-table-title-group">
                    <h4>Role Permission Control</h4>
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
                        <th>Role Account</th>
                        <th>Permission Access</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManagedAdmins.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="acct-empty-row">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                            <span>No managed role accounts found.</span>
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
                                    <small>{adminUser.email} | {adminUser.role} | {adminUser.domain_name || '-'} | prefix: {adminUser.employee_code_prefix || '-'}</small>
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
                  <h3 id="create-admin-title">Create Role Account</h3>
                  <p>Create a role account, assign a domain, and set permissions in one popup.</p>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="small outline" onClick={() => setCreateAdminPopupOpen(false)}>Close</button>
                </div>
              </header>
              <form className="form account-create-form" onSubmit={createAdminAccount}>
                <div className="account-form-row">
                  <input
                    placeholder="Account name"
                    value={adminCreateForm.name}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Account email"
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
                <div className="account-form-row">
                  <input
                    type="text"
                    placeholder="Role name e.g. admin, manager"
                    value={adminCreateForm.role}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Domain e.g. finance"
                    value={adminCreateForm.domain_name}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, domain_name: e.target.value.toLowerCase() }))}
                    required
                  />
                </div>
                <input
                  type="text"
                  placeholder="Employee code prefix e.g. fch"
                  value={adminCreateForm.employee_code_prefix}
                  onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, employee_code_prefix: e.target.value.toLowerCase() }))}
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
                  <p>{selectedAdminPermissionUser.email} | role: {selectedAdminPermissionUser.role} | domain: {selectedAdminPermissionUser.domain_name || '-'} | prefix: {selectedAdminPermissionUser.employee_code_prefix || '-'}</p>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="small outline" onClick={() => setSelectedAdminPermissionId(null)}>Close</button>
                </div>
              </header>

              <div className="account-form-row">
                <input
                  placeholder="Account name"
                  value={adminDetailDrafts[selectedAdminPermissionUser.id]?.name || ''}
                  onChange={(e) => setAdminDetailDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: {
                      ...(prev[selectedAdminPermissionUser.id] || {}),
                      name: e.target.value
                    }
                  }))}
                />
                <input
                  type="email"
                  placeholder="Account email"
                  value={adminDetailDrafts[selectedAdminPermissionUser.id]?.email || ''}
                  onChange={(e) => setAdminDetailDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: {
                      ...(prev[selectedAdminPermissionUser.id] || {}),
                      email: e.target.value
                    }
                  }))}
                />
              </div>
              <div className="account-form-row">
                <input
                  placeholder="Role"
                  value={adminDetailDrafts[selectedAdminPermissionUser.id]?.role || ''}
                  onChange={(e) => setAdminDetailDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: {
                      ...(prev[selectedAdminPermissionUser.id] || {}),
                      role: e.target.value
                    }
                  }))}
                />
                <input
                  placeholder="Domain"
                  value={adminDetailDrafts[selectedAdminPermissionUser.id]?.domain_name || ''}
                  onChange={(e) => setAdminDetailDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: {
                      ...(prev[selectedAdminPermissionUser.id] || {}),
                      domain_name: e.target.value.toLowerCase()
                    }
                  }))}
                />
              </div>
              <input
                placeholder="Employee code prefix e.g. fch"
                value={adminDetailDrafts[selectedAdminPermissionUser.id]?.employee_code_prefix || ''}
                onChange={(e) => setAdminDetailDrafts((prev) => ({
                  ...prev,
                  [selectedAdminPermissionUser.id]: {
                    ...(prev[selectedAdminPermissionUser.id] || {}),
                    employee_code_prefix: e.target.value.toLowerCase()
                  }
                }))}
              />

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
                  className="small outline"
                  onClick={() => saveRoleAccountDetails(selectedAdminPermissionUser.id)}
                >
                  Save Details
                </button>
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
                <button
                  type="button"
                  className="small outline"
                  onClick={() => deleteRoleAccount(selectedAdminPermissionUser.id)}
                >
                  Delete Account
                </button>
              </div>
            </section>
          </div>
        )}

        {selectedEmployee && (
          <div className="employee-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="employee-view-title" onClick={() => setSelectedEmployeeId(null)}>
            <section className="employee-modal" onClick={(e) => e.stopPropagation()}>
              <header className="employee-modal-hero">
                <div className="employee-modal-photo" aria-hidden="true">
                  {getNameInitials(selectedEmployee.name)}
                </div>
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
                    <span className="soft-pill">Domain: {selectedEmployee.domain_name || '-'}</span>
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
                        <input
                          type="text"
                          value={employeeEditForm.role}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, role: e.target.value }))}
                          placeholder="user / admin / manager"
                          required
                        />
                      </label>
                      <label>
                        <span>Domain</span>
                        <input
                          type="text"
                          value={employeeEditForm.domain_name}
                          onChange={(e) => setEmployeeEditForm((prev) => ({ ...prev, domain_name: e.target.value.toLowerCase() }))}
                          placeholder="finance / hr / sales"
                          required
                        />
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
                      <div><label>Domain</label><p>{selectedEmployee.domain_name || '-'}</p></div>
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

        {section === 'invoices' && (
          <section className="panel wide invoice-page">
            <section className="inventory-head invoice-head">
              <div>
                <h3>Tracker Bill-Invoice Payment Record All</h3>
                <p className="hint">Store bill details and track paid or unpaid invoice status.</p>
              </div>
              <div className="inventory-head-actions">
                <button type="button" className="outline" onClick={() => setInvoiceStatusFilter('all')}>All Bills</button>
                <button type="button" className="outline" onClick={() => setInvoiceStatusFilter('unpaid')}>Unpaid</button>
                <button type="button" className="outline" onClick={() => setInvoiceStatusFilter('paid')}>Paid</button>
              </div>
            </section>

            <section className="inventory-mini-stats invoice-stats">
              <article><span>Total Bills</span><strong>{invoiceStats.total}</strong><small>{formatCurrency(invoiceStats.totalAmount)}</small></article>
              <article><span>Paid</span><strong>{invoiceStats.paid}</strong><small>{formatCurrency(invoiceStats.paidAmount)}</small></article>
              <article><span>Unpaid</span><strong>{invoiceStats.unpaid}</strong><small>{formatCurrency(invoiceStats.unpaidAmount)}</small></article>
              <article><span>Overdue</span><strong>{invoiceStats.overdue}</strong><small>Needs follow-up</small></article>
            </section>

            <section className="invoice-layout">
              {hasAdminPermission('invoices.manage') && (
                <section className="create-box invoice-form-card">
                  <div className="create-head">
                    <div>
                      <h4>Add Bill</h4>
                      <p className="hint">Record vendor, amount, due date, and payment state.</p>
                    </div>
                  </div>
                  <form className="form invoice-form" onSubmit={createInvoice}>
                    <label className="field">
                      <span>Vendor</span>
                      <input
                        value={invoiceForm.vendor}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, vendor: e.target.value }))}
                        placeholder="e.g. Dell Partner"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Bill Number</span>
                      <input
                        value={invoiceForm.billNo}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, billNo: e.target.value }))}
                        placeholder="e.g. INV-2026-001"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={invoiceForm.category}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          setInvoiceForm((prev) => ({
                            ...prev,
                            category: nextCategory,
                            subcategory: INVOICE_SUBCATEGORIES_BY_CATEGORY[nextCategory][0]
                          }));
                        }}
                      >
                        {Object.keys(INVOICE_SUBCATEGORIES_BY_CATEGORY).map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Subcategory</span>
                      <select
                        value={invoiceForm.subcategory}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, subcategory: e.target.value }))}
                      >
                        {(INVOICE_SUBCATEGORIES_BY_CATEGORY[invoiceForm.category] || []).map((subcategory) => (
                          <option key={subcategory} value={subcategory}>{subcategory}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="50000"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Due Date</span>
                      <input
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        value={invoiceForm.status}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    </label>
                    <label className="field invoice-notes">
                      <span>Notes</span>
                      <input
                        value={invoiceForm.notes}
                        onChange={(e) => setInvoiceForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="PO, branch, renewal, warranty..."
                      />
                    </label>
                    <label className="field invoice-upload-field">
                      <span>Upload Invoice</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => readInvoiceFile(e.target.files?.[0], (filePayload) => {
                          setInvoiceForm((prev) => ({ ...prev, ...filePayload }));
                        })}
                      />
                    </label>
                    <div className="create-actions">
                      <small>{invoiceStats.unpaid} unpaid bills in tracker</small>
                      <button type="submit">Save Bill</button>
                    </div>
                  </form>
                </section>
              )}

              <section className="inventory-table-shell invoice-table-card">
                <div className="invoice-toolbar">
                  <input
                    className="inventory-search"
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                    placeholder="Search vendor, bill number, category, subcategory, notes..."
                  />
                  <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill No</th>
                        <th>Vendor</th>
                        <th>Category</th>
                        <th>Subcategory</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th>Upload Invoice</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.length === 0 && (
                        <tr><td colSpan={10}>No bill details saved yet.</td></tr>
                      )}
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.billNo}</td>
                          <td>{invoice.vendor}</td>
                          <td>{invoice.category}</td>
                          <td>{invoice.subcategory || '-'}</td>
                          <td>{formatCurrency(invoice.amount)}</td>
                          <td>{invoice.dueDate || '-'}</td>
                          <td><span className={`status invoice-status ${invoice.status}`}>{invoice.status}</span></td>
                          <td>{invoice.notes || '-'}</td>
                          <td>
                            <label className="invoice-table-upload">
                              <span>{invoice.invoiceFileName || 'Upload'}</span>
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp"
                                onChange={(e) => updateInvoiceUpload(invoice.id, e.target.files?.[0])}
                              />
                            </label>
                          </td>
                          <td>
                            <div className="invoice-actions">
                              <button type="button" className="small" onClick={() => toggleInvoiceStatus(invoice.id)}>
                                Mark {invoice.status === 'paid' ? 'Unpaid' : 'Paid'}
                              </button>
                              <button
                                type="button"
                                className="small invoice-show-btn"
                                disabled={!invoice.invoiceFileData}
                                onClick={() => showInvoice(invoice)}
                              >
                                Show Invoice
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
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

            <section className="activity-grid activity-grid-single">
              {/*
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
              */}

              <section className="panel activity-panel">
                <div className="panel-head"><h3>Activity Log</h3></div>
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
                      {activityLogRows.length === 0 && (
                        <tr><td colSpan={5}>No activity entries yet.</td></tr>
                      )}
                      {activityLogRows.map((log) => (
                        <tr key={log.key}>
                          <td>{log.timeLabel}</td>
                          <td>{log.actor}</td>
                          <td>
                            <span className={`activity-action-badge action-${(log.action || '').toLowerCase()}`}>
                              {formatAuditAction(log.action)}
                            </span>
                          </td>
                          <td>{log.entity}</td>
                          <td>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </section>
        )}

        {invoicePreview && (
          <div className="invoice-preview-overlay" role="dialog" aria-modal="true" aria-label="Invoice preview">
            <div className="invoice-preview-modal">
              <div className="invoice-preview-head">
                <div>
                  <h3>{invoicePreview.invoiceFileName || 'Invoice'}</h3>
                  <p>{invoicePreview.vendor} | {invoicePreview.billNo}</p>
                </div>
                <button type="button" className="outline" onClick={() => setInvoicePreview(null)}>Close</button>
              </div>
              <div className="invoice-preview-body">
                {String(invoicePreview.invoiceFileData).startsWith('data:image/') ? (
                  <img src={invoicePreview.invoiceFileData} alt={invoicePreview.invoiceFileName || 'Invoice'} />
                ) : (
                  <iframe src={invoicePreview.invoiceFileData} title={invoicePreview.invoiceFileName || 'Invoice'} />
                )}
              </div>
            </div>
          </div>
        )}

        {message && <div className="toast">{message}</div>}
      </div>
    </div>
  );
}

export default App;
