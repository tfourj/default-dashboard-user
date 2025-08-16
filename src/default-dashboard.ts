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
  // Global check: if any dropdown (user or global) is set to refresh, rebuild options for all
  {
    const { userDropdown, globalDropdown } = getHelperEntityIds(hass);
    const dropdownIds = [userDropdown, globalDropdown];
    // Before any action, record current non-refresh selections as last known
    dropdownIds.forEach((id) => {
      const current = hass.states[id]?.state as string | undefined;
      if (current && current !== REFRESH_OPTION) setLastSavedOption(id, current);
    });
    const anyRefresh = dropdownIds.some((id) => hass.states[id]?.state === REFRESH_OPTION);
    if (anyRefresh) {
      log('Refreshing dropdown options for all helpers (global check)');
      const urls = await getUrlsHash();
      const dynamicOptions = Object.keys(urls).filter((k) => k && k !== OVERVIEW_OPTION && k !== REFRESH_OPTION);
      const options = [OVERVIEW_OPTION, ...dynamicOptions, REFRESH_OPTION];

      for (const id of dropdownIds) {
        if (hass.states[id] !== undefined) {
          await setDefaultDashboardOptions(hass, id, options);
        }
      }
      // Restore previous selection for any dropdown currently on refresh, if we have one and it's valid
      for (const id of dropdownIds) {
        const isOnRefresh = hass.states[id]?.state === REFRESH_OPTION;
        if (isOnRefresh) {
          const last = getLastSavedOption(id);
          if (last && options.includes(last)) {
            await setDefaultDashboardOption(hass, id, last);
          }
        }
      }
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
      log('Refreshing dropdown options for all helpers');
      const urls = await getUrlsHash();
      const dynamicOptions = Object.keys(urls).filter((k) => k && k !== OVERVIEW_OPTION && k !== REFRESH_OPTION);
      const options = [OVERVIEW_OPTION, ...dynamicOptions, REFRESH_OPTION];

      // Update options for both user and global dropdowns when any is refreshed
      const { userDropdown, globalDropdown } = getHelperEntityIds(hass);
      const targetDropdowns = [userDropdown, globalDropdown].filter((id) => hass.states[id] !== undefined);
      // Record current non-refresh selections before changing options
      targetDropdowns.forEach((id) => {
        const current = hass.states[id]?.state as string | undefined;
        if (current && current !== REFRESH_OPTION) setLastSavedOption(id, current);
      });
      for (const id of targetDropdowns) {
        await setDefaultDashboardOptions(hass, id, options);
      }
      // Restore previous selection for the dropdown that triggered refresh, if available and valid
      const lastForTrigger = getLastSavedOption(dropdownEntityId);
      if (lastForTrigger && options.includes(lastForTrigger)) {
        await setDefaultDashboardOption(hass, dropdownEntityId, lastForTrigger);
      }
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
