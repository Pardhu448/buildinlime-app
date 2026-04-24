import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import * as SecureStore from "expo-secure-store"

const STORAGE_KEY = "selected_project_id"

interface ProjectContextValue {
  projectId: string | null
  ready: boolean
  selectProject: (id: string) => Promise<void>
  clearProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Restore last selected project on mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((id) => {
      if (id) setProjectId(id)
      setReady(true)
    })
  }, [])

  async function selectProject(id: string) {
    await SecureStore.setItemAsync(STORAGE_KEY, id)
    setProjectId(id)
  }

  async function clearProject() {
    await SecureStore.deleteItemAsync(STORAGE_KEY)
    setProjectId(null)
  }

  return (
    <ProjectContext.Provider value={{ projectId, ready, selectProject, clearProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjectContext must be used inside ProjectProvider")
  return ctx
}
