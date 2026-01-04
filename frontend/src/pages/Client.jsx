import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import logo from "../logo.png";
import { Link } from "react-router-dom";

export default function ClientPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);

    // État du formulaire simplifié (sans status)
    const [formData, setFormData] = useState({
        code_client: "",
        nom_client: "",
        adresse: "",
        code_tva: ""
    });

    // --- CHARGEMENT DES DONNÉES ---
    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .order("created_at", { ascending: false });

        if (!error) setClients(data);
        setLoading(false);
    };

    // --- FILTRAGE ---
    const filteredClients = clients.filter(client => {
        return (
            client.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.code_client?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    // --- ACTIONS ---
    const handleOpenModal = () => {
        setFormData({ code_client: "", nom_client: "", adresse: "", code_tva: "" });
        setShowModal(true);
    };

    const handleDeleteClient = async (id) => {
        if (window.confirm("Supprimer ce client définitivement ?")) {
            const { error } = await supabase.from("clients").delete().eq("id", id);
            if (!error) fetchClients();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from("clients").insert([formData]);

        if (error) {
            alert("Erreur : " + error.message);
        } else {
            setShowModal(false);
            fetchClients();
        }
    };

    return (
        <div className="flex h-screen bg-white font-sans text-black">
            {/* SIDEBAR */}
            <aside className="w-64 bg-black text-white flex flex-col">
                {/* LOGO AVEC CADRE BLANC RÉGULIER */}
                <div className="p-8 mb-4">
                    <div className="flex items-center gap-4">
                        {/* Cadre blanc pour le logo */}
                        <div className="w-60 h-20 bg-white rounded-xl flex items-center justify-center overflow-hidden p-2 shadow-sm">
                            <img
                                src={logo}
                                alt="Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>


                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    {/* Navigation vers le Dashboard (par exemple la racine /) */}
                    <NavItem label="Dashboard" to="/dashboard" />

                    {/* Page actuelle (active) */}
                    <NavItem label="Création d'un dossier" to="/creation-dossier" />

                    <NavItem label="Suivi des dossiers" to="/archive" />

                    {/* Navigation vers la page Client */}
                    <NavItem label="Clients" to="/" active />
                </nav>
            </aside >

            {/* CONTENU PRINCIPAL */}
            < main className="flex-1 flex flex-col overflow-hidden" >
                <header className="h-20 border-b border-zinc-100 flex items-center justify-between px-10">
                    <h1 className="text-xl font-bold tracking-tight">Liste des Clients</h1>
                    <button
                        onClick={handleOpenModal}
                        className="bg-black text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition active:scale-95"
                    >
                        + Nouveau Client
                    </button>
                </header>

                <div className="p-10 flex-1 overflow-auto">
                    {/* BARRE DE RECHERCHE SIMPLE */}
                    <div className="flex gap-4 mb-8">
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou code..."
                            className="flex-1 bg-zinc-50 border-none rounded-xl px-5 py-3 text-sm focus:ring-1 focus:ring-black outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* TABLEAU AVEC COLONNE TVA DÉDIÉE */}
                    <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                                    <th className="px-6 py-5 font-bold">Code Client</th>
                                    <th className="px-6 py-5 font-bold">Client</th>
                                    <th className="px-6 py-5 font-bold">Adresse </th>
                                    <th className="px-6 py-5 font-bold">Code TVA</th>
                                    <th className="px-6 py-5 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                                {loading ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-zinc-400 italic">Mise à jour des données...</td></tr>
                                ) : filteredClients.map((c) => (
                                    <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">{c.code_client}</td>
                                        <td className="px-6 py-4 font-bold text-zinc-900">{c.nom_client}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-600">{c.adresse || "—"}</td>
                                        <td className="px-6 py-4">
                                            <code className="bg-zinc-100 px-2 py-1 rounded text-[11px] font-mono text-zinc-700">
                                                {c.code_tva || "NON SPÉCIFIÉ"}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleDeleteClient(c.id)}
                                                className="text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-black transition"
                                            >
                                                Supprimer
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main >

            {/* MODAL AJOUT */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-100">
                            <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold tracking-tight">Fiche Nouveau Client</h2>
                                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-black">✕</button>
                            </div>
                            <form className="p-8 space-y-5" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Code Client</label>
                                        <input required type="text" placeholder="Code Client" className="w-full bg-zinc-50 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={formData.code_client} onChange={(e) => setFormData({ ...formData, code_client: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Code TVA</label>
                                        <input type="text" placeholder="Code TVA" className="w-full bg-zinc-50 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={formData.code_tva} onChange={(e) => setFormData({ ...formData, code_tva: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Client</label>
                                    <input required type="text" placeholder="Nom de l'entreprise" className="w-full bg-zinc-50 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-black outline-none"
                                        value={formData.nom_client} onChange={(e) => setFormData({ ...formData, nom_client: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Adresse</label>
                                    <textarea placeholder="Adresse" rows="2" className="w-full bg-zinc-50 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-black outline-none resize-none"
                                        value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black transition">Fermer</button>
                                    <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg active:scale-95 transition">Valider</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}



function NavItem({ label, active = false, to = "/" }) {
    return (
        <Link to={to} className="block no-underline">
            <div className={`px-4 py-3 rounded-xl cursor-pointer text-sm font-medium transition ${active
                ? "bg-white text-black shadow-sm"
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                }`}>
                {label}
            </div>
        </Link>
    );
}