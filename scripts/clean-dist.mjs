import { rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
await rm(resolve(rootDirectory, "dist"), { recursive: true, force: true })
