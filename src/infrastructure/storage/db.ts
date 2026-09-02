import Dexie, { type EntityTable } from "dexie"
import type { Screenshot, TestStep, TestSuite } from "@/domain/types"

export const db = new Dexie("sit-web-generator") as Dexie & {
  suites: EntityTable<TestSuite, "id">
  steps: EntityTable<TestStep, "id">
  screenshots: EntityTable<Screenshot, "id">
}

db.version(1).stores({
  suites: "id, name, projectKey, jiraIssueKey, updatedAt",
  steps: "id, suiteId, [suiteId+position], status",
  screenshots: "id, suiteId, stepId, [suiteId+position], createdAt, updatedAt",
})

export async function seedWorkspace() {
  if ((await db.suites.count()) > 0) return
  const now = Date.now()
  const suiteId = crypto.randomUUID()
  await db.transaction("rw", db.suites, db.steps, async () => {
    await db.suites.add({
      id: suiteId,
      name: "Checkout flow",
      description: "Smoke coverage for the customer checkout journey.",
      projectKey: "SIT",
      createdAt: now,
      updatedAt: now,
    })
    await db.steps.bulkAdd([
      { id: crypto.randomUUID(), suiteId, position: 0, action: "Open the storefront", expectedResult: "The home page is displayed", status: "passed" },
      { id: crypto.randomUUID(), suiteId, position: 1, action: "Add an item to the cart", expectedResult: "The cart badge increments", status: "not-run" },
    ])
  })
}

export async function clearWorkspace() {
  await db.transaction("rw", db.suites, db.steps, db.screenshots, async () => {
    await Promise.all([db.suites.clear(), db.steps.clear(), db.screenshots.clear()])
  })
}
