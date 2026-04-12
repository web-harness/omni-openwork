import { IpcMain } from "electron"
import { getSetting, setSetting } from "../db"

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("settings:get", (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle("settings:set", (_event, { key, value }: { key: string; value: string }) => {
    setSetting(key, value)
  })
}
