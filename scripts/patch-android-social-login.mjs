import fs from "node:fs";
import path from "node:path";

const javaRoot = path.join(process.cwd(), "android", "app", "src", "main", "java");

function findMainActivity(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.isFile() && entry.name === "MainActivity.java") {
      return full;
    }
  }
  return null;
}

const file = findMainActivity(javaRoot);
if (!file) {
  throw new Error("MainActivity.java was not found after npx cap add android.");
}

let source = fs.readFileSync(file, "utf8");

const imports = [
  "import android.content.Intent;",
  "import android.util.Log;",
  "import com.getcapacitor.Plugin;",
  "import com.getcapacitor.PluginHandle;",
  "import ee.forgr.capacitor.social.login.GoogleProvider;",
  "import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;",
  "import ee.forgr.capacitor.social.login.SocialLoginPlugin;",
];

for (const line of imports) {
  if (!source.includes(line)) {
    source = source.replace(
      "import com.getcapacitor.BridgeActivity;",
      "import com.getcapacitor.BridgeActivity;\n" + line,
    );
  }
}

source = source.replace(
  "public class MainActivity extends BridgeActivity {",
  "public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {",
);

if (!source.includes("handleGoogleLoginIntent(requestCode, data)")) {
  const method = `
  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
        && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("Google Activity Result", "SocialLogin plugin handle is null");
        return;
      }

      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
        return;
      }

      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  @Override
  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
`;

  const lastBrace = source.lastIndexOf("}");
  source = source.slice(0, lastBrace) + method + source.slice(lastBrace);
}


// Backport native [16] Account reauth recovery from newer plugin releases.
// The previous Android 16 GetGoogleIdOption workaround is intentionally not used
// for the standard flow. We keep GetSignInWithGoogleOption and add the newer
// clear-Credential-Manager-state + one-time retry behavior.
const googleProvider = path.join(
  process.cwd(),
  "node_modules",
  "@capgo",
  "capacitor-social-login",
  "android",
  "src",
  "main",
  "java",
  "ee",
  "forgr",
  "capacitor",
  "social",
  "login",
  "GoogleProvider.java",
);

