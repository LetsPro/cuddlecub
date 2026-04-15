import { DEFAULT_KIDS_FONT_STYLE, getKidsFontOption, getKidsFontStyle, type KidsFontStyle } from './branding';

const DEFAULT_PRIMARY = '#f58416';
const DEFAULT_SECONDARY = '#10b5aa';
const DEFAULT_SHELL_START = '#3d3026';
const DEFAULT_SHELL_END = '#183a3c';
const THEME_STORAGE_KEY = 'school-theme';

interface ThemeSource {
  primary_color?: string | null;
  secondary_color?: string | null;
  settings?: Record<string, unknown> | null;
}

function normalizeHex(color: string | null | undefined, fallback: string) {
  if (!color) return fallback;

  const value = color.trim();
  const shortHex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = value.replace(shortHex, (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`);

  return /^#([a-f\d]{6})$/i.test(fullHex) ? fullHex : fallback;
}

function hexToRgbChannels(color: string) {
  const normalized = normalizeHex(color, DEFAULT_PRIMARY).replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function blendHexColors(base: string, mix: string, mixWeight: number) {
  const weight = Math.min(1, Math.max(0, mixWeight));
  const baseValue = normalizeHex(base, DEFAULT_PRIMARY).replace('#', '');
  const mixValue = normalizeHex(mix, DEFAULT_SECONDARY).replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const baseChannel = Number.parseInt(baseValue.slice(offset, offset + 2), 16);
    const mixChannel = Number.parseInt(mixValue.slice(offset, offset + 2), 16);
    const channel = Math.round(baseChannel * (1 - weight) + mixChannel * weight);
    return channel.toString(16).padStart(2, '0');
  });

  return `#${channels.join('')}`;
}

function persistTheme(primary: string, secondary: string, fontStyle: KidsFontStyle) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ primary, secondary, fontStyle }));
  } catch {
    // Ignore localStorage failures and continue with runtime-only theming.
  }
}

function readStoredTheme() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { primary?: string; secondary?: string };
    return {
      primary: normalizeHex(parsed.primary, DEFAULT_PRIMARY),
      secondary: normalizeHex(parsed.secondary, DEFAULT_SECONDARY),
      fontStyle: getKidsFontStyle(parsed as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

export function getThemeColors(source?: ThemeSource | null) {
  const settings = (source?.settings ?? {}) as Record<string, unknown>;
  const settingsPrimary = typeof settings.theme_primary_color === 'string' ? settings.theme_primary_color : null;
  const settingsSecondary = typeof settings.theme_secondary_color === 'string' ? settings.theme_secondary_color : null;

  return {
    primary: normalizeHex(settingsPrimary ?? source?.primary_color, DEFAULT_PRIMARY),
    secondary: normalizeHex(settingsSecondary ?? source?.secondary_color, DEFAULT_SECONDARY),
    fontStyle: getKidsFontStyle(settings),
  };
}

function setThemeVariables(primary: string, secondary: string, fontStyle: KidsFontStyle) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const shellStart = blendHexColors(primary, '#0f172a', 0.72);
  const shellEnd = blendHexColors(secondary, '#0f172a', 0.82);
  const fontOption = getKidsFontOption(fontStyle);

  root.style.setProperty('--school-primary', primary);
  root.style.setProperty('--school-primary-rgb', hexToRgbChannels(primary));
  root.style.setProperty('--school-secondary', secondary);
  root.style.setProperty('--school-secondary-rgb', hexToRgbChannels(secondary));
  root.style.setProperty('--school-shell-start', shellStart || DEFAULT_SHELL_START);
  root.style.setProperty('--school-shell-end', shellEnd || DEFAULT_SHELL_END);
  root.style.setProperty('--school-display-font', fontOption.displayStack);
  root.style.setProperty('--school-body-font', fontOption.bodyStack);
}

export function applySchoolTheme(primaryColor?: string | null, secondaryColor?: string | null, fontStyle: KidsFontStyle = DEFAULT_KIDS_FONT_STYLE) {
  const primary = normalizeHex(primaryColor, DEFAULT_PRIMARY);
  const secondary = normalizeHex(secondaryColor, DEFAULT_SECONDARY);

  setThemeVariables(primary, secondary, fontStyle);
  persistTheme(primary, secondary, fontStyle);
}

export function applyThemeFromSchool(source?: ThemeSource | null) {
  const { primary, secondary, fontStyle } = getThemeColors(source);
  applySchoolTheme(primary, secondary, fontStyle);
}

export function resetSchoolTheme() {
  setThemeVariables(DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_KIDS_FONT_STYLE);
}

const storedTheme = readStoredTheme();
if (storedTheme) {
  setThemeVariables(storedTheme.primary, storedTheme.secondary, storedTheme.fontStyle);
} else {
  setThemeVariables(DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_KIDS_FONT_STYLE);
}
