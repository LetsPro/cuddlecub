import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import { MediaField } from '../../components/MediaField';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { MAX_WEBSITE_LOGO_SCALE, MIN_WEBSITE_LOGO_SCALE, getWebsiteLogoScale } from '../../lib/public-branding';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { getInitials } from '../../lib/utils';

function ProfileDetail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/70 bg-white/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="theme-bg-primary-soft rounded-xl p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { school, refreshSchool } = useAppContext();
  const settings = (school.settings ?? {}) as Record<string, unknown>;
  const themePrimaryColor = typeof settings.theme_primary_color === 'string' ? settings.theme_primary_color : school.primary_color ?? '#f58416';
  const themeSecondaryColor = typeof settings.theme_secondary_color === 'string' ? settings.theme_secondary_color : school.secondary_color ?? '#10b5aa';
  const initialWebsiteLogoScale = getWebsiteLogoScale(settings);
  const [profileForm, setProfileForm] = useState({
    name: school.name ?? '',
    address: school.address ?? '',
    contact_email: school.contact_email ?? '',
    contact_phone: school.contact_phone ?? '',
    logo_url: school.logo_url ?? '',
    academic_year_label: school.academic_year_label ?? '',
    website_logo_scale: initialWebsiteLogoScale,
  });
  const [form, setForm] = useState({
    primary_color: themePrimaryColor,
    secondary_color: themeSecondaryColor,
    language_preference: typeof settings.language_preference === 'string' ? settings.language_preference : 'en',
    terms_and_policies: typeof settings.terms_and_policies === 'string' ? settings.terms_and_policies : '',
    whatsapp_sender_name: typeof settings.whatsapp_sender_name === 'string' ? settings.whatsapp_sender_name : '',
    report_footer: typeof settings.report_footer === 'string' ? settings.report_footer : '',
    dashboard_brandline: typeof settings.dashboard_brandline === 'string' ? settings.dashboard_brandline : '',
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextSettings = (school.settings ?? {}) as Record<string, unknown>;
    setProfileForm({
      name: school.name ?? '',
      address: school.address ?? '',
      contact_email: school.contact_email ?? '',
      contact_phone: school.contact_phone ?? '',
      logo_url: school.logo_url ?? '',
      academic_year_label: school.academic_year_label ?? '',
      website_logo_scale: getWebsiteLogoScale(nextSettings),
    });
    setForm({
      primary_color: typeof nextSettings.theme_primary_color === 'string' ? nextSettings.theme_primary_color : school.primary_color ?? '#f58416',
      secondary_color: typeof nextSettings.theme_secondary_color === 'string' ? nextSettings.theme_secondary_color : school.secondary_color ?? '#10b5aa',
      language_preference: typeof nextSettings.language_preference === 'string' ? nextSettings.language_preference : 'en',
      terms_and_policies: typeof nextSettings.terms_and_policies === 'string' ? nextSettings.terms_and_policies : '',
      whatsapp_sender_name: typeof nextSettings.whatsapp_sender_name === 'string' ? nextSettings.whatsapp_sender_name : '',
      report_footer: typeof nextSettings.report_footer === 'string' ? nextSettings.report_footer : '',
      dashboard_brandline: typeof nextSettings.dashboard_brandline === 'string' ? nextSettings.dashboard_brandline : '',
    });
  }, [school]);

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: profileForm.name,
          address: profileForm.address || null,
          contact_email: profileForm.contact_email || null,
          contact_phone: profileForm.contact_phone || null,
          logo_url: profileForm.logo_url || null,
          academic_year_label: profileForm.academic_year_label || null,
          settings: {
            ...(school.settings ?? {}),
            website_logo_scale: profileForm.website_logo_scale,
          },
        })
        .eq('id', school.id);

      if (error) throw error;
      await refreshSchool();
      setMessage('School profile updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          settings: {
            ...(school.settings ?? {}),
            theme_primary_color: form.primary_color,
            theme_secondary_color: form.secondary_color,
            language_preference: form.language_preference,
            terms_and_policies: form.terms_and_policies,
            whatsapp_sender_name: form.whatsapp_sender_name,
            report_footer: form.report_footer,
            dashboard_brandline: form.dashboard_brandline,
          },
        })
        .eq('id', school.id);

      if (error) throw error;
      await refreshSchool();
      setMessage('Branding and settings updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Branding and policy controls"
        description="Manage the school profile, branding theme, language preference, policy text and communication settings from one control panel."
      />
      <ToastMessage message={message} />

      <SectionCard
        title="School profile"
        description="Manage the school identity, contact details, logo, address, and default academic-year label used across the CRM, reports, and public website."
      >
        <form className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]" onSubmit={handleProfileSave}>
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgb(var(--school-primary-rgb)/0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgb(var(--school-secondary-rgb)/0.14),transparent_34%),linear-gradient(135deg,#fff,#fffaf3_48%,#f8fafc_100%)] p-5 shadow-soft">
              <div className="flex items-center gap-4">
                {profileForm.logo_url ? (
                  <img
                    alt={profileForm.name || school.name}
                    className="w-auto object-contain"
                    decoding="async"
                    loading="lazy"
                    src={profileForm.logo_url}
                    style={{
                      height: `${Math.round(80 * profileForm.website_logo_scale / 100)}px`,
                      maxWidth: `${Math.round(220 * profileForm.website_logo_scale / 100)}px`,
                    }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] text-2xl font-extrabold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--school-primary), rgb(var(--school-secondary-rgb) / 0.94))' }}
                  >
                    {getInitials(profileForm.name || school.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">School identity</p>
                  <h2 className="mt-2 truncate font-serif text-3xl text-slate-900">{profileForm.name || 'School name'}</h2>
                  <p className="mt-2 text-sm text-slate-500">{profileForm.academic_year_label || 'Academic year label not set'}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={Mail} label="Contact email" value={profileForm.contact_email || 'Not set'} />
                <ProfileDetail icon={Phone} label="Contact phone" value={profileForm.contact_phone || 'Not set'} />
                <ProfileDetail icon={Building2} label="Academic label" value={profileForm.academic_year_label || 'Not set'} />
                <ProfileDetail icon={MapPin} label="Address" value={profileForm.address || 'Not set'} />
              </div>
            </div>

            <MediaField
              helperText="Pick the school logo from the media library or upload a new file."
              label="School logo"
              onChange={(value) => setProfileForm((current) => ({ ...current, logo_url: value }))}
              previewHeightClassName="h-56"
              value={profileForm.logo_url}
            />

            <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Public website logo size</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Adjust the uploaded logo size for the website navbar and footer.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{profileForm.website_logo_scale}%</span>
              </div>
              <input
                className="mt-4 h-2 w-full cursor-pointer accent-[var(--school-primary)]"
                disabled={!profileForm.logo_url}
                max={MAX_WEBSITE_LOGO_SCALE}
                min={MIN_WEBSITE_LOGO_SCALE}
                onChange={(event) => setProfileForm((current) => ({ ...current, website_logo_scale: Number(event.target.value) }))}
                type="range"
                value={profileForm.website_logo_scale}
              />
              <p className="mt-3 text-xs text-slate-500">
                {profileForm.logo_url ? 'Save school profile to apply the logo size on the website.' : 'Upload a logo first to enable size adjustment.'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="form-label">School name</label>
              <input className="form-input" onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} value={profileForm.name} />
            </div>
            <div>
              <label className="form-label">Contact email</label>
              <input
                className="form-input"
                onChange={(event) => setProfileForm((current) => ({ ...current, contact_email: event.target.value }))}
                value={profileForm.contact_email}
              />
            </div>
            <div>
              <label className="form-label">Contact phone</label>
              <input
                className="form-input"
                onChange={(event) => setProfileForm((current) => ({ ...current, contact_phone: event.target.value }))}
                value={profileForm.contact_phone}
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Academic year label</label>
              <input
                className="form-input"
                onChange={(event) => setProfileForm((current) => ({ ...current, academic_year_label: event.target.value }))}
                placeholder="2026 - 2027"
                value={profileForm.academic_year_label}
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Address</label>
              <textarea className="form-input min-h-36" onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} value={profileForm.address} />
            </div>
            <div className="md:col-span-2 flex justify-end pt-2">
              <button className="button-primary" type="submit">
                Save school profile
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Brand and preferences" description="School-specific branding used across the UI, reports and communication modules.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Primary color</label>
            <input className="form-input h-12" onChange={(event) => setForm((current) => ({ ...current, primary_color: event.target.value }))} type="color" value={form.primary_color} />
          </div>
          <div>
            <label className="form-label">Secondary color</label>
            <input className="form-input h-12" onChange={(event) => setForm((current) => ({ ...current, secondary_color: event.target.value }))} type="color" value={form.secondary_color} />
          </div>
          <div>
            <label className="form-label">Language preference</label>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, language_preference: event.target.value }))} value={form.language_preference}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
            </select>
          </div>
          <div>
            <label className="form-label">WhatsApp sender label</label>
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, whatsapp_sender_name: event.target.value }))} value={form.whatsapp_sender_name} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Dashboard brandline</label>
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, dashboard_brandline: event.target.value }))} value={form.dashboard_brandline} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Terms and policies</label>
            <textarea className="form-input min-h-28" onChange={(event) => setForm((current) => ({ ...current, terms_and_policies: event.target.value }))} value={form.terms_and_policies} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Report footer</label>
            <textarea className="form-input min-h-24" onChange={(event) => setForm((current) => ({ ...current, report_footer: event.target.value }))} value={form.report_footer} />
          </div>
          <div className="md:col-span-2">
            <button className="button-primary" type="submit">
              Save settings
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
