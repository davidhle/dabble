/**
 * CategoryColorPicker.tsx - The Expanded Category Color Picker Panel
 *
 * Labeled rows of swatches plus a "Custom" native color input, shared by
 * ManageCategoriesModal.tsx (recoloring an existing category) and
 * AddEntryForm.tsx's "+ Add new category" sub-form (coloring a new one).
 * Each caller decides which swatch groups to offer (e.g. "Current" only
 * makes sense for a category that already exists) and owns the open/closed
 * state - this is just the panel's contents.
 *
 * `onPick` (a preset swatch) and `onCustomChange` (the native input) are
 * separate on purpose: callers close the panel on a preset pick, but must
 * NOT on a custom change - see ManageCategoriesModal's
 * handleCustomColorChange comment for why (the native dialog fires
 * onChange continuously mid-drag, and closing would unmount the input).
 */

export interface ColorSwatchGroupSpec {
  label: string;
  colors: string[];
}

interface CategoryColorPickerProps {
  /** Swatch rows, top to bottom. Empty groups are skipped. */
  groups: ColorSwatchGroupSpec[];
  /** The currently staged color - its swatch renders outlined/pressed. */
  selectedColor: string;
  onPick: (color: string) => void;
  onCustomChange: (color: string) => void;
  /** Accessible name for the custom color input, e.g. "Pick a custom color for Pottery". */
  customAriaLabel: string;
  className?: string;
}

export default function CategoryColorPicker({
  groups,
  selectedColor,
  onPick,
  onCustomChange,
  customAriaLabel,
  className = '',
}: CategoryColorPickerProps) {
  return (
    <div
      className={`space-y-2.5 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] p-3 ${className}`}
    >
      {groups
        .filter(group => group.colors.length > 0)
        .map(group => (
          <ColorSwatchGroup
            key={group.label}
            label={group.label}
            colors={group.colors}
            selectedColor={selectedColor}
            onPick={onPick}
          />
        ))}

      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
          Custom
        </p>
        {/*
         * Full-freedom escape hatch beyond the curated options above - a
         * native <input type="color"> stacked (opacity-0) over a
         * conic-gradient "color wheel" icon, so the swatch READS as "pick
         * anything" rather than one more solid color option. Gradient/
         * multi-color category appearance is intentionally NOT offered -
         * see ManageCategoriesModal.tsx's top-of-file comment.
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
            value={selectedColor}
            onChange={e => onCustomChange(e.target.value)}
            aria-label={customAriaLabel}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

/**
 * One labeled row of color swatches within the picker - every group
 * ("Current", "In use", "Suggestions", ...) renders through this same
 * small helper so they stay visually consistent. `selectedColor` is the
 * caller's STAGED color, so the pressed/outlined swatch always reflects
 * whatever's currently picked, even mid-preview across groups.
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
