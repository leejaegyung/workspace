// Theme utility — sets CSS custom properties directly on <html> via inline style
// (inline styles always override stylesheet rules, bypassing Tailwind v4 specificity issues)

export const ACCENT_PALETTES = [
  { label: '일렉트릭 블루', primary: '#97a9ff', secondary: '#ac8aff', primaryDim: '#3e65ff', secondaryDim: '#8455ef' },
  { label: '바이올렛',      primary: '#b99dff', secondary: '#d4b8ff', primaryDim: '#8455ef', secondaryDim: '#6b3fd4' },
  { label: '핑크',          primary: '#ffa3e9', secondary: '#ff7fd4', primaryDim: '#e883d2', secondaryDim: '#d460be' },
  { label: '민트',          primary: '#6ee7b7', secondary: '#34d399', primaryDim: '#10b981', secondaryDim: '#059669' },
];

const DARK_VARS: Record<string, string> = {
  '--color-surface':                    '#0e0e0e',
  '--color-surface-container-lowest':   '#000000',
  '--color-surface-container-low':      '#131313',
  '--color-surface-container':          '#1a1a1a',
  '--color-surface-container-high':     '#20201f',
  '--color-surface-container-highest':  '#262626',
  '--color-surface-bright':             '#2c2c2c',
  '--color-surface-variant':            '#2e2e2e',
  '--color-on-surface':                 '#ffffff',
  '--color-on-surface-variant':         '#adaaaa',
  '--color-outline-variant':            '#484847',
  '--color-secondary-container':        '#3d2a6e',
  '--color-on-secondary-container':     '#e8d9ff',
};

const LIGHT_VARS: Record<string, string> = {
  '--color-surface':                    '#f5f5f4',
  '--color-surface-container-lowest':   '#ffffff',
  '--color-surface-container-low':      '#efefee',
  '--color-surface-container':          '#e8e8e6',
  '--color-surface-container-high':     '#e0e0de',
  '--color-surface-container-highest':  '#d8d8d6',
  '--color-surface-bright':             '#d0d0ce',
  '--color-surface-variant':            '#e4e4e2',
  '--color-on-surface':                 '#0e0e0e',
  '--color-on-surface-variant':         '#525252',
  '--color-outline-variant':            '#c0c0be',
  '--color-secondary-container':        '#ede0ff',
  '--color-on-secondary-container':     '#3d2a6e',
};

export function applyTheme(themeIndex: number, accentIndex: number) {
  const root = document.documentElement;

  // 1. Apply all surface/text CSS variables directly (highest priority)
  const vars = themeIndex === 1 ? LIGHT_VARS : DARK_VARS;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // 2. Set data-theme for non-variable CSS (glass, shadow, autofill overrides)
  root.setAttribute('data-theme', themeIndex === 1 ? 'light' : 'dark');

  // 3. Apply accent palette
  const accent = ACCENT_PALETTES[accentIndex] ?? ACCENT_PALETTES[0];
  root.style.setProperty('--color-primary',       accent.primary);
  root.style.setProperty('--color-secondary',     accent.secondary);
  root.style.setProperty('--color-primary-dim',   accent.primaryDim);
  root.style.setProperty('--color-secondary-dim', accent.secondaryDim);
}

export async function loadAndApplyTheme() {
  try {
    const res = await fetch('/api/data/settings/appearance', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return;
    const { value } = await res.json();
    if (value) applyTheme(value.theme ?? 0, value.accent ?? 0);
  } catch { /* ignore */ }
}
