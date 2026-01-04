import { BrowserRouter, Routes, Route } from "react-router-dom"
import Client from "./pages/Client"
import CreationDossier from "./pages/CreationDossier"
import SuiviPage from "./pages/Archive"
import Dashboard from "./pages/Dashboard"
import ModifierDossier from "./pages/ModifierDossier";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/creation-dossier" element={<CreationDossier />} />
        <Route path="/archive" element={<SuiviPage />} />
        <Route path="/client" element={<Client />} />
        <Route path="/modifier-dossier/:dossier_no" element={<ModifierDossier />} />

      </Routes>
    </BrowserRouter>
  )
}
