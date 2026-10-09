import { existsSync } from "node:fs"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const distDirectory = join(rootDirectory, "dist")
const relativeSpecifierPattern = /(from\s+["'])(\.\.?\/[^"']+)(["'])/g
const relativeImportTypePattern = /(import\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g

async function listJavaScriptFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(path))
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))
    ) {
      files.push(path)
    }
  }
  return files
}

function resolveSpecifier(specifier, sourceFile) {
  if (specifier.endsWith(".js")) return specifier

  const target = resolve(dirname(sourceFile), specifier)
  if (existsSync(`${target}.js`)) return `${specifier}.js`
  if (existsSync(join(target, "index.js"))) return `${specifier}/index.js`
  return specifier
}

for (const file of await listJavaScriptFiles(distDirectory)) {
  const source = await readFile(file, "utf8")
  const updated = source.replace(
    relativeSpecifierPattern,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveSpecifier(specifier, file)}${suffix}`,
  ).replace(
    relativeImportTypePattern,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveSpecifier(specifier, file)}${suffix}`,
  )
  if (updated !== source) {
    await writeFile(file, updated)
  }
}
