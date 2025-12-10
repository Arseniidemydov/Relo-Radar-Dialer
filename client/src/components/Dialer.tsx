
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
                leadId: currentLead.id
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
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700 relative">
            {/* Header Actions */}
            <div className="absolute top-4 right-4 z-10">
                <ImportLeadsModal onImport={handleImportLeads} />
            </div>

            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-teal-400">Power Dialer</h2>
                    {/* Moved Import Button to absolute top right for cleaner layout or just keep it here? 
                         Let's keep the device state here and import button maybe elsewhere or next to it.
                         Actually, let's put it in the top right absolute position to save space in the header row.
                     */}
                    <div className={`px-2 py-1 rounded text-xs font-mono select-none ${deviceState === 'ready' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {deviceState.toUpperCase()}
                    </div>
                </div>

                <div className="bg-gray-900 p-4 rounded-lg mb-6 border border-gray-700 relative group">
                    <h3 className="text-2xl font-semibold text-white mb-1">{currentLead.name}</h3>
                    <p className="text-gray-400 text-lg mb-2">{currentLead.phone}</p>
                    <div className="h-px bg-gray-700 my-3"></div>
                    <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-gray-300 max-h-32 overflow-y-auto">{currentLead.notes}</p>

                    <div className="absolute top-2 right-2 text-xs text-gray-600 font-mono">
                        {currentLeadIndex + 1} / {leads.length}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Call Controls */}
                    {callState === 'idle' ? (
                        <button
                            onClick={() => makeCall(currentLead.id, currentLead.phone)}
                            disabled={deviceState !== 'ready'}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            <span className="text-xl">📞</span> Call Lead
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={hangup}
                                className="py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
                            >
                                Hang Up
                            </button>
                            <button
                                onClick={handleDropVoicemail}
                                disabled={loading}
                                className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Drop Voicemail 🤖'}
                            </button>
                        </div>
                    )}

                    {/* Navigation */}
                    <button
                        onClick={handleNextLead}
                        disabled={callState !== 'idle' || currentLeadIndex >= leads.length - 1}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors mt-2 disabled:opacity-50"
                    >
                        Next Lead →
                    </button>
                </div>

                {/* Status Messages */}
                <div className="mt-6 text-center h-6">
                    {voiceError && <p className="text-red-400 text-sm">{voiceError}</p>}
                    {dropStatus && <p className="text-indigo-400 font-medium animate-pulse">{dropStatus}</p>}
                    {!dropStatus && !voiceError && callState !== 'idle' && (
                        <p className="text-emerald-400 font-mono text-sm animate-pulse">
                            Status: {callState.toUpperCase()}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
