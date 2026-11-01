import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LandingPageMarketing } from '../LandingPage';

describe('EduSphere marketing landing page', () => {
  it('renders its product headline, demo CTA, and public navigation without sign-up', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><LandingPageMarketing /></MemoryRouter>);

    expect(markup).toContain('One platform.');
    expect(markup).toContain('Every academic need.');
    expect(markup).toContain('Request a demo');
    expect(markup).toContain('Log in');
    expect(markup).not.toContain('Sign up');
  });
});
