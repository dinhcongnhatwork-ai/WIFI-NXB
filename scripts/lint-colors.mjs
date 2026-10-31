import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Only customer-authored portal/CMS content is exempt. Administration chrome is checked.
const contentDirectories = new Set([
  "src/components/cms",
  "src/components/renderer",
  "src/components/builder",
]);
const contentFiles = new Set([
  "src/components/attendance/ParticipantAttendanceDialog.tsx",
]);
const forbidden =
  /(?:purple|violet|indigo|fuchsia|pink|cyan|teal|orange)-\d|bg-gradient|(?:linear|radial|conic)-gradient\s*\(/g;
let violations = 0;
async function scan(directory) {
  if (contentDirectories.has(directory)) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:[jt]sx?|css)$/.test(path) && !contentFiles.has(path)) {
      const lines = (await readFile(path, "utf8")).split("\n");
      lines.forEach((line, index) => {
        const matches = line.match(forbidden);
        if (matches) {
          violations += matches.length;
          console.error(`${path}:${index + 1}: ${matches.join(", ")}`);
        }
      });
    }
  }
}
await scan("src/app/admin");
await scan("src/components");
if (violations) {
  console.error(`${violations} vi phạm bảng màu quản trị.`);
  process.exitCode = 1;
} else console.log("Bảng màu quản trị hợp lệ: 0 vi phạm.");
