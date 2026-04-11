import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url"
import initSqlJsBase from "sql.js"

export default function initSqlJs(config?: Parameters<typeof initSqlJsBase>[0]) {
  return initSqlJsBase({
    locateFile: (filename: string) => {
      if (filename.endsWith(".wasm")) return sqlWasmUrl as string
      return filename
    },
    ...config
  })
}

export type { Database, SqlJsStatic } from "sql.js"
