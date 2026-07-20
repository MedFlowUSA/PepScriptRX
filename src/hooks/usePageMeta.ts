import { useEffect } from 'react';

const SITE_NAME = 'PepScriptRX';
const DEFAULT_IMAGE = '/og-image.png';

export function usePageMeta(title: string, description: string, image = DEFAULT_IMAGE) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const imageUrl = new URL(image, window.location.origin).href;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', imageUrl);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', imageUrl);
    setLink('canonical', canonicalUrl);
  }, [title, description, image]);
}

function setLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function setMeta(attrName: string, attrValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
