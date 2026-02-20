import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '../api/client';

export function useBackendStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 5000,
  });

  return {
    isConnected: data ?? false,
    checking: isLoading,
  };
}
