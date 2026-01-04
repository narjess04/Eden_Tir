import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import logo from "../logo.png";

export default function SuiviPage() {
    const [dossiers, setDossiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDossier, setSelectedDossier] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("tous");
    const navigate = useNavigate();

    // État pour les données de la facture en cours d'édition
    const [invoiceRows, setInvoiceRows] = useState({
        debours: [
            { label: "Droits & taxes C", montant: 19.0 },
            { label: "Droits & taxes UC", montant: 119.0 },
            { label: "Pénalité en douane (dépôt tardif)", montant: 100.0 },
            { label: "Pénalité en douane (Enlèvement tardif)", montant: 300.0 },
            { label: "Frais de visite du conteneur au port", montant: 150.0 },
            { label: "Assurance", montant: 62.42 },
            { label: "Timbres douane", montant: 25.0 }
        ],
        transit: [
            { label: "Honoraires", montant: 250.0 },
            { label: "Formalité déclaration UC", montant: 30.0 },
            { label: "Traitement informatique", montant: 30.0 },
            { label: "Etablissement TCE", montant: 20.0 },
            { label: "Frais fixes", montant: 50.0 }
        ],
        transport: [
            { label: "Frais de transport d'un conteneur 20\"", montant: 280.0 }
        ]
    });
    const [timbre, setTimbre] = useState(1.0);

    useEffect(() => {
        fetchDossiers();
    }, []);

    // Trier les dossiers : non payés en haut, payés en bas
    const dossiersTries = useMemo(() => {
        const nonPayes = dossiers.filter(d => d.status === "non payé");
        const payes = dossiers.filter(d => d.status === "payé");

        // Trier les non-payés par date de création (les plus récents d'abord)
        const nonPayesTries = nonPayes.sort((a, b) => {
            const dateA = new Date(a.created_at || a.date_creation || 0);
            const dateB = new Date(b.created_at || b.date_creation || 0);
            return dateB - dateA;
        });

        // Trier les payés par date de création (les plus récents d'abord)
        const payesTries = payes.sort((a, b) => {
            const dateA = new Date(a.created_at || a.date_creation || 0);
            const dateB = new Date(b.created_at || b.date_creation || 0);
            return dateB - dateA;
        });

        return [...nonPayesTries, ...payesTries];
    }, [dossiers]);

    // Utiliser useMemo pour calculer les montants non payés de manière optimisée
    const montantsNonPayes = useMemo(() => {
        const filtered = dossiers.filter(client => {
            const matchesSearch = client.dossier_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.destinataire?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === "tous" || client.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        let totalNonPaye = 0;
        const parClient = {};

        filtered.forEach(dossier => {
            if (dossier.status === "non payé") {
                const montant = parseFloat(dossier.dbMontant) || 0;
                totalNonPaye += montant;

                // Normaliser le nom du client (enlever les espaces et mettre en minuscules pour la clé)
                const clientKey = dossier.destinataire?.trim().toLowerCase() || "inconnu";
                const clientDisplay = dossier.destinataire?.trim() || "Client inconnu";

                if (!parClient[clientKey]) {
                    parClient[clientKey] = {
                        nom: clientDisplay,
                        montant: 0
                    };
                }
                parClient[clientKey].montant += montant;
            }
        });

        // Trier les clients par nom pour un affichage cohérent
        const sortedClients = {};
        Object.keys(parClient).sort().forEach(key => {
            sortedClients[key] = parClient[key];
        });

        return {
            total: totalNonPaye,
            parClient: sortedClients
        };
    }, [dossiers, searchTerm, statusFilter]);

    const fetchDossiers = async () => {
        setLoading(true);
        try {
            // Récupérer les dossiers avec leurs factures
            const { data: dossiersData } = await supabase.from("dossiers").select(`*, factures (id, montant_total , data_json)`);
            const { data: clientsData } = await supabase.from("clients").select("*");
            const { data: paiementsData } = await supabase.from("paiements").select("*");

            const enriched = dossiersData.map(d => {
                const facture = d.factures?.[0];
                const paiement = paiementsData?.find(p => p.dossier_no === d.dossier_no);

                // Normaliser le nom du destinataire
                const destinataireNormalise = d.destinataire?.trim() || "";

                return {
                    ...d,
                    clientInfo: clientsData.find(c => {
                        const nomClientNormalise = c.nom_client?.trim().toLowerCase();
                        const destinataireLower = destinataireNormalise.toLowerCase();
                        return nomClientNormalise === destinataireLower;
                    }) || {},
                    dbFactureId: facture?.id || "---",
                    dbMontant: facture?.montant_total || "0.000",
                    status: paiement?.paye ? "payé" : "non payé",
                    destinataire: destinataireNormalise // Stocker la version normalisée
                };
            });
            setDossiers(enriched);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    const updateStatus = async (dossier_no, newStatus) => {
        try {
            // Vérifier si un paiement existe déjà pour ce dossier
            const { data: existingPaiement } = await supabase
                .from("paiements")
                .select("*")
                .eq("dossier_no", dossier_no)
                .single();

            if (existingPaiement) {
                // Mettre à jour le paiement existant
                const { error } = await supabase
                    .from("paiements")
                    .update({
                        paye: newStatus === "payé",
                        date_maj: new Date().toISOString()
                    })
                    .eq("dossier_no", dossier_no);

                if (error) throw error;
            } else {
                // Créer un nouveau paiement
                const { error } = await supabase
                    .from("paiements")
                    .insert([{
                        dossier_no: dossier_no,
                        paye: newStatus === "payé",
                        date_creation: new Date().toISOString(),
                        date_maj: new Date().toISOString()
                    }]);

                if (error) throw error;
            }

            // Mettre à jour l'état local
            setDossiers(prevDossiers =>
                prevDossiers.map(dossier =>
                    dossier.dossier_no === dossier_no
                        ? { ...dossier, status: newStatus }
                        : dossier
                )
            );
        } catch (error) {
            console.error("Erreur lors de la mise à jour du statut:", error);
            alert("Erreur lors de la mise à jour du statut");
        }
    };

    const handleStatusClick = (dossier) => {
        const newStatus = dossier.status === "payé" ? "non payé" : "payé";
        updateStatus(dossier.dossier_no, newStatus);
    };

    const filteredClients = dossiersTries.filter(client => {
        const matchesSearch = client.dossier_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.destinataire?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "tous" || client.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Séparer les dossiers filtrés en non payés et payés pour l'affichage
    const dossiersNonPayes = filteredClients.filter(d => d.status === "non payé");
    const dossiersPayes = filteredClients.filter(d => d.status === "payé");

    const handleDelete = async (dossier_no) => {
        if (window.confirm("Voulez-vous vraiment supprimer ce dossier ?")) {
            // Supprimer d'abord le paiement associé
            await supabase.from("paiements").delete().eq("dossier_no", dossier_no);

            // Puis supprimer le dossier
            const { error } = await supabase.from("dossiers").delete().eq("dossier_no", dossier_no);

            if (error) {
                alert("Erreur lors de la suppression");
            } else {
                alert("Dossier et paiement supprimés !");
                fetchDossiers();
            }
        }
    };

    // Calculs de la facture
    const debTotal = invoiceRows.debours.reduce((sum, r) => sum + r.montant, 0);
    const taxTotaldossier = invoiceRows.transit.reduce((sum, r) => sum + r.montant, 0);
    const transportSubTotal = invoiceRows.transport.reduce((sum, r) => sum + r.montant, 0);
    const taxTotal = taxTotaldossier + transportSubTotal;
    const tva = taxTotaldossier * 0.19;
    const tva7 = transportSubTotal * 0.07;
    const totalFinal = debTotal + taxTotal + tva + timbre + tva7;

    const handleDownload = async () => {
        const factureId = selectedDossier.dbFactureId;

        if (!factureId) {
            alert("Facture non encore enregistrée");
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL;

        try {
            const response = await fetch(
                `${API_URL}/facture/${factureId}`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            if (!response.ok) {
                throw new Error("Erreur téléchargement facture");
            }

            const blob = await response.blob();

            const pdfBlob = new Blob([blob], { type: "application/pdf" });

            const url = window.URL.createObjectURL(pdfBlob);

            const numero =
                selectedDossier.factures?.[0]?.data_json?.facture?.numero || factureId;

            const safeFilename = `facture_${numero}`.replace(/[\/\\]/g, "_");

            const a = document.createElement("a");
            a.href = url;
            a.download = `${safeFilename}.pdf`;

            document.body.appendChild(a);
            a.click();

            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error(error);
            alert("Impossible de télécharger la facture");
        }
    };


    const getNextInvoiceNumber = async () => {
        const year = new Date().getFullYear().toString().slice(-2);

        const { data, error } = await supabase
            .from("factures")
            .select("data_json")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Filtrer uniquement les factures de l'année courante
        const currentYearInvoices = data.filter(f =>
            f?.data_json?.facture?.numero?.endsWith(`/${year}`)
        );

        if (currentYearInvoices.length === 0) {
            return `001/${year}`;
        }

        const lastNumber = currentYearInvoices[0].data_json.facture.numero;
        const lastIndex = parseInt(lastNumber.split("/")[0], 10);

        return `${String(lastIndex + 1).padStart(3, "0")}/${year}`;
    };

    const handleValidateInvoice = async () => {
        try {
            const nextInvoiceNumber = await getNextInvoiceNumber();

            const dataJson = {
                facture: {
                    numero: nextInvoiceNumber,
                    date: new Date().toISOString(),
                    dossier_no: selectedDossier.dossier_no,
                    navire: selectedDossier.navire || "",
                    date_arrivee: "",
                    conteneur: selectedDossier.ctu_lta?.split('"')[0] || "",
                    marque: selectedDossier.ctu_lta?.includes('"')
                        ? selectedDossier.ctu_lta.split('"').slice(1).join('"')
                        : "",
                    declaration_c: selectedDossier.declaration_no || "",
                    declaration_uc: "",
                    escale: selectedDossier.escale || "",
                    rubrique: selectedDossier.rubrique || "",
                    colisage: selectedDossier.colisage || "",
                    poids_brut: selectedDossier.pb || "",
                    valeur_douane: ""
                },

                client: {
                    code_client: selectedDossier.clientInfo?.code_client || "",
                    nom: selectedDossier.destinataire || "",
                    adresse: selectedDossier.clientInfo?.adresse || "",
                    code_tva: selectedDossier.clientInfo?.code_tva || ""
                },

                lignes: {
                    debours: invoiceRows.debours,
                    transit: invoiceRows.transit,
                    transport: invoiceRows.transport
                },

                totaux: {
                    total_non_taxable: debTotal,
                    total_taxable: taxTotal,
                    tva_7: tva7,
                    tva_19: tva,
                    timbre: timbre,
                    total_final: totalFinal
                }
            };

            const { error } = await supabase
                .from("factures")
                .insert([{
                    dossier_no: selectedDossier.dossier_no,
                    montant_total: totalFinal,
                    data_json: dataJson
                }]);

            if (error) throw error;

            // Créer automatiquement un enregistrement dans la table paiements
            const { error: paiementError } = await supabase
                .from("paiements")
                .insert([{
                    dossier_no: selectedDossier.dossier_no,
                    paye: false, // Par défaut non payé
                    montant: totalFinal,
                    date_creation: new Date().toISOString(),
                    date_maj: new Date().toISOString()
                }]);

            if (paiementError) {
                console.error("Erreur création paiement:", paiementError);
            }

            setSelectedDossier(prev => ({
                ...prev,
                dbFactureId: nextInvoiceNumber
            }));

            alert("✅ Facture enregistrée avec tous les champs !");
            fetchDossiers();
            setSelectedDossier(null);

        } catch (error) {
            console.error(error);
            alert("❌ Erreur : " + error.message);
        }
    };

    return (
        <div className="flex h-screen bg-zinc-100 font-sans text-black">
            <style>{`
                .invoice-page { width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; background: white; box-sizing: border-box; display: flex; flex-direction: column; position: relative; box-shadow: 0 0 20px rgba(0,0,0,0.2); }
                .invoice-header { display: flex; justify-content: space-between; margin-bottom: 25px; }
                .logo-img { max-width: 250px; height: auto; }
                .client-box { width: 280px; font-size: 12px; line-height: 1.4; border: 1px solid #eee; padding: 8px; text-align: left; }
                .info-container { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 20px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; }
                .info-col { width: 48%; text-align: left; }
                .info-row { display: flex; margin-bottom: 2px; }
                .info-label { width: 130px; font-weight: bold; }
                .info-value { flex: 1; border: none; outline: none; font-size: 11px; background: transparent; }
                .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .invoice-table th { text-align: left; font-size: 12px; border-bottom: 1px solid #000; padding: 8px; }
                .invoice-table td { padding: 4px 8px; font-size: 12px; border-bottom: 1px solid #f9f9f9; }
                .section-header { font-weight: bold; text-decoration: underline; background: #f2f2f2; padding: 10px 8px; text-align: left; }
                .amount-col { text-align: right; width: 130px; }
                .editable-input { border: none; width: 90%; background: transparent; outline: none; }
                .num-input { border: none; text-align: right; width: 100%; outline: none; font-family: monospace; font-size: 13px; background: transparent; }
                .totals-wrapper { display: flex; justify-content: flex-end; margin-top: 10px; }
                .totals-table { width: 280px; }
                .totals-table td { border: none; padding: 3px 8px; font-size: 13px; }
                .total-final { font-weight: bold; font-size: 15px; border-top: 2px solid #000 !important; }
                .total-phrase-row { margin-top: auto; padding: 15px 0; font-size: 13px; border-top: 1px solid #000; text-align: left; }
                .invoice-footer { display: flex; justify-content: space-between; font-size: 10px; padding-top: 5px; text-align: left; }
                .btn-add { font-size: 10px; margin-left: 10px; cursor: pointer; background: #eee; border: 1px solid #ccc; padding: 2px 5px; border-radius: 3px; color: black; }
                .btn-del { color: red; cursor: pointer; font-weight: bold; margin-right: 5px; }
                
                .status-badge {
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    min-width: 100px;
                    text-align: center;
                    display: inline-block;
                }
                .status-non-paye {
                    background-color: #fee2e2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                }
                .status-paye {
                    background-color: #dcfce7;
                    color: #16a34a;
                    border: 1px solid #bbf7d0;
                }
                .status-badge:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .filter-container {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .filter-select {
                    background-color: white;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 14px;
                    cursor: pointer;
                }
                
                .montants-summary {
                    background-color: white;
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    border: 1px solid #e5e7eb;
                }
                .montant-total {
                    font-size: 18px;
                    font-weight: bold;
                    color: #dc2626;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .montants-clients {
                    max-height: 200px;
                    overflow-y: auto;
                }
                .client-montant {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f3f4f6;
                    font-size: 14px;
                }
                .client-montant:last-child {
                    border-bottom: none;
                }
                .montant-value {
                    font-weight: 600;
                    color: #374151;
                }
                .client-count {
                    background-color: #f3f4f6;
                    color: #6b7280;
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-weight: 500;
                }
                
                .section-header-row {
                    background-color: #f8fafc;
                    font-weight: bold;
                    font-size: 14px;
                    padding: 12px 24px;
                    border-bottom: 2px solid #e2e8f0;
                    color: #475569;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .count-badge {
                    background-color: #3b82f6;
                    color: white;
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-weight: 500;
                }
                
                .empty-message {
                    text-align: center;
                    padding: 40px;
                    color: #94a3b8;
                    font-style: italic;
                }
                
                @media print { 
                    .no-print { display: none !important; } 
                    body { background: white; }
                    .invoice-page { box-shadow: none; margin: 0; width: 100%; }
                }
            `}</style>

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
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden no-print">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between">
                    <h1 className="text-xl font-bold">Suivi & Facturation</h1>
                </header>

                <div className="p-6 overflow-auto">
                    <div className="filter-container">
                        <input
                            type="text"
                            placeholder="Rechercher par dossier ou client"
                            className="flex-1 bg-zinc-50 border-none rounded-xl px-5 py-3 text-sm focus:ring-1 focus:ring-black outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        <select
                            className="filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="tous">Tous les statuts</option>
                            <option value="payé">Payé</option>
                            <option value="non payé">Non payé</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        {/* Section NON PAYÉS */}
                        {statusFilter === "tous" || statusFilter === "non payé" ? (
                            <>
                                <div className="section-header-row">
                                    <span>Dossiers Non Payés</span>
                                    <span className="count-badge">{dossiersNonPayes.length} dossier(s)</span>
                                </div>

                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b text-[11px] uppercase text-zinc-500">
                                            <th className="px-6 py-4">Dossier</th>
                                            <th className="px-6 py-4">Destinataire</th>
                                            <th className="px-6 py-4">Facture N°</th>
                                            <th className="px-6 py-4">Montant facture</th>
                                            <th className="px-6 py-4">Statut</th>
                                            <th className="px-6 py-4">Actions</th>
                                            <th className="px-6 py-4 text-right">Facture</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {dossiersNonPayes.map((d) => (
                                            <tr key={d.dossier_no} className="hover:bg-zinc-50">
                                                <td className="px-6 py-4 font-bold text-red-600">{d.dossier_no}</td>
                                                <td className="px-6 py-4">{d.destinataire}</td>
                                                <td className="px-6 py-4">{d.factures?.[0]?.data_json?.facture?.numero || "—"}</td>
                                                <td className="px-6 py-4 font-mono">{Number(d.dbMontant).toFixed(3)}</td>
                                                <td className="px-6 py-4">
                                                    <div
                                                        className={`status-badge ${d.status === 'payé' ? 'status-paye' : 'status-non-paye'}`}
                                                        onClick={() => handleStatusClick(d)}
                                                        title="Cliquer pour changer le statut"
                                                    >
                                                        {d.status}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => navigate(`/modifier-dossier/${d.dossier_no}`)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-[11px] uppercase"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button onClick={() => handleDelete(d.dossier_no)} className="text-red-500 hover:text-red-700 font-medium text-[11px] uppercase">Supprimer</button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => setSelectedDossier(d)} className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-4 py-2 rounded">Ouvrir Facture</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {dossiersNonPayes.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    Aucun dossier non payé trouvé
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </>
                        ) : null}

                        {/* Section PAYÉS */}
                        {statusFilter === "tous" || statusFilter === "payé" ? (
                            <>
                                <div className="section-header-row">
                                    <span>Dossiers Payés</span>
                                    <span className="count-badge">{dossiersPayes.length} dossier(s)</span>
                                </div>

                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b text-[11px] uppercase text-zinc-500">
                                            <th className="px-6 py-4">Dossier</th>
                                            <th className="px-6 py-4">Destinataire</th>
                                            <th className="px-6 py-4">Facture N°</th>
                                            <th className="px-6 py-4">Montant facture</th>
                                            <th className="px-6 py-4">Statut</th>
                                            <th className="px-6 py-4">Actions</th>
                                            <th className="px-6 py-4 text-right">Facture</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {dossiersPayes.map((d) => (
                                            <tr key={d.dossier_no} className="hover:bg-zinc-50">
                                                <td className="px-6 py-4 font-bold text-red-600">{d.dossier_no}</td>
                                                <td className="px-6 py-4">{d.destinataire}</td>
                                                <td className="px-6 py-4">{d.factures?.[0]?.data_json?.facture?.numero || "—"}</td>
                                                <td className="px-6 py-4 font-mono">{Number(d.dbMontant).toFixed(3)}</td>
                                                <td className="px-6 py-4">
                                                    <div
                                                        className={`status-badge ${d.status === 'payé' ? 'status-paye' : 'status-non-paye'}`}
                                                        onClick={() => handleStatusClick(d)}
                                                        title="Cliquer pour changer le statut"
                                                    >
                                                        {d.status}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => navigate(`/modifier-dossier/${d.dossier_no}`)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-[11px] uppercase"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button onClick={() => handleDelete(d.dossier_no)} className="text-red-500 hover:text-red-700 font-medium text-[11px] uppercase">Supprimer</button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => setSelectedDossier(d)} className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-4 py-2 rounded">Ouvrir Facture</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {dossiersPayes.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    Aucun dossier payé trouvé
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </>
                        ) : null}
                    </div>

                    {/* Section des montants non payés */}
                    {(statusFilter === "tous" || statusFilter === "non payé") && (
                        <div className="montants-summary">
                            <div className="montant-total">
                                <span>Total non payé : {montantsNonPayes.total.toFixed(3)} TND</span>
                                <span className="client-count">
                                    {Object.keys(montantsNonPayes.parClient).length} client(s)
                                </span>
                            </div>

                            {Object.keys(montantsNonPayes.parClient).length > 0 && (
                                <div className="montants-clients">
                                    <h3 className="font-semibold text-gray-700 mb-3">Montants non payés par client :</h3>
                                    {Object.entries(montantsNonPayes.parClient).map(([key, clientData]) => (
                                        <div key={key} className="client-montant">
                                            <span>{clientData.nom}</span>
                                            <span className="montant-value">{clientData.montant.toFixed(3)} TND</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {Object.keys(montantsNonPayes.parClient).length === 0 && (
                                <div className="text-center text-gray-500 py-4">
                                    {statusFilter === "non payé"
                                        ? "Aucun montant non payé pour les critères sélectionnés"
                                        : "Aucun dossier non payé"}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {selectedDossier && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center overflow-y-auto py-10 no-print">
                    <div className="relative">
                        {/* Boutons de contrôle */}
                        <div className="absolute -left-24 top-0 flex flex-col gap-4 no-print">
                            <button onClick={() => setSelectedDossier(null)} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-gray-100">✕</button>
                            <button onClick={handleDownload} className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-blue-700">📥</button>
                            <button onClick={handleValidateInvoice} className="w-12 h-12 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-green-700" title="Valider et Enregistrer">✅</button>
                        </div>

                        {/* Zone PDF */}
                        <div id="invoice-content" className="invoice-page">
                            <div className="invoice-header">
                                <div className="logo"><img src={logo} alt="Logo" className="logo-img" /></div>
                                <div className="client-box">
                                    Code client : {selectedDossier.clientInfo?.code_client || "---"}<br />
                                    <strong>Client : {selectedDossier.destinataire}</strong><br />
                                    Adresse : {selectedDossier.clientInfo?.adresse || "---"}<br />
                                    Code TVA : {selectedDossier.clientInfo?.code_tva || "---"}
                                </div>
                            </div>

                            <div className="info-container">
                                <div className="info-col">
                                    <div className="info-row"><span className="info-label">Facture n° :</span><input className="info-value" defaultValue={`${selectedDossier.factures?.[0]?.data_json?.facture?.numero || "—"}`} /></div>
                                    <div className="info-row"><span className="info-label">Date Facture :</span><input className="info-value" defaultValue={new Date().toLocaleDateString('fr-FR')} /></div>
                                    <div className="info-row"><span className="info-label">Dossier import n° :</span><input className="info-value" defaultValue={selectedDossier.dossier_no} /></div>
                                    <div className="info-row"><span className="info-label">Navire :</span><input className="info-value" defaultValue={selectedDossier.navire || ""} /></div>
                                    <div className="info-row"><span className="info-label">Date d'arrivée :</span><input className="info-value" defaultValue={selectedDossier.date_dest || ""} /></div>
                                    <div className="info-row">
                                        <span className="info-label">Conteneur :</span>
                                        <input className="info-value" defaultValue={selectedDossier.ctu_lta?.split('"')[0] + (selectedDossier.ctu_lta?.includes('"') ? '"' : '')} />
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Marque :</span>
                                        <input className="info-value" defaultValue={selectedDossier.ctu_lta?.includes('"') ? selectedDossier.ctu_lta.split('"').slice(1).join('"') : " "} />
                                    </div>
                                </div>
                                <div className="info-col">
                                    <div className="info-row"><span className="info-label">Déclaration C n° :</span><input className="info-value" defaultValue={selectedDossier.declaration_no || ""} /></div>
                                    <div className="info-row"><span className="info-label">Déclaration UC n° :</span><input className="info-value" defaultValue={""} /></div>
                                    <div className="info-row"><span className="info-label">Escale n° :</span><input className="info-value" defaultValue={selectedDossier.escale || ""} /></div>
                                    <div className="info-row"><span className="info-label">Rubrique :</span><input className="info-value" defaultValue={selectedDossier.rubrique || ""} /></div>
                                    <div className="info-row"><span className="info-label">Colisage :</span><input className="info-value" defaultValue={selectedDossier.colisage || ""} /></div>
                                    <div className="info-row"><span className="info-label">Poids Brut :</span><input className="info-value" defaultValue={selectedDossier.pb || ""} /></div>
                                    <div className="info-row"><span className="info-label">Valeur Douane:</span><input className="info-value" defaultValue={selectedDossier.valeur_dinars || ""} /></div>
                                </div>
                            </div>

                            <InvoiceTable
                                rows={invoiceRows}
                                setRows={setInvoiceRows}
                                timbre={timbre}
                                setTimbre={setTimbre}
                                totals={{ debTotal, taxTotal, tva, tva7, totalFinal }}
                            />

                            <div className="invoice-footer">
                                <div>
                                    <div className="font-bold">EDEN TRANSPORT INTERNATIONAL<br />
                                        Transport multimodal - Groupage - Transit </div>
                                    <div className="font-semibold">Code TVA : 763530P/A/M/000<br />
                                        R.C : B130912001</div>
                                </div>
                                <div className="text-right">
                                    19 bis, Av. Habib Bourguiba - 2033 Megrine <br />
                                    Tél. : (+216) 71 42 89 15 - 71 42 76 76<br />
                                    Fax : (+216) 71 42 85 07<br />
                                    Email : eden.tir@planet.tn
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InvoiceTable({ rows, setRows, timbre, setTimbre, totals }) {
    const updateValue = (section, index, field, value) => {
        const newRows = { ...rows };
        newRows[section][index][field] = field === 'montant' ? parseFloat(value || 0) : value;
        setRows(newRows);
    };

    const addRow = (section) => {
        setRows({ ...rows, [section]: [...rows[section], { label: `Nouvelle prestation...`, montant: 0 }] });
    };

    const removeRow = (section, index) => {
        const newRows = { ...rows };
        newRows[section].splice(index, 1);
        setRows(newRows);
    };

    return (
        <>
            <table className="invoice-table">
                <tbody>
                    <tr className="section-header"><td colSpan="2">DEBOURS <button className="btn-add no-print" onClick={() => addRow('debours')}>+ Ajouter</button></td></tr>
                    {rows.debours.map((r, i) => (
                        <tr key={i}>
                            <td><span className="btn-del no-print" onClick={() => removeRow('debours', i)}>×</span><input className="editable-input" value={r.label} onChange={(e) => updateValue('debours', i, 'label', e.target.value)} /></td>
                            <td className="amount-col"><input type="number" step="0.001" className="num-input" value={r.montant.toFixed(3)} onChange={(e) => updateValue('debours', i, 'montant', e.target.value)} /></td>
                        </tr>
                    ))}
                    <tr className="section-header"><td colSpan="2">TRANSIT <button className="btn-add no-print" onClick={() => addRow('transit')}>+ Ajouter</button></td></tr>
                    {rows.transit.map((r, i) => (
                        <tr key={i}>
                            <td><span className="btn-del no-print" onClick={() => removeRow('transit', i)}>×</span><input className="editable-input" value={r.label} onChange={(e) => updateValue('transit', i, 'label', e.target.value)} /></td>
                            <td className="amount-col"><input type="number" step="0.001" className="num-input" value={r.montant.toFixed(3)} onChange={(e) => updateValue('transit', i, 'montant', e.target.value)} /></td>
                        </tr>
                    ))}
                    <tr className="section-header"><td colSpan="2">TRANSPORT <button className="btn-add no-print" onClick={() => addRow('transport')}>+ Ajouter</button></td></tr>
                    {rows.transport.map((r, i) => (
                        <tr key={i}>
                            <td><span className="btn-del no-print" onClick={() => removeRow('transport', i)}>×</span><input className="editable-input" value={r.label} onChange={(e) => updateValue('transport', i, 'label', e.target.value)} /></td>
                            <td className="amount-col"><input type="number" step="0.001" className="num-input" value={r.montant.toFixed(3)} onChange={(e) => updateValue('transport', i, 'montant', e.target.value)} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="totals-wrapper">
                <table className="totals-table">
                    <tbody>
                        <tr><td>Total non Taxable :</td><td className="amount-col">{totals.debTotal.toFixed(3)}</td></tr>
                        <tr><td>Total Taxables :</td><td className="amount-col">{totals.taxTotal.toFixed(3)}</td></tr>
                        <tr><td>TVA 7% :</td><td className="amount-col">{totals.tva7.toFixed(3)}</td></tr>
                        <tr><td>TVA 19% :</td><td className="amount-col">{totals.tva.toFixed(3)}</td></tr>
                        <tr><td>Timbre Fiscal :</td><td className="amount-col"><input type="number" step="0.001" className="num-input" value={timbre.toFixed(3)} onChange={(e) => setTimbre(parseFloat(e.target.value || 0))} /></td></tr>
                        <tr className="total-final"><td>Total Facture en TND</td><td className="amount-col">{totals.totalFinal.toFixed(3)}</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="total-phrase-row">
                <strong>Total en votre aimable règlement : </strong>
                <span className="italic">{Math.floor(totals.totalFinal)} Dinars, {Math.round((totals.totalFinal % 1) * 1000)} millimes</span>
            </div>
        </>
    );
}

function NavItem({ label, active = false, to = "/" }) {
    return (
        <Link to={to} className="block no-underline">
            <div className={`px-4 py-3 rounded-xl cursor-pointer text-sm font-medium transition ${active ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-white hover:bg-zinc-900"}`}>
                {label}
            </div>
        </Link>
    );
}