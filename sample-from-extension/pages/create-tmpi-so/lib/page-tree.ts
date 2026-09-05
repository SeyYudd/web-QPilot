// lib/page-tree.ts — Master page tree (srs-automation-tmp.md 7.1) dan
// substitusi title dari Project Config (7.2). Murni fungsi, tanpa I/O.
import type { NodeKey, TmpIsoProjectConfig } from "./types";

export type TreeNode = {
  key: NodeKey;
  /** Title template persis seperti di master tree 7.1 (token belum disubstitusi). */
  templateTitle: string;
  parent: NodeKey | null;
  /** True kalau page punya fill rule di 7.3 (selain manual). */
  fillable: boolean;
};

/** Master tree 7.1. `1.2` bersifat kondisional (lihat buildPageTree). */
export const MASTER_TREE: TreeNode[] = [
  { key: "root", templateTitle: "<YYYYMMDD> - <idProject> - <Project Name>", parent: null, fillable: true },
  { key: "01", templateTitle: "01. SIT For <idProject>", parent: "root", fillable: true },
  { key: "1.1", templateTitle: "1.1 Evidence", parent: "01", fillable: true },
  { key: "1.2", templateTitle: "1.2 Bug List", parent: "01", fillable: true },
  { key: "02", templateTitle: "02. UAT For <idProject>", parent: "root", fillable: true },
  { key: "02-01", templateTitle: "02-01. BAA & UAT Summary", parent: "02", fillable: true },
  { key: "02-02", templateTitle: "02-02. DEP", parent: "02", fillable: true },
  { key: "02-03", templateTitle: "02-03. IT Control Checklist", parent: "02", fillable: true },
  { key: "03", templateTitle: "03. Deployment For <idProject>", parent: "root", fillable: true },
  { key: "03-01", templateTitle: "03-01. BADT & DT Summary", parent: "03", fillable: false },
  { key: "03-02", templateTitle: "03-02. SOP Deployment, Maintenance, Monitoring and Troubleshooting", parent: "03", fillable: false },
  { key: "03-02-01", templateTitle: "03-02-01. SOP Deployment", parent: "03-02", fillable: true },
  { key: "03-02-02", templateTitle: "03-02-02. SOP Maintenance", parent: "03-02", fillable: true },
  { key: "03-02-03", templateTitle: "03-02-03. SOP Monitoring", parent: "03-02", fillable: true },
  { key: "03-02-04", templateTitle: "03-02-04. SOP Troubleshooting", parent: "03-02", fillable: true },
  { key: "03-03", templateTitle: "03-03. SOP Verification & UAT Envi Readiness", parent: "03", fillable: false },
  { key: "04", templateTitle: "04. Pilot Test For <idProject>", parent: "root", fillable: false },
  { key: "04-01", templateTitle: "04-01. BAPT & PT Summary", parent: "04", fillable: false },
  { key: "05", templateTitle: "05. Automation & Performance Assessment", parent: "root", fillable: false },
];

/** Substitusi token di title template (real Confluence): `<...>` and `{{idproject}}` → nilai Project Config. */
export function substituteTitle(templateTitle: string, config: TmpIsoProjectConfig): string {
  return templateTitle
    .replaceAll("<YYYYMMDD>", config.onboardingDate)
    .replaceAll("<Tanggal-Masuk-QA>", config.onboardingDate)
    .replaceAll("<idProject>", config.idProject)
    .replaceAll(/{{idproject}}/gi, config.idProject)
    .replaceAll("<Project Name>", config.projectName);
}

export type TreeItem = { key: NodeKey; title: string; parent: NodeKey | null; fillable: boolean };

/**
 * Tree final untuk satu project config. `1.2 Bug List` hanya disertakan bila
 * `linkJiraBug` terisi (FR-7.4.3).
 */
export function buildPageTree(config: TmpIsoProjectConfig): TreeItem[] {
  return MASTER_TREE.filter((node) => node.key !== "1.2" || Boolean(config.linkJiraBug?.trim())).map((node) => ({
    key: node.key,
    title: substituteTitle(node.templateTitle, config),
    parent: node.parent,
    fillable: node.fillable,
  }));
}

/**
 * Petakan title halaman template (yang di-fetch dari Confluence) ke key tree.
 * Dicocokkan via prefix karena template asli bisa punya token yang sudah
 * terganti di master. Mengembalikan null bila title di luar master tree.
 */
export function nodeKeyForTitle(title: string): NodeKey | null {
  // Cocokkan via regex: literal di-escape, token `<...>` dijadikan wildcard.
  const match = MASTER_TREE.find((node) => {
    const pattern = node.templateTitle.replaceAll(/<[^>]+>/g, "\u0000").split("\u0000").map(escapeRegExp).join(".*");
    return new RegExp(`^${pattern}$`).test(title.trim());
  });
  return match ? match.key : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}