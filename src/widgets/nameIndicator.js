import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

export default class NameIndicator extends SystemIndicator {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super();

        this._nameLabel = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._nameLabel);
    }

    _update() {
        const username = GLib.get_user_name();
        const hostname = GLib.get_host_name();
        const indexOfDomain = hostname.indexOf('.');
        const isLockScreen = this._sessionMode === 'unlock-dialog';
        const isHidden = isLockScreen && this._lockHide === 1;
        const isUserName =
            this._isUserName && (!isLockScreen || this._lockHide !== 2);
        const isHostName = this._isHostName;
        const isDomainName = this._isDomainName;
        let name = '';
        if (!isHidden) {
            name = `${isUserName ? username : ''}`;
            name = `${name}${
                isUserName && (isHostName || isDomainName) ? '@' : ''
            }`;
            name = `${name}${
                isHostName
                    ? indexOfDomain < 0
                        ? hostname
                        : hostname.substring(0, indexOfDomain)
                    : ''
            }`;
            name = `${name}${
                isDomainName
                    ? indexOfDomain < 0
                        ? ''
                        : hostname.substring(
                              indexOfDomain + (isHostName ? 0 : 1)
                          )
                    : ''
            }`;
        }
        if (name.length > 0) {
            this._nameLabel.set_text(` ${name} `);
            this.show();
        } else {
            this._nameLabel.set_text('');
            this.hide();
        }
    }
}
