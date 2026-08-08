import * as React from 'react';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
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
  ScanText,
  LayoutGrid,
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
  useUpdateProjectContext,
} from '@/hooks/useProjectsQueries';
import { type CloudContextItem } from '@/api/client';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/app/projects/$projectId/context')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/app/projects/$projectId',
      params: { projectId: params.projectId },
    });
  },
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

export function ProjectContextModal({
  open,
  onOpenChange,
  projectId,
  existingImages,
  existingTexts,
  onSuccess,
}: ProjectContextModalProps) {
  const updateContextMutation = useUpdateProjectContext(projectId);
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

      await updateContextMutation.mutateAsync({
        images: imageFiles,
        texts: textValues,
        callbacks: {
          onProgress: (msg) => setProgressMessages((prev) => [...prev, msg]),
          onDone: () => {
            onSuccess();
            onOpenChange(false);
          },
          onError: (msg) => {
            setErrorMessage(msg);
            setIsSubmitting(false);
          },
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
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-[#ececf1] px-6 py-5">
          <DialogTitle className="font-serif text-2xl font-light">
            {existingImages.length > 0 || existingTexts.length > 0
              ? 'Update Project Context'
              : 'Add Project Context'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add the latest information about your product. Clariti will analyse it and generate an updated context summary to help create better test cases.
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto bg-white px-6 py-5">
          {/* Image upload */}
          <section>
            <div className="mb-3 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-semibold text-violet-600">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">Add screenshots <span className="font-normal text-muted-foreground">(optional)</span></p>
                <p className="text-xs text-muted-foreground">Upload images to help Clariti understand the UI, flows, and changes.</p>
              </div>
            </div>

            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-7 text-center transition-colors',
                isDragging
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-[#d9d9e1] bg-[#fafafd] hover:border-violet-400 hover:bg-violet-500/5'
              )}
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/10">
                <Upload className="size-4 text-violet-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                Drag & drop images here, or{' '}
                <span className="font-medium text-violet-600">browse</span>
              </p>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP up to 10 MB each</p>
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
                  <div key={img.key} className="group relative aspect-square overflow-hidden rounded-lg border border-[#ececf1] bg-[#f5f5f8]">
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
          </section>

          {/* Text notes */}
          <section>
            <div className="mb-3 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-semibold text-violet-600">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">Add text context <span className="font-normal text-muted-foreground">(optional)</span></p>
                <p className="text-xs text-muted-foreground">Paste details, updates, or anything Clariti should know.</p>
              </div>
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
                    className="flex-1 resize-none rounded-lg border border-[#ececf1] bg-[#f5f5f8] px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="border-[#d9d9e1] bg-white hover:bg-[#f5f5f8]"
                onClick={() => setTexts((prev) => [...prev, ''])}
              >
                <Plus className="size-3.5" />
                Add context
              </Button>
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-lg bg-violet-500/5 px-3 py-2.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
            <p>Clariti will analyse all uploaded screenshots and notes to generate an improved context summary.</p>
          </div>

          {/* Progress / error */}
          {progressMessages.length > 0 && (
            <div className="space-y-1 rounded-xl border border-[#ececf1] bg-white px-4 py-3">
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
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#ececf1] bg-white px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#111114] hover:bg-[#29292f]"
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
                Generate context
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
  const { project } = useProject(projectId);
  const { contextItems, loading: itemsLoading } = useProjectContextItems(projectId);
  const updateContextMutation = useUpdateProjectContext(projectId);
  const [modalOpen, setModalOpen] = React.useState(false);

  if (!project) return null;

  const existingImages = contextItems.filter((i) => i.type === 'image');
  const existingTexts = contextItems.filter((i) => i.type === 'text');

  function handleContextSuccess() {
    // cache invalidation is handled automatically by useUpdateProjectContext onSuccess
  }

  const hasContext = !!project.context_summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app" className="text-muted-foreground hover:text-foreground">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/projects/$projectId" params={{ projectId }} className="text-muted-foreground hover:text-foreground">
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Context</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Foundational knowledge the AI uses to generate accurate test cases.
          </p>
        </div>
        {hasContext && (
          <Button size="sm" onClick={() => setModalOpen(true)} disabled={itemsLoading}>
            <RefreshCw className="size-3.5" />
            Update Context
          </Button>
        )}
      </div>

      {!hasContext ? (
        /* ── Empty state ── */
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="w-full max-w-md rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/10">
              <BookText className="size-7 text-violet-600" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">No context added yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Upload screenshots and text notes — the AI will analyse them and build a context summary that powers better test generation.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {[
                { icon: ImageIcon, label: 'UI Screenshots' },
                { icon: FileText, label: 'User Stories' },
                { icon: ScanText, label: 'Tech Specs' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                  <Icon className="size-3" />
                  {label}
                </span>
              ))}
            </div>
            <Button className="mt-8" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add Context
            </Button>
          </div>
        </div>
      ) : (
        /* ── Populated bento ── */
        <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          {/* ── AI Summary — spans 2 cols on large ── */}
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">AI SUMMARY</span>
            </div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">What we understand</h2>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-12">
              {project.context_summary}
            </p>
            {(existingImages.length > 0 || existingTexts.length > 0) && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                {existingImages.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    <ImageIcon className="size-3" />
                    {existingImages.length} image{existingImages.length !== 1 ? 's' : ''}
                  </span>
                )}
                {existingTexts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    <FileText className="size-3" />
                    {existingTexts.length} text note{existingTexts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {project.source_memory && (
            <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">APP MEMORY</span>
              </div>
              <h2 className="mb-3 text-base font-semibold text-foreground">What you told Clariti</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground line-clamp-12">
                {project.source_memory}
              </p>
            </div>
          )}

          {/* ── Upload / Update CTA ── */}
          <div
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-violet-600 p-6 transition-opacity hover:opacity-90"
            onClick={() => setModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
          >
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-white/20">
              <Upload className="size-5 text-white" />
            </div>
            <h2 className="text-base font-semibold text-white">Update Context</h2>
            <p className="mt-1 flex-1 text-sm text-violet-200">
              Replace or add screenshots and notes to regenerate the AI summary.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white">
              <RefreshCw className="size-3" />
              Regenerate
            </div>
            {/* decorative blobs */}
            <div className="pointer-events-none absolute -bottom-6 -right-6 size-28 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 -right-12 size-40 rounded-full bg-white/5" />
          </div>

          {/* ── Screenshots grid ── */}
          {existingImages.length > 0 && (
            <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Screenshots</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {existingImages.length}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {existingImages.slice(0, 6).map((img) => (
                  <div key={img.id} className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    {img.content ? (
                      <img
                        src={dataUrlFromBase64(img.content, img.filename ?? 'image.png')}
                        alt={img.filename ?? 'screenshot'}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ImageIcon className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {existingImages.length > 6 && (
                  <div className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted text-xs font-medium text-muted-foreground">
                    +{existingImages.length - 6}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Text notes preview ── */}
          {existingTexts.length > 0 && (
            <div className={cn(
              'flex flex-col rounded-2xl border border-border bg-card p-5',
              existingImages.length === 0 ? 'md:col-span-1' : ''
            )}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Notes</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {existingTexts.length}
                </span>
              </div>
              <div className="space-y-2">
                {existingTexts.slice(0, 2).map((item) => (
                  <p key={item.id} className="line-clamp-3 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {item.content}
                  </p>
                ))}
                {existingTexts.length > 2 && (
                  <p className="text-xs text-muted-foreground">+{existingTexts.length - 2} more note{existingTexts.length - 2 !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          to="/app/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-3.5 rotate-180" />
          Back to overview
        </Link>
      </div>

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
