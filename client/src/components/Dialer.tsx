
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTwilioVoice } from '../hooks/useTwilioVoice';

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const Dialer: React.FC = () => {
    const { deviceState, callState, makeCall, hangup, error: voiceError } = useTwilioVoice({
        tokenEndpoint: `${SERVER_URL}/twilio/token`
    });

    const [leads, setLeads] = useState<Lead[]>([]);
    const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [dropStatus, setDropStatus] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const { data } = await axios.get(`${SERVER_URL}/leads`);
                setLeads(data);
            } catch (err) {
                console.error("Failed to load leads", err);
            }
        };
        fetchLeads();
    }, []);

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

    if (!currentLead) return <div className="p-8 text-white">Loading leads...</div>;

    return (
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-teal-400">Power Dialer</h2>
                    <div className={`px-2 py-1 rounded text-xs font-mono ${deviceState === 'ready' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {deviceState.toUpperCase()}
                    </div>
                </div>

                <div className="bg-gray-900 p-4 rounded-lg mb-6 border border-gray-700">
                    <h3 className="text-2xl font-semibold text-white mb-1">{currentLead.name}</h3>
                    <p className="text-gray-400 text-lg mb-2">{currentLead.phone}</p>
                    <div className="h-px bg-gray-700 my-3"></div>
                    <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-gray-300">{currentLead.notes}</p>
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
                        disabled={callState !== 'idle'}
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
