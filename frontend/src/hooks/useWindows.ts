import { useQuery } from '@tanstack/react-query';
import { getWindows } from '../api/client';

export function useWindows() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['windows'],
    queryFn: async () => {
      const data = await getWindows();
      // Filter out system windows and sort by app name
      return data
        .filter(w => 
          w.title && 
          w.title !== 'Dock' && 
          w.title !== 'Gesture Blocking Overlay' &&
          w.bounds.width > 100 &&
          w.bounds.height > 100
        )
        .sort((a, b) => a.app_name.localeCompare(b.app_name));
    },
  });

  return {
    windows: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
