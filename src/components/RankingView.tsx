import React, { useMemo, useState } from "react";
import { Award, CalendarDays, CheckCircle, Clock, Radio, ShieldAlert, Trophy } from "lucide-react";
import { Inspection, InspectionStatus, Potential, Supervisor, getTipoLancamento } from "../types";
import {
  getInspectionScore,
  getSupervisorTargets,
  inspectionDate
} from "../utils/operational";
import {
  getOperationalWeek,
  formatOperationalWeekLabel
} from "../utils/operationalWeek";

interface RankingViewProps {
  inspections: Inspection[];
  supervisors: Supervisor[];
}

const formatMonthName = (monthStr: string) => {
  const [year, month] = monthStr.split("-").map(Number);
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${monthNames[month - 1]} de ${year}`;
};

export default function RankingView({ inspections, supervisors }: RankingViewProps) {
  const { start, end } = getOperationalWeek(new Date());

  // Dynamic available months list based on data + current month
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Always include current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthsSet.add(currentMonthStr);
    
    // Include months from inspections
    inspections.forEach((item) => {
      if (item.data) {
        const parts = item.data.split("-");
        if (parts.length >= 2) {
          monthsSet.add(`${parts[0]}-${parts[1]}`);
        }
      }
    });
    
    // Sort descending
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [inspections]);

  // Selected month state (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Calculate start/end date range for the selected month
  const { monthStart, monthEnd } = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startOf = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOf = new Date(year, month, 0, 23, 59, 59, 999);
    return { monthStart: startOf, monthEnd: endOf };
  }, [selectedMonth]);

  // Compute exclusively monthly ranking data
  const rankingData = useMemo(() => supervisors
    .filter((supervisor) => supervisor.ativo)
    .map((supervisor) => {
      const own = inspections.filter((item) => item.supervisorId === supervisor.id);
      
      // Filter inspections belonging exclusively to the selected month
      const month = own.filter((item) => {
        const date = inspectionDate(item);
        return date >= monthStart && date <= monthEnd;
      });

      const targets = getSupervisorTargets(supervisor);
      
      // Percentage calculated by: quantity monthly / meta monthly * 100
      const monthlyPercent = targets.monthly ? Math.round((month.length / targets.monthly) * 100) : 0;
      
      // Calculate score of the month's inspections only
      const score = month.reduce((sum, item) => sum + getInspectionScore(item), 0);
      
      // Get the most recent inspection of this selected month
      const last = [...month].sort((a, b) => inspectionDate(b).getTime() - inspectionDate(a).getTime())[0];
      
      return {
        supervisor,
        month: month.length,
        targets,
        monthlyPercent,
        score,
        total: month.length,
        treated: month.filter((item) => item.status === InspectionStatus.CONCLUIDO).length,
        critical: month.filter((item) => item.potencial === Potential.CRITICO).length,
        last,
        lastTimestamp: last ? inspectionDate(last).getTime() : 0
      };
    })
    .sort((a, b) => {
      // 1. Maior pontuação mensal
      if (b.score !== a.score) return b.score - a.score;
      // 2. Maior percentual da meta mensal
      if (b.monthlyPercent !== a.monthlyPercent) return b.monthlyPercent - a.monthlyPercent;
      // 3. Maior quantidade de inspeções no mês
      if (b.month !== a.month) return b.month - a.month;
      // 4. Data da última inspeção mais recente
      return b.lastTimestamp - a.lastTimestamp;
    }),
  [inspections, supervisors, monthStart.getTime(), monthEnd.getTime()]);

  // Leader of the month is the first place in our sorted list
  const monthLeader = rankingData[0];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0B2E59]">Leaderboard de Conformidade Operacional</h1>
          <p className="text-xs text-gray-500 mt-1">Pontuação e metas individuais de supervisores e gestores baseadas no desempenho mensal.</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5">
          <span className="text-[9px] uppercase tracking-widest font-black text-[#F58220]">Semana Operacional Atual</span>
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0B2E59]">
            <CalendarDays size={14} /> {formatOperationalWeekLabel({ start, end })}
          </div>
        </div>
      </div>

      {/* Filter Selector Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Filtrar por Mês:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-extrabold text-[#0B2E59] bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F58220] cursor-pointer"
          >
            {availableMonths.map((mStr) => (
              <option key={mStr} value={mStr}>
                {formatMonthName(mStr)}
              </option>
            ))}
          </select>
        </div>
        <div className="text-[10px] font-semibold text-gray-400">
          Mostrando {rankingData.length} participantes ativos
        </div>
      </div>

      {/* High-level Premium Cards - Structured in a 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supervisor do Mês */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-4">
          <div className="bg-blue-100 text-blue-600 rounded-xl p-3 flex items-center justify-center">
            <Award size={24} />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-black text-blue-700">Supervisor de {formatMonthName(selectedMonth)}</span>
            <strong className="text-base text-gray-800 block mt-0.5">
              {monthLeader?.supervisor.nome || "Sem dados"}
            </strong>
            {monthLeader && monthLeader.total > 0 && (
              <span className="block text-[11px] text-blue-600 font-bold mt-1">
                🏆 {monthLeader.score} pts • {monthLeader.monthlyPercent}% da meta ({monthLeader.total} vistorias)
              </span>
            )}
          </div>
        </div>

        {/* Sincronização */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-4">
          <div className="bg-emerald-100 text-emerald-600 rounded-xl p-3 flex items-center justify-center">
            <Radio className="animate-pulse" size={24} />
          </div>
          <div>
            <span className="block text-[9px] uppercase font-black text-emerald-700">Sincronização</span>
            <strong className="text-base text-gray-800 block mt-0.5">Firestore em tempo real</strong>
            <span className="block text-[11px] text-emerald-600 font-bold mt-1">
              Banco de dados ativo • Conexão segura
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-3">
        {rankingData.map((row, index) => (
          <article key={row.supervisor.id} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Position and Supervisor details */}
              <div className="flex items-center gap-3 lg:w-72">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${index < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  #{index + 1}
                </div>
                <div className="min-w-0">
                  <strong className="block text-sm text-[#0B2E59] truncate">{row.supervisor.nome}</strong>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{row.supervisor.unidade || "Operacional"}</span>
                </div>
              </div>

              {/* Monthly stats columns: Meta Mensal, Pontuação, Inspeções */}
              <div className="grid grid-cols-3 gap-3 flex-1 text-center">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400">Meta Mensal</span>
                  <strong className="text-sm text-gray-700">{row.month} / {row.targets.monthly}</strong>
                  <span className="block text-[10px] text-blue-600 font-black">{row.monthlyPercent}%</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400">Pontuação</span>
                  <strong className="text-lg text-[#F58220]">{row.score}</strong>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-gray-400">Inspeções</span>
                  <strong className="text-lg text-[#0B2E59]">{row.total}</strong>
                </div>
              </div>

              {/* Checklist & Last inspection summary */}
              <div className="lg:w-56 text-[10px] text-gray-500 space-y-1">
                <span className="flex items-center gap-1"><CheckCircle size={11} className="text-green-500" /> {row.treated} concluídas</span>
                <span className="flex items-center gap-1"><ShieldAlert size={11} className="text-red-500" /> {row.critical} críticas</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {row.last ? `${getTipoLancamento(row.last.atividade, row.last.tipo)} em ${row.last.data.split("-").reverse().join("/")}` : "Sem inspeções"}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="text-[10px] text-gray-400">
        Ordenação: maior pontuação mensal, maior percentual da meta mensal, maior quantidade de inspeções no mês e última inspeção mais recente.
      </p>
    </div>
  );
}
