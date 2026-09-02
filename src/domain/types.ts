export type AuthScheme = "basic" | "bearer"

export type ServiceCredentials = {
  baseUrl: string
  email: string
  pat: string
  authScheme: AuthScheme
  connectedAt?: string
}

export type StoredCredentials = {
  version: 1
  remember: boolean
  jira: ServiceCredentials
  confluence: ServiceCredentials
}

export type TestSuite = {
  id?: string
  name: string
  description?: string
  projectKey?: string
  jiraIssueKey?: string
  createdAt: number
  updatedAt: number
}

export type TestStep = {
  id?: string
  suiteId: string
  position: number
  action: string
  testData?: string
  expectedResult: string
  status: "not-run" | "passed" | "failed" | "blocked"
}

export type CanvasAnnotation = {
  id: string
  type: "arrow" | "rectangle" | "ellipse" | "line" | "freehand" | "text" | "blur"
  points?: Array<{ x: number; y: number }>
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color?: string
  strokeWidth?: number
  filled?: boolean
  fontSize?: number
  blurRadius?: number
}

export type Screenshot = {
  id?: string
  suiteId?: string
  stepId?: string
  originalBlob: Blob
  editedBlob?: Blob
  mimeType: string
  filename?: string
  source: "upload" | "paste" | "screen-capture"
  annotations: CanvasAnnotation[]
  width: number
  height: number
  position: number
  createdAt: number
  updatedAt: number
}

export type Preferences = {
  version: 1
  theme: "light" | "dark" | "system"
  defaultImageFormat: "png" | "jpeg" | "webp"
  jpegQuality: number
  retentionDays: 7 | 30 | 90 | null
}
