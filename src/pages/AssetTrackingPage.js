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
  ],
  customPanel: (
    <section className="lp-page-section lp-project-links">
      <div className="section-header">
        <label>Live Projects</label>
        <h2>Explore real deployments</h2>
      </div>
      <div className="lp-page-grid">
        <article className="lp-feature-card lp-page-card">
          <h3>IT Manage</h3>
          <p>Visit the live IT Manage deployment for the full platform experience.</p>
          <a
            className="btn-secondary"
            href="https://it-manage.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open IT Manage
          </a>
        </article>
        <article className="lp-feature-card lp-page-card">
          <h3>Visiting Cards</h3>
          <p>Check out the visiting card project deployed on Vercel.</p>
          <a
            className="btn-secondary"
            href="https://visiting-card-swart.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Visiting Cards
          </a>
        </article>
      </div>
    </section>
  )
};

const AssetTrackingPage = (props) => <MarketingPage {...props} page={page} />;

export default AssetTrackingPage;
