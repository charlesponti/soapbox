/* client/progress.ts — reading progress bar.
   The #progress div lives in BaseLayout with transition:persist, so it
   survives the client-router body swap. Listeners attach once per JS realm
   (guarded on window); astro:page-load recomputes after every navigation. */

const w = window as unknown as { __essaysProgressInit?: boolean };
if (!w.__essaysProgressInit) {
  w.__essaysProgressInit = true;

  const bar = document.getElementById("progress");

  let ticking = false;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    if (bar) bar.style.transform = `scaleX(${pct / 100})`;
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  /* Astro resets scroll to top on navigation; recompute then. */
  document.addEventListener("astro:page-load", update);
  update();
}
