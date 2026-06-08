import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LockPreferences extends Adw.PreferencesPage {
    static {
        GObject.registerClass(
            {
                GTypeName: 'LockPreferences',
                Template: GLib.uri_resolve_relative(
                    import.meta.url,
                    '../ui/lock.ui',
                    GLib.UriFlags.NONE
                ),
                InternalChildren: [
                    'activate_message',
                    'message_preferences',
                    'message_source_title',
                    'message_title',
                    'message_body',
                ],
            },
            this
        );
    }

    constructor({ settings }) {
        super({});

        settings.bind(
            'activate-message',
            this._activate_message,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'message-source-title',
            this._message_source_title,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'message-title',
            this._message_title,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind(
            'message-body',
            this._message_body,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._updateActivateMessage(settings);
        this._activate_message.connect('notify::active', () =>
            this._updateActivateMessage(settings)
        );
    }

    _updateActivateMessage() {
        let isActive = this._activate_message.get_active();
        if (isActive) {
            if (this._message_source_title.get_text_length() === 0) {
                // prettier-ignore
                this._message_source_title.set_text(
                    /* Keep English version followed by slash, e.g.,
                    "Locked/Gesperrt" */
                    _("Locked")
                );
            }
            if (this._message_title.get_text_length() === 0) {
                // prettier-ignore
                this._message_title.set_text(
                    /* Keep English version followed by slash, e.g.,
                    "If found/Falls gefunden" */
                    _("If found")
                );
            }
            if (this._message_body.get_text_length() === 0) {
                // prettier-ignore
                this._message_body.set_text(
                    /* Keep English version followed by slash, e.g.,
                   "Please contact the owner/Kontaktieren Sie bitte den Besitzer:" */
                    _("Please contact the owner:")
                );
            }
        }
        this._message_source_title.set_sensitive(isActive);
        this._message_title.set_sensitive(isActive);
        this._message_body.set_sensitive(isActive);
    }
}
