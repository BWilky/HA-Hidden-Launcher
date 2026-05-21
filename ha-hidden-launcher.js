/**
 * Lovelace Hidden Launcher Card
 * A premium card wrapper for Home Assistant that secures dashboard actions behind a gesture and PIN.
 */

async function init() {
  let LitElement;
  let html;
  let css;

  // Attempt to extract LitElement and its template tags from Home Assistant's already loaded elements
  const baseEl = customElements.get("hui-masonry-view") || 
                 customElements.get("hui-view") || 
                 customElements.get("ha-panel-lovelace") || 
                 customElements.get("hui-error-entity-row") ||
                 customElements.get("ha-card");

  if (baseEl) {
    const proto = Object.getPrototypeOf(baseEl);
    if (proto) {
      LitElement = proto;
      // In older HA versions, html/css were attached to the prototype. In newer ones, they might not be.
      html = proto.prototype?.html || proto.html;
      css = proto.prototype?.css || proto.css;
    }
  }

  // Fallback to CDN dynamic import if they couldn't be extracted from Home Assistant
  if (!LitElement || !html || !css) {
    console.info("Hidden Launcher: Extracting Lit from Home Assistant failed. Using CDN fallback.");
    try {
      const litModule = await import("https://unpkg.com/lit-element@2.4.0/lit-element.js?module");
      LitElement = litModule.LitElement;
      html = litModule.html;
      css = litModule.css;
    } catch (e) {
      console.error("Hidden Launcher: Failed to load Lit library.", e);
      return;
    }
  }

  defineCard(LitElement, html, css);
}

