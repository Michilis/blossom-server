import fetch from 'cross-fetch';

let fs, path, fileURLToPath, __filename, __dirname, WHITELIST_FILE;

if (typeof window === 'undefined') {
  fs = await import('fs');
  path = await import('path');
  fileURLToPath = await import('url').then(mod => mod.fileURLToPath);

  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);

  WHITELIST_FILE = path.resolve(__dirname, '../data/whitelist.json');
}

const WHITELIST_URL = 'https://relayapi.azzamo.net/.well-known/nostr.json';

interface WhitelistResponse {
  names: Record<string, string>;
}

export async function fetchAndCachePubkeys() {
  if (typeof window !== 'undefined') return false; // Prevent execution in the browser

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
  if (typeof window !== 'undefined') return false; // Prevent execution in the browser

  if (!fs.existsSync(WHITELIST_FILE)) return false;
  
  const pubkeys = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf-8'));
  return pubkeys.includes(pubkey);
}
