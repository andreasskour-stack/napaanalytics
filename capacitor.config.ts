import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.napaanalytics.survivorgreece",
  appName: "Survivor Greece Stats",
  webDir: "out", // unused for live URL, but required
  server: {
    url: "https://napaanalytics.company/projects/survivor-stats", // <-- put your live URL here
    cleartext: false
  }
};

export default config;
