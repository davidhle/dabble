/**
 * ManageCategoriesModal.tsx - Rename/Recolor/Delete Existing Categories
 *
 * Opened from FilterBar's "Manage Categories" pencil button (to the left of
 * "Show All"). Reuses the same dark-theme modal chrome (overlay + centered
 * card, `dark-scrollbar` internal scroll, no close-on-backdrop-click) and
 * the same capture-phase Escape-to-close AddEntryForm.tsx already
 * established - see that file's ESCAPE-TO-CANCEL comment for why the
 * capture-phase listener (not a plain bubble-phase one) is required to stop
 * Escape from ALSO reaching EntrySelectionContext.tsx's own window listener
 * underneath and collapsing a sidebar panel / advancing the canvas reset
 * while this modal is open.
 *
 * RENAME/RECOLOR NEEDS NO ENTRY DATA CHANGES: every Entry stores its
 * category as `activityType`, a stable category id - never a name or color
 * snapshot of its own (see the Category doc comment in types/Category.ts).
 * So renaming or recoloring a category here only ever rewrites the Category
 * object itself, via updateCategory in utils/categories.ts; every entry
 * that references it by id picks up the new name/color the next time it's
 * looked up (getCategoryName/getActivityColor), with zero Entry objects
 * touched. See updateCategory's own comment for the same point.
 *
 * WHY DELETE HERE IS A SINGLE confirm(), NOT AddEntryForm's TWO-STEP FLOW:
 * AddEntryForm's own entry-delete can ORPHAN a category (deleting an
 * entry can leave its category with zero remaining entries), so that flow
 * needs to warn about a cascading category delete before it happens. Here
 * it's the reverse and much simpler: the trash button for a category is
 * simply DISABLED (with an explanatory `title`) for as long as `entries`
 * contains anything referencing it, so by the time it's ever clickable
 * there is nothing left to cascade - a single native confirm() is enough.
 * Delete is also the ONE thing here that still persists immediately
 * (unlike name/color below) - it's destructive and independently
 * confirmed, so there's no "unsaved" state for it to sit in.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DRAFT STATE UNTIL 'DONE'
 * ──────────────────────────────────────────────────────────────────────
 * Name and color edits used to write straight to localStorage the instant
 * a swatch was clicked or a name field lost focus. That made every pick a
 * live, uncancellable commit - clicking through a few colors to compare
 * them meant actually overwriting the saved category each time, with no
 * way to back out short of picking the old color again from memory.
 *
 * Edits now live in `drafts` - a plain `{ [categoryId]: { name, color } }`
 * map, seeded from the last-persisted `categories` snapshot every time the
 * modal opens (see the `isOpen` effect below) and otherwise touched by
 * NOTHING but this component's own handlers. Every row reads FROM `drafts`
 * (not `categories`) for what to display, so clicking a swatch or editing
 * a name updates the on-screen preview immediately without writing
 * anything to storage. `categories` itself stays frozen at whatever was
 * persisted when the modal opened, which is exactly what makes it useful
 * as the "original" value for the per-row undo button and the color
 * picker's "Current" swatch below.
 *
 * `commitDrafts` (called only from the Done button) is the one place that
 * diffs each draft against its matching `categories` entry and calls
 * updateCategory for whatever actually changed, then fires
 * `onCategoriesChanged` once for the whole batch - so ten edits made
 * before clicking Done cost one app-wide refresh, not ten. The header's
 * close (X) button and Escape do NOT call `commitDrafts` - they simply
 * close the modal, discarding whatever's in `drafts`; since `drafts` is
 * always re-seeded from the real persisted list the next time the modal
 * opens, there's nothing left to explicitly roll back.
 *
 * ──────────────────────────────────────────────────────────────────────
 * REACTIVITY: SEE StarMap/LinearTimeline/SpiralTimeline's OWN COMMENTS
 * ──────────────────────────────────────────────────────────────────────
 * `onCategoriesChanged` (App.tsx's own refreshCategories, via
 * EntrySelectionContext) is what makes star colors, capsule/arc colors,
 * filter chips, and panel accents update immediately across all three
 * visualization pages instead of only inside this modal - each of those
 * three canvases now also lists `categories` as a dependency of the
 * useMemo that computes its entries' colors, which is the other half of
 * "immediately" (bumping `categoriesVersion` alone doesn't help a memoized
 * color list that was never going to recompute in response to it).
 */

import { useCallback, useEffect, useState } from 'react';
import { Entry } from '../types/Entry';
import { Category } from '../types/Category';
import {
  loadCategories,
  updateCategory,
  deleteCategory,
  getHueRotatedColorOptions,
} from '../utils/categories';

