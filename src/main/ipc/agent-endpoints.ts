import { IpcMain } from "electron"
import {
  getAllAgentEndpoints,
  upsertAgentEndpoint as dbUpsert,
  deleteAgentEndpoint as dbDelete
} from "../db"

export function registerAgentEndpointHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("agentEndpoints:list", async () => {
    return getAllAgentEndpoints().map((row) => ({
      id: row.id,
      url: row.url,
      bearerToken: row.bearer_token,
      name: row.name,
      removable: row.removable === 1
    }))
  })

  ipcMain.handle(
    "agentEndpoints:upsert",
    async (
      _event,
      endpoint: { id: string; url: string; bearerToken: string; name: string; removable: boolean }
    ) => {
      const row = dbUpsert(endpoint.id, {
        url: endpoint.url,
        bearerToken: endpoint.bearerToken,
        name: endpoint.name,
        removable: endpoint.removable
      })
      return {
        id: row.id,
        url: row.url,
        bearerToken: row.bearer_token,
        name: row.name,
        removable: row.removable === 1
      }
    }
  )

  ipcMain.handle("agentEndpoints:delete", async (_event, id: string) => {
    dbDelete(id)
  })
}
