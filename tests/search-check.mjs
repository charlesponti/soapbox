/**
 * tests/search-check.mjs — regression test for the index search feature.
 * Requires a built site served at $URL (default http://localhost:4321).
 *
 * Checks:
 *   1. typing a query returns full-text results (Pagefind)
 *   2. query + topic multiselect compose via category facets
 *   3. result click navigates to the essay (client router)
 *
 *   node tests/search-check.mjs
 */
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:4321/";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const settled = (page) =>
  page.waitForFunction(
    () => {
      const s = document.querySelector("p[aria-live] span")?.textContent ?? "";
      return !s.includes("Searching") && /(result|essay)s?/.test(s);
    },
    { timeout: 15000 },
  );

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

try {
  await page.goto(URL, { waitUntil: "networkidle" });
  const input = page.locator('input[type="search"]');

  /* 1. typed query returns full-text results */
  // "antitrust" → 3 results: small enough that no paginator renders (the
  // "money" query this check once used now matches 26 of 88 essays).
  await input.fill("antitrust");
  await settled(page);
  await page.waitForFunction(() => document.querySelectorAll("#list li").length > 0, {
    timeout: 10000,
  });
  const countText = await page.locator("p[aria-live] span").textContent();
  const first = await page.locator("#list li").first().innerText();
  check("query returns results", /^\d+ results?$/.test(countText ?? ""), `count: ${countText}`);
  check(
    "antitrust hits The Dam on the Rerouted River",
    first.includes("The Dam on the Rerouted River"),
    first.split("\n")[0],
  );
  check("result count < 10 (no paginator)", (await page.locator("#list li").count()) <= 10);

  /* 2. query + topic facet compose (shadcn-style dropdown) */
  await input.fill("engineer");
  await settled(page);
  await page.waitForFunction(() => document.querySelectorAll("#list li").length > 0, {
    timeout: 10000,
  });
  const unrestricted = Number(
    (await page.locator("p[aria-live] span").textContent()).match(/\d+/)?.[0],
  );
  await page.locator('button[aria-haspopup="listbox"]').click();
  await page
    .locator("button[role=option]")
    .filter({ has: page.locator('span:text-is("technology")') })
    .first()
    .click();
  await settled(page);
  await page.waitForTimeout(600);
  const restrictedText = await page.locator("p[aria-live] span").textContent();
  const restricted = Number((restrictedText ?? "0").match(/\d+/)?.[0] ?? 0);
  const rows = await page.locator("#list li").count();
  const techOnly = await page.evaluate(() =>
    [...document.querySelectorAll("#list li")].every((li) =>
      (li.querySelector(".shrink-0")?.textContent ?? "").includes("technology"),
    ),
  );
  check(
    "topic chip narrows Pagefind results",
    restricted <= unrestricted && rows > 0,
    `software ${unrestricted} → +technology ${restrictedText}`,
  );
  check("narrowed rows are all technology", techOnly, `${rows} row(s)`);

  /* 2b. selected topics show as removable badges */
  const badges = page.locator("[data-topic-badge]");
  check("badge bar shows selected topic", (await badges.count()) === 1, "1 badge");
  check("badge is technology", ((await badges.first().innerText()) ?? "").includes("technology"));

  /* 2c. badge label reopens the picker at the same state */
  await badges
    .first()
    .getByRole("button", { name: /^Edit / })
    .click();
  const expanded = await page
    .locator("button[aria-haspopup=listbox]")
    .getAttribute("aria-expanded");
  check("badge label reopens picker", expanded === "true", `aria-expanded: ${expanded}`);
  check(
    "reopened picker keeps selection",
    (await page
      .locator("button[role=option]")
      .filter({ has: page.locator('span:text-is("technology")') })
      .first()
      .getAttribute("aria-selected")) === "true",
  );
  await page.keyboard.press("Escape");

  await badges
    .first()
    .getByRole("button", { name: /^Remove / })
    .click();
  await settled(page);
  await page.waitForTimeout(600);
  const restored = Number(
    (await page.locator("p[aria-live] span").textContent()).match(/\d+/)?.[0],
  );
  check(
    "removing badge widens results back",
    restored >= unrestricted,
    `${restricted} → ${restored}`,
  );
  check("badge bar clears with selection", (await badges.count()) === 0);

  /* 3. clickthrough navigates to the essay */
  await page.locator("#list li a").first().click();
  await page.waitForFunction(
    () => location.pathname.startsWith("/essays/") && !!document.querySelector("article.prose"),
    { timeout: 10000 },
  );
  const path = await page.evaluate(() => location.pathname);
  check("result click navigates to essay", path.startsWith("/essays/"), path);
  check("essay prose rendered", (await page.locator("article.prose").innerText()).length > 100);

  /* 4. essay tag pills get the native entry transition (@starting-style) */
  const pillCount = await page.locator(".tag-pill").count();
  if (pillCount > 0) {
    await page.waitForTimeout(600); // let the entry transition settle
    const allVisible = await page.evaluate(() =>
      [...document.querySelectorAll(".tag-pill")].every((el) => {
        const cs = getComputedStyle(el);
        return cs.opacity === "1" && cs.visibility !== "hidden";
      }),
    );
    check("tag pills visible after entry", allVisible, `${pillCount} pill(s)`);
  } else {
    check("essay has tag pills", false, "no pills on this essay — picked one without tags");
  }
} finally {
  await page.screenshot({ path: "tests/search-state.png" });
  await browser.close();
}

console.log(failures === 0 ? "\nAll checks passed ✔" : `\n${failures} check(s) failed ✘`);
process.exit(failures === 0 ? 0 : 1);
