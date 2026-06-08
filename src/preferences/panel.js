import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

export default class PanelPreferences extends Adw.PreferencesPage {
    static {
        GObject.registerClass(
            {
                GTypeName: 'PanelPreferences',
                Template: GLib.uri_resolve_relative(
                    import.meta.url,
                    '../ui/panel.ui',
                    GLib.UriFlags.NONE
                ),
                InternalChildren: [
                    'x11_warning',
                    'activate_button',
                    'context_button',
                    'window_button',
                    'title_button',
                    'activate_clock',
                    'weekday_clock',
                    'date_clock',
                    'time_clock',
                    'activate_name',
                    'user_name',
                    'host_name',
                    'domain_name',
                ],
            },
            this
        );
    }

    constructor({ settings }) {
        super({});

        const isX11 = GLib.getenv('XDG_SESSION_TYPE') === 'x11';
        this._x11_warning.set_visible(isX11);

        settings.bind(
            'activate-button',
            this._activate_button,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-context',
            this._context_button,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-window',
            this._window_button,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-title',
            this._title_button,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'activate-clock',
            this._activate_clock,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-weekday',
            this._weekday_clock,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-date',
            this._date_clock,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-time',
            this._time_clock,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'activate-name',
            this._activate_name,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-user',
            this._user_name,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-host',
            this._host_name,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'enable-domain',
            this._domain_name,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._updateActivateButton();
        this._updateActivateClock();
        this._updateActivateName();
        this._activate_button.connect('notify::active', () =>
            this._updateActivateButton()
        );
        this._activate_clock.connect('notify::active', () =>
            this._updateActivateClock()
        );
        this._activate_name.connect('notify::active', () =>
            this._updateActivateName()
        );
    }

    _updateActivateButton() {
        let isActive = this._activate_button.get_active();
        this._context_button.set_sensitive(isActive);
        this._window_button.set_sensitive(isActive);
        this._title_button.set_sensitive(isActive);
    }

    _updateActivateClock() {
        let isActive = this._activate_clock.get_active();
        this._weekday_clock.set_sensitive(isActive);
        this._date_clock.set_sensitive(isActive);
        this._time_clock.set_sensitive(isActive);
    }

    _updateActivateName() {
        let isActive = this._activate_name.get_active();
        this._user_name.set_sensitive(isActive);
        this._host_name.set_sensitive(isActive);
        this._domain_name.set_sensitive(isActive);
    }
}
