import { useMutation } from '@tanstack/react-query';
import { login, register, type AuthResponse } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (data: AuthResponse) => {
      setAuth(data.access_token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      });
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name?: string;
    }) => register(email, password, name),
    onSuccess: (data: AuthResponse) => {
      setAuth(data.access_token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      });
    },
  });
}
