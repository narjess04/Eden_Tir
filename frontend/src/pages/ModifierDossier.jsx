import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import logo from "../logo.png";
import { Link, useParams, useNavigate } from "react-router-dom";

export default function ModifierDossier() {
    const { dossier_no } = useParams(); // Récupère le numéro de dossier depuis l'URL
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState(null);

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

    // Fonction pour charger les données du dossier
    useEffect(() => {
        const fetchDossierData = async () => {
            if (!dossier_no) return;

            setFetching(true);
            setError(null);

            try {
                const { data, error } = await supabase
                    .from("dossiers")
                    .select("*")
                    .eq("dossier_no", dossier_no)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        setError("Dossier non trouvé");
                    } else {
                        throw error;
                    }
                } else if (data) {
                    setFormData({
                        dossier_no: data.dossier_no || "",
                        mode: data.mode || "import",
                        expediteur: data.expediteur || "",
                        destinataire: data.destinataire || "",
                        marchandise: data.marchandise || "",
                        nature_chargement: data.nature_chargement || "Complet",
                        agent_marit: data.agent_marit || "",
                        magasin: data.magasin || "",
                        port_emb: data.port_emb || "",
                        date_emb: data.date_emb || "",
                        port_dest: data.port_dest || "",
                        date_dest: data.date_dest || "",
                        ctu_lta: data.ctu_lta || "",
                        navire: data.navire || "",
                        escale: data.escale || "",
                        rubrique: data.rubrique || "",
                        colisage: data.colisage || "",
                        pb: data.pb || "",
                        valeur_devise: data.valeur_devise || "",
                        valeur_dinars: data.valeur_dinars || "",
                        dg: data.dg || "",
                        type_declaration: data.type_declaration || "",
                        declaration_no: data.declaration_no || "",
                        date_declaration: data.date_declaration || "",
                        repertoire: data.repertoire || "",
                        banque: data.banque || ""
                    });
                }
            } catch (err) {
                console.error("Erreur lors du chargement du dossier:", err);
                setError("Erreur lors du chargement des données");
            } finally {
                setFetching(false);
            }
        };

        fetchDossierData();
    }, [dossier_no]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    // ACTION : Mise à jour dans Supabase
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Préparer les données pour la mise à jour
            const updateData = { ...formData };
            delete updateData.dossier_no; // On ne met pas à jour le numéro de dossier

            const { error } = await supabase
                .from("dossiers")
                .update(updateData)
                .eq("dossier_no", dossier_no);

            if (error) throw error;

            alert("✅ Dossier mis à jour avec succès !");
            navigate("/archive"); // Rediriger vers la page de suivi

        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
            alert("❌ Erreur lors de la mise à jour : " + error.message);
        }
        setLoading(false);
    };

    // ACTION : Télécharger le PDF
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
                credentials: "include",   // important cross-origin
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error("Erreur serveur lors de la génération du PDF");
            }

            const blob = await response.blob();

            // Forcer le type MIME
            const pdfBlob = new Blob([blob], { type: "application/pdf" });

            const url = window.URL.createObjectURL(pdfBlob);

            // Sécuriser le nom du fichier
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


    const handleCancel = () => {
        navigate("/archive");
    };

    if (fetching) {
        return (
            <div className="flex h-screen bg-white font-sans text-black">
                <aside className="w-64 bg-black text-white flex flex-col">
                    <div className="p-8 mb-4">
                        <div className="flex items-center gap-4">
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
                        <NavItem label="Dashboard" to="/" />
                        <NavItem label="Création d'un dossier" to="/creation-dossier" />
                        <NavItem label="Suivi des dossiers" to="/archive" />
                        <NavItem label="Clients" to="/client" />
                    </nav>
                </aside>
                <main className="flex-1 bg-zinc-50 overflow-y-auto min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                        <p className="text-lg font-medium">Chargement du dossier...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen bg-white font-sans text-black">
                <aside className="w-64 bg-black text-white flex flex-col">
                    <div className="p-8 mb-4">
                        <div className="flex items-center gap-4">
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
                        <NavItem label="Dashboard" to="/" />
                        <NavItem label="Création d'un dossier" to="/creation-dossier" />
                        <NavItem label="Suivi des dossiers" to="/archive" />
                        <NavItem label="Clients" to="/client" />
                    </nav>
                </aside>
                <main className="flex-1 bg-zinc-50 overflow-y-auto min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-red-500 text-5xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold mb-2">Erreur</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <button
                            onClick={() => navigate("/archive")}
                            className="bg-black text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition"
                        >
                            Retour au suivi
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white font-sans text-black">
            {/* SIDEBAR */}
            <aside className="w-64 bg-black text-white flex flex-col">
                <div className="p-8 mb-4">
                    <div className="flex items-center gap-4">
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
                    <NavItem label="Dashboard" to="/" />
                    <NavItem label="Création d'un dossier" to="/creation-dossier" />
                    <NavItem label="Suivi des dossiers" to="/archive" active />
                    <NavItem label="Clients" to="/client" />
                </nav>
            </aside >

            {/* CONTENU PRINCIPAL */}
            <main className="flex-1 bg-zinc-50 overflow-y-auto min-h-screen">
                <header className="h-20 bg-white border-b border-zinc-100 flex items-center px-10 sticky top-0 z-20">
                    <h1 className="text-xl font-bold tracking-tight uppercase">
                        Modification du Dossier {dossier_no}
                    </h1>
                </header>

                <div className="p-10 flex justify-center">
                    <form onSubmit={handleSubmit} className="bg-white w-[850px] p-12 shadow-2xl border border-zinc-200 rounded-sm mb-20 text-sm">

                        {/* HEADER FORMULAIRE */}
                        <div className="flex justify-between items-start mb-10">
                            <div className="text-3xl font-black italic tracking-tighter text-zinc-800">EDEN TIR</div>
                            <div className="flex items-center gap-2 font-bold">
                                <span>DOSSIER N° :</span>
                                <input
                                    name="dossier_no"
                                    value={formData.dossier_no}
                                    readOnly
                                    className="border-b-2 border-dotted border-black outline-none w-40 px-2 pb-1 bg-transparent text-gray-500"
                                />
                            </div>
                        </div>

                        {/* MODE SELECTION */}
                        <div className="flex justify-center gap-20 mb-10 uppercase font-bold tracking-widest text-xs">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="import"
                                    checked={formData.mode === "import"}
                                    onChange={handleChange}
                                    className="w-4 h-4 accent-black"
                                />
                                Import
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="export"
                                    checked={formData.mode === "export"}
                                    onChange={handleChange}
                                    className="w-4 h-4 accent-black"
                                />
                                Export
                            </label>
                        </div>

                        {/* TABLEAU EXPEDITEUR / DESTINATAIRE / MARCHANDISE */}
                        <div className="grid grid-cols-3 border border-black mb-8">
                            <div className="border-r border-black">
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Expéditeur</div>
                                <textarea
                                    name="expediteur"
                                    value={formData.expediteur}
                                    onChange={handleChange}
                                    rows="4"
                                    className="w-full p-2 outline-none resize-none bg-transparent"
                                />
                            </div>
                            <div className="border-r border-black">
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Destinataire</div>
                                <textarea
                                    name="destinataire"
                                    value={formData.destinataire}
                                    onChange={handleChange}
                                    rows="4"
                                    className="w-full p-2 outline-none resize-none bg-transparent"
                                />
                            </div>
                            <div>
                                <div className="bg-zinc-100 p-2 text-center font-bold border-b border-black uppercase text-[10px]">Marchandise</div>
                                <textarea
                                    name="marchandise"
                                    value={formData.marchandise}
                                    onChange={handleChange}
                                    rows="4"
                                    className="w-full p-2 outline-none resize-none bg-transparent"
                                />
                            </div>
                        </div>

                        {/* SECTION TRANSPORT */}
                        <div className="border-y-4 border-double border-black py-2 text-center text-2xl font-black tracking-[0.3em] mb-6">TRANSPORT</div>

                        <div className="space-y-4 mb-10">
                            <div className="flex items-center gap-6">
                                <span className="font-bold text-xs uppercase italic text-zinc-500">Nature de chargement :</span>
                                <label className="flex items-center gap-2 text-xs font-bold">
                                    <input
                                        type="radio"
                                        name="nature_chargement"
                                        value="Complet"
                                        checked={formData.nature_chargement === "Complet"}
                                        onChange={handleChange}
                                        className="accent-black"
                                    /> COMPLET
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold">
                                    <input
                                        type="radio"
                                        name="nature_chargement"
                                        value="Groupage"
                                        checked={formData.nature_chargement === "Groupage"}
                                        onChange={handleChange}
                                        className="accent-black"
                                    /> GROUPAGE
                                </label>
                            </div>

                            <div className="flex gap-4">
                                <Field label="Agent maritime" name="agent_marit" value={formData.agent_marit} onChange={handleChange} flex />
                                <Field label="Magasin" name="magasin" value={formData.magasin} onChange={handleChange} width="w-1/3" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Port Embarquement" name="port_emb" value={formData.port_emb} onChange={handleChange} flex />
                                <Field label="Date" name="date_emb" value={formData.date_emb} onChange={handleChange} width="w-1/4" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Port Destination" name="port_dest" value={formData.port_dest} onChange={handleChange} flex />
                                <Field label="Date" name="date_dest" value={formData.date_dest} onChange={handleChange} width="w-1/4" />
                            </div>

                            <Field label="CTU N° / LTA N°" name="ctu_lta" value={formData.ctu_lta} onChange={handleChange} flex />

                            <div className="flex gap-4">
                                <Field label="Navire" name="navire" value={formData.navire} onChange={handleChange} flex />
                                <Field label="Escale" name="escale" value={formData.escale} onChange={handleChange} width="w-1/4" />
                                <Field label="Rubrique" name="rubrique" value={formData.rubrique} onChange={handleChange} width="w-1/4" />
                            </div>

                            <div className="flex gap-4">
                                <Field label="Colisage" name="colisage" value={formData.colisage} onChange={handleChange} flex />
                                <Field label="P.B" name="pb" value={formData.pb} onChange={handleChange} width="w-1/4" />
                            </div>
                        </div>

                        {/* SECTION DOUANE */}
                        <div className="border-y-4 border-double border-black py-2 text-center text-2xl font-black tracking-[0.3em] mb-6">DOUANE</div>

                        <div className="space-y-4 mb-12">
                            <div className="flex gap-4">
                                <Field label="Valeur devise" name="valeur_devise" value={formData.valeur_devise} onChange={handleChange} flex />
                                <Field label="Valeur dinars" name="valeur_dinars" value={formData.valeur_dinars} onChange={handleChange} flex />
                            </div>
                            <div className="flex gap-4">
                                <Field label="DG" name="dg" value={formData.dg} onChange={handleChange} flex />
                                <Field label="Type déclaration" name="type_declaration" value={formData.type_declaration} onChange={handleChange} flex />
                            </div>
                            <div className="flex gap-4">
                                <Field label="Déclaration N°" name="declaration_no" value={formData.declaration_no} onChange={handleChange} flex />
                                <Field label="Date" name="date_declaration" value={formData.date_declaration} onChange={handleChange} width="w-1/3" />
                            </div>
                            <div className="flex gap-4">
                                <Field label="Répertoire" name="repertoire" value={formData.repertoire} onChange={handleChange} flex />
                                <Field label="Banque domicilataire" name="banque" value={formData.banque} onChange={handleChange} flex />
                            </div>
                        </div>

                        {/* BOUTONS D'ACTION */}
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-300 transition active:scale-95"
                            >
                                Annuler
                            </button>

                            <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className="flex-1 bg-white text-black border-2 border-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-100 transition active:scale-95"
                            >
                                Télécharger PDF
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition active:scale-95 disabled:bg-zinc-400"
                            >
                                {loading ? "Mise à jour en cours..." : "Mettre à jour le dossier"}
                            </button>
                        </div>

                    </form>
                </div>
            </main>
        </div>
    );
}

// COMPOSANTS INTERNES
function Field({ label, name, value, onChange, flex = false, width = "" }) {
    return (
        <div className={`flex items-baseline gap-2 ${flex ? "flex-1" : width}`}>
            <label className="text-[10px] font-black uppercase whitespace-nowrap text-zinc-500 italic">{label} :</label>
            <input
                name={name}
                value={value}
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