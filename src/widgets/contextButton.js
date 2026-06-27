import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { WindowMenu } from 'resource:///org/gnome/shell/ui/windowMenu.js';

const GNOME_POST_49 = parseInt(Config.PACKAGE_VERSION) >= 49;

export default class ContextButton extends PanelMenu.Button {
    static {
        GObject.registerClass(this);
    }

    _init() {
        super._init(0, null, true); // true for dontCreateMenu

        this._isTitleButton = false;
        this._isContextButton = false;
        this._isWindowButton = false;
        this._isConnected = false;
        this._isUpdating = false;
        this._isDirty = false;
        this._focusWindow = null;

        // X11 compatbility mode
        this._isX11 = GLib.getenv('XDG_SESSION_TYPE') === 'x11';

        // Prevent squeezing of the padding when the title is too long
        // In gnome-shell's data/theme/gnome-shell-sass/widgets/_panel.scss:
        // -natural-hpadding: $base_padding * 2;
        // -minimum-hpadding: $base_padding;
        // where: $base_padding: 6px;
        // Reduce the 'natural' padding to the 'minimum', which can be compensated
        // by adding a default of 6px internal padding left and right
        this.set_style('-minimum-hpadding: 6px; -natural-hpadding: 6px');

        this._appMenu = new AppMenu(this);
        Main.panel.menuManager.addMenu(this._appMenu);
        const updateMenu = this._patchAppMenu(this._appMenu);
        this.setMenu(this._appMenu);

        this._box = new St.BoxLayout({
            style: 'padding-left: 6px; padding-right: 6px',
        });
        this._fallbackIcon = new Gio.ThemedIcon({
            name: 'application-x-sharedlib-symbolic',
        });
        this._icon = new St.Icon({ fallback_gicon: this._fallbackIcon });
        this._icon.hide(); // Hide initially to not show fallback icon briefly
        this._box.add_child(this._icon);
        this._padding = new St.Label();
        this._box.add_child(this._padding);
        this._title = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        this._box.add_child(this._title);
        this.add_child(this._box);
        this._maxTitleWidth = -1;

        // GNOME 49+ has Clutter.ClickGesture
        if (Clutter.ClickGesture) {
            if (this._clickGesture) {
                this.remove_action(this._clickGesture);
            }
            this._clickGesture = new Clutter.ClickGesture();
            this._clickGesture.connectObject(
                'recognize',
                (gesture) => this._onClick(gesture, true),
                this
            );
            this.add_action(this._clickGesture);
        }
        this.connectObject(
            'scroll-event',
            (actor, event) => this._onScroll(event),
            this
        );

        this._appMenu.connectObject(
            'open-state-changed',
            (menu, open) => {
                if (open) {
                    if (updateMenu) {
                        updateMenu();
                    }
                } else {
                    if (this._isX11) {
                        // For X11, run postponed update on menu close
                        this.#update();
                    }
                }
            },
            this
        );
    }

    _onDestroy() {
        // While calling disconnectObject when the object (this)
        // is being destroyed is unnecessary, do it anyway...
        // (just to more easily keep track of what's going on)
        // For documentation, see gnome-shell's js/misc/signalTracker.js

        // These are connected in _init()
        if (Clutter.ClickGesture) {
            this._clickGesture?.disconnectObject(this); // Used for 'recognize'
            this._clickGesture = null;
        }
        this.disconnectObject(this); // Used for 'scroll-event'
        if (this._connectedDisplay) {
            // Used for 'notify::focus-window'
            this._connectedDisplay.disconnectObject(this);
            this._connectedDisplay = null;
        }
        this._isConnected = false;
        this._windowMenu = null; // Submenu of the app menu
        if (this._appMenu) {
            this._appMenu.disconnectObject(this); // Used for 'open-state-changed'
            Main.panel.menuManager.removeMenu(this._appMenu);
            // The app menu is destroyed by super._onDestroy()
            this._appMenu = null;
        }

        // These are connected in #updateDo()
        if (this._focusWindow) {
            this._focusWindow.disconnectObject(this); // Used for 'notify::title'
            this._focusWindow = null;
        }
        if (this._connectedShowAppsButton) {
            // Used for 'notify::checked'
            this._connectedShowAppsButton.disconnectObject(this);
            this._connectedShowAppsButton = null;
        }
        if (this._connectedOverview) {
            // Used for 'hiding' and 'showing'
            this._connectedOverview.disconnectObject(this);
            this._connectedOverview = null;
        }

        super._onDestroy();
    }

