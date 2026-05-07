import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/platform/global-fleet',
  eyebrow: 'Global Fleet',
  title: 'Coordinate remote hardware operations across cities and countries.',
  description:
    'Give IT, procurement, and people ops one shared system for fulfillment, swaps, returns, and vendor coordination.',
  stats: [
    { value: '15+', label: 'Country workflows' },
    { value: '3x faster', label: 'Replacement cycles' },
    { value: '1 hub', label: 'For vendors and teams' }
  ],
  highlights: [
    'Multi-location inventory control',
    'Cross-border replacement planning',
    'Vendor and store coordination'
  ],
  sections: [
    {
      title: 'Distributed logistics',
      body: 'Handle dispatch, collection, spares, and swaps while keeping asset status synchronized centrally.'
    },
    {
      title: 'Local execution, central governance',
      body: 'Regional teams can move quickly while global admins preserve policy consistency and reporting.'
    }
  ]
};

const GlobalFleetPage = (props) => <MarketingPage {...props} page={page} />;

export default GlobalFleetPage;
