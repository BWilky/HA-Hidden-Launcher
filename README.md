# Lovelace Hidden Launcher Card

A custom Lovelace wrapper card for Home Assistant that executes a configured action when a specific tap gesture (e.g., tap 5 times rapidly) is performed on the wrapped element. Supports an optional PIN pad security lock.

This card reuses Home Assistant's internal Lit library to minimize resource loading.

## Features

- Wrapper card: Can wrap any Lovelace component (buttons, vertical stacks, markdown, etc.) without altering its layout.
- Tap gesture: Listens for a configurable number of consecutive clicks within a specified time window. Stops event propagation on the final tap to prevent the underlying card's action from triggering.
- Modal PIN pad: Displays a fullscreen modal using the native HTML <dialog> element.
- Actions: Uses the standard Home Assistant Lovelace action schema to execute service calls, navigation, or events.

## Installation

1. Copy `ha-hidden-launcher.js` to your Home Assistant configuration directory under `www/`:
   `/config/www/ha-hidden-launcher.js`
2. Add the file as a Dashboard resource:
   - Go to Settings > Dashboards.
   - Select Resources from the overflow menu.
   - Click Add Resource.
   - Set the URL to `/local/ha-hidden-launcher.js` and select JavaScript Module as the type.
3. Refresh the dashboard.

## Configuration

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | Required | Must be `custom:hidden-launcher`. |
| `card` | map | Required | The configuration of the card to be wrapped. |
| `action` | map | Required | The Lovelace action configuration to execute on success. |
| `pin` | string / number | Optional | The PIN code required to unlock the action. If omitted, the action executes immediately when the tap threshold is met. |
| `taps` | number | `5` | Number of consecutive taps required to trigger the launcher. |
| `tap_window` | number | `1000` | Time window (in milliseconds) between taps to count as consecutive. |
| `title` | string | `"Enter PIN"` | The title shown on the PIN pad popup. |
| `subtitle` | string | Optional | Subtitle text shown below the title. |
| `timeout` | number | `30` | Inactivity timeout (in seconds) before the popup automatically closes. Set to `0` to disable. |

## Examples

### PIN Protected Service Call (Button Wrapper)
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
    action: none
action:
  action: call-service
  service: script.arm_alarm_home
```

### Action Without PIN (Stack Wrapper Navigation)
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