function defineCard(LitElement, html, css) {
  class HiddenLauncherCard extends LitElement {
    static get properties() {
      return {
        hass: { attribute: false },
        _config: { attribute: false },
        _showPopup: { type: Boolean },
        _enteredPin: { type: String },
        _status: { type: String }
      };
    }

    constructor() {
      super();
      this._showPopup = false;
      this._enteredPin = "";
      this._tapCount = 0;
      this._lastTapTime = 0;
      this._status = "idle"; // 'idle', 'success', 'error'
      this._openedTime = 0;
      this._childCard = null;
      this._handleTapCapture = this._handleTapCapture.bind(this);
    }

    setConfig(config) {
      if (!config.card) {
        throw new Error("You must define a child card under 'card' in the YAML configuration.");
      }
      this._config = config;
      this._createChildCard();
    }

    async _createChildCard() {
      try {
        const helpers = await window.loadCardHelpers();
        this._childCard = await helpers.createCardElement(this._config.card);
        this._childCard.hass = this.hass;
        this.requestUpdate();
      } catch (err) {
        console.error("Hidden Launcher: Error creating child card element", err);
      }
    }

    set hass(hass) {
      this._hass = hass;
      if (this._childCard) {
        this._childCard.hass = hass;
      }
    }

    get hass() {
      return this._hass;
    }

    connectedCallback() {
      super.connectedCallback();
      // Listen for click/tap in the capture phase to bypass child event.stopPropagation()
      this.addEventListener("click", this._handleTapCapture, { capture: true });
    }

    disconnectedCallback() {
      this.removeEventListener("click", this._handleTapCapture, { capture: true });
      super.disconnectedCallback();
    }

    _handleTapCapture(event) {
      // Don't intercept if the modal is currently showing
      if (this._showPopup) return;

      // Determine the active config settings
      const tapWindow = this._config.tap_window || 1000;
      const requiredTaps = this._config.taps || 5;
      const now = Date.now();

      if (now - this._lastTapTime > tapWindow) {
        this._tapCount = 1;
      } else {
        this._tapCount++;
      }

      this._lastTapTime = now;

      if (this._tapCount >= requiredTaps) {
        this._tapCount = 0;
        // Stop the final tap click from executing on the child card (e.g. toggling a button)
        event.stopPropagation();
        event.preventDefault();
        this._triggerLauncher();
      }
    }

    _triggerLauncher() {
      const pin = this._config.pin;
      if (pin) {
        this._showPopup = true;
        this._enteredPin = "";
        this._status = "idle";
        this._openedTime = Date.now();
        this.requestUpdate();

        // Allow DOM to render then open dialog using native showModal
        setTimeout(() => {
          const dialog = this.shadowRoot.getElementById("pin-dialog");
          if (dialog) {
            dialog.showModal();
            this._openedTime = Date.now();
          }
        }, 50);
      } else {
        // No PIN required, run action immediately
        this._executeAction();
      }
    }

    _closePopup() {
      const dialog = this.shadowRoot.getElementById("pin-dialog");
      const content = this.shadowRoot.querySelector(".popup-content");

      if (content) {
        content.classList.add("closing");
      }

      // Wait for slide/fade exit animation to finish before closing native dialog
      setTimeout(() => {
        if (dialog) {
          dialog.close();
        }
        this._showPopup = false;
        this._enteredPin = "";
        this._status = "idle";
        if (content) {
          content.classList.remove("closing");
        }
        this.requestUpdate();
      }, 200);
    }

    _handleBackdropClick(event) {
      // Ignore click if it occurs within 1 second of opening the dialog
      if (Date.now() - this._openedTime < 1000) {
        return;
      }
      // Native dialog backdrop is click target when clicking outside the content container
      if (event.target === event.currentTarget) {
        this._closePopup();
      }
    }

    _handleNumberPress(num) {
      if (this._status === "success" || this._status === "error") return;

      const pinLength = this._config.pin.toString().length;
      if (this._enteredPin.length < pinLength) {
        this._enteredPin += num;
        this.requestUpdate();
      }

      if (this._enteredPin.length === pinLength) {
        this._checkPin();
      }
    }

    _handleDelete() {
      if (this._status === "success" || this._status === "error") return;
      if (this._enteredPin.length > 0) {
        this._enteredPin = this._enteredPin.slice(0, -1);
        this.requestUpdate();
      }
    }

    _checkPin() {
      const targetPin = this._config.pin.toString();
      if (this._enteredPin === targetPin) {
        this._status = "success";
        this.requestUpdate();

        // Vibrate success if supported
        if (navigator.vibrate) {
          navigator.vibrate(60);
        }

        setTimeout(() => {
          this._closePopup();
          this._executeAction();
        }, 600);
      } else {
        this._status = "error";
        this.requestUpdate();

        // Vibrate error if supported
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        // Keep error shake state for a moment, then reset
        setTimeout(() => {
          this._enteredPin = "";
          this._status = "idle";
          this.requestUpdate();
        }, 500);
      }
    }

    _executeAction() {
      const actionConfig = this._config.action;
      if (!actionConfig) {
        console.warn("Hidden Launcher: No action configured.");
        return;
      }

      // Build event that standard Lovelace action system understands
      const tempConfig = {
        ...this._config,
        tap_action: actionConfig
      };

      const event = new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: {
          config: tempConfig,
          action: "tap"
        }
      });

      this.dispatchEvent(event);
    }

    render() {
      const pinLength = this._config.pin ? this._config.pin.toString().length : 0;

      return html`
        <div class="launcher-wrapper">
          ${this._childCard || html`<div class="loading">Loading card...</div>`}
          
          ${this._showPopup ? html`
            <dialog id="pin-dialog" @click=${this._handleBackdropClick}>
              <div class="popup-content ${this._status === 'error' ? 'shake' : ''} ${this._status === 'success' ? 'success' : ''}">
                <div class="popup-header">
                  <div class="popup-title">${this._config.title || "Enter PIN"}</div>
                  ${this._config.subtitle ? html`<div class="popup-subtitle">${this._config.subtitle}</div>` : ""}
                </div>
                
                <div class="pin-display">
                  <div class="pin-dots">
                    ${Array.from({ length: pinLength }).map((_, index) => html`
                      <div class="pin-dot ${index < this._enteredPin.length ? 'filled' : ''} ${this._status === 'success' ? 'success' : ''} ${this._status === 'error' ? 'error' : ''}"></div>
                    `)}
                  </div>
                </div>
                
                <div class="pinpad-grid">
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => html`
                    <button class="pinpad-btn" @click=${() => this._handleNumberPress(num.toString())}>
                      ${num}
                    </button>
                  `)}
                  <button class="pinpad-btn action-btn cancel" @click=${this._closePopup}>
                    Cancel
                  </button>
                  <button class="pinpad-btn" @click=${() => this._handleNumberPress("0")}>
                    0
                  </button>
                  <button class="pinpad-btn action-btn delete" @click=${this._handleDelete}>
                    ⌫
                  </button>
                </div>
              </div>
            </dialog>
          ` : ""}
        </div>
      `;
    }

    static get styles() {
      return css`
        .launcher-wrapper {
          display: block;
          outline: none;
        }

        .loading {
          padding: 16px;
          text-align: center;
          color: var(--secondary-text-color, #727272);
        }

        dialog {
          border: none;
          border-radius: 24px;
          padding: 0;
          background: transparent;
          outline: none;
          max-width: 320px;
          width: 85%;
          box-shadow: none;
          overflow: visible;
        }

        dialog::backdrop {
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          opacity: 0;
          transition: opacity 0.25s ease-out;
        }

        dialog[open]::backdrop {
          opacity: 1;
        }

        .popup-content {
          background: var(--paper-dialog-background-color, var(--ha-card-background, var(--card-background-color, var(--primary-background-color, #ffffff))));
          backdrop-filter: blur(25px) saturate(180%);
          -webkit-backdrop-filter: blur(25px) saturate(180%);
          border: 1px solid var(--divider-color, rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.12));
          border-radius: 24px;
          padding: 32px 24px;
          color: var(--primary-text-color, #212121);
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: var(--dialog-box-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.4));
          transform: scale(0.9) translateY(20px);
          opacity: 0;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out;
        }

        dialog[open] .popup-content {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        .popup-content.closing {
          transform: scale(0.9) translateY(15px);
          opacity: 0;
          transition: transform 0.18s ease-in, opacity 0.18s ease-in;
        }

        .popup-header {
          text-align: center;
          margin-bottom: 24px;
          width: 100%;
        }

        .popup-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
          font-family: var(--paper-font-title_-_font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }

        .popup-subtitle {
          font-size: 13px;
          color: var(--secondary-text-color, rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.6));
          font-family: var(--paper-font-body1_-_font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }

        .pin-display {
          display: flex;
          justify-content: center;
          margin-bottom: 28px;
          width: 100%;
        }

        .pin-dots {
          display: flex;
          gap: 14px;
          justify-content: center;
          align-items: center;
          height: 24px;
        }

        .pin-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--divider-color, rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.25));
          background: transparent;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .pin-dot.filled {
          background: var(--primary-text-color, #212121);
          border-color: var(--primary-text-color, #212121);
          transform: scale(1.15);
          box-shadow: 0 0 8px rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.3);
        }

        .pin-dot.success {
          background: var(--success-color, #10b981);
          border-color: var(--success-color, #10b981);
          box-shadow: 0 0 10px rgba(var(--rgb-success-color, 16, 185, 129), 0.4);
          transform: scale(1.2);
        }

        .pin-dot.error {
          background: var(--error-color, #ef4444);
          border-color: var(--error-color, #ef4444);
          box-shadow: 0 0 10px rgba(var(--rgb-error-color, 239, 68, 68), 0.4);
          transform: scale(1.2);
        }

        .pinpad-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px 18px;
          justify-items: center;
          width: 100%;
          max-width: 240px;
        }

        .pinpad-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 1px solid var(--divider-color, rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08));
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.03);
          color: var(--primary-text-color, #212121);
          font-size: 24px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: background-color 0.15s, border-color 0.15s, transform 0.1s, color 0.15s;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          font-family: inherit;
        }

        .pinpad-btn:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08);
          border-color: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.18);
        }

        .pinpad-btn:active {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.15);
          transform: scale(0.92);
        }

        .pinpad-btn.action-btn {
          font-size: 14px;
          font-weight: 400;
          border: none;
          background: transparent;
        }

        .pinpad-btn.action-btn:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.05);
        }

        .pinpad-btn.action-btn.cancel {
          color: var(--error-color, #ef4444);
        }

        .pinpad-btn.action-btn.delete {
          color: var(--secondary-text-color, rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.6));
        }

        /* Animations */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }

        .shake {
          animation: shake 0.35s ease-in-out;
        }

        @keyframes success-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        .success {
          animation: success-pulse 0.4s ease-out;
        }
      `;
    }
  }

  customElements.define("hidden-launcher", HiddenLauncherCard);

  // Register the custom element with Home Assistant
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "hidden-launcher",
    name: "Hidden Launcher Wrapper",
    preview: true,
    description: "Wraps any Lovelace card and triggers a hidden secure action via gesture and optional PIN."
  });
}

// Start the component initialization
init();
