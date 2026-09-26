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

  // androidbrowserhelper 2.5.0 declares androidx.browser 1.4.0,
  // while this plugin requires 1.9.0. Force the newer compatible
  // browser version for every plugin configuration so Gradle's
  // consistent-resolution constraint cannot select 1.4.0.
  const resolutionStrategyBlock = `
configurations.configureEach {
    resolutionStrategy.force "androidx.browser:browser:1.9.0"
}
`;

  if (!gradle.includes('resolutionStrategy.force "androidx.browser:browser:1.9.0"')) {
    gradle = resolutionStrategyBlock + gradle;
    console.log("Patched Android browser resolution strategy:", socialLoginGradle);
  }
  const oldDependency = "implementation('com.google.androidbrowserhelper:androidbrowserhelper:2.5.0') {";
  const newDependency = `implementation('com.google.androidbrowserhelper:androidbrowserhelper:2.5.0') {
            exclude group: 'androidx.browser', module: 'browser'`;
  if (gradle.includes(oldDependency) && !gradle.includes("exclude group: 'androidx.browser', module: 'browser'")) {
    gradle = gradle.replace(oldDependency, newDependency);
    fs.writeFileSync(socialLoginGradle, gradle);
    console.log("Patched Android browser dependency conflict:", socialLoginGradle);
  }
}

fs.writeFileSync(file, source);
console.log("Configured native Google Sign-In:", file);
