// Test fill-rules: dispatch per jenis placeholder (srs-automation-tmp.md 7.3).
import { describe, expect, it, vi } from "vitest";
import { fillForNode, JIRA_MACRO_TAGS } from "./fill-rules";
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

const ctx = (overrides: Partial<Parameters<typeof fillForNode>[2]> = {}) => ({
  config,
  pages: new Map([["01", { id: "901", title: "01. SIT For PRJ123" }]]),
  confluenceBase: "https://confluence.bri.co.id",
  fetchPageBody: vi.fn(async () => "<p>MIG content</p>"),
  ...overrides,
});

describe("fillForNode", () => {
  it("Link: mengganti tag link dengan anchor dari config", async () => {
    const outcome = await fillForNode("root", "<p>{{LINKJiraProject}}</p>", ctx());
    expect(outcome?.filled).toContain("{{LINKJiraProject}}");
    expect(outcome?.body).toContain('<a href="https://jira.bri.co.id/browse/PRJ">');
  });

  it("LinkTitle: self-reference ke page hasil generate pada run yang sama", async () => {
    const outcome = await fillForNode("01", "<p>{{LINKTITLEConfluenceSIT}}</p>", ctx());
    expect(outcome?.body).toContain("pageId=901");
    expect(outcome?.body).toContain("01. SIT For PRJ123");
  });

  it("Copy content: fetch body sumber dan menempel verbatim", async () => {
    const fetchPageBody = vi.fn(async () => "<p>SOP penuh</p>");
    const outcome = await fillForNode("03-02-01", "<p>{{COPYCONTENTSOPDEPLOYMENT}}</p>", ctx({ fetchPageBody }));
    expect(fetchPageBody).toHaveBeenCalledTimes(1);
    expect(outcome?.body).toBe("<p><p>SOP penuh</p></p>");
  });

  it("Copy content SOP: tiap halaman fetch sendiri walau sumber sama (FR-7.4.4)", async () => {
    const fetchPageBody = vi.fn(async () => "<p>SOP penuh</p>");
    await fillForNode("03-02-01", "<p>{{COPYCONTENTSOPDEPLOYMENT}}</p>", ctx({ fetchPageBody }));
    await fillForNode("03-02-02", "<p>{{COPYCONTENTSOPMAINTENANCE}}</p>", ctx({ fetchPageBody }));
    expect(fetchPageBody).toHaveBeenCalledTimes(2);
  });

  it("Jira macro: status blocked, JQL open item tidak ditebak (FR-7.4.8)", async () => {
    const tag = Object.keys(JIRA_MACRO_TAGS)[0];
    const outcome = await fillForNode("root", `<p>${tag}</p>`, ctx());
    expect(outcome?.blocked).toContain(tag);
    expect(outcome?.filled).toHaveLength(0);
    expect(outcome?.body).toContain(tag); // tag dibiarkan mentah
  });

  it("Tag tidak dikenal dilaporkan unknown dan dibiarkan mentah", async () => {
    const outcome = await fillForNode("05", "<p>{{TAGMANUAL}}</p>", ctx());
    expect(outcome?.unknown).toContain("{{TAGMANUAL}}");
    expect(outcome?.body).toContain("{{TAGMANUAL}}");
  });

  it("Body tanpa placeholder mengembalikan null (manual page, FR-7.4.5)", async () => {
    expect(await fillForNode("03-01", "<p>Kosong</p>", ctx())).toBeNull();
  });

  it("Auto-link 1.2 Bug List memakai linkJiraBug", async () => {
    const outcome = await fillForNode("1.2", "<p>{{LINKJiraBug}}</p>", ctx());
    expect(outcome?.body).toContain("https://jira.bri.co.id/browse/PRJ-BUG");
  });
});
