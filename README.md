## default-dashboard-user
Forked from [daredoes/default-dashboard](https://github.com/daredoes/default-dashboard) repo with some improvements and aditional features

### Installation

#### Option A: HACS (recommended)
1. In Home Assistant, open HACS → three dots → Custom repositories.
2. Add `https://github.com/tfourj/default-dashboard-user` with category `Lovelace` (Frontend).
3. Search for and install "Default Dashboard User" from HACS.
4. Resource registration:
   - Newer HACS/HA usually add the resource automatically. If not, go to Settings → Dashboards → Resources → Add resource:
     - URL: `/hacsfiles/default-dashboard-user/default-dashboard-user.js`
     - Type: `JavaScript Module`

#### Option B: Manual
1. Download `default-dashboard-user.js` from a GitHub release (the file is inside `dist/`).
2. Copy it to your HA `config/www/` directory (e.g. `config/www/default-dashboard-user.js`).
3. Add a Lovelace resource in Settings → Dashboards → Resources:
   - URL: `/local/default-dashboard-user.js`
   - Type: `JavaScript Module`

### Usage
- Create helpers (either global or per-user):
  - `input_select.default_dashboard` (or `input_select.default_dashboard_<username_or_id>`) and include the option `refresh`.
  - `input_boolean.default_dashboard` (or `input_boolean.default_dashboard_<username_or_id>`).
- Set the dropdown to one of your dashboard url paths (e.g. `lovelace`, `<your_dashboard_slug>`) and toggle the boolean ON.
- Selecting `refresh` will rebuild the dropdown options from available dashboards.

### Troubleshooting
- Ensure the resource is loaded (check Settings → Dashboards → Resources for the URL above).
- After changing the default dashboard, refresh the browser. If needed, clear cache.
- Verify helper entity ids are correct and exist, and that the dropdown includes `refresh`.
- Make sure the toggle (`input_boolean...`) is ON for the user/global scope you expect.
