import { BrowserRouter, Routes, Route } from "react-router-dom"
import Client from "./pages/Client"
import CreationDossier from "./pages/CreationDossier"
import SuiviPage from "./pages/Archive"
import Dashboard from "./pages/Dashboard"
import ModifierDossier from "./pages/ModifierDossier";
import FacturePage from "./pages/FactureDetails";
import ArchiveMod from "./pages/ArchiveModifier";
import ModFacture from "./pages/ModifierFacture";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/creation-dossier" element={<CreationDossier />} />
        <Route path="/ArchiveModifier" element={<SuiviPage />} />
        <Route path="/client" element={<Client />} />
        <Route path="/modifier-dossier/:dossier_no" element={<ModifierDossier />} />
        <Route path="/facture/:dossier_no" element={<FacturePage />} />
        <Route path="/archive" element={<ArchiveMod />} />
        <Route path="/modfacture/:dossier_no" element={<ModFacture />} />

      </Routes>
    </BrowserRouter>
  )
}
