/* Progressive enhancement: every public route and filter also works with GET forms. */
(() => {
  "use strict";
  if (window.matchMedia("(max-width:760px)").matches)
    for (const details of document.querySelectorAll(".diagram-text"))
      details.open = true;
  const form = document.querySelector("#explorer");
  const cards = Array.from(document.querySelectorAll("[data-project]"));
  function applyFilters(updateUrl) {
    if (!form) return;
    const state = new URLSearchParams(new FormData(form));
    for (const [key, value] of Array.from(state))
      if (!value.trim()) state.delete(key);
    const words = (state.get("q") || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    let count = 0;
    cards.forEach((card) => {
      const d = card.dataset;
      const status = state.get("status");
      const matches =
        words.every((word) => d.search.includes(word)) &&
        (!state.get("domain") || d.domain === state.get("domain")) &&
        (!status ||
          (status === "active"
            ? ["EVOLVING", "IN PROGRESS"].includes(d.status)
            : status === d.status)) &&
        (!state.get("kind") || d.kind === state.get("kind")) &&
        (!state.get("technology") ||
          JSON.parse(d.technologies).includes(
            state.get("technology").toLowerCase(),
          )) &&
        (!state.get("year") ||
          (d.start &&
            +state.get("year") >= +d.start &&
            +state.get("year") <= +d.end));
      card.hidden = !matches;
      if (matches) count++;
    });
    document.querySelector("#result-count").textContent =
      `${count} of ${cards.length} records`;
    document.querySelector("#empty-results").hidden = count > 0;
    if (updateUrl)
      history.replaceState(
        null,
        "",
        `${location.pathname}${state.size ? "?" + state : ""}`,
      );
  }
  if (form) {
    document.documentElement.classList.add("enhanced");
    let timer;
    form.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFilters(true), 80);
    });
    form.addEventListener("change", () => applyFilters(true));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      applyFilters(true);
    });
    document
      .querySelector("#clear-filters")
      .addEventListener("click", (event) => {
        event.preventDefault();
        for (const control of form.querySelectorAll("input,select"))
          control.value = "";
        applyFilters(true);
        form.querySelector("input").focus();
      });
    window.addEventListener("popstate", () => {
      const state = new URLSearchParams(location.search);
      for (const control of form.querySelectorAll("input,select"))
        control.value = state.get(control.name) || "";
      applyFilters(false);
    });
  }
  for (const node of document.querySelectorAll("[data-node]")) {
    const highlight = (active) => {
      for (const edge of document.querySelectorAll(".lineage-edge"))
        edge.classList.toggle(
          "highlighted",
          active &&
            (edge.dataset.from === node.dataset.node ||
              edge.dataset.to === node.dataset.node),
        );
    };
    node.addEventListener("mouseenter", () => highlight(true));
    node.addEventListener("mouseleave", () => highlight(false));
    node.addEventListener("focus", () => highlight(true));
    node.addEventListener("blur", () => highlight(false));
  }

  if (form && document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const results = () =>
      cards
        .filter((c) => !c.hidden)
        .map((c) => ({
          slug: c.dataset.project,
          title: c.querySelector("h2 a").textContent.trim(),
          domain: c.dataset.domain,
          status: c.dataset.status,
          url: c.querySelector("h2 a").getAttribute("href"),
        }));
    const properties = Object.fromEntries(
      ["q", "domain", "status", "technology", "year", "kind"].map((name) => [
        name,
        {
          type: "string",
          ...(name === "q"
            ? { maxLength: 200 }
            : {
                enum: [...form.elements.namedItem(name).options].map(
                  (o) => o.value,
                ),
              }),
        },
      ]),
    );
    const definitions = [
      {
        name: "read_project_results",
        description:
          "Read the published project results currently visible in the archive.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw new Error("Expected an empty object.");
          return { projects: results() };
        },
      },
      {
        name: "set_project_filters",
        description:
          "Replace visible archive filters and update the shareable URL. Does not change project content.",
        inputSchema: {
          type: "object",
          properties,
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input))
            throw new Error("Expected filters.");
          for (const [name, value] of Object.entries(input)) {
            if (
              !Object.hasOwn(properties, name) ||
              typeof value !== "string" ||
              value.length > 200 ||
              (name !== "q" && !properties[name].enum.includes(value))
            )
              throw new Error("Invalid filter.");
          }
          for (const name of Object.keys(properties))
            form.elements.namedItem(name).value = input[name] || "";
          applyFilters(true);
          return {
            projects: results(),
            url: location.pathname + location.search,
          };
        },
      },
    ];
    for (const tool of definitions) {
      try {
        Promise.resolve(
          document.modelContext.registerTool(tool, {
            signal: lifecycle.signal,
          }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    window.addEventListener("pagehide", () => lifecycle.abort(), {
      once: true,
    });
  }
})();
