/**
 * mockEntries.ts - Sample Data for the Constellation Star Map
 *
 * The app currently keeps `entries` in React state only (see App.tsx),
 * so a fresh page load always starts with an empty array and there's
 * nothing for StarMap to render. This file provides a small, varied
 * set of entries (spread across several categories, with different
 * tags/notes/dates) purely so the Constellation page has something
 * "starry" to show while testing the visualization.
 *
 * Constellation.tsx falls back to this data only when the real
 * `entries` array (lifted in App.tsx) is empty - as soon as the user
 * adds their own entries via the '+' button, those take over.
 *
 * DYNAMIC CATEGORIES:
 * Categories used to be a fixed ActivityType enum, so this file just
 * picked enum values off the shelf (ActivityType.Dance, etc). Categories
 * are now a plain, localStorage-backed list (see utils/categories.ts),
 * but Shuffle Dance, House Dance, C-Walk, Indoor Bouldering, Outdoor
 * Bouldering, Flying Pole, and Language Learning are all part of
 * DEFAULT_CATEGORIES (see types/Category.ts) - the seed list every fresh
 * browser already starts with - so this file can just reference their
 * fixed ids directly below, the same way it referenced fixed enum values
 * before. No addCategory calls needed here: unlike a genuinely
 * user-invented category (created via AddEntryForm's "+ Add new
 * category" flow), these are already guaranteed to exist.
 */

import { createEntry, Entry } from '../types/Entry';

export function generateMockEntries(): Entry[] {
  return [
    // ─── Shuffle Dance ───
    createEntry({
      activityType: 'ShuffleDance',
      title: 'Running man drills in the garage',
      description: 'Ran through running man and T-step combos for an hour.',
      tags: ['running-man', 'practice'],
      mediaLinks: [],
      notes: 'Legs are toast but the timing is finally clicking.',
      timestamp: '2026-08-12T21:00:00.000Z',
    }),
    createEntry({
      activityType: 'ShuffleDance',
      title: 'Shuffle meetup at the rec center',
      description: 'First time shuffling with a group instead of solo practice.',
      tags: ['social', 'running-man'],
      mediaLinks: [],
      notes: 'Way easier to hold rhythm when the music is loud and shared.',
      timestamp: '2026-06-10T20:00:00.000Z',
    }),

    // ─── House Dance ───
    createEntry({
      activityType: 'HouseDance',
      title: 'House class - intro to grooves',
      description: 'First house dance class, focused on the basic groove.',
      tags: ['groove', 'class'],
      mediaLinks: [],
      notes: 'Much more about weight shifts than I expected.',
      timestamp: '2026-07-28T18:00:00.000Z',
    }),
    createEntry({
      activityType: 'HouseDance',
      title: 'Jacking practice to a new playlist',
      description: 'Worked on the jack isolation drills for 30 minutes.',
      tags: ['jacking', 'practice'],
      mediaLinks: [],
      notes: 'Core is sore in a way it has not been from anything else.',
      timestamp: '2026-06-02T19:00:00.000Z',
    }),

    // ─── C-Walk ───
    createEntry({
      activityType: 'CWalk',
      title: 'Learning the basic crosswalk step',
      description: 'Followed a tutorial breaking down the foot-crossing pattern.',
      tags: ['tutorial', 'footwork'],
      mediaLinks: [],
      notes: 'Balance is the hard part, not the speed.',
      timestamp: '2026-08-03T17:30:00.000Z',
    }),
    createEntry({
      activityType: 'CWalk',
      title: 'Filmed a practice clip',
      description: 'Recorded myself running through the combo to check form.',
      tags: ['footwork', 'practice'],
      mediaLinks: [],
      notes: 'Looks way less smooth on camera than it feels live.',
      timestamp: '2026-06-22T18:45:00.000Z',
    }),

    // ─── Indoor Bouldering ───
    createEntry({
      activityType: 'IndoorBouldering',
      title: 'Bouldering session - V3 project',
      description: 'Worked the overhung V3 in the back cave.',
      tags: ['V3', 'overhang'],
      mediaLinks: [],
      notes: 'Sent it on the fourth try, the heel hook was the key.',
      timestamp: '2026-08-24T16:00:00.000Z',
    }),
    createEntry({
      activityType: 'IndoorBouldering',
      title: 'Kilter board session',
      description: 'Ran through a few benchmark kilter problems.',
      tags: ['kilter', 'V2'],
      mediaLinks: [],
      notes: 'Steep boards expose every weakness in my core.',
      timestamp: '2026-07-05T19:00:00.000Z',
    }),

    // ─── Outdoor Bouldering ───
    createEntry({
      activityType: 'OutdoorBouldering',
      title: 'Crag day at the boulder field',
      description: 'Drove out with a couple friends and a crash pad.',
      tags: ['outdoor', 'crash-pad'],
      mediaLinks: [],
      notes: 'Real rock feels so different from plastic holds.',
      timestamp: '2026-08-09T14:00:00.000Z',
    }),
    createEntry({
      activityType: 'OutdoorBouldering',
      title: 'Sent an outdoor V2 highball',
      description: 'Topped out a tall-for-its-grade problem with a spotter.',
      tags: ['outdoor', 'highball'],
      mediaLinks: [],
      notes: 'The height made a V2 feel a lot scarier than it should.',
      timestamp: '2026-06-28T15:00:00.000Z',
    }),

    // ─── Flying Pole ───
    createEntry({
      activityType: 'FlyingPole',
      title: 'Pole conditioning session',
      description: 'Worked on grip strength and basic spins.',
      tags: ['conditioning', 'spins'],
      mediaLinks: [],
      notes: 'Forearms are going to hate me tomorrow.',
      timestamp: '2026-08-14T18:00:00.000Z',
    }),
    createEntry({
      activityType: 'FlyingPole',
      title: 'First invert attempt',
      description: 'Tried climbing into a basic invert with a crash mat down.',
      tags: ['invert', 'practice'],
      mediaLinks: [],
      notes: 'Got upside down for about a second before bailing - progress.',
      timestamp: '2026-06-15T19:30:00.000Z',
    }),

    // ─── Language Learning ───
    createEntry({
      activityType: 'LanguageLearning',
      title: 'Spanish conversation exchange',
      description: 'Met up with a language partner for an hour of Spanish.',
      tags: ['spanish', 'speaking'],
      mediaLinks: [],
      notes: 'Subjunctive mood is still tripping me up.',
      timestamp: '2026-08-22T12:00:00.000Z',
    }),
    createEntry({
      activityType: 'LanguageLearning',
      title: 'Vietnamese listening practice',
      description: 'Watched a Vietnamese cooking show with subtitles off.',
      tags: ['vietnamese', 'listening'],
      mediaLinks: [],
      notes: 'Caught about 40% of it, tones are getting easier to hear.',
      timestamp: '2026-07-19T20:00:00.000Z',
    }),
  ];
}
