export const coach = {
  title: 'Coach',
  // Label above anything the AI wrote (shown in italic).
  label: 'Coach',
  // Header line of both tabs: how to read the screen.
  subtitle: 'Italic text is written by the AI. Numbers come from the app.',
  conversation: 'Conversation',
  // Shown while the device is offline: the coach needs the network.
  offline: 'The coach needs a connection. Training works as usual, saved on this device.',
  tabs: {
    label: 'Coach sections',
    conversation: 'Chat',
    analyses: 'Debriefs',
  },
  client: {
    title: 'Weekly debriefs',
    generate: 'Generate now',
    generating: 'Generating...',
    empty: 'No debrief yet. The coach reads your week and says what to keep or change.',
    error: 'The debrief did not generate.',
    keyMissing: '{provider} key missing',
    keySetup: 'Set {variable} in .env to enable the coach.',
    applied: 'Applied',
    weekOf: 'Week of {date}',
    suggested:
      '{count, plural, one {# adjustment suggested} other {# adjustments suggested}}',
    unreadable: 'The suggested adjustments of this debrief could not be read.',
  },
  chat: {
    apiKey: 'Set {variable} in .env to enable the chat.',
    liveSession: 'Live session attached.',
    liveSessionDescription:
      'The coach sees the sets logged so far and the program targets for this workout.',
    new: 'New chat',
    conversations: 'Conversations',
    placeholder: 'Message your coach...',
    messageLabel: 'Message to the coach',
    send: 'Send',
    thinking: 'Writing...',
    error: 'The coach did not answer.',
    loadError: 'This conversation did not load.',
    suggestionsLabel: 'Suggested questions',
    suggestions: {
      plateau: 'How do I break my bench plateau?',
      deload: 'Should I take a deload?',
      swap: 'Swap an exercise because of pain',
    },
    sessionSuggestions: {
      load: 'Keep or drop the load on the next set?',
      swap: 'This exercise hurts. What can I swap?',
      rest: 'How long should I rest here?',
    },
    emptySession:
      'Mid-workout question? Ask about your next set, a load that feels off, or an exercise swap.',
    empty:
      'Ask about breaking a plateau, training volume, progression, recovery or injury adjustments.',
    advisory:
      'The chat advises but cannot edit your data. Apply changes yourself on the Programs page, or from the weekly debrief.',
  },
  context: {
    title: 'What your coach sees',
    description:
      'A summary the app calculates, plus your recent set-by-set logs. Never your account data or anything outside your training history.',
    history: 'History',
    historyValue:
      '{weeks, plural, one {# week} other {# weeks}} · {exercises, plural, one {# exercise} other {# exercises}}',
    noHistory: 'No workouts yet',
    goals: 'Goals',
    goal: '{name} {weight} kg × {reps}',
    goalProgress: '{percent}%',
    achieved: 'achieved',
    noGoals: 'None set',
    stalled: 'Stalled',
    noStalled: 'None',
    deload: 'Deload',
    deloadActive: 'This week',
    deloadRecommended: 'Recommended{reasons, select, none {} other {: {reasons}}}',
    noDeload: 'Not needed',
    conditioning: 'Conditioning',
    conditioningValue:
      '{minutes} of {target} min{km, select, none {} other { · {km} km}} · {sessions, plural, one {# session} other {# sessions}}',
    readiness: 'Readiness',
    readinessValue: '{readiness} of 5 · sleep {sleep} of 5 · {when}',
    today: 'today',
    daysAgo: '{days, plural, one {# day ago} other {# days ago}}',
    noReadiness: 'No check-in in 7 days',
  },
  note: {
    title: 'Note to your coach',
    description:
      'Add context the training data does not show, such as an injury, illness or travel.',
    placeholder: 'e.g. Travelling Oct 20-24, dumbbells only at the hotel',
    clear: 'Clear',
    save: 'Save',
    saved: 'Note saved.',
    cleared: 'Note cleared.',
    error: 'Could not save your note.',
  },
  adjustments: {
    title: 'Suggested adjustments',
    applied: 'Already applied',
    description:
      'Choose what to apply to the active program. You can edit values before confirming.',
    // The proposal block under a debrief (nothing is applied from there).
    proposed: '{count, plural, one {Proposed change} other {# proposed changes}}',
    note: 'Nothing changes until you review and confirm.',
    review: '{count, plural, one {Review change} other {Review changes}}',
    aria: 'Apply the adjustment to {exercise}',
    repsMin: 'Reps min',
    repsMax: 'Reps max',
    sets: 'Sets',
    rest: 'Rest (s)',
    targetLoad: 'Target load',
    versus: ' (vs {value})',
    applying: 'Applying...',
    apply: 'Apply {count, plural, one {# adjustment} other {# adjustments}}',
    noneSelected: 'Select at least one adjustment.',
    done: '{count, plural, one {# adjustment applied} other {# adjustments applied}}{skipped, plural, =0 {.} other { (# skipped: {names}).}}',
    error: 'Could not apply the adjustments.',
  },
};
