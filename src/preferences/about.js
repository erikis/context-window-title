// SPDX-License-Identifier: CC0-1.0
// SPDX-FileCopyrightText: No rights reserved
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export function getApplicationName() {
    // prettier-ignore
    const name =
        /* This is the application name */
        _("Context + Window Title");
    return name;
}

export function createAboutWindow({ metadata, window }) {
    const aw = new Adw.AboutWindow({ modal: true, transient_for: window });

    aw.set_application_name(getApplicationName());
    aw.set_version(metadata['version-name']);
    aw.set_website(metadata.url);
    aw.set_issue_url(`${metadata.url}/issues`);

    aw.set_application_icon('context-window-title');
    aw.set_developer_name('erikis.github.io');
    aw.set_copyright('© 2026 Erik Isaksson');
    aw.set_license_type(Gtk.License.GPL_2_0);

    aw.set_developers(['Erik Isaksson https://github.com/erikis']);

    // prettier-ignore
    const translator =
        /* Change this to your real name to show up in the credits.
           To include your URL: Name https://url
           Or to include your email address: Name <emailaddress> */
        _("TRANSLATOR");
    if (translator !== 'TRANSLATOR') {
        aw.set_translator_credits(translator);
    }

    return aw;
}

export function addIconsToSearchPath(window, baseDir) {
    const iconTheme = Gtk.IconTheme.get_for_display(window.get_display());
    const iconsDir = baseDir.get_child('icons').get_path();
    if (iconTheme.get_search_path().indexOf(iconsDir) === -1) {
        iconTheme.add_search_path(iconsDir);
    }
}
