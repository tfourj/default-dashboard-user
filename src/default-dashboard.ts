import './types';
import { LIB_VERSION } from './version';
import { localize } from './localize/localize';
import { getHass, log } from './helpers';
import Controller from './controller';
import { HomeAssistant } from 'custom-card-helpers';
// import { HassDefaultEvent } from './types';

log(`${localize('common.version')} ${LIB_VERSION}`);
const ENTITY_ID = 'default_dashboard';
const REFRESH_OPTION = 'refresh';
const OVERVIEW_OPTION = 'lovelace';
const LAST_OPTION_PREFIX = 'defaultDashboard:lastOption:';

let controller: Controller;

// Persist and restore last non-refresh selection for each dropdown
const getLastSavedOption = (dropdownEntityId: string): string | null => {
  try {
    return localStorage.getItem(`${LAST_OPTION_PREFIX}${dropdownEntityId}`);
  } catch {
    return null;
  }
};

const setLastSavedOption = (dropdownEntityId: string, option: string): void => {
  if (!option || option === REFRESH_OPTION) return;
  try {
    localStorage.setItem(`${LAST_OPTION_PREFIX}${dropdownEntityId}`, option);
  } catch {
    // ignore
  }
};

// Gets the dashboards, and then puts the url_path attributes in a hash
const getUrlsHash = async (): Promise<Record<string, boolean>> => {
  try {
    const dashboards = await controller.getDashboards();
    const urls = {} as Record<string, boolean>;
    dashboards.forEach((d) => {
      urls[d.url_path] = true;
    });
    // Always allow Overview (lovelace) as a valid target
    urls[OVERVIEW_OPTION] = true;
    log(`Fetched dashboards: count=${dashboards.length}, urls=[${Object.keys(urls).join(', ')}]`);
    return urls;
  } catch (err) {
    log('Error fetching dashboards', err);
    return {};
  }
};

// Calls the HASS service to set the options for an input select
const setDefaultDashboardOptions = async (hass: HomeAssistant, dropdownEntityId: string, options: string[]) => {
  log(`Setting options for ${dropdownEntityId}: [${options.join(', ')}]`);
  return hass.callService(
    'input_select',
    'set_options',
    {
      options,
    },
    { entity_id: dropdownEntityId },
  );
};

// Calls the HASS service to select the option for an input select
const setDefaultDashboardOption = async (hass: HomeAssistant, dropdownEntityId: string, option: string) => {
  log(`Selecting option for ${dropdownEntityId}: ${option}`);
  return hass.callService(
    'input_select',
    'select_option',
    {
      option,
    },
    { entity_id: dropdownEntityId },
  );
};

// (removed) enableIfNull was unused

// Refresh options for all default-dashboard input_select helpers (global + all users)
const refreshAllDefaultDashboardDropdowns = async (
  hass: HomeAssistant,
  triggeringDropdownId?: string,
) => {
  const ENTITY_PREFIX = `input_select.${ENTITY_ID}`; // matches input_select.default_dashboard and input_select.default_dashboard_*
  log(
    `Begin refreshAll: trigger=${String(triggeringDropdownId)}; totalStates=${Object.keys(hass.states || {}).length}`,
  );
  // Build options from dashboards
  const urls = await getUrlsHash();
  const dynamicOptions = Object.keys(urls).filter((k) => k && k !== OVERVIEW_OPTION && k !== REFRESH_OPTION);
  const options = [OVERVIEW_OPTION, ...dynamicOptions, REFRESH_OPTION];
  log(
    `Computed options: count=${options.length}, options=[${options.join(', ')}], dynamicCount=${dynamicOptions.length}`,
  );

  // Discover all default-dashboard dropdowns in state
  const allDropdownIds = Object.keys(hass.states || {}).filter((eid) =>
    eid.startsWith(ENTITY_PREFIX),
  );
  log(
    `Discovered dropdowns: count=${allDropdownIds.length}, ids=[${allDropdownIds.join(', ')}]`,
  );

  // Record current selections for potential restore
  const currentSelections: Record<string, string | undefined> = {};
  for (const id of allDropdownIds) {
    const state = hass.states[id]?.state as string | undefined;
    currentSelections[id] = state;
    if (state && state !== REFRESH_OPTION) setLastSavedOption(id, state);
  }
  log(
    `Pre-update selections: ${allDropdownIds
      .map((id) => `${id}=${String(currentSelections[id])}`)
      .join('; ')}`,
  );

  // Apply options to every discovered dropdown
  for (const id of allDropdownIds) {
    await setDefaultDashboardOptions(hass, id, options);
  }
  log(`Applied options to ${allDropdownIds.length} dropdown(s)`);

  // After refresh, restore every dropdown to a sensible target.
  // Rules:
  // - If previously on refresh: restore to last saved valid option; else fall back to lovelace.
  // - If previously on a specific dashboard: keep it if still valid; else try last saved valid; else fall back to lovelace.
  for (const id of allDropdownIds) {
    const previous = currentSelections[id];
    const last = getLastSavedOption(id);
    const previousIsValid = Boolean(previous && previous !== REFRESH_OPTION && options.includes(previous));
    const lastIsValid = Boolean(last && last !== REFRESH_OPTION && options.includes(last));

    let target: string;
    if (previous === REFRESH_OPTION) {
      target = lastIsValid && last ? last : OVERVIEW_OPTION;
    } else if (previousIsValid && previous) {
      target = previous;
    } else if (lastIsValid && last) {
      target = last;
    } else {
      target = OVERVIEW_OPTION;
    }

    log(
      `Post-refresh restore: id=${id}, prev=${String(previous)}, last=${String(
        last,
      )}, prevIsValid=${previousIsValid}, lastIsValid=${lastIsValid}, target=${target}`,
    );
    await setDefaultDashboardOption(hass, id, target);
  }
};

