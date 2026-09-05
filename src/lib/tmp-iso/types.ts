// lib/tmp-iso/types.ts — Kontrak Create TMP/ISO (srs-automation-tmp.md 4.3 & FR-7).

export type TmpIsoProjectConfig = {
  idProject: string;
  projectName: string;
  onboardingDate: string; // YYYYMMDD
  /** Field operasional (di luar 13 field 4.3): copy phase butuh lokasi template & space target. */
  templateRootPageId: string;
  targetSpaceKey: string;
  linkJiraProject: string; // {{LINKJiraProject}}
  linkBrd: string; // {{LINKBRD}}
  linkSystemDesignDev: string; // {{LINKSytemDesign}} + sumber copy-content 4 halaman SOP
  linkNcm: string; // {{LinkNCM}}
  linkJiraUqa: string; // {{LINKJiraUQA}}
  linkJiraDast: string; // {{LINKJiraDAST}}
  linkConfluenceDast: string; // {{LINKConfluenceDAST}}
  linkJiraSitTe: string; // {{LINKJIRASIT}} + auto-link 1.1 Evidence
  linkJiraUatTe: string; // {{LINKJIRAUAT}} + auto-link 02-01 BAA & UAT Summary
  linkJiraBug?: string; // opsional — tanpa ini 1.2 Bug List tidak dibuat
  linkMigDev: string; // {{COPYCONTENTMIG}}
};

/** Key node pada master page tree (srs-automation-tmp.md 7.1). */
export type NodeKey =
  | "root"
  | "01"
  | "1.1"
  | "1.2"
  | "02"
  | "02-01"
  | "02-02"
  | "02-03"
  | "03"
  | "03-01"
  | "03-02"
  | "03-02-01"
  | "03-02-02"
  | "03-02-03"
  | "03-02-04"
  | "03-03"
  | "04"
  | "04-01"
  | "05";

export type PageResultStatus = "success" | "failed" | "blocked" | "unfilled";

export type PageResult = {
  key: NodeKey | string;
  title: string;
  status: PageResultStatus;
  /** Fase saat page ini diproses: "copy" atau "fill". */
  phase: "copy" | "fill";
  pageId?: string;
  error?: string;
  /** Tag yang terisi / terblokir / tidak dikenal (khusus fill phase). */
  filled?: string[];
  blocked?: string[];
  unknown?: string[];
};

export type TmpIsoPage = {
  id: string;
  title: string;
  version: number;
  body: string;
};
