export interface WebsiteHeroSliderSettings {
  autoScroll: boolean;
  intervalSeconds: number;
}

const DEFAULT_INTERVAL_SECONDS = 5;

export function getWebsiteHeroSliderSettings(settings: Record<string, unknown> | null | undefined): WebsiteHeroSliderSettings {
  const autoScrollValue = settings?.website_slider_auto_scroll;
  const intervalValue = settings?.website_slider_interval_seconds;
  const parsedInterval = typeof intervalValue === 'number' ? intervalValue : Number(intervalValue);
  const safeInterval = Number.isFinite(parsedInterval) && parsedInterval >= 3 && parsedInterval <= 12 ? parsedInterval : DEFAULT_INTERVAL_SECONDS;

  return {
    autoScroll: typeof autoScrollValue === 'boolean' ? autoScrollValue : true,
    intervalSeconds: safeInterval,
  };
}
