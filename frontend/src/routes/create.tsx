import React, { useState, useCallback, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { 
  Plus, 
  FileText, 
  Image, 
  Video, 
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
  Play,
  Eye,
  Layers,
  Layout,
  ListChecks,
  Monitor,
  CheckCircle2,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';
import {
  createFeatureContext,
  addImageToContext,
  addDocumentToContext,
  addVideoToContext,
  addTextToContext,
  buildContext,
  generateTestPlan,
  approveAndGenerateTests,
  executeTestsStream,
  provideGuidance,
  getWindows,
  BuildContextResponse,
  TestCase,
  TestPlanResponse,
  WindowInfo,
  TestStartEvent,
  StepEvent,
  NeedHelpEvent,
  TestCompleteEvent,
  SuiteCompleteEvent,
} from '../api/client';

type Step = 'create' | 'select' | 'summary' | 'review' | 'execute' | 'done';

interface LocalFile {
  id: string;
  file: File;
  type: 'image' | 'document' | 'video';
  name: string;
}

interface TextNote {
  id: string;
  text: string;
}

function CreateTestPage() {
  // Step 1: Feature details
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [contextId, setContextId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Step 2: Local file selection (not uploaded yet)
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [textNotes, setTextNotes] = useState<TextNote[]>([]);
  const [currentTextNote, setCurrentTextNote] = useState('');
  
  // Step 3: Context building
  const [isBuilding, setIsBuilding] = useState(false);
  const [contextSummary, setContextSummary] = useState<BuildContextResponse | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [userFeedback, setUserFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Step 4: Test generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [testPlan, setTestPlan] = useState<TestPlanResponse | null>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Step 5: Test execution
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<string>('');
  const [isLoadingWindows, setIsLoadingWindows] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTest, setCurrentTest] = useState<TestStartEvent | null>(null);
  const [currentStep, setCurrentStep] = useState<StepEvent | null>(null);
  const [needsHelp, setNeedsHelp] = useState<NeedHelpEvent | null>(null);
  const [guidanceText, setGuidanceText] = useState('');
  const [executionResults, setExecutionResults] = useState<{
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    testResults: Array<{test_id: string; status: string; title?: string; conclusion?: string}>;
  } | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  const [step, setStep] = useState<Step>('create');

  // ========================================
  // Step 1: Create Feature
  // ========================================
  const handleCreateContext = async () => {
    if (!featureName.trim()) return;
    
    setIsCreating(true);
    try {
      const result = await createFeatureContext({
        name: featureName,
        description: featureDescription,
      });
      setContextId(result.context_id);
      setStep('select');
    } catch (err) {
      console.error('Failed to create context:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // ========================================
  // Step 2: Select Files (Local only)
  // ========================================
  const handleFileSelect = useCallback((files: FileList | null, type: 'image' | 'document' | 'video') => {
    if (!files) return;
    
    const newFiles: LocalFile[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${file.name}`,
      file,
      type,
      name: file.name,
    }));
    
    setLocalFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleAddTextNote = () => {
    if (!currentTextNote.trim()) return;
    
    setTextNotes(prev => [...prev, {
      id: `text-${Date.now()}`,
      text: currentTextNote
    }]);
    setCurrentTextNote('');
  };

  const handleRemoveFile = (fileId: string) => {
    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleRemoveTextNote = (noteId: string) => {
    setTextNotes(prev => prev.filter(n => n.id !== noteId));
  };

  // ========================================
  // Step 3: Build Context (Upload + Process)
  // ========================================
  const handleBuildContext = async (feedback: string = '') => {
    if (!contextId) return;
    
    if (feedback) {
      setIsRegenerating(true);
    } else {
      setIsBuilding(true);
    }
    setBuildError(null);
    
    try {
      // If first time, upload all files
      if (!feedback) {
        console.log('Uploading files...');
        
        for (const localFile of localFiles) {
          if (localFile.type === 'image') {
            await addImageToContext(contextId, localFile.file);
          } else if (localFile.type === 'document') {
            await addDocumentToContext(contextId, localFile.file);
          } else if (localFile.type === 'video') {
            await addVideoToContext(contextId, localFile.file);
          }
        }
        
        // Upload text notes
        for (const note of textNotes) {
          await addTextToContext(contextId, note.text);
        }
      }
      
      console.log(feedback ? 'Regenerating context with feedback...' : 'Building context...');
      
      // Build/regenerate the context (process all items)
      const result = await buildContext(contextId, feedback);
      setContextSummary(result);
      setStep('summary');
      setUserFeedback(''); // Clear feedback after regeneration
    } catch (err) {
      setBuildError(String(err));
    } finally {
      setIsBuilding(false);
      setIsRegenerating(false);
    }
  };

  const handleRegenerateWithFeedback = async () => {
    if (!userFeedback.trim()) return;
    await handleBuildContext(userFeedback);
  };

  // ========================================
  // Step 4: Generate Test Cases
  // ========================================
  const handleGenerateTests = async () => {
    if (!contextId) return;
    
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      const result = await generateTestPlan(contextId);
      setTestPlan(result);
      setSelectedTests(new Set(result.test_cases.map(tc => tc.id)));
      setStep('review');
    } catch (err) {
      setGenerationError(String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleTest = (testId: string) => {
    setSelectedTests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const handleToggleExpand = (testId: string) => {
    setExpandedTests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const handleApproveAndGenerate = async () => {
    if (!contextId || selectedTests.size === 0) return;
    
    setIsApproving(true);
    try {
      await approveAndGenerateTests(contextId, Array.from(selectedTests));
      // Load windows for execution
      await loadWindows();
      setStep('execute');
    } catch (err) {
      setGenerationError(String(err));
    } finally {
      setIsApproving(false);
    }
  };

  // ========================================
  // Step 5: Execute Tests
  // ========================================
  const loadWindows = async () => {
    setIsLoadingWindows(true);
    try {
      const windowList = await getWindows();
      setWindows(windowList);
    } catch (err) {
      console.error('Failed to load windows:', err);
    } finally {
      setIsLoadingWindows(false);
    }
  };

  const handleExecuteTests = async () => {
    if (!contextId || !selectedWindow) return;
    
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResults(null);
    setCurrentTest(null);
    setCurrentStep(null);
    setNeedsHelp(null);
    setGuidanceText('');
    
    const testResults: Array<{test_id: string; status: string; title?: string; conclusion?: string}> = [];
    
    try {
      await executeTestsStream(
        contextId,
        { window_title: selectedWindow, provider: 'claude' },
        {
          onSuiteStart: (data) => {
            console.log('Suite started:', data);
          },
          onTestStart: (data) => {
            setCurrentTest(data);
            setCurrentStep(null);
            setNeedsHelp(null);
            setGuidanceText('');
          },
          onStep: (data) => {
            setCurrentStep(data);
            setNeedsHelp(null);  // Clear help request if step progresses
          },
          onNeedHelp: (data) => {
            setNeedsHelp(data);
            console.log('Agent needs help:', data);
          },
          onTestComplete: (data) => {
            testResults.push({
              test_id: data.test_id,
              status: data.status,
              title: currentTest?.title,
              conclusion: data.conclusion,
            });
            setCurrentTest(null);
          },
          onTestSkip: (data) => {
            testResults.push({
              test_id: data.test_id,
              status: 'skipped'
            });
          },
          onSuiteComplete: (data) => {
            setExecutionResults({
              ...data,
              testResults
            });
            setIsExecuting(false);
            setStep('done');
          },
          onError: (message) => {
            setExecutionError(message);
            setIsExecuting(false);
          }
        }
      );
    } catch (err) {
      setExecutionError(String(err));
      setIsExecuting(false);
    }
  };

  const handleProvideGuidance = async () => {
    if (!contextId || !needsHelp || !guidanceText.trim()) return;
    
    try {
      await provideGuidance(contextId, needsHelp.test_id, guidanceText);
      setGuidanceText('');
      setNeedsHelp(null);
      // Execution will continue automatically with the guidance
    } catch (err) {
      console.error('Failed to provide guidance:', err);
      setExecutionError(String(err));
    }
  };

  // ========================================
  // Helpers
  // ========================================
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'text': return <MessageSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'must': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'should': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'could': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-void-400 bg-void-500/10 border-void-500/30';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'happy_path': return 'text-green-400 bg-green-500/10';
      case 'edge_case': return 'text-amber-400 bg-amber-500/10';
      case 'error_handling': return 'text-red-400 bg-red-500/10';
      case 'validation': return 'text-purple-400 bg-purple-500/10';
      case 'ui_ux': return 'text-plasma-400 bg-plasma-500/10';
      default: return 'text-void-400 bg-void-500/10';
    }
  };

  const totalAssets = localFiles.length + textNotes.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-void-50 mb-2">
            Create Test Suite
          </h1>
          <p className="text-void-300">
            Upload designs, documents, and recordings to generate AI-powered test cases
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { key: 'create', label: 'Name', icon: '1' },
            { key: 'select', label: 'Select Assets', icon: '2' },
            { key: 'summary', label: 'Review Context', icon: '3' },
            { key: 'review', label: 'Review Tests', icon: '4' },
            { key: 'execute', label: 'Execute', icon: '5' },
          ].map((s, idx) => {
            const stepOrder = ['create', 'select', 'summary', 'review', 'execute', 'done'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(s.key);
            const isCompleted = thisIdx < currentIdx;
            const isCurrent = s.key === step;
            
            return (
              <React.Fragment key={s.key}>
                {idx > 0 && <ArrowRight className="w-4 h-4 text-void-600 flex-shrink-0" />}
                <div className={`flex items-center gap-2 flex-shrink-0 ${isCurrent ? 'text-plasma-400' : isCompleted ? 'text-green-400' : 'text-void-500'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isCurrent ? 'bg-plasma-500/20 text-plasma-400' : 
                    isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-void-700 text-void-400'
                  }`}>
                    {isCompleted ? '✓' : s.icon}
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ================================================
            Step 1: Create Feature 
        ================================================ */}
        {step === 'create' && (
          <div className="bg-void-800 rounded-xl p-6 border border-void-700">
            <h2 className="text-lg font-semibold text-void-50 mb-4">Feature Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-void-200 mb-2">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  placeholder="e.g., Add to Bag, User Login, Checkout Flow"
                  className="w-full px-4 py-3 bg-void-900 border border-void-600 rounded-lg text-void-50 placeholder-void-500 focus:outline-none focus:border-plasma-500 focus:ring-1 focus:ring-plasma-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-void-200 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={featureDescription}
                  onChange={(e) => setFeatureDescription(e.target.value)}
                  placeholder="Brief description of what this feature does..."
                  rows={3}
                  className="w-full px-4 py-3 bg-void-900 border border-void-600 rounded-lg text-void-50 placeholder-void-500 focus:outline-none focus:border-plasma-500 focus:ring-1 focus:ring-plasma-500 resize-none"
                />
              </div>
              
              <button
                onClick={handleCreateContext}
                disabled={!featureName.trim() || isCreating}
                className="w-full py-3 bg-plasma-600 hover:bg-plasma-500 disabled:bg-void-700 disabled:text-void-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================================================
            Step 2: Select Assets (Local only)
        ================================================ */}
        {step === 'select' && (
          <div className="space-y-6">
            {/* Feature Info */}
            <div className="bg-void-800/50 rounded-lg p-4 border border-void-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-void-50 font-medium">{featureName}</h3>
                  {featureDescription && (
                    <p className="text-sm text-void-400 mt-1">{featureDescription}</p>
                  )}
                </div>
                <span className="text-xs text-void-500 font-mono">{contextId?.slice(0, 8)}</span>
              </div>
            </div>

            {/* Upload Areas */}
            <div className="grid grid-cols-2 gap-4">
              {/* Images */}
              <label className="group bg-void-800 rounded-xl p-6 border border-void-700 border-dashed hover:border-plasma-500/50 hover:bg-void-800/80 cursor-pointer transition-all">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files, 'image')}
                />
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-plasma-500/10 flex items-center justify-center mb-3 group-hover:bg-plasma-500/20 transition-colors">
                    <Image className="w-6 h-6 text-plasma-400" />
                  </div>
                  <h3 className="text-void-100 font-medium mb-1">Figma Designs</h3>
                  <p className="text-xs text-void-400">Screenshots, mockups, wireframes</p>
                </div>
              </label>

              {/* Documents */}
              <label className="group bg-void-800 rounded-xl p-6 border border-void-700 border-dashed hover:border-plasma-500/50 hover:bg-void-800/80 cursor-pointer transition-all">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files, 'document')}
                />
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3 group-hover:bg-green-500/20 transition-colors">
                    <FileText className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-void-100 font-medium mb-1">PRD Documents</h3>
                  <p className="text-xs text-void-400">PDF, DOCX, or TXT files</p>
                </div>
              </label>

              {/* Videos */}
              <label className="group bg-void-800 rounded-xl p-6 border border-void-700 border-dashed hover:border-plasma-500/50 hover:bg-void-800/80 cursor-pointer transition-all">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files, 'video')}
                />
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
                    <Video className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-void-100 font-medium mb-1">Screen Recordings</h3>
                  <p className="text-xs text-void-400">Video of the user flow</p>
                </div>
              </label>

              {/* Text Notes */}
              <div className="bg-void-800 rounded-xl p-6 border border-void-700">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-void-100 font-medium mb-1">Text Notes</h3>
                  <p className="text-xs text-void-400">Additional context or requirements</p>
                </div>
                <textarea
                  value={currentTextNote}
                  onChange={(e) => setCurrentTextNote(e.target.value)}
                  placeholder="Describe expected behavior, edge cases..."
                  rows={2}
                  className="w-full px-3 py-2 bg-void-900 border border-void-600 rounded-lg text-sm text-void-100 placeholder-void-500 focus:outline-none focus:border-plasma-500 resize-none mb-2"
                />
                <button
                  onClick={handleAddTextNote}
                  disabled={!currentTextNote.trim()}
                  className="w-full py-2 bg-void-700 hover:bg-void-600 disabled:opacity-50 text-void-200 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>
            </div>

            {/* Selected Assets */}
            {totalAssets > 0 && (
              <div className="bg-void-800 rounded-xl border border-void-700">
                <div className="p-4 border-b border-void-700 flex items-center justify-between">
                  <h3 className="text-void-100 font-medium">Selected Assets ({totalAssets})</h3>
                  <span className="text-xs text-void-500">Not uploaded yet</span>
                </div>
                <div className="divide-y divide-void-700">
                  {localFiles.map((file) => (
                    <div key={file.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-void-700 flex items-center justify-center text-void-300">
                        {getTypeIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-void-100 text-sm font-medium truncate">{file.name}</p>
                        <p className="text-void-500 text-xs capitalize">{file.type}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 text-void-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {textNotes.map((note) => (
                    <div key={note.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-void-700 flex items-center justify-center text-void-300">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-void-100 text-sm truncate">{note.text}</p>
                        <p className="text-void-500 text-xs">Text Note</p>
                      </div>
                      <button
                        onClick={() => handleRemoveTextNote(note.id)}
                        className="p-1 text-void-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Build Error */}
            {buildError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Failed to build context</p>
                    <p className="text-red-300/70 text-sm mt-1">{buildError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Context Button */}
            <button
              onClick={() => handleBuildContext()}
              disabled={totalAssets === 0 || isBuilding}
              className="w-full py-4 bg-gradient-to-r from-plasma-600 to-purple-600 hover:from-plasma-500 hover:to-purple-500 disabled:from-void-700 disabled:to-void-700 disabled:text-void-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-plasma-500/25"
            >
              {isBuilding ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Context ({totalAssets} assets)
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ================================================
            Step 3: Review Context Summary
        ================================================ */}
        {step === 'summary' && contextSummary && (
          <div className="space-y-6">
            {/* Feature Info */}
            <div className="bg-void-800/50 rounded-lg p-4 border border-void-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-void-50 font-medium">{contextSummary.feature_name}</h3>
                  <p className="text-sm text-void-400 mt-1">
                    {contextSummary.has_feedback 
                      ? "Context regenerated with your feedback" 
                      : "Context built successfully"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {contextSummary.has_feedback && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                      Updated
                    </span>
                  )}
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </div>

            {/* What AI Understood */}
            <div className="bg-void-800 rounded-xl p-6 border border-void-700">
              <h3 className="text-lg font-semibold text-void-50 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-plasma-400" />
                What AI Understood
              </h3>
              
              <div className="space-y-6">
                {/* Screens Detected */}
                {contextSummary.summary.screens_detected.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-void-300 mb-2 flex items-center gap-2">
                      <Layout className="w-4 h-4" />
                      Screens Detected ({contextSummary.summary.screens_detected.length})
                    </h4>
                    <div className="space-y-2">
                      {contextSummary.summary.screens_detected.map((screen, idx) => (
                        <div key={idx} className="bg-void-900/50 rounded-lg p-3">
                          <p className="text-void-100 font-medium">{screen.name}</p>
                          <p className="text-void-400 text-sm mt-1">{screen.description}</p>
                          <p className="text-void-500 text-xs mt-1">Source: {screen.source}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UI Elements */}
                {contextSummary.summary.ui_elements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-void-300 mb-2 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      UI Elements ({contextSummary.summary.ui_elements.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {contextSummary.summary.ui_elements.slice(0, 12).map((elem, idx) => (
                        <span key={idx} className="px-2 py-1 bg-void-700 rounded text-xs text-void-200">
                          {elem.type}: {elem.label}
                        </span>
                      ))}
                      {contextSummary.summary.ui_elements.length > 12 && (
                        <span className="px-2 py-1 bg-void-700 rounded text-xs text-void-400">
                          +{contextSummary.summary.ui_elements.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {contextSummary.summary.requirements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-void-300 mb-2 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" />
                      Requirements ({contextSummary.summary.requirements.length})
                    </h4>
                    <div className="space-y-2">
                      {contextSummary.summary.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${getPriorityColor(req.priority)}`}>
                            {req.priority}
                          </span>
                          <p className="text-void-200 text-sm">{req.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* User Flows */}
                {contextSummary.summary.user_flows.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-void-300 mb-2">
                      User Flows ({contextSummary.summary.user_flows.length})
                    </h4>
                    <div className="space-y-3">
                      {contextSummary.summary.user_flows.map((flow, idx) => (
                        <div key={idx} className="bg-void-900/50 rounded-lg p-3">
                          <p className="text-void-100 font-medium mb-2">{flow.name}</p>
                          <ol className="space-y-1">
                            {flow.steps.map((step, stepIdx) => (
                              <li key={stepIdx} className="text-void-300 text-sm flex items-start gap-2">
                                <span className="text-void-500 font-mono text-xs">{stepIdx + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Notes */}
                {contextSummary.summary.text_notes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-void-300 mb-2">
                      Notes ({contextSummary.summary.text_notes.length})
                    </h4>
                    <div className="space-y-2">
                      {contextSummary.summary.text_notes.map((note, idx) => (
                        <div key={idx} className="bg-void-900/50 rounded-lg p-3">
                          <p className="text-void-200 text-sm">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Processed Items */}
            <div className="bg-void-800 rounded-xl p-6 border border-void-700">
              <h3 className="text-sm font-medium text-void-300 mb-3">Processed Items</h3>
              <div className="space-y-2">
                {contextSummary.processed_items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-void-900/50 rounded-lg">
                    <div className="w-6 h-6 rounded bg-void-700 flex items-center justify-center text-void-400">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-void-200 text-sm truncate">{item.source_name}</p>
                      <p className="text-void-500 text-xs">{item.extracted_summary}</p>
                    </div>
                    {item.processed && <CheckCircle className="w-4 h-4 text-green-400" />}
                  </div>
                ))}
              </div>
            </div>

            {/* User Feedback Section */}
            <div className="bg-void-800 rounded-xl p-6 border border-void-700">
              <h3 className="text-lg font-semibold text-void-50 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                Provide Feedback (Optional)
              </h3>
              <p className="text-sm text-void-400 mb-4">
                If the AI misunderstood something, provide corrections or additional context. The context will be regenerated with your feedback.
              </p>
              
              <textarea
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                placeholder="e.g., 'The consolidator widget is actually on the 3rd widget, not 2nd. Also, the floating button should say Add to Bag, not just Add.'"
                rows={4}
                className="w-full px-4 py-3 bg-void-900 border border-void-600 rounded-lg text-void-100 placeholder-void-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none mb-3"
              />
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRegenerateWithFeedback}
                  disabled={!userFeedback.trim() || isRegenerating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-void-700 disabled:text-void-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isRegenerating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Regenerate Context
                    </>
                  )}
                </button>
                {userFeedback && (
                  <button
                    onClick={() => setUserFeedback('')}
                    className="px-4 py-2 bg-void-700 hover:bg-void-600 text-void-300 text-sm rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Generation Error */}
            {generationError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Failed to generate tests</p>
                    <p className="text-red-300/70 text-sm mt-1">{generationError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Test Cases Button */}
            <button
              onClick={handleGenerateTests}
              disabled={isGenerating || isRegenerating}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-void-700 disabled:to-void-700 disabled:text-void-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating Test Cases...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate & Review Test Cases
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ================================================
            Step 4: Review Tests
        ================================================ */}
        {step === 'review' && testPlan && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-void-800 rounded-xl p-6 border border-void-700">
              <h3 className="text-void-50 font-medium mb-2">Feature Summary</h3>
              <p className="text-void-300 text-sm">{testPlan.feature_summary}</p>
              
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-void-700">
                <div className="flex items-center gap-2">
                  <span className="text-void-400 text-sm">Generated:</span>
                  <span className="text-void-100 font-medium">{testPlan.test_count} test cases</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-void-400 text-sm">Selected:</span>
                  <span className="text-plasma-400 font-medium">{selectedTests.size}</span>
                </div>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <h3 className="text-void-100 font-medium">Test Cases</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTests(new Set(testPlan.test_cases.map(tc => tc.id)))}
                  className="px-3 py-1.5 text-xs text-void-300 hover:text-void-100 bg-void-800 hover:bg-void-700 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedTests(new Set())}
                  className="px-3 py-1.5 text-xs text-void-300 hover:text-void-100 bg-void-800 hover:bg-void-700 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Test Cards */}
            <div className="space-y-3">
              {testPlan.test_cases.map((test) => {
                const isSelected = selectedTests.has(test.id);
                const isExpanded = expandedTests.has(test.id);
                
                return (
                  <div
                    key={test.id}
                    className={`bg-void-800 rounded-xl border transition-all ${
                      isSelected ? 'border-plasma-500/50' : 'border-void-700'
                    }`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      <button
                        onClick={() => handleToggleTest(test.id)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          isSelected 
                            ? 'bg-plasma-500 text-white' 
                            : 'bg-void-700 text-void-500 hover:bg-void-600'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-void-500 text-xs font-mono">{test.id}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(test.category)}`}>
                            {test.category.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(test.priority)}`}>
                            {test.priority}
                          </span>
                        </div>
                        <h4 className="text-void-50 font-medium">{test.name}</h4>
                        <p className="text-void-400 text-sm mt-1">{test.description}</p>
                      </div>
                      
                      <button
                        onClick={() => handleToggleExpand(test.id)}
                        className="p-1 text-void-500 hover:text-void-300 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-void-700 mx-4 mb-4">
                        <div className="mb-4">
                          <h5 className="text-void-300 text-xs font-medium uppercase tracking-wider mb-2">Steps</h5>
                          <ol className="space-y-1">
                            {test.steps.map((step, idx) => (
                              <li key={idx} className="text-void-200 text-sm flex items-start gap-2">
                                <span className="text-void-500 font-mono text-xs mt-0.5">{idx + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                        
                        <div>
                          <h5 className="text-void-300 text-xs font-medium uppercase tracking-wider mb-2">Expected Result</h5>
                          <p className="text-green-400 text-sm">{test.expected_result}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Coverage Notes */}
            {testPlan.coverage_notes && (
              <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
                <h4 className="text-amber-400 text-sm font-medium mb-2">Coverage Notes</h4>
                <p className="text-amber-300/70 text-sm">{testPlan.coverage_notes}</p>
              </div>
            )}

            {/* Approve Button */}
            <button
              onClick={handleApproveAndGenerate}
              disabled={selectedTests.size === 0 || isApproving}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-void-700 disabled:to-void-700 disabled:text-void-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
            >
              {isApproving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating Executable Tests...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Approve & Generate ({selectedTests.size} tests)
                </>
              )}
            </button>
          </div>
        )}

        {/* ================================================
            Step 5: Execute Tests
        ================================================ */}
        {step === 'execute' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-void-800/50 rounded-lg p-4 border border-void-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-void-50 font-medium">{featureName}</h3>
                  <p className="text-sm text-void-400 mt-1">
                    {selectedTests.size} tests ready to execute
                  </p>
                </div>
                <Zap className="w-5 h-5 text-plasma-400" />
              </div>
            </div>

            {/* Window Selection */}
            <div className="bg-void-800 rounded-xl p-6 border border-void-700">
              <h3 className="text-lg font-semibold text-void-50 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-plasma-400" />
                Select Target Window
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedWindow}
                    onChange={(e) => setSelectedWindow(e.target.value)}
                    className="flex-1 px-4 py-3 bg-void-900 border border-void-600 rounded-lg text-void-100 focus:outline-none focus:border-plasma-500"
                  >
                    <option value="">Select a window...</option>
                    {windows.map((w) => (
                      <option key={w.id} value={w.title}>
                        {w.title} ({w.app_name})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadWindows}
                    disabled={isLoadingWindows}
                    className="px-4 py-3 bg-void-700 hover:bg-void-600 text-void-200 rounded-lg transition-colors"
                  >
                    {isLoadingWindows ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </button>
                </div>
                
                {selectedWindow && (
                  <div className="text-sm text-void-400">
                    Tests will be executed on: <span className="text-void-200 font-medium">{selectedWindow}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Execution Progress */}
            {isExecuting && (
              <div className="bg-void-800 rounded-xl p-6 border border-plasma-500/50">
                <div className="flex items-center gap-3 mb-4">
                  <Loader className="w-5 h-5 text-plasma-400 animate-spin" />
                  <h3 className="text-void-50 font-medium">Executing Tests...</h3>
                </div>
                
                {currentTest && (
                  <div className="bg-void-900/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-void-200 font-medium">
                        Test {currentTest.test_number}/{currentTest.total_tests}: {currentTest.title}
                      </span>
                      <span className="text-xs text-void-500 font-mono">{currentTest.test_id}</span>
                    </div>
                    
                    {currentTest.goal && (
                      <div className="text-xs text-void-400 mb-2 whitespace-pre-wrap">
                        {currentTest.goal}
                      </div>
                    )}
                    
                    {currentStep && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-void-400">Step {currentStep.step_number}:</span>
                          <span className="text-void-200">{currentStep.action}</span>
                          {currentStep.target && (
                            <>
                              <span className="text-void-500">→</span>
                              <span className="text-void-300 truncate">{currentStep.target}</span>
                            </>
                          )}
                          {currentStep.success !== undefined && (
                            currentStep.success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            )
                          )}
                        </div>
                        {currentStep.reasoning && (
                          <div className="text-xs text-void-500 italic pl-4">
                            {currentStep.reasoning}
                          </div>
                        )}
                        {currentStep.current_state && (
                          <div className="text-xs text-void-400 pl-4">
                            State: {currentStep.current_state}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Agent Needs Help */}
                {needsHelp && (
                  <div className="bg-amber-500/10 rounded-lg p-4 mb-4 border border-amber-500/30">
                    <div className="flex items-start gap-3 mb-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-amber-400 font-medium mb-1">Agent Needs Help</h4>
                        <p className="text-void-300 text-sm mb-2">{needsHelp.question}</p>
                        {needsHelp.current_state && (
                          <p className="text-void-400 text-xs mb-3">
                            Current state: {needsHelp.current_state}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <textarea
                        value={guidanceText}
                        onChange={(e) => setGuidanceText(e.target.value)}
                        placeholder="Provide guidance to help the agent continue..."
                        className="w-full bg-void-900/50 border border-void-700 rounded-lg px-3 py-2 text-sm text-void-200 placeholder-void-500 focus:outline-none focus:border-amber-500/50"
                        rows={3}
                      />
                      <button
                        onClick={handleProvideGuidance}
                        disabled={!guidanceText.trim()}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-void-700 disabled:text-void-500 text-white font-medium rounded-lg transition-colors"
                      >
                        Provide Guidance & Continue
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-void-500">
                  Watching the target window and executing test steps...
                </div>
              </div>
            )}

            {/* Execution Error */}
            {executionError && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Execution Failed</p>
                    <p className="text-red-300/70 text-sm mt-1">{executionError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecuteTests}
              disabled={!selectedWindow || isExecuting}
              className="w-full py-4 bg-gradient-to-r from-plasma-600 to-purple-600 hover:from-plasma-500 hover:to-purple-500 disabled:from-void-700 disabled:to-void-700 disabled:text-void-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-plasma-500/25"
            >
              {isExecuting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Executing Tests...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Tests on {selectedWindow || 'Selected Window'}
                </>
              )}
            </button>

            {/* Skip to manual execution */}
            <div className="text-center">
              <button
                onClick={() => setStep('done')}
                className="text-sm text-void-500 hover:text-void-300 transition-colors"
              >
                Skip and finish later
              </button>
            </div>
          </div>
        )}

        {/* ================================================
            Step 6: Done
        ================================================ */}
        {step === 'done' && (
          <div className="bg-void-800 rounded-xl p-12 border border-void-700 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            
            {executionResults ? (
              <>
                <h2 className="text-xl font-semibold text-void-50 mb-2">Test Execution Complete!</h2>
                
                {/* Results Summary */}
                <div className="flex items-center justify-center gap-6 my-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{executionResults.passed}</div>
                    <div className="text-xs text-void-500">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{executionResults.failed}</div>
                    <div className="text-xs text-void-500">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{executionResults.skipped}</div>
                    <div className="text-xs text-void-500">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-void-200">{executionResults.total}</div>
                    <div className="text-xs text-void-500">Total</div>
                  </div>
                </div>

                {/* Test Results List */}
                {executionResults.testResults.length > 0 && (
                  <div className="bg-void-900/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                    {executionResults.testResults.map((result, idx) => (
                      <div key={idx} className="py-2 border-b border-void-800 last:border-0">
                        <div className="flex items-center gap-2">
                          {result.status === 'passed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          ) : result.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          )}
                          <span className="text-void-500 text-xs font-mono">{result.test_id}</span>
                          <span className="text-void-300 text-sm truncate">{result.title}</span>
                        </div>
                        {result.conclusion && (
                          <p className="text-xs text-void-400 mt-1 ml-6 italic">
                            {result.conclusion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-void-50 mb-2">Tests Generated Successfully!</h2>
                <p className="text-void-400 mb-6">
                  Your executable test cases have been generated and saved.
                </p>
              </>
            )}
            
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setStep('create');
                  setContextId(null);
                  setFeatureName('');
                  setFeatureDescription('');
                  setLocalFiles([]);
                  setTextNotes([]);
                  setContextSummary(null);
                  setTestPlan(null);
                  setSelectedTests(new Set());
                  setExecutionResults(null);
                }}
                className="px-6 py-2 bg-void-700 hover:bg-void-600 text-void-200 rounded-lg transition-colors"
              >
                Create Another Suite
              </button>
              {!executionResults && (
                <button
                  onClick={() => {
                    loadWindows();
                    setStep('execute');
                  }}
                  className="px-6 py-2 bg-plasma-600 hover:bg-plasma-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Run Tests
                </button>
              )}
              {executionResults && executionResults.failed > 0 && (
                <button
                  onClick={() => {
                    loadWindows();
                    setStep('execute');
                  }}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Re-run Tests
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/create')({
  component: CreateTestPage,
});
