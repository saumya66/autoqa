// Central place for externally-configurable links.
// Set these in landingsite/.env (see .env.example).

export const BOOK_DEMO_URL: string =
  import.meta.env.PUBLIC_BOOK_DEMO_URL ?? 'https://cal.com/clariti/demo';

export const DEMO_VIDEO_URL: string = import.meta.env.PUBLIC_DEMO_VIDEO_URL ?? '';

export const NAV_LINKS = [
  { label: 'The Problem', href: '#problem' },
  { label: 'The Solution', href: '#solution' },
  { label: 'Why it works', href: '#why-it-works' },
  { label: 'How it works', href: '#how-it-works' },
] as const;
