# Lovelace Hidden Launcher Card

A premium, custom Lovelace wrapper card for [Home Assistant](https://www.home-assistant.io/) that secures dashboard actions behind a custom tap gesture (e.g., tap 5 times rapidly) and an optional PIN entry pad. 

The card leverages Home Assistant's internal `Lit` library (avoiding redundant module loads) and presents a stunning, glassmorphic modal with pop-up/pop-down transitions, haptic vibration, and dynamic indicators matching the configured PIN length.

## Features

- 🔄 **Transparent Wrapper**: Can wrap **any** Home Assistant card (vertical stacks, buttons, picture elements, gauges, markdown etc.) without changing its look or spacing.
- 👆 **Multi-Tap Gesture**: Listens for a configurable consecutive click gesture (default: 5 taps) with a time-decay window. The final tap intercepts click actions, preventing the underlying card from reacting.
- 🔐 **Premium PIN Pad Popup**: Renders a glassmorphic modal using the native HTML `<dialog>` element, ensuring it appears on the browser's "top layer" on top of all stacking contexts (no container `z-index` or `transform` clipping).
- 🎨 **Theme & Aesthetic Excellence**: Curated responsive styling that flows naturally with Home Assistant's light and dark themes. Features micro-animations for keyboard presses, indicator fill states, mistake shakes, and success pulses.
- ⚡ **Zero Dependencies**: Dynamically borrows Lit Element from Home Assistant's existing registry with a reliable CDN fallback.

---

## Installation

### Manual Installation
1. Download or copy `hidden-launcher-card.js` into your Home Assistant config directory under `www/`:
   ```bash
   # Path in your HA config folder
   /config/www/hidden-launcher-card.js
   ```
2. Register the file as a Dashboard resource:
   - Go to **Settings > Dashboards**.
   - Click the three dots (upper-right) and select **Resources**.
   - Click **Add Resource**.
   - Set the URL to `/local/hidden-launcher-card.js` and select **JavaScript Module** as the type.
3. Refresh your dashboard page.

---

## Configuration

### YAML Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | **Required** | Must be `custom:hidden-launcher`. |
| `card` | map | **Required** | The Lovelace card config that will be wrapped. |
| `action` | map | **Required** | The Home Assistant action config to trigger on success (standard tap_action schema). |
| `pin` | string / number | *Optional* | The PIN code to unlock the action. If omitted, the action triggers immediately after the gesture. |
| `taps` | number | `5` | The number of consecutive taps required to trigger the launcher. |
| `tap_window` | number | `1000` | The time window (in milliseconds) between taps to be counted as consecutive. |
| `title` | string | `"Enter PIN"` | The title shown at the top of the PIN pad popup. |
| `subtitle` | string | *Optional* | A subtitle shown below the title on the popup. |

---

## YAML Examples

### Example 1: Secure Service Call (PIN Protected Button)
This example wraps a standard button. Tapping the button wraps a light toggle service, but tapping it rapidly 5 times prompts the user for PIN `4321`. Entering the PIN executes a script to arm the alarm system.

```yaml
type: custom:hidden-launcher
taps: 5
pin: "4321"
title: "Secure Terminal"
subtitle: "Enter PIN to arm security system"
card:
  type: button
  name: "Arm Alarm"
  icon: mdi:shield-lock
  tap_action:
    action: none  # Inner tap action is disabled or can perform minor operations
action:
  action: call-service
  service: script.arm_alarm_home
  target: {}
```

### Example 2: Hidden Navigation (Secret Gesture with Stack Card)
This example wraps a vertical stack card of server stats. Tapping anywhere on the stack rapidly 6 times will directly navigate the user to a secret admin panel without asking for a PIN.

```yaml
type: custom:hidden-launcher
taps: 6
tap_window: 1200
card:
  type: vertical-stack
  cards:
    - type: markdown
      content: "### System Overview"
    - type: gauge
      entity: sensor.processor_use
      name: CPU
action:
  action: navigate
  navigation_path: /lovelace/admin-settings
```

### Example 3: Fire DOM Events (Browser Mod Popups)
You can trigger local popups or events like `fire-dom-event` (e.g. Browser Mod) when the PIN is input correctly.

```yaml
type: custom:hidden-launcher
pin: "1984"
title: "Developer Mode"
card:
  type: picture-glance
  title: Camera Feed
  image: /local/camera_snapshot.jpg
  entities: []
action:
  action: fire-dom-event
  browser_mod:
    service: browser_mod.popup
    data:
      title: Admin Controls
      content:
        type: entities
        entities:
          - switch.home_server_power
          - button.reboot_ha
```
