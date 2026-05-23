import React from 'react';
import MarketingPage from '../components/MarketingPage';

const officeAddress = '296, Phase-IV, Udyog Vihar, Gurgaon, Haryana, 122015';
const mapsQuery = encodeURIComponent(officeAddress);
const mapsUrl = `https://www.google.com/maps?q=${mapsQuery}`;
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

const page = {
  path: '/contact',
  eyebrow: 'Contact Us',
  title: 'Talk to the NEXTGEN office team.',
  description:
    'Reach the team for IT inventory support, account assistance, and office visits at our Gurgaon location.',
  stats: [
    { value: '+91 00000 00000', label: 'Mobile number' },
    { value: 'info@nextgenrentals.in', label: 'Email address' },
    { value: 'Gurgaon', label: 'Office location' }
  ],
  highlights: [
    'Office support for asset and account queries',
    'Email assistance for billing and operations',
    'Visit the Gurgaon office using the live map'
  ],
  heroVisual: (
    <img
      className="contact-agent-visual"
      src="/Agent2.jpg"
      alt="NEXTGEN office support agent"
    />
  ),
  customPanel: (
    <>
      <section className="contact-location-section">
        <div className="contact-location-card">
          <div className="contact-map-frame">
            <iframe
              title="NEXTGEN office location on Google Maps"
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="contact-location-info">
            <span>Locate Us</span>
            <h2>NEXTGEN Office</h2>
            <p>{officeAddress}</p>
            <a className="contact-locate-button" href={mapsUrl} target="_blank" rel="noreferrer">
              Locate Us
            </a>
            <a className="contact-route-button" href={directionsUrl} target="_blank" rel="noreferrer">
              Check Route
            </a>
          </div>
        </div>
      </section>
      <div className="contact-form-heading">
        <h2>Contact Us</h2>
      </div>
      <section className="contact-form-section">
        <div className="contact-form-card">
          <div className="contact-form-info">
            <h2>Let's build smarter IT operations together.</h2>
            <div>
              <h3>Our Office:</h3>
              <p>
                <strong>Gurgaon</strong>
                <span>{officeAddress}</span>
              </p>
            </div>
            <div>
              <h3>Email:</h3>
              <p>info@nextgenrentals.in</p>
            </div>
          </div>
          <form className="contact-form" action={`mailto:info@nextgenrentals.in`} method="post" encType="text/plain">
            <h2>Get In Touch</h2>
            <p>Drop your details and our team will connect with a solution tailored for your organization.</p>
            <div className="contact-form-row">
              <input type="text" name="name" placeholder="Your Name" aria-label="Your Name" required />
              <input type="email" name="email" placeholder="Your Email" aria-label="Your Email" required />
            </div>
            <input type="text" name="subject" placeholder="Subject" aria-label="Subject" required />
            <textarea name="message" placeholder="Message" aria-label="Message" rows="7" required />
            <button type="submit">Send Message</button>
          </form>
        </div>
      </section>
    </>
  ),
  sectionEyebrow: 'Office details',
  sectionTitle: 'Contact information',
  sections: [
    {
      title: 'Mobile',
      body: '+91 00000 00000'
    },
    {
      title: 'Email',
      body: 'info@nextgenrentals.in'
    },
    {
      title: 'Office address',
      body: officeAddress
    }
  ]
};

const ContactPage = (props) => <MarketingPage {...props} page={page} />;

export default ContactPage;
