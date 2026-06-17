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

const GlobalFleetPage = (props) => <MarketingPage {...props} page={page} />;

export default GlobalFleetPage;
