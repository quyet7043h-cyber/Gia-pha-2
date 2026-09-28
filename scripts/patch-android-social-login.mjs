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


// Android 16 workaround: force the Google Credential Manager path that uses
// GetGoogleIdOption with explicit account filtering disabled. Some Android 16
// devices can return [16] Account reauth failed with GetSignInWithGoogleOption
// even after CredentialManager.clearCredentialState().
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
  if (!googleSource.includes("import com.google.android.libraries.identity.googleid.GetGoogleIdOption;")) {
    googleSource = googleSource.replace(
      "import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;",
      "import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;\nimport com.google.android.libraries.identity.googleid.GetGoogleIdOption;",
    );
  }
  const standardBlock = `GetSignInWithGoogleOption.Builder googleIdOptionBuilder = new GetSignInWithGoogleOption.Builder(this.clientId);

            if (!nonce.isEmpty()) {
                googleIdOptionBuilder.setNonce(nonce);
            }
            requestBuilder.addCredentialOption(googleIdOptionBuilder.build());`;
  const replacementBlock = `GetGoogleIdOption.Builder googleIdOptionBuilder = new GetGoogleIdOption.Builder()
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

  if (googleSource.includes(standardBlock)) {
    googleSource = googleSource.replace(standardBlock, replacementBlock);
    fs.writeFileSync(googleProvider, googleSource);
    console.log("Patched GoogleProvider standard UI for Android 16 reauth handling:", googleProvider);
  } else {
    console.log("GoogleProvider Android 16 patch already applied or source changed:", googleProvider);
  }
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
