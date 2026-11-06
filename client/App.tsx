import { Navigate, Route, Routes } from 'react-router-dom'
import { EmployeeDetailPage } from './pages/EmployeeDetail'
import { EmployeesPage } from './pages/Employees'
import { LoginPage } from './pages/Login'
import { OverviewPage } from './pages/Overview'
import { QuestionsPage } from './pages/Questions'
import { Shell } from './shell'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Shell />}>
        <Route index element={<OverviewPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="questions" element={<QuestionsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
