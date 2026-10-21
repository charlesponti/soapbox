/**
 * components/TopicSelect.tsx — multi-select for the essay topics, built on the
 * generic Dropdown. Trigger + checkbox option rows + selected badges only; all
 * open/close, popover↔sheet, draft/Cancel/Done behavior lives in Dropdown.
 */
import { useRef, useState, memo } from "react";
import Dropdown, { type DropdownHandle } from "./Dropdown";

interface Props {
  topics: { name: string; count: number }[];
  active: Set<string>;
  onToggle: (topic: string) => void;
  onSetTopics: (next: Set<string>) => void;
}

const EXIT_MS = 160;

const setEqual = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((t) => b.has(t));

const toggleIn = (set: Set<string>, name: string): Set<string> => {
  const next = new Set(set);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
};

function TopicSelect({ topics, active, onToggle, onSetTopics }: Props) {
  const [exiting, setExiting] = useState<Record<string, true>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const count = active.size;
  const shown = Array.from(new Set([...active, ...Object.keys(exiting)]));

  /** Mark a topic exiting so its badge animates out (kept mounted during the
   *  exit animation, then dropped). Optimistic — call before applying. */
  const markExiting = (t: string) => {
    setExiting((e) => (e[t] ? e : { ...e, [t]: true }));
    window.setTimeout(() => {
      setExiting((e) => {
        const next = { ...e };
        delete next[t];
        return next;
      });
    }, EXIT_MS);
  };

  return (
    <Dropdown<Set<string>>
      ref={dropdownRef}
      value={active}
      onSubmit={onSetTopics}
      equal={setEqual}
      ariaLabel="Topics"
      multi
      panelClassName="w-max min-w-[13rem] max-w-[min(22rem,calc(100vw-2rem))]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          id="topics-trigger"
          className={`press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring/50 ${
            count > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {count === 0 ? (
            <span>Topics</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                {count}
              </span>
              <span>selected</span>
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      content={({ draft, sheet, pick }) => (
        <>
          {topics.map(({ name, count: topicCount }) => {
            const on = draft.has(name);
            return (
              <button
                key={name}
                role="option"
                type="button"
                aria-selected={on}
                onClick={() => {
                  // Desktop removal: mark the badge exiting before it applies.
                  if (draft.has(name) && !sheet) markExiting(name);
                  pick(toggleIn(draft, name));
                }}
                className={`press flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${
                  on ? "font-medium" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border sm:hidden ${
                      on ? "border-foreground bg-foreground" : "border-border"
                    }`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-background ${on ? "block" : "hidden"}`}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="truncate">{name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground/70">
                    {topicCount}
                  </span>
                  {on && !sheet && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </>
      )}
      footer={
        shown.length > 0 && (
          <div id="badges-bar" className="mt-2.5 flex flex-wrap gap-1.5">
            {shown.map((t, i) => {
              const on = active.has(t);
              const leaving = !!exiting[t] && !on;
              return (
                <span
                  key={t}
                  data-topic-badge
                  className={`inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground ${
                    leaving ? "badge-out pointer-events-none" : "badge-in"
                  }`}
                  style={!leaving ? { animationDelay: `${Math.min(i, 6) * 15}ms` } : undefined}
                >
                  <button
                    type="button"
                    aria-label={`Edit topic ${t}`}
                    title={`Edit topic ${t}`}
                    onClick={() => dropdownRef.current?.open()}
                    className="press rounded-sm hover:underline hover:underline-offset-2 focus:outline-none focus:ring-1 focus:ring-ring/50"
                  >
                    {t}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${t}`}
                    onClick={() => {
                      markExiting(t);
                      onToggle(t);
                    }}
                    className="press rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )
      }
    />
  );
}

/** Memoized: only re-renders when the selection actually changes (topics,
 *  onToggle, onSetTopics, and the active Set identity are stable between
 *  unrelated updates). */
export default memo(TopicSelect);
