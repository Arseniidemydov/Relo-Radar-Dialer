import { Client } from '@notionhq/client';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

// Hardcoded Data Source ID (Verified via API)
const NOTION_DATA_SOURCE_ID = '2a2bcfce-678b-80f9-af55-000b0637bb50';

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
 * Fetch leads from the Notion database
 */
export async function fetchLeadsFromNotion(): Promise<Lead[]> {
    if (!process.env.NOTION_API_KEY) {
        throw new Error('NOTION_API_KEY is not set');
    }

    const notion = new Client({
        auth: process.env.NOTION_API_KEY,
    });

    const leads: Lead[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    console.log(`[NotionService] Fetching from Data Source: ${NOTION_DATA_SOURCE_ID}`);

    while (hasMore) {
        try {
            // v5 SDK uses dataSources.query
            // Explicit cast to 'any' because types are missing query on databases in this version
            const response: any = await (notion as any).dataSources.query({
                data_source_id: NOTION_DATA_SOURCE_ID,
                start_cursor: nextCursor,
                page_size: 100,
            });

            console.log(`[NotionService] Fetched page. Results: ${response.results?.length}`);

            for (const page of response.results) {
                if (page.object !== 'page' || !('properties' in page)) {
                    continue;
                }

                const properties = page.properties;

                const nameProperty = findProperty(properties, [
                    'Name', 'name', 'Full Name', 'Contact Name', 'Lead Name'
                ]);

                const phoneProperty = findProperty(properties, [
                    'Phone', 'phone', 'Phone Number', 'Phone number',
                    'Mobile', 'Cell', 'Telephone', 'Contact Number'
                ]);

                const name = extractPropertyValue(nameProperty);
                const phone = extractPropertyValue(phoneProperty);

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

        } catch (error: any) {
            console.error('[NotionService] Error calling databases.query:', error);

            // Debugging helper: Check if it's the "not a function" error
            if (error.message?.includes('not a function')) {
                console.error('[NotionService] Debug - Available keys on notion.databases:', Object.keys(notion.databases));
            }
            throw error;
        }
    }

    return leads;
}
