import createDebug from "debug"

const debug = createDebug("omni:workspace")

import { directoryOpen } from "browser-fs-access"

export async function selectWorkspaceFolder(
  currentThreadId: string | null,
  setWorkspacePath: (path: string | null) => void,
  setWorkspaceFiles: (files: Array<{ path: string; is_dir?: boolean; size?: number }>) => void,
  setLoading: (loading: boolean) => void,
  setOpen?: (open: boolean) => void
): Promise<void> {
  if (!currentThreadId) return
  setLoading(true)
  try {
    let path: string | null = null

    if (window.api?.workspace?.select) {
      // Electron path (also handles web via shim internally)
      path = await window.api.workspace.select(currentThreadId)
    } else {
      // Direct browser-fs-access fallback
      const files = await directoryOpen({ recursive: true })
      const list = Array.isArray(files) ? files : [files]
      if (list.length > 0) {
        path = "/" + list[0].webkitRelativePath.split("/")[0]
      }
    }

    if (path) {
      setWorkspacePath(path)
      const result = await window.api.workspace.loadFromDisk(currentThreadId)
      if (result.success && result.files) {
        setWorkspaceFiles(result.files)
      }
    }
    if (setOpen) setOpen(false)
  } catch (e) {
    debug("[WorkspacePicker] Select folder error:", e)
  } finally {
    setLoading(false)
  }
}
