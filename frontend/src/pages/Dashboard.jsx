import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Link, useLocation } from "react-router-dom";
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import logo from "../logo.png";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        total: 0,
        ca: 0,
        imports: 0,
        exports: 0,
        chiffre: 0  // Ajouté ici
    });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            setLoading(true);
            const { data, error } = await supabase.from("dossiers").select("*");
            const { data: data_facture, error: error_facture } = await supabase.from("factures").select("montant_total");

            if (error) throw error;
            if (error_facture) console.error("Erreur factures:", error_facture);

            // 1. Calcul des statistiques globales
            const total = data.length;
            const ca = data.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);
            const chiffre = data_facture?.reduce((acc, curr) => acc + (Number(curr.montant_total) || 0), 0) || 0;
            const importsCount = data.filter(d => d.mode?.toLowerCase() === 'import').length;
            const exportsCount = data.filter(d => d.mode?.toLowerCase() === 'export').length;

            // CORRECTION : Ajouter chiffre dans setStats
            setStats({
                total,
                ca,
                imports: importsCount,
                exports: exportsCount,
                chiffre: chiffre  // Ajouté ici
            });

            // 2. Préparation des données mixtes par mois
            const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Août", "Sep", "Oct", "Nov", "Déc"];
            const monthlyStats = months.map((month, index) => {
                const dossiersDuMois = data.filter(d => {
                    if (!d.created_at) return false;
                    const date = new Date(d.created_at);
                    return date.getMonth() === index;
                });

                return {
                    name: month,
                    total: dossiersDuMois.length,
                    imports: dossiersDuMois.filter(d => d.mode?.toLowerCase() === 'import').length,
                    exports: dossiersDuMois.filter(d => d.mode?.toLowerCase() === 'export').length
                };
            });

            setChartData(monthlyStats);

        } catch (error) {
            console.error("Erreur:", error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-black">
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
                    <NavItem label="Dashboard" to="/" active />
                    <NavItem label="Création d'un dossier" to="/creation-dossier" />
                    <NavItem label="Suivi des dossiers" to="/archive" />
                    <NavItem label="Clients" to="/client" />
                </nav>
            </aside>

            {/* CONTENU PRINCIPAL */}
            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8">
                    <h1 className="text-xl font-bold">Analyse d'Activité</h1>
                </header>

                <div className="p-8 space-y-8">
                    {/* CARTES STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Nbr Dossiers" value={stats.total} subtitle="" />
                        <StatCard title="Imports" value={stats.imports} color="text-blue-600" />
                        <StatCard title="Exports" value={stats.exports} color="text-red-600" />
                    </div>

                    {/* GRAPHIQUE MIXTE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold">Flux Mensuels</h3>
                            <p className="text-sm text-gray-500">Histogramme (Total) vs Lignes (Import/Export)</p>
                        </div>

                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="top" height={36} />

                                    <Bar dataKey="total" name="Total Dossiers" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={40} />

                                    <Line type="monotone" dataKey="imports" name="Imports" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />

                                    <Line type="monotone" dataKey="exports" name="Exports" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CARTE CA - CORRECTION ICI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Chiffre d'affaires "
                            value={`${stats.chiffre.toLocaleString()} DT`}
                            subtitle=""
                            color="text-green-600"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, color = "text-black", subtitle = "" }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
            </div>
        </div>
    );
}

function NavItem({ label, active, to }) {
    return (
        <Link to={to} className="block no-underline">
            <div className={`px-4 py-3 rounded-xl text-sm font-medium transition ${active ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white hover:bg-zinc-900"}`}>
                {label}
            </div>
        </Link>
    );
}