// Derive helper entity ids for both user and global (user overrides global)
const getHelperEntityIds = (hass: HomeAssistant) => {
  const userId = hass.user?.id || '';
  const userName = hass.user?.name || '';
  const slug = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const suffix = slug(userName) || slug(userId);
  const userDropdown = `input_select.${ENTITY_ID}_${suffix}`;
  const userToggle = `input_boolean.${ENTITY_ID}_${suffix}`;
  const globalDropdown = `input_select.${ENTITY_ID}`;
  const globalToggle = `input_boolean.${ENTITY_ID}`;
  log(
    `Helper ids: user(suffix=${suffix}) dropdown=${userDropdown}, toggle=${userToggle}; global dropdown=${globalDropdown}, toggle=${globalToggle}`,
  );
  return { userDropdown, userToggle, globalDropdown, globalToggle, suffix };
};

// Choose active helpers: user (if present and enabled) overrides global; else fallback to global
const getUrlAndToggle = (hass: HomeAssistant) => {
  const { userDropdown, userToggle, globalDropdown, globalToggle, suffix } = getHelperEntityIds(hass);

  const userUrl = hass.states[userDropdown]?.state;
  const userEnabled = hass.states[userToggle]?.state;
  const globalUrl = hass.states[globalDropdown]?.state;
  const globalEnabled = hass.states[globalToggle]?.state;

  const stateCount = Object.keys(hass.states || {}).length;
  log(
    `Helper check: states=${stateCount}, user: ${userDropdown} -> ${String(userUrl)}, ${userToggle} -> ${String(
      userEnabled,
    )}; global: ${globalDropdown} -> ${String(globalUrl)}, ${globalToggle} -> ${String(globalEnabled)}`,
  );

  // Use user-scoped when present and toggle is on
  if (userUrl !== undefined && userEnabled !== undefined && userEnabled === 'on') {
    return { url: userUrl, enabled: true, dropdownEntityId: userDropdown };
  }

  // Fallback to global when present
  if (globalUrl !== undefined && globalEnabled !== undefined) {
    return { url: globalUrl, enabled: globalEnabled === 'on', dropdownEntityId: globalDropdown };
  }

  // Missing helpers; log guidance
  if (userUrl === undefined || userEnabled === undefined) {
    log(
      `User helpers missing. Please create input_select.${ENTITY_ID}_${suffix} (include option "refresh") and input_boolean.${ENTITY_ID}_${suffix}.`,
    );
  }
  if (globalUrl === undefined || globalEnabled === undefined) {
    log(
      `Global helpers missing. Please create input_select.${ENTITY_ID} (include option "refresh") and input_boolean.${ENTITY_ID}.`,
    );
  }
  // Prefer user dropdown id in return to aid users creating it next
  return { url: null as string | null, enabled: false, dropdownEntityId: userDropdown };
};

// Try to enable Default Dashboard, if that is current setting
const tryEnabledDefaultDashboard = async (enabled: boolean) => {
  if (enabled) {
    await controller.enable();
    log('Default Dashboard Enabled');
    return true;
  }
  await controller.disable();
  log('Default Dashboard Disabled');
  return false;
};

// Sets the default panel to whatever the given url is, if valid
const setDefaultDashboard = async (url: string) => {
  const managedPanel = `"${url}"`;
  const settings = await controller.getStorageSettings();
  const urls = await getUrlsHash();
  log(`Set default attempt: url=${url}, validUrl=${Boolean(urls[url])}`);
  if (urls[url]) {
    if (settings.defaultPanel !== managedPanel) {
      log(`Setting default panel to ${managedPanel}`);
      await controller.setDefaultPanel(managedPanel);
      // Reload the homepage after setting the new homepage
      location.replace('/');
    }
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
  // Global check: if any default-dashboard dropdown (any user/global) is set to refresh, rebuild options for ALL
  {
    const anyDefaultDashboardIsRefresh = Object.entries(hass.states || {})
      .filter(([id]) => id.startsWith(`input_select.${ENTITY_ID}`))
      .some(([, v]: any) => v?.state === REFRESH_OPTION);
    if (anyDefaultDashboardIsRefresh) {
      log('Detected at least one dropdown on refresh (startup). Refreshing ALL default-dashboard dropdowns.');
      await refreshAllDefaultDashboardDropdowns(hass);
      return;
    }
  }
  // Per-user only; no default dashboard listener
  // Fourth, we get the url and toggle status of our helpers
  const { url: my_lovelace_url, enabled: default_dashboard_enabled, dropdownEntityId } = getUrlAndToggle(hass);
  log(`111Startup state: dropdown=${dropdownEntityId}, url=${String(my_lovelace_url)}, enabled=${String(default_dashboard_enabled)}`);
  // Fifth, we confirm we have a url
  if (my_lovelace_url) {
    // Sixth, we see if that URL is refresh, and if it is we refresh our input select's options.
    if (my_lovelace_url === 'refresh') {
      log('Refreshing dropdown options for ALL default-dashboard dropdowns (triggered by user)');
      await refreshAllDefaultDashboardDropdowns(hass, dropdownEntityId);
      return;
    } else {
      // Sixth-else, we try to enable default dashboard for this user, and then try to set the default dashboard for this user
      // Persist last chosen non-refresh option
      setLastSavedOption(dropdownEntityId, my_lovelace_url);
      await tryEnabledDefaultDashboard(default_dashboard_enabled);
      await setDefaultDashboard(my_lovelace_url);
    }
  }
})();
