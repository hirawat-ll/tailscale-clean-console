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
 *       Settings     - a popover to view/restore hidden items, choose the
 *                      default view, export / import and opt into sync
 *
 * All settings live in localStorage under "tsc:settings:v1" (optionally
 * mirrored to browser.storage.sync when the user turns sync on).
 */
(() => {
  "use strict";

  const STORE_KEY = "tsc:settings:v1";
  const SCHEMA_VERSION = 2;
  const MACHINES_PATH = /^\/admin\/machines\/?$/;
  const DEFAULT_SETTINGS = Object.freeze({
    schema: SCHEMA_VERSION,
    view: "grid",
    hidden: [],
    hiddenDevices: [],
    sync: false,
    onboarded: false,
    hintShown: false,
  });

  /* ---------------------------------------------------------------- state */

  let settings = loadSettings();

  /* Coerce whatever is in storage into a known-good settings object: any
     missing or wrongly-typed field falls back to its default, and the schema
     is stamped with the version this build understands. */
  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      schema: SCHEMA_VERSION,
      view: source.view === "list" ? "list" : "grid",
      hidden: Array.isArray(source.hidden) ? source.hidden.filter((s) => typeof s === "string") : [],
      hiddenDevices: Array.isArray(source.hiddenDevices)
        ? source.hiddenDevices.filter((s) => typeof s === "string")
        : [],
      sync: source.sync === true,
      onboarded: source.onboarded === true,
      hintShown: source.hintShown === true,
    };
  }

  function loadSettings() {
    try {
      return normalizeSettings(JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
    } catch (err) {
      return normalizeSettings({});
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (err) {
      /* storage full or blocked - ignore */
    }
  }

  /* Persist locally, and mirror to browser.storage.sync when the user has
     opted in and the API is available (Chrome MV3 / Firefox MV2). */
  function saveSettings() {
    saveLocal();
    const area = syncArea();
    if (area && settings.sync) storageSet(area, STORE_KEY, settings);
  }

  /* ------------------------------------------------------ optional sync */

  function syncArea() {
    try {
      return (
        (globalThis.browser && globalThis.browser.storage && globalThis.browser.storage.sync) ||
        (globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.sync) ||
        null
      );
    } catch (err) {
      return null;
    }
  }

  function storageGet(area, key) {
    return new Promise((resolve) => {
      try {
        const pending = area.get(key, (result) => resolve(result ? result[key] : undefined));
        if (pending && typeof pending.then === "function") {
          pending.then(
            (result) => resolve(result ? result[key] : undefined),
            () => resolve(undefined)
          );
        }
      } catch (err) {
        resolve(undefined);
      }
    });
  }

  function storageSet(area, key, value) {
    try {
      const pending = area.set({ [key]: value });
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch (err) {
      /* ignore */
    }
  }

  /* Pull the synced copy on start (or when sync is switched on) and adopt it
     if it looks like settings. Best-effort: failures leave local untouched. */
  function hydrateFromSync() {
    const area = syncArea();
    if (!area || !settings.sync) return;
    storageGet(area, STORE_KEY).then((remote) => {
      if (!remote || typeof remote !== "object") return;
      settings = normalizeSettings(remote);
      settings.sync = true;
      pruneDone = false;
      saveLocal();
      sweep();
      if (settingsOpen) renderSettings();
    }, () => {});
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

  /* The real machine rows, in order: each has a name cell and an action cell,
     never one of our injected section headers or the empty-search placeholder. */
  function deviceRows(table) {
    const rows = [];
    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("tsc-section") || row.classList.contains("tsc-empty")) continue;
      const cells = Array.from(row.children).filter((c) => c.tagName === "TD");
      if (cells.length >= 2) rows.push(row);
    }
    return rows;
  }

  /* Hide the devices the user removed; they are skipped by the count below. */
  function applyHiddenDevices(table) {
    for (const row of deviceRows(table)) {
      const key = deviceKey(row);
      row.classList.toggle("tsc-device-hidden", !!key && settings.hiddenDevices.includes(key));
    }
  }

  /* Drop hiddenDevices keys that no longer match any row - devices removed from
     the tailnet, or keys carried over from another machine. Runs once per page
     load (and again after an import), only once the table has rows, so a slow
     render or a search filter cannot wipe the list. */
  let pruneDone = false;

  function pruneHiddenDevices(table) {
    if (pruneDone || !table) return;
    const rows = deviceRows(table);
    if (rows.length === 0) return;
    pruneDone = true;
    if (settings.hiddenDevices.length === 0) return;

    const present = new Set();
    for (const row of rows) {
      const key = deviceKey(row);
      if (key) present.add(key);
    }
    const kept = settings.hiddenDevices.filter((key) => present.has(key));
    if (kept.length !== settings.hiddenDevices.length) {
      settings.hiddenDevices = kept;
      saveSettings();
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
  let helpOpen = false;
  let settingsOpen = false;
  let help = null;
  let settingsEl = null;
  let hint = null;
  let tour = null;
  let tourTimer = null;
  let tourStep = 0;

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
      '<button type="button" data-act="reset" title="Show everything you have hidden"></button>' +
      '<button type="button" data-act="gear" title="Settings" aria-label="Settings">\u2699</button>' +
      '<button type="button" data-act="help" title="How this works" aria-label="Help">?</button>';
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
    closeSettings();
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
        if (settingsOpen) renderSettings();
        break;
      case "pick":
        setPick(!pickArmed);
        break;
      case "reset":
        settings.hidden = [];
        settings.hiddenDevices = [];
        saveSettings();
        sweep();
        if (settingsOpen) renderSettings();
        break;
      case "gear":
        toggleSettings();
        break;
      case "help":
        closeSettings();
        helpOpen = true;
        syncHelp();
        break;
    }
    renderPill();
  }

  function renderPill() {
    if (!pill) return;
    const view = pill.querySelector('[data-act="view"]');
    const pick = pill.querySelector('[data-act="pick"]');
    const reset = pill.querySelector('[data-act="reset"]');
    const gear = pill.querySelector('[data-act="gear"]');

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

    if (gear) gear.classList.toggle("is-on", settingsOpen);
  }

  /* ------------------------------------------- welcome / help card + hint */

  /* One short line per pill button - no wall of text. */
  const HELP_LINES = [
    ["\u25A6 Grid / \u2630 List", "switch between cards and the classic table"],
    ["\u2316 Hide", "click an element, or a device card, to hide it"],
    ["\u21BA Reset", "bring back everything you hid"],
    ["\u2699 Settings", "restore hidden items, choose the view, export / import"],
  ];

  function ensureHelp() {
    if (help && help.isConnected) return;

    help = document.createElement("div");
    help.id = "tsc-help";
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-label", "Tailscale Clean Console help");

    const title = document.createElement("p");
    title.className = "tsc-help-title";
    title.textContent = "Tailscale Clean Console";

    const list = document.createElement("ul");
    list.className = "tsc-help-list";
    for (const [key, text] of HELP_LINES) {
      const item = document.createElement("li");
      item.setAttribute("data-help-line", "");
      const name = document.createElement("b");
      name.textContent = key;
      const desc = document.createElement("span");
      desc.textContent = text;
      item.append(name, desc);
      list.appendChild(item);
    }

    const actions = document.createElement("div");
    actions.className = "tsc-help-actions";

    const tourBtn = document.createElement("button");
    tourBtn.type = "button";
    tourBtn.dataset.help = "tour";
    tourBtn.textContent = "10-second tour";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.dataset.help = "dismiss";
    dismiss.textContent = "Got it";

    actions.append(tourBtn, dismiss);
    help.append(title, list, actions);
    help.addEventListener("click", onHelpClick);
    (document.body || document.documentElement).appendChild(help);
  }

  function onHelpClick(event) {
    const button = event.target.closest("button[data-help]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.help === "tour") {
      startTour();
    } else {
      /* dismiss: remember it so the welcome card never shows again */
      settings.onboarded = true;
      helpOpen = false;
      saveSettings();
      syncHelp();
    }
  }

  function removeHelp() {
    if (!help) return;
    help.remove();
    help = null;
  }

  /* The welcome card shows on the first visit; the ? button reopens it. */
  function syncHelp() {
    const wanted =
      onMachinesPage() && !tour && !pickArmed && !settingsOpen && (helpOpen || !settings.onboarded);
    if (wanted) ensureHelp();
    else removeHelp();
  }

  function ensureHint() {
    if (hint && hint.isConnected) return;
    hint = document.createElement("div");
    hint.id = "tsc-hint";
    hint.setAttribute("role", "status");
    hint.textContent = "Click a device card to hide the whole device.";
    (document.body || document.documentElement).appendChild(hint);
  }

  function removeHint() {
    if (!hint) return;
    hint.remove();
    hint = null;
  }

  /* ------------------------------------------------ optional 10-second tour */

  const TOUR_STEPS = [
    {
      selector: '#tsc-pill [data-act="view"]',
      text: "Grid or List \u2014 switch the layout whenever you like.",
      place: "top",
    },
    {
      selector: "table.tsc-machines tr.tsc-section--online",
      text: "Online and Offline split the machines, with live counts that follow what you hide.",
      place: "bottom",
    },
  ];
  const TOUR_STEP_MS = 5000;

  function startTour() {
    if (tour) return;
    tourStep = 0;

    tour = document.createElement("div");
    tour.id = "tsc-tour";
    tour.setAttribute("role", "dialog");
    tour.setAttribute("aria-modal", "true");
    tour.setAttribute("aria-label", "Quick tour");
    tour.innerHTML =
      '<div class="tsc-tour-spot" aria-hidden="true"></div>' +
      '<div class="tsc-tour-card">' +
      '<p class="tsc-tour-text"></p>' +
      '<div class="tsc-tour-actions">' +
      '<span class="tsc-tour-progress"></span>' +
      '<button type="button" data-tour="skip">Skip</button>' +
      '<button type="button" data-tour="next">Next</button>' +
      "</div></div>";
    tour.addEventListener("click", onTourClick);
    document.addEventListener("keydown", onTourKey, true);
    window.addEventListener("resize", placeTour);
    window.addEventListener("scroll", placeTour, true);
    (document.body || document.documentElement).appendChild(tour);

    syncHelp();
    showTourStep(0);
  }

  function showTourStep(index) {
    tourStep = index;
    if (!tour) return;
    if (index >= TOUR_STEPS.length) {
      endTour();
      return;
    }

    tour.querySelector(".tsc-tour-text").textContent = TOUR_STEPS[index].text;
    tour.querySelector(".tsc-tour-progress").textContent = index + 1 + " / " + TOUR_STEPS.length;
    tour.querySelector('[data-tour="next"]').textContent =
      index === TOUR_STEPS.length - 1 ? "Done" : "Next";
    placeTour();

    clearTimeout(tourTimer);
    tourTimer = setTimeout(() => showTourStep(index + 1), TOUR_STEP_MS);
  }

  function placeTour() {
    if (!tour) return;
    const step = TOUR_STEPS[tourStep];
    if (!step) return;

    const spot = tour.querySelector(".tsc-tour-spot");
    const card = tour.querySelector(".tsc-tour-card");
    const target = document.querySelector(step.selector);

    if (!target) {
      spot.style.display = "none";
      card.style.display = "none";
      return;
    }

    spot.style.display = "block";
    card.style.display = "block";

    const pad = 6;
    const rect = target.getBoundingClientRect();
    spot.style.left = rect.left - pad + "px";
    spot.style.top = rect.top - pad + "px";
    spot.style.width = rect.width + pad * 2 + "px";
    spot.style.height = rect.height + pad * 2 + "px";

    const width = 280;
    const gap = 14;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);

    let top;
    if (step.place === "top") {
      top = rect.top - gap - 122;
      if (top < 12) top = rect.bottom + gap;
    } else {
      top = rect.bottom + gap;
      if (top + 122 > window.innerHeight) top = Math.max(12, rect.top - gap - 122);
    }

    card.style.left = left + "px";
    card.style.top = top + "px";
    card.style.width = width + "px";
  }

  function onTourClick(event) {
    const button = event.target.closest("button[data-tour]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.tour === "skip") endTour();
      else showTourStep(tourStep + 1);
      return;
    }
    /* clicking the dimmed backdrop advances */
    if (event.target === tour) showTourStep(tourStep + 1);
  }

  function onTourKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    endTour();
  }

  function endTour() {
    clearTimeout(tourTimer);
    tourTimer = null;
    if (tour) {
      tour.remove();
      tour = null;
    }
    document.removeEventListener("keydown", onTourKey, true);
    window.removeEventListener("resize", placeTour);
    window.removeEventListener("scroll", placeTour, true);
    syncHelp();
  }

  /* --------------------------------------------------------- settings pop */

  const SETTING_KEYS = ["schema", "view", "hidden", "hiddenDevices", "sync", "onboarded", "hintShown"];

  function toggleSettings() {
    if (settingsOpen) closeSettings();
    else openSettings();
  }

  function openSettings() {
    settingsOpen = true;
    helpOpen = false;
    if (tour) endTour();
    ensureSettings();
    syncHelp();
    renderPill();
  }

  function closeSettings() {
    settingsOpen = false;
    if (settingsEl) {
      settingsEl.remove();
      settingsEl = null;
    }
    renderPill();
  }

  function ensureSettings() {
    if (settingsEl && settingsEl.isConnected) return settingsEl;
    settingsEl = document.createElement("div");
    settingsEl.id = "tsc-settings";
    settingsEl.setAttribute("role", "dialog");
    settingsEl.setAttribute("aria-label", "Tailscale Clean Console settings");
    settingsEl.addEventListener("click", onSettingsClick);
    settingsEl.addEventListener("change", onSettingsChange);
    (document.body || document.documentElement).appendChild(settingsEl);
    renderSettings();
    return settingsEl;
  }

  function renderSettings() {
    if (!settingsEl) return;
    settingsEl.textContent = "";

    const head = document.createElement("div");
    head.className = "tsc-settings-head";
    const title = document.createElement("p");
    title.className = "tsc-settings-title";
    title.textContent = "Settings";
    const close = settingsButton("close", "\u00D7");
    close.setAttribute("aria-label", "Close settings");
    head.append(title, close);

    const viewRow = document.createElement("div");
    viewRow.className = "tsc-settings-row";
    const viewLabel = document.createElement("span");
    viewLabel.className = "tsc-settings-label";
    viewLabel.textContent = "Default view";
    const viewGroup = document.createElement("div");
    viewGroup.className = "tsc-settings-seg";
    viewGroup.setAttribute("role", "group");
    viewGroup.setAttribute("aria-label", "Default view");
    for (const [value, text] of [["grid", "\u25A6 Grid"], ["list", "\u2630 List"]]) {
      const btn = settingsButton("view-" + value, text);
      const on = settings.view === value;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("is-on", on);
      viewGroup.appendChild(btn);
    }
    viewRow.append(viewLabel, viewGroup);

    settingsEl.append(head, viewRow, hiddenSection("devices"), hiddenSection("elements"));

    const area = syncArea();
    const syncRow = document.createElement("label");
    syncRow.className = "tsc-settings-sync";
    const syncBox = document.createElement("input");
    syncBox.type = "checkbox";
    syncBox.dataset.settings = "sync";
    syncBox.checked = settings.sync === true;
    syncBox.disabled = !area;
    syncBox.setAttribute("aria-label", "Sync settings across devices");
    const syncText = document.createElement("span");
    syncText.textContent = "Sync settings across devices";
    syncRow.append(syncBox, syncText);
    if (!area) {
      const note = document.createElement("span");
      note.className = "tsc-settings-note";
      note.textContent = "not available in this browser";
      syncRow.appendChild(note);
    }

    const io = document.createElement("div");
    io.className = "tsc-settings-io";
    io.append(settingsButton("export", "Export JSON"), settingsButton("import", "Import JSON"));

    const version = document.createElement("p");
    version.className = "tsc-settings-version";
    version.textContent = "settings v" + settings.schema;

    settingsEl.append(syncRow, io, version);
  }

  function settingsButton(action, text) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.settings = action;
    button.textContent = text;
    return button;
  }

  /* One section per kind of hidden thing, with a per-item "Show" action and a
     section-level reset - so restoring devices and elements is independent. */
  function hiddenSection(kind) {
    const isDevices = kind === "devices";
    const keys = isDevices ? settings.hiddenDevices : settings.hidden;

    const section = document.createElement("section");
    section.className = "tsc-settings-section";
    section.dataset.section = kind;

    const head = document.createElement("div");
    head.className = "tsc-settings-subhead";
    const sub = document.createElement("span");
    sub.className = "tsc-settings-subtitle";
    sub.textContent = (isDevices ? "Hidden devices" : "Hidden elements") + " (" + keys.length + ")";
    const reset = settingsButton(isDevices ? "reset-devices" : "reset-elements", "Show all");
    reset.setAttribute("aria-label", isDevices ? "Show hidden devices" : "Show hidden elements");
    reset.title = isDevices ? "Show hidden devices" : "Show hidden elements";
    reset.disabled = keys.length === 0;
    head.append(sub, reset);
    section.appendChild(head);

    if (keys.length) {
      const list = document.createElement("ul");
      list.className = "tsc-settings-list";
      keys.forEach((key, index) => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.className = "tsc-settings-item";
        name.textContent = isDevices ? deviceNameFor(key) : key;
        name.title = key;
        const show = settingsButton(isDevices ? "show-device" : "show-element", "Show");
        show.setAttribute("aria-label", "Show " + name.textContent);
        show.dataset.key = key;
        show.dataset.index = String(index);
        item.append(name, show);
        list.appendChild(item);
      });
      section.appendChild(list);
    }
    return section;
  }

  function onSettingsClick(event) {
    const button = event.target.closest("button[data-settings]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    switch (button.dataset.settings) {
      case "close":
        closeSettings();
        return;
      case "view-grid":
        setView("grid");
        return;
      case "view-list":
        setView("list");
        return;
      case "show-device":
        removeKey(settings.hiddenDevices, button.dataset.key);
        return;
      case "show-element":
        removeAt(settings.hidden, Number(button.dataset.index));
        return;
      case "reset-devices":
        settings.hiddenDevices = [];
        afterChange();
        return;
      case "reset-elements":
        settings.hidden = [];
        afterChange();
        return;
      case "export":
        exportSettings();
        return;
      case "import":
        ensureSettingsFile().click();
        return;
    }
  }

  function onSettingsChange(event) {
    const box = event.target.closest('input[data-settings="sync"]');
    if (!box) return;
    settings.sync = box.checked === true;
    saveSettings();
    const area = syncArea();
    if (settings.sync && area) {
      storageSet(area, STORE_KEY, settings);
      hydrateFromSync();
    }
    renderSettings();
    renderPill();
  }

  function setView(view) {
    settings.view = view === "list" ? "list" : "grid";
    saveSettings();
    sweep();
    renderSettings();
  }

  function removeKey(list, key) {
    const next = list.filter((item) => item !== key);
    if (next.length === list.length) return;
    if (list === settings.hiddenDevices) settings.hiddenDevices = next;
    else settings.hidden = next;
    afterChange();
  }

  function removeAt(list, index) {
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    afterChange();
  }

  function afterChange() {
    saveSettings();
    sweep();
    renderSettings();
    renderPill();
  }

  /* Map a stored device key back to the machine name shown on the card. */
  function deviceNameFor(key) {
    const table = findMachinesTable();
    if (table) {
      for (const row of deviceRows(table)) {
        if (deviceKey(row) !== key) continue;
        const link = row.querySelector("td a[href]");
        const text = ((link ? link.textContent : row.textContent) || "").trim();
        if (text) return text.split("\n")[0].slice(0, 80);
      }
    }
    return key.replace(/^(id|name):/, "");
  }

  /* ------------------------------------------------- export / import JSON */

  function exportSettings() {
    const json = JSON.stringify(settings, null, 2);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tailscale-clean-console-settings.json";
      link.rel = "noopener";
      (document.body || document.documentElement).appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn("[tailscale-clean] could not export settings", err);
    }
  }

  function ensureSettingsFile() {
    if (settingsFile && settingsFile.isConnected) return settingsFile;
    settingsFile = document.createElement("input");
    settingsFile.type = "file";
    settingsFile.id = "tsc-settings-file";
    settingsFile.accept = "application/json,.json";
    settingsFile.hidden = true;
    settingsFile.addEventListener("change", onSettingsFile);
    (document.body || document.documentElement).appendChild(settingsFile);
    return settingsFile;
  }

  function onSettingsFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = applyImportedSettings(String(reader.result || ""));
      if (!ok) console.warn("[tailscale-clean] ignored an invalid settings file");
      if (settingsOpen) renderSettings();
    };
    reader.onerror = () => {
      if (settingsOpen) renderSettings();
    };
    reader.readAsText(file);
  }

  /* Accept only JSON that looks like our settings, then run it through the same
     normalizer as storage - bad fields fall back to defaults. */
  function applyImportedSettings(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      return false;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    if (!SETTING_KEYS.some((key) => key in raw)) return false;
    settings = normalizeSettings(raw);
    pruneDone = false;
    saveSettings();
    sweep();
    return true;
  }

  let settingsFile = null;

  /* --------------------------------------------------------- element pick */

  let highlighted = null;
  let highlightedOutline = "";
  let highlightedOffset = "";

  /* The extension's own floating UI must never be pickable or highlightable. */
  function isTscUi(el) {
    return !!(
      el &&
      el.closest &&
      el.closest("#tsc-pill, #tsc-help, #tsc-settings, #tsc-settings-file, #tsc-hint, #tsc-tour")
    );
  }

  function setPick(on) {
    if (pickArmed === on) return;
    pickArmed = on;
    document.documentElement.classList.toggle("tsc-picking", on);

    if (on) {
      document.addEventListener("mousemove", onPickMove, true);
      document.addEventListener("click", onPickClick, true);
      document.addEventListener("keydown", onPickKey, true);
      /* contextual hint, on the very first Hide only */
      if (!settings.hintShown) {
        settings.hintShown = true;
        saveSettings();
        ensureHint();
      }
    } else {
      document.removeEventListener("mousemove", onPickMove, true);
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onPickKey, true);
      clearHighlight();
      removeHint();
    }
    renderPill();
    syncHelp();
  }

  function onPickMove(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el === highlighted || isTscUi(el)) return;
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
    if (isTscUi(event.target)) return; /* let the pill and cards work */

    event.preventDefault();
    event.stopPropagation();

    const el = document.elementFromPoint(event.clientX, event.clientY) || event.target;
    if (isTscUi(el)) return;

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
    if (table) {
      pruneHiddenDevices(table);
      applyHiddenDevices(table);
    }

    const grid = applyGrid();
    if (onMachinesPage()) {
      if (grid) markTable();
      ensurePill();
    } else {
      removePill();
      removeHint();
      if (tour) endTour();
      closeSettings();
    }
    syncHelp();
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
  hydrateFromSync();
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
