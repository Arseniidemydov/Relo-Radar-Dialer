import React, { useState } from 'react';
import axios from 'axios';

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

interface NotionSyncModalProps {
    onSync: (leads: Lead[]) => void;
    serverUrl: string;
}

export const NotionSyncModal: React.FC<NotionSyncModalProps> = ({ onSync, serverUrl }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSync = async () => {
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await axios.post(`${serverUrl}/leads/sync-notion`);

            const { leads, addedCount, message } = response.data;

            setSuccess(message || `Synced ${addedCount} leads from Notion!`);
            onSync(leads);

            // Clear success message after a few seconds
            setTimeout(() => {
                setSuccess(null);
            }, 3000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to sync from Notion';
            setError(errorMessage);

            // Clear error after a few seconds
            setTimeout(() => {
                setError(null);
            }, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleSync}
                disabled={isLoading}
                className={`
                    px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 
                    border border-white/10 backdrop-blur-md flex items-center gap-2 text-sm font-semibold 
                    shadow-lg shadow-black/20 group
                    ${isLoading ? 'opacity-70 cursor-wait' : ''}
                `}
            >
                <span className={`text-lg leading-none transition-transform ${isLoading ? 'animate-spin' : 'group-hover:rotate-12'}`}>
                    {isLoading ? '⏳' : '🔄'}
                </span>
                <span>{isLoading ? 'Syncing...' : 'Sync with Notion'}</span>
            </button>

            {/* Success/Error Toast */}
            {(success || error) && (
                <div className={`
                    absolute top-full left-0 right-0 mt-2 p-2 rounded-lg text-xs font-medium z-50
                    ${success ? 'bg-green-900/90 text-green-200 border border-green-700' : ''}
                    ${error ? 'bg-red-900/90 text-red-200 border border-red-700' : ''}
                `}>
                    {success && <span>✅ {success}</span>}
                    {error && <span>❌ {error}</span>}
                </div>
            )}
        </div>
    );
};
