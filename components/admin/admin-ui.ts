// Shared classes of the admin forms (design v2): fields straight on the page,
// a 14/600 label over a 48px field, muted hints, errors in the text tone of
// the destructive accent.

// The line under a section title.
export const DESCRIPTION = '-mt-1 text-caption text-muted-foreground text-pretty';
// One label + field (+ hint) stack.
export const FIELD = 'flex flex-col gap-1.5';
export const LABEL = 'text-caption font-semibold leading-snug';
// The label of a switch row (the switch on the right of a hairline row).
export const ROW_LABEL = 'text-body font-semibold leading-snug';
export const HINT = 'text-[0.8125rem] font-medium text-muted-foreground text-pretty';
export const ERROR = 'text-caption text-destructive-text';
// A field with its button on the same line, wrapping under it on a narrow
// phone instead of squeezing the field.
export const INLINE_FORM = 'flex flex-wrap items-center gap-2';
export const INLINE_INPUT = 'min-w-[12rem] flex-1';
// A field that holds a number (a price): the widened figures of the sheet.
export const NUMBER_INPUT = 'font-num tabular-nums stretch-112';
