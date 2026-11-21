import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { TopologyPage } from './pages/TopologyPage'
import { DatasetPage } from './pages/DatasetPage'
import { TasksPage } from './pages/TasksPage'
import { SimulationPage } from './pages/SimulationPage'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/topology" element={<TopologyPage />} />
        <Route path="/dataset" element={<DatasetPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
