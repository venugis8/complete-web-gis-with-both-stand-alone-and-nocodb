import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SuperAdminDashboard from '@/components/super-admin-dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <SuperAdminDashboard />
        {/* Simple toast container - temporary fallback */}
        <div id="toast-container" className="fixed top-4 right-4 z-50"></div>
      </div>
    </QueryClientProvider>
  );
}

export default App;