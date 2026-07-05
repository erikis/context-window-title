import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

export default class ClockLabel extends St.Label {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({ style_class: 'clock' });

        // Keep same style as in gnome-shell's dateMenu.js
        this.clutter_text.y_align = Clutter.ActorAlign.CENTER;
        this.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this._locale = undefined; // Use runtime's default locale
        this._options = {};
        this._second = 0; // 0 = showing second is off
        this._f = null; // Intl.DateTimeFormat
        this._t = null; // timeout
        this._u = false; // Already updated
    }

    destroy() {
        // Remove the current update timeout
        if (this._t !== null) {
            GLib.source_remove(this._t);
            this._t = null;
        }

        // As connectObject was used with this as object, these will be automatically
        // disconnected when this is destroyed
        this._connectedClock = null;
        this._connectedClockDisplay = null;

        super.destroy();
    }

    // Optionally make the clock more responsive by connecting
    // to a wall clock and the original clock display
    _connect(wallClock, originalClockDisplay) {
        // Do a re-format and an extraordinary update when the time zone changes
        if (!this._connectedClock) {
            this._connectedClock = wallClock;
            this._connectedClock?.connectObject(
                'notify::timezone',
                () => {
                    this._updateFormat();
                    this.#updateTime();
                },
                this
            );
        }

        // As dateMenu._clockDisplay updates based on actual wall clock time
        // (instead of using a monotonic timer, which becomes inaccurate e.g.
        // after suspend), trigger regular updates when it updates
        if (!this._connectedClockDisplay) {
            this._connectedClockDisplay = originalClockDisplay;
            let lastSeconds = 0; // Keep track between notifications
            this._connectedClockDisplay?.connectObject(
                'notify::text',
                () => {
                    // Only call _updateTime() if we're actually on a new second/minute
                    let nowSeconds = Date.now(); // Get epoch
                    nowSeconds -= nowSeconds % 1000; // Completed seconds only (in ms)
                    const second = this._second;
                    if (
                        (second === 1 && nowSeconds !== lastSeconds) ||
                        (second === 0 &&
                            nowSeconds - (nowSeconds % 60) !==
                                lastSeconds - (lastSeconds % 60))
                    ) {
                        lastSeconds = nowSeconds;
                        this.#updateTime(nowSeconds);
                    }
                },
                this
            );
        }
    }

    _updateFormat() {
        let locale = this._locale; // Only the extension class may modify this._locale
        let options = { ...this._options }; // Clone, even though this._options is safe to modify
        const indexOfComma = locale?.indexOf(',');
        if (indexOfComma >= 0) {
            // Allow passing in override options as a JSON object after a comma in the locale
            try {
                let overrideString = locale.substring(indexOfComma + 1);
                let overrideOptions =
                    overrideString.length > 0
                        ? JSON.parse(overrideString)
                        : null;
                if (
                    typeof overrideOptions === 'object' &&
                    overrideOptions !== null
                ) {
                    Object.assign(options, overrideOptions);
                    Object.keys(options).forEach((key) => {
                        if (options[key] === null) {
                            delete options[key];
                        }
                    });
                }
            } catch {
                // Probably invalid JSON, just ignore
            }
            locale =
                indexOfComma > 0
                    ? locale.substring(0, indexOfComma)
                    : undefined;
        }
        try {
            this._f = new Intl.DateTimeFormat(locale, options);
        } catch {
            // Perhaps invalid locale string (user input)
            try {
                this._f = new Intl.DateTimeFormat(undefined, options);
            } catch {
                // Or invalid time zone (user input)
                delete options.timeZone;
                try {
                    this._f = new Intl.DateTimeFormat(locale, options);
                } catch {
                    try {
                        this._f = new Intl.DateTimeFormat(locale);
                    } catch {
                        this._f = new Intl.DateTimeFormat();
                    }
                }
            }
        }
    }

    #updateTime(u = false) {
        let now = new Date();
        this.set_text(this._f.format(now));
        this._u = u;
        return now;
    }

    _updateStart() {
        // Only start a new update timeout if there is no existing one
        if (this._t === null) {
            // Function to use for calculating how many ms until next update
            let n = null;
            switch (this._second) {
                case 1: // Second is on - wait up to 1 s
                    n = (now) => 1000 - now.getMilliseconds();
                    break;
                case 2:
                    n = (now) => 100 - (now.getMilliseconds() % 100);
                    break;
                case 3:
                    n = (now) => 10 - (now.getMilliseconds() % 10);
                    break;
                case 4:
                    n = () => 1;
                    break;
                default: // Second is off - wait up to 60 s
                    n = (now) =>
                        1000 -
                        now.getMilliseconds() +
                        Math.max(0, 59 - now.getSeconds()) * 1000;
                    break;
            }

            // Function for checking whether already updated
            const iu = () => {
                if (this._u === false) {
                    return false;
                }
                // Already updated by call to #updateTime() from _connect()
                let s = Date.now();
                s -= s % 1000; // Completed seconds only
                return this._u === s; // Whether update still valid
            };

            // If clock is already updated according to iu(), just wait for the next update
            // using a new timeout. If not updated, then also do an update.
            let c = null; // Timeout callback
            const u = () => {
                if (this._t !== null) {
                    GLib.source_remove(this._t);
                    this._t = null;
                }
                this._t = GLib.timeout_add(
                    GLib.PRIORITY_HIGH,
                    n(iu() ? new Date() : this.#updateTime()), // n: time until next update
                    c // Use this function or optimized function as timeout callback
                );
                return GLib.SOURCE_REMOVE; // Already removed, but also don't set new expiry
            };
            c = u;
            if (this._second === 4) {
                // Optimization for 1 ms updates: keep same timeout running
                c = () => {
                    this.#updateTime();
                    return GLib.SOURCE_CONTINUE;
                };
            }
            u(); // Start
        }
    }

    _updateStop() {
        if (this._t !== null) {
            GLib.source_remove(this._t);
            this._t = null;
        }
        this._u = false; // Clear updated state
    }

    vfunc_unrealize() {
        // Avoid set_text() resulting in a "has been already disposed" error
        this._updateStop(); // Could be restarted if for locked screen and not shutdown
        super.vfunc_unrealize();
    }
}
