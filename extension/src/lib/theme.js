const VALID_THEME_MODES = new Set(["system", "light", "dark"]);

export function normalizeThemeMode(mode) {
  return VALID_THEME_MODES.has(mode) ? mode : "system";
}

export function applyThemeMode(mode) {
  const normalized = normalizeThemeMode(mode);
  const resolved = normalized === "system" ? getSystemTheme() : normalized;
  document.documentElement.dataset.themeMode = normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return { mode: normalized, resolved };
}

export function syncThemeModeControl(control, mode) {
  const normalized = normalizeThemeMode(mode);
  for (const button of control?.querySelectorAll("[data-theme-mode]") ?? []) {
    const isActive = button.dataset.themeMode === normalized;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

export function bindThemeModeControl(control, onChange) {
  control?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-theme-mode]");
    if (!button || !control.contains(button)) {
      return;
    }
    const mode = normalizeThemeMode(button.dataset.themeMode);
    syncThemeModeControl(control, mode);
    applyThemeMode(mode);
    await onChange(mode);
  });
}

export function watchSystemTheme(getMode, onSystemChange) {
  const query = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!query) {
    return () => {};
  }

  const handler = () => {
    if (normalizeThemeMode(getMode()) === "system") {
      onSystemChange();
    }
  };

  query.addEventListener?.("change", handler);
  return () => query.removeEventListener?.("change", handler);
}

function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}
