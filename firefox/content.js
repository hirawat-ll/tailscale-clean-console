/* Tailscale Clean Console - content script
 *
 * What it does:
 *  1. Hides the "Your free trial has ended" top banner (CSS rule for
 *     .trial-expired-notice in styles.css).
 *  2. Renders the Machines list (<table class="tb">) as a responsive card
 *     grid by default, with one click back to the classic list view.
 *  3. Adds a small floating pill (bottom-right) with:
 *       Grid / List  - toggle the layout (remembered)
 *       Hide         - pick any element on the page and hide it (remembered)
 *       Reset        - unhide everything you hid
 *
 * All settings live in localStorage under "tsc:settings:v1".
 */
(() => {
  "use strict";

  const STORE_KEY = "tsc:settings:v1";
  const MACHINES_PATH = /^\/admin\/machines\/?$/;
  const DEFAULT_SETTINGS = Object.freeze({ view: "grid", hidden: [], hiddenDevices: [] });

  /* ---------------------------------------------------------------- state */

  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return {
        view: raw.view === "list" ? "list" : "grid",
        hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((s) => typeof s === "string") : [],
        hiddenDevices: Array.isArray(raw.hiddenDevices)
          ? raw.hiddenDevices.filter((s) => typeof s === "string")
          : [],
      };
    } catch (err) {
      return { ...DEFAULT_SETTINGS, hidden: [], hiddenDevices: [] };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (err) {
      /* storage full or blocked - ignore */
    }
  }

  function onMachinesPage() {
    return MACHINES_PATH.test(location.pathname);
  }

  /* ------------------------------------------- user-hidden element styles */

  function hideStyleElement() {
    let el = document.getElementById("tsc-user-hide");
    if (!el) {
      el = document.createElement("style");
      el.id = "tsc-user-hide";
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function applyHidden() {
    const css = settings.hidden.map((sel) => `${sel} { display: none !important; }`).join("\n");
    const el = hideStyleElement();
    if (el.textContent !== css) el.textContent = css;
  }

  /* ------------------------------------------------- machines -> card grid */

  function findMachinesTable() {
    const preferred = document.querySelector("table.tb");
    if (preferred && preferred.querySelector("tbody tr")) return preferred;

    /* fallback: the table with the most body rows (in case Tailscale renames
       the .tb class some day) */
    let best = null;
    let bestRows = 1;
    for (const table of document.querySelectorAll("table")) {
      const rows = table.querySelectorAll("tbody tr").length;
      if (rows > bestRows) {
        best = table;
        bestRows = rows;
      }
    }
    return best;
  }

  /* Columns dropped from the cards in grid view (requested: addresses/version) */
  const OMIT_COLUMN = /^(addresses?|ip|version)$/i;
  const LAST_SEEN_COLUMN = /^last\s*seen$/i;

  /* A device row is a real machine row in the machines table - not a section
     header we injected, not the empty-search placeholder. */
  function deviceRowFor(el) {
    const row = el && el.closest ? el.closest("tr") : null;
    if (!row) return null;
    const table = row.closest("table");
    if (!table || table !== findMachinesTable()) return null;
    if (row.classList.contains("tsc-section") || row.classList.contains("tsc-empty")) return null;
    const cells = Array.from(row.children).filter((c) => c.tagName === "TD");
    return cells.length >= 2 ? row : null;
  }

  /* A stable key so a hidden device stays hidden across reloads: the node key
     from the row id when there is one, otherwise the machine name. */
  function deviceKey(row) {
    if (row.id) return "id:" + row.id;
    const link = row.querySelector("td a[href]");
    const name = (link ? link.textContent : "").trim().slice(0, 200);
    return name ? "name:" + name : null;
  }

  /* Hide the devices the user removed; they are skipped by the count below. */
  function applyHiddenDevices(table) {
    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("tsc-section")) continue;
      const cells = Array.from(row.children).filter((c) => c.tagName === "TD");
      if (cells.length < 2) continue;
      const key = deviceKey(row);
      row.classList.toggle("tsc-device-hidden", !!key && settings.hiddenDevices.includes(key));
    }
  }

  function markTable() {
    const table = findMachinesTable();
    if (!table) return;

    if (!table.classList.contains("tsc-machines")) table.classList.add("tsc-machines");

    const headers = Array.from(table.querySelectorAll("thead th"), (th) => th.textContent.trim());
    const lastSeenIndex = headers.findIndex((h) => LAST_SEEN_COLUMN.test(h));

    let online = 0;
    let offline = 0;

    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("tsc-section")) continue;

      const cells = Array.from(row.children).filter((el) => el.tagName === "TD");

      /* empty-search / placeholder row: let it span the whole grid */
      if (cells.length < 2) {
        if (!row.classList.contains("tsc-empty")) row.classList.add("tsc-empty");
        continue;
      }

      /* the user hid this device: keep it out of the online/offline totals */
      if (row.classList.contains("tsc-device-hidden")) continue;

      cells.forEach((td, i) => {
        const isFirst = i === 0;
        const isLast = i === cells.length - 1;
        const header = headers[i] || "";
        const omit = !isFirst && !isLast && OMIT_COLUMN.test(header);

        td.classList.toggle("tsc-title", isFirst);
        td.classList.toggle("tsc-actions", isLast);
        td.classList.toggle("tsc-omit", omit);

        const label = isFirst || isLast || omit ? "" : header;
        if (label) {
          if (td.getAttribute("data-tsc-label") !== label) td.setAttribute("data-tsc-label", label);
        } else if (td.hasAttribute("data-tsc-label")) {
          td.removeAttribute("data-tsc-label");
        }
      });

      const isOnline = lastSeenIndex >= 0 && cellIsOnline(cells[lastSeenIndex]);
      row.classList.toggle("tsc-online", isOnline);
      row.classList.toggle("tsc-offline", !isOnline);
      if (isOnline) online++;
      else offline++;
    }

    syncSections(table, online, offline);
  }

  /* A machine is online when its "Last seen" cell renders the green status dot
     (class bg-green-300 / dark:bg-green-400); the "Connected" label is the
     fallback in case Tailscale restyles the dot. */
  function cellIsOnline(cell) {
    if (!cell) return false;
    if (cell.querySelector('[class*="bg-green"]')) return true;
    return /^connected\b/i.test(cell.textContent.trim());
  }

  function syncSections(table, onlineCount, offlineCount) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    let online = table.querySelector("tr.tsc-section--online");
    let offline = table.querySelector("tr.tsc-section--offline");
    if (!online) {
      online = makeSectionRow("online");
      tbody.appendChild(online);
    }
    if (!offline) {
      offline = makeSectionRow("offline");
      tbody.appendChild(offline);
    }

    updateSection(online, onlineCount);
    updateSection(offline, offlineCount);
  }

  function makeSectionRow(kind) {
    const row = document.createElement("tr");
    row.className = "tsc-section tsc-section--" + kind;

    const cell = document.createElement("td");
    const title = document.createElement("span");
    title.className = "tsc-section-title";
    title.textContent = kind === "online" ? "Online" : "Offline";

    const count = document.createElement("span");
    count.className = "tsc-section-count";
    count.textContent = "0";

    cell.append(title, count);
    row.appendChild(cell);
    return row;
  }

  function updateSection(row, count) {
    const badge = row.querySelector(".tsc-section-count");
    const text = String(count);
    if (badge && badge.textContent !== text) badge.textContent = text;
    const hide = count === 0;
    if (row.hidden !== hide) row.hidden = hide;
  }

  function applyGrid() {
    const grid = onMachinesPage() && settings.view === "grid";
    document.documentElement.classList.toggle("tsc-grid", grid);
    return grid;
  }

  /* ------------------------------------------------------------ tiny pill */

  let pill = null;
  let pickArmed = false;

  function ensurePill() {
    if (pill && pill.isConnected) {
      renderPill();
      return;
    }
    pill = document.createElement("div");
    pill.id = "tsc-pill";
    pill.setAttribute("role", "toolbar");
    pill.setAttribute("aria-label", "Tailscale Clean Console");
    pill.innerHTML =
      '<button type="button" data-act="view"></button>' +
      '<button type="button" data-act="pick" title="Hide: click this, then click an element (or a device card) to remove it"></button>' +
      '<button type="button" data-act="reset" title="Show everything you have hidden"></button>';
    pill.addEventListener("click", onPillClick, true);
    (document.body || document.documentElement).appendChild(pill);
    renderPill();
  }

  function removePill() {
    if (pill) {
      pill.remove();
      pill = null;
    }
    if (pickArmed) setPick(false);
  }

  function onPillClick(event) {
    const button = event.target.closest("button[data-act]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    switch (button.dataset.act) {
      case "view":
        settings.view = settings.view === "grid" ? "list" : "grid";
        saveSettings();
        sweep();
        break;
      case "pick":
        setPick(!pickArmed);
        break;
      case "reset":
        settings.hidden = [];
        settings.hiddenDevices = [];
        saveSettings();
        sweep();
        break;
    }
    renderPill();
  }

  function renderPill() {
    if (!pill) return;
    const view = pill.querySelector('[data-act="view"]');
    const pick = pill.querySelector('[data-act="pick"]');
    const reset = pill.querySelector('[data-act="reset"]');

    view.textContent = settings.view === "grid" ? "\u25A6 Grid" : "\u2630 List";
    view.title =
      settings.view === "grid"
        ? "Showing grid view - click for the classic list"
        : "Showing list view - click for the grid";

    pick.textContent = pickArmed ? "\u2316 pick..." : "\u2316 Hide";
    pick.classList.toggle("is-on", pickArmed);
    pick.title = pickArmed ? "Click an element or device to hide it (Esc to cancel)" : "Hide an element or a device on the page";

    reset.textContent = "\u21BA";
    const hiddenCount = settings.hidden.length + settings.hiddenDevices.length;
    reset.disabled = hiddenCount === 0;
    reset.title = hiddenCount
      ? `Show ${hiddenCount} hidden item(s) again`
      : "Nothing hidden";
  }

  /* --------------------------------------------------------- element pick */

  let highlighted = null;
  let highlightedOutline = "";
  let highlightedOffset = "";

  function setPick(on) {
    if (pickArmed === on) return;
    pickArmed = on;
    document.documentElement.classList.toggle("tsc-picking", on);

    if (on) {
      document.addEventListener("mousemove", onPickMove, true);
      document.addEventListener("click", onPickClick, true);
      document.addEventListener("keydown", onPickKey, true);
    } else {
      document.removeEventListener("mousemove", onPickMove, true);
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onPickKey, true);
      clearHighlight();
    }
    renderPill();
  }

  function onPickMove(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el === highlighted || (pill && pill.contains(el))) return;
    clearHighlight();
    highlighted = el;
    highlightedOutline = el.style.outline;
    highlightedOffset = el.style.outlineOffset;
    el.style.outline = "2px solid #7c3aed";
    el.style.outlineOffset = "-2px";
  }

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.style.outline = highlightedOutline;
    highlighted.style.outlineOffset = highlightedOffset;
    highlighted = null;
  }

  function onPickClick(event) {
    if (pill && pill.contains(event.target)) return; /* let the pill work */

    event.preventDefault();
    event.stopPropagation();

    const el = document.elementFromPoint(event.clientX, event.clientY) || event.target;

    /* clicking a device (anywhere on its card) hides the whole device, so it
       also drops out of the online/offline totals */
    const device = deviceRowFor(el);
    if (device) {
      const key = deviceKey(device);
      if (key && !settings.hiddenDevices.includes(key)) {
        settings.hiddenDevices.push(key);
        saveSettings();
      }
      console.info("[tailscale-clean] hid device", device, "with key:", key);
      setPick(false);
      sweep();
      return;
    }

    const selector = selectorFor(el);
    if (selector && !settings.hidden.includes(selector)) {
      settings.hidden.push(selector);
      saveSettings();
      applyHidden();
    }
    console.info("[tailscale-clean] hidden element", el, "with selector:", selector);
    setPick(false);
  }

  function onPickKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setPick(false);
  }

  function selectorFor(el) {
    if (!(el instanceof Element)) return null;
    if (el === document.body || el === document.documentElement) return null;

    if (el.id) return "#" + CSS.escape(el.id);

    const classes = Array.from(el.classList).filter(
      (c) => c && c.length <= 80 && !c.startsWith("tsc-")
    );
    for (let n = Math.min(classes.length, 4); n >= 1; n--) {
      const sel =
        el.localName + "." + classes.slice(0, n).map((c) => CSS.escape(c)).join(".");
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch (err) {
        /* invalid selector - try the next candidate */
      }
    }

    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 6) {
      if (node.id) {
        parts.unshift("#" + CSS.escape(node.id));
        break;
      }
      let part = node.localName;
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.localName === node.localName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    const sel = parts.join(" > ");
    try {
      if (document.querySelectorAll(sel).length >= 1) return sel;
    } catch (err) {
      /* fall through */
    }
    return null;
  }

  /* -------------------------------------------------- sweep + observers */

  function sweep() {
    applyHidden();

    const table = onMachinesPage() ? findMachinesTable() : null;
    if (table) applyHiddenDevices(table);

    const grid = applyGrid();
    if (onMachinesPage()) {
      if (grid) markTable();
      ensurePill();
    } else {
      removePill();
    }
  }

  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      sweep();
    }, 100);
  }

  sweep();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
})();