/** A single category's in-progress, not-yet-persisted edit. */
interface CategoryDraft {
  name: string;
  color: string;
}

/** How many golden-angle "Suggestions" swatches the expanded picker offers per category. */
const SUGGESTION_COUNT = 5;

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The full, unfiltered entries array - used only to count how many
   * entries reference each category (by activityType), which gates that
   * category's own delete button. Deliberately the FULL array, not a
   * time-range-filtered one, since a category shouldn't become deletable
   * just because the active time window happens to hide its entries.
   */
  entries: Entry[];
  /**
   * Called once after Done commits any staged rename/recolor, and
   * immediately after a delete (which still persists right away - see the
   * top-of-file comment). Wired to EntrySelectionContext's
   * `refreshCategories` by FilterBar, so every page's own category-derived
   * colors/labels refresh immediately. See the top-of-file comment.
   */
  onCategoriesChanged: () => void;
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  entries,
  onCategoriesChanged,
}: ManageCategoriesModalProps) {
  // The last-PERSISTED snapshot - frozen once the modal opens (see the
  // `isOpen` effect below), so it stays a stable "original" reference for
  // the per-row undo button and the color picker's "Current" swatch even
  // while `drafts` below is being edited. Only reloaded from localStorage
  // when the modal (re)opens, or right after a delete (see `handleDelete`).
  const [categories, setCategories] = useState<Category[]>([]);
  // Staged name/color edits, keyed by category id - see the top-of-file
  // DRAFT STATE UNTIL 'DONE' comment. Every row's displayed name/color
  // reads from here, never from `categories` directly.
  const [drafts, setDrafts] = useState<Record<string, CategoryDraft>>({});
  // Which single category's expanded color picker is currently open, or
  // null - only one at a time, mirroring AddEntryForm's own single-grid
  // "+ Add new category" sub-form.
  const [openSwatchId, setOpenSwatchId] = useState<string | null>(null);

  // Loads a fresh snapshot and re-seeds `drafts` from it every time the
  // modal opens - picks up anything created/renamed/deleted in a previous
  // session or elsewhere in the app since this modal last opened, and (just
  // as importantly) throws away whatever was left in `drafts` from a
  // previous open that was dismissed without clicking Done.
  useEffect(() => {
    if (!isOpen) return;
    const fresh = loadCategories();
    setCategories(fresh);
    setDrafts(
      Object.fromEntries(
        fresh.map(category => [
          category.id,
          { name: category.name, color: category.color },
        ])
      )
    );
    setOpenSwatchId(null);
  }, [isOpen]);

  /**
   * Diffs every draft against its matching persisted `categories` entry
   * and writes only the fields that actually changed, via updateCategory -
   * see that function's own comment for why a rename/recolor never needs
   * to touch Entry data. Fires `onCategoriesChanged` once, after every
   * changed category has been written, rather than once per category, so
   * several staged edits collapse into a single app-wide refresh.
   */
  const commitDrafts = useCallback(() => {
    let anyChanged = false;

    for (const category of categories) {
      const draft = drafts[category.id];
      if (!draft) continue;

      const name = draft.name.trim() || category.name;
      const updates: Partial<Pick<Category, 'name' | 'color'>> = {};
      if (name !== category.name) updates.name = name;
      if (draft.color !== category.color) updates.color = draft.color;

      if (Object.keys(updates).length > 0) {
        updateCategory(category.id, updates);
        anyChanged = true;
      }
    }

    if (anyChanged) {
      onCategoriesChanged();
    }
  }, [categories, drafts, onCategoriesChanged]);

  const handleDone = useCallback(() => {
    commitDrafts();
    setOpenSwatchId(null);
    onClose();
  }, [commitDrafts, onClose]);

  /**
   * Closes WITHOUT committing - the header's X button and Escape (below)
   * both use this. Nothing needs to be explicitly rolled back: `drafts` is
   * simply left as-is and gets overwritten by the `isOpen` effect above
   * the next time the modal opens.
   */
  const handleDiscard = useCallback(() => {
    setOpenSwatchId(null);
    onClose();
  }, [onClose]);

  // ─── ESCAPE-TO-CLOSE (capture phase) ───
  // See the top-of-file comment for why this must be capture-phase, not
  // bubble-phase - identical reasoning (and identical risk if omitted) to
  // AddEntryForm.tsx's own ESCAPE-TO-CANCEL effect. Escape DISCARDS staged
  // edits, same as the header's X button - see handleDiscard's own comment.
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleDiscard();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, handleDiscard]);

  /** Updates a category's staged name draft as the user types - no persistence, see the top-of-file comment. */
  const handleNameChange = (categoryId: string, name: string) => {
    setDrafts(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], name },
    }));
  };

  /**
   * On blur (or Enter, which just blurs - see the input's own onKeyDown
   * below), snaps a blank draft name back to the persisted name rather
   * than leaving an empty staged edit around. A non-blank draft is left
   * exactly as typed - it isn't written to storage until Done (see
   * commitDrafts).
   */
  const handleNameBlur = (categoryId: string) => {
    const original = categories.find(category => category.id === categoryId);
    const draft = drafts[categoryId];
    if (!original || !draft) return;

    if (!draft.name.trim()) {
      setDrafts(prev => ({
        ...prev,
        [categoryId]: { ...prev[categoryId], name: original.name },
      }));
    }
  };

  /** Color swatch pick - stages the draft only, see the top-of-file comment. */
  const handleColorPick = (categoryId: string, color: string) => {
    setDrafts(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], color },
    }));
    setOpenSwatchId(null);
  };

  /**
   * Native `<input type="color">` onChange - stages the draft color like
   * handleColorPick above, but deliberately does NOT close the swatch
   * panel. Chrome/Firefox fire React's onChange continuously (once per
   * `input` event) while the user is still dragging around inside the OS
   * color dialog, not just once when they finish. Since that `<input>`
   * only exists in the DOM while `isSwatchOpen` is true (see the JSX
   * below), closing the panel on the very first of those events would
   * unmount the input mid-drag and cut the picker off after a single
   * tick. The panel is left open here and only closes via the swatch
   * toggle button, a preset pick, or the modal's own Done/close/Escape.
   */
  const handleCustomColorChange = (categoryId: string, color: string) => {
    setDrafts(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], color },
    }));
  };

  /**
   * Resets just this ONE category's draft color back to its last-persisted
   * value - the per-row undo button below. Leaves that category's own
   * draft NAME, and every other category's draft entirely, untouched.
   */
  const handleRevertColor = (categoryId: string) => {
    const original = categories.find(category => category.id === categoryId);
    if (!original) return;
    setDrafts(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], color: original.color },
    }));
  };

  const handleDelete = (category: Category) => {
    if (
      !window.confirm(
        `Delete the "${category.name}" category? This cannot be undone.`
      )
    ) {
      return;
    }

    deleteCategory(category.id);
    const fresh = loadCategories();
    setCategories(fresh);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[category.id];
      return next;
    });
    onCategoriesChanged();
  };

  if (!isOpen) return null;

  return (
    // See AddEntryForm.tsx's MODAL STRUCTURE comment: no onClick here on
    // the overlay - only Escape or the header's close/Done buttons close
    // this modal, so a stray click outside the card can't silently discard
    // a still-open color picker mid-pick.
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="flex w-[90vw] max-w-[500px] flex-col rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] shadow-xl"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-shrink-0 border-b border-[var(--panel-border-color)] px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-color)]">
                Manage Categories
              </h2>
              <button
                type="button"
                onClick={handleDiscard}
                className="text-[var(--text-muted-color)] hover:text-[var(--text-secondary-color)]"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* dark-scrollbar: same transparent-track/visible-thumb treatment as AddEntryForm's own scrollable content - see its comment. */}
          <div className="dark-scrollbar flex-1 overflow-y-auto px-6 py-4">
            {categories.length === 0 ? (
              <p className="text-sm text-[var(--text-muted-color)]">
                No categories yet.
              </p>
            ) : (
              <div className="space-y-3">
                {categories.map(category => {
                  const draft = drafts[category.id] ?? {
                    name: category.name,
                    color: category.color,
                  };
                  const entryCount = entries.filter(
                    entry => entry.activityType === category.id
                  ).length;
                  const canDelete = entryCount === 0;
                  const isSwatchOpen = openSwatchId === category.id;
                  const hasUnsavedColor = draft.color !== category.color;

                  // "In use" group - every OTHER category's own draft color
                  // (what it'll actually be once Done is clicked), deduped
                  // so two categories that already share a color don't
                  // render two identical swatches.
                  const inUseColors = Array.from(
                    new Set(
                      categories
                        .filter(other => other.id !== category.id)
                        .map(other => drafts[other.id]?.color ?? other.color)
                    )
                  );

                  // "Suggestions" - golden-angle hue rotation relative to
                  // THIS category's own current (persisted) color, not the
                  // in-progress draft - so the suggestions offered don't
                  // shift out from under the user as they click through
                  // options before settling on one.
                  const suggestedColors = getHueRotatedColorOptions(
                    category.color,
                    SUGGESTION_COUNT
                  );

                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Color swatch - click reveals the expanded picker below. */}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSwatchId(isSwatchOpen ? null : category.id)
                          }
                          aria-label={`Change color for ${category.name}`}
                          aria-expanded={isSwatchOpen}
                          className="h-7 w-7 flex-shrink-0 rounded-full border-2 border-[var(--field-border-strong)] transition-transform hover:scale-110"
                          style={{ backgroundColor: draft.color }}
                        />

                        {/* Per-category undo - reverts ONLY this category's staged color, see handleRevertColor. */}
                        <button
                          type="button"
                          onClick={() => handleRevertColor(category.id)}
                          disabled={!hasUnsavedColor}
                          title={
                            hasUnsavedColor
                              ? 'Revert to saved color'
                              : 'No unsaved color change'
                          }
                          aria-label={`Revert ${category.name} to its saved color`}
                          className="flex-shrink-0 text-[var(--text-muted-color)] transition-colors hover:text-[var(--accent-color)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-muted-color)]"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 15L4 10m0 0l5-5m-5 5h11a4 4 0 010 8h-1"
                            />
                          </svg>
                        </button>

                        <input
                          type="text"
                          value={draft.name}
                          onChange={e =>
                            handleNameChange(category.id, e.target.value)
                          }
                          onBlur={() => handleNameBlur(category.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          aria-label={`Rename ${category.name}`}
                          className="block flex-1 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-1.5 text-sm text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        />

                        <span className="flex-shrink-0 text-xs text-[var(--text-muted-color)]">
                          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? 'Delete category'
                              : 'Remove all entries from this category first'
                          }
                          aria-label={`Delete ${category.name}`}
                          className="flex-shrink-0 text-[var(--text-muted-color)] transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-muted-color)]"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7M10 11v6M14 11v6"
                            />
                          </svg>
                        </button>
                      </div>

                      {isSwatchOpen && (
                        <div className="ml-9 space-y-2.5 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] p-3">
                          <ColorSwatchGroup
                            label="Current"
                            colors={[category.color]}
                            selectedColor={draft.color}
                            onPick={color =>
                              handleColorPick(category.id, color)
                            }
                          />

                          {inUseColors.length > 0 && (
                            <ColorSwatchGroup
                              label="In use"
                              colors={inUseColors}
                              selectedColor={draft.color}
                              onPick={color =>
                                handleColorPick(category.id, color)
                              }
                            />
                          )}

                          <ColorSwatchGroup
                            label="Suggestions"
                            colors={suggestedColors}
                            selectedColor={draft.color}
                            onPick={color =>
                              handleColorPick(category.id, color)
                            }
                          />

                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
                              Custom
                            </p>
                            {/*
                             * Full-freedom escape hatch beyond the curated
                             * options above - a native <input type="color">
                             * stacked (opacity-0) over a conic-gradient
                             * "color wheel" icon, so the swatch READS as
                             * "pick anything" rather than one more solid
                             * color option. Gradient/multi-color category
                             * appearance is intentionally NOT offered here -
                             * see the top-of-file comment.
                             */}
                            <label
                              className="relative block h-6 w-6 cursor-pointer rounded-full border-2 border-[var(--field-border-strong)] transition-transform hover:scale-110"
                              style={{
                                backgroundImage:
                                  'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                              }}
                              title="Pick a custom color"
                            >
                              <input
                                type="color"
                                value={draft.color}
                                onChange={e =>
                                  handleCustomColorChange(
                                    category.id,
                                    e.target.value
                                  )
                                }
                                aria-label={`Pick a custom color for ${category.name}`}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 justify-end border-t border-[var(--panel-border-color)] px-6 py-4">
            <button
              type="button"
              onClick={handleDone}
              className="rounded-md bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground-color)] hover:brightness-90"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One labeled row of color swatches within the expanded picker - "Current"
 * (the category's own saved color, always exactly one swatch), "In use"
 * (every other category's color), or "Suggestions" (golden-angle
 * alternatives) all render through this same small helper so the three
 * groups stay visually consistent. `selectedColor` is the category's
 * DRAFT color (not its persisted one) - see ManageCategoriesModal's own
 * top-of-file DRAFT STATE comment - so the pressed/outlined swatch always
 * reflects whatever's currently staged, even mid-preview across groups.
 */
function ColorSwatchGroup({
  label,
  colors,
  selectedColor,
  onPick,
}: {
  label: string;
  colors: string[];
  selectedColor: string;
  onPick: (color: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color, index) => (
          <button
            // Colors within a group aren't guaranteed unique (e.g. two
            // categories could already share a color before dedup catches
            // it elsewhere) - index keeps React's keys stable regardless.
            key={`${color}-${index}`}
            type="button"
            onClick={() => onPick(color)}
            aria-label={`Use color ${color}`}
            aria-pressed={selectedColor === color}
            className="h-6 w-6 flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor:
                selectedColor === color ? 'var(--text-color)' : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}
