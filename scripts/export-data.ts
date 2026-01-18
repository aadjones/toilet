import { sql } from '@vercel/postgres';
import { writeFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function exportData() {
  try {
    console.log('Exporting graffiti...');
    const graffiti = await sql`SELECT * FROM graffiti ORDER BY created_at`;

    console.log('Exporting analytics events...');
    const analytics = await sql`SELECT * FROM analytics_events ORDER BY created_at`;

    const data = {
      graffiti: graffiti.rows,
      analytics_events: analytics.rows,
      exported_at: new Date().toISOString(),
    };

    writeFileSync('data-export.json', JSON.stringify(data, null, 2));

    console.log(`✓ Exported ${graffiti.rows.length} graffiti items`);
    console.log(`✓ Exported ${analytics.rows.length} analytics events`);
    console.log('✓ Data saved to data-export.json');

    process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

exportData();
