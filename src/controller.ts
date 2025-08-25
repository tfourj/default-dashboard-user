import { HomeAssistant } from 'custom-card-helpers';
import LOCAL_STORAGE_OPTIONS from './helpers/storageOptions';
class DefaultDashboardController {
  hass!: HomeAssistant;
  constructor(hass: HomeAssistant) {
    this.hass = hass;
  }

  // Unused helper creation and dashboard enumeration code removed

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