    _patchAppMenu(appMenu) {
        // Compatibility checks
        if (
            !(
                typeof appMenu._updateWindowsSection === 'function' &&
                appMenu._windowSection instanceof PopupMenu.PopupMenuSection &&
                appMenu._openWindowsHeader instanceof
                    PopupMenu.PopupSeparatorMenuItem
            )
        ) {
            return null; // Unsupported - stop here
        }

        // Convert "Open Windows" from a section to a submenu
        const openWindowsMenuItem = new PopupMenu.PopupSubMenuMenuItem(
            appMenu._openWindowsHeader.label.text,
            false
        );
        appMenu.addMenuItem(openWindowsMenuItem, 0);
        appMenu._windowSection.destroy();
        const openWindowsMenu = openWindowsMenuItem.menu;
        appMenu._windowSection = openWindowsMenu;

        // Adjust the animation of opening/closing the submenu (but keep arrow as-is)
        const adjustSubmenuEaseProps = (props) => ({
            ...props,
            // Prevent appearance of overshooting
            height: Math.max(0, props.height - 12),
            // Cut duration by half
            duration: props.duration === 0 ? 0 : 125,
        });
        // The ease method comes from gnome-shell's js/ui/environment.js
        const overrideEaseMethod = (actor, adjustProps) => {
            if (!Object.prototype.hasOwnProperty.call(actor, 'ease')) {
                actor.ease = (props) =>
                    Clutter.Actor.prototype.ease.call(
                        actor,
                        adjustProps(props)
                    );
            }
        };
        overrideEaseMethod(openWindowsMenu.actor, adjustSubmenuEaseProps);

        // When updating the app menu as it opens
        let windowMenuItem = null;
        const updateMenu = () => {
            // Open the "Open Windows" submenu by default
            if (openWindowsMenuItem.is_visible()) {
                openWindowsMenu.open();
            }

            // Populate the embedded window menu
            if (windowMenuItem) {
                const windowMenu = windowMenuItem.menu;
                windowMenu.removeAll();
                const windowMenuBuilder = Object.create(windowMenu);
                const windowMenuPrototype = WindowMenu.prototype;
                // WindowMenu overrides addAction() to set a default ornament of none.
                // Just Perfection's API.js replaces _buildMenu with a function
                // that accesses _oldBuildMenu where it has put the original function.
                Object.getOwnPropertyNames(windowMenuPrototype).forEach(
                    (key) => {
                        windowMenuBuilder[key] = windowMenuPrototype[key];
                    }
                );
                if (this._focusWindow) {
                    windowMenuBuilder._buildMenu(this._focusWindow);
                }
            }
        };

        // Replace the app menu's _updateWindowsSection() with a function
        // that calls the original function and applies changes to the menu
        const originalUpdateWindowsSection =
            appMenu._updateWindowsSection.bind(appMenu);
        appMenu._updateWindowsSection = () => {
            // Doing an extra remove all initially prevents the windows sometimes
            // being added twice on X11 (e.g., when switcing between two Files windows)
            openWindowsMenu.removeAll();

            // Original "Open Windows" section menu update
            originalUpdateWindowsSection();

            // Apply menu changes
            if (appMenu._openWindowsHeader.is_visible()) {
                openWindowsMenuItem.show();
            } else {
                openWindowsMenuItem.hide();
            }
            appMenu._openWindowsHeader.hide();
            this._windowMenu = null;
            windowMenuItem?.destroy();
            windowMenuItem = null;
            if (appMenu._app) {
                windowMenuItem = new PopupMenu.PopupSubMenuMenuItem(
                    appMenu._app.get_name() || '',
                    false
                );
                const windowMenu = windowMenuItem.menu;
                this._windowMenu = windowMenu; // So it can be emptied in #update()
                overrideEaseMethod(windowMenu.actor, adjustSubmenuEaseProps);
                appMenu.addMenuItem(windowMenuItem, 0);
            }
            if (appMenu.isOpen) {
                updateMenu();
            }
        };

        return updateMenu; // Call when menu is being opened
    }

