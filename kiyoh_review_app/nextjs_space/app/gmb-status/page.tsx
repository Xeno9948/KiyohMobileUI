"use client";

import { useState, useEffect } from "react";

export default function GMBStatusPage() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const checkStatus = async () => {
        setLoading(true);
        try {
            // Use the existing setup-ids endpoint which attempts to fetch accounts
            // This is the best way to test if Quota is still 0
            const response = await fetch('/api/gmb/setup-ids');
            const data = await response.json();

            setStatus({
                ok: response.ok,
                data: data,
                status: response.status
            });
        } catch (error: any) {
            setStatus({ error: error.message });
        } finally {
            setLoading(false);
            setLastChecked(new Date());
        }
    };

    // Check immediately on load
    useEffect(() => {
        checkStatus();
    }, []);

    // Poll every 30 seconds
    useEffect(() => {
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">GMB API Status Monitor</h1>
                    {loading && <span className="text-blue-600 animate-pulse">Checking...</span>}
                </div>

                <div className="mb-6">
                    <p className="text-gray-600 mb-2">
                        Monitoring API Quota status. This page will auto-refresh every 30 seconds.
                    </p>
                    {lastChecked && (
                        <p className="text-xs text-gray-400">Last checked: {lastChecked.toLocaleTimeString()}</p>
                    )}
                </div>

                <div className="space-y-4">
                    <div className={`p-4 rounded-lg border ${status?.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <h3 className="font-semibold mb-2">
                            Status: {status?.ok ? '✅ Operational' : '❌ Blocked / Error'}
                        </h3>

                        {status?.status === 429 && (
                            <div className="text-red-700 bg-red-50 p-4 rounded border border-red-200">
                                <p className="font-bold text-lg">⚠️ Waiting for Google (Quota 0)</p>
                                <p className="mt-2 text-sm">
                                    <strong>Good news:</strong> You successfully enabled the correct API! <br />
                                    <strong>Bad news:</strong> Google takes 15-60 minutes to update your quota after billing is added.
                                </p>
                                <p className="mt-2 text-sm">
                                    Ignore the "Dead Link" errors. You don't need to click anything else.
                                    Just keep this page open until it turns green. 🍵
                                </p>
                            </div>
                        )}

                        {!status?.ok && status?.data?.error && (
                            <pre className="mt-2 text-xs overflow-auto bg-white p-2 rounded border border-red-100 max-h-40">
                                {typeof status.data.error === 'string'
                                    ? status.data.error
                                    : JSON.stringify(status.data.error, null, 2)}
                            </pre>
                        )}

                        {status?.ok && (
                            <div className="text-green-700">
                                <p className="font-bold">🎉 Success! API is working.</p>
                                <p className="text-sm mt-1">
                                    Account ID found: {status.data.accountId}<br />
                                    Location ID found: {status.data.locationId}
                                </p>
                                <a href="/reviews" className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
                                    Go to Reviews
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={checkStatus}
                    disabled={loading}
                    className="mt-6 w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded transition"
                >
                    Check Now Manually
                </button>
            </div>
        </div>
    );
}
