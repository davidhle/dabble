/**
 * useRelationHighlight - What The Canvases Highlight For The Focused Entry
 *
 * While an entry is focused (EntrySelectionContext's `expandedEntryId`),
 * its related entries (utils/entryRelations.ts - authored links and
 * inferred tag/place/mood matches) stay at full strength and everything
 * else is dimmed, with the same dimming the category filter uses.
 * Hovering a row in the sidebar's Related list narrows that to just the
 * focused entry and the hovered one, as a preview.
 *
 * Computed once per page and handed to its canvas: SpiralTimeline /
 * LinearTimeline only need `highlightedIds`; StarMap also draws a line per
 * related entry, so it gets the authored/inferred split too.
 */

import { useMemo } from 'react';
import { Entry } from '../types/Entry';
import { useEntrySelectionContext } from '../context/EntrySelectionContext';
import { getRelatedEntryIds } from '../utils/entryRelations';

export interface RelationHighlight {
  focusedEntryId: string;
  authoredIds: Set<string>;
  inferredIds: Set<string>;
  /** The Related row being hovered, if any. */
  previewEntryId: string | null;
  /** Entries kept at full strength - everything else is dimmed. */
  highlightedIds: Set<string>;
}

/** Null when no entry is focused (nothing is dimmed then). */
export function useRelationHighlight(
  entries: Entry[]
): RelationHighlight | null {
  const { expandedEntryId, relationPreviewEntryId } =
    useEntrySelectionContext();

  const related = useMemo(() => {
    const focused = entries.find(entry => entry.id === expandedEntryId);
    return focused ? getRelatedEntryIds(focused, entries) : null;
  }, [entries, expandedEntryId]);

  return useMemo(() => {
    if (!expandedEntryId || !related) return null;
    return {
      focusedEntryId: expandedEntryId,
      authoredIds: related.authored,
      inferredIds: related.inferred,
      previewEntryId: relationPreviewEntryId,
      highlightedIds: new Set(
        relationPreviewEntryId
          ? [expandedEntryId, relationPreviewEntryId]
          : [expandedEntryId, ...related.authored, ...related.inferred]
      ),
    };
  }, [expandedEntryId, related, relationPreviewEntryId]);
}