    _update() {
        if (
            !this._isConnected &&
            (this._isWindowButton || this._isTitleButton)
        ) {
            if (!this._connectedDisplay) {
                this._connectedDisplay = global.display;
                this._connectedDisplay.connectObject(
                    'notify::focus-window',
                    () => this.#update(),
                    this
                );
            }
            this._isConnected = true;
        } else if (
            this._isConnected &&
            !this._isWindowButton &&
            !this._isTitleButton
        ) {
            if (this._connectedDisplay) {
                // Used for 'notify::focus-window'
                this._connectedDisplay.disconnectObject(this);
                this._connectedDisplay = null;
            }
            this._isConnected = false;
        }
        this.#update(true);
    }

    #update(isInit = false, isQuick = false) {
        if (this._isUpdating) {
            this._isDirty = true;
            return;
        } else {
            this._isDirty = false;
        }

        const focusWindow = global.display.get_focus_window();
        if (
            !isInit &&
            focusWindow === null &&
            this._isX11 &&
            this._appMenu.isOpen
        ) {
            // On X11, when opening panel menus, the window loses focus
            return;
        }
        this._windowMenu?.removeAll();
        if (this._focusWindow) {
            if (isInit || focusWindow !== this._focusWindow) {
                this._focusWindow.disconnectObject(this);
            } else {
                return;
            }
        } else if (this._isContextButton) {
            if (this._connectedShowAppsButton) {
                // Used for 'notify::checked'
                this._connectedShowAppsButton.disconnectObject(this);
                this._connectedShowAppsButton = null;
            }
            if (this._connectedOverview) {
                // Used for 'hiding' and 'showing'
                this._connectedOverview.disconnectObject(this);
                this._connectedOverview = null;
            }
        }
        this._focusWindow = focusWindow;

