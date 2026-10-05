// October 5: menus default to a dark night chart room; the light chart-paper
// day theme stays selectable in Settings. Saved per device.
const KEY = 'urchin3d-menu-theme-v1';
export const MENU_THEMES = ['night', 'day'];

export function menuTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return MENU_THEMES.includes(saved) ? saved : 'night';
  } catch {
    return 'night';
  }
}
export function applyMenuTheme(theme = menuTheme()) {
  document.documentElement.dataset.menuTheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'night' ? '#151f28' : '#ece4d0');
  return theme;
}
export function cycleMenuTheme() {
  const next = MENU_THEMES[(MENU_THEMES.indexOf(menuTheme()) + 1) % MENU_THEMES.length];
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* The theme still applies for this session without storage. */
  }
  return applyMenuTheme(next);
}
export const menuThemeLabel = () => `Menu colours: ${menuTheme() === 'night' ? 'Night' : 'Day'}`;
