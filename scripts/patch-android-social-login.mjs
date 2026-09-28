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


// Backport the native [16] Account reauth recovery from newer plugin releases.
// Keep the normal standard Google flow (GetSignInWithGoogleOption), but when
// Credential Manager returns Account reauth failed, clear credential state and
// retry once with the standard account picker. This is the Android 16 failure
// mode we are targeting without changing the Capacitor/plugin major versions.
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

  const standardBlock = `GetSignInWithGoogleOption.Builder googleIdOptionBuilder = new GetSignInWithGoogleOption.Builder(this.clientId);

            if (!nonce.isEmpty()) {
                googleIdOptionBuilder.setNonce(nonce);
            }
            if (this.hostedDomain != null && !this.hostedDomain.isEmpty()) {
                googleIdOptionBuilder.setHostedDomainFilter(this.hostedDomain);
            }

            requestBuilder.addCredentialOption(googleIdOptionBuilder.build());`;

  const android16StandardBlock = `GetGoogleIdOption.Builder googleIdOptionBuilder = new GetGoogleIdOption.Builder()
                .setServerClientId(this.clientId)
                .setFilterByAuthorizedAccounts(false)
                .setAutoSelectEnabled(false);

            if (!nonce.isEmpty()) {
                googleIdOptionBuilder.setNonce(nonce);
            }
            if (this.hostedDomain != null && !this.hostedDomain.isEmpty()) {
                googleIdOptionBuilder.setHostedDomainFilter(this.hostedDomain);
            }

            requestBuilder.addCredentialOption(googleIdOptionBuilder.build());`;

  // Revert the previous workaround if it is present: the newer recovery
  // specifically retries the standard SignInWithGoogle flow after clearing state.
  if (googleSource.includes(android16StandardBlock)) {
    googleSource = googleSource.replace(android16StandardBlock, standardBlock);
  }

  const retryMarker = 'private static final String REAUTH_RETRY_FLAG = "_googleReauthRetry";';
  if (!googleSource.includes(retryMarker)) {
    googleSource = googleSource.replace(
      'private static final String TOKEN_REQUEST_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";',
      'private static final String TOKEN_REQUEST_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";\\n    ' + retryMarker,
    );
  }

  const clearHelper = `\n    private void clearCredentialManagerState(CredentialManagerCallback<Void, Exception> handler) {
        ClearCredentialStateRequest request = new ClearCredentialStateRequest();
        Executor executor = Executors.newSingleThreadExecutor();
        credentialManager.clearCredentialStateAsync(
            request,
            null,
            executor,
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) { handler.onResult(null); }
                @Override
                public void onError(@NonNull ClearCredentialException e) { handler.onError(e); }
            }
        );
    }
`;
  if (!googleSource.includes('private void clearCredentialManagerState(')) {
    googleSource = googleSource.replace('    private void rawLogout(', clearHelper + '\\n    private void rawLogout(');
  }

  const recovery = `\n    private boolean isAccountReauthFailed(String message) {
        return message != null && message.contains("Account reauth failed");
    }

    private boolean isReauthRetry(PluginCall call) {
        return call.getData().optBoolean(REAUTH_RETRY_FLAG, false);
    }

    private void markReauthRetry(PluginCall call) {
        call.getData().put(REAUTH_RETRY_FLAG, true);
    }

    private void retryLoginAfterReauthFailure(PluginCall call, JSONObject config, JSONObject options) {
        try {
            options.put("style", "standard");
            options.put("filterByAuthorizedAccounts", false);
            call.getData().put("options", options);
        } catch (JSONException ex) {
            call.reject("Google Sign-In failed: " + ex.getMessage());
            return;
        }
        login(call, config);
    }

    private void handleAccountReauthFailed(GetCredentialException e, PluginCall call, JSONObject config, JSONObject options) {
        String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        if (isReauthRetry(call)) {
            call.reject("Google Sign-In failed: [16] Account reauth failed after clearing Credential Manager state and retrying. " + errorMessage);
            return;
        }
        Log.w(LOG_TAG, "Account reauth failed; clearing Credential Manager state and retrying standard Google sign-in.");
        markReauthRetry(call);
        clearCredentialManagerState(new CredentialManagerCallback<Void, Exception>() {
            @Override
            public void onResult(Void unused) {
                retryLoginAfterReauthFailure(call, config, options);
            }
            @Override
            public void onError(@NonNull Exception clearError) {
                Log.w(LOG_TAG, "Could not clear Credential Manager state; retrying sign-in anyway.", clearError);
                retryLoginAfterReauthFailure(call, config, options);
            }
        });
    }
`;
  if (!googleSource.includes('private boolean isAccountReauthFailed(')) {
    googleSource = googleSource.replace('    private void handleSignInError(', recovery + '\\n    private void handleSignInError(');
  }

  const errorNeedle='    private void handleSignInError(GetCredentialException e, PluginCall call, JSONObject config) {\\n        Log.e(LOG_TAG, "Google Sign-In failed", e);';
  const errorReplacement='    private void handleSignInError(GetCredentialException e, PluginCall call, JSONObject config) {\\n        String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();\\n        Log.e(LOG_TAG, "Google Sign-In failed", e);\\n        JSONObject optionsForReauth = call.getObject("options", new JSObject());\\n        if (isAccountReauthFailed(errorMessage)) {\\n            handleAccountReauthFailed(e, call, config, optionsForReauth);\\n            return;\\n        }';
  if (!googleSource.includes('handleAccountReauthFailed(e, call, config, optionsForReauth);')) {
    if (!googleSource.includes(errorNeedle)) throw new Error('handleSignInError marker not found');
    googleSource = googleSource.replace(errorNeedle,errorReplacement);
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
