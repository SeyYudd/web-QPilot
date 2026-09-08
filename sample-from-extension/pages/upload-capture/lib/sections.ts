// Logic bisnis Upload Capture: konversi gambar, parsing scenario, dan manipulasi Expand Section di Confluence.
import { requestApi } from "../../../lib/api-request";

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: header.match(/data:([^;]+)/)?.[1] || "image/png" });
}

// Parse struktur Scenario (root expand) + Expand Section (inner expand) dari storage HTML Confluence.
export function parseScenarios(storageValue: string) {
  const doc = new DOMParser().parseFromString(
    storageValue,
    "text/html",
  );
      const roots = [...doc.querySelectorAll("ac\\:structured-macro")]
        .filter(
          (node) =>
            (node.getAttribute("ac:name") || "").toLowerCase() === "expand",
        )
        .filter(
          (node) => !node.parentElement?.closest("ac\\:structured-macro"),
        );
      const found = roots.map((node, scenarioIndex) => {
        const title =
          node
            .querySelector("ac\\:parameter[ac\\:name='title']")
            ?.textContent?.trim() || `Scenario ${scenarioIndex + 1}`;
        const scenarioId = (
          title.match(/\bTC\d+\b/i)?.[0] || `SCENARIO-${scenarioIndex + 1}`
        ).toUpperCase();
        const inner = [
          ...node.querySelectorAll("ac\\:rich-text-body ac\\:structured-macro"),
        ]
          .filter(
            (child) =>
              (child.getAttribute("ac:name") || "").toLowerCase() === "expand",
          )
          .map((child, index) => ({
            id: `remote-${scenarioIndex}-${index}`,
            title:
              child
                .querySelector("ac\\:parameter[ac\\:name='title']")
                ?.textContent?.trim() || `Screen Capture ${index + 1}`,
          }));
        return {
          scenarioId,
          scenarioTitle: title,
          scenarioIndex: scenarioIndex + 1,
          expandSections: inner.length
            ? inner
            : [{ id: `remote-${scenarioIndex}-main`, title: "Screen Capture" }],
        };
      });
  return found;
}

// Tambah / edit / hapus Expand Section di dalam Expand scenario di halaman Confluence.
export async function updateConfluenceExpand(
  base: string,
  pageId: string,
  scenarioId: string,
  action: "add" | "edit" | "delete",
  title: string,
  nextTitle = "",
) {
    const page = await requestApi(
      `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}?expand=body.storage,version`,
    );
    const doc = new DOMParser().parseFromString(
      page.body?.storage?.value || "",
      "text/html",
    );
    const roots = [...doc.querySelectorAll("ac\\:structured-macro")]
      .filter(
        (node) =>
          (node.getAttribute("ac:name") || "").toLowerCase() === "expand",
      )
      .filter((node) => !node.parentElement?.closest("ac\\:structured-macro"));
    const root = roots.find((node) =>
      (
        node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent ||
        ""
      ).includes(scenarioId),
    );
    if (!root) throw new Error("Scenario tidak ditemukan di Confluence.");
    const body = root.querySelector("ac\\:rich-text-body") || root;
    const target = [...body.querySelectorAll("ac\\:structured-macro")].find(
      (node) =>
        (node.getAttribute("ac:name") || "").toLowerCase() === "expand" &&
        (node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent ||
          "") === title,
    );
    const newExpand = `<ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">${window.QPilotSitTemplateBuilder?.escapeHtml?.(nextTitle) || nextTitle}</ac:parameter><ac:rich-text-body><p>Untuk Evidence...</p></ac:rich-text-body></ac:structured-macro>`;
    if (action === "add") {
      const insertAfter = target || body.querySelector("ac\\:structured-macro");
      if (insertAfter) insertAfter.insertAdjacentHTML("afterend", newExpand);
      else body.insertAdjacentHTML("beforeend", newExpand);
    }
    if (action === "edit" && target)
      target.querySelector("ac\\:parameter[ac\\:name='title']")!.textContent =
        nextTitle;
    if (action === "delete" && target) target.remove();
    if (action !== "add" && !target)
      throw new Error("Expand Section tidak ditemukan di Confluence.");
    const value = doc.body.innerHTML.replace(
      /<(br|hr|img|input|meta|link|col|source)(\s[^>]*)?>/gi,
      (tag, name, attrs = "") =>
        /\/\s*>$/.test(tag) ? tag : `<${name}${attrs} />`,
    );
    await requestApi(
      `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page",
          title: page.title,
          version: { number: (page.version?.number || 1) + 1 },
          body: { storage: { value, representation: "storage" } },
        }),
      },
    );
}
