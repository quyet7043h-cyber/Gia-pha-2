import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

let initialized = false;
let socialLogin: typeof import("@capgo/capacitor-social-login").SocialLogin | null = null;

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Thiếu VITE_GOOGLE_WEB_CLIENT_ID. Hãy thêm Google Web Client ID vào GitHub Actions Secrets.",
    );
  }

  const module = await import("@capgo/capacitor-social-login");
  socialLogin = module.SocialLogin;

  await socialLogin.initialize({
    google: {
      webClientId: clientId,
      mode: "online",
    },
  });

  initialized = true;
}

export function isNativeGoogleSignInAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function signInWithNativeGoogle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Native Google Sign-In chỉ dùng trong ứng dụng Android.");
  }

  await ensureInitialized();

  const rawNonce = createNonce();
  const nonceDigest = await sha256Hex(rawNonce);

  if (!socialLogin) {
    throw new Error("Google Sign-In chưa được khởi tạo.");
  }

  const response = await socialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      nonce: nonceDigest,
      filterByAuthorizedAccounts: false,
    },
  });

  // The plugin's TypeScript response is a union that also includes
  // offline mode, where idToken is not present. We explicitly narrow
  // the runtime result because this app initializes Google in online mode.
  const result = response.result as { idToken?: string };
  const idToken = result.idToken;

  if (!idToken) {
    throw new Error("Google không trả về ID token.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: rawNonce,
  });

  if (error) throw error;
}
