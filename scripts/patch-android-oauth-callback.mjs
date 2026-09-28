import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(
  process.cwd(),
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);

if (!fs.existsSync(manifestPath)) {
  throw new Error("AndroidManifest.xml was not found after npx cap add android.");
}

let manifest = fs.readFileSync(manifestPath, "utf8");

if (!manifest.includes('android:scheme="com.giapha.donghoviet"')) {
  const activityPattern = /(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>)/;
  if (!activityPattern.test(manifest)) {
    throw new Error("MainActivity entry not found in AndroidManifest.xml");
  }

  manifest = manifest.replace(
    activityPattern,
    `$1
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.giapha.donghoviet" android:host="auth-callback" />
            </intent-filter>`,
  );

  fs.writeFileSync(manifestPath, manifest);
  console.log("Added native OAuth callback intent filter:", manifestPath);
} else {
  console.log("Native OAuth callback intent filter already present.");
}

console.log("Android 16 build configured for Supabase browser OAuth callback; Credential Manager SocialLogin patch is not applied.");
