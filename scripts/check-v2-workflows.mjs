import { readdir, readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const workflowsDirectory = join(rootDirectory, ".github", "workflows")
const retiredPluginKey = /\\?["']plugin\\?["']\s*:/
const failures = []

for (const filename of await readdir(workflowsDirectory)) {
  if (!filename.endsWith(".yml") && !filename.endsWith(".yaml")) continue
  const path = join(workflowsDirectory, filename)
  const lines = (await readFile(path, "utf8")).split("\n")
  for (const [index, line] of lines.entries()) {
    if (retiredPluginKey.test(line)) {
      failures.push(`${relative(rootDirectory, path)}:${index + 1}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(
    `OpenCode V1 \"plugin\" config key found in release workflows:\n${failures.join("\n")}`,
  )
}
