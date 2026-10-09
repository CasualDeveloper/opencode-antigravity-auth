import { readdir, readFile } from "node:fs/promises"

const packageJson = JSON.parse(await readFile("package.json", "utf8"))
const build = JSON.parse(await readFile("tsconfig.build.json", "utf8"))
if (build.include.some((path) => path.includes("/v2/") || /(?:plugin-v2|v1|server)\.ts$/.test(path))) {
  throw new Error("Build configuration still targets a removed version adapter")
}
if (packageJson.dependencies["@opencode-ai/plugin"] || packageJson.exports["./v1"] || packageJson.exports["./server"]) {
  throw new Error("V1 package surfaces must not be published")
}
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === "v2" || path === "src/plugin/ui") throw new Error(`Parallel/legacy implementation: ${path}`)
      await check(path)
    } else if (entry.name.endsWith(".ts")) {
      if (entry.name.startsWith("plugin-v2.")) throw new Error(`Versioned adapter: ${path}`)
      const source = await readFile(path, "utf8")
      if (/from\s+["']@opencode-ai\/plugin|PluginInput|PluginClient|createAntigravityPlugin/.test(source)) {
        throw new Error(`Legacy plugin contract in ${path}`)
      }
    }
  }
}
await check("src")
await check("script")
console.log("Verified one native plugin implementation, with no version adapter or V1 surfaces")
