import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryDirectory = await mkdtemp(join(tmpdir(), "antigravity-pack-"))
let tarballPath

try {
  const packResult = JSON.parse(execFileSync(
    "npm",
    ["pack", "--ignore-scripts", "--json"],
    { cwd: rootDirectory, encoding: "utf8" },
  ))
  const filename = packResult[0]?.filename
  if (typeof filename !== "string") {
    throw new Error("npm pack did not return a tarball filename")
  }
  tarballPath = join(rootDirectory, filename)

  const forbiddenFiles = (packResult[0]?.files ?? [])
    .map((file) => file.path)
    .filter((path) =>
      path.includes("/v2/legacy-client.")
      || path.includes("/plugin/cli.")
      || path.includes("/plugin/ui/")
      || path.includes("/plugin/recovery/index."),
    )
  if (forbiddenFiles.length > 0) {
    throw new Error(`Packed artifact contains removed compatibility files: ${forbiddenFiles.join(", ")}`)
  }

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarballPath,
      "@types/node@24",
    ],
    { cwd: temporaryDirectory, stdio: "inherit" },
  )

  const packageJson = JSON.parse(await readFile(join(rootDirectory, "package.json"), "utf8"))
  const packageName = packageJson.name
  const smokeScript = [
    `const module = await import(${JSON.stringify(packageName)})`,
    `if (module.default?.id !== "opencode.provider.antigravity") throw new Error("Missing v2 plugin export")`,
    `if (typeof module.default.setup !== "function") throw new Error("Missing v2 plugin setup")`,
    `const unexpected = Object.keys(module).filter((name) => name !== "default")`,
    `if (unexpected.length) throw new Error(\`Unexpected named exports: \${unexpected.join(", ")}\`)`,
  ].join("\n")
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", smokeScript],
    { cwd: temporaryDirectory, stdio: "inherit" },
  )

  await writeFile(
    join(temporaryDirectory, "consumer.ts"),
    [
      `import { Plugin } from "@opencode-ai/plugin"`,
      `import antigravityAuthPlugin from ${JSON.stringify(packageName)}`,
      "const plugin: Plugin.Plugin = antigravityAuthPlugin",
      "void plugin",
    ].join("\n"),
  )
  await writeFile(
    join(temporaryDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        skipLibCheck: false,
        strict: true,
      },
      files: ["consumer.ts"],
    }),
  )
  execFileSync(
    join(temporaryDirectory, "node_modules", ".bin", "tsc"),
    ["--project", "tsconfig.json"],
    { cwd: temporaryDirectory, stdio: "inherit" },
  )

  console.log(`Verified packed ${basename(tarballPath)} with native Node ESM`)
} finally {
  if (tarballPath) {
    await rm(tarballPath, { force: true })
  }
  await rm(temporaryDirectory, { recursive: true, force: true })
}
