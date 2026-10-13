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
 *                      default view / language, export / import and sync
 *  4. Toasts and an undo history: every hide says what it hid and offers
 *     "Undo" (also Cmd/Ctrl+Z); reset is confirmed too.
 *  5. Keyboard shortcuts (g grid/list, h hide, r reset, p show/hide the pill,
 *     Esc cancel) and a keyboard-operable element picker.
 *
 * All settings live in localStorage under "tsc:settings:v1" (optionally
 * mirrored to browser.storage.sync when the user turns sync on). UI strings
 * go through t() so the locale can be switched in settings.
 */
(() => {
  "use strict";

  const STORE_KEY = "tsc:settings:v1";
  const SCHEMA_VERSION = 4;
  const MACHINES_PATH = /^\/admin\/machines\/?$/;
  const DEFAULT_SETTINGS = Object.freeze({
    schema: SCHEMA_VERSION,
    view: "grid",
    hidden: [],
    hiddenDevices: [],
    sync: false,
    onboarded: false,
    hintShown: false,
    locale: "en",
    pillHidden: false,
    sort: "status",
    density: "comfortable",
    hideOffline: false,
  });
  const SORT_MODES = ["status", "name", "lastSeen"];

  /* --------------------------------------------------------------- i18n */

  /* Every user-facing string lives here (see t()). Adding a locale is one
     more key; any missing string falls back to English. The scaffold ships
     English plus one non-English locale (Spanish). */
  const MESSAGES = {
    en: {
      "pill.label": "Tailscale Clean Console",
      "pill.viewGrid": "Grid",
      "pill.viewList": "List",
      "pill.viewToggle": "Toggle grid or list view",
      "pill.viewTitleGrid": "Showing grid view - click for the classic list",
      "pill.viewTitleList": "Showing list view - click for the grid",
      "pill.pick": "Hide",
      "pill.pickArmed": "pick...",
      "pill.pickToggle": "Pick an element or device to hide",
      "pill.pickTitle": "Hide: click this, then click an element (or a device card) to remove it",
      "pill.pickArmedTitle": "Click an element or device to hide it (Esc to cancel)",
      "pill.reset": "Reset",
      "pill.resetAria": "Show everything you have hidden",
      "pill.resetCount": "Show {count} hidden item(s) again",
      "pill.resetNone": "Nothing hidden",
      "pill.settings": "Settings",
      "pill.help": "How this works",
      "help.title": "Tailscale Clean Console",
      "help.aria": "Tailscale Clean Console help",
      "help.line.view": "switch between cards and the classic table",
      "help.line.pick": "click an element, or a device card, to hide it",
      "help.line.reset": "bring back everything you hid",
      "help.line.settings": "restore hidden items, choose the view, export / import",
      "help.tour": "10-second tour",
      "help.dismiss": "Got it",
      "hint.device": "Click a device card to hide the whole device.",
      "tour.aria": "Quick tour",
      "tour.view": "Grid or List - switch the layout whenever you like.",
      "tour.sections": "Online and Offline split the machines, with live counts that follow what you hide.",
      "tour.skip": "Skip",
      "tour.next": "Next",
      "tour.done": "Done",
      "tour.progress": "{index} / {total}",
      "section.online": "Online",
      "section.offline": "Offline",
      "settings.title": "Settings",
      "settings.aria": "Tailscale Clean Console settings",
      "settings.close": "Close settings",
      "settings.defaultView": "Default view",
      "settings.language": "Language",
      "settings.sync": "Sync settings across devices",
      "settings.syncUnavailable": "not available in this browser",
      "settings.export": "Export JSON",
      "settings.import": "Import JSON",
      "settings.hiddenDevices": "Hidden devices",
      "settings.hiddenElements": "Hidden elements",
      "settings.showAll": "Show all",
      "settings.showAllDevices": "Show hidden devices",
      "settings.showAllElements": "Show hidden elements",
      "settings.show": "Show",
      "settings.showItem": "Show {name}",
      "settings.version": "settings v{version}",
      "settings.hidePill": "Hide the pill",
      "settings.hidePillTitle": "Hide the floating controls; press P to bring them back",
      "toast.undo": "Undo",
      "toast.hiddenDevice": "Hidden {name}",
      "toast.hiddenElement": "Hidden {name}",
      "toast.hiddenElementGeneric": "Hidden element",
      "toast.restored": "Showed everything you hid",
      "toast.undone": "Undone",
      "toast.nothingHidden": "Nothing hidden",
      "toast.pillHidden": "Pill hidden - press P to bring it back",
      "toast.pillShown": "Pill shown",
      "toolbar.aria": "Machines view controls",
      "toolbar.sort": "Sort",
      "toolbar.sortStatus": "Status",
      "toolbar.sortName": "Name",
      "toolbar.sortLastSeen": "Last seen",
      "toolbar.density": "Density",
      "toolbar.densityComfortable": "Comfortable",
      "toolbar.densityCompact": "Compact",
      "toolbar.hideOffline": "Hide offline",
      "toolbar.showOffline": "Show offline",
      "empty.search": "No machines match \u201C{query}\u201D",
      "empty.hidden": "{count} device(s) hidden",
      "empty.showAll": "Show all",
      "empty.clear": "Clear search",
      "copy.name": "Copy name",
      "copy.ip": "Copy IP",
      "toast.copied": "Copied {what}",
      "toast.copyFailed": "Couldn't copy",
    },
    es: {
      "pill.label": "Tailscale Clean Console",
      "pill.viewGrid": "Cuadrícula",
      "pill.viewList": "Lista",
      "pill.viewToggle": "Cambiar entre cuadrícula y lista",
      "pill.viewTitleGrid": "Vista de cuadrícula: haz clic para la lista clásica",
      "pill.viewTitleList": "Vista de lista: haz clic para la cuadrícula",
      "pill.pick": "Ocultar",
      "pill.pickArmed": "elige...",
      "pill.pickToggle": "Elegir un elemento o dispositivo para ocultar",
      "pill.pickTitle": "Ocultar: haz clic aquí y luego en un elemento (o una tarjeta de dispositivo) para quitarlo",
      "pill.pickArmedTitle": "Haz clic en un elemento o dispositivo para ocultarlo (Esc para cancelar)",
      "pill.reset": "Restablecer",
      "pill.resetAria": "Mostrar todo lo que has ocultado",
      "pill.resetCount": "Mostrar {count} elemento(s) oculto(s) de nuevo",
      "pill.resetNone": "Nada oculto",
      "pill.settings": "Ajustes",
      "pill.help": "Cómo funciona",
      "help.title": "Tailscale Clean Console",
      "help.aria": "Ayuda de Tailscale Clean Console",
      "help.line.view": "cambia entre tarjetas y la tabla clásica",
      "help.line.pick": "haz clic en un elemento, o en una tarjeta de dispositivo, para ocultarlo",
      "help.line.reset": "recupera todo lo que ocultaste",
      "help.line.settings": "restaura elementos ocultos, elige la vista, exporta / importa",
      "help.tour": "Tour de 10 segundos",
      "help.dismiss": "Entendido",
      "hint.device": "Haz clic en una tarjeta de dispositivo para ocultar todo el dispositivo.",
      "tour.aria": "Tour rápido",
      "tour.view": "Cuadrícula o Lista: cambia el diseño cuando quieras.",
      "tour.sections": "En línea y Desconectados separan las máquinas, con recuentos en vivo que siguen lo que ocultas.",
      "tour.skip": "Saltar",
      "tour.next": "Siguiente",
      "tour.done": "Listo",
      "tour.progress": "{index} / {total}",
      "section.online": "En línea",
      "section.offline": "Desconectados",
      "settings.title": "Ajustes",
      "settings.aria": "Ajustes de Tailscale Clean Console",
      "settings.close": "Cerrar ajustes",
      "settings.defaultView": "Vista predeterminada",
      "settings.language": "Idioma",
      "settings.sync": "Sincronizar ajustes entre dispositivos",
      "settings.syncUnavailable": "no disponible en este navegador",
      "settings.export": "Exportar JSON",
      "settings.import": "Importar JSON",
      "settings.hiddenDevices": "Dispositivos ocultos",
      "settings.hiddenElements": "Elementos ocultos",
      "settings.showAll": "Mostrar todo",
      "settings.showAllDevices": "Mostrar dispositivos ocultos",
      "settings.showAllElements": "Mostrar elementos ocultos",
      "settings.show": "Mostrar",
      "settings.showItem": "Mostrar {name}",
      "settings.version": "ajustes v{version}",
      "settings.hidePill": "Ocultar la píldora",
      "settings.hidePillTitle": "Oculta los controles flotantes; pulsa P para recuperarlos",
      "toast.undo": "Deshacer",
      "toast.hiddenDevice": "Ocultado {name}",
      "toast.hiddenElement": "Ocultado {name}",
      "toast.hiddenElementGeneric": "Elemento oculto",
      "toast.restored": "Se mostró todo lo que ocultaste",
      "toast.undone": "Deshecho",
      "toast.nothingHidden": "Nada oculto",
      "toast.pillHidden": "Píldora oculta: pulsa P para recuperarla",
      "toast.pillShown": "Píldora visible",
      "toolbar.aria": "Controles de la vista de máquinas",
      "toolbar.sort": "Ordenar",
      "toolbar.sortStatus": "Estado",
      "toolbar.sortName": "Nombre",
      "toolbar.sortLastSeen": "Vista por última vez",
      "toolbar.density": "Densidad",
      "toolbar.densityComfortable": "Cómoda",
      "toolbar.densityCompact": "Compacta",
      "toolbar.hideOffline": "Ocultar desconectados",
      "toolbar.showOffline": "Mostrar desconectados",
      "empty.search": "Ninguna máquina coincide con \u201C{query}\u201D",
      "empty.hidden": "{count} dispositivo(s) oculto(s)",
      "empty.showAll": "Mostrar todo",
      "empty.clear": "Borrar búsqueda",
      "copy.name": "Copiar nombre",
      "copy.ip": "Copiar IP",
      "toast.copied": "Copiado {what}",
      "toast.copyFailed": "No se pudo copiar",
    },
  };

  const LOCALES = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  /* Look up a string for the current locale, with {name} placeholders. */
  function t(key, vars) {
    const dict = (settings && MESSAGES[settings.locale]) || MESSAGES.en;
    let text = dict[key];
    if (text == null) text = MESSAGES.en[key];
    if (text == null) text = key;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
      );
    }
    return text;
  }

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
      locale: typeof source.locale === "string" && MESSAGES[source.locale] ? source.locale : "en",
      pillHidden: source.pillHidden === true,
      sort: SORT_MODES.includes(source.sort) ? source.sort : "status",
      density: source.density === "compact" ? "compact" : "comfortable",
      hideOffline: source.hideOffline === true,
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
    let hidden = 0;
    let visible = 0;
    const query = searchQuery.trim().toLowerCase();
    const onlineRows = [];
    const offlineRows = [];
    const meta = new Map();

    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("tsc-section")) continue;

      const cells = Array.from(row.children).filter((el) => el.tagName === "TD");

      /* empty-search / placeholder row: let it span the whole grid */
      if (cells.length < 2) {
        if (!row.classList.contains("tsc-empty")) row.classList.add("tsc-empty");
        continue;
      }

      cells.forEach((td, i) => {
        const isFirst = i === 0;
        const isLast = i === cells.length - 1;
        const header = headers[i] || "";
        const omit = !isFirst && !isLast && OMIT_COLUMN.test(header);

        td.classList.toggle("tsc-title", isFirst);
        td.classList.toggle("tsc-actions", isLast);
        td.classList.toggle("tsc-omit", omit);
        /* the last-seen cell shares its baseline with the copy buttons, so it
           needs a class of its own to keep the timestamp clear of them */
        td.classList.toggle("tsc-seen", lastSeenIndex >= 0 && i === lastSeenIndex);

        const label = isFirst || isLast || omit ? "" : header;
        if (label) {
          if (td.getAttribute("data-tsc-label") !== label) td.setAttribute("data-tsc-label", label);
        } else if (td.hasAttribute("data-tsc-label")) {
          td.removeAttribute("data-tsc-label");
        }
      });

      ensureRowCopy(row);

      const isOnline = lastSeenIndex >= 0 && cellIsOnline(cells[lastSeenIndex]);
      row.classList.toggle("tsc-online", isOnline);
      row.classList.toggle("tsc-offline", !isOnline);

      /* mirror the console's search: filter the cards and drop the misses from
         the Online / Offline totals (the console's own filter may not survive
         the grid restyle) */
      const matches = !query || rowMatchesQuery(row, query);
      row.classList.toggle("tsc-filtered", !matches);

      /* a stable "as Tailscale listed it" index, so the Status sort can put the
         rows back the way they arrived */
      if (!row.dataset.tscSeq) row.dataset.tscSeq = String(seqCounter++);
      meta.set(row, {
        name: deviceSortName(row),
        recent: isOnline ? Number.MAX_SAFE_INTEGER : lastSeenTime(cells[lastSeenIndex]),
        seq: Number(row.dataset.tscSeq),
      });

      if (isOnline) onlineRows.push(row);
      else offlineRows.push(row);

      if (row.classList.contains("tsc-device-hidden")) {
        hidden++;
        continue;
      }
      if (!matches) continue;
      if (isOnline) online++;
      else offline++;
      visible++;
    }

    sortRowList(onlineRows, meta);
    sortRowList(offlineRows, meta);

    syncSections(table, online, offline);
    reorderRows(table, onlineRows, offlineRows);
    updateMachineCount(table);
    syncEmptyState(table, { visible, hidden, query });
  }

  /* Whether a device card contains the console's search text (name, tag, owner,
     IP, version - anything Tailscale rendered into the row). */
  function rowMatchesQuery(row, query) {
    return ((row.textContent || "") + "").toLowerCase().includes(query);
  }

  /* The machine name in a row, lowercased, for the Name sort. */
  function deviceSortName(row) {
    const cell = row.querySelector("td.tsc-title") || row.querySelector("td");
    const link = (cell && cell.querySelector("a[href]")) || row.querySelector("td a[href]");
    const text = ((link ? link.textContent : (cell || row).textContent) || "").trim();
    return (text.split("\n")[0] || "").toLowerCase();
  }

  /* Epoch ms for a "Last seen" cell, so the Last-seen sort can order offline
     machines. The console shows a full date for older entries ("Mar 12, 9:41 AM
     GMT+5:30") but only a clock time for devices that went offline today
     ("1:55 PM GMT+5:30"), which Date.parse rejects - treat such a value as
     today so it still sorts ahead of older dates. */
  function lastSeenTime(cell) {
    if (!cell) return 0;
    const text = (cell.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || /^connected\b/i.test(text)) return 0;

    const absolute = Date.parse(text);
    if (!Number.isNaN(absolute)) return absolute;

    const clock = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (clock) {
      let hours = Number(clock[1]);
      const minutes = Number(clock[2]);
      const seconds = Number(clock[3] || 0);
      const meridiem = (clock[4] || "").toLowerCase();
      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
      const today = new Date();
      today.setHours(hours, minutes, seconds, 0);
      return today.getTime();
    }
    return 0;
  }

  /* Sort a group of rows according to the current sort preference, falling back
     to Tailscale's own order so the sort is stable. */
  function sortRowList(list, meta) {
    const mode = settings.sort;
    if (mode === "name") {
      list.sort((a, b) => meta.get(a).name.localeCompare(meta.get(b).name) || meta.get(a).seq - meta.get(b).seq);
    } else if (mode === "lastSeen") {
      list.sort((a, b) => meta.get(b).recent - meta.get(a).recent || meta.get(a).seq - meta.get(b).seq);
    } else {
      list.sort((a, b) => meta.get(a).seq - meta.get(b).seq);
    }
  }

  /* Put the tbody back in visual order: online header, online cards, offline
     header, offline cards. Only touches the DOM when the order actually
     changed, so the MutationObserver does not loop. */
  function reorderRows(table, onlineRows, offlineRows) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const desired = [];
    const onlineHeader = table.querySelector("tr.tsc-section--online");
    const offlineHeader = table.querySelector("tr.tsc-section--offline");
    if (onlineHeader) desired.push(onlineHeader);
    desired.push(...onlineRows);
    if (offlineHeader) desired.push(offlineHeader);
    desired.push(...offlineRows);

    const current = Array.from(tbody.children);
    const inDesired = new Set(desired);
    const final = desired.concat(current.filter((node) => !inDesired.has(node)));

    let same = final.length === current.length;
    if (same) {
      for (let i = 0; i < final.length; i++) {
        if (final[i] !== current[i]) {
          same = false;
          break;
        }
      }
    }
    if (!same) for (const node of final) tbody.appendChild(node);
  }

  /* ------------------------------------------------ sort, toolbar, search */

  let seqCounter = 1;
  let searchQuery = "";
  let toolbar = null;
  let toolbarSort = null;
  let toolbarDensity = null;
  let toolbarOffline = null;

  /* The console has its own search box; we do not add a second one. We watch
     that input so the Online / Offline counts follow its filtering. */
  let pageSearch = null;

  function findPageSearchInput() {
    const inputs = document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])');
    for (const input of inputs) {
      if (isTscUi(input) || input.disabled || input.readOnly) continue;
      const hint = (
        (input.getAttribute("placeholder") || "") +
        " " +
        (input.getAttribute("aria-label") || "") +
        " " +
        (input.getAttribute("name") || "") +
        " " +
        (input.id || "")
      ).toLowerCase();
      if (/search|filter/.test(hint)) return input;
    }
    return null;
  }

  function watchPageSearch() {
    const input = onMachinesPage() ? findPageSearchInput() : null;
    if (input === pageSearch) return;
    if (pageSearch) pageSearch.removeEventListener("input", onPageSearchChanged);
    pageSearch = input;
    if (pageSearch) {
      searchQuery = pageSearch.value;
      pageSearch.addEventListener("input", onPageSearchChanged);
    }
  }

  function onPageSearchChanged() {
    searchQuery = pageSearch ? pageSearch.value : "";
    schedule();
  }

  function applyDensity() {
    const compact = onMachinesPage() && settings.density === "compact";
    document.documentElement.classList.toggle("tsc-compact", compact);
  }

  function applyHideOffline() {
    const hide = onMachinesPage() && settings.hideOffline === true;
    document.documentElement.classList.toggle("tsc-hide-offline", hide);
  }

  function createToolbar() {
    const el = document.createElement("div");
    el.id = "tsc-toolbar";
    el.setAttribute("role", "toolbar");

    const sort = document.createElement("select");
    sort.className = "tsc-sort";
    sort.dataset.tsc = "sort";
    for (const [value, key] of [
      ["status", "toolbar.sortStatus"],
      ["name", "toolbar.sortName"],
      ["lastSeen", "toolbar.sortLastSeen"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.dataset.key = key;
      option.textContent = t(key);
      sort.appendChild(option);
    }
    sort.addEventListener("change", () => {
      settings.sort = SORT_MODES.includes(sort.value) ? sort.value : "status";
      saveSettings();
      sweep();
    });

    const density = document.createElement("button");
    density.type = "button";
    density.dataset.tsc = "density";
    density.addEventListener("click", () => {
      settings.density = settings.density === "compact" ? "comfortable" : "compact";
      saveSettings();
      sweep();
    });

    const offline = document.createElement("button");
    offline.type = "button";
    offline.dataset.tsc = "offline";
    offline.addEventListener("click", () => {
      settings.hideOffline = settings.hideOffline !== true;
      saveSettings();
      sweep();
    });

    el.append(sort, density, offline);
    toolbarSort = sort;
    toolbarDensity = density;
    toolbarOffline = offline;
    return el;
  }

  function ensureToolbar(table) {
    if (!table) {
      removeToolbar();
      return;
    }
    if (!toolbar || !toolbar.isConnected) toolbar = createToolbar();
    if (toolbar.parentElement !== table.parentElement || toolbar.nextElementSibling !== table) {
      table.parentElement.insertBefore(toolbar, table);
    }
    renderToolbar();
  }

  function removeToolbar() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
    toolbarSort = null;
    toolbarDensity = null;
    toolbarOffline = null;
  }

  function renderToolbar() {
    if (!toolbar) return;
    toolbar.setAttribute("aria-label", t("toolbar.aria"));

    if (toolbarSort) {
      const sortLabel = t("toolbar.sort");
      if (toolbarSort.getAttribute("aria-label") !== sortLabel) toolbarSort.setAttribute("aria-label", sortLabel);
      for (const option of toolbarSort.options) {
        const text = t(option.dataset.key);
        if (option.textContent !== text) option.textContent = text;
      }
      if (toolbarSort.value !== settings.sort) toolbarSort.value = settings.sort;
    }

    if (toolbarDensity) {
      const compact = settings.density === "compact";
      const text = t(compact ? "toolbar.densityCompact" : "toolbar.densityComfortable");
      if (toolbarDensity.textContent !== text) toolbarDensity.textContent = text;
      toolbarDensity.setAttribute("aria-pressed", String(compact));
      const densityLabel = t("toolbar.density");
      if (toolbarDensity.getAttribute("aria-label") !== densityLabel) toolbarDensity.setAttribute("aria-label", densityLabel);
    }

    if (toolbarOffline) {
      const hid = settings.hideOffline === true;
      const text = t(hid ? "toolbar.showOffline" : "toolbar.hideOffline");
      if (toolbarOffline.textContent !== text) toolbarOffline.textContent = text;
      toolbarOffline.setAttribute("aria-pressed", String(hid));
    }
  }

  /* --------------------------------------------- copy name / IP from cards */

  function deviceIp(row) {
    const cells = row.querySelectorAll("td.tsc-omit");
    for (const cell of cells) {
      const v4 = (cell.textContent || "").match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
      if (v4) return v4[0];
    }
    for (const cell of cells) {
      const text = (cell.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return text.split(" ")[0];
    }
    return "";
  }

  function ensureRowCopy(row) {
    let wrap = row.querySelector(":scope > .tsc-copy");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "tsc-copy";
      for (const kind of ["name", "ip"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.copy = kind;
        wrap.appendChild(button);
      }
      row.appendChild(wrap);
    }

    const nameLabel = t("copy.name");
    const ipLabel = t("copy.ip");
    const nameBtn = wrap.querySelector('[data-copy="name"]');
    if (nameBtn.getAttribute("aria-label") !== nameLabel) {
      nameBtn.setAttribute("aria-label", nameLabel);
      nameBtn.title = nameLabel;
    }
    const ipBtn = wrap.querySelector('[data-copy="ip"]');
    if (ipBtn.getAttribute("aria-label") !== ipLabel) {
      ipBtn.setAttribute("aria-label", ipLabel);
      ipBtn.title = ipLabel;
    }
    const hasIp = !!deviceIp(row);
    if (ipBtn.hidden === hasIp) ipBtn.hidden = !hasIp;
  }

  function copyFromRow(row, kind) {
    if (!row) return;
    const value = kind === "ip" ? deviceIp(row) : deviceDisplayName(row);
    if (!value) {
      showToast(t("toast.copyFailed"));
      return;
    }
    copyText(value, kind === "ip" ? "IP" : value);
  }

  function copyText(text, label) {
    const done = () => showToast(t("toast.copied", { what: label }));
    const fail = () => showToast(t("toast.copyFailed"));
    const fallback = () => {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        (document.body || document.documentElement).appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (ok) done();
        else fail();
      } catch (err) {
        fail();
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
        return;
      }
    } catch (err) {
      /* fall through to the legacy path */
    }
    fallback();
  }

  /* Clicks on our injected card/toolbar controls. Never in pick mode: there the
     picker owns the page and returns early for our UI anyway. */
  function onInjectedClick(event) {
    const target = event.target;
    if (!target || !target.closest || pickArmed) return;

    const copyBtn = target.closest(".tsc-copy button[data-copy]");
    if (copyBtn) {
      event.preventDefault();
      event.stopPropagation();
      copyFromRow(copyBtn.closest("tr"), copyBtn.dataset.copy);
      return;
    }

    const action = target.closest(".tsc-empty-action");
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      if (action.dataset.tsc === "clear") {
        searchQuery = "";
        if (pageSearch) {
          pageSearch.value = "";
          pageSearch.dispatchEvent(new Event("input", { bubbles: true }));
        }
        schedule();
      } else {
        settings.hiddenDevices = [];
        afterChange();
      }
    }
  }

  /* ------------------------------- Tailscale's own "N machines" count sync */

  function findMachineCountEl() {
    const direct = document.querySelector(".count");
    if (direct && /\d[\d,]*\s+machines?/i.test(direct.textContent)) return direct;
    for (const el of document.querySelectorAll("main p, main span, main div, .page p, .page span, .page div")) {
      if (el.children.length || isTscUi(el)) continue;
      if (/^\s*\d[\d,]*\s+machines?\s*$/i.test(el.textContent)) return el;
    }
    return null;
  }

  function updateMachineCount(table) {
    const el = findMachineCountEl();
    if (!el) return;
    const hidden = table.querySelectorAll("tr.tsc-device-hidden").length;

    const current = el.textContent;
    /* if the page changed the text itself, treat it as the new template */
    if (current !== el.dataset.tscLast) el.dataset.tscTemplate = current;
    const template = el.dataset.tscTemplate || current;
    const match = template.match(/\d[\d,]*/);
    if (!match) return;

    /* subtract from the count the page already shows, so Tailscale's own
       search/filtering does not throw our number off */
    const base = Number(match[0].replace(/,/g, ""));
    const shown = Math.max(0, base - hidden);
    const next = template.replace(/\d[\d,]*/, String(shown));
    el.dataset.tscLast = next;
    if (current !== next) el.textContent = next;
  }

  /* ------------------------------- empty state (all hidden / no matches) */

  function syncEmptyState(table, state) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const noMatches = !!state.query && state.visible === 0;
    const allHidden = !state.query && state.visible === 0 && state.hidden > 0;
    let row = table.querySelector("tr.tsc-empty-state");

    if (!noMatches && !allHidden) {
      if (row) row.remove();
      return;
    }

    if (!row) {
      row = document.createElement("tr");
      row.className = "tsc-empty-state";
      row.appendChild(document.createElement("td"));
    }
    if (row.parentElement !== tbody) tbody.appendChild(row);

    const cell = row.firstElementChild;
    const message = noMatches
      ? t("empty.search", { query: searchQuery.trim() })
      : t("empty.hidden", { count: state.hidden });

    let text = row.querySelector(".tsc-empty-text");
    if (!text) {
      text = document.createElement("span");
      text.className = "tsc-empty-text";
      cell.appendChild(text);
    }
    if (text.textContent !== message) text.textContent = message;

    const action = noMatches ? "clear" : "show-all";
    let button = row.querySelector(".tsc-empty-action");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "tsc-empty-action";
      cell.appendChild(button);
    }
    if (button.dataset.tsc !== action) button.dataset.tsc = action;
    const buttonText = t(noMatches ? "empty.clear" : "empty.showAll");
    if (button.textContent !== buttonText) button.textContent = buttonText;
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
    row.dataset.tscKind = kind;

    const cell = document.createElement("td");
    const title = document.createElement("span");
    title.className = "tsc-section-title";
    title.textContent = sectionTitle(kind);

    const count = document.createElement("span");
    count.className = "tsc-section-count";
    count.textContent = "0";

    cell.append(title, count);
    row.appendChild(cell);
    return row;
  }

  function sectionTitle(kind) {
    return t(kind === "online" ? "section.online" : "section.offline");
  }

  function updateSection(row, count) {
    const kind = row.dataset.tscKind || (row.classList.contains("tsc-section--online") ? "online" : "offline");
    const title = row.querySelector(".tsc-section-title");
    const wanted = sectionTitle(kind);
    if (title && title.textContent !== wanted) title.textContent = wanted;

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

  /* --------------------------------------------------------- undo + toast */

  /* Recent hides, newest last, so Cmd/Ctrl+Z (or the toast's Undo) can put
     one back. Bounded so a long session does not grow forever. */
  const undoStack = [];
  const UNDO_LIMIT = 20;

  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  function undoTarget(entry) {
    if (entry.kind === "device") {
      settings.hiddenDevices = settings.hiddenDevices.filter((key) => key !== entry.key);
    } else {
      settings.hidden = settings.hidden.filter((sel) => sel !== entry.selector);
    }
  }

  function undoLast() {
    const entry = undoStack.pop();
    if (!entry) return;
    undoTarget(entry);
    saveSettings();
    sweep();
    if (settingsOpen) renderSettings();
    showToast(t("toast.undone"));
  }

  let toastEl = null;
  let toastTimer = null;

  function ensureToast() {
    if (toastEl && toastEl.isConnected) return toastEl;
    toastEl = document.createElement("div");
    toastEl.id = "tsc-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    (document.body || document.documentElement).appendChild(toastEl);
    return toastEl;
  }

  /* A short confirmation under the page. `opts.undo` adds an Undo button and
     gives the user longer to reach it. */
  function showToast(message, opts) {
    const el = ensureToast();
    el.textContent = "";

    const text = document.createElement("span");
    text.className = "tsc-toast-text";
    text.textContent = message;
    el.appendChild(text);

    if (opts && opts.undo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tsc-toast-undo";
      button.textContent = t("toast.undo");
      button.addEventListener("click", undoLast, { once: true });
      el.appendChild(button);
    }

    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(removeToast, opts && opts.undo ? 6000 : 3000);
  }

  function removeToast() {
    clearTimeout(toastTimer);
    toastTimer = null;
    if (toastEl) toastEl.classList.remove("is-on");
  }

  /* ------------------------------------------------------- hide actions */

  /* Name a device for the toast/undo label, falling back to its key. */
  function deviceDisplayName(row) {
    const key = deviceKey(row);
    if (key) {
      const name = deviceNameFor(key);
      if (name) return name;
    }
    const link = row.querySelector("td a[href]");
    const text = ((link ? link.textContent : row.textContent) || "").trim().replace(/\s+/g, " ");
    return text.split("\n")[0].slice(0, 60) || "device";
  }

  /* A short, human label for a hidden element: its aria-label or text, else
     its tag name. */
  function elementLabel(el) {
    if (!el) return "";
    const text = ((el.getAttribute("aria-label") || el.textContent || "") + "").trim().replace(/\s+/g, " ").slice(0, 48);
    return text || el.localName || t("toast.hiddenElementGeneric");
  }

  function hideDevice(row) {
    const key = deviceKey(row);
    if (!key || settings.hiddenDevices.includes(key)) return false;
    const name = deviceDisplayName(row);
    settings.hiddenDevices.push(key);
    saveSettings();
    pushUndo({ kind: "device", key, name });
    sweep();
    showToast(t("toast.hiddenDevice", { name }), { undo: true });
    console.info("[tailscale-clean] hid device", row, "with key:", key);
    return true;
  }

  function hideElement(el) {
    if (!el || el === document.body || el === document.documentElement || isTscUi(el)) return false;
    const selector = selectorFor(el);
    if (!selector || settings.hidden.includes(selector)) return false;
    const name = elementLabel(el);
    settings.hidden.push(selector);
    saveSettings();
    applyHidden();
    pushUndo({ kind: "element", selector, name });
    showToast(t("toast.hiddenElement", { name }), { undo: true });
    console.info("[tailscale-clean] hidden element", el, "with selector:", selector);
    return true;
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
    pill.innerHTML =
      '<button type="button" data-act="view"></button>' +
      '<button type="button" data-act="pick" aria-pressed="false"></button>' +
      '<button type="button" data-act="reset"></button>' +
      '<button type="button" data-act="gear">\u2699</button>' +
      '<button type="button" data-act="help">?</button>';
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
    removeToast();
  }

  /* Run a pill action, whichever way it was triggered (click or shortcut). */
  function toggleView() {
    keepScroll(() => {
      settings.view = settings.view === "grid" ? "list" : "grid";
      saveSettings();
      sweep();
    });
    if (settingsOpen) renderSettings();
    renderPill();
  }

  /* Grid and list have very different heights; hold the user's place across the
     toggle by putting the scroll offset back once the new layout is in. */
  function keepScroll(fn) {
    const y = window.scrollY || window.pageYOffset || 0;
    fn();
    try {
      window.scrollTo(0, y);
    } catch (err) {
      /* ignore */
    }
    requestAnimationFrame(() => {
      try {
        window.scrollTo(0, y);
      } catch (err) {
        /* ignore */
      }
    });
  }

  function resetHidden() {
    const hiddenCount = settings.hidden.length + settings.hiddenDevices.length;
    if (hiddenCount === 0) {
      showToast(t("toast.nothingHidden"));
      return;
    }
    settings.hidden = [];
    settings.hiddenDevices = [];
    undoStack.length = 0;
    saveSettings();
    sweep();
    if (settingsOpen) renderSettings();
    showToast(t("toast.restored"));
  }

  /* Hide the pill for power users; the `p` shortcut brings it back. */
  function setPillHidden(hidden) {
    const next = hidden === true;
    if (settings.pillHidden === next) return;
    settings.pillHidden = next;
    saveSettings();
    renderPill();
    if (settingsOpen) renderSettings();
    showToast(t(next ? "toast.pillHidden" : "toast.pillShown"));
  }

  function onPillClick(event) {
    const button = event.target.closest("button[data-act]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    switch (button.dataset.act) {
      case "view":
        toggleView();
        break;
      case "pick":
        setPick(!pickArmed);
        break;
      case "reset":
        resetHidden();
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
    pill.hidden = settings.pillHidden === true;
    pill.setAttribute("aria-label", t("pill.label"));

    const view = pill.querySelector('[data-act="view"]');
    const pick = pill.querySelector('[data-act="pick"]');
    const reset = pill.querySelector('[data-act="reset"]');
    const gear = pill.querySelector('[data-act="gear"]');
    const helpBtn = pill.querySelector('[data-act="help"]');

    view.textContent = settings.view === "grid" ? "\u25A6 " + t("pill.viewGrid") : "\u2630 " + t("pill.viewList");
    view.title = settings.view === "grid" ? t("pill.viewTitleGrid") : t("pill.viewTitleList");
    view.setAttribute("aria-label", t("pill.viewToggle"));
    view.setAttribute("aria-pressed", String(settings.view === "grid"));

    pick.textContent = pickArmed ? "\u2316 " + t("pill.pickArmed") : "\u2316 " + t("pill.pick");
    pick.classList.toggle("is-on", pickArmed);
    pick.title = pickArmed ? t("pill.pickArmedTitle") : t("pill.pickTitle");
    pick.setAttribute("aria-label", t("pill.pickToggle"));
    pick.setAttribute("aria-pressed", String(pickArmed));

    reset.textContent = "\u21BA";
    const hiddenCount = settings.hidden.length + settings.hiddenDevices.length;
    reset.disabled = hiddenCount === 0;
    reset.title = hiddenCount ? t("pill.resetCount", { count: hiddenCount }) : t("pill.resetNone");
    reset.setAttribute("aria-label", hiddenCount ? t("pill.resetCount", { count: hiddenCount }) : t("pill.resetNone"));

    if (gear) {
      gear.classList.toggle("is-on", settingsOpen);
      gear.title = t("pill.settings");
      gear.setAttribute("aria-label", t("pill.settings"));
    }
    if (helpBtn) {
      helpBtn.title = t("pill.help");
      helpBtn.setAttribute("aria-label", t("pill.help"));
    }
  }

  /* ------------------------------------------- welcome / help card + hint */

  /* One short line per pill button - no wall of text. */
  function helpLines() {
    return [
      ["\u25A6 " + t("pill.viewGrid") + " / \u2630 " + t("pill.viewList"), t("help.line.view")],
      ["\u2316 " + t("pill.pick"), t("help.line.pick")],
      ["\u21BA " + t("pill.reset"), t("help.line.reset")],
      ["\u2699 " + t("pill.settings"), t("help.line.settings")],
    ];
  }

  function ensureHelp() {
    if (help && help.isConnected) return;

    help = document.createElement("div");
    help.id = "tsc-help";
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-label", t("help.aria"));

    const title = document.createElement("p");
    title.className = "tsc-help-title";
    title.textContent = t("help.title");

    const list = document.createElement("ul");
    list.className = "tsc-help-list";
    for (const [key, text] of helpLines()) {
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
    tourBtn.textContent = t("help.tour");

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.dataset.help = "dismiss";
    dismiss.textContent = t("help.dismiss");

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
    hint.textContent = t("hint.device");
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
      textKey: "tour.view",
      place: "top",
    },
    {
      selector: "table.tsc-machines tr.tsc-section--online",
      textKey: "tour.sections",
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
    tour.setAttribute("aria-label", t("tour.aria"));
    tour.innerHTML =
      '<div class="tsc-tour-spot" aria-hidden="true"></div>' +
      '<div class="tsc-tour-card">' +
      '<p class="tsc-tour-text"></p>' +
      '<div class="tsc-tour-actions">' +
      '<span class="tsc-tour-progress"></span>' +
      '<button type="button" data-tour="skip"></button>' +
      '<button type="button" data-tour="next"></button>' +
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

    tour.querySelector(".tsc-tour-text").textContent = t(TOUR_STEPS[index].textKey);
    tour.querySelector(".tsc-tour-progress").textContent = t("tour.progress", {
      index: index + 1,
      total: TOUR_STEPS.length,
    });
    tour.querySelector('[data-tour="skip"]').textContent = t("tour.skip");
    tour.querySelector('[data-tour="next"]').textContent =
      index === TOUR_STEPS.length - 1 ? t("tour.done") : t("tour.next");
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

  const SETTING_KEYS = ["schema", "view", "hidden", "hiddenDevices", "sync", "onboarded", "hintShown", "locale", "pillHidden", "sort", "density", "hideOffline"];

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
    settingsEl.setAttribute("aria-label", t("settings.aria"));
    settingsEl.addEventListener("click", onSettingsClick);
    settingsEl.addEventListener("change", onSettingsChange);
    (document.body || document.documentElement).appendChild(settingsEl);
    renderSettings();
    return settingsEl;
  }

  function renderSettings() {
    if (!settingsEl) return;
    settingsEl.textContent = "";
    settingsEl.setAttribute("aria-label", t("settings.aria"));

    const head = document.createElement("div");
    head.className = "tsc-settings-head";
    const title = document.createElement("p");
    title.className = "tsc-settings-title";
    title.textContent = t("settings.title");
    const close = settingsButton("close", "\u00D7");
    close.setAttribute("aria-label", t("settings.close"));
    head.append(title, close);

    const viewRow = document.createElement("div");
    viewRow.className = "tsc-settings-row";
    const viewLabel = document.createElement("span");
    viewLabel.className = "tsc-settings-label";
    viewLabel.textContent = t("settings.defaultView");
    const viewGroup = document.createElement("div");
    viewGroup.className = "tsc-settings-seg";
    viewGroup.setAttribute("role", "group");
    viewGroup.setAttribute("aria-label", t("settings.defaultView"));
    for (const [value, text] of [["grid", "\u25A6 " + t("pill.viewGrid")], ["list", "\u2630 " + t("pill.viewList")]]) {
      const btn = settingsButton("view-" + value, text);
      const on = settings.view === value;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("is-on", on);
      viewGroup.appendChild(btn);
    }
    viewRow.append(viewLabel, viewGroup);

    const langRow = document.createElement("div");
    langRow.className = "tsc-settings-row";
    const langLabel = document.createElement("span");
    langLabel.className = "tsc-settings-label";
    langLabel.textContent = t("settings.language");
    const localeSelect = document.createElement("select");
    localeSelect.dataset.settings = "locale";
    localeSelect.setAttribute("aria-label", t("settings.language"));
    for (const locale of LOCALES) {
      const option = document.createElement("option");
      option.value = locale.code;
      option.textContent = locale.label;
      if (locale.code === settings.locale) option.selected = true;
      localeSelect.appendChild(option);
    }
    langRow.append(langLabel, localeSelect);

    settingsEl.append(head, viewRow, langRow, hiddenSection("devices"), hiddenSection("elements"));

    const area = syncArea();
    const syncRow = document.createElement("label");
    syncRow.className = "tsc-settings-sync";
    const syncBox = document.createElement("input");
    syncBox.type = "checkbox";
    syncBox.dataset.settings = "sync";
    syncBox.checked = settings.sync === true;
    syncBox.disabled = !area;
    syncBox.setAttribute("aria-label", t("settings.sync"));
    const syncText = document.createElement("span");
    syncText.textContent = t("settings.sync");
    syncRow.append(syncBox, syncText);
    if (!area) {
      const note = document.createElement("span");
      note.className = "tsc-settings-note";
      note.textContent = t("settings.syncUnavailable");
      syncRow.appendChild(note);
    }

    const io = document.createElement("div");
    io.className = "tsc-settings-io";
    io.append(settingsButton("export", t("settings.export")), settingsButton("import", t("settings.import")));

    const pillRow = document.createElement("div");
    pillRow.className = "tsc-settings-pill";
    const hidePill = settingsButton("hide-pill", t("settings.hidePill"));
    hidePill.title = t("settings.hidePillTitle");
    hidePill.setAttribute("aria-label", t("settings.hidePillTitle"));
    pillRow.appendChild(hidePill);

    const version = document.createElement("p");
    version.className = "tsc-settings-version";
    version.textContent = t("settings.version", { version: settings.schema });

    settingsEl.append(syncRow, io, pillRow, version);
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
    const label = isDevices ? t("settings.hiddenDevices") : t("settings.hiddenElements");
    sub.textContent = label + " (" + keys.length + ")";
    const reset = settingsButton(isDevices ? "reset-devices" : "reset-elements", t("settings.showAll"));
    reset.setAttribute("aria-label", t(isDevices ? "settings.showAllDevices" : "settings.showAllElements"));
    reset.title = t(isDevices ? "settings.showAllDevices" : "settings.showAllElements");
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
        const show = settingsButton(isDevices ? "show-device" : "show-element", t("settings.show"));
        show.setAttribute("aria-label", t("settings.showItem", { name: name.textContent }));
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
      case "hide-pill":
        closeSettings();
        setPillHidden(true);
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
    const locale = event.target.closest('select[data-settings="locale"]');
    if (locale) {
      settings.locale = MESSAGES[locale.value] ? locale.value : "en";
      saveSettings();
      sweep();
      renderSettings();
      renderPill();
      return;
    }

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
    keepScroll(() => {
      settings.view = view === "list" ? "list" : "grid";
      saveSettings();
      sweep();
    });
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
    undoStack.length = 0;
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
  let pickFocus = null;

  /* The extension's own floating UI must never be pickable or highlightable. */
  function isTscUi(el) {
    return !!(
      el &&
      el.closest &&
      el.closest(
        "#tsc-pill, #tsc-help, #tsc-settings, #tsc-settings-file, #tsc-hint, #tsc-tour, #tsc-toast, #tsc-toolbar, .tsc-copy, .tsc-empty-state"
      )
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
      document.addEventListener("focusin", onPickFocus, true);
      /* contextual hint, on the very first Hide only */
      if (!settings.hintShown) {
        settings.hintShown = true;
        saveSettings();
        ensureHint();
      }
      /* seed the keyboard cursor so Enter has a target right away */
      pickFocus = pickableRows()[0] || null;
      if (pickFocus) setHighlight(pickFocus, true);
    } else {
      document.removeEventListener("mousemove", onPickMove, true);
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onPickKey, true);
      document.removeEventListener("focusin", onPickFocus, true);
      clearHighlight();
      pickFocus = null;
      removeHint();
    }
    renderPill();
    syncHelp();
  }

  function pickableRows() {
    const table = onMachinesPage() ? findMachinesTable() : null;
    if (!table) return [];
    return deviceRows(table).filter((row) => !row.classList.contains("tsc-device-hidden"));
  }

  /* Outline whatever the picker is about to hide, for the mouse and the
     keyboard alike. */
  function setHighlight(el, scroll) {
    if (!el || el === highlighted) return;
    clearHighlight();
    highlighted = el;
    highlightedOutline = el.style.outline;
    highlightedOffset = el.style.outlineOffset;
    el.style.outline = "2px solid #7c3aed";
    el.style.outlineOffset = "-2px";
    if (scroll) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.style.outline = highlightedOutline;
    highlighted.style.outlineOffset = highlightedOffset;
    highlighted = null;
  }

  function onPickMove(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || isTscUi(el)) return;
    setHighlight(el, false);
  }

  function onPickClick(event) {
    if (isTscUi(event.target)) return; /* let the pill and cards work */

    event.preventDefault();
    event.stopPropagation();

    /* Prefer the element under the pointer for mouse clicks, but fall back to
       the event target when there are no coordinates (keyboard / synthetic
       clicks report 0,0, which would otherwise hit the wrong element). */
    let el = event.target;
    if (event.clientX || event.clientY) el = document.elementFromPoint(event.clientX, event.clientY) || el;
    if (isTscUi(el)) return;

    /* clicking a device (anywhere on its card) hides the whole device, so it
       also drops out of the online/offline totals */
    const device = deviceRowFor(el);
    if (device) hideDevice(device);
    else hideElement(el);
    setPick(false);
  }

  /* Keep the keyboard cursor on whatever the user tabs to. */
  function onPickFocus(event) {
    if (!pickArmed) return;
    const el = event.target;
    if (!el || isTscUi(el)) return;
    const row = deviceRowFor(el);
    if (row) pickFocus = row;
    else if (el !== document.body) pickFocus = el;
    setHighlight(pickFocus, false);
  }

  function onPickKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setPick(false);
      return;
    }
    if (!pickArmed) return;

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activatePickFocus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      movePickFocus(forward ? 1 : -1);
    }
  }

  /* Enter hides the element the keyboard cursor (or focus) sits on. */
  function activatePickFocus() {
    const target = pickFocus && pickFocus.isConnected ? pickFocus : document.activeElement;
    if (!target || target === document.body || isTscUi(target)) return;
    const row = deviceRowFor(target);
    if (row) hideDevice(row);
    else hideElement(target);
    setPick(false);
  }

  function movePickFocus(delta) {
    const rows = pickableRows();
    if (!rows.length) return;
    let index = rows.indexOf(pickFocus);
    if (index === -1) index = delta > 0 ? -1 : 0;
    index = (index + delta + rows.length) % rows.length;
    pickFocus = rows[index];
    setHighlight(pickFocus, true);
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

  /* -------------------------------------------------- keyboard shortcuts */

  /* Never hijack keys while the user is typing in the console's own fields. */
  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
  }

  function onGlobalKey(event) {
    /* Cmd/Ctrl+Z undoes the last hide (leave the browser's undo alone when we
       have nothing to put back). */
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
      if (undoStack.length && !isTypingTarget(event.target)) {
        event.preventDefault();
        undoLast();
      }
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      if (settingsOpen) {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (helpOpen) {
        event.preventDefault();
        helpOpen = false;
        syncHelp();
        return;
      }
      return; /* the picker and the tour handle their own Escape */
    }

    if (!onMachinesPage() || tour || settingsOpen) return;
    if (isTypingTarget(event.target)) return;

    switch (event.key) {
      case "g":
        event.preventDefault();
        toggleView();
        break;
      case "h":
        event.preventDefault();
        setPick(!pickArmed);
        break;
      case "r":
        event.preventDefault();
        resetHidden();
        break;
      case "p":
        event.preventDefault();
        setPillHidden(!settings.pillHidden);
        break;
    }
  }

  /* -------------------------------------------------- sweep + observers */

  function sweep() {
    applyHidden();
    watchPageSearch();

    const table = onMachinesPage() ? findMachinesTable() : null;
    if (table) {
      pruneHiddenDevices(table);
      applyHiddenDevices(table);
    }

    const grid = applyGrid();
    applyDensity();
    applyHideOffline();
    if (onMachinesPage()) {
      if (grid) {
        ensureToolbar(table);
        markTable();
      } else {
        removeToolbar();
        if (table) updateMachineCount(table);
      }
      ensurePill();
    } else {
      removeToolbar();
      removePill();
      removeHint();
      if (tour) endTour();
      closeSettings();
      removeToast();
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

  document.addEventListener("keydown", onGlobalKey, true);
  document.addEventListener("click", onInjectedClick, true);
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
