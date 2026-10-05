/**
 * SettingsModal.tsx - App-Wide Preferences and Data Management
 *
 * Opened from the gear button in Layout.tsx's top-right navbar pill, and
 * mounted at the Layout level (next to AddEntryForm/ManageCategoriesModal)
 * so it's available from every page.
 *
 * CHROME: the same overlay + centered card, theme tokens, `dark-scrollbar`
 * internal scroll and capture-phase Escape-to-close as
 * ManageCategoriesModal.tsx - see that file's (and AddEntryForm.tsx's
 * ESCAPE-TO-CANCEL) comment for why the listener must be capture-phase:
 * it stops Escape from also reaching EntrySelectionContext.tsx's own
 * window listener and collapsing a sidebar panel / advancing the canvas
 * reset while this modal is open.
 *
 * DIFFERENCES FROM ManageCategoriesModal:
 *   - Clicking the overlay closes it. There's no staged/unsaved work here
 *     to protect - every setting applies immediately - so the "stray click
 *     could discard edits" reason that modal and AddEntryForm avoid
 *     overlay-close for doesn't apply.
 *   - No Done button, for the same reason: these are preferences and
 *     one-shot actions, not a batch of drafts waiting to be committed.
 *
 * STRUCTURE: content is a list of labeled <SettingsSection>s (Display,
 * Data), so a new group of settings is just another section - see the
 * placeholder comment in the JSX below. Preferences live in
 * SettingsContext.tsx.
 *
 * DATA SECTION: Export/Import (moved here from Home.tsx) and "Start Your
 * Own Constellation" (also still on Home) all come from the shared
 * hooks/useDataManagement.ts - same logic, same reload after a successful
 * import/reset. This modal uses its OWN status-message key, and on mount
 * reopens itself if that key held a message, so the post-reload success
 * message lands back inside Settings where the action was taken.
 */

import { ReactNode, useCallback, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import useDataManagement, {
  STATUS_BANNER_CLASSES,
} from '../hooks/useDataManagement';

/** See the DATA SECTION comment above - distinct from Home.tsx's key. */
const SETTINGS_STATUS_MESSAGE_KEY = 'dabble-settings-status-message';

interface SettingsModalProps {
  isOpen: boolean;
  /** Called to open the modal itself - used only to reopen it after a reload that left a status message for it. */
  onOpen: () => void;
  onClose: () => void;
}

/** A labeled group of settings - the unit future settings get added in. */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted-color)]">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * One on/off preference: label + helper on the left, a switch on the
 * right. Applies on click - no Done button (see the top-of-file comment).
 */
function SettingsToggle({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-color)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--text-muted-color)]">{helper}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 ${
          checked
            ? 'bg-[var(--accent-color)]'
            : 'bg-[var(--field-border-strong)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

/** One action row: button on top, short helper line underneath. */
function SettingsAction({
  label,
  helper,
  onClick,
  destructive = false,
}: {
  label: string;
  helper: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className={`rounded-md border-2 bg-transparent px-4 py-2 text-sm font-medium ${
          destructive
            ? 'border-red-500 text-red-500 hover:bg-red-500/10'
            : 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        {label}
      </button>
      <p className="mt-1 text-xs text-[var(--text-muted-color)]">{helper}</p>
    </div>
  );
}

export default function SettingsModal({
  isOpen,
  onOpen,
  onClose,
}: SettingsModalProps) {
  const {
    statusMessage,
    setStatusMessage,
    handleStartOwnConstellation,
    handleExport,
    fileInputRef,
    handleImportClick,
    handleFileChange,
  } = useDataManagement(SETTINGS_STATUS_MESSAGE_KEY);
  const { animationsEnabled, setAnimationsEnabled } = useSettings();

  // Reopen after a reload that stashed a message for this modal (a
  // successful import/reset started from here) - see the DATA SECTION
  // comment above. Only a message read back on mount can be present while
  // closed, since an import error is set while the modal is already open
  // and handleClose below clears the message on the way out.
  useEffect(() => {
    if (statusMessage && !isOpen) onOpen();
  }, [statusMessage, isOpen, onOpen]);

  // Clears any status message on close so a stale error/success doesn't
  // greet the next, unrelated open.
  const handleClose = useCallback(() => {
    setStatusMessage(null);
    onClose();
  }, [onClose, setStatusMessage]);

  // ─── ESCAPE-TO-CLOSE (capture phase) ───
  // Identical to ManageCategoriesModal.tsx's own effect - see the
  // top-of-file comment for why it must be capture-phase.
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleClose();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    // Overlay click closes - see DIFFERENCES FROM ManageCategoriesModal above.
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50"
      onClick={handleClose}
    >
      <div className="flex h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          className="flex w-[90vw] max-w-[500px] flex-col rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] shadow-xl"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-shrink-0 border-b border-[var(--panel-border-color)] px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <h2
                id="settings-modal-title"
                className="text-lg font-semibold text-[var(--text-color)]"
              >
                Settings
              </h2>
              <button
                type="button"
                onClick={handleClose}
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

          {/* dark-scrollbar: same treatment as ManageCategoriesModal's own scrollable content. */}
          <div className="dark-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {/*
             * FUTURE SECTIONS go here as additional <SettingsSection>s,
             * and new preferences in existing ones - backed by
             * SettingsContext.tsx. Settings should apply immediately on
             * change (no Done button - see the top-of-file comment).
             */}

            <SettingsSection title="Display">
              {/* See SettingsContext.tsx's ANIMATIONS comment for how this interacts with the OS reduced-motion preference. */}
              <SettingsToggle
                label="Animations"
                helper="Turn off to reduce motion and improve performance on slower devices."
                checked={animationsEnabled}
                onChange={setAnimationsEnabled}
              />
            </SettingsSection>

            <SettingsSection title="Data">
              {statusMessage && (
                <div
                  className={`rounded-md border p-3 text-sm ${STATUS_BANNER_CLASSES[statusMessage.type]}`}
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}

              <SettingsAction
                label="Export Data"
                helper="Download all entries and categories as a JSON backup."
                onClick={handleExport}
              />

              <SettingsAction
                label="Import Data"
                helper="Replace your current data with a previously exported file."
                onClick={handleImportClick}
              />
              {/* Hidden - opened by the Import Data button above via fileInputRef. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <SettingsAction
                label="Start Your Own Constellation"
                helper="Permanently delete all entries and categories and start from a blank constellation."
                onClick={handleStartOwnConstellation}
                destructive
              />
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>
  );
}
