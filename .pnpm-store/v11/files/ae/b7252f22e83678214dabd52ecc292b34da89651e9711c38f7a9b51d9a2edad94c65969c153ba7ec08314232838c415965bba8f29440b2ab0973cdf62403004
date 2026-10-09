var capacitorCapacitorCalendar = (function (exports, core) {
    'use strict';

    /**
     * @since 7.1.0
     */
    exports.AttendeeRole = void 0;
    (function (AttendeeRole) {
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeRole["UNKNOWN"] = "unknown";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeRole["REQUIRED"] = "required";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeRole["OPTIONAL"] = "optional";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeRole["CHAIR"] = "chair";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeRole["NON_PARTICIPANT"] = "nonParticipant";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeRole["ATTENDEE"] = "attendee";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeRole["ORGANIZER"] = "organizer";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeRole["PERFORMER"] = "performer";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeRole["SPEAKER"] = "speaker";
    })(exports.AttendeeRole || (exports.AttendeeRole = {}));

    /**
     * @since 7.1.0
     */
    exports.AttendeeStatus = void 0;
    (function (AttendeeStatus) {
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeStatus["NONE"] = "none";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeStatus["ACCEPTED"] = "accepted";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeStatus["DECLINED"] = "declined";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeStatus["INVITED"] = "invited";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeStatus["UNKNOWN"] = "unknown";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeStatus["PENDING"] = "pending";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeStatus["TENTATIVE"] = "tentative";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeStatus["DELEGATED"] = "delegated";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeStatus["COMPLETED"] = "completed";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeStatus["IN_PROCESS"] = "inProcess";
    })(exports.AttendeeStatus || (exports.AttendeeStatus = {}));

    /**
     * @since 7.1.0
     */
    exports.AttendeeType = void 0;
    (function (AttendeeType) {
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeType["UNKNOWN"] = "unknown";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeType["PERSON"] = "person";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeType["ROOM"] = "room";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        AttendeeType["RESOURCE"] = "resource";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        AttendeeType["GROUP"] = "group";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeType["REQUIRED"] = "required";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeType["NONE"] = "none";
        /**
         * @platform Android
         * @since 7.1.0
         */
        AttendeeType["OPTIONAL"] = "optional";
    })(exports.AttendeeType || (exports.AttendeeType = {}));

    /**
     * @since 0.2.0
     */
    exports.CalendarChooserDisplayStyle = void 0;
    (function (CalendarChooserDisplayStyle) {
        /**
         * @since 0.2.0
         */
        CalendarChooserDisplayStyle[CalendarChooserDisplayStyle["ALL_CALENDARS"] = 0] = "ALL_CALENDARS";
        /**
         * @since 0.2.0
         */
        CalendarChooserDisplayStyle[CalendarChooserDisplayStyle["WRITABLE_CALENDARS_ONLY"] = 1] = "WRITABLE_CALENDARS_ONLY";
    })(exports.CalendarChooserDisplayStyle || (exports.CalendarChooserDisplayStyle = {}));

    /**
     * Enum defining available calendar and reminders related permissions.
     *
     * @since 7.1.0
     */
    exports.CalendarPermissionScope = void 0;
    (function (CalendarPermissionScope) {
        /**
         * Permission required for reading calendar events.
         *
         * @permissions
         * | Platform  | Required |
         * |-----------|---------------------|
         * | iOS 17+   | `NSCalendarsFullAccessUsageDescription` |
         * | iOS 13-16 | `NSCalendarsUsageDescription` |
         * | Android   | `android.permission.READ_CALENDAR` |
         *
         * @platform Android, iOS
         * @since 7.1.0
         */
        CalendarPermissionScope["READ_CALENDAR"] = "readCalendar";
        /**
         * Permission required for reading reminders.
         *
         * On Android, reminders are not supported. `checkPermission` and
         * `checkAllPermissions` return `"prompt"` for this scope.
         * `requestPermission` rejects with `Invalid scope.`.
         *
         * @permissions
         * | Platform  | Required |
         * |-----------|---------------------|
         * | iOS 17+   | `NSRemindersFullAccessUsageDescription` |
         * | iOS 10-16 | `NSRemindersUsageDescription` |
         * @platform iOS
         * @since 7.1.0
         */
        CalendarPermissionScope["READ_REMINDERS"] = "readReminders";
        /**
         * Permission required for adding or modifying calendar events.
         *
         * @permissions
         * | Platform  | Required |
         * |-----------|---------------------|
         * | iOS 17+   | `NSCalendarsWriteOnlyAccessUsageDescription` |
         * | iOS 13-16 | `NSCalendarsUsageDescription` |
         * | Android   | `android.permission.WRITE_CALENDAR` |
         *
         * @platform Android, iOS
         * @since 7.1.0
         */
        CalendarPermissionScope["WRITE_CALENDAR"] = "writeCalendar";
        /**
         * Permission required for adding or modifying reminders.
         *
         * On Android, reminders are not supported. `checkPermission` and
         * `checkAllPermissions` return `"prompt"` for this scope.
         * `requestPermission` rejects with `Invalid scope.`.
         *
         * @permissions
         * | Platform  | Required |
         * |-----------|---------------------|
         * | iOS 17+   | `NSRemindersFullAccessUsageDescription` |
         * | iOS 13-16 | `NSRemindersUsageDescription` |
         *
         * @platform iOS
         * @since 7.1.0
         */
        CalendarPermissionScope["WRITE_REMINDERS"] = "writeReminders";
    })(exports.CalendarPermissionScope || (exports.CalendarPermissionScope = {}));

    /**
     * @since 7.1.0
     */
    exports.CalendarSourceType = void 0;
    (function (CalendarSourceType) {
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["LOCAL"] = 0] = "LOCAL";
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["EXCHANGE"] = 1] = "EXCHANGE";
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["CAL_DAV"] = 2] = "CAL_DAV";
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["MOBILE_ME"] = 3] = "MOBILE_ME";
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["SUBSCRIBED"] = 4] = "SUBSCRIBED";
        /**
         * @since 7.1.0
         */
        CalendarSourceType[CalendarSourceType["BIRTHDAYS"] = 5] = "BIRTHDAYS";
    })(exports.CalendarSourceType || (exports.CalendarSourceType = {}));

    /**
     * @since 7.1.0
     */
    exports.CalendarType = void 0;
    (function (CalendarType) {
        /**
         * @since 7.1.0
         */
        CalendarType[CalendarType["LOCAL"] = 0] = "LOCAL";
        /**
         * @since 7.1.0
         */
        CalendarType[CalendarType["CAL_DAV"] = 1] = "CAL_DAV";
        /**
         * @since 7.1.0
         */
        CalendarType[CalendarType["EXCHANGE"] = 2] = "EXCHANGE";
        /**
         * @since 7.1.0
         */
        CalendarType[CalendarType["SUBSCRIPTION"] = 3] = "SUBSCRIPTION";
        /**
         * @since 7.1.0
         */
        CalendarType[CalendarType["BIRTHDAY"] = 4] = "BIRTHDAY";
    })(exports.CalendarType || (exports.CalendarType = {}));

    /**
     * @since 7.1.0
     */
    exports.EventAvailability = void 0;
    (function (EventAvailability) {
        /**
         * @platform iOS
         * @since 7.1.0
         */
        EventAvailability[EventAvailability["NOT_SUPPORTED"] = -1] = "NOT_SUPPORTED";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventAvailability[EventAvailability["BUSY"] = 0] = "BUSY";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventAvailability[EventAvailability["FREE"] = 1] = "FREE";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventAvailability[EventAvailability["TENTATIVE"] = 2] = "TENTATIVE";
        /**
         * @platform iOS
         * @since 7.1.0
         */
        EventAvailability[EventAvailability["UNAVAILABLE"] = 3] = "UNAVAILABLE";
    })(exports.EventAvailability || (exports.EventAvailability = {}));

    /**
     * @since 7.1.0
     */
    exports.EventSpan = void 0;
    (function (EventSpan) {
        /**
         * Only the identified event or occurrence.
         *
         * @since 7.1.0
         */
        EventSpan[EventSpan["THIS_EVENT"] = 0] = "THIS_EVENT";
        /**
         * The identified occurrence and future occurrences in the series.
         *
         * @since 7.1.0
         */
        EventSpan[EventSpan["THIS_AND_FUTURE_EVENTS"] = 1] = "THIS_AND_FUTURE_EVENTS";
    })(exports.EventSpan || (exports.EventSpan = {}));

    /**
     * @platform Android, iOS
     * @since 7.1.0
     */
    exports.EventStatus = void 0;
    (function (EventStatus) {
        /**
         * @platform iOS
         * @since 7.1.0
         */
        EventStatus["NONE"] = "none";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventStatus["CONFIRMED"] = "confirmed";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventStatus["TENTATIVE"] = "tentative";
        /**
         * @platform Android, iOS
         * @since 7.1.0
         */
        EventStatus["CANCELED"] = "canceled";
    })(exports.EventStatus || (exports.EventStatus = {}));

    /**
     * @deprecated Use `RecurrenceFrequency`.
     */
    exports.ReminderRecurrenceFrequency = void 0;
    (function (ReminderRecurrenceFrequency) {
        /**
         * @deprecated Use `RecurrenceFrequency.DAILY`.
         */
        ReminderRecurrenceFrequency[ReminderRecurrenceFrequency["DAILY"] = 0] = "DAILY";
        /**
         * @deprecated Use `RecurrenceFrequency.WEEKLY`.
         */
        ReminderRecurrenceFrequency[ReminderRecurrenceFrequency["WEEKLY"] = 1] = "WEEKLY";
        /**
         * @deprecated Use `RecurrenceFrequency.MONTHLY`.
         */
        ReminderRecurrenceFrequency[ReminderRecurrenceFrequency["MONTHLY"] = 2] = "MONTHLY";
        /**
         * @deprecated Use `RecurrenceFrequency.YEARLY`.
         */
        ReminderRecurrenceFrequency[ReminderRecurrenceFrequency["YEARLY"] = 3] = "YEARLY";
    })(exports.ReminderRecurrenceFrequency || (exports.ReminderRecurrenceFrequency = {}));

    /**
     * Triggers a browser download for an `.ics` `File`.
     * Resolves after the object URL is revoked.
     *
     * @throws If `document` or `URL` is not available.
     *
     * @example
     * const { ics } = await CapacitorCalendar.createEvent({
     *   title: 'Team standup',
     *   icsFileName: 'team-standup.ics',
     * });
     * if (ics) {
     *   await downloadIcsFile(ics);
     * }
     *
     * @since 8.5.0
     */
    async function downloadIcsFile(file) {
        if (typeof document === 'undefined' || typeof URL === 'undefined') {
            throw new Error('downloadIcsFile requires a browser document environment.');
        }
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name.length > 0 ? file.name : 'event.ics';
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Delay revoke so the browser can start the download
        await new Promise((resolve) => setTimeout(resolve, 1000));
        URL.revokeObjectURL(url);
    }

    const CapacitorCalendar = core.registerPlugin('CapacitorCalendar', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.CapacitorCalendarWeb()),
    });

    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;
    const CRLF = '\r\n';
    /**
     * Builds an RFC 5545 `VCALENDAR` document with one `VEVENT` from CreateEventOptions.
     * When `startDate` is omitted, uses the current time. When `endDate` is omitted, uses
     * one hour after the start (or the next day for all-day events).
     */
    function buildEventIcs(options) {
        var _a;
        const startDate = (_a = options.startDate) !== null && _a !== void 0 ? _a : Date.now();
        const isAllDay = options.isAllDay === true;
        const endDate = resolveEndDate(startDate, options.endDate, isAllDay);
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//ebarooni/capacitor-calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${generateUid()}`,
            `DTSTAMP:${formatDateTimeUtc(Date.now())}`,
        ];
        if (isAllDay) {
            lines.push(`DTSTART;VALUE=DATE:${formatDateOnlyLocal(startDate)}`);
            lines.push(`DTEND;VALUE=DATE:${formatDateOnlyLocal(endDate)}`);
        }
        else {
            lines.push(`DTSTART:${formatDateTimeUtc(startDate)}`);
            lines.push(`DTEND:${formatDateTimeUtc(endDate)}`);
        }
        lines.push(`SUMMARY:${escapeText(options.title)}`);
        if (options.description != null && options.description.length > 0) {
            lines.push(`DESCRIPTION:${escapeText(options.description)}`);
        }
        if (options.location != null && options.location.length > 0) {
            lines.push(`LOCATION:${escapeText(options.location)}`);
        }
        if (options.url != null && options.url.length > 0) {
            lines.push(`URL:${escapeText(options.url)}`);
        }
        if (options.organizer != null && options.organizer.length > 0) {
            lines.push(`ORGANIZER:mailto:${escapeText(options.organizer)}`);
        }
        const transp = mapTransparency(options.availability);
        if (transp != null) {
            lines.push(`TRANSP:${transp}`);
        }
        if (options.recurrence != null) {
            lines.push(`RRULE:${toRRule(options.recurrence, isAllDay)}`);
        }
        if (options.attendees != null) {
            for (const guest of options.attendees) {
                if (guest.email.length === 0) {
                    continue;
                }
                const cn = guest.name != null && guest.name.length > 0 ? `;CN=${formatParamValue(guest.name)}` : '';
                lines.push(`ATTENDEE${cn}:mailto:${escapeText(guest.email)}`);
            }
        }
        if (options.alerts != null) {
            for (const minutes of options.alerts) {
                lines.push(...buildAlarm(minutes));
            }
        }
        lines.push('END:VEVENT', 'END:VCALENDAR');
        return lines.map(foldLine).join(CRLF) + CRLF;
    }
    /**
     * Resolves the `.ics` download filename.
     * Uses `icsFileName` when set; otherwise derives a name from `title` (fallback `event.ics`).
     * Appends `.ics` when the chosen name has no such extension.
     */
    function resolveIcsFileName(options) {
        var _a;
        const custom = (_a = options.icsFileName) === null || _a === void 0 ? void 0 : _a.trim();
        if (custom != null && custom.length > 0) {
            return /\.ics$/i.test(custom) ? custom : `${custom}.ics`;
        }
        return fileNameFromTitle(options.title);
    }
    function fileNameFromTitle(title) {
        const base = (title !== null && title !== void 0 ? title : 'event')
            .trim()
            .replace(/[^\w\s-]+/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 64);
        return `${base.length > 0 ? base : 'event'}.ics`;
    }
    function resolveEndDate(startDate, endDate, isAllDay) {
        if (!isAllDay) {
            return endDate !== null && endDate !== void 0 ? endDate : startDate + HOUR_MS;
        }
        if (endDate == null) {
            return startDate + DAY_MS;
        }
        // ICS all-day DTEND is exclusive; same local date as DTSTART is zero-length.
        if (formatDateOnlyLocal(endDate) <= formatDateOnlyLocal(startDate)) {
            return startDate + DAY_MS;
        }
        return endDate;
    }
    function mapTransparency(availability) {
        if (availability == null) {
            return null;
        }
        if (availability === exports.EventAvailability.FREE) {
            return 'TRANSPARENT';
        }
        if (availability === exports.EventAvailability.BUSY) {
            return 'OPAQUE';
        }
        return 'OPAQUE';
    }
    function toRRule(rule, isAllDay) {
        var _a;
        const parts = [`FREQ=${rule.frequency.toUpperCase()}`, `INTERVAL=${Math.max(1, (_a = rule.interval) !== null && _a !== void 0 ? _a : 1)}`];
        if (rule.count != null) {
            parts.push(`COUNT=${rule.count}`);
        }
        else if (rule.end != null) {
            // RFC 5545: UNTIL must match DTSTART value type (DATE vs DATE-TIME).
            parts.push(`UNTIL=${isAllDay ? formatDateOnlyLocal(rule.end) : formatDateTimeUtc(rule.end)}`);
        }
        if (rule.byWeekDay != null && rule.byWeekDay.length > 0) {
            const mapped = rule.byWeekDay.map(mapWeekday).filter((d) => d != null);
            if (mapped.length > 0) {
                parts.push(`BYDAY=${[...new Set(mapped)].join(',')}`);
            }
        }
        if (rule.byMonthDay != null && rule.byMonthDay.length > 0) {
            parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
        }
        if (rule.byMonth != null && rule.byMonth.length > 0) {
            parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
        }
        if (rule.weeksOfTheYear != null && rule.weeksOfTheYear.length > 0) {
            parts.push(`BYWEEKNO=${rule.weeksOfTheYear.join(',')}`);
        }
        if (rule.daysOfTheYear != null && rule.daysOfTheYear.length > 0) {
            parts.push(`BYYEARDAY=${rule.daysOfTheYear.join(',')}`);
        }
        return parts.join(';');
    }
    function mapWeekday(day) {
        switch (day) {
            case 1:
                return 'MO';
            case 2:
                return 'TU';
            case 3:
                return 'WE';
            case 4:
                return 'TH';
            case 5:
                return 'FR';
            case 6:
                return 'SA';
            case 7:
                return 'SU';
            default:
                return null;
        }
    }
    function buildAlarm(minutes) {
        const trigger = minutes < 0 ? `-PT${Math.abs(minutes)}M` : `PT${minutes}M`;
        return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', `TRIGGER:${trigger}`, 'END:VALARM'];
    }
    function generateUid() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${crypto.randomUUID()}@capacitor-calendar`;
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}@capacitor-calendar`;
    }
    function formatDateTimeUtc(ms) {
        const d = new Date(ms);
        const y = d.getUTCFullYear();
        const mo = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        const h = pad(d.getUTCHours());
        const mi = pad(d.getUTCMinutes());
        const s = pad(d.getUTCSeconds());
        return `${y}${mo}${day}T${h}${mi}${s}Z`;
    }
    function formatDateOnlyLocal(ms) {
        const d = new Date(ms);
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }
    function pad(n) {
        return n < 10 ? `0${n}` : String(n);
    }
    /**
     * Escapes TEXT values per RFC 5545 §3.3.11.
     */
    function escapeText(value) {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\n|\r/g, '\\n');
    }
    /**
     * Formats a property parameter value per RFC 5545 §3.2.
     * Values with COMMA, SEMICOLON, or COLON are quoted; DQUOTE and line breaks are sanitized.
     */
    function formatParamValue(value) {
        const sanitized = value.replace(/[\r\n]+/g, ' ').replace(/"/g, "'");
        if (/[;:,]/.test(sanitized)) {
            return `"${sanitized}"`;
        }
        return sanitized;
    }
    /**
     * Folds a content line so each physical line is at most 75 octets (RFC 5545 §3.1).
     */
    function foldLine(line) {
        const max = 75;
        if (byteLength(line) <= max) {
            return line;
        }
        const chars = [...line];
        let result = '';
        let current = '';
        for (const ch of chars) {
            const next = current + ch;
            if (byteLength(next) > max) {
                result += result.length === 0 ? current : `${CRLF} ${current}`;
                current = ch;
                // Continuations are limited to 74 octets of content + leading space = 75
                while (byteLength(current) > max - 1) {
                    // Extremely rare for a single code point; split by taking first unit as-is
                    result += `${CRLF} ${current}`;
                    current = '';
                    break;
                }
            }
            else {
                current = next;
            }
        }
        if (current.length > 0) {
            result += result.length === 0 ? current : `${CRLF} ${current}`;
        }
        return result;
    }
    function byteLength(s) {
        return new TextEncoder().encode(s).length;
    }

    class CapacitorCalendarWeb extends core.WebPlugin {
        checkPermission(_options) {
            return this.throwUnimplemented(this.checkPermission.name);
        }
        checkAllPermissions() {
            return this.throwUnimplemented(this.checkAllPermissions.name);
        }
        requestPermission(_options) {
            return this.throwUnimplemented(this.requestPermission.name);
        }
        createRemindersList(_options) {
            return this.throwUnimplemented(this.createRemindersList.name);
        }
        deleteRemindersList(_options) {
            return this.throwUnimplemented(this.deleteRemindersList.name);
        }
        requestAllPermissions() {
            return this.throwUnimplemented(this.requestAllPermissions.name);
        }
        requestWriteOnlyCalendarAccess() {
            return this.throwUnimplemented(this.requestWriteOnlyCalendarAccess.name);
        }
        requestReadOnlyCalendarAccess() {
            return this.throwUnimplemented(this.requestReadOnlyCalendarAccess.name);
        }
        requestFullCalendarAccess() {
            return this.throwUnimplemented(this.requestFullCalendarAccess.name);
        }
        requestFullRemindersAccess() {
            return this.throwUnimplemented(this.requestFullRemindersAccess.name);
        }
        createEventWithPrompt(_options) {
            return this.throwUnimplemented(this.createEventWithPrompt.name);
        }
        modifyEventWithPrompt(_options) {
            return this.throwUnimplemented(this.modifyEventWithPrompt.name);
        }
        createEvent(options) {
            try {
                const content = buildEventIcs(options);
                const ics = new File([content], resolveIcsFileName(options), {
                    type: 'text/calendar;charset=utf-8',
                });
                return Promise.resolve({ id: null, ics });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return Promise.reject(new Error(message));
            }
        }
        commit() {
            return this.throwUnimplemented(this.commit.name);
        }
        modifyEvent(_options) {
            return this.throwUnimplemented(this.modifyEvent.name);
        }
        selectCalendarsWithPrompt(_options) {
            return this.throwUnimplemented(this.selectCalendarsWithPrompt.name);
        }
        fetchAllCalendarSources() {
            return this.throwUnimplemented(this.fetchAllCalendarSources.name);
        }
        listCalendars() {
            return this.throwUnimplemented(this.listCalendars.name);
        }
        fetchAllRemindersSources() {
            return this.throwUnimplemented(this.fetchAllRemindersSources.name);
        }
        getDefaultCalendar(_options) {
            return this.throwUnimplemented(this.getDefaultCalendar.name);
        }
        getDefaultRemindersList() {
            return this.throwUnimplemented(this.getDefaultRemindersList.name);
        }
        openReminders() {
            return this.throwUnimplemented(this.openReminders.name);
        }
        getRemindersLists() {
            return this.throwUnimplemented(this.getRemindersLists.name);
        }
        openCalendar(_options) {
            return this.throwUnimplemented(this.openCalendar.name);
        }
        createCalendar(_options) {
            return this.throwUnimplemented(this.createCalendar.name);
        }
        deleteCalendar(_options) {
            return this.throwUnimplemented(this.deleteCalendar.name);
        }
        createReminder(_options) {
            return this.throwUnimplemented(this.createReminder.name);
        }
        deleteRemindersById(_options) {
            return this.throwUnimplemented(this.deleteRemindersById.name);
        }
        deleteReminder(_options) {
            return this.throwUnimplemented(this.deleteReminder.name);
        }
        modifyReminder(_options) {
            return this.throwUnimplemented(this.modifyReminder.name);
        }
        getReminderById(_options) {
            return this.throwUnimplemented(this.getReminderById.name);
        }
        getRemindersFromLists(_options) {
            return this.throwUnimplemented(this.getRemindersFromLists.name);
        }
        deleteEventsById(_options) {
            return this.throwUnimplemented(this.deleteEventsById.name);
        }
        deleteEvent(_options) {
            return this.throwUnimplemented(this.deleteEvent.name);
        }
        deleteEventWithPrompt(_options) {
            return this.throwUnimplemented(this.deleteEventWithPrompt.name);
        }
        listEventsInRange(_options) {
            return this.throwUnimplemented(this.listEventsInRange.name);
        }
        modifyCalendar(_options) {
            return this.throwUnimplemented(this.modifyCalendar.name);
        }
        deleteReminderWithPrompt(_options) {
            return this.throwUnimplemented(this.deleteReminderWithPrompt.name);
        }
        updateRemindersList(_options) {
            return this.throwUnimplemented(this.updateRemindersList.name);
        }
        throwUnimplemented(methodName) {
            return Promise.reject(this.unimplemented(`${methodName} is not implemented on the web.`));
        }
    }

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CapacitorCalendarWeb: CapacitorCalendarWeb
    });

    exports.CapacitorCalendar = CapacitorCalendar;
    exports.downloadIcsFile = downloadIcsFile;

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
