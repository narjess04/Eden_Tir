import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import logo from "../logo.png";
import { Link } from "react-router-dom";

export default function DossierPage() {
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [loadingClients, setLoadingClients] = useState(false);

    const [formData, setFormData] = useState({
        dossier_no: "",
        mode: "import",
        expediteur: "",
        destinataire: "",
        marchandise: "",
        nature_chargement: "Complet",
        agent_marit: "",
        magasin: "",
        port_emb: "",
        date_emb: "",
        port_dest: "",
        date_dest: "",
        ctu_lta: "",
        navire: "",
        escale: "",
        rubrique: "",
        colisage: "",
        pb: "",
        valeur_devise: "",
        valeur_dinars: "",
        dg: "",
        type_declaration: "",
        declaration_no: "",
        date_declaration: "",
        repertoire: "",
        banque: ""
    });

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setLoadingClients(true);
        try {
            const { data, error } = await supabase
                .from("clients")
                .select("id, nom_client")
                .order("nom_client", { ascending: true });

            if (error) throw error;

            setClients(data || []);
            setFilteredClients(data || []);
        } catch (error) {
            console.error("Erreur chargement clients:", error);
            alert("Erreur lors du chargement des clients");
        } finally {
            setLoadingClients(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleClientSearch = (e) => {
        const searchTerm = e.target.value;
        setClientSearch(searchTerm);
        setFormData({ ...formData, destinataire: searchTerm });

        if (searchTerm.length > 0) {
            const filtered = clients.filter(client => {
                const searchLower = searchTerm.toLowerCase();
                return (
                    client.nom_client &&
                    client.nom_client.toLowerCase().includes(searchLower)
                );
            });
            setFilteredClients(filtered);
            setShowDropdown(true);
        } else {
            setFilteredClients(clients);
            setShowDropdown(false);
        }
    };

    const selectClient = (client) => {
        const clientInfo = client.nom_client || "";

        setFormData({
            ...formData,
            destinataire: clientInfo
        });
        setClientSearch(clientInfo);
        setShowDropdown(false);
    };

    useEffect(() => {
        const handleClickOutside = () => {
            setShowDropdown(false);
        };

        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.from("dossiers").insert([formData]);

        if (error) {
            alert("Erreur base de données : " + error.message);
        }
        setLoading(false);
    };

    const handleDownloadPDF = async () => {
        if (!formData.dossier_no) {
            alert("Veuillez saisir un numéro de dossier.");
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL;

        try {
            const response = await fetch(`${API_URL}/generate-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error("Erreur serveur lors de la génération du PDF");
            }

            const blob = await response.blob();
            const pdfBlob = new Blob([blob], { type: "application/pdf" });
            const url = window.URL.createObjectURL(pdfBlob);
            const safeDossierNo = String(formData.dossier_no).replace(/[\/\\]/g, "_");
            const link = document.createElement("a");
            link.href = url;
            link.download = `Dossier_${safeDossierNo}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Erreur lors du téléchargement :", error);
            alert("Impossible de générer le PDF. Vérifiez le serveur.");
        }
    };

    return (
        <div className="flex h-screen bg-white font-sans text-black">
            <aside className="w-64 bg-black text-white flex flex-col">
                <div className="p-8 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-60 h-20 bg-white rounded-xl flex items-center justify-center overflow-hidden p-2 shadow-sm">
                            <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    <NavItem label="Dashboard" to="/" />
                    <NavItem label="Création d'un dossier" to="/creation-dossier" active />
                    <NavItem label="Suivi des dossiers" to="/archive" />
                    <NavItem label="Clients" to="/client" />
                </nav>
            </aside>

            <main className="flex-1 bg-zinc-50 overflow-y-auto min-h-screen">
                <header className="h-20 bg-white border-b border-zinc-100 flex items-center px-10 sticky top-0 z-20">
                    <h1 className="text-xl font-bold tracking-tight uppercase">Saisie Dossier de Transit</h1>
                </header>

                <div className="p-10 flex justify-center">
                    <form onSubmit={handleSubmit} className="bg-white w-[850px] p-12 shadow-2xl border border-zinc-200 rounded-sm mb-20 text-sm">

                        <div className="flex justify-between items-start mb-10">
                            <div className="text-3xl font-black italic tracking-tighter text-zinc-800">EDEN TIR</div>
                            <div className="flex items-center gap-2 font-bold">
                                <span>DOSSIER N° :</span>
                                <input name="dossier_no" onChange={handleChange} className="border-b-2 border-dotted border-black outline-none w-40 px-2 pb-1 bg-transparent" />
                            </div>
                        </div>

                        <div className="flex justify-center gap-20 mb-10 uppercase font-bold tracking-widest text-xs">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="mode" value="import" checked={formData.mode === "import"} onChange={handleChange} className="w-4 h-4 accent-black" />
                                Import
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="mode" value="export" checked={formData.mode === "export"} onChange={handleChange} className="w-4 h-4 accent-black" />
                                Export
                            </label>
                        </div>

                        <div className="grid grid-cols-3 border border-black mb-8">
                            <div className="border-r border-black">
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Expéditeur</div>
                                <textarea name="expediteur" onChange={handleChange} rows="4" className="w-full p-2 outline-none resize-none bg-transparent" />
                            </div>

                            <div className="border-r border-black relative">
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Destinataire</div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={clientSearch}
                                        onChange={handleClientSearch}
                                        onFocus={() => clientSearch.length > 0 && setShowDropdown(true)}
                                        placeholder="Rechercher un client..."
                                        className="w-full p-2 outline-none bg-transparent border-none focus:ring-0"
                                    />

                                    {showDropdown && (
                                        <div
                                            className="absolute z-50 top-full left-0 right-0 max-h-60 overflow-y-auto bg-white border border-zinc-200 shadow-lg"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {loadingClients ? (
                                                <div className="p-3 text-center text-zinc-500">Chargement...</div>
                                            ) : filteredClients.length > 0 ? (
                                                filteredClients.map((client) => (
                                                    <div
                                                        key={client.id}
                                                        onClick={() => selectClient(client)}
                                                        className="p-3 border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
                                                    >
                                                        <div className="font-semibold text-sm">
                                                            {client.nom_client || "Client sans nom"}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 text-center text-zinc-500">Aucun client trouvé</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>

                            <div>
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Marchandise</div>
                                <textarea name="marchandise" onChange={handleChange} rows="4" className="w-full p-2 outline-none resize-none bg-transparent" />
                            </div>
                        </div>

                        <div className="border-y-4 border-double border-black py-2 text-center text-2xl font-black tracking-[0.3em] mb-6">TRANSPORT</div>

                        <div className="space-y-4 mb-10">
                            <div className="flex items-center gap-6">
                                <span className="font-bold text-xs uppercase italic text-zinc-500">Nature de chargement :</span>
                                <label className="flex items-center gap-2 text-xs font-bold">
                                    <input type="radio" name="nature_chargement" value="Complet" onChange={handleChange} checked={formData.nature_chargement === "Complet"} className="accent-black" /> COMPLET
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold">
                                    <input type="radio" name="nature_chargement" value="Groupage" onChange={handleChange} checked={formData.nature_chargement === "Groupage"} className="accent-black" /> GROUPAGE
                                </label>
                            </div>

                            <div className="flex gap-4">
                                <Field label="Agent maritime" name="agent_marit" onChange={handleChange} flex />
                                <Field label="Magasin" name="magasin" onChange={handleChange} width="w-1/3" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Port Embarquement" name="port_emb" onChange={handleChange} flex />
                                <Field label="Date" name="date_emb" onChange={handleChange} width="w-1/4" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Port Destination" name="port_dest" onChange={handleChange} flex />
                                <Field label="Date" name="date_dest" onChange={handleChange} width="w-1/4" />
                            </div>

                            <Field label="CTU N° / LTA N°" name="ctu_lta" onChange={handleChange} flex />

                            <div className="flex gap-4">
                                <Field label="Navire" name="navire" onChange={handleChange} flex />
                                <Field label="Escale" name="escale" onChange={handleChange} width="w-1/4" />
                                <Field label="Rubrique" name="rubrique" onChange={handleChange} width="w-1/4" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Colisage" name="colisage" onChange={handleChange} flex />
                                <Field label="P.B" name="pb" onChange={handleChange} width="w-1/4" />
                            </div>
                        </div>

                        <div className="border-y-4 border-double border-black py-2 text-center text-2xl font-black tracking-[0.3em] mb-6">DOUANE</div>

                        <div className="space-y-4 mb-12">
                            <div className="flex gap-4">
                                <Field label="Valeur devise" name="valeur_devise" onChange={handleChange} flex />
                                <Field label="Valeur dinars" name="valeur_dinars" onChange={handleChange} flex />
                            </div>
                            <div className="flex gap-4">
                                <Field label="DG" name="dg" onChange={handleChange} flex />
                                <Field label="Type déclaration" name="type_declaration" onChange={handleChange} flex />
                            </div>
                            <div className="flex gap-4">
                                <Field label="Déclaration N°" name="declaration_no" onChange={handleChange} flex />
                                <Field label="Date" name="date_declaration" onChange={handleChange} width="w-1/3" />
                            </div>
                            <div className="flex gap-4">
                                <Field label="Répertoire" name="repertoire" onChange={handleChange} flex />
                                <Field label="Banque domicilataire" name="banque" onChange={handleChange} flex />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition active:scale-95 disabled:bg-zinc-400"
                            >
                                {loading ? "Action en cours..." : "Enregistrer le dossier"}
                            </button>

                            <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className="flex-1 bg-white text-black border-2 border-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-100 transition active:scale-95"
                            >
                                Télécharger PDF
                            </button>
                        </div>

                    </form>
                </div>
            </main>
        </div>
    );
}

function Field({ label, name, onChange, flex = false, width = "" }) {
    return (
        <div className={`flex items-baseline gap-2 ${flex ? "flex-1" : width}`}>
            <label className="text-[10px] font-black uppercase whitespace-nowrap text-zinc-500 italic">{label} :</label>
            <input
                name={name}
                onChange={onChange}
                className="flex-1 border-b border-dotted border-zinc-400 outline-none bg-transparent px-1 focus:border-black transition-colors"
            />
        </div>
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