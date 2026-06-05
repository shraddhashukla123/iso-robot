import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { useActiveJobsPoller } from './hooks/useActiveJobs'
import { ClassificationsPage } from './pages/ClassificationsPage'
import { ControlsPage } from './pages/ControlsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ExportPage } from './pages/ExportPage'
import { IssuesPage } from './pages/IssuesPage'
import { RiskDiscoveryPage } from './pages/RiskDiscoveryPage'
import { RiskLibraryPage } from './pages/RiskLibraryPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1 },
  },
})

function Shell() {
  const [toast, setToast] = useState<string | null>(null)
  const loc = useLocation()
  useEffect(() => {
    setToast(null)
  }, [loc.pathname])

  // Keep the global job poller alive across all page navigations.
  useActiveJobsPoller()

  return (
    <AppLayout toast={toast}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage onError={setToast} />} />
        <Route path="/controls" element={<ControlsPage onError={setToast} />} />
        <Route path="/issues" element={<IssuesPage onError={setToast} />} />
        <Route path="/classifications" element={<ClassificationsPage onError={setToast} />} />
        <Route path="/risk-discovery" element={<RiskDiscoveryPage onError={setToast} />} />
        <Route path="/risk-library" element={<RiskLibraryPage onError={setToast} />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
