import GLib from 'gi://GLib';

export default class Defaults {
    #timeLocale = null;

    get buttonSaturation() {
        return 100; // %
    }

    get buttonMenuAlignment() {
        return 0; // % from left to right
    }

    get buttonEaseTime() {
        return 100; // ms
    }

    get buttonMinimumWidth() {
        return 0; // px
    }

    get buttonPaddingWidth() {
        return 6; // px
    }

    get buttonPaddingLeft() {
        return 6; // px
    }

    get buttonPaddingRight() {
        return 6; // px
    }

    get buttonIconSize() {
        return 24; // px
    }

    get buttonContextIcon() {
        return 'shell-focus-app-grid-symbolic';
    }

    get timeLocale() {
        if (this.#timeLocale !== null) {
            // Value can be undefined
            return this.#timeLocale;
        }
        let lc_time = GLib.getenv('LC_ALL'); // Takes precedence
        if (!lc_time) {
            lc_time = GLib.getenv('LC_TIME');
        }
        if (!lc_time) {
            lc_time = GLib.getenv('LANG'); // Fallback
        }
        if (
            lc_time &&
            (lc_time = lc_time.match(/^([a-z][a-z])_([A-Z][A-Z])(\.|$)/i))
        ) {
            return (this.#timeLocale = `${lc_time[1]}-${lc_time[2]}`);
        } else {
            // undefined: use runtime's default locale in Intl.DateTimeFormat
            return (this.#timeLocale = undefined);
        }
    }

    get messageSourceIcon() {
        return 'system-lock-screen-symbolic';
    }
}
