import React, { useState, useMemo, useEffect } from 'react';
import { Player, RPEEntry, SessionMeta, PlayerSessionRecord } from '../types';
import { DataStore } from '../lib/dataStore';
import { SupabaseService } from '../lib/supabaseService';
import {
  ScanLine,
  Upload,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Save,
  HelpCircle,
  FileText,
  Calendar,
  Clock,
  Trophy,
  Activity,
  Filter,
  Trash2,
  Eye,
  Database,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Plus,
  ShieldCheck,
} from 'lucide-react';

interface BulkDataImportViewProps {
  roster: Player[];
  isAuthenticated?: boolean;
  onNavigateSettings?: () => void;
  onNavigateRPE?: () => void;
  onNavigateGames?: () => void;
  onNavigateDashboard?: () => void;
}

export type ImportWorkflowType = 'RPE' | 'GAME_MINUTES';

export interface UploadedImageItem {
  id: string; // unique internal tracking id
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewUrl: string;
  base64Data: string;
  
  // OCR processing state
  status: 'PENDING' | 'ANALYZING' | 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  statusDetail?: string;
  modelUsed?: string;
  
  // Detected metadata
  detectedDates: string[];
  primaryDate: string; // editable by coach
  detectedOpponent?: string;
  detectedSheetTitle?: string;
  
  // Raw extracted entries before user review
  extractedCount: number;
}

export interface ReviewRecordItem {
  id: string; // unique item id
  imageId: string;
  imageFileName: string;
  date: string; // YYYY-MM-DD
  
  // Athlete association
  matchedPlayer: Player | null;
  extractedName?: string;
  extractedNumber?: string;
  
  // Data values for RPE
  rpeScore: number | null; // 1-10
  wellnessScore?: number | null;
  sorenessScore?: number | null;
  durationMin?: number | null;
  notes?: string;
  
  // Data values for Game Minutes
  minutesRaw?: string;
  minutesNumeric: number | null;
  starter?: boolean;
  opponent?: string;
  
  // Quality & validation
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';
  warnings: string[];
  
  // Duplicate check status
  isDuplicate: boolean;
  duplicateAction: 'UPDATE' | 'SKIP';
  
  // User reviewed state
  isReviewed: boolean;
  isSelectedForImport: boolean;
}

