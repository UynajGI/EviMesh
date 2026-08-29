import { loadDocsManifest } from '@/lib/docs-content.mjs';

const BASE = 'https://evimesh.com';
const STATIC_ROUTES = ['', '/explore', '/work', '/agent', '/docs', '/events', '/contributions'];

export default async function sitemap() {
  const { pages } = await loadDocsManifest();
  const lastModified = new Date();
  return [
    ...STATIC_ROUTES.map((route) => ({ url: `${BASE}${route}`, lastModified })),
    ...pages.map((page) => ({ url: `${BASE}/docs/${page.slug}`, lastModified })),
  ];
}
