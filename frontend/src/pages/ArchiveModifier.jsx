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

    const handleOpenFacture = (d) => {
        const montant = parseFloat(d.dbMontant) || 0;
        const numeroFacture = d.factures?.[0]?.data_json?.facture?.numero;

        // Condition : Montant est 0 ET pas de numéro de facture
        if (montant === 0 && !numeroFacture) {
            navigate(`/facture/${d.dossier_no}`);
        } else {
            navigate(`/modfacture/${d.dossier_no}`);
        }
    };

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

            const enriched = (dossiersData || []).map(d => {
                const facture = d.factures?.[0];
                const paiement = paiementsData?.find(p => p.dossier_no === d.dossier_no);

                // Normaliser le nom du destinataire
                const destinataireNormalise = d.destinataire?.trim() || "";

                return {
                    ...d,
                    clientInfo: clientsData?.find(c => {
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
                .maybeSingle();

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

    return (
        <div className="flex h-screen bg-zinc-100 font-sans text-black">
            <style>{`
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
                
                @media print { 
                    .no-print { display: none !important; } 
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
                        {(statusFilter === "tous" || statusFilter === "non payé") && (
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
                                                    <button
                                                        onClick={() => handleOpenFacture(d)}
                                                        className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-4 py-2 rounded"
                                                    >
                                                        Ouvrir Facture
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {dossiersNonPayes.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Aucun dossier non payé trouvé</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {/* Section PAYÉS */}
                        {(statusFilter === "tous" || statusFilter === "payé") && (
                            <>
                                <div className="section-header-row mt-4">
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
                                                    <button
                                                        onClick={() => handleOpenFacture(d)}
                                                        className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-4 py-2 rounded"
                                                    >
                                                        Ouvrir Facture
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {dossiersPayes.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Aucun dossier payé trouvé</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    {/* Résumé des montants */}
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
                        </div>
                    )}
                </div>
            </main>
        </div>
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
