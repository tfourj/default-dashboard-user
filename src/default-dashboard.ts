import './types';
import { LIB_VERSION } from './version';
import { localize } from './localize/localize';
import { getHass, log } from './helpers';
import Controller from './controller';
import { HomeAssistant } from 'custom-card-helpers';
// import { HassDefaultEvent } from './types';

log(`${localize('common.version')} ${LIB_VERSION}`);
const OVERVIEW_OPTION = 'lovelace';

let controller: Controller;

// Normalize a dashboard value (string or URL) to a Lovelace url_path slug
const toDashboardSlug = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  let s = input.trim();
  if (!s) return '';
  // Strip query/hash early
  s = s.split('#')[0].split('?')[0];
  // If full URL, extract pathname
  try {
    const u = new URL(s);
    s = u.pathname || '';
  } catch {
    // Not a full URL; keep as-is
  }
  // Remove leading slash
  if (s.startsWith('/')) s = s.slice(1);
  // Take only the first path segment (before any "/")
  const first = s.split('/')[0]?.trim() || '';
  return first;
};

// Load desired dashboard(s) from local JSON file with cache-busting param
const loadDashboardsFromLocalFile = async (
  hass?: HomeAssistant,
): Promise<{ defaultUrl: string | null; allowed: Record<string, boolean> }> => {
  const versionParam = Date.now();
  const url = `/local/default-dashboard.json?v=${versionParam}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data: unknown = await res.json();
    let defaultUrl: string | null = null;
    const allowed: Record<string, boolean> = {};

    if (typeof data === 'string') {
      const slug = toDashboardSlug(data);
      defaultUrl = slug || null;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const userName = (hass?.user?.name || '').toLowerCase();
      const users = (obj.users && typeof obj.users === 'object' ? (obj.users as Record<string, unknown>) : undefined) || undefined;
      const global = obj.global as unknown;

      if (users) {
        // Collect allowed from enabled user entries and resolve match for current user
        for (const [key, value] of Object.entries(users)) {
          if (typeof value === 'string') {
            const slug = toDashboardSlug(value);
            if (slug) allowed[slug] = true;
            if (!defaultUrl && userName && key.toLowerCase() === userName && slug) {
              defaultUrl = slug;
            }
            continue;
          }
          if (value && typeof value === 'object') {
            const valObj = value as Record<string, unknown>;
            const enabled = Object.prototype.hasOwnProperty.call(valObj, 'enabled') ? Boolean(valObj.enabled) : true;
            const slug = typeof valObj.dashboard === 'string' ? toDashboardSlug(valObj.dashboard as string) : '';
            if (enabled && slug) {
              allowed[slug] = true;
              if (!defaultUrl && userName && key.toLowerCase() === userName) {
                defaultUrl = slug;
              }
            }
          }
        }
      }

      // Prefer global fallback when user is not defined; support string or { url, enabled }
      if (!defaultUrl) {
        let globalEnabled = true;
        let globalSlug: string | null = null;
        if (typeof global === 'string') {
          globalSlug = toDashboardSlug(global);
        } else if (global && typeof global === 'object') {
          const gObj = global as Record<string, unknown>;
          globalEnabled = Object.prototype.hasOwnProperty.call(gObj, 'enabled') ? Boolean(gObj.enabled) : true;
          const gDash = typeof gObj.dashboard === 'string' ? (gObj.dashboard as string) : '';
          globalSlug = toDashboardSlug(gDash);
        }
        if (globalEnabled && globalSlug) {
          defaultUrl = globalSlug;
          allowed[defaultUrl] = true;
        }
      }


      // Legacy fields as last resort
      if (!defaultUrl) {
        const candidates = [obj.default, obj.dashboard, obj.dashboard, obj.panel, obj.path];
        const first = candidates.find((v) => typeof v === 'string' && toDashboardSlug(v as string).length > 0) as string | undefined;
        const slug = first ? toDashboardSlug(first) : '';
        defaultUrl = slug || null;
        if (slug) allowed[slug] = true;
      }

      // Final fallback: lovelace
      if (!defaultUrl) {
        defaultUrl = OVERVIEW_OPTION;
      }
    }

    // Always allow Overview as a valid target
    allowed[OVERVIEW_OPTION] = true;

    log(
      `Loaded default-dashboard.json: default=${String(defaultUrl)}, allowed=[${Object.keys(allowed).join(', ')}]`,
    );
    return { defaultUrl, allowed };
  } catch (err) {
    log('Failed to load /local/default-dashboard.json', err);
    return { defaultUrl: null, allowed: { [OVERVIEW_OPTION]: true } };
  }
};


// Sets the default panel to whatever the given url is (no panels/cards validation)
const setDefaultDashboard = async (url: string) => {
  const managedPanel = `"${url}"`;
  const settings = await controller.getStorageSettings();
  log(`Set default attempt (file-driven): url=${url}`);
  if (settings.defaultPanel !== managedPanel) {
    log(`Setting default panel to ${managedPanel}`);
    await controller.setDefaultPanel(managedPanel);
    // Reload the homepage after setting the new homepage
    location.replace('/');
  }
};

// Main/entrypoint
(async () => {
  // Wait for scoped customElements registry to be set up
  // otherwise the customElements registry card-mod is defined in
  // may get overwritten by the polyfill if card-mod is loaded as a module
  while (customElements.get('home-assistant') === undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 100));

  // First, we get our hass object from the page.
  const hass = getHass();
  log(`Module initialized for user: id=${hass.user?.id}, name=${hass.user?.name}`);
  // Second, we pass it into our controller instance
  controller = new Controller(hass);
  // Load desired default dashboard from local JSON (bypass panels/cards and helpers)
  const { defaultUrl } = await loadDashboardsFromLocalFile(hass);
  if (defaultUrl) {
    await setDefaultDashboard(defaultUrl);
  } else {
    log('No default dashboard specified in /local/default-dashboard.json; nothing to do.');
  }
})();

