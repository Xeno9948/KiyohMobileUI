"use client";

import { useState } from "react";

export default function GMBSetupPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Default to the known location ID if available, but allow interaction
    const [accountId, setAccountId] = useState("11535144745965350294");
    const [locationId, setLocationId] = useState("11535144745965350294");

    const setupGMB = async () => {
        setLoading(true);
        setResult(null); // Clear previous results
        try {
            const response = await fetch('/api/gmb/check-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    companyId: 'cmlaqdoqk0000ob8yey5qfdwg',
                    accountId: accountId.trim(),
                    locationId: locationId.trim(),
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (error: any) {
            setResult({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
                <h1 className="text-2xl font-bold mb-4">Manual GMB Setup</h1>

                <div className="mb-6">
                    <p className="text-gray-600 mb-4">
                        Since the API auto-discovery is blocked, please enter your IDs manually.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Account ID
                            </label>
                            <input
                                type="text"
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Enter Account ID"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Check your browser URL when logged into Google Business Profile.
                                Could be numeric (e.g. 115...) causes 404 if wrong.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Location ID
                            </label>
                            <input
                                type="text"
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Enter Location ID"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Usually found in URL: .../locations/<b>123456...</b>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={setupGMB}
                        disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
                    >
                        {loading ? 'Saving...' : 'Save Configuration'}
                    </button>

                    <a href="/reviews" className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition border border-gray-300">
                        Check Reviews Page
                    </a>
                </div>

                {result && (
                    <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                        <p className="font-semibold mb-2">Result:</p>
                        <pre className="text-xs overflow-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                        {result.success && <p className="text-green-600 font-bold mt-2">✅ Saved! Now go check reviews.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
