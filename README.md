## default-dashboard-user
Forked from [daredoes/default-dashboard](https://github.com/daredoes/default-dashboard) repo with some improvements and aditional features

### Installation

#### Option A: HACS (recommended)
1. In Home Assistant, open HACS → three dots → Custom repositories.
2. Add `https://github.com/tfourj/default-dashboard-user` with category `Lovelace` (Frontend).
3. Search for and install "Default Dashboard User" from HACS.

#### Option B: Manual
1. Download `default-dashboard-user.js` from a GitHub release (the file is inside `dist/`).
2. Copy it to your HA `config/www/` directory (e.g. `config/www/default-dashboard-user.js`).
3. Add a Lovelace resource in Settings → Dashboards → Resources:
   - URL: `/local/default-dashboard-user.js`
   - Type: `JavaScript Module`

### Create configuration
No helpers are required. After installing the resource:

1) Create a file in your Home Assistant config: `homeassistant/www/default-dashboard.json` or `config/www/default-dashboard.json`(check which one exists) (accessible as `/local/default-dashboard.json`).

2) Put one of the following in the file (values are dashboard slugs, not full URLs):

- Minimal (single default for everyone):
```json
"lovelace"
```

- Per-user mapping with a global fallback:
```json
{
  "users": {
    "alex": "alex-dashboard"
  },
  "global": "dashboard-home"
}
```

- Optional enabled toggles (works for both users and global):
```json
{
  "users": {
    "alex": { "dashboard": "alex-dashboard", "enabled": true },
    "maria": { "dashboard": "maria-dashboard", "enabled": false }
  },
  "global": { "dashboard": "lovelace", "enabled": true }
}
```

Rules:
- User matching is by the Home Assistant display name (case-insensitive).
- If no user match, the `global` value is used when present and enabled.
- If neither is found, the fallback is `lovelace` (Overview).
- Valid values are Lovelace dashboard `url_path` slugs (e.g., `lovelace`, `house-entry`, `dashboard-home`).

Notes on values:
- Only provide the dashboard slug (the `url_path`), e.g. `home-dashboard`.
- Do not paste full URLs like `https://example.homeassistant.com/home-dashboard/room1`.
- If a full URL or path with slashes is provided, the integration automatically extracts the first segment (e.g., it converts `https://example/home-dashboard/room1` to `home-dashboard`).

After the file is saved, the add-on will read it and set the default dashboard. When it changes the default, the homepage is reloaded automatically.

### Troubleshooting
- Ensure the resource is loaded (check Settings → Dashboards → Resources for the URL above).
- Ensure the JSON file exists at `config/www/default-dashboard.json` (served as `/local/default-dashboard.json`).
- Confirm your dashboard slugs exist in Settings → Dashboards (they must match `url_path`).
- After creating or editing the JSON file, refresh the browser if it doesn't redirect automatically.
- Open the browser console to see logs like "Loaded default-dashboard.json: ..." and "Set default attempt (file-driven): ..." for diagnostics.