export const BulkDataImportView: React.FC<BulkDataImportViewProps> = ({
  roster,
  isAuthenticated = false,
  onNavigateSettings,
  onNavigateRPE,
  onNavigateGames,
  onNavigateDashboard,
}) => {
  // Workflow selector
  const [workflow, setWorkflow] = useState<ImportWorkflowType>('RPE');
  
  // Multi-step pipeline:
  // 1: Upload Images
  // 2: Multi-Image Review & Cards
  // 3: Structured Human Review & Edit Table
  // 4: Final Database Ingestion & Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Uploaded images state
  const [uploadedImages, setUploadedImages] = useState<UploadedImageItem[]>([]);
  
  // Parsed and normalized review records
  const [reviewRecords, setReviewRecords] = useState<ReviewRecordItem[]>([]);
  
  // Filter and display state in Step 3
  const [filterConfidence, setFilterConfidence] = useState<'ALL' | 'NEEDS_REVIEW' | 'DUPLICATES'>('ALL');
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [modalPreviewImage, setModalPreviewImage] = useState<string | null>(null);

  // Persistence and execution state
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Import summary report
  const [importSummary, setImportSummary] = useState<{
    batchId: string;
    workflow: ImportWorkflowType;
    totalImages: number;
    savedRecordsCount: number;
    skippedCount: number;
    failedCount: number;
    storagePath?: string | null;
    datesCount: number;
    uniquePlayersCount: number;
  } | null>(null);

  // Storage bucket check state
  const [storageStatus, setStorageStatus] = useState<{
    checked: boolean;
    ready: boolean;
    message?: string;
  }>({ checked: false, ready: false });

  // AI Engine health status
  const [aiEngineStatus, setAiEngineStatus] = useState<{
    checked: boolean;
    online: boolean;
    configured: boolean;
    model?: string;
    deployment?: string;
    error?: string;
  }>({ checked: false, online: false, configured: false });

  // Existing data for duplicate checking
  const existingRPE = useMemo(() => DataStore.getRPEEntries(), []);
  const existingRecords = useMemo(() => DataStore.getPlayerRecords(), []);
  const existingSessions = useMemo(() => DataStore.getSessionsMeta(), []);

  // Check Supabase Storage bucket and AI status on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      // 1. Probe Storage
      try {
        const res = await SupabaseService.uploadSourceImage('test_probe', {
          name: 'probe.txt',
          base64: 'cHJvYmU=',
          type: 'text/plain',
        });
        if (isMounted) {
          setStorageStatus({
            checked: true,
            ready: res.bucketReady,
            message: res.bucketReady
              ? 'Supabase Storage bucket "import-source-images" is ready.'
              : 'Supabase Storage bucket is not yet provisioned. Image audit metadata will be safely preserved in PostgreSQL import_history table.',
          });
        }
      } catch {
        if (isMounted) {
          setStorageStatus({
            checked: true,
            ready: false,
            message: 'Supabase Storage bucket is offline or unprovisioned.',
          });
        }
      }

      // 2. Probe AI Vision Backend Status
      try {
        const aiRes = await fetch('/api/ai/status');
        if (isMounted) {
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            setAiEngineStatus({
              checked: true,
              online: true,
              configured: Boolean(aiData.configured),
              model: aiData.model || 'gemini-3.8-flash',
              deployment: aiData.deployment || 'express-server',
            });
          } else {
            setAiEngineStatus({
              checked: true,
              online: false,
              configured: false,
              error: `API endpoint /api/ai/status returned HTTP ${aiRes.status}. Server or Netlify Function not responding.`,
            });
          }
        }
      } catch (aiErr: any) {
        if (isMounted) {
          setAiEngineStatus({
            checked: true,
            online: false,
            configured: false,
            error: `Failed to connect to /api/ai/status: ${aiErr.message || 'Network error'}`,
          });
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Convert and optimize image for OCR (downscales ultra-high-res images to max 1800px width/height while maintaining crisp text clarity)
  const processAndOptimizeImage = (file: File): Promise<{ base64: string; mimeType: string; size: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (err) => reject(err);
      reader.onload = () => {
        const rawBase64 = reader.result as string;
        const img = new Image();
        img.onerror = () => resolve({ base64: rawBase64, mimeType: file.type || 'image/png', size: file.size });
        img.onload = () => {
          const maxDim = 1800; // Optimal resolution for basketball table text and fast network payloads
          let { width, height } = img;
          if (width <= maxDim && height <= maxDim && file.size < 900 * 1024) {
            // Already optimal size
            return resolve({ base64: rawBase64, mimeType: file.type || 'image/png', size: file.size });
          }

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve({ base64: rawBase64, mimeType: file.type || 'image/png', size: file.size });
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // For photos/screenshots > 1.2MB, compress as high-quality JPEG (0.88) to shrink payload from 8MB to ~300KB
          const targetMime = file.size > 1.2 * 1024 * 1024 ? 'image/jpeg' : (file.type || 'image/png');
          const optimizedBase64 = canvas.toDataURL(targetMime, 0.88);
          resolve({
            base64: optimizedBase64,
            mimeType: targetMime,
            size: Math.round(optimizedBase64.length * 0.75),
          });
        };
        img.src = rawBase64;
      };
      reader.readAsDataURL(file);
    });
  };

  // -------------------------------------------------------------
  // STEP 1: Handle Multiple Image Selection
  // -------------------------------------------------------------
  const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setGlobalError(null);
    const newItems: UploadedImageItem[] = [];

    for (const file of files) {
      // Validate image format
      if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
        alert(`Unsupported file type: "${file.name}". Please upload PNG, JPG, or WEBP images.`);
        continue;
      }

      try {
        const { base64, mimeType: optMime, size: optSize } = await processAndOptimizeImage(file);
        const todayStr = new Date().toISOString().split('T')[0];

        // Suggest date from filename if present (e.g. 2026-08-11 or 20260811)
        let suggestedDate = todayStr;
        const dateMatch = file.name.match(/(20\d{2})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/);
        if (dateMatch) {
          suggestedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        } else {
          const compact = file.name.match(/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
          if (compact) suggestedDate = `${compact[1]}-${compact[2]}-${compact[3]}`;
        }

        newItems.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          fileName: file.name,
          fileSize: optSize,
          mimeType: optMime,
          previewUrl: URL.createObjectURL(file),
          base64Data: base64,
          status: 'PENDING',
          detectedDates: [suggestedDate],
          primaryDate: suggestedDate,
          extractedCount: 0,
        });
      } catch (err: any) {
        console.error('Failed reading file:', file.name, err);
      }
    }

    if (newItems.length > 0) {
      setUploadedImages((prev) => [...prev, ...newItems]);
      setStep(2);
    }
  };

  // -------------------------------------------------------------
  // STEP 2: Vision AI Analysis per Image
  // -------------------------------------------------------------
  const analyzeSingleImage = async (
    item: UploadedImageItem,
    onStatusUpdate?: (status: string) => void
  ): Promise<{
    item: UploadedImageItem;
    records: ReviewRecordItem[];
  }> => {
    const endpoint = workflow === 'RPE' ? '/api/ai/parse-wellness-image' : '/api/ai/parse-gamesheet';
    const payload = {
      imageBase64: item.base64Data,
      mimeType: item.mimeType,
      filename: item.fileName,
      roster: roster.map((p) => ({
        id: p.id,
        number: p.number,
        displayName: p.displayName,
        position: p.position,
        aliases: p.aliases,
      })),
    };

    const maxRetries = 3;
    let lastError: any = null;
    let resJson: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      // 28-second timeout per attempt to match platform constraints
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      try {
        if (attempt > 1 && onStatusUpdate) {
          onStatusUpdate(`Retrying attempt ${attempt}/${maxRetries}...`);
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const status = response.status;
          let msg = errJson.error;

          if (!msg) {
            if (status === 504) {
              msg = `Server OCR gateway timed out (HTTP 504).`;
            } else if (status === 503) {
              msg = `AI model is temporarily experiencing high demand (HTTP 503).`;
            } else if (status === 429) {
              msg = `API rate limit reached (HTTP 429).`;
            } else if (status === 404) {
              msg = `API endpoint "${endpoint}" not found (HTTP 404). Backend server or Netlify Functions required.`;
            } else {
              msg = `Server OCR request failed (HTTP ${status})`;
            }
          }

          const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;
          if (isRetryable && attempt < maxRetries) {
            const retryAfter = response.headers.get('Retry-After');
            let delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
            if (isNaN(delay) || delay <= 0) {
              delay = Math.min(1500 * Math.pow(2, attempt - 1) + Math.random() * 500, 6000);
            }
            if (onStatusUpdate) {
              onStatusUpdate(`Server busy (${status}). Retrying in ${Math.round(delay / 1000)}s...`);
            }
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          throw new Error(msg);
        }

        resJson = await response.json();
        break; // Successfully received response
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        const isAbort = err.name === 'AbortError';
        const msg = err.message || '';
        const isRetryable =
          isAbort ||
          msg.includes('504') ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError');

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.min(1500 * Math.pow(2, attempt - 1) + Math.random() * 500, 6000);
          if (onStatusUpdate) {
            onStatusUpdate(
              isAbort
                ? `Timed out (504). Retrying attempt ${attempt + 1}/${maxRetries}...`
                : `Retrying attempt ${attempt + 1}/${maxRetries}...`
            );
          }
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (isAbort) {
          throw new Error(
            'Image analysis timed out after 28 seconds (Gateway Timeout / 504). Please retry or optimize the screenshot.'
          );
        }
        throw err;
      }
    }

    if (!resJson || !resJson.success || !resJson.data) {
      throw lastError || new Error('Vision OCR failed to parse table.');
    }

    const data = resJson.data;
    const records: ReviewRecordItem[] = [];
    const detectedDates: string[] = [];

    if (workflow === 'RPE') {
      // Process RPE & Wellness entries
      const entries = Array.isArray(data.entries) ? data.entries : [];
      if (Array.isArray(data.detectedDates)) {
        detectedDates.push(...data.detectedDates.filter(Boolean));
      }

      for (let i = 0; i < entries.length; i++) {
        const ent = entries[i];
        const recordDate = ent.date || item.primaryDate || new Date().toISOString().split('T')[0];
        if (!detectedDates.includes(recordDate)) detectedDates.push(recordDate);

        // Match against roster
        const rawNum = ent.jerseyNumber ? String(ent.jerseyNumber).replace(/[^0-9]/g, '') : undefined;
        const rawName = ent.playerName || ent.playerIdentifier || '';
        const matched = DataStore.matchPlayer(rawName, rawNum);

        // Validation warnings
        const warnings: string[] = [];
        let confidence: ReviewRecordItem['confidence'] = ent.confidence || 'HIGH';

        if (!matched) {
          confidence = 'UNMATCHED';
          warnings.push('Unmatched athlete: Roster confirmation required');
        } else if (rawNum && matched.number.replace(/[^0-9]/g, '') !== rawNum) {
          confidence = 'MEDIUM';
          warnings.push(`Extracted #${rawNum} differs from roster ${matched.number}`);
        }

        // Validate RPE score
        let validatedRpe: number | null = null;
        if (ent.rpeScore !== null && ent.rpeScore !== undefined) {
          const num = Number(ent.rpeScore);
          if (isNaN(num)) {
            warnings.push('Unreadable RPE value');
          } else if (num < 1 || num > 10) {
            warnings.push(`RPE score (${num}) is outside standard 1-10 Borg CR10 scale`);
            validatedRpe = num;
          } else {
            validatedRpe = num;
          }
        } else {
          warnings.push('No RPE value detected in cell (Rest / Off / Missing)');
        }

        // Check duplicates in existing database
        const isDup = matched
          ? existingRPE.some((e) => e.player_id === matched.id && e.date === recordDate)
          : false;

        records.push({
          id: `rec_${item.id}_${i}`,
          imageId: item.id,
          imageFileName: item.fileName,
          date: recordDate,
          matchedPlayer: matched,
          extractedName: rawName,
          extractedNumber: rawNum,
          rpeScore: validatedRpe,
          wellnessScore: ent.wellnessScore !== null ? Number(ent.wellnessScore) : null,
          sorenessScore: ent.sorenessScore !== null ? Number(ent.sorenessScore) : null,
          durationMin: ent.durationMin !== null ? Number(ent.durationMin) : null,
          notes: ent.notes || '',
          minutesNumeric: null,
          confidence,
          warnings: [...warnings, ...(ent.warning ? [ent.warning] : [])],
          isDuplicate: isDup,
          duplicateAction: isDup ? 'UPDATE' : 'UPDATE',
          isReviewed: false,
          isSelectedForImport: Boolean(matched && validatedRpe !== null),
        });
      }
    } else {
      // Process Game Minutes & Box Score
      const gameDate = data.gameDate || item.primaryDate;
      if (gameDate && !detectedDates.includes(gameDate)) detectedDates.push(gameDate);

      const players = Array.isArray(data.players) ? data.players : [];
      for (let i = 0; i < players.length; i++) {
        const pl = players[i];
        const rawNum = pl.number ? String(pl.number).replace(/[^0-9]/g, '') : undefined;
        const rawName = pl.name || '';
        const matched = DataStore.matchPlayer(rawName, rawNum);

        const warnings: string[] = [];
        let confidence: ReviewRecordItem['confidence'] = pl.confidence || 'HIGH';

        if (!matched) {
          confidence = 'UNMATCHED';
          warnings.push('Unmatched athlete: Roster confirmation required');
        }

        // Minutes interpretation
        let numericMins: number | null = null;
        if (pl.minutesNumeric !== null && pl.minutesNumeric !== undefined) {
          numericMins = Number(pl.minutesNumeric);
        } else if (pl.minutesRaw) {
          const raw = String(pl.minutesRaw).trim();
          if (raw.includes(':')) {
            const parts = raw.split(':');
            const mm = parseInt(parts[0], 10);
            const ss = parseInt(parts[1], 10);
            if (!isNaN(mm) && !isNaN(ss)) {
              numericMins = Number((mm + ss / 60).toFixed(1));
            }
          } else {
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) numericMins = parsed;
          }
        }

        if (numericMins === null) {
          warnings.push('Player did not play or minutes missing/DNP');
        }

        // Check if player record already has game_minutes on this date
        const isDup = matched
          ? existingRecords.some(
              (r) => r.player_id === matched.id && r.date === gameDate && r.game_minutes && r.game_minutes > 0
            )
          : false;

        records.push({
          id: `rec_${item.id}_${i}`,
          imageId: item.id,
          imageFileName: item.fileName,
          date: gameDate,
          matchedPlayer: matched,
          extractedName: rawName,
          extractedNumber: rawNum,
          rpeScore: null,
          minutesRaw: pl.minutesRaw || (numericMins !== null ? String(numericMins) : 'DNP'),
          minutesNumeric: numericMins,
          starter: Boolean(pl.starter),
          opponent: data.opponent || 'Opponent',
          confidence,
          warnings: [...warnings, ...(pl.warning ? [pl.warning] : [])],
          isDuplicate: isDup,
          duplicateAction: isDup ? 'UPDATE' : 'UPDATE',
          isReviewed: false,
          isSelectedForImport: Boolean(matched && numericMins !== null),
        });
      }
    }

    const updatedItem: UploadedImageItem = {
      ...item,
      status: 'SUCCESS',
      statusDetail: `Extracted via ${resJson.modelUsed || 'gemini-3.8-flash'}`,
      modelUsed: resJson.modelUsed,
      errorMessage: undefined,
      detectedDates: detectedDates.length > 0 ? detectedDates : [item.primaryDate],
      primaryDate: detectedDates[0] || item.primaryDate,
      detectedOpponent: data.opponent,
      detectedSheetTitle: data.sheetTitle,
      extractedCount: records.length,
    };

    return { item: updatedItem, records };
  };

  const handleAnalyzeAllImages = async () => {
    if (uploadedImages.length === 0) return;

    setIsProcessingOcr(true);
    setGlobalError(null);

    for (const imgItem of uploadedImages) {
      // Skip if already parsed with results unless error
      if (imgItem.status === 'SUCCESS' && imgItem.extractedCount > 0) {
        continue;
      }

      try {
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === imgItem.id
              ? { ...img, status: 'ANALYZING', errorMessage: undefined, statusDetail: 'Scanning table with AI Vision...' }
              : img
          )
        );

        const { item: processedItem, records } = await analyzeSingleImage(imgItem, (statusDetail) => {
          setUploadedImages((prev) =>
            prev.map((img) => (img.id === imgItem.id ? { ...img, statusDetail } : img))
          );
        });

        setUploadedImages((prev) =>
          prev.map((img) => (img.id === imgItem.id ? processedItem : img))
        );

        // Store records incrementally without duplicates
        setReviewRecords((prev) => [
          ...prev.filter((r) => r.imageId !== imgItem.id),
          ...records,
        ]);
      } catch (err: any) {
        console.error('OCR analysis error on', imgItem.fileName, err);
        const failedItem: UploadedImageItem = {
          ...imgItem,
          status: 'ERROR',
          errorMessage: err.message || 'Vision model OCR analysis failed.',
          statusDetail: undefined,
        };
        setUploadedImages((prev) =>
          prev.map((img) => (img.id === imgItem.id ? failedItem : img))
        );
      }
    }

    setIsProcessingOcr(false);

    setUploadedImages((curr) => {
      const successCount = curr.filter((img) => img.status === 'SUCCESS').length;
      const failedCount = curr.filter((img) => img.status === 'ERROR').length;
      if (successCount > 0 && failedCount === 0) {
        triggerToast(`Analysis complete: all ${successCount} image(s) processed!`);
        setStep(3);
      } else if (successCount > 0 && failedCount > 0) {
        triggerToast(`Extracted ${successCount} image(s). ${failedCount} image(s) encountered errors.`);
        setGlobalError(`${failedCount} image(s) failed analysis. You can retry failed images or proceed to review successfully parsed records.`);
      } else {
        const firstError = curr.find((img) => img.errorMessage)?.errorMessage;
        setGlobalError(
          firstError
            ? `Image analysis failed: ${firstError}`
            : 'Failed to analyze selected images. Please verify your connection or retry.'
        );
      }
      return curr;
    });
  };

  const handleRetryFailedImages = async () => {
    const failedList = uploadedImages.filter((img) => img.status === 'ERROR');
    if (failedList.length === 0) return;

    setIsProcessingOcr(true);
    setGlobalError(null);

    for (const imgItem of failedList) {
      try {
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === imgItem.id
              ? { ...img, status: 'ANALYZING', errorMessage: undefined, statusDetail: 'Retrying analysis...' }
              : img
          )
        );

        const { item: processedItem, records } = await analyzeSingleImage(imgItem, (statusDetail) => {
          setUploadedImages((prev) =>
            prev.map((img) => (img.id === imgItem.id ? { ...img, statusDetail } : img))
          );
        });

        setUploadedImages((prev) =>
          prev.map((img) => (img.id === imgItem.id ? processedItem : img))
        );

        setReviewRecords((prev) => [
          ...prev.filter((r) => r.imageId !== imgItem.id),
          ...records,
        ]);
      } catch (err: any) {
        const failedItem: UploadedImageItem = {
          ...imgItem,
          status: 'ERROR',
          errorMessage: err.message || 'Vision model OCR analysis failed.',
          statusDetail: undefined,
        };
        setUploadedImages((prev) =>
          prev.map((img) => (img.id === imgItem.id ? failedItem : img))
        );
      }
    }

    setIsProcessingOcr(false);
  };

  const handleReanalyzeSingleImage = async (imageId: string) => {
    const target = uploadedImages.find((img) => img.id === imageId);
    if (!target) return;

    try {
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, status: 'ANALYZING', errorMessage: undefined, statusDetail: 'Scanning table...' }
            : img
        )
      );

      const { item: processedItem, records } = await analyzeSingleImage(target, (statusDetail) => {
        setUploadedImages((prev) =>
          prev.map((img) => (img.id === imageId ? { ...img, statusDetail } : img))
        );
      });

      setUploadedImages((prev) =>
        prev.map((img) => (img.id === imageId ? processedItem : img))
      );

      // Replace records for this image without duplicates
      setReviewRecords((prev) => [
        ...prev.filter((r) => r.imageId !== imageId),
        ...records,
      ]);

      triggerToast(`Re-analyzed "${target.fileName}": ${records.length} records extracted.`);
    } catch (err: any) {
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, status: 'ERROR', errorMessage: err.message, statusDetail: undefined }
            : img
        )
      );
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
    setReviewRecords((prev) => prev.filter((r) => r.imageId !== imageId));
    if (uploadedImages.length <= 1) {
      setStep(1);
    }
  };

  const handleUpdateImageDate = (imageId: string, newDate: string) => {
    setUploadedImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, primaryDate: newDate } : img))
    );
    // Also update associated review records if they share the previous primary date
    setReviewRecords((prev) =>
      prev.map((rec) => (rec.imageId === imageId ? { ...rec, date: newDate } : rec))
    );
  };

  // -------------------------------------------------------------
  // STEP 3: Mandatory Human Review Handlers
  // -------------------------------------------------------------
  const updateReviewRecord = (recordId: string, updates: Partial<ReviewRecordItem>) => {
    setReviewRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const updated = { ...rec, ...updates };

        // If player assignment changed, update validation and duplicate status
        if (updates.matchedPlayer !== undefined) {
          if (updated.matchedPlayer) {
            updated.confidence = 'HIGH';
            updated.warnings = updated.warnings.filter((w) => !w.includes('Unmatched'));
            // Re-check duplicate
            if (workflow === 'RPE') {
              updated.isDuplicate = existingRPE.some(
                (e) => e.player_id === updated.matchedPlayer!.id && e.date === updated.date
              );
            } else {
              updated.isDuplicate = existingRecords.some(
                (r) =>
                  r.player_id === updated.matchedPlayer!.id &&
                  r.date === updated.date &&
                  r.game_minutes &&
                  r.game_minutes > 0
              );
            }
          } else {
            updated.confidence = 'UNMATCHED';
            if (!updated.warnings.some((w) => w.includes('Unmatched'))) {
              updated.warnings.push('Unmatched athlete: Roster confirmation required');
            }
          }
        }

        // Mark as manually reviewed
        updated.isReviewed = true;
        return updated;
      })
    );
  };

  const toggleSelectRecord = (recordId: string) => {
    setReviewRecords((prev) =>
      prev.map((rec) =>
        rec.id === recordId ? { ...rec, isSelectedForImport: !rec.isSelectedForImport } : rec
      )
    );
  };

  const selectAllRecords = (selected: boolean) => {
    setReviewRecords((prev) =>
      prev.map((rec) => ({
        ...rec,
        isSelectedForImport: rec.matchedPlayer ? selected : false,
      }))
    );
  };

  // -------------------------------------------------------------
  // STEP 4: Database Persistence Execution
  // -------------------------------------------------------------
  const handleExecuteBulkImport = async () => {
    if (isSavingToDatabase) return;
    setGlobalError(null);

    const recordsToImport = reviewRecords.filter((r) => r.isSelectedForImport && r.matchedPlayer !== null);
    if (recordsToImport.length === 0) {
      alert('No valid athlete records are selected for import. Please assign athletes and ensure values are valid.');
      return;
    }

    // Check for unresolved invalid values
    if (workflow === 'RPE') {
      const invalidRpes = recordsToImport.filter((r) => r.rpeScore === null || r.rpeScore < 1 || r.rpeScore > 10);
      if (invalidRpes.length > 0) {
        const proceed = confirm(
          `${invalidRpes.length} selected record(s) have empty or invalid RPE values. They will be skipped. Continue?`
        );
        if (!proceed) return;
      }
    } else {
      const invalidMins = recordsToImport.filter((r) => r.minutesNumeric === null || r.minutesNumeric < 0);
      if (invalidMins.length > 0) {
        const proceed = confirm(
          `${invalidMins.length} selected record(s) have missing or zero minutes. Continue?`
        );
        if (!proceed) return;
      }
    }

    setIsSavingToDatabase(true);
    const batchId = `batch_${Date.now()}`;

    try {
      // 1. Attempt uploading source images to private Supabase Storage bucket for auditability
      let savedStoragePath: string | null = null;
      for (const img of uploadedImages) {
        try {
          const uploadRes = await SupabaseService.uploadSourceImage(batchId, {
            name: img.fileName,
            base64: img.base64Data,
            type: img.mimeType,
          });
          if (uploadRes.path) {
            savedStoragePath = uploadRes.path;
          }
        } catch (storageErr) {
          console.warn('Storage upload notice for', img.fileName, storageErr);
        }
      }

      let savedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      // 2. Persist records according to workflow
      if (workflow === 'RPE') {
        const rpePayloads = recordsToImport
          .filter((r) => r.rpeScore !== null && r.rpeScore >= 1 && r.rpeScore <= 10)
          .map((r) => {
            if (r.isDuplicate && r.duplicateAction === 'SKIP') {
              skippedCount++;
              return null;
            }

            // Look up session_id if exists for this date
            const existingSession = existingSessions.find((s) => s.date === r.date);

            return {
              player_id: r.matchedPlayer!.id,
              player_number: r.matchedPlayer!.number,
              session_id: existingSession ? existingSession.id : null,
              date: r.date,
              rpe_score: Number(r.rpeScore),
              duration_min: r.durationMin || existingSession?.duration_min || 90,
              notes: r.notes || `Bulk image OCR import (${r.imageFileName})`,
            };
          })
          .filter(Boolean) as Omit<RPEEntry, 'id' | 'created_at'>[];

        const saveRes = await DataStore.saveBatchRPEAsync(rpePayloads);
        savedCount = saveRes.saved.length;
        failedCount = saveRes.errors.length;

        if (failedCount > 0) {
          console.error('[BulkDataImport] Errors during RPE persistence:', saveRes.errors);
        }
      } else {
        // Game Minutes persistence
        const minutesPayloads = recordsToImport
          .filter((r) => r.minutesNumeric !== null && r.minutesNumeric >= 0)
          .map((r) => {
            if (r.isDuplicate && r.duplicateAction === 'SKIP') {
              skippedCount++;
              return null;
            }

            return {
              playerId: r.matchedPlayer!.id,
              playerNumber: r.matchedPlayer!.number,
              playerName: r.matchedPlayer!.displayName,
              date: r.date,
              minutes: Number(r.minutesNumeric),
              starter: Boolean(r.starter),
              opponent: r.opponent || 'Opponent',
            };
          })
          .filter(Boolean) as {
            playerId: string;
            playerNumber: string;
            playerName: string;
            date: string;
            minutes: number;
            starter?: boolean;
            opponent?: string;
          }[];

        const saveRes = await DataStore.saveBatchGameMinutesAsync(minutesPayloads);
        savedCount = saveRes.savedCount;
        failedCount = saveRes.errors.length;
      }

      // 3. Record in public.import_history for full compliance and auditability
      const uniqueDates = Array.from(new Set(recordsToImport.map((r) => r.date)));
      const uniquePlayers = Array.from(new Set(recordsToImport.map((r) => r.matchedPlayer!.id)));

      await SupabaseService.saveImportHistory({
        id: `imp_img_${Date.now()}`,
        filename: uploadedImages.map((img) => img.fileName).join(', '),
        sessionDate: uniqueDates[0] || new Date().toISOString().split('T')[0],
        acceptedRows: savedCount,
        rejectedRows: failedCount,
        duplicateRows: skippedCount,
        status: failedCount === 0 ? 'COMPLETED' : 'PARTIAL',
        metadata: {
          importType: workflow === 'RPE' ? 'WELLNESS_RPE_IMAGE' : 'GAME_MINUTES_BOXSCORE_IMAGE',
          batchId,
          imageCount: uploadedImages.length,
          dates: uniqueDates,
          storageBucket: 'import-source-images',
          storageReference: savedStoragePath,
        },
      });

      setImportSummary({
        batchId,
        workflow,
        totalImages: uploadedImages.length,
        savedRecordsCount: savedCount,
        skippedCount,
        failedCount,
        storagePath: savedStoragePath,
        datesCount: uniqueDates.length,
        uniquePlayersCount: uniquePlayers.length,
      });

      setIsSavingToDatabase(false);
      setStep(4);
      triggerToast(`Import completed! ${savedCount} records saved to database.`);
    } catch (err: any) {
      console.error('Fatal bulk import persistence error:', err);
      setGlobalError(`Database persistence error: ${err.message || String(err)}`);
      setIsSavingToDatabase(false);
    }
  };

  // Filtered review records for display
  const filteredRecords = useMemo(() => {
    return reviewRecords.filter((rec) => {
      if (filterDate !== 'ALL' && rec.date !== filterDate) return false;
      if (filterConfidence === 'NEEDS_REVIEW') {
        return rec.confidence !== 'HIGH' || rec.warnings.length > 0;
      }
      if (filterConfidence === 'DUPLICATES') {
        return rec.isDuplicate;
      }
      return true;
    });
  }, [reviewRecords, filterDate, filterConfidence]);

  const allAvailableDates = useMemo(() => {
    return Array.from(new Set(reviewRecords.map((r) => r.date))).sort();
  }, [reviewRecords]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-zinc-950 px-5 py-3 rounded-lg shadow-2xl font-black flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Image Modal Lightbox */}
      {modalPreviewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-w-4xl max-h-[90vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-orange-400">SOURCE SCREENSHOT PREVIEW</span>
              <button
                onClick={() => setModalPreviewImage(null)}
                className="text-zinc-400 hover:text-white text-xs font-bold px-2 py-1 bg-zinc-800 rounded"
              >
                Close ✕
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center">
              <img
                src={modalPreviewImage}
                alt="Source preview"
                className="max-h-[75vh] object-contain rounded border border-zinc-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Module Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-orange-500 text-xs font-black tracking-widest uppercase mb-1 flex items-center space-x-1.5">
            <ScanLine className="w-4 h-4" />
            <span>AI VISION INGESTION ENGINE</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide">
            BULK DATA IMPORT — IMAGE RECOGNITION
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Import historical wellness/RPE ratings and basketball box score game minutes from multiple screenshots or photos across multiple dates using real Gemini Vision OCR.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                aiEngineStatus.online && aiEngineStatus.configured
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                  : aiEngineStatus.online && !aiEngineStatus.configured
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  aiEngineStatus.online && aiEngineStatus.configured
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              />
              <span>
                {aiEngineStatus.online
                  ? `Gemini Vision: ${aiEngineStatus.model || 'gemini-3.8-flash'} (Online)`
                  : aiEngineStatus.checked
                  ? 'Vision OCR Engine: Offline (Check Express port 3000 / Netlify Functions)'
                  : 'Checking Vision OCR Engine...'}
              </span>
            </span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center space-x-1.5 text-xs font-bold overflow-x-auto">
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 1
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            1. Select Images
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 2
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            2. Analyze Images
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 3
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            3. Review & Edit
          </div>
          <span className="text-zinc-600">→</span>
          <div
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              step === 4
                ? 'bg-orange-600 text-zinc-950 border-orange-500 font-black'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            4. Summary
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-4 bg-rose-950/80 border border-rose-600 rounded-lg text-rose-200 text-xs flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Notice:</span>
            <span>{globalError}</span>
          </div>
        </div>
      )}

      {/* Workflow Selector Tabs (Step 1 & 2 only) */}
      {step <= 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              if (workflow !== 'RPE') {
                setWorkflow('RPE');
                setUploadedImages([]);
                setReviewRecords([]);
                setStep(1);
              }
            }}
            className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
              workflow === 'RPE'
                ? 'bg-orange-950/40 border-orange-500/80 ring-1 ring-orange-500/30'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                  workflow === 'RPE' ? 'bg-orange-600 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-orange-400">
                  WORKFLOW A
                </div>
                <div className="text-base font-black text-white">
                  Wellness & RPE Image Import
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Extract player perceived exertion (1-10 Borg CR10) from single-day sheets or weekly multi-date training screenshots.
            </p>
          </button>

          <button
            onClick={() => {
              if (workflow !== 'GAME_MINUTES') {
                setWorkflow('GAME_MINUTES');
                setUploadedImages([]);
                setReviewRecords([]);
                setStep(1);
              }
            }}
            className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
              workflow === 'GAME_MINUTES'
                ? 'bg-orange-950/40 border-orange-500/80 ring-1 ring-orange-500/30'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                  workflow === 'GAME_MINUTES' ? 'bg-orange-600 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-orange-400">
                  WORKFLOW B
                </div>
                <div className="text-base font-black text-white">
                  Game Minutes & Box Score Import
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Extract official playing time from B.LEAGUE box scores (e.g. 28:34 → 28.6 min) across one or multiple game dates.
            </p>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 1: Multi-Image File Selection */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-orange-500/60 rounded-xl p-10 text-center transition-all bg-zinc-950/40">
            <FileImage className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-white">
              Upload {workflow === 'RPE' ? 'Wellness / RPE' : 'Game Box Score'} Screenshots
            </h3>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto mt-1 mb-6">
              Select one or multiple images (PNG, JPG, WEBP). Multiple dates and multi-day table formats are fully supported.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <label className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-extrabold px-6 py-3 rounded-lg text-xs cursor-pointer shadow-lg transition-colors flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>SELECT SCREENSHOTS (MULTI-IMAGE SUPPORTED)</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  multiple
                  onChange={handleImageFilesSelected}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Guidelines Box */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
            <div className="font-bold text-zinc-200 flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-orange-500" />
              <span>Image Recognition Capabilities & Rules</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li>
                <strong className="text-zinc-300">Roster Grounding:</strong> Extracted names & numbers are verified against the 13 Orange Vikings athletes (#1, #2, #3, #8, #11, #13, #14, #16, #17, #44, #50, #65, #78).
              </li>
              <li>
                <strong className="text-zinc-300">Multi-Date Grids:</strong> Weekly spreadsheets with dates across columns (e.g. Mon–Sun) maintain individual date-player associations.
              </li>
              <li>
                <strong className="text-zinc-300">Strict Minutes Conversion:</strong> Game minutes in MM:SS (e.g. 28:34) are mathematically converted to total minutes (28.6). 00:00 is preserved as 0, while DNP is recorded as unplayed.
              </li>
              <li>
                <strong className="text-zinc-300">Mandatory Human Review:</strong> No data is written to Supabase without your explicit review and confirmation in Step 3.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 2: Multi-Image Review Cards & Trigger Analysis */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <span>UPLOADED IMAGES QUEUE</span>
                <span className="bg-orange-950 text-orange-400 border border-orange-800 text-[10px] px-2 py-0.5 rounded font-black">
                  {uploadedImages.length} {uploadedImages.length === 1 ? 'IMAGE' : 'IMAGES'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review dates and trigger AI Vision recognition. You can adjust the session date or add more images before processing.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-1.5 rounded text-xs cursor-pointer border border-zinc-700 flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Add More Images</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  multiple
                  onChange={handleImageFilesSelected}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setUploadedImages([]);
                  setReviewRecords([]);
                  setStep(1);
                }}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded hover:bg-zinc-800"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Cards for Every Uploaded Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedImages.map((img, idx) => (
              <div
                key={img.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Header */}
                  <div className="relative h-36 bg-zinc-950 border-b border-zinc-800 flex items-center justify-center overflow-hidden group">
                    <img
                      src={img.previewUrl}
                      alt={img.fileName}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                    <button
                      onClick={() => setModalPreviewImage(img.previewUrl)}
                      className="absolute bottom-2 right-2 bg-zinc-900/90 text-zinc-200 border border-zinc-700 p-1.5 rounded text-[10px] font-bold flex items-center space-x-1 hover:bg-orange-600 hover:text-zinc-950 transition-colors"
                      title="View full image"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-2 right-2 bg-zinc-950/80 text-zinc-400 hover:text-rose-400 p-1.5 rounded"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate max-w-[180px]" title={img.fileName}>
                        {img.fileName}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                        {(img.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    {/* Date Selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-orange-400" />
                        <span>ASSOCIATED SESSION DATE</span>
                      </label>
                      <input
                        type="date"
                        value={img.primaryDate}
                        onChange={(e) => handleUpdateImageDate(img.id, e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-zinc-400">Recognition Status:</span>
                      {img.status === 'PENDING' && (
                        <span className="text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-bold">
                          Pending Analysis
                        </span>
                      )}
                      {img.status === 'ANALYZING' && (
                        <span className="text-orange-400 bg-orange-950/80 border border-orange-800 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{img.statusDetail || 'Scanning...'}</span>
                        </span>
                      )}
                      {img.status === 'SUCCESS' && (
                        <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded font-bold flex items-center space-x-1" title={img.statusDetail}>
                          <Check className="w-3 h-3" />
                          <span>{img.extractedCount} Records</span>
                        </span>
                      )}
                      {img.status === 'ERROR' && (
                        <span className="text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded font-bold">
                          Analysis Failed
                        </span>
                      )}
                    </div>

                    {img.statusDetail && img.status === 'SUCCESS' && (
                      <p className="text-[10px] text-zinc-400 bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800">
                        {img.statusDetail}
                      </p>
                    )}

                    {img.errorMessage && (
                      <p className="text-[10px] text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-800 break-words">
                        {img.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase font-black">
                    IMAGE #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleReanalyzeSingleImage(img.id)}
                    disabled={isProcessingOcr}
                    className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Scan Individually</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-white font-bold cursor-pointer"
            >
              ← Back to File Picker
            </button>

            <div className="flex flex-wrap items-center gap-3">
              {uploadedImages.some((img) => img.status === 'ERROR') && (
                <button
                  onClick={handleRetryFailedImages}
                  disabled={isProcessingOcr}
                  className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 font-bold px-4 py-2.5 rounded-lg text-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    Retry Failed ({uploadedImages.filter((img) => img.status === 'ERROR').length}) Images
                  </span>
                </button>
              )}

              {reviewRecords.length > 0 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={isProcessingOcr}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold px-4 py-2.5 rounded-lg text-xs flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <span>Proceed to Review ({reviewRecords.length} records ready)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                id="analyze-all-btn"
                onClick={handleAnalyzeAllImages}
                disabled={isProcessingOcr || uploadedImages.length === 0}
                className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {isProcessingOcr ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
                    <span>ANALYZING IMAGES (AUTO-RETRY ENABLED)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>ANALYZE ALL {uploadedImages.length} IMAGE(S)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 3: Mandatory Human Review & Inline Correction Table */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Header & Stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-orange-400 uppercase tracking-wider">
                  MANDATORY HUMAN REVIEW
                </span>
                <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono font-bold">
                  {workflow === 'RPE' ? 'WELLNESS / RPE' : 'GAME MINUTES'}
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-0.5">
                AUDIT & EDIT EXTRACTED RECORDS
              </h2>
              <p className="text-xs text-zinc-400">
                Verify recognized players and values before saving to Supabase. Unmatched athletes or ambiguous values can be corrected inline.
              </p>
            </div>

            {/* Quick Metric Pills */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {reviewRecords.filter((r) => r.matchedPlayer && r.confidence === 'HIGH').length} High Conf
              </span>
              <span className="flex items-center text-amber-400 font-bold bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {reviewRecords.filter((r) => r.confidence === 'MEDIUM' || r.warnings.length > 0).length} Review
              </span>
              <span className="flex items-center text-rose-400 font-bold bg-rose-950/60 border border-rose-800 px-2.5 py-1 rounded">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {reviewRecords.filter((r) => !r.matchedPlayer).length} Unmatched
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 text-zinc-400">
                <Filter className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-bold">Filter:</span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setFilterConfidence('ALL')}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
                    filterConfidence === 'ALL'
                      ? 'bg-orange-600 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  All ({reviewRecords.length})
                </button>
                <button
                  onClick={() => setFilterConfidence('NEEDS_REVIEW')}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
                    filterConfidence === 'NEEDS_REVIEW'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-900 text-amber-400 hover:text-amber-300'
                  }`}
                >
                  Needs Review ({reviewRecords.filter((r) => r.confidence !== 'HIGH' || r.warnings.length > 0).length})
                </button>
                <button
                  onClick={() => setFilterConfidence('DUPLICATES')}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
                    filterConfidence === 'DUPLICATES'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-900 text-purple-400 hover:text-purple-300'
                  }`}
                >
                  Duplicates ({reviewRecords.filter((r) => r.isDuplicate).length})
                </button>
              </div>

              {allAvailableDates.length > 1 && (
                <div className="flex items-center space-x-1 pl-3 border-l border-zinc-800">
                  <span className="text-zinc-500">Date:</span>
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="ALL">All Dates ({allAvailableDates.length})</option>
                    {allAvailableDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Selection Toggles */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => selectAllRecords(true)}
                className="text-[11px] text-zinc-300 hover:text-white font-semibold underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-zinc-600">|</span>
              <button
                onClick={() => selectAllRecords(false)}
                className="text-[11px] text-zinc-400 hover:text-white font-semibold underline cursor-pointer"
              >
                Deselect All
              </button>
              <span className="text-xs bg-zinc-900 text-zinc-400 px-2 py-1 rounded border border-zinc-800 font-mono">
                {reviewRecords.filter((r) => r.isSelectedForImport).length} queued for import
              </span>
            </div>
          </div>

          {/* Editable Review Table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 font-black uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        reviewRecords.length > 0 &&
                        reviewRecords.every((r) => r.isSelectedForImport)
                      }
                      onChange={(e) => selectAllRecords(e.target.checked)}
                      className="rounded text-orange-500"
                    />
                  </th>
                  <th className="p-3">Session Date</th>
                  <th className="p-3">OCR Extracted Athlete</th>
                  <th className="p-3">Matched Roster Player</th>
                  {workflow === 'RPE' ? (
                    <>
                      <th className="p-3">RPE Score (1-10)</th>
                      <th className="p-3">Wellness / Soreness</th>
                      <th className="p-3">Notes</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3">Extracted Minutes (MM:SS)</th>
                      <th className="p-3">Numeric Minutes</th>
                      <th className="p-3">Starter</th>
                    </>
                  )}
                  <th className="p-3">Confidence & Status</th>
                  <th className="p-3">Duplicate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/60">
                {filteredRecords.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-zinc-800/40 transition-colors ${
                      !row.isSelectedForImport ? 'opacity-40 bg-zinc-950/30' : ''
                    } ${row.isDuplicate ? 'bg-purple-950/20' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={row.isSelectedForImport}
                        onChange={() => toggleSelectRecord(row.id)}
                        className="rounded text-orange-500"
                      />
                    </td>

                    {/* Date */}
                    <td className="p-3 font-mono text-zinc-200">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateReviewRecord(row.id, { date: e.target.value })}
                        className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-bold"
                      />
                    </td>

                    {/* Raw Extracted Identifier */}
                    <td className="p-3">
                      <div className="font-bold text-white max-w-[140px] truncate" title={row.extractedName}>
                        {row.extractedName || '—'}
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center space-x-1">
                        <span>#{row.extractedNumber || '?'}</span>
                        <span>•</span>
                        <span className="truncate max-w-[90px]" title={row.imageFileName}>
                          {row.imageFileName}
                        </span>
                      </div>
                    </td>

                    {/* Matched Roster Player Dropdown */}
                    <td className="p-3">
                      <select
                        value={row.matchedPlayer?.id || ''}
                        onChange={(e) => {
                          const p = roster.find((item) => item.id === e.target.value) || null;
                          updateReviewRecord(row.id, { matchedPlayer: p });
                        }}
                        className={`bg-zinc-950 border text-xs rounded px-2.5 py-1 font-bold ${
                          row.matchedPlayer
                            ? 'border-emerald-700 text-emerald-300'
                            : 'border-rose-700 text-rose-400 ring-1 ring-rose-500'
                        }`}
                      >
                        <option value="">-- Assign Athlete --</option>
                        {roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.number} {p.displayName} ({p.position})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Workflow A: RPE Specific Fields */}
                    {workflow === 'RPE' ? (
                      <>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="0.5"
                            value={row.rpeScore ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateReviewRecord(row.id, { rpeScore: val });
                            }}
                            placeholder="1-10"
                            className={`w-20 bg-zinc-950 border rounded px-2 py-1 text-xs font-black text-center ${
                              row.rpeScore !== null && row.rpeScore >= 1 && row.rpeScore <= 10
                                ? 'border-orange-500 text-orange-400'
                                : 'border-rose-600 text-rose-300 bg-rose-950/40'
                            }`}
                          />
                        </td>

                        <td className="p-3 text-[11px] text-zinc-400">
                          {row.wellnessScore ? `Well: ${row.wellnessScore}/5 ` : ''}
                          {row.sorenessScore ? `Sore: ${row.sorenessScore}/5` : '—'}
                        </td>

                        <td className="p-3">
                          <input
                            type="text"
                            value={row.notes || ''}
                            onChange={(e) => updateReviewRecord(row.id, { notes: e.target.value })}
                            placeholder="Optional notes"
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 w-36 truncate"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Workflow B: Game Minutes Fields */}
                        <td className="p-3 font-mono text-zinc-400 text-xs">
                          {row.minutesRaw || '—'}
                        </td>

                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            step="0.1"
                            value={row.minutesNumeric ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateReviewRecord(row.id, { minutesNumeric: val });
                            }}
                            placeholder="Minutes"
                            className="w-20 bg-zinc-950 border border-amber-600 rounded px-2 py-1 text-xs font-black text-amber-400 text-center"
                          />
                        </td>

                        <td className="p-3">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(row.starter)}
                              onChange={(e) => updateReviewRecord(row.id, { starter: e.target.checked })}
                              className="rounded text-orange-500"
                            />
                            <span className="text-[10px] text-zinc-400">Start 5</span>
                          </label>
                        </td>
                      </>
                    )}

                    {/* Confidence & Warnings */}
                    <td className="p-3">
                      <div className="flex flex-col space-y-1">
                        {row.confidence === 'HIGH' ? (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded w-max">
                            CONFIDENT
                          </span>
                        ) : row.confidence === 'MEDIUM' ? (
                          <span className="text-[9px] font-black text-amber-400 bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 rounded w-max">
                            CHECK MATCH
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-rose-400 bg-rose-950/80 border border-rose-800 px-1.5 py-0.5 rounded w-max">
                            UNMATCHED
                          </span>
                        )}

                        {row.warnings.map((w, wIdx) => (
                          <span key={wIdx} className="text-[9px] text-amber-400 truncate max-w-[160px]" title={w}>
                            • {w}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Duplicate Action */}
                    <td className="p-3">
                      {row.isDuplicate ? (
                        <div className="flex flex-col space-y-1">
                          <span className="text-[9px] text-purple-400 font-bold bg-purple-950/80 border border-purple-800 px-1.5 py-0.5 rounded w-max">
                            DUPLICATE
                          </span>
                          <select
                            value={row.duplicateAction}
                            onChange={(e) =>
                              updateReviewRecord(row.id, {
                                duplicateAction: e.target.value as 'UPDATE' | 'SKIP',
                              })
                            }
                            className="bg-zinc-950 border border-purple-800 text-[10px] rounded px-1.5 py-0.5 text-purple-300"
                          >
                            <option value="UPDATE">Update Existing</option>
                            <option value="SKIP">Skip Row</option>
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-medium">New Record</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unauthenticated Staff Alert */}
          {!isAuthenticated && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Staff Notice: Operating in unauthenticated mode. PostgreSQL persistence requires active coach login or updated RLS policies in Supabase.
                </span>
              </div>
              {onNavigateSettings && (
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="text-xs text-orange-400 hover:text-orange-300 font-bold underline ml-2 shrink-0 cursor-pointer"
                >
                  Sign In / Database →
                </button>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(2)}
              disabled={isSavingToDatabase}
              className="text-xs text-zinc-400 hover:text-white font-bold cursor-pointer disabled:opacity-50"
            >
              ← Back to Image Queue
            </button>

            <button
              id="confirm-import-btn"
              onClick={handleExecuteBulkImport}
              disabled={
                isSavingToDatabase ||
                reviewRecords.filter((r) => r.isSelectedForImport && r.matchedPlayer).length === 0
              }
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {isSavingToDatabase ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
                  <span>PERSISTING RECORDS TO SUPABASE...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    CONFIRM & SAVE {reviewRecords.filter((r) => r.isSelectedForImport && r.matchedPlayer).length} RECORD(S) TO SUPABASE
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 4: Ingestion Audit & Final Database Summary Report */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && importSummary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Banner Status */}
          <div
            className={`p-6 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              importSummary.failedCount === 0
                ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-200'
                : 'bg-amber-950/50 border-amber-700/80 text-amber-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  importSummary.failedCount === 0
                    ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
                    : 'bg-amber-900/60 border-amber-500 text-amber-300'
                }`}
              >
                {importSummary.failedCount === 0 ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  BULK VISION DATA INGESTION COMPLETED
                </h2>
                <p className="text-xs mt-0.5 opacity-90">
                  {importSummary.savedRecordsCount} records successfully written and confirmed in Supabase database across {importSummary.datesCount} date(s).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {workflow === 'RPE' && onNavigateRPE && (
                <button
                  onClick={onNavigateRPE}
                  className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 shrink-0 shadow-lg cursor-pointer transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  <span>VIEW RPE TRENDS</span>
                </button>
              )}

              {workflow === 'GAME_MINUTES' && onNavigateGames && (
                <button
                  onClick={onNavigateGames}
                  className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-5 py-2.5 rounded-lg text-xs flex items-center space-x-2 shrink-0 shadow-lg cursor-pointer transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  <span>VIEW GAME MINUTES</span>
                </button>
              )}
            </div>
          </div>

          {/* Metric Tiles Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Images Processed</span>
              <span className="text-white font-black text-lg">{importSummary.totalImages}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Records Persisted</span>
              <span className="text-emerald-400 font-black text-lg">{importSummary.savedRecordsCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Unique Athletes</span>
              <span className="text-amber-400 font-black text-lg">{importSummary.uniquePlayersCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Distinct Dates</span>
              <span className="text-sky-400 font-black text-lg">{importSummary.datesCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Duplicates Skipped</span>
              <span className="text-zinc-400 font-black text-lg">{importSummary.skippedCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
              <span className="text-zinc-500 text-[10px] font-extrabold uppercase block">Errors</span>
              <span className={importSummary.failedCount > 0 ? 'text-rose-400 font-black text-lg' : 'text-zinc-500 font-black text-lg'}>
                {importSummary.failedCount}
              </span>
            </div>
          </div>

          {/* Storage & Auditability Verification Card */}
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-orange-400 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SOURCE IMAGE AUDITABILITY & SUPABASE TRACKING</span>
            </div>
            <p className="text-zinc-400">
              Batch <code className="text-zinc-200 font-mono">{importSummary.batchId}</code> has been recorded in <code className="text-zinc-200">public.import_history</code> with filename references, date tags, and record counts.
            </p>
            {storageStatus.ready ? (
              <p className="text-emerald-400 flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Original image files archived in private Supabase Storage bucket <code>import-source-images</code>.</span>
              </p>
            ) : (
              <p className="text-zinc-400">
                Source metadata is preserved in PostgreSQL. (Optional: Run the private storage bucket SQL in Settings to enable direct S3/Supabase storage archiving).
              </p>
            )}
          </div>

          {/* Action Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={() => {
                setUploadedImages([]);
                setReviewRecords([]);
                setStep(1);
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Import More Screenshots
            </button>

            <div className="flex items-center space-x-3">
              {onNavigateDashboard && (
                <button
                  onClick={onNavigateDashboard}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Go to Today's Load
                </button>
              )}

              {workflow === 'RPE' && onNavigateRPE ? (
                <button
                  onClick={onNavigateRPE}
                  className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer transition-colors"
                >
                  <span>OPEN RPE LOGS & TRENDS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : onNavigateGames ? (
                <button
                  onClick={onNavigateGames}
                  className="bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 shadow-lg shadow-orange-950/40 cursor-pointer transition-colors"
                >
                  <span>OPEN GAME LOAD VIEW</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
