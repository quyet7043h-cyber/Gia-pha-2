import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

const NATIVE_GOOGLE_REDIRECT = "com.giapha.donghoviet://auth-callback";

export function isNativeGoogleSignInAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Android 16 workaround:
 * use Supabase's browser OAuth flow instead of Credential Manager.
 * Android 16 Credential Manager can fail with [16] Account reauth failed
 * immediately after account selection even when OAuth clients are correct.
 */
export async function signInWithNativeGoogle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Native Google Sign-In chỉ dùng trong ứng dụng Android.");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_GOOGLE_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw new Error(`Google OAuth không thể khởi động: ${error.message}`);
  }

  if (!data?.url) {
    throw new Error("Google OAuth không trả về URL đăng nhập.");
  }

  window.location.href = data.url;
}
