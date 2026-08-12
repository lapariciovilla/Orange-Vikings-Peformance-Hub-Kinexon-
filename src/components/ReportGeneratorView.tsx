import React, { useState } from 'react';
import { Player, SessionMeta } from '../types';
import { DataStore } from '../lib/dataStore';
import {
  FileText,
  Download,
  Edit3,
  Check,
  Printer,
  Sparkles,
  Dumbbell,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  // Find records matching selected timeframe
  const currentSession = sessions.find((s) => s.date === selectedDate) || sessions[0];
  const dayRecords = allRecords.filter((r) => r.date === selectedDate);

  // Compute team averages for the 5 requested metrics:
  // 1. Distance, 2. Acceleration Load, 3. Deceleration Load, 4. Jump Load, 5. Mechanical Load
  const totalDist = dayRecords.reduce((sum, r) => sum + (r.distance_m || 0), 0);
  const avgDist = dayRecords.length > 0 ? Math.round(totalDist / dayRecords.length) : 0;
  const avgAccel = dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.accumulated_acceleration_load || 0), 0) / dayRecords.length) : 0;
  const avgDecel = dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.deceleration_load || 0), 0) / dayRecords.length) : 0;
  const avgJump = dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.jump_load || 0), 0) / dayRecords.length) : 0;
  const avgMech = dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.mechanical_load || 0), 0) / dayRecords.length) : 0;

  // Report State Content
  const [reportTitle, setReportTitle] = useState<string>(
    'ORANGE VIKINGS STRENGTH & CONDITIONING PERFORMANCE REPORT'
  );
  const [execSummary, setExecSummary] = useState<string>(
    `Session recorded on ${selectedDate} (${currentSession?.session_name || 'Practice'}). Team average volume reached ${avgDist.toLocaleString()}m distance with an average mechanical load of ${avgMech}. Acceleration load averaged ${avgAccel}, deceleration load averaged ${avgDecel}, and jump load averaged ${avgJump}.`
  );
  const [recommendations, setRecommendations] = useState<string>(
    '1. Patellar Tendon Yielding Isometrics (3x30s @ 60° knee flexion) for high jump load athletes.\n2. Concentric-only active recovery cycling (15 mins @ 90 RPM) to promote lymphatic clearance without added eccentric muscular stress.\n3. Compensatory 4v4 Small-Sided Games (3x3 min) and 4x15m shuttle sprints for athletes with low match/practice volume.'
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
        backgroundColor: '#18181b',
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
      pdf.save(`Orange_Vikings_SC_Report_${selectedDate}.pdf`);
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-4 py-2.5 rounded-lg shadow-2xl font-black flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header & Controls */}
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
            Generate, customize, and export official Strength & Conditioning PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              if (isEditing) showToast('Report changes locked');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-1.5 transition-colors ${
              isEditing
                ? 'bg-emerald-600 text-zinc-950'
                : 'bg-zinc-800 text-orange-400 border border-orange-800 hover:bg-zinc-700'
            }`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{isEditing ? 'DONE EDITING' : 'EDIT REPORT (COACH LUIS)'}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-zinc-950 font-black px-4 py-2 rounded-lg text-xs flex items-center space-x-2 shadow-lg transition-colors"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
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

      {/* Report Configuration Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
        {/* Report Type Selector */}
        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="text-zinc-400">Report Scope:</span>
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

        {/* Date Selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-zinc-400 font-bold">Session Date:</span>
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

      {/* Printable / Viewable Official S&C Report Document */}
      <div
        id="sc-report-document"
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0"
      >
        {/* Document Header */}
        <div className="border-b-2 border-orange-500 pb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src="https://i.postimg.cc/QxTv6dV1/icon-ogp.webp"
              alt="Logo"
              className="w-12 h-12 rounded bg-zinc-950 p-1 border border-orange-500 print:border-black"
            />
            <div>
              <div className="text-orange-500 print:text-orange-600 font-black text-xs uppercase tracking-widest">
                EHIME ORANGE VIKINGS • STRENGTH & CONDITIONING
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="bg-zinc-950 text-white border border-orange-500 rounded px-2 py-1 font-black text-lg w-full"
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
              COACH: Luis Aparicio Villa
            </div>
            <div className="text-orange-400 print:text-orange-700 font-bold uppercase text-[10px] mt-0.5">
              TYPE: {reportType.toUpperCase()} REPORT
            </div>
          </div>
        </div>

        {/* 5 Primary Metrics Bar: Distance, Acceleration Load, Deceleration Load, Jump Load, Mechanical Load */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-zinc-950 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">DISTANCE</span>
            <span className="text-amber-400 print:text-amber-700 font-black text-lg">{avgDist.toLocaleString()} m</span>
          </div>

          <div className="bg-zinc-950 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">ACCELERATION LOAD</span>
            <span className="text-orange-400 print:text-orange-700 font-black text-lg">{avgAccel}</span>
          </div>

          <div className="bg-zinc-950 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">DECELERATION LOAD</span>
            <span className="text-rose-400 print:text-rose-700 font-black text-lg">{avgDecel}</span>
          </div>

          <div className="bg-zinc-950 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">JUMP LOAD</span>
            <span className="text-purple-400 print:text-purple-700 font-black text-lg">{avgJump}</span>
          </div>

          <div className="bg-zinc-950 print:bg-zinc-100 border border-zinc-800 print:border-zinc-300 p-3.5 rounded-xl text-center">
            <span className="text-zinc-500 print:text-zinc-700 text-[10px] block font-extrabold uppercase">MECHANICAL LOAD</span>
            <span className="text-sky-400 print:text-sky-700 font-black text-lg">{avgMech}</span>
          </div>
        </div>

        {/* Section 1: Executive Session Summary */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4" />
            <span>1. EXECUTIVE SESSION SUMMARY</span>
          </h2>
          {isEditing ? (
            <textarea
              rows={4}
              value={execSummary}
              onChange={(e) => setExecSummary(e.target.value)}
              className="w-full bg-zinc-950 text-white border border-orange-500 rounded p-3 text-xs"
            />
          ) : (
            <div className="bg-zinc-950/60 print:bg-zinc-50 p-4 rounded-lg border border-zinc-800 print:border-zinc-300 text-xs text-zinc-300 print:text-zinc-800 leading-relaxed">
              {execSummary}
            </div>
          )}
        </div>

        {/* Section 2: Recommendations & Compensatory Exercise Plan */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-orange-400 print:text-orange-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Dumbbell className="w-4 h-4" />
            <span>2. RECOMMENDATIONS & COMPENSATORY EXERCISE PLAN</span>
          </h2>
          {isEditing ? (
            <textarea
              rows={5}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              className="w-full bg-zinc-950 text-white border border-orange-500 rounded p-3 text-xs"
            />
          ) : (
            <div className="bg-zinc-950/60 print:bg-zinc-50 p-4 rounded-lg border border-zinc-800 print:border-zinc-300 text-xs text-zinc-300 print:text-zinc-800 leading-relaxed whitespace-pre-line">
              {recommendations}
            </div>
          )}
        </div>

        {/* Sign-off Footer */}
        <div className="pt-6 border-t border-zinc-800 print:border-zinc-400 flex items-center justify-between text-xs text-zinc-500 print:text-zinc-700">
          <div>
            <strong>Report Status:</strong> Coach Reviewed & Verified
          </div>
          <div>
            <strong>Signature:</strong> Coach Luis Aparicio Villa (S&C Head)
          </div>
        </div>
      </div>
    </div>
  );
};
