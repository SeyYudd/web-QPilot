import { emptyRow, text, type Row, type Step } from "./types";

// Template XLSX dengan 3 baris header (header utama, sub-header step, contoh).
export function downloadTemplate() {
  if (!window.XLSX) throw new Error("SheetJS belum tersedia.");
  const row1 = ["No", "Reuse Jira or Not?\n*fill this 2 field if want to reuse", "", "Project", "Test ID", "Summary", "Description", "Assignee", "Test Repository Path", "Expected Result", "Test Execution", "Issue Links", "Labels", "Test Details: Manual Test Steps", "", "", "", "", ""];
  const row2 = ["", "Reuse?", "Jira Exist", "", "", "", "", "", "", "", "", "", "", "Action", "Data", "Expected Result", "Action", "Data", "Expected Result"];
  const row3 = [1, "", "", "PROJ", "TC-001", "Maker melakukan Proceed", "", "01234567", "Test Repository/Project Contoh/Sub Project", "Berhasil melakukan Proceed.", "TESTEXEC-123", "", "", "1 Masuk kehalaman\n2 Isi filter\n3 Klik Button Search", "1. PN\n2. Password", "Berhasil melakukan Proceed.", "", "", ""];
  const sheet = window.XLSX.utils.aoa_to_sheet([row1, row2, row3]);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    ...[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((c) => ({ s: { r: 0, c }, e: { r: 1, c } })),
    { s: { r: 0, c: 13 }, e: { r: 0, c: 18 } },
  ];
  sheet["!cols"] = [{ wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 55 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
  const book = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(book, sheet, "Create Test");
  window.XLSX.writeFile(book, "Scenario - Jira test Repository.xlsx");
}

// Parse spreadsheet hasil download template menjadi baris-baris Row.
export async function parseXlsx(file: File): Promise<Row[]> {
  if (!window.XLSX) throw new Error("SheetJS belum tersedia.");
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  const main = (data[0] || []).map(text);
  const sub = (data[1] || []).map(text);
  return (data.slice(2) as unknown[][]).map((values, index) => {
    if (!values.some((value) => text(value))) return null;
    const get = (name: string) => text(values[main.findIndex((header) => header.toLowerCase() === name.toLowerCase())]);
    const row = emptyRow(index + 1);
    Object.assign(row, { reuse: /^(true|yes)$/i.test(get("Reuse?")), jiraExist: get("Jira Exist"), project: get("Project").toUpperCase(), testId: get("Test ID"), summary: get("Summary"), description: get("Description"), assignee: get("Assignee"), repository: get("Test Repository Path"), expectedResult: get("Expected Result"), testExecution: get("Test Execution"), issueLinks: get("Issue Links"), labels: get("Labels") });
    const stepColumns = sub.map((name, column) => ({ name: name.toLowerCase(), column })).filter((item) => /action|data|expected/.test(item.name));
    const groups = new Map<number, Step>();
    let lastStepNo = 0;
    stepColumns.forEach(({ name, column }) => {
      let stepNo = lastStepNo;
      if (name.includes("action")) { stepNo = lastStepNo + 1; lastStepNo = stepNo; }
      const step = groups.get(stepNo) || { action: "", data: "", expectedResult: "" };
      const value = text(values[column]);
      if (name.includes("action")) step.action = value; else if (name.includes("data")) step.data = value; else step.expectedResult = value;
      groups.set(stepNo, step);
    });
    row.steps = groups.size ? [...groups.values()] : [{ action: "", data: "", expectedResult: "" }];
    return row;
  }).filter(Boolean) as Row[];
}
