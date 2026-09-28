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

function maskClientId(clientId: string): string {
  if (clientId.length < 16) return "***";
  return `${clientId.slice(0, 12)}…${clientId.slice(-8)}`;
}

function diagnosticContext(clientId: string) {
  return {
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
    packageId: "com.giapha.donghoviet",
    webClientId: maskClientId(clientId),
    userAgent: navigator.userAgent,
  };
}

function makeDiagnosticError(stage: string, error: unknown, context?: Record<string, unknown>): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  console.error("[NativeGoogleAuth]", {
    stage,
    code,
    name,
    message,
    ...context,
  });

  return new Error(
    [
      `Google Sign-In lỗi ở bước: ${stage}`,
      code ? `code=${code}` : "",
      name ? `name=${name}` : "",
      message ? `message=${message}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );
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

  try {
    await socialLogin.initialize({
      google: {
        webClientId: clientId,
        mode: "online",
      },
    });
  } catch (error) {
    throw makeDiagnosticError("initialize", error, diagnosticContext(clientId));
  }

  initialized = true;
}

export function isNativeGoogleSignInAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function signInWithNativeGoogle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Native Google Sign-In chỉ dùng trong ứng dụng Android.");
  }

  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Thiếu VITE_GOOGLE_WEB_CLIENT_ID. Hãy thêm Google Web Client ID vào GitHub Actions Secrets.",
    );
  }

  await ensureInitialized();

  const rawNonce = createNonce();
  const nonceDigest = await sha256Hex(rawNonce);

  if (!socialLogin) {
    throw new Error("Google Sign-In chưa được khởi tạo.");
  }

  let response: Awaited<ReturnType<typeof socialLogin.login>>;
  const loginOptions = {
    provider: "google" as const,
    options: {
      scopes: ["email", "profile"],
      nonce: nonceDigest,
      // Always show the normal account chooser. This avoids silently
      // selecting a stale Credential Manager account on Android 16.
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
      style: "standard" as const,
    },
  };

  try {
    response = await socialLogin.login(loginOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    // Android Credential Manager can return [16] when a cached Google
    // account needs re-authentication. Clear the native Google credential
    // state and retry once with the standard account chooser.
    if (code === "16" || /\[16\]\s*Account reauth failed/i.test(message)) {
      try {
        await socialLogin.logout({ provider: "google" });
      } catch (clearError) {
        console.warn("[NativeGoogleAuth] Could not clear Google credential state before retry", clearError);
      }

      try {
        response = await socialLogin.login(loginOptions);
      } catch (retryError) {
        throw makeDiagnosticError("credential-manager-login-retry", retryError, {
          ...diagnosticContext(clientId),
          nonce: "sha256(rawNonce)",
        });
      }
    } else {
      throw makeDiagnosticError("credential-manager-login", error, {
        ...diagnosticContext(clientId),
        nonce: "sha256(rawNonce)",
      });
    }
  }

  const result = response.result as { idToken?: string };
  const idToken = result.idToken;

  if (!idToken) {
    throw makeDiagnosticError(
      "id-token",
      new Error("Google không trả về ID token."),
      {
        ...diagnosticContext(clientId),
        resultType: typeof response.result,
      },
    );
  }

  try {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      nonce: rawNonce,
    });

    if (error) {
      throw makeDiagnosticError(
        "supabase-sign-in-with-id-token",
        error,
        diagnosticContext(clientId),
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Google Sign-In lỗi ở bước:")
    ) {
      throw error;
    }

    throw makeDiagnosticError(
      "supabase-sign-in-with-id-token",
      error,
      diagnosticContext(clientId),
    );
  }
}