if (fs.existsSync(googleProvider)) {
  let googleSource = fs.readFileSync(googleProvider, "utf8");

  // Restore the plugin's original standard Google option if an older patch left
  // GetGoogleIdOption in the standard branch.
  googleSource = googleSource.replace(
    /GetGoogleIdOption\\.Builder googleIdOptionBuilder = new GetGoogleIdOption\\.Builder\\(\\)\\s*\\.setServerClientId\\(this\\.clientId\\)\\s*\\.setFilterByAuthorizedAccounts\\(false\\)\\s*\\.setAutoSelectEnabled\\(false\\);[\\s\\S]*?requestBuilder\\.addCredentialOption\\(googleIdOptionBuilder\\.build\\(\\)\\);/,
    `GetSignInWithGoogleOption.Builder googleIdOptionBuilder = new GetSignInWithGoogleOption.Builder(this.clientId);\n\n            if (!nonce.isEmpty()) {\n                googleIdOptionBuilder.setNonce(nonce);\n            }\n            if (this.hostedDomain != null && !this.hostedDomain.isEmpty()) {\n                googleIdOptionBuilder.setHostedDomainFilter(this.hostedDomain);\n            }\n\n            requestBuilder.addCredentialOption(googleIdOptionBuilder.build());`,
  );

  if (!googleSource.includes('private static final String REAUTH_RETRY_FLAG')) {
    googleSource = googleSource.replace(
      'private static final String TOKEN_REQUEST_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";',
      'private static final String TOKEN_REQUEST_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";\n    private static final String REAUTH_RETRY_FLAG = "_googleReauthRetry";',
    );
  }

  if (!googleSource.includes('private void clearCredentialManagerState(')) {
    const helper = `\n    private void clearCredentialManagerState(CredentialManagerCallback<Void, Exception> handler) {\n        ClearCredentialStateRequest request = new ClearCredentialStateRequest();\n        Executor executor = Executors.newSingleThreadExecutor();\n        credentialManager.clearCredentialStateAsync(\n            request,\n            null,\n            executor,\n            new CredentialManagerCallback<Void, ClearCredentialException>() {\n                @Override\n                public void onResult(Void result) { handler.onResult(null); }\n                @Override\n                public void onError(@NonNull ClearCredentialException e) { handler.onError(e); }\n            }\n        );\n    }\n`;
    googleSource = googleSource.replace(/\n    private void rawLogout\(/, helper + "\n    private void rawLogout(");
  }

  if (!googleSource.includes('private boolean isAccountReauthFailed(')) {
    const recovery = `\n    private boolean isAccountReauthFailed(String message) {\n        return message != null && message.contains("Account reauth failed");\n    }\n\n    private boolean isReauthRetry(PluginCall call) {\n        return call.getData().optBoolean(REAUTH_RETRY_FLAG, false);\n    }\n\n    private void markReauthRetry(PluginCall call) {\n        call.getData().put(REAUTH_RETRY_FLAG, true);\n    }\n\n    private void retryLoginAfterReauthFailure(PluginCall call, JSONObject config, JSONObject options) {\n        try {\n            options.put("style", "standard");\n            options.put("filterByAuthorizedAccounts", false);\n            call.getData().put("options", options);\n        } catch (JSONException ex) {\n            call.reject("Google Sign-In failed: " + ex.getMessage());\n            return;\n        }\n        login(call, config);\n    }\n\n    private void handleAccountReauthFailed(GetCredentialException e, PluginCall call, JSONObject config, JSONObject options) {\n        if (isReauthRetry(call)) {\n            call.reject("Google Sign-In failed: [16] Account reauth failed after retry: " + e.getMessage());\n            return;\n        }\n        markReauthRetry(call);\n        Log.w(LOG_TAG, "Account reauth failed; clearing Credential Manager state and retrying standard Google sign-in.");\n        clearCredentialManagerState(new CredentialManagerCallback<Void, Exception>() {\n            @Override\n            public void onResult(Void unused) { retryLoginAfterReauthFailure(call, config, options); }\n            @Override\n            public void onError(@NonNull Exception clearError) {\n                Log.w(LOG_TAG, "Credential Manager state clear failed; retrying sign-in anyway.", clearError);\n                retryLoginAfterReauthFailure(call, config, options);\n            }\n        });\n    }\n`;
    googleSource = googleSource.replace(/\n    private void handleSignInError\(/, recovery + "\n    private void handleSignInError(");
  }

  // Insert the [16] branch before the existing NoCredentialException handling.
  if (!googleSource.includes('handleAccountReauthFailed(e, call, config, options);')) {
    const needle = '        boolean isBottomUi = false;\n        JSONObject options = call.getObject("options", new JSObject());';
    const replacement = '        boolean isBottomUi = false;\n        JSONObject options = call.getObject("options", new JSObject());\n        if (isAccountReauthFailed(e.getMessage())) {\n            handleAccountReauthFailed(e, call, config, options);\n            return;\n        }';
    if (!googleSource.includes(needle)) throw new Error("handleSignInError insertion marker not found");
    googleSource = googleSource.replace(needle, replacement);
  }

  fs.writeFileSync(googleProvider, googleSource);
  console.log("Backported native Google [16] reauth retry:", googleProvider);
}

const socialLoginGradle = path.join(
  process.cwd(),
  "node_modules",
  "@capgo",
  "capacitor-social-login",
  "android",
  "build.gradle",
);

if (fs.existsSync(socialLoginGradle)) {
  let gradle = fs.readFileSync(socialLoginGradle, "utf8");

  // androidbrowserhelper 2.5.0 brings androidx.browser 1.4.0 as a strict
  // constraint. Exclude that transitive dependency so the plugin's
  // androidx.browser 1.9.0 requirement can resolve.
  const helperRegex =
    /(implementation|compileOnly)\s+(['"])com\.google\.androidbrowserhelper:androidbrowserhelper:2\.5\.0\2(?!\s*\{)/g;

  let patched = false;
  gradle = gradle.replace(helperRegex, (_, configuration, quote) => {
    patched = true;
    return `${configuration}(${quote}com.google.androidbrowserhelper:androidbrowserhelper:2.5.0${quote}) {
      exclude group: 'androidx.browser', module: 'browser'
    }`;
  });

  fs.writeFileSync(socialLoginGradle, gradle);
  console.log(
    patched
      ? "Patched androidbrowserhelper browser exclusion:"
      : "androidbrowserhelper dependency already patched or not present:",
    socialLoginGradle,
  );
}

fs.writeFileSync(file, source);
console.log("Configured native Google Sign-In:", file);
