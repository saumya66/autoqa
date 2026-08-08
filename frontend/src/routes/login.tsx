import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useLogin, useRegister } from '@/hooks/useAuthMutations';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const skipped = useAuthStore((s) => s.skipped);

  // Redirect if already authenticated or skipped (e.g. after persist hydration)
  React.useEffect(() => {
    if (token) navigate({ to: '/app' });
    else if (skipped) navigate({ to: '/app/create' });
  }, [token, skipped, navigate]);

  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const authMutation = mode === 'login' ? loginMutation : registerMutation;
  const error = authMutation.isError
    ? (authMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
      'Sign in failed'
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      loginMutation.mutate(
        { email, password },
        {
          onSuccess: () => navigate({ to: '/app' }),
        }
      );
    } else {
      registerMutation.mutate(
        { email, password, name: name || undefined },
        {
          onSuccess: () => navigate({ to: '/app' }),
        }
      );
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-auto bg-white text-foreground">
      <main className="grid min-h-screen w-full overflow-hidden bg-white lg:grid-cols-[0.95fr_1.05fr]">
        <section
          className="relative m-3 hidden overflow-hidden rounded-3xl bg-[#09091a] bg-cover bg-center p-8 text-white lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundImage: "linear-gradient(180deg, rgba(6, 5, 20, 0.05) 25%, rgba(4, 4, 12, 0.92) 88%), url('/auth-bg.png')" }}
        >
          <p className="text-xs font-semibold tracking-[0.24em] text-white/80">CLARITI</p>
          <div className="max-w-xs">
            <h2 className="font-serif text-4xl leading-[1.03] tracking-tight xl:text-5xl">
              Build with confidence. Ship with clarity.
            </h2>
            <p className="mt-5 text-sm leading-6 text-white/75">
              Transform every release into a confident decision.
            </p>
          </div>
        </section>

        <section className="flex min-h-155 items-center justify-center px-7 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-center gap-2">
              <img src="/logo.png" alt="Clariti" className="size-7 object-contain" />
              <span className="text-base font-semibold tracking-tight">Clariti</span>
            </div>

            <div className="mt-14 text-center">
              <h1 className="font-serif text-4xl leading-none tracking-tight text-[#15151b]">
                {mode === 'login' ? 'Welcome back' : 'Create an account'}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {mode === 'login' ? 'Enter your details to access your workspace.' : 'Enter your details to get started.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#25252c]">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-2 h-11 border-0 bg-[#f5f5f8] px-4 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[#25252c]"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-[#25252c]">Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-2 h-11 border-0 bg-[#f5f5f8] px-4 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[#25252c]"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[#25252c]">Password</Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 border-0 bg-[#f5f5f8] px-4 pr-11 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[#25252c]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-3.5 rounded border-[#c9c9cf] accent-[#15151b]"
                />
                <Label
                  htmlFor="remember"
                  className="cursor-pointer text-xs font-normal text-muted-foreground"
                >
                  Remember me
                </Label>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="h-11 w-full bg-[#111114] text-sm font-medium text-white hover:bg-[#29292f]"
              disabled={authMutation.isPending}
            >
              {authMutation.isPending ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
            <p className="pt-24 text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); registerMutation.reset(); }}
                  className="font-semibold text-[#25252c] hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); loginMutation.reset(); }}
                  className="font-semibold text-[#25252c] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
