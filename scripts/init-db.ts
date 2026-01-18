import { config } from 'dotenv';
import { initializeDatabase } from '../lib/db';

// Load environment variables
config({ path: '.env.local' });

async function main() {
  console.log('Initializing database schema...');
  console.log('Using database:', process.env.POSTGRES_URL?.split('@')[1]?.split('/')[0]);

  try {
    await initializeDatabase();
    console.log('✓ Database initialized successfully!');
    console.log('✓ Tables created: graffiti, analytics_events');
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
