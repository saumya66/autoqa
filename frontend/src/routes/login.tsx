import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FlaskConical, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useLogin, useRegister } from '@/hooks/useAuthMutations';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const skipped = useAuthStore((s) => s.skipped);
  const setSkipped = useAuthStore((s) => s.setSkipped);

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

  const handleSkip = () => {
    setSkipped();
    navigate({ to: '/app/create' });
  };

  return (
    <div className="flex h-full min-h-screen w-full bg-background text-foreground">
      {/* Left: Form */}
      <div className="flex w-full flex-col justify-between p-8 sm:w-1/2 lg:max-w-[480px] lg:px-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </div>
            <span className="text-xl font-semibold text-foreground">AutoQA</span>
          </div>

          {/* Welcome */}
          <div className="mt-12">
            <h1 className="text-2xl font-bold text-foreground">
              {mode === 'login' ? 'Welcome back,' : 'Create an account'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {mode === 'login'
                ? 'Please enter your details to access your dashboard.'
                : 'Enter your details to get started.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="mt-1.5 h-10 text-foreground"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <Label htmlFor="name" className="text-foreground">Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1.5 h-10 text-foreground"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 pr-10 text-foreground"
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
                  className="size-4 rounded border-input"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  Remember for 30 days
                </Label>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={authMutation.isPending}
            >
              {authMutation.isPending ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create account'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); registerMutation.reset(); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign up for free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); loginMutation.reset(); }}
                    className="font-medium text-primary hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Skip & Use Locally */}
        <div className="mt-8 pt-8 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleSkip}
          >
            Skip & Use Locally
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-muted-foreground">
          © 2024 AutoQA Inc. · Privacy Policy · Terms of Service
        </p>
      </div>

      {/* Right: Empty placeholder */}
      <div className="hidden flex-1 bg-muted/30 lg:block" />
    </div>
  );
}
