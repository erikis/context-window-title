# Context + Window Title

Add a little more text and context to your [GNOME](https://www.gnome.org/) user experience

## Features

Creates a top bar “context” button with the focused window’s icon and title, or an app grid icon if no window is focused. Optionally shows a more customizable clock, the user/host name on the system menu button, and a message on the lock screen.

The context button can function both as a toggle from desktop to apps, windows, and back to desktop when clicked, and as an app menu when pressed using the secondary button or long-pressed by touch.

## Screenshot

![Context + Window Title screenshot](./resources/screenshots/widgets.png?raw=true)

## Install

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
