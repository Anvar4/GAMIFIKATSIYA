// Faqat ommaviy (public) sozlamalar. service_role kaliti frontendda HECH QACHON ishlatilmaydi.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  isConfigured: /^https?:\/\//.test(url) && anonKey.length > 20,
};
