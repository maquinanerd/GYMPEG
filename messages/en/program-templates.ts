// Text of the built-in program templates (lib/programs/templates.ts), keyed by
// each template's `key`. `workouts` and `notes` hold the workout names and the
// exercise notes the template references by key. A program created from a
// template is saved with these texts in the user's language.
export const programTemplates = {
  fiveThreeOneBbb: {
    name: '5/3/1 (Boring But Big, 4-day)',
    summary: 'Wendler 5/3/1 main lifts with 5x10 BBB supplemental work, 4 days.',
    attribution:
      'Jim Wendler 5/3/1. Run the main lift off your training max (90% of 1RM): wave 5s/3s/1s week to week, last set AMRAP. Supplemental is 5x10 at ~50-60% TM.',
    programName: '5/3/1 Boring But Big',
    description:
      'Wendler 5/3/1 with Boring But Big supplemental volume. Set your training max to 90% of your 1RM and progress the TM, not the day-to-day load.',
    phase: 'Strength',
    workouts: {
      day1: 'Day 1 - Overhead Press',
      day2: 'Day 2 - Deadlift',
      day3: 'Day 3 - Bench Press',
      day4: 'Day 4 - Squat',
    },
    notes: {
      mainLift: 'Main lift. 5/3/1 wave off training max; last set AMRAP.',
      supplemental: 'Boring But Big supplemental: 5x10 at ~50-60% TM.',
      pullingAccessory: 'Pulling accessory to balance the pressing volume.',
    },
  },
  gzclp: {
    name: 'GZCLP (linear progression)',
    summary: 'GZCL-based linear progression: T1 5x3, T2 3x10, T3 3x15+, 3 days.',
    attribution:
      'Cody LeFever GZCLP. T1: 5x3+ heavy, add weight each session, drop to 6x2 then 10x1 on a stall. T2: 3x10 (then 3x8, 3x6). T3: 3x15+ AMRAP last set, add weight when last set hits 25.',
    programName: 'GZCLP',
    description:
      'GZCL-based linear progression with T1 (main strength), T2 (secondary volume) and T3 (accessory) tiers. Add weight each session until you stall, then drop to the next rep scheme.',
    phase: 'Strength',
    workouts: {
      dayA: 'Day A - Squat / Bench',
      dayB: 'Day B - Overhead Press / Deadlift',
      dayC: 'Day C - Bench / Squat',
    },
    notes: {
      t1: 'T1: 5x3+, last set AMRAP. Add weight each session.',
      t2: 'T2: 3x10, then 3x8 then 3x6 on stalls.',
      t3Progression: 'T3: 3x15+, last set AMRAP. Add weight when last set hits 25.',
      t3: 'T3: 3x15+, last set AMRAP.',
    },
  },
  ppl: {
    name: 'Push / Pull / Legs (6-day)',
    summary: 'Classic 6-day PPL hypertrophy split, 8-12 rep work at 1-2 RIR.',
    attribution:
      'Standard Push/Pull/Legs run twice per week. Hypertrophy rep ranges (8-15), 1-2 RIR, progress load when you hit the top of the range across all sets.',
    programName: 'Push Pull Legs',
    description:
      'A 6-day Push/Pull/Legs hypertrophy split. Train each session twice per week; progress load when the top of the rep range is reached on all sets.',
    phase: 'Hypertrophy',
    workouts: {
      pushA: 'Push A',
      pullA: 'Pull A',
      legsA: 'Legs A',
      pushB: 'Push B',
      pullB: 'Pull B',
      legsB: 'Legs B',
    },
  },
  upperLower: {
    name: 'Upper / Lower (4-day)',
    summary: '4-day Upper/Lower split balancing strength and hypertrophy work.',
    attribution:
      'Standard 4-day Upper/Lower. Heavier compound work (5-8 reps) early in each session, hypertrophy accessories (8-15 reps) after, 1-2 RIR.',
    programName: 'Upper Lower',
    description:
      'A 4-day Upper/Lower split. Lead with a heavier compound, then accumulate hypertrophy volume on accessories. Progress load at the top of each rep range.',
    phase: 'Hypertrophy',
    workouts: {
      upperA: 'Upper A',
      lowerA: 'Lower A',
      upperB: 'Upper B',
      lowerB: 'Lower B',
    },
  },
  nsuns: {
    name: 'nSuns 531 LP (4-day)',
    summary: 'nSuns 531 linear progression, 4 days, volume-heavy main-lift waves.',
    attribution:
      'nSuns 531 LP. The main lift runs a 9-set wave (e.g. 8/6/4/4/4/5/6/7/8+ reps at rising then falling %TM); the AMRAP on the key set drives the weekly TM increase. Express the wave by logging the prescribed reps each set.',
    programName: 'nSuns 531 LP',
    description:
      'nSuns 531 linear progression. Each main lift runs a 9-set intensity wave with an AMRAP set that decides next week’s training-max bump. Run the prescribed reps per set as written.',
    phase: 'Strength',
    workouts: {
      day1: 'Day 1 - Bench / OHP',
      day2: 'Day 2 - Squat / Sumo Deadlift',
      day3: 'Day 3 - OHP / Incline Bench',
      day4: 'Day 4 - Deadlift / Front Squat',
    },
    notes: {
      t1Wave: 'nSuns T1 wave: 8/6/4/4/4/5/6/7/8+ reps; key set is AMRAP.',
      t1DeadliftWave: 'nSuns T1 wave: 5/3/1/3/3/3/5/7/4+ reps; key set is AMRAP.',
      t2UpperWave: 'nSuns T2 wave: 6/5/3/5/7/4/6/8 reps.',
      t2LowerWave: 'nSuns T2 wave: 5/5/3/5/7/4/6/8 reps.',
    },
  },
  startingStrength: {
    name: 'Starting Strength (3x5 A/B)',
    summary:
      'Rippetoe novice linear progression: two full-body days, 3x5, add weight every session.',
    attribution:
      'Mark Rippetoe Starting Strength. Alternate workout A and B across 3 sessions per week. Squat every session 3x5; add 2.5-5 kg each time you complete all reps. Deadlift is 1x5. Reset 10% on a stall.',
    programName: 'Starting Strength',
    description:
      'Rippetoe novice barbell linear progression. Two alternating full-body workouts, three sessions per week. Squat 3x5 every session and add a small jump whenever all prescribed reps are completed.',
    phase: 'Strength',
    workouts: {
      workoutA: 'Workout A - Squat / Bench / Deadlift',
      workoutB: 'Workout B - Squat / Press / Power Clean',
    },
    notes: {
      squat: '3x5. Add 2.5-5 kg every session you complete all reps.',
      press: '3x5. Add weight every session you complete all reps.',
      deadlift: '1x5 working set. Add weight every session.',
      powerClean: '5x3 explosive pulls. Beginners may substitute barbell rows.',
    },
  },
  stronglifts: {
    name: 'StrongLifts 5x5 (A/B)',
    summary: 'Two alternating full-body workouts, 5x5 main lifts, add weight every session.',
    attribution:
      'StrongLifts 5x5 by Mehdi. Alternate workout A and B across 3 sessions per week. 5x5 on squat, bench, press and row; deadlift 1x5. Add 2.5 kg each session; deload 10% after three failed attempts.',
    programName: 'StrongLifts 5x5',
    description:
      'Two alternating full-body workouts run three times per week. 5x5 on the main lifts (deadlift 1x5). Add a small jump every session and deload 10% after stalling three times.',
    phase: 'Strength',
    workouts: {
      workoutA: 'Workout A - Squat / Bench / Row',
      workoutB: 'Workout B - Squat / Press / Deadlift',
    },
    notes: {
      squat: '5x5. Add 2.5 kg every session you complete all reps.',
      mainLift: '5x5. Add weight every session you complete all reps.',
      deadlift: '1x5 working set. Add weight every session.',
    },
  },
  madcow: {
    name: 'Madcow 5x5 (intermediate)',
    summary: 'Weekly ramping 5x5: heavy Monday top set, light Wednesday, Friday PR triple.',
    attribution:
      'Madcow 5x5 intermediate program. Monday ramps in 5 sets to a top set of 5; Wednesday is lighter recovery volume; Friday ramps to a heavy top set then a back-off. Progress the load week to week, not session to session.',
    programName: 'Madcow 5x5',
    description:
      'Intermediate weekly-progression 5x5. Ramp across sets to a heavy top set on Monday, take a lighter Wednesday, and hit a new top set on Friday. Add weight week over week rather than every session.',
    phase: 'Strength',
    workouts: {
      monday: 'Monday - Heavy Ramp',
      wednesday: 'Wednesday - Light',
      friday: 'Friday - Top Set / PR',
    },
    notes: {
      squatRamp: 'Ramp 5 sets to a top set of 5. Top set sits near 1-2 RIR.',
      ramp: 'Ramp 5 sets to a top set of 5.',
      squatLight: 'Lighter recovery volume; ramp to Monday’s 3rd set load.',
      light: 'Lighter recovery volume.',
      deadliftLight: 'Lighter ramp; save the heavy pull for the weekly progression.',
      squatTopSet: 'Ramp to a heavy top set of 3 (PR set), then one back-off set of 8.',
      benchTopSet: 'Ramp to a heavy top set of 3 (PR set), then a back-off set.',
      rowTopSet: 'Ramp to a heavy top set, then a back-off set.',
    },
  },
  phul: {
    name: 'PHUL (Power Hypertrophy Upper Lower)',
    summary: '4-day upper/lower mixing two heavy power days with two higher-rep hypertrophy days.',
    attribution:
      'PHUL (Power Hypertrophy Upper Lower). Two power days (3-5 reps on main lifts) and two hypertrophy days (8-15 reps). Progress load on the power days; chase volume and the rep range on the hypertrophy days.',
    programName: 'PHUL',
    description:
      'Power Hypertrophy Upper Lower. Two heavier power days build strength on the main lifts (3-5 reps) and two hypertrophy days accumulate volume (8-15 reps). Four sessions per week.',
    phase: 'Hypertrophy',
    workouts: {
      upperPower: 'Upper Power',
      lowerPower: 'Lower Power',
      upperHypertrophy: 'Upper Hypertrophy',
      lowerHypertrophy: 'Lower Hypertrophy',
    },
  },
  phat: {
    name: 'PHAT (Power Hypertrophy Adaptive Training)',
    summary: 'Layne Norton 5-day split: two power days plus three high-volume hypertrophy days.',
    attribution:
      'PHAT by Layne Norton. Two power days train the main lifts in the 3-5 rep range; three hypertrophy days train the same patterns lighter for 8-20 reps. Five sessions per week, high overall volume.',
    programName: 'PHAT',
    description:
      'Power Hypertrophy Adaptive Training (Layne Norton). Two power days (3-5 reps) drive strength and three hypertrophy days (8-20 reps) drive volume across upper and lower body. Five sessions per week.',
    phase: 'Hypertrophy',
    workouts: {
      upperPower: 'Upper Power',
      lowerPower: 'Lower Power',
      backShouldersHypertrophy: 'Back / Shoulders Hypertrophy',
      lowerHypertrophy: 'Lower Hypertrophy',
      chestArmsHypertrophy: 'Chest / Arms Hypertrophy',
    },
  },
  fullBody: {
    name: 'Full Body 3x/week (beginner)',
    summary: 'Beginner-friendly full-body program, three sessions per week, moderate volume.',
    attribution:
      'Generic beginner full-body, three non-consecutive days per week. Each session hits the whole body with one main compound per pattern plus an accessory. Add weight when you reach the top of the rep range on all sets.',
    programName: 'Full Body 3x',
    description:
      'A beginner-friendly full-body program run three non-consecutive days per week. Each day covers a squat, a hinge/pull, a press and an accessory, in the 6-15 rep range. Progress load at the top of each range.',
    phase: 'General',
    workouts: {
      fullBodyA: 'Full Body A',
      fullBodyB: 'Full Body B',
      fullBodyC: 'Full Body C',
    },
  },
};
