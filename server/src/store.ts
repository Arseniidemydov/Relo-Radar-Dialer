
// Simple in-memory store for Lead <-> CallSid mapping
// In a real app, use Redis or a database

// Store active calls: LeadID -> CallSid
export const activeCalls = new Map<string, string>();

// Store pending voicemail drops: CallerID -> Lead Phone
// Used to link the outbound call leg to the inbound voiceflow leg
export const pendingVoicemails = new Map<string, string>();

interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

// Mock Leads
export const leads: Lead[] = [
    { id: '1', name: 'arsenii', phone: '+41762693103', notes: 'Primary contact' }
];
