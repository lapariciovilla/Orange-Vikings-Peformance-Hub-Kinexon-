import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics } from '../types';
import { DataStore } from '../lib/dataStore';
import { getPositionalGroup, formatWholeNumber } from '../lib/positionalUtils';
import {
  FileText,
  Download,
  Edit3,
  Check,
  Printer,
  Sparkles,
  Loader2,
  CheckCircle2,
  Users,
  Trophy,
  Activity,
  Layers,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ReportGeneratorViewProps {
  roster: Player[];
}

export type ReportType = 'daily' | 'weekly' | 'game' | 'weekend';

export const ReportGeneratorView: React.FC<ReportGeneratorViewProps> = ({ roster }) => {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-11');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const sessions = DataStore.getSessionsMeta();
  const allRecords = DataStore.getPlayerRecords();

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.date === selectedDate) || sessions[0];
  }, [sessions, selectedDate]);

  // Determine records based on report scope
  const scopedSessions = useMemo(() => {
    if (reportType === 'daily') {
      return sessions.filter((s) => s.date === selectedDate);
    }
    if (reportType === 'game') {
      const match = sessions.find((s) => s.date === selectedDate && s.session_type === 'Game');
      if (match) return [match];
      const anyGame = sessions.filter((s) => s.session_type === 'Game');
      return anyGame.length > 0 ? [anyGame[0]] : sessions.filter((s) => s.date === selectedDate);
    }
    if (reportType === 'weekly') {
      // Find all sessions in the same week (simple 7-day range around selectedDate or matching same date prefix)
      const targetDate = new Date(selectedDate);
      const dayOfWeek = targetDate.getDay();
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      return sessions.filter((s) => s.date >= startStr && s.date <= endStr);
    }
    if (reportType === 'weekend') {
      // Sessions on Saturday/Sunday or same weekend dates
      return sessions.filter((s) => s.session_type === 'Game' || s.date.endsWith('12') || s.date.endsWith('13'));
    }
    return sessions.filter((s) => s.date === selectedDate);
  }, [sessions, selectedDate, reportType]);

  const scopedSessionIds = useMemo(() => new Set(scopedSessions.map((s) => s.id)), [scopedSessions]);

  const scopedRecords = useMemo(() => {
    return allRecords.filter((r) => scopedSessionIds.has(r.session_id));
  }, [allRecords, scopedSessionIds]);

  // Compute team averages for the 5 requested metrics
  const totalCount = scopedRecords.length;
  const avgDist = totalCount > 0 ? Math.round(scopedRecords.reduce((sum, r) => sum + (r.distance_m || 0), 0) / totalCount) : 0;
  const avgAccel = totalCount > 0 ? Math.round(scopedRecords.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / totalCount) : 0;
  const avgDecel = totalCount > 0 ? Math.round(scopedRecords.reduce((sum, r) => sum + (r.deceleration_load || 0), 0) / totalCount) : 0;
  const avgJump = totalCount > 0 ? Math.round(scopedRecords.reduce((sum, r) => sum + (r.jump_load || 0), 0) / totalCount) : 0;
  const avgMech = totalCount > 0 ? Math.round(scopedRecords.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / totalCount) : 0;

  // Report Editable State Content
  const [reportTitle, setReportTitle] = useState<string>(
    'EHIME ORANGE VIKINGS STRENGTH & CONDITIONING PERFORMANCE REPORT'
  );

  const [execSummary, setExecSummary] = useState<string>(
    `S&C Performance Analysis (${reportType.toUpperCase()} SCOPE). Total monitored athlete sessions: ${totalCount}. Team average distance reached ${avgDist.toLocaleString()} m with a mechanical load average of ${avgMech}. Acceleration load averaged ${avgAccel}, deceleration load averaged ${avgDecel}, and jump load averaged ${avgJump}.`
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const reportElement = document.getElementById('sc-report-document');
      if (!reportElement) {
        window.print();
        return;
      }

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#09090b',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Orange_Vikings_SC_Report_${selectedDate}_${reportType}.pdf`);
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  // Player Rankings (Top 3 for each metric)
  const topDistance = [...scopedRecords].sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0)).slice(0, 3);
  const topAccel = [...scopedRecords].sort((a, b) => (b.accumulated_acceleration_load || 0) - (a.accumulated_acceleration_load || 0)).slice(0, 3);
  const topDecel = [...scopedRecords].sort((a, b) => (b.deceleration_load || 0) - (a.deceleration_load || 0)).slice(0, 3);

  // Positional Group Aggregations
  const positionalGroups = useMemo(() => {
    const groups: Record<'POINT GUARDS' | 'FORWARDS' | 'CENTERS', typeof scopedRecords> = {
      'POINT GUARDS': [],
      FORWARDS: [],
      CENTERS: [],
    };

    scopedRecords.forEach((r) => {
      const g = getPositionalGroup({ id: r.player_id, number: r.player_number, player_name: r.player_name });
      groups[g].push(r);
    });

    const getGroupAvg = (recs: typeof scopedRecords, key: keyof CoreMetrics) => {
      if (recs.length === 0) return 0;
      const sum = recs.reduce((s, r) => s + (r[key] || 0), 0);
      return Math.round(sum / recs.length);
    };

    return [
      {
        group: 'POINT GUARDS',
        count: groups['POINT GUARDS'].length,
        dist: getGroupAvg(groups['POINT GUARDS'], 'distance_m'),
        accel: getGroupAvg(groups['POINT GUARDS'], 'accumulated_acceleration_load'),
        decel: getGroupAvg(groups['POINT GUARDS'], 'deceleration_load'),
        jump: getGroupAvg(groups['POINT GUARDS'], 'jump_load'),
        mech: getGroupAvg(groups['POINT GUARDS'], 'mechanical_load'),
      },
      {
        group: 'FORWARDS',
        count: groups.FORWARDS.length,
        dist: getGroupAvg(groups.FORWARDS, 'distance_m'),
        accel: getGroupAvg(groups.FORWARDS, 'accumulated_acceleration_load'),
        decel: getGroupAvg(groups.FORWARDS, 'deceleration_load'),
        jump: getGroupAvg(groups.FORWARDS, 'jump_load'),
        mech: getGroupAvg(groups.FORWARDS, 'mechanical_load'),
      },
      {
        group: 'CENTERS',
        count: groups.CENTERS.length,
        dist: getGroupAvg(groups.CENTERS, 'distance_m'),
        accel: getGroupAvg(groups.CENTERS, 'accumulated_acceleration_load'),
        decel: getGroupAvg(groups.CENTERS, 'deceleration_load'),
        jump: getGroupAvg(groups.CENTERS, 'jump_load'),
        mech: getGroupAvg(groups.CENTERS, 'mechanical_load'),
      },
    ];
  }, [scopedRecords]);

  // Player Chart Data for Report
  const playerChartData = scopedRecords.slice(0, 12).map((r) => ({
    name: `#${r.player_number} ${r.player_name.split(' ')[0]}`,
    distance: r.distance_m || 0,
    mech: r.mechanical_load || 0,
    rpe: r.RPE || 0,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-4 py-2.5 rounded-lg shadow-2xl font-black flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header & Control Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            EXECUTIVE REPORTING & PDF EXPORT ENGINE
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-orange-500" />
            <span>S&C PERFORMANCE REPORT GENERATOR</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Generate, customize, and export official Strength & Conditioning PDF reports for Coach Luis Aparicio Villa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              if (isEditing) showToast('Report changes saved');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-1.5 transition-colors ${
              isEditing
                ? 'bg-emerald-600 text-zinc-950'
                : 'bg-zinc-800 text-orange-400 border border-orange-800 hover:bg-zinc-700'
            }`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{isEditing ? 'LOCK EDITING' : 'EDIT REPORT NOTES'}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-2 shadow-lg transition-colors"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'GENERATING PDF...' : 'DOWNLOAD PDF REPORT'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-2 rounded-lg text-xs flex items-center space-x-1 border border-zinc-700"
            title="System Print Window"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scope Selector Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="text-zinc-400 uppercase">Report Scope:</span>
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            {(['daily', 'weekly', 'game', 'weekend'] as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={`px-3 py-1.5 rounded uppercase font-black transition-colors ${
                  reportType === t ? 'bg-orange-600 text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t} Report
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-zinc-400 font-bold uppercase">Session Date:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-white font-bold"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.date}>
                {s.date} ({s.session_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable / Exportable Official S&C Report Document */}
      <div
        id="sc-report-document"
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-zinc-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0"
      >
        {/* Official Document Header */}
        <div className="border-b-2 border-orange-500 pb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src="https://i.postimg.cc/QxTv6dV1/icon-ogp.webp"
              alt="Orange Vikings Logo"
              className="w-12 h-12 rounded bg-zinc-900 p-1 border border-orange-500 print:border-black"
            />
            <div>
              <div className="text-orange-500 print:text-orange-600 font-black text-xs uppercase tracking-widest">
                EHIME ORANGE VIKINGS • STRENGTH & CONDITIONING ANALYTICS
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="bg-zinc-900 text-white border border-orange-500 rounded px-2 py-1 font-black text-lg w-full"
                />
              ) : (
                <h1 className="text-xl font-black text-white print:text-black tracking-tight">
                  {reportTitle}
                </h1>
              )}
            </div>
          </div>

          <div className="text-right text-xs">
            <div className="font-extrabold text-white print:text-black">
              DATE: {selectedDate}
            </div>
            <div className="text-zinc-400 print:text-zinc-600">
              S&C HEAD: Luis Aparicio Villa
            </div>
            <div className="text-orange-400 print:text-orange-700 font-bold uppercase text-[10px] mt-0.5">
              SCOPE: {reportType.toUpperCase()} REPORT
            </div>
          </div>
        </div>

        {/* 5 Core External Load Metrics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">TOTAL DISTANCE</span>
            <span className="text-amber-400 print:text-amber-700 font-black text-lg">{avgDist.toLocaleString()} m</span>
          </div>

          <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">ACCEL LOAD</span>
            <span className="text-orange-400 print:text-orange-700 font-black text-lg">{avgAccel}</span>
          </div>

          <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">DECEL LOAD</span>
            <span className="text-rose-400 print:text-rose-700 font-black text-lg">{avgDecel}</span>
          </div>

          <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">JUMP LOAD</span>
            <span className="text-purple-400 print:text-purple-700 font-black text-lg">{avgJump}</span>
          </div>

          <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">MECHANICAL LOAD</span>
            <span className="text-sky-400 print:text-sky-700 font-black text-lg">{avgMech}</span>
          </div>
        </div>

        {/* Section 1: Executive Session Summary */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4" />
            <span>1. EXECUTIVE PERFORMANCE SUMMARY</span>
          </h2>
          {isEditing ? (
            <textarea
              rows={3}
              value={execSummary}
              onChange={(e) => setExecSummary(e.target.value)}
              className="w-full bg-zinc-900 text-white border border-orange-500 rounded p-3 text-xs"
            />
          ) : (
            <div className="bg-zinc-900/60 print:bg-zinc-50 p-4 rounded-lg border border-zinc-800 print:border-zinc-300 text-xs text-zinc-300 print:text-zinc-800 leading-relaxed">
              {execSummary}
            </div>
          )}
        </div>

        {/* Section 2: Player Top Performers & Rankings */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Trophy className="w-4 h-4" />
            <span>2. WORKLOAD TOP PERFORMERS ({reportType.toUpperCase()})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-zinc-900 print:bg-zinc-100 p-3.5 rounded-xl border border-zinc-800 print:border-zinc-300 space-y-2">
              <span className="font-extrabold text-amber-400 print:text-amber-700 uppercase text-[10px] block">
                DISTANCE LEADERS
              </span>
              {topDistance.map((r, i) => (
                <div key={r.player_id} className="flex justify-between text-zinc-300 print:text-zinc-800">
                  <span>{i + 1}. #{r.player_number} {r.player_name}</span>
                  <strong className="text-white print:text-black">{formatWholeNumber(r.distance_m)} m</strong>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 print:bg-zinc-100 p-3.5 rounded-xl border border-zinc-800 print:border-zinc-300 space-y-2">
              <span className="font-extrabold text-orange-400 print:text-orange-700 uppercase text-[10px] block">
                ACCELERATION LOAD LEADERS
              </span>
              {topAccel.map((r, i) => (
                <div key={r.player_id} className="flex justify-between text-zinc-300 print:text-zinc-800">
                  <span>{i + 1}. #{r.player_number} {r.player_name}</span>
                  <strong className="text-white print:text-black">{formatWholeNumber(r.accumulated_acceleration_load)}</strong>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 print:bg-zinc-100 p-3.5 rounded-xl border border-zinc-800 print:border-zinc-300 space-y-2">
              <span className="font-extrabold text-rose-400 print:text-rose-700 uppercase text-[10px] block">
                DECELERATION LOAD LEADERS
              </span>
              {topDecel.map((r, i) => (
                <div key={r.player_id} className="flex justify-between text-zinc-300 print:text-zinc-800">
                  <span>{i + 1}. #{r.player_number} {r.player_name}</span>
                  <strong className="text-white print:text-black">{formatWholeNumber(r.deceleration_load)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Positional Group Comparisons */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4" />
            <span>3. POSITIONAL GROUP COMPARISONS</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900 print:bg-zinc-200 text-zinc-400 print:text-zinc-800 font-extrabold border-b border-zinc-800">
                  <th className="p-2">Positional Group</th>
                  <th className="p-2 text-right">Athletes</th>
                  <th className="p-2 text-right">Avg Distance</th>
                  <th className="p-2 text-right">Avg Accel Load</th>
                  <th className="p-2 text-right">Avg Decel Load</th>
                  <th className="p-2 text-right">Avg Jump Load</th>
                  <th className="p-2 text-right">Avg Mech Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-300">
                {positionalGroups.map((pg) => (
                  <tr key={pg.group} className="hover:bg-zinc-900/40">
                    <td className="p-2 font-bold text-orange-400 print:text-orange-700 uppercase">{pg.group}</td>
                    <td className="p-2 text-right text-zinc-400">{pg.count}</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-400">{formatWholeNumber(pg.dist)} m</td>
                    <td className="p-2 text-right font-mono font-bold text-orange-400">{formatWholeNumber(pg.accel)}</td>
                    <td className="p-2 text-right font-mono font-bold text-rose-400">{formatWholeNumber(pg.decel)}</td>
                    <td className="p-2 text-right font-mono font-bold text-purple-400">{formatWholeNumber(pg.jump)}</td>
                    <td className="p-2 text-right font-mono font-bold text-sky-400">{formatWholeNumber(pg.mech)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Individual Player Table */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Users className="w-4 h-4" />
            <span>4. INDIVIDUAL PLAYER EXTERNAL LOAD & RPE TABLE ({scopedRecords.length} ENTRIES)</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900 print:bg-zinc-200 text-zinc-400 print:text-zinc-800 font-extrabold border-b border-zinc-800">
                  <th className="p-2">Athlete</th>
                  <th className="p-2">Pos Group</th>
                  <th className="p-2">Denominator</th>
                  <th className="p-2 text-right">Distance (m)</th>
                  <th className="p-2 text-right">Accel</th>
                  <th className="p-2 text-right">Decel</th>
                  <th className="p-2 text-right">Jump</th>
                  <th className="p-2 text-right">Mech</th>
                  <th className="p-2 text-right">RPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-300 font-medium">
                {scopedRecords.map((r) => {
                  const pg = getPositionalGroup({ id: r.player_id, number: r.player_number, player_name: r.player_name });
                  const isGame = r.session_type === 'Game';
                  const denomStr = isGame
                    ? (r.game_minutes ? `${r.game_minutes} played min` : 'Game min N/A')
                    : (r.duration_min ? `${r.duration_min} session min` : 'Duration N/A');

                  return (
                    <tr key={`${r.session_id}-${r.player_id}`} className="hover:bg-zinc-900/40">
                      <td className="p-2 font-bold text-white print:text-black">
                        #{r.player_number} {r.player_name}
                      </td>
                      <td className="p-2 text-[10px] text-zinc-400 uppercase font-bold">{pg}</td>
                      <td className="p-2 text-zinc-400">{denomStr}</td>
                      <td className="p-2 text-right font-mono font-bold text-amber-400">{formatWholeNumber(r.distance_m)}</td>
                      <td className="p-2 text-right font-mono font-bold text-orange-400">{formatWholeNumber(r.accumulated_acceleration_load)}</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-400">{formatWholeNumber(r.deceleration_load)}</td>
                      <td className="p-2 text-right font-mono font-bold text-purple-400">{formatWholeNumber(r.jump_load)}</td>
                      <td className="p-2 text-right font-mono font-bold text-sky-400">{formatWholeNumber(r.mechanical_load)}</td>
                      <td className="p-2 text-right font-mono font-bold text-purple-300">
                        {r.RPE !== null && r.RPE !== undefined ? `${formatWholeNumber(r.RPE)}/10` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Team Visual Workload Chart */}
        <div className="space-y-2 pt-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Activity className="w-4 h-4" />
            <span>5. TEAM MECHANICAL LOAD VISUALIZATION</span>
          </h2>
          <div className="h-48 w-full bg-zinc-900 print:bg-zinc-100 p-4 rounded-xl border border-zinc-800 print:border-zinc-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={playerChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} />
                <YAxis stroke="#a1a1aa" fontSize={10} tickFormatter={(v) => Math.round(v).toString()} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                  formatter={(val: number) => [formatWholeNumber(val), 'Mechanical Load']}
                />
                <Bar dataKey="mech" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sign-off Footer */}
        <div className="pt-6 border-t border-zinc-800 print:border-zinc-400 flex items-center justify-between text-xs text-zinc-500 print:text-zinc-700">
          <div>
            <strong>Report Status:</strong> Official S&C Verified Analysis
          </div>
          <div>
            <strong>Signature:</strong> Coach Luis Aparicio Villa (S&C Head)
          </div>
        </div>
      </div>
    </div>
  );
};
