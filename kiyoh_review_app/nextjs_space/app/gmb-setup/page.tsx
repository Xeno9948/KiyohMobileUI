"use client";

import { useState } from "react";

export default function GMBSetupPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const setupGMB = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/gmb/check-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    companyId: 'cmlaqdoqk0000ob8yey5qfdwg',
                    // For v4 API: accounts/{id}/locations/{id}/reviews
                    // Storing raw IDs - the API will build the full path
                    accountId: '11535144745965350294',
                    locationId: '11535144745965350294',
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
                <h1 className="text-2xl font-bold mb-4">GMB Setup Tool</h1>

                <div className="mb-6">
                    <p className="text-gray-600 mb-2">This will configure:</p>
                    <ul className="list-disc ml-6 text-sm text-gray-700">
                        <li>Company ID: cmlaqdoqk0000ob8yey5qfdwg</li>
                        <li>Account ID: accounts/11535144745965350294</li>
                        <li>Location ID: locations/11535144745965350294</li>
                    </ul>
                </div>

                <button
                    onClick={setupGMB}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
                >
                    {loading ? 'Setting up...' : 'Configure GMB Now'}
                </button>

                {result && (
                    <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                        <p className="font-semibold mb-2">Result:</p>
                        <pre className="text-xs overflow-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}

                {result?.success && (
                    <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-lg">
                        <p className="text-green-800 font-semibold">✅ Success!</p>
                        <p className="text-green-700 text-sm mt-1">
                            Now go to <a href="/reviews" className="underline font-semibold">Reviews → Google tab</a> to see your reviews!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
