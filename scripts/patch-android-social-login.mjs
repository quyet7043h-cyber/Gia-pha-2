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
  // constraint. Exclude that transitive dependency because the plugin also
  // requires the newer androidx.browser version.
  const helperPattern =
    /implementation\(\s*(['"])com\.google\.androidbrowserhelper:androidbrowserhelper:2\.5\.0\1\s*\)(?:\s*\{([\s\S]*?)\})?/;

  const helperMatch = gradle.match(helperPattern);
  if (
    helperMatch &&
    !/exclude\s+group:\s*['"]androidx\.browser['"],\s*module:\s*['"]browser['"]/.test(
      helperMatch[0],
    )
  ) {
    const replacement =
      `implementation(${helperMatch[1]}com.google.androidbrowserhelper:androidbrowserhelper:2.5.0${helperMatch[1]}) {
        exclude group: 'androidx.browser', module: 'browser'
      }`;
    gradle = gradle.replace(helperPattern, replacement);
    console.log("Patched androidbrowserhelper browser exclusion:", socialLoginGradle);
  }

  fs.writeFileSync(socialLoginGradle, gradle);
}

fs.writeFileSync(file, source);
console.log("Configured native Google Sign-In:", file);
