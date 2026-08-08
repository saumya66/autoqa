import React, { useState, useCallback } from 'react';
import {
  Plus,
  X,
  Image,
  MessageSquare,
  AlertCircle,
  Loader,
  ArrowRight,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  createCloudFeature,
  addImageToContext,
  addTextToContext,
  buildContext,
  buildFeatureContext,
  generateTestPlan,
  generateFeatureTests,
  approveAndGenerateTests,
  saveFeatureTests,
  type BuildContextResponse,
  type TestPlanResponse,
  type CloudTestCase,
  type ContextSummary,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateFeature,
  useBuildFeatureContext,
  useGenerateFeatureTests,
  useSaveFeatureTests,
} from '@/hooks/useProjectsQueries';

type Step = 'create' | 'select' | 'summary' | 'review';

interface LocalFile {
  id: string;
  file: File;
  type: 'image';
  name: string;
}

interface TextNote {
  id: string;
  text: string;
}

// Normalised shape used for both local and cloud context results
interface ContextResult {
  featureName: string;
  summary: ContextSummary;
  contextSummaryText?: string;
  processedItems?: BuildContextResponse['processed_items'];
  hasFeedback?: boolean;
}

interface CreateTestFlowProps {
  onClose?: () => void;
  /** When provided the cloud flow is used (build/generate via cloud endpoints). */
  projectId?: string;
}

