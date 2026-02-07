import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../logo.png";
import { Link } from "react-router-dom";

export default function FactureModifier() {
    const { dossier_no } = useParams();
    const navigate = useNavigate();

    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // États des champs modifiables
    const [declarationUC, setDeclarationUC] = useState("");
    const [timbre, setTimbre] = useState(1.0);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceRows, setInvoiceRows] = useState({
        debours: [],
        transit: [],
        transport: []
    });

    useEffect(() => {
        fetchFactureData();
    }, [dossier_no]);

    const fetchFactureData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("dossiers")
                .select(`*, factures(*)`)
                .eq("dossier_no", dossier_no)
                .single();

            if (error) throw error;

            if (!data.factures || data.factures.length === 0) {
                alert("Aucune facture trouvée pour ce dossier.");
                navigate("/archive");
                return;
            }

            const factureExistante = data.factures[0];
            const json = factureExistante.data_json;

            const nomClientRecherche =
                data.mode === "import"
                    ? data.destinataire
                    : data.mode === "export"
                        ? data.expediteur
                        : null;

            let clientData = [];

            if (nomClientRecherche) {
                const { data: clients } = await supabase
                    .from("clients")
                    .select("*")
                    .ilike("nom_client", nomClientRecherche.trim());

                clientData = clients || [];
            }

            setDossier({
                ...data,
                clientNom: nomClientRecherche || "",
                clientInfo: clientData?.[0] || {},
                dbFactureId: data.factures?.[0]?.id || null
            });

            if (json.lignes) setInvoiceRows(json.lignes);
            setInvoiceNumber(json.facture?.numero || "");
            setDeclarationUC(json.facture?.declaration_uc || "");
            setTimbre(json.totaux?.timbre || 1.0);

        } catch (error) {
            console.error("Erreur chargement:", error);
            alert("Erreur lors de la récupération des données.");
        } finally {
            setLoading(false);
        }
    };

    const debTotal = useMemo(() => invoiceRows.debours.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);
    const transitTotal = useMemo(() => invoiceRows.transit.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);
    const transportTotal = useMemo(() => invoiceRows.transport.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);

    const tva19 = transitTotal * 0.19;
    const tva7 = transportTotal * 0.07;
    const taxTotal = transitTotal + transportTotal;
    const totalFinal = debTotal + taxTotal + tva19 + tva7 + timbre;

    const handleDownloadPDF = async () => {
        if (!dossier?.dbFactureId) {
            alert("Facture non encore enregistrée");
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL;
        try {
            const response = await fetch(`${API_URL}/facture/${dossier.dbFactureId}`, {
                method: "GET",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Erreur téléchargement");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `facture_${dossier_no}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error(error);
            alert("Impossible de télécharger la facture");
        }
    };




    const handleUpdate = async () => {
        try {
            setSaving(true);

            const nomClient =
                dossier.mode === "import"
                    ? dossier.destinataire
                    : dossier.mode === "export"
                        ? dossier.expediteur
                        : "";

            const date_arrive_sortie =
                dossier.mode === "import"
                    ? dossier.date_dest
                    : dossier.mode === "export"
                        ? dossier.date_emb
                        : "";

            // Reconstruction du JSON selon le format du 2ème code
            const updatedDataJson = {
                facture: {
                    numero: invoiceNumber,
                    date: new Date().toLocaleDateString('fr-FR'),
                    dossier_no: dossier_no,
                    mode: dossier.mode,
                    navire: dossier.navire || "",
                    date_arrivee: date_arrive_sortie,
                    conteneur: dossier.ctu_lta?.split('"')[0] || "",
                    marque: dossier.ctu_lta?.includes('"') ? dossier.ctu_lta.split('"').slice(1).join('"') : "",
                    declaration_c: dossier.declaration_no && dossier.date_declaration
                        ? `${dossier.declaration_no} du ${dossier.date_declaration}`
                        : "",
                    declaration_uc: declarationUC,
                    escale: dossier.escale || "",
                    rubrique: dossier.rubrique || "",
                    colisage: dossier.colisage || "",
                    poids_brut: dossier.pb || "",
                    valeur_douane: dossier.valeur_dinars || "",
                    date_modification: new Date().toISOString()
                },
                client: {
                    code_client: dossier.clientInfo?.code_client || "",
                    nom: nomClient,
                    adresse: dossier.clientInfo?.adresse || "",
                    code_tva: dossier.clientInfo?.code_tva || ""
                },
                lignes: invoiceRows,
                totaux: {
                    total_non_taxable: debTotal,
                    total_taxable: taxTotal,
                    tva_7: tva7,
                    tva_19: tva19,
                    timbre: timbre,
                    total_final: totalFinal
                }
            };

            const { error: errorFact } = await supabase
                .from("factures")
                .update({
                    montant_total: totalFinal,
                    data_json: updatedDataJson
                })
                .eq("id", dossier.dbFactureId);

            if (errorFact) throw errorFact;

            await supabase
                .from("paiements")
                .update({
                    montant: totalFinal,
                    date_maj: new Date().toISOString()
                })
                .eq("dossier_no", dossier_no);

            alert("✅ Facture mise à jour avec succès !");
            navigate("/archive");

        } catch (error) {
            alert("❌ Erreur : " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateValue = (section, index, field, value) => {
        const copy = { ...invoiceRows };
        copy[section][index][field] = value;
        setInvoiceRows(copy);
    };

    const addRow = (section) => {
        setInvoiceRows({
            ...invoiceRows,
            [section]: [...invoiceRows[section], { label: "Nouvelle ligne", montant: 0 }]
        });
    };

    const removeRow = (section, index) => {
        const copy = { ...invoiceRows };
        copy[section].splice(index, 1);
        setInvoiceRows(copy);
    };

    if (loading) return <div className="p-10 text-center">Chargement des données...</div>;

    return (
        <div className="flex h-screen bg-white font-sans text-black">
            <Sidebar />

            <main className="flex-1 bg-zinc-50 overflow-y-auto">
                <header className="h-20 bg-white border-b border-zinc-100 flex items-center px-10 sticky top-0 z-20">
                    <h1 className="text-xl font-bold uppercase">
                        Modification Facture {invoiceNumber}
                    </h1>
                </header>

                <div className="p-10 flex justify-center">
                    <div className="max-w-[900px] w-full bg-white shadow-2xl p-10 border border-zinc-300">
                        {/* ENTETE */}
                        <div className="flex justify-between items-start mb-6">
                            <img src={logo} alt="Logo" className="w-72" />
                            <div className="border border-zinc-300 p-4 w-[380px] leading-relaxed">
                                <div className="text-[11px]">Code client : {dossier.clientInfo.code_client}</div>
                                <div className="font-bold text-[15px] my-1 uppercase">Client : {
                                    dossier.mode === "export"
                                        ? dossier.expediteur
                                        : dossier.destinataire
                                }</div>
                                <div className="text-[11px]">Adresse : {dossier.clientInfo.adresse}</div>
                                <div className="text-[11px]">Code TVA : {dossier.clientInfo.code_tva}</div>
                            </div>
                        </div>

                        <hr className="border-black border-t-2 mb-6" />

                        {/* INFOS DOSSIER - CHAMPS COMPLETS COMME LE 2EME CODE */}
                        <div className="grid grid-cols-2 gap-x-16 mb-8">
                            <div className="space-y-1">
                                <InfoRow label="Facture n° :" value={invoiceNumber} />
                                <InfoRow label="Dossier import n° :" value={dossier.dossier_no} />
                                <InfoRow label="Navire :" value={dossier.navire} />
                                <InfoRow
                                    label={dossier.mode === "export"
                                        ? "Date de sortie :"
                                        : "Date d'arrivée :"}
                                    value={dossier.mode === "export"
                                        ? dossier.date_emb
                                        : dossier.date_dest}
                                    isEditable={true}
                                />
                                <InfoRow label="Conteneur :" value={dossier.ctu_lta?.split('"')[0] + '"'} />
                                <InfoRow label="Marque :" value={dossier.ctu_lta?.includes('"') ? dossier.ctu_lta.split('"').slice(1).join('"') : ""} />
                            </div>

                            <div className="space-y-1">
                                <InfoRow label={dossier.mode === "export" ? "Déclaration E n° :" : "Déclaration C n°"} value={dossier.declaration_no && dossier.date_declaration
                                    ? `${dossier.declaration_no} du ${dossier.date_declaration}`
                                    : ""} isEditable={true} />
                                <div className="flex items-center">
                                    <span className="w-36 font-bold">Déclaration UC :</span>
                                    <input
                                        className="flex-1 border-b border-zinc-300 outline-none focus:border-black transition-colors"
                                        value={declarationUC}
                                        onChange={(e) => setDeclarationUC(e.target.value)}
                                    />
                                </div>
                                <InfoRow label="Escale n° :" value={dossier.escale} />
                                <InfoRow label="Rubrique :" value={dossier.rubrique} />
                                <InfoRow label="Poids Brut :" value={dossier.pb} />
                                <InfoRow label="Valeur Douane :" value={dossier.valeur_dinars} />
                            </div>
                        </div>

                        {/* TABLES */}
                        <div className="space-y-6">
                            <SectionTable title="DEBOURS" rows={invoiceRows.debours} onAdd={() => addRow('debours')} onRemove={(i) => removeRow('debours', i)} onChange={(i, f, v) => updateValue('debours', i, f, v)} />
                            <SectionTable title="TRANSIT" rows={invoiceRows.transit} onAdd={() => addRow('transit')} onRemove={(i) => removeRow('transit', i)} onChange={(i, f, v) => updateValue('transit', i, f, v)} />
                            <SectionTable title="TRANSPORT" rows={invoiceRows.transport} onAdd={() => addRow('transport')} onRemove={(i) => removeRow('transport', i)} onChange={(i, f, v) => updateValue('transport', i, f, v)} />
                        </div>

                        {/* TOTAUX */}
                        <div className="mt-8 flex justify-end">
                            <div className="w-[320px] space-y-1 text-sm border-t border-zinc-200 pt-4">
                                <TotalRow label="Total non Taxable :" value={debTotal} />
                                <TotalRow label="Total Taxables :" value={taxTotal} />
                                <TotalRow label="TVA 7% :" value={tva7} />
                                <TotalRow label="TVA 19% :" value={tva19} />
                                <div className="flex justify-between py-1">
                                    <span>Timbre Fiscal :</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-20 text-right font-bold border-b border-zinc-300 outline-none"
                                        value={timbre}
                                        onChange={(e) => setTimbre(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex justify-between border-t border-black pt-2 text-[16px] font-extrabold uppercase">
                                    <span>Nouveau Total TND</span>
                                    <span>{totalFinal.toFixed(3)}</span>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-4 mt-12 print:hidden">
                            <button
                                type="button"
                                onClick={() => navigate("/archive")}
                                className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-bold uppercase hover:bg-gray-300 transition"
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
                                type="button"
                                onClick={handleUpdate}
                                disabled={saving}
                                className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase hover:bg-zinc-800 transition disabled:bg-zinc-400"
                            >
                                {saving ? "Mise à jour..." : "Enregistrer les modifications"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Composants internes (Sidebar, NavItem, InfoRow, SectionTable, TotalRow restent identiques)
function Sidebar() {
    return (
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
                <NavItem label="Création d'un dossier" to="/creation-dossier" />
                <NavItem label="Suivi des dossiers" to="/archive" active />
                <NavItem label="Clients" to="/client" />
            </nav>
        </aside>
    );
}

function NavItem({ label, active, to }) {
    return (
        <Link to={to} className="block no-underline">
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${active ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>
                {label}
            </div>
        </Link>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex items-center">
            <span className="w-36 font-bold">{label}</span>
            <span className="flex-1 border-b border-transparent py-0.5">{value || "-"}</span>
        </div>
    );
}

function SectionTable({ title, rows, onAdd, onRemove, onChange }) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-4 bg-zinc-50 border-y border-zinc-200 px-3 py-1.5 mb-2">
                <h3 className="font-extrabold text-[12px] tracking-wider uppercase">{title}</h3>
                <button onClick={onAdd} className="text-[10px] font-bold border border-zinc-400 px-2 rounded bg-white hover:bg-zinc-100">+ Ajouter</button>
            </div>
            <table className="w-full">
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className="group border-b border-zinc-50">
                            <td className="w-8 text-center">
                                <button onClick={() => onRemove(i)} className="text-red-400 opacity-0 group-hover:opacity-100 transition">×</button>
                            </td>
                            <td className="py-0.5">
                                <input
                                    className="w-full bg-transparent outline-none border-b border-transparent focus:border-zinc-300"
                                    value={r.label}
                                    onChange={(e) => onChange(i, "label", e.target.value)}
                                />
                            </td>
                            <td className="w-40">
                                <input
                                    type="number"
                                    step="0.001"
                                    className="w-full text-right bg-transparent outline-none font-mono focus:bg-zinc-100"
                                    value={r.montant}
                                    onChange={(e) => onChange(i, "montant", parseFloat(e.target.value) || 0)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TotalRow({ label, value }) {
    return (
        <div className="flex justify-between py-0.5 font-medium">
            <span>{label}</span>
            <span className="font-mono">{value.toFixed(3)}</span>
        </div>
    );
}