        if (this.#updatePrepare(isInit)) {
            this._isUpdating = true;
            this.#updateOldOut(isQuick);
        }
    }

    #updatePrepare(isInit) {
        if (isInit || this._isTitleButton || this._isWindowButton) {
            this._newIcon = new St.Icon({
                fallback_gicon: this._fallbackIcon,
                icon_size: this._iconSize,
                style: this._isSymbolic ? '-st-icon-style: symbolic' : null,
            });
            this._newIcon.hide();
            this._box.insert_child_at_index(this._newIcon, 0);
        } else {
            this._newIcon = null;
        }

        let focusApp = null;
        if (
            this._focusWindow !== null &&
            this._newIcon !== null &&
            (this._isTitleButton || this._isWindowButton)
        ) {
            focusApp = Shell.WindowTracker.get_default().get_window_app(
                this._focusWindow
            );
            if (focusApp !== null) {
                this._newIcon.set_gicon(focusApp.get_icon());
            }
        }
        this._appMenu?.setApp(
            this._isTitleButton || this._isWindowButton ? focusApp : null
        );

        return this._newIcon !== null;
    }

    #updateOldOut(isQuick) {
        // Manually unset hover state, so that the button won't blink as update is finished
        // if the mouse pointer is then outside, due to a now smaller button. Remember current
        // hover state (to be set to false elsewhere if the pointer leaving is detected), so it
        // can be restored if the mouse pointer is still within the button as update is finished.
        // Ideally sync_hover() would work, but in GNOME 49+ it seems to have an implementation
        // which not fully handles the pointer leaving while a mouse button is pressed.
        this._isHover = this.hover;
        this.hover = false;

        // When switching workspaces, the workspace indicator varies in size throughout its
        // animation, causing the context button to tremble. If the the title is too long
        // and therefore ellipsized, sometimes the character from which it is ellipsized
        // will not be consistent (depending on the string and exact available space).
        // As this is slightly distracting, temporarily use a fixed width for the title.
        // Note that this can't be limited to when Main.wm._switchInProgress is true
        // because it is false when switching workspaces in the overview.
        let isTempFixedWidth = this.#tempFixTitleWidth();

        // The initial fade-out also gives time to finish pre-loading the new icon
        this.ease({
            opacity: 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: isQuick ? 0 : this._easeTime,
            onComplete: () => {
                if (isTempFixedWidth) {
                    this._title.set_width(this._titleWidth);
                }
                this.#updateDo();
            },
        });
    }

    #updateDo() {
        if (this._newIcon) {
            this._box.remove_child(this._icon);
            this._icon.destroy();
            this._icon = this._newIcon;
            this._newIcon = null;
            if (this._iconSize > 0) {
                this._icon.show();
            }
        }
        if (this._isDirty) {
            this._isUpdating = false;
            this._focusWindow = null;
            // Start over instead of continuing with old state
            this.#update(false, true);
        } else {
            this._updateTitle();
            if (
                this._focusWindow !== null &&
                (this._isTitleButton || this._isWindowButton)
            ) {
                this._focusWindow.connectObject(
                    'notify::title',
                    () => this._updateTitle(),
                    GObject.ConnectFlags.AFTER,
                    this
                );
                if (!this._isContextButton) {
                    this.set({
                        width: -1, // Restore after using zero width to hide (see below)
                        min_width:
                            this._minimumWidth > 0 ? this._minimumWidth : 1,
                        min_width_set: this._minimumWidth > 0,
                    });
                }
            } else if (this._isContextButton) {
                this._updateContextIcon();
                let handler = () => this._updateContextIcon();
                const controls = Main.overview._overview?.controls;
                if (!this._connectedShowAppsButton) {
                    this._connectedShowAppsButton =
                        controls?.dash?.showAppsButton;
                    this._connectedShowAppsButton?.connectObject(
                        'notify::checked',
                        handler,
                        GObject.ConnectFlags.AFTER,
                        this
                    );
                }
                if (!this._connectedOverview) {
                    this._connectedOverview = Main.overview;
                    this._connectedOverview.connectObject(
                        'hiding',
                        handler,
                        GObject.ConnectFlags.AFTER,
                        this
                    );
                    this._connectedOverview.connectObject(
                        'showing',
                        handler,
                        GObject.ConnectFlags.AFTER,
                        this
                    );
                }
            } else {
                // Set zero width instead of calling hide() because easings were
                // skipped when in conjunction with workspace switch
                this.set_width(0);
                if (this._isHover) {
                    this.hover = true;
                }
                this._isUpdating = false;
                return;
            }
            if (this._isHover) {
                this.hover = true;
            }
            // Give a moment for widths to be calculated
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 0, () => {
                try {
                    this.#updateNewIn();
                } catch {
                    // Just remove the timeout
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    #updateNewIn() {
        let isTempFixedWidth = this.#tempFixTitleWidth();
        this.ease({
            opacity: 255,
            duration: this._easeTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (isTempFixedWidth) {
                    this._title.set_width(this._titleWidth);
                }
                this._isUpdating = false;
                if (this._isDirty) {
                    // Start again if state has become old in the meantime
                    this.#update();
                }
            },
        });
    }

    #tempFixTitleWidth() {
        if (this._titleWidth < 0) {
            let titleWidth = this._title.get_width();
            let preferredWidth = this._title.get_preferred_width(
                this._title.get_height()
            )[1];
            if (preferredWidth > titleWidth) {
                this._title.set_width(titleWidth);
                return true;
            }
        }
        return false;
    }

    _updateTitle() {
        let title = this._focusWindow?.get_title();
        if (
            this._isTitleButton &&
            typeof title === 'string' &&
            title.length > 0
        ) {
            // If title width is configured to be fixed then always show padding
            // Otherwise, hide padding if title is empty
            if (this._titleWidth < 0) {
                this._padding.show();
            }
            this._title.set_text(title);
        } else {
            this._title.set_text('');
            if (this._titleWidth < 0) {
                this._padding.hide();
            }
        }
    }

    _updateContextIcon() {
        if (
            this._focusWindow === null ||
            !(this._isTitleButton || this._isWindowButton)
        ) {
            if (Main.overview.visible && !Main.overview.closing) {
                const controls = Main.overview._overview?.controls;
                if (controls?.dash?.showAppsButton?.checked) {
                    this._icon.set_icon_name('shell-focus-windows-symbolic');
                } else {
                    this._icon.set_icon_name('shell-focus-desktop-symbolic');
                }
            } else {
                this._icon.set_icon_name(
                    this._contextIcon || 'shell-focus-app-grid-symbolic'
                );
            }
            this._reconnectShowAppsButton();
        }
    }

    _reconnectShowAppsButton() {
        // If another extension (e.g., Dash to Dock) has replaced the
        // showAppsButton, disconnect and reconnect to the new button
        const controls = Main.overview._overview?.controls;
        const showAppsButton = controls?.dash?.showAppsButton;
        if (
            this._connectedShowAppsButton &&
            showAppsButton !== this._connectedShowAppsButton
        ) {
            this._connectedShowAppsButton.disconnectObject(this);
            this._connectedShowAppsButton = showAppsButton;
            this._connectedShowAppsButton?.connectObject(
                'notify::checked',
                () => this._updateContextIcon(),
                GObject.ConnectFlags.AFTER,
                this
            );
        }
    }

    _onPress(event) {
        const button =
            event.type() === Clutter.EventType.TOUCH_BEGIN
                ? Clutter.BUTTON_PRIMARY
                : event.get_button();

        // Context button functionality
        if (this._isContextButton) {
            let ret = this.#onPressContext(button);
            if (ret !== undefined) {
                return ret;
            }
            // Not context button usage, fall through
        }

        // Window/title button functionality
        return this.#onPressWindow(button);
    }

    #onPressContext(button) {
        switch (button) {
            case 8: // Back button
            case 9: // Forward button
                return Clutter.EVENT_PROPAGATE;
        }
        if (
            this._focusWindow === null ||
            button === Clutter.BUTTON_PRIMARY ||
            (!this._isTitleButton &&
                !(
                    this._isWindowButton &&
                    (button === Clutter.BUTTON_SECONDARY ||
                        button === Clutter.BUTTON_MIDDLE)
                )) ||
            (this._isTitleButton &&
                !this._isWindowButton &&
                button === Clutter.BUTTON_MIDDLE)
        ) {
            return Clutter.EVENT_PROPAGATE;
        }
        return undefined; // Don't handle if not actually context usage
    }

    #onPressWindow(button) {
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
            case Clutter.BUTTON_SECONDARY:
                this._appMenu?.toggle();
                return Clutter.EVENT_STOP;
            case Clutter.BUTTON_MIDDLE:
                if (this._isWindowButton) {
                    return Clutter.EVENT_PROPAGATE;
                } else if (this._isTitleButton) {
                    this._appMenu?.toggle();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            default:
                if (!this._isContextButton) {
                    this._appMenu?.toggle();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
        }
    }

    _onClick(event, isGesture = false) {
        let button = event.get_button();
        if (!isGesture && event.type() === Clutter.EventType.TOUCH_END) {
            button = Clutter.BUTTON_PRIMARY;
        }

        // Context button functionality
        if (this._isContextButton) {
            switch (button) {
                case 8: // Back button
                    // Simulate scroll up on workspace indicator
                    Main.wm.handleWorkspaceScroll({
                        type: () => Clutter.EventType.SCROLL,
                        get_scroll_direction: () => Clutter.ScrollDirection.UP,
                    });
                    return Clutter.EVENT_STOP;
                case 9: // Forward button
                    // Simulate scroll down on workspace indicator
                    Main.wm.handleWorkspaceScroll({
                        type: () => Clutter.EventType.SCROLL,
                        get_scroll_direction: () =>
                            Clutter.ScrollDirection.DOWN,
                    });
                    return Clutter.EVENT_STOP;
            }
            let ret = this.#onClickContext(button);
            if (ret !== undefined) {
                return ret;
            }
            // Not context button usage, fall through
        }

        // Window/title button functionality
        return this.#onClickWindow(button);
    }

    #onClickContext(button) {
        if (
            this._focusWindow === null ||
            button === Clutter.BUTTON_PRIMARY ||
            (!this._isTitleButton &&
                !(
                    this._isWindowButton &&
                    (button === Clutter.BUTTON_SECONDARY ||
                        button === Clutter.BUTTON_MIDDLE)
                )) ||
            (this._isTitleButton &&
                !this._isWindowButton &&
                button === Clutter.BUTTON_MIDDLE)
        ) {
            if (this._isContextButton && !Main.overview.closing) {
                if (Main.overview.visible && !Main.overview.closing) {
                    const controls = Main.overview._overview?.controls;
                    if (controls?.dash?.showAppsButton?.checked) {
                        // Dash to Dock's docking.js sets _fromDesktop = true to indicate that
                        // the apps button should close the overview and not just the app grid
                        const showAppsButton = controls.dash.showAppsButton;
                        if (showAppsButton._fromDesktop === true) {
                            showAppsButton._fromDesktop = false;
                        }
                        showAppsButton.checked = false;
                    } else {
                        Main.overview.hide();
                    }
                } else {
                    Main.overview.showApps();
                }
                this._updateContextIcon();
            }
            return Clutter.EVENT_STOP;
        }
        return undefined; // Don't handle if not actually context usage
    }

    #onClickWindow(button) {
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
            case Clutter.BUTTON_SECONDARY:
                // Already handled on press
                return Clutter.EVENT_STOP;
            case Clutter.BUTTON_MIDDLE:
                if (this._isWindowButton) {
                    if (this._focusWindow?.can_close()) {
                        this._focusWindow.delete(global.get_current_time());
                    }
                    return Clutter.EVENT_STOP;
                } else if (this._isTitleButton) {
                    // Already handled on press
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            default:
                if (!this._isContextButton) {
                    // Already handled on press
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
        }
    }

    _onScroll(event) {
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                if (!this._isWindowButton) {
                    if (this._isContextButton) {
                        return Main.wm.handleWorkspaceScroll(event);
                    }
                    return Clutter.EVENT_PROPAGATE;
                } else if (this._focusWindow?.can_maximize()) {
                    if (GNOME_POST_49) {
                        // For GNOME 49+ maximize() is used without MaximizeFlags
                        this._focusWindow.maximize();
                    } else {
                        // For GNOME 49+, maximize() is used without flags (above),
                        // but for older GNOME versions use it with Meta.MaximizeFlags.BOTH
                        this._focusWindow.maximize.call(
                            this._focusWindow,
                            Meta.MaximizeFlags.BOTH
                        );
                    }
                }
                return Clutter.EVENT_STOP;
            case Clutter.ScrollDirection.DOWN:
                if (!this._isWindowButton) {
                    if (this._isContextButton) {
                        return Main.wm.handleWorkspaceScroll(event);
                    }
                    return Clutter.EVENT_PROPAGATE;
                } else if (
                    this._focusWindow &&
                    (GNOME_POST_49
                        ? // GNOME 49+ has get_maximize_flags()
                          this._focusWindow.get_maximize_flags() !== 0
                        : // For GNOME 49+, get_maximize_flags() is used (above),
                          // but for older GNOME versions use get_maximized()
                          this._focusWindow.get_maximized.call(
                              this._focusWindow
                          ))
                ) {
                    // GNOME 46-48 has get_maximized().
                    // GNOME 49 has is_maximized() (48+) and get_maximize_flags() (49+).
                    // get_maximize_flags() is better because it is non-zero both for full and
                    // either vertical/horizontal maximization, is_maximized() only for full.
                    if (GNOME_POST_49) {
                        // For GNOME 49+ unmaximize() is used without MaximizeFlags
                        this._focusWindow.unmaximize();
                    } else {
                        // For GNOME 49+, maximize() is used without flags (above),
                        // but for older GNOME versions use it with Meta.MaximizeFlags.BOTH
                        this._focusWindow.unmaximize.call(
                            this._focusWindow,
                            Meta.MaximizeFlags.BOTH
                        );
                    }
                }
                return Clutter.EVENT_STOP;
            case Clutter.ScrollDirection.LEFT:
            case Clutter.ScrollDirection.RIGHT:
                if (!this._isContextButton) {
                    return Clutter.EVENT_PROPAGATE;
                }
                return Main.wm.handleWorkspaceScroll(event);
            default:
                return Clutter.EVENT_PROPAGATE;
        }
    }

    vfunc_leave_event(event) {
        this._isHover = false;
        if (typeof this._longPressTimeout === 'number') {
            GLib.source_remove(this._longPressTimeout);
            this._longPressTimeout = null;
        }
        try {
            // Keep original functionality working (e.g., hover and click)
            return super.vfunc_leave_event(event);
        } catch {
            // In case of virtual function not implemented
            return Clutter.EVENT_PROPAGATE;
        }
    }

    vfunc_button_press_event(event) {
        let ret = this._onPress(event);
        if (ret !== Clutter.EVENT_PROPAGATE) {
            return ret;
        }
        try {
            return super.vfunc_button_press_event(event);
        } catch {
            return Clutter.EVENT_PROPAGATE;
        }
    }

    vfunc_button_release_event(event) {
        if (!this.hover) {
            this._isHover = false;
        } else if (
            !Clutter.ClickGesture &&
            (!this._isX11 || this._isContextButton)
        ) {
            // Manually implement click gestures for older GNOME versions because
            // ClickAction disrupted vfunc calls
            let ret = this._onClick(event);
            if (ret !== Clutter.EVENT_PROPAGATE) {
                return ret;
            }
        }
        try {
            return super.vfunc_button_release_event(event);
        } catch {
            return Clutter.EVENT_PROPAGATE;
        }
    }

    vfunc_touch_event(event) {
        if (this._isX11) {
            // If we're on X11, disable this touch handler due to it not working well
            // On X11, touch (but not long touch) still works through button press/release
            return Clutter.EVENT_STOP;
        }
        switch (event.type()) {
            case Clutter.EventType.TOUCH_BEGIN:
                {
                    let ret = this._onPress(event);
                    if (ret !== Clutter.EVENT_PROPAGATE) {
                        return ret;
                    }
                }
                // Custom long-press touch implementation (necessary also in newer GNOME
                // versions because LongPressGesture detects mouse buttons besides touch)
                this._longPressTimeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    Clutter.Settings.get_default().longPressDuration,
                    () => {
                        try {
                            if (this._focusWindow) {
                                let ret = this._onPress({
                                    // Simulate secondary button press
                                    type: () => Clutter.EventType.BUTTON_PRESS,
                                    get_button: () => Clutter.BUTTON_SECONDARY,
                                });
                                this._longPressTimeout =
                                    ret !== Clutter.EVENT_PROPAGATE;
                            } else {
                                this._longPressTimeout = false; // Not handled
                            }
                        } catch {
                            // Just remove the timeout
                        }
                        return GLib.SOURCE_REMOVE;
                    }
                );
                break;
            case Clutter.EventType.TOUCH_END:
                if (typeof this._longPressTimeout === 'number') {
                    GLib.source_remove(this._longPressTimeout);
                    this._longPressTimeout = null;
                }
                if (!this.hover) {
                    this._isHover = false;
                } else {
                    if (this._longPressTimeout === true) {
                        // Already handled as a long-press
                        this._longPressTimeout = null;
                        return Clutter.EVENT_STOP;
                    }
                    let ret = this._onClick(event);
                    if (ret !== Clutter.EVENT_PROPAGATE) {
                        return ret;
                    }
                }
                break;
        }
        try {
            return super.vfunc_touch_event(event);
        } catch {
            return Clutter.EVENT_PROPAGATE;
        }
    }

    vfunc_event(/* event */) {
        // Necessary to override implementation by PanelMenu.Button
        // which exists in pre GNOME 49
        return Clutter.EVENT_PROPAGATE;
    }
}
