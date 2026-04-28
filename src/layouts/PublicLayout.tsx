import { Heart, Images, Mail, MapPin, Menu, Palette, Phone, School2, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';
import { PublicSiteProvider, usePublicSite } from '../lib/public-site';
import { getWebsiteLogoScale } from '../lib/public-branding';
import { applySeo, getPublicSeo } from '../lib/seo';

const links = [
  { label: 'Home', to: '/', icon: Sparkles },
  { label: 'About', to: '/about', icon: Heart },
  { label: 'Programs', to: '/programs', icon: Palette },
  { label: 'Gallery', to: '/gallery', icon: Images },
];

export function PublicSiteScaffold({ children, logoScaleOverride }: { children: ReactNode; logoScaleOverride?: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { school, page, loading, error } = usePublicSite();
  const settings = (school?.settings ?? {}) as Record<string, unknown>;
  const address = page.footer_address || school?.address;
  const phone = page.footer_phone || school?.contact_phone;
  const email = page.footer_email || school?.contact_email;
  const currentYear = new Date().getFullYear();
  const websiteLogoScale = typeof logoScaleOverride === 'number' ? logoScaleOverride : getWebsiteLogoScale(settings);
  const headerLogoHeight = Math.round(56 * websiteLogoScale / 100);
  const headerLogoMaxWidth = Math.round(220 * websiteLogoScale / 100);
  const footerLogoHeight = Math.round(72 * websiteLogoScale / 100);
  const footerLogoMaxWidth = Math.round(260 * websiteLogoScale / 100);

  useEffect(() => {
    const routeSeo = getPublicSeo(location.pathname);
    applySeo({
      ...routeSeo,
      path: routeSeo.path ?? location.pathname,
    });
  }, [location.pathname, page, school?.name]);

  if (loading) {
    return <LoadingScreen showText={false} tone="plain" />;
  }

  return (
    <div className="public-kids-theme min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="kids-orb kids-orb-one" />
        <div className="kids-orb kids-orb-two" />
        <div className="kids-orb kids-orb-three" />
        <div className="kids-orb kids-orb-four" />
      </div>

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="kids-cloud-panel kids-site-header mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <NavLink aria-label={school?.name ?? 'School Website'} className="flex min-w-0 items-center gap-3" to="/">
            {school?.logo_url ? (
              <img
                alt={school.name}
                className="w-auto shrink-0 object-contain"
                decoding="async"
                loading="eager"
                src={school.logo_url}
                style={{ height: `${headerLogoHeight}px`, maxWidth: `${headerLogoMaxWidth}px` }}
              />
            ) : (
              <div className="theme-icon-gradient flex h-14 w-14 items-center justify-center rounded-[1.6rem]">
                <School2 className="h-6 w-6" />
              </div>
            )}
          </NavLink>

          <nav className="hidden items-center gap-2 lg:flex">
            {links.map((item) => (
              <NavLink key={item.to} className={({ isActive }) => `kids-nav-link ${isActive ? 'theme-nav-active' : ''}`} end={item.to === '/'} to={item.to}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <NavLink className="button-primary !rounded-full !px-5" to="/login">
              Login
            </NavLink>
          </div>

          <button className="button-secondary !rounded-full !p-3 !text-slate-900 lg:hidden" onClick={() => setMenuOpen((current) => !current)} type="button">
            <Menu className="h-4 w-4" />
          </button>
        </div>
        {menuOpen ? (
          <div className="px-4 py-3 lg:hidden sm:px-6">
            <div className="kids-cloud-panel kids-mobile-panel mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-4">
              {links.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) => `kids-nav-link w-full justify-start ${isActive ? 'theme-nav-active' : ''}`}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  to={item.to}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <NavLink className="button-primary mt-2" onClick={() => setMenuOpen(false)} to="/login">
                Login
              </NavLink>
            </div>
          </div>
        ) : null}
      </header>

      {error ? <div className="relative z-10 mx-auto max-w-[1400px] px-4 pt-4 text-sm text-rose-600 sm:px-6 lg:px-8">{error}</div> : null}

      <main className="relative z-10 pb-16">{children}</main>

      <footer className="relative z-10 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="kids-cloud-panel mx-auto max-w-[1400px] rounded-[2.4rem] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.7fr_0.8fr]">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {school?.logo_url ? (
                  <img
                    alt={school.name}
                    className="w-auto object-contain"
                    decoding="async"
                    loading="lazy"
                    src={school.logo_url}
                    style={{ height: `${footerLogoHeight}px`, maxWidth: `${footerLogoMaxWidth}px` }}
                  />
                ) : (
                  <div className="theme-icon-gradient flex h-16 w-16 items-center justify-center rounded-[1.6rem]">
                    <School2 className="h-6 w-6" />
                  </div>
                )}
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-600">{page.footer_tagline}</p>
              <div className="flex flex-wrap gap-3">
                <NavLink className="button-primary !rounded-full !px-5" to="/login">
                  Login
                </NavLink>
                <NavLink className="button-secondary !rounded-full !px-5" to="/programs">
                  Explore programs
                </NavLink>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Explore</p>
              <div className="mt-4 flex flex-col gap-3">
                {links.map((item) => (
                  <NavLink key={item.to} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900" end={item.to === '/'} to={item.to}>
                    <item.icon className="h-4 w-4 text-brand-600" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Contact</p>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                {address ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 theme-text-primary" />
                    <span>{address}</span>
                  </div>
                ) : null}
                {phone ? (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 theme-text-primary" />
                    <span>{phone}</span>
                  </div>
                ) : null}
                {email ? (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 theme-text-primary" />
                    <span>{email}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-slate-200/80 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>{school?.name ?? 'School Website'} © {currentYear}. All rights reserved.</p>
            <p>
              Powered by{' '}
              <a className="font-semibold theme-text-primary transition hover:opacity-80" href="https://dreambuzz.in" rel="noreferrer" target="_blank">
                Dreambuzz Solutions
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicLayout() {
  return (
    <PublicSiteProvider>
      <PublicSiteScaffold>
        <Outlet />
      </PublicSiteScaffold>
    </PublicSiteProvider>
  );
}
