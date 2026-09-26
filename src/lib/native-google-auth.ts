import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

import { supabase } from "@/lib/supabase";

let initialized = false;

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

  await SocialLogin.initialize({
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

  const response = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      nonce: nonceDigest,
      filterByAuthorizedAccounts: false,
    },
  });

  const idToken = response.result?.idToken;
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
