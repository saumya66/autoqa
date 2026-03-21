import React, { useState, useCallback } from 'react';
import {
  Plus,
  Image,
  MessageSquare,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowRight,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Layers,
  Layout,
  ListChecks,
} from 'lucide-react';
import {
  createFeatureContext,
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
  type TestCase,
  type ContextSummary,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';

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
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Step 4 — test generation + review
  const [isGenerating, setIsGenerating] = useState(false);
  const [testPlan, setTestPlan] = useState<TestPlanResponse | null>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('create');

  // =========================================================================
  // Step 1: Create Feature
  // =========================================================================
  const handleCreateContext = async () => {
    if (!featureName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      if (isCloudMode) {
        // Cloud mode: create local context stub + cloud feature in parallel
        const [localResult, cloudFeature] = await Promise.all([
          createFeatureContext({ name: featureName, description: featureDescription }),
          createCloudFeature(projectId!, featureName, featureDescription || undefined),
        ]);
        setContextId(localResult.context_id);
        setCloudFeatureId(cloudFeature.id);
      } else {
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
        await buildFeatureContext(
          cloudFeatureId,
          projectId!,
          feedback || undefined,
          {
            onProgress: (msg) => setProgressMessage(msg),
            onDone: (summary, contextSummaryText) => {
              setContextResult({
                featureName,
                summary,
                hasFeedback: !!feedback,
              });
              setProgressMessage('');
              setUserFeedback('');
              if (!rebuilding) setStep('summary');
            },
            onError: (msg) => setBuildError(msg),
          },
          rebuilding ? undefined : localFiles.map((lf) => lf.file),
          rebuilding ? undefined : textNotes.map((n) => n.text),
        );
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
  const handleGenerateTests = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      if (isCloudMode && cloudFeatureId) {
        await generateFeatureTests(
          cloudFeatureId,
          projectId!,
          {
            onProgress: (msg) => setProgressMessage(msg),
            onDone: (featureSummary, testCases, coverageNotes) => {
              // Normalise into TestPlanResponse shape
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
              setSelectedTests(new Set(testCases.map((tc) => tc.id)));
              setStep('review');
              setProgressMessage('');
            },
            onError: (msg) => setGenerationError(msg),
          },
        );
      } else if (contextId) {
        const result = await generateTestPlan(contextId);
        setTestPlan(result);
        setSelectedTests(new Set(result.test_cases.map((tc) => tc.id)));
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
      const approvedCases = testPlan.test_cases.filter((tc) => selectedTests.has(tc.id));
      if (isCloudMode && cloudFeatureId) {
        await saveFeatureTests(cloudFeatureId, approvedCases);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'must': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'should': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'could': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'happy_path': return 'text-green-400 bg-green-500/10';
      case 'edge_case': return 'text-amber-400 bg-amber-500/10';
      case 'error_handling': return 'text-red-400 bg-red-500/10';
      case 'validation': return 'text-purple-400 bg-purple-500/10';
      case 'ui_ux': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const totalAssets = localFiles.length + textNotes.length;

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Create Test Suite</h1>
          <p className="text-muted-foreground">
            Upload designs and notes to generate AI-powered test cases
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { key: 'create', label: 'Name', icon: '1' },
            { key: 'select', label: 'Select Assets', icon: '2' },
            { key: 'summary', label: 'Review Context', icon: '3' },
            { key: 'review', label: 'Review & Save', icon: '4' },
          ].map((s, idx) => {
            const stepOrder = ['create', 'select', 'summary', 'review'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(s.key);
            const isCompleted = thisIdx < currentIdx;
            const isCurrent = s.key === step;
            return (
              <React.Fragment key={s.key}>
                {idx > 0 && <ArrowRight className="w-4 h-4 text-border shrink-0" />}
                <div className={`flex items-center gap-2 shrink-0 ${isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isCurrent ? 'bg-primary/20 text-primary' : isCompleted ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {isCompleted ? '✓' : s.icon}
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ================================================
            Step 1: Feature Name
        ================================================ */}
        {step === 'create' && (
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Feature Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  placeholder="e.g., Add to Bag, User Login, Checkout Flow"
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={featureDescription}
                  onChange={(e) => setFeatureDescription(e.target.value)}
                  placeholder="Brief description of what this feature does..."
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {createError && (
                <div className="bg-destructive/10 rounded-lg p-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {createError}
                </div>
              )}

              <button
                onClick={handleCreateContext}
                disabled={!featureName.trim() || isCreating}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================================================
            Step 2: Select Assets
        ================================================ */}
        {step === 'select' && (
          <div className="space-y-6">
            {/* Feature info pill */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-medium">{featureName}</h3>
                {featureDescription && (
                  <p className="text-sm text-muted-foreground mt-0.5">{featureDescription}</p>
                )}
              </div>
              {isCloudMode && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Cloud</span>
              )}
            </div>

            {/* Upload cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Images */}
              <label className="group bg-card rounded-xl p-6 border border-border border-dashed hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Image className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-foreground font-medium mb-1">Images</h3>
                  <p className="text-xs text-muted-foreground">Screenshots, mockups, wireframes</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10 MB each</p>
                </div>
              </label>

              {/* Text */}
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-foreground font-medium mb-1">Text</h3>
                  <p className="text-xs text-muted-foreground">Requirements, descriptions, notes</p>
                </div>
                <textarea
                  value={currentTextNote}
                  onChange={(e) => setCurrentTextNote(e.target.value)}
                  placeholder="Describe expected behavior, edge cases..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring resize-none mb-2"
                />
                <button
                  onClick={handleAddTextNote}
                  disabled={!currentTextNote.trim()}
                  className="w-full py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Note
                </button>
              </div>
            </div>

            {/* Asset list */}
            {totalAssets > 0 && (
              <div className="bg-card rounded-xl border border-border">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-foreground font-medium">Selected Assets ({totalAssets})</h3>
                  <span className="text-xs text-muted-foreground">
                    {isCloudMode ? 'Will upload to cloud on next step' : 'Not uploaded yet'}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {localFiles.map((file) => (
                    <div key={file.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <Image className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-medium truncate">{file.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {(file.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <button onClick={() => handleRemoveFile(file.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {textNotes.map((note) => (
                    <div key={note.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm truncate">{note.text}</p>
                        <p className="text-muted-foreground text-xs">Text note</p>
                      </div>
                      <button onClick={() => handleRemoveTextNote(note.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {buildError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{buildError}</p>
              </div>
            )}

            {/* Progress message during SSE */}
            {isBuilding && progressMessage && (
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 flex items-center gap-3">
                <Loader className="w-4 h-4 animate-spin text-primary shrink-0" />
                <p className="text-sm text-primary">{progressMessage}</p>
              </div>
            )}

            <button
              onClick={() => handleBuildContext()}
              disabled={totalAssets === 0 || isBuilding}
              className="w-full py-4 bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary disabled:from-muted disabled:to-muted disabled:text-muted-foreground text-primary-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            >
              {isBuilding ? (
                <><Loader className="w-5 h-5 animate-spin" /> {progressMessage || 'Processing...'}</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Context ({totalAssets} assets) <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        )}

        {/* ================================================
            Step 3: Review Context
        ================================================ */}
        {step === 'summary' && contextResult && (
          <div className="space-y-6">
            {/* Status pill */}
            <div className="bg-card/50 rounded-lg p-4 border border-border flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-medium">{contextResult.featureName}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {contextResult.hasFeedback ? 'Context regenerated with your feedback' : 'Context built successfully'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {contextResult.hasFeedback && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">Updated</span>
                )}
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            </div>

            {/* What AI understood */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> What AI Understood
              </h3>
              <div className="space-y-6">
                {contextResult.summary.screens_detected.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Layout className="w-4 h-4" />
                      Screens Detected ({contextResult.summary.screens_detected.length})
                    </h4>
                    <div className="space-y-2">
                      {contextResult.summary.screens_detected.map((screen, idx) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-foreground font-medium">{screen.name}</p>
                          <p className="text-muted-foreground text-sm mt-1">{screen.description}</p>
                          <p className="text-muted-foreground text-xs mt-1">Source: {screen.source}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contextResult.summary.ui_elements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      UI Elements ({contextResult.summary.ui_elements.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {contextResult.summary.ui_elements.slice(0, 12).map((elem, idx) => (
                        <span key={idx} className="px-2 py-1 bg-muted rounded text-xs text-foreground">
                          {elem.type}: {elem.label}
                        </span>
                      ))}
                      {contextResult.summary.ui_elements.length > 12 && (
                        <span className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                          +{contextResult.summary.ui_elements.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {contextResult.summary.requirements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" />
                      Requirements ({contextResult.summary.requirements.length})
                    </h4>
                    <div className="space-y-2">
                      {contextResult.summary.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className={`px-1.5 py-0.5 text-xs rounded border ${getPriorityColor(req.priority)}`}>
                            {req.priority}
                          </span>
                          <p className="text-foreground text-sm">{req.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contextResult.summary.user_flows.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      User Flows ({contextResult.summary.user_flows.length})
                    </h4>
                    <div className="space-y-3">
                      {contextResult.summary.user_flows.map((flow, idx) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-foreground font-medium mb-2">{flow.name}</p>
                          <ol className="space-y-1">
                            {flow.steps.map((s, sIdx) => (
                              <li key={sIdx} className="text-muted-foreground text-sm flex items-start gap-2">
                                <span className="text-muted-foreground font-mono text-xs">{sIdx + 1}.</span>
                                {s}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contextResult.summary.text_notes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Notes ({contextResult.summary.text_notes.length})
                    </h4>
                    <div className="space-y-2">
                      {contextResult.summary.text_notes.map((note, idx) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-foreground text-sm">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contextResult.summary.screens_detected.length === 0 &&
                  contextResult.summary.ui_elements.length === 0 &&
                  contextResult.summary.text_notes.length === 0 && (
                    <p className="text-muted-foreground text-sm">No structured data extracted yet.</p>
                  )}
              </div>
            </div>

            {/* Processed items (local mode only) */}
            {contextResult.processedItems && contextResult.processedItems.length > 0 && (
              <div className="bg-card rounded-xl p-6 border border-border">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Processed Items</h3>
                <div className="space-y-2">
                  {contextResult.processedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground">
                        <Image className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm truncate">{item.source_name}</p>
                        <p className="text-muted-foreground text-xs">{item.extracted_summary}</p>
                      </div>
                      {item.processed && <CheckCircle className="w-4 h-4 text-green-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" /> Provide Feedback (Optional)
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                If the AI misunderstood something, provide corrections. The context will be regenerated.
              </p>
              <textarea
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                placeholder="e.g., 'The button should say Add to Bag, not just Add.'"
                rows={3}
                className="w-full px-4 py-3 bg-muted border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none mb-3"
              />
              {isRegenerating && progressMessage && (
                <div className="bg-amber-500/5 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-400 mb-3">
                  <Loader className="w-4 h-4 animate-spin shrink-0" />
                  {progressMessage}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleBuildContext(userFeedback)}
                  disabled={!userFeedback.trim() || isRegenerating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isRegenerating ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Regenerating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Regenerate Context</>
                  )}
                </button>
                {userFeedback && (
                  <button onClick={() => setUserFeedback('')} className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground text-sm rounded-lg transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {generationError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{generationError}</p>
              </div>
            )}

            {/* Progress during test generation */}
            {isGenerating && progressMessage && (
              <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/20 flex items-center gap-3">
                <Loader className="w-4 h-4 animate-spin text-green-400 shrink-0" />
                <p className="text-sm text-green-400">{progressMessage}</p>
              </div>
            )}

            <button
              onClick={handleGenerateTests}
              disabled={isGenerating || isRegenerating}
              className="w-full py-4 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-muted disabled:to-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isGenerating ? (
                <><Loader className="w-5 h-5 animate-spin" /> {progressMessage || 'Generating...'}</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate & Review Test Cases <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        )}

        {/* ================================================
            Step 4: Review & Save
        ================================================ */}
        {step === 'review' && testPlan && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="text-foreground font-medium mb-2">Feature Summary</h3>
              <p className="text-muted-foreground text-sm">{testPlan.feature_summary}</p>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Generated:</span>
                  <span className="text-foreground font-medium">{testPlan.test_count} test cases</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Selected:</span>
                  <span className="text-primary font-medium">{selectedTests.size}</span>
                </div>
              </div>
            </div>

            {/* Select/deselect controls */}
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-medium">Test Cases</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTests(new Set(testPlan.test_cases.map((tc) => tc.id)))}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-card hover:bg-muted rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedTests(new Set())}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-card hover:bg-muted rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Test case cards */}
            <div className="space-y-3">
              {testPlan.test_cases.map((test) => {
                const isSelected = selectedTests.has(test.id);
                const isExpanded = expandedTests.has(test.id);
                return (
                  <div
                    key={test.id}
                    className={`bg-card rounded-xl border transition-all ${isSelected ? 'border-primary/50' : 'border-border'}`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      <button
                        onClick={() => handleToggleTest(test.id)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-muted-foreground text-xs font-mono">{test.id}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(test.category)}`}>
                            {test.category.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(test.priority)}`}>
                            {test.priority}
                          </span>
                        </div>
                        <h4 className="text-foreground font-medium">{test.name}</h4>
                        <p className="text-muted-foreground text-sm mt-1">{test.description}</p>
                      </div>
                      <button
                        onClick={() => handleToggleExpand(test.id)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border mx-4 mb-4">
                        <div className="mb-4">
                          <h5 className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
                            Steps
                          </h5>
                          <ol className="space-y-1">
                            {test.steps.map((s, idx) => (
                              <li key={idx} className="text-foreground text-sm flex items-start gap-2">
                                <span className="text-muted-foreground font-mono text-xs mt-0.5">{idx + 1}.</span>
                                {s}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <h5 className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
                            Expected Result
                          </h5>
                          <p className="text-green-400 text-sm">{test.expected_result}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {testPlan.coverage_notes && (
              <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
                <h4 className="text-amber-400 text-sm font-medium mb-2">Coverage Notes</h4>
                <p className="text-amber-300/70 text-sm">{testPlan.coverage_notes}</p>
              </div>
            )}

            {generationError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{generationError}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={selectedTests.size === 0 || isApproving}
              className="w-full py-4 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-muted disabled:to-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isApproving ? (
                <><Loader className="w-5 h-5 animate-spin" /> Saving...</>
              ) : (
                <><Check className="w-5 h-5" /> Save ({selectedTests.size} tests)</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
