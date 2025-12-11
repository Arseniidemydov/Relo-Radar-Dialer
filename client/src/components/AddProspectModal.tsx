
import React, { useState } from 'react';

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
    status?: string;
}

interface AddProspectModalProps {
    onAdd: (lead: Lead) => void;
}

export const AddProspectModal: React.FC<AddProspectModalProps> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState<string | null>(null);

    const toggleModal = () => {
        setIsOpen(!isOpen);
        setError(null);
        if (!isOpen) {
            // Reset fields when opening
            setName('');
            setPhone('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !phone.trim()) {
            setError('Both Name and Phone are required.');
            return;
        }

        const newLead: Lead = {
            id: crypto.randomUUID(),
            name: name.trim(),
            phone: phone.trim(),
            notes: 'Manually added',
            status: 'Not contacted'
        };

        onAdd(newLead);
        toggleModal();
    };

    return (
        <>
            <button
                onClick={toggleModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-lg shadow-indigo-900/20"
            >
                <span className="text-lg leading-none">+</span> Add Prospect
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-lg font-bold text-white">Add New Prospect</h3>
                            <button onClick={toggleModal} className="text-gray-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1234567890"
                                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +1)</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={toggleModal}
                                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg"
                                >
                                    Add Prospect
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
