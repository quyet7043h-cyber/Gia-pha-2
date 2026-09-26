import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.giapha.donghoviet",
  appName: "Gia Phả Dòng Họ Việt",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    backgroundColor: "#FBF7F0",
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
