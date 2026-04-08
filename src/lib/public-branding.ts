export const DEFAULT_WEBSITE_LOGO_SCALE = 100;
export const MIN_WEBSITE_LOGO_SCALE = 60;
export const MAX_WEBSITE_LOGO_SCALE = 150;

export function getWebsiteLogoScale(settings: Record<string, unknown> | null | undefined) {
  const rawValue = settings?.website_logo_scale;
  const parsedValue =
    typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' ? Number.parseInt(rawValue, 10) : DEFAULT_WEBSITE_LOGO_SCALE;

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_WEBSITE_LOGO_SCALE;
  }

  return Math.min(MAX_WEBSITE_LOGO_SCALE, Math.max(MIN_WEBSITE_LOGO_SCALE, Math.round(parsedValue)));
}
