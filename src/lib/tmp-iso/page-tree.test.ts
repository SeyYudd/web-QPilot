// Test page-tree: substitusi title & tree kondisional (srs-automation-tmp.md 7.1/7.2).
import { describe, expect, it } from "vitest";
import { buildPageTree, nodeKeyForTitle, substituteTitle } from "./page-tree";
import type { TmpIsoProjectConfig } from "./types";

const baseConfig: TmpIsoProjectConfig = {
  idProject: "PRJ123",
  projectName: "Qris Baru",
  onboardingDate: "20260904",
  templateRootPageId: "100",
  targetSpaceKey: "DEV",
  linkJiraProject: "https://jira.bri.co.id/browse/PRJ",
  linkBrd: "https://confluence.bri.co.id/brd",
  linkSystemDesignDev: "https://confluence.bri.co.id/sd",
  linkNcm: "https://ncm.bri.co.id",
  linkJiraUqa: "https://jira.bri.co.id/uqa",
  linkJiraDast: "https://jira.bri.co.id/dast",
  linkConfluenceDast: "https://confluence.bri.co.id/dast",
  linkJiraSitTe: "https://jira.bri.co.id/browse/PRJ-SIT",
  linkJiraUatTe: "https://jira.bri.co.id/browse/PRJ-UAT",
  linkMigDev: "https://confluence.bri.co.id/mig",
};

describe("substituteTitle", () => {
  it("mengganti semua token config ke dalam title", () => {
    expect(substituteTitle("<YYYYMMDD> - <idProject> - [TEMPLATE] <Project Name>", baseConfig)).toBe(
      "20260904 - PRJ123 - [TEMPLATE] Qris Baru",
    );
  });

  it("mengganti token idProject pada title anak", () => {
    expect(substituteTitle("01. SIT For <idProject>", baseConfig)).toBe("01. SIT For PRJ123");
  });
});

describe("buildPageTree", () => {
  it("memasukkan 1.2 Bug List bila linkJiraBug terisi", () => {
    const tree = buildPageTree({ ...baseConfig, linkJiraBug: "https://jira.bri.co.id/browse/PRJ-BUG" });
    expect(tree.map((node) => node.key)).toContain("1.2");
  });

  it("mengeluarkan 1.2 Bug List bila linkJiraBug kosong (FR-7.4.3)", () => {
    const tree = buildPageTree(baseConfig);
    expect(tree.map((node) => node.key)).not.toContain("1.2");
    expect(tree.map((node) => node.key)).toContain("1.1");
  });
});

describe("nodeKeyForTitle", () => {
  it("memetakan title template ke key tree", () => {
    expect(nodeKeyForTitle("01. SIT For <idProject>")).toBe("01");
    expect(nodeKeyForTitle("<YYYYMMDD> - <idProject> - [TEMPLATE] <Project Name>")).toBe("root");
    expect(nodeKeyForTitle("Halaman Tidak Dikenal")).toBeNull();
  });
});
