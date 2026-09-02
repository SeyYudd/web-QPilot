import type { ServiceCredentials } from "@/domain/types"

type Service = "jira" | "confluence"

function authHeader(credentials: ServiceCredentials) {
  if (credentials.authScheme === "bearer") return `Bearer ${credentials.pat}`
  const bytes = new TextEncoder().encode(`${credentials.email}:${credentials.pat}`)
  let binary = ""
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `Basic ${btoa(binary)}`
}

function root(credentials: ServiceCredentials) {
  return credentials.baseUrl.trim().replace(/\/$/, "")
}

async function request<T>(service: Service, credentials: ServiceCredentials, path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`${root(credentials)}${path}`, {
      ...init,
      credentials: "omit",
      headers: {
        Accept: "application/json",
        Authorization: authHeader(credentials),
        ...init.headers,
      },
    })
    if (!response.ok) throw new Error(`${service} request failed (${response.status}).`)
    return response.status === 204 ? {} as T : await response.json() as T
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`Unable to reach ${service}. Check HTTPS and CORS settings.`, { cause: error })
    throw error
  }
}

export function testConnection(service: Service, credentials: ServiceCredentials) {
  return request<{ displayName?: string; display_name?: string }>(service, credentials, service === "jira" ? "/rest/api/3/myself" : "/wiki/rest/api/user/current")
}

export function searchJira(credentials: ServiceCredentials, query: string) {
  return request<{ issues?: Array<{ key: string; fields?: { summary?: string; status?: { name?: string } } }> }>("jira", credentials, `/rest/api/3/search/jql?jql=${encodeURIComponent(query)}&maxResults=10`)
}

export function updateJiraStatus(credentials: ServiceCredentials, issueKey: string, status: string) {
  return request("jira", credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, { method: "PUT", body: JSON.stringify({ fields: { labels: [status.toLowerCase()] } }), headers: { "Content-Type": "application/json" } })
}

export function uploadJiraAttachment(credentials: ServiceCredentials, issueKey: string, blob: Blob, filename: string) {
  const form = new FormData()
  form.append("file", blob, filename)
  return request("jira", credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`, { method: "POST", body: form, headers: { "X-Atlassian-Token": "no-check" } })
}

export function searchConfluencePages(credentials: ServiceCredentials, title: string) {
  return request<{ results?: Array<{ id: string; title: string }> }>("confluence", credentials, `/wiki/api/v2/pages?title=${encodeURIComponent(title)}`)
}

export function createConfluencePage(credentials: ServiceCredentials, spaceId: string, title: string, body: string) {
  return request("confluence", credentials, "/wiki/api/v2/pages", { method: "POST", body: JSON.stringify({ spaceId, status: "current", title, body: { representation: "storage", value: body } }), headers: { "Content-Type": "application/json" } })
}
