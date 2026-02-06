"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Facebook, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function FacebookSettings() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [status, setStatus] = useState<"connected" | "disconnected">("disconnected");
    const [stats, setStats] = useState<any>(null);
    const [error, setError] = useState("");

    // Check connection status on mount
    useEffect(() => {
        checkStatus();

        // Handle URL params
        const success = searchParams.get('success');
        const err = searchParams.get('error');
        if (success === 'facebook_connected') {
            checkStatus(); // Refresh status
            // Clear URL
            router.replace('/settings');
        }
        if (err) {
            setError(searchParams.get('details') || "Failed to connect Facebook");
        }
    }, [searchParams]);

    const checkStatus = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/company");
            const data = await res.json();

            if (data.company?.fbEnabled) {
                setStatus("connected");
                // Typically fetch page name or stats here if available
                setStats({ pageId: data.company.fbPageId });
            } else {
                setStatus("disconnected");
            }
        } catch (e) {
            console.error("Failed to check FB status", e);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        setConnecting(true);
        // Redirect to Auth Route
        window.location.href = "/api/facebook/auth?returnTo=/settings";
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Facebook? This will stop review syncing.")) return;

        setConnecting(true);
        try {
            const res = await fetch("/api/facebook/disconnect", { method: "POST" });
            if (res.ok) {
                setStatus("disconnected");
                setStats(null);
            } else {
                setError("Failed to disconnect");
            }
        } catch (e) {
            setError("Connection error");
        } finally {
            setConnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-xl border border-gray-200 animate-pulse h-40"></div>
        );
    }

    return (
        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1877F2]/10 rounded-full flex items-center justify-center">
                        <Facebook className="text-[#1877F2]" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Facebook Reviews</h3>
                        <p className="text-sm text-gray-500">Connect your Facebook Page to sync reviews</p>
                    </div>
                </div>
                {status === "connected" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle size={12} />
                        Connected
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <XCircle size={12} />
                        Disconnected
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                    <XCircle size={16} />
                    {error}
                </div>
            )}

            {status === "connected" ? (
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-200">
                                <Facebook size={16} className="text-[#1877F2]" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Connected Page</p>
                                <p className="text-xs text-gray-500 font-mono">ID: {stats?.pageId || '...'}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDisconnect}
                            disabled={connecting}
                            className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                        >
                            {connecting ? "Disconnecting..." : "Disconnect"}
                        </button>
                    </div>
                    <div className="text-xs text-gray-500">
                        Reviews are synced automatically every 15 minutes.
                    </div>
                </div>
            ) : (
                <div className="mt-4">
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
                    >
                        {connecting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Facebook size={18} />
                                Connect Facebook Page
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
