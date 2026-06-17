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
  { label: 'IT Manage', path: 'https://it-manage.vercel.app', external: true },
  { label: 'Visiting Cards', path: 'https://visiting-card-swart.vercel.app/', external: true },
  { label: 'HRMS', path: '#' }
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
