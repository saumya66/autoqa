import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  BookText,
  RefreshCw,
  Plus,
  X,
  ImageIcon,
  FileText,
  Upload,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  useProject,
  useProjectContextItems,
  projectQueryKey,
} from '@/hooks/useProjectsQueries';
import { updateProjectContext, type CloudContextItem } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/app/projects/$projectId/context')({
  component: ProjectContextPage,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

function dataUrlFromBase64(base64: string, filename: string): string {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? 'png';
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'gif'
        ? 'image/gif'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/png';
  return `data:${mime};base64,${base64}`;
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface StagedImage {
  /** Identifier — File object name for new, item id for existing */
  key: string;
  file?: File;
  previewUrl: string;
  filename: string;
  /** Pre-existing base64 content (for items already saved to cloud) */
  existingBase64?: string;
  existingSize?: number;
}

interface ProjectContextModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  existingImages: CloudContextItem[];
  existingTexts: CloudContextItem[];
  onSuccess: () => void;
}

function ProjectContextModal({
  open,
  onOpenChange,
  projectId,
  existingImages,
  existingTexts,
  onSuccess,
}: ProjectContextModalProps) {
  const [images, setImages] = React.useState<StagedImage[]>([]);
  const [texts, setTexts] = React.useState<string[]>(['']);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [progressMessages, setProgressMessages] = React.useState<string[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Pre-fill when modal opens
  React.useEffect(() => {
    if (!open) return;

    setProgressMessages([]);
    setErrorMessage(null);
    setIsSubmitting(false);

    const prefilledImages: StagedImage[] = existingImages
      .filter((item) => item.content)
      .map((item) => ({
        key: item.id,
        filename: item.filename ?? 'image',
        previewUrl: dataUrlFromBase64(item.content!, item.filename ?? 'image.png'),
        existingBase64: item.content!,
        existingSize: item.file_size ?? 0,
      }));
    setImages(prefilledImages);

    const prefilledTexts = existingTexts
      .filter((item) => item.content)
      .map((item) => item.content!);
    setTexts(prefilledTexts.length > 0 ? prefilledTexts : ['']);
  }, [open, existingImages, existingTexts]);

  function addFiles(files: File[]) {
    const valid = files.filter((f) => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_IMAGE_BYTES) {
        setErrorMessage(`"${f.name}" exceeds the 10 MB limit.`);
        return false;
      }
      return true;
    });
    const staged: StagedImage[] = valid.map((f) => ({
      key: `${f.name}-${f.lastModified}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      filename: f.name,
    }));
    setImages((prev) => [...prev, ...staged]);
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const img = prev.find((i) => i.key === key);
      if (img?.file) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setProgressMessages([]);
    setErrorMessage(null);

    try {
      // For existing items still in the list, reconstruct File-like blobs
      const imageFiles: File[] = await Promise.all(
        images.map(async (img) => {
          if (img.file) return img.file;
          // Existing item: convert base64 back to File
          const res = await fetch(img.previewUrl);
          const blob = await res.blob();
          return new File([blob], img.filename, { type: blob.type });
        })
      );

      const textValues = texts.filter((t) => t.trim().length > 0);

      await updateProjectContext(projectId, imageFiles, textValues, {
        onProgress: (msg) => setProgressMessages((prev) => [...prev, msg]),
        onDone: () => {
          onSuccess();
          onOpenChange(false);
        },
        onError: (msg) => {
          setErrorMessage(msg);
          setIsSubmitting(false);
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  const hasContent = images.length > 0 || texts.some((t) => t.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-base font-semibold">
            {existingImages.length > 0 || existingTexts.length > 0
              ? 'Update Project Context'
              : 'Add Project Context'}
          </DialogTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload screenshots or paste text notes. AI will generate a context summary used to produce better test cases.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Image upload */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Screenshots</span>
              <span className="text-xs text-muted-foreground">(max 10 MB each)</span>
            </div>

            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <Upload className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop images here, or{' '}
                <span className="font-medium text-primary">browse</span>
              </p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />

            {/* Staged images grid */}
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((img) => (
                  <div key={img.key} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    <img
                      src={img.previewUrl}
                      alt={img.filename}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.key)}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Text notes */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Text Notes</span>
            </div>
            <div className="space-y-2">
              {texts.map((text, idx) => (
                <div key={idx} className="flex gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => {
                      const next = [...texts];
                      next[idx] = e.target.value;
                      setTexts(next);
                    }}
                    placeholder="Describe a feature, user flow, or business rule…"
                    rows={3}
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {texts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTexts((prev) => prev.filter((_, i) => i !== idx))}
                      className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTexts((prev) => [...prev, ''])}
              >
                <Plus className="size-3.5" />
                Add note
              </Button>
            </div>
          </div>

          {/* Progress / error */}
          {progressMessages.length > 0 && (
            <div className="rounded-lg bg-muted/60 px-4 py-3 space-y-1">
              {progressMessages.map((msg, i) => (
                <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {i === progressMessages.length - 1 && isSubmitting && (
                    <Loader2 className="size-3 shrink-0 animate-spin" />
                  )}
                  {msg}
                </p>
              ))}
            </div>
          )}
          {errorMessage && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasContent}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Context
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ProjectContextPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const { project, refetch: refetchProject } = useProject(projectId);
  const { contextItems, loading: itemsLoading } = useProjectContextItems(projectId);
  const [modalOpen, setModalOpen] = React.useState(false);

  if (!project) return null;

  const existingImages = contextItems.filter((i) => i.type === 'image');
  const existingTexts = contextItems.filter((i) => i.type === 'text');

  function handleContextSuccess() {
    // Refetch project so context_summary updates
    queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
    refetchProject();
  }

  const hasContext = !!project.context_summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app" className="text-muted-foreground hover:text-foreground">
                Projects
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                to="/app/projects/$projectId"
                params={{ projectId }}
                className="text-muted-foreground hover:text-foreground"
              >
                {project.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Context</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Project Context</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the foundational knowledge the AI uses to generate accurate test cases.
        </p>
      </div>

      {/* Content */}
      {!hasContext ? (
        /* ── Empty state ── */
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <BookText className="size-8" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">No project context yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Add screenshots and text notes to help the AI understand your product. Rich context leads to significantly better test coverage.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5" />
                UI Screenshots
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                User Stories
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                Technical Specs
              </div>
            </div>
            <Button
              className="mt-8"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="size-4" />
              Add Context
            </Button>
          </div>
        </div>
      ) : (
        /* ── Populated state ── */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card 1 — What we understand */}
          <div className={cn(
            'flex flex-col rounded-xl border border-border bg-card p-5',
            'lg:col-span-2'
          )}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">What we understand</h2>
                <p className="text-xs text-muted-foreground">AI-generated project context summary</p>
              </div>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {project.context_summary}
            </p>

            {/* Asset counts */}
            {!itemsLoading && (existingImages.length > 0 || existingTexts.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {existingImages.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <ImageIcon className="size-3" />
                    {existingImages.length} image{existingImages.length !== 1 ? 's' : ''}
                  </span>
                )}
                {existingTexts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <FileText className="size-3" />
                    {existingTexts.length} text note{existingTexts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Card 2 — Update context */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RefreshCw className="size-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Update Context</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Add or replace screenshots and notes to regenerate the context summary.
            </p>
            <Button
              className="mt-5 w-full"
              variant="outline"
              onClick={() => setModalOpen(true)}
              disabled={itemsLoading}
            >
              <RefreshCw className="size-4" />
              Update
            </Button>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-6">
        <Link
          to="/app/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-3.5 rotate-180" />
          Back to overview
        </Link>
      </div>

      {/* Modal */}
      <ProjectContextModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectId={projectId}
        existingImages={existingImages}
        existingTexts={existingTexts}
        onSuccess={handleContextSuccess}
      />
    </div>
  );
}
