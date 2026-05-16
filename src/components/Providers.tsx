"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import SyncProvider from "./SyncProvider";

// ─────────────────────────────────────────────────────────
// Providers — client component wrapper for React Query + Sync
// ─────────────────────────────────────────────────────────

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5 minutes
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <SyncProvider>{children}</SyncProvider>
        </QueryClientProvider>
    );
}
