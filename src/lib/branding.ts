export type KidsFontStyle = 'fredoka' | 'baloo' | 'quicksand';

export interface KidsFontOption {
  value: KidsFontStyle;
  label: string;
  description: string;
  displayStack: string;
  bodyStack: string;
}

export const DEFAULT_KIDS_FONT_STYLE: KidsFontStyle = 'fredoka';

export const kidsFontOptions: KidsFontOption[] = [
  {
    value: 'fredoka',
    label: 'Fredoka Playhouse',
    description: 'Rounded, bright and playful for daily school dashboards.',
    displayStack: "'Fredoka', 'Nunito', sans-serif",
    bodyStack: "'Nunito', sans-serif",
  },
  {
    value: 'baloo',
    label: 'Baloo Storytime',
    description: 'Soft bubble lettering that feels cheerful in branded PDFs.',
    displayStack: "'Baloo 2', 'Nunito', sans-serif",
    bodyStack: "'Nunito', sans-serif",
  },
  {
    value: 'quicksand',
    label: 'Quicksand Sunshine',
    description: 'Light and friendly for a clean kindergarten look.',
    displayStack: "'Quicksand', 'Nunito', sans-serif",
    bodyStack: "'Quicksand', 'Nunito', sans-serif",
  },
];

export function getKidsFontStyle(settings: Record<string, unknown> | null | undefined): KidsFontStyle {
  const style = settings?.kids_font_style;
  return kidsFontOptions.some((option) => option.value === style) ? (style as KidsFontStyle) : DEFAULT_KIDS_FONT_STYLE;
}

export function getKidsFontOption(style: KidsFontStyle) {
  return kidsFontOptions.find((option) => option.value === style) ?? kidsFontOptions[0];
}
