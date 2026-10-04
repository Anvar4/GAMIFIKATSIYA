// Server/tarmoq xatolarini foydalanuvchiga tushunarli oʻzbekcha matnga aylantirish
export function errorMessage(err: unknown): string {
  if (!err) return 'Nomaʼlum xato yuz berdi';
  if (typeof err === 'string') return err;
  const e = err as { message?: string; code?: string; details?: string; hint?: string; status?: number };
  const msg = e.message ?? '';

  if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_NETWORK/i.test(msg)) {
    return 'Server bilan aloqa yoʻq. Internet aloqasini tekshiring.';
  }
  if (/Invalid login credentials/i.test(msg)) return 'Email yoki parol notoʻgʻri.';
  if (/Email not confirmed/i.test(msg)) return 'Email tasdiqlanmagan. Supabase panelida foydalanuvchini tasdiqlang.';
  if (/Anonymous sign-ins are disabled/i.test(msg)) {
    return 'Supabase loyihasida anonim kirish oʻchirilgan (Authentication → Sign In / Providers → Anonymous). Oʻqituvchiga xabar bering.';
  }
  if (e.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
    return 'Server funksiyasi topilmadi — maʼlumotlar bazasi migratsiyalari qoʻllanganini tekshiring.';
  }
  if (e.code === 'PGRST301' || /JWT expired/i.test(msg)) return 'Sessiya muddati tugadi. Sahifani yangilang.';
  if (/permission denied/i.test(msg)) return 'Bu amalga ruxsat yoʻq.';
  if (/duplicate key/i.test(msg)) return 'Bunday yozuv allaqachon mavjud.';
  if (msg.length > 0) return msg;
  return 'Nomaʼlum xato yuz berdi';
}

export function isNetworkError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  return /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg);
}