export function CreateTestFlow({ onClose, projectId }: CreateTestFlowProps) {
  const token = useAuthStore((s) => s.token);
  const isCloudMode = !!(projectId && token);

  // Step 1 — feature details
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [contextId, setContextId] = useState<string | null>(null);      // local context id
  const [cloudFeatureId, setCloudFeatureId] = useState<string | null>(null); // cloud feature id
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Step 2 — asset selection
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [textNotes, setTextNotes] = useState<TextNote[]>([]);
  const [currentTextNote, setCurrentTextNote] = useState('');

  // Step 3 — context building
  const [isBuilding, setIsBuilding] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [contextResult, setContextResult] = useState<ContextResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [userFeedback, setUserFeedback] = useState('');
  const [testFeedback, setTestFeedback] = useState('');
  const [showTestFeedback, setShowTestFeedback] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Step 4 — test generation + review
  const [isGenerating, setIsGenerating] = useState(false);
  const [testPlan, setTestPlan] = useState<TestPlanResponse | null>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('create');

  // Image preview URLs (revoked on unmount)
  const thumbnailUrls = React.useMemo(
    () => localFiles.map((f) => URL.createObjectURL(f.file)),
    [localFiles]
  );
  React.useEffect(() => {
    return () => thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [thumbnailUrls]);

  // Cloud mutations — hooks must be at top level, params update on re-render
  const createFeatureMutation = useCreateFeature(projectId ?? '');
  const buildContextMutation = useBuildFeatureContext();
  const generateTestsMutation = useGenerateFeatureTests();
  const saveTestsMutation = useSaveFeatureTests(cloudFeatureId, projectId);

  // =========================================================================
  // Step 1: Create Feature
  // =========================================================================
  const handleCreateContext = async () => {
    if (!featureName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      if (isCloudMode) {
        const cloudFeature = await createFeatureMutation.mutateAsync({
          name: featureName,
          description: featureDescription || undefined,
        });
        setCloudFeatureId(cloudFeature.id);
      } else {
        const { createFeatureContext } = await import('@/api/client');
        const result = await createFeatureContext({
          name: featureName,
          description: featureDescription,
        });
        setContextId(result.context_id);
      }
      setStep('select');
    } catch (err) {
      setCreateError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  // =========================================================================
  // Step 2: Select Files (local staging)
  // =========================================================================
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    const valid = Array.from(files).filter((f) => f.size <= MAX_SIZE);
    const oversized = files.length - valid.length;
    if (oversized > 0) {
      setBuildError(`${oversized} file(s) skipped — max size is 10 MB each.`);
    } else {
      setBuildError(null);
    }
    const newFiles: LocalFile[] = valid.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      type: 'image',
      name: file.name,
    }));
    setLocalFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleAddTextNote = () => {
    if (!currentTextNote.trim()) return;
    setTextNotes((prev) => [...prev, { id: `text-${Date.now()}`, text: currentTextNote }]);
    setCurrentTextNote('');
  };

  const handleRemoveFile = (fileId: string) => setLocalFiles((prev) => prev.filter((f) => f.id !== fileId));
  const handleRemoveTextNote = (noteId: string) => setTextNotes((prev) => prev.filter((n) => n.id !== noteId));

  // =========================================================================
  // Step 3: Build Context
  // =========================================================================
  const handleBuildContext = async (feedback = '') => {
    const rebuilding = !!feedback;
    if (rebuilding) setIsRegenerating(true);
    else setIsBuilding(true);
    setBuildError(null);
    setProgressMessage('');

    try {
      if (isCloudMode && cloudFeatureId) {
        // Cloud flow — send images+texts to local backend which saves to cloud + runs AI
        await buildContextMutation.mutateAsync({
          featureId: cloudFeatureId,
          projectId: projectId!,
          userFeedback: feedback || undefined,
          callbacks: {
            onProgress: (msg) => setProgressMessage(msg),
            onDone: (summary, contextSummaryText) => {
              setContextResult({
                featureName,
                summary,
                contextSummaryText,
                hasFeedback: !!feedback,
              });
              setProgressMessage('');
              setUserFeedback('');
              if (!rebuilding) setStep('summary');
            },
            onError: (msg) => setBuildError(msg),
          },
          images: rebuilding ? undefined : localFiles.map((lf) => lf.file),
          texts: rebuilding ? undefined : textNotes.map((n) => n.text),
        });
      } else if (contextId) {
        // Local-only flow (legacy)
        if (!feedback) {
          for (const lf of localFiles) await addImageToContext(contextId, lf.file);
          for (const n of textNotes) await addTextToContext(contextId, n.text);
        }
        const result = await buildContext(contextId, feedback);
        setContextResult({
          featureName: result.feature_name,
          summary: result.summary,
          processedItems: result.processed_items,
          hasFeedback: result.has_feedback,
        });
        setUserFeedback('');
        setStep('summary');
      }
    } catch (err) {
      setBuildError(String(err));
    } finally {
      setIsBuilding(false);
      setIsRegenerating(false);
      setProgressMessage('');
    }
  };

  // =========================================================================
  // Step 3→4: Generate Test Cases
  // =========================================================================
  const handleGenerateTests = async (feedback = '') => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      if (isCloudMode && cloudFeatureId) {
        await generateTestsMutation.mutateAsync({
          featureId: cloudFeatureId,
          projectId: projectId!,
          userFeedback: feedback || undefined,
          callbacks: {
            onProgress: (msg) => setProgressMessage(msg),
            onDone: (featureSummary, testCases, coverageNotes) => {
              setTestPlan({
                success: true,
                context_id: cloudFeatureId,
                feature_name: featureName,
                feature_summary: featureSummary,
                test_count: testCases.length,
                test_cases: testCases,
                coverage_notes: coverageNotes,
                status: 'pending_review',
                message: '',
              });
              setSelectedTests(new Set(testCases.map((tc) => tc.test_key)));
              if (step !== 'review') setStep('review');
              setProgressMessage('');
              setTestFeedback('');
              setShowTestFeedback(false);
            },
            onError: (msg) => setGenerationError(msg),
          },
        });
      } else if (contextId) {
        const result = await generateTestPlan(contextId);
        setTestPlan(result);
        setSelectedTests(new Set(result.test_cases.map((tc) => tc.test_key)));
        setStep('review');
      }
    } catch (err) {
      setGenerationError(String(err));
    } finally {
      setIsGenerating(false);
      setProgressMessage('');
    }
  };

  // =========================================================================
  // Step 4: Save
  // =========================================================================
  const handleSave = async () => {
    if (!testPlan || selectedTests.size === 0) return;
    setIsApproving(true);
    try {
      const approvedCases = testPlan.test_cases.filter((tc) => selectedTests.has(tc.test_key));
      if (isCloudMode && cloudFeatureId) {
        await saveTestsMutation.mutateAsync(approvedCases);
      } else if (contextId) {
        await approveAndGenerateTests(contextId, Array.from(selectedTests));
      }
      onClose?.();
    } catch (err) {
      setGenerationError(String(err));
    } finally {
      setIsApproving(false);
    }
  };

  // =========================================================================
  // Helpers
  // =========================================================================
  const handleToggleTest = (testId: string) => {
    setSelectedTests((prev) => {
      const s = new Set(prev);
      s.has(testId) ? s.delete(testId) : s.add(testId);
      return s;
    });
  };

  const handleToggleExpand = (testId: string) => {
    setExpandedTests((prev) => {
      const s = new Set(prev);
      s.has(testId) ? s.delete(testId) : s.add(testId);
      return s;
    });
  };

  const getPriorityColor = (priority: string | null | undefined) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'functional': return 'bg-blue-500/10 text-blue-500';
      case 'negative': return 'bg-red-500/10 text-red-400';
      case 'ui': return 'bg-purple-500/10 text-purple-400';
      case 'edge_case': return 'bg-amber-500/10 text-amber-500';
      case 'accessibility': return 'bg-teal-500/10 text-teal-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalAssets = localFiles.length + textNotes.length;

  const STEPS = [
    { key: 'create',  label: 'Name',    desc: 'Name your test suite' },
    { key: 'select',  label: 'Assets',  desc: 'Upload screenshots & notes' },
    { key: 'summary', label: 'Context', desc: 'Review AI understanding' },
    { key: 'review',  label: 'Review',  desc: 'Select & save tests' },
  ] as const;

  const stepOrder = STEPS.map((s) => s.key);
  const currentIdx = stepOrder.indexOf(step);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="relative flex h-full min-h-0 flex-1 items-stretch overflow-hidden bg-white">

      {/* ── Left sidebar ──────────────────────────────────────────── */}
      <aside className="flex w-48 shrink-0 self-stretch flex-col border-r border-[#ececf1] bg-[#fafafd] p-5">

        {/* Brand */}
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/logo.png" alt="Clariti" className="size-7 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-xs leading-none text-muted-foreground">Clariti</p>
            <p className="text-sm font-semibold leading-snug text-foreground">New Test Suite</p>
          </div>
        </div>

        {/* Steps */}
        <div>
          {STEPS.map((s, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = s.key === step;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                    isCurrent  ? 'bg-violet-500 text-white ring-2 ring-violet-500/20' :
                    isCompleted ? 'bg-green-500 text-white' :
                                  'bg-muted text-muted-foreground border border-border'
                  )}>
                    {isCompleted ? <Check className="size-3" /> : <span>{idx + 1}</span>}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn('w-px my-1', 'h-8', isCompleted ? 'bg-green-500/30' : 'bg-border')} />
                  )}
                </div>
                <div className={cn('pb-4', idx === STEPS.length - 1 && 'pb-0')}>
                  <p className={cn(
                    'mt-0.5 text-sm font-medium leading-none',
                    isCurrent  ? 'text-foreground' :
                    isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'
                  )}>
                    {s.label}
                  </p>
                  {isCurrent && (
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{s.desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature info card (shown once name is set) */}
        {featureName && step !== 'create' && (
          <div className="mt-auto pt-4">
            <div className="rounded-lg border border-[#ececf1] bg-white p-3 shadow-[0_2px_8px_rgba(15,15,25,0.04)]">
              <p className="mb-0.5 text-xs text-muted-foreground">Suite</p>
              <p className="truncate text-sm font-medium text-foreground">{featureName}</p>
              {featureDescription && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{featureDescription}</p>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Right content ─────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full bg-[#f5f5f8] text-muted-foreground hover:bg-[#ececf1] hover:text-foreground"
            aria-label="Close new test suite"
          >
            <X className="size-3.5" />
          </button>
        )}
        <div className="mx-auto w-full max-w-2xl p-8 pr-12">

          {/* ──────────── Step 1: Name ──────────── */}
          {step === 'create' && (
            <div>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-light text-foreground">Let&apos;s name your test suite</h2>
                <p className="text-sm text-muted-foreground mt-1">Give this suite a name that reflects the feature you're testing.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Feature name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={featureName}
                    onChange={(e) => setFeatureName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && featureName.trim() && !isCreating && handleCreateContext()}
                    placeholder="e.g. Add to Bag, User Login, Checkout Flow"
                    className="w-full px-3.5 py-2.5 bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                    placeholder="What does this feature do? Any specific behaviors to test?"
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors text-sm resize-none"
                  />
                </div>
                {createError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                    <AlertCircle className="size-4 shrink-0" />
                    {createError}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCreateContext}
                  disabled={!featureName.trim() || isCreating}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#29292f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? (
                    <><Loader className="size-4 animate-spin" /> Creating suite…</>
                  ) : (
                    <>Continue <ArrowRight className="size-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ──────────── Step 2: Assets ──────────── */}
          {step === 'select' && (
            <div>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-light text-foreground">Add context to help AI understand</h2>
                <p className="text-sm text-muted-foreground mt-1">Upload screenshots or add text notes. AI uses these to generate relevant test cases.</p>
              </div>

              {/* Image upload zone */}
              <label className="block mb-4 cursor-pointer">
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
                {localFiles.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all p-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                        <Image className="size-5 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Drop screenshots here</p>
                      <p className="text-xs text-muted-foreground mt-1">or click to browse · PNG, JPG, WebP · max 10 MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border hover:border-primary/30 transition-all p-3">
                    <div className="grid grid-cols-5 gap-2 mb-2">
                      {localFiles.map((file, idx) => (
                        <div key={file.id} className="relative group aspect-square">
                          <img
                            src={thumbnailUrls[idx]}
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-border"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleRemoveFile(file.id); }}
                            className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      <div className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                        <Plus className="size-4" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {localFiles.length} image{localFiles.length !== 1 ? 's' : ''} · click to add more
                    </p>
                  </div>
                )}
              </label>

              {/* Text notes */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Text notes</span>
                  {textNotes.length > 0 && (
                    <span className="text-xs text-muted-foreground">· {textNotes.length} added</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={currentTextNote}
                    onChange={(e) => setCurrentTextNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && currentTextNote.trim()) {
                        e.preventDefault();
                        handleAddTextNote();
                      }
                    }}
                    placeholder="Paste requirements, describe expected behavior…"
                    rows={3}
                    className="flex-1 px-3.5 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors resize-none"
                  />
                  <button
                    onClick={handleAddTextNote}
                    disabled={!currentTextNote.trim()}
                    className="self-start px-3 py-2 bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium shrink-0"
                  >
                    <Plus className="size-4" /> Add
                  </button>
                </div>
                {textNotes.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {textNotes.map((note) => (
                      <div key={note.id} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <p className="flex-1 text-xs text-foreground line-clamp-2">{note.text}</p>
                        <button
                          onClick={() => handleRemoveTextNote(note.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {buildError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 mb-4">
                  <AlertCircle className="size-4 shrink-0" />
                  {buildError}
                </div>
              )}
              {isBuilding && progressMessage && (
                <div className="flex items-center gap-2.5 text-sm text-primary bg-primary/5 border border-primary/15 rounded-lg px-3.5 py-2.5 mb-4">
                  <Loader className="size-4 animate-spin shrink-0" />
                  {progressMessage}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('create')} className="rounded-lg border border-[#ececf1] bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[#f5f5f8]">
                  Back
                </button>
                <button
                  onClick={() => handleBuildContext()}
                  disabled={totalAssets === 0 || isBuilding}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#29292f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBuilding ? (
                    <><Loader className="size-4 animate-spin" /> {progressMessage || 'Analysing assets…'}</>
                  ) : (
                    <>Continue <ArrowRight className="size-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ──────────── Step 3: Context ──────────── */}
          {step === 'summary' && contextResult && (
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-5 rounded-full bg-green-500/15 flex items-center justify-center">
                    <Check className="size-3 text-green-500" />
                  </div>
                  <h2 className="font-serif text-2xl font-light text-foreground">AI has analyzed your context</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {contextResult.hasFeedback ? 'Regenerated with your feedback.' : 'AI has analysed your assets.'} Review below then generate tests.
                </p>
              </div>

              {/* Prose summary */}
              {contextResult.contextSummaryText && (
                <div className="bg-muted/40 rounded-xl p-4 border border-border mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">What AI understood</p>
                  <div className="max-h-52 overflow-y-auto pr-1">
                    <p className="text-sm text-foreground leading-relaxed">{contextResult.contextSummaryText}</p>
                  </div>
                </div>
              )}


              {/* Feedback / refine — always visible */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground mb-1">Something wrong?</p>
                <p className="text-xs text-muted-foreground mb-2">Correct the AI and it'll rebuild the context with your feedback.</p>
                <textarea
                  value={userFeedback}
                  onChange={(e) => setUserFeedback(e.target.value)}
                  placeholder="e.g. The checkout starts from cart, not product page. The button says 'Add to Bag'…"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors resize-none"
                  disabled={isRegenerating}
                />
                {isRegenerating && progressMessage && (
                  <div className="flex items-center gap-2 text-xs text-amber-500 mt-2">
                    <Loader className="size-3 animate-spin shrink-0" />
                    {progressMessage}
                  </div>
                )}
                {userFeedback.trim() && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => handleBuildContext(userFeedback)}
                      disabled={isRegenerating}
                      className="w-1/2 py-2 bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed text-primary text-sm font-medium rounded-lg border border-primary/40 hover:border-primary/70 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="size-4" />
                      {isRegenerating ? 'Rebuilding context…' : 'Rebuild Context'}
                    </button>
                  </div>
                )}
              </div>

              {generationError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 mb-4">
                  <AlertCircle className="size-4 shrink-0" />
                  {generationError}
                </div>
              )}
              {isGenerating && progressMessage && (
                <div className="flex items-center gap-2.5 text-sm text-primary bg-primary/5 border border-primary/15 rounded-lg px-3.5 py-2.5 mb-4">
                  <Loader className="size-4 animate-spin shrink-0" />
                  {progressMessage}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('select')} className="rounded-lg border border-[#ececf1] bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[#f5f5f8]">
                  Back
                </button>
                <button
                  onClick={() => handleGenerateTests()}
                  disabled={isGenerating || isRegenerating}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#29292f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <><Loader className="size-4 animate-spin" /> {progressMessage || 'Generating tests…'}</>
                  ) : (
                    <>Looks good, continue <ArrowRight className="size-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ──────────── Step 4: Review & Save ──────────── */}
          {step === 'review' && testPlan && (
            <div>
              <div className="mb-5">
                <h2 className="font-serif text-2xl font-light text-foreground">{testPlan.test_count} test cases ready!</h2>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{testPlan.feature_summary}</p>
              </div>

              {/* Collapsible regenerate panel */}
              <div className="mb-4 border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowTestFeedback((p) => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Not what you expected?</span>
                  </div>
                  <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', showTestFeedback && 'rotate-180')} />
                </button>
                {showTestFeedback && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Tell us what to change and we'll regenerate the tests.</p>
                    <textarea
                      value={testFeedback}
                      onChange={(e) => setTestFeedback(e.target.value)}
                      placeholder="e.g. Focus more on payment failure edge cases, add accessibility tests…"
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors resize-none mb-2"
                      disabled={isGenerating}
                    />
                    {isGenerating && progressMessage && (
                      <div className="flex items-center gap-2 text-xs text-primary mb-2">
                        <Loader className="size-3 animate-spin shrink-0" />
                        {progressMessage}
                      </div>
                    )}
                    <button
                      onClick={() => handleGenerateTests(testFeedback)}
                      disabled={!testFeedback.trim() || isGenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="size-3.5" />
                      {isGenerating ? 'Regenerating…' : 'Regenerate tests'}
                    </button>
                  </div>
                )}
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{selectedTests.size} selected</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedTests(new Set(testPlan.test_cases.map((tc) => tc.test_key)))}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedTests(new Set())}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Test cards */}
              <div className="space-y-2 mb-4">
                {testPlan.test_cases.map((test) => {
                  const isSelected = selectedTests.has(test.test_key);
                  const isExpanded = expandedTests.has(test.test_key);
                  const priorityAccent = {
                    critical: 'border-l-red-500',
                    high: 'border-l-orange-400',
                    medium: 'border-l-amber-400',
                    low: 'border-l-green-500',
                  }[test.priority ?? 'medium'] ?? 'border-l-border';

                  return (
                    <div
                      key={test.test_key}
                      className={cn(
                        'rounded-xl border border-border border-l-2 bg-card transition-all',
                        priorityAccent,
                        !isSelected && 'opacity-55'
                      )}
                    >
                      <div className="p-3.5 flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTest(test.test_key)}
                          className={cn(
                            'size-4.5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all border',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-card hover:border-primary/50'
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-muted-foreground text-xs font-mono">{test.test_key}</span>
                            {test.category && (
                              <span className={cn('px-1.5 py-0.5 text-xs rounded-full', getCategoryColor(test.category))}>
                                {test.category.replace('_', ' ')}
                              </span>
                            )}
                            <span className={cn('px-1.5 py-0.5 text-xs rounded-full border', getPriorityColor(test.priority))}>
                              {test.priority ?? 'medium'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{test.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{test.goal}</p>
                        </div>
                        <button
                          onClick={() => handleToggleExpand(test.test_key)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border mx-3.5 mb-3.5 pt-3 space-y-3">
                          {test.expected_result && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Expected</p>
                              <p className="text-sm text-green-500">{test.expected_result}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {testPlan.coverage_notes && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-medium text-amber-500 mb-1">Coverage notes</p>
                  <p className="text-xs text-muted-foreground">{testPlan.coverage_notes}</p>
                </div>
              )}

              {generationError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 mb-4">
                  <AlertCircle className="size-4 shrink-0" />
                  {generationError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('summary')} className="rounded-lg border border-[#ececf1] bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[#f5f5f8]">
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={selectedTests.size === 0 || isApproving}
                  className="flex w-fit items-center justify-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#29292f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApproving ? (
                    <><Loader className="size-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Check className="size-4" /> Save {selectedTests.size} Tests</>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}