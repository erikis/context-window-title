# Context + Window Title

Add a little more text and context to your [GNOME](https://www.gnome.org/) user experience

## Features

Creates a top bar “context” button with the focused window’s icon and title, or an app grid icon if no window is focused. Optionally shows a more customizable clock, the user/host name on the system menu button, and a message on the lock screen.

The context button can function both as a toggle from desktop to apps, windows, and back to desktop when clicked, and as an app menu when activated using the secondary mouse button, long-press, or a keyboard shortcut.

## Screenshot

![Context + Window Title screenshot](./resources/screenshots/widgets.png?raw=true)

## Tips

- A **minimum width** can make the context button easier to click and touch. In the preferences, under Advanced, Context Button, set Minimum Width to a value such as 384 px.
- A **keyboard shortcut** can be set for opening the app menu. In the preferences, under Advanced, Context Button, click on Keyboard Shortcut and press the key combination that you want to use, such as Super+C.
- If you prefer **monochrome icons**, the saturation can be reduced and/or a symbolic icon style applied. In the preferences, under Advanced, Context Button, set Saturation to either 0% or one of the special values -2 or -3 for symbolic icon style and 100% or 0% saturation, respectively. Not all icons have a symbolic style and the saturation also applies to the title which may contain emojis. With symbolic icons, a smaller **icon size** might look better, such as 16 px to match the indicators on the system menu button. The icon size can be changed in the preferences under Advanced, Context Button, Components.
- For the custom clock, the **number style** can be changed. In the preferences, under Advanced, Custom Clock, Extra, set Numeral System to a value such as mathsanb (for a bold font) or segment (for a segmented display style).
- The custom clock uses [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) to format the date and time. If you want to **customize the formatting** further than is possible using the preferences, the arguments provided to Intl.DateTimeFormat can be overridden. In the preferences, under Advanced, Custom Clock, Extra, set Time Locale to a language tag and/or, following a comma, a JSON object for overriding the [locale options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#locale_options). For example, `en-GB, { "day": "2-digit" }` to use English (UK) locale and always use two digits for the day of month. Providing a value for Time Locale without a language tag (e.g., just a comma) means that the runtime's default locale will be used. In the JSON object, using a null value means that an existing option will be removed.

## Install

### From GNOME Shell Extensions

Go to [Context + Window Title](https://extensions.gnome.org/extension/10114/context-window-title/) and click on Install. If you have [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) (Flathub link; Debian/Ubuntu package gnome-shell-extension-manager), this should work without installing a browser extension or connector.

### From source

Run `make install`.

### From a release

Install a release .zip using `gnome-extensions install` followed by the release file name. Use `-f` to overwrite an existing extension.

## Translate

Add your language to po/LINGUAS and then run `make languages`. Modify the generated .po file. Use [gnome-shell](https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/main/po) for reference.

## Develop

See the [GJS guide for creating extensions](https://gjs.guide/extensions/development/creating.html).

Linting and formatting: `npm install --save-dev eslint @eslint/js prettier`. Then run `make eslint` and `make prettier`.

Updating strings for translation: `make strings`

## License

Copyright © 2026 Erik Isaksson. Licensed under [GNU General Public License, version 2 or later](LICENSE).
