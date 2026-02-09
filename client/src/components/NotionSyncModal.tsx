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
    const [isOpen, setIsOpen] = useState(false);
    const [databaseId, setDatabaseId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const toggleModal = () => {
        setIsOpen(!isOpen);
        setError(null);
        setSuccess(null);
    };

    const handleSync = async () => {
        if (!databaseId.trim()) {
            setError('Please enter a Notion Database ID');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await axios.post(`${serverUrl}/leads/sync-notion`, {
                databaseId: databaseId.trim()
            });

            const { leads, addedCount, message } = response.data;

            setSuccess(message || `Synced ${addedCount} leads from Notion!`);
            onSync(leads);

            // Close modal after short delay to show success
            setTimeout(() => {
                toggleModal();
            }, 1500);
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to sync from Notion';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Extract database ID from Notion URL if pasted
    const handleDatabaseIdChange = (value: string) => {
        // Check if it's a Notion URL
        const urlMatch = value.match(/notion\.so\/.*?([a-f0-9]{32})/i);
        if (urlMatch) {
            setDatabaseId(urlMatch[1]);
        } else {
            // Also handle dash-formatted IDs by removing dashes
            setDatabaseId(value.replace(/-/g, ''));
        }
    };

    return (
        <>
            <button
                onClick={toggleModal}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 border border-white/10 backdrop-blur-md flex items-center gap-2 text-sm font-semibold shadow-lg shadow-black/20 group"
            >
                <span className="text-lg leading-none group-hover:rotate-12 transition-transform">🔄</span>
                <span>Sync with Notion</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span>📚</span> Sync from Notion
                            </h3>
                            <button onClick={toggleModal} className="text-gray-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-gray-300 text-sm font-medium mb-2">
                                    Notion Database ID
                                </label>
                                <input
                                    type="text"
                                    value={databaseId}
                                    onChange={(e) => handleDatabaseIdChange(e.target.value)}
                                    placeholder="Paste database ID or Notion URL..."
                                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                                />
                            </div>

                            <div className="mb-6 text-xs text-gray-500 bg-gray-900/50 p-3 rounded border border-gray-700/50">
                                <p className="font-semibold mb-2 uppercase tracking-wider text-gray-400">How to find your Database ID:</p>
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Open your Notion database in full page view</li>
                                    <li>Copy the URL from your browser</li>
                                    <li>Paste it here - we'll extract the ID automatically</li>
                                </ol>
                                <p className="mt-2 text-teal-400 text-xs">
                                    💡 Make sure your database is shared with your Notion integration!
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-200 text-sm flex items-center gap-2">
                                    <span>✅</span> {success}
                                </div>
                            )}

                            <button
                                onClick={handleSync}
                                disabled={isLoading || !databaseId.trim()}
                                className={`
                                    w-full py-3 rounded-lg font-semibold transition-all duration-200
                                    ${isLoading || !databaseId.trim()
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg'
                                    }
                                `}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin">⏳</span>
                                        Syncing...
                                    </span>
                                ) : (
                                    'Sync Leads'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
