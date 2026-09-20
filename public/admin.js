(() => {
  "use strict";
  const editor = document.querySelector("#project-editor");
  const message = document.querySelector("#editor-message");
  let dirty = false,
    busy = false;
  let csrfToken =
    editor?.dataset.csrf ||
    document.querySelector("[data-csrf]")?.dataset.csrf ||
    "";
  let csrfRefreshed = Date.now();
  async function csrf() {
    if (Date.now() - csrfRefreshed > 60 * 60 * 1000) {
      const response = await fetch("/api/admin/csrf", {
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "Your sign-in needs attention. Keep this page open and sign in through Owner access in another tab, then retry.",
        );
      const data = await response.json();
      if (typeof data.token !== "string")
        throw new Error(
          "The editing token could not be renewed. Your input is still here.",
        );
      csrfToken = data.token;
      csrfRefreshed = Date.now();
    }
    return csrfToken;
  }
  function notice(text, kind = "error") {
    if (!message) return;
    message.textContent = text;
    message.className = `notice ${kind}`;
    message.hidden = false;
    message.scrollIntoView({ behavior: "auto", block: "nearest" });
  }
  async function request(path, body, options = {}) {
    const response = await fetch(path, {
      method: options.method || "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": await csrf(),
        ...options.headers,
      },
      body: body instanceof Blob ? body : JSON.stringify(body),
    });
    const data = await response
      .json()
      .catch(() => ({
        error:
          "The server returned an unexpected response. Your input is still here.",
      }));
    if (!response.ok)
      throw new Error(data.error || "The request could not be completed.");
    return data;
  }
  function changed() {
    dirty = true;
    const status = document.querySelector("#save-status");
    if (status) status.textContent = "Unsaved changes";
  }
  function rows(name) {
    return [...editor.querySelector(`[data-list="${name}"]`).children].map(
      (row) =>
        Object.fromEntries(
          [...row.querySelectorAll("[data-field]")].map((el) => [
            el.dataset.field,
            el.value,
          ]),
        ),
    );
  }
  function projectInput() {
    const value = (name) =>
      editor.querySelector(`[name="${name}"]`).value.trim();
    return {
      slug: value("slug"),
      title: value("title"),
      subtitle: value("subtitle"),
      summary: value("summary"),
      status: value("status"),
      domain: value("domain"),
      kind: value("kind"),
      timeframe: value("timeframe"),
      startYear: value("startYear") ? Number(value("startYear")) : null,
      endYear: value("endYear") ? Number(value("endYear")) : null,
      featured: editor.querySelector('[name="featured"]').checked,
      sortOrder: Number(value("sortOrder")),
      nextIteration: value("nextIteration"),
      privateNotes: editor.querySelector('[name="privateNotes"]').value,
      technologies: value("technologies")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sections: rows("sections"),
      updates: rows("updates"),
      links: rows("links"),
      relationships: rows("relationships"),
      architecture: {
        nodes: rows("nodes").map((n) => ({ ...n, column: Number(n.column) })),
        edges: rows("edges"),
      },
      media: rows("media"),
    };
  }
  function addRow(name) {
    const template = document.querySelector(`#template-${name}`);
    const list = document.querySelector(`[data-list="${name}"]`);
    list.append(template.content.cloneNode(true));
    changed();
    return list.lastElementChild;
  }
  if (editor) {
    editor.addEventListener("input", changed);
    editor.addEventListener("change", changed);
    editor.addEventListener("click", (event) => {
      const add = event.target.closest("[data-add]");
      if (add) {
        const row = addRow(add.dataset.add);
        row.querySelector("input,textarea,select")?.focus();
        return;
      }
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        const row = remove.closest(".repeat-row");
        if (
          [...row.querySelectorAll("input,textarea")].some((e) =>
            e.value.trim(),
          ) &&
          !window.confirm(
            "Remove this entry from the draft? Save the draft to keep the change.",
          )
        )
          return;
        row.remove();
        changed();
        return;
      }
      const move = event.target.closest("[data-move]");
      if (move) {
        const row = move.closest(".repeat-row");
        const other =
          move.dataset.move === "up"
            ? row.previousElementSibling
            : row.nextElementSibling;
        if (other) {
          if (move.dataset.move === "up") other.before(row);
          else other.after(row);
          changed();
          move.focus();
        }
      }
    });
    editor.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      const save = editor.querySelector('[type="submit"]');
      save.disabled = true;
      document.querySelector("#save-status").textContent = "Saving…";
      try {
        const id = editor.dataset.id;
        const result = await request(
          `/api/admin/projects${id ? "/" + id : ""}`,
          { version: Number(editor.dataset.version), project: projectInput() },
          { method: id ? "PUT" : "POST" },
        );
        dirty = false;
        editor.dataset.version = String(result.version);
        editor.dataset.slug = projectInput().slug;
        notice("Draft saved. The public version has not changed.", "success");
        document.querySelector("#save-status").textContent = "Draft saved";
        if (!id) location.assign(`/admin/projects/${result.id}`);
      } catch (error) {
        notice(error.message);
        document.querySelector("#save-status").textContent =
          "Not saved — your changes are still here";
      } finally {
        busy = false;
        save.disabled = false;
      }
    });
    document
      .querySelector("#preview-draft")
      ?.addEventListener("click", (event) => {
        if (dirty) {
          event.preventDefault();
          notice(
            "Save your draft first so the preview includes your latest changes.",
          );
        }
      });
    window.addEventListener("beforeunload", (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }
  for (const button of document.querySelectorAll("[data-command]"))
    button.addEventListener("click", async () => {
      if (busy || !editor) return;
      const action = button.dataset.command;
      if (dirty) {
        notice("Save your draft before changing its publication state.");
        return;
      }
      const confirmation = document.querySelector("#confirm-slug")?.value;
      if (action !== "publish" && confirmation !== editor.dataset.slug) {
        notice("Type the exact project slug to confirm this action.");
        return;
      }
      if (
        !window.confirm(
          action === "publish"
            ? "Publish the saved draft? It will replace the current public version."
            : action === "unpublish"
              ? "Remove this project and its images from public access?"
              : "Delete this unpublished project? It will be removed from the editor. A content backup is recommended first.",
        )
      )
        return;
      busy = true;
      button.disabled = true;
      try {
        await request(`/api/admin/projects/${editor.dataset.id}/${action}`, {
          version: Number(editor.dataset.version),
          ...(action === "publish" ? {} : { confirmation }),
        });
        dirty = false;
        location.assign(
          action === "delete"
            ? "/admin"
            : `/admin/projects/${editor.dataset.id}`,
        );
      } catch (error) {
        notice(error.message);
        busy = false;
        button.disabled = false;
      }
    });
  document
    .querySelector("#admin-search")
    ?.addEventListener("input", (event) => {
      const q = event.target.value.toLowerCase();
      for (const row of document.querySelectorAll("[data-admin-search]"))
        row.hidden = !row.dataset.adminSearch.includes(q);
    });

  async function normalizeImage(file) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    )
      throw new Error("Choose a PNG, JPEG or WebP image under 15 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      Math.sqrt(3000000 / (bitmap.width * bitmap.height)),
      2048 / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    let width = Math.max(1, Math.floor(bitmap.width * scale)),
      height = Math.max(1, Math.floor(bitmap.height * scale));
    try {
      for (let attempt = 0; attempt < 7; attempt++) {
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (blob && blob.size <= 5 * 1024 * 1024) return blob;
        width = Math.floor(width * 0.8);
        height = Math.floor(height * 0.8);
      }
    } finally {
      bitmap.close();
    }
    throw new Error(
      "The image is too large after conversion. Try a smaller image.",
    );
  }
  document
    .querySelector("#upload-image")
    ?.addEventListener("click", async (event) => {
      if (busy) return;
      const file = document.querySelector("#image-file").files[0];
      const alt = document.querySelector("#image-alt").value.trim();
      const status = document.querySelector("#upload-status");
      if (!file || !alt) {
        status.textContent = "Choose an image and describe it in the alt text.";
        return;
      }
      busy = true;
      event.target.disabled = true;
      status.textContent = "Preparing and uploading the image…";
      try {
        const png = await normalizeImage(file);
        const result = await request("/api/admin/media", png, {
          headers: {
            "Content-Type": "image/png",
            "X-Project-Id": editor.dataset.id,
            "X-Image-Alt": encodeURIComponent(alt),
          },
        });
        const option = document.createElement("option");
        option.value = result.id;
        option.textContent = alt;
        for (const select of editor.querySelectorAll(
          '[data-list="media"] select',
        ))
          select.append(option.cloneNode(true));
        document
          .querySelector("#template-media")
          .content.querySelector("select")
          .append(option);
        const row = addRow("media");
        row.querySelector('[data-field="id"]').value = result.id;
        row.querySelector('[data-field="alt"]').value = alt;
        document.querySelector("#image-file").value = "";
        document.querySelector("#image-alt").value = "";
        status.textContent =
          "Image uploaded and attached. Save the draft to keep this attachment.";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
        event.target.disabled = false;
      }
    });
  for (const button of document.querySelectorAll("[data-delete-media]"))
    button.addEventListener("click", async () => {
      if (
        !window.confirm(
          "Permanently delete this unused image? Images referenced by a saved revision cannot be deleted.",
        )
      )
        return;
      button.disabled = true;
      try {
        await request(
          `/api/admin/media/${button.dataset.deleteMedia}`,
          {},
          { method: "DELETE" },
        );
        button.closest(".media-admin-card").remove();
      } catch (error) {
        const status = document.querySelector("#media-message");
        status.textContent = error.message;
        status.className = "notice error";
        button.disabled = false;
      }
    });
})();
