export const MARKETING_HOME_PATH = '/';

export const HEADER_NAV_ITEMS = [
  { label: 'Platform', path: '/platform' },
  { label: 'Solutions', path: '/solutions' },
  { label: 'Enterprise', path: '/enterprise' },
  { label: 'Resources', path: '/resources' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Contact Us', path: '/contact' }
];

export const PLATFORM_DROPDOWN_ITEMS = [
  { label: 'Asset Tracking', path: '/platform/asset-tracking' },
  { label: 'Global Fleet', path: '/platform/global-fleet' },
  { label: 'Security Ops', path: '/platform/security-ops' }
];

export const MARKETING_PATHS = [
  '/platform',
  '/platform/asset-tracking',
  '/platform/global-fleet',
  '/platform/security-ops',
  '/solutions',
  '/enterprise',
  '/resources',
  '/pricing',
  '/contact'
];

export function normalizeMarketingPath(pathname) {
  const normalized = pathname && pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  return MARKETING_PATHS.includes(normalized) ? normalized : '/';
}
