/* eslint-disable @typescript-eslint/no-explicit-any */
import { HomeAssistant } from 'custom-card-helpers';
import { log } from './helpers';
import LOCAL_STORAGE_OPTIONS from './helpers/storageOptions';
import { Dashboard } from './types';
class DefaultDashboardController {
  hass!: HomeAssistant;
  constructor(hass: HomeAssistant) {
    this.hass = hass;
  }

  getDashboards = async (): Promise<Dashboard[]> => {
    return this.hass.callWS({
      type: 'lovelace/dashboards/list',
    }) as Promise<Dashboard[]>;
  };

  createInputBoolean = async (name = 'Default Dashboard'): Promise<any> => {
    try {
      const res = await this.hass.callWS({
        type: 'input_boolean/create',
        name,
      });
      log(`Created input_boolean helper: name="${name}"`);
      return res;
    } catch (error) {
      log('Failed to create input_boolean helper via WS (likely unsupported). Please create it manually in Settings → Devices & Services → Helpers.', error);
      return null;
    }
  };

  createInputSelect = async (name = 'Default Dashboard'): Promise<any> => {
    try {
      const dashboards = await this.getDashboards().then((boards) => {
        return boards
          .filter((d) => !d.require_admin)
          .flatMap((d) => {
            return d.url_path;
          });
      });
      const res = await this.hass.callWS({
        type: 'input_select/create',
        name,
        options: ['lovelace', ...dashboards, 'refresh'],
      });
      log(`Created input_select helper: name="${name}", optionsCount=${dashboards.length + 2}`);
      return res;
    } catch (error) {
      log('Failed to create input_select helper via WS (likely unsupported). Please create it manually in Settings → Devices & Services → Helpers.', error);
      return null;
    }
  };

  getStorageSettings = async (): Promise<{ defaultPanel: string | null; isDefaultPanelManaged: string | null }> => {
    const defaultPanel: string | null = localStorage.getItem(LOCAL_STORAGE_OPTIONS.defaultPanel);
    const isDefaultPanelManaged: string | null = localStorage.getItem(LOCAL_STORAGE_OPTIONS.isDefaultPanelManaged);
    return { defaultPanel, isDefaultPanelManaged };
  };

  setDefaultPanel = async (defaultPanel: string): Promise<void> => {
    localStorage.setItem(LOCAL_STORAGE_OPTIONS.defaultPanel, defaultPanel);
    localStorage.setItem(LOCAL_STORAGE_OPTIONS.isDefaultPanelManaged, 'true');
  };

  disable = async (): Promise<void> => {
    localStorage.setItem(LOCAL_STORAGE_OPTIONS.isDefaultPanelManaged, 'false');
  };

  enable = async (): Promise<void> => {
    localStorage.setItem(LOCAL_STORAGE_OPTIONS.isDefaultPanelManaged, 'true');
  };
}

export default DefaultDashboardController;
