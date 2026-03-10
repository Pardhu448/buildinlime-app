import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import * as SecureStore from "expo-secure-store"
import { createScopedCollections, type ScopedCollections } from "../collections/scoped"

const STORAGE_KEY = "selected_project_id"

interface ProjectContextValue {
  projectId: string | null
  collections: ScopedCollections | null
  selectProject: (id: string) => Promise<void>
  clearProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [collections, setCollections] = useState<ScopedCollections | null>(null)

  // Restore last selected project on mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((id) => {
      if (id) activate(id)
    })
  }, [])

  function activate(id: string) {
    setProjectId(id)
    setCollections(createScopedCollections(id))
  }

  async function selectProject(id: string) {
    await SecureStore.setItemAsync(STORAGE_KEY, id)
    activate(id)
  }

  async function clearProject() {
    await SecureStore.deleteItemAsync(STORAGE_KEY)
    setProjectId(null)
    setCollections(null)
  }

  return (
    <ProjectContext.Provider value={{ projectId, collections, selectProject, clearProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjectContext must be used inside ProjectProvider")
  return ctx
}
