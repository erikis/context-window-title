import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { getApplicationName, createAboutWindow } from './about.js';

export default class AdvancedPreferences extends Adw.PreferencesPage {
    static {
        GObject.registerClass(
            {
                GTypeName: 'AdvancedPreferences',
                Template: GLib.uri_resolve_relative(
                    import.meta.url,
                    '../ui/advanced.ui',
                    GLib.UriFlags.NONE
                ),
                InternalChildren: [
                    'button_saturation',
                    'button_menu_alignment',
                    'button_ease_time',
                    'button_minimum_width',
                    'button_title_width',
                    'button_padding_width',
                    'button_padding_left',
                    'button_padding_right',
                    'button_icon_size',
                    'button_context_icon',
                    'clock_year',
                    'clock_month',
                    'clock_weekday',
                    'clock_hour',
                    'clock_second',
                    'clock_time_zone_name',
                    'clock_time_zone',
                    'clock_calendar',
                    'clock_numbering',
                    'clock_locale',
                    'name_lock_hide',
                    'message_source_icon',
                    'about',
                    'reset_row',
                    'reset_advanced',
                    'reset_all',
                ],
            },
            this
        );
    }

    constructor({ settings, defaults, metadata, window }) {
        super({});

        const valueForAutomatic = '-1';

        this._button_saturation.set_subtitle(
            this._button_saturation
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonSaturation)
        );
        const saturationSpin = this._button_saturation;
        const saturationRegularSubtitle = saturationSpin.get_subtitle();
        let saturationIsRegular = true;
        saturationSpin.connect('notify::value', () => {
            let symbolicSubtitle = _(
                '!VALUE! for symbolic icon style and !CURRENT!% saturation'
            );
            switch (saturationSpin.get_value()) {
                case -2:
                    saturationSpin.set_subtitle(
                        symbolicSubtitle
                            .replace('!VALUE!', '-2')
                            .replace('!CURRENT!', '100')
                    );
                    saturationIsRegular = false;
                    break;
                case -3:
                    saturationSpin.set_subtitle(
                        symbolicSubtitle
                            .replace('!VALUE!', '-3')
                            .replace('!CURRENT!', '0')
                    );
                    saturationIsRegular = false;
                    break;
                default:
                    if (!saturationIsRegular) {
                        saturationSpin.set_subtitle(saturationRegularSubtitle);
                        saturationIsRegular = true;
                    }
                    break;
            }
        });
        settings.bind(
            'button-saturation',
            this._button_saturation,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_menu_alignment.set_subtitle(
            this._button_menu_alignment
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonMenuAlignment)
        );
        settings.bind(
            'button-menu-alignment',
            this._button_menu_alignment,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_ease_time.set_subtitle(
            this._button_ease_time
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonEaseTime)
        );
        settings.bind(
            'button-ease-time',
            this._button_ease_time,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_minimum_width.set_subtitle(
            this._button_minimum_width
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonMinimumWidth)
        );
        settings.bind(
            'button-minimum-width',
            this._button_minimum_width,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_title_width.set_subtitle(
            this._button_title_width
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
            // No !CURRENT! in this string
        );
        settings.bind(
            'button-title-width',
            this._button_title_width,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_padding_width.set_subtitle(
            this._button_padding_width
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonPaddingWidth)
        );
        settings.bind(
            'button-padding-width',
            this._button_padding_width,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_padding_left.set_subtitle(
            this._button_padding_left
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonPaddingLeft)
        );
        settings.bind(
            'button-padding-left',
            this._button_padding_left,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_padding_right.set_subtitle(
            this._button_padding_right
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonPaddingRight)
        );
        settings.bind(
            'button-padding-right',
            this._button_padding_right,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_icon_size.set_subtitle(
            this._button_icon_size
                .get_subtitle()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonIconSize)
        );
        settings.bind(
            'button-icon-size',
            this._button_icon_size,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._button_context_icon.set_title(
            this._button_context_icon
                .get_title()
                .replace('!VALUE!', valueForAutomatic)
                .replace('!CURRENT!', defaults.buttonContextIcon)
        );
        settings.bind(
            'button-context-icon',
            this._button_context_icon,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-year',
            this._clock_year,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-month',
            this._clock_month,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-weekday',
            this._clock_weekday,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-hour',
            this._clock_hour,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-second',
            this._clock_second,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-time-zone-name',
            this._clock_time_zone_name,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'clock-time-zone',
            this._clock_time_zone,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        const calendarDropdown = this._clock_calendar;
        const calendarModel = calendarDropdown.model; // a GtkStringList in advanced.ui
        const selectedCalendar = settings.get_string('clock-calendar');
        let calendarIndex = 0;
        Intl.supportedValuesOf('calendar').forEach((calendar, index) => {
            calendarModel.append(calendar);
            if (calendar === selectedCalendar) {
                calendarIndex = index + 1;
            }
        });
        if (selectedCalendar.length > 0 && calendarIndex === 0) {
            settings.set_string('clock-calendar', ''); // Unknown calendar - set to default
        }
        calendarDropdown.set_selected(calendarIndex);
        calendarDropdown.connect('notify::selected-item', () => {
            settings.set_string(
                'clock-calendar',
                calendarDropdown.get_selected() === 0
                    ? ''
                    : calendarDropdown.get_selected_item().get_string()
            );
        });

        const numberingDropdown = this._clock_numbering;
        const numberingModel = numberingDropdown.model; // a GtkStringList in advanced.ui
        const selectedNumbering = settings.get_string('clock-numbering');
        let numberingIndex = 0;
        Intl.supportedValuesOf('numberingSystem').forEach(
            (numbering, index) => {
                numberingModel.append(numbering);
                if (numbering === selectedNumbering) {
                    numberingIndex = index + 1;
                }
            }
        );
        if (selectedNumbering.length > 0 && numberingIndex === 0) {
            settings.set_string('clock-numbering', ''); // Unknown numbering - set to default
        }
        numberingDropdown.set_selected(numberingIndex);
        numberingDropdown.connect('notify::selected-item', () => {
            settings.set_string(
                'clock-numbering',
                numberingDropdown.get_selected() === 0
                    ? ''
                    : numberingDropdown.get_selected_item().get_string()
            );
        });

        this._clock_locale.set_title(
            this._clock_locale
                .get_title()
                .replace('!CURRENT!', defaults.timeLocale)
        );
        settings.bind(
            'clock-locale',
            this._clock_locale,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.bind(
            'name-lock-hide',
            this._name_lock_hide,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._message_source_icon.set_title(
            this._message_source_icon
                .get_title()
                .replace('!CURRENT!', defaults.messageSourceIcon)
        );
        settings.bind(
            'message-source-icon',
            this._message_source_icon,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._about.set_label(
            this._about.get_label().replace('!NAME!', getApplicationName())
        );

        const ui = { calendarDropdown, numberingDropdown };
        this._about.connect('clicked', () =>
            createAboutWindow({ metadata, window }).show()
        );
        this._reset_advanced.connect('clicked', () =>
            this._reset(settings, false, ui)
        );
        this._reset_all.connect('clicked', () =>
            this._reset(settings, true, ui)
        );
    }

    _reset(settings, isAll, ui) {
        let keysOther = [
            'activate-button',
            'enable-context',
            'enable-window',
            'enable-title',
            'activate-clock',
            'enable-weekday',
            'enable-date',
            'enable-time',
            'activate-name',
            'enable-user',
            'enable-host',
            'enable-domain',
            'activate-message',
            'message-source-title',
            'message-title',
            'message-body',
        ];
        let keysAdvanced = [
            'button-saturation',
            'button-menu-alignment',
            'button-ease-time',
            'button-minimum-width',
            'button-title-width',
            'button-padding-width',
            'button-padding-left',
            'button-padding-right',
            'button-icon-size',
            'button-context-icon',
            'clock-year',
            'clock-month',
            'clock-weekday',
            'clock-hour',
            'clock-second',
            'clock-time-zone-name',
            'clock-time-zone',
            'clock-locale',
            'name-lock-hide',
            'message-source-icon',
        ];
        (isAll ? keysOther.concat(keysAdvanced) : keysAdvanced).forEach((key) =>
            settings.reset(key)
        );

        // Update those without bindings via UI objects instead
        ui.calendarDropdown.set_selected(0);
        ui.numberingDropdown.set_selected(0);

        // Hide the reset buttons to indicate that something happened
        this._reset_row.set_expanded(false);
    }
}
