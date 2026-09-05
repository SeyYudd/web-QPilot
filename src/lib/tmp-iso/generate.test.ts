// Test generate: 2 fase + partial failure handling (FR-7.4.2/6).
import { describe, expect, it } from "vitest";
import { generateTmpIsoTree, type TmpIsoApi } from "./generate";
import type { TmpIsoProjectConfig } from "./types";

const config: TmpIsoProjectConfig = {
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
  linkJiraBug: "https://jira.bri.co.id/browse/PRJ-BUG",
  linkMigDev: "https://confluence.bri.co.id/mig",
};

const templatePages = [
  { id: "100", title: "<YYYYMMDD> - <idProject> - [TEMPLATE] <Project Name>", parentTemplateId: undefined, version: 1, body: "<p>{{LINKJiraProject}}</p>" },
  { id: "101", title: "01. SIT For <idProject>", parentTemplateId: "100", version: 1, body: "<p>{{LINKJIRASIT}}</p>" },
  { id: "102", title: "1.2 Bug List", parentTemplateId: "101", version: 1, body: "<p>{{LINKJiraBug}}</p>" },
  { id: "103", title: "05. Automation & Performance Assessment", parentTemplateId: "100", version: 1, body: "<p>Kosong</p>" },
];

function makeApi(overrides: Partial<TmpIsoApi> = {}): TmpIsoApi & { created: Array<{ title: string; body: string; parentPageId?: string }>; updated: Array<{ pageId: string; body: string; version: number }> } {
  const api: TmpIsoApi & { created: Array<{ title: string; body: string; parentPageId?: string }>; updated: Array<{ pageId: string; body: string; version: number }> } = {
    created: [] as Array<{ title: string; body: string; parentPageId?: string }>,
    updated: [] as Array<{ pageId: string; body: string; version: number }>,
    async getPage(pageId: string) {
      const page = templatePages.find((item) => item.id === pageId);
      if (!page) throw new Error(`HTTP 404: ${pageId}`);
      return { id: page.id, title: page.title, version: page.version, body: page.body };
    },
    async getChildren(pageId: string) {
      return templatePages.filter((item) => item.parentTemplateId === pageId).map(({ id, title, version, body }) => ({ id, title, version, body }));
    },
    async createPage(input) {
      if (input.title.includes("1.2")) throw new Error("HTTP 500: gagal buat Bug List");
      api.created.push({ title: input.title, body: input.body, parentPageId: input.parentPageId });
      return { id: String(900 + api.created.length) };
    },
    async updatePage(input) {
      if (input.pageId === "902") throw new Error("HTTP 412: gagal update");
      api.updated.push({ pageId: input.pageId, body: input.body, version: input.version });
    },
    async findByTitle() {
      return [];
    },
    ...overrides,
  };
  return api;
}

describe("generateTmpIsoTree", () => {
  it("fase copy menyalin body mentah dan fase fill mengganti placeholder", async () => {
    const api = makeApi();
    const result = await generateTmpIsoTree(config, api, "https://confluence.bri.co.id");
    // Copy: body masih mentah (tag belum diganti) & title sudah disubstitusi.
    const root = api.created.find((page) => page.title.startsWith("20260904 - PRJ123"));
    expect(root?.body).toBe("<p>{{LINKJiraProject}}</p>");
    // Fill: PUT per page mengganti tag.
    expect(api.updated.some((page) => page.body.includes("https://jira.bri.co.id/browse/PRJ"))).toBe(true);
    // Manual page tidak di-PUT.
    expect(api.updated.find((page) => page.pageId === result.pages.find((p) => p.key === "05")?.pageId)).toBeUndefined();
  });

  it("kegagalan copy dilaporkan per page dan tidak menghentikan page lain", async () => {
    const api = makeApi();
    const result = await generateTmpIsoTree(config, api, "https://confluence.bri.co.id");
    const failed = result.results.find((page) => page.key === "1.2");
    expect(failed?.status).toBe("failed");
    expect(failed?.phase).toBe("copy");
    expect(result.copyFailures).toHaveLength(1);
    // 1.1 / 05 tetap dibuat meski 1.2 gagal (tidak rollback).
    expect(api.created.length).toBe(3);
  });

  it("kegagalan fill dilaporkan per page tanpa rollback page sukses", async () => {
    const api = makeApi();
    const result = await generateTmpIsoTree(config, api, "https://confluence.bri.co.id");
    // Page 902 = node kedua yang dibuat (01. SIT) gagal di updatePage.
    const fillResults = result.results.filter((page) => page.phase === "fill");
    expect(fillResults.find((page) => page.status === "failed")?.key).toBe("01");
    expect(fillResults.filter((page) => page.status === "success").length).toBeGreaterThan(0);
  });

  it("1.2 Bug List tidak dibuat bila link bug kosong", async () => {
    const api = makeApi();
    await generateTmpIsoTree({ ...config, linkJiraBug: "" }, api, "https://confluence.bri.co.id");
    expect(api.created.some((page) => page.title.includes("1.2 Bug List"))).toBe(false);
  });
});
