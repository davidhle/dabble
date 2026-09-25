/**
 * IconButton.tsx - A Small Circular Icon Button
 *
 * Circular hit target plus a hover background, the same treatment the old
 * expanded panel header's edit/minimize/close buttons used. Shared by
 * FocusedEntryView.tsx's controls row and EntryContent.tsx's per-reflection
 * edit/delete controls.
 */

import { ReactNode } from 'react';

export default function IconButton({
  onClick,
  label,
  disabled = false,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)] hover:text-[var(--text-secondary-color)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted-color)]"
    >
      {children}
    </button>
  );
}
