"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Link as LinkIcon, Settings, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function GMBSettings() {
    const [loading, setLoading] = useState(true);
    const [gmbStatus, setGmbStatus] = useState<{
        enabled: boolean;
        accountId?: string;
        locationId?: string;
    } | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const searchParams = useSearchParams();

    useEffect(() => {
        fetchGMBStatus();
    }, []);

    const fetchGMBStatus = async () => {
        try {
            const res = await fetch("/api/company");
            if (res.ok) {
                const data = await res.json();
                setGmbStatus({
                    enabled: data.company?.gmbEnabled || false,
                    accountId: data.company?.gmbAccountId,
                    locationId: data.company?.gmbLocationId,
                });
            }
        } catch (error) {
            console.error("Failed to fetch GMB status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        window.location.href = "/api/gmb/auth";
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Google My Business?")) {
            return;
        }

        setDisconnecting(true);
        try {
            const res = await fetch("/api/gmb/disconnect", {
                method: "POST",
            });

            if (res.ok) {
                await fetchGMBStatus();
            } else {
                alert("Failed to disconnect GMB");
            }
        } catch (error) {
            console.error("Disconnect error:", error);
            alert("Failed to disconnect GMB");
        } finally {
            setDisconnecting(false);
        }
    };

    // Check for OAuth callback messages
    const gmbSuccess = searchParams?.get("gmb_success");
    const gmbError = searchParams?.get("gmb_error");

    if (loading) {
        return (
            <div className="kiyoh-card p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-[#6bbc4a]" size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="kiyoh-card p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#f5f5f5] rounded-lg">
                    <Settings className="text-[#6bbc4a]" size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-[#3d3d3d]">Google My Business</h3>
                    <p className="text-sm text-gray-500">Manage GMB reviews alongside Kiyoh reviews</p>
                </div>
            </div>

            {/* Success/Error Messages */}
            {gmbSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle size={16} />
                    <span>Successfully connected to Google My Business!</span>
                </div>
            )}

            {gmbError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle size={16} />
                    <span>Error: {gmbError.replace(/_/g, " ")}</span>
                </div>
            )}

            {/* Connection Status */}
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        {gmbStatus?.enabled ? (
                            <CheckCircle className="text-[#6bbc4a]" size={20} />
                        ) : (
                            <XCircle className="text-gray-400" size={20} />
                        )}
                        <div>
                            <p className="font-medium text-[#3d3d3d]">
                                {gmbStatus?.enabled ? "Connected" : "Not Connected"}
                            </p>
                            {gmbStatus?.enabled && gmbStatus.locationId && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Location: {gmbStatus.locationId.split("/").pop()}
                                </p>
                            )}
                        </div>
                    </div>

                    {gmbStatus?.enabled ? (
                        <button
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="btn-secondary text-red-600 hover:bg-red-50 border-red-200"
                        >
                            {disconnecting ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <XCircle size={16} />
                            )}
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="btn-kiyoh"
                        >
                            <LinkIcon size={16} />
                            Connect GMB
                        </button>
                    )}
                </div>

                {/* Info */}
                {!gmbStatus?.enabled && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-gray-700">
                            <strong>Connect your Google My Business account</strong> to view and manage GMB reviews directly from the dashboard. You'll be able to:
                        </p>
                        <ul className="mt-2 ml-4 text-sm text-gray-600 space-y-1 list-disc">
                            <li>View GMB reviews alongside Kiyoh reviews</li>
                            <li>Use AI to generate responses</li>
                            <li>Manage all reviews from one place</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
