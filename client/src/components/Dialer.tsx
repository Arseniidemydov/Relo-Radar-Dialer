
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTwilioVoice } from '../hooks/useTwilioVoice';

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL;

    if (!url) {
        if (import.meta.env.MODE === 'production') {
            // Fallback for Render if VITE_API_URL isn't set
            url = 'https://dialer-server.onrender.com';
        } else {
            url = 'http://localhost:3001';
        }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }
    // Remove trailing slash if present for consistency
    return url.replace(/\/$/, '');
};

const SERVER_URL = getApiUrl();

import { ImportLeadsModal } from './ImportLeadsModal';

export const Dialer: React.FC = () => {
    const { deviceState, callState, makeCall, hangup, error: voiceError } = useTwilioVoice({
        tokenEndpoint: `${SERVER_URL}/twilio/token`
    });

    const [leads, setLeads] = useState<Lead[]>([]);
    const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isLoadingLeads, setIsLoadingLeads] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [dropStatus, setDropStatus] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Initial fetch from server (keep this for default behavior)
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isLoadingLeads) {
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isLoadingLeads]);

    useEffect(() => {
        const fetchLeads = async () => {
            console.log('Fetching leads from:', SERVER_URL);
            setIsLoadingLeads(true);
            setFetchError(null);
            try {
                const { data } = await axios.get(`${SERVER_URL}/leads`, {
                    timeout: 90000 // 90 second timeout for cold starts
                });
                console.log('Leads fetched:', data);
                setLeads(data);
            } catch (err: any) {
                console.error("Failed to load leads", err);
                const errorMessage = err.message || "Failed to load leads";
                const detailedError = err.code === 'ECONNABORTED'
                    ? "Connection timed out. Server might be waking up (cold start)."
                    : errorMessage;
                // Only set error if we don't have leads. If user imports csv, we might not care about initial fetch failure as much.
                // But for now, let's show it.
                setFetchError(detailedError);
            } finally {
                setIsLoadingLeads(false);
            }
        };
        fetchLeads();
    }, []);

    const handleImportLeads = (importedLeads: Lead[]) => {
        setLeads(importedLeads);
        setCurrentLeadIndex(0); // Reset to start
        setDropStatus(null);
        setFetchError(null); // Clear any previous fetch errors since we validly loaded manual leads
        setIsLoadingLeads(false); // Ensure loading state is off
        console.log('Imported new leads:', importedLeads);
    };

    const currentLead = leads[currentLeadIndex];

    const handleNextLead = () => {
        if (currentLeadIndex < leads.length - 1) {
            setCurrentLeadIndex(prev => prev + 1);
            setDropStatus(null);
        }
    };

    const handleDropVoicemail = async () => {
        if (!currentLead) return;
        setLoading(true);
        setDropStatus('Dropping voicemail...');
        try {
            await axios.post(`${SERVER_URL}/leads/drop-voicemail`, {
                leadId: currentLead.id,
                leadName: currentLead.name
            });
            setDropStatus('Voicemail Dropped!');
            // Optionally hangup the agent leg locally if desired, 
            // or let the backend/Twilio handle logic.
            // Usually, dropping VM means the agent is done.
            hangup();
        } catch (err) {
            console.error(err);
            setDropStatus('Failed to drop voicemail');
        } finally {
            setLoading(false);
        }
    };

    // If strictly loading initial leads AND we have no leads yet, show loader.
    // But if we want to allow import even during loading or error, we might want to render the main UI shell sooner.
    // For now, let's keep the simple "Loading" screen but maybe add a "Cancel/Import" button? 
    // Actually, to keep it simple as per request, let's just render the 'Loading' state as is, 
    // but if we want to allow import *after* loading or *instead* of loading, we should probably allow the UI to render.

    // Modification: If loading leads, we still show the spinner. 
    // If fetchError, we show error but maybe we should allow import there too?
    // Let's create a "Shell" or just leave it. The user flow is: Open app -> Loads (or fails) -> Then can import.

    if (isLoadingLeads) return (
        <div className="p-8 text-white flex flex-col items-center justify-center min-h-[200px]">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg">Loading leads...</p>
            <p className="text-sm text-gray-400 mt-2">Target: {SERVER_URL}</p>
            <p className="text-xs text-gray-500 mt-1">Time elapsed: {elapsedTime}s</p>
            {elapsedTime > 5 && (
                <p className="text-xs text-yellow-500 mt-2 animate-pulse">Server might be waking up...</p>
            )}
        </div>
    );

    if (fetchError) return (
        <div className="p-8 text-red-400 flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">Error Loading Leads</h2>
            <p className="mb-4">{fetchError}</p>
            <p className="text-sm text-gray-400 mb-6">Trying to connect to: {SERVER_URL}</p>

            {/* Allow importing even if fetch failed */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex flex-col items-center">
                <p className="text-gray-300 mb-3 text-sm">You can still import leads manually CSV:</p>
                <ImportLeadsModal onImport={handleImportLeads} />
            </div>
        </div>
    );

    if (!currentLead && leads.length === 0) return (
        <div className="p-8 text-white flex flex-col items-center">
            <p className="mb-4 text-xl">No leads found.</p>
            <ImportLeadsModal onImport={handleImportLeads} />
        </div>
    );

    return (
        <div className="bg-transparent rounded-3xl border border-white/20 p-1 relative overflow-hidden backdrop-blur-sm">
            {/* Header Actions - Absolute positioned import */}
            <div className="absolute top-6 right-6 z-10">
                <ImportLeadsModal onImport={handleImportLeads} />
            </div>

            <div className="p-8 space-y-8">
                {/* Lead Info Section - Single Card Vertical Layout */}
                <div className="bg-[#0A1025] border border-white/10 rounded-2xl p-6 text-center space-y-4">
                    <div>
                        <h3 className="text-white font-bold text-2xl leading-tight">{currentLead.name}</h3>
                        <p className="text-gray-400 font-mono text-lg mt-1">{currentLead.phone}</p>
                    </div>

                    <div className="w-full h-px bg-white/5"></div>

                    <div className="text-left">
                        <p className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-2">Notes</p>
                        <p className="text-gray-300 text-sm leading-relaxed max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {currentLead.notes}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 pt-2">
                    {/* Main Action Button */}
                    {callState === 'idle' ? (
                        <button
                            onClick={() => makeCall(currentLead.id, currentLead.phone)}
                            disabled={deviceState !== 'ready'}
                            className="group w-full py-4 px-6 bg-[#3B82F6] hover:bg-[#2563EB] active:bg-[#1D4ED8] text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center justify-center gap-3"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">📞</span>
                            <span className="font-bold text-lg">Start a call</span>
                        </button>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={hangup}
                                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-colors shadow-lg shadow-red-900/20"
                            >
                                End Call
                            </button>
                            <button
                                onClick={handleDropVoicemail}
                                disabled={loading}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                            >
                                {loading ? 'Processing...' : (
                                    <>
                                        <span>🤖</span> Drop Voicemail
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Navigation */}
                    <button
                        onClick={handleNextLead}
                        disabled={callState !== 'idle' || currentLeadIndex >= leads.length - 1}
                        className="w-full py-4 bg-[#1F2937] hover:bg-[#374151] text-gray-200 font-semibold text-lg rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next Lead
                        <span className="text-gray-500">→</span>
                    </button>

                    <div className="text-center">
                        <span className="text-xs font-mono text-gray-600">
                            {currentLeadIndex + 1} / {leads.length} Leads
                        </span>
                    </div>
                </div>

                {/* Status Footer */}
                <div className="absolute bottom-2 left-0 w-full text-center pointer-events-none">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5 text-xs font-semibold">
                        {voiceError ? (
                            <span className="text-red-400">{voiceError}</span>
                        ) : dropStatus ? (
                            <span className="text-indigo-400 animate-pulse">{dropStatus}</span>
                        ) : (
                            <>
                                <span className={`w-2 h-2 rounded-full ${deviceState === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                <span className={deviceState === 'ready' ? 'text-gray-300' : 'text-red-300'}>
                                    {callState !== 'idle' ? `Status: ${callState.toUpperCase()}` : `Device: ${deviceState.toUpperCase()}`}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

