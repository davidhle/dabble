/**
 * mockEntries.ts - Sample Data for the Constellation Star Map
 *
 * The app currently keeps `entries` in React state only (see App.tsx),
 * so a fresh page load always starts with an empty array and there's
 * nothing for StarMap to render. This file provides a small, varied
 * set of entries (spread across every ActivityType, with different
 * tags/notes/dates) purely so the Constellation page has something
 * "starry" to show while testing the visualization.
 *
 * Constellation.tsx falls back to this data only when the real
 * `entries` array (lifted in App.tsx) is empty - as soon as the user
 * adds their own entries via the '+' button, those take over.
 */

import { ActivityType, createEntry, Entry } from '../types/Entry';

export function generateMockEntries(): Entry[] {
  return [
    // ─── Dance ───
    createEntry({
      activityType: ActivityType.Dance,
      title: 'Salsa social night',
      description: 'Dropped into the open social at the studio downtown.',
      tags: ['salsa', 'social'],
      mediaLinks: [],
      notes: 'Finally landed the cross-body lead without stepping on anyone.',
      timestamp: '2026-08-20T19:30:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Dance,
      title: 'Shuffle practice in the garage',
      description: 'Ran through running man and T-step combos.',
      tags: ['shuffle', 'practice'],
      mediaLinks: [],
      notes: 'Legs are toast but the timing is finally clicking.',
      timestamp: '2026-08-12T21:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Dance,
      title: 'House class - intro to grooves',
      description: 'First house dance class, focused on the basic groove.',
      tags: ['house', 'class'],
      mediaLinks: [],
      notes: 'Much more about weight shifts than I expected.',
      timestamp: '2026-07-28T18:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Dance,
      title: 'Pole conditioning session',
      description: 'Worked on grip strength and basic spins.',
      tags: ['pole', 'practice'],
      mediaLinks: [],
      notes: 'Forearms are going to hate me tomorrow.',
      timestamp: '2026-07-15T17:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Dance,
      title: 'Battle night spectating',
      description: 'Watched the local breaking battle, took notes on footwork.',
      tags: ['battle', 'practice'],
      mediaLinks: [],
      notes: 'Want to try entering the beginner bracket next season.',
      timestamp: '2026-06-30T20:00:00.000Z',
    }),

    // ─── Climbing ───
    createEntry({
      activityType: ActivityType.Climbing,
      title: 'Bouldering session - V3 project',
      description: 'Worked the overhung V3 in the back cave.',
      tags: ['bouldering', 'V3', 'indoor'],
      mediaLinks: [],
      notes: 'Sent it on the fourth try, the heel hook was the key.',
      timestamp: '2026-08-24T16:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Climbing,
      title: 'Outdoor top-rope day',
      description: 'Drove out to the crag with a couple friends.',
      tags: ['top-rope', 'outdoor'],
      mediaLinks: [],
      notes: 'Real rock feels so different from plastic holds.',
      timestamp: '2026-08-09T14:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Climbing,
      title: 'Lead climbing certification',
      description: 'Took the gym lead belay/climb certification class.',
      tags: ['lead', 'indoor'],
      mediaLinks: [],
      notes: 'Clipping above my head while pumped is scarier than expected.',
      timestamp: '2026-07-22T10:30:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Climbing,
      title: 'Kilter board session',
      description: 'Ran through a few benchmark kilter problems.',
      tags: ['kilter', 'V2'],
      mediaLinks: [],
      notes: 'Steep boards expose every weakness in my core.',
      timestamp: '2026-07-05T19:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Climbing,
      title: 'V4 attempt - the crimpy one',
      description: 'Multiple burns on the new V4 setter problem.',
      tags: ['bouldering', 'V4', 'indoor'],
      mediaLinks: [],
      notes: 'Did not send, but got past the crux move for the first time.',
      timestamp: '2026-06-18T18:30:00.000Z',
    }),

    // ─── Language Learning ───
    createEntry({
      activityType: ActivityType.LanguageLearning,
      title: 'Spanish conversation exchange',
      description: 'Met up with a language partner for an hour of Spanish.',
      tags: ['spanish', 'speaking'],
      mediaLinks: [],
      notes: 'Subjunctive mood is still tripping me up.',
      timestamp: '2026-08-22T12:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.LanguageLearning,
      title: 'French vocabulary drills',
      description: 'Ran through 100 flashcards on food and cooking words.',
      tags: ['french', 'vocabulary'],
      mediaLinks: [],
      notes: 'Retention feels better when I cook while reviewing.',
      timestamp: '2026-08-05T09:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.LanguageLearning,
      title: 'Vietnamese listening practice',
      description: 'Watched a Vietnamese cooking show with subtitles off.',
      tags: ['vietnamese', 'listening'],
      mediaLinks: [],
      notes: 'Caught about 40% of it, tones are getting easier to hear.',
      timestamp: '2026-07-19T20:00:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.LanguageLearning,
      title: 'German grammar review',
      description: 'Went over case endings for der/die/das.',
      tags: ['german', 'grammar'],
      mediaLinks: [],
      notes: 'Dative case is finally starting to feel automatic.',
      timestamp: '2026-06-25T08:30:00.000Z',
    }),

    // ─── Other ───
    createEntry({
      activityType: ActivityType.Other,
      customActivityType: 'Photography',
      title: 'Golden hour walk with the camera',
      description: 'Shot a roll of film around the park.',
      tags: ['creative', 'hobby'],
      mediaLinks: [],
      notes: 'Light was incredible around 7:15pm, need to go back same time.',
      timestamp: '2026-08-16T19:15:00.000Z',
    }),
    createEntry({
      activityType: ActivityType.Other,
      customActivityType: 'Woodworking',
      title: 'Started a small shelf project',
      description: 'Cut and sanded the boards for a floating shelf.',
      tags: ['project', 'creative'],
      mediaLinks: [],
      notes: 'Measured twice, cut once - actually worked out this time.',
      timestamp: '2026-07-01T15:00:00.000Z',
    }),
  ];
}
