import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import LandingPage from './components/LandingPage';
import AssetTrackingPage from './pages/AssetTrackingPage';
import ContactPage from './pages/ContactPage';
import EnterprisePage from './pages/EnterprisePage';
import GlobalFleetPage from './pages/GlobalFleetPage';
import PlatformPage from './pages/PlatformPage';
import PricingPage from './pages/PricingPage';
import ResourcesPage from './pages/ResourcesPage';
import SecurityOpsPage from './pages/SecurityOpsPage';
import SolutionsPage from './pages/SolutionsPage';
import { MARKETING_HOME_PATH, normalizeMarketingPath } from './pages/marketingPages';
import importedTrackerInvoices from './data/importedInvoices.json';


const DEV_API_PORTS = Array.from({ length: 20 }, (_, index) => 4000 + index);
const API_BASE_STORAGE_KEY = 'itmanage.apiBase';
const EMPLOYEE_PHOTO_BUCKET = process.env.REACT_APP_EMPLOYEE_PHOTO_BUCKET || 'it-manage-145023120812-ap-south-1-an';
const EMPLOYEE_PHOTO_REGION = process.env.REACT_APP_EMPLOYEE_PHOTO_REGION || 'ap-south-1';
const EMPLOYEE_PHOTO_BASE_URL = process.env.REACT_APP_EMPLOYEE_PHOTO_BASE_URL
  || `https://${EMPLOYEE_PHOTO_BUCKET}.s3.${EMPLOYEE_PHOTO_REGION}.amazonaws.com`;

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
  const candidates = [`http://${hostname}:4000`, storedApi, configuredApi].filter(Boolean);
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
        const health = await response.json().catch(() => ({}));
        if (
          process.env.NODE_ENV === 'development' &&
          !health?.capabilities?.assignedByPersistence
        ) {
          lastError = new Error('health_missing_assigned_by_persistence');
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
const OTHER_ASSET_TYPE_VALUE = '__other_asset_type__';
const OTHER_BRAND_VALUE = '__other_brand__';
const OTHER_MODEL_VALUE = '__other_model__';

function normalizeBrandName(name) {
  return String(name || '').trim().toLowerCase();
}

function isAppleMacBrandName(name) {
  const normalized = normalizeBrandName(name);
  return ['apple', 'mac', 'macbook', 'macintosh'].includes(normalized);
}

function dedupeModels(models) {
  const seen = new Set();
  return models.filter((model) => {
    const key = `${normalizeBrandName(model.category)}::${normalizeBrandName(model.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const INVOICE_SUBCATEGORIES_BY_CATEGORY = {
  'Assets Bill': ['Laptops', 'Phone', 'SIM', 'Printer', 'Camira', 'BIOMATRIX', 'Other'],
  'Utility Bill': ['Wifi Bill', 'Leased Line Bill', 'Electricity Bill', 'Water Bill', 'Pantry Supplies', 'Cleaning Supplies', 'Marketing', 'Petty Cash', 'Other'],
  'Maintenance Bill': ['Office Maintenance', 'Cleaning & Maintenance', 'Reparing & Maintenance', 'Other'],
  'Rental Bill': ['Office Rent', 'Other'],
  'Other Bill': ['Other----']
};

const INVOICE_APPROVER_NAME_OPTIONS = ['Hansi Kunwar'];

const BILL_DESCRIPTION_VENDOR_OPTIONS = [
  'AbCom',
  'ACT Bill, SANT NAGAR',
  'ACT Bill, Tajes',
  'AirTel CREDWISE Leas Line A 62 2nd floor Sector 2 noida',
  'AirTel CREDWISE Mobile Bill',
  'Airtel FINTECH CLOUD Leas Line Sector -63 Noida 3rd & 4th floor',
  'AirTel FINTECH CLOUD Mobile Bill',
  'AirTel FINTECH CLOUD Wifi Bill',
  'AirTel Fintech F1Speed Loan Mobile Bill',
  'AirTel Jan Bill Naman Finlease',
  'AirTel Leas Line A 62 2nd floor Sector 2 noida',
  'Airtel Leas Line Devika tower',
  'Airtel Leas Line SEC 63 ,NOIDA',
  'Airtel Leas Line UDYOG VIHAR',
  'AirTel Mobile Bill Credwise',
  'AirTel Mobile Bill F1 Speed Loan',
  'AirTel Mobile Bill Naman',
  'AirTel Mobile Bill Pawansut',
  'AirTel Mobile Bill, south extension',
  'AirTel Mobile Naman',
  'AirTel Naman Leas Line Salary Setu, Devika Tower',
  'AirTel wifi Bill',
  'AirTel wifi Bill Accounts',
  'AirTel wifi Bill Dhanrishi',
  'AirTel wifi Bill FUNDOBABA',
  'AirTel wifi Bill NavNirmman',
  'AirTel wifi Bill NPA Birpal',
  'AirTel wifi Bill panchsheel park',
  'AirTel wifi Bill S4S',
  'AirTel wifi Bill Sec -63',
  'AirTel wifi Bill Udyog vihar',
  'AirTel wifi Bill, Badarpur,',
  'AirTel wifi Bill, Udyog Vihar,',
  'AirTel wifi Mumbai, Bill',
  'AirTel Wifi, (Disconnected) A-62, Sector 2, Noida',
  'DAKSH COPIER SYSTEM',
  'Daksh Copier, DWRKA',
  'Daksh Copier, SEC 63 ,NOIDA',
  'Daksh Copier, SEC 63 ,NOIDA + Deposit',
  'Daksh Copier, UDYOG VIHAR',
  'Jordan IT',
  'Jordan IT -19 Laptop Rental',
  'Jordan IT -2 Laptop Rental',
  'Jordan IT -3 Laptop Rental',
  'Jordan IT -41 Laptop Rental',
  'Jordan IT Repair DISPLAY',
  'Jordan IT Repair PANEL',
  'KTCS Computer, 1 Laptop Rental',
  'KTCS Computer, 4 Laptop Rental',
  'KTCS Computer, 6 Laptop Rental',
  'KTCS Computer, Rental',
  'NEW VISION ENTERPRISES',
  'Point Blank',
  'Point Blank, Bio-Metric',
  'Point Blank, CAMERA',
  'Point Blank, Installation Sant Nagar,',
  'Point Blank, Service',
  'Siddiki Emgineers Devika Tower',
  'Siddiki Engineers',
  'Tata FINTECH CLOUD Leas Line Sector -63 Noida 3rd & 4th floor',
  'Tata NXG Leas Line A 62 4th floor Sector 2 noida',
  'Timbl Leas Line Bill',
  'U.M.COMPUTER SOLUTION',
  'UM Computer, Router for SalarySatu Devika Tower',
  'UM Computer, UPS & Router for Sec-2, 4th floor Noida',
  'VI Bill',
  'VI Bill FINTECH',
  'VI Bill NAMAN'
];

const INVOICE_APPROVAL_STAGES = [
  { key: 'domain', label: 'Bill Raised', helper: 'Domain' },
  { key: 'head', label: 'Admin Approval', helper: 'Stage 2' },
  { key: 'accounts', label: 'Accounts Approval', helper: 'Final approval' },
  { key: 'payment', label: 'Payment', helper: 'Mark paid' }
];

const INVOICE_APPROVAL_STATUS_LABELS = {
  pending_domain: 'Raised',
  pending_head: 'Pending Admin',
  pending_accounts: 'Pending Accounts',
  payment_pending: 'Payment Pending',
  completed: 'Completed',
  rejected: 'Rejected',
  correction: 'Correction Required'
};
const INVOICE_APPROVAL_SORT_ORDER = {
  pending_domain: 0,
  pending_head: 0,
  pending_accounts: 0,
  payment_pending: 0,
  rejected: 1,
  correction: 1,
  completed: 2
};
const INVOICE_STORAGE_VERSION = 'head_accounts_approval_v1';
const DELETED_INVOICE_KEYS_STORAGE_KEY = 'deleted_invoice_keys';
const INVOICE_ACCOUNTANT_NAMES = ['hansi kunwar', 'umesh', 'umesh ji', 'jeetiesh', 'jeetiesh ji'];
const ROLE_ACCOUNT_PASSWORDS_KEY = 'itmanage_role_account_passwords';

function getInvoiceMergeKey(invoice = {}) {
  return [
    String(invoice.billNo || '').trim().toLowerCase(),
    String(invoice.vendor || '').trim().toLowerCase(),
    String(invoice.amount || '').trim(),
    String(invoice.dueDate || '').trim()
  ].join('|');
}

function mergeImportedInvoices(savedInvoices = [], importedInvoices = []) {
  const merged = [];
  const seen = new Set();
  [...savedInvoices, ...importedInvoices].forEach((invoice) => {
    const key = getInvoiceMergeKey(invoice);
    if (!key.replace(/\|/g, '') || seen.has(key)) return;
    seen.add(key);
    merged.push(invoice);
  });
  return merged;
}

function readDeletedInvoiceKeys() {
  try {
    const keys = JSON.parse(localStorage.getItem(DELETED_INVOICE_KEYS_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(keys) ? keys : []);
  } catch (_error) {
    return new Set();
  }
}

function stripInvoiceAttachmentData(invoice) {
  return {
    ...invoice,
    invoiceFileData: '',
    paidBillScreenshotData: ''
  };
}

function persistInvoicesSafely(nextInvoices) {
  const serializedInvoices = JSON.stringify(nextInvoices);
  try {
    localStorage.setItem('invoices', serializedInvoices);
    return 'full';
  } catch (_error) {
    const lightweightInvoices = nextInvoices.map(stripInvoiceAttachmentData);
    const serializedLightweightInvoices = JSON.stringify(lightweightInvoices);
    try {
      localStorage.setItem('invoices', serializedLightweightInvoices);
      return 'lightweight';
    } catch (_retryError) {
      localStorage.removeItem('invoices');
      localStorage.setItem('invoices', serializedLightweightInvoices);
      return 'lightweight';
    }
  }
}

const INVOICE_ATTACHMENT_DB = 'itmanage_invoice_attachments';
const INVOICE_ATTACHMENT_STORE = 'attachments';

function openInvoiceAttachmentDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(INVOICE_ATTACHMENT_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(INVOICE_ATTACHMENT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveInvoiceAttachment(key, value) {
  const db = await openInvoiceAttachmentDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVOICE_ATTACHMENT_STORE, 'readwrite');
    transaction.objectStore(INVOICE_ATTACHMENT_STORE).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getInvoiceAttachment(key) {
  const db = await openInvoiceAttachmentDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVOICE_ATTACHMENT_STORE, 'readonly');
    const request = transaction.objectStore(INVOICE_ATTACHMENT_STORE).get(key);
    request.onsuccess = () => resolve(request.result || '');
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function getInvoiceAttachmentKey(invoiceId, type) {
  return `invoice:${invoiceId}:${type}`;
}

const ADMIN_PERMISSION_OPTIONS = [
  { key: 'overview.view', label: 'Dashboard: Overview' },
  { key: 'inventory.view', label: 'Inventory: View Assets' },
  { key: 'inventory.manage', label: 'Inventory: Add/Edit/Delete Assets' },
  { key: 'assignments.view', label: 'Assignments: View Employee Assets' },
  { key: 'assignments.manage', label: 'Assignments: Assign/Return/Replace Assets' },
  { key: 'insights.view', label: 'Insights: View' },
  { key: 'invoices.view', label: 'Invoices: View Bills' },
  { key: 'invoices.manage', label: 'Invoices: Add Bills' },
  { key: 'activity.view', label: 'Recent Activity: View' },
  { key: 'accounts.manage', label: 'Role Account: Management' }
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
  '/pricing': PricingPage,
  '/contact': ContactPage
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className = '',
  allowCreate = false,
  createLabel = 'Add',
  selectedLabel = '',
  onCreate,
  showSearch = true,
  customMode = false,
  customValue = '',
  customPlaceholder = '',
  onCustomChange,
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
    if (!showSearch) return options;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label || ''} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query, showSearch]);
  const trimmedQuery = query.trim();
  const canCreate = showSearch && allowCreate && trimmedQuery && !options.some((option) =>
    String(option.label || '').trim().toLowerCase() === trimmedQuery.toLowerCase()
  );

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

    const focusTimer = showSearch
      ? window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0)
      : null;

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, showSearch]);

  return (
    <div ref={rootRef} className={`searchable-select ${className}`.trim()}>
      {customMode && (
        <div className={`searchable-select__trigger searchable-select__trigger--custom${isOpen ? ' is-open' : ''}`}>
          <input
            className="searchable-select__custom-input"
            value={customValue}
            onChange={(event) => onCustomChange?.(event.target.value)}
            placeholder={customPlaceholder || placeholder}
            autoFocus
          />
          <button
            type="button"
            className="searchable-select__caret-button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Open options"
          >
            <span className="searchable-select__caret" aria-hidden="true" />
          </button>
        </div>
      )}
      {!customMode && (
      <button
        type="button"
        className={`searchable-select__trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={`searchable-select__value${selectedOption || selectedLabel ? '' : ' is-placeholder'}`}>
          {selectedOption?.label || selectedLabel || placeholder}
        </span>
        <span className="searchable-select__caret" aria-hidden="true" />
      </button>
      )}

      {isOpen && (
        <div className="searchable-select__menu">
          {showSearch && (
            <input
              ref={searchInputRef}
              className="searchable-select__search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          )}
          <div className="searchable-select__list">
            {canCreate && (
              <button
                type="button"
                className="searchable-select__option searchable-select__option--create"
                onClick={() => {
                  onCreate?.(trimmedQuery);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                {createLabel} "{trimmedQuery}"
              </button>
            )}
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
              !canCreate && <div className="searchable-select__empty">{emptyMessage}</div>
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

function isAbsoluteAssetUrl(value) {
  return /^(https?:|data:|blob:)/i.test(String(value || '').trim());
}

function encodeS3Key(key) {
  return String(key || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildS3PhotoUrl(key) {
  const cleanKey = String(key || '').trim().replace(/^\/+/, '');
  if (!cleanKey) return '';
  if (isAbsoluteAssetUrl(cleanKey)) return cleanKey;
  return `${EMPLOYEE_PHOTO_BASE_URL.replace(/\/$/, '')}/${encodeS3Key(cleanKey)}`;
}

function slugForPhoto(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getEmployeePhotoCandidates(employee) {
  const explicit = [
    employee?.profile_image_url,
    employee?.employee_photo,
    employee?.photo_url,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  const identifiers = [
    employee?.employee_code,
    employee?.email ? String(employee.email).split('@')[0] : '',
    employee?.id ? `employee-${employee.id}` : '',
    slugForPhoto(employee?.name),
  ].map((value) => String(value || '').trim()).filter(Boolean);

  const generated = [];
  const prefixes = ['', 'photos/', 'employee-photos/', 'employees/', 'profile-photos/'];
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  identifiers.forEach((identifier) => {
    const variants = Array.from(new Set([identifier, identifier.toUpperCase(), identifier.toLowerCase(), slugForPhoto(identifier)].filter(Boolean)));
    variants.forEach((variant) => {
      prefixes.forEach((prefix) => {
        extensions.forEach((extension) => generated.push(`${prefix}${variant}.${extension}`));
      });
    });
  });

  return Array.from(new Set([...explicit.map(buildS3PhotoUrl), ...generated.map(buildS3PhotoUrl)].filter(Boolean)));
}

function EmployeePhoto({ employee, variant = 'cell' }) {
  const candidates = useMemo(() => getEmployeePhotoCandidates(employee), [employee]);
  const candidateKey = candidates.join('|');
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  const initials = getNameInitials(employee?.name);
  const src = candidates[candidateIndex] || '';
  const isModal = variant === 'modal';
  const containerClass = isModal ? 'employee-modal-photo' : 'employee-photo-cell';
  const fallbackClass = isModal ? 'employee-modal-photo-fallback' : 'employee-photo-fallback';
  const imageClass = isModal ? 'employee-modal-photo-img' : 'employee-photo-img';

  return (
    <div className={containerClass} aria-hidden={isModal ? 'true' : undefined}>
      {src ? (
        <img
          className={imageClass}
          src={src}
          alt={employee?.name || 'Employee'}
          onError={() => setCandidateIndex((index) => (index + 1 < candidates.length ? index + 1 : candidates.length))}
        />
      ) : null}
      <span className={fallbackClass}>{initials}</span>
    </div>
  );
}

function formatAssignedByName(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '-';
  if (rawValue.includes('@')) return rawValue.split('@')[0] || rawValue;
  return rawValue;
}

function getAllocationAssignmentActor(allocation, assignmentAuditLog = null) {
  return {
    name: allocation?.assigned_by_name || assignmentAuditLog?.actor_name || '',
    userId: allocation?.assigned_by_user_id || assignmentAuditLog?.actor_user_id || null,
    role: allocation?.assigned_by_role || assignmentAuditLog?.actor_role || null
  };
}

function readRoleAccountPasswords() {
  try {
    return JSON.parse(localStorage.getItem(ROLE_ACCOUNT_PASSWORDS_KEY) || '{}') || {};
  } catch (_error) {
    return {};
  }
}

function persistRoleAccountPasswords(nextPasswords) {
  try {
    localStorage.setItem(ROLE_ACCOUNT_PASSWORDS_KEY, JSON.stringify(nextPasswords));
  } catch (_error) {
    // Ignore local browser storage failures.
  }
}

function buildEmployeeLookupKeys(employee) {
  return [
    employee?.employee_code,
    employee?.email,
    employee?.name
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function getGeolocationMapUrl(geolocation) {
  const value = String(geolocation || '').trim();
  if (!value) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function buildQrPlainText(lines) {
  return lines
    .map(([label, value]) => {
      const text = String(value ?? '').trim();
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function buildAssignmentSelectionValue(userOption) {
  if (userOption?.selection_value) return String(userOption.selection_value);
  if (userOption?.local_user_id) return String(userOption.local_user_id);
  return `external:${userOption?.external_employee_id || userOption?.employee_code || userOption?.name || 'unknown'}`;
}

function formatCsvCell(value) {
  const normalizedText = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const text = Array.from(normalizedText)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 10 || code === 9 || (code > 31 && code !== 127);
    })
    .join('');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function buildExcelCsv(rows) {
  return `\uFEFF${rows.map((row) => row.map(formatCsvCell).join(',')).join('\r\n')}\r\n`;
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
  const [uploadedEmployeeAssets, setUploadedEmployeeAssets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoaded, setAuditLogsLoaded] = useState(false);
  const [invoices, setInvoices] = useState(() => {
    try {
      const savedVersion = localStorage.getItem('invoice_storage_version');
      const deletedInvoiceKeys = readDeletedInvoiceKeys();
      let savedInvoices = [];
      if (savedVersion !== INVOICE_STORAGE_VERSION) {
        localStorage.setItem('invoice_storage_version', INVOICE_STORAGE_VERSION);
        localStorage.setItem('invoices', '[]');
      } else {
        savedInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
      }
      return mergeImportedInvoices(
        (Array.isArray(savedInvoices) ? savedInvoices : [])
          .filter((invoice) => !deletedInvoiceKeys.has(getInvoiceMergeKey(invoice))),
        (Array.isArray(importedTrackerInvoices) ? importedTrackerInvoices : [])
          .filter((invoice) => !deletedInvoiceKeys.has(getInvoiceMergeKey(invoice)))
      );
    } catch {
      return Array.isArray(importedTrackerInvoices) ? importedTrackerInvoices : [];
    }
  });
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceVendorFilter, setInvoiceVendorFilter] = useState('all');
  const [invoiceCategoryFilter, setInvoiceCategoryFilter] = useState('all');
  const [invoiceSubcategoryFilter, setInvoiceSubcategoryFilter] = useState('all');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('all');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    vendor: '',
    billNo: '',
    category: 'Assets Bill',
    subcategory: 'Laptops',
    amount: '',
    dueDate: '',
    status: 'unpaid',
    approvalAssignee: '',
    notes: '',
    invoiceFileName: '',
    invoiceFileData: ''
  });
  const invoiceAttachmentsLoadedRef = useRef(false);
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [domains, setDomains] = useState([]);
  const [domainRecords, setDomainRecords] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [customBrandName, setCustomBrandName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [section, setSection] = useState('overview');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [quickAssetQuery, setQuickAssetQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [inventoryTypes, setInventoryTypes] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState('25');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentSearchDraft, setAssignmentSearchDraft] = useState('');
  const [assignmentUserFilter, setAssignmentUserFilter] = useState('all');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPageSize, setAssignmentPageSize] = useState('25');
  const [quickAssignForm, setQuickAssignForm] = useState({
    userId: '',
    domainName: '',
    employeeName: '',
    employeeCode: '',
    employeeEmail: '',
    employeeMobile: '',
    employeeDepartment: '',
    employeeDesignation: '',
    assetId: '',
    assetType: 'all',
    assetSearch: '',
    notes: ''
  });
  const [assignValidated, setAssignValidated] = useState(false);
  const [selfieEmployeeId, setSelfieEmployeeId] = useState('');
  const [selfieCameraOpen, setSelfieCameraOpen] = useState(false);
  const [selfieSaving, setSelfieSaving] = useState(false);
  const [selfieError, setSelfieError] = useState('');
  const selfieVideoRef = useRef(null);
  const selfieStreamRef = useRef(null);

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [message]);
  useEffect(() => () => {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      selfieStreamRef.current = null;
    }
  }, []);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountManagementTab, setAccountManagementTab] = useState('roles');
  const [createAdminPopupOpen, setCreateAdminPopupOpen] = useState(false);
  const [createDomainPopupOpen, setCreateDomainPopupOpen] = useState(false);
  const [selectedAdminPermissionId, setSelectedAdminPermissionId] = useState(null);
  const [domainCreateForm, setDomainCreateForm] = useState({
    code: '',
    name: '',
    branch_type: 'Branch',
    country: 'India',
    state: '',
    city: '',
    address: '',
    pincode: '',
    latitude: '',
    longitude: '',
    status: 'active',
    primary_admin_id: '',
    backup_admin_id: '',
    employee_code_prefix: ''
  });
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
  const [roleAccountPasswords, setRoleAccountPasswords] = useState(() => readRoleAccountPasswords());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedReplacementEmployeeId, setSelectedReplacementEmployeeId] = useState(null);
  const [selectedEmployeeReturnId, setSelectedEmployeeReturnId] = useState(null);
  const [employeeReturnForm, setEmployeeReturnForm] = useState({
    allocationId: '',
    reason: 'Damaged',
    notes: ''
  });
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
  const [returnForm, setReturnForm] = useState({
    allocationId: '',
    assetName: '',
    serial: '',
    reason: 'Damaged',
    notes: ''
  });
  const [selectedAssetType, setSelectedAssetType] = useState('');
  const [customAssetType, setCustomAssetType] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [assetDomainName, setAssetDomainName] = useState('');
  const [assetDraft, setAssetDraft] = useState({
    serial: '',
    vendor: '',
    notes: ''
  });
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetDeleteDialog, setAssetDeleteDialog] = useState(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
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

  function hasInvoiceHeadApprovalAccess() {
    if (isSuperAdmin) return true;
    const normalizedRole = String(user?.role || '').toLowerCase();
    return normalizedRole.includes('head');
  }

  function hasInvoiceAccountsApprovalAccess() {
    if (isSuperAdmin) return true;
    const normalizedRole = String(user?.role || '').toLowerCase();
    const normalizedName = String(user?.name || '').trim().toLowerCase();
    return normalizedRole.includes('account') || INVOICE_ACCOUNTANT_NAMES.includes(normalizedName);
  }

  function canDeleteInvoices() {
    if (isSuperAdmin) return true;
    return String(user?.role || '').trim().toLowerCase() === 'admin';
  }

  function resetAssetForm() {
    setEditingAsset(null);
    setSelectedAssetType('');
    setCustomAssetType('');
    setSelectedBrandId('');
    setCustomBrandName('');
    setSelectedModelId('');
    setCustomModelName('');
    setAssetDraft({
      serial: '',
      vendor: '',
      notes: ''
    });
    setAssetDomainName(currentUserDomain || '');
  }

  function startEditAsset(asset) {
    if (!hasAdminPermission('inventory.manage')) return;
    const assetType = String(asset?.type || '').trim();
    const assetBrandId = asset?.brand_id ? String(asset.brand_id) : '';
    const matchedBrand = assetBrandId
      ? brands.find((brand) => String(brand.id) === assetBrandId)
      : brands.find((brand) => normalizeBrandName(brand.name) === normalizeBrandName(asset?.brand_name));
    const assetModelId = asset?.model_id ? String(asset.model_id) : '';
    const matchedModel = matchedBrand
      ? (matchedBrand.models || []).find((model) => String(model.id) === assetModelId)
      : null;
    const knownType = assetType && assetTypeDropdownOptions.some((option) => option.value === assetType);

    setEditingAsset(asset || null);
    setSelectedAssetType(knownType ? assetType : OTHER_ASSET_TYPE_VALUE);
    setCustomAssetType(knownType ? '' : assetType);

    if (matchedBrand) {
      setSelectedBrandId(String(matchedBrand.id));
      setCustomBrandName('');
    } else {
      setSelectedBrandId(asset?.brand_name ? OTHER_BRAND_VALUE : '');
      setCustomBrandName(String(asset?.brand_name || '').trim());
    }

    if (matchedModel) {
      setSelectedModelId(String(matchedModel.id));
      setCustomModelName('');
    } else {
      setSelectedModelId(asset?.model_name ? OTHER_MODEL_VALUE : '');
      setCustomModelName(String(asset?.model_name || '').trim());
    }

    setAssetDraft({
      serial: String(asset?.serial || ''),
      vendor: String(asset?.vendor || ''),
      notes: String(asset?.notes || '')
    });
    setAssetDomainName(String(asset?.domain_name || currentUserDomain || '').trim().toLowerCase());

    const formAnchor = document.querySelector('.inventory-create-top');
    if (formAnchor?.scrollIntoView) {
      formAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getAssetAssigneeName(asset) {
    const directName = String(asset?.assigned_to_name || '').trim();
    if (directName) return directName;

    const allocation = activeAllocations.find((item) => String(item.asset_id) === String(asset?.id));
    if (!allocation) return '';

    const allocationUser = userById[allocation.user_id] || null;
    return String(
      allocation.employee_name
      || allocationUser?.name
      || allocation.employee_email
      || allocation.employee_code
      || ''
    ).trim();
  }

  function requestDeleteAsset(asset) {
    if (!hasAdminPermission('inventory.manage')) {
      setMessage('You do not have permission to delete assets.');
      return;
    }
    const assignedTo = getAssetAssigneeName(asset);
    if (assignedTo) {
      setAssetDeleteDialog({
        mode: 'assigned',
        asset,
        assignedTo
      });
      return;
    }

    setAssetDeleteDialog({
      mode: 'confirm',
      asset
    });
  }

  async function performDeleteAsset(asset) {
    const res = await apiFetch(`/api/assets/${asset.id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
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
      setMessage('You do not have permission to delete this asset.');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error || 'Delete asset failed');
      return;
    }

    if (editingAsset?.id === asset.id) {
      resetAssetForm();
    }
    setMessage('Asset deleted');
    fetchAssets();
    fetchAuditLogs();
  }

  async function confirmDeleteAsset() {
    if (!assetDeleteDialog?.asset) return;
    const targetAsset = assetDeleteDialog.asset;
    setAssetDeleteDialog(null);
    await performDeleteAsset(targetAsset);
  }

  function closeAssetDeleteDialog() {
    setAssetDeleteDialog(null);
  }

  function normalizeApprovalIdentity(value) {
    return String(value || '').trim().toLowerCase();
  }

  function compactApprovalIdentity(value) {
    return normalizeApprovalIdentity(value).replace(/[^a-z0-9]/g, '');
  }

  function getCurrentUserApprovalIdentifiers() {
    if (!user) return [];
    return [
      user.id,
      user.name,
      user.email,
      user.email ? String(user.email).split('@')[0] : '',
      user.employee_code,
      user.employee_code_prefix,
    ]
      .map((value) => normalizeApprovalIdentity(value))
      .filter(Boolean);
  }

  function hasInvoiceApprovalAssignee(invoice) {
    return Boolean(normalizeApprovalIdentity(invoice?.approvalAssignee));
  }

  function getInvoiceRaisedDomain(invoice) {
    const rawDomain =
      invoice?.domain_name
      || invoice?.domain
      || invoice?.raisedDomain
      || invoice?.sourceDomain
      || '';
    if (rawDomain) return normalizeApprovalIdentity(rawDomain);

    const notes = String(invoice?.notes || '');
    const domainMatch = notes.match(/\bdomain\s*:\s*([^|]+?)(?:\s*\||$)/i);
    if (domainMatch?.[1]) {
      return normalizeApprovalIdentity(domainMatch[1]);
    }

    return '';
  }

  function isZaptoRaisedInvoice(invoice) {
    return getInvoiceRaisedDomain(invoice) === 'zapto';
  }

  function isInvoiceApprovalAssignee(invoice) {
    const assignee = normalizeApprovalIdentity(invoice?.approvalAssignee);
    if (!assignee) return true;
    const assigneeParts = assignee.split(/[^a-z0-9@._-]+/).filter(Boolean);
    const compactAssignee = compactApprovalIdentity(assignee);
    return getCurrentUserApprovalIdentifiers().some((identifier) => (
      assignee === identifier
      || assigneeParts.includes(identifier)
      || compactAssignee === compactApprovalIdentity(identifier)
    ));
  }

  function canUseInvoiceApprovalAction(invoice, fallbackAccess, allowFallbackOverride = false) {
    if (allowFallbackOverride && fallbackAccess) {
      return true;
    }
    return hasInvoiceApprovalAssignee(invoice)
      ? isInvoiceApprovalAssignee(invoice)
      : fallbackAccess;
  }

  function hasApprovalForCurrentStage(invoice) {
    const approval = getInvoiceApproval(invoice);
    const currentStageLabel = String(approval.stageLabel || '').trim().toLowerCase();
    if (!currentStageLabel) return false;
    return Array.isArray(invoice?.approvalHistory)
      && invoice.approvalHistory.some((entry) => (
        String(entry?.action || '').trim().toLowerCase() === 'approve'
        && String(entry?.stage || '').trim().toLowerCase() === currentStageLabel
      ));
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

    switch (section) {
      case 'overview':
        fetchAssets();
        fetchAllocations();
        fetchDomains();
        break;
      case 'inventory':
        fetchAssets();
        fetchQuickAssignUsers();
        fetchAllocations();
        fetchStores();
        fetchBrands();
        fetchDomains();
        break;
      case 'assignments':
        fetchAssets();
        fetchAllocations();
        fetchQuickAssignUsers();
        fetchUploadedEmployeeAssets();
        break;
      case 'accounts':
        fetchDomains();
        break;
      case 'insights':
        fetchAssets();
        fetchAllocations();
        break;
      case 'invoices':
        // No initial fetch needed
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionChecked, authView, section]);

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
    if (!token || !selectedEmployeeId || auditLogsLoaded) return;
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedEmployeeId, auditLogsLoaded]);

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

  function fetchAssets(type = 'all') {
    const queryParam = type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
    apiFetch(`/api/assets${queryParam}`, { headers: authHeaders() })
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

  function fetchDomains() {
    apiFetch('/api/domains', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`domains_${r.status}`);
        return r.json();
      })
      .then((rows) => {
        const nextRecords = Array.isArray(rows)
          ? rows
            .map((row) => ({
              ...row,
              name: String(row.name || row.domain_name || '').trim().toLowerCase(),
              code: String(row.code || '').trim(),
              status: String(row.status || 'active').trim().toLowerCase()
            }))
            .filter((row) => row.name)
          : [];
        const recordMap = new Map();
        nextRecords.forEach((row) => {
          if (!recordMap.has(row.name)) recordMap.set(row.name, row);
        });
        const uniqueRecords = Array.from(recordMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setDomainRecords(uniqueRecords);
        setDomains(uniqueRecords.map((row) => row.name));
      })
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setDomainRecords([]);
        setDomains([]);
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

  function fetchUploadedEmployeeAssets() {
    apiFetch('/api/users/uploaded-employee-assets', { headers: authHeaders() })
      .then((r) => {
        if (handleUnauthorized(r.status)) throw new Error('unauthorized');
        if (!r.ok) throw new Error(`uploaded_employee_assets_${r.status}`);
        return r.json();
      })
      .then((rows) => setUploadedEmployeeAssets(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        if (err.message === 'unauthorized') return;
        setUploadedEmployeeAssets([]);
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
    setShowLogoutDialog(false);
    setToken('');
    setUser(null);
    setAuditLogs([]);
    setAuditLogsLoaded(false);
    setAuthView('landing');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMessage('');
  }

  function getQuickAssignEmployeeDetails(option) {
    if (!option) {
      return {
        employeeName: '',
        employeeCode: '',
        employeeEmail: '',
        employeeMobile: '',
        employeeDepartment: '',
        employeeDesignation: ''
      };
    }
    return {
      employeeName: option.name || '',
      employeeCode: option.employee_code || '',
      employeeEmail: option.employee_email || option.email || '',
      employeeMobile: option.personal_mobile_no || option.mobile_no || option.mobile || '',
      employeeDepartment: option.department || '',
      employeeDesignation: option.designation || ''
    };
  }

  function updateQuickAssignEmployeeField(field, value) {
    setQuickAssignForm((prev) => {
      const next = { ...prev, [field]: value };
      const trimmed = String(value || '').trim().toLowerCase();
      const matched = trimmed
        ? quickAssignUsers.find((item) => {
          if (field === 'employeeCode') return String(item.employee_code || '').trim().toLowerCase() === trimmed;
          if (field === 'employeeEmail') return String(item.employee_email || item.email || '').trim().toLowerCase() === trimmed;
          if (field === 'employeeName') return String(item.name || '').trim().toLowerCase() === trimmed;
          return false;
        })
        : null;
      if (!matched && ['employeeName', 'employeeCode', 'employeeEmail'].includes(field)) {
        return { ...next, userId: '' };
      }
      if (!matched) return next;
      return {
        ...next,
        userId: String(matched.selection_value || matched.local_user_id || matched.id),
        ...getQuickAssignEmployeeDetails(matched),
        [field]: value
      };
    });
  }

  async function allocate(e) {
    e.preventDefault();
    setAssignValidated(true);
    const asset_id = Number(quickAssignForm.assetId);
    const notes = quickAssignForm.notes.trim();
    const selectedEmployeeOption = quickAssignUsers.find((item) => String(item.selection_value || item.local_user_id || item.id) === String(quickAssignForm.userId));
    const employeeName = quickAssignForm.employeeName.trim() || selectedEmployeeOption?.name || '';
    const employeeCode = quickAssignForm.employeeCode.trim() || selectedEmployeeOption?.employee_code || '';
    const employeeEmail = quickAssignForm.employeeEmail.trim() || selectedEmployeeOption?.employee_email || selectedEmployeeOption?.email || '';
    const employeeMobile = quickAssignForm.employeeMobile.trim() || selectedEmployeeOption?.personal_mobile_no || selectedEmployeeOption?.mobile_no || selectedEmployeeOption?.mobile || '';
    const employeeDepartment = quickAssignForm.employeeDepartment.trim() || selectedEmployeeOption?.department || '';
    const employeeDesignation = quickAssignForm.employeeDesignation.trim() || selectedEmployeeOption?.designation || '';

    if (!asset_id || !employeeName || !employeeCode || !employeeEmail || !employeeMobile || !employeeDepartment || !employeeDesignation) {
      setMessage('Please fill out all required employee details (Name, Code, Email, Mobile, Department, Designation) and select an asset.');
      return;
    }
    const payload = {
      asset_id,
      notes,
      user_id: selectedEmployeeOption?.local_user_id ? Number(selectedEmployeeOption.local_user_id) : null,
      employee_code: employeeCode || null,
      employee_name: employeeName || null,
      employee_email: employeeEmail || null,
      employee_mobile: employeeMobile || null,
      employee_department: employeeDepartment || null,
      employee_designation: employeeDesignation || null
    };
    const res = await apiFetch('/api/allocations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Asset assigned successfully' : body.error || 'Allocation failed');
    if (res.ok) {
      setAssignValidated(false);
      fetchAssets();
      fetchAllocations();
      fetchAuditLogs();
      setQuickAssignForm((prev) => ({
        ...prev,
        assetId: '',
        assetType: 'all',
        assetSearch: '',
        userId: '',
        employeeName: '',
        employeeCode: '',
        employeeEmail: '',
        employeeMobile: '',
        employeeDepartment: '',
        employeeDesignation: '',
        notes: ''
      }));
    }
  }

  function stopSelfieCamera() {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      selfieStreamRef.current = null;
    }
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }
    setSelfieCameraOpen(false);
  }

  function getQuickAssignSelfieUserId() {
    const selectedEmployeeOption = quickAssignUsers.find((item) => String(item.selection_value || item.local_user_id || item.id) === String(quickAssignForm.userId));
    return selectedEmployeeOption?.local_user_id ? String(selectedEmployeeOption.local_user_id) : '';
  }

  async function openSelfieCamera(e, targetEmployeeId = '') {
    e?.preventDefault();
    setSelfieError('');
    const nextEmployeeId = targetEmployeeId || selfieEmployeeId || getQuickAssignSelfieUserId();
    if (!nextEmployeeId) {
      setSelfieError('Select employee before opening camera.');
      return;
    }
    setSelfieEmployeeId(nextEmployeeId);
    if (!navigator.mediaDevices?.getUserMedia) {
      setSelfieError('Camera is not available in this browser.');
      return;
    }
    try {
      stopSelfieCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      selfieStreamRef.current = stream;
      setSelfieCameraOpen(true);
      requestAnimationFrame(() => {
        if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = stream;
          selfieVideoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setSelfieError('Camera permission denied or camera is not available.');
    }
  }

  async function captureEmployeeSelfie() {
    setSelfieError('');
    const video = selfieVideoRef.current;
    if (!selfieEmployeeId || !video || !video.videoWidth) {
      setSelfieError('Open camera and wait for preview before capture.');
      return;
    }
    const canvas = document.createElement('canvas');
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = Math.max(0, Math.floor((video.videoWidth - side) / 2));
    const sourceY = Math.max(0, Math.floor((video.videoHeight - side) / 2));
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sourceX, sourceY, side, side, 0, 0, canvas.width, canvas.height);
    const profileImageUrl = canvas.toDataURL('image/jpeg', 0.82);

    setSelfieSaving(true);
    try {
      const res = await apiFetch(`/api/users/${selfieEmployeeId}/photo`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ profile_image_url: profileImageUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Selfie upload failed');
      setUsers((prev) => prev.map((item) => (
        Number(item.id) === Number(selfieEmployeeId) ? { ...item, ...body, profile_image_url: body.profile_image_url || profileImageUrl } : item
      )));
      setMessage('Employee selfie saved successfully.');
      stopSelfieCamera();
    } catch (err) {
      setSelfieError(err.message || 'Selfie upload failed.');
    } finally {
      setSelfieSaving(false);
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

  function closeReturnAssetDialog() {
    setReturnForm({
      allocationId: '',
      assetName: '',
      serial: '',
      reason: 'Damaged',
      notes: ''
    });
  }

  async function submitReturnAsset(e) {
    e.preventDefault();
    if (!returnForm.allocationId) return;
    const notes = returnForm.notes.trim();
    if (returnForm.reason === 'Other' && !notes) {
      setMessage('Please provide return notes for Other reason');
      return;
    }
    await returnAsset(returnForm.allocationId, {
      reason: returnForm.reason,
      reason_detail: notes || null
    });
    closeReturnAssetDialog();
  }

  async function replaceEmployeeAsset(e) {
    e.preventDefault();
    if (!selectedReplacementEmployee) return;
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
      setSelectedReplacementEmployeeId(null);
      setReplacementForm((prev) => ({
        ...prev,
        allocationId: '',
        replacementType: 'all',
        newAssetId: '',
        reason: 'Damaged',
        reasonDetail: ''
      }));
    }
  }

  async function ensureBrand(name) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return null;
    const existing = brands.find((brand) => normalizeBrandName(brand.name) === normalizeBrandName(trimmedName));
    if (existing) return existing;
    const res = await apiFetch('/api/brands', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: trimmedName })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Brand create failed');
    return body;
  }

  async function ensureModel(brandId, name, category) {
    const trimmedName = String(name || '').trim();
    if (!brandId || !trimmedName) return null;
    const existingBrand = brands.find((brand) => String(brand.id) === String(brandId));
    const existing = (existingBrand?.models || []).find((model) =>
      normalizeBrandName(model.name) === normalizeBrandName(trimmedName)
      && normalizeBrandName(model.category) === normalizeBrandName(category)
    );
    if (existing) return existing;
    const res = await apiFetch('/api/brands/models', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ brand_id: brandId, name: trimmedName, category })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Model create failed');
    return body;
  }

  async function createAsset(e) {
    e.preventDefault();
    const type = effectiveAssetType.trim();
    const brandName = selectedBrandId === OTHER_BRAND_VALUE ? customBrandName.trim() : selectedBrandName.trim();
    const selectedModel = selectedModelId === OTHER_MODEL_VALUE
      ? null
      : modelOptionsByType.find((model) => String(model.id) === String(selectedModelId));
    const modelName = selectedModelId === OTHER_MODEL_VALUE ? customModelName.trim() : String(selectedModel?.name || '').trim();
    const serial = assetDraft.serial.trim();
    const vendor = assetDraft.vendor.trim();
    const notes = assetDraft.notes.trim();
    const domain_name = (assetDomainName || currentUserDomain || '').trim().toLowerCase();
    if (!type) {
      setMessage('Select asset type.');
      return;
    }
    if (!brandName) {
      setMessage('Type asset brand.');
      return;
    }
    if (!modelName) {
      setMessage('Type asset model.');
      return;
    }
    if (!serial) {
      setMessage('Asset serial number is required.');
      return;
    }
    if (!domain_name) {
      setMessage('Asset domain is required.');
      return;
    }
    let brand_id = selectedBrandId && selectedBrandId !== OTHER_BRAND_VALUE ? Number(selectedBrandId) : null;
    let model_id = selectedModelId && selectedModelId !== OTHER_MODEL_VALUE ? Number(selectedModelId) : null;
    let createdBrandName = brandName;
    let createdModelName = modelName;
    try {
      if (!brand_id && brandName) {
        const brand = await ensureBrand(brandName);
        brand_id = brand?.id ? Number(brand.id) : brand_id;
        createdBrandName = brand?.name || brandName;
      }
      if (!model_id && modelName) {
        if (!brand_id) {
          const brand = await ensureBrand(brandName || 'Generic');
          brand_id = brand?.id ? Number(brand.id) : brand_id;
          createdBrandName = brand?.name || createdBrandName;
        }
        const model = await ensureModel(brand_id, modelName, type);
        model_id = model?.id ? Number(model.id) : model_id;
        createdModelName = model?.name || modelName;
      }
    } catch (error) {
      setMessage(error.message || 'Unable to add brand/model');
      return;
    }
    const name = (createdModelName || createdBrandName || type || 'Asset').trim();
    const isEditing = Boolean(editingAsset?.id);
    const res = await apiFetch(isEditing ? `/api/assets/${editingAsset.id}` : '/api/assets', {
      method: isEditing ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        type,
        serial,
        vendor,
        notes,
        brand_id,
        model_id,
        domain_name,
        status: isEditing ? editingAsset.status : 'available'
      })
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
      setMessage(isEditing ? 'You do not have permission to edit assets for this domain.' : 'You do not have permission to create assets for this domain.');
      return;
    }
    setMessage(res.ok ? (isEditing ? 'Asset updated' : 'Asset created') : body.error || (isEditing ? 'Update asset failed' : 'Create asset failed'));
    if (res.ok) {
      fetchAssets();
      fetchAuditLogs();
      resetAssetForm();
      fetchBrands();
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

  function buildSimNotes(row) {
    return JSON.stringify({
      source: 'SIM CSV',
      s_no: row.sno || '',
      connection_number: row.connectionnumber || '',
      connection_type: row.connectiontype || '',
      sim_status: row.status || '',
      sim_number: row.simnumber || '',
      assigned_name: row.name || ''
    });
  }

  function downloadBulkAssetTemplate() {
    const headers = ['S.No', 'Asset Type', 'Brand', 'Model', 'Asset Serial Number', 'Vendor', 'Domain'];
    const sampleRow = ['1', 'Laptop', 'Dell', 'Latitude 5440', 'SN-AX9-22190', 'Dell Partner', 'main'];
    const csv = buildExcelCsv([headers, sampleRow]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk_asset_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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
    const selectedModel = selectedModelId === OTHER_MODEL_VALUE
      ? null
      : modelOptionsByType.find((model) => String(model.id) === String(selectedModelId));
    const fallbackName = selectedModel?.name || customModelName.trim() || selectedBrandName || effectiveAssetType;
    let created = 0;
    let failed = 0;

    for (const [index, row] of rows.entries()) {
      const isSimCsvRow = Boolean(row.connectionnumber || row.connectiontype || row.simnumber);
      const rowType = row.assettype || row.type || effectiveAssetType || 'Laptop';
      const rowBrandName = (row.brand || row.brandname || '').trim();
      const rowModelName = (row.model || row.modelname || '').trim();
      const type = isSimCsvRow ? 'SIM' : rowType;
      const serial = isSimCsvRow
        ? (row.connectionnumber || row.simnumber || `SIM-${Date.now()}-${index + 1}`)
        : (row.assetserialnumber || row.serial || row.serialnumber || `BULK-${Date.now()}-${index + 1}`);
      const domain_name = (row.domain || row.domainname || fallbackDomain || 'global').trim().toLowerCase();
      let brand_id = null;
      let model_id = null;
      let rowBrand = null;
      let rowModel = null;

      try {
        if (!isSimCsvRow && (rowBrandName || rowModelName)) {
          rowBrand = await ensureBrand(rowBrandName || 'Generic');
          brand_id = rowBrand?.id || null;
        }
        if (!isSimCsvRow && rowModelName && brand_id) {
          rowModel = await ensureModel(brand_id, rowModelName, type);
          model_id = rowModel?.id || null;
        }
      } catch (_error) {
        failed += 1;
        continue;
      }

      const name = isSimCsvRow
        ? (row.name || row.connectionnumber || `SIM ${index + 1}`)
        : (row.asset || row.assetname || row.name || rowModel?.name || rowBrand?.name || fallbackName || `Bulk Asset ${index + 1}`);

      const res = await apiFetch('/api/assets', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          type,
          serial,
          domain_name,
          vendor: isSimCsvRow ? (row.connectiontype || '') : (row.vendor || ''),
          notes: isSimCsvRow ? buildSimNotes(row) : (row.notes || ''),
          brand_id,
          model_id
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
    fetchBrands();
    e.target.value = '';
    setMessage(`Bulk upload complete: ${created} assets added${failed ? `, ${failed} failed` : ''}.`);
  }

  function buildAssetQrData(asset) {
    return buildQrPlainText([
      ['Asset ID', asset.id],
      ['Name', asset.name],
      ['Type', asset.type],
      ['Serial', asset.serial]
    ]);
  }

  function buildAssignedAssetQrData(asset, employee, assignmentAuditLog = null) {
    const assignmentActor = getAllocationAssignmentActor(asset, assignmentAuditLog);
    return buildQrPlainText([
      ['Allocation ID', asset.id],
      ['Employee Name', employee?.name],
      ['Employee Email', employee?.email],
      ['Asset Name', asset.assetName],
      ['Asset Type', asset.type],
      ['Serial Number', asset.serial],
      ['Assigned At', asset.allocatedAt ? new Date(asset.allocatedAt).toISOString() : null],
      ['Assigned By', assignmentActor.name || 'Unknown'],
      ['Assigned By ID', assignmentActor.userId],
      ['Assigned By Role', assignmentActor.role]
    ]);
  }

  function getQrImageUrl(data) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&margin=6&data=${encodeURIComponent(data)}`;
  }

  function printAssetQr(asset) {
    const qrData = buildAssetQrData(asset);
    const qrUrl = getQrImageUrl(qrData);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
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
          <script>
            window.onload = () => window.print();
            window.onafterprint = () => {
              setTimeout(() => {
                window.frameElement.remove();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  }

  function printAssignedAssetQr(asset, employee, assignmentAuditLog = null) {
    const qrData = buildAssignedAssetQrData(asset, employee, assignmentAuditLog);
    const qrUrl = getQrImageUrl(qrData);
    const assignedAtText = asset.allocatedAt ? new Date(asset.allocatedAt).toLocaleString() : '-';
    const assignedBy = getAllocationAssignmentActor(asset, assignmentAuditLog).name || 'Unknown';
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
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
          <script>
            window.onload = () => window.print();
            window.onafterprint = () => {
              setTimeout(() => {
                window.frameElement.remove();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  }

  function printEmployeeDetails() {
    if (!selectedEmployee) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    const assetRows = selectedEmployee.assignedAssets
      .map((asset) => `<tr><td>${asset.assetName}</td><td>${asset.type}</td><td>${asset.serial}</td><td>${asset.allocatedAt ? new Date(asset.allocatedAt).toLocaleString() : '-'}</td><td>${asset.notes || '-'}</td></tr>`)
      .join('');
    doc.open();
    doc.write(`
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
          <script>
            window.onload = () => window.print();
            window.onafterprint = () => {
              setTimeout(() => {
                window.frameElement.remove();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
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
      if (body.id) {
        setRoleAccountPasswords((prev) => {
          const next = { ...prev, [body.id]: payload.password };
          persistRoleAccountPasswords(next);
          return next;
        });
      }
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
      fetchDomains();
      fetchAuditLogs();
      setCreateAdminPopupOpen(false);
    }
    return res.ok;
  }

  async function createDomain(event) {
    event.preventDefault();
    if (!isSuperAdmin) {
      setMessage('Only super admin can create domains.');
      return false;
    }
    const payload = {
      code: String(domainCreateForm.code || '').trim().toUpperCase(),
      name: String(domainCreateForm.name || '').trim().toLowerCase(),
      branch_type: String(domainCreateForm.branch_type || '').trim(),
      country: String(domainCreateForm.country || '').trim(),
      state: String(domainCreateForm.state || '').trim(),
      city: String(domainCreateForm.city || '').trim(),
      address: String(domainCreateForm.address || '').trim(),
      pincode: String(domainCreateForm.pincode || '').trim(),
      latitude: String(domainCreateForm.latitude || '').trim(),
      longitude: String(domainCreateForm.longitude || '').trim(),
      status: String(domainCreateForm.status || 'active').trim().toLowerCase(),
      primary_admin_id: domainCreateForm.primary_admin_id || null,
      backup_admin_id: domainCreateForm.backup_admin_id || null,
      employee_code_prefix: String(domainCreateForm.employee_code_prefix || '').trim().toLowerCase()
    };
    if (!payload.code || !payload.name || !payload.branch_type || !payload.city) {
      setMessage('Domain code, domain name, branch type, and city are required.');
      return false;
    }
    const res = await apiFetch('/api/domains', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Domain location created.' : body.error || 'Domain creation failed');
    if (res.ok) {
      setDomainCreateForm({
        code: '',
        name: '',
        branch_type: 'Branch',
        country: 'India',
        state: '',
        city: '',
        address: '',
        pincode: '',
        latitude: '',
        longitude: '',
        status: 'active',
        primary_admin_id: '',
        backup_admin_id: '',
        employee_code_prefix: ''
      });
      setCreateDomainPopupOpen(false);
      fetchDomains();
      fetchAuditLogs();
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
      fetchDomains();
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
      setRoleAccountPasswords((prev) => {
        const next = { ...prev };
        delete next[targetUserId];
        persistRoleAccountPasswords(next);
        return next;
      });
    }
    return res.ok;
  }

  async function deleteDomain(domainName) {
    if (!isSuperAdmin) {
      setMessage('Only super admin can delete domains.');
      return;
    }
    const normalizedDomain = String(domainName || '').trim().toLowerCase();
    if (!normalizedDomain) return;
    const confirmed = window.confirm(`Delete domain "${normalizedDomain}"? This will remove it from users and assets too.`);
    if (!confirmed) return;
    const res = await apiFetch(`/api/domains/${encodeURIComponent(normalizedDomain)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Domain deleted.' : body.error || 'Domain delete failed');
    if (res.ok) {
      fetchDomains();
      fetchUsers();
      fetchAssets();
      fetchAuditLogs();
      setAssetDomainName((prev) => (String(prev || '').trim().toLowerCase() === normalizedDomain ? currentUserDomain || '' : prev));
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
    const toMs = (msValue, dateValue) => {
      const fromMs = Number(msValue);
      if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
      const parsed = new Date(dateValue || '').getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const events = [];
    allocations.forEach((a) => {
      const assetName = assetById[a.asset_id]?.name || `Asset ${a.asset_id}`;
      const employee = userById[a.user_id] || {};
      const userName = employee.name || `User ${a.user_id}`;
      const employeeCode = employee.employee_code || '';
      const employeeEmail = employee.email || '';
      const allocatedMs = toMs(a.allocated_at_ms, a.allocated_at);
      if (allocatedMs > 0) {
        events.push({
          id: `alloc-${a.id}`,
          action: 'Allocated',
          allocationId: a.id,
          assetName,
          userName,
          employeeCode,
          employeeEmail,
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
          employeeCode,
          employeeEmail,
          timestampMs: returnedMs
        });
      }
    });
    return events.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 12);
  }, [allocations, assetById, userById]);
  const domainAssignmentTotals = useMemo(() => {
    const getAssetTypeBucket = (type) => {
      const normalized = String(type || '').trim().toLowerCase();
      if (normalized.includes('sim')) return 'sim';
      if (normalized.includes('mobile') || normalized.includes('phone')) return 'mobile';
      if (normalized.includes('laptop')) return 'laptop';
      return 'other';
    };
    const totals = {};
    activeAllocations.forEach((allocation) => {
      const asset = assetById[allocation.asset_id] || {};
      const domain = String(allocation.domain_name || asset.domain_name || 'unassigned').trim().toLowerCase() || 'unassigned';
      if (!totals[domain]) {
        totals[domain] = {
          domain,
          count: 0,
          laptop: 0,
          mobile: 0,
          sim: 0,
          other: 0
        };
      }
      totals[domain].count += 1;
      totals[domain][getAssetTypeBucket(asset.type)] += 1;
    });
    const totalAssigned = Math.max(activeAllocations.length, 1);
    return Object.values(totals)
      .map((item) => ({
        ...item,
        pct: Math.round((item.count / totalAssigned) * 100)
      }))
      .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
  }, [activeAllocations, assetById]);
  const recentAuditLogs = useMemo(() => auditLogs.slice(0, 50), [auditLogs]);
  const allocationAssignAuditById = useMemo(() => {
    const byAllocation = {};
    auditLogs.forEach((log) => {
      if (
        log.entity_type !== 'allocation' ||
        !['ALLOCATE_ASSET', 'REPLACE_ASSET'].includes(log.action) ||
        !log.entity_id
      ) return;
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
  const effectiveAssetType = selectedAssetType === OTHER_ASSET_TYPE_VALUE
    ? customAssetType.trim()
    : selectedAssetType;
  const displayedAssetType = selectedAssetType === OTHER_ASSET_TYPE_VALUE
    ? (customAssetType.trim() || 'Other Asset')
    : selectedAssetType;
  const selectedBrandModels = useMemo(() => {
    if (selectedBrandId === OTHER_BRAND_VALUE) return [];
    const brand = brands.find((b) => b.id === Number(selectedBrandId));
    if (!brand) return [];
    const brandModels = brand.models || [];
    if (!isAppleMacBrandName(brand.name)) return brandModels;

    const appleMacModels = brands
      .filter((b) => isAppleMacBrandName(b.name))
      .flatMap((b) => b.models || []);

    return dedupeModels([...brandModels, ...appleMacModels]);
  }, [brands, selectedBrandId]);
  const selectedBrandModelsByType = useMemo(() => {
    return selectedBrandModels.filter(
      (m) => (m.category || '').toLowerCase() === effectiveAssetType.toLowerCase(),
    );
  }, [selectedBrandModels, effectiveAssetType]);
  const allModelsBySelectedType = useMemo(() => {
    return brands
      .flatMap((brand) => brand.models || [])
      .filter((m) => (m.category || '').toLowerCase() === effectiveAssetType.toLowerCase());
  }, [brands, effectiveAssetType]);
  const hasSelectedExistingBrand = selectedBrandId && selectedBrandId !== OTHER_BRAND_VALUE;
  const modelOptionsByType = hasSelectedExistingBrand ? selectedBrandModelsByType : allModelsBySelectedType;
  const selectedBrandName = useMemo(() => {
    if (customBrandName) return customBrandName;
    if (selectedBrandId === OTHER_BRAND_VALUE) return 'Other Brand';
    const brand = brands.find((b) => String(b.id) === String(selectedBrandId));
    return brand?.name || '';
  }, [brands, customBrandName, selectedBrandId]);
  const brandsBySelectedType = useMemo(() => {
    return brands.filter((b) =>
      (b.models || []).some((m) => (m.category || '').toLowerCase() === effectiveAssetType.toLowerCase()),
    );
  }, [brands, effectiveAssetType]);
  const assetTypeDropdownOptions = useMemo(() => {
    const values = new Set(TYPE_OPTIONS);
    assets.forEach((asset) => {
      if (asset.type) values.add(asset.type);
    });
    brands.forEach((brand) => {
      (brand.models || []).forEach((model) => {
        if (model.category) values.add(model.category);
      });
    });
    const baseOptions = Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({ value: type, label: type, searchText: type }));
    return [
      ...baseOptions.filter((option) => option.label.toLowerCase() !== 'other asset'),
      { value: OTHER_ASSET_TYPE_VALUE, label: 'Other Asset', searchText: 'Other Asset' },
    ];
  }, [assets, brands]);
  const brandDropdownOptions = useMemo(
    () => [
      ...brandsBySelectedType.map((brand) => ({
        value: String(brand.id),
        label: brand.name,
        searchText: brand.name,
      })),
      { value: OTHER_BRAND_VALUE, label: 'Other Brand', searchText: 'Other Brand' },
    ],
    [brandsBySelectedType]
  );
  useEffect(() => {
    if (!selectedBrandId) return;
    if (selectedBrandId === OTHER_BRAND_VALUE) return;
    const exists = brandsBySelectedType.some((b) => String(b.id) === String(selectedBrandId));
    if (!exists) {
      setSelectedBrandId('');
      setCustomBrandName('');
      setSelectedModelId('');
      setCustomModelName('');
    }
  }, [brandsBySelectedType, selectedBrandId]);
  useEffect(() => {
    setSelectedModelId((prev) => (
      prev === OTHER_MODEL_VALUE ? prev :
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
  const modelDropdownOptions = useMemo(
    () => [
      ...modelOptionsByType.map((model) => ({
        value: String(model.id),
        label: model.name,
        searchText: `${model.name || ''} ${model.category || ''}`,
      })),
      { value: OTHER_MODEL_VALUE, label: 'Other Model', searchText: 'Other Model' },
    ],
    [modelOptionsByType]
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
  const accountManagementDomains = useMemo(
    () => Array.from(new Set(
      [...domains, ...managedAdmins.map((admin) => admin.domain_name)]
        .map((domain) => String(domain || '').trim().toLowerCase())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b)),
    [domains, managedAdmins]
  );
  const adminSelectOptions = useMemo(
    () => managedAdmins.map((admin) => ({
      value: String(admin.id),
      label: `${admin.name || admin.email || 'Admin'} (${admin.domain_name || 'no domain'})`,
      searchText: `${admin.name || ''} ${admin.email || ''} ${admin.domain_name || ''}`
    })),
    [managedAdmins]
  );
  const domainManagementRows = useMemo(() => {
    const rowMap = new Map();
    domainRecords.forEach((domain) => {
      if (domain.name) rowMap.set(domain.name, domain);
    });
    accountManagementDomains.forEach((name) => {
      if (!rowMap.has(name)) {
        rowMap.set(name, { name, status: 'active' });
      }
    });
    return Array.from(rowMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [domainRecords, accountManagementDomains]);
  const domainDashboardStats = useMemo(() => {
    const domainNames = new Set(domainManagementRows.map((domain) => domain.name).filter(Boolean));
    const domainAssetCount = assets.filter((asset) => domainNames.has(String(asset.domain_name || '').trim().toLowerCase())).length;
    const domainEmployeeCount = employees.filter((employee) => domainNames.has(String(employee.domain_name || '').trim().toLowerCase())).length;
    const domainAdminIds = new Set();
    managedAdmins.forEach((admin) => {
      if (admin.domain_name) domainAdminIds.add(`role-${admin.id}`);
    });
    domainManagementRows.forEach((domain) => {
      if (domain.primary_admin_id) domainAdminIds.add(`primary-${domain.primary_admin_id}`);
      if (domain.backup_admin_id) domainAdminIds.add(`backup-${domain.backup_admin_id}`);
    });
    const pendingBills = invoices.filter((invoice) => {
      const approvalStatus = invoice.approvalStatus || (invoice.status === 'paid' ? 'completed' : 'pending_domain');
      return ['pending_domain', 'pending_head', 'pending_accounts', 'payment_pending'].includes(approvalStatus);
    }).length;
    return {
      totalDomains: domainManagementRows.length,
      activeLocations: domainManagementRows.filter((domain) => (domain.status || 'active') === 'active').length,
      totalAssets: domainAssetCount || assets.length,
      domainAdmins: domainAdminIds.size || managedAdmins.filter((admin) => admin.domain_name).length,
      employees: domainEmployeeCount || employees.length,
      openTickets: 0,
      unassignedAssets: availableAssets.length,
      pendingApprovals: pendingBills,
      pendingBills
    };
  }, [assets, availableAssets, domainManagementRows, employees, invoices, managedAdmins]);
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
    const totalRoleAccounts = managedAdmins.length;
    const managedDomains = accountManagementDomains.length;
    const fullyPrivileged = managedAdmins.filter((u) =>
      ADMIN_PERMISSION_OPTIONS.every((perm) => (u.permissions || []).includes(perm.key))
    ).length;
    const permissionCounts = managedAdmins.map((u) => (u.permissions || []).length);
    const maxPermissions = permissionCounts.length ? Math.max(...permissionCounts) : 0;
    const avgPermissions = permissionCounts.length
      ? Math.round((permissionCounts.reduce((sum, n) => sum + n, 0) / permissionCounts.length) * 10) / 10
      : 0;
    return { totalRoleAccounts, managedDomains, fullyPrivileged, maxPermissions, avgPermissions };
  }, [managedAdmins, accountManagementDomains]);
  const assignedUsersCount = useMemo(
    () => {
      const employeeIds = new Set(employees.map((e) => e.id));
      return new Set(activeAllocations.filter((a) => employeeIds.has(a.user_id)).map((a) => a.user_id)).size;
    },
    [activeAllocations, employees],
  );
  const uploadedEmployeeLookup = useMemo(() => {
    const lookup = {};
    uploadedEmployeeAssets.forEach((row) => {
      buildEmployeeLookupKeys({
        employee_code: row.employee_code,
        email: row.email,
        name: row.employee_name
      }).forEach((key) => {
        if (!lookup[key]) lookup[key] = row;
      });
    });
    return lookup;
  }, [uploadedEmployeeAssets]);
  const employeeDirectory = useMemo(() => {
    const directorySource = quickAssignUsers.length
      ? quickAssignUsers
      : employees.map((emp) => ({
        ...emp,
        local_user_id: emp.id,
        employee_email: emp.email,
        label: emp.employee_code ? `${emp.name} (${emp.employee_code})` : emp.name,
      }));

    return directorySource
      .map((option) => {
        const selectionValue = buildAssignmentSelectionValue(option);
        const localUserId = option.local_user_id ? Number(option.local_user_id) : (Number(option.id) || null);
        const localUser = localUserId ? userById[localUserId] : null;
        const baseEmployee = localUser || option;
        const name = baseEmployee.name || option.name || option.label || '';
        const email = baseEmployee.email || option.employee_email || '';
        const employeeCode = baseEmployee.employee_code || option.employee_code || '';
        const uploadedEmployee = buildEmployeeLookupKeys({
          ...baseEmployee,
          name,
          email,
          employee_code: employeeCode
        })
          .map((key) => uploadedEmployeeLookup[key])
          .find(Boolean);
        const assignedAssets = activeAllocations
          .filter((a) => {
            if (localUserId && Number(a.user_id) === Number(localUserId)) return true;
            const allocationCode = String(a.employee_code || '').trim().toLowerCase();
            const allocationEmail = String(a.employee_email || '').trim().toLowerCase();
            const allocationName = String(a.employee_name || '').trim().toLowerCase();
            return (
              (employeeCode && allocationCode === String(employeeCode).trim().toLowerCase())
              || (email && allocationEmail === String(email).trim().toLowerCase())
              || (name && allocationName === String(name).trim().toLowerCase())
            );
          })
          .map((a) => ({
            id: a.id,
            assetId: a.asset_id,
            allocatedAt: a.allocated_at,
            assigned_by_name: a.assigned_by_name,
            assigned_by_user_id: a.assigned_by_user_id,
            assigned_by_role: a.assigned_by_role,
            assignedBy: formatAssignedByName(a.assigned_by_name),
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
          ...baseEmployee,
          id: selectionValue,
          local_user_id: localUserId,
          name,
          email,
          employee_code: employeeCode,
          role: baseEmployee.role || 'user',
          department: baseEmployee.department || option.department || uploadedEmployee?.department || '',
          designation: baseEmployee.designation || option.designation || uploadedEmployee?.designation || '',
          personal_mobile_no: baseEmployee.personal_mobile_no || uploadedEmployee?.mobile_no || uploadedEmployee?.mobile || '',
          profile_image_url: baseEmployee.profile_image_url || uploadedEmployee?.employee_photo || '',
          geolocation: baseEmployee.location || option.location || uploadedEmployee?.location || '',
          domain_name: baseEmployee.domain_name || option.domain_name || uploadedEmployee?.domain_name || '',
          assignedAssets,
          assignedCount: assignedAssets.length,
          latestAllocatedAt: latestAllocatedAt ? new Date(latestAllocatedAt) : null
        };
      })
      .filter((emp) => assignmentUserFilter === 'all' || String(emp.domain_name || '').trim().toLowerCase() === assignmentUserFilter)
      .filter((emp) => {
        const q = assignmentSearch.trim().toLowerCase();
        if (!q) return true;
        const assetsText = emp.assignedAssets.map((a) => `${a.assetName} ${a.serial} ${a.type}`).join(' ');
        return `${emp.name || ''} ${emp.employee_code || ''} ${emp.email || ''} ${emp.personal_mobile_no || ''} ${emp.role || ''} ${emp.department || ''} ${emp.designation || ''} ${emp.geolocation || emp.location || ''} ${assetsText}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.assignedCount - a.assignedCount || (a.name || '').localeCompare(b.name || ''));
  }, [quickAssignUsers, employees, activeAllocations, assetById, assignmentUserFilter, assignmentSearch, uploadedEmployeeLookup, userById]);
  const selectedEmployee = useMemo(
    () => employeeDirectory.find((emp) => emp.id === selectedEmployeeId) || null,
    [employeeDirectory, selectedEmployeeId]
  );
  const selectedReplacementEmployee = useMemo(
    () => employeeDirectory.find((emp) => emp.id === selectedReplacementEmployeeId) || null,
    [employeeDirectory, selectedReplacementEmployeeId]
  );
  const employeeDirectoryRenderKey = useMemo(
    () => `${assignmentSearch}|${assignmentUserFilter}|${employeeDirectory.map((emp) => emp.id).join(',')}`,
    [assignmentSearch, assignmentUserFilter, employeeDirectory]
  );

  const assignmentSize = assignmentPageSize === 'all' ? employeeDirectory.length || 1 : Number(assignmentPageSize);
  const assignmentTotalPages = Math.max(1, Math.ceil(employeeDirectory.length / assignmentSize));
  const paginatedEmployeeDirectory = useMemo(() => {
    const start = (assignmentPage - 1) * assignmentSize;
    return employeeDirectory.slice(start, start + assignmentSize);
  }, [employeeDirectory, assignmentPage, assignmentSize]);
  const selectedEmployeeHistory = useMemo(() => {
    if (!selectedEmployee) return [];
    const selectedLocalUserId = selectedEmployee.local_user_id || selectedEmployee.id;
    return allocations
      .filter((a) => String(a.user_id || '') === String(selectedLocalUserId || ''))
      .map((a) => {
        const assignmentAuditLog = allocationAssignAuditById[a.id];
        const assignmentActor = getAllocationAssignmentActor(a, assignmentAuditLog);
        return {
          ...a,
          assetName: assetById[a.asset_id]?.name || `Asset ${a.asset_id}`,
          serial: assetById[a.asset_id]?.serial || '-',
          type: assetById[a.asset_id]?.type || '-',
          status: a.returned_at ? 'Returned' : 'Allocated',
          assignedBy: formatAssignedByName(assignmentActor.name)
        };
      })
      .sort((a, b) => new Date(b.allocated_at || 0) - new Date(a.allocated_at || 0));
  }, [selectedEmployee, allocations, assetById, allocationAssignAuditById]);
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
    const employee = employeeDirectory.find((emp) => String(emp.id) === String(employeeId));
    setSelectedReplacementEmployeeId(employeeId);
    setReplacementForm({
      allocationId: employee?.assignedAssets[0]?.id ? String(employee.assignedAssets[0].id) : '',
      replacementType: 'all',
      newAssetId: '',
      reason: 'Damaged',
      reasonDetail: ''
    });
  }

  function startReturnForEmployee(employeeId) {
    const employee = employeeDirectory.find((emp) => String(emp.id) === String(employeeId));
    setSelectedEmployeeReturnId(employeeId);
    setEmployeeReturnForm({
      allocationId: employee?.assignedAssets[0]?.id ? String(employee.assignedAssets[0].id) : '',
      reason: 'Damaged',
      notes: ''
    });
  }

  async function submitEmployeeReturnAsset(e) {
    e.preventDefault();
    if (!employeeReturnForm.allocationId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/api/allocations/${employeeReturnForm.allocationId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          return_reason: employeeReturnForm.reason,
          return_notes: employeeReturnForm.notes,
        })
      });
      const body = await res.json();
      setMessage(res.ok ? 'Asset returned successfully' : body.error || 'Return failed');
      if (res.ok) {
        setSelectedEmployeeReturnId(null);
        fetchAssets();
        fetchAllocations();
        fetchAuditLogs();
      }
    } catch (err) {
      setMessage('Network error returning asset');
    } finally {
      setLoading(false);
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
  const selectedEmployeeReplacementCount = useMemo(
    () => selectedEmployeeHistory.filter((item) => (item.notes || '').includes('Replacement for allocation')).length,
    [selectedEmployeeHistory]
  );
  const selectedEmployeeLatestNote = useMemo(() => {
    if (!selectedEmployee) return '-';
    const noted = selectedEmployee.assignedAssets.find((asset) => asset.notes);
    return noted?.notes || '-';
  }, [selectedEmployee]);
  useEffect(() => {
    setInventoryTypes((prev) => {
      const newTypes = new Set(prev);
      let changed = false;
      for (const a of assets) {
        if (a.type && !newTypes.has(a.type)) {
          newTypes.add(a.type);
          changed = true;
        }
      }
      if (changed) {
        return Array.from(newTypes).sort((a, b) => a.localeCompare(b));
      }
      return prev;
    });
  }, [assets]);
  const inventoryBrands = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.brand_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const inventoryDomains = useMemo(() => {
    const domainValues = (accountManagementDomains.length ? accountManagementDomains : [currentUserDomain])
      .map((domain) => String(domain || '').trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(domainValues)).sort((a, b) => a.localeCompare(b));
  }, [accountManagementDomains, currentUserDomain]);
  const assignmentFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Domains', searchText: 'all domains' },
      ...inventoryDomains
        .map((domain) => ({
          value: domain,
          label: domain,
          searchText: domain,
        })),
    ],
    [inventoryDomains]
  );
  function getSimAssetDetails(asset) {
    let details = {};
    try {
      details = asset.notes ? JSON.parse(asset.notes) : {};
    } catch (err) {
      details = {};
    }
    const connectionNumber = details.connection_number || '';
    const connectionType = details.connection_type || asset.vendor || '';
    const simStatus = details.sim_status || (asset.status === 'available' ? 'Active' : asset.status || '');
    const simNumber = details.sim_number || asset.serial || '';
    const assignedName = details.assigned_name || asset.name || '';
    const sNo = Number(details.s_no) || null;
    const source = details.source || '';
    const employeeCode = details.employee_code || '';
    return { sNo, connectionNumber, connectionType, simStatus, simNumber, assignedName, source, employeeCode };
  }
  const quickAssetResults = useMemo(() => {
    const q = quickAssetQuery.trim().toLowerCase();
    if (!q) return [];
    return assets
      .filter((asset) => {
        const simDetails = getSimAssetDetails(asset);
        return `${asset.name || ''} ${asset.type || ''} ${asset.serial || ''} ${asset.vendor || ''} ${asset.brand_name || ''} ${asset.model_name || ''} ${asset.domain_name || ''} ${asset.status || ''} ${simDetails.connectionNumber} ${simDetails.connectionType} ${simDetails.simStatus} ${simDetails.simNumber} ${simDetails.assignedName} ${simDetails.source} ${simDetails.employeeCode}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (a.type || '').localeCompare(b.type || '') || (a.name || '').localeCompare(b.name || ''))
      .slice(0, 8);
  }, [assets, quickAssetQuery]);
  function openInventoryAssetSearch(query = quickAssetQuery) {
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setInventoryQuery(nextQuery);
    setFilterType('all');
    setSection('inventory');
  }
  const isSimInventoryView = filterType === 'SIM';
  const filteredSortedAssets = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    const filtered = assets.filter((a) => {
      const simDetails = getSimAssetDetails(a);
      const matchQuery = !q || `${a.name || ''} ${a.type || ''} ${a.serial || ''} ${a.vendor || ''} ${a.brand_name || ''} ${a.model_name || ''} ${a.domain_name || ''} ${a.assigned_to_name || ''} ${a.assigned_to_employee_code || ''} ${a.status || ''} ${simDetails.connectionNumber} ${simDetails.connectionType} ${simDetails.simStatus} ${simDetails.simNumber} ${simDetails.assignedName} ${simDetails.source} ${simDetails.employeeCode}`.toLowerCase().includes(q);
      const matchDomain = filterDomain === 'all' || String(a.domain_name || '').trim().toLowerCase() === filterDomain;
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchBrand = filterBrand === 'all' || (a.brand_name || '') === filterBrand;
      const matchType = filterType === 'all' || (a.type || '') === filterType;
      return matchQuery && matchDomain && matchStatus && matchBrand && matchType;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (isSimInventoryView) {
        const leftSim = getSimAssetDetails(a);
        const rightSim = getSimAssetDetails(b);
        if (leftSim.sNo && rightSim.sNo && leftSim.sNo !== rightSim.sNo) return leftSim.sNo - rightSim.sNo;
        if (leftSim.connectionNumber !== rightSim.connectionNumber) return leftSim.connectionNumber.localeCompare(rightSim.connectionNumber);
      }
      const left = (a[sortBy] || '').toString().toLowerCase();
      const right = (b[sortBy] || '').toString().toLowerCase();
      if (left < right) return sortDir === 'asc' ? -1 : 1;
      if (left > right) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [assets, inventoryQuery, filterDomain, filterStatus, filterBrand, filterType, sortBy, sortDir, isSimInventoryView]);
  const pageSize = inventoryPageSize === 'all' ? filteredSortedAssets.length || 1 : Number(inventoryPageSize);
  const totalPages = Math.max(1, Math.ceil(filteredSortedAssets.length / pageSize));
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSortedAssets.slice(start, start + pageSize);
  }, [filteredSortedAssets, page, pageSize]);
  const inventoryStats = useMemo(() => {
    const total = filteredSortedAssets.length;
    const available = filteredSortedAssets.filter((a) => a.status === 'available').length;
    const allocated = filteredSortedAssets.filter((a) => a.status === 'allocated').length;
    const uniqueBrands = new Set(filteredSortedAssets.map((a) => a.brand_name).filter(Boolean)).size;
    return { total, available, allocated, uniqueBrands };
  }, [filteredSortedAssets]);
  const assignmentKpiCards = useMemo(() => {
    const totalEmployees = Math.max(employees.length, 1);
    const availableCount = availableAssets.length;
    const activeCount = activeAllocations.length;
    const coveredCount = assignedUsersCount;
    const assignableBase = Math.max(availableCount + activeCount, 1);
    return [
      {
        key: 'available',
        label: 'Available To Assign',
        value: availableCount.toLocaleString(),
        pct: Math.round((availableCount / assignableBase) * 100),
        hint: `${(availableCount + activeCount) > 0 ? Math.round((availableCount / assignableBase) * 100) : 0}% of assignable`
      },
      {
        key: 'active',
        label: 'Active Assignments',
        value: activeCount.toLocaleString(),
        pct: Math.round((activeCount / assignableBase) * 100),
        hint: `${(availableCount + activeCount) > 0 ? Math.round((activeCount / assignableBase) * 100) : 0}% of assignable`
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
  }, [availableAssets.length, activeAllocations.length, assignedUsersCount, employees.length]);
  const filteredInvoices = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    const now = Date.now();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    return invoices
      .filter((invoice) => invoiceStatusFilter === 'all' || invoice.status === invoiceStatusFilter)
      .filter((invoice) => invoiceVendorFilter === 'all' || (invoice.vendor || '') === invoiceVendorFilter)
      .filter((invoice) => invoiceCategoryFilter === 'all' || (invoice.category || '') === invoiceCategoryFilter)
      .filter((invoice) => invoiceSubcategoryFilter === 'all' || (invoice.subcategory || '') === invoiceSubcategoryFilter)
      .filter((invoice) => {
        if (invoiceDateFilter === 'all') return true;
        const rawDate = invoice.dueDate || invoice.createdAt;
        if (!rawDate) return false;
        const invoiceDate = typeof rawDate === 'number' ? new Date(rawDate) : new Date(`${rawDate}T00:00:00`);
        if (Number.isNaN(invoiceDate.getTime())) return false;
        if (invoiceDateFilter === 'overdue') {
          return invoice.status !== 'paid' && invoiceDate.getTime() < now;
        }
        if (invoiceDateFilter === 'this_month') {
          return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
        }
        if (invoiceDateFilter === 'last_30') {
          return now - invoiceDate.getTime() <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      })
      .filter((invoice) => {
        if (!q) return true;
        const approvalStatus = invoice.approvalStatus || (invoice.status === 'paid' ? 'completed' : 'pending_domain');
        const approvalStage = invoice.approvalStage || (invoice.status === 'paid' ? 'payment' : 'domain');
        return `${invoice.vendor || ''} ${invoice.billNo || ''} ${invoice.category || ''} ${invoice.subcategory || ''} ${invoice.notes || ''} ${invoice.status || ''} ${approvalStatus} ${approvalStage}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aApprovalStatus = a.approvalStatus || (a.status === 'paid' ? 'completed' : 'pending_domain');
        const bApprovalStatus = b.approvalStatus || (b.status === 'paid' ? 'completed' : 'pending_domain');
        const aPriority = INVOICE_APPROVAL_SORT_ORDER[aApprovalStatus] ?? 3;
        const bPriority = INVOICE_APPROVAL_SORT_ORDER[bApprovalStatus] ?? 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const left = a.dueDate || '';
        const right = b.dueDate || '';
        if (left === right) return (b.createdAt || 0) - (a.createdAt || 0);
        return left.localeCompare(right);
      });
  }, [invoices, invoiceQuery, invoiceStatusFilter, invoiceVendorFilter, invoiceCategoryFilter, invoiceSubcategoryFilter, invoiceDateFilter]);
  const invoiceVendors = useMemo(() => {
    return Array.from(new Set(invoices.map((invoice) => invoice.vendor).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [invoices]);
  const invoiceVendorOptions = useMemo(() => {
    return Array.from(new Set([...BILL_DESCRIPTION_VENDOR_OPTIONS, ...invoiceVendors])).sort((a, b) => a.localeCompare(b));
  }, [invoiceVendors]);
  const invoiceVendorDropdownOptions = useMemo(
    () => invoiceVendorOptions.map((vendor) => ({
      value: vendor,
      label: vendor,
      searchText: vendor,
    })),
    [invoiceVendorOptions]
  );
  const invoiceApproverDropdownOptions = useMemo(
    () => Array.from(new Set([
      ...INVOICE_APPROVER_NAME_OPTIONS,
      ...invoices.map((invoice) => invoice.approvalAssignee).filter(Boolean),
    ]))
      .sort((a, b) => a.localeCompare(b))
      .map((approver) => ({
        value: approver,
        label: approver,
        searchText: approver,
      })),
    [invoices]
  );
  const invoiceCategoryOptions = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(INVOICE_SUBCATEGORIES_BY_CATEGORY),
      ...invoices.map((invoice) => invoice.category).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b));
  }, [invoices]);
  const invoiceCategoryDropdownOptions = useMemo(
    () => invoiceCategoryOptions.map((category) => ({
      value: category,
      label: category,
      searchText: category,
    })),
    [invoiceCategoryOptions]
  );
  const invoiceFormSubcategoryOptions = useMemo(() => {
    return Array.from(new Set([
      ...(INVOICE_SUBCATEGORIES_BY_CATEGORY[invoiceForm.category] || []),
      ...invoices
        .filter((invoice) => invoice.category === invoiceForm.category)
        .map((invoice) => invoice.subcategory)
        .filter(Boolean),
      invoiceForm.subcategory,
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [invoiceForm.category, invoiceForm.subcategory, invoices]);
  const invoiceFormSubcategoryDropdownOptions = useMemo(
    () => invoiceFormSubcategoryOptions.map((subcategory) => ({
      value: subcategory,
      label: subcategory,
      searchText: subcategory,
    })),
    [invoiceFormSubcategoryOptions]
  );
  const invoiceSubcategoryOptions = useMemo(() => {
    if (invoiceCategoryFilter === 'all') {
      return Array.from(new Set([
        ...Object.values(INVOICE_SUBCATEGORIES_BY_CATEGORY).flat(),
        ...invoices.map((invoice) => invoice.subcategory).filter(Boolean),
      ])).sort((a, b) => a.localeCompare(b));
    }
    return Array.from(new Set([
      ...(INVOICE_SUBCATEGORIES_BY_CATEGORY[invoiceCategoryFilter] || []),
      ...invoices
        .filter((invoice) => invoice.category === invoiceCategoryFilter)
        .map((invoice) => invoice.subcategory)
        .filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b));
  }, [invoiceCategoryFilter, invoices]);
  const filteredInvoiceStats = useMemo(() => {
    return {
      totalAmount: filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
      count: filteredInvoices.length,
      paid: filteredInvoices.filter((invoice) => invoice.status === 'paid').length,
      withBills: filteredInvoices.filter((invoice) => invoice.invoiceFileData || invoice.invoiceFileName).length
    };
  }, [filteredInvoices]);
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
    const pendingApproval = invoices.filter((invoice) => {
      const approvalStatus = invoice.approvalStatus || (invoice.status === 'paid' ? 'completed' : 'pending_domain');
      return ['pending_domain', 'pending_head', 'pending_accounts', 'payment_pending'].includes(approvalStatus);
    }).length;
    const rejected = invoices.filter((invoice) => invoice.approvalStatus === 'rejected').length;
    return {
      total: invoices.length,
      paid: invoices.filter((invoice) => invoice.status === 'paid').length,
      unpaid: invoices.filter((invoice) => invoice.status === 'unpaid').length,
      overdue: overdueCount,
      pendingApproval,
      rejected,
      totalAmount,
      paidAmount,
      unpaidAmount
    };
  }, [invoices]);

  useEffect(() => {
    if (!invoices.length) {
      localStorage.setItem('invoices', '[]');
      return;
    }
    try {
      const persistenceMode = persistInvoicesSafely(invoices);
      if (persistenceMode === 'lightweight') {
        setMessage('Browser storage is full, so bill details were saved without heavy file data.');
      }
    } catch (_error) {
      setMessage('Browser storage is full. Remove large invoice files or clear old bill records.');
    }
  }, [invoices]);

  useEffect(() => {
    if (invoiceAttachmentsLoadedRef.current || !invoices.length) return;
    invoiceAttachmentsLoadedRef.current = true;

    let cancelled = false;
    Promise.all(invoices.map(async (invoice) => {
      const [invoiceFileData, paidBillScreenshotData] = await Promise.all([
        invoice.invoiceFileData ? Promise.resolve(invoice.invoiceFileData) : getInvoiceAttachment(getInvoiceAttachmentKey(invoice.id, 'invoice')),
        invoice.paidBillScreenshotData ? Promise.resolve(invoice.paidBillScreenshotData) : getInvoiceAttachment(getInvoiceAttachmentKey(invoice.id, 'paidProof'))
      ]);
      return {
        ...invoice,
        invoiceFileData: invoiceFileData || invoice.invoiceFileData || '',
        paidBillScreenshotData: paidBillScreenshotData || invoice.paidBillScreenshotData || ''
      };
    }))
      .then((hydratedInvoices) => {
        if (cancelled) return;
        const hasRestoredData = hydratedInvoices.some((invoice, index) => (
          invoice.invoiceFileData !== invoices[index]?.invoiceFileData ||
          invoice.paidBillScreenshotData !== invoices[index]?.paidBillScreenshotData
        ));
        if (hasRestoredData) setInvoices(hydratedInvoices);
      })
      .catch(() => {
        if (!cancelled) setMessage('Could not load saved invoice attachments from this browser.');
      });

    return () => {
      cancelled = true;
    };
  }, [invoices]);

  useEffect(() => {
    setPage(1);
  }, [inventoryQuery, filterDomain, filterStatus, filterBrand, filterType, sortBy, sortDir, inventoryPageSize]);

  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentSearch, assignmentUserFilter, assignmentPageSize]);

  function openAssignedDomainAssets(domain, type = 'all') {
    const normalizedDomain = String(domain || '').trim().toLowerCase();
    if (!normalizedDomain) return;
    setInventoryQuery('');
    setFilterDomain(normalizedDomain);
    setFilterStatus('allocated');
    setFilterBrand('all');
    setFilterType(type);
    setPage(1);
    setSection('inventory');
  }

  function exportInventoryCsv() {
    const header = isSimInventoryView
      ? ['S. No.', 'CONNECTION NUMBER', 'CONNECTION TYPE', 'STATUS', 'SIM NUMBER', 'NAME', 'SOURCE']
      : ['Asset', 'Type', 'Brand', 'Model', 'Assigned To', 'Employee Code', 'Domain', 'Vendor', 'Serial', 'Status'];
    const rows = isSimInventoryView
      ? filteredSortedAssets.map((a, index) => {
        const sim = getSimAssetDetails(a);
        return [sim.sNo || index + 1, sim.connectionNumber, sim.connectionType, sim.simStatus, sim.simNumber, sim.assignedName, sim.source];
      })
      : filteredSortedAssets.map((a) => [
        a.name || '',
        a.type || '',
        a.brand_name || '',
        a.model_name || '',
        a.assigned_to_name || '',
        a.assigned_to_employee_code || '',
        a.domain_name || '',
        a.vendor || '',
        a.serial || '',
        a.status || ''
      ]);
    const csv = buildExcelCsv([header, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportAssignmentCsv() {
    const header = ['Employee', 'Code', 'Email', 'Mobile', 'Department', 'Designation', 'Geolocation', 'Role', 'Assigned Assets', 'Latest Assignment'];
    const rows = employeeDirectory.map((employee) => ([
      employee.name || '',
      employee.employee_code || '',
      employee.email || '',
      employee.personal_mobile_no || '',
      employee.department || '',
      employee.designation || '',
      employee.geolocation || employee.location || '',
      employee.role || '',
      employee.assignedAssets.map((asset) => `${asset.assetName} (${asset.serial || '-'})`).join(' | '),
      employee.latestAllocatedAt ? employee.latestAllocatedAt.toLocaleString() : ''
    ]));
    const csv = buildExcelCsv([header, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assignment_directory_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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
    fetchAssets('all');
    setSortBy('name');
    setSortDir('asc');
    setInventoryPageSize('25');
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
    const invoiceId = Date.now();
    if (invoiceForm.invoiceFileData) {
      saveInvoiceAttachment(getInvoiceAttachmentKey(invoiceId, 'invoice'), invoiceForm.invoiceFileData)
        .catch(() => setMessage('Bill saved, but invoice file could not be stored in this browser.'));
    }
    setInvoices((prev) => [
      {
        id: invoiceId,
        vendor: invoiceForm.vendor.trim(),
        billNo: invoiceForm.billNo.trim(),
        category: invoiceForm.category,
        subcategory: invoiceForm.subcategory,
        amount,
        dueDate: invoiceForm.dueDate,
        status: invoiceForm.status,
        approvalAssignee: invoiceForm.approvalAssignee.trim(),
        notes: invoiceForm.notes.trim(),
        invoiceFileName: invoiceForm.invoiceFileName,
        invoiceFileData: invoiceForm.invoiceFileData,
        paidBillScreenshotName: '',
        paidBillScreenshotData: '',
        raisedDomain: currentUserDomain || '',
        approvalStage: 'head',
        approvalStatus: 'pending_head',
        approvalHistory: [{ action: 'Invoice Raised', stage: 'Domain', at: new Date().toISOString() }],
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
      approvalAssignee: '',
      notes: '',
      invoiceFileName: '',
      invoiceFileData: ''
    });
    setMessage('Invoice raised and sent to admin approval.');
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

  function getInvoiceApproval(invoice) {
    const approvalStatus = invoice.approvalStatus || (invoice.status === 'paid' ? 'completed' : 'pending_head');
    const approvalStage = invoice.approvalStage || (invoice.status === 'paid' ? 'payment' : 'head');
    const stage = INVOICE_APPROVAL_STAGES.find((item) => item.key === approvalStage);
    const fallbackStageLabel = approvalStage === 'archived'
      ? 'Archived'
      : approvalStage === 'correction'
        ? 'Correction'
        : 'Admin Approval';
    return {
      stageKey: approvalStage,
      statusKey: approvalStatus,
      stageLabel: stage?.label || fallbackStageLabel,
      statusLabel: INVOICE_APPROVAL_STATUS_LABELS[approvalStatus] || approvalStatus
    };
  }

  function updateInvoiceApproval(invoiceId, action) {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!targetInvoice) return;
    const targetApproval = getInvoiceApproval(targetInvoice);
    const isCurrentUserAdmin = String(user?.role || '').trim().toLowerCase() === 'admin';
    const canActOnHeadStage = targetApproval.stageKey === 'head'
      && canUseInvoiceApprovalAction(
        targetInvoice,
        hasInvoiceHeadApprovalAccess(),
        isSuperAdmin || (isCurrentUserAdmin && isZaptoRaisedInvoice(targetInvoice))
      );
    const canActOnAccountsStage = targetApproval.stageKey === 'accounts'
      && canUseInvoiceApprovalAction(targetInvoice, hasInvoiceAccountsApprovalAccess(), isSuperAdmin);
    const canResubmitBill = action === 'Resubmit' && hasAdminPermission('invoices.manage');
    if (!canActOnHeadStage && !canActOnAccountsStage && !canResubmitBill) {
      setMessage(hasInvoiceApprovalAssignee(targetInvoice)
        ? `Only ${targetInvoice.approvalAssignee} can approve this bill.`
        : 'You do not have permission for this approval stage.');
      return;
    }

    let reason = '';
    if (action === 'Reject' || action === 'Approve') {
      reason = window.prompt(action === 'Reject' ? 'Enter rejection reason' : 'Enter approval reason');
      if (!reason || !reason.trim()) {
        setMessage(action === 'Reject' ? 'Rejection reason is required.' : 'Approval reason is required.');
        return;
      }
      reason = reason.trim();
    }

    setInvoices((prev) => prev.map((invoice) => {
      if (invoice.id !== invoiceId) return invoice;

      const current = getInvoiceApproval(invoice);
      const history = Array.isArray(invoice.approvalHistory) ? invoice.approvalHistory : [];
      const entry = { action, stage: current.stageLabel, reason, at: new Date().toISOString() };

      if (action === 'Reject') {
        return {
          ...invoice,
          status: 'unpaid',
          approvalStage: 'archived',
          approvalStatus: 'rejected',
          rejectionReason: reason,
          approvalHistory: [...history, entry]
        };
      }

      if (action === 'Correction') {
        return {
          ...invoice,
          status: 'unpaid',
          approvalStage: 'correction',
          approvalStatus: 'correction',
          approvalHistory: [...history, entry]
        };
      }

      if (action === 'Resubmit') {
        return {
          ...invoice,
          status: 'unpaid',
          approvalStage: 'head',
          approvalStatus: 'pending_head',
          rejectionReason: '',
          approvalHistory: [...history, entry]
        };
      }

      if (current.stageKey === 'domain') {
        return {
          ...invoice,
          approvalStage: 'head',
          approvalStatus: 'pending_head',
          approvalHistory: [...history, entry]
        };
      }

      if (current.stageKey === 'head') {
        return {
          ...invoice,
          approvalStage: 'accounts',
          approvalStatus: 'pending_accounts',
          approvalHistory: [...history, entry]
        };
      }

      if (current.stageKey === 'accounts') {
        return {
          ...invoice,
          approvalStage: 'payment',
          approvalStatus: 'payment_pending',
          approvalHistory: [...history, entry]
        };
      }

      return invoice;
    }));
  }

  function deleteInvoice(invoiceId) {
    if (!canDeleteInvoices()) {
      setMessage('Only admin can delete bill records.');
      return;
    }
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!targetInvoice) return;
    const confirmed = window.confirm(`Delete bill "${targetInvoice.billNo || targetInvoice.vendor || invoiceId}"?`);
    if (!confirmed) return;
    const deletedInvoiceKeys = readDeletedInvoiceKeys();
    deletedInvoiceKeys.add(getInvoiceMergeKey(targetInvoice));
    localStorage.setItem(DELETED_INVOICE_KEYS_STORAGE_KEY, JSON.stringify(Array.from(deletedInvoiceKeys)));
    setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
    setMessage('Bill record deleted.');
  }

  function updateInvoiceUpload(invoiceId, file) {
    if (!file) return;
    if (!hasAdminPermission('invoices.manage')) {
      setMessage('You do not have permission to update invoices.');
      return;
    }
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    const hadInvoiceFile = !!(targetInvoice?.invoiceFileData || targetInvoice?.invoiceFileName);
    readInvoiceFile(file, (filePayload) => {
      saveInvoiceAttachment(getInvoiceAttachmentKey(invoiceId, 'invoice'), filePayload.invoiceFileData)
        .catch(() => setMessage('Invoice file could not be stored in this browser.'));
      setInvoices((prev) => prev.map((invoice) => (
        invoice.id === invoiceId
          ? { ...invoice, ...filePayload }
          : invoice
      )));
      setMessage(hadInvoiceFile ? 'Invoice changed successfully.' : 'Invoice uploaded successfully.');
    });
  }

  function updatePaidBillScreenshot(invoiceId, file) {
    if (!file) return;
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!canUseInvoiceApprovalAction(targetInvoice, hasInvoiceAccountsApprovalAccess())) {
      setMessage(hasInvoiceApprovalAssignee(targetInvoice)
        ? `Only ${targetInvoice.approvalAssignee} can attach paid bill screenshots.`
        : 'You do not have permission to attach paid bill screenshots.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const proofData = String(reader.result || '');
      saveInvoiceAttachment(getInvoiceAttachmentKey(invoiceId, 'paidProof'), proofData)
        .catch(() => setMessage('Paid proof could not be stored in this browser.'));
      setInvoices((prev) => prev.map((invoice) => (
        invoice.id === invoiceId
          ? {
            ...invoice,
            paidBillScreenshotName: file.name,
            paidBillScreenshotData: proofData
          }
          : invoice
      )));
      setMessage('Paid bill screenshot attached.');
    };
    reader.readAsDataURL(file);
  }

  function updateInvoicePaymentStatus(invoiceId, nextStatus) {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!targetInvoice) return;
    const targetApproval = getInvoiceApproval(targetInvoice);
    const canManagePayment = targetApproval.stageKey === 'payment'
      && canUseInvoiceApprovalAction(targetInvoice, hasInvoiceAccountsApprovalAccess(), isSuperAdmin);
    if (!canManagePayment) {
      setMessage(hasInvoiceApprovalAssignee(targetInvoice)
        ? `Only ${targetInvoice.approvalAssignee} can update payment status.`
        : 'You do not have permission to update payment status.');
      return;
    }

    const normalizedStatus = nextStatus === 'paid' ? 'paid' : 'unpaid';
    const actionLabel = normalizedStatus === 'paid' ? 'Marked Paid' : 'Marked Unpaid';
    setInvoices((prev) => prev.map((invoice) => {
      if (invoice.id !== invoiceId) return invoice;
      const history = Array.isArray(invoice.approvalHistory) ? invoice.approvalHistory : [];
      return {
        ...invoice,
        status: normalizedStatus,
        approvalStage: 'payment',
        approvalStatus: normalizedStatus === 'paid' ? 'completed' : 'payment_pending',
        approvalHistory: [
          ...history,
          { action: actionLabel, stage: 'Payment', at: new Date().toISOString() }
        ]
      };
    }));
    setMessage(`Payment status updated to ${normalizedStatus}.`);
  }

  async function showPaidBillScreenshot(invoice) {
    const proofData = invoice.paidBillScreenshotData || await getInvoiceAttachment(getInvoiceAttachmentKey(invoice.id, 'paidProof'));
    if (!proofData) {
      setMessage('Upload a paid bill screenshot before viewing it.');
      return;
    }
    setInvoicePreview({
      ...invoice,
      invoiceFileName: invoice.paidBillScreenshotName || 'Paid bill screenshot',
      invoiceFileData: proofData
    });
  }

  function showInvoice(invoice) {
    if (!invoice.invoiceFileData) {
      setMessage('Upload an invoice before viewing it.');
      return;
    }
    setInvoicePreview(invoice);
  }

  const selectedInvoiceDetail = invoiceDetail
    ? invoices.find((invoice) => invoice.id === invoiceDetail.id) || invoiceDetail
    : null;

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
                      <img src="/nextgen-logo1-transparent.png" alt="NEXTGEN" className="auth-brand-logo" />
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
                      &times;
                    </button>
                    <h3 id="login-title">Hello!</h3>
                    <p>Sign in to get started.</p>
                    <form onSubmit={login} className="form auth-form-modern" autoComplete="off">
                      <div className="input-shell">
                        <input
                          id="email"
                          name="email"
                          type="text"
                          placeholder="Username"
                          autoComplete="off"
                          required
                        />
                      </div>
                      <div className="input-shell">
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
              <img src="/nextgen-logo1-transparent.png" alt="NEXTGEN" className="sidebar-brand-logo" />
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

        <button type="button" className="sidebar-logout" onClick={() => setShowLogoutDialog(true)}>
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
                <div className="overview-asset-search">
                  <input
                    type="text"
                    placeholder="Quick search assets..."
                    value={quickAssetQuery}
                    onChange={(e) => setQuickAssetQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openInventoryAssetSearch();
                    }}
                    aria-label="Quick search assets"
                  />
                  {quickAssetQuery.trim() && (
                    <div className="overview-asset-results" role="listbox" aria-label="Asset search results">
                      {quickAssetResults.length ? (
                        quickAssetResults.map((asset) => (
                          <button
                            type="button"
                            key={asset.id}
                            onClick={() => openInventoryAssetSearch(asset.name || asset.type || asset.serial || quickAssetQuery)}
                          >
                            <span>
                              <strong>{asset.name || asset.type || 'Asset'}</strong>
                              <small>{[asset.type, asset.brand_name, asset.model_name].filter(Boolean).join(' / ') || 'Asset'}</small>
                            </span>
                            <em>{asset.serial || asset.status || '-'}</em>
                          </button>
                        ))
                      ) : (
                        <div className="overview-asset-empty">No assets found</div>
                      )}
                      <button
                        type="button"
                        className="overview-asset-view-all"
                        onClick={() => openInventoryAssetSearch()}
                      >
                        View all matching assets
                      </button>
                    </div>
                  )}
                </div>
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
                <div className="panel-head"><h3>Assigned assets by domain</h3><span>{activeAllocations.length} active assignments</span></div>
                <ul className="list plain overview-activity-list">
                  {domainAssignmentTotals.length === 0 && (
                    <li>
                      <div>
                        <strong>No assigned assets</strong>
                        <small>Domains will appear here after assignment</small>
                      </div>
                    </li>
                  )}
                  {domainAssignmentTotals.slice(0, 6).map((item) => (
                    <li key={item.domain}>
                      <div>
                        <strong>{item.domain}</strong>
                        <small className="domain-asset-breakdown">
                          <button
                            type="button"
                            disabled={!item.laptop}
                            onClick={() => openAssignedDomainAssets(item.domain, 'Laptop')}
                          >
                            Laptop {item.laptop}
                          </button>
                          <button
                            type="button"
                            disabled={!item.mobile}
                            onClick={() => openAssignedDomainAssets(item.domain, 'Mobile')}
                          >
                            Mobile {item.mobile}
                          </button>
                          <button
                            type="button"
                            disabled={!item.sim}
                            onClick={() => openAssignedDomainAssets(item.domain, 'SIM')}
                          >
                            SIM {item.sim}
                          </button>
                        </small>
                      </div>
                      <div className="activity-meta">
                        <span>{item.count}</span>
                        <small>{item.pct}% assigned</small>
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
            <div className="inventory-page-stack">
              <div className="inventory-head">
                <div>
                  <h3>Asset Inventory</h3>
                </div>
              </div>

            {hasAdminPermission('inventory.manage') && (
              <div className="create-box inventory-create-top">
                <div className="create-head">
                  <div>
                    <h4>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h4>
                  </div>
                  <div className="create-meta">
                    <span>{editingAsset ? 'Editing mode' : (displayedAssetType || 'Select asset type')}</span>
                    <span>{brandsBySelectedType.length} brands</span>
                    <span>{modelOptionsByType.length} models</span>
                  </div>
                </div>
                <form onSubmit={createAsset} className="form asset-create-form">
                  <label className="field required-field">
                    <span>Asset Type <span className="required-indicator">*</span></span>
                    <SearchableSelect
                      value={selectedAssetType}
                      onChange={(value) => {
                        setSelectedAssetType(value);
                        setCustomAssetType('');
                        setSelectedBrandId('');
                        setCustomBrandName('');
                        setSelectedModelId('');
                        setCustomModelName('');
                      }}
                      options={assetTypeDropdownOptions}
                      placeholder="Select asset type"
                      searchPlaceholder="Search or type asset type..."
                      emptyMessage="No asset type found"
                      showSearch={false}
                      selectedLabel={displayedAssetType}
                      customMode={selectedAssetType === OTHER_ASSET_TYPE_VALUE}
                      customValue={customAssetType}
                      customPlaceholder="Type asset type"
                      onCustomChange={(value) => {
                        setCustomAssetType(value);
                        setSelectedBrandId('');
                        setCustomBrandName('');
                        setSelectedModelId('');
                        setCustomModelName('');
                      }}
                    />
                  </label>
                  <label className="field required-field">
                    <span>Brand <span className="required-indicator">*</span></span>
                    <SearchableSelect
                      value={selectedBrandId}
                      onChange={(value) => {
                        setSelectedBrandId(value);
                        setCustomBrandName('');
                        setSelectedModelId('');
                        setCustomModelName('');
                      }}
                      options={brandDropdownOptions}
                      placeholder="Select asset brand"
                      searchPlaceholder="Search or type brand..."
                      emptyMessage="No brand found"
                      showSearch={false}
                      selectedLabel={customBrandName}
                      customMode={selectedBrandId === OTHER_BRAND_VALUE}
                      customValue={customBrandName}
                      customPlaceholder="Type asset brand"
                      onCustomChange={(value) => {
                        setCustomBrandName(value);
                        setSelectedModelId('');
                        setCustomModelName('');
                      }}
                    />
                  </label>
                  <label className="field required-field">
                    <span>Model <span className="required-indicator">*</span></span>
                    <SearchableSelect
                      value={selectedModelId}
                      onChange={(value) => {
                        setSelectedModelId(value);
                        setCustomModelName('');
                      }}
                      options={modelDropdownOptions}
                      placeholder="Select asset model"
                      searchPlaceholder="Search or type asset model..."
                      emptyMessage="No model found"
                      showSearch={false}
                      selectedLabel={customModelName}
                      customMode={selectedModelId === OTHER_MODEL_VALUE}
                      customValue={customModelName}
                      customPlaceholder="Type asset model"
                      onCustomChange={setCustomModelName}
                    />
                  </label>
                  <label className="field required-field">
                    <span>Serial Number <span className="required-indicator">*</span></span>
                    <input
                      name="serial"
                      placeholder="e.g. SN-AX9-22190"
                      value={assetDraft.serial}
                      onChange={(e) => setAssetDraft((prev) => ({ ...prev, serial: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Vendor (optional)</span>
                    <input
                      name="vendor"
                      placeholder="e.g. Dell Partner, Amazon, Local Supplier"
                      value={assetDraft.vendor}
                      onChange={(e) => setAssetDraft((prev) => ({ ...prev, vendor: e.target.value }))}
                    />
                  </label>
                  <label className="field required-field">
                    <span>Domain <span className="required-indicator">*</span></span>
                    <select
                      name="domain_name"
                      value={assetDomainName}
                      onChange={(e) => setAssetDomainName(e.target.value)}
                      required
                      disabled={!isSuperAdmin}
                    >
                      <option value="" disabled>Select domain</option>
                      {Array.from(new Set([assetDomainName, currentUserDomain, ...inventoryDomains].filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b))
                        .map((domain) => (
                          <option key={domain} value={domain}>{domain}</option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <input
                      name="notes"
                      placeholder="Branch, team, procurement, warranty..."
                      value={assetDraft.notes}
                      onChange={(e) => setAssetDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </label>
                  <div className="field asset-bulk-upload">
                    <span>Bulk Upload Assets</span>
                    <div className="bulk-upload-actions">
                      <div className="bulk-upload-file-box">
                        <input
                          id="bulk-asset-upload"
                          className="bulk-upload-input"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={uploadBulkAssets}
                        />
                        <label className="bulk-upload-picker" htmlFor="bulk-asset-upload">
                          Choose file
                        </label>
                      </div>
                      <div className="bulk-upload-sample-box">
                        <button
                          type="button"
                          className="secondary-link bulk-upload-inline-link"
                          onClick={downloadBulkAssetTemplate}
                        >
                          Download Bulk Upload Sample
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="create-actions">
                    <div className="create-action-buttons">
                      {editingAsset && (
                        <button type="button" className="outline" onClick={resetAssetForm}>Cancel Edit</button>
                      )}
                      <button type="submit">{editingAsset ? 'Save Changes' : 'Add Asset'}</button>
                    </div>
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
              <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
                <option value="all">All Domains</option>
                {inventoryDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="allocated">Allocated</option>
              </select>
              <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
                <option value="all">All Brands</option>
                {inventoryBrands.map((b) => <option key={b} value={b}>{b}</option>)}
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
              <select value={inventoryPageSize} onChange={(e) => setInventoryPageSize(e.target.value)}>
                <option value="25">Show 25</option>
                <option value="50">Show 50</option>
                <option value="100">Show 100</option>
                <option value="all">Show All</option>
              </select>
            </div>

            <div className="inventory-type-buttons" aria-label="Asset type filters">
              <button
                type="button"
                className={filterType === 'all' ? 'active' : ''}
                onClick={() => { setFilterType('all'); fetchAssets('all'); }}
              >
                All Types
              </button>
              {inventoryTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={filterType === type ? 'active' : ''}
                  onClick={() => { setFilterType(type); fetchAssets(type); }}
                >
                  {type}
                </button>
              ))}
              <div className="inventory-type-actions">
                <button type="button" className="outline inventory-export-inline" onClick={exportInventoryCsv}>Export CSV</button>
                <button type="button" className="outline inventory-reset-inline" onClick={resetInventoryFilters}>Reset Filters</button>
              </div>
            </div>

            <div className="inventory-mini-stats inventory-mini-stats-strong">
              <article><span>Filtered Total</span><strong>{inventoryStats.total}</strong></article>
              <article><span>Available Stock</span><strong>{inventoryStats.available}</strong></article>
              <article><span>Allocated Stock</span><strong>{inventoryStats.allocated}</strong></article>
              <article><span>Brands</span><strong>{inventoryStats.uniqueBrands}</strong></article>
            </div>

            <div className="inventory-table-shell">
              <div className="table-wrap">
                {isSimInventoryView ? (
                  <table>
                    <thead><tr><th>S. No.</th><th>CONNECTION NUMBER</th><th>CONNECTION TYPE</th><th>STATUS</th><th>SIM NUMBER</th><th>NAME</th><th>SOURCE</th><th>Action</th></tr></thead>
                    <tbody>
                      {paginatedAssets.map((a, index) => {
                        const sim = getSimAssetDetails(a);
                        return (
                          <tr key={a.id}>
                            <td>{sim.sNo || (page - 1) * pageSize + index + 1}</td>
                            <td>{sim.connectionNumber || '-'}</td>
                            <td>{sim.connectionType || '-'}</td>
                            <td>{sim.simStatus || '-'}</td>
                            <td>{sim.simNumber || '-'}</td>
                            <td>{sim.assignedName || '-'}</td>
                            <td>{sim.source || '-'}</td>
                            <td>
                              <div className="asset-row-actions">
                                {hasAdminPermission('inventory.manage') ? (
                                  <>
                                    <button type="button" className="small outline" onClick={() => startEditAsset(a)}>Edit</button>
                                    <button type="button" className="small danger" onClick={() => requestDeleteAsset(a)}>Delete</button>
                                  </>
                                ) : '-'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead><tr><th>Type</th><th>Brand</th><th>Model</th><th>Domain</th><th>Vendor</th><th>Serial</th><th>Status</th><th>QR</th><th>Action</th></tr></thead>
                    <tbody>
                      {paginatedAssets.map((a) => (
                        <tr key={a.id}>
                          <td>{a.type}</td><td>{a.brand_name || '-'}</td><td>{a.model_name || '-'}</td><td>{a.domain_name || '-'}</td><td>{a.vendor || '-'}</td><td>{a.serial}</td>
                          <td><span className={`status ${a.status}`}>{a.status}</span></td>
                          <td>
                            <div className="asset-qr-cell">
                              <img src={getQrImageUrl(buildAssetQrData(a))} alt={`${a.name} QR`} />
                              <button type="button" className="small" onClick={() => printAssetQr(a)}>Print QR</button>
                            </div>
                          </td>
                          <td>
                            <div className="asset-row-actions">
                              {hasAdminPermission('inventory.manage') ? (
                                <>
                                  <button type="button" className="small outline" onClick={() => startEditAsset(a)}>Edit</button>
                                  <button type="button" className="small danger" onClick={() => requestDeleteAsset(a)}>Delete</button>
                                </>
                              ) : '-'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="inventory-pager">
                <span>Page {page} of {totalPages} | Showing {paginatedAssets.length} items</span>
                <div className="inventory-pager-actions">
                  <button type="button" className="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                  <button type="button" className="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              </div>
            </div>
            </div>
          </section>
        )}

        {assetDeleteDialog && (
          <div
            className="asset-delete-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-delete-title"
            onClick={closeAssetDeleteDialog}
          >
            <section className="asset-delete-modal" onClick={(e) => e.stopPropagation()}>
              {assetDeleteDialog.mode === 'assigned' ? (
                <>
                  <h3 id="asset-delete-title">Asset Deletion Validation</h3>
                  <div className="asset-delete-detail">
                    <strong>Assigned To:</strong>
                    <span>{assetDeleteDialog.assignedTo || '-'}</span>
                  </div>
                  <p>This asset is currently assigned to an assignee. Please unassign the asset before deleting it.</p>
                  <div className="asset-delete-actions">
                    <button type="button" className="outline" onClick={closeAssetDeleteDialog}>OK</button>
                  </div>
                </>
              ) : (
                <>
                  <h3 id="asset-delete-title">Delete Asset</h3>
                  <p>Are you sure you want to delete this asset?</p>
                  <div className="asset-delete-actions">
                    <button type="button" className="outline" onClick={closeAssetDeleteDialog}>Cancel</button>
                    <button type="button" className="outline" onClick={confirmDeleteAsset}>Delete</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {section === 'assignments' && (
          <div className="assignments-page-stack">
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
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAssignmentSearchDraft(nextValue);
                    setAssignmentSearch(nextValue.trim());
                  }}
                />
                <SearchableSelect
                  value={assignmentUserFilter}
                  onChange={setAssignmentUserFilter}
                  options={assignmentFilterOptions}
                  placeholder="All Domains"
                  searchPlaceholder="Search domain..."
                  emptyMessage="No domain found"
                />
                <button type="button" className="small" onClick={exportAssignmentCsv}>Export CSV</button>
              </form>

              {hasAdminPermission('assignments.manage') && (
                <div className="create-box assignment-quick-assign">
                  <h4>Assign Asset To Employee</h4>
                  <form id="assignment-quick-form" onSubmit={allocate} className="form assignment-inline-form">
                    <label className="assignment-field">
                      <span>Employee Name</span>
                      <input
                        list="quick-assign-employee-names"
                        value={quickAssignForm.employeeName}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeName', e.target.value)}
                        placeholder="Type employee name"
                        className={assignValidated && !quickAssignForm.employeeName.trim() ? 'input-error' : ''}
                      />
                      <datalist id="quick-assign-employee-names">
                        {quickAssignUsers.map((employee, index) => (
                          <option key={`employee-name-${employee.selection_value || employee.local_user_id || employee.id || index}`} value={employee.name || ''}>
                            {employee.employee_code || employee.employee_email || ''}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    <label className="assignment-field">
                      <span>Employee Code</span>
                      <input
                        type="text"
                        value={quickAssignForm.employeeCode}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeCode', e.target.value)}
                        placeholder="Type employee code"
                        className={assignValidated && !quickAssignForm.employeeCode.trim() ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Email</span>
                      <input
                        type="text"
                        value={quickAssignForm.employeeEmail}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeEmail', e.target.value)}
                        placeholder="Type email"
                        className={assignValidated && !quickAssignForm.employeeEmail.trim() ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Mobile</span>
                      <input
                        value={quickAssignForm.employeeMobile}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeMobile', e.target.value)}
                        placeholder="Type mobile"
                        className={assignValidated && !quickAssignForm.employeeMobile.trim() ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Department</span>
                      <input
                        value={quickAssignForm.employeeDepartment}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeDepartment', e.target.value)}
                        placeholder="Type department"
                        className={assignValidated && !quickAssignForm.employeeDepartment.trim() ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Designation</span>
                      <input
                        value={quickAssignForm.employeeDesignation}
                        onChange={(e) => updateQuickAssignEmployeeField('employeeDesignation', e.target.value)}
                        placeholder="Type designation"
                        className={assignValidated && !quickAssignForm.employeeDesignation.trim() ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Asset Type</span>
                      <select
                        value={quickAssignForm.assetType}
                        onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, assetType: e.target.value }))}
                      >
                        <option value="all">All asset types</option>
                        {quickAssignTypeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="assignment-field">
                      <span>Available Asset</span>
                      <SearchableSelect
                        value={quickAssignForm.assetId}
                        onChange={(nextValue) => setQuickAssignForm((prev) => ({ ...prev, assetId: nextValue }))}
                        options={quickAssignAssetSelectOptions}
                        placeholder={quickAssignAssetSelectOptions.length ? 'Select available asset' : 'No available assets'}
                        searchPlaceholder="Search asset by name, serial, brand..."
                        emptyMessage="No asset found"
                        className={assignValidated && !quickAssignForm.assetId ? 'input-error' : ''}
                      />
                    </label>
                    <label className="assignment-field">
                      <span>Notes</span>
                      <input
                        name="notes"
                        value={quickAssignForm.notes}
                        onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, notes: e.target.value }))}
                      />
                    </label>
                    {!isSuperAdmin && (
                      <button
                        type="button"
                        className="selfie-open-btn"
                        disabled={!getQuickAssignSelfieUserId()}
                        onClick={(e) => openSelfieCamera(e, getQuickAssignSelfieUserId())}
                      >
                        Live Selfie
                      </button>
                    )}
                    <div className="assignment-submit-row">
                      <button
                        type="submit"
                        className="assignment-submit-btn"
                      >
                        Assign To Employee
                      </button>
                    </div>
                  </form>
                  {selfieCameraOpen && (
                    <div className="selfie-camera-box quick-selfie-camera">
                      <video ref={selfieVideoRef} className="selfie-camera-preview" autoPlay playsInline muted />
                      <div className="selfie-camera-actions">
                        <button type="button" className="small selfie-capture-btn" onClick={captureEmployeeSelfie} disabled={selfieSaving}>
                          {selfieSaving ? 'Saving...' : 'Capture Selfie'}
                        </button>
                        <button type="button" className="small outline" onClick={stopSelfieCamera}>
                          Close Camera
                        </button>
                      </div>
                    </div>
                  )}
                  {selfieError && <p className="selfie-error">{selfieError}</p>}
                  <p className="assignment-inline-meta">
                    {quickAssignAssetOptions.length} matching available assets
                    {quickAssignForm.assetType !== 'all' ? ` in ${quickAssignForm.assetType}` : ''}
                  </p>
                </div>
              )}

              <div className="table-wrap assignment-employee-table">
                <table key={employeeDirectoryRenderKey}>
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Employee</th>
                      <th>ID</th>
                      <th>Code</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Domain</th>
                      <th>Asset Type</th>
                      <th>Geolocation</th>
                      <th>Assigned Assets</th>
                      <th>Latest Assignment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployeeDirectory.length === 0 ? (
                      <tr><td colSpan={12}>No employees matched this search.</td></tr>
                    ) : paginatedEmployeeDirectory.map((emp, index) => (
                      <tr key={emp.id}>
                        <td>{(assignmentPage - 1) * assignmentSize + index + 1}</td>
                        <td className="employee-cell">
                          <div>
                            <strong>{emp.name}</strong>
                          </div>
                        </td>
                        <td>{emp.id}</td>
                        <td>{emp.employee_code || '-'}</td>
                        <td>{emp.email || '-'}</td>
                        <td>{emp.personal_mobile_no || '-'}</td>
                        <td>{emp.domain_name || '-'}</td>
                        <td>{[...new Set(emp.assignedAssets.map(a => a.type))].join(', ') || '-'}</td>
                        <td>
                          {emp.geolocation ? (
                            <a className="geolocation-link" href={getGeolocationMapUrl(emp.geolocation)} target="_blank" rel="noreferrer">
                              {emp.geolocation}
                            </a>
                          ) : '-'}
                        </td>
                        <td><span className="count-pill">{emp.assignedCount}</span></td>
                        <td>{emp.latestAllocatedAt ? emp.latestAllocatedAt.toLocaleString() : '-'}</td>
                        <td>
                          <div className="assignment-row-actions">
                            <button type="button" className="small assignment-view-btn" onClick={() => setSelectedEmployeeId(emp.id)}>View</button>
                            {hasAdminPermission('assignments.manage') && emp.assignedCount > 0 && (
                              <>
                                <button type="button" className="small assignment-assign-btn" onClick={() => startQuickAssignForEmployee(emp.id)}>Replace</button>
                                <button type="button" className="small assignment-return-btn" onClick={() => startReturnForEmployee(emp.id)}>Return</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignmentTotalPages > 1 && (
                  <div className="inventory-pager">
                    <span>
                      Page {assignmentPage} of {assignmentTotalPages} | Showing {paginatedEmployeeDirectory.length} of {employeeDirectory.length} items
                      <select 
                        value={assignmentPageSize} 
                        onChange={(e) => setAssignmentPageSize(e.target.value)}
                        style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                      >
                        <option value="10">10 per page</option>
                        <option value="25">25 per page</option>
                        <option value="50">50 per page</option>
                        <option value="all">Show All</option>
                      </select>
                    </span>
                    <div className="inventory-pager-actions">
                      <button type="button" className="outline" disabled={assignmentPage <= 1} onClick={() => setAssignmentPage((p) => Math.max(1, p - 1))}>Prev</button>
                      <button type="button" className="outline" disabled={assignmentPage >= assignmentTotalPages} onClick={() => setAssignmentPage((p) => Math.min(assignmentTotalPages, p + 1))}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {section === 'accounts' && (
          <section className="panel wide account-management-panel">
            {isSuperAdmin && (
              <div className="account-tabs account-tabs-top">
                <button
                  type="button"
                  className={accountManagementTab === 'roles' ? 'active' : ''}
                  onClick={() => setAccountManagementTab('roles')}
                >
                  Role Accounts
                </button>
                <button
                  type="button"
                  className={accountManagementTab === 'domains' ? 'active' : ''}
                  onClick={() => setAccountManagementTab('domains')}
                >
                  Domain / Location Management
                </button>
              </div>
            )}

            {/* â”€â”€ Hero Banner â”€â”€ */}
            <div className="acct-hero-banner">
              <div className="acct-hero-glow acct-hero-glow-1" />
              <div className="acct-hero-glow acct-hero-glow-2" />
              <div className="acct-hero-inner">
                <div className="acct-hero-text">
                  <div className="acct-hero-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                    Admin Console
                  </div>
                  <h2 className="acct-hero-title">{accountManagementTab === 'domains' ? 'Domain / Location Management' : 'Account Management'}</h2>
                  <p className="acct-hero-sub">
                    {accountManagementTab === 'domains'
                      ? 'Central control for branch details, admins, assets, employees, and pending approvals.'
                      : 'Control admin access, permissions, and account lifecycle from one place.'}
                  </p>
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className="acct-hero-cta"
                    onClick={() => (accountManagementTab === 'domains' ? setCreateDomainPopupOpen(true) : setCreateAdminPopupOpen(true))}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    {accountManagementTab === 'domains' ? 'Create Domain' : 'Create Role Account'}
                  </button>
                )}
              </div>

              {/* â”€â”€ Metric Cards inside hero â”€â”€ */}
              <div className="acct-metric-row">
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>{accountManagementTab === 'domains' ? 'Total Domains' : 'Managed Domains'}</span>
                    <strong>{accountManagementTab === 'domains' ? domainDashboardStats.totalDomains : accountSummary.managedDomains}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-indigo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>{accountManagementTab === 'domains' ? 'Active Locations' : 'Total Role Accounts'}</span>
                    <strong>{accountManagementTab === 'domains' ? domainDashboardStats.activeLocations : accountSummary.totalRoleAccounts}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-emerald">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>{accountManagementTab === 'domains' ? 'IT Assets' : 'Full Access'}</span>
                    <strong>{accountManagementTab === 'domains' ? domainDashboardStats.totalAssets : accountSummary.fullyPrivileged}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-amber">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>{accountManagementTab === 'domains' ? 'Employees' : 'Avg Permissions'}</span>
                    <strong>{accountManagementTab === 'domains' ? domainDashboardStats.employees : accountSummary.avgPermissions}</strong>
                  </div>
                </div>
                <div className="acct-metric-card">
                  <div className="acct-metric-icon acct-icon-rose">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  </div>
                  <div className="acct-metric-body">
                    <span>{accountManagementTab === 'domains' ? 'Pending Bills' : 'Max Permissions'}</span>
                    <strong>{accountManagementTab === 'domains' ? domainDashboardStats.pendingBills : accountSummary.maxPermissions}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Content â”€â”€ */}

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
              <>
              {accountManagementTab === 'roles' && (
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
                      placeholder="Search by name or emailâ€¦"
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
                                    {hasFullAccess ? 'âœ¦ Full Access' : 'Limited'}
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

              {accountManagementTab === 'domains' && (
                <section className="domain-location-panel domain-location-panel-compact">
                  <div className="domain-location-head">
                    <div>
                      <h4>Domain / Location Management</h4>
                      <p>Central control for branch details, admins, assets, employees, and pending approvals.</p>
                    </div>
                    <button type="button" className="small" onClick={() => setCreateDomainPopupOpen(true)}>Create Domain</button>
                  </div>

                  <div className="domain-dashboard-grid">
                    <article><span>Total Domains</span><strong>{domainDashboardStats.totalDomains}</strong></article>
                    <article><span>Active Locations</span><strong>{domainDashboardStats.activeLocations}</strong></article>
                    <article><span>IT Assets</span><strong>{domainDashboardStats.totalAssets}</strong></article>
                    <article><span>Domain Admins</span><strong>{domainDashboardStats.domainAdmins}</strong></article>
                    <article><span>Employees</span><strong>{domainDashboardStats.employees}</strong></article>
                    <article><span>Open IT Tickets</span><strong>{domainDashboardStats.openTickets}</strong></article>
                    <article><span>Unassigned Assets</span><strong>{domainDashboardStats.unassignedAssets}</strong></article>
                    <article><span>Pending Bills</span><strong>{domainDashboardStats.pendingBills}</strong></article>
                  </div>

                  <div className="domain-master-table-wrap">
                    <table className="domain-master-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Location</th>
                          <th>Type</th>
                          <th>City</th>
                          <th>Primary Admin</th>
                          <th>Backup Admin</th>
                          <th>Prefix</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domainManagementRows.length === 0 ? (
                          <tr><td colSpan={9} className="acct-empty-row">No domains found.</td></tr>
                        ) : (
                          domainManagementRows.map((domain) => (
                            <tr key={domain.name}>
                              <td>{domain.code || '-'}</td>
                              <td>
                                <strong>{domain.name}</strong>
                                <small>{domain.address || '-'}</small>
                              </td>
                              <td>{domain.branch_type || '-'}</td>
                              <td>{domain.city || '-'}</td>
                              <td>{domain.primary_admin_name || '-'}</td>
                              <td>{domain.backup_admin_name || '-'}</td>
                              <td>{domain.employee_code_prefix || '-'}</td>
                              <td><span className={`domain-status-pill status-${domain.status || 'active'}`}>{domain.status || 'active'}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="domain-delete-btn"
                                  disabled={domain.name === 'global'}
                                  onClick={() => deleteDomain(domain.name)}
                                  title={domain.name === 'global' ? 'Global domain cannot be deleted' : `Delete ${domain.name}`}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              </>
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
                  <label className="account-field">
                    <span>Account Name</span>
                    <input
                      placeholder="e.g. Zapto Admin"
                      value={adminCreateForm.name}
                      onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="account-field">
                    <span>Email / Login ID</span>
                    <input
                      type="email"
                      placeholder="e.g. zapto@gmail.com"
                      value={adminCreateForm.email}
                      onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                <label className="account-field">
                  <span>Password</span>
                  <input
                    type="text"
                    placeholder="Default: password"
                    value={adminCreateForm.password}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </label>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Role</span>
                    <input
                      type="text"
                      placeholder="e.g. admin, manager"
                      value={adminCreateForm.role}
                      onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="account-field">
                    <span>Domain</span>
                    <input
                      type="text"
                      placeholder="e.g. finance"
                      value={adminCreateForm.domain_name}
                      onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, domain_name: e.target.value.toLowerCase() }))}
                      required
                    />
                  </label>
                </div>
                <label className="account-field">
                  <span>Employee Code Prefix</span>
                  <input
                    type="text"
                    placeholder="e.g. fch"
                    value={adminCreateForm.employee_code_prefix}
                    onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, employee_code_prefix: e.target.value.toLowerCase() }))}
                  />
                </label>
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

        {createDomainPopupOpen && (
          <div className="account-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="create-domain-title" onClick={() => setCreateDomainPopupOpen(false)}>
            <section className="account-permission-modal domain-create-modal" onClick={(e) => e.stopPropagation()}>
              <header className="account-permission-header">
                <div>
                  <h3 id="create-domain-title">Create Domain / Location</h3>
                  <p>Add branch identity, address, admins, status, and employee code prefix.</p>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="small outline" onClick={() => setCreateDomainPopupOpen(false)}>Close</button>
                </div>
              </header>
              <form className="form account-create-form domain-create-form" onSubmit={createDomain}>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Location Code</span>
                    <input
                      placeholder="e.g. DEL-HO"
                      value={domainCreateForm.code}
                      onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </label>
                  <label className="account-field">
                    <span>Domain Name</span>
                    <input
                      placeholder="e.g. Delhi Head Office"
                      value={domainCreateForm.name}
                      onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Branch Type</span>
                    <select
                      value={domainCreateForm.branch_type}
                      onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, branch_type: e.target.value }))}
                    >
                      <option value="Head Office">Head Office</option>
                      <option value="Branch">Branch</option>
                      <option value="Tech Center">Tech Center</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Remote Hub">Remote Hub</option>
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Status</span>
                    <select
                      value={domainCreateForm.status}
                      onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </label>
                </div>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Country</span>
                    <input value={domainCreateForm.country} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, country: e.target.value }))} />
                  </label>
                  <label className="account-field">
                    <span>State</span>
                    <input placeholder="e.g. Delhi" value={domainCreateForm.state} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, state: e.target.value }))} />
                  </label>
                </div>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>City</span>
                    <input placeholder="e.g. New Delhi" value={domainCreateForm.city} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, city: e.target.value }))} required />
                  </label>
                  <label className="account-field">
                    <span>Pincode</span>
                    <input placeholder="e.g. 110001" value={domainCreateForm.pincode} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, pincode: e.target.value }))} />
                  </label>
                </div>
                <label className="account-field">
                  <span>Full Address</span>
                  <input placeholder="Office address" value={domainCreateForm.address} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, address: e.target.value }))} />
                </label>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Latitude</span>
                    <input placeholder="28.6139" value={domainCreateForm.latitude} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, latitude: e.target.value }))} />
                  </label>
                  <label className="account-field">
                    <span>Longitude</span>
                    <input placeholder="77.2090" value={domainCreateForm.longitude} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, longitude: e.target.value }))} />
                  </label>
                </div>
                <div className="account-form-row">
                  <label className="account-field">
                    <span>Primary Admin</span>
                    <select value={domainCreateForm.primary_admin_id} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, primary_admin_id: e.target.value }))}>
                      <option value="">Select admin</option>
                      {adminSelectOptions.map((admin) => <option key={admin.value} value={admin.value}>{admin.label}</option>)}
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Backup Admin</span>
                    <select value={domainCreateForm.backup_admin_id} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, backup_admin_id: e.target.value }))}>
                      <option value="">Select backup admin</option>
                      {adminSelectOptions.map((admin) => <option key={admin.value} value={admin.value}>{admin.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="account-field">
                  <span>Employee Code Prefix</span>
                  <input placeholder="e.g. del" value={domainCreateForm.employee_code_prefix} onChange={(e) => setDomainCreateForm((prev) => ({ ...prev, employee_code_prefix: e.target.value.toLowerCase() }))} />
                </label>
                <div className="employee-edit-actions">
                  <button type="submit" className="small">Create Domain</button>
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
                <label className="account-field">
                  <span>Account Name</span>
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
                </label>
                <label className="account-field">
                  <span>Email / Login ID</span>
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
                </label>
              </div>
              <div className="account-form-row">
                <label className="account-field">
                  <span>Role</span>
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
                </label>
                <label className="account-field">
                  <span>Domain</span>
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
                </label>
              </div>
              <label className="account-field">
                <span>Employee Code Prefix</span>
                <input
                  placeholder="e.g. fch"
                  value={adminDetailDrafts[selectedAdminPermissionUser.id]?.employee_code_prefix || ''}
                  onChange={(e) => setAdminDetailDrafts((prev) => ({
                    ...prev,
                    [selectedAdminPermissionUser.id]: {
                      ...(prev[selectedAdminPermissionUser.id] || {}),
                      employee_code_prefix: e.target.value.toLowerCase()
                    }
                  }))}
                />
              </label>
              <label className="account-field">
                <span>Password</span>
                <input
                  type="text"
                  readOnly
                  value={roleAccountPasswords[selectedAdminPermissionUser.id] || 'Not available for older accounts'}
                />
              </label>

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
                <EmployeePhoto employee={selectedEmployee} variant="modal" />
                <div className="employee-modal-headcopy">
                  <div className="employee-modal-title-row">
                    <h3 id="employee-view-title">{selectedEmployee.name}</h3>
                    <div className="employee-modal-actions">
                      <button type="button" className="small outline" onClick={printEmployeeDetails}>Print</button>
                      {hasAdminPermission('assignments.manage') && selectedEmployee.local_user_id && (
                        <button type="button" className="small outline" onClick={() => setIsEditingEmployee((v) => !v)}>{isEditingEmployee ? 'Cancel Edit' : 'Edit'}</button>
                      )}
                      <button type="button" className="small outline" onClick={() => setSelectedEmployeeId(null)}>Close</button>
                    </div>
                  </div>
                  <p>{selectedEmployee.email || '-'} | {selectedEmployee.role || 'user'} | Employee ID #{selectedEmployee.id}</p>
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
                  <h4>Employee Details</h4>
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
                      <div><label>Mobile</label><p>{selectedEmployee.personal_mobile_no || '-'}</p></div>

                      <div><label>Domain</label><p>{selectedEmployee.domain_name || '-'}</p></div>
                      <div><label>Code</label><p>{selectedEmployee.employee_code || '-'}</p></div>
                      <div><label>Department</label><p>{selectedEmployee.department || '-'}</p></div>
                      <div><label>Designation</label><p>{selectedEmployee.designation || '-'}</p></div>
                      <div><label>Location</label><p>{selectedEmployee.location || '-'}</p></div>
                      <div><label>DOJ</label><p>{selectedEmployee.date_of_joining || '-'}</p></div>

                      <div><label>Gender</label><p>{selectedEmployee.gender || '-'}</p></div>
                      <div><label>Status</label><p>{selectedEmployee.employment_status || '-'}</p></div>

                      <div><label>Last Note</label><p>{selectedEmployeeLatestNote}</p></div>
                    </div>
                  )}
                </section>
              </div>

              <section className="employee-modal-assets">
                <h4>Assigned Assets</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Asset</th><th>Type</th><th>Serial</th><th>Assigned At</th><th>Assigned By</th><th>Notes</th><th>QR</th></tr></thead>
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
                            <td>{asset.assignedBy || '-'}</td>
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="employee-modal-assets">
                <h4>Allocation History</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Asset</th><th>Type</th><th>Serial</th><th>Allocated At</th><th>Returned At</th><th>Status</th><th>Reason/Notes</th><th>Assigned By</th></tr></thead>
                    <tbody>
                      {selectedEmployeeHistory.length === 0 ? (
                        <tr><td colSpan={8}>No history found.</td></tr>
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
                            <td>{item.assignedBy || '-'}</td>
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

        {returnForm.allocationId && (
          <div className="employee-modal-overlay return-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="return-modal-title" onClick={closeReturnAssetDialog}>
            <section className="employee-modal return-modal" onClick={(e) => e.stopPropagation()}>
              <header className="replacement-modal-head">
                <div>
                  <h3 id="return-modal-title">Return Asset</h3>
                  <p>{returnForm.assetName || '-'} | {returnForm.serial || '-'}</p>
                </div>
                <button type="button" className="small outline" onClick={closeReturnAssetDialog}>Close</button>
              </header>
              <form className="return-reason-form" onSubmit={submitReturnAsset}>
                <label>
                  <span>Reason</span>
                  <select
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                  >
                    <option value="Damaged">Damaged</option>
                    <option value="Not Working">Not Working</option>
                    <option value="User Leaving">User Leaving</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  <span>Notes</span>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={returnForm.reason === 'Other' ? 'Type return reason detail' : 'Return notes...'}
                    rows={3}
                  />
                </label>
                <div className="return-reason-actions">
                  <button type="submit" className="small">Return Asset</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedReplacementEmployee && (
          <div className="employee-modal-overlay replacement-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="replacement-modal-title" onClick={() => setSelectedReplacementEmployeeId(null)}>
            <section className="employee-modal replacement-modal" onClick={(e) => e.stopPropagation()}>
              <header className="replacement-modal-head">
                <div>
                  <h3 id="replacement-modal-title">Replace Assigned Asset</h3>
                  <p>{selectedReplacementEmployee.name || '-'} | {selectedReplacementEmployee.employee_code || '-'} | {selectedReplacementEmployee.domain_name || '-'}</p>
                </div>
              </header>
              <form className="replacement-form" onSubmit={replaceEmployeeAsset}>
                <label className="replacement-current-field">
                  <span>Current Assigned Asset</span>
                  <select
                    value={replacementForm.allocationId}
                    onChange={(e) => setReplacementForm((prev) => ({ ...prev, allocationId: e.target.value }))}
                    required
                  >
                    <option value="">Select active allocation</option>
                    {selectedReplacementEmployee.assignedAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.assetName} ({asset.serial})</option>
                    ))}
                  </select>
                </label>
                <label className="replacement-type-field">
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
                <label className="replacement-asset-field">
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
                <label className="replacement-reason-field">
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
                <label className="replacement-wide">
                  <span>Reason Detail</span>
                  <input
                    value={replacementForm.reasonDetail}
                    onChange={(e) => setReplacementForm((prev) => ({ ...prev, reasonDetail: e.target.value }))}
                    placeholder="Select Other to type reason detail"
                    disabled={replacementForm.reason !== 'Other'}
                    required={replacementForm.reason === 'Other'}
                  />
                </label>
                <div className="employee-edit-actions replacement-actions">
                  <button type="button" className="small outline" onClick={() => setSelectedReplacementEmployeeId(null)}>Cancel</button>
                  <button type="submit" className="small">Replace Asset</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedEmployeeReturnId && (
          <div className="employee-modal-overlay return-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="employee-return-modal-title" onClick={() => setSelectedEmployeeReturnId(null)}>
            <section className="employee-modal replacement-modal" onClick={(e) => e.stopPropagation()}>
              <header className="replacement-modal-head">
                <div>
                  <h3 id="employee-return-modal-title">Return Assigned Asset</h3>
                  <p>{employeeDirectory.find((emp) => String(emp.id) === String(selectedEmployeeReturnId))?.name || '-'} | {employeeDirectory.find((emp) => String(emp.id) === String(selectedEmployeeReturnId))?.employee_code || '-'}</p>
                </div>
              </header>
              <form className="replacement-form" onSubmit={submitEmployeeReturnAsset}>
                <label className="replacement-current-field">
                  <span>Current Assigned Asset</span>
                  <select
                    value={employeeReturnForm.allocationId}
                    onChange={(e) => setEmployeeReturnForm((prev) => ({ ...prev, allocationId: e.target.value }))}
                    required
                  >
                    <option value="">Select active allocation</option>
                    {(employeeDirectory.find((emp) => String(emp.id) === String(selectedEmployeeReturnId))?.assignedAssets || []).map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.assetName} ({asset.serial})</option>
                    ))}
                  </select>
                </label>
                <label className="replacement-reason-field">
                  <span>Reason</span>
                  <select
                    value={employeeReturnForm.reason}
                    onChange={(e) => setEmployeeReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                    required
                  >
                    <option value="Damaged">Damaged Product</option>
                    <option value="Not Working">Not Working Product</option>
                    <option value="User Leaving">User Leaving</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="replacement-wide">
                  <span>Reason Detail</span>
                  <input
                    value={employeeReturnForm.notes}
                    onChange={(e) => setEmployeeReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Type return reason detail"
                    disabled={employeeReturnForm.reason !== 'Other'}
                    required={employeeReturnForm.reason === 'Other'}
                  />
                </label>
                <div className="employee-edit-actions replacement-actions">
                  <button type="button" className="small outline" onClick={() => setSelectedEmployeeReturnId(null)}>Cancel</button>
                  <button type="submit" className="small">Return Asset</button>
                </div>
              </form>
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
              <div className="panel-head"><h3>Recent Allocation Events</h3><span>Latest 12</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Asset</th><th>Employee</th><th>Event Time</th><th>Action</th></tr></thead>
                  <tbody>
                    {recentActivity.map((a) => (
                      <tr key={a.id}>
                        <td>{a.assetName}</td>
                        <td>
                          <strong>{a.userName}</strong>
                          <small className="table-subtext">
                            {[a.employeeCode, a.employeeEmail].filter(Boolean).join(' | ') || '-'}
                          </small>
                        </td>
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
            <section className="expense-hero">
              <div className="expense-nav-pills" aria-label="Invoice tools">
                <button type="button" className="active" onClick={() => document.querySelector('.expense-filter-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View All Bills</button>
                <button type="button" onClick={() => document.querySelector('.invoice-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Add Bill</button>
              </div>
              <div>
                <p className="expense-eyebrow">Tracker Bill-Invoice Payment Record All</p>
                <h3>My Bills</h3>
              </div>
            </section>

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
                    <SearchableSelect
                      value={invoiceForm.vendor}
                      onChange={(value) => setInvoiceForm((prev) => ({ ...prev, vendor: value }))}
                      options={invoiceVendorDropdownOptions}
                      placeholder="Select bill description"
                      searchPlaceholder="Search or type vendor..."
                      emptyMessage="No vendor found"
                      allowCreate
                      createLabel="Add vendor"
                      selectedLabel={invoiceForm.vendor}
                      onCreate={(value) => setInvoiceForm((prev) => ({ ...prev, vendor: value }))}
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
                    <SearchableSelect
                      value={invoiceForm.category}
                      onChange={(nextCategory) => {
                        setInvoiceForm((prev) => ({
                          ...prev,
                          category: nextCategory,
                          subcategory: INVOICE_SUBCATEGORIES_BY_CATEGORY[nextCategory]?.[0] || ''
                        }));
                      }}
                      options={invoiceCategoryDropdownOptions}
                      placeholder="Select category"
                      searchPlaceholder="Search or type category..."
                      emptyMessage="No category found"
                      allowCreate
                      createLabel="Add category"
                      selectedLabel={invoiceForm.category}
                      onCreate={(nextCategory) => {
                        setInvoiceForm((prev) => ({
                          ...prev,
                          category: nextCategory,
                          subcategory: ''
                        }));
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Subcategory</span>
                    <SearchableSelect
                      value={invoiceForm.subcategory}
                      onChange={(value) => setInvoiceForm((prev) => ({ ...prev, subcategory: value }))}
                      options={invoiceFormSubcategoryDropdownOptions}
                      placeholder="Select subcategory"
                      searchPlaceholder="Search or type subcategory..."
                      emptyMessage="No subcategory found"
                      allowCreate
                      createLabel="Add subcategory"
                      selectedLabel={invoiceForm.subcategory}
                      onCreate={(value) => setInvoiceForm((prev) => ({ ...prev, subcategory: value }))}
                    />
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
                    <span>Approval</span>
                    <SearchableSelect
                      value={invoiceForm.approvalAssignee}
                      onChange={(value) => setInvoiceForm((prev) => ({ ...prev, approvalAssignee: value }))}
                      options={invoiceApproverDropdownOptions}
                      placeholder="Approver name"
                      searchPlaceholder="Search or type approver name..."
                      emptyMessage="No approver found"
                      allowCreate
                      createLabel="Add approver"
                      selectedLabel={invoiceForm.approvalAssignee}
                      onCreate={(value) => setInvoiceForm((prev) => ({ ...prev, approvalAssignee: value }))}
                    />
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
                        setInvoiceForm((prev) => {
                          const hadInvoiceFile = !!(prev.invoiceFileData || prev.invoiceFileName);
                          setMessage(hadInvoiceFile ? 'Invoice changed successfully.' : 'Invoice uploaded successfully.');
                          return { ...prev, ...filePayload };
                        });
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

            <section className="expense-summary-row">
              <article><span>Total</span><strong>{formatCurrency(filteredInvoiceStats.totalAmount)}</strong></article>
              <article><span>Count</span><strong>{filteredInvoiceStats.count}</strong></article>
              <article><span>Paid</span><strong>{filteredInvoiceStats.paid}</strong></article>
              <article><span>With Bills</span><strong>{filteredInvoiceStats.withBills}</strong></article>
            </section>

            <section className="invoice-workflow-card">
              <div className="panel-head">
                <h3>Bill Approval Workflow</h3>
                <span>{invoiceStats.pendingApproval} pending approval | {invoiceStats.rejected} rejected</span>
              </div>
              <div className="invoice-workflow-steps">
                {INVOICE_APPROVAL_STAGES.map((stage, index) => (
                  <article key={stage.key}>
                    <small>{stage.helper}</small>
                    <strong>{stage.label}</strong>
                    {index < INVOICE_APPROVAL_STAGES.length - 1 && <span className="workflow-arrow">-&gt;</span>}
                  </article>
                ))}
              </div>
            </section>

            <section className="invoice-layout">
              <section className="expense-filter-card">
                <div className="panel-head">
                  <h3>Filters</h3>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      setInvoiceVendorFilter('all');
                      setInvoiceStatusFilter('all');
                      setInvoiceCategoryFilter('all');
                      setInvoiceSubcategoryFilter('all');
                      setInvoiceDateFilter('all');
                      setInvoiceQuery('');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
                <div className="expense-filter-grid">
                  <label>
                    <span>Brand / Vendor</span>
                    <select value={invoiceVendorFilter} onChange={(e) => setInvoiceVendorFilter(e.target.value)}>
                      <option value="all">All</option>
                      {invoiceVendorOptions.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value)}>
                      <option value="all">All</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label>
                    <span>Category</span>
                    <select
                      value={invoiceCategoryFilter}
                      onChange={(e) => {
                        setInvoiceCategoryFilter(e.target.value);
                        setInvoiceSubcategoryFilter('all');
                      }}
                    >
                      <option value="all">All</option>
                      {invoiceCategoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Subcategory</span>
                    <select value={invoiceSubcategoryFilter} onChange={(e) => setInvoiceSubcategoryFilter(e.target.value)}>
                      <option value="all">All</option>
                      {invoiceSubcategoryOptions.map((subcategory) => (
                        <option key={subcategory} value={subcategory}>{subcategory}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Date Range</span>
                    <select value={invoiceDateFilter} onChange={(e) => setInvoiceDateFilter(e.target.value)}>
                      <option value="all">All Time</option>
                      <option value="this_month">This Month</option>
                      <option value="last_30">Last 30 Days</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </label>
                </div>
                <input
                  className="expense-wide-search"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="Search vendor, bill number, category, subcategory, approval..."
                />
              </section>

              <section className="inventory-table-shell invoice-table-card">
                <div className="expense-record-head">
                  <div>
                    <h3>Detailed Bill Records</h3>
                    <p>{filteredInvoices.length} records matched</p>
                  </div>
                  <span>{formatCurrency(filteredInvoiceStats.totalAmount)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill No</th>
                        <th>Vendor</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.length === 0 && (
                        <tr><td colSpan={5}>No bill details saved yet.</td></tr>
                      )}
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.billNo}</td>
                          <td><span className="invoice-two-line" title={invoice.vendor}>{invoice.vendor}</span></td>
                          <td>{formatCurrency(invoice.amount)}</td>
                          <td>{invoice.dueDate || '-'}</td>
                          <td>
                            <div className="invoice-status-actions">
                              <span className={`status invoice-status ${invoice.status}`}>{invoice.status}</span>
                              <button type="button" className="small" onClick={() => setInvoiceDetail(invoice)}>View</button>
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
                    ? `${activitySummary.latestEvent.action} â€¢ ${activitySummary.latestEvent.assetName}`
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
                        <small>{new Date(a.timestampMs).toLocaleString()} â€¢ Allocation #{a.allocationId}</small>
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

        {selectedInvoiceDetail && (
          (() => {
            const invoice = selectedInvoiceDetail;
            const approval = getInvoiceApproval(invoice);
            const canApproveHead = approval.statusKey === 'pending_head'
              && canUseInvoiceApprovalAction(
                invoice,
                hasInvoiceHeadApprovalAccess(),
                isSuperAdmin || (String(user?.role || '').trim().toLowerCase() === 'admin' && isZaptoRaisedInvoice(invoice))
              );
            const canApproveAccounts = approval.statusKey === 'pending_accounts'
              && canUseInvoiceApprovalAction(invoice, hasInvoiceAccountsApprovalAccess(), isSuperAdmin);
            const canApprove = (canApproveHead || canApproveAccounts) && !hasApprovalForCurrentStage(invoice);
            const needsResubmit = ['rejected', 'correction'].includes(approval.statusKey);
            const canAttachPaidProof = ['pending_accounts', 'payment_pending', 'completed'].includes(approval.statusKey)
              && canUseInvoiceApprovalAction(invoice, hasInvoiceAccountsApprovalAccess(), isSuperAdmin);
            const canUpdatePaymentStatus = approval.stageKey === 'payment'
              && canUseInvoiceApprovalAction(invoice, hasInvoiceAccountsApprovalAccess(), isSuperAdmin);
            const isAccountantUser = !isSuperAdmin && hasInvoiceAccountsApprovalAccess();
            const canShowPaidProofUpload = isAccountantUser || canAttachPaidProof;
            const hasPaidProof = !!(invoice.paidBillScreenshotData || invoice.paidBillScreenshotName);
            const approvalHistory = Array.isArray(invoice.approvalHistory) ? invoice.approvalHistory : [];
            return (
              <div className="invoice-detail-overlay" role="dialog" aria-modal="true" aria-label="Invoice details">
                <div className="invoice-detail-modal">
                  <div className="invoice-detail-hero">
                    <div>
                      <h3>{invoice.billNo || 'Bill Details'}</h3>
                      <p>{invoice.vendor || '-'} | {formatCurrency(invoice.amount)}</p>
                      <div className="employee-modal-pill-row">
                        <span className={`status invoice-status ${invoice.status}`}>{invoice.status}</span>
                        <span className={`invoice-approval-badge approval-${approval.statusKey}`}>{approval.statusLabel}</span>
                        <span className="soft-pill">Stage: {approval.stageLabel}</span>
                      </div>
                    </div>
                    <div className="employee-modal-actions invoice-detail-actions">
                      <button type="button" onClick={() => showInvoice(invoice)}>Invoice</button>
                      <button type="button" className="outline" disabled={!hasPaidProof} onClick={() => showPaidBillScreenshot(invoice)}>Proof</button>
                      <button type="button" onClick={() => setInvoiceDetail(null)}>Close</button>
                    </div>
                  </div>

                  <div className="invoice-detail-grid">
                    <article><span>Bill No</span><strong>{invoice.billNo || '-'}</strong></article>
                    <article><span>Vendor</span><strong>{invoice.vendor || '-'}</strong></article>
                    <article><span>Amount</span><strong>{formatCurrency(invoice.amount)}</strong></article>
                    <article><span>Due Date</span><strong>{invoice.dueDate || '-'}</strong></article>
                    <article><span>Category</span><strong>{invoice.category || '-'}</strong></article>
                    <article><span>Subcategory</span><strong>{invoice.subcategory || '-'}</strong></article>
                    <article><span>Payment Status</span><strong>{invoice.status || '-'}</strong></article>
                    <article><span>Approver</span><strong>{invoice.approvalAssignee || '-'}</strong></article>
                  </div>

                  <div className="invoice-detail-panels">
                    <section>
                      <h4>Notes</h4>
                      <p>{invoice.notes || '-'}</p>
                      {invoice.rejectionReason && (
                        <p><strong>Rejection Reason:</strong> {invoice.rejectionReason}</p>
                      )}
                    </section>
                    <section>
                      <h4>Documents</h4>
                      <div className="invoice-document-list">
                        <span>Invoice: {invoice.invoiceFileName || (invoice.invoiceFileData ? 'Uploaded' : 'Not uploaded')}</span>
                        <span>Paid proof: {invoice.paidBillScreenshotName || (invoice.paidBillScreenshotData ? 'Uploaded' : 'Not uploaded')}</span>
                      </div>
                    </section>
                  </div>

                  <div className="invoice-detail-action-panel">
                    <h4>Actions</h4>
                    <div className="invoice-actions">
                      {canApprove && (
                        <>
                          <button type="button" className="small" onClick={() => updateInvoiceApproval(invoice.id, 'Approve')}>Approve</button>
                          <button type="button" className="small outline" onClick={() => updateInvoiceApproval(invoice.id, 'Reject')}>Reject</button>
                        </>
                      )}
                      {needsResubmit && (
                        <button type="button" className="small" onClick={() => updateInvoiceApproval(invoice.id, 'Resubmit')}>Resubmit</button>
                      )}
                      {!isAccountantUser && (
                        <label className="small invoice-action-upload">
                          <span>Upload Invoice</span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => updateInvoiceUpload(invoice.id, e.target.files?.[0])}
                          />
                        </label>
                      )}
                      {canShowPaidProofUpload && (
                        <label className="small invoice-action-upload">
                          <span>{invoice.paidBillScreenshotName ? 'Change Payment Proof' : 'Payment Proof'}</span>
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp"
                            onChange={(e) => updatePaidBillScreenshot(invoice.id, e.target.files?.[0])}
                          />
                        </label>
                      )}
                      {canUpdatePaymentStatus && (
                        <>
                          <button
                            type="button"
                            className="small"
                            onClick={() => updateInvoicePaymentStatus(invoice.id, 'paid')}
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            className="small outline"
                            onClick={() => updateInvoicePaymentStatus(invoice.id, 'unpaid')}
                          >
                            Mark Unpaid
                          </button>
                        </>
                      )}
                      {canDeleteInvoices() && (
                        <button
                          type="button"
                          className="small danger"
                          onClick={() => {
                            deleteInvoice(invoice.id);
                            setInvoiceDetail(null);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="employee-modal-assets invoice-detail-history">
                    <h4>Approval History</h4>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Action</th><th>Stage</th><th>Time</th><th>Reason</th></tr></thead>
                        <tbody>
                          {approvalHistory.length === 0 && (
                            <tr><td colSpan={4}>No approval history yet.</td></tr>
                          )}
                          {approvalHistory.map((entry, index) => (
                            <tr key={`${entry.action || 'entry'}-${index}`}>
                              <td>{entry.action || '-'}</td>
                              <td>{entry.stage || '-'}</td>
                              <td>{entry.at ? new Date(entry.at).toLocaleString() : '-'}</td>
                              <td>{entry.reason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
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

        {showLogoutDialog && (
          <div className="asset-delete-overlay" role="dialog" aria-modal="true" onClick={() => setShowLogoutDialog(false)}>
            <section className="asset-delete-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Logout</h3>
              <p>Are you sure you want to log out of your account?</p>
              <div className="asset-delete-actions">
                <button type="button" className="outline" onClick={() => setShowLogoutDialog(false)}>Cancel</button>
                <button type="button" className="outline" onClick={logout}>Logout</button>
              </div>
            </section>
          </div>
        )}

        {message && <div className="toast">{message}</div>}
      </div>
    </div>
  );
}

export default App;

