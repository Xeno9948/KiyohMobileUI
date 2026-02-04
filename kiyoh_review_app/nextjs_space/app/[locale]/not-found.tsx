'use client';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
                <h1 className="text-6xl font-bold">404</h1>
                <p className="mt-3 text-2xl">Page not found</p>
                <a href="/" className="mt-6 text-blue-600 hover:text-blue-800">
                    Go back home
                </a>
            </main>
        </div>
    );
}
