const url = process.env.EXPO_PUBLIC_API_URL;

if (!url) {
  throw new Error('Missing EXPO_PUBLIC_API_URL');
}

export const env = {
  apiUrl: url.replace(/\/$/, ''),
};
