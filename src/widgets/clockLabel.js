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

        this.connect('destroy', this._onDestroy.bind(this));
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

    _updateTime(u = false) {
        let now = new Date();
        this.set_text(this._f.format(now));
        this._u = u;
        return now;
    }

    _updateStart() {
        if (typeof this._t !== 'number') {
            let n = null; // Function for next update in ms
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
                    this._updateTime();
                    this._t = GLib.timeout_add(
                        GLib.PRIORITY_HIGH,
                        1,
                        this._updateTime.bind(this)
                    );
                    return;
                default: // Second is off - wait up to 60 s
                    n = (now) =>
                        1000 -
                        now.getMilliseconds() +
                        Math.max(0, 59 - now.getSeconds()) * 1000;
                    break;
            }
            const iu = () => {
                // If updated already by _updateTime() from outside
                if (this._u === false) {
                    return false;
                }
                let s = Date.now();
                s -= s % 1000; // Completed seconds only
                return this._u === s; // If update still valid
            };
            let u;
            if (GLib.timeout_add_once) {
                // Use timeout_add_once if available
                u = () => {
                    this._t = GLib.timeout_add_once(
                        GLib.PRIORITY_HIGH,
                        n(iu() ? new Date() : this._updateTime()),
                        u
                    );
                };
            } else {
                u = () => {
                    try {
                        this._t = GLib.timeout_add(
                            GLib.PRIORITY_HIGH,
                            n(iu() ? new Date() : this._updateTime()),
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
        if (typeof this._t === 'number') {
            GLib.source_remove(this._t);
            this._t = null;
        }
        this._u = false; // Clear updated state
    }

    _onDestroy() {
        this._updateStop();
    }
}
