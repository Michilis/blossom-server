import fetch from 'cross-fetch';

if (typeof window === 'undefined') {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const WHITELIST_URL = 'https://relayapi.azzamo.net/.well-known/nostr.json';
  const WHITELIST_FILE = path.resolve(__dirname, '../data/whitelist.json');

  interface WhitelistResponse {
    names: Record<string, string>;
  }

  export async function fetchAndCachePubkeys() {
    try {
      const response = await fetch(WHITELIST_URL);
      if (!response.ok) throw new Error('Failed to fetch whitelist');
      
      const data = await response.json() as WhitelistResponse;
      const pubkeys = Object.values(data.names);
      
      const currentCache = fs.existsSync(WHITELIST_FILE) ? JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf-8')) : [];
      console.log('Whitelist cached successfully');
      if (JSON.stringify(currentCache) !== JSON.stringify(pubkeys)) {
        fs.writeFileSync(WHITELIST_FILE, JSON.stringify(pubkeys, null, 2));
        console.log('Pubkeys cache updated');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error fetching pubkeys:', error);
      return false;
    }
  }

  export function isPubkeyWhitelisted(pubkey: string): boolean {
    if (!fs.existsSync(WHITELIST_FILE)) return false;
    
    const pubkeys = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf-8'));
    return pubkeys.includes(pubkey);
  }
}
