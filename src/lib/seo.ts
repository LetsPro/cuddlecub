const SITE_URL = 'https://www.cuddlecubpreschool.com';
const SITE_NAME = 'Cuddle Cub International Pre School';
const DEFAULT_DESCRIPTION =
  'Cuddle Cub International Pre School in Mysuru offers play-based early learning, nursery, pre-primary and daycare with caring teachers and safe routines.';
const DEFAULT_KEYWORDS =
  'Cuddle Cub International Pre School, Cuddle Cub Pre School, preschool in Mysuru, play school in Mysuru, nursery school Mysuru, pre primary school Mysuru, daycare Mysuru';

interface SeoConfig {
  title: string;
  description?: string;
  keywords?: string;
  path?: string;
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
}

export function applySeo({ title, description = DEFAULT_DESCRIPTION, keywords = DEFAULT_KEYWORDS, path = '/' }: SeoConfig) {
  if (typeof document === 'undefined') return;

  const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');
  const canonicalUrl = `${SITE_URL}${normalizedPath}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  document.title = fullTitle;
  upsertMeta('meta[name="description"]', 'name', 'description', description);
  upsertMeta('meta[name="keywords"]', 'name', 'keywords', keywords);
  upsertMeta('meta[name="author"]', 'name', 'author', SITE_NAME);
  upsertMeta('meta[name="robots"]', 'name', 'robots', 'index, follow');
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', `${SITE_URL}/favicon.svg`);
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary');
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', `${SITE_URL}/favicon.svg`);
  upsertLink('canonical', canonicalUrl);
}

export function getPublicSeo(pathname: string) {
  if (pathname.startsWith('/about')) {
    return {
      title: `About ${SITE_NAME}`,
      description:
        'Learn about Cuddle Cub International Pre School in Mysuru, a warm early learning space focused on safety, care, creativity and confident child development.',
    };
  }

  if (pathname.startsWith('/programs')) {
    return {
      title: `Preschool Programs | ${SITE_NAME}`,
      description:
        'Explore playgroup, nursery, pre-primary and daycare programs at Cuddle Cub International Pre School in Mysuru for joyful age-appropriate learning.',
    };
  }

  if (pathname.startsWith('/gallery')) {
    return {
      title: `Gallery | ${SITE_NAME}`,
      description:
        'View classroom moments, celebrations, creative activities and school life from Cuddle Cub International Pre School in Mysuru.',
    };
  }

  if (pathname.startsWith('/login')) {
    return {
      title: `Login | ${SITE_NAME}`,
      description: 'Login to the Cuddle Cub International Pre School portal for parent, staff and school administration access.',
      path: '/login',
    };
  }

  return {
    title: `${SITE_NAME} | Mysuru`,
    description: DEFAULT_DESCRIPTION,
  };
}
