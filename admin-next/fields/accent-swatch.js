/**
 * accent-swatch — admin2 field for the theme's accent preset.
 *
 * Radios drawn as colour squares, so the choice shows the actual colour
 * rather than its name. Options and labels come from the blueprint.
 */

const TAG = window.__GRAV_FIELD_TAG;

// The light-mode --bcn-accent-strong of each preset in css/bcn.css. Keep the
// two in step: the admin cannot read the site's stylesheet.
const COLORS = {
    purple: '#9333EA',
    blue: '#115BCC',
    green: '#017832',
    amber: '#8A5600',
    rose: '#BA0036',
};

class AccentSwatchField extends HTMLElement {
    constructor() {
        super();
        this._value = null;
        this._field = null;
        this._name = 'accent-' + Math.random().toString(36).slice(2, 8);
    }

    set field(v) {
        this._field = v;
        if (this.isConnected) this._render();
    }
    get field() { return this._field; }

    set value(v) {
        this._value = v ?? this._field?.default ?? null;
        if (this.isConnected) this._sync();
    }
    get value() { return this._value; }

    connectedCallback() {
        this._render();
    }

    _options() {
        const opts = this._field?.options;
        if (Array.isArray(opts)) return opts.map(o => ({ value: o.value, label: o.label }));
        if (opts && typeof opts === 'object') {
            return Object.entries(opts).map(([value, label]) => ({ value, label }));
        }
        return Object.keys(COLORS).map(value => ({ value, label: value }));
    }

    _render() {
        this.innerHTML = `
            <style>
                .bcn-swatches { display: flex; flex-wrap: wrap; gap: 12px; border: 0; margin: 0; padding: 0; }
                .bcn-swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;
                    font-size: 12px; color: var(--muted-foreground, #6b7280); }
                .bcn-swatch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
                .bcn-swatch-chip { width: 32px; height: 32px; border-radius: 8px;
                    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); outline-offset: 2px; }
                .bcn-swatch input:checked + .bcn-swatch-chip { outline: 2px solid var(--foreground, #111827); }
                .bcn-swatch input:focus-visible + .bcn-swatch-chip { outline: 2px solid var(--primary, #3b82f6); }
                .bcn-swatch input:checked ~ .bcn-swatch-label { color: var(--foreground, #111827); font-weight: 600; }
            </style>
            <fieldset class="bcn-swatches">
                ${this._options().map(o => `
                    <label class="bcn-swatch">
                        <input type="radio" name="${this._name}" value="${o.value}" />
                        <span class="bcn-swatch-chip" style="background:${COLORS[o.value] ?? '#9ca3af'}"></span>
                        <span class="bcn-swatch-label">${o.label}</span>
                    </label>
                `).join('')}
            </fieldset>
        `;
        this.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', e => {
                // The input's own change event would bubble out of the element
                // too, reaching the admin with no detail.
                e.stopPropagation();
                this._value = e.target.value;
                this.dispatchEvent(new CustomEvent('change', { detail: this._value, bubbles: true }));
            });
        });
        this._sync();
    }

    _sync() {
        this.querySelectorAll('input').forEach(input => {
            input.checked = input.value === this._value;
        });
    }
}

customElements.define(TAG, AccentSwatchField);
