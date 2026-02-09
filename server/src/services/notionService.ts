import { Client } from '@notionhq/client';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

/**
 * Extract text from a Notion property
 */
function extractPropertyValue(property: any): string {
    if (!property) return '';

    switch (property.type) {
        case 'title':
            return property.title?.map((t: any) => t.plain_text).join('') || '';
        case 'rich_text':
            return property.rich_text?.map((t: any) => t.plain_text).join('') || '';
        case 'phone_number':
            return property.phone_number || '';
        case 'number':
            return property.number?.toString() || '';
        case 'email':
            return property.email || '';
        case 'url':
            return property.url || '';
        case 'select':
            return property.select?.name || '';
        case 'status':
            return property.status?.name || '';
        default:
            return '';
    }
}

/**
 * Find a property by checking multiple possible column names
 */
function findProperty(properties: Record<string, any>, possibleNames: string[]): any {
    for (const name of possibleNames) {
        // Check exact match (case-insensitive)
        const key = Object.keys(properties).find(
            k => k.toLowerCase() === name.toLowerCase()
        );
        if (key && properties[key]) {
            return properties[key];
        }
    }
    return null;
}

/**
 * Fetch leads from a Notion database
 * Handles pagination automatically
 */
export async function fetchLeadsFromNotion(databaseId: string): Promise<Lead[]> {
    // Initialize client inside function to ensure env vars are loaded
    const notion = new Client({
        auth: process.env.NOTION_API_KEY,
    });

    const leads: Lead[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
        // Use the client's query method with explicit type annotation
        const response: any = await (notion as any).databases.query({
            database_id: databaseId,
            start_cursor: nextCursor,
            page_size: 100,
        });

        for (const page of response.results) {
            // Only process full page objects
            if (page.object !== 'page' || !('properties' in page)) {
                continue;
            }

            const properties = page.properties;

            // Find name property (check multiple possible column names)
            const nameProperty = findProperty(properties, [
                'Name', 'name', 'Full Name', 'Contact Name', 'Lead Name'
            ]);

            // Find phone property (check multiple possible column names)
            const phoneProperty = findProperty(properties, [
                'Phone', 'phone', 'Phone Number', 'Phone number',
                'Mobile', 'Cell', 'Telephone', 'Contact Number'
            ]);

            const name = extractPropertyValue(nameProperty);
            const phone = extractPropertyValue(phoneProperty);

            // Skip entries without phone number
            if (!phone) {
                continue;
            }

            leads.push({
                id: page.id,
                name: name || 'Unknown',
                phone: phone,
                notes: `Synced from Notion`,
            });
        }

        hasMore = response.has_more;
        nextCursor = response.next_cursor || undefined;
    }

    return leads;
}
