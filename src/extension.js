/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 * SPDX-FileCopyrightText: Copyright (c) 2026 Erik Isaksson
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import ClockLabel from './widgets/clockLabel.js';
import ContextButton from './widgets/contextButton.js';
import Defaults from './preferences/defaults.js';
import LockMessage from './widgets/lockMessage.js';
import NameIndicator from './widgets/nameIndicator.js';

const NAME = 'ContextWindowTitle ContextExtension'; // Used for console log
const MENU_KEYBINDING = 'context-window-title-menu-keybinding'; // Keybinding name in the schema

export default class ContextExtension extends Extension {
    #settings = null;
    #defaults = null;
    #sessionMode = null;
    #isLogging = false;
    #allKeybindings = [];
    #contextButton = null;
    #clockLabel = null;
    #originalClockDisplay = null;
    #nameIndicator = null;
    #lockMessage = null;

    _log(to, ...args) {
        // Only write to the log if enabled in settings
        if (this.#isLogging) {
            to.apply(console, args);
        }
    }

    enable() {
        if (!this.#settings) {
            this.#settings = this.getSettings();
            // Also set in #onSettings() but do it early here in case something is logged
            this.#isLogging = this.#settings.get_boolean('allow-log');
        }
        if (!this.#defaults) {
            this.#defaults = new Defaults();
        }
        this.#onSessionMode(); // This will initialize everything

        this.#settings.connectObject(
            'changed',
            () => this.#onSettings(),
            GObject.ConnectFlags.AFTER,
            this
        );
        Main.sessionMode.connectObject(
            'updated',
            () => this.#onSessionMode(),
            GObject.ConnectFlags.AFTER,
            this
        );
    }

    disable() {
        // This extension uses unlock-dialog so that:
        //  - The user/host name indicator (nameIndicator) can remain visible on the lock screen.
        //  - The lock screen message (lockMessage) can be added to the lock screen.
        // The custom clock (clockLabel) also remains while on lock screen but updates are paused
        // as the clock is not visible at that time.
        // The context button (contextButton) is destroyed and not visible on the lock screen.
        // No keybindings are in use on the lock screen.

        this.#settings?.disconnectObject(this);
        Main.sessionMode.disconnectObject(this);

        this.#removeAllKeybindings();

        this.#contextButton?.destroy();
        this.#contextButton = null;

        this.#clockLabel?.destroy();
        this.#clockLabel = null;
        this.#restoreOriginalClock();

        this.#nameIndicator?.destroy();
        this.#nameIndicator = null;

        this.#lockMessage?.destroy();
        this.#lockMessage = null;

        this.#settings = null;
        this.#defaults = null;
    }

    #onSessionMode() {
        // currentMode may be e.g. 'ubuntu' so check parentMode too
        const mode =
            Main.sessionMode.parentMode === 'user'
                ? 'user'
                : Main.sessionMode.currentMode;
        this.#sessionMode = mode;

        // User session mode (or, in theory, GDM session mode)
        if (mode === 'user' /*|| mode === 'gdm'*/) {
            this.#onSettings(); // This will instantiate the context button, etc.
        } else {
            this.#removeAllKeybindings(); // Remove all keybindings on lock screen
            this.#contextButton?.destroy();
            this.#contextButton = null;
            try {
                if (this.#nameIndicator) {
                    this.#nameIndicator._sessionMode = mode;
                    if (this.#nameIndicator._lockHide > 0) {
                        this.#nameIndicator._update();
                    }
                }
            } catch (ex) {
                this._log(
                    console.error,
                    `${NAME} nameIndicator _update on sessionMode`,
                    ex
                );
            }
        }

        // Unlock dialog session mode
        if (mode === 'unlock-dialog') {
            this.#onSessionModeUnlockDialog();
        } else {
            // As the lock screen is closed the message should have been destroyed
            this.#lockMessage = null;
        }
    }

    #removeAllKeybindings() {
        let keybinding;
        while ((keybinding = this.#allKeybindings.pop())) {
            Main.wm.removeKeybinding(keybinding);
        }
    }

    #removeKeybinding(keybinding) {
        let index = this.#allKeybindings.indexOf(keybinding);
        if (index !== -1) {
            Main.wm.removeKeybinding(keybinding);
            this.#allKeybindings.splice(index, 1);
        }
    }

    #onSessionModeUnlockDialog() {
        // Lock screen message
        try {
            const isMessageActivated =
                this.#settings.get_boolean('activate-message');
            if (isMessageActivated && this.#lockMessage === null) {
                let sourceIcon = this.#settings.get_string(
                    'message-source-icon'
                );
                if (sourceIcon.length === 0) {
                    sourceIcon = this.#defaults.messageSourceIcon;
                }
                this.#lockMessage = new LockMessage({
                    sourceIcon,
                    sourceTitle: this.#settings.get_string(
                        'message-source-title'
                    ),
                    title: this.#settings.get_string('message-title'),
                    body: this.#settings.get_string('message-body'),
                });
                const notificationsBox =
                    Main.screenShield._dialog?._notificationsBox;
                notificationsBox?._notificationBox.insert_child_at_index(
                    this.#lockMessage,
                    0
                );
                notificationsBox?._updateVisibility();
            } else if (!isMessageActivated && this.#lockMessage !== null) {
                this.#lockMessage = null;
            }
        } catch (ex) {
            this._log(
                console.error,
                `${NAME} lockMessage activate on sessionMode`,
                ex
            );
        }
    }

    #onSettings() {
        // Already set in enable() but in case the value was changed
        this.#isLogging = this.#settings.get_boolean('allow-log');

        // Break up in handlers per widget and don't let errors in one break the others

        // Context button
        try {
            this.#onSettingsContext();
        } catch (ex) {
            this._log(console.error, `${NAME} contextButton on settings`, ex);
        }

        // Custom clock
        try {
            this.#onSettingsClock();
        } catch (ex) {
            this._log(console.error, `${NAME} clockLabel on settings`, ex);
        }

        // User/host name
        try {
            this.#onSettingsName();
        } catch (ex) {
            this._log(console.error, `${NAME} nameIndicator on settings`, ex);
        }
    }

    #onSettingsContext() {
        const isButtonActivated = this.#settings.get_boolean('activate-button');
        const isContextButton = this.#settings.get_boolean('enable-context');
        const isWindowButton = this.#settings.get_boolean('enable-window');
        const isTitleButton = this.#settings.get_boolean('enable-title');
        let isAdding = false;
        if (
            this.#sessionMode === 'user' &&
            isButtonActivated &&
            (isTitleButton || isContextButton || isWindowButton)
        ) {
            if (!this.#contextButton) {
                this.#contextButton = new ContextButton();
                isAdding = true;
            }
        } else {
            this.#removeKeybinding(MENU_KEYBINDING);
            this.#contextButton?.destroy();
            this.#contextButton = null;
        }
        if (this.#contextButton) {
            let isModified = false;
            if (this.#contextButton._isTitleButton !== isTitleButton) {
                isModified = true;
                this.#contextButton._isTitleButton = isTitleButton;
            }
            if (this.#contextButton._isContextButton !== isContextButton) {
                isModified = true;
                this.#contextButton._isContextButton = isContextButton;
            }
            if (this.#contextButton._isWindowButton !== isWindowButton) {
                isModified = true;
                this.#contextButton._isWindowButton = isWindowButton;
            }
            this.#onSettingsContextConfigure({ isAdding, isModified });
        }
    }

    // Break up into multiple, chained functions for readability, isolation,
    // and keeping ESLint happy
    #onSettingsContextConfigure({ isAdding, isModified }) {
        let saturation = this.#settings.get_int('button-saturation');
        if (saturation === -1 || saturation < -3) {
            saturation = this.#defaults.buttonSaturation;
        }
        if (this.#contextButton._saturation !== saturation) {
            this.#contextButton._saturation = saturation;
            const isSymbolic = saturation < 0; // Symbolic icon setting -2/-3
            if (isSymbolic) {
                saturation = saturation === -3 ? 0 : 100; // -3 for desaturation too
            }
            if (saturation < 100) {
                if (!this.#contextButton._desaturate) {
                    this.#contextButton._desaturate =
                        new Clutter.DesaturateEffect();
                    this.#contextButton.add_effect(
                        this.#contextButton._desaturate
                    );
                }
                this.#contextButton._desaturate.set_factor(
                    (100 - saturation) / 100
                );
            } else if (this.#contextButton._desaturate) {
                this.#contextButton.remove_effect(
                    this.#contextButton._desaturate
                );
                this.#contextButton._desaturate = null;
            }
            if (this.#contextButton._isSymbolic !== isSymbolic) {
                this.#contextButton._isSymbolic = isSymbolic;
                isModified = true;
            }
        }
        let menuAlignment = this.#settings.get_int('button-menu-alignment');
        if (menuAlignment < 0) {
            menuAlignment = this.#defaults.buttonMenuAlignment;
        }
        if (this.#contextButton._menuAlignment !== menuAlignment) {
            this.#contextButton._menuAlignment = menuAlignment;
            if (menuAlignment <= 100) {
                this.#contextButton._appMenu.setSourceAlignment(
                    menuAlignment / 100
                );
            } else {
                this.#contextButton._appMenu.setSourceAlignment(0.5);
            }
        }
        let easeTime = this.#settings.get_int('button-ease-time');
        if (easeTime < 0 || easeTime > 1000) {
            easeTime = this.#defaults.buttonEaseTime;
        }
        this.#contextButton._easeTime = easeTime;
        let minimumWidth = this.#settings.get_int('button-minimum-width');
        if (minimumWidth < 0 || minimumWidth > 9999) {
            minimumWidth = this.#defaults.buttonMinimumWidth;
        }
        if (this.#contextButton._minimumWidth !== minimumWidth) {
            this.#contextButton._minimumWidth = minimumWidth;
            this.#contextButton.set({
                min_width: minimumWidth > 0 ? minimumWidth : 1,
                min_width_set: minimumWidth > 0,
            });
        }
        this.#onSettingsContextConfigureComponents({ isAdding, isModified });
    }

    #onSettingsContextConfigureComponents({ isAdding, isModified }) {
        let titleWidth = this.#settings.get_int('button-title-width');
        if (titleWidth < 0 || titleWidth > 9999) {
            titleWidth = -1; // Dynamic
        }
        if (this.#contextButton._titleWidth !== titleWidth) {
            this.#contextButton._titleWidth = titleWidth;
            this.#contextButton._title.set_width(titleWidth);
            this.#contextButton._updateTitle(); // To show/hide padding
        }
        let paddingWidth = this.#settings.get_int('button-padding-width');
        if (paddingWidth < 0 || paddingWidth > 32) {
            paddingWidth = this.#defaults.buttonPaddingWidth;
        }
        if (this.#contextButton._paddingWidth !== paddingWidth) {
            this.#contextButton._paddingWidth = paddingWidth;
            this.#contextButton._padding.set_width(paddingWidth);
        }
        let paddingLeft = this.#settings.get_int('button-padding-left');
        if (paddingLeft < 0 || paddingWidth > 32) {
            paddingLeft = this.#defaults.buttonPaddingLeft;
        }
        let paddingRight = this.#settings.get_int('button-padding-right');
        if (paddingRight < 0 || paddingRight > 32) {
            paddingRight = this.#defaults.buttonPaddingRight;
        }
        if (
            this.#contextButton._paddingLeft !== paddingLeft ||
            this.#contextButton._paddingRight !== paddingRight
        ) {
            this.#contextButton._paddingLeft = paddingLeft;
            this.#contextButton._paddingRight = paddingRight;
            this.#contextButton._box.set_style(
                `padding-left: ${paddingLeft}px; padding-right: ${paddingRight}px`
            );
        }
        this.#onSettingsContextConfigureIcon({ isAdding, isModified });
    }

    #onSettingsContextConfigureIcon({ isAdding, isModified }) {
        let iconSize = this.#settings.get_int('button-icon-size');
        if (iconSize < 0 || iconSize > 32) {
            iconSize = this.#defaults.buttonIconSize;
        }
        if (this.#contextButton._iconSize !== iconSize) {
            this.#contextButton._iconSize = iconSize;
            this.#contextButton._icon.set_icon_size(iconSize);
            this.#contextButton._newIcon?.set_icon_size(iconSize);
            if (!isAdding) {
                iconSize > 0
                    ? this.#contextButton._icon.show()
                    : this.#contextButton._icon.hide();
            }
        }
        let contextIcon = this.#settings.get_string('button-context-icon');
        if (contextIcon.length === 0) {
            contextIcon = this.#defaults.buttonContextIcon;
        }
        if (this.#contextButton._contextIcon !== contextIcon) {
            this.#contextButton._contextIcon = contextIcon;
            if (!isAdding) {
                this.#contextButton._updateContextIcon();
            }
        }
        const iconChange = this.#settings.get_int('button-icon-change');
        if (this.#contextButton._iconChange !== iconChange) {
            this.#contextButton._iconChange = iconChange;
            isModified = true;
        }
        this.#onSettingsContextConfigureBehavior({ isAdding, isModified });
    }

    #onSettingsContextConfigureBehavior({ isAdding, isModified }) {
        const isWindowsToggle = this.#settings.get_boolean(
            'button-windows-toggle'
        );
        if (this.#contextButton._isWindowsToggle !== isWindowsToggle) {
            this.#contextButton._isWindowsToggle = isWindowsToggle;
            if (!isAdding) {
                this.#contextButton._updateContextIcon();
            }
        }
        this.#contextButton._isOverviewScroll = this.#settings.get_boolean(
            'button-overview-scroll'
        );
        this.#contextButton._isDesktopScroll = this.#settings.get_boolean(
            'button-desktop-scroll'
        );
        this.#onSettingsContextAddOrModify({ isAdding, isModified });
    }

    #onSettingsContextAddOrModify({ isAdding, isModified }) {
        if (isAdding) {
            Main.panel.addToStatusArea(
                'context-window-title',
                this.#contextButton,
                -1,
                'left'
            );
            const keybindingName = MENU_KEYBINDING;
            if (this.#allKeybindings.indexOf(keybindingName) === -1) {
                const keybindingAction = Main.wm.addKeybinding(
                    keybindingName,
                    this.#settings, // Current keybinding is read from the settings
                    Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                    Shell.ActionMode.NORMAL |
                        Shell.ActionMode.OVERVIEW |
                        Shell.ActionMode.POPUP,
                    () => {
                        // When opening the menu, automatically focus first menu item
                        this.#contextButton?._toggleMenu(true);
                    }
                );
                // Return value is Meta.KeyBindingAction.NONE if add was unsuccessful
                if (keybindingAction !== Meta.KeyBindingAction.NONE) {
                    // Save the keybinding name for later removal
                    this.#allKeybindings.push(keybindingName);
                }
            }
        }
        if (isAdding || isModified) {
            // Run _update() after adding to avoid "not on stage" errors
            this.#contextButton._update();
        }
    }

    #onSettingsClock() {
        const isClockActivated = this.#settings.get_boolean('activate-clock');
        const isWeekdayClock = this.#settings.get_boolean('enable-weekday');
        const isDateClock = this.#settings.get_boolean('enable-date');
        const isTimeClock = this.#settings.get_boolean('enable-time');
        let isAdding = false;
        if (
            isClockActivated &&
            (isWeekdayClock || isDateClock || isTimeClock)
        ) {
            if (!this.#clockLabel) {
                this.#clockLabel = new ClockLabel();
                isAdding = true;
            }
        } else {
            this.#clockLabel?.destroy();
            this.#clockLabel = null;
            this.#restoreOriginalClock();
        }
        if (this.#clockLabel) {
            let isModified = false;
            if (this.#clockLabel._isWeekdayClock !== isWeekdayClock) {
                isModified = true;
                this.#clockLabel._isWeekdayClock = isWeekdayClock;
            }
            if (this.#clockLabel._isDateClock !== isDateClock) {
                isModified = true;
                this.#clockLabel._isDateClock = isDateClock;
            }
            if (this.#clockLabel._isTimeClock !== isTimeClock) {
                isModified = true;
                this.#clockLabel._isTimeClock = isTimeClock;
            }
            this.#onSettingsClockConfigure({
                isAdding,
                isModified,
                isWeekdayClock,
                isDateClock,
                isTimeClock,
            });
        }
    }

    #onSettingsClockConfigure({
        isAdding,
        isModified,
        isWeekdayClock,
        isDateClock,
        isTimeClock,
    }) {
        const opt = {}; // Options for Intl.DateTimeFormat
        this.#clockLabel._options = opt;
        if (isDateClock) {
            opt.day = 'numeric';
        }
        if (isTimeClock) {
            opt.hour = 'numeric';
            opt.minute = 'numeric';
        }
        let year = this.#settings.get_int('clock-year');
        if (!isDateClock || year < 0 || year > 3) {
            year = 0;
        }
        if (this.#clockLabel._year !== year) {
            this.#clockLabel._year = year;
            isModified = true;
        }
        if (year > 0) {
            opt.year = 'numeric';
        }
        if (year > 1) {
            opt.era = 'short';
        }
        let month = this.#settings.get_int('clock-month');
        if (month < 0 || month > 2) {
            month = 0;
        }
        if (this.#clockLabel._month !== month) {
            this.#clockLabel._month = month;
            isModified = true;
        }
        if (isDateClock) {
            opt.month = 'short'; // default
            if (month > 0) {
                opt.month = month === 1 ? 'long' : 'numeric';
            }
        }
        this.#onSettingsClockConfigureAdvanced({
            isAdding,
            isModified,
            isWeekdayClock,
            isTimeClock,
            opt,
        });
    }

    #onSettingsClockConfigureAdvanced({
        isAdding,
        isModified,
        isWeekdayClock,
        isTimeClock,
        opt,
    }) {
        let weekday = this.#settings.get_int('clock-weekday');
        if (weekday < 0 || weekday > 2) {
            weekday = 0;
        }
        if (this.#clockLabel._weekday !== weekday) {
            this.#clockLabel._weekday = weekday;
            isModified = true;
        }
        if (isWeekdayClock) {
            opt.weekday = 'short'; // default
            if (weekday > 0) {
                opt.weekday = weekday === 1 ? 'long' : 'narrow';
            }
        }
        let hour = this.#settings.get_int('clock-hour');
        if (!isTimeClock || hour < 0 || hour > 2) {
            hour = 0;
        }
        if (this.#clockLabel._hour !== hour) {
            this.#clockLabel._hour = hour;
            isModified = true;
        }
        if (hour > 0) {
            opt.hour12 = hour === 1; // If false, force 24h
        }
        let second = this.#settings.get_int('clock-second');
        if (!isTimeClock || second < 0 || second > 4) {
            second = 0;
        }
        if (this.#clockLabel._second !== second) {
            this.#clockLabel._second = second;
            isModified = true;
        }
        if (second > 0) {
            opt.second = '2-digit';
        }
        if (second > 1) {
            opt.fractionalSecondDigits = second - 1;
        }
        this.#onSettingsClockConfigureExtra({
            isAdding,
            isModified,
            isTimeClock,
            opt,
        });
    }

    #onSettingsClockConfigureExtra({ isAdding, isModified, isTimeClock, opt }) {
        let timeZoneName = this.#settings.get_int('clock-time-zone-name');
        if (!isTimeClock || timeZoneName < 0 || timeZoneName > 3) {
            timeZoneName = 0;
        }
        if (this.#clockLabel._timeZoneName !== timeZoneName) {
            this.#clockLabel._timeZoneName = timeZoneName;
            isModified = true;
        }
        if (timeZoneName > 0) {
            opt.timeZoneName =
                timeZoneName === 1
                    ? 'short'
                    : timeZoneName === 2
                      ? 'shortOffset'
                      : 'longOffset';
        }
        let timeZone = this.#settings.get_string('clock-time-zone');
        if (this.#clockLabel._timeZone !== timeZone) {
            this.#clockLabel._timeZone = timeZone;
            isModified = true;
        }
        if (timeZone.length > 0) {
            opt.timeZone = timeZone;
        }
        let calendar = this.#settings.get_string('clock-calendar');
        if (this.#clockLabel._calendar !== calendar) {
            this.#clockLabel._calendar = calendar;
            isModified = true;
        }
        if (calendar.length > 0) {
            opt.calendar = calendar;
        }
        let numbering = this.#settings.get_string('clock-numbering');
        if (this.#clockLabel._numbering !== numbering) {
            this.#clockLabel._numbering = numbering;
            isModified = true;
        }
        if (numbering.length > 0) {
            opt.numberingSystem = numbering;
        }
        let locale = this.#settings.get_string('clock-locale');
        if (locale.length === 0) {
            locale = this.#defaults.timeLocale;
        }
        if (this.#clockLabel._locale !== locale) {
            this.#clockLabel._locale = locale;
            isModified = true;
        }
        this.#onSettingsClockAddOrModify({ isAdding, isModified });
    }

    #onSettingsClockAddOrModify({ isAdding, isModified }) {
        if (isAdding || isModified) {
            this.#clockLabel._updateFormat();
        }
        if (isAdding) {
            this.#clockLabel._updateStart();
            const dateMenu = Main.panel.statusArea.dateMenu;
            this.#originalClockDisplay = dateMenu._clockDisplay;
            this.#originalClockDisplay?.hide();
            this.#originalClockDisplay
                ?.get_parent()
                .insert_child_at_index(this.#clockLabel, 0);
            this.#clockLabel._connect(
                dateMenu._clock,
                this.#originalClockDisplay
            );
        } else if (isModified) {
            this.#clockLabel._updateStop();
            this.#clockLabel._updateStart();
        }
    }

    #restoreOriginalClock() {
        const originalClockDisplay = this.#originalClockDisplay;
        this.#originalClockDisplay = null;
        try {
            originalClockDisplay?.show();
        } catch (ex) {
            this._log(console.error, `${NAME} #restoreOriginalClock`, ex);
        }
    }

    #onSettingsName() {
        const isNameActivated = this.#settings.get_boolean('activate-name');
        const isUserName = this.#settings.get_boolean('enable-user');
        const isHostName = this.#settings.get_boolean('enable-host');
        const isDomainName = this.#settings.get_boolean('enable-domain');
        let isAdding = false;
        if (isNameActivated && (isUserName || isHostName || isDomainName)) {
            if (!this.#nameIndicator) {
                this.#nameIndicator = new NameIndicator();
                isAdding = true;
            }
        } else {
            this.#nameIndicator?.destroy();
            this.#nameIndicator = null;
        }
        if (this.#nameIndicator) {
            let isModified = false;
            if (this.#nameIndicator._isUserName !== isUserName) {
                isModified = true;
                this.#nameIndicator._isUserName = isUserName;
            }
            if (this.#nameIndicator._isHostName !== isHostName) {
                isModified = true;
                this.#nameIndicator._isHostName = isHostName;
            }
            if (this.#nameIndicator._isHost_isDomainNameName !== isDomainName) {
                isModified = true;
                this.#nameIndicator._isDomainName = isDomainName;
            }
            if (this.#nameIndicator._sessionMode !== this.#sessionMode) {
                isModified = true;
                this.#nameIndicator._sessionMode = this.#sessionMode;
            }
            this.#onSettingsNameConfigure({ isAdding, isModified });
        }
    }

    #onSettingsNameConfigure({ isAdding, isModified }) {
        let lockHide = this.#settings.get_int('name-lock-hide');
        if (lockHide < 0 || lockHide > 2) {
            lockHide = 1; // 1 = hide
        }
        if (this.#nameIndicator._lockHide !== lockHide) {
            this.#nameIndicator._lockHide = lockHide;
            isModified = true;
        }
        this.#onSettingsNameAddOrModify({ isAdding, isModified });
    }

    #onSettingsNameAddOrModify({ isAdding, isModified }) {
        if (isAdding || isModified) {
            this.#nameIndicator._update();
        }
        if (isAdding) {
            Main.panel.statusArea.quickSettings.addExternalIndicator(
                this.#nameIndicator
            );
        }
    }
}
