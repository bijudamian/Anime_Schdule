"use client";

// ─────────────────────────────────────────────────────────
// AuthButton — vivid sign-in / user button for the filter bar
// ─────────────────────────────────────────────────────────

import { Show, UserButton, SignInButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";

export default function AuthButton() {
    return (
        <div className="flex items-center">
            <Show when="signed-out">
                <SignInButton mode="modal">
                    <button
                        className="group/auth relative inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold text-white cursor-pointer transition-all duration-300 overflow-hidden"
                        style={{
                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #a855f7 100%)",
                            boxShadow: "0 0 16px rgba(139, 92, 246, 0.45), 0 2px 8px rgba(0,0,0,0.3)",
                        }}
                    >
                        {/* Animated shine sweep on hover */}
                        <span
                            className="absolute inset-0 opacity-0 group-hover/auth:opacity-100 transition-opacity duration-300"
                            style={{
                                background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 40%, #c084fc 100%)",
                            }}
                        />
                        <LogIn className="relative z-10 h-3.5 w-3.5" />
                        <span className="relative z-10">Sign In</span>
                    </button>
                </SignInButton>
            </Show>
            <Show when="signed-in">
                <UserButton
                    appearance={{
                        elements: {
                            avatarBox: "w-8 h-8 ring-2 ring-purple-500/50",
                        },
                    }}
                />
            </Show>
        </div>
    );
}
