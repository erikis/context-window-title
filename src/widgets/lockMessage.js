import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import { Message, Source } from 'resource:///org/gnome/shell/ui/messageList.js';

export default class LockMessage extends Message {
    static {
        GObject.registerClass(this);
    }

    constructor(config) {
        const source = new Source();
        super(source);
        source.set({
            title: config.sourceTitle,
            icon: new Gio.ThemedIcon({ name: config.sourceIcon }),
        });
        this.visible = true;
        this.config = config;
        this._update();
    }

    _update() {
        this.set({
            title: this.config.title,
            body: this.config.body,
            icon: null,
        });
    }
}
