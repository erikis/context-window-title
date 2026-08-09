// Special values for settings with otherwise quantitative values

export const AUTOMATIC = -1;

export const ButtonSaturation = Object.freeze({
    SYMBOLIC: -2,
    SYMBOLIC_DESATURATED: -3,
});

// Corresponding to the string lists in advanced.ui

export const ButtonIconChange = Object.freeze({
    DYNAMIC: 0,
    APP_ICON_OR_STATIC: 1,
    NO_APP_ICON: 2,
    STATIC: 3,
});

export const ButtonMenuPatch = Object.freeze({
    OFF: 0,
    BUTTON_ONLY: 1,
    EVERYWHERE: 2,
});

export const ButtonMenuOpenWindows = Object.freeze({
    AUTOMATIC: 0,
    ALWAYS_AND_CLOSED: 1,
    ALWAYS_AND_OPEN: 2,
});

export const ButtonMenuHideFavorite = Object.freeze({
    DO_NOT_HIDE: 0,
    BUTTON_ONLY: 1,
    EVERYWHERE: 2,
});

export const ButtonMenuAdjustSubMenu = Object.freeze({
    OFF: 0,
    APP_MENU_ONLY: 1,
    EVERYWHERE: 2,
});

export const ClockYear = Object.freeze({
    OFF: 0,
    ON: 1,
    ON_WITH_ERA: 2,
});

export const ClockMonth = Object.freeze({
    SHORT: 0,
    LONG: 1,
    NUMERIC: 2,
});

export const ClockWeekday = Object.freeze({
    SHORT: 0,
    LONG: 1,
    NARROW: 2,
});

export const ClockHour = Object.freeze({
    DEFAULT: 0,
    H12: 1,
    H24: 2,
});

export const ClockSecond = Object.freeze({
    OFF: 0,
    SECOND: 1,
    SECOND_10TH: 2,
    SECOND_100TH: 3,
    SECOND_1000TH: 4,
});

export const ClockTimeZoneName = Object.freeze({
    OFF: 0,
    ON: 1,
    ON_OFFSET: 2,
    ON_OFFSET_LONG: 3,
});

export const NameLockHide = Object.freeze({
    DO_NOT_HIDE: 0,
    HIDE: 1,
    HIDE_USER: 2,
});
