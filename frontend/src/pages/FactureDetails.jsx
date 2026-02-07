import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../logo.png";
import { Link } from "react-router-dom";

export default function FactureDetails() {
    const { dossier_no } = useParams();
    const navigate = useNavigate();

    const [dossier, setDossier] = useState(null);
    const [declarationUC, setDeclarationUC] = useState("");
    const [timbre, setTimbre] = useState(1.0);
    const [loading, setLoading] = useState(false);

    const [invoiceRows, setInvoiceRows] = useState({
        debours: [
            { label: "Droits & taxes C", montant: 19.0 },
            { label: "Droits & taxes UC", montant: 119.0 },
            { label: "Pénalité en douane (dépôt tardif)", montant: 100.0 },
            { label: "Pénalité en douane (Enlèvement tardif)", montant: 300.0 },
            { label: "Frais portuaire", montant: 130.0 },
            { label: "Frais de visite du conteneur au port", montant: 150.0 },
            { label: "Assurance", montant: 62.420 },
            { label: "Timbres douane", montant: 25.000 }
        ],
        transit: [
            { label: "Honoraires", montant: 250.0 },
            { label: "Formalité déclaration UC", montant: 30.0 },
            { label: "Traitement informatique", montant: 30.0 },
            { label: "Etablissement TCE", montant: 20.0 },
            { label: "Etablissement bon de sortie", montant: 25.0 },
            { label: "Frais fixes", montant: 50.0 }
        ],
        transport: [
            { label: "Frais de transport d'un conteneur 20\"", montant: 280.0 }
        ]
    });

    useEffect(() => {
        fetchDossier();
    }, [dossier_no]);

    const fetchDossier = async () => {
        const { data, error } = await supabase
            .from("dossiers")
            .select(`*, factures(*)`)
            .eq("dossier_no", dossier_no)
            .single();

        if (error) return console.error(error);

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

        if (data?.factures?.[0]) {
            const f = data.factures[0].data_json;
            if (f.lignes) setInvoiceRows(f.lignes);
            setDeclarationUC(f.facture?.declaration_uc || "");
            setTimbre(f.facture?.timbre || 1);
        }
    };

    /* ================= CALCULS ================= */
    const debTotal = useMemo(() => invoiceRows.debours.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);
    const transitTotal = useMemo(() => invoiceRows.transit.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);
    const transportTotal = useMemo(() => invoiceRows.transport.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0), [invoiceRows]);

    const tva19 = transitTotal * 0.19;
    const tva7 = transportTotal * 0.07;
    const taxTotal = transitTotal + transportTotal;
    const totalFinal = debTotal + taxTotal + tva19 + tva7 + timbre;

    /* ================= ACTIONS ================= */

    const handleCancel = () => {
        navigate("/archive");
    };

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
            setLoading(true);
            const nextInvoiceNumber = await getNextInvoiceNumber();


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


            const dataJson = {
                facture: {
                    numero: nextInvoiceNumber,
                    date: new Date().toLocaleDateString('fr-FR'),
                    dossier_no: dossier_no,
                    mode: dossier.mode,
                    navire: dossier.navire || "",
                    date_arrivee: date_arrive_sortie,
                    conteneur: dossier.ctu_lta?.split('"')[0] || "",
                    marque: dossier.ctu_lta?.includes('"') ? dossier.ctu_lta.split('"').slice(1).join('"') : "",
                    declaration_c:
                        dossier.declaration_no && dossier.date_declaration
                            ? `${dossier.declaration_no} du ${dossier.date_declaration}`
                            : "",
                    declaration_uc: declarationUC,
                    escale: dossier.escale || "",
                    rubrique: dossier.rubrique || "",
                    colisage: dossier.colisage || "",
                    poids_brut: dossier.pb || "",
                    valeur_douane: dossier.valeur_dinars || ""
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
            // Sauvegarde Facture
            let factureResult;
            if (dossier.factures?.[0]) {
                factureResult = await supabase
                    .from("factures")
                    .update({ montant_total: totalFinal, data_json: dataJson })
                    .eq("id", dossier.factures[0].id)
                    .select().single();
            } else {
                factureResult = await supabase
                    .from("factures")
                    .insert([{ dossier_no, montant_total: totalFinal, data_json: dataJson }])
                    .select().single();
            }

            if (factureResult.error) throw factureResult.error;

            // Gestion Paiement (Vérifier si existe d'abord pour éviter l'erreur de contrainte)
            const { data: existingPaiement } = await supabase
                .from("paiements")
                .select("id")
                .eq("dossier_no", dossier_no)
                .single();

            if (existingPaiement) {
                await supabase
                    .from("paiements")
                    .update({ montant: totalFinal, date_maj: new Date().toISOString() })
                    .eq("id", existingPaiement.id);
            } else {
                await supabase
                    .from("paiements")
                    .insert([{
                        dossier_no: dossier_no,
                        paye: false,
                        montant: totalFinal,
                        date_creation: new Date().toISOString(),
                        date_maj: new Date().toISOString()
                    }]);
            }

            setDossier(prev => ({ ...prev, dbFactureId: factureResult.data.id }));
            alert("✅ Facture enregistrée avec succès !");
            fetchDossier();

        } catch (error) {
            console.error(error);
            alert("❌ Erreur : " + error.message);
        } finally {
            setLoading(false);
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

    if (!dossier) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="flex h-screen bg-white font-sans text-black">
            <Sidebar />

            <main className="flex-1 bg-zinc-50 overflow-y-auto min-h-screen">
                <header className="h-20 bg-white border-b border-zinc-100 flex items-center px-10 sticky top-0 z-20">
                    <h1 className="text-xl font-bold tracking-tight uppercase">
                        Facture du Dossier {dossier_no}
                    </h1>
                </header>


                <div className="p-10 flex justify-center">
                    <div className="max-w-[900px] w-full bg-white shadow-2xl p-10 border border-zinc-300">
                        {/* ENTETE LOGO */}
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

                        {/* INFOS DOSSIER */}
                        <div className="grid grid-cols-2 gap-x-16 mb-8">

                            <div className="space-y-1">

                                <InfoRow label="Facture n° :" value={dossier.factures?.[0]?.data_json?.facture?.numero} />

                                <InfoRow label="Date Facture :" value={new Date().toLocaleDateString('fr-FR')} isEditable={true} />

                                <InfoRow label="Dossier import n° :" value={dossier.dossier_no} isEditable={true} />

                                <InfoRow label="Navire :" value={dossier.navire} isEditable={true} />

                                <InfoRow
                                    label={dossier.mode === "export"
                                        ? "Date de sortie :"
                                        : "Date d'arrivée :"}
                                    value={dossier.mode === "export"
                                        ? dossier.date_emb
                                        : dossier.date_dest}
                                    isEditable={true}
                                />

                                <InfoRow label="Conteneur :" value={dossier.ctu_lta?.split('"')[0] + '"'} isEditable={true} />

                                <InfoRow label="Marque :" value={dossier.ctu_lta?.includes('"') ? dossier.ctu_lta.split('"').slice(1).join('"') : ""} isEditable={true} />

                            </div>



                            <div className="space-y-1">

                                <InfoRow label={dossier.mode === "export" ? "Déclaration E n° :" : "Déclaration C n°"} value={dossier.declaration_no && dossier.date_declaration
                                    ? `${dossier.declaration_no} du ${dossier.date_declaration}`
                                    : ""} isEditable={true} />


                                <div className="flex items-center">

                                    <span className="w-36 font-bold">Déclaration UC n° :</span>

                                    <input

                                        className="flex-1 border-b border-transparent hover:border-zinc-300 outline-none focus:border-black transition-colors"

                                        value={declarationUC}

                                        onChange={(e) => setDeclarationUC(e.target.value)}

                                    />

                                </div>

                                <InfoRow label="Escale n° :" value={dossier.escale} isEditable={true} />

                                <InfoRow label="Rubrique :" value={dossier.rubrique} isEditable={true} />

                                <InfoRow label="Colisage :" value={dossier.colisage} isEditable={true} />

                                <InfoRow label="Poids Brut :" value={dossier.pb} isEditable={true} />

                                <InfoRow label="Valeur Douane :" value={dossier.valeur_dinars} isEditable={true} />

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
                                        type="text"
                                        className="w-20 text-right font-bold outline-none border-b border-transparent focus:border-zinc-300"
                                        value={timbre}
                                        onChange={(e) => setTimbre(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex justify-between border-t border-black pt-2 text-[16px] font-extrabold uppercase">
                                    <span>Total Facture en TND</span>
                                    <span>{totalFinal.toFixed(3)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 italic font-semibold text-[14px] mb-12">
                            Total en votre aimable règlement : {Math.floor(totalFinal)} Dinars, {Math.round((totalFinal % 1) * 1000)} millimes
                        </div>

                        <div className="flex gap-4 print:hidden">
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
                                type="button"
                                onClick={handleValidateInvoice}
                                disabled={loading}
                                className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition active:scale-95 disabled:bg-zinc-400"
                            >
                                {loading ? "Mise à jour en cours..." : "Valider la Facture"}
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

/* ================= COMPOSANTS RÉUTILISABLES ================= */

function Sidebar() {
    return (
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

function Header({ title }) {
    return (
        <header className="h-20 bg-white border-b border-zinc-100 flex items-center px-10 sticky top-0 z-20">
            <h1 className="text-xl font-bold tracking-tight uppercase">{title}</h1>
        </header>
    );
}

function InfoRow({ label, value, isEditable }) {
    return (
        <div className="flex items-center">
            <span className="w-36 font-bold">{label}</span>
            <input
                defaultValue={value}
                disabled={!isEditable}
                className={`flex-1 bg-transparent outline-none border-b border-transparent ${isEditable ? 'hover:border-zinc-300 focus:border-black' : ''}`}
            />
        </div>
    );
}

function EditableAmount({ value, onChange }) {
    const [tempValue, setTempValue] = useState(value);
    useEffect(() => setTempValue(value), [value]);

    return (
        <input
            type="text"
            className="w-full text-right bg-transparent outline-none font-mono focus:bg-zinc-50 border-b border-transparent hover:border-zinc-200"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => {
                const parsed = parseFloat(tempValue.toString().replace(',', '.'));
                onChange(isNaN(parsed) ? 0 : parsed);
            }}
        />
    );
}

function SectionTable({ title, rows, onAdd, onRemove, onChange }) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-4 bg-zinc-50 border-y border-zinc-200 px-3 py-1.5 mb-2">
                <h3 className="font-extrabold text-[12px] tracking-wider uppercase">{title}</h3>
                <button onClick={onAdd} className="text-[10px] font-bold border border-zinc-400 px-2 rounded bg-white hover:bg-zinc-100 print:hidden">+ Ajouter</button>
            </div>
            <table className="w-full">
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className="group border-b border-transparent hover:border-zinc-50">
                            <td className="w-8 text-center print:hidden">
                                <button onClick={() => onRemove(i)} className="text-red-400 opacity-0 group-hover:opacity-100 transition">×</button>
                            </td>
                            <td className="py-0.5">
                                <input
                                    className="w-full bg-transparent outline-none border-b border-transparent hover:border-zinc-200 focus:border-black"
                                    value={r.label}
                                    onChange={(e) => onChange(i, "label", e.target.value)}
                                />
                            </td>
                            <td className="w-40">
                                <EditableAmount value={r.montant} onChange={(newVal) => onChange(i, "montant", newVal)} />
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
            <span className="font-mono text-[14px]">{value.toFixed(3)}</span>
        </div>
    );
}