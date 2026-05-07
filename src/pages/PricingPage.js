import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/pricing',
  eyebrow: 'Pricing',
  title: 'Flexible plans for lean teams and global operators alike.',
  description:
    'Start with core inventory management and expand into automation, analytics, and enterprise controls as you grow.',
  stats: [
    { value: '$99', label: 'Starter tier' },
    { value: '$499', label: 'Enterprise tier' },
    { value: 'Custom', label: 'Global programs' }
  ],
  highlights: [
    'Simple monthly entry point',
    'Scale into advanced telemetry',
    'Custom SLAs for large deployments'
  ],
  sections: [
    {
      title: 'Transparent packaging',
      body: 'Choose based on operational maturity, then add support and governance capabilities as needed.'
    },
    {
      title: 'Enterprise alignment',
      body: 'Custom plans cover multi-entity operations, onboarding support, and complex rollout needs.'
    }
  ]
};

const PricingPage = (props) => <MarketingPage {...props} page={page} />;

export default PricingPage;
