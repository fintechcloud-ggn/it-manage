import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/platform/asset-tracking',
  eyebrow: 'Asset Tracking',
  title: 'Track every device from purchase order to retirement.',
  description:
    'Maintain a clean source of truth for ownership, location, hardware condition, and financial lifecycle across your fleet.',
  stats: [
    { value: '100%', label: 'Serial traceability' },
    { value: '24/7', label: 'Status visibility' },
    { value: '0 guesswork', label: 'During audits' }
  ],
  highlights: [
    'Barcode and serial-based lookup',
    'Warranty and depreciation monitoring',
    'Assignment history with timestamps'
  ],
  sections: [
    {
      title: 'Precise ownership history',
      body: 'Track who used an asset, when it moved, and why it changed status with full historical context.'
    },
    {
      title: 'Financial lifecycle insight',
      body: 'Map capex decisions to depreciation, replacement windows, and return planning.'
    }
  ]
};

const AssetTrackingPage = (props) => <MarketingPage {...props} page={page} />;

export default AssetTrackingPage;
