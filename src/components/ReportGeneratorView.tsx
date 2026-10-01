import React, { useState, useMemo } from 'react';
import { Player, CoreMetrics, PlayerSessionRecord } from '../types';
import { DataStore } from '../lib/dataStore';
import { getPositionalGroup, formatWholeNumber, formatPlayerNumber } from '../lib/positionalUtils';
import { CORE_METRIC_KEYS, METRIC_LABELS } from '../lib/contextBaseline';
import { calculateAllPlayerThresholds, evaluateExposureAgainstThreshold } from '../lib/loadThresholdEngine';
import { SessionCalendarPicker } from './SessionCalendarPicker';
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
  ShieldAlert,
  AlertTriangle,
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
      return sessions.filter((s) => s.session_type === 'Game' || s.date.endsWith('12') || s.date.endsWith('13'));
    }
    return sessions.filter((s) => s.date === selectedDate);
  }, [sessions, selectedDate, reportType]);

  const scopedSessionIds = useMemo(() => new Set(scopedSessions.map((s) => s.id)), [scopedSessions]);

  const scopedRecords = useMemo(() => {
    return allRecords.filter((r) => scopedSessionIds.has(r.session_id));
  }, [allRecords, scopedSessionIds]);

  // Player Threshold & Traffic-Light Status Summary Calculation (Synthesized & Visual)
  const playerStatuses = useMemo(() => {
    return scopedRecords.map((r) => {
      const playerObj = roster.find((p) => p.id === r.player_id) || {
        id: r.player_id,
        displayName: r.player_name,
        number: r.player_number,
        position: r.position,
      };

      const isGame = r.session_type === 'Game' || (r.session_name || '').toLowerCase().includes('vs');
      const targetCtx = isGame ? 'GAME' : 'PRACTICE';
      const thresholds = calculateAllPlayerThresholds(allRecords, playerObj as Player, targetCtx);

      let statusRank = 1; // 1 = GREEN, 2 = YELLOW, 3 = RED, 0 = BLUE
      let topMetricLabel = 'ALL CORE METRICS';
      let deviationText = 'WITHIN TYPICAL RANGE';
      let statusTag = 'WITHIN TYPICAL RANGE';
      let coachingAction = 'Normal exposure';
      let maxPctDiff = 0;

      let underloadedCount = 0;
      let maxUnderloadPct = 0;
      let topUnderloadedLabel = '';

      CORE_METRIC_KEYS.forEach((mKey) => {
        const val = r[mKey];
        if (val === null || val === undefined) return;
        const t = thresholds[mKey];
        const ev = evaluateExposureAgainstThreshold(val, t);
        if (!ev) return;

        const p90 = t.highThreshold;
        const typical = t.typicalTarget;

        if (ev.status === 'VERY_HIGH_HISTORICAL' || (p90 && val >= p90)) {
          statusRank = 3;
          const pctAboveP90 = p90 && p90 > 0 ? Math.round(((val - p90) / p90) * 100) : 15;
          if (pctAboveP90 > maxPctDiff || topMetricLabel === 'ALL CORE METRICS') {
            maxPctDiff = pctAboveP90;
            topMetricLabel = METRIC_LABELS[mKey].label.toUpperCase();
            deviationText = `+${Math.max(1, pctAboveP90)}% ABOVE P90`;
            statusTag = 'HIGH HISTORICAL EXPOSURE';
            coachingAction = 'Limit additional high-intensity exposure';
          }
        } else if (ev.status === 'HIGH_EXPOSURE' || ev.status === 'ABOVE_TYPICAL') {
          if (statusRank < 3) statusRank = 2;
          const pctAboveTypical = typical && typical > 0 ? Math.round(((val - typical) / typical) * 100) : 10;
          if (pctAboveTypical > maxPctDiff || topMetricLabel === 'ALL CORE METRICS') {
            maxPctDiff = pctAboveTypical;
            topMetricLabel = METRIC_LABELS[mKey].label.toUpperCase();
            deviationText = `+${Math.max(1, pctAboveTypical)}% ABOVE TYPICAL`;
            statusTag = 'ELEVATED EXPOSURE';
            coachingAction = 'Review additional court volume';
          }
        } else if (ev.status === 'BELOW_TYPICAL') {
          if (typical && typical > 0 && val < typical * 0.8) {
            underloadedCount++;
            const pctBelow = Math.round(((typical - val) / typical) * 100);
            if (pctBelow > maxUnderloadPct) {
              maxUnderloadPct = pctBelow;
              topUnderloadedLabel = METRIC_LABELS[mKey].label.toUpperCase();
            }
          }
        }
      });

      if (statusRank === 1 && underloadedCount >= 2 && maxUnderloadPct >= 15) {
        statusRank = 0; // BLUE
        topMetricLabel = topUnderloadedLabel || 'EXTERNAL WORKLOAD';
        deviationText = `-${maxUnderloadPct}% BELOW TYPICAL`;
        statusTag = 'UNDER TYPICAL EXPOSURE';
        coachingAction = 'Consider compensatory loading';
      }

      const colorKey: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' =
        statusRank === 3 ? 'RED' : statusRank === 2 ? 'YELLOW' : statusRank === 0 ? 'BLUE' : 'GREEN';

      const iconSymbol = colorKey === 'RED' ? '🔴' : colorKey === 'YELLOW' ? '🟡' : colorKey === 'BLUE' ? '🔵' : '🟢';

      return {
        record: r,
        player: playerObj,
        colorKey,
        iconSymbol,
        metricLabel: topMetricLabel,
        deviationText,
        statusTag,
        coachingAction,
        RPE: r.RPE,
        gameMinutes: r.game_minutes,
        durationMin: r.duration_min,
      };
    });
  }, [scopedRecords, roster, allRecords]);

  // Compute team averages for ALL 8 core metrics
  const totalCount = scopedRecords.length;
  const getAvg = (key: keyof CoreMetrics) => {
    if (totalCount === 0) return 0;
    const vals = scopedRecords.map((r) => r[key]).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Number((sum / vals.length).toFixed(1));
  };

  const avgDist = getAvg('distance_m');
  const avgAccel = getAvg('accumulated_acceleration_load');
  const avgAccelMin = getAvg('accumulated_acceleration_load_per_min');
  const avgAnaerobic = getAvg('anaerobic_activity_time');
  const avgDecel = getAvg('deceleration_load');
  const avgDecelMin = getAvg('deceleration_load_per_min');
  const avgJump = getAvg('jump_load');
  const avgMech = getAvg('mechanical_load');

  // Report Editable State Content
  const [reportTitle, setReportTitle] = useState<string>(
    'EHIME ORANGE VIKINGS STRENGTH & CONDITIONING PERFORMANCE REPORT'
  );

  const [execSummary, setExecSummary] = useState<string>(
    `S&C Performance Analysis (${reportType.toUpperCase()} SCOPE). Total monitored athlete sessions: ${totalCount}. Team average distance reached ${avgDist.toLocaleString()} m with a mechanical load average of ${avgMech}. Accel load averaged ${avgAccel} (${avgAccelMin} au/min density), decel load averaged ${avgDecel} (${avgDecelMin} au/min density), anaerobic activity time averaged ${avgAnaerobic} s, and jump load averaged ${avgJump}.`
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const docEl = document.getElementById('sc-report-document');
      if (!docEl) {
        window.print();
        return;
      }

      const pageElements = Array.from(docEl.querySelectorAll('.sc-report-page')) as HTMLElement[];
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      if (pageElements.length > 0) {
        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i];
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#09090b',
          });

          const imgData = canvas.toDataURL('image/png');
          const canvasHeightMm = (canvas.height * pdfWidth) / canvas.width;

          if (i > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, canvasHeightMm));
        }
      } else {
        const canvas = await html2canvas(docEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#09090b',
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeightMm = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeightMm;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightMm);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightMm);
          heightLeft -= pdfHeight;
        }
      }

      pdf.save(`Orange_Vikings_SC_Report_${selectedDate}_${reportType}.pdf`);
      showToast('Multi-page PDF generated & downloaded successfully!');
    } catch (err) {
      console.error('PDF export failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  // Player Rankings (Top 3 for core metrics)
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
      return Number((sum / recs.length).toFixed(1));
    };

    return [
      {
        group: 'POINT GUARDS',
        count: groups['POINT GUARDS'].length,
        dist: getGroupAvg(groups['POINT GUARDS'], 'distance_m'),
        accel: getGroupAvg(groups['POINT GUARDS'], 'accumulated_acceleration_load'),
        accelMin: getGroupAvg(groups['POINT GUARDS'], 'accumulated_acceleration_load_per_min'),
        anaerobic: getGroupAvg(groups['POINT GUARDS'], 'anaerobic_activity_time'),
        decel: getGroupAvg(groups['POINT GUARDS'], 'deceleration_load'),
        decelMin: getGroupAvg(groups['POINT GUARDS'], 'deceleration_load_per_min'),
        jump: getGroupAvg(groups['POINT GUARDS'], 'jump_load'),
        mech: getGroupAvg(groups['POINT GUARDS'], 'mechanical_load'),
      },
      {
        group: 'FORWARDS',
        count: groups.FORWARDS.length,
        dist: getGroupAvg(groups.FORWARDS, 'distance_m'),
        accel: getGroupAvg(groups.FORWARDS, 'accumulated_acceleration_load'),
        accelMin: getGroupAvg(groups.FORWARDS, 'accumulated_acceleration_load_per_min'),
        anaerobic: getGroupAvg(groups.FORWARDS, 'anaerobic_activity_time'),
        decel: getGroupAvg(groups.FORWARDS, 'deceleration_load'),
        decelMin: getGroupAvg(groups.FORWARDS, 'deceleration_load_per_min'),
        jump: getGroupAvg(groups.FORWARDS, 'jump_load'),
        mech: getGroupAvg(groups.FORWARDS, 'mechanical_load'),
      },
      {
        group: 'CENTERS',
        count: groups.CENTERS.length,
        dist: getGroupAvg(groups.CENTERS, 'distance_m'),
        accel: getGroupAvg(groups.CENTERS, 'accumulated_acceleration_load'),
        accelMin: getGroupAvg(groups.CENTERS, 'accumulated_acceleration_load_per_min'),
        anaerobic: getGroupAvg(groups.CENTERS, 'anaerobic_activity_time'),
        decel: getGroupAvg(groups.CENTERS, 'deceleration_load'),
        decelMin: getGroupAvg(groups.CENTERS, 'deceleration_load_per_min'),
        jump: getGroupAvg(groups.CENTERS, 'jump_load'),
        mech: getGroupAvg(groups.CENTERS, 'mechanical_load'),
      },
    ];
  }, [scopedRecords]);

  // Chart Data
  const playerChartData = useMemo(() => {
    return scopedRecords.map((r) => ({
      name: `#${r.player_number} ${r.player_name.split(' ')[0]}`,
      mech: r.mechanical_load || 0,
      accel: r.accumulated_acceleration_load || 0,
      dist: r.distance_m || 0,
    }));
  }, [scopedRecords]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-5 py-3 rounded-lg shadow-2xl font-black flex items-center space-x-2 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1">
            EXECUTIVE REPORTING ENGINE
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-orange-500" />
            <span>STRENGTH & CONDITIONING REPORT GENERATOR</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Export official multi-page A4 PDF documents with complete 8-metric physical load logs & player statistics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border ${
              isEditing
                ? 'bg-amber-500 text-zinc-950 border-amber-400'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
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

      {/* Scope Selector Bar & Session Calendar Picker */}
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

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-zinc-400 font-bold uppercase">Session Calendar Date:</span>
          <SessionCalendarPicker
            sessions={sessions}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
          />
        </div>
      </div>

      {/* Printable / Multi-Page Exportable Document Container */}
      <div id="sc-report-document" className="space-y-8 print:space-y-0">
        
        {/* PAGE 1: EXECUTIVE SUMMARY & 8 CORE METRICS OVERVIEW */}
        <div className="sc-report-page bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-zinc-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:break-after-page">
          {/* Official Header */}
          <div className="border-b-2 border-orange-500 pb-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-orange-600 font-black text-zinc-950 flex items-center justify-center text-lg tracking-tighter border border-amber-400 shadow-md shrink-0 print:border-black">
                EOV
              </div>
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
                PAGE 1 OF 3 • {reportType.toUpperCase()} SCOPE
              </div>
            </div>
          </div>

          {/* 8 Core External Load Metrics Summary Grid */}
          <div>
            <h2 className="text-xs font-black text-zinc-400 print:text-zinc-700 uppercase tracking-widest mb-2">
              TEAM AVERAGE WORKLOAD SUMMARY (ALL 8 CORE METRICS)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">TOTAL DISTANCE</span>
                <span className="text-amber-400 print:text-amber-700 font-black text-base">{avgDist.toLocaleString()} m</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">ACCEL LOAD</span>
                <span className="text-orange-400 print:text-orange-700 font-black text-base">{avgAccel} au</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">ACCEL LOAD / MIN</span>
                <span className="text-orange-300 print:text-orange-800 font-black text-base">{avgAccelMin} au/min</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">ANAEROBIC TIME</span>
                <span className="text-yellow-400 print:text-yellow-700 font-black text-base">{avgAnaerobic > 60 ? (avgAnaerobic / 60).toFixed(1) : avgAnaerobic} min</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">DECEL LOAD</span>
                <span className="text-rose-400 print:text-rose-700 font-black text-base">{avgDecel} au</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">DECEL LOAD / MIN</span>
                <span className="text-rose-300 print:text-rose-800 font-black text-base">{avgDecelMin} au/min</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">JUMP LOAD</span>
                <span className="text-purple-400 print:text-purple-700 font-black text-base">{avgJump} au</span>
              </div>

              <div className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3 rounded-xl text-center">
                <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">MECHANICAL LOAD</span>
                <span className="text-sky-400 print:text-sky-700 font-black text-base">{avgMech} au</span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Session Summary */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
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

          {/* Section 1.5: THRESHOLD / EXPOSURE STATUS SUMMARY (SYNTHESIZED VISUAL CARDS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 print:border-zinc-300 pb-2">
              <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                <span>2. THRESHOLD / EXPOSURE STATUS SUMMARY (COACH DECISION SUPPORT)</span>
              </h2>
              <div className="flex items-center space-x-2 text-[10px] font-black">
                <span className="bg-rose-950/80 print:bg-rose-100 text-rose-300 print:text-rose-800 px-2 py-0.5 rounded border border-rose-800 print:border-rose-300">
                  🔴 RED: {playerStatuses.filter((s) => s.colorKey === 'RED').length}
                </span>
                <span className="bg-amber-950/80 print:bg-amber-100 text-amber-300 print:text-amber-800 px-2 py-0.5 rounded border border-amber-800 print:border-amber-300">
                  🟡 YELLOW: {playerStatuses.filter((s) => s.colorKey === 'YELLOW').length}
                </span>
                <span className="bg-emerald-950/80 print:bg-emerald-100 text-emerald-400 print:text-emerald-800 px-2 py-0.5 rounded border border-emerald-800 print:border-emerald-300">
                  🟢 GREEN: {playerStatuses.filter((s) => s.colorKey === 'GREEN').length}
                </span>
                <span className="bg-blue-950/80 print:bg-blue-100 text-blue-300 print:text-blue-800 px-2 py-0.5 rounded border border-blue-800 print:border-blue-300">
                  🔵 BLUE: {playerStatuses.filter((s) => s.colorKey === 'BLUE').length}
                </span>
              </div>
            </div>

            {/* Compact Visual Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
              {playerStatuses.map((item) => (
                <div
                  key={`compact-${item.record.session_id}-${item.record.player_id}`}
                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 ${
                    item.colorKey === 'RED'
                      ? 'bg-rose-950/40 print:bg-rose-50 border-rose-800 print:border-rose-300'
                      : item.colorKey === 'YELLOW'
                      ? 'bg-amber-950/40 print:bg-amber-50 border-amber-800 print:border-amber-300'
                      : item.colorKey === 'BLUE'
                      ? 'bg-blue-950/40 print:bg-blue-50 border-blue-800 print:border-blue-300'
                      : 'bg-zinc-900 print:bg-zinc-50 border-zinc-800 print:border-zinc-300'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <span className="text-base leading-none pt-0.5">{item.iconSymbol}</span>
                    <div className="truncate flex-1">
                      <div className="font-black text-white print:text-black text-xs truncate">
                        {formatPlayerNumber(item.record.player_number)} {item.record.player_name}
                      </div>
                      <div className="text-[10px] font-extrabold text-orange-400 print:text-orange-700 tracking-wider mt-0.5 truncate">
                        {item.metricLabel}
                      </div>
                      <div className="text-[10px] text-zinc-300 print:text-zinc-800 font-extrabold mt-0.5">
                        {item.deviationText}
                      </div>
                      <div className="text-[9px] text-zinc-400 print:text-zinc-600 font-bold uppercase mt-0.5">
                        {item.statusTag}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-zinc-800/60 print:border-zinc-300 flex items-center justify-between text-[9px]">
                    <span className="font-bold text-zinc-200 print:text-zinc-800 bg-zinc-950/80 print:bg-zinc-200 px-2 py-0.5 rounded">
                      {item.coachingAction}
                    </span>
                    <span className="text-zinc-500 font-mono">
                      {item.gameMinutes ? `${item.gameMinutes}m` : ''} {item.RPE ? `RPE ${item.RPE}/10` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Player Top Performers & Rankings */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
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
        </div>

        {/* PAGE 2: POSITIONAL GROUP COMPARISONS & TEAM VISUALIZATION */}
        <div className="sc-report-page bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-zinc-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:break-after-page">
          <div className="border-b border-zinc-800 pb-3 flex items-center justify-between text-xs">
            <span className="text-orange-500 font-bold uppercase">EHIME ORANGE VIKINGS • PAGE 2</span>
            <span className="text-zinc-400 font-bold">{selectedDate} ({currentSession?.session_type || 'Session'})</span>
          </div>

          {/* Section 3: Positional Group Comparisons */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>3. POSITIONAL GROUP DETAILED BREAKDOWN (ALL 8 METRICS)</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900 print:bg-zinc-200 text-zinc-400 print:text-zinc-800 font-extrabold border-b border-zinc-800">
                    <th className="p-2">Positional Group</th>
                    <th className="p-2 text-right">Athletes</th>
                    <th className="p-2 text-right">Distance</th>
                    <th className="p-2 text-right">Accel</th>
                    <th className="p-2 text-right">Accel/min</th>
                    <th className="p-2 text-right">Anaerobic</th>
                    <th className="p-2 text-right">Decel</th>
                    <th className="p-2 text-right">Decel/min</th>
                    <th className="p-2 text-right">Jump</th>
                    <th className="p-2 text-right">Mech</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-300">
                  {positionalGroups.map((pg) => (
                    <tr key={pg.group} className="hover:bg-zinc-900/40">
                      <td className="p-2 font-bold text-orange-400 print:text-orange-700 uppercase">{pg.group}</td>
                      <td className="p-2 text-right text-zinc-400">{pg.count}</td>
                      <td className="p-2 text-right font-mono font-bold text-amber-400">{formatWholeNumber(pg.dist)} m</td>
                      <td className="p-2 text-right font-mono font-bold text-orange-400">{formatWholeNumber(pg.accel)}</td>
                      <td className="p-2 text-right font-mono font-bold text-orange-300">{pg.accelMin}</td>
                      <td className="p-2 text-right font-mono font-bold text-yellow-400">{formatWholeNumber(pg.anaerobic > 60 ? pg.anaerobic / 60 : pg.anaerobic)} min</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-400">{formatWholeNumber(pg.decel)}</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-300">{pg.decelMin}</td>
                      <td className="p-2 text-right font-mono font-bold text-purple-400">{formatWholeNumber(pg.jump)}</td>
                      <td className="p-2 text-right font-mono font-bold text-sky-400">{formatWholeNumber(pg.mech)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Team Visual Workload Chart */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>4. TEAM MECHANICAL LOAD VISUALIZATION</span>
            </h2>
            <div className="h-56 w-full bg-zinc-900 print:bg-zinc-100 p-4 rounded-xl border border-zinc-800 print:border-zinc-300">
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
        </div>

        {/* PAGE 3: FULL PLAYER-BY-PLAYER 8-METRIC LOG DATA TABLE */}
        <div className="sc-report-page bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-zinc-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
          <div className="border-b border-zinc-800 pb-3 flex items-center justify-between text-xs">
            <span className="text-orange-500 font-bold uppercase">EHIME ORANGE VIKINGS • PAGE 3</span>
            <span className="text-zinc-400 font-bold">ALL ATHLETES SESSION DRILL-DOWN ({scopedRecords.length} ENTRIES)</span>
          </div>

          {/* Section 4: Complete Individual Player Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Users className="w-4 h-4" />
              <span>5. INDIVIDUAL PLAYER COMPLETE EXTERNAL LOAD & RPE TABLE</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-zinc-900 print:bg-zinc-200 text-zinc-400 print:text-zinc-800 font-extrabold border-b border-zinc-800">
                    <th className="p-2">Athlete</th>
                    <th className="p-2">Pos</th>
                    <th className="p-2 text-right">Distance</th>
                    <th className="p-2 text-right">Accel</th>
                    <th className="p-2 text-right">Accel/min</th>
                    <th className="p-2 text-right">Anaerobic</th>
                    <th className="p-2 text-right">Decel</th>
                    <th className="p-2 text-right">Decel/min</th>
                    <th className="p-2 text-right">Jump</th>
                    <th className="p-2 text-right">Mech</th>
                    <th className="p-2 text-right">RPE</th>
                    <th className="p-2">Denominator Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 print:divide-zinc-300 font-medium">
                  {scopedRecords.map((r) => {
                    const pg = getPositionalGroup({ id: r.player_id, number: r.player_number, player_name: r.player_name });
                    const isGame = r.session_type === 'Game';
                    const denomStr = isGame
                      ? (r.game_minutes ? `${r.game_minutes} min played (Game)` : 'Game min N/A')
                      : (r.duration_min ? `${r.duration_min} min session (Practice)` : 'Duration N/A');

                    return (
                      <tr key={`${r.session_id}-${r.player_id}`} className="hover:bg-zinc-900/40">
                        <td className="p-2 font-bold text-white print:text-black whitespace-nowrap">
                          #{r.player_number} {r.player_name}
                        </td>
                        <td className="p-2 text-[10px] text-zinc-400 uppercase font-bold">{pg.slice(0, 2)}</td>
                        <td className="p-2 text-right font-mono font-bold text-amber-400">{formatWholeNumber(r.distance_m)}m</td>
                        <td className="p-2 text-right font-mono font-bold text-orange-400">{formatWholeNumber(r.accumulated_acceleration_load)}</td>
                        <td className="p-2 text-right font-mono font-bold text-orange-300">
                          {r.accumulated_acceleration_load_per_min !== null && r.accumulated_acceleration_load_per_min !== undefined
                            ? r.accumulated_acceleration_load_per_min.toFixed(2)
                            : '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-yellow-400">
                          {r.anaerobic_activity_time !== null && r.anaerobic_activity_time !== undefined
                            ? `${formatWholeNumber(r.anaerobic_activity_time > 60 ? r.anaerobic_activity_time / 60 : r.anaerobic_activity_time)} min`
                            : '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-rose-400">{formatWholeNumber(r.deceleration_load)}</td>
                        <td className="p-2 text-right font-mono font-bold text-rose-300">
                          {r.deceleration_load_per_min !== null && r.deceleration_load_per_min !== undefined
                            ? r.deceleration_load_per_min.toFixed(2)
                            : '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-purple-400">{formatWholeNumber(r.jump_load)}</td>
                        <td className="p-2 text-right font-mono font-bold text-sky-400">{formatWholeNumber(r.mechanical_load)}</td>
                        <td className="p-2 text-right font-mono font-bold text-purple-300">
                          {r.RPE !== null && r.RPE !== undefined ? `${formatWholeNumber(r.RPE)}/10` : '-'}
                        </td>
                        <td className="p-2 text-[10px] text-zinc-400 whitespace-nowrap">{denomStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    </div>
  );
};
