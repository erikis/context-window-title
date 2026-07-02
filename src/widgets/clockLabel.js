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
        this._updateStop();

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
                    // this._options is safe to modify
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
        // Only start a new update timeout if there is no existing one.
        // Therefore, there is no existing timeout to remove first.
        // If there is no timeout, then this method will decide the best implementation.
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
                    // Optimization: instead of n => 1, repeat the same timeout
                    this.#updateTime();
                    // Initially there is no timeout (see beginning of this method)
                    // so there is no none to remove.
                    // Create a simple update timeout which just keeps running until stopped.
                    this._t = GLib.timeout_add(
                        GLib.PRIORITY_HIGH,
                        1,
                        this.#updateTime.bind(this)
                    );
                    return; // We're already done creating an update timeout
                default: // Second is off - wait up to 60 s
                    n = (now) =>
                        1000 -
                        now.getMilliseconds() +
                        Math.max(0, 59 - now.getSeconds()) * 1000;
                    break;
            }

            // Function for checking whether already updated
            const iu = () => {
                // If updated already by _updateTime() from outside
                if (this._u === false) {
                    return false;
                }
                let s = Date.now();
                s -= s % 1000; // Completed seconds only
                return this._u === s; // If update still valid
            };

            // Create update timeout using timeout_add_once if available, otherwise timeout_add.
            // If clock is already updated according to iu(), just wait for the next update
            // using a new timeout. If not updated, then also do an update. Initially there is
            // no timeout (see beginning of this method) so there is none to remove.
            let u;
            if (GLib.timeout_add_once) {
                u = () => {
                    // Using timeout_add_once so the current timeout doesn't need to be removed
                    this._t = null; // In case of error adding the new timeout
                    this._t = GLib.timeout_add_once(
                        GLib.PRIORITY_HIGH,
                        n(iu() ? new Date() : this.#updateTime()),
                        u
                    );
                };
            } else {
                u = () => {
                    try {
                        // The current timeout is removed by returning GLib.SOURCE_REMOVE below
                        this._t = null; // In case of error adding the new timeout
                        this._t = GLib.timeout_add(
                            GLib.PRIORITY_HIGH,
                            n(iu() ? new Date() : this.#updateTime()),
                            u
                        );
                    } catch {
                        // Just remove the timeout
                    }
                    return GLib.SOURCE_REMOVE;
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
}
