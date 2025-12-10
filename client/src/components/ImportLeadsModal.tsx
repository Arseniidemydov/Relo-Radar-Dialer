import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
    status?: string;
}

interface ImportLeadsModalProps {
    onImport: (leads: Lead[]) => void;
}

export const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ onImport }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleModal = () => {
        setIsOpen(!isOpen);
        setError(null);
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        setError(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedLeads: Lead[] = [];
                let skippedCount = 0;

                results.data.forEach((row: any) => {
                    // Match requirements: 
                    // 1. Must have Phone number
                    // 2. status must be 'Not contacted' (making it case-insensitive for better UX)

                    const status = row['status'] || row['Status'];
                    const phone = row['Phone number'] || row['phone number'] || row['Phone'];
                    const name = row['Name'] || row['name'];
                    const notes = row['notes'] || row['Notes'];

                    if (!phone) {
                        skippedCount++;
                        return;
                    }

                    if (status && status.toLowerCase() === 'not contacted') {
                        parsedLeads.push({
                            id: crypto.randomUUID(),
                            name: name || 'Unknown',
                            phone: phone,
                            notes: notes || '',
                            status: status
                        });
                    } else {
                        skippedCount++;
                    }
                });

                if (parsedLeads.length === 0) {
                    setError(`No valid leads found. 0 leads imported (${skippedCount} ignored). check your CSV for 'Phone number' and 'status: Not contacted'.`);
                } else {
                    onImport(parsedLeads);
                    toggleModal();
                    // Optionally show success message elsewhere or just close
                }
                setIsProcessing(false);
            },
            error: (err) => {
                setError(`Failed to parse CSV: ${err.message}`);
                setIsProcessing(false);
            }
        });
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            processFile(files[0]);
        } else if (files.length > 0) {
            setError('Please upload a valid CSV file.');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <>
            <button
                onClick={toggleModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
                📥 Import CSV
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-lg font-bold text-white">Import Leads from CSV</h3>
                            <button onClick={toggleModal} className="text-gray-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`
                                    border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                                    flex flex-col items-center justify-center min-h-[200px]
                                    ${isDragging
                                        ? 'border-teal-500 bg-teal-500/10 scale-[1.02]'
                                        : 'border-gray-600 hover:border-gray-500 bg-gray-900/30'
                                    }
                                `}
                            >
                                <span className="text-4xl mb-4">📄</span>
                                <p className="text-gray-300 mb-2 font-medium">
                                    {isDragging ? 'Drop it like it\'s hot!' : 'Drag & drop your CSV here'}
                                </p>
                                <p className="text-gray-500 text-sm mb-6">
                                    or click to select a file
                                </p>

                                <label className="relative cursor-pointer">
                                    <span className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-md transition-colors shadow-lg font-medium">
                                        Browse Files
                                    </span>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {isProcessing && (
                                <div className="mt-4 text-center text-teal-400 animate-pulse">
                                    Processing CSV...
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="mt-6 text-xs text-gray-500 bg-gray-900/50 p-3 rounded border border-gray-700/50">
                                <p className="font-semibold mb-1 uppercase tracking-wider text-gray-400">Requirements:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Format: <code className="bg-gray-800 px-1 rounded text-gray-300">.csv</code></li>
                                    <li>Columns: <code className="bg-gray-800 px-1 rounded text-gray-300">Name</code>, <code className="bg-gray-800 px-1 rounded text-gray-300">Phone number</code>, <code className="bg-gray-800 px-1 rounded text-gray-300">notes</code>, <code className="bg-gray-800 px-1 rounded text-gray-300">status</code></li>
                                    <li>Status must be: <code className="text-teal-400 font-mono">Not contacted</code></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
