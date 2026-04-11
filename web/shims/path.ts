import * as zenfsPath from "@zenfs/core/path"
import pathBrowserify from "path-browserify"

const merged = { ...pathBrowserify, ...zenfsPath }
const posix = merged
const path = { ...merged, posix, win32: merged }

export default path
export { posix }
export const win32 = merged
export * from "@zenfs/core/path"
