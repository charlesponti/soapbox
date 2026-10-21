/**
 * components/Dropdown.tsx — reusable selection dropdown.
 *
 * Renders as a popover under the trigger on desktop and as a detached bottom
 * sheet (floating, backdrop, grabber, Cancel/Done header) on mobile. The two
 * layouts are the same DOM swapped by CSS (global.css `@media (max-width:
 * 640px)`), so no JS duplication. Behavior stays generic:
 *
 *  - The consumer supplies the trigger (render prop) and the option content.
 *  - Selections are staged in a `draft`. On desktop an option pick applies
 *    immediately (`pick` submits + closes). In the sheet, picks only update
 *    the draft; Cancel discards and Done submits — disabled until the draft
 *    differs from `value` (per the `equal` comparator).
 *  - Outside click / Escape close; the sheet locks background scroll; the
 *    scroll position of the option list is saved across open/close.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react";

export interface DropdownHandle {
  open: () => void;
}

export interface TriggerContext {
  open: boolean;
  toggle: () => void;
}

export interface ContentContext<T> {
  /** Current staged value — equals `value` until the user changes it. */
  draft: T;
  /** True while rendered as the mobile bottom sheet. */
  sheet: boolean;
  /** Replace the draft (sheet picks; desktop applies via `pick`). */
  onDraftChange: (next: T) => void;
  /** Stage a change; on desktop also submits and closes immediately. */
  pick: (next: T) => void;
  close: () => void;
}

export interface DropdownProps<T> {
  value: T;
  /** Called with the confirmed value (desktop pick, sheet Done). */
  onSubmit: (next: T) => void;
  trigger: (ctx: TriggerContext) => ReactNode;
  content: (ctx: ContentContext<T>) => ReactNode;
  /** Rendered below the trigger, inside the dropdown's hit area — e.g. the
   *  selected-item badges of a multi-select. */
  footer?: ReactNode;
  /** Content equality for the "Done enabled" check. Defaults to reference/===. */
  equal?: (a: T, b: T) => boolean;
  ariaLabel?: string;
  /** Set for multi-select lists (renders aria-multiselectable + the sheet
   *  checkbox list). */
  multi?: boolean;
  /** Extra classes for the panel (e.g. popover sizing). */
  panelClassName?: string;
}

const MOBILE_MQ = "(max-width: 640px)";
const same = <T,>(a: T, b: T): boolean => a === b;

function DropdownInner<T>(
  {
    value,
    onSubmit,
    trigger,
    content,
    footer,
    equal = same,
    ariaLabel,
    multi = false,
    panelClassName = "",
  }: DropdownProps<T>,
  ref: ForwardedRef<DropdownHandle>,
): ReactElement {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  /** Scroll offset of the option list, kept across open/close so reopening
   *  (e.g. via a badge label) returns to the same spot. */
  const savedScroll = useRef(0);

  const sheet = typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;

  const close = () => {
    if (scrollAreaRef.current) savedScroll.current = scrollAreaRef.current.scrollTop;
    setDraft(null);
    setOpen(false);
  };
  const openDropdown = () => {
    setDraft(value);
    setOpen(true);
  };
  const toggle = () => (open ? close() : openDropdown());

  useImperativeHandle(ref, () => ({ open: openDropdown }), [value]);

  /* Restore the list scroll on reopen (before paint — no flash). */
  useLayoutEffect(() => {
    if (open && scrollAreaRef.current) scrollAreaRef.current.scrollTop = savedScroll.current;
  }, [open]);

  /* Close on outside click or Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Bottom sheet: lock background scroll on mobile so only the list scrolls. */
  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  const current = draft ?? value;
  const changed = draft !== null && !equal(draft, value);
  const pick = (next: T) => {
    setDraft(next);
    if (!sheet) {
      onSubmit(next);
      setOpen(false);
    }
  };
  const done = () => {
    onSubmit(current);
    close();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      {trigger({ open, toggle })}
      {footer}
      {open && (
        <>
          <div className="dropdown-backdrop" onClick={close} aria-hidden="true" />
          <div
            role="listbox"
            aria-multiselectable={multi || undefined}
            aria-label={ariaLabel}
            className={`dropdown-panel absolute z-50 mt-2 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[0_14px_38px_-16px_rgba(0,0,0,0.75)] ${panelClassName}`}
          >
            <div className="dropdown-sheet-header">
              <button
                type="button"
                onClick={close}
                className="press rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
              >
                Cancel
              </button>
              <span className="text-sm font-medium">{ariaLabel}</span>
              <button
                type="button"
                onClick={done}
                disabled={!changed}
                className="press rounded-md px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
              >
                Done
              </button>
            </div>
            <div ref={scrollAreaRef} className="dropdown-scroll max-h-72 overflow-auto">
              {content({ draft: current, sheet, onDraftChange: setDraft, pick, close })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const Dropdown = forwardRef(DropdownInner) as <T>(
  props: DropdownProps<T> & RefAttributes<DropdownHandle>,
) => ReactElement;

export default Dropdown;
