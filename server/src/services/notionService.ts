import { Client } from '@notionhq/client';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

// Hardcoded data source ID (from URL's v= parameter)
// Database URL: https://www.notion.so/hypelab/2a2bcfce678b80af9eefd39c96828b83?v=2a2bcfce678b8030b2c2000cb7bdf50b
const NOTION_DATA_SOURCE_ID = '2a2bcfce678b8030b2c2000cb7bdf50b';

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
 * Uses the v5 SDK dataSources.query method
 */
export async function fetchLeadsFromNotion(): Promise<Lead[]> {
    const notion = new Client({
        auth: process.env.NOTION_API_KEY,
    });

    const leads: Lead[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
        // v5 SDK uses dataSources.query with data_source_id
        const response: any = await (notion as any).dataSources.query({
            data_source_id: NOTION_DATA_SOURCE_ID,
            start_cursor: nextCursor,
            page_size: 100,
        });

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
    }

    return leads;
}
