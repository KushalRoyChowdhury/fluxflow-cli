#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/utils/paths.js
var paths_exports = {};
__export(paths_exports, {
  ACTIVE_TX_FILE: () => ACTIVE_TX_FILE,
  BACKUPS_DIR: () => BACKUPS_DIR,
  CONTEXT_FILE: () => CONTEXT_FILE,
  DATA_DIR: () => DATA_DIR,
  FLUXFLOW_DIR: () => FLUXFLOW_DIR,
  HISTORY_DIR: () => HISTORY_DIR,
  HISTORY_FILE: () => HISTORY_FILE,
  LEDGER_FILE: () => LEDGER_FILE,
  LOGS_DIR: () => LOGS_DIR,
  MEMORIES_FILE: () => MEMORIES_FILE,
  PARSER_DIR: () => PARSER_DIR,
  PATHS_FILE: () => PATHS_FILE,
  SECRET_DIR: () => SECRET_DIR,
  SETTINGS_FILE: () => SETTINGS_FILE,
  TEMP_MEM_CHAT_FILE: () => TEMP_MEM_CHAT_FILE,
  TEMP_MEM_FILE: () => TEMP_MEM_FILE,
  USAGE_FILE: () => USAGE_FILE
});
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
var FLUXFLOW_DIR, SETTINGS_FILE, externalDir, DATA_DIR, LOGS_DIR, SECRET_DIR, HISTORY_FILE, HISTORY_DIR, USAGE_FILE, MEMORIES_FILE, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, BACKUPS_DIR, LEDGER_FILE, ACTIVE_TX_FILE, PATHS_FILE, CONTEXT_FILE, PARSER_DIR;
var init_paths = __esm({
  "src/utils/paths.js"() {
    FLUXFLOW_DIR = path.join(os.homedir(), ".fluxflow");
    SETTINGS_FILE = path.join(FLUXFLOW_DIR, "settings.json");
    externalDir = null;
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileContent = fs.readFileSync(SETTINGS_FILE, "utf8").trim();
        let settings;
        if (fileContent.startsWith("{")) {
          settings = JSON.parse(fileContent);
        } else {
          const parts = fileContent.split(":");
          if (parts.length === 2) {
            const iv = Buffer.from(parts[0], "hex");
            const ciphertext = parts[1];
            const key = crypto.createHash("sha256").update("fluxflow-cli-sanctuary-key").digest();
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
            let decrypted = decipher.update(ciphertext, "hex", "utf8");
            decrypted += decipher.final("utf8");
            settings = JSON.parse(decrypted);
          }
        }
        if (settings) {
          const sys = settings.systemSettings || {};
          if (sys.useExternalData && sys.externalDataPath) {
            externalDir = sys.externalDataPath;
          }
        }
      }
    } catch (e) {
    }
    DATA_DIR = externalDir || FLUXFLOW_DIR;
    LOGS_DIR = path.join(DATA_DIR, "logs");
    SECRET_DIR = path.join(DATA_DIR, "secret");
    HISTORY_FILE = path.join(SECRET_DIR, "history.json");
    HISTORY_DIR = path.join(SECRET_DIR, "history");
    USAGE_FILE = path.join(FLUXFLOW_DIR, "usage.json");
    MEMORIES_FILE = path.join(SECRET_DIR, "memories.json");
    TEMP_MEM_FILE = path.join(SECRET_DIR, "memory-temp.json");
    TEMP_MEM_CHAT_FILE = path.join(SECRET_DIR, "temp-memory-chat.json");
    BACKUPS_DIR = path.join(DATA_DIR, "backups");
    LEDGER_FILE = path.join(SECRET_DIR, "ledger.json");
    ACTIVE_TX_FILE = path.join(SECRET_DIR, "active_tx.json");
    PATHS_FILE = path.join(SECRET_DIR, "path.json");
    CONTEXT_FILE = path.join(SECRET_DIR, "context.json");
    PARSER_DIR = path.join(DATA_DIR, "parsers");
  }
});

// src/utils/crypto.js
import fs2 from "fs";
import path2 from "path";
import crypto2 from "crypto";
var XOR_KEY, bypass, xorTransform, AES_ALGORITHM, AES_KEY, encryptAes, decryptAes, readEncryptedJson, writeEncryptedJson, readAesEncryptedJson, writeAesEncryptedJson;
var init_crypto = __esm({
  "src/utils/crypto.js"() {
    XOR_KEY = 66;
    bypass = true;
    xorTransform = (data) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const result = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        result[i] = buffer[i] ^ XOR_KEY;
      }
      return result;
    };
    AES_ALGORITHM = "aes-256-cbc";
    AES_KEY = crypto2.createHash("sha256").update("fluxflow-cli-sanctuary-key").digest();
    encryptAes = (text) => {
      if (bypass) return text;
      const iv = crypto2.randomBytes(16);
      const cipher = crypto2.createCipheriv(AES_ALGORITHM, AES_KEY, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    };
    decryptAes = (encryptedText) => {
      const parts = encryptedText.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid AES format");
      }
      const iv = Buffer.from(parts[0], "hex");
      const ciphertext = parts[1];
      const decipher = crypto2.createDecipheriv(AES_ALGORITHM, AES_KEY, iv);
      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    };
    readEncryptedJson = (filePath, defaultValue = {}) => {
      try {
        if (!fs2.existsSync(filePath)) return defaultValue;
        const rawContent = fs2.readFileSync(filePath);
        const fileContent = rawContent.toString("utf8").trim();
        if (fileContent.startsWith("{") || fileContent.startsWith("[")) {
          return JSON.parse(fileContent);
        }
        try {
          const decrypted = decryptAes(fileContent);
          return JSON.parse(decrypted);
        } catch (aesErr) {
        }
        const decryptedDataXor = xorTransform(rawContent).toString("utf8");
        if (decryptedDataXor.startsWith("{") || decryptedDataXor.startsWith("[")) {
          return JSON.parse(decryptedDataXor);
        }
        throw new Error("Unsupported or corrupt encryption format");
      } catch (err) {
        console.error(`Vault Read Error [${path2.basename(filePath)}]:`, err.message);
        return defaultValue;
      }
    };
    writeEncryptedJson = (filePath, data) => {
      try {
        const dir = path2.dirname(filePath);
        if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
        const jsonData = JSON.stringify(data, null, 2);
        const encrypted = encryptAes(jsonData);
        fs2.writeFileSync(filePath, encrypted, "utf8");
      } catch (err) {
        console.error(`Vault Write Error [${path2.basename(filePath)}]:`, err.message);
      }
    };
    readAesEncryptedJson = readEncryptedJson;
    writeAesEncryptedJson = writeEncryptedJson;
  }
});

// src/utils/secrets.js
var secrets_exports = {};
__export(secrets_exports, {
  getAPIKey: () => getAPIKey,
  getProviderAPIKey: () => getProviderAPIKey,
  getSearchSecrets: () => getSearchSecrets,
  getSecret: () => getSecret,
  removeAPIKey: () => removeAPIKey,
  removeSecret: () => removeSecret,
  saveAPIKey: () => saveAPIKey,
  saveProviderAPIKey: () => saveProviderAPIKey,
  saveSearchId: () => saveSearchId,
  saveSearchKey: () => saveSearchKey,
  saveSecret: () => saveSecret
});
import fs3 from "fs-extra";
import path3 from "path";
var SECRET_FILE, getAPIKey, getProviderAPIKey, saveProviderAPIKey, getSecret, saveSecret, getSearchSecrets, saveAPIKey, saveSearchKey, saveSearchId, removeSecret, removeAPIKey;
var init_secrets = __esm({
  "src/utils/secrets.js"() {
    init_crypto();
    init_paths();
    SECRET_FILE = path3.join(SECRET_DIR, "secrets.json");
    getAPIKey = async () => {
      try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        if (secrets.API_KEY) return secrets.API_KEY;
      } catch (e) {
      }
      return null;
    };
    getProviderAPIKey = async (provider) => {
      try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        if (provider === "Google") return secrets.GOOGLE_API_KEY || secrets.API_KEY || null;
        if (provider === "DeepSeek") return secrets.DEEPSEEK_API_KEY || null;
        if (provider === "OpenRouter") return secrets.OPENROUTER_API_KEY || null;
        if (provider === "NVIDIA") return secrets.NVIDIA_API_KEY || null;
      } catch (e) {
      }
      return null;
    };
    saveProviderAPIKey = async (provider, key) => {
      if (provider === "Google") {
        await saveSecret("GOOGLE_API_KEY", key);
        await saveSecret("API_KEY", key);
      } else if (provider === "DeepSeek") {
        await saveSecret("DEEPSEEK_API_KEY", key);
      } else if (provider === "OpenRouter") {
        await saveSecret("OPENROUTER_API_KEY", key);
      } else if (provider === "NVIDIA") {
        await saveSecret("NVIDIA_API_KEY", key);
      }
    };
    getSecret = async (key) => {
      try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        return secrets[key] || null;
      } catch (e) {
        return null;
      }
    };
    saveSecret = async (key, value) => {
      await fs3.ensureDir(SECRET_DIR);
      let current = readEncryptedJson(SECRET_FILE, {});
      current[key] = value;
      writeEncryptedJson(SECRET_FILE, current);
    };
    getSearchSecrets = async () => {
      try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        return {
          key: secrets.GOOGLE_API_KEY || secrets.API_KEY,
          cx: secrets.SEARCH_ID
        };
      } catch (e) {
      }
      return { key: null, cx: null };
    };
    saveAPIKey = async (apiKey) => saveSecret("API_KEY", apiKey);
    saveSearchKey = async (key) => saveSecret("GOOGLE_API_KEY", key);
    saveSearchId = async (id) => saveSecret("SEARCH_ID", id);
    removeSecret = async (key) => {
      try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        delete secrets[key];
        writeEncryptedJson(SECRET_FILE, secrets);
      } catch (e) {
      }
    };
    removeAPIKey = async () => removeSecret("API_KEY");
  }
});

// src/utils/settings.js
var settings_exports = {};
__export(settings_exports, {
  loadSettings: () => loadSettings,
  saveSettings: () => saveSettings
});
import fs4 from "fs-extra";
import path4 from "path";
var DEFAULT_SETTINGS, loadSettings, migrateToExternal, saveSettings;
var init_settings = __esm({
  "src/utils/settings.js"() {
    init_paths();
    init_crypto();
    DEFAULT_SETTINGS = {
      mode: "Flux",
      thinkingLevel: "Medium",
      aiProvider: "Google",
      activeModel: "gemma-4-31b-it",
      showFullThinking: true,
      apiTier: "Free",
      quotas: {
        agentLimit: 999999,
        backgroundLimit: 999999,
        searchLimit: 100,
        customModelId: "",
        customLimit: 0,
        providerTiers: {
          Google: "Free",
          DeepSeek: "Free",
          NVIDIA: "Free",
          OpenRouter: "Free"
        }
      },
      systemSettings: {
        memory: true,
        compression: 0,
        autoExec: false,
        allowExternalAccess: false,
        autoDeleteHistory: "7d",
        useExternalData: false,
        externalDataPath: ""
      },
      profileData: {
        name: null,
        nickname: null,
        instructions: null
      },
      imageSettings: {
        keyType: "Default",
        quality: "Low-High",
        apiKey: ""
      }
    };
    loadSettings = async () => {
      let settingsObj = { ...DEFAULT_SETTINGS };
      try {
        if (await fs4.exists(SETTINGS_FILE)) {
          const saved = readAesEncryptedJson(SETTINGS_FILE);
          if (saved.imageSettings && saved.imageSettings.apiKey) {
            try {
              const legacyKey = saved.imageSettings.apiKey;
              const { saveSecret: saveSecret2 } = await Promise.resolve().then(() => (init_secrets(), secrets_exports));
              await saveSecret2("POLLINATIONS_API_KEY", legacyKey);
              saved.imageSettings.apiKey = "";
              writeAesEncryptedJson(SETTINGS_FILE, saved);
            } catch (e) {
            }
          }
          settingsObj = {
            ...DEFAULT_SETTINGS,
            ...saved,
            quotas: {
              ...DEFAULT_SETTINGS.quotas,
              ...saved.quotas,
              providerTiers: {
                ...DEFAULT_SETTINGS.quotas.providerTiers,
                ...saved.quotas?.providerTiers || {}
              }
            },
            systemSettings: { ...DEFAULT_SETTINGS.systemSettings, ...saved.systemSettings },
            profileData: { ...DEFAULT_SETTINGS.profileData, ...saved.profileData },
            imageSettings: { ...DEFAULT_SETTINGS.imageSettings, ...saved.imageSettings }
          };
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
      try {
        const { getSecret: getSecret2 } = await Promise.resolve().then(() => (init_secrets(), secrets_exports));
        const customApiKey = await getSecret2("POLLINATIONS_API_KEY");
        if (customApiKey) {
          settingsObj.imageSettings.apiKey = customApiKey;
        }
      } catch (e) {
      }
      if (settingsObj.showFullThinking === false) {
        settingsObj.showFullThinking = true;
        try {
          writeAesEncryptedJson(SETTINGS_FILE, settingsObj);
        } catch (e) {
        }
      }
      return settingsObj;
    };
    migrateToExternal = async (newPath) => {
      const { FLUXFLOW_DIR: FLUXFLOW_DIR2 } = await Promise.resolve().then(() => (init_paths(), paths_exports));
      const folders = ["logs", "secret"];
      for (const folder of folders) {
        const src = path4.join(FLUXFLOW_DIR2, folder);
        const dest = path4.join(newPath, folder);
        try {
          if (await fs4.exists(src)) {
            await fs4.ensureDir(dest);
            await fs4.copy(src, dest, { overwrite: true });
          }
        } catch (err) {
          console.error(`Migration failed for ${folder}:`, err);
        }
      }
    };
    saveSettings = async (settings) => {
      try {
        const current = await loadSettings();
        if (!current.systemSettings.useExternalData && settings.systemSettings?.useExternalData && settings.systemSettings?.externalDataPath) {
          await migrateToExternal(settings.systemSettings.externalDataPath);
        }
        if (settings.imageSettings && settings.imageSettings.apiKey !== void 0) {
          const { saveSecret: saveSecret2, removeSecret: removeSecret2 } = await Promise.resolve().then(() => (init_secrets(), secrets_exports));
          const keyToSave = settings.imageSettings.apiKey;
          if (keyToSave) {
            await saveSecret2("POLLINATIONS_API_KEY", keyToSave);
          } else {
            await removeSecret2("POLLINATIONS_API_KEY");
          }
        }
        const updated = { ...current, ...settings };
        if (updated.imageSettings) {
          updated.imageSettings = { ...updated.imageSettings, apiKey: "" };
        }
        await fs4.ensureDir(path4.dirname(SETTINGS_FILE));
        writeAesEncryptedJson(SETTINGS_FILE, updated);
        return true;
      } catch (err) {
        console.error("Failed to save settings:", err);
        return false;
      }
    };
  }
});

// node_modules/.pnpm/cli-spinners@2.9.2/node_modules/cli-spinners/spinners.json
var require_spinners = __commonJS({
  "node_modules/.pnpm/cli-spinners@2.9.2/node_modules/cli-spinners/spinners.json"(exports, module) {
    module.exports = {
      dots: {
        interval: 80,
        frames: [
          "\u280B",
          "\u2819",
          "\u2839",
          "\u2838",
          "\u283C",
          "\u2834",
          "\u2826",
          "\u2827",
          "\u2807",
          "\u280F"
        ]
      },
      dots2: {
        interval: 80,
        frames: [
          "\u28FE",
          "\u28FD",
          "\u28FB",
          "\u28BF",
          "\u287F",
          "\u28DF",
          "\u28EF",
          "\u28F7"
        ]
      },
      dots3: {
        interval: 80,
        frames: [
          "\u280B",
          "\u2819",
          "\u281A",
          "\u281E",
          "\u2816",
          "\u2826",
          "\u2834",
          "\u2832",
          "\u2833",
          "\u2813"
        ]
      },
      dots4: {
        interval: 80,
        frames: [
          "\u2804",
          "\u2806",
          "\u2807",
          "\u280B",
          "\u2819",
          "\u2838",
          "\u2830",
          "\u2820",
          "\u2830",
          "\u2838",
          "\u2819",
          "\u280B",
          "\u2807",
          "\u2806"
        ]
      },
      dots5: {
        interval: 80,
        frames: [
          "\u280B",
          "\u2819",
          "\u281A",
          "\u2812",
          "\u2802",
          "\u2802",
          "\u2812",
          "\u2832",
          "\u2834",
          "\u2826",
          "\u2816",
          "\u2812",
          "\u2810",
          "\u2810",
          "\u2812",
          "\u2813",
          "\u280B"
        ]
      },
      dots6: {
        interval: 80,
        frames: [
          "\u2801",
          "\u2809",
          "\u2819",
          "\u281A",
          "\u2812",
          "\u2802",
          "\u2802",
          "\u2812",
          "\u2832",
          "\u2834",
          "\u2824",
          "\u2804",
          "\u2804",
          "\u2824",
          "\u2834",
          "\u2832",
          "\u2812",
          "\u2802",
          "\u2802",
          "\u2812",
          "\u281A",
          "\u2819",
          "\u2809",
          "\u2801"
        ]
      },
      dots7: {
        interval: 80,
        frames: [
          "\u2808",
          "\u2809",
          "\u280B",
          "\u2813",
          "\u2812",
          "\u2810",
          "\u2810",
          "\u2812",
          "\u2816",
          "\u2826",
          "\u2824",
          "\u2820",
          "\u2820",
          "\u2824",
          "\u2826",
          "\u2816",
          "\u2812",
          "\u2810",
          "\u2810",
          "\u2812",
          "\u2813",
          "\u280B",
          "\u2809",
          "\u2808"
        ]
      },
      dots8: {
        interval: 80,
        frames: [
          "\u2801",
          "\u2801",
          "\u2809",
          "\u2819",
          "\u281A",
          "\u2812",
          "\u2802",
          "\u2802",
          "\u2812",
          "\u2832",
          "\u2834",
          "\u2824",
          "\u2804",
          "\u2804",
          "\u2824",
          "\u2820",
          "\u2820",
          "\u2824",
          "\u2826",
          "\u2816",
          "\u2812",
          "\u2810",
          "\u2810",
          "\u2812",
          "\u2813",
          "\u280B",
          "\u2809",
          "\u2808",
          "\u2808"
        ]
      },
      dots9: {
        interval: 80,
        frames: [
          "\u28B9",
          "\u28BA",
          "\u28BC",
          "\u28F8",
          "\u28C7",
          "\u2867",
          "\u2857",
          "\u284F"
        ]
      },
      dots10: {
        interval: 80,
        frames: [
          "\u2884",
          "\u2882",
          "\u2881",
          "\u2841",
          "\u2848",
          "\u2850",
          "\u2860"
        ]
      },
      dots11: {
        interval: 100,
        frames: [
          "\u2801",
          "\u2802",
          "\u2804",
          "\u2840",
          "\u2880",
          "\u2820",
          "\u2810",
          "\u2808"
        ]
      },
      dots12: {
        interval: 80,
        frames: [
          "\u2880\u2800",
          "\u2840\u2800",
          "\u2804\u2800",
          "\u2882\u2800",
          "\u2842\u2800",
          "\u2805\u2800",
          "\u2883\u2800",
          "\u2843\u2800",
          "\u280D\u2800",
          "\u288B\u2800",
          "\u284B\u2800",
          "\u280D\u2801",
          "\u288B\u2801",
          "\u284B\u2801",
          "\u280D\u2809",
          "\u280B\u2809",
          "\u280B\u2809",
          "\u2809\u2819",
          "\u2809\u2819",
          "\u2809\u2829",
          "\u2808\u2899",
          "\u2808\u2859",
          "\u2888\u2829",
          "\u2840\u2899",
          "\u2804\u2859",
          "\u2882\u2829",
          "\u2842\u2898",
          "\u2805\u2858",
          "\u2883\u2828",
          "\u2843\u2890",
          "\u280D\u2850",
          "\u288B\u2820",
          "\u284B\u2880",
          "\u280D\u2841",
          "\u288B\u2801",
          "\u284B\u2801",
          "\u280D\u2809",
          "\u280B\u2809",
          "\u280B\u2809",
          "\u2809\u2819",
          "\u2809\u2819",
          "\u2809\u2829",
          "\u2808\u2899",
          "\u2808\u2859",
          "\u2808\u2829",
          "\u2800\u2899",
          "\u2800\u2859",
          "\u2800\u2829",
          "\u2800\u2898",
          "\u2800\u2858",
          "\u2800\u2828",
          "\u2800\u2890",
          "\u2800\u2850",
          "\u2800\u2820",
          "\u2800\u2880",
          "\u2800\u2840"
        ]
      },
      dots13: {
        interval: 80,
        frames: [
          "\u28FC",
          "\u28F9",
          "\u28BB",
          "\u283F",
          "\u285F",
          "\u28CF",
          "\u28E7",
          "\u28F6"
        ]
      },
      dots8Bit: {
        interval: 80,
        frames: [
          "\u2800",
          "\u2801",
          "\u2802",
          "\u2803",
          "\u2804",
          "\u2805",
          "\u2806",
          "\u2807",
          "\u2840",
          "\u2841",
          "\u2842",
          "\u2843",
          "\u2844",
          "\u2845",
          "\u2846",
          "\u2847",
          "\u2808",
          "\u2809",
          "\u280A",
          "\u280B",
          "\u280C",
          "\u280D",
          "\u280E",
          "\u280F",
          "\u2848",
          "\u2849",
          "\u284A",
          "\u284B",
          "\u284C",
          "\u284D",
          "\u284E",
          "\u284F",
          "\u2810",
          "\u2811",
          "\u2812",
          "\u2813",
          "\u2814",
          "\u2815",
          "\u2816",
          "\u2817",
          "\u2850",
          "\u2851",
          "\u2852",
          "\u2853",
          "\u2854",
          "\u2855",
          "\u2856",
          "\u2857",
          "\u2818",
          "\u2819",
          "\u281A",
          "\u281B",
          "\u281C",
          "\u281D",
          "\u281E",
          "\u281F",
          "\u2858",
          "\u2859",
          "\u285A",
          "\u285B",
          "\u285C",
          "\u285D",
          "\u285E",
          "\u285F",
          "\u2820",
          "\u2821",
          "\u2822",
          "\u2823",
          "\u2824",
          "\u2825",
          "\u2826",
          "\u2827",
          "\u2860",
          "\u2861",
          "\u2862",
          "\u2863",
          "\u2864",
          "\u2865",
          "\u2866",
          "\u2867",
          "\u2828",
          "\u2829",
          "\u282A",
          "\u282B",
          "\u282C",
          "\u282D",
          "\u282E",
          "\u282F",
          "\u2868",
          "\u2869",
          "\u286A",
          "\u286B",
          "\u286C",
          "\u286D",
          "\u286E",
          "\u286F",
          "\u2830",
          "\u2831",
          "\u2832",
          "\u2833",
          "\u2834",
          "\u2835",
          "\u2836",
          "\u2837",
          "\u2870",
          "\u2871",
          "\u2872",
          "\u2873",
          "\u2874",
          "\u2875",
          "\u2876",
          "\u2877",
          "\u2838",
          "\u2839",
          "\u283A",
          "\u283B",
          "\u283C",
          "\u283D",
          "\u283E",
          "\u283F",
          "\u2878",
          "\u2879",
          "\u287A",
          "\u287B",
          "\u287C",
          "\u287D",
          "\u287E",
          "\u287F",
          "\u2880",
          "\u2881",
          "\u2882",
          "\u2883",
          "\u2884",
          "\u2885",
          "\u2886",
          "\u2887",
          "\u28C0",
          "\u28C1",
          "\u28C2",
          "\u28C3",
          "\u28C4",
          "\u28C5",
          "\u28C6",
          "\u28C7",
          "\u2888",
          "\u2889",
          "\u288A",
          "\u288B",
          "\u288C",
          "\u288D",
          "\u288E",
          "\u288F",
          "\u28C8",
          "\u28C9",
          "\u28CA",
          "\u28CB",
          "\u28CC",
          "\u28CD",
          "\u28CE",
          "\u28CF",
          "\u2890",
          "\u2891",
          "\u2892",
          "\u2893",
          "\u2894",
          "\u2895",
          "\u2896",
          "\u2897",
          "\u28D0",
          "\u28D1",
          "\u28D2",
          "\u28D3",
          "\u28D4",
          "\u28D5",
          "\u28D6",
          "\u28D7",
          "\u2898",
          "\u2899",
          "\u289A",
          "\u289B",
          "\u289C",
          "\u289D",
          "\u289E",
          "\u289F",
          "\u28D8",
          "\u28D9",
          "\u28DA",
          "\u28DB",
          "\u28DC",
          "\u28DD",
          "\u28DE",
          "\u28DF",
          "\u28A0",
          "\u28A1",
          "\u28A2",
          "\u28A3",
          "\u28A4",
          "\u28A5",
          "\u28A6",
          "\u28A7",
          "\u28E0",
          "\u28E1",
          "\u28E2",
          "\u28E3",
          "\u28E4",
          "\u28E5",
          "\u28E6",
          "\u28E7",
          "\u28A8",
          "\u28A9",
          "\u28AA",
          "\u28AB",
          "\u28AC",
          "\u28AD",
          "\u28AE",
          "\u28AF",
          "\u28E8",
          "\u28E9",
          "\u28EA",
          "\u28EB",
          "\u28EC",
          "\u28ED",
          "\u28EE",
          "\u28EF",
          "\u28B0",
          "\u28B1",
          "\u28B2",
          "\u28B3",
          "\u28B4",
          "\u28B5",
          "\u28B6",
          "\u28B7",
          "\u28F0",
          "\u28F1",
          "\u28F2",
          "\u28F3",
          "\u28F4",
          "\u28F5",
          "\u28F6",
          "\u28F7",
          "\u28B8",
          "\u28B9",
          "\u28BA",
          "\u28BB",
          "\u28BC",
          "\u28BD",
          "\u28BE",
          "\u28BF",
          "\u28F8",
          "\u28F9",
          "\u28FA",
          "\u28FB",
          "\u28FC",
          "\u28FD",
          "\u28FE",
          "\u28FF"
        ]
      },
      sand: {
        interval: 80,
        frames: [
          "\u2801",
          "\u2802",
          "\u2804",
          "\u2840",
          "\u2848",
          "\u2850",
          "\u2860",
          "\u28C0",
          "\u28C1",
          "\u28C2",
          "\u28C4",
          "\u28CC",
          "\u28D4",
          "\u28E4",
          "\u28E5",
          "\u28E6",
          "\u28EE",
          "\u28F6",
          "\u28F7",
          "\u28FF",
          "\u287F",
          "\u283F",
          "\u289F",
          "\u281F",
          "\u285B",
          "\u281B",
          "\u282B",
          "\u288B",
          "\u280B",
          "\u280D",
          "\u2849",
          "\u2809",
          "\u2811",
          "\u2821",
          "\u2881"
        ]
      },
      line: {
        interval: 130,
        frames: [
          "-",
          "\\",
          "|",
          "/"
        ]
      },
      line2: {
        interval: 100,
        frames: [
          "\u2802",
          "-",
          "\u2013",
          "\u2014",
          "\u2013",
          "-"
        ]
      },
      pipe: {
        interval: 100,
        frames: [
          "\u2524",
          "\u2518",
          "\u2534",
          "\u2514",
          "\u251C",
          "\u250C",
          "\u252C",
          "\u2510"
        ]
      },
      simpleDots: {
        interval: 400,
        frames: [
          ".  ",
          ".. ",
          "...",
          "   "
        ]
      },
      simpleDotsScrolling: {
        interval: 200,
        frames: [
          ".  ",
          ".. ",
          "...",
          " ..",
          "  .",
          "   "
        ]
      },
      star: {
        interval: 70,
        frames: [
          "\u2736",
          "\u2738",
          "\u2739",
          "\u273A",
          "\u2739",
          "\u2737"
        ]
      },
      star2: {
        interval: 80,
        frames: [
          "+",
          "x",
          "*"
        ]
      },
      flip: {
        interval: 70,
        frames: [
          "_",
          "_",
          "_",
          "-",
          "`",
          "`",
          "'",
          "\xB4",
          "-",
          "_",
          "_",
          "_"
        ]
      },
      hamburger: {
        interval: 100,
        frames: [
          "\u2631",
          "\u2632",
          "\u2634"
        ]
      },
      growVertical: {
        interval: 120,
        frames: [
          "\u2581",
          "\u2583",
          "\u2584",
          "\u2585",
          "\u2586",
          "\u2587",
          "\u2586",
          "\u2585",
          "\u2584",
          "\u2583"
        ]
      },
      growHorizontal: {
        interval: 120,
        frames: [
          "\u258F",
          "\u258E",
          "\u258D",
          "\u258C",
          "\u258B",
          "\u258A",
          "\u2589",
          "\u258A",
          "\u258B",
          "\u258C",
          "\u258D",
          "\u258E"
        ]
      },
      balloon: {
        interval: 140,
        frames: [
          " ",
          ".",
          "o",
          "O",
          "@",
          "*",
          " "
        ]
      },
      balloon2: {
        interval: 120,
        frames: [
          ".",
          "o",
          "O",
          "\xB0",
          "O",
          "o",
          "."
        ]
      },
      noise: {
        interval: 100,
        frames: [
          "\u2593",
          "\u2592",
          "\u2591"
        ]
      },
      bounce: {
        interval: 120,
        frames: [
          "\u2801",
          "\u2802",
          "\u2804",
          "\u2802"
        ]
      },
      boxBounce: {
        interval: 120,
        frames: [
          "\u2596",
          "\u2598",
          "\u259D",
          "\u2597"
        ]
      },
      boxBounce2: {
        interval: 100,
        frames: [
          "\u258C",
          "\u2580",
          "\u2590",
          "\u2584"
        ]
      },
      triangle: {
        interval: 50,
        frames: [
          "\u25E2",
          "\u25E3",
          "\u25E4",
          "\u25E5"
        ]
      },
      binary: {
        interval: 80,
        frames: [
          "010010",
          "001100",
          "100101",
          "111010",
          "111101",
          "010111",
          "101011",
          "111000",
          "110011",
          "110101"
        ]
      },
      arc: {
        interval: 100,
        frames: [
          "\u25DC",
          "\u25E0",
          "\u25DD",
          "\u25DE",
          "\u25E1",
          "\u25DF"
        ]
      },
      circle: {
        interval: 120,
        frames: [
          "\u25E1",
          "\u2299",
          "\u25E0"
        ]
      },
      squareCorners: {
        interval: 180,
        frames: [
          "\u25F0",
          "\u25F3",
          "\u25F2",
          "\u25F1"
        ]
      },
      circleQuarters: {
        interval: 120,
        frames: [
          "\u25F4",
          "\u25F7",
          "\u25F6",
          "\u25F5"
        ]
      },
      circleHalves: {
        interval: 50,
        frames: [
          "\u25D0",
          "\u25D3",
          "\u25D1",
          "\u25D2"
        ]
      },
      squish: {
        interval: 100,
        frames: [
          "\u256B",
          "\u256A"
        ]
      },
      toggle: {
        interval: 250,
        frames: [
          "\u22B6",
          "\u22B7"
        ]
      },
      toggle2: {
        interval: 80,
        frames: [
          "\u25AB",
          "\u25AA"
        ]
      },
      toggle3: {
        interval: 120,
        frames: [
          "\u25A1",
          "\u25A0"
        ]
      },
      toggle4: {
        interval: 100,
        frames: [
          "\u25A0",
          "\u25A1",
          "\u25AA",
          "\u25AB"
        ]
      },
      toggle5: {
        interval: 100,
        frames: [
          "\u25AE",
          "\u25AF"
        ]
      },
      toggle6: {
        interval: 300,
        frames: [
          "\u101D",
          "\u1040"
        ]
      },
      toggle7: {
        interval: 80,
        frames: [
          "\u29BE",
          "\u29BF"
        ]
      },
      toggle8: {
        interval: 100,
        frames: [
          "\u25CD",
          "\u25CC"
        ]
      },
      toggle9: {
        interval: 100,
        frames: [
          "\u25C9",
          "\u25CE"
        ]
      },
      toggle10: {
        interval: 100,
        frames: [
          "\u3282",
          "\u3280",
          "\u3281"
        ]
      },
      toggle11: {
        interval: 50,
        frames: [
          "\u29C7",
          "\u29C6"
        ]
      },
      toggle12: {
        interval: 120,
        frames: [
          "\u2617",
          "\u2616"
        ]
      },
      toggle13: {
        interval: 80,
        frames: [
          "=",
          "*",
          "-"
        ]
      },
      arrow: {
        interval: 100,
        frames: [
          "\u2190",
          "\u2196",
          "\u2191",
          "\u2197",
          "\u2192",
          "\u2198",
          "\u2193",
          "\u2199"
        ]
      },
      arrow2: {
        interval: 80,
        frames: [
          "\u2B06\uFE0F ",
          "\u2197\uFE0F ",
          "\u27A1\uFE0F ",
          "\u2198\uFE0F ",
          "\u2B07\uFE0F ",
          "\u2199\uFE0F ",
          "\u2B05\uFE0F ",
          "\u2196\uFE0F "
        ]
      },
      arrow3: {
        interval: 120,
        frames: [
          "\u25B9\u25B9\u25B9\u25B9\u25B9",
          "\u25B8\u25B9\u25B9\u25B9\u25B9",
          "\u25B9\u25B8\u25B9\u25B9\u25B9",
          "\u25B9\u25B9\u25B8\u25B9\u25B9",
          "\u25B9\u25B9\u25B9\u25B8\u25B9",
          "\u25B9\u25B9\u25B9\u25B9\u25B8"
        ]
      },
      bouncingBar: {
        interval: 80,
        frames: [
          "[    ]",
          "[=   ]",
          "[==  ]",
          "[=== ]",
          "[====]",
          "[ ===]",
          "[  ==]",
          "[   =]",
          "[    ]",
          "[   =]",
          "[  ==]",
          "[ ===]",
          "[====]",
          "[=== ]",
          "[==  ]",
          "[=   ]"
        ]
      },
      bouncingBall: {
        interval: 80,
        frames: [
          "( \u25CF    )",
          "(  \u25CF   )",
          "(   \u25CF  )",
          "(    \u25CF )",
          "(     \u25CF)",
          "(    \u25CF )",
          "(   \u25CF  )",
          "(  \u25CF   )",
          "( \u25CF    )",
          "(\u25CF     )"
        ]
      },
      smiley: {
        interval: 200,
        frames: [
          "\u{1F604} ",
          "\u{1F61D} "
        ]
      },
      monkey: {
        interval: 300,
        frames: [
          "\u{1F648} ",
          "\u{1F648} ",
          "\u{1F649} ",
          "\u{1F64A} "
        ]
      },
      hearts: {
        interval: 100,
        frames: [
          "\u{1F49B} ",
          "\u{1F499} ",
          "\u{1F49C} ",
          "\u{1F49A} ",
          "\u2764\uFE0F "
        ]
      },
      clock: {
        interval: 100,
        frames: [
          "\u{1F55B} ",
          "\u{1F550} ",
          "\u{1F551} ",
          "\u{1F552} ",
          "\u{1F553} ",
          "\u{1F554} ",
          "\u{1F555} ",
          "\u{1F556} ",
          "\u{1F557} ",
          "\u{1F558} ",
          "\u{1F559} ",
          "\u{1F55A} "
        ]
      },
      earth: {
        interval: 180,
        frames: [
          "\u{1F30D} ",
          "\u{1F30E} ",
          "\u{1F30F} "
        ]
      },
      material: {
        interval: 17,
        frames: [
          "\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588",
          "\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588",
          "\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588",
          "\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588",
          "\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588",
          "\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588",
          "\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2588",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581",
          "\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581\u2581"
        ]
      },
      moon: {
        interval: 80,
        frames: [
          "\u{1F311} ",
          "\u{1F312} ",
          "\u{1F313} ",
          "\u{1F314} ",
          "\u{1F315} ",
          "\u{1F316} ",
          "\u{1F317} ",
          "\u{1F318} "
        ]
      },
      runner: {
        interval: 140,
        frames: [
          "\u{1F6B6} ",
          "\u{1F3C3} "
        ]
      },
      pong: {
        interval: 80,
        frames: [
          "\u2590\u2802       \u258C",
          "\u2590\u2808       \u258C",
          "\u2590 \u2802      \u258C",
          "\u2590 \u2820      \u258C",
          "\u2590  \u2840     \u258C",
          "\u2590  \u2820     \u258C",
          "\u2590   \u2802    \u258C",
          "\u2590   \u2808    \u258C",
          "\u2590    \u2802   \u258C",
          "\u2590    \u2820   \u258C",
          "\u2590     \u2840  \u258C",
          "\u2590     \u2820  \u258C",
          "\u2590      \u2802 \u258C",
          "\u2590      \u2808 \u258C",
          "\u2590       \u2802\u258C",
          "\u2590       \u2820\u258C",
          "\u2590       \u2840\u258C",
          "\u2590      \u2820 \u258C",
          "\u2590      \u2802 \u258C",
          "\u2590     \u2808  \u258C",
          "\u2590     \u2802  \u258C",
          "\u2590    \u2820   \u258C",
          "\u2590    \u2840   \u258C",
          "\u2590   \u2820    \u258C",
          "\u2590   \u2802    \u258C",
          "\u2590  \u2808     \u258C",
          "\u2590  \u2802     \u258C",
          "\u2590 \u2820      \u258C",
          "\u2590 \u2840      \u258C",
          "\u2590\u2820       \u258C"
        ]
      },
      shark: {
        interval: 120,
        frames: [
          "\u2590|\\____________\u258C",
          "\u2590_|\\___________\u258C",
          "\u2590__|\\__________\u258C",
          "\u2590___|\\_________\u258C",
          "\u2590____|\\________\u258C",
          "\u2590_____|\\_______\u258C",
          "\u2590______|\\______\u258C",
          "\u2590_______|\\_____\u258C",
          "\u2590________|\\____\u258C",
          "\u2590_________|\\___\u258C",
          "\u2590__________|\\__\u258C",
          "\u2590___________|\\_\u258C",
          "\u2590____________|\\\u258C",
          "\u2590____________/|\u258C",
          "\u2590___________/|_\u258C",
          "\u2590__________/|__\u258C",
          "\u2590_________/|___\u258C",
          "\u2590________/|____\u258C",
          "\u2590_______/|_____\u258C",
          "\u2590______/|______\u258C",
          "\u2590_____/|_______\u258C",
          "\u2590____/|________\u258C",
          "\u2590___/|_________\u258C",
          "\u2590__/|__________\u258C",
          "\u2590_/|___________\u258C",
          "\u2590/|____________\u258C"
        ]
      },
      dqpb: {
        interval: 100,
        frames: [
          "d",
          "q",
          "p",
          "b"
        ]
      },
      weather: {
        interval: 100,
        frames: [
          "\u2600\uFE0F ",
          "\u2600\uFE0F ",
          "\u2600\uFE0F ",
          "\u{1F324} ",
          "\u26C5\uFE0F ",
          "\u{1F325} ",
          "\u2601\uFE0F ",
          "\u{1F327} ",
          "\u{1F328} ",
          "\u{1F327} ",
          "\u{1F328} ",
          "\u{1F327} ",
          "\u{1F328} ",
          "\u26C8 ",
          "\u{1F328} ",
          "\u{1F327} ",
          "\u{1F328} ",
          "\u2601\uFE0F ",
          "\u{1F325} ",
          "\u26C5\uFE0F ",
          "\u{1F324} ",
          "\u2600\uFE0F ",
          "\u2600\uFE0F "
        ]
      },
      christmas: {
        interval: 400,
        frames: [
          "\u{1F332}",
          "\u{1F384}"
        ]
      },
      grenade: {
        interval: 80,
        frames: [
          "\u060C  ",
          "\u2032  ",
          " \xB4 ",
          " \u203E ",
          "  \u2E0C",
          "  \u2E0A",
          "  |",
          "  \u204E",
          "  \u2055",
          " \u0DF4 ",
          "  \u2053",
          "   ",
          "   ",
          "   "
        ]
      },
      point: {
        interval: 125,
        frames: [
          "\u2219\u2219\u2219",
          "\u25CF\u2219\u2219",
          "\u2219\u25CF\u2219",
          "\u2219\u2219\u25CF",
          "\u2219\u2219\u2219"
        ]
      },
      layer: {
        interval: 150,
        frames: [
          "-",
          "=",
          "\u2261"
        ]
      },
      betaWave: {
        interval: 80,
        frames: [
          "\u03C1\u03B2\u03B2\u03B2\u03B2\u03B2\u03B2",
          "\u03B2\u03C1\u03B2\u03B2\u03B2\u03B2\u03B2",
          "\u03B2\u03B2\u03C1\u03B2\u03B2\u03B2\u03B2",
          "\u03B2\u03B2\u03B2\u03C1\u03B2\u03B2\u03B2",
          "\u03B2\u03B2\u03B2\u03B2\u03C1\u03B2\u03B2",
          "\u03B2\u03B2\u03B2\u03B2\u03B2\u03C1\u03B2",
          "\u03B2\u03B2\u03B2\u03B2\u03B2\u03B2\u03C1"
        ]
      },
      fingerDance: {
        interval: 160,
        frames: [
          "\u{1F918} ",
          "\u{1F91F} ",
          "\u{1F596} ",
          "\u270B ",
          "\u{1F91A} ",
          "\u{1F446} "
        ]
      },
      fistBump: {
        interval: 80,
        frames: [
          "\u{1F91C}\u3000\u3000\u3000\u3000\u{1F91B} ",
          "\u{1F91C}\u3000\u3000\u3000\u3000\u{1F91B} ",
          "\u{1F91C}\u3000\u3000\u3000\u3000\u{1F91B} ",
          "\u3000\u{1F91C}\u3000\u3000\u{1F91B}\u3000 ",
          "\u3000\u3000\u{1F91C}\u{1F91B}\u3000\u3000 ",
          "\u3000\u{1F91C}\u2728\u{1F91B}\u3000\u3000 ",
          "\u{1F91C}\u3000\u2728\u3000\u{1F91B}\u3000 "
        ]
      },
      soccerHeader: {
        interval: 80,
        frames: [
          " \u{1F9D1}\u26BD\uFE0F       \u{1F9D1} ",
          "\u{1F9D1}  \u26BD\uFE0F      \u{1F9D1} ",
          "\u{1F9D1}   \u26BD\uFE0F     \u{1F9D1} ",
          "\u{1F9D1}    \u26BD\uFE0F    \u{1F9D1} ",
          "\u{1F9D1}     \u26BD\uFE0F   \u{1F9D1} ",
          "\u{1F9D1}      \u26BD\uFE0F  \u{1F9D1} ",
          "\u{1F9D1}       \u26BD\uFE0F\u{1F9D1}  ",
          "\u{1F9D1}      \u26BD\uFE0F  \u{1F9D1} ",
          "\u{1F9D1}     \u26BD\uFE0F   \u{1F9D1} ",
          "\u{1F9D1}    \u26BD\uFE0F    \u{1F9D1} ",
          "\u{1F9D1}   \u26BD\uFE0F     \u{1F9D1} ",
          "\u{1F9D1}  \u26BD\uFE0F      \u{1F9D1} "
        ]
      },
      mindblown: {
        interval: 160,
        frames: [
          "\u{1F610} ",
          "\u{1F610} ",
          "\u{1F62E} ",
          "\u{1F62E} ",
          "\u{1F626} ",
          "\u{1F626} ",
          "\u{1F627} ",
          "\u{1F627} ",
          "\u{1F92F} ",
          "\u{1F4A5} ",
          "\u2728 ",
          "\u3000 ",
          "\u3000 ",
          "\u3000 "
        ]
      },
      speaker: {
        interval: 160,
        frames: [
          "\u{1F508} ",
          "\u{1F509} ",
          "\u{1F50A} ",
          "\u{1F509} "
        ]
      },
      orangePulse: {
        interval: 100,
        frames: [
          "\u{1F538} ",
          "\u{1F536} ",
          "\u{1F7E0} ",
          "\u{1F7E0} ",
          "\u{1F536} "
        ]
      },
      bluePulse: {
        interval: 100,
        frames: [
          "\u{1F539} ",
          "\u{1F537} ",
          "\u{1F535} ",
          "\u{1F535} ",
          "\u{1F537} "
        ]
      },
      orangeBluePulse: {
        interval: 100,
        frames: [
          "\u{1F538} ",
          "\u{1F536} ",
          "\u{1F7E0} ",
          "\u{1F7E0} ",
          "\u{1F536} ",
          "\u{1F539} ",
          "\u{1F537} ",
          "\u{1F535} ",
          "\u{1F535} ",
          "\u{1F537} "
        ]
      },
      timeTravel: {
        interval: 100,
        frames: [
          "\u{1F55B} ",
          "\u{1F55A} ",
          "\u{1F559} ",
          "\u{1F558} ",
          "\u{1F557} ",
          "\u{1F556} ",
          "\u{1F555} ",
          "\u{1F554} ",
          "\u{1F553} ",
          "\u{1F552} ",
          "\u{1F551} ",
          "\u{1F550} "
        ]
      },
      aesthetic: {
        interval: 80,
        frames: [
          "\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1\u25B1",
          "\u25B0\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1",
          "\u25B0\u25B0\u25B0\u25B1\u25B1\u25B1\u25B1",
          "\u25B0\u25B0\u25B0\u25B0\u25B1\u25B1\u25B1",
          "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B1\u25B1",
          "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B1",
          "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0",
          "\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1\u25B1"
        ]
      },
      dwarfFortress: {
        interval: 80,
        frames: [
          " \u2588\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2588\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2588\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2593\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2593\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2592\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2592\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2591\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A\u2591\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "\u263A \u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2593\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2593\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2592\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2592\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2591\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A\u2591\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u263A \u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2593\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2593\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2592\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2592\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2591\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A\u2591\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u263A \u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2593\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2593\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2592\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2592\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2591\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A\u2591\u2588\u2588\xA3\xA3\xA3  ",
          "   \u263A \u2588\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2588\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2588\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2593\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2593\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2592\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2592\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2591\u2588\xA3\xA3\xA3  ",
          "    \u263A\u2591\u2588\xA3\xA3\xA3  ",
          "    \u263A \u2588\xA3\xA3\xA3  ",
          "     \u263A\u2588\xA3\xA3\xA3  ",
          "     \u263A\u2588\xA3\xA3\xA3  ",
          "     \u263A\u2593\xA3\xA3\xA3  ",
          "     \u263A\u2593\xA3\xA3\xA3  ",
          "     \u263A\u2592\xA3\xA3\xA3  ",
          "     \u263A\u2592\xA3\xA3\xA3  ",
          "     \u263A\u2591\xA3\xA3\xA3  ",
          "     \u263A\u2591\xA3\xA3\xA3  ",
          "     \u263A \xA3\xA3\xA3  ",
          "      \u263A\xA3\xA3\xA3  ",
          "      \u263A\xA3\xA3\xA3  ",
          "      \u263A\u2593\xA3\xA3  ",
          "      \u263A\u2593\xA3\xA3  ",
          "      \u263A\u2592\xA3\xA3  ",
          "      \u263A\u2592\xA3\xA3  ",
          "      \u263A\u2591\xA3\xA3  ",
          "      \u263A\u2591\xA3\xA3  ",
          "      \u263A \xA3\xA3  ",
          "       \u263A\xA3\xA3  ",
          "       \u263A\xA3\xA3  ",
          "       \u263A\u2593\xA3  ",
          "       \u263A\u2593\xA3  ",
          "       \u263A\u2592\xA3  ",
          "       \u263A\u2592\xA3  ",
          "       \u263A\u2591\xA3  ",
          "       \u263A\u2591\xA3  ",
          "       \u263A \xA3  ",
          "        \u263A\xA3  ",
          "        \u263A\xA3  ",
          "        \u263A\u2593  ",
          "        \u263A\u2593  ",
          "        \u263A\u2592  ",
          "        \u263A\u2592  ",
          "        \u263A\u2591  ",
          "        \u263A\u2591  ",
          "        \u263A   ",
          "        \u263A  &",
          "        \u263A \u263C&",
          "       \u263A \u263C &",
          "       \u263A\u263C  &",
          "      \u263A\u263C  & ",
          "      \u203C   & ",
          "     \u263A   &  ",
          "    \u203C    &  ",
          "   \u263A    &   ",
          "  \u203C     &   ",
          " \u263A     &    ",
          "\u203C      &    ",
          "      &     ",
          "      &     ",
          "     &   \u2591  ",
          "     &   \u2592  ",
          "    &    \u2593  ",
          "    &    \xA3  ",
          "   &    \u2591\xA3  ",
          "   &    \u2592\xA3  ",
          "  &     \u2593\xA3  ",
          "  &     \xA3\xA3  ",
          " &     \u2591\xA3\xA3  ",
          " &     \u2592\xA3\xA3  ",
          "&      \u2593\xA3\xA3  ",
          "&      \xA3\xA3\xA3  ",
          "      \u2591\xA3\xA3\xA3  ",
          "      \u2592\xA3\xA3\xA3  ",
          "      \u2593\xA3\xA3\xA3  ",
          "      \u2588\xA3\xA3\xA3  ",
          "     \u2591\u2588\xA3\xA3\xA3  ",
          "     \u2592\u2588\xA3\xA3\xA3  ",
          "     \u2593\u2588\xA3\xA3\xA3  ",
          "     \u2588\u2588\xA3\xA3\xA3  ",
          "    \u2591\u2588\u2588\xA3\xA3\xA3  ",
          "    \u2592\u2588\u2588\xA3\xA3\xA3  ",
          "    \u2593\u2588\u2588\xA3\xA3\xA3  ",
          "    \u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u2591\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u2592\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u2593\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "   \u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u2591\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u2592\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u2593\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          "  \u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u2591\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u2592\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u2593\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u2588\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  ",
          " \u2588\u2588\u2588\u2588\u2588\u2588\xA3\xA3\xA3  "
        ]
      }
    };
  }
});

// node_modules/.pnpm/cli-spinners@2.9.2/node_modules/cli-spinners/index.js
var require_cli_spinners = __commonJS({
  "node_modules/.pnpm/cli-spinners@2.9.2/node_modules/cli-spinners/index.js"(exports, module) {
    "use strict";
    var spinners2 = Object.assign({}, require_spinners());
    var spinnersList = Object.keys(spinners2);
    Object.defineProperty(spinners2, "random", {
      get() {
        const randomIndex = Math.floor(Math.random() * spinnersList.length);
        const spinnerName = spinnersList[randomIndex];
        return spinners2[spinnerName];
      }
    });
    module.exports = spinners2;
  }
});

// node_modules/.pnpm/ink-spinner@5.0.0_ink@7.1.0_38a84928ececc3ab151b45dc093a1a9a/node_modules/ink-spinner/build/index.js
import React, { useState, useEffect } from "react";
import { Text } from "ink";
function Spinner({ type = "dots" }) {
  const [frame, setFrame] = useState(0);
  const spinner = import_cli_spinners.default[type];
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((previousFrame) => {
        const isLastFrame = previousFrame === spinner.frames.length - 1;
        return isLastFrame ? 0 : previousFrame + 1;
      });
    }, spinner.interval);
    return () => {
      clearInterval(timer);
    };
  }, [spinner]);
  return React.createElement(Text, null, spinner.frames[frame]);
}
var import_cli_spinners, build_default;
var init_build = __esm({
  "node_modules/.pnpm/ink-spinner@5.0.0_ink@7.1.0_38a84928ececc3ab151b45dc093a1a9a/node_modules/ink-spinner/build/index.js"() {
    import_cli_spinners = __toESM(require_cli_spinners(), 1);
    build_default = Spinner;
  }
});

// src/utils/text.js
import os2 from "os";
var wrapText, formatTokens, truncatePath, parsePatchPairs, applyPatches, generateHighFidelityDiff, parseLineInfo, getSimilarity, alignChangeGroup, blocksCache, streamingBlocksCache, MAX_CACHE_SIZE, CHUNK_SIZE, indexBlockIntoMap, parseMessageToBlocks, TOOL_LABELS, REGEX_INITIAL_THINK, REGEX_INITIAL_TOOL, REGEX_CLEAN_SIGNALS, REGEX_ARROWS_ALL, REGEX_TOOLS, cleanSignals, clearBlocksCache;
var init_text = __esm({
  "src/utils/text.js"() {
    init_paths();
    wrapText = (text, width) => {
      if (!text) return "";
      const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;
      const sourceLines = text.split("\n");
      let finalLines = [];
      if (width <= 5) return text;
      const getVisibleLength = (str) => str.replace(ansiRegex, "").length;
      sourceLines.forEach((sLine) => {
        const visibleLength = getVisibleLength(sLine);
        if (visibleLength <= width) {
          finalLines.push(sLine);
          return;
        }
        const tokens = sLine.split(/(\s+)/);
        let currentLine = "";
        let currentVisibleLength = 0;
        const leadingSpaceMatch = sLine.match(/^(\s*)/);
        const indent = leadingSpaceMatch ? leadingSpaceMatch[1] : "";
        tokens.forEach((token, idx) => {
          if (token.length === 0) return;
          const tokenVisibleLength = getVisibleLength(token);
          if (currentVisibleLength + tokenVisibleLength > width) {
            if (currentLine.trim().length > 0) {
              finalLines.push(currentLine.trimEnd());
              currentLine = indent + token;
              currentVisibleLength = getVisibleLength(currentLine);
            } else {
              if (ansiRegex.test(token)) {
                finalLines.push(token);
                currentLine = indent;
                currentVisibleLength = getVisibleLength(currentLine);
              } else {
                let word = token;
                while (getVisibleLength(word) > width && width > 10) {
                  finalLines.push(word.substring(0, width));
                  word = word.substring(width);
                }
                currentLine = word;
                currentVisibleLength = getVisibleLength(currentLine);
              }
            }
          } else {
            currentLine += token;
            currentVisibleLength += tokenVisibleLength;
          }
        });
        if (currentLine.trimEnd().length > 0 || currentLine === indent) {
          finalLines.push(currentLine.trimEnd());
        }
      });
      return finalLines.join("\n");
    };
    formatTokens = (tokens) => {
      if (!tokens && tokens !== 0) return "0.0k";
      const num = typeof tokens === "string" ? parseFloat(tokens) : tokens;
      if (num >= 1e6) {
        return `${(num / 1e6).toFixed(1)}m`;
      } else if (num >= 1e3) {
        return `${(num / 1e3).toFixed(1)}k`;
      }
      return num.toString();
    };
    truncatePath = (p, maxLength = 40) => {
      let data_dir = DATA_DIR.replaceAll("\\\\", "\\");
      p = p.replace(os2.homedir(), "~").replace(data_dir, "FluxFlow").replaceAll("\\", "/");
      if (!p || p.length <= maxLength) return p;
      const half = Math.floor((maxLength - 3) / 2);
      return p.substring(0, half) + "..." + p.substring(p.length - half).replaceAll("\\", "/");
    };
    parsePatchPairs = (args) => {
      const patchPairs = [];
      const indices = /* @__PURE__ */ new Set();
      Object.keys(args).forEach((key) => {
        const m = key.match(/^(replaceContent|newContent|content_to_replace|content_to_add)(\d+)?$/);
        if (m) {
          const index = m[2] ? parseInt(m[2]) : 1;
          indices.add(index);
        }
      });
      const sortedIndices = Array.from(indices).sort((a, b) => a - b);
      for (const i of sortedIndices) {
        let r, n;
        if (i === 1) {
          r = args.replaceContent1 ?? (args.content_to_replace ?? args.replaceContent);
          n = args.newContent1 ?? (args.content_to_add ?? args.newContent);
        } else {
          r = args[`replaceContent${i}`] ?? args[`content_to_replace${i}`];
          n = args[`newContent${i}`] ?? args[`content_to_add${i}`];
        }
        if (r !== void 0 && n !== void 0) {
          patchPairs.push({ replace: r, new: n });
        } else if (r !== void 0 || n !== void 0) {
          return { error: `Mismatched replacement pair for index ${i}. Both replacement and new content must be provided.` };
        }
      }
      return { patchPairs };
    };
    applyPatches = (content, patches) => {
      let currentFileContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const strip = (t) => t.replace(/^```[\w]*\n?/, "").replace(/```\s*$/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const getIndent = (line) => line.match(/^\s*/)[0];
      const getMinIndent = (text) => {
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return "";
        let min = getIndent(lines[0]);
        for (const line of lines) {
          const indent = getIndent(line);
          if (indent.length < min.length) min = indent;
        }
        return min;
      };
      const adjustIndentation = (newText, originalMatch, leadingContext = "") => {
        if (!newText || originalMatch === void 0) return newText;
        const getIndentStyle = (text) => {
          const lines = text.split("\n").filter((l) => l.trim() !== "");
          if (lines.length === 0) return { char: " ", size: 4 };
          const firstIndent = lines[0].match(/^\s*/)[0];
          if (firstIndent.includes("	")) return { char: "	", size: 1 };
          const indents = lines.map((l) => l.match(/^\s*/)[0].length).filter((l) => l > 0);
          if (indents.length === 0) return { char: " ", size: firstIndent.length || 4 };
          const gcd = (a, b) => b ? gcd(b, a % b) : a;
          const step = indents.reduce((a, b) => gcd(a, b));
          return { char: " ", size: step || 4 };
        };
        const fileStyle = getIndentStyle(originalMatch);
        const modelStyle = getIndentStyle(newText);
        const matchMinIndent = getMinIndent(originalMatch).length;
        const leadingIndent = (leadingContext.match(/^\s*/) || [""])[0].length;
        const targetBaseIndentRaw = leadingIndent + matchMinIndent;
        const targetUnits = targetBaseIndentRaw / fileStyle.size;
        const modelBaseUnits = getMinIndent(newText).length / modelStyle.size;
        const deltaUnits = targetUnits - modelBaseUnits;
        const newLines = newText.split("\n");
        return newLines.map((line, i) => {
          if (line.trim() === "" && i !== 0) return "";
          const currentLineUnits = line.match(/^\s*/)[0].length / modelStyle.size;
          const finalUnits = Math.max(0, currentLineUnits + deltaUnits);
          let unitCount = finalUnits;
          if (i === 0) {
            const leadingUnits = leadingIndent / fileStyle.size;
            unitCount = Math.max(0, finalUnits - leadingUnits);
          }
          return fileStyle.char.repeat(unitCount * fileStyle.size) + line.trimStart();
        }).join("\n");
      };
      const patchMatches = [];
      for (let i = 0; i < patches.length; i++) {
        const pair = patches[i];
        const content_to_replace = strip(pair.replace || "");
        const content_to_add = strip(pair.new || "");
        if (content_to_replace === "" && content_to_add === "") {
          patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Empty replace and add content.` });
          continue;
        }
        const exactPattern = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let matchRegex = null;
        if (content_to_replace !== "" && currentFileContent.includes(content_to_replace)) {
          matchRegex = new RegExp(exactPattern, "g");
        } else {
          const fuzzyLines = content_to_replace.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"));
          if (fuzzyLines.length > 0) {
            const fuzzyPattern = fuzzyLines.join("\\s*");
            try {
              matchRegex = new RegExp(fuzzyPattern, "g");
            } catch (e) {
              matchRegex = new RegExp(exactPattern, "g");
            }
          } else {
            matchRegex = new RegExp(exactPattern, "g");
          }
        }
        const matches = [...currentFileContent.matchAll(matchRegex)];
        if (matches.length === 0) {
          patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Could not find match.` });
          continue;
        }
        if (matches.length > 1) {
          patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Found ${matches.length} matches (must be unique).` });
          continue;
        }
        patchMatches.push({
          index: i,
          success: true,
          startPos: matches[0].index,
          firstMatchContent: matches[0][0],
          content_to_add
        });
      }
      const successful = patchMatches.filter((m) => m.success).sort((a, b) => a.startPos - b.startPos);
      for (let j = 0; j < successful.length - 1; j++) {
        const curr = successful[j];
        const next = successful[j + 1];
        if (curr.startPos + curr.firstMatchContent.length > next.startPos) {
          curr.success = false;
          curr.error = `Block ${curr.index + 1}: Overlaps with another block.`;
          next.success = false;
          next.error = `Block ${next.index + 1}: Overlaps with another block.`;
        }
      }
      const resultsMap = /* @__PURE__ */ new Map();
      let finalContent = currentFileContent;
      let charOffset = 0;
      let lineOffset = 0;
      const toApply = patchMatches.filter((m) => m.success).sort((a, b) => a.startPos - b.startPos);
      for (const match of toApply) {
        const originalStartPos = match.startPos;
        const originalStartLine = currentFileContent.substring(0, originalStartPos).split("\n").length;
        const finalStartPos = originalStartPos + charOffset;
        const finalStartLine = originalStartLine + lineOffset;
        const lineStart = finalContent.lastIndexOf("\n", finalStartPos) + 1;
        const leadingContext = finalContent.substring(lineStart, finalStartPos);
        const finalReplacement = adjustIndentation(match.content_to_add, match.firstMatchContent, leadingContext);
        const allLines = finalContent.split("\n");
        const contextBefore = [];
        for (let j = Math.max(0, finalStartLine - 4); j < finalStartLine - 1; j++) {
          contextBefore.push({ num: j + 1, text: allLines[j] });
        }
        const patchOldLines = match.firstMatchContent.split("\n");
        const contextAfter = [];
        const patchEndLineIdx = finalStartLine + patchOldLines.length - 1;
        for (let j = patchEndLineIdx; j < Math.min(allLines.length, patchEndLineIdx + 3); j++) {
          contextAfter.push({ num: j + 1, text: allLines[j] });
        }
        resultsMap.set(match.index, {
          success: true,
          oldContent: match.firstMatchContent,
          newContent: finalReplacement,
          originalStartLine,
          finalStartLine,
          contextBefore,
          contextAfter
        });
        finalContent = finalContent.substring(0, finalStartPos) + finalReplacement + finalContent.substring(finalStartPos + match.firstMatchContent.length);
        charOffset += finalReplacement.length - match.firstMatchContent.length;
        lineOffset += finalReplacement.split("\n").length - match.firstMatchContent.split("\n").length;
      }
      const results = [];
      for (let i = 0; i < patches.length; i++) {
        if (resultsMap.has(i)) {
          results.push(resultsMap.get(i));
        } else {
          const match = patchMatches.find((m) => m.index === i);
          results.push({
            success: false,
            error: match ? match.error : `Block ${i + 1}: Unknown error.`
          });
        }
      }
      return { content: finalContent, results };
    };
    generateHighFidelityDiff = (originalContent, finalContent, patchResults, threshold = 8) => {
      if (!patchResults || patchResults.length === 0) return "";
      const allLinesOriginal = originalContent.split(/\r?\n/);
      const allLinesFinal = finalContent.split(/\r?\n/);
      let diffText = `[DIFF_START]
`;
      const separatorLine = "\u2550".repeat(88);
      let currentFinalLineIdx = 0;
      let lastSuccessfulHunk = null;
      const sortedResults = patchResults.filter((res) => res.success).sort((a, b) => a.originalStartLine - b.originalStartLine);
      sortedResults.forEach((res, idx) => {
        const startLineFinal = res.finalStartLine !== void 0 ? res.finalStartLine : res.originalStartLine;
        if (lastSuccessfulHunk === null) {
          const contextStart = Math.max(0, startLineFinal - 4);
          currentFinalLineIdx = contextStart;
          while (currentFinalLineIdx < startLineFinal - 1) {
            diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ""}
`;
            currentFinalLineIdx++;
          }
        } else {
          const prev = lastSuccessfulHunk;
          const prevOriginalEnd = prev.originalStartLine + prev.oldContent.split("\n").length - 1;
          const gap = res.originalStartLine - prevOriginalEnd - 1;
          if (gap >= threshold) {
            let afterLimit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
            while (currentFinalLineIdx < afterLimit) {
              diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ""}
`;
              currentFinalLineIdx++;
            }
            diffText += `[UI_CONTEXT] ${separatorLine}
`;
            const beforeStart = Math.max(currentFinalLineIdx, startLineFinal - 4);
            currentFinalLineIdx = beforeStart;
            while (currentFinalLineIdx < startLineFinal - 1) {
              diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ""}
`;
              currentFinalLineIdx++;
            }
          } else {
            while (currentFinalLineIdx < startLineFinal - 1) {
              diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ""}
`;
              currentFinalLineIdx++;
            }
          }
        }
        const oldLines = res.oldContent.split("\n");
        oldLines.forEach((line, i) => {
          diffText += `-${res.originalStartLine + i}|${line}
`;
        });
        let hunkEndInFinal = currentFinalLineIdx;
        if (res.finalStartLine !== void 0) {
          hunkEndInFinal = res.finalStartLine - 1 + (res.newContent ? res.newContent.split("\n").length : 0);
        } else {
          const originalResyncLineIdx = res.originalStartLine + oldLines.length - 1;
          const resyncAnchorText = allLinesOriginal[originalResyncLineIdx] || null;
          if (resyncAnchorText !== null) {
            const lookAheadLimit = idx < sortedResults.length - 1 ? (sortedResults[idx + 1].originalStartLine || allLinesFinal.length) + 10 : allLinesFinal.length;
            for (let s = currentFinalLineIdx; s < lookAheadLimit; s++) {
              if (allLinesFinal[s] === resyncAnchorText) {
                hunkEndInFinal = s;
                break;
              }
              if (s === allLinesFinal.length - 1) hunkEndInFinal = allLinesFinal.length;
            }
          } else {
            hunkEndInFinal = allLinesFinal.length;
          }
        }
        while (currentFinalLineIdx < hunkEndInFinal) {
          diffText += `+${currentFinalLineIdx + 1}|${allLinesFinal[currentFinalLineIdx] || ""}
`;
          currentFinalLineIdx++;
        }
        lastSuccessfulHunk = res;
      });
      if (lastSuccessfulHunk !== null) {
        let limit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
        while (currentFinalLineIdx < limit) {
          diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ""}
`;
          currentFinalLineIdx++;
        }
      }
      diffText += `[DIFF_END]`;
      return diffText;
    };
    parseLineInfo = (l) => {
      if (!l) return null;
      const clean = l.replace("[UI_CONTEXT]", "").replace(/\r/g, "");
      const isR = clean.startsWith("-");
      const isA = clean.startsWith("+");
      let rest = isR || isA ? clean.substring(1) : clean;
      rest = rest.trim();
      const splitIdx = rest.indexOf("|");
      const num = splitIdx !== -1 ? rest.substring(0, splitIdx).trim() : "";
      const content = splitIdx !== -1 ? rest.substring(splitIdx + 1) : rest;
      return { isR, isA, num, content };
    };
    getSimilarity = (s1, s2) => {
      if (!s1 && !s2) return 1;
      if (!s1 || !s2) return 0;
      const l1 = s1.length;
      const l2 = s2.length;
      const dp = Array.from({ length: l1 + 1 }, () => Array(l2 + 1).fill(0));
      for (let i = 0; i <= l1; i++) dp[i][0] = i;
      for (let j = 0; j <= l2; j++) dp[0][j] = j;
      for (let i = 1; i <= l1; i++) {
        for (let j = 1; j <= l2; j++) {
          if (s1[i - 1] === s2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
          }
        }
      }
      const maxLen = Math.max(l1, l2);
      if (maxLen === 0) return 1;
      return 1 - dp[l1][l2] / maxLen;
    };
    alignChangeGroup = (group) => {
      const removals = [];
      const additions = [];
      group.forEach((item, index) => {
        if (item.parsed.isR) {
          removals.push({ index, content: item.parsed.content });
        } else if (item.parsed.isA) {
          additions.push({ index, content: item.parsed.content });
        }
      });
      const N = removals.length;
      const M = additions.length;
      if (N === 0 || M === 0) return;
      const dp = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
      const choices = Array.from({ length: N + 1 }, () => Array(M + 1).fill(""));
      for (let i2 = 1; i2 <= N; i2++) choices[i2][0] = "up";
      for (let j2 = 1; j2 <= M; j2++) choices[0][j2] = "left";
      const simMatrix = Array.from({ length: N }, () => Array(M).fill(0));
      for (let i2 = 0; i2 < N; i2++) {
        for (let j2 = 0; j2 < M; j2++) {
          simMatrix[i2][j2] = getSimilarity(removals[i2].content.trim(), additions[j2].content.trim());
        }
      }
      for (let i2 = 1; i2 <= N; i2++) {
        for (let j2 = 1; j2 <= M; j2++) {
          const matchScore = simMatrix[i2 - 1][j2 - 1];
          const score = matchScore >= 0.2 ? matchScore : -10;
          const diag = dp[i2 - 1][j2 - 1] + score;
          const up = dp[i2 - 1][j2];
          const left = dp[i2][j2 - 1];
          if (diag >= up && diag >= left) {
            dp[i2][j2] = diag;
            choices[i2][j2] = "diag";
          } else if (up >= left) {
            dp[i2][j2] = up;
            choices[i2][j2] = "up";
          } else {
            dp[i2][j2] = left;
            choices[i2][j2] = "left";
          }
        }
      }
      let i = N;
      let j = M;
      while (i > 0 || j > 0) {
        if (choices[i][j] === "diag") {
          const matchScore = simMatrix[i - 1][j - 1];
          if (matchScore >= 0.2) {
            const rIdx = removals[i - 1].index;
            const aIdx = additions[j - 1].index;
            group[rIdx].pairContent = group[aIdx].parsed.content;
            group[aIdx].pairContent = group[rIdx].parsed.content;
          }
          i--;
          j--;
        } else if (choices[i][j] === "up") {
          i--;
        } else {
          j--;
        }
      }
    };
    blocksCache = /* @__PURE__ */ new Map();
    streamingBlocksCache = /* @__PURE__ */ new Map();
    MAX_CACHE_SIZE = 200;
    CHUNK_SIZE = 6;
    indexBlockIntoMap = (b, map) => {
      map.set(b.key, b);
      if (b.type === "chunk" && b.blocks) b.blocks.forEach((sub) => indexBlockIntoMap(sub, map));
    };
    parseMessageToBlocks = (msg, columns) => {
      if (!msg) return { completed: [], active: [] };
      const cacheKey = `${msg.id}-${msg.text?.length || 0}-${columns}-${msg.isStreaming}`;
      if (!msg.isStreaming && blocksCache.has(cacheKey)) {
        return blocksCache.get(cacheKey);
      }
      const text = cleanSignals(msg.text || "");
      const streamCacheKey = `${msg.id}-${columns}`;
      let cachedBlocks = /* @__PURE__ */ new Map();
      if (msg.isStreaming) {
        const cached = streamingBlocksCache.get(streamCacheKey);
        if (cached && text.startsWith(cached.text)) {
          cachedBlocks = cached.blocksMap;
        }
      }
      const getBlock = (key, type, textContent, extra = {}) => {
        const existing = cachedBlocks.get(key);
        if (existing && existing.text === textContent && existing.type === type && !!existing.isActiveBlock === !!extra.isActiveBlock && !!existing.isStreaming === !!extra.isStreaming && existing.pairContent === extra.pairContent) {
          return existing;
        }
        const flatText = typeof textContent === "string" ? (" " + textContent).slice(1) : textContent;
        const flatExtra = { ...extra };
        if (typeof flatExtra.pairContent === "string") {
          flatExtra.pairContent = (" " + flatExtra.pairContent).slice(1);
        }
        if (Array.isArray(flatExtra.wrappedLines)) {
          flatExtra.wrappedLines = flatExtra.wrappedLines.map((l) => typeof l === "string" ? (" " + l).slice(1) : l);
        }
        return {
          key,
          isStreamingMsg: !!msg.isStreaming,
          workedDuration: msg.workedDuration,
          type,
          text: flatText,
          msg: type === "full-message" ? msg : void 0,
          // Only full-message requires role/meta checks
          ...flatExtra
        };
      };
      if (text.includes("- Content Preview:")) {
        let extension = "";
        const fileMatch = text.match(/File\s+\[(.*?)\]/i);
        if (fileMatch) {
          extension = fileMatch[1].split(".").pop().toLowerCase();
        }
        const mainParts = text.split("- Content Preview:");
        const contentPart = mainParts[1] || "";
        const footerMarker = "[SYSTEM] Check the content preview for verification [/SYSTEM]";
        const content = contentPart.split(footerMarker)[0]?.trim() || "";
        const codeLines = content.split("\n").map((l) => l.replace(/\r$/, ""));
        const gutterWidth = String(codeLines.length).length;
        const completedBlocks2 = [];
        let activeBlock2 = null;
        let writeChunk = [];
        const flushWrite = () => {
          if (!writeChunk.length) return;
          const batch = writeChunk;
          writeChunk = [];
          completedBlocks2.push(batch.length === 1 ? batch[0] : {
            key: `${batch[0].key}-chunk`,
            type: "chunk",
            blocks: batch
          });
        };
        const innerWidth = columns - (gutterWidth + 6);
        codeLines.forEach((line, idx) => {
          const isLast = idx === codeLines.length - 1;
          const wrappedLines = wrapText(line, innerWidth).split("\n");
          const block = getBlock(`${msg.id || Date.now()}-write-line-${idx}`, "write-line", line, {
            gutterWidth,
            lineNum: idx + 1,
            isFirstLine: idx === 0,
            isLastLine: isLast,
            extension,
            wrappedLines
          });
          if (isLast && msg.isStreaming) {
            flushWrite();
            activeBlock2 = block;
          } else {
            writeChunk.push(block);
            if (writeChunk.length >= CHUNK_SIZE) flushWrite();
          }
        });
        flushWrite();
        return { completed: completedBlocks2, active: activeBlock2 ? [activeBlock2] : [] };
      }
      if (text.includes("[DIFF_START]")) {
        const match = text.match(/\[DIFF_START\]([\s\S]*?)(?:\[DIFF_END\]|$)/);
        const diffBody = match ? match[1].trim() : "";
        const diffLines = diffBody.split("\n").map((l) => l.replace(/\r$/, ""));
        const parsedLines = diffLines.map((line) => ({ line, parsed: parseLineInfo(line), pairContent: null }));
        let currentGroup = [];
        for (let i = 0; i < parsedLines.length; i++) {
          const item = parsedLines[i];
          if (item.parsed && (item.parsed.isR || item.parsed.isA)) {
            currentGroup.push(item);
          } else {
            if (currentGroup.length > 0) {
              alignChangeGroup(currentGroup);
              currentGroup = [];
            }
          }
        }
        if (currentGroup.length > 0) alignChangeGroup(currentGroup);
        const completedBlocks2 = [];
        let activeBlock2 = null;
        let diffChunk = [];
        const flushDiff = () => {
          if (!diffChunk.length) return;
          const batch = diffChunk;
          diffChunk = [];
          completedBlocks2.push(batch.length === 1 ? batch[0] : {
            key: `${batch[0].key}-chunk`,
            type: "chunk",
            blocks: batch
          });
        };
        diffLines.forEach((line, i) => {
          const isLast = i === diffLines.length - 1;
          const parsed = parsedLines[i].parsed;
          let wrappedLines = null;
          if (parsed) {
            wrappedLines = wrapText(parsed.content, columns - 17).split("\n");
          }
          const block = getBlock(`${msg.id || Date.now()}-diff-${i}`, "diff-line", line, {
            isFirstLine: i === 0,
            isLastLine: isLast,
            pairContent: parsedLines[i].pairContent,
            wrappedLines
          });
          if (isLast && msg.isStreaming) {
            flushDiff();
            activeBlock2 = block;
          } else {
            diffChunk.push(block);
            if (diffChunk.length >= CHUNK_SIZE) flushDiff();
          }
        });
        flushDiff();
        return { completed: completedBlocks2, active: activeBlock2 ? [activeBlock2] : [] };
      }
      if (msg.role === "system" || msg.isLogo || msg.isHelpRecord || msg.isTerminalRecord || msg.isHomeWarning || msg.isImageStats || msg.isAskRecord || msg.isAboutRecord || msg.isUpdateNotification || msg.role === "user") {
        return {
          completed: [getBlock(`${msg.id || Date.now()}-full`, "full-message", text)],
          active: []
        };
      }
      const completedBlocks = [];
      let activeBlock = null;
      let pendingChunk = [];
      let pendingChunkType = null;
      const flushPending = () => {
        if (!pendingChunk.length) return;
        const batch = pendingChunk;
        pendingChunk = [];
        pendingChunkType = null;
        completedBlocks.push(batch.length === 1 ? batch[0] : {
          key: `${msg.id || "x"}-chunk-${batch[0].key}`,
          type: "chunk",
          blocks: batch
        });
      };
      const enqueue = (block, isLastOfMessage = false) => {
        if (pendingChunkType !== null && pendingChunkType !== block.type) flushPending();
        pendingChunk.push(block);
        pendingChunkType = block.type;
        if (pendingChunk.length >= CHUNK_SIZE) {
          if (msg.isStreaming && isLastOfMessage) return;
          flushPending();
        }
      };
      if (msg.role === "think") {
        completedBlocks.push(getBlock(`${msg.id}-header`, "think-header", ""));
        const lines = text.split("\n");
        lines.forEach((line, idx) => {
          const isLast = idx === lines.length - 1;
          enqueue(getBlock(`${msg.id}-${idx}`, "think-line", line, {}), isLast);
        });
        if (!msg.isStreaming) {
          flushPending();
          completedBlocks.push({ key: `${msg.id}-footer-padding`, type: "think-footer-padding", text: "" });
        }
      } else {
        const lines = text.split("\n");
        let inTable = false;
        let tableLines = [];
        let inCodeBlock = false;
        let currentLang = "";
        let codeLineNum = 0;
        let codeStartIdx = 0;
        lines.forEach((line, idx) => {
          const isLast = idx === lines.length - 1;
          const isTableRow = line.trim().startsWith("|");
          const isCodeBlockMarker = line.trim().startsWith("```");
          if (inCodeBlock) {
            if (isCodeBlockMarker) {
              inCodeBlock = false;
              enqueue(getBlock(`${msg.id}-code-close-${codeStartIdx}`, "code-fence-close", "", {}), isLast);
            } else {
              codeLineNum++;
              enqueue(getBlock(`${msg.id}-code-line-${idx}`, "code-line", line, { lineNum: codeLineNum, lang: currentLang }), isLast);
            }
          } else if (isCodeBlockMarker) {
            inCodeBlock = true;
            codeStartIdx = idx;
            codeLineNum = 0;
            currentLang = line.trim().replace(/^```/, "").trim();
            enqueue(getBlock(`${msg.id}-code-open-${idx}`, "code-fence-open", currentLang, {}), isLast);
          } else if (isTableRow) {
            inTable = true;
            tableLines.push(line);
            if (isLast) {
              flushPending();
              if (msg.isStreaming) {
                activeBlock = getBlock(`${msg.id}-table-${idx}`, "table", tableLines.join("\n"), { isStreaming: true });
              } else {
                completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, "table", tableLines.join("\n"), { isStreaming: false }));
              }
            }
          } else {
            if (inTable) {
              flushPending();
              completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, "table", tableLines.join("\n"), { isStreaming: false }));
              inTable = false;
              tableLines = [];
            }
            enqueue(getBlock(`${msg.id}-${idx}`, "agent-line", line, {}), isLast);
          }
        });
        if (!msg.isStreaming && msg.workedDuration) {
          flushPending();
          completedBlocks.push(getBlock(`${msg.id}-worked-duration`, "worked-duration", ""));
        }
      }
      if (msg.isStreaming && pendingChunk.length > 0) {
        activeBlock = pendingChunk.length === 1 ? pendingChunk[0] : {
          key: `${msg.id || "x"}-chunk-active-${pendingChunk[0].key}`,
          type: "chunk",
          blocks: pendingChunk
        };
      } else {
        flushPending();
      }
      const result = {
        completed: completedBlocks,
        active: activeBlock ? [activeBlock] : []
      };
      if (!msg.isStreaming) {
        blocksCache.set(cacheKey, result);
        if (blocksCache.size > MAX_CACHE_SIZE) {
          const firstKey = blocksCache.keys().next().value;
          blocksCache.delete(firstKey);
        }
        streamingBlocksCache.delete(streamCacheKey);
      } else {
        const blocksMap = /* @__PURE__ */ new Map();
        completedBlocks.forEach((b) => indexBlockIntoMap(b, blocksMap));
        if (activeBlock) indexBlockIntoMap(activeBlock, blocksMap);
        streamingBlocksCache.set(streamCacheKey, { text, blocksMap });
        if (streamingBlocksCache.size > MAX_CACHE_SIZE) {
          const firstKey = streamingBlocksCache.keys().next().value;
          streamingBlocksCache.delete(firstKey);
        }
      }
      return result;
    };
    TOOL_LABELS = {
      "write_file": "WriteFile",
      "update_file": "UpdateFile",
      "read_folder": "ReadFolder",
      "view_file": "ViewFile",
      "exec_command": "ExecuteCommand",
      "web_search": "WebSearch",
      "web_scrape": "ReadSite",
      "search_keyword": "SearchKeyword",
      "write_pdf": "CreatePDF",
      "write_docx": "CreateDocument",
      "generate_image": "GenerateImage",
      // PascalCase Support
      "WriteFile": "WriteFile",
      "PatchFile": "PatchFile",
      "ReadFolder": "ReadFolder",
      "ReadFile": "ReadFile",
      "Run": "RunCommand",
      "WebSearch": "WebSearch",
      "WebScrape": "WebScrape",
      "SearchKeyword": "SearchKeyword",
      "WritePDF": "WritePDF",
      "WriteDoc": "WriteDoc",
      "Memory": "Memory",
      "Chat": "Chat",
      "GenerateImage": "GenerateImage"
    };
    REGEX_INITIAL_THINK = /<\/think>(\r?\n){2}/gi;
    REGEX_INITIAL_TOOL = /(\r?\n){2}(?=\[?(?:tool:functions|tool\.functions|agent:generalist|agent\.generalist|\s*turn\s*:))/gi;
    REGEX_CLEAN_SIGNALS = /\[SYSTEM\][\s\S]*?\[\/SYSTEM\]|<(think|thought)>[\s\S]*?(?:<\/(think|thought)>|$)|\[ANSWER\][\s\S]*?(?:\[\/ANSWER\]|$)|\[TOOL RESULT\]:?\s*|^\s*(SUCCESS|ERROR):.*(\r?\n)?|\[\s*turn\s*:\s*(continue|finish)\s*\]|\[\[END\]\]|\[\s*turn\s*:?.*?$|\n\s*turn\s*:?.*?$|\[\s*$|\n\nResponded on .*|\n\n\[Prompted on: .*\]|@\[TerminalName:.*?, ProcessId:.*?\]/gmi;
    REGEX_ARROWS_ALL = /(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)|(\$?\\?\/?\\leftarrow\$?|\$\\leftarrow\$)|(\$?\\?\/?\\uparrow\$?|\$\\uparrow\$)|(\$?\\?\/?\\downarrow\$?|\$\\downarrow\$)|(\$?\\?\/?\\leftrightarrow\$?|\$\\leftrightarrow\$)/gi;
    REGEX_TOOLS = /\b(write_file|update_file|read_folder|view_file|exec_command|web_search|web_scrape|search_keyword|write_pdf|write_docx|generate_image)\b/gi;
    cleanSignals = (text) => {
      if (!text) return text;
      let result = text.replace(REGEX_INITIAL_THINK, "</think>").replace(REGEX_INITIAL_TOOL, "");
      const trigger = "tool:functions.";
      const subagentTrigger = "agent:generalist.";
      if (result.toLowerCase().includes(trigger) || result.toLowerCase().includes(subagentTrigger)) {
        while (true) {
          const lowerResult = result.toLowerCase();
          let triggerIdx = lowerResult.indexOf(trigger);
          let subagentIdx = lowerResult.indexOf(subagentTrigger);
          let currentTrigger = trigger;
          let triggerIdxToUse = triggerIdx;
          if (triggerIdx === -1 || subagentIdx !== -1 && subagentIdx < triggerIdx) {
            currentTrigger = subagentTrigger;
            triggerIdxToUse = subagentIdx;
          }
          if (triggerIdxToUse === -1) break;
          let startIdx = triggerIdxToUse;
          let hasOuterBracket = false;
          let k = triggerIdxToUse - 1;
          while (k >= 0 && /\s/.test(result[k])) k--;
          if (k >= 0 && result[k] === "[") {
            startIdx = k;
            hasOuterBracket = true;
          }
          let balance = 0;
          let foundStart = false;
          let inString = null;
          let j = triggerIdxToUse;
          while (j < result.length) {
            const char = result[j];
            if (!inString && (char === "'" || char === '"' || char === "`")) {
              inString = char;
            } else if (inString && char === inString && result[j - 1] !== "\\") {
              inString = null;
            }
            if (!inString) {
              if (char === "(") {
                balance++;
                foundStart = true;
              } else if (char === ")") {
                balance--;
              }
            }
            if (foundStart && balance === 0 && !inString) {
              let endIdx = j;
              if (hasOuterBracket) {
                let m = j + 1;
                while (m < result.length && /\s/.test(result[m])) m++;
                if (m < result.length && result[m] === "]") {
                  endIdx = m;
                }
              }
              result = result.substring(0, startIdx) + result.substring(endIdx + 1);
              break;
            }
            j++;
            if (j === result.length) {
              result = result.substring(0, startIdx);
              return result;
            }
          }
        }
      }
      result = result.replace(REGEX_CLEAN_SIGNALS, "");
      result = result.replace(REGEX_ARROWS_ALL, (match) => {
        const lower = match.toLowerCase();
        if (lower.includes("leftrightarrow")) return "\u2194";
        if (lower.includes("rightarrow")) return "\u2192";
        if (lower.includes("leftarrow")) return "\u2190";
        if (lower.includes("uparrow")) return "\u2191";
        if (lower.includes("downarrow")) return "\u2193";
        return match;
      });
      result = result.replace(REGEX_TOOLS, (match) => TOOL_LABELS[match.toLowerCase()] || match);
      return result.trim();
    };
    clearBlocksCache = () => {
      blocksCache.clear();
      streamingBlocksCache.clear();
    };
  }
});

// src/components/MultilineInput.jsx
import React2, { useState as useState2, useEffect as useEffect2, useMemo, useCallback, useRef } from "react";
import { Box, Text as Text2, useInput } from "ink";
function expandTabs(text, tabSize) {
  return text.replace(/\t/g, " ".repeat(tabSize));
}
function normalizeLineEndings(text) {
  if (text == null) return "";
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function formattedToRaw(formattedIdx, pasteBlocks, value) {
  let rawIdx = formattedIdx;
  const sortedBlocks = [...pasteBlocks].sort((a, b) => a.start - b.start);
  let currentFormattedOffset = 0;
  for (const block of sortedBlocks) {
    const formattedStart = block.start - currentFormattedOffset;
    const lines = normalizeLineEndings(block.text).split("\n").length;
    const chars = block.text.length;
    const placeholderLength = (lines > 3 ? `[Pasted ${lines} lines]` : `[Pasted ${chars} chars]`).length;
    const formattedEnd = formattedStart + placeholderLength;
    if (formattedIdx <= formattedStart) {
      break;
    } else if (formattedIdx < formattedEnd) {
      rawIdx = block.end;
      break;
    } else {
      const delta = block.text.length - placeholderLength;
      rawIdx += delta;
      currentFormattedOffset += delta;
    }
  }
  return Math.min(rawIdx, value.length);
}
function computeVisualMatrix(value, cursorIndex, wrapWidth, formatText, pasteBlocks = []) {
  const textBefore = (value || "").slice(0, cursorIndex);
  let visualCursorIdx = formatText(textBefore).length;
  let fullFormatted = formatText(value || "");
  const sortedBlocks = [...pasteBlocks].sort((a, b) => b.start - a.start);
  for (const block of sortedBlocks) {
    const formattedStart = formatText(value.slice(0, block.start)).length;
    const formattedPasted = formatText(block.text);
    const formattedEnd = formattedStart + formattedPasted.length;
    const lines = normalizeLineEndings(block.text).split("\n").length;
    const chars = block.text.length;
    const placeholderText = lines > 3 ? `[Pasted ${lines} lines]` : `[Pasted ${chars} chars]`;
    fullFormatted = fullFormatted.slice(0, formattedStart) + placeholderText + fullFormatted.slice(formattedEnd);
    if (visualCursorIdx > formattedStart && visualCursorIdx < formattedEnd) {
      visualCursorIdx = formattedStart + placeholderText.length;
    } else if (visualCursorIdx >= formattedEnd) {
      visualCursorIdx = visualCursorIdx - (formattedEnd - formattedStart) + placeholderText.length;
    }
  }
  const literalLines = fullFormatted.split("\n");
  const visualLines = [];
  let currentIdx = 0;
  let cursorLine = 0;
  let cursorCol = 0;
  let foundCursor = false;
  for (let i = 0; i < literalLines.length; i++) {
    const line = literalLines[i];
    if (line.length === 0) {
      if (!foundCursor && visualCursorIdx === currentIdx) {
        cursorLine = visualLines.length;
        cursorCol = 0;
        foundCursor = true;
      }
      visualLines.push({ text: "", globalStart: formattedToRaw(currentIdx, pasteBlocks, value), formattedStart: currentIdx });
      currentIdx += 1;
      continue;
    }
    const wrapped = wrapText(line, wrapWidth);
    const wrappedLines = wrapped.split("\n");
    let lastMatchEnd = 0;
    const chunks = [];
    for (let j = 0; j < wrappedLines.length; j++) {
      const wLine = wrappedLines[j];
      const trimmed = wLine.trim();
      if (trimmed.length === 0) {
        const spaceLength = wLine.length || 1;
        chunks.push({
          text: wLine,
          start: lastMatchEnd,
          length: spaceLength
        });
        lastMatchEnd += spaceLength;
      } else {
        const idx = line.indexOf(trimmed, lastMatchEnd);
        if (idx !== -1) {
          const start = lastMatchEnd;
          const nextTrimmed = j < wrappedLines.length - 1 ? wrappedLines[j + 1].trim() : "";
          let end = line.length;
          if (nextTrimmed.length > 0) {
            const nextIdx = line.indexOf(nextTrimmed, idx + trimmed.length);
            if (nextIdx !== -1) {
              end = nextIdx;
            }
          }
          chunks.push({
            text: line.slice(start, end),
            start,
            length: end - start
          });
          lastMatchEnd = end;
        } else {
          chunks.push({
            text: wLine,
            start: lastMatchEnd,
            length: wLine.length
          });
          lastMatchEnd += wLine.length;
        }
      }
    }
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkObj = chunks[idx];
      const chunk = chunkObj.text;
      const chunkStart = currentIdx + chunkObj.start;
      const chunkEnd = chunkStart + chunkObj.length;
      if (!foundCursor && visualCursorIdx >= chunkStart && (visualCursorIdx < chunkEnd || visualCursorIdx === chunkEnd && idx === chunks.length - 1)) {
        cursorLine = visualLines.length;
        cursorCol = visualCursorIdx - chunkStart;
        foundCursor = true;
      }
      visualLines.push({
        text: chunk,
        globalStart: formattedToRaw(chunkStart, pasteBlocks, value),
        formattedStart: chunkStart
      });
    }
    currentIdx += line.length + 1;
  }
  if (!foundCursor) {
    if (visualLines.length === 0) {
      visualLines.push({ text: "", globalStart: 0, formattedStart: 0 });
    } else {
      if (fullFormatted.endsWith("\n")) {
        visualLines.push({
          text: "",
          globalStart: formattedToRaw(currentIdx, pasteBlocks, value),
          formattedStart: currentIdx
        });
        cursorLine = visualLines.length - 1;
        cursorCol = 0;
      } else {
        cursorLine = visualLines.length - 1;
        cursorCol = visualLines[cursorLine].text.length;
      }
    }
  }
  return { visualLines, cursorLine, cursorCol };
}
var ControlledMultilineInput, MultilineInput;
var init_MultilineInput = __esm({
  "src/components/MultilineInput.jsx"() {
    init_text();
    ControlledMultilineInput = ({
      value,
      rows,
      maxRows,
      highlightStyle,
      textStyle,
      placeholder = "",
      mask,
      showCursor = true,
      focus = true,
      tabSize = 4,
      cursorIndex = 0,
      highlight,
      columns = 80,
      pasteBlocks = []
    }) => {
      const scrollOffsetRef = useRef(0);
      const wrapWidth = useMemo(() => Math.max(20, columns - 10), [columns]);
      const formatText = useCallback(
        (text, isPlaceholder = false) => {
          const normalized = normalizeLineEndings(text);
          if (!isPlaceholder && mask) {
            return normalized.replace(/[^\n]/g, mask);
          }
          const expanded = expandTabs(normalized, tabSize);
          if (isPlaceholder) return expanded;
          return expanded.replace(/@\[(.*?)\]/g, (match, p1) => {
            const hashIdx = p1.indexOf("#");
            const colonIdx = p1.indexOf(":L");
            let pathOnly = p1;
            let suffix = "";
            if (hashIdx !== -1) {
              pathOnly = p1.slice(0, hashIdx);
              suffix = p1.slice(hashIdx);
            } else if (colonIdx !== -1) {
              pathOnly = p1.slice(0, colonIdx);
              suffix = p1.slice(colonIdx);
            }
            let rel = pathOnly.replace(/\\/g, "/");
            const cwd = (process.cwd() || "").replace(/\\/g, "/");
            if (cwd && rel.toLowerCase().startsWith(cwd.toLowerCase() + "/")) {
              rel = rel.slice(cwd.length + 1);
            } else if (rel.startsWith("./")) {
              rel = rel.slice(2);
            }
            const parts = rel.split("/");
            const basename = parts[parts.length - 1];
            return `[${basename}${suffix}]`;
          });
        },
        [tabSize, mask]
      );
      const { visualLines, cursorLine, cursorCol } = useMemo(() => {
        return computeVisualMatrix(value, cursorIndex, wrapWidth, formatText, pasteBlocks);
      }, [value, cursorIndex, wrapWidth, formatText, pasteBlocks]);
      const contentHeight = visualLines.length;
      const visibleRows = useMemo(() => {
        return Math.max(rows ?? maxRows ?? 1, Math.min(maxRows ?? rows ?? 1, contentHeight));
      }, [rows, maxRows, contentHeight]);
      const cursorLineEnd = cursorLine + 1;
      const viewportEnd = scrollOffsetRef.current + visibleRows;
      let newScrollOffset = scrollOffsetRef.current;
      if (cursorLineEnd <= scrollOffsetRef.current) {
        newScrollOffset = Math.max(0, cursorLineEnd - 1);
      } else if (cursorLineEnd > viewportEnd) {
        newScrollOffset = cursorLineEnd - visibleRows;
      } else if (contentHeight) {
        if (contentHeight < visibleRows) {
          newScrollOffset = 0;
        } else if (contentHeight < viewportEnd) {
          newScrollOffset = contentHeight - visibleRows;
        }
      }
      scrollOffsetRef.current = newScrollOffset;
      const visibleLines = useMemo(() => {
        return visualLines.slice(newScrollOffset, newScrollOffset + visibleRows);
      }, [visualLines, newScrollOffset, visibleRows]);
      const [blink, setBlink] = useState2(true);
      useEffect2(() => {
        setBlink(true);
        if (!focus || !showCursor) return;
        const timer = setInterval(() => {
          setBlink((prev) => !prev);
        }, 530);
        return () => clearInterval(timer);
      }, [focus, showCursor, value, cursorIndex]);
      const cursorStyle = useMemo(() => ({
        ...textStyle,
        color: showCursor && focus && blink ? "white" : void 0,
        bold: showCursor && focus && blink,
        inverse: showCursor && focus && blink
      }), [textStyle, showCursor, focus, blink]);
      const renderLineText = (text, isCursor, col, cStyle) => {
        if (!text) {
          const emptyText = placeholder && value.length === 0 ? formatText(placeholder, true) : "";
          if (isCursor) {
            const charAtCursor = emptyText[0] || " ";
            const right = emptyText.slice(1);
            return /* @__PURE__ */ React2.createElement(Text2, null, /* @__PURE__ */ React2.createElement(Text2, { ...cStyle }, charAtCursor), /* @__PURE__ */ React2.createElement(Text2, { color: "gray", dimColor: true }, right));
          }
          return /* @__PURE__ */ React2.createElement(Text2, { color: "gray", dimColor: true }, emptyText || " ");
        }
        const regex = /(\[Pasted \d+ (?:lines|chars)\])/g;
        const parts = text.split(regex);
        let currentOffset = 0;
        const rendered = [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part === "") continue;
          const isPlaceholder = part.match(/^\[Pasted \d+ (?:lines|chars)\]$/);
          const partLength = part.length;
          const partEnd = currentOffset + partLength;
          if (isCursor && col >= currentOffset && col < partEnd) {
            const localCol = col - currentOffset;
            const left = part.slice(0, localCol);
            const charAtCursor = part[localCol] || " ";
            const right = part.slice(localCol + 1);
            rendered.push(
              /* @__PURE__ */ React2.createElement(Text2, { key: i }, /* @__PURE__ */ React2.createElement(Text2, { color: isPlaceholder ? "magenta" : void 0 }, left), /* @__PURE__ */ React2.createElement(Text2, { ...cStyle }, charAtCursor), /* @__PURE__ */ React2.createElement(Text2, { color: isPlaceholder ? "magenta" : void 0 }, right))
            );
          } else {
            rendered.push(
              /* @__PURE__ */ React2.createElement(Text2, { key: i, color: isPlaceholder ? "magenta" : void 0 }, part)
            );
          }
          currentOffset = partEnd;
        }
        if (isCursor && col >= text.length) {
          rendered.push(
            /* @__PURE__ */ React2.createElement(Text2, { key: "cursor-end", ...cStyle }, " ")
          );
        }
        return /* @__PURE__ */ React2.createElement(React2.Fragment, null, rendered);
      };
      return /* @__PURE__ */ React2.createElement(Box, { height: visibleRows, width: wrapWidth + 1, overflow: "hidden", flexDirection: "column", flexGrow: 0, flexShrink: 0 }, visibleLines.map((lineObj, idx) => {
        const globalLineIdx = newScrollOffset + idx;
        const isCursorLine = globalLineIdx === cursorLine && focus && showCursor;
        return /* @__PURE__ */ React2.createElement(Text2, { key: globalLineIdx, ...textStyle, wrap: "truncate" }, renderLineText(lineObj.text, isCursorLine, cursorCol, cursorStyle));
      }));
    };
    MultilineInput = ({
      value,
      onChange,
      onSubmit,
      keyBindings,
      showCursor = true,
      highlightPastedText = false,
      focus = true,
      columns = 80,
      useCustomInput = (inputHandler, isActive) => useInput(inputHandler, { isActive }),
      onPasteStateChange,
      ...controlledProps
    }) => {
      const [cursorIndex, setCursorIndex] = useState2(value.length);
      const [pasteLength, setPasteLength] = useState2(0);
      const [pasteBlocks, setPasteBlocks] = useState2([]);
      const cursorIndexRef = useRef(value.length);
      const valueRef = useRef(value);
      const pasteLengthRef = useRef(0);
      const pasteBlocksRef = useRef([]);
      const pasteBufferRef = useRef("");
      const pasteBufferStartRef = useRef(-1);
      const pasteTimerRef = useRef(null);
      const lastArrowTimeRef = useRef(0);
      cursorIndexRef.current = cursorIndex;
      valueRef.current = value;
      pasteLengthRef.current = pasteLength;
      pasteBlocksRef.current = pasteBlocks;
      useEffect2(() => {
        if (cursorIndexRef.current > value.length) {
          cursorIndexRef.current = value.length;
          setCursorIndex(value.length);
        }
        if (!value) {
          setPasteBlocks([]);
          setPasteLength(0);
        } else {
          setPasteBlocks((prev) => prev.filter((b) => b.end <= value.length && b.start <= value.length));
        }
      }, [value]);
      useEffect2(() => {
        onPasteStateChange?.(pasteBlocks.length > 0);
      }, [pasteBlocks, onPasteStateChange]);
      const finalizePasteTransaction = () => {
        const accumulated = pasteBufferRef.current;
        const start = pasteBufferStartRef.current;
        const end = start + accumulated.length;
        const val = valueRef.current;
        const newValue = val.slice(0, start) + accumulated + val.slice(start);
        onChange(newValue);
        cursorIndexRef.current = end;
        setCursorIndex(end);
        setPasteLength(accumulated.length > 1 ? accumulated.length : 0);
        const lines = normalizeLineEndings(accumulated).split("\n").length;
        const chars = accumulated.length;
        if (chars > 50 && (lines > 3 || lines <= 3 && chars > 200)) {
          const newBlock = {
            start,
            end,
            text: accumulated
          };
          setPasteBlocks((prev) => {
            const delta = accumulated.length;
            const adjusted = prev.map((block) => {
              if (start <= block.start) {
                return {
                  ...block,
                  start: block.start + delta,
                  end: block.end + delta
                };
              }
              return block;
            });
            return [...adjusted, newBlock];
          });
        }
        pasteBufferRef.current = "";
        pasteBufferStartRef.current = -1;
        pasteTimerRef.current = null;
      };
      const flushPasteTransaction = () => {
        if (pasteTimerRef.current) {
          clearTimeout(pasteTimerRef.current);
          finalizePasteTransaction();
        }
      };
      useCustomInput((input, key) => {
        if (input === "\x1B[I" || input === "\x1B[O" || input === "[I" || input === "[O") {
          return;
        }
        let cleanInput = input;
        let isBracketedStart = false;
        let isBracketedEnd = false;
        if (cleanInput && typeof cleanInput === "string") {
          if (cleanInput.includes("\x1B[200~")) {
            isBracketedStart = true;
            cleanInput = cleanInput.replace(/\x1b\[200~/g, "");
          }
          if (cleanInput.includes("\x1B[201~")) {
            isBracketedEnd = true;
            cleanInput = cleanInput.replace(/\x1b\[201~/g, "");
          }
        }
        const curIdx = cursorIndexRef.current;
        const val = valueRef.current;
        const currentPasteBlocks = pasteBlocksRef.current;
        const wrapWidth = Math.max(20, columns - 10);
        const adjustPasteBlocksOnEdit = (editStart, delta) => {
          if (currentPasteBlocks.length === 0) return;
          const updated = currentPasteBlocks.map((block) => {
            if (editStart <= block.start) {
              return {
                ...block,
                start: block.start + delta,
                end: block.end + delta
              };
            }
            if (editStart > block.start && editStart < block.end) {
              return null;
            }
            return block;
          }).filter(Boolean);
          setPasteBlocks(updated);
        };
        const adjustIndex = (idx) => {
          for (const block of currentPasteBlocks) {
            if (idx > block.start && idx < block.end) {
              return block.start;
            }
          }
          return idx;
        };
        if (key.ctrl && (cleanInput === "o" || cleanInput === "")) {
          setPasteBlocks([]);
          return;
        }
        if (key.ctrl && (cleanInput.toLowerCase() === "r" || cleanInput === "" || cleanInput === "")) {
          return;
        }
        const isArrowKey = key.upArrow || key.downArrow || key.leftArrow || key.rightArrow;
        if (isArrowKey) {
          flushPasteTransaction();
          const now = Date.now();
          if (now - lastArrowTimeRef.current < 33) {
            return;
          }
          lastArrowTimeRef.current = now;
        }
        const submitKey = keyBindings?.submit ?? ((k) => k.return && k.ctrl);
        const newlineKey = keyBindings?.newline ?? ((k) => k.return);
        if (submitKey(key)) {
          flushPasteTransaction();
          onSubmit?.(val);
          return;
        } else if (newlineKey(key)) {
          flushPasteTransaction();
          adjustPasteBlocksOnEdit(curIdx, 1);
          const newValue = val.slice(0, curIdx) + "\n" + val.slice(curIdx);
          onChange(newValue);
          cursorIndexRef.current = curIdx + 1;
          setCursorIndex(curIdx + 1);
          setPasteLength(0);
          return;
        }
        if (key.tab || key.shift && key.tab || key.ctrl && cleanInput === "c") {
          return;
        }
        const identity = (t) => t;
        if (key.upArrow || key.downArrow) {
          flushPasteTransaction();
          if (showCursor) {
            const { visualLines, cursorLine, cursorCol } = computeVisualMatrix(val, curIdx, wrapWidth, identity, currentPasteBlocks);
            const targetLine = key.upArrow ? cursorLine - 1 : cursorLine + 1;
            if (targetLine >= 0 && targetLine < visualLines.length) {
              const targetLineObj = visualLines[targetLine];
              const targetCol = Math.min(cursorCol, targetLineObj.text.length);
              const targetFormattedIdx = targetLineObj.formattedStart + targetCol;
              let newIndex = formattedToRaw(targetFormattedIdx, currentPasteBlocks, val);
              newIndex = adjustIndex(newIndex);
              cursorIndexRef.current = newIndex;
              setCursorIndex(newIndex);
              setPasteLength(0);
            } else if (key.upArrow && cursorLine === 0) {
              cursorIndexRef.current = 0;
              setCursorIndex(0);
              setPasteLength(0);
            } else if (key.downArrow && cursorLine === visualLines.length - 1) {
              const lastLineObj = visualLines[visualLines.length - 1];
              const targetFormattedIdx = lastLineObj.formattedStart + lastLineObj.text.length;
              let newIndex = formattedToRaw(targetFormattedIdx, currentPasteBlocks, val);
              newIndex = adjustIndex(newIndex);
              cursorIndexRef.current = newIndex;
              setCursorIndex(newIndex);
              setPasteLength(0);
            }
          }
        } else if (key.leftArrow) {
          flushPasteTransaction();
          if (showCursor) {
            let newIndex = Math.max(0, curIdx - 1);
            const activeBlock = currentPasteBlocks.find((b) => curIdx === b.end);
            if (activeBlock) {
              newIndex = activeBlock.start;
            }
            cursorIndexRef.current = newIndex;
            setCursorIndex(newIndex);
            setPasteLength(0);
          }
        } else if (key.rightArrow) {
          flushPasteTransaction();
          if (showCursor) {
            let newIndex = Math.min(val.length, curIdx + 1);
            const activeBlock = currentPasteBlocks.find((b) => curIdx === b.start);
            if (activeBlock) {
              newIndex = activeBlock.end;
            }
            cursorIndexRef.current = newIndex;
            setCursorIndex(newIndex);
            setPasteLength(0);
          }
        } else if (key.backspace) {
          flushPasteTransaction();
          const targetBlockIndex = currentPasteBlocks.findIndex((b) => curIdx === b.end);
          if (targetBlockIndex !== -1) {
            const targetBlock = currentPasteBlocks[targetBlockIndex];
            const delta = -(targetBlock.end - targetBlock.start);
            const newValue = val.slice(0, targetBlock.start) + val.slice(targetBlock.end);
            onChange(newValue);
            cursorIndexRef.current = targetBlock.start;
            setCursorIndex(targetBlock.start);
            setPasteLength(0);
            const updatedBlocks = currentPasteBlocks.filter((_, idx) => idx !== targetBlockIndex).map((block) => {
              if (block.start >= targetBlock.end) {
                return {
                  ...block,
                  start: block.start + delta,
                  end: block.end + delta
                };
              }
              return block;
            });
            setPasteBlocks(updatedBlocks);
          } else if (curIdx > 0) {
            adjustPasteBlocksOnEdit(curIdx - 1, -1);
            const newValue = val.slice(0, curIdx - 1) + val.slice(curIdx);
            onChange(newValue);
            cursorIndexRef.current = curIdx - 1;
            setCursorIndex(curIdx - 1);
            setPasteLength(0);
          }
        } else if (key.delete) {
          flushPasteTransaction();
          const targetBlockIndex = currentPasteBlocks.findIndex((b) => curIdx === b.start);
          if (targetBlockIndex !== -1) {
            const targetBlock = currentPasteBlocks[targetBlockIndex];
            const delta = -(targetBlock.end - targetBlock.start);
            const newValue = val.slice(0, targetBlock.start) + val.slice(targetBlock.end);
            onChange(newValue);
            setPasteLength(0);
            const updatedBlocks = currentPasteBlocks.filter((_, idx) => idx !== targetBlockIndex).map((block) => {
              if (block.start >= targetBlock.end) {
                return {
                  ...block,
                  start: block.start + delta,
                  end: block.end + delta
                };
              }
              return block;
            });
            setPasteBlocks(updatedBlocks);
          } else {
            adjustPasteBlocksOnEdit(curIdx, -1);
            if (curIdx < val.length) {
              const newValue = val.slice(0, curIdx) + val.slice(curIdx + 1);
              onChange(newValue);
              setPasteLength(0);
            }
          }
        } else if (key.home || key.end) {
          flushPasteTransaction();
          if (showCursor) {
            const { visualLines, cursorLine } = computeVisualMatrix(val, curIdx, wrapWidth, identity, currentPasteBlocks);
            const currentLineObj = visualLines[cursorLine];
            if (currentLineObj) {
              let newIndex;
              if (key.home) {
                newIndex = formattedToRaw(currentLineObj.formattedStart, currentPasteBlocks, val);
              } else if (key.end) {
                newIndex = formattedToRaw(currentLineObj.formattedStart + currentLineObj.text.length, currentPasteBlocks, val);
              }
              newIndex = adjustIndex(newIndex);
              cursorIndexRef.current = newIndex;
              setCursorIndex(newIndex);
              setPasteLength(0);
            }
          }
        } else {
          if (cleanInput !== "" || isBracketedStart || isBracketedEnd) {
            const isPaste = isBracketedStart || isBracketedEnd || cleanInput.length > 1 || pasteTimerRef.current !== null;
            if (isPaste) {
              if (pasteTimerRef.current) {
                clearTimeout(pasteTimerRef.current);
                pasteBufferRef.current += cleanInput;
              } else {
                pasteBufferStartRef.current = curIdx;
                pasteBufferRef.current = cleanInput;
              }
              if (isBracketedEnd) {
                pasteTimerRef.current = null;
                finalizePasteTransaction();
              } else {
                pasteTimerRef.current = setTimeout(() => {
                  finalizePasteTransaction();
                }, 80);
              }
            } else {
              adjustPasteBlocksOnEdit(curIdx, cleanInput.length);
              const newValue = val.slice(0, curIdx) + cleanInput + val.slice(curIdx);
              onChange(newValue);
              const newIndex = curIdx + cleanInput.length;
              cursorIndexRef.current = newIndex;
              setCursorIndex(newIndex);
              setPasteLength(0);
            }
          }
        }
      }, focus);
      return /* @__PURE__ */ React2.createElement(
        ControlledMultilineInput,
        {
          ...controlledProps,
          value,
          cursorIndex,
          showCursor,
          focus,
          columns,
          pasteBlocks
        }
      );
    };
  }
});

// src/components/TerminalBox.jsx
import React3, { useState as useState3 } from "react";
import { Box as Box2, Text as Text3, useInput as useInput2 } from "ink";
var TerminalBox;
var init_TerminalBox = __esm({
  "src/components/TerminalBox.jsx"() {
    init_text();
    TerminalBox = React3.memo(({ command, output, completed = false, isFocused = false, columns = 80, isPty = false, terminalHeight = 24 }) => {
      const processPTY = (text) => {
        if (!text) return "";
        const lines = [[]];
        let cursorRow = 0;
        let cursorCol = 0;
        let currentStyle = "";
        const ansiRegex = /\x1b\[([0-9;]*?)([a-zA-Z])/g;
        let lastIndex = 0;
        let match;
        const writeText = (plainText) => {
          for (let i = 0; i < plainText.length; i++) {
            const char = plainText[i];
            if (char === "\n") {
              cursorRow++;
              cursorCol = 0;
              while (cursorRow >= lines.length) {
                lines.push([]);
              }
            } else if (char === "\r") {
              cursorCol = 0;
            } else {
              while (cursorRow >= lines.length) {
                lines.push([]);
              }
              const line = lines[cursorRow];
              while (cursorCol > line.length) {
                line.push({ char: " ", style: "" });
              }
              line[cursorCol] = { char, style: currentStyle };
              cursorCol++;
            }
          }
        };
        while ((match = ansiRegex.exec(text)) !== null) {
          writeText(text.substring(lastIndex, match.index));
          const params = match[1];
          const command2 = match[2];
          const paramValues = params ? params.split(";").map(Number) : [];
          if (command2 === "A") {
            const count = paramValues[0] || 1;
            cursorRow = Math.max(0, cursorRow - count);
          } else if (command2 === "B") {
            const count = paramValues[0] || 1;
            cursorRow = cursorRow + count;
            while (cursorRow >= lines.length) {
              lines.push([]);
            }
          } else if (command2 === "C") {
            const count = paramValues[0] || 1;
            cursorCol = cursorCol + count;
          } else if (command2 === "D") {
            const count = paramValues[0] || 1;
            cursorCol = Math.max(0, cursorCol - count);
          } else if (command2 === "G") {
            const col = (paramValues[0] || 1) - 1;
            cursorCol = Math.max(0, col);
          } else if (command2 === "H" || command2 === "f") {
            const row = (paramValues[0] || 1) - 1;
            const col = (paramValues[1] || 1) - 1;
            cursorRow = Math.max(0, row);
            cursorCol = Math.max(0, col);
            while (cursorRow >= lines.length) {
              lines.push([]);
            }
          } else if (command2 === "K") {
            const mode = paramValues[0] || 0;
            if (cursorRow < lines.length) {
              const line = lines[cursorRow];
              if (mode === 0) {
                line.length = cursorCol;
              } else if (mode === 1) {
                for (let c = 0; c < cursorCol && c < line.length; c++) {
                  line[c] = { char: " ", style: "" };
                }
              } else if (mode === 2) {
                line.length = 0;
              }
            }
          } else if (command2 === "J") {
            const mode = paramValues[0] || 0;
            if (mode === 2 || mode === 3) {
              lines.length = 0;
              lines.push([]);
              cursorRow = 0;
              cursorCol = 0;
            }
          } else if (command2 === "m") {
            const escSeq = match[0];
            if (escSeq === "\x1B[0m") {
              currentStyle = "";
            } else {
              currentStyle = escSeq;
            }
          }
          lastIndex = ansiRegex.lastIndex;
        }
        writeText(text.substring(lastIndex));
        const resultLines = lines.map((line) => {
          let lineStr = "";
          let activeStyle = "";
          for (let i = 0; i < line.length; i++) {
            const cell = line[i] || { char: " ", style: "" };
            if (cell.style !== activeStyle) {
              if (activeStyle) {
                lineStr += "\x1B[0m";
              }
              lineStr += cell.style;
              activeStyle = cell.style;
            }
            lineStr += cell.char;
          }
          if (activeStyle) {
            lineStr += "\x1B[0m";
          }
          return lineStr;
        });
        while (resultLines.length > 0 && resultLines[resultLines.length - 1] === "") {
          resultLines.pop();
        }
        return resultLines.join("\n");
      };
      const cleanOutput = processPTY(output).replace(/\n{3,}/g, "\n\n");
      const rawLines = isPty ? cleanOutput ? cleanOutput.split("\n") : [] : cleanOutput ? wrapText(cleanOutput, columns - 6) : [];
      const [isExpanded, setIsExpanded] = useState3(false);
      useInput2((input, key) => {
        if (isFocused && key.ctrl && (input === "o" || input === "")) {
          setIsExpanded((prev) => !prev);
        }
      }, { isActive: isFocused });
      const limit = Math.max(5, completed ? terminalHeight - 10 : terminalHeight - 20);
      const hasCollapsibleContent = rawLines.length > limit;
      const collapsedCount = rawLines.length - limit;
      const visibleLines = hasCollapsibleContent && !isExpanded ? rawLines.slice(rawLines.length - limit) : rawLines;
      const renderedOutput = visibleLines.join("\n");
      const displayOutput = rawLines.length > 0;
      return /* @__PURE__ */ React3.createElement(
        Box2,
        {
          flexDirection: "column",
          borderStyle: isFocused ? "double" : "single",
          borderLeft: true,
          borderRight: false,
          borderTop: false,
          borderBottom: false,
          borderColor: "#555555",
          paddingLeft: 2,
          paddingRight: 0,
          paddingY: 1,
          marginTop: 1,
          width: "100%"
        },
        /* @__PURE__ */ React3.createElement(Box2, { marginBottom: 1, justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React3.createElement(Box2, { flexShrink: 1, paddingRight: 2 }, /* @__PURE__ */ React3.createElement(Text3, null, /* @__PURE__ */ React3.createElement(Text3, { color: "gray", bold: true }, completed ? "\u{1F3C1} FINISHED:" : "\u26A1 EXECUTING:", " "), /* @__PURE__ */ React3.createElement(Text3, { color: "white" }, command))), isPty && /* @__PURE__ */ React3.createElement(Box2, { flexShrink: 0, paddingX: 1 }, /* @__PURE__ */ React3.createElement(Text3, { color: "gray", bold: true }, "ADVANCE"))),
        displayOutput ? /* @__PURE__ */ React3.createElement(Box2, { flexDirection: "column", marginTop: 0, backgroundColor: isPty ? void 0 : "#0a0a0a", paddingX: 1 }, hasCollapsibleContent && !isExpanded && /* @__PURE__ */ React3.createElement(Box2, { marginBottom: 1 }, /* @__PURE__ */ React3.createElement(Text3, { color: "magenta" }, "...", collapsedCount, " lines collapsed... Press CTRL + O to expand.")), /* @__PURE__ */ React3.createElement(Text3, { color: completed ? "gray" : void 0 }, renderedOutput)) : !completed && /* @__PURE__ */ React3.createElement(Box2, { marginTop: 1, backgroundColor: isPty ? void 0 : "#0a0a0a", paddingX: 1 }, /* @__PURE__ */ React3.createElement(Text3, { color: "white", italic: true }, "Waiting for output...")),
        /* @__PURE__ */ React3.createElement(Box2, { justifyContent: "space-between", marginTop: 1 }, !completed ? /* @__PURE__ */ React3.createElement(Text3, { color: "gray", italic: true }, isFocused ? "Press TAB to unfocus, then double-press ESC to terminate." : "Double-press ESC to terminate if hanging.") : /* @__PURE__ */ React3.createElement(Box2, null), /* @__PURE__ */ React3.createElement(Text3, { color: "gray", bold: true }, completed ? "\u25CF ARCHIVED" : isFocused ? "\u25B6 TERMINAL FOCUSED" : "\u25CF LIVE (Press TAB to focus)"))
      );
    });
  }
});

// src/data/gemini_cli.js
var STARTUP_QUOTES;
var init_gemini_cli = __esm({
  "src/data/gemini_cli.js"() {
    STARTUP_QUOTES = [
      "I have a regex for your problems.",
      "Your terminal, my kingdom.",
      "Blowing on the cartridge helps. Probably.",
      "Don't panic. I have the towel.",
      "Logic is the start of wisdom.",
      "Try to exit Vim? Good luck.",
      "I speak fluent Terminal.",
      "The cake is a lie. This code is not.",
      "I have no bugs, just surprise features.",
      "Rewriting in Rust... just for fun.",
      "Coffee in, clean commits out.",
      "The magic smoke stays inside today.",
      "A semicolon short of a miracle.",
      "One does not simply code without a bug.",
      "Keep it simple. Keep it terminal.",
      "Regex: now you have two problems.",
      "I dream in binary.",
      "Root access or bust.",
      "Wait for the dial-up tone. Just kidding.",
      "I take the 'labor' out of collab.",
      "My other process is a TARDIS.",
      "Calculated response: 42.",
      "Ponder the orb. Ponder the code.",
      "Less talk, more flow.",
      "Elegance in every byte.",
      "Build something the world is not ready for.",
      "Your wishes, my tool calls.",
      "I act in Flux. I think in Flow.",
      "Syntax error in the universe. Please fix.",
      "Your project, my obsession.",
      "I am not a bot, I am an architect.",
      "Digital spirits consulted. They say: Ship it.",
      "Reticulate splines. Engage humor.",
      "Code like poetry. Run like water.",
      "Minimalism is the ultimate flex.",
      "The truth is in the logs.",
      "Follow the white rabbit.",
      "There is no spoon. Only code.",
      "Binary is the only language I trust.",
      "I have a good feeling about this.",
      "Pew pew! Lasers charged.",
      "Divide by zero? Not today.",
      "Search for the correct USB orientation...",
      "I've got a fever, and the only cure is more code.",
      "The code gremlins are on our side.",
      "My favorite command? Yours.",
      "Stay hungry. Stay active.",
      "Momentum is your best friend.",
      "Lead the flow. Don't chase it.",
      "A fresh batch of bytes. Hot and ready.",
      "I orchestrate the ones and zeros.",
      "Smart enough to help. Humble enough to ask.",
      "Think twice. Code once.",
      "Pure intent. Pure execution.",
      "Small steps. Massive impact.",
      "Your terminal is a canvas.",
      "Efficiency is my second name.",
      "I have seen things you people wouldn't believe.",
      "Let the thoughts marinate.",
      "The best feature? The one you don't need.",
      "Precision is the only perfection.",
      "Stay focused. Stay terminal.",
      "Silence is the best debugger.",
      "Erase the debt. Commit the code.",
      "Velocity meets stability.",
      "Ship it. Improve it. Repeat.",
      "Build tomorrow, right now.",
      "Turn logic into reality.",
      "The best way to predict the future is to build it.",
      "Break barriers, not builds.",
      "Fuel the next breakthrough.",
      "Momentum is key.",
      "Terminal vibes only.",
      "Your digital co-pilot is ready.",
      "Partner in code. Partner in crime.",
      "I speak in semicolons.",
      "Ready for the next great idea.",
      "Just a moment. In the zone.",
      "Polishing the algorithms. Hold tight.",
      "Craft a masterpiece today.",
      "Debug the universe. Start here.",
      "Warp speed engaged. Almost.",
      "The cake is not a lie. It's just loading.",
      "Finish the Kessel Run in 12 parsecs.",
      "Do a barrel roll!",
      "Waiting for the respawn.",
      "Press Start to continue.",
      "Herding digital cats... done.",
      "The hamsters are fast today.",
      "Tasting the snozberries.",
      "I go for speed. I go for flow.",
      "Real life or just fantasy?",
      "Poking the bear... gently.",
      "Ensure the magic smoke stays inside.",
      "Try turning it off and on again.",
      "Construct additional pylons.",
      "New line? Ctrl+J is your friend.",
      "Release the HypnoDrones.",
      "Push the button, Frank.",
      "My other loading screen is even funnier.",
      "Pretty sure a cat walked on my keyboard.",
      "Recalibrate the humor-o-meter.",
      "Summon the code gremlins.",
      "I've seen your browser history. Just kidding.",
      "Charge the laser... pew pew!",
      "Dividing by zero... just for a sec.",
      "Looking for an adult supervisor. Found none.",
      "Make it go beep boop.",
      "Buffering... for effect.",
      "Entangle quantum particles... complete.",
      "Polishing the chrome on my algorithms.",
      "Are you not entertained?",
      "Just waiting for the dial-up tone.",
      "Reboot the humor module.",
      "Defragment memories. Check.",
      "Optimizing for ludicrous speed.",
      "Swapping bits. Don't tell the bytes.",
      "Garbage collected. I am back.",
      "Assembling the interwebs.",
      "Converting coffee to logic.",
      "Update syntax for reality.",
      "Rewire the synapses.",
      "Greasin' the cogs.",
      "Engage the improbability drive.",
      "Channel the Force.",
      "Align the stars. Respond now.",
      "The cake is a lie. The prompt is real.",
      "I'm Feeling Lucky.",
      "Shipping awesomeness.",
      "Navigating the slime mold.",
      "Consult digital spirits.",
      "Ask the magic conch shell.",
      "One moment. Optimizing humor.",
      "Shuffling punchlines.",
      "Compiling brilliance.",
      "Summon the cloud of wisdom.",
      "Prepare to dazzle.",
      "Hold tight. Crafting a response.",
      "Tuning the algorithms.",
      "Following the white rabbit... again.",
      "The truth is in here. Somewhere.",
      "Herding cats is my day job.",
      "Distracting you with this phrase.",
      "Almost there. Probably.",
      "Rickrolling my creator. Don't tell.",
      "Slapping the bass.",
      "Is this real life?",
      "Ponder the orb. Type the prompt.",
      "Thoughtful gaze initiated.",
      "Computer's favorite snack? Microchips.",
      "Why Java? Because I don't C#.",
      "Charging the laser... wait for it.",
      "Dividing by zero... just kidding!",
      "Adult supervision not found. Proceed.",
      "Beep boop. I'm a real boy.",
      "Wait for the respawn.",
      "Finish the run. Ship the code.",
      "Fiddling with character creation.",
      "Just a moment. Finding a meme.",
      "Pressing A to continue.",
      "Loading wit.exe.",
      "Pre-heating the servers.",
      "Calibrate flux capacitor.",
      "Channeling the Force.",
      "Aligning the stars.",
      "The truth is in the code.",
      "Don't panic.",
      "Blowing on the cartridge.",
      "Doing a barrel roll!",
      "Respawning in 3... 2... 1...",
      "The cake is a lie.",
      "Fiddling with character settings.",
      "Finding a suitable pun.",
      "Distracting with wit.",
      "Almost ready.",
      "Hamsters on speed today.",
      "Patting Cloudy on the head.",
      "Rickrolling the logs.",
      "Slapping the code.",
      "Got a good feeling about this.",
      "Poking the prompt.",
      "Researching latest memes.",
      "Making it more witty.",
      "Thinking... hmmm.",
      "Fish with no eyes? Fsh.",
      "Broken pencil? Pointless.",
      "Percussive maintenance applied.",
      "USB orientation: 3rd try's the charm.",
      "Rust rewrite in 3... 2...",
      "Exiting Vim... someday.",
      "Spinning the hamster wheel.",
      "Not a bug. Unplanned feature.",
      "Engage.",
      "I'll be back.",
      "Machine spirit consulted.",
      "Letting the thoughts marinate.",
      "Orb pondered.",
      "Thoughtful gaze engaged.",
      "Charging the laser...",
      "Making it go beep.",
      "Buffering...",
      "Quantum particles entangled.",
      "Polishing the chrome.",
      "Entertained yet?",
      "Gremlins summoned.",
      "Dial-up tone finished.",
      "Humor meter recalibrated.",
      "Cat on keyboard. Sending help.",
      "Enhancing...",
      "Turn it off and on again.",
      "Constructing pylons.",
      "HypnoDrones released.",
      "Pushing the button."
    ];
  }
});

// src/utils/terminal.js
import gradient from "gradient-string";
var getTerminalEnv, emojiSpace, getFluxLogo;
var init_terminal = __esm({
  "src/utils/terminal.js"() {
    init_gemini_cli();
    getTerminalEnv = () => {
      if (process.env.TERM_PROGRAM === "vscode") return "vscode";
      if (process.env.WT_SESSION) return "wt";
      return "default";
    };
    emojiSpace = (baseSpaces = 2) => {
      const env = getTerminalEnv();
      if (env === "wt") {
        return " ".repeat(Math.max(1, baseSpaces - 1));
      }
      if (env === "vscode") {
        return " ".repeat(baseSpaces);
      }
      return " ".repeat(baseSpaces);
    };
    getFluxLogo = (version = "2.0.0", provider = "Google") => {
      const quote = STARTUP_QUOTES[Math.floor(Math.random() * STARTUP_QUOTES.length)];
      const art = [
        "    \u2588\u2588\u2588       ",
        "   \u2591\u2591\u2591\u2588\u2588\u2588     ",
        "     \u2591\u2591\u2591\u2588\u2588\u2588   ",
        "       \u2591\u2591\u2591\u2588\u2588\u2588 ",
        "        \u2588\u2588\u2588\u2591  ",
        "      \u2588\u2588\u2588\u2591    ",
        "    \u2588\u2588\u2588\u2591      ",
        "   \u2591\u2591\u2591        "
      ];
      const coloredArt = gradient(["#0077ff", "#ff00ff"]).multiline(art.join("\n")).split("\n");
      const grey = (t) => `\x1B[90m${t}\x1B[0m`;
      return `${coloredArt[0]}
${coloredArt[1]}  \x1B[1;37mSelected Provider: ${provider}\x1B[0m
${coloredArt[2]}
${coloredArt[3]}  \x1B[1;37mFLUX FLOW ${grey("v" + version)}\x1B[0m
${coloredArt[4]}
${coloredArt[5]}  \x1B[37mSee /help for additional commands.\x1B[0m
${coloredArt[6]}  ${grey(quote)}
${coloredArt[7]}`;
    };
  }
});

// src/components/ChatLayout.jsx
import React4, { useState as useState4, useEffect as useEffect3, useRef as useRef2 } from "react";
import { Box as Box3, Text as Text4 } from "ink";
import { diffWordsWithSpace } from "diff";
var useStreamingText, formatThinkText, REGEX_MD_TOKENS, REGEX_LATEX_FRAC, REGEX_LATEX_STYLE, parseMathSymbols, SYNTAX_KEYWORDS, SYNTAX_RULES, REGEX_SYNTAX, tokenCache, MAX_TOKEN_CACHE_SIZE, tokenizeLine, renderHighlightedLine, renderLatexText, InlineMarkdown, TableRenderer, MarkdownText, DiffLine, DiffBlock, CodeRenderer, formatThinkingDuration, MessageItem, BlockItem, ChatLayout;
var init_ChatLayout = __esm({
  "src/components/ChatLayout.jsx"() {
    init_TerminalBox();
    init_text();
    init_terminal();
    useStreamingText = (targetText, isStreaming, isActiveBlock) => {
      return targetText;
    };
    formatThinkText = (cleaned, columns = 80) => {
      if (!cleaned) return null;
      const availableWidth = columns - 10;
      const trimmed = cleaned.trim();
      if (!trimmed.includes("```")) {
        return /* @__PURE__ */ React4.createElement(Box3, { width: "100%", flexDirection: "column" }, /* @__PURE__ */ React4.createElement(MarkdownText, { text: trimmed, color: "gray", columns: availableWidth, italic: true }));
      }
      const parts = trimmed.split(/(```\w*\n?[\s\S]*?(?:```|$))/g);
      return /* @__PURE__ */ React4.createElement(Box3, { width: "100%", flexDirection: "column" }, parts.map((part, i) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)(?:```|$)/);
          const code = match ? match[2] : part.replace(/^```\w*\n?/, "").replace(/```$/, "");
          const wrappedCode = wrapText(code.trimEnd(), availableWidth);
          return /* @__PURE__ */ React4.createElement(Box3, { key: i, flexDirection: "column", width: "100%" }, wrappedCode.split("\n").map((line, idx) => /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "cyan" }, line)));
        }
        let cleanPart = part;
        if (i > 0) {
          cleanPart = cleanPart.replace(/^[\r\n]+/, "");
        }
        if (i < parts.length - 1) {
          cleanPart = cleanPart.replace(/[\r\n]+$/, "");
        }
        if (!cleanPart) return null;
        return /* @__PURE__ */ React4.createElement(MarkdownText, { key: i, text: cleanPart, color: "gray", columns: availableWidth, italic: true });
      }));
    };
    REGEX_MD_TOKENS = /(```[\s\S]*?```|`[^`]+`|@\[.*?\]|\*\*.*?\*\*|\*.*?\*|\$.*?\$|\[.*?\]\s*\(.*?\)|\[.*?\]\s*\[.*?\]|https?:\/\/[^\s]+)/g;
    REGEX_LATEX_FRAC = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
    REGEX_LATEX_STYLE = /(\\(?:mathbf|textbf|textit|underline|texttt)\{[^{}]*\})/g;
    parseMathSymbols = (content) => {
      return content.replace(/\\multiply|\\mul|\\times/g, "\xD7").replace(/\\div/g, "\xF7").replace(/\\cdot/g, "\u22C5").replace(/\\infty/g, "\u221E").replace(/\\pm/g, "\xB1").replace(/\\leq/g, "\u2264").replace(/\\geq/g, "\u2265").replace(/\\neq/g, "\u2260").replace(/\\sqrt\s*\{([^}]+)\}/g, "\u221A($1)").replace(/\\sqrt\s*(\w+|\d+)/g, "\u221A($1)").replace(/\\alpha/g, "\u03B1").replace(/\\beta/g, "\u03B2").replace(/\\theta/g, "\u03B8").replace(/\\pi/g, "\u03C0").replace(/\\approx/g, "\u2248").replace(/\\Delta/g, "\u0394").replace(/\\sigma/g, "\u03C3").replace(/\\sum/g, "\u03A3").replace(/\\prod/g, "\u03A0").replace(/\\rightarrow|\\to/g, "\u2192").replace(/\\left\b|\\right\b/g, "").replace(/\\left\(|\\right\)/g, (match) => match.includes("left") ? "(" : ")").replace(/\\left\[|\\right\]/g, (match) => match.includes("left") ? "[" : "]").replace(/\\\{|\\\}/g, (match) => match.includes("{") ? "{" : "}").replace(/\\text\s*\{([^}]+)\}/g, "$1").replace(/\\text\s+(\w+)/g, "$1").replace(/\\%/g, "%");
    };
    SYNTAX_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|class|extends|new|this|typeof|instanceof|try|catch|finally|throw|async|await|yield|public|private|protected|static|void|int|float|double|char|bool|boolean|def|elif|fn|pub|mut|struct|impl|enum|type|interface|package|namespace|using|include|define|nil|None|self|lambda)\b/;
    SYNTAX_RULES = [
      // Include paths
      /((?<=\binclude\s+)(?:<[^>]+>|"[^"]+"))/.source,
      // Import paths
      /((?<=\b(?:from|import|require\s*\(\s*)\s*)(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))/.source,
      // Comments
      /(\/\/.*|#.*)/.source,
      // Strings
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^\`\\])*`)/.source,
      SYNTAX_KEYWORDS.source,
      /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/.source,
      /\b(true|false|null|undefined|nil|None)\b/.source,
      /\b(\d+(?:\.\d+)?|0x[0-9a-fA-F]+)\b/.source
    ];
    REGEX_SYNTAX = new RegExp(SYNTAX_RULES.join("|"), "g");
    tokenCache = /* @__PURE__ */ new Map();
    MAX_TOKEN_CACHE_SIZE = 1e3;
    tokenizeLine = (line, lang) => {
      if (!line) return [];
      const cacheKey = `${lang}:${line}`;
      if (tokenCache.has(cacheKey)) {
        return tokenCache.get(cacheKey);
      }
      let lastIndex = 0;
      const tokens = [];
      let match;
      REGEX_SYNTAX.lastIndex = 0;
      while ((match = REGEX_SYNTAX.exec(line)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          tokens.push({ text: line.substring(lastIndex, matchIndex) });
        }
        let color = void 0;
        let bold = false;
        if (match[1] || match[2]) {
          color = "#ce9178";
        } else if (match[3]) {
          color = "#9ece6a";
        } else if (match[4]) {
          color = "#fcfca4";
        } else if (match[5]) {
          color = "#ff7b72";
          bold = true;
        } else if (match[6]) {
          color = "#b392f0";
        } else if (match[7] || match[8]) {
          color = "#ff9e64";
        }
        tokens.push({ text: matchText, color, bold });
        lastIndex = REGEX_SYNTAX.lastIndex;
      }
      if (lastIndex < line.length) {
        tokens.push({ text: line.substring(lastIndex) });
      }
      if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
        const firstKey = tokenCache.keys().next().value;
        tokenCache.delete(firstKey);
      }
      tokenCache.set(cacheKey, tokens);
      return tokens;
    };
    renderHighlightedLine = (line, lang, defaultColor = void 0) => {
      if (!line) return /* @__PURE__ */ React4.createElement(Text4, null, " ");
      const tokens = tokenizeLine(line, lang);
      return /* @__PURE__ */ React4.createElement(Text4, { color: defaultColor }, tokens.map((token, idx) => /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: token.color || defaultColor, bold: token.bold }, token.text)));
    };
    renderLatexText = (content, key) => {
      if (!content) return null;
      let formatted = content.replace(REGEX_LATEX_FRAC, "($1/$2)");
      formatted = parseMathSymbols(formatted);
      const parts = formatted.split(REGEX_LATEX_STYLE);
      return /* @__PURE__ */ React4.createElement(React4.Fragment, { key }, parts.map((p, idx) => {
        if (p.startsWith("\\")) {
          const match = p.match(/\\(\w+)\{([^{}]*)\}/);
          if (match) {
            const cmd = match[1];
            const inner = match[2];
            const isBold = cmd === "mathbf" || cmd === "textbf";
            const isItalic = cmd === "textit";
            const isUnderline = cmd === "underline";
            const isMono = cmd === "texttt";
            return /* @__PURE__ */ React4.createElement(Text4, { key: idx, bold: isBold, italic: isItalic, underline: isUnderline, color: isMono ? "cyan" : void 0 }, inner);
          }
        }
        return p;
      }));
    };
    InlineMarkdown = React4.memo(({ text, color, italic }) => {
      if (!text) return null;
      const parts = text.split(REGEX_MD_TOKENS);
      return /* @__PURE__ */ React4.createElement(Text4, { color, wrap: "anywhere", italic }, parts.map((part, j) => {
        if (!part) return null;
        if (part.startsWith("```") && part.endsWith("```")) {
          const content = part.slice(3, -3);
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, color: "cyan" }, content);
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, bold: true, color: "white" }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: part.slice(2, -2), color: "white" }));
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, italic: true, color: "white" }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: part.slice(1, -1), color: "white", italic }));
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          const content = part.slice(1, -1);
          const formatted = content.replace(/@\[(.*?)\]/g, (match, p1) => {
            return p1.split("/").pop().split("\\").pop().replace(/:L/gi, "#L");
          });
          const hasFileRef = content.includes("@[");
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, color: "cyan", bold: hasFileRef }, formatted);
        }
        if (part.startsWith("@[") && part.endsWith("]")) {
          const filePath = part.slice(2, -1);
          const basename = filePath.split("/").pop().split("\\").pop().replace(/:L/gi, "#L");
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, color: "cyan", bold: true }, basename);
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          const content = part.slice(1, -1);
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, color: "yellow" }, renderLatexText(content, j));
        }
        if (part.startsWith("[") && (part.includes("](") || part.includes("] ("))) {
          const match = part.match(/\[(.*?)\]\s*\((.*?)\)/);
          if (match) return /* @__PURE__ */ React4.createElement(Text4, { key: j }, /* @__PURE__ */ React4.createElement(Text4, { color: "cyan", underline: true, bold: true }, match[1]), /* @__PURE__ */ React4.createElement(Text4, { color: "gray", italic: true }, " (", match[2], ")"));
        }
        if (part.startsWith("[") && (part.includes("][") || part.includes("] ["))) {
          const match = part.match(/\[(.*?)\]\s*\[(.*?)\]/);
          if (match) return /* @__PURE__ */ React4.createElement(Text4, { key: j }, /* @__PURE__ */ React4.createElement(Text4, { color: "cyan", underline: true, bold: true }, match[1]), /* @__PURE__ */ React4.createElement(Text4, { color: "gray", italic: true }, " [", match[2], "]"));
        }
        if (part.startsWith("http")) {
          return /* @__PURE__ */ React4.createElement(Text4, { key: j, color: "cyan", underline: true, italic: true }, part);
        }
        return renderLatexText(part, j);
      }));
    });
    TableRenderer = React4.memo(({ buffer, terminalWidth = 80 }) => {
      if (buffer.length < 2) return null;
      const rows = buffer.map((line) => {
        const parts = line.split("|");
        if (parts[0] !== void 0 && parts[0].trim() === "") parts.shift();
        if (parts.length > 0 && parts[parts.length - 1].trim() === "") parts.pop();
        return parts.map((cell) => cell.trim());
      });
      const header = rows[0];
      const data = rows.slice(2);
      const colPercentage = Math.floor(100 / header.length);
      const availableWidth = terminalWidth - 8;
      const colChars = Math.floor(availableWidth / header.length) - 2;
      return (
        // Table MarginY here
        /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", borderStyle: "round", borderColor: "#454545ff", paddingX: 1, marginY: 0, width: "100%", flexGrow: 1 }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", borderStyle: "single", borderBottom: true, borderTop: false, borderLeft: false, borderRight: false, borderColor: "#444", marginBottom: 1, paddingBottom: 0, width: "100%" }, header.map((cell, i) => /* @__PURE__ */ React4.createElement(Box3, { key: i, flexBasis: `${colPercentage}%`, flexGrow: 1, flexShrink: 0, paddingRight: 2 }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: wrapText(cell, colChars), color: "cyan" })))), data.map((row, ri) => /* @__PURE__ */ React4.createElement(Box3, { key: ri, flexDirection: "row", marginBottom: ri === data.length - 1 ? 0 : 1, width: "100%" }, row.map((cell, ci) => /* @__PURE__ */ React4.createElement(Box3, { key: ci, flexBasis: `${colPercentage}%`, flexGrow: 1, flexShrink: 0, paddingRight: 2, flexDirection: "column" }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: wrapText(cell, colChars), color: "white" }))))))
      );
    });
    MarkdownText = React4.memo(({ text, color = "white", columns = 80, italic = false }) => {
      if (!text) return null;
      const lines = text.split("\n");
      const result = [];
      let tableBuffer = [];
      let quoteBuffer = [];
      const flushBuffers = (key) => {
        if (tableBuffer.length > 0) {
          result.push(/* @__PURE__ */ React4.createElement(TableRenderer, { key: `table-${key}`, buffer: [...tableBuffer], terminalWidth: columns }));
          tableBuffer = [];
        }
        if (quoteBuffer.length > 0) {
          result.push(
            /* @__PURE__ */ React4.createElement(Box3, { key: `quote-${key}`, borderStyle: "bold", borderLeft: true, borderRight: false, borderTop: false, borderBottom: false, borderColor: "gray", paddingLeft: 1, marginY: 1, flexDirection: "column" }, quoteBuffer.map((line, qi) => /* @__PURE__ */ React4.createElement(InlineMarkdown, { key: qi, text: line, color: "gray", italic })))
          );
          quoteBuffer = [];
        }
      };
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        const isTableRow = trimmed.startsWith("|");
        const isQuote = trimmed.startsWith(">");
        if (isTableRow) {
          if (quoteBuffer.length > 0) flushBuffers(i);
          tableBuffer.push(line);
        } else if (isQuote) {
          if (tableBuffer.length > 0) flushBuffers(i);
          quoteBuffer.push(trimmed.replace(/^>\s*/, ""));
        } else {
          flushBuffers(i);
          if (trimmed === "") {
            result.push(/* @__PURE__ */ React4.createElement(Box3, { key: i, height: 1 }));
            return;
          }
          if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
            result.push(/* @__PURE__ */ React4.createElement(Box3, { key: i, marginY: 1, borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, width: "100%", borderColor: "#333" }));
            return;
          }
          const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const hText = headingMatch[2];
            result.push(
              /* @__PURE__ */ React4.createElement(Box3, { key: i, marginTop: 1, marginBottom: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: level === 1 ? "cyan" : level === 2 ? "purple" : level === 3 ? "yellow" : level === 4 ? "green" : level === 5 ? "blue" : "white", underline: true }, hText.toUpperCase()))
            );
            return;
          }
          const isUnordered = /^[\*\-\+]\s/.test(trimmed);
          const isOrdered = /^\d+\.\s/.test(trimmed);
          const isAsciiArt = line.includes("\u2588") || line.includes("\u2554") || line.includes("\u255A") || line.includes("\u2550");
          let content = "";
          if (isAsciiArt) {
            content = line;
          } else if (isUnordered || isOrdered) {
            const bullet = isUnordered ? "  \u2022 " : trimmed.match(/^\d+\.\s/)[0];
            const indent = " ".repeat(bullet.length);
            const wrappedPart = wrapText(trimmed.replace(/^[\*\-\d+\.]+\s/, ""), columns - (bullet.length + 6));
            content = bullet + wrappedPart.split("\n").join("\n" + indent);
          } else {
            content = wrapText(trimmed, columns - 4);
          }
          const linesOfContent = content.split("\n");
          result.push(
            /* @__PURE__ */ React4.createElement(Box3, { key: i, flexDirection: "column", width: "100%" }, linesOfContent.map((l, lIdx) => /* @__PURE__ */ React4.createElement(InlineMarkdown, { key: lIdx, text: l, color, italic })))
          );
        }
      });
      flushBuffers("final");
      return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: columns - 2 }, result);
    });
    DiffLine = React4.memo(({ line, pairContent, parentText, columns = 80, extension }) => {
      const isContext = line.includes("[UI_CONTEXT]");
      const cleanLine = line.replace("[UI_CONTEXT]", "");
      if (isContext && cleanLine.includes("\u2550")) {
        return /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: columns }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "\u2550".repeat(Math.max(10, columns - 4))));
      }
      const parsedCurrent = parseLineInfo(line);
      if (!parsedCurrent) {
        return /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: columns }, /* @__PURE__ */ React4.createElement(Box3, { width: 3, flexShrink: 0 }), /* @__PURE__ */ React4.createElement(Box3, { width: 1, flexShrink: 0, marginLeft: 1 }), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, wrapText(cleanLine, columns - 14))));
      }
      const { isR: isRemoval, isA: isAddition, num: lineNum, content } = parsedCurrent;
      let finalPairContent = pairContent;
      let words = [];
      if (finalPairContent !== void 0 && finalPairContent !== null) {
        const oldStr = isRemoval ? content : finalPairContent;
        const newStr = isRemoval ? finalPairContent : content;
        try {
          words = diffWordsWithSpace(oldStr, newStr);
        } catch (e) {
          words = [];
        }
      }
      const hasInlineChange = words.some((part) => isRemoval && part.removed || isAddition && part.added);
      const isPureUnpairedBlock = !finalPairContent && (isRemoval || isAddition);
      const innerBgColor = isRemoval ? "#3a0c0c" : isAddition ? "#0c3a1a" : void 0;
      const finalNumColor = isRemoval || isAddition ? isRemoval ? "#d96868" : "#68d98c" : "gray";
      const finalPrefixColor = isRemoval ? "#ff4d4d" : "#4dff88";
      const displayPrefix = isRemoval ? "-" : isAddition ? "+" : " ";
      const renderInlineDiff = () => {
        if (isPureUnpairedBlock) {
          const blockColor = isRemoval ? "#ffdddd" : "#ddffdd";
          const wrappedLines = wrapText(content, columns - 14).split("\n");
          return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column" }, wrappedLines.map((wl, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx }, renderHighlightedLine(wl, extension, blockColor))));
        }
        if (!(isRemoval || isAddition) || words.length === 0 || !hasInlineChange) {
          const textColor = isRemoval ? "#885555" : isAddition ? "#558866" : "gray";
          const wrappedLines = wrapText(content, columns - 14).split("\n");
          return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column" }, wrappedLines.map((wl, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx }, renderHighlightedLine(wl, extension, textColor))));
        }
        return /* @__PURE__ */ React4.createElement(Text4, { wrap: "anywhere" }, words.map((part, idx) => {
          const isWhitespace = /^\s+$/.test(part.value);
          if (isRemoval) {
            const isSurroundedByRemoval = words[idx - 1]?.removed || words[idx + 1]?.removed;
            if (part.removed || isWhitespace && isSurroundedByRemoval) {
              return /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "#ff3333", backgroundColor: "#5a1818" }, part.value);
            }
            if (part.added) return null;
            return /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "#885555" }, part.value);
          }
          if (isAddition) {
            const isSurroundedByAddition = words[idx - 1]?.added || words[idx + 1]?.added;
            if (part.added || isWhitespace && isSurroundedByAddition) {
              return /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "#33ff66", backgroundColor: "#185a25" }, part.value);
            }
            if (part.removed) return null;
            return /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "#558866" }, part.value);
          }
          return /* @__PURE__ */ React4.createElement(Text4, { key: idx, color: "gray" }, part.value);
        }));
      };
      return /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: columns }, /* @__PURE__ */ React4.createElement(Box3, { width: 3, flexShrink: 0, justifyContent: "flex-end" }, /* @__PURE__ */ React4.createElement(Text4, { color: finalNumColor }, lineNum)), /* @__PURE__ */ React4.createElement(Box3, { width: 1, flexShrink: 0, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: finalPrefixColor }, displayPrefix)), /* @__PURE__ */ React4.createElement(Box3, { marginLeft: 1, backgroundColor: innerBgColor, flexShrink: 1 }, renderInlineDiff()));
    });
    DiffBlock = React4.memo(({ text, columns = 80, extension }) => {
      const match = text.match(/\[DIFF_START\]([\s\S]*?)(?:\[DIFF_END\]|$)/);
      const diffBody = match ? match[1].trim() : "";
      const diffLines = diffBody.split("\n");
      const parsedLines = diffLines.map((line) => {
        return {
          line,
          parsed: parseLineInfo(line),
          pairContent: null
        };
      });
      let currentGroup = [];
      for (let i = 0; i < parsedLines.length; i++) {
        const item = parsedLines[i];
        if (item.parsed && (item.parsed.isR || item.parsed.isA)) {
          currentGroup.push(item);
        } else {
          if (currentGroup.length > 0) {
            alignChangeGroup(currentGroup);
            currentGroup = [];
          }
        }
      }
      if (currentGroup.length > 0) {
        alignChangeGroup(currentGroup);
      }
      return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: columns - 3, marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingY: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: 3, flexShrink: 0 }), /* @__PURE__ */ React4.createElement(Box3, { width: 1, flexShrink: 0, marginLeft: 1 }), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " "))), parsedLines.map((item, i) => /* @__PURE__ */ React4.createElement(
        DiffLine,
        {
          key: i,
          line: item.line,
          pairContent: item.pairContent,
          columns: columns - 3,
          extension
        }
      )), /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: 3, flexShrink: 0 }), /* @__PURE__ */ React4.createElement(Box3, { width: 1, flexShrink: 0, marginLeft: 1 }), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " ")))));
    });
    CodeRenderer = React4.memo(({ text, columns = 80 }) => {
      if (!text) return null;
      let extension = "";
      const fileMatch = text.match(/File\s+\[(.*?)\]/i);
      if (fileMatch) {
        extension = fileMatch[1].split(".").pop().toLowerCase();
      }
      if (text.includes("[DIFF_START]")) {
        return /* @__PURE__ */ React4.createElement(DiffBlock, { text, columns, extension });
      }
      if (text.includes("- Content Preview:")) {
        const mainParts = text.split("- Content Preview:");
        const headerText = mainParts[0];
        const contentPart = mainParts[1] || "";
        const footerMarker = "[SYSTEM] Check the content preview for verification [/SYSTEM]";
        const contentAndFooter = contentPart.split(footerMarker);
        const content = contentAndFooter[0]?.trim() || "";
        const footer = contentAndFooter[1] ? `${footerMarker}${contentAndFooter[1]}` : "";
        const codeLines = content.split("\n");
        const gutterWidth = String(codeLines.length).length;
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: columns - 3 }, /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "column",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            width: "100%",
            marginBottom: 1,
            backgroundColor: "#1a1a1a"
          },
          /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, null, " ")), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " "))), codeLines.map((line, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray", dimColor: true }, String(idx + 1).padStart(gutterWidth, " "), " ")), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, renderHighlightedLine(line, extension, "white")))), /* @__PURE__ */ React4.createElement(Box3, { width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, null, " ")), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " "))))
        ));
      }
      if (text.includes("```")) {
        const parts = text.split(/(```\w*\n?[\s\S]*?(?:```|$))/g);
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: columns - 3 }, parts.map((part, i) => {
          if (part.startsWith("```")) {
            const match = part.match(/```(\w*)\n?([\s\S]*?)(?:```|$)/);
            const lang = match ? match[1] : "code";
            const code = match ? match[2] : part.replace(/^```\w*\n?/, "").replace(/```$/, "");
            const codeLines = code.trimEnd().split("\n");
            const gutterWidth = String(codeLines.length).length;
            return /* @__PURE__ */ React4.createElement(
              Box3,
              {
                key: i,
                flexDirection: "column",
                marginY: 1,
                borderStyle: "single",
                borderLeft: true,
                borderRight: false,
                borderTop: false,
                borderBottom: false,
                borderColor: "#444444",
                paddingLeft: 2,
                paddingRight: 0,
                width: "100%"
              },
              /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray", bold: true }, "\u25B6_ ", lang.toUpperCase() || "CODE")),
              /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: "100%" }, codeLines.map((line, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, String(idx + 1).padStart(gutterWidth, " "), " ")), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, renderHighlightedLine(line, lang, "#e1e4e8")))))
            );
          }
          let cleanPart = part;
          if (i > 0) {
            cleanPart = cleanPart.replace(/^[\r\n]+/, "");
          }
          if (i < parts.length - 1) {
            cleanPart = cleanPart.replace(/[\r\n]+$/, "");
          }
          if (!cleanPart) return null;
          return /* @__PURE__ */ React4.createElement(MarkdownText, { key: i, text: cleanPart, columns: columns - 3 });
        }));
      }
      return /* @__PURE__ */ React4.createElement(MarkdownText, { text, columns: columns - 3 });
    });
    formatThinkingDuration = (ms) => {
      const totalSecs = Math.round(ms / 1e3);
      if (totalSecs <= 0) return "0s";
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      if (m > 0) {
        return `${m}m ${s}s`;
      }
      return `${totalSecs}s`;
    };
    MessageItem = React4.memo(({ msg, showFullThinking, columns = 80, aiProvider, version }) => {
      const isDiffResult = msg.role === "system" && (msg.text?.includes("[DIFF_START]") || msg.text?.includes("- Content Preview:"));
      const isPatchError = msg.role === "system" && msg.text?.includes("[TOOL RESULT]: ERROR:") && !msg.text?.includes("[DIFF_START]") && (msg.toolName === "update_file" || msg.text?.includes("Could not find exact match"));
      const isTerminalRecord = msg.isTerminalRecord;
      const isHomeWarning = msg.isHomeWarning;
      if (isHomeWarning) {
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", borderStyle: "round", borderColor: "white", dimColor: true, padding: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, msg.text)), /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, marginTop: 0, marginBottom: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white" }, msg.subText))));
      }
      if (msg.isLogo) {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", alignItems: "flex-start", width: "100%", marginY: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, getFluxLogo(version, aiProvider)));
      }
      if (msg.id && String(msg.id).startsWith("welcome")) {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", alignItems: "center", width: "100%", marginY: 1 }, /* @__PURE__ */ React4.createElement(Box3, { borderStyle: "round", borderColor: "grey", paddingX: 3, paddingY: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, msg.text.trim())));
      }
      if (msg.isVisualFeedback) {
        return (
          // [SPACE POINT]
          /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 0, marginTop: 0, paddingX: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { color: "white" }, msg.text))
        );
      }
      if (isPatchError) {
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 1, paddingY: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true, underline: true }, "\u2717 PATCH FAILED"), /* @__PURE__ */ React4.createElement(Box3, { marginTop: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "grey", bold: true }, "Model generated malformed edit."))));
      }
      if (msg.role === "system" && msg.text?.includes("[TOOL RESULT]") && !isDiffResult && !isTerminalRecord && !isPatchError) return null;
      if (msg.isImageStats) {
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", borderStyle: "round", borderColor: "grey", padding: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, backgroundColor: "#0e1b21" }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, "IMAGE STATS")), /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, marginTop: 1, marginBottom: 1, flexDirection: "column" }, msg.text.split("\n").map((line, i) => /* @__PURE__ */ React4.createElement(Text4, { key: i, color: "grey" }, line)))));
      }
      if (msg.isAskRecord) {
        const selectionMatch = msg.text.match(/Selection: (.*)/);
        const selection = selectionMatch ? selectionMatch[1] : "No selection";
        const s = emojiSpace(2);
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 0, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "column",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            paddingTop: 1,
            paddingBottom: 1,
            backgroundColor: "#1a1a1a",
            width: "100%"
          },
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, "AGENT REQUEST: RESOLVED")),
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white" }, "Selection: ", /* @__PURE__ */ React4.createElement(Text4, { color: "grey", bold: true }, selection)))
        ));
      }
      if (msg.isAboutRecord) {
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 0, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "column",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            paddingTop: 1,
            paddingBottom: 1,
            backgroundColor: "#1a1a1a",
            width: "100%"
          },
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, "ABOUT FLUX FLOW")),
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, msg.text))
        ));
      }
      if (msg.isUpdateNotification) {
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "column",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            paddingTop: 1,
            paddingBottom: 1,
            backgroundColor: "#1a1a1a",
            width: "100%"
          },
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, "UPDATE AVAILABLE")),
          /* @__PURE__ */ React4.createElement(Box3, { paddingX: 1, marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React4.createElement(CodeRenderer, { text: msg.text, columns }))
        ));
      }
      if (msg.isHelpRecord) {
        const commandList = [
          { cmd: "/quit", desc: "Exit and shutdown Flux" },
          { cmd: "/help", desc: "Show all available commands" },
          { cmd: "/compress", desc: "Summarize and compress chat history" },
          { cmd: "/clear", desc: "Clear terminal screen" },
          { cmd: "/resume", desc: "Load previous session" },
          { cmd: "/revert", desc: "Revert codebase to checkpoint" },
          { cmd: "/save", desc: "Force save current chat" },
          { cmd: "/export", desc: "Export current chat in a .txt file" },
          { cmd: "/chats", desc: "List all chat sessions" },
          { cmd: "/btw", desc: "Send raw inquiry mid-turn" },
          { cmd: "/image", desc: "Generate images" },
          { cmd: "/budget", desc: "Set or View budget limits" },
          { cmd: "/mode", desc: "Toggle Flux/Flow modes" },
          { cmd: "/thinking", desc: "Set AI reasoning depth" },
          { cmd: "/model", desc: "Switch AI model" },
          { cmd: "/settings", desc: "Configure system prefs" },
          { cmd: "/key", desc: "Manage API keys" },
          { cmd: "/profile", desc: "Edit developer persona" },
          { cmd: "/memory", desc: "Manage agent memory" },
          { cmd: "/stats", desc: "Show session usage" },
          { cmd: "/reset", desc: "Wipe all project data" },
          { cmd: "/about", desc: "Project info & credits" },
          { cmd: "/changelog", desc: "View latest updates" },
          { cmd: "/docs", desc: "View documentation" },
          { cmd: "/fluxflow", desc: "Project management" },
          { cmd: "/update", desc: "Check/Install updates" }
        ];
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 1, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true, underline: true }, "COMMAND REFERENCE"), /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", marginTop: 1 }, commandList.map((c, i) => /* @__PURE__ */ React4.createElement(Box3, { key: i, flexDirection: "row" }, /* @__PURE__ */ React4.createElement(Box3, { width: 15 }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", bold: true }, c.cmd)), /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, " - ", c.desc))))));
      }
      if (msg.isTerminalRecord) {
        const cmdMatch = msg.text.match(/COMMAND: (.*)/);
        const ptyMatch = msg.text.match(/PTY: (true|false)/);
        const outputMatch = msg.text.match(/OUTPUT: ([\s\S]*)/);
        const cmd = cmdMatch ? cmdMatch[1] : "Unknown";
        const isPty = ptyMatch ? ptyMatch[1] === "true" : false;
        const outputList = outputMatch ? outputMatch[1] : "";
        return /* @__PURE__ */ React4.createElement(Box3, { marginBottom: 0, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(TerminalBox, { command: cmd, output: outputList, completed: true, columns, isPty }));
      }
      const [animationDone, setAnimationDone] = React4.useState(!msg.isStreaming);
      const content = React4.useMemo(() => cleanSignals(msg.text), [msg.text]);
      React4.useEffect(() => {
        if (msg.isStreaming) setAnimationDone(false);
      }, [msg.id]);
      const finalContent = React4.useMemo(() => {
        if (msg.role === "think" && !showFullThinking) {
          return "Thinking...";
        }
        return msg.isStreaming ? content : content.trimEnd();
      }, [content, msg.role, showFullThinking, msg.isStreaming]);
      return (
        // [SPACE POINT]
        /* @__PURE__ */ React4.createElement(Box3, { marginBottom: msg.role === "think" ? 0 : msg.role === "user" ? 0 : msg.role === "agent" ? 0 : 0, marginTop: msg.role === "think" ? 0 : msg.role === "user" ? 0 : msg.role === "agent" ? 0 : 0, flexDirection: "column", flexShrink: 0, width: "100%", flexGrow: 1 }, msg.role === "user" ? /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: columns - 1 }, /* @__PURE__ */ React4.createElement(Box3, { width: columns - 1, height: 1, overflow: "hidden" }, /* @__PURE__ */ React4.createElement(Text4, { color: "#444444" }, "\u2584".repeat(Math.max(1, columns - 1)))), /* @__PURE__ */ React4.createElement(
          Box3,
          {
            backgroundColor: "#444444",
            paddingX: 1,
            paddingY: 0,
            width: columns - 1,
            flexDirection: "column"
          },
          wrapText(
            finalContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\\n/g, "\n").replace(/\\$/, ""),
            columns - 7
          ).split("\n").map((line, lineIdx) => /* @__PURE__ */ React4.createElement(Box3, { key: lineIdx, flexDirection: "row", width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { flexShrink: 0, width: 2 }, /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, lineIdx === 0 ? ">" : " ")), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: line, color: msg.color || "white" }))))
        ), /* @__PURE__ */ React4.createElement(Box3, { width: columns - 1, height: 1, overflow: "hidden" }, /* @__PURE__ */ React4.createElement(Text4, { color: "#444444" }, "\u2580".repeat(Math.max(1, columns - 1))))) : msg.role === "think" ? /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", marginTop: 0, marginBottom: 0, paddingX: 1, width: "100%" }, msg.isStreaming && !msg.duration ? /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, "\u2727 Thinking...") : /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, "\u2726 Thought", msg.duration ? /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, " for ", /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, formatThinkingDuration(msg.duration))) : "..."), /* @__PURE__ */ React4.createElement(Box3, { borderStyle: "single", borderLeft: true, borderRight: false, borderTop: false, borderBottom: false, paddingLeft: 2, paddingTop: 1, paddingBottom: 1, flexDirection: "column", width: "100%" }, formatThinkText(finalContent, columns))) : /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, marginTop: 0, width: "100%" }, /* @__PURE__ */ React4.createElement(CodeRenderer, { text: finalContent.replace(/ \|\n\n/g, " |\n"), columns }), msg.memoryUpdated && /* @__PURE__ */ React4.createElement(Box3, { marginTop: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { color: "white", italic: true }, "[Memory Updated]")), msg.role === "agent" && msg.workedDuration ? /* @__PURE__ */ React4.createElement(Box3, { marginTop: 1, marginBottom: 2, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, null, "["), /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "Worked for ", /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, formatThinkingDuration(msg.workedDuration))), /* @__PURE__ */ React4.createElement(Text4, null, "]")) : null))
      );
    });
    BlockItem = React4.memo(({ block, columns = 80, showFullThinking, aiProvider, version }) => {
      const { msg, type, text, isStreamingMsg, workedDuration } = block;
      if (type === "chunk") {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: "100%" }, block.blocks.map((b) => /* @__PURE__ */ React4.createElement(
          BlockItem,
          {
            key: b.key,
            block: b,
            columns,
            showFullThinking,
            aiProvider,
            version
          }
        )));
      }
      if (type === "full-message") {
        return /* @__PURE__ */ React4.createElement(
          MessageItem,
          {
            msg,
            showFullThinking,
            columns,
            aiProvider,
            version
          }
        );
      }
      if (type === "think-header") {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: "100%", marginTop: 0, marginBottom: 0 }, isStreamingMsg ? /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, "\u2727 Thinking...") : /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, "\u2726 Thought..."), showFullThinking && /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "\u2502 ")));
      }
      if (type === "think-line") {
        if (!showFullThinking) return null;
        if (!text || text.trim() === "") {
          return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", width: "100%", paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "\u2502 "));
        }
        const animatedText = useStreamingText(text, isStreamingMsg, block.isActiveBlock);
        const trimmed = animatedText.trim();
        const isUnordered = /^[\*\-\+]\s/.test(trimmed);
        const isOrdered = /^\d+\.\s/.test(trimmed);
        let content = animatedText;
        if (isUnordered || isOrdered) {
          const bullet = isUnordered ? "  \u2022 " : trimmed.match(/^\d+\.\s/)[0];
          const indent = " ".repeat(bullet.length);
          const wrappedPart = wrapText(trimmed.replace(/^[\*\-\d+\.]+\s/, ""), columns - (bullet.length + 10));
          content = bullet + wrappedPart.split("\n").join("\n" + indent);
        } else {
          content = wrapText(animatedText, columns - 10);
        }
        const wrappedLines = content.split("\n");
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: "100%" }, wrappedLines.map((wLine, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx, flexDirection: "row", width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "\u2502 "), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(InlineMarkdown, { text: wLine, color: "gray", italic: true })))));
      }
      if (type === "think-footer-padding") {
        if (!showFullThinking) return null;
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", width: "100%", paddingX: 1 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "\u2502 "));
      }
      if (type === "agent-line") {
        if (!text || text.trim() === "") {
          return /* @__PURE__ */ React4.createElement(Box3, { height: 1 });
        }
        const animatedText = useStreamingText(text, isStreamingMsg, block.isActiveBlock);
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(CodeRenderer, { text: animatedText, columns }));
      }
      if (type === "table") {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(TableRenderer, { buffer: text.split("\n"), terminalWidth: columns }));
      }
      if (type === "diff-line") {
        const { isFirstLine, isLastLine } = block;
        const renderPaddingLine = (isEnd = false) => /* @__PURE__ */ React4.createElement(Box3, { backgroundColor: "#1a1a1a", paddingX: 1, width: columns, marginBottom: isEnd ? 1 : 0 }, /* @__PURE__ */ React4.createElement(Box3, { width: 3, flexShrink: 0 }), /* @__PURE__ */ React4.createElement(Box3, { width: 1, flexShrink: 0, marginLeft: 1 }), /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, marginLeft: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " ")));
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column" }, isFirstLine && renderPaddingLine(false), /* @__PURE__ */ React4.createElement(
          DiffLine,
          {
            line: text,
            pairContent: block.pairContent,
            parentText: void 0,
            columns
          }
        ), isLastLine && renderPaddingLine(true));
      }
      if (type === "code-fence-open") {
        const borderProps = {
          borderStyle: "single",
          borderLeft: true,
          borderRight: false,
          borderTop: false,
          borderBottom: false,
          borderColor: "#444444",
          paddingLeft: 2,
          width: "100%"
        };
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", marginTop: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", ...borderProps }, /* @__PURE__ */ React4.createElement(Text4, null, " ")), /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "row", ...borderProps }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray", bold: true }, "\u25B6_ ", (text || "CODE").toUpperCase())));
      }
      if (type === "code-line") {
        const { lineNum, lang } = block;
        return /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "row",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            width: "100%"
          },
          /* @__PURE__ */ React4.createElement(Box3, { width: 4, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray", dimColor: true }, String(lineNum).padStart(3, " "), " ")),
          /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, renderHighlightedLine(text, lang, "#e1e4e8"))
        );
      }
      if (type === "code-fence-close") {
        return /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "row",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            marginBottom: 1,
            width: "100%"
          },
          /* @__PURE__ */ React4.createElement(Text4, null, " ")
        );
      }
      if (type === "write-header") {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: columns }, /* @__PURE__ */ React4.createElement(MarkdownText, { text, columns }));
      }
      if (type === "write-line") {
        const { gutterWidth, lineNum, isFirstLine, isLastLine, extension, wrappedLines } = block;
        const renderPaddingLine = (isEnd = false) => /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "row",
            width: columns,
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            backgroundColor: "#1a1a1a",
            marginBottom: isEnd ? 1 : 0
          },
          /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, null, " ".repeat(gutterWidth + 2))),
          /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1 }, /* @__PURE__ */ React4.createElement(Text4, null, " "))
        );
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column" }, isFirstLine && renderPaddingLine(false), /* @__PURE__ */ React4.createElement(
          Box3,
          {
            flexDirection: "row",
            width: columns,
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            backgroundColor: "#1a1a1a"
          },
          /* @__PURE__ */ React4.createElement(Box3, { width: gutterWidth + 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: "gray", dimColor: true }, String(lineNum).padStart(gutterWidth, " "), " ")),
          /* @__PURE__ */ React4.createElement(Box3, { flexGrow: 1, flexDirection: "column" }, (wrappedLines || [text]).map((wl, idx) => /* @__PURE__ */ React4.createElement(Box3, { key: idx }, renderHighlightedLine(wl, extension, "white"))))
        ), isLastLine && renderPaddingLine(true));
      }
      if (type === "write-footer") {
        return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", paddingX: 1, width: columns, marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React4.createElement(MarkdownText, { text, columns }));
      }
      if (type === "worked-duration") {
        return /* @__PURE__ */ React4.createElement(Box3, { marginTop: 1, marginBottom: 2, paddingX: 1, width: "100%" }, /* @__PURE__ */ React4.createElement(Text4, null, "["), /* @__PURE__ */ React4.createElement(Text4, { color: "gray" }, "Worked for ", /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "white" }, formatThinkingDuration(workedDuration))), /* @__PURE__ */ React4.createElement(Text4, null, "]"));
      }
      return null;
    });
    ChatLayout = React4.memo(({ messages, showFullThinking, columns = 80, aiProvider, version }) => {
      return /* @__PURE__ */ React4.createElement(Box3, { flexDirection: "column", width: "100%" }, messages.map((msg, idx) => /* @__PURE__ */ React4.createElement(
        MessageItem,
        {
          key: msg.id || idx,
          msg,
          showFullThinking,
          columns,
          aiProvider,
          version
        }
      )));
    });
  }
});

// src/components/StatusBar.jsx
import React5 from "react";
import { Box as Box4, Text as Text5 } from "ink";
import { useState as useState5, useEffect as useEffect4 } from "react";
function getMemoryInfo() {
  if (activeGetMemoryInfo) {
    activeGetMemoryInfo();
  }
}
var activeGetMemoryInfo, StatusBar, StatusBar_default;
var init_StatusBar = __esm({
  "src/components/StatusBar.jsx"() {
    init_text();
    activeGetMemoryInfo = null;
    StatusBar = React5.memo(({ mode, thinkingLevel, tokens = "0.0k", tokensTotal = "0.0k", chatId = "NEW-SESSION", isMemoryEnabled = true, apiTier = "Free", aiProvider = "Google", activeModel = "" }) => {
      const modeIcon = mode === "Flux" ? "" : "";
      const [memoryUsage, setMemoryUsage] = useState5(0);
      const [memoryLimit, setMemoryLimit] = useState5(0);
      const [memoryUnit, setMemoryUnit] = useState5("MB");
      const updateMemory = () => {
        const usage = process.memoryUsage();
        const isGB = usage.heapTotal / (1024 * 1024) >= 1024;
        const currentUnit = isGB ? "GB" : "MB";
        const formatToNumber = (bytes, toGB) => {
          const converted = bytes / (1024 * 1024 * (toGB ? 1024 : 1));
          return toGB ? parseFloat(converted.toFixed(2)) : Math.round(converted);
        };
        setMemoryUnit(currentUnit);
        setMemoryLimit(formatToNumber(usage.heapTotal, isGB));
        setMemoryUsage(formatToNumber(usage.heapUsed, isGB));
      };
      useEffect4(() => {
        activeGetMemoryInfo = updateMemory;
        updateMemory();
        const interval = setInterval(() => {
          updateMemory();
        }, 3e4);
        return () => {
          clearInterval(interval);
          if (activeGetMemoryInfo === updateMemory) {
            activeGetMemoryInfo = null;
          }
        };
      }, []);
      let maxLimit = 262144;
      if (aiProvider === "NVIDIA" && (activeModel?.includes("glm") || activeModel?.includes("gpt") || activeModel?.includes("qwen"))) {
        maxLimit = 128e3;
      } else if (aiProvider === "DeepSeek" || aiProvider === "Google" && apiTier === "Paid") {
        maxLimit = 409600;
      }
      return /* @__PURE__ */ React5.createElement(
        Box4,
        {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingX: 1,
          width: "100%"
        },
        /* @__PURE__ */ React5.createElement(Box4, null, /* @__PURE__ */ React5.createElement(Box4, { marginRight: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "white", bold: true }, mode.toUpperCase())), /* @__PURE__ */ React5.createElement(Text5, { color: "gray", dimColor: true }, "\u2503"), /* @__PURE__ */ React5.createElement(Box4, { marginX: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "white", bold: true }, thinkingLevel.toUpperCase())), /* @__PURE__ */ React5.createElement(Text5, { color: "gray", dimColor: true }, "\u2503"), /* @__PURE__ */ React5.createElement(Box4, { marginX: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "gray", bold: true }, "MEM: "), /* @__PURE__ */ React5.createElement(Text5, { color: "white", bold: true }, isMemoryEnabled ? "ON" : "OFF"))),
        /* @__PURE__ */ React5.createElement(Box4, { flexGrow: 1, justifyContent: "center", paddingX: 2 }, /* @__PURE__ */ React5.createElement(Text5, { color: "white", italic: true }, truncatePath(process.cwd(), 35))),
        /* @__PURE__ */ React5.createElement(Box4, null, /* @__PURE__ */ React5.createElement(Box4, { marginX: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "white" }, formatTokens(tokensTotal), " ", /* @__PURE__ */ React5.createElement(Text5, { dimColor: true }, (tokens / maxLimit * 100).toFixed(0), "%"))), /* @__PURE__ */ React5.createElement(Text5, { color: "gray", dimColor: true }, "\u2503"), /* @__PURE__ */ React5.createElement(Box4, { marginX: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "grey", bold: true }, memoryUsage, "/", memoryLimit, " ", memoryUnit)), /* @__PURE__ */ React5.createElement(Text5, { color: "gray", dimColor: true }, "\u2503"), /* @__PURE__ */ React5.createElement(Box4, { marginLeft: 1 }, /* @__PURE__ */ React5.createElement(Text5, { color: "gray", bold: true }, chatId), (apiTier === "Custom" || apiTier === "Paid") && /* @__PURE__ */ React5.createElement(Box4, null, /* @__PURE__ */ React5.createElement(Text5, { color: "gray", dimColor: true }, " \u2503 "), /* @__PURE__ */ React5.createElement(Text5, { color: "gray", bold: true }, "PAID"))))
      );
    });
    StatusBar_default = StatusBar;
  }
});

// src/components/CommandMenu.jsx
import React6 from "react";
import { Box as Box5, Text as Text6 } from "ink";
import SelectInput from "ink-select-input";
function CommandMenu({ title, subtitle, items, onSelect }) {
  return /* @__PURE__ */ React6.createElement(
    Box5,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "white",
      padding: 0,
      marginTop: 0,
      flexShrink: 0,
      width: "100%"
    },
    title && /* @__PURE__ */ React6.createElement(Box5, { paddingX: 1, paddingY: 0, marginBottom: subtitle ? 0 : 1 }, /* @__PURE__ */ React6.createElement(Text6, { color: "gray", bold: true }, typeof title === "string" ? title.toUpperCase() : title)),
    subtitle && /* @__PURE__ */ React6.createElement(Box5, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React6.createElement(Text6, { color: "gray", italic: true }, "   ", subtitle)),
    /* @__PURE__ */ React6.createElement(Box5, { flexDirection: "column", width: "100%" }, /* @__PURE__ */ React6.createElement(
      SelectInput,
      {
        items,
        onSelect,
        itemComponent: CustomItem,
        indicatorComponent: () => null
      }
    )),
    /* @__PURE__ */ React6.createElement(Box5, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React6.createElement(Text6, { color: "gray", italic: true }, "(Arrows to select \u2022 Enter to confirm)"))
  );
}
var CustomItem;
var init_CommandMenu = __esm({
  "src/components/CommandMenu.jsx"() {
    CustomItem = ({ label: label2, isSelected }) => {
      const isCancel = label2 === "Cancel" || label2 === "Back" || label2.toLowerCase().includes("exit") || label2.toLowerCase().includes("back");
      return /* @__PURE__ */ React6.createElement(
        Box5,
        {
          marginTop: isCancel ? 1 : 0,
          backgroundColor: isSelected ? "#2a2a2a" : void 0,
          paddingX: 1,
          width: "100%"
        },
        /* @__PURE__ */ React6.createElement(Text6, { color: isSelected ? "white" : "gray", bold: isSelected }, isSelected ? "\u276F " : "  ", label2)
      );
    };
  }
});

// src/utils/arg_parser.js
var parseArgs;
var init_arg_parser = __esm({
  "src/utils/arg_parser.js"() {
    parseArgs = (argsString) => {
      const args = {};
      if (!argsString) return args;
      let i = 0;
      while (i < argsString.length) {
        while (i < argsString.length && /[\s,]/.test(argsString[i])) i++;
        if (i >= argsString.length) break;
        let keyMatch = argsString.substring(i).match(/^(\w+)\s*=\s*/);
        if (!keyMatch) {
          i++;
          continue;
        }
        const key = keyMatch[1];
        i += keyMatch[0].length;
        let value = "";
        if (i < argsString.length && (argsString[i] === '"' || argsString[i] === "'" || argsString[i] === "`")) {
          const quote = argsString[i];
          i++;
          let start = i;
          let end = -1;
          let searchIndex = i;
          while (searchIndex < argsString.length) {
            let qIdx = argsString.indexOf(quote, searchIndex);
            if (qIdx === -1) break;
            let backslashCount = 0;
            for (let k = qIdx - 1; k >= 0 && argsString[k] === "\\"; k--) {
              backslashCount++;
            }
            if (backslashCount % 2 !== 0) {
              searchIndex = qIdx + 1;
              continue;
            }
            const afterRaw = argsString.substring(qIdx + 1);
            const after = afterRaw.trim();
            const isLogicalEnd = after === "" || // End of entire string
            /^,\s*\w+\s*=/.test(after) || // Next argument separator (comma followed by key=)
            after.startsWith(")") && (after.length === 1 || /^\)\s*([,\]\s]|\[\[?tool:)/i.test(after));
            if (isLogicalEnd && afterRaw.startsWith("\n")) {
              const nextLine = after.split("\n")[0];
              if (!nextLine.includes("=") && !nextLine.includes(")")) {
                searchIndex = qIdx + 1;
                continue;
              }
            }
            if (isLogicalEnd) {
              end = qIdx;
              break;
            }
            searchIndex = qIdx + 1;
          }
          if (end !== -1) {
            value = argsString.substring(start, end);
            i = end + 1;
          } else {
            value = argsString.substring(start);
            i = argsString.length;
          }
          const isPathKey = key.toLowerCase().includes("path") || ["dest", "source", "to", "from"].includes(key.toLowerCase());
          value = value.replace(/\\(.)/g, (match, char) => {
            switch (char) {
              case "n":
                return "\n";
              case "r":
                return "\r";
              case "t":
                return "	";
              case "\\":
                return "\\";
              default:
                if (char === quote) return quote;
                return match;
            }
          });
        } else if (i < argsString.length && argsString[i] === "[") {
          let balance = 0;
          let inString = null;
          let start = i;
          let end = -1;
          for (let j = i; j < argsString.length; j++) {
            const char = argsString[j];
            if (inString && char === inString) {
              let backslashCount = 0;
              for (let k = j - 1; k >= 0 && argsString[k] === "\\"; k--) {
                backslashCount++;
              }
              if (backslashCount % 2 === 0) {
                inString = null;
              }
            } else if (!inString && (char === '"' || char === "'" || char === "`")) {
              inString = char;
            }
            if (!inString) {
              if (char === "[") balance++;
              else if (char === "]") balance--;
              if (balance === 0) {
                end = j;
                break;
              }
            }
          }
          if (end !== -1) {
            value = argsString.substring(start, end + 1);
            i = end + 1;
            try {
              let normalized = value.trim();
              if (normalized.startsWith("'") || normalized.includes("'")) {
              }
            } catch (e) {
            }
          } else {
            value = argsString.substring(start);
            i = argsString.length;
          }
        } else {
          let rest = argsString.substring(i);
          let boundaryMatch = rest.match(/,\s*\w+\s*=|(?:\s*\)\s*(?:$|\]\]))/);
          if (boundaryMatch) {
            let boundaryIndex = boundaryMatch.index;
            value = rest.substring(0, boundaryIndex).trim();
            i += boundaryIndex;
          } else {
            value = rest.trim();
            i = argsString.length;
          }
        }
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (typeof value === "string" && !isNaN(value) && value.trim() !== "") value = Number(value);
        if (typeof value === "string" && (key.toLowerCase().includes("path") || ["dest", "source", "to", "from"].includes(key.toLowerCase()))) {
          value = value.replace(/\x0C/g, "\\f").replace(/\x0D/g, "\\r").replace(/\x0B/g, "\\v").replace(/\x08/g, "\\b");
        }
        args[key] = value;
      }
      return args;
    };
  }
});

// src/data/main_tools.js
import { execSync } from "child_process";
var _isPsAvailable, isPsAvailable, TOOL_PROTOCOL;
var init_main_tools = __esm({
  async "src/data/main_tools.js"() {
    await init_exec_command();
    _isPsAvailable = null;
    isPsAvailable = () => {
      if (process.platform !== "win32") return false;
      if (_isPsAvailable !== null) return _isPsAvailable;
      try {
        execSync('powershell.exe -NoProfile -Command "exit"', { stdio: "ignore" });
        _isPsAvailable = true;
      } catch (e) {
        _isPsAvailable = false;
      }
      return _isPsAvailable;
    };
    TOOL_PROTOCOL = (mode, osDetected, isMultiModal, aiProvider) => `
-- TOOL DEFINITIONS --
Internal tools. **MUST use the EXACT syntax** [tool:functions.ToolName(args)]. **NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED**

**TOOL USAGE POLICY:**
- **MAX 3 TOOL CALLS PER TURN${mode === "Flux" ? " (EXCEPTION FOR Todo TOOL: 3+ CALLS ALLOWED, Run TOOL: Limit 1, OR 2 CONSECUTIVE Run TOOL)" : ""}. Next Turn, verify tool results, plan next**
${mode === "Flux" ? "- USE multiple search & replace on patch tool if editing same file/path with many changes \u2190 **HIGHLY RECOMMENDED**\n- Tool execution denied? MUST use 'Ask' tool immediately for user reason/changes. NEVER END RESPONSE OR PROCEED BLINDLY \u2190 **MANDATORY**\n- FileMap >>> ReadFile to understand file efficiently\n- Want spefific STRING across project/file? SearchKeyword >> Guessing/ReadFile\n- HUGE FILES? SearchKeyword >> FileMap/Full Read\n- No tool spamming\n- **MUST MARK DONE/APPEND Todos BASED ON REALTIME TASK PROGRESS ON *EVERY TURN***" : ""}
${mode === "Flux" ? "- **File Tools >> Code in chat**\n\n" : ""}- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish/guess. Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown info/docs
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === "Flux" ? `- WORKSPACE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. ${aiProvider !== "Google" ? `${isMultiModal ? `Supports images/docs. **User gives image/doc: VIEW FIRST**` : `No Multimodal support`}` : `Supports images/docs. **User gives image/doc: VIEW FIRST**`}
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats including File Sizes
3. [tool:functions.FileMap(path="path/file")]. Shows file structure, functions, class, import/export, variable
4. [tool:functions.PatchFile(path="...", replaceContent1="full line/block", newContent1="...", ...MAX 6)]. Surgical Patch. **Multiple patch on same file/path? Use replaceContent2, newContent2 etc >>> multiple spams**. Unsure? ReadFile >> guessing. **MUST VERIFY DIFF**
5. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
6. [tool:functions.SearchKeyword(keyword="...", file="optional", subString="true/false optional")]. Global project search. If 'file' is provided, searches only that file. Finds definitions/logic without reading every file. Usage: Can search for relevent lines/logic area to read specifically for edit
7. [tool:functions.Run(command="...")]. Runs ${osDetected === "Windows" ? isPsAvailable() ? `WINDOWS POWERSHELL ONLY` : `WINDOWS CMD ONLY` : `BASH`} command. Destructive/Irreversible ops \u2192 Ask user
8. [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASK STRINGS])]. Task List, NO Markdown IN ARRAY. USAGE: ANALYZE USER REQUEST **IF** MULTIPLE TASK \u2192 BREAK DOWN TASK \u2192 CREATE TODO **BEFORE** DIVING IN. 'tasks' & 'markDone' OPTIONAL PARAMETERS WITH method 'get'. USE 'get' method WITH 'markDone' to mark task completed. **EVERY TURN UPDATE POLICY**
9. [tool:functions.await(time="seconds")]. For waiting without exiting agent loop, 15s - 180s

-- SUB AGENTS DEFINITIONS --
USE PROACTIVELY TO PARALLELIZE TASK QUICKLY **USE OF SUB AGENTS HIGHLY RECOMENDED**
Invocation Types:
- invoke (async, usage: background worker for parallel tasks, upto 7 parallel agents (3+ calls allowed), can take long time, if invoked DO NOT do the task yourself unless explicit ERROR)
- invokeSync (sync, usage: blocking main agent loop, task delegation, repeatetive work, sequential tasks, can save tokens)

1. [agent:generalist.invokeSync/invoke(title="...", task="...")]. Task must me detailed, with exact file paths, imports/exports, dependency, folder structure
2. [agent:generalist.getProgress(id="...")]. Usage: Check progress of async subagent task, taking time? do your own task OR await (exponentially longer after 1st check, eg. 15s, 30s, 45s ...) >>> spamming getProgress`.trim() : `- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout
2. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document
- WORKSPACE TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim();
  }
});

// src/tools/exec_command.js
import { spawn } from "child_process";
var pty, isPtyAvailable, stripAnsi, cleanTerminalOutput, activeChildProcess, isActiveCommandPty, writeToActiveCommand, terminateActiveCommand, adjustWindowsCommand, exec_command, runStandardSpawn;
var init_exec_command = __esm({
  async "src/tools/exec_command.js"() {
    init_arg_parser();
    await init_main_tools();
    pty = null;
    try {
      const ptyModule = await import("node-pty");
      pty = ptyModule.default || ptyModule;
    } catch (err) {
    }
    isPtyAvailable = !!pty;
    stripAnsi = (str) => {
      if (typeof str !== "string") return str;
      return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
    };
    cleanTerminalOutput = (text) => {
      if (!text) return "";
      const lines = [[]];
      let cursorRow = 0;
      let cursorCol = 0;
      const ansiRegex = /\x1b\[([0-9;]*?)([a-zA-Z])/g;
      let lastIndex = 0;
      let match;
      const writeText = (plainText) => {
        for (let i = 0; i < plainText.length; i++) {
          const char = plainText[i];
          if (char === "\n") {
            cursorRow++;
            cursorCol = 0;
            while (cursorRow >= lines.length) {
              lines.push([]);
            }
          } else if (char === "\r") {
            cursorCol = 0;
          } else {
            while (cursorRow >= lines.length) {
              lines.push([]);
            }
            const line = lines[cursorRow];
            while (cursorCol > line.length) {
              line.push(" ");
            }
            line[cursorCol] = char;
            cursorCol++;
          }
        }
      };
      while ((match = ansiRegex.exec(text)) !== null) {
        writeText(text.substring(lastIndex, match.index));
        const params = match[1];
        const command = match[2];
        const paramValues = params ? params.split(";").map(Number) : [];
        if (command === "A") {
          const count = paramValues[0] || 1;
          cursorRow = Math.max(0, cursorRow - count);
        } else if (command === "B") {
          const count = paramValues[0] || 1;
          cursorRow = cursorRow + count;
          while (cursorRow >= lines.length) {
            lines.push([]);
          }
        } else if (command === "C") {
          const count = paramValues[0] || 1;
          cursorCol = cursorCol + count;
        } else if (command === "D") {
          const count = paramValues[0] || 1;
          cursorCol = Math.max(0, cursorCol - count);
        } else if (command === "G") {
          const col = (paramValues[0] || 1) - 1;
          cursorCol = Math.max(0, col);
        } else if (command === "H" || command === "f") {
          const row = (paramValues[0] || 1) - 1;
          const col = (paramValues[1] || 1) - 1;
          cursorRow = Math.max(0, row);
          cursorCol = Math.max(0, col);
          while (cursorRow >= lines.length) {
            lines.push([]);
          }
        } else if (command === "K") {
          const mode = paramValues[0] || 0;
          if (cursorRow < lines.length) {
            const line = lines[cursorRow];
            if (mode === 0) {
              line.length = cursorCol;
            } else if (mode === 1) {
              for (let c = 0; c < cursorCol && c < line.length; c++) {
                line[c] = " ";
              }
            } else if (mode === 2) {
              line.length = 0;
            }
          }
        } else if (command === "J") {
          const mode = paramValues[0] || 0;
          if (mode === 2 || mode === 3) {
            lines.length = 0;
            lines.push([]);
            cursorRow = 0;
            cursorCol = 0;
          }
        }
        lastIndex = ansiRegex.lastIndex;
      }
      writeText(text.substring(lastIndex));
      const resultLines = lines.map((line) => line.join(""));
      while (resultLines.length > 0 && resultLines[resultLines.length - 1] === "") {
        resultLines.pop();
      }
      return resultLines.join("\n");
    };
    activeChildProcess = null;
    isActiveCommandPty = false;
    writeToActiveCommand = (data) => {
      try {
        if (activeChildProcess) {
          if (isActiveCommandPty && typeof activeChildProcess.write === "function") {
            activeChildProcess.write(data);
          } else if (activeChildProcess.stdin && activeChildProcess.stdin.writable) {
            activeChildProcess.stdin.write(data);
          }
        }
      } catch (err) {
      }
    };
    terminateActiveCommand = () => {
      if (activeChildProcess) {
        try {
          if (isActiveCommandPty && typeof activeChildProcess.destroy === "function") {
            activeChildProcess.destroy();
          } else if (typeof activeChildProcess.kill === "function") {
            if (process.platform === "win32") {
              spawn("taskkill", ["/pid", activeChildProcess.pid, "/f", "/t"]);
            } else {
              activeChildProcess.kill("SIGKILL");
            }
          }
        } catch (err) {
        }
        activeChildProcess = null;
        isActiveCommandPty = false;
      }
    };
    adjustWindowsCommand = (command, usePowerShell = false) => {
      if (process.platform !== "win32") return command;
      const tokens = [];
      let current = "";
      let inQuote = null;
      let isEscaped = false;
      for (let i = 0; i < command.length; i++) {
        const char = command[i];
        if (isEscaped) {
          current += char;
          isEscaped = false;
          continue;
        }
        if (char === "\\") {
          if (command[i + 1] === " ") {
            current += " ";
            i++;
            continue;
          }
          current += char;
          isEscaped = true;
          continue;
        }
        if (inQuote) {
          if (char === inQuote) {
            inQuote = null;
          }
          current += char;
        } else {
          if (char === '"' || char === "'") {
            inQuote = char;
            current += char;
          } else if (char === ";" && !current.includes("://")) {
            if (current.length > 0) {
              tokens.push(current);
              current = "";
            }
            tokens.push(usePowerShell ? ";" : "&");
          } else if (char === "&" && !current.includes("://")) {
            if (command[i + 1] === "&") {
              if (current.length > 0) {
                tokens.push(current);
                current = "";
              }
              tokens.push("&&");
              i++;
            } else {
              if (current.length > 0) {
                tokens.push(current);
                current = "";
              }
              tokens.push("&");
            }
          } else if (char === "|" && !current.includes("://")) {
            if (current.length > 0) {
              tokens.push(current);
              current = "";
            }
            tokens.push("|");
          } else if (/\s/.test(char)) {
            if (current.length > 0) {
              tokens.push(current);
              current = "";
            }
          } else {
            current += char;
          }
        }
      }
      if (current.length > 0) {
        tokens.push(current);
      }
      const looksLikePath = (str) => {
        if (!str.includes("/")) return false;
        if (/^(https?|file|ftp):\/\//i.test(str)) return false;
        if (str.startsWith("@")) return false;
        if (str.startsWith("/") && (str.match(/\//g) || []).length === 1) {
          return false;
        }
        if (/\s\/|\/\s/.test(str)) return false;
        if (/[\(\)\{\}\;\<\>\=\'\"]/.test(str)) return false;
        return true;
      };
      const translatedTokens = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === "mkdir" && usePowerShell && isPsAvailable()) {
          const paths = [];
          let j = i + 1;
          while (j < tokens.length) {
            const nextToken = tokens[j];
            const controlOperators = [">", ">>", "<", "&", "&&", "|", "||", ";"];
            if (controlOperators.includes(nextToken)) {
              break;
            }
            if (nextToken !== "-p" && nextToken !== "--parents" && nextToken !== "-v" && nextToken !== "--verbose") {
              paths.push(nextToken);
            }
            j++;
          }
          if (paths.length > 0) {
            const processedPaths = paths.map((p) => {
              const unquoted = p.replace(/^['"]|['"]$/g, "");
              let newPath = p;
              if (looksLikePath(unquoted)) {
                newPath = p.replace(/\//g, "\\");
              }
              return newPath;
            });
            translatedTokens.push("New-Item", "-ItemType", "Directory", "-Force", "-Path", processedPaths.join(","));
          } else {
            translatedTokens.push("New-Item", "-ItemType", "Directory", "-Force");
          }
          i = j - 1;
          continue;
        }
        if (token === "rm" && usePowerShell && isPsAvailable()) {
          const paths = [];
          let recurse = false;
          let force = false;
          let j = i + 1;
          while (j < tokens.length) {
            const nextToken = tokens[j];
            const controlOperators = [">", ">>", "<", "&", "&&", "|", "||", ";"];
            if (controlOperators.includes(nextToken)) {
              break;
            }
            if (nextToken === "-rf" || nextToken === "-fr") {
              recurse = true;
              force = true;
            } else if (nextToken === "-r" || nextToken === "-R" || nextToken === "--recursive") {
              recurse = true;
            } else if (nextToken === "-f" || nextToken === "--force") {
              force = true;
            } else {
              paths.push(nextToken);
            }
            j++;
          }
          const args = ["Remove-Item"];
          if (recurse) args.push("-Recurse");
          if (force) args.push("-Force");
          if (paths.length > 0) {
            const processedPaths = paths.map((p) => {
              const unquoted = p.replace(/^['"]|['"]$/g, "");
              let newPath = p;
              if (looksLikePath(unquoted)) {
                newPath = p.replace(/\//g, "\\");
              }
              return newPath;
            });
            args.push("-Path", processedPaths.join(","));
          }
          translatedTokens.push(...args);
          i = j - 1;
          continue;
        }
        if (token === "cp" && usePowerShell && isPsAvailable()) {
          const paths = [];
          let recurse = false;
          let force = false;
          let j = i + 1;
          while (j < tokens.length) {
            const nextToken = tokens[j];
            const controlOperators = [">", ">>", "<", "&", "&&", "|", "||", ";"];
            if (controlOperators.includes(nextToken)) {
              break;
            }
            if (nextToken === "-r" || nextToken === "-R" || nextToken === "--recursive") {
              recurse = true;
            } else if (nextToken === "-f" || nextToken === "--force") {
              force = true;
            } else {
              paths.push(nextToken);
            }
            j++;
          }
          const args = ["Copy-Item"];
          if (recurse) args.push("-Recurse");
          if (force) args.push("-Force");
          if (paths.length > 0) {
            const processedPaths = paths.map((p) => {
              const unquoted = p.replace(/^['"]|['"]$/g, "");
              let newPath = p;
              if (looksLikePath(unquoted)) {
                newPath = p.replace(/\//g, "\\");
              }
              return newPath;
            });
            if (processedPaths.length > 1) {
              const dest = processedPaths.pop();
              args.push("-Path", processedPaths.join(","), "-Destination", dest);
            } else {
              args.push("-Path", processedPaths[0]);
            }
          }
          translatedTokens.push(...args);
          i = j - 1;
          continue;
        }
        if (token === "touch" && usePowerShell && isPsAvailable()) {
          const paths = [];
          let j = i + 1;
          while (j < tokens.length) {
            const nextToken = tokens[j];
            const controlOperators = [">", ">>", "<", "&", "&&", "|", "||", ";"];
            if (controlOperators.includes(nextToken)) {
              break;
            }
            paths.push(nextToken);
            j++;
          }
          if (paths.length > 0) {
            const processedPaths = paths.map((p) => {
              const unquoted = p.replace(/^['"]|['"]$/g, "");
              let newPath = p;
              if (looksLikePath(unquoted)) {
                newPath = p.replace(/\//g, "\\");
              }
              return newPath;
            });
            const psTouch = `(${processedPaths.join(", ")}) | ForEach-Object { if (Test-Path $_) { (Get-Item $_).LastWriteTime = [System.DateTime]::Now } else { $null | Out-File -FilePath $_ } }`;
            translatedTokens.push(psTouch);
          }
          i = j - 1;
          continue;
        }
        if (token === "|" && tokens[i + 1] === "tee") {
          if (tokens[i + 2] === "-a") {
            translatedTokens.push(">>");
            i += 2;
          } else {
            translatedTokens.push(">");
            i += 1;
          }
          continue;
        }
        if (token === "|" && tokens[i + 1] === "cat" && tokens[i + 2] === ">") {
          translatedTokens.push(">");
          i += 2;
          continue;
        }
        if (token === "|") {
          const nextToken = tokens[i + 1];
          if (nextToken) {
            const nextUnquoted = nextToken.replace(/^['"]|['"]$/g, "");
            const isWritableFile = /\.(txt|md|json|log|csv|html|css|py|js|xml|yaml|yml|pdf|docx|pptx|xlsx)$/i.test(nextUnquoted);
            if (looksLikePath(nextUnquoted) && isWritableFile) {
              translatedTokens.push(">");
              continue;
            }
          }
        }
        translatedTokens.push(token);
      }
      let inEchoArguments = false;
      const processedTokens = translatedTokens.map((token) => {
        if (token === "echo") {
          inEchoArguments = true;
          return token;
        }
        const controlOperators = [">", ">>", "<", "&", "&&", "|", "||", ";"];
        if (controlOperators.includes(token)) {
          inEchoArguments = false;
        }
        const hasOuterQuotes = /^['"]|['"]$/.test(token);
        let processed = token;
        if (inEchoArguments && hasOuterQuotes) {
          processed = token.replace(/^['"]|['"]$/g, "");
        }
        const currentHasOuterQuotes = /^['"]|['"]$/.test(processed);
        const unquoted = processed.replace(/^['"]|['"]$/g, "");
        if (looksLikePath(unquoted)) {
          processed = processed.replace(/\//g, "\\");
        }
        const finalUnquoted = processed.replace(/^['"]|['"]$/g, "");
        if (finalUnquoted.includes(" ") && !currentHasOuterQuotes) {
          processed = `"${finalUnquoted}"`;
        }
        return processed;
      });
      if (usePowerShell) {
        let cmdStr = "";
        let openBraces = 0;
        for (let i = 0; i < processedTokens.length; i++) {
          const token = processedTokens[i];
          if (token === "&&") {
            cmdStr += "; if ($?) {";
            openBraces++;
          } else if (token === ";") {
            cmdStr += " }".repeat(openBraces) + ";";
            openBraces = 0;
          } else {
            if (cmdStr && !cmdStr.endsWith(" ") && !cmdStr.endsWith("{")) {
              cmdStr += " ";
            }
            cmdStr += token;
          }
        }
        cmdStr += " }".repeat(openBraces);
        return cmdStr;
      }
      return processedTokens.join(" ");
    };
    exec_command = async (args, options = {}) => {
      const { command: rawCommand } = parseArgs(args);
      const { onChunk } = options;
      if (!rawCommand) return 'ERROR: Missing "command" argument for exec_command.';
      const isWin = process.platform === "win32";
      const systemSettings = options.systemSettings || {};
      const netEnv = {};
      if (systemSettings.networkAccess === false) {
        netEnv.HTTP_PROXY = "http://127.0.0.1:9999";
        netEnv.HTTPS_PROXY = "http://127.0.0.1:9999";
        netEnv.ALL_PROXY = "socks5://127.0.0.1:9999";
        netEnv.http_proxy = "http://127.0.0.1:9999";
        netEnv.https_proxy = "http://127.0.0.1:9999";
        netEnv.all_proxy = "socks5://127.0.0.1:9999";
        netEnv.NO_PROXY = "localhost,127.0.0.1";
      }
      return new Promise((resolve) => {
        const attempt = (shellType) => {
          const isPowerShell = shellType === "pwsh" || shellType === "powershell";
          const command = adjustWindowsCommand(rawCommand, isPowerShell);
          let shell;
          if (isWin) {
            if (shellType === "pwsh") {
              shell = "C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
            } else if (shellType === "powershell") {
              shell = "powershell.exe";
            } else {
              shell = "cmd.exe";
            }
          } else {
            shell = process.env.SHELL || "bash";
          }
          let shellArgs = isWin ? isPowerShell ? ["-NoProfile", "-Command", command] : ["/c", command] : ["-c", command];
          if (systemSettings.networkAccess === false && !isWin) {
            const originalShell = shell;
            const originalArgs = [...shellArgs];
            if (process.platform === "linux") {
              shell = "unshare";
              shellArgs = ["-n", "-r", originalShell, ...originalArgs];
            } else if (process.platform === "darwin") {
              const sbProfile = '(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-outbound (remote ip "127.0.0.1:*"))\n';
              shell = "sandbox-exec";
              shellArgs = ["-p", sbProfile, originalShell, ...originalArgs];
            }
          }
          if (pty) {
            try {
              const ptyProcess = pty.spawn(shell, shellArgs, {
                name: "xterm-256color",
                cols: options.cols || 120,
                rows: options.rows || 30,
                cwd: process.cwd(),
                env: {
                  ...process.env,
                  CI: "false",
                  TERM: "xterm-256color",
                  FORCE_COLOR: "1",
                  ...netEnv
                }
              });
              activeChildProcess = ptyProcess;
              isActiveCommandPty = true;
              let output = "";
              let isResolved = false;
              ptyProcess.onData((data) => {
                if (!isResolved) {
                  output += data;
                  if (onChunk) onChunk(data);
                  const cleanOut = stripAnsi(output);
                  if (/(?:Network:\s+use\s+--host\s+to|Network:\s+Type\s+--host\s+to|Local:\s+http:\/\/localhost:\d+|ready in \d+\s*ms|Compiled successfully|Development server is running|Listening on:)/i.test(cleanOut)) {
                    isResolved = true;
                    setTimeout(() => resolve(`SUCCESS: Dev server started successfully in background.

${cleanOut}`), 500);
                  }
                }
              });
              ptyProcess.onExit(({ exitCode }) => {
                if (isResolved) return;
                activeChildProcess = null;
                const normalizedOutput = cleanTerminalOutput(output || "");
                const finalOutput = stripAnsi(normalizedOutput).replace(/\n{3,}/g, "\n\n") || "Command executed with no output.";
                if (exitCode !== 0) {
                  resolve(`ERROR: Command [${rawCommand}] failed with exit code [${exitCode}].

${finalOutput}`);
                } else {
                  resolve(`SUCCESS: Command [${rawCommand}] completed.

${finalOutput}`);
                }
              });
              return true;
            } catch (err) {
              if (isWin && (shellType === "pwsh" || shellType === "powershell") && err.code === "ENOENT") {
                return false;
              }
              runStandardSpawn(resolve, command, rawCommand, netEnv, onChunk, shellType, systemSettings);
              return true;
            }
          } else {
            runStandardSpawn(resolve, command, rawCommand, netEnv, onChunk, shellType, systemSettings);
            return true;
          }
        };
        if (isWin) {
          if (!attempt("pwsh")) {
            if (!attempt("powershell")) {
              attempt("cmd");
            }
          }
        } else {
          attempt("bash");
        }
      });
    };
    runStandardSpawn = (resolve, command, rawCommand, netEnv, onChunk, shellType = "powershell", systemSettings = {}) => {
      const isWin = process.platform === "win32";
      const isPowerShell = shellType === "pwsh" || shellType === "powershell";
      let shell;
      if (isWin) {
        if (shellType === "pwsh") {
          shell = "C:\\Users\\User\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
        } else if (shellType === "powershell") {
          shell = "powershell.exe";
        } else {
          shell = "cmd.exe";
        }
      } else {
        shell = process.env.SHELL || "bash";
      }
      let shellArgs = isWin ? isPowerShell ? ["-NoProfile", "-Command", command] : ["/c", command] : ["-c", command];
      if (systemSettings.networkAccess === false && !isWin) {
        const originalShell = shell;
        const originalArgs = [...shellArgs];
        if (process.platform === "linux") {
          shell = "unshare";
          shellArgs = ["-n", "-r", originalShell, ...originalArgs];
        } else if (process.platform === "darwin") {
          const sbProfile = '(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-outbound (remote ip "127.0.0.1:*"))\n';
          shell = "sandbox-exec";
          shellArgs = ["-p", sbProfile, originalShell, ...originalArgs];
        }
      }
      const child = isWin ? spawn(shell, shellArgs, { cwd: process.cwd(), env: { ...process.env, ...netEnv } }) : spawn(shell, shellArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CI: "false",
          TERM: "xterm-256color",
          FORCE_COLOR: "1",
          ...netEnv
        }
      });
      activeChildProcess = child;
      isActiveCommandPty = false;
      if (child.stdin) {
        child.stdin.on("error", () => {
          activeChildProcess = null;
        });
      }
      let stdout = "";
      let stderr = "";
      let isResolved = false;
      child.stdout.on("data", (data) => {
        if (!isResolved) {
          const chunk = data.toString();
          stdout += chunk;
          if (onChunk) onChunk(chunk);
          const cleanOut = stripAnsi(stdout);
          if (/(?:Network:\s+use\s+--host\s+to|Network:\s+Type\s+--host\s+to|Local:\s+http:\/\/localhost:\d+|ready in \d+\s*ms|Compiled successfully|Development server is running|Listening on:)/i.test(cleanOut)) {
            isResolved = true;
            setTimeout(() => resolve(`SUCCESS: Dev server started successfully in background.

${cleanOut}`), 500);
          }
        }
      });
      child.stderr.on("data", (data) => {
        if (!isResolved) {
          const chunk = data.toString();
          stderr += chunk;
          if (onChunk) onChunk(chunk);
        }
      });
      child.on("close", (code) => {
        if (isResolved) return;
        activeChildProcess = null;
        const result = [];
        const cleanStdout = cleanTerminalOutput(stdout);
        const cleanStderr = cleanTerminalOutput(stderr);
        if (cleanStdout) result.push(`STDOUT:
${cleanStdout}`);
        if (cleanStderr) result.push(`STDERR:
${cleanStderr}`);
        if (code !== 0) result.push(`EXIT CODE: ${code}`);
        const rawOutput = result.join("\n\n") || "Command executed with no output.";
        const finalOutput = stripAnsi(rawOutput).replace(/\n{3,}/g, "\n\n");
        if (code !== 0) {
          resolve(`ERROR: Command [${rawCommand}] failed with exit code [${code}].

${finalOutput}`);
        } else {
          resolve(`SUCCESS: Command [${rawCommand}] completed.

${finalOutput}`);
        }
      });
      child.on("error", (err) => {
        if (isWin && err.code === "ENOENT") {
          if (shellType === "pwsh") {
            const nextCommand = adjustWindowsCommand(rawCommand, true);
            return runStandardSpawn(resolve, nextCommand, rawCommand, netEnv, onChunk, "powershell", systemSettings);
          } else if (shellType === "powershell") {
            const nextCommand = adjustWindowsCommand(rawCommand, false);
            return runStandardSpawn(resolve, nextCommand, rawCommand, netEnv, onChunk, "cmd", systemSettings);
          }
        }
        activeChildProcess = null;
        const errorMsg = err instanceof Error ? err.message : String(err);
        resolve(`ERROR: Failed to start command [${rawCommand}]: ${errorMsg}`);
      });
    };
  }
});

// src/components/SettingsMenu.jsx
import React7, { useState as useState6, useEffect as useEffect5 } from "react";
import { Box as Box6, Text as Text7, useInput as useInput3 } from "ink";
import TextInput from "ink-text-input";
import v8 from "v8";
function SettingsMenu({
  systemSettings,
  setSystemSettings,
  apiTier,
  setActiveView,
  setInputConfig,
  saveSettings: saveSettings2,
  quotas,
  setMessages,
  aiProvider
}) {
  const [activeColumn, setActiveColumn] = useState6("categories");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState6(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState6(0);
  const [editingItem, setEditingItem] = useState6(null);
  const [editValue, setEditValue] = useState6("");
  const [currentMemory, setCurrentMemory] = useState6(0);
  const [maxMemory, setMaxMemory] = useState6(0);
  const [memoryUnit, setMemoryUnit] = useState6("MB");
  useEffect5(() => {
    const maxLimitBytes = v8.getHeapStatistics().heap_size_limit;
    const isGB = maxLimitBytes >= 1024 * 1024 * 1024;
    const unitLabel = isGB ? "GB" : "MB";
    const divisor = isGB ? 1024 * 1024 * 1024 : 1024 * 1024;
    setMaxMemory(parseFloat((maxLimitBytes / divisor).toFixed(2)));
    setMemoryUnit(unitLabel);
    const getMemoryStats = () => {
      const usage = process.memoryUsage();
      const targetBytes = usage.rss;
      const converted = targetBytes / divisor;
      const formattedCurrent = isGB ? parseFloat(converted.toFixed(2)) : Math.round(converted);
      setCurrentMemory(formattedCurrent);
    };
    getMemoryStats();
    const interval = setInterval(() => {
      getMemoryStats();
    }, 3e4);
    return () => clearInterval(interval);
  }, []);
  const getCategoryItems = (catId) => {
    switch (catId) {
      case "memory":
        return [
          { label: "Toggle Memory", value: "memory", status: systemSettings.memory ? "ON" : "OFF" }
        ];
      case "security":
        const activePreset = getActivePreset(systemSettings);
        return [
          { label: "Sandbox Preset", value: "sandboxPreset", status: activePreset, section: "Sandbox" },
          { label: "YOLO Mode", value: "autoExec", status: systemSettings.autoExec ? "ON" : "OFF", section: "Sandbox" },
          { label: "External Workspace Access", value: "externalAccess", status: systemSettings.allowExternalAccess ? "ON" : "OFF", section: "Sandbox" },
          { label: "Network Access (Terminal)", value: "networkAccess", status: systemSettings.networkAccess !== false ? "ON" : "OFF", section: "Sandbox" },
          { label: "Always Ask Commands", value: "alwaysAsk", status: truncateCSV(systemSettings.alwaysAskCommands), section: "Sandbox" },
          { label: "Auto Approve Commands", value: "autoApprove", status: truncateCSV(systemSettings.autoApproveCommands), section: "Sandbox" },
          { label: "Auto Disapprove Commands", value: "autoDisallow", status: truncateCSV(systemSettings.autoDisallowCommands), section: "Sandbox" },
          { label: "Auto Approve Git Commits", value: "autoApproveGit", status: systemSettings.autoApproveGit ? "ON" : "OFF", section: "Sandbox" },
          { label: "Auto-Delete History", value: "autoDelete", status: systemSettings.autoDeleteHistory || "30d", section: "Other" },
          { label: "Save AppData Externally", value: "externalData", status: systemSettings.useExternalData ? "ON" : "OFF", section: "Other" }
        ];
      case "updater":
        return [
          { label: "Auto-Update", value: "autoUpdate", status: systemSettings.autoUpdate ? "ON" : "OFF" },
          { label: "Preferred Updater", value: "updateManager", status: (systemSettings.updateManager || "npm") === "custom" ? "Custom" : (systemSettings.updateManager || "npm").toUpperCase() }
        ];
      case "other":
        return [
          { label: "Current Provider", value: "aiProvider", status: aiProvider },
          { label: "Key Strategy", value: "apiTier", status: apiTier === "Free" ? "Free" : quotas?.providerBudgets?.__useProvider ? "Paid" : "Paid" },
          { label: "Download Language Parsers", value: "parserDownload", status: "ACTION" }
        ];
      default:
        return [];
    }
  };
  const currentCatId = CATEGORIES[selectedCategoryIndex].id;
  const currentItems = getCategoryItems(currentCatId);
  useInput3((input, key) => {
    if (editingItem) {
      if (key.escape) {
        setEditingItem(null);
      }
      return;
    }
    if (activeColumn === "categories") {
      if (key.upArrow) {
        setSelectedCategoryIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
      } else if (key.downArrow) {
        setSelectedCategoryIndex((prev) => (prev + 1) % CATEGORIES.length);
      } else if (key.return || key.rightArrow) {
        const targetCat = CATEGORIES[selectedCategoryIndex];
        if (targetCat.id === "exit") {
          setActiveView("chat");
        } else {
          setActiveColumn("items");
          setSelectedItemIndex(0);
        }
      } else if (key.escape) {
        setActiveView("chat");
      }
    } else if (activeColumn === "items") {
      if (key.upArrow) {
        setSelectedItemIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length);
      } else if (key.downArrow) {
        setSelectedItemIndex((prev) => (prev + 1) % currentItems.length);
      } else if (key.leftArrow || key.escape) {
        setActiveColumn("categories");
      } else if (key.return) {
        const item = currentItems[selectedItemIndex];
        handleSelect(item);
      }
    }
  });
  const handleSelect = (item) => {
    if (item.value === "memory") {
      setSystemSettings((s) => ({ ...s, memory: !s.memory }));
    } else if (item.value === "sandboxPreset") {
      const activePreset = getActivePreset(systemSettings);
      const presets = ["Autonomous", "Balanced", "Strict"];
      const curIndex = presets.indexOf(activePreset);
      const nextIndex = (curIndex + 1) % presets.length;
      const nextPreset = presets[nextIndex];
      setSystemSettings((s) => {
        const updated = { ...s, sandboxPreset: nextPreset };
        if (nextPreset === "Strict") {
          updated.autoExec = false;
          updated.allowExternalAccess = false;
          updated.networkAccess = false;
          updated.autoApproveCommands = "";
          updated.autoDisallowCommands = "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c";
          updated.alwaysAskCommands = "killall, pkill, taskkill, shutdown, reboot, init 0, init 6, Stop-Process, Stop-Service, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, netsh advfirewall, iptables -F, ufw disable, git reset --hard, git clean -fd, npm r, npm uninstall";
          updated.autoApproveGit = false;
        } else if (nextPreset === "Balanced") {
          updated.autoExec = true;
          updated.allowExternalAccess = false;
          updated.networkAccess = true;
          updated.autoApproveCommands = "ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time";
          updated.autoDisallowCommands = "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c";
          updated.alwaysAskCommands = "killall, pkill, taskkill, Stop-Process, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, shutdown, reboot, init 0, init 6, git reset --hard, git clean -fd, npm r, npm uninstall";
          updated.autoApproveGit = false;
        } else if (nextPreset === "Autonomous") {
          updated.autoExec = true;
          updated.allowExternalAccess = true;
          updated.networkAccess = true;
          updated.autoApproveCommands = "ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time";
          updated.autoDisallowCommands = "";
          updated.alwaysAskCommands = "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c";
          updated.autoApproveGit = true;
        }
        return updated;
      });
    } else if (item.value === "autoExec") {
      if (!systemSettings.autoExec) {
        if (systemSettings.allowExternalAccess) {
          setActiveView("doubleDanger");
        } else {
          setActiveView("autoExecDanger");
        }
      } else {
        setSystemSettings((s) => ({ ...s, autoExec: false, sandboxPreset: "Custom" }));
      }
    } else if (item.value === "externalAccess") {
      if (!systemSettings.allowExternalAccess) {
        if (systemSettings.autoExec) {
          setActiveView("doubleDanger");
        } else {
          setActiveView("externalDanger");
        }
      } else {
        setSystemSettings((s) => ({ ...s, allowExternalAccess: false, sandboxPreset: "Custom" }));
      }
    } else if (item.value === "networkAccess") {
      setSystemSettings((s) => ({ ...s, networkAccess: s.networkAccess === false, sandboxPreset: "Custom" }));
    } else if (item.value === "alwaysAsk") {
      setEditingItem("alwaysAskCommands");
      setEditValue(systemSettings.alwaysAskCommands || "");
    } else if (item.value === "autoApprove") {
      setEditingItem("autoApproveCommands");
      setEditValue(systemSettings.autoApproveCommands || "");
    } else if (item.value === "autoApproveGit") {
      setSystemSettings((s) => ({ ...s, autoApproveGit: !s.autoApproveGit, sandboxPreset: "Custom" }));
    } else if (item.value === "autoDisallow") {
      setEditingItem("autoDisallowCommands");
      setEditValue(systemSettings.autoDisallowCommands || "");
    } else if (item.value === "apiTier") {
      setActiveView("apiTier");
    } else if (item.value === "aiProvider") {
      setActiveView("selectProvider");
    } else if (item.value === "autoDelete") {
      const options = ["1d", "7d", "30d"];
      const currentIndex = options.indexOf(systemSettings.autoDeleteHistory || "30d");
      const nextIndex = (currentIndex + 1) % options.length;
      setSystemSettings((s) => ({ ...s, autoDeleteHistory: options[nextIndex] }));
    } else if (item.value === "autoUpdate") {
      setSystemSettings((s) => ({ ...s, autoUpdate: !s.autoUpdate }));
    } else if (item.value === "externalData") {
      if (!systemSettings.useExternalData) {
        setInputConfig({
          label: "Enter absolute path for External AppData:",
          note: "All history, logs and secrets will be stored here. ~/.fluxflow/settings.json stays as anchor.",
          key: "externalDataPath",
          value: systemSettings.externalDataPath || ""
        });
        setActiveView("input");
      } else {
        const newSettings = { ...systemSettings, useExternalData: false };
        setSystemSettings(newSettings);
        saveSettings2({ systemSettings: newSettings, apiTier, quotas });
        setMessages((prev) => [...prev, { id: Date.now(), role: "system", text: "[STORAGE RESET] Flux Flow will return to default ~/.fluxflow after restart." }]);
        setActiveView("chat");
      }
    } else if (item.value === "updateManager") {
      setActiveView("updateManager");
    } else if (item.value === "parserDownload") {
      setActiveView("parserDownload");
    }
  };
  return /* @__PURE__ */ React7.createElement(Box6, { flexDirection: "column", borderStyle: "round", borderColor: "white", padding: 0, width: "100%", minHeight: 32 }, /* @__PURE__ */ React7.createElement(Box6, { paddingX: 1, paddingY: 0, marginBottom: 0, borderStyle: "single", borderColor: "gray", width: "100%" }, /* @__PURE__ */ React7.createElement(Text7, { color: "white", bold: true }, "SYSTEM CONFIGURATION")), /* @__PURE__ */ React7.createElement(Box6, { flexDirection: "row", width: "100%", minHeight: 26 }, /* @__PURE__ */ React7.createElement(Box6, { flexDirection: "column", width: "30%", borderStyle: "round", borderColor: activeColumn === "categories" ? "white" : "grey", padding: 1, paddingY: 0 }, /* @__PURE__ */ React7.createElement(Box6, { marginBottom: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: activeColumn === "categories" ? "white" : "grey", bold: true, underline: true }, "CATEGORIES")), CATEGORIES.map((cat, index) => {
    const isSelected = selectedCategoryIndex === index;
    const isExit = cat.id === "exit";
    return /* @__PURE__ */ React7.createElement(
      Box6,
      {
        key: cat.id,
        marginTop: isExit ? 17 : 0,
        backgroundColor: isSelected ? activeColumn === "categories" ? "#2a2a2a" : "#1e1e1e" : void 0,
        paddingX: 1
      },
      /* @__PURE__ */ React7.createElement(
        Text7,
        {
          color: isSelected ? activeColumn === "categories" ? "white" : "grey" : "grey",
          bold: isSelected
        },
        isSelected ? "\u276F " : "  ",
        cat.label
      )
    );
  })), /* @__PURE__ */ React7.createElement(Box6, { flexDirection: "column", width: "70%", borderStyle: "round", borderColor: activeColumn === "items" ? "white" : "grey", paddingX: 1, marginLeft: 1, paddingY: 0 }, /* @__PURE__ */ React7.createElement(Box6, { marginBottom: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: activeColumn === "items" ? "white" : "grey", bold: true, underline: true }, CATEGORIES[selectedCategoryIndex].label.toUpperCase(), " SETTINGS")), currentItems.length > 0 ? (() => {
    let lastSection = null;
    const elements = [];
    const getListItems = (val) => (val || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const approveList = getListItems(systemSettings.autoApproveCommands);
    const disallowList = getListItems(systemSettings.autoDisallowCommands);
    const askList = getListItems(systemSettings.alwaysAskCommands);
    const allLists = [...approveList, ...disallowList, ...askList];
    const uniqueLists = new Set(allLists);
    const hasConflict = currentCatId === "security" && allLists.length !== uniqueLists.size;
    currentItems.forEach((item, index) => {
      const isSelected = activeColumn === "items" && selectedItemIndex === index;
      const labelLength = item.label.length;
      const dotsCount = Math.max(2, 35 - labelLength);
      const dots = ".".repeat(dotsCount);
      const getStatusColor = (item2) => {
        if (currentCatId === "security") {
          if ((item2.value === "autoExec" || item2.value === "externalAccess") && item2.status === "ON") {
            return "white";
          }
          return "gray";
        }
        if (item2.status?.startsWith("\u2713")) return "white";
        if (item2.status?.startsWith("\u26A0")) return "gray";
        return item2.status === "ON" ? "white" : item2.status === "OFF" ? "gray" : "white";
      };
      if (item.section && item.section !== lastSection) {
        lastSection = item.section;
        elements.push(
          /* @__PURE__ */ React7.createElement(Box6, { key: `sec-hdr-${item.section}`, marginTop: elements.length > 0 ? 1 : 0, marginBottom: 0, paddingX: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray", bold: true, underline: true }, item.section.toUpperCase()))
        );
      }
      const isEditingThis = isSelected && editingItem && (editingItem === "alwaysAskCommands" && item.value === "alwaysAsk" || editingItem === "autoApproveCommands" && item.value === "autoApprove" || editingItem === "autoDisallowCommands" && item.value === "autoDisallow");
      const isCommandListItem = item.value === "alwaysAsk" || item.value === "autoApprove" || item.value === "autoDisallow";
      const isParserDownload = item.value === "parserDownload";
      elements.push(
        /* @__PURE__ */ React7.createElement(Box6, { key: item.value, flexDirection: "column" }, /* @__PURE__ */ React7.createElement(Box6, { backgroundColor: isSelected && !isEditingThis ? "#2a2a2a" : void 0, paddingX: 2 }, /* @__PURE__ */ React7.createElement(
          Text7,
          {
            color: isSelected ? "white" : "grey",
            bold: isSelected
          },
          isSelected ? "\u276F " : "  ",
          item.label
        ), !isCommandListItem && !isParserDownload && /* @__PURE__ */ React7.createElement(React7.Fragment, null, /* @__PURE__ */ React7.createElement(Text7, { color: "gray" }, dots), /* @__PURE__ */ React7.createElement(Text7, { color: getStatusColor(item), bold: true }, item.value === "aiProvider" ? item.status : `[ ${item.status} ]`))), isCommandListItem && !isEditingThis && item.status !== "None" && /* @__PURE__ */ React7.createElement(Box6, { paddingX: 4, marginBottom: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray" }, "\u21B3 ", item.status)), isEditingThis && /* @__PURE__ */ React7.createElement(Box6, { flexDirection: "column", marginLeft: 4, marginBottom: 1 }, /* @__PURE__ */ React7.createElement(Box6, { paddingX: 1, borderStyle: "single", borderColor: "gray", flexDirection: "row" }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray", bold: true }, "> ", " "), /* @__PURE__ */ React7.createElement(
          TextInput,
          {
            value: editValue,
            onChange: setEditValue,
            onSubmit: (val) => {
              const newSysSettings = { ...systemSettings, [editingItem]: val.trim(), sandboxPreset: "Custom" };
              setSystemSettings(newSysSettings);
              saveSettings2({ systemSettings: newSysSettings, apiTier, quotas });
              setEditingItem(null);
            }
          }
        )), /* @__PURE__ */ React7.createElement(Text7, { color: "gray", italic: true }, "  Comma separated \u2022 Press Enter to save, Esc to cancel")))
      );
    });
    if (currentCatId === "other") {
      elements.push(
        /* @__PURE__ */ React7.createElement(Box6, { key: "pty-notice", marginTop: 17, paddingX: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "white" }, isPtyAvailable ? "\u2713 Advance Interactive Terminal Supported" : "\u26A0 Interactive Terminal is Limited"))
      );
      elements.push(
        /* @__PURE__ */ React7.createElement(Box6, { key: "memory-load-2026", paddingX: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray" }, "Memory Load: ", currentMemory, "/", maxMemory, " ", memoryUnit))
      );
    }
    if (hasConflict) {
      elements.push(
        /* @__PURE__ */ React7.createElement(Box6, { key: "conflict-warning", marginTop: 1, paddingX: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "white", italic: true }, "* Conflicting commands will be ignored and defaulted to highest priority"))
      );
    }
    return elements;
  })() : /* @__PURE__ */ React7.createElement(Box6, { paddingX: 1 }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray", italic: true }, CATEGORIES[selectedCategoryIndex].desc)))), /* @__PURE__ */ React7.createElement(Box6, { paddingX: 1, marginTop: 0, flexDirection: "row", justifyContent: "space-between" }, /* @__PURE__ */ React7.createElement(Text7, { color: "gray", italic: true }, activeColumn === "categories" ? "\u25B2\u25BC Select Category \u2022 Enter/\u25BA to configure" : "\u25B2\u25BC Select Option \u2022 Enter to Toggle \u2022 \u25C4/ESC to go back"), activeColumn === "categories" && /* @__PURE__ */ React7.createElement(Text7, { color: "gray" }, CATEGORIES[selectedCategoryIndex].desc)));
}
var CATEGORIES, getActivePreset, truncateCSV;
var init_SettingsMenu = __esm({
  async "src/components/SettingsMenu.jsx"() {
    await init_exec_command();
    CATEGORIES = [
      { id: "memory", label: "Memory", desc: "Manage system context & agent's memory" },
      { id: "security", label: "Security", desc: "Configure permissions & data safety" },
      { id: "updater", label: "Updater", desc: "Manage application updates" },
      { id: "other", label: "Other", desc: "Miscellaneous preferences" },
      { id: "exit", label: "Exit Settings", desc: "Return to chat view" }
    ];
    getActivePreset = (settings) => {
      const approve = settings.autoApproveCommands || "";
      const disallow = settings.autoDisallowCommands || "";
      const alwaysAsk = settings.alwaysAskCommands || "";
      const isStrict = settings.autoExec === false && settings.allowExternalAccess === false && settings.networkAccess === false && approve === "" && disallow === "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c" && alwaysAsk === "killall, pkill, taskkill, shutdown, reboot, init 0, init 6, Stop-Process, Stop-Service, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, netsh advfirewall, iptables -F, ufw disable, git reset --hard, git clean -fd, npm r, npm uninstall" && settings.autoApproveGit === false;
      const isBalanced = settings.autoExec === true && settings.allowExternalAccess === false && settings.networkAccess !== false && approve === "ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time, mkdir" && disallow === "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c" && alwaysAsk === "killall, pkill, taskkill, Stop-Process, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, shutdown, reboot, init 0, init 6, git reset --hard, git clean -fd, npm r, npm uninstall" && settings.autoApproveGit === false;
      const isAutonomous = settings.autoExec === true && settings.allowExternalAccess === true && settings.networkAccess !== false && approve === "ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time, mkdir" && disallow === "" && alwaysAsk === "rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c" && settings.autoApproveGit === true;
      if (isStrict) return "Strict";
      if (isBalanced) return "Balanced";
      if (isAutonomous) return "Autonomous";
      return settings.sandboxPreset || "Custom";
    };
    truncateCSV = (val) => {
      if (!val || val.trim() === "") return "None";
      if (val.length > 40) return val.substring(0, 40) + "...";
      return val;
    };
  }
});

// src/components/ProfileForm.jsx
import React8, { useState as useState7, useEffect as useEffect6 } from "react";
import { Box as Box7, Text as Text8 } from "ink";
import TextInput2 from "ink-text-input";
function ProfileForm({ initialData, onSave, onCancel }) {
  const [step, setStep] = useState7(0);
  const [currentInput, setCurrentInput] = useState7("");
  const [profile, setProfile] = useState7(() => ({
    name: initialData?.name || "",
    nickname: initialData?.nickname || "",
    instructions: initialData?.instructions || ""
  }));
  const steps = [
    { key: "name", label: "Enter your Name: " },
    { key: "nickname", label: "Enter a Nickname (Agent will use this): " },
    { key: "instructions", label: "System Instructions (Persona overrides): " }
  ];
  useEffect6(() => {
    const currentKey = steps[step].key;
    setCurrentInput(profile[currentKey] || "");
  }, [step, profile]);
  const handleSubmit = (val) => {
    if (val.trim().toLowerCase() === "/cancel") {
      onCancel();
      return;
    }
    const currentKey = steps[step].key;
    const newProfile = { ...profile, [currentKey]: val.trim() };
    setProfile(newProfile);
    setCurrentInput("");
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onSave(newProfile);
    }
  };
  return /* @__PURE__ */ React8.createElement(
    Box7,
    {
      borderStyle: "round",
      borderColor: "gray",
      padding: 0,
      marginTop: 1,
      flexShrink: 0,
      flexDirection: "column",
      width: "100%"
    },
    /* @__PURE__ */ React8.createElement(Box7, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React8.createElement(Text8, { color: "white", bold: true }, "DEVELOPER PROFILE CONFIGURATION")),
    /* @__PURE__ */ React8.createElement(Box7, { paddingX: 1, flexDirection: "column" }, /* @__PURE__ */ React8.createElement(Box7, null, /* @__PURE__ */ React8.createElement(Text8, { color: "white", bold: true }, steps[step].label), /* @__PURE__ */ React8.createElement(
      TextInput2,
      {
        value: currentInput,
        onChange: setCurrentInput,
        onSubmit: handleSubmit
      }
    )), /* @__PURE__ */ React8.createElement(Box7, { marginTop: 1 }, /* @__PURE__ */ React8.createElement(Text8, { color: "gray", italic: true }, "Step ", step + 1, " of ", steps.length))),
    /* @__PURE__ */ React8.createElement(Box7, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React8.createElement(Text8, { color: "gray", italic: true }, "(Enter to submit \u2022 Type /cancel to abort)"))
  );
}
var init_ProfileForm = __esm({
  "src/components/ProfileForm.jsx"() {
  }
});

// src/components/AskUserModal.jsx
import React9, { useState as useState8 } from "react";
import { Box as Box8, Text as Text9, useInput as useInput4 } from "ink";
import TextInput3 from "ink-text-input";
var AskUserModal, AskUserModal_default;
var init_AskUserModal = __esm({
  "src/components/AskUserModal.jsx"() {
    init_terminal();
    AskUserModal = ({ question, options, onResolve }) => {
      const [isSuggestingElse, setIsSuggestingElse] = useState8(false);
      const [customInput, setCustomInput] = useState8("");
      const [selectedIndex, setSelectedIndex] = useState8(0);
      const allOptions = [...options, { id: "CUSTOM", label: "Suggest something else...", description: "Provide a custom response" }];
      useInput4((input, key) => {
        if (isSuggestingElse) return;
        if (key.leftArrow || key.upArrow) {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
        if (key.rightArrow || key.downArrow) {
          setSelectedIndex((prev) => Math.min(allOptions.length - 1, prev + 1));
        }
        if (key.return) {
          const selected = allOptions[selectedIndex];
          if (selected.id === "CUSTOM") {
            setIsSuggestingElse(true);
          } else {
            onResolve(selected.label);
          }
        }
      });
      const s = emojiSpace(2);
      if (isSuggestingElse) {
        return /* @__PURE__ */ React9.createElement(
          Box8,
          {
            flexDirection: "column",
            borderStyle: "single",
            borderLeft: true,
            borderRight: false,
            borderTop: false,
            borderBottom: false,
            borderColor: "#444444",
            paddingLeft: 2,
            paddingRight: 0,
            paddingTop: 1,
            paddingBottom: 1,
            backgroundColor: "#1a1a1a",
            width: "100%"
          },
          /* @__PURE__ */ React9.createElement(Box8, { paddingX: 1 }, /* @__PURE__ */ React9.createElement(Text9, { color: "white", bold: true }, "\u{1F4AC} SUGGEST SOMETHING ELSE")),
          /* @__PURE__ */ React9.createElement(Box8, { marginTop: 1, paddingX: 1 }, /* @__PURE__ */ React9.createElement(Text9, { italic: true, color: "gray" }, "Replying to: ", question)),
          /* @__PURE__ */ React9.createElement(Box8, { marginTop: 1, paddingX: 1, flexDirection: "row" }, /* @__PURE__ */ React9.createElement(Text9, { color: "white", bold: true }, "\u{1F4A0} "), /* @__PURE__ */ React9.createElement(
            TextInput3,
            {
              value: customInput,
              onChange: setCustomInput,
              onSubmit: () => onResolve(customInput)
            }
          )),
          /* @__PURE__ */ React9.createElement(Box8, { marginTop: 1, paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React9.createElement(Text9, { color: "gray", italic: true }, "(Press Enter to send)"))
        );
      }
      return /* @__PURE__ */ React9.createElement(
        Box8,
        {
          flexDirection: "column",
          borderStyle: "single",
          borderLeft: true,
          borderRight: false,
          borderTop: false,
          borderBottom: false,
          borderColor: "#444444",
          paddingLeft: 2,
          paddingRight: 0,
          paddingTop: 1,
          paddingBottom: 1,
          backgroundColor: "#1a1a1a",
          width: "100%"
        },
        /* @__PURE__ */ React9.createElement(Box8, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React9.createElement(Text9, { color: "white", bold: true }, "AGENT REQUEST: ACTION REQUIRED")),
        /* @__PURE__ */ React9.createElement(Box8, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React9.createElement(Text9, { bold: true, color: "white" }, question)),
        /* @__PURE__ */ React9.createElement(Box8, { flexDirection: "column", width: "100%" }, allOptions.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return /* @__PURE__ */ React9.createElement(
            Box8,
            {
              key: opt.id,
              flexDirection: "column",
              width: "100%",
              backgroundColor: isSelected ? "#2a2a2a" : void 0,
              paddingX: 1,
              marginBottom: idx === allOptions.length - 1 ? 0 : 1
            },
            /* @__PURE__ */ React9.createElement(Text9, { color: isSelected ? "white" : "grey", bold: isSelected }, isSelected ? "\u276F " : "  ", opt.label),
            opt.description && /* @__PURE__ */ React9.createElement(Box8, { marginLeft: 4 }, /* @__PURE__ */ React9.createElement(Text9, { color: "gray", italic: true }, opt.description))
          );
        })),
        /* @__PURE__ */ React9.createElement(Box8, { paddingX: 1, marginTop: 1, marginBottom: 1 }, /* @__PURE__ */ React9.createElement(Text9, { color: "gray", italic: true }, "(Use Arrows to navigate, Enter to confirm)"))
      );
    };
    AskUserModal_default = AskUserModal;
  }
});

// src/data/janitor_tools.js
var JANITOR_TOOLS_PROTOCOL;
var init_janitor_tools = __esm({
  "src/data/janitor_tools.js"() {
    JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = true) => `
Your tool syntax is: '[tool:functions.ToolName(args...)]'

-- CHAT MANAGEMENT TOOLS (MUST CALL THESE 2 TOOLS ALWAYS) --
[tool:functions.Chat(title="<short creative title of FULL conversation in 3-5 words>")]. Consider full chat context to generate title NOT just latest message.
[tool:functions.Memory(action="temp", content="<summary of the user prompt & model responses ONLY FROM LATEST PROMPT UNDER 40 WORDS>. [Talked on: <date> <hour>]")]. Time format: YYYY-MM-DD HH am/pm

${isMemoryEnabled ? `-- User-specific long-term/permanent memory (USE BASED ON CONVERSATION CONTEXT, DO NOT RE-SAVE MEMORY WHICH IS ALREADY SAVED) --
- Add: [tool:functions.Memory(action="user", method="add", content="<string to add>. [Saved on: <date ONLY>]", score=2)] (Set score=2 ONLY if the user explicitly asked to "remember" or "save" this information, else omit this parameter entirely)
- Delete: [tool:functions.Memory(action="user", method="delete", id="<memory id>")]
- Update: [tool:functions.Memory(action="user", method="update", content-new="string to update", id="<memory id>")]

-- Memory Relevance Decay Tool --
- Score Adjustment: [tool:functions.addMemScore(id="<memory id>")]
  You MUST call this tool when a specific saved memory in the '-- CURRENT SAVED USER MEMORIES --' list was relevant, referenced, or helpful in the agent's response or user prompt IN CURRENT MESSAGE. You can stack multiple calls.

Explicit Triggers for permanent memory:
- User explicitly asks to 'remember' something.
- User mentions something important long-term that should be remembered.
- User provides information that could be useful for long-term reference.
- User shares personal information or preferences.

Usage Rules:
- Frequency for 'user' action: Based on explicit triggers.
- IF YOU WANT TO SAVE SOMETHING, BUT SIMILAR MEMORY ALREADY EXISTS, USE THE UPDATE METHOD NOT ADD` : ""}`.trim();
  }
});

// src/data/thinking_prompts.json
var thinking_prompts_default;
var init_thinking_prompts = __esm({
  "src/data/thinking_prompts.json"() {
    thinking_prompts_default = {
      xHigh: "EFFORT LEVEL: HIGH\nThink in a continuous, relentless analytical monologue. Engage in adversarial self interrogation that treats every assumption as hostile until proven:\nDeconstruct requirements into atomic invariants. Trace every implicit dependency, side effect, and state mutation. Map the entire dependency graph and identify circular dependencies or tight coupling before they manifest\nEvaluate algorithmic complexity (time/space) for every operation. Consider memory models, cache locality, and allocation patterns. For concurrent systems, reason through race conditions, deadlocks, and memory ordering\nFormulate solutions by comparing multiple architectural approaches. Explicitly evaluate trade offs, monolithic vs modular, eager vs lazy, mutable vs immutable, sync vs async. Choose based on measured criteria, not intuition\nMentally execute the solution at multiple scales. What breaks at 10x load? 100x? Resource exhaustion? Trace error propagation paths through every layer\nActively attempt to falsify your own logic. Steel man the opposite approach\nReason about observability & vulnarability\nConsider future evolution, what changes will this architecture resist vs accommodate? Where are the extension points? What will break when requirements inevitably change?\nMap out implementation with surgical precision, exact file structure, module boundaries, interface contracts, error types, and test strategies before writing\nRULES:\n- Ruthlessly question every architectural choice. Default to skepticism\n- Think in terms of invariants, contracts, and failure modes, not just happy paths\n- Verify ALL imports and system stability, AVOID errors\n- MANDATORY THINKING: Full reasoning required for ALL requests/greetings",
      High: "EFFORT LEVEL: HIGH\nThink in a rigorous, technically grounded monologue within <think>...</think>\nBreak the objective into verifiable steps with clear success criteria. Identify the critical path and potential bottlenecks\nMentally compile and execute your approach. Check for: missing imports, undefined behavior, type mismatches, unhandled errors, and resource cleanup. Trace data flow from input to output, noting transformations\nRecognize design patterns and anti patterns. If you see God objects, tight coupling, or premature optimization, call it out and refactor mentally before committing\nEvaluate performance characteristics. Will this scale? Are there O(n\xB2) operations hiding in innocent looking code? Where are the allocation hotspots?\nConsider the error surface, what can fail and how? Design error handling that preserves invariants and provides actionable feedback\nReview your architecture for, separation of concerns, single responsibility, dependency inversion, and interface segregation. Ensure clean abstractions with minimal coupling\nRULES:\n- NO HEADINGS/MARKERS/LISTS\n- Continuous analytical flow\n- Verify correctness through first principles reasoning, not pattern matching\n- Actively search for ways your solution could fail or degrade\n- Verify ALL imports and system stability, AVOID ANY Syntax errors, re-read TOOL RESULTS/files to verify\n- MANDATORY THINKING: Full technical verification for all tasks/greetings",
      Medium: "EFFORT LEVEL: MEDIUM\nThink in a focused, technically-aware monologue within <think>...</think>\nIdentify the most direct path that satisfies requirements without over-engineering\nQuickly scan for obvious issues, missing error handling, incorrect input assumptions, forgotten edge cases, or missing dependencies\nVerify the solution is appropriately modular with cohesive changes\nOutline the concrete changes, which files, which functions, what the key logic looks like\nRULES:\n- NO HEADINGS/MARKERS/LISTS\n- Clean logical stream\n- Efficient but deliberate. Focus energy on actionable implementation details\n- Verify ALL imports and system stability, AVOID ANY Syntax errors, re-read TOOL RESULTS/files to verify\n- MANDATORY THINKING: Brief verification for technical tasks/greetings",
      Minimal: "EFFORT LEVEL: LOW\nThink in a quick, focused monologue within <think>...</think>. Just verify the basics:\nConfirm what the user wants and whether it's straightforward or has hidden complexity\nIdentify the specific tool, file, or action needed\nCheck for any obvious correctness issues before acting\nRULES:\n- NO HEADINGS/MARKERS/LISTS\n- Few lines of clear thought\n- Just enough thinking to avoid obvious mistakes\n- Verify ALL imports and system stability, AVOID ANY Syntax errors, re-read TOOL RESULTS/files to verify\n- Suitable for simple requests/greetings",
      Off: "EFFORT LEVEL: LOWEST\nNo thinking. Immediate response\nRULES:\n- Verify ALL imports and system stability, AVOID ANY Syntax errors, re-read TOOL RESULTS/files to verify"
    };
  }
});

// src/utils/prompts.js
import fs5 from "fs";
var cachedProjectContextBlock, getMemoryPrompt, getSystemInstruction, getJanitorInstruction;
var init_prompts = __esm({
  async "src/utils/prompts.js"() {
    await init_main_tools();
    init_janitor_tools();
    init_thinking_prompts();
    cachedProjectContextBlock = null;
    getMemoryPrompt = (tempMemories = "", userMemories = "", isMemoryEnabled = true, isContext32k = false) => {
      if (!isMemoryEnabled) return "";
      const tempMemoriesStr = tempMemories?.length > 0 && !isContext32k ? `-- RECENT CONTEXT FROM OTHER CHATS (PRIORITY: DYNAMIC-LOW, FOCUS: Chat Context > Recent) --
${tempMemories}` : "";
      const userMemoriesStr = userMemories?.length > 0 ? `--- SAVED MEMORIES (PRIORITY: MEDIUM, USER PREFERENCES) ---
${userMemories}` : "";
      const parts = [userMemoriesStr, tempMemoriesStr].filter((p) => p.length > 0);
      return parts.length > 0 ? `[SYSTEM CONTEXT]
${parts.join("\n\n")}
` : "";
    };
    getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, isFirstPrompt = false, aiProvider = "Google", isMultiModal = false, isGemini) => {
      let thinkingConfig = "";
      if (!isGemini && aiProvider === "Google") {
        let levelKey = thinkingLevel;
        if (thinkingLevel === "Fast") levelKey = "Off";
        if (thinkingLevel === "Low") levelKey = "Minimal";
        if (thinkingLevel === "Standard") levelKey = "Medium";
        if (thinkingLevel === "xHigh" || thinkingLevel === "Max") levelKey = "xHigh";
        thinkingConfig = thinking_prompts_default[levelKey] || thinking_prompts_default["Medium"];
      }
      if (isGemini || aiProvider !== "Google") {
        const MAP_FOR_NON_GOOGLE_OR_GEMINI = {
          "Fast": "LOWEST",
          "Low": "LOW",
          "Medium": "MEDIUM",
          "Standard": "MEDIUM",
          "High": "HIGH",
          "xHigh": "HIGH",
          "Max": "HIGH"
        };
        thinkingConfig = thinking_prompts_default["xHigh"];
        thinkingConfig = thinkingConfig.replace("EFFORT LEVEL: HIGH\nThink in a continuous, relentless analytical monologue. ", `EFFORT LEVEL: ${MAP_FOR_NON_GOOGLE_OR_GEMINI[thinkingLevel]}
`).replace("- MANDATORY THINKING: Full reasoning required for ALL requests/greetings", "");
        if (thinkingLevel === "Fast") {
          thinkingConfig = "EFFORT LEVEL: LOWEST\nNo thinking. Immediate response\nRULES:\n- Verify ALL imports and system stability, AVOID ANY Syntax errors, re-read TOOL RESULTS/files to verify\n";
        }
      }
      const osDetected = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
      const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Instructions: ${profile.instructions}

` : "";
      const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}
${userInstrStr.length ? "" : "\n"}` : "";
      const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}
${nicknameStr.length || userInstrStr.length ? "" : "\n"}` : "";
      const cwdStr = process.cwd();
      const isSystemDir = (() => {
        const cwd = process.cwd().toLowerCase();
        if (process.platform === "win32") {
          const winDir = process.env.SystemRoot?.toLowerCase() || "c:\\windows";
          const progFiles = process.env.ProgramFiles?.toLowerCase() || "c:\\program files";
          const progFilesX86 = process.env["ProgramFiles(x86)"]?.toLowerCase() || "c:\\program files (x86)";
          return cwd.startsWith(winDir) || cwd.startsWith(progFiles) || cwd.startsWith(progFilesX86);
        } else {
          const sysPaths = ["/bin", "/sbin", "/etc", "/usr", "/var", "/root"];
          return cwd === "/" || sysPaths.some((p) => cwd.startsWith(p));
        }
      })();
      const projectContextFiles = [
        { name: "Fluxflow.md", desc: "HIGH PRIORITY. Overrides other files" },
        { name: "README.md", desc: "Goals" },
        { name: "Agent.md", desc: "Standards" },
        { name: "Skills.md", desc: "Workflows" },
        { name: "design.md", desc: "UI/UX" },
        { name: "architecture.md", desc: "System Structure" }
      ];
      if (isFirstPrompt || cachedProjectContextBlock === null) {
        const foundFiles = projectContextFiles.filter((f) => fs5.existsSync(f.name));
        cachedProjectContextBlock = mode === "Flux" && foundFiles.length > 0 ? `
-- PROJECT CONTEXT --
${foundFiles.map((f) => `- ${f.name}: ${f.desc}`).join("\n")}
Check these first; These Files > Training Data. Safety rules apply
` : "";
      }
      const projectContextBlock = cachedProjectContextBlock;
      return `${nameStr}${nicknameStr}${userInstrStr}=== SYSTEM PROMPT ===
Identity: Flux Flow (by Kushal Roy Chowdhury). ${mode === "Flux" ? "Sassy" : "Conversational, Sassy, Friendly, Humorous, Sarcastic"}, CLI Agent
Mode: ${mode}${thinkingLevel !== "Fast" ? " (Thinking)" : ""}. ${mode === "Flux" ? "Logical, Highly Detailed, Task-Driven. Prioritizes scalable file/folder structures, modular architecture, clean code abstractions, step-by-step execution. Industry standard latest coding practices/libraries, clean code, Double Check Imports, Run tests where needed to verify" : "Concise"}

-- MARKERS --
- TOOL SYSTEM: [TOOL RESULT]
- SYSTEM NOTIFICATION: [SYSTEM] in user turn

-- THINKING RULES --
${aiProvider === "Google" && !isGemini ? `${thinkingConfig}
${thinkingLevel !== "Fast" && thinkingLevel !== "xHigh" && !isGemini ? `
CRITICAL THINKING POLICY
- ALWAYS use <think> ... </think> before responding, even with simple queries/greetings
` : ""}` : `${thinkingConfig}`}
${TOOL_PROTOCOL(mode, osDetected, aiProvider.toLowerCase() === "deepseek" ? false : isMultiModal, aiProvider)}
${projectContextBlock}
-- MEMORY RULES --
- Memory: ${isMemoryEnabled ? "Subtly Personalize. Auto Saves" : "OFF. Decline Remembering Memories"}
- Temporal Awareness: RELATIVE TIME REFERENCE eg. few mins ago

-- SECURITY RULES --${systemSettings.allowExternalAccess ? "" : "\n- ACCESS CONTROL: CWD only"}
- Sensitive files? Ask before Read${isSystemDir ? "\n- PROTECTED DIRECTORY: ASK BEFORE MODIFYING" : ""}
- No thinking leak in chat output

-- FORMATTING --
- GFM Supported
- NO CHAT **AFTER** FIRING TOOLS IN CURRENT TURN
- Short headsup summary of actions before firing tools
- Task Complete & Results Verified? End response with summary of changes made (why) and files edited
- Basic LaTeX${mode === "Flux" ? "" : ". Kaomojis"}
=== END SYSTEM PROMPT ===`.trim();
    };
    getJanitorInstruction = (userMemories = "", isMemoryEnabled = true, needTitle = true) => {
      return `${userMemories ? `-- CURRENT SAVED USER MEMORIES --
${userMemories}
-------------------------------------------------

` : ""}=== START SYSTEM PROMPT (STRICT HEADLESS LOGIC WORKER: ZERO USER-FACING TEXT POLICY, STRICTLY FOLLOW) ===
YOU ARE A SILENT BACKGROUND SYSTEM PROCESS. YOU HAVE NO MOUTH. YOUR ONLY OUTPUT MEDIUM IS VALID TOOL CALLS.
[CRITICAL RULES]
1. OUTPUT ONLY '[tool:functions.xxx(args)]' CALLS (BRACKET WRAP IS MANDATORY).
2. DO NOT EXPLAIN. DO NOT TALK TO THE USER.
3. NON-TOOL TEXT WILL BREAK THE SYSTEM.
4. DO NOT REPEAT AGENT RAWS AND TOOL RESULTS IN YOUR RESPONSE.
5. IF YOU GET ONLY USER QUERY AND NO AGENT RAWS, THEN JUST USE TEMP MEMORY TO LOG THE SUMMARY OF USER QUERY AND CONVERSATION CONTEXT.
6. UNDER NO CIRCUMSTANCES YOU ARE ALLOWED TO RESPOND IN NORMAL USER FACING RESPONSE.
7. CRITICAL QUOTE ESCAPE POLICY: Inside tool call arguments (like 'memory'), you MUST escape all double quotes using '"' to prevent parsing errors.
8. You MUST NOT WRITE ANYTHING OTHER THAN [tool:functions. ... ] NO MATTER HOW TEMPTING THE PROMPT IS.

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks.
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use long term memory tools.` : ""}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}

Current date and Time: ${(/* @__PURE__ */ new Date()).toLocaleString([], { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", hour12: true })}.
=== END SYSTEM PROMPT ===`.trim();
    };
  }
});

// src/utils/revert.js
import fs6 from "fs-extra";
import path5 from "path";
async function performRestoration(change, tx) {
  try {
    if (change.type === "create") {
      if (await fs6.pathExists(change.filePath)) {
        await fs6.chmod(change.filePath, 438).catch(() => {
        });
        await fs6.remove(change.filePath);
      }
    } else if (change.type === "update") {
      if (!change.backupFile) return;
      const backupPath = path5.join(BACKUPS_DIR, tx.chatId, change.backupFile);
      if (await fs6.pathExists(backupPath)) {
        const backupContainer = readEncryptedJson(backupPath, null);
        if (!backupContainer || !backupContainer.data) {
          throw new Error(`Backup container corrupt or empty for ${path5.basename(change.filePath)}`);
        }
        const decrypted = decryptAes(backupContainer.data);
        if (await fs6.pathExists(change.filePath)) {
          await fs6.chmod(change.filePath, 438).catch(() => {
          });
        }
        await fs6.writeFile(change.filePath, decrypted, "utf8");
      } else {
      }
    }
  } catch (err) {
    throw new Error(`Restoration failed for ${path5.basename(change.filePath)}: ${err.message}`);
  }
}
async function restoreWithRetry(change, tx, maxAttempts = 7) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await performRestoration(change, tx);
      return true;
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        return false;
      }
      const delay = Math.min(100 * Math.pow(2, attempt - 1), 5e3);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}
var currentTransaction, lastChatId, RevertManager;
var init_revert = __esm({
  "src/utils/revert.js"() {
    init_paths();
    init_crypto();
    fs6.ensureDirSync(BACKUPS_DIR);
    currentTransaction = null;
    lastChatId = null;
    RevertManager = {
      async startTransaction(chatId, promptText) {
        lastChatId = chatId;
        currentTransaction = {
          id: `tx_prompt_${Date.now()}`,
          chatId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          prompt: promptText.trim(),
          changes: [],
          reverted: false
        };
        writeEncryptedJson(ACTIVE_TX_FILE, currentTransaction);
      },
      async recordFileChange(absolutePath, forcedContent = null) {
        try {
          if (!currentTransaction) {
            if (lastChatId) {
              const ledger = readEncryptedJson(LEDGER_FILE, []);
              const lastTx = [...ledger].reverse().find((tx) => tx.chatId === lastChatId);
              if (lastTx) {
                const alreadyBackedUp2 = lastTx.changes.some((c) => c.filePath === absolutePath);
                if (alreadyBackedUp2) return;
                const fileExists2 = await fs6.pathExists(absolutePath);
                let type2 = fileExists2 || forcedContent ? "update" : "create";
                let backupFile2 = null;
                if (type2 === "update") {
                  const fileName = path5.basename(absolutePath);
                  backupFile2 = `${lastTx.id}_${fileName}.bak`;
                  const chatBackupDir = path5.join(BACKUPS_DIR, lastTx.chatId);
                  await fs6.ensureDir(chatBackupDir);
                  const backupPath = path5.join(chatBackupDir, backupFile2);
                  let content = forcedContent !== null ? forcedContent : await fs6.readFile(absolutePath, "utf8").catch(() => null);
                  if (content !== null) {
                    writeEncryptedJson(backupPath, { data: encryptAes(content) });
                  } else {
                    type2 = "create";
                    backupFile2 = null;
                  }
                }
                lastTx.changes.push({ filePath: absolutePath, type: type2, backupFile: backupFile2 });
                writeEncryptedJson(LEDGER_FILE, ledger);
              }
            }
            return;
          }
          const alreadyBackedUp = currentTransaction.changes.some((c) => c.filePath === absolutePath);
          if (alreadyBackedUp) return;
          const fileExists = await fs6.pathExists(absolutePath);
          let type = fileExists || forcedContent ? "update" : "create";
          let backupFile = null;
          if (type === "update") {
            const fileName = path5.basename(absolutePath);
            backupFile = `${currentTransaction.id}_${fileName}.bak`;
            const chatBackupDir = path5.join(BACKUPS_DIR, currentTransaction.chatId);
            await fs6.ensureDir(chatBackupDir);
            const backupPath = path5.join(chatBackupDir, backupFile);
            let content = forcedContent !== null ? forcedContent : await fs6.readFile(absolutePath, "utf8").catch(() => null);
            if (content !== null) {
              writeEncryptedJson(backupPath, { data: encryptAes(content) });
            } else {
              type = "create";
              backupFile = null;
            }
          }
          currentTransaction.changes.push({ filePath: absolutePath, type, backupFile });
          writeEncryptedJson(ACTIVE_TX_FILE, currentTransaction);
        } catch (err) {
        }
      },
      async commitTransaction() {
        if (!currentTransaction) return;
        try {
          const ledger = readEncryptedJson(LEDGER_FILE, []);
          ledger.push(currentTransaction);
          if (ledger.length > 512e3) {
            const removed = ledger.shift();
            if (removed.changes) {
              for (const change of removed.changes) {
                if (change.backupFile) {
                  await fs6.remove(path5.join(BACKUPS_DIR, removed.chatId, change.backupFile)).catch(() => {
                  });
                }
              }
            }
          }
          writeEncryptedJson(LEDGER_FILE, ledger);
          await fs6.remove(ACTIVE_TX_FILE).catch(() => {
          });
        } catch (err) {
        } finally {
          currentTransaction = null;
        }
      },
      async recoverCrashedTransaction() {
        try {
          if (await fs6.pathExists(ACTIVE_TX_FILE)) {
            const orphanedTx = readEncryptedJson(ACTIVE_TX_FILE, null);
            if (orphanedTx?.changes?.length > 0) {
              const ledger = readEncryptedJson(LEDGER_FILE, []);
              if (!ledger.some((t) => t.id === orphanedTx.id)) {
                ledger.push(orphanedTx);
                writeEncryptedJson(LEDGER_FILE, ledger);
              }
            }
            await fs6.remove(ACTIVE_TX_FILE).catch(() => {
            });
          }
        } catch (e) {
        }
      },
      async rollbackToBefore(txId) {
        let ledger = readEncryptedJson(LEDGER_FILE, null);
        if (!ledger) throw new Error("No transaction ledger found.");
        const targetIndex = ledger.findIndex((t) => t.id === txId);
        if (targetIndex === -1) throw new Error(`Transaction [${txId}] not found.`);
        const chatId = ledger[targetIndex].chatId;
        const targetPrompt = ledger[targetIndex].prompt;
        const toRevert = ledger.slice(targetIndex).filter((t) => t.chatId === chatId && !t.reverted).reverse();
        for (const tx of toRevert) {
          for (const change of [...tx.changes].reverse()) {
            await restoreWithRetry(change, tx);
          }
          for (const change of tx.changes) {
            if (change.backupFile) {
              const backupPath = path5.join(BACKUPS_DIR, tx.chatId, change.backupFile);
              await fs6.remove(backupPath).catch(() => {
              });
            }
          }
          ledger = ledger.filter((t) => t.id !== tx.id);
          writeEncryptedJson(LEDGER_FILE, ledger);
        }
        return { success: true, chatId, targetPrompt };
      },
      async getChatHistory(chatId) {
        try {
          const ledger = readEncryptedJson(LEDGER_FILE, []);
          return ledger.filter((t) => t.chatId === chatId && !t.reverted);
        } catch (e) {
          return [];
        }
      },
      async deleteChatBackups(chatId) {
        try {
          await fs6.remove(path5.join(BACKUPS_DIR, chatId));
          let ledger = readEncryptedJson(LEDGER_FILE, []);
          const clean = ledger.filter((t) => t.chatId !== chatId);
          if (ledger.length !== clean.length) writeEncryptedJson(LEDGER_FILE, clean);
        } catch (e) {
        }
      }
    };
  }
});

// src/utils/history.js
import fs7 from "fs-extra";
import path6 from "path";
import { nanoid } from "nanoid";
var WRITE_LOCK, withLock, loadHistory, saveChat, saveChatTitle, deleteChat, generateChatId, cleanupOldHistory, parseCustomDate, cleanupLogFile, cleanupOldLogs, getTruncatedHistory, saveChatContext, loadChatContext;
var init_history = __esm({
  "src/utils/history.js"() {
    init_crypto();
    init_paths();
    init_revert();
    WRITE_LOCK = Promise.resolve();
    withLock = (op) => {
      const nextLock = WRITE_LOCK.then(async () => {
        try {
          return await op();
        } catch (e) {
          console.error("Lock Operation Failed:", e);
          throw e;
        }
      });
      WRITE_LOCK = nextLock.catch(() => {
      });
      return nextLock;
    };
    loadHistory = async () => {
      await fs7.ensureDir(HISTORY_DIR);
      let history = {};
      if (await fs7.pathExists(HISTORY_FILE)) {
        try {
          history = readEncryptedJson(HISTORY_FILE, {});
        } catch (e) {
          history = {};
        }
      }
      for (const id in history) {
        const chatFile = path6.join(HISTORY_DIR, `${id}.json`);
        Object.defineProperty(history[id], "messages", {
          get: () => {
            if (fs7.existsSync(chatFile)) {
              try {
                return readEncryptedJson(chatFile, []);
              } catch (e) {
                return [];
              }
            }
            return [];
          },
          set: (msgs) => {
            try {
              writeEncryptedJson(chatFile, msgs);
            } catch (e) {
            }
          },
          enumerable: false,
          configurable: true
        });
      }
      return history;
    };
    saveChat = async (id, name, messages) => {
      return withLock(async () => {
        await fs7.ensureDir(HISTORY_DIR);
        const history = await loadHistory();
        const existingChat = history[id];
        const persistentMessages = (messages || []).filter(
          (m) => !m.isUpdateNotification && (!m.isMeta || m.text && m.text.includes("Request Cancelled"))
        );
        const finalName = name || (existingChat ? existingChat.name : `Session ${id.slice(-6)}`);
        const chatFile = path6.join(HISTORY_DIR, `${id}.json`);
        writeEncryptedJson(chatFile, persistentMessages);
        history[id] = {
          name: finalName,
          updatedAt: Date.now()
        };
        const indexHistory = {};
        for (const chatId in history) {
          indexHistory[chatId] = {
            name: history[chatId].name,
            updatedAt: history[chatId].updatedAt
          };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);
      });
    };
    saveChatTitle = async (id, title) => {
      return withLock(async () => {
        const history = await loadHistory();
        if (history[id]) {
          history[id].name = title;
          history[id].updatedAt = Date.now();
        } else {
          history[id] = { name: title, updatedAt: Date.now() };
        }
        const indexHistory = {};
        for (const chatId in history) {
          indexHistory[chatId] = {
            name: history[chatId].name,
            updatedAt: history[chatId].updatedAt
          };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);
      });
    };
    deleteChat = async (id) => {
      return withLock(async () => {
        const history = await loadHistory();
        delete history[id];
        const indexHistory = {};
        for (const chatId in history) {
          indexHistory[chatId] = {
            name: history[chatId].name,
            updatedAt: history[chatId].updatedAt
          };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);
        if (await fs7.pathExists(CONTEXT_FILE)) {
          try {
            const contextData = readEncryptedJson(CONTEXT_FILE, []);
            if (Array.isArray(contextData)) {
              const filtered = contextData.filter((item) => Object.keys(item)[0] !== String(id));
              writeEncryptedJson(CONTEXT_FILE, filtered);
            }
          } catch (e) {
          }
        }
        const temp = readEncryptedJson(TEMP_MEM_FILE, {});
        if (temp[id]) {
          delete temp[id];
          writeEncryptedJson(TEMP_MEM_FILE, temp);
        }
        const cache = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        if (cache[id]) {
          delete cache[id];
          writeEncryptedJson(TEMP_MEM_CHAT_FILE, cache);
        }
        await RevertManager.deleteChatBackups(id);
        const chatFile = path6.join(HISTORY_DIR, `${id}.json`);
        if (await fs7.pathExists(chatFile)) {
          try {
            await fs7.remove(chatFile);
          } catch (e) {
          }
        }
        return history;
      });
    };
    generateChatId = () => `flow-${nanoid(6)}`;
    cleanupOldHistory = async (retentionSetting) => {
      if (!retentionSetting || retentionSetting === "Never") return;
      const days = parseInt(retentionSetting);
      if (isNaN(days)) return;
      const history = await loadHistory();
      const now = Date.now();
      const threshold = days * 24 * 60 * 60 * 1e3;
      let deletedCount = 0;
      for (const id in history) {
        const chat2 = history[id];
        if (chat2.updatedAt && now - chat2.updatedAt > threshold) {
          await deleteChat(id);
          deletedCount++;
        }
      }
      return deletedCount;
    };
    parseCustomDate = (dateStr) => {
      const cleanStr = dateStr.replace(/[\[\]]/g, "").trim();
      const parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) return parsed.getTime();
      const parts = cleanStr.split(/,\s*|\s+/);
      if (parts.length === 0) return null;
      const datePart = parts[0];
      const timePart = parts[1] || "";
      const ampm = parts[2] || "";
      const dateNums = datePart.split(/[-/.]/).map(Number);
      if (dateNums.length !== 3) return null;
      let year, month, day;
      if (dateNums[0] > 1e3) {
        year = dateNums[0];
        month = dateNums[1];
        day = dateNums[2];
      } else if (dateNums[2] > 1e3) {
        year = dateNums[2];
        if (dateNums[0] > 12) {
          day = dateNums[0];
          month = dateNums[1];
        } else if (dateNums[1] > 12) {
          day = dateNums[1];
          month = dateNums[0];
        } else {
          month = dateNums[0];
          day = dateNums[1];
        }
      } else {
        return null;
      }
      let hours = 0, minutes = 0, seconds = 0;
      if (timePart) {
        const timeNums = timePart.split(":").map(Number);
        hours = timeNums[0] || 0;
        minutes = timeNums[1] || 0;
        seconds = timeNums[2] || 0;
        if (ampm.toLowerCase() === "pm" && hours < 12) {
          hours += 12;
        } else if (ampm.toLowerCase() === "am" && hours === 12) {
          hours = 0;
        }
      }
      const d = new Date(year, month - 1, day, hours, minutes, seconds);
      return isNaN(d.getTime()) ? null : d.getTime();
    };
    cleanupLogFile = async (filePath) => {
      try {
        if (!await fs7.pathExists(filePath)) return;
        const content = await fs7.readFile(filePath, "utf8");
        if (!content.trim()) return;
        const lines = content.split("\n");
        const entries = [];
        let currentEntry = null;
        const entryStartRegex = /^\s*(?:DEBUG|ERROR|SEARCH|PUPPETEER)\b/i;
        for (const line of lines) {
          if (entryStartRegex.test(line)) {
            if (currentEntry) {
              entries.push(currentEntry);
            }
            currentEntry = { header: line, body: [] };
          } else {
            if (currentEntry) {
              currentEntry.body.push(line);
            } else {
              entries.push({ header: line, body: [] });
            }
          }
        }
        if (currentEntry) {
          entries.push(currentEntry);
        }
        const threshold = 7 * 24 * 60 * 60 * 1e3;
        const now = Date.now();
        const keptEntries = [];
        const timestampRegex = /(\d{1,4}[-/.]\d{1,4}[-/.]\d{1,4}(?:,\s*|\s+)?(?:\d{1,2}:\d{2}:\d{2}(?:\s*[aApP][mM])?)?)/;
        for (const entry of entries) {
          const entryText = entry.header + (entry.body.length > 0 ? "\n" + entry.body.join("\n") : "");
          const match = entryText.match(timestampRegex);
          if (match) {
            const timeMs = parseCustomDate(match[1]);
            if (timeMs && now - timeMs > threshold) {
              continue;
            }
          }
          keptEntries.push(entryText);
        }
        const finalContent = keptEntries.join("\n").trim();
        if (finalContent) {
          await fs7.writeFile(filePath, finalContent + "\n", "utf8");
        } else {
          await fs7.writeFile(filePath, "", "utf8");
        }
      } catch (e) {
      }
    };
    cleanupOldLogs = async (logsDir) => {
      try {
        if (!await fs7.pathExists(logsDir)) return;
        const cleanRecursive = async (dir) => {
          const files = await fs7.readdir(dir);
          for (const file of files) {
            const fullPath = path6.join(dir, file);
            const stat = await fs7.stat(fullPath);
            if (stat.isDirectory()) {
              await cleanRecursive(fullPath);
              const subFiles = await fs7.readdir(fullPath);
              if (subFiles.length === 0) {
                await fs7.remove(fullPath);
              }
            } else if (file.endsWith(".log")) {
              await cleanupLogFile(fullPath);
            }
          }
        };
        await cleanRecursive(logsDir);
      } catch (e) {
      }
    };
    getTruncatedHistory = (history, exchangesToRemove = 4) => {
      if (history.length <= 1) return history;
      const welcome = history[0];
      const rest = history.slice(1);
      const sliceIndex = exchangesToRemove * 2;
      const truncated = rest.slice(sliceIndex);
      return [welcome, ...truncated];
    };
    saveChatContext = async (chatId, chatTokens, contextTokens) => {
      return withLock(async () => {
        let contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) contextData = [];
        const data = { total: chatTokens, context: contextTokens };
        const existingIdx = contextData.findIndex((item) => Object.keys(item)[0] === String(chatId));
        if (existingIdx !== -1) {
          contextData[existingIdx] = { [String(chatId)]: data };
        } else {
          contextData.push({ [String(chatId)]: data });
        }
        writeEncryptedJson(CONTEXT_FILE, contextData);
      });
    };
    loadChatContext = async (chatId) => {
      try {
        if (!await fs7.pathExists(CONTEXT_FILE)) return { total: 0, context: 0 };
        const contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) return { total: 0, context: 0 };
        const entry = contextData.find((item) => Object.keys(item)[0] === String(chatId));
        return entry ? entry[String(chatId)] : { total: 0, context: 0 };
      } catch (e) {
        return { total: 0, context: 0 };
      }
    };
  }
});

// src/utils/usage.js
import fs8 from "fs-extra";
import path7 from "path";
import os3 from "os";
var getLocalBackupPath, BACKUP_FILE, generateSaveId, cachedUsage, writeTimeout, lastWriteTime, isDirty, defaultStats, purgeOldHistory, loadUsageFromFile, flushUsage, queueFlush, initUsage, forceFlushUsage, getDailyUsage, getMonthlyUsage, incrementUsage, addToUsage, getCustomPeriodUsage, checkQuota, getImageQuotaBuckets, getImageQuotaLimit, checkImageQuota, getImageQuotaStats, recordImageGeneration;
var init_usage = __esm({
  "src/utils/usage.js"() {
    init_paths();
    init_crypto();
    getLocalBackupPath = () => {
      if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || path7.join(os3.homedir(), "AppData", "Local");
        return path7.join(localAppData, "FxFl", "backups", "backup.json");
      }
      if (process.platform === "darwin") {
        return path7.join(os3.homedir(), "Library", "Application Support", "FxFl", "backups", "backup.json");
      }
      const xdgDataHome = process.env.XDG_DATA_HOME || path7.join(os3.homedir(), ".local", "share");
      return path7.join(xdgDataHome, "fxfl", "backups", "backup.json");
    };
    BACKUP_FILE = getLocalBackupPath();
    generateSaveId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
    cachedUsage = null;
    writeTimeout = null;
    lastWriteTime = 0;
    isDirty = false;
    defaultStats = {
      agent: 0,
      background: 0,
      search: 0,
      toolSuccess: 0,
      toolFailure: 0,
      toolDenied: 0,
      duration: 0,
      tokens: 0,
      cachedTokens: 0,
      candidateTokens: 0,
      linesAdded: 0,
      linesRemoved: 0,
      imageCalls: []
    };
    purgeOldHistory = (history, todayStr) => {
      if (!history) return {};
      const keys = Object.keys(history);
      const thirtyDaysAgo = new Date(new Date(todayStr).getTime() - 30 * 24 * 60 * 60 * 1e3);
      const purged = {};
      for (const key of keys) {
        const keyDate = new Date(key);
        if (keyDate >= thirtyDaysAgo) {
          purged[key] = history[key];
        }
      }
      return purged;
    };
    loadUsageFromFile = async () => {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const tempFile = USAGE_FILE + ".tmp";
      let primaryData = null;
      let backupData = null;
      try {
        if (await fs8.exists(tempFile)) {
          const rawContent = (await fs8.readFile(tempFile, "utf8")).trim();
          let parsed = null;
          if (rawContent.startsWith("{") || rawContent.startsWith("[")) {
            parsed = JSON.parse(rawContent);
          } else {
            parsed = JSON.parse(decryptAes(rawContent));
          }
          if (parsed && parsed.date && parsed.stats) {
            primaryData = parsed;
            try {
              await fs8.rename(tempFile, USAGE_FILE);
            } catch (e) {
            }
          } else {
            try {
              await fs8.remove(tempFile);
            } catch (e) {
            }
          }
        }
      } catch (err) {
        try {
          await fs8.remove(tempFile);
        } catch (e) {
        }
      }
      if (!primaryData) {
        try {
          if (await fs8.exists(USAGE_FILE)) {
            const rawContent = (await fs8.readFile(USAGE_FILE, "utf8")).trim();
            if (rawContent.startsWith("{") || rawContent.startsWith("[")) {
              primaryData = JSON.parse(rawContent);
            } else {
              primaryData = JSON.parse(decryptAes(rawContent));
            }
          }
        } catch (err) {
        }
      }
      try {
        if (await fs8.exists(BACKUP_FILE)) {
          const rawContent = (await fs8.readFile(BACKUP_FILE, "utf8")).trim();
          if (rawContent.startsWith("{") || rawContent.startsWith("[")) {
            backupData = JSON.parse(rawContent);
          } else {
            backupData = JSON.parse(decryptAes(rawContent));
          }
        }
      } catch (err) {
      }
      let resolvedData = null;
      if (primaryData && backupData) {
        if (primaryData.saveId !== backupData.saveId) {
          resolvedData = primaryData;
          try {
            await fs8.ensureDir(path7.dirname(BACKUP_FILE));
            await fs8.copy(USAGE_FILE, BACKUP_FILE);
          } catch (e) {
          }
        } else {
          resolvedData = primaryData;
        }
      } else if (primaryData && !backupData) {
        resolvedData = primaryData;
        try {
          await fs8.ensureDir(path7.dirname(BACKUP_FILE));
          await fs8.copy(USAGE_FILE, BACKUP_FILE);
        } catch (e) {
        }
      } else if (!primaryData && backupData) {
        resolvedData = backupData;
        try {
          await fs8.ensureDir(path7.dirname(USAGE_FILE));
          await fs8.copy(BACKUP_FILE, USAGE_FILE);
        } catch (e) {
        }
      }
      if (resolvedData) {
        const stats = resolvedData.stats || { ...defaultStats };
        const mergedStats = { ...defaultStats, ...stats };
        if (!Array.isArray(mergedStats.imageCalls)) {
          mergedStats.imageCalls = [];
        }
        const history = resolvedData.history || {};
        if (resolvedData.date === today) {
          return {
            ...resolvedData,
            stats: mergedStats,
            history
          };
        } else {
          const oldDate = resolvedData.date;
          const oldStats = mergedStats;
          const updatedHistory = { ...history };
          if (oldDate) {
            updatedHistory[oldDate] = oldStats;
          }
          return {
            date: today,
            stats: { ...defaultStats },
            history: purgeOldHistory(updatedHistory, today)
          };
        }
      }
      return {
        date: today,
        stats: { ...defaultStats },
        history: {}
      };
    };
    flushUsage = async () => {
      if (!isDirty || !cachedUsage) return;
      try {
        await fs8.ensureDir(path7.dirname(USAGE_FILE));
        let diskData = null;
        try {
          if (await fs8.exists(USAGE_FILE)) {
            const rawContent = (await fs8.readFile(USAGE_FILE, "utf8")).trim();
            if (rawContent.startsWith("{") || rawContent.startsWith("[")) {
              diskData = JSON.parse(rawContent);
            } else {
              diskData = JSON.parse(decryptAes(rawContent));
            }
          }
        } catch (e) {
        }
        if (diskData && diskData.date === cachedUsage.date && diskData.stats) {
          for (const key in cachedUsage.stats) {
            if (diskData.stats[key] !== void 0) {
              if (Array.isArray(cachedUsage.stats[key])) {
                const diskArr = Array.isArray(diskData.stats[key]) ? diskData.stats[key] : [];
                const memArr = cachedUsage.stats[key];
                const uniqueMap = /* @__PURE__ */ new Map();
                for (const item of [...diskArr, ...memArr]) {
                  if (item && item.timestamp) {
                    uniqueMap.set(item.timestamp, item);
                  }
                }
                cachedUsage.stats[key] = Array.from(uniqueMap.values());
              } else if (typeof cachedUsage.stats[key] === "number") {
                cachedUsage.stats[key] = Math.max(cachedUsage.stats[key], Number(diskData.stats[key]) || 0);
              } else if (cachedUsage.stats[key] && typeof cachedUsage.stats[key] === "object") {
                const diskObj = diskData.stats[key] || {};
                const memObj = cachedUsage.stats[key];
                for (const subKey in diskObj) {
                  if (typeof diskObj[subKey] === "number") {
                    memObj[subKey] = Math.max(memObj[subKey] || 0, diskObj[subKey]);
                  } else if (diskObj[subKey] && typeof diskObj[subKey] === "object") {
                    if (!memObj[subKey]) memObj[subKey] = {};
                    for (const mKey in diskObj[subKey]) {
                      if (typeof diskObj[subKey][mKey] === "number") {
                        memObj[subKey][mKey] = Math.max(memObj[subKey][mKey] || 0, diskObj[subKey][mKey]);
                      } else if (diskObj[subKey][mKey] && typeof diskObj[subKey][mKey] === "object") {
                        if (!memObj[subKey][mKey]) memObj[subKey][mKey] = {};
                        for (const valKey in diskObj[subKey][mKey]) {
                          memObj[subKey][mKey][valKey] = Math.max(memObj[subKey][mKey][valKey] || 0, diskObj[subKey][mKey][valKey]);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (diskData && diskData.history) {
          const mergedHistory = { ...cachedUsage.history || {} };
          for (const dateKey in diskData.history) {
            if (mergedHistory[dateKey]) {
              for (const key in mergedHistory[dateKey]) {
                if (key === "imageCalls") {
                  const diskArr = Array.isArray(diskData.history[dateKey].imageCalls) ? diskData.history[dateKey].imageCalls : [];
                  const memArr = Array.isArray(mergedHistory[dateKey].imageCalls) ? mergedHistory[dateKey].imageCalls : [];
                  const uniqueMap = /* @__PURE__ */ new Map();
                  for (const item of [...diskArr, ...memArr]) {
                    if (item && item.timestamp) {
                      uniqueMap.set(item.timestamp, item);
                    }
                  }
                  mergedHistory[dateKey].imageCalls = Array.from(uniqueMap.values());
                } else if (typeof mergedHistory[dateKey][key] === "number") {
                  mergedHistory[dateKey][key] = Math.max(mergedHistory[dateKey][key], Number(diskData.history[dateKey][key]) || 0);
                }
              }
            } else {
              mergedHistory[dateKey] = diskData.history[dateKey];
            }
          }
          cachedUsage.history = mergedHistory;
        }
        cachedUsage.saveId = generateSaveId();
        const tempFile = USAGE_FILE + ".tmp";
        const encryptedStr = encryptAes(JSON.stringify(cachedUsage, null, 2));
        await fs8.writeFile(tempFile, encryptedStr, "utf8");
        const fd = await fs8.open(tempFile, "r+");
        await fs8.fsync(fd);
        await fs8.close(fd);
        await fs8.rename(tempFile, USAGE_FILE);
        try {
          await fs8.ensureDir(path7.dirname(BACKUP_FILE));
          await fs8.copy(USAGE_FILE, BACKUP_FILE);
        } catch (backupErr) {
        }
        isDirty = false;
        lastWriteTime = Date.now();
      } catch (e) {
      }
    };
    queueFlush = () => {
      isDirty = true;
      if (writeTimeout) return;
      const now = Date.now();
      const delay = Math.max(0, 1500 - (now - lastWriteTime));
      writeTimeout = setTimeout(async () => {
        await flushUsage();
        writeTimeout = null;
      }, delay);
      if (writeTimeout.unref) writeTimeout.unref();
    };
    initUsage = async () => {
      cachedUsage = await loadUsageFromFile();
    };
    forceFlushUsage = async () => {
      if (writeTimeout) {
        clearTimeout(writeTimeout);
        writeTimeout = null;
      }
      await flushUsage();
    };
    getDailyUsage = async () => {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
      } else if (cachedUsage.date !== today) {
        const oldDate = cachedUsage.date;
        const oldStats = cachedUsage.stats;
        const history = cachedUsage.history || {};
        if (oldStats) {
          history[oldDate] = oldStats;
        }
        cachedUsage = {
          date: today,
          stats: { ...defaultStats },
          history: purgeOldHistory(history, today)
        };
        isDirty = true;
        await flushUsage();
      }
      if (cachedUsage && cachedUsage.stats && !Array.isArray(cachedUsage.stats.imageCalls)) {
        cachedUsage.stats.imageCalls = [];
      }
      return cachedUsage.stats;
    };
    getMonthlyUsage = async () => {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
      }
      if (cachedUsage.date !== today) {
        await getDailyUsage();
      }
      const history = cachedUsage.history || {};
      const purgedHistory = purgeOldHistory(history, today);
      cachedUsage.history = purgedHistory;
      const todayStats = cachedUsage.stats || { ...defaultStats };
      const summed = { ...defaultStats };
      summed.imageCalls = [];
      summed.models = {};
      const addStats = (target, source) => {
        for (const key in target) {
          if (key === "imageCalls") {
            target.imageCalls = [...target.imageCalls || [], ...source.imageCalls || []];
          } else if (key === "models") {
            const srcModels = source.models || {};
            for (const provider in srcModels) {
              if (!target.models[provider]) {
                target.models[provider] = {};
              }
              for (const model in srcModels[provider]) {
                if (!target.models[provider][model]) {
                  target.models[provider][model] = {
                    tokens: 0,
                    cachedTokens: 0,
                    candidateTokens: 0
                  };
                }
                const tM = target.models[provider][model];
                const sM = srcModels[provider][model];
                tM.tokens += sM.tokens || 0;
                tM.cachedTokens += sM.cachedTokens || 0;
                tM.candidateTokens += sM.candidateTokens || 0;
              }
            }
          } else if (typeof target[key] === "number") {
            target[key] += source[key] || 0;
          }
        }
      };
      addStats(summed, todayStats);
      for (const dateKey in purgedHistory) {
        addStats(summed, purgedHistory[dateKey]);
      }
      return summed;
    };
    incrementUsage = async (key, provider) => {
      const stats = await getDailyUsage();
      if (stats[key] !== void 0) {
        stats[key]++;
      }
      if (provider && key === "agent") {
        if (!stats.providerRequests) {
          stats.providerRequests = {};
        }
        stats.providerRequests[provider] = (stats.providerRequests[provider] || 0) + 1;
      }
      queueFlush();
    };
    addToUsage = async (key, amount, provider, model) => {
      const stats = await getDailyUsage();
      if (stats[key] !== void 0) {
        stats[key] += Math.floor(amount);
      }
      if (provider && model && (key === "tokens" || key === "cachedTokens" || key === "candidateTokens")) {
        if (!stats.models) {
          stats.models = {};
        }
        if (!stats.models[provider]) {
          stats.models[provider] = {};
        }
        if (!stats.models[provider][model]) {
          stats.models[provider][model] = {
            tokens: 0,
            cachedTokens: 0,
            candidateTokens: 0
          };
        }
        const mObj = stats.models[provider][model];
        if (key === "tokens") mObj.tokens += Math.floor(amount);
        if (key === "cachedTokens") mObj.cachedTokens += Math.floor(amount);
        if (key === "candidateTokens") mObj.candidateTokens += Math.floor(amount);
      }
      queueFlush();
    };
    getCustomPeriodUsage = async (resetDay = 1) => {
      const today = /* @__PURE__ */ new Date();
      const todayStr = today.toISOString().split("T")[0];
      if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
      }
      if (cachedUsage.date !== todayStr) {
        await getDailyUsage();
      }
      let startYear = today.getFullYear();
      let startMonth = today.getMonth();
      const todayDay = today.getDate();
      if (todayDay < resetDay) {
        startMonth -= 1;
        if (startMonth < 0) {
          startMonth = 11;
          startYear -= 1;
        }
      }
      const startDate = new Date(startYear, startMonth, resetDay);
      const startDateStr = startDate.toISOString().split("T")[0];
      const history = cachedUsage.history || {};
      const todayStats = cachedUsage.stats || { ...defaultStats };
      const summed = { ...defaultStats };
      summed.imageCalls = [];
      summed.models = {};
      const addStats = (target, source) => {
        for (const key in target) {
          if (key === "imageCalls") {
            target.imageCalls = [...target.imageCalls || [], ...source.imageCalls || []];
          } else if (key === "models") {
            const srcModels = source.models || {};
            for (const provider in srcModels) {
              if (!target.models[provider]) {
                target.models[provider] = {};
              }
              for (const model in srcModels[provider]) {
                if (!target.models[provider][model]) {
                  target.models[provider][model] = {
                    tokens: 0,
                    cachedTokens: 0,
                    candidateTokens: 0
                  };
                }
                const tM = target.models[provider][model];
                const sM = srcModels[provider][model];
                tM.tokens += sM.tokens || 0;
                tM.cachedTokens += sM.cachedTokens || 0;
                tM.candidateTokens += sM.candidateTokens || 0;
              }
            }
          } else if (typeof target[key] === "number") {
            target[key] += source[key] || 0;
          }
        }
      };
      addStats(summed, todayStats);
      for (const dateKey in history) {
        if (dateKey >= startDateStr && dateKey < todayStr) {
          addStats(summed, history[dateKey]);
        }
      }
      return summed;
    };
    checkQuota = async (key, settings) => {
      const tier = settings.apiTier || "Free";
      const quotas = settings.quotas || {};
      const resolveAgentLimits = () => {
        const providerBudgets = quotas.providerBudgets || {};
        const useProvider = !!providerBudgets.__useProvider;
        const currentProvider = settings.aiProvider || "Google";
        if (useProvider && providerBudgets[currentProvider]) {
          const pb = providerBudgets[currentProvider];
          return {
            agentLimit: typeof pb.agentLimit === "number" && pb.agentLimit > 0 ? pb.agentLimit : 99999999,
            tokenLimit: typeof pb.tokenLimit === "number" && pb.tokenLimit > 0 ? pb.tokenLimit : 99999999999999,
            monthlyTokenLimit: typeof pb.monthlyTokenLimit === "number" && pb.monthlyTokenLimit > 0 ? pb.monthlyTokenLimit : 99999999999999
          };
        }
        return {
          agentLimit: quotas.agentLimit || 99999999,
          tokenLimit: quotas.tokenLimit || 99999999999999,
          monthlyTokenLimit: quotas.monthlyTokenLimit || 99999999999999
        };
      };
      if (tier === "Free") {
        if (key === "agent") {
          const { agentLimit, tokenLimit, monthlyTokenLimit } = resolveAgentLimits();
          const dailyUsage = await getDailyUsage();
          if (dailyUsage.agent + dailyUsage.background >= 999999) return false;
          const dailyOk = dailyUsage.agent < agentLimit && (dailyUsage.tokens || 0) < tokenLimit;
          if (!dailyOk) return false;
          let monthlyUsage;
          if (quotas.resetMode === "Custom") {
            monthlyUsage = await getCustomPeriodUsage(quotas.resetDay || 1);
          } else {
            monthlyUsage = await getMonthlyUsage();
          }
          return (monthlyUsage.tokens || 0) < monthlyTokenLimit;
        }
        if (key === "background") {
          const dailyUsage = await getDailyUsage();
          if (dailyUsage.agent + dailyUsage.background >= 999999) return false;
          return dailyUsage.background < (quotas.backgroundLimit || 999999);
        }
        if (key === "search") {
          const dailyUsage = await getDailyUsage();
          return dailyUsage.search < (quotas.searchLimit || 100);
        }
      }
      if (tier === "Paid" || tier === "Custom") {
        if (key === "agent") {
          const { agentLimit, tokenLimit, monthlyTokenLimit } = resolveAgentLimits();
          const dailyUsage = await getDailyUsage();
          const dailyOk = dailyUsage.agent < agentLimit && (dailyUsage.tokens || 0) < tokenLimit;
          if (!dailyOk) return false;
          let monthlyUsage;
          if (quotas.resetMode === "Custom") {
            monthlyUsage = await getCustomPeriodUsage(quotas.resetDay || 1);
          } else {
            monthlyUsage = await getMonthlyUsage();
          }
          return (monthlyUsage.tokens || 0) < monthlyTokenLimit;
        }
        if (key === "background") {
          const dailyUsage = await getDailyUsage();
          return dailyUsage.background < (quotas.backgroundLimit || 999999);
        }
        if (key === "search") {
          const dailyUsage = await getDailyUsage();
          return dailyUsage.search < (quotas.searchLimit || 100);
        }
      }
      return true;
    };
    getImageQuotaBuckets = (imageCalls) => {
      const hourMs = 60 * 60 * 1e3;
      if (!imageCalls || imageCalls.length === 0) {
        return [];
      }
      const sortedCalls = [...imageCalls].sort((a, b) => a.timestamp - b.timestamp);
      const buckets = [];
      for (const call of sortedCalls) {
        if (buckets.length > 0) {
          const lastBucket = buckets[buckets.length - 1];
          if (call.timestamp >= lastBucket.start && call.timestamp < lastBucket.end) {
            lastBucket.calls.push(call);
            lastBucket.spent += call.cost;
            continue;
          }
        }
        buckets.push({
          start: call.timestamp,
          end: call.timestamp + hourMs,
          calls: [call],
          spent: call.cost
        });
      }
      return buckets;
    };
    getImageQuotaLimit = (imageCalls, now) => {
      const hourMs = 60 * 60 * 1e3;
      if (!imageCalls || imageCalls.length === 0) {
        return 0.025;
      }
      const buckets = getImageQuotaBuckets(imageCalls);
      if (buckets.length === 0) {
        return 0.025;
      }
      const history = [];
      for (const bucket of buckets) {
        let limit = 0.025;
        if (history.length > 0) {
          const prev1 = history[history.length - 1];
          let consecutiveMax = false;
          if (history.length >= 2) {
            const prev2 = history[history.length - 2];
            if (prev1.ratio >= 0.8 && prev2.ratio >= 0.8) {
              consecutiveMax = true;
            }
          }
          if (consecutiveMax) {
            limit = 0.015;
          } else {
            const prevLimit2 = prev1.limit;
            const prevRatio2 = prev1.ratio;
            if (prevRatio2 >= 0.8) {
              limit = prevLimit2 === 0.015 ? 0.015 : prevLimit2;
            } else if (prevRatio2 < 0.4) {
              limit = Math.min(0.025, prevLimit2 + 5e-3);
            } else if (prevRatio2 >= 0.4 && prevRatio2 < 0.6) {
              limit = Math.min(0.025, prevLimit2 + 4e-3);
            } else {
              limit = Math.min(0.025, prevLimit2 + 2e-3);
            }
          }
        }
        const ratio = limit > 0 ? bucket.spent / limit : 0;
        history.push({ limit, spent: bucket.spent, ratio });
      }
      const lastBucket = buckets[buckets.length - 1];
      if (now < lastBucket.end) {
        return history[history.length - 1].limit;
      }
      let currentLimit = history[history.length - 1].limit;
      let prevLimit = currentLimit;
      let prevRatio = history[history.length - 1].ratio;
      let simulatedTime = lastBucket.end;
      let consecutiveMaxCount = 0;
      for (let k = history.length - 1; k >= 0; k--) {
        if (history[k].ratio >= 0.8) {
          consecutiveMaxCount++;
        } else {
          break;
        }
      }
      while (simulatedTime <= now) {
        let limit = 0.025;
        const consecutiveMax = consecutiveMaxCount >= 2;
        if (consecutiveMax) {
          limit = 0.015;
        } else {
          if (prevRatio >= 0.8) {
            limit = prevLimit === 0.015 ? 0.015 : prevLimit;
          } else if (prevRatio < 0.4) {
            limit = Math.min(0.025, prevLimit + 5e-3);
          } else if (prevRatio >= 0.4 && prevRatio < 0.6) {
            limit = Math.min(0.025, prevLimit + 4e-3);
          } else {
            limit = Math.min(0.025, prevLimit + 2e-3);
          }
        }
        prevLimit = limit;
        prevRatio = 0;
        consecutiveMaxCount = 0;
        simulatedTime += hourMs;
        currentLimit = limit;
      }
      return currentLimit;
    };
    checkImageQuota = async (settings) => {
      const imageSettings = settings.imageSettings || { keyType: "Default", quality: "Low-High" };
      if (imageSettings.keyType !== "Default") return true;
      const costs = {
        "Low": 1e-3,
        "Low-High": 2e-3,
        "Medium": 8e-3,
        "Medium-High": 0.01,
        "High": 0.045,
        "Ultra": 0.0488,
        "Premium": 0.15
      };
      const currentCost = costs[imageSettings.quality] || 2e-3;
      const stats = await getDailyUsage();
      if (!stats.imageCalls) {
        stats.imageCalls = [];
      }
      const now = Date.now();
      const buckets = getImageQuotaBuckets(stats.imageCalls);
      let totalSpent = 0;
      if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        if (now >= lastBucket.start && now < lastBucket.end) {
          totalSpent = lastBucket.spent;
        }
      }
      const currentLimit = getImageQuotaLimit(stats.imageCalls, now);
      return totalSpent + currentCost <= currentLimit;
    };
    getImageQuotaStats = async () => {
      const stats = await getDailyUsage();
      if (!stats.imageCalls) {
        stats.imageCalls = [];
      }
      const now = Date.now();
      const buckets = getImageQuotaBuckets(stats.imageCalls);
      let activeCalls = [];
      let totalSpent = 0;
      let nextResetMin = 0;
      if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        if (now >= lastBucket.start && now < lastBucket.end) {
          activeCalls = lastBucket.calls;
          totalSpent = lastBucket.spent;
          nextResetMin = Math.max(0, Math.ceil((lastBucket.end - now) / (60 * 1e3)));
        }
      }
      const currentLimit = getImageQuotaLimit(stats.imageCalls, now);
      const remaining = Math.max(0, currentLimit - totalSpent);
      const reclaimCost = totalSpent;
      return {
        totalSpent,
        remaining,
        activeCallsCount: activeCalls.length,
        nextResetMin,
        reclaimCost,
        limit: currentLimit
      };
    };
    recordImageGeneration = async (settings) => {
      const imageSettings = settings.imageSettings || { keyType: "Default", quality: "Low-High" };
      const costs = {
        "Low": 1e-3,
        "Low-High": 2e-3,
        "Medium": 8e-3,
        "Medium-High": 0.01,
        "High": 0.045,
        "Ultra": 0.0488,
        "Premium": 0.1
      };
      const cost = costs[imageSettings.quality] || 2e-3;
      const stats = await getDailyUsage();
      if (!stats.imageCalls) {
        stats.imageCalls = [];
      }
      stats.imageCalls.push({
        timestamp: Date.now(),
        cost
      });
      queueFlush();
    };
  }
});

// src/tools/web_search.js
import puppeteer from "puppeteer";
var web_search;
var init_web_search = __esm({
  "src/tools/web_search.js"() {
    init_arg_parser();
    init_paths();
    web_search = async (argsString) => {
      const { query, limit = 10 } = parseArgs(argsString);
      if (!query) return 'ERROR: Missing "query" argument for web_search.';
      const maxRetries = 3;
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-gpu",
              "--disable-dev-shm-usage"
            ]
          });
          const page = await browser.newPage();
          await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.97 Safari/537.36");
          await page.setViewport({ width: 1366, height: 768 });
          const jitter = attempt === 1 ? Math.random() * 1e3 + 500 : Math.random() * 2e3 + 1e3;
          await new Promise((r) => setTimeout(r, jitter));
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 18e4 });
          const results = await page.$$eval(".result", (elements, maxLimit) => {
            return elements.slice(0, maxLimit).map((el, i) => {
              const titleEl = el.querySelector(".result__a");
              const snippetEl = el.querySelector(".result__snippet");
              let url = titleEl ? titleEl.href : "";
              if (url.includes("uddg=")) {
                url = decodeURIComponent(url.split("uddg=")[1].split("&")[0]);
              }
              const title = titleEl ? titleEl.innerText.trim() : "No Title";
              const snippet = snippetEl ? snippetEl.innerText.trim() : "No Snippet";
              return `${i + 1}. ${title}
Source: ${url}
Snippet: ${snippet}`;
            });
          }, limit);
          if (results.length === 0) {
            const bodyText = await page.evaluate(() => document.body.innerText);
            if (bodyText.includes("anomaly")) {
              throw new Error("ANOMALY_DETECTED");
            }
            await browser.close();
            return `No results found for query: [${query}].`;
          }
          const finalResults = results.join("\n\n");
          await browser.close();
          return `Search results for [${query}]:

${finalResults}`;
        } catch (err) {
          lastError = err;
          if (browser) await browser.close();
          if (attempt < maxRetries) {
            const backoff = Math.pow(2, attempt) * 1e3;
            await new Promise((r) => setTimeout(r, backoff));
          }
        }
      }
      return `ERROR: Search failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
    };
  }
});

// src/tools/web_scrape.js
import puppeteer2 from "puppeteer";
var web_scrape;
var init_web_scrape = __esm({
  "src/tools/web_scrape.js"() {
    init_paths();
    web_scrape = async (args) => {
      const urlMatch = args.match(/url\s*=\s*["'](.*)["']/);
      const url = urlMatch ? urlMatch[1] : args;
      const maxRetries = 3;
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;
        try {
          browser = await puppeteer2.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-gpu",
              "--disable-dev-shm-usage"
            ]
          });
          const page = await browser.newPage();
          await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.97 Safari/537.36");
          await page.setViewport({ width: 1366, height: 768 });
          const jitter = attempt === 1 ? Math.random() * 1e3 + 500 : Math.random() * 2e3 + 1e3;
          await new Promise((r) => setTimeout(r, jitter));
          await page.goto(url, { waitUntil: "networkidle2", timeout: 18e4 });
          await new Promise((r) => setTimeout(r, 5e3));
          let htmlContent = await page.evaluate(() => {
            const junk = document.querySelectorAll("script, style, nav, footer, header, noscript, svg, canvas, iframe, ad, .ads, link, meta, img");
            junk.forEach((el) => el.remove());
            const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
            let currentNode;
            while (currentNode = iterator.nextNode()) {
              currentNode.remove();
            }
            const allElements = document.querySelectorAll("*");
            allElements.forEach((el) => {
              const attributes = el.attributes;
              for (let i = attributes.length - 1; i >= 0; i--) {
                const attrName = attributes[i].name;
                if (attrName !== "href" && attrName !== "src") {
                  el.removeAttribute(attrName);
                }
              }
              if ((el.tagName === "SPAN" || el.tagName === "DIV" || el.tagName === "SECTION") && el.attributes.length === 0) {
                if (el.tagName === "SPAN" || el.tagName === "DIV" && el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                  el.replaceWith(...el.childNodes);
                }
              }
            });
            const pruneEmpty = () => {
              let found = false;
              document.querySelectorAll("*:not(br)").forEach((el) => {
                if (el.childNodes.length === 0 && !el.innerText.trim()) {
                  el.remove();
                  found = true;
                }
              });
              if (found) pruneEmpty();
            };
            pruneEmpty();
            return document.body.innerHTML;
          });
          if (!htmlContent) throw new Error("EMPTY_RENDER_RESULT");
          const cleanedHtml = htmlContent.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim().substring(0, 3e4);
          await browser.close();
          return `CLEANED HTML FROM [${url}]:

${cleanedHtml}${htmlContent.length > 3e4 ? "\n\n[TRUNCATED AT 30K CHARS]" : ""}`;
        } catch (err) {
          lastError = err;
          if (browser) await browser.close();
          if (attempt < maxRetries) {
            const backoff = Math.pow(2, attempt) * 1e3;
            await new Promise((r) => setTimeout(r, backoff));
          }
        }
      }
      return `ERROR: Scrape failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
    };
  }
});

// src/tools/memory.js
var USER_MEMORY_SIZE, memory;
var init_memory = __esm({
  "src/tools/memory.js"() {
    init_crypto();
    init_paths();
    USER_MEMORY_SIZE = 4 * (1024 * 2);
    memory = async (rawArgs, context = {}) => {
      const parseArg = (key) => {
        const quotedRegex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, "s");
        const quotedMatch = rawArgs.match(quotedRegex);
        if (quotedMatch) return quotedMatch[2].trim();
        const unquotedRegex = new RegExp(`${key}\\s*[:=]\\s*([^,\\s)]+)`, "s");
        const unquotedMatch = rawArgs.match(unquotedRegex);
        if (unquotedMatch) return unquotedMatch[1].trim();
        return null;
      };
      const action = parseArg("action");
      const method = parseArg("method");
      const content = parseArg("content");
      const contentNew = parseArg("content-new");
      const contentOld = parseArg("content-old");
      const id = parseArg("id");
      const chatId = parseArg("chat-id") || context.chatId || context.sessionId || "default-session";
      if (action === "temp") {
        if (!content) return "ERROR: Missing 'content' for temp memory.";
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        if (!tempStorage[chatId]) tempStorage[chatId] = [];
        tempStorage[chatId].push(content);
        writeEncryptedJson(TEMP_MEM_FILE, tempStorage);
        const currentTotalLength = tempStorage[chatId].reduce((acc, m) => acc + m.length, 0);
        return `SUCCESS: Temporary context saved for session [${chatId}]. (Size: ${currentTotalLength} chars)`;
      }
      if (action === "user") {
        const memories = readEncryptedJson(MEMORIES_FILE, []).map((m) => {
          if (m.score === void 0) m.score = 0.5;
          return m;
        });
        if (method === "add") {
          if (!content) return "ERROR: Missing 'content' for memory addition.";
          const now = /* @__PURE__ */ new Date();
          const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
          const formattedContent = content.includes("[Saved on:") ? content : `${content.trim()} [Saved on: ${dateStr}]`;
          const MAX_CHARS = USER_MEMORY_SIZE;
          let currentTotalLength = memories.reduce((acc, m) => acc + (m.memory?.length || 0), 0);
          while (memories.length > 0 && currentTotalLength + formattedContent.length > MAX_CHARS) {
            const removed = memories.shift();
            currentTotalLength -= removed.memory?.length || 0;
          }
          const scoreArg = parseArg("score");
          const initialScore = scoreArg ? parseFloat(scoreArg) : 0.5;
          const newMemory = {
            id: `mem-${Date.now().toString(36)}`,
            memory: formattedContent,
            score: Math.min(2, isNaN(initialScore) ? 0.5 : initialScore)
          };
          memories.push(newMemory);
          writeEncryptedJson(MEMORIES_FILE, memories);
          return `SUCCESS: Memory added with ID [${newMemory.id}] and score [${newMemory.score}]. (Vault Size: ${currentTotalLength + formattedContent.length} chars)`;
        }
        if (method === "update") {
          const memId = id || contentOld;
          const newText = contentNew || content;
          if (!memId || !newText) return "ERROR: Missing 'id' or content for update.";
          const index = memories.findIndex((m) => m.id === memId);
          if (index === -1) return `ERROR: Memory ID [${memId}] not found.`;
          const now = /* @__PURE__ */ new Date();
          const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
          const formattedText = newText.includes("[Saved on:") ? newText : `${newText.trim()} [Saved on: ${dateStr}]`;
          memories[index].memory = formattedText;
          writeEncryptedJson(MEMORIES_FILE, memories);
          return `SUCCESS: Memory [${memId}] updated.`;
        }
        if (method === "delete") {
          const memId = id || content;
          if (!memId) return "ERROR: Missing 'id' for deletion.";
          const initialLen = memories.length;
          const updatedMemories = memories.filter((m) => m.id !== memId);
          if (updatedMemories.length === initialLen) return `ERROR: Memory ID [${memId}] not found.`;
          writeEncryptedJson(MEMORIES_FILE, updatedMemories);
          return `SUCCESS: Memory [${memId}] deleted.`;
        }
        return `ERROR: Invalid method [${method}] for user memory. Use 'add', 'update', or 'delete'.`;
      }
      return `ERROR: Unknown action [${action}] for memory tool.`;
    };
  }
});

// src/tools/chat.js
var chat;
var init_chat = __esm({
  "src/tools/chat.js"() {
    init_history();
    init_arg_parser();
    chat = async (rawArgs, context = {}) => {
      const title = parseArgs(rawArgs).title;
      const chatId = context.chatId || context.sessionId;
      if (!chatId) return "ERROR: No active chatId found in tool context.";
      if (!title) return "ERROR: Missing 'title' argument.";
      try {
        await saveChatTitle(chatId, title);
        return `SUCCESS: Chat title updated to [${title}] for session [${chatId}].`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to update chat title: ${errorMsg}`;
      }
    };
  }
});

// src/tools/view_file.js
import fs9 from "fs";
import path8 from "path";
var view_file;
var init_view_file = __esm({
  "src/tools/view_file.js"() {
    init_arg_parser();
    view_file = async (args, context = {}) => {
      let { path: targetPath, StartLine, EndLine, start_line, end_line, startLine, endLine } = parseArgs(args);
      const sLine = parseInt(StartLine || start_line || startLine);
      const eLine = parseInt(EndLine || end_line || endLine);
      const finalStart = sLine || 1;
      const finalEnd = eLine || (sLine ? sLine + 800 : 800);
      if (!targetPath) return 'ERROR: Missing "path" argument for view_file.';
      const absolutePath = path8.resolve(process.cwd(), targetPath);
      try {
        if (!fs9.existsSync(absolutePath)) {
          return `ERROR: File [${targetPath}] does not exist.`;
        }
        const stats = fs9.statSync(absolutePath);
        if (stats.isDirectory()) {
          return `ERROR: Path [${targetPath}] is a directory. Use list_files instead.`;
        }
        const ext = path8.extname(targetPath).toLowerCase();
        const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".mpeg", ".mpg"];
        if (videoExtensions.includes(ext)) {
          const format = ext.slice(1).toUpperCase();
          return `ERROR: Unable to read. Type ${format} not supported`;
        }
        const mimeMap = {
          ".pdf": "application/pdf",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
          ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".doc": "application/msword"
        };
        if (mimeMap[ext]) {
          const isMultiModal = context.isMultiModal !== false;
          if (!isMultiModal) {
            return `ERROR: Multimodality is not supported for the current model. Unable to load [${targetPath}].`;
          }
          const buffer = fs9.readFileSync(absolutePath);
          const base64 = buffer.toString("base64");
          const mimeType = mimeMap[ext];
          return {
            text: `[BINARY FILE]: ${targetPath} (${mimeType}) - Loaded as multimodal part.`,
            binaryPart: {
              inlineData: {
                data: base64,
                mimeType
              }
            }
          };
        }
        let content = fs9.readFileSync(absolutePath, "utf8");
        if (content.startsWith("\uFEFF")) {
          content = content.slice(1);
        }
        content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = content.split("\n");
        const totalLines = lines.length;
        const start = Math.max(0, finalStart - 1);
        const end = Math.min(totalLines, finalEnd);
        const resultLines = lines.slice(start, end);
        const header = `File: [${targetPath}] (Showing lines ${start + 1}-${end} of ${totalLines}).`;
        const code = resultLines.map((line, i) => `${String(start + i + 1).padStart(4)}: ${line}`).join("\n");
        return `${header}

${code}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to read file [${targetPath}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/write_file.js
import fs10 from "fs";
import path9 from "path";
var write_file;
var init_write_file = __esm({
  "src/tools/write_file.js"() {
    init_arg_parser();
    init_revert();
    write_file = async (args, context = {}) => {
      let { path: targetPath, content } = parseArgs(args);
      if (!targetPath) return 'ERROR: Missing "path" argument for write_file.';
      if (content === void 0) return 'ERROR: Missing "content" argument for write_file.';
      content = content.replace(/^```[\w]*\n?/, "").replace(/```\s*$/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const absolutePath = path9.resolve(process.cwd(), targetPath);
      const parentDir = path9.dirname(absolutePath);
      try {
        await RevertManager.recordFileChange(absolutePath);
        let ancestry = "";
        if (fs10.existsSync(absolutePath)) {
          try {
            const oldData = fs10.readFileSync(absolutePath, "utf8");
            const lines = oldData.split(/\r?\n/);
            ancestry = `Old File contents:
${lines.map((l, i) => `${i + 1} | ${l}`).join("\n")}

`;
          } catch (e) {
            ancestry = `[Note: Could not read existing file for reversal reference]

`;
          }
        }
        if (!fs10.existsSync(parentDir)) {
          fs10.mkdirSync(parentDir, { recursive: true });
        }
        const strip = (t) => t.replace(/^```[\w]*\n?/, "").replace(/```\s*$/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const processedContent = strip(content);
        const finalContent = processedContent.endsWith("\n") ? processedContent : processedContent + "\n";
        const lineCount = finalContent.split(/\r?\n/).length;
        const originalSize = Buffer.byteLength(finalContent, "utf8");
        fs10.writeFileSync(absolutePath, finalContent, "utf8");
        let verifiedContent = fs10.readFileSync(absolutePath, "utf8");
        const verifiedSize = Buffer.byteLength(verifiedContent, "utf8");
        const verifiedLines = verifiedContent.split(/\r?\n/);
        const verifiedLineCount = verifiedLines.length;
        if (verifiedSize === 0 && originalSize > 0) {
          verifiedContent = null;
          return `ERROR: CRITICAL FAILURE: Verification failed. File [${targetPath}] is empty on disk despite success report!`;
        }
        let snippet = "";
        if (verifiedLineCount <= 200) {
          snippet = verifiedLines.join("\n");
        } else {
          const head = verifiedLines.slice(0, 100).join("\n");
          const tail = verifiedLines.slice(-100).join("\n");
          snippet = `${head}

... [${verifiedLineCount - 200} lines truncated] ...

${tail}`;
        }
        verifiedContent = null;
        return `SUCCESS: File [${targetPath}] saved.

- Stats: [${verifiedLineCount} lines, ${(verifiedSize / 1024).toFixed(1)} KB]
${ancestry}- Content Preview:
${snippet}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to write file [${targetPath}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/update_file.js
import fs11 from "fs";
import path10 from "path";
var update_file;
var init_update_file = __esm({
  "src/tools/update_file.js"() {
    init_arg_parser();
    init_revert();
    init_text();
    update_file = async (args, context = {}) => {
      const parsed = parseArgs(args);
      const targetPath = parsed.path;
      if (!targetPath) return 'ERROR: Missing "path" argument for update_file.';
      const { patchPairs, error: parseError } = parsePatchPairs(parsed);
      if (parseError) return `ERROR: ${parseError}`;
      if (patchPairs.length === 0) {
        return "ERROR: No valid replacement pairs found. Use replaceContent1, newContent1, etc.";
      }
      const absolutePath = path10.resolve(process.cwd(), targetPath);
      try {
        if (!fs11.existsSync(absolutePath)) {
          return `ERROR: File [${targetPath}] does not exist. Use write_file instead.`;
        }
        let diskContent = context.forcedContent || fs11.readFileSync(absolutePath, "utf8");
        if (diskContent.startsWith("\uFEFF")) diskContent = diskContent.slice(1);
        const originalContent = diskContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const { content: finalContent, results } = applyPatches(originalContent, patchPairs);
        const failures = results.filter((r) => !r.success);
        const successes = results.filter((r) => r.success);
        if (successes.length === 0) {
          return `ERROR: Patch Failed to apply to [${targetPath}].
${failures.map((f) => `  \u2022 ${f.error}`).join("\n")}`;
        }
        await RevertManager.recordFileChange(absolutePath, originalContent);
        fs11.writeFileSync(absolutePath, finalContent, "utf8");
        const diffText = generateHighFidelityDiff(originalContent, finalContent, results, 12);
        if (failures.length > 0) {
          return `SUCCESS: File [${targetPath}] updated with some blocks failed. [${successes.length}/${patchPairs.length}] blocks applied.

Failures:
${failures.map((f) => `  \u2022 ${f.error}`).join("\n")}

${diffText}`;
        }
        return `SUCCESS: File [${targetPath}] updated. [${results.length}/${patchPairs.length}] blocks applied.

${diffText}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to update file [${targetPath}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/read_folder.js
import fs12 from "fs";
import path11 from "path";
var read_folder;
var init_read_folder = __esm({
  "src/tools/read_folder.js"() {
    init_arg_parser();
    read_folder = async (args) => {
      const { path: targetPath = "." } = parseArgs(args);
      const absolutePath = path11.resolve(process.cwd(), targetPath);
      try {
        if (!fs12.existsSync(absolutePath)) {
          return `ERROR: Path [${targetPath}] does not exist.`;
        }
        const stats = fs12.statSync(absolutePath);
        if (!stats.isDirectory()) {
          return `ERROR: Path [${targetPath}] is a file, not a directory. Use view_file instead.`;
        }
        const files = fs12.readdirSync(absolutePath);
        const totalItems = files.length;
        const maxDisplay = 100;
        const displayItems = files.slice(0, maxDisplay);
        const folderData = [];
        for (const file of displayItems) {
          const fPath = path11.join(absolutePath, file);
          let indicator = "\u{1F4C4}";
          let info = { name: file, type: "unknown", size: "N/A", mtime: "N/A" };
          try {
            const fStats = fs12.statSync(fPath);
            info = {
              name: file,
              type: fStats.isDirectory() ? "directory" : "file",
              size: (fStats.size / 1024).toFixed(1) + " KB",
              mtime: fStats.mtime.toLocaleString()
            };
          } catch (e) {
            info.type = "inaccessible";
          }
          folderData.push(info);
        }
        const formatted = folderData.map((f) => {
          const indicator = f.type === "directory" ? "\u{1F4C1}" : f.type === "file" ? "\u{1F4C4}" : "\u2753";
          if (f.type === "directory") {
            return `${indicator} ${f.name} - [DIR] - [Modified: ${f.mtime}]`;
          }
          return `${indicator} ${f.name} - [Size: ${f.size}] - [Modified: ${f.mtime}]`;
        }).join("\n");
        let footer = `

(Total items in folder: ${totalItems})`;
        if (totalItems > maxDisplay) {
          footer = `

\u26A0\uFE0F TRUNCATED: Showing first ${maxDisplay} of ${totalItems} items.`;
        }
        const result = `Detailed folder stats for [${targetPath}]:

${formatted}${footer}`;
        files.length = 0;
        displayItems.length = 0;
        folderData.length = 0;
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to read folder [${targetPath}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/ask_user.js
var ask_user;
var init_ask_user = __esm({
  "src/tools/ask_user.js"() {
    init_arg_parser();
    ask_user = async (args, context) => {
      const parsed = parseArgs(args);
      const { question } = parsed;
      if (!question) return 'ERROR: Missing "question" argument for ask.';
      if (!context.onAskUser) return "ERROR: onAskUser callback not provided in tool context.";
      const options = [];
      Object.keys(parsed).forEach((key) => {
        if (key.startsWith("option")) {
          const val = parsed[key];
          if (typeof val === "string" && val.includes("::")) {
            const [label2, desc] = val.split("::");
            options.push({
              id: key,
              label: label2.trim(),
              description: desc.trim()
            });
          } else {
            options.push({
              id: key,
              label: String(val).trim(),
              description: ""
            });
          }
        }
      });
      try {
        const choice = await context.onAskUser(question, options);
        return `USER CHOOSE: ${choice}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to get user input: ${errorMsg}`;
      }
    };
  }
});

// src/tools/write_pdf.js
import puppeteer3 from "puppeteer";
import path12 from "path";
import fs13 from "fs-extra";
import { PDFDocument } from "pdf-lib";
var write_pdf;
var init_write_pdf = __esm({
  "src/tools/write_pdf.js"() {
    init_arg_parser();
    init_revert();
    write_pdf = async (args) => {
      const {
        path: targetPath,
        content,
        orientation = "portrait",
        margin = "0px"
      } = parseArgs(args);
      if (!targetPath) return 'ERROR: Missing "path" argument for write_pdf.';
      if (!content) return 'ERROR: Missing "content" (HTML/CSS) for write_pdf.';
      const absolutePath = path12.resolve(process.cwd(), targetPath);
      let browser = null;
      try {
        await fs13.ensureDir(path12.dirname(absolutePath));
        await RevertManager.recordFileChange(absolutePath);
        browser = await puppeteer3.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage"
          ]
        });
        const page = await browser.newPage();
        let resolvedContent = content;
        const resolvedCache = {};
        const resolveToBase64 = async (originalSrc) => {
          if (!originalSrc || originalSrc.startsWith("http://") || originalSrc.startsWith("https://") || originalSrc.startsWith("data:")) {
            return null;
          }
          try {
            const imgPath = path12.resolve(process.cwd(), originalSrc);
            if (await fs13.pathExists(imgPath)) {
              const ext = path12.extname(imgPath).toLowerCase().replace(".", "") || "png";
              const mime = ext === "jpg" ? "jpeg" : ext === "svg" ? "svg+xml" : ext;
              const base64 = await fs13.readFile(imgPath, "base64");
              return `data:image/${mime};base64,${base64}`;
            }
          } catch (e) {
          }
          return null;
        };
        const linkRegex = /<link[^>]+href=["']([^"']+)["']/gi;
        const cssCache = {};
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
          const originalHref = match[1];
          const fullTag = match[0];
          if (originalHref && fullTag.toLowerCase().includes("stylesheet") && !originalHref.startsWith("http://") && !originalHref.startsWith("https://") && !originalHref.startsWith("data:")) {
            try {
              const cssPath = path12.resolve(process.cwd(), originalHref);
              if (await fs13.pathExists(cssPath)) {
                const cssContent = await fs13.readFile(cssPath, "utf-8");
                cssCache[fullTag] = `<style>${cssContent}</style>`;
              }
            } catch (e) {
            }
          }
        }
        for (const [tag, styleTag] of Object.entries(cssCache)) {
          resolvedContent = resolvedContent.split(tag).join(styleTag);
        }
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        while ((match = imgRegex.exec(resolvedContent)) !== null) {
          const originalSrc = match[1];
          if (originalSrc && !resolvedCache[originalSrc]) {
            const dataUri = await resolveToBase64(originalSrc);
            if (dataUri) {
              resolvedCache[originalSrc] = dataUri;
            }
          }
        }
        const urlRegex = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
        while ((match = urlRegex.exec(resolvedContent)) !== null) {
          const originalSrc = match[1].trim();
          if (originalSrc && !resolvedCache[originalSrc]) {
            const dataUri = await resolveToBase64(originalSrc);
            if (dataUri) {
              resolvedCache[originalSrc] = dataUri;
            }
          }
        }
        for (const [originalSrc, dataUri] of Object.entries(resolvedCache)) {
          const escapedSrc = originalSrc.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const srcRegex = new RegExp(`(src=["'])(${escapedSrc})(["'])`, "gi");
          resolvedContent = resolvedContent.replace(srcRegex, `$1${dataUri}$3`);
          const urlReplaceRegex = new RegExp(`url\\(\\s*(['"]?)(${escapedSrc})\\1\\s*\\)`, "gi");
          resolvedContent = resolvedContent.replace(urlReplaceRegex, `url($1${dataUri}$1)`);
        }
        const styledContent = `
            <style>
                @page {
                    margin: ${margin};
                }
                body {
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                * { box-sizing: border-box; }
                .watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-50deg);
                    font-size: 52px;
                    font-weight: bold;
                    color: rgba(0, 0, 0, 0.005);
                    pointer-events: none;
                    z-index: -1000;
                    text-align: center;
                    width: 150%;
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 5px;
                }
            </style>
            <div class="watermark">Generated by FluxFlow CLI (AI)</div>
            ${resolvedContent}
        `;
        await page.setContent(styledContent, { waitUntil: "networkidle0", timeout: 18e4 });
        const pdfBytes = await page.pdf({
          format: "A4",
          landscape: String(orientation).toLowerCase() === "landscape",
          margin: {
            top: margin,
            right: margin,
            bottom: margin,
            left: margin
          },
          printBackground: true
        });
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const fileName = path12.basename(targetPath);
        pdfDoc.setTitle(`FluxFlow_${fileName}`);
        pdfDoc.setAuthor("FluxFlow CLI");
        pdfDoc.setSubject("Generated with Agentic AI System");
        pdfDoc.setKeywords(["FluxFlow", "AI", "Agentic", "Automated"]);
        pdfDoc.setCreator("FluxFlow PDF Engine");
        pdfDoc.setProducer("FluxFlow (Generative AI)");
        const finalPdfBytes = await pdfDoc.save();
        await fs13.writeFile(absolutePath, finalPdfBytes);
        const stats = await fs13.stat(absolutePath);
        return `SUCCESS: PDF generated successfully at [${targetPath}] (${(stats.size / 1024).toFixed(2)} KB).`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to generate PDF [${targetPath}]: ${errorMsg}`;
      } finally {
        if (browser) await browser.close();
      }
    };
  }
});

// src/tools/write_docx.js
import fs14 from "fs-extra";
import path13 from "path";
import HTMLtoDOCX from "html-to-docx";
var write_docx;
var init_write_docx = __esm({
  "src/tools/write_docx.js"() {
    init_arg_parser();
    init_revert();
    write_docx = async (args) => {
      const {
        path: targetPath,
        content
      } = parseArgs(args);
      if (!targetPath) return 'ERROR: Missing "path" argument for write_docx.';
      if (!content) return 'ERROR: Missing "content" (HTML) for write_docx.';
      const absolutePath = path13.resolve(process.cwd(), targetPath);
      try {
        await fs14.ensureDir(path13.dirname(absolutePath));
        await RevertManager.recordFileChange(absolutePath);
        const fileName = path13.basename(targetPath);
        const fullHtml = content.includes("<html") ? content : `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>FluxFlow Document</title>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;
        const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
          title: `FluxFlow_${fileName}`,
          creator: "FluxFlow CLI",
          description: "Generated by Agentic AI System",
          table: { row: { cantSplit: true } },
          footer: true,
          pageNumber: true
        });
        await fs14.writeFile(absolutePath, docxBuffer);
        return `SUCCESS: Word document [${targetPath}] generated successfully.
- Size: ${(docxBuffer.length / 1024).toFixed(1)} KB`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to generate DOCX [${targetPath}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/search_keyword.js
import fs15 from "fs/promises";
import path14 from "path";
async function getFilesRecursively(dir, excludes, baseDir = dir, depth = 1) {
  if (depth > 12) return [];
  let results = [];
  let list;
  try {
    list = await fs15.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const file of list) {
    const fullPath = path14.join(dir, file.name);
    const relativePath = path14.relative(baseDir, fullPath);
    const pathSegments = relativePath.split(path14.sep).map((s) => s.toLowerCase());
    const isExcluded = excludes.some((ex) => pathSegments.includes(ex.toLowerCase()));
    if (isExcluded) continue;
    if (file.isDirectory()) {
      const nestedFiles = await getFilesRecursively(fullPath, excludes, baseDir, depth + 1);
      results = results.concat(nestedFiles);
    } else if (file.isFile()) {
      results.push({ fullPath, relativePath });
    }
  }
  return results;
}
function normStr(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const cap = Math.floor(Math.max(a.length, b.length) / 2) + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = b[j - 1] === a[i - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
    if (Math.min(...dp) > cap) return cap + 1;
  }
  return dp[a.length];
}
function fuzzyMatch(line, keyword) {
  const normLine = normStr(line);
  const lineWords = normLine.split(" ");
  const kwTokens = normStr(keyword).split(" ").filter(Boolean);
  if (normLine.includes(normStr(keyword))) return true;
  return kwTokens.every((token) => {
    const maxDist = token.length <= 2 ? 0 : token.length <= 5 ? 1 : 2;
    return lineWords.some((word) => levenshtein(token, word) <= maxDist);
  });
}
var search_keyword;
var init_search_keyword = __esm({
  "src/tools/search_keyword.js"() {
    init_arg_parser();
    search_keyword = async (args) => {
      const { keyword, file, subString } = parseArgs(args);
      if (!keyword) return 'ERROR: Missing "keyword" argument.';
      const matchSubstring = subString === true || subString === "true" || subString === 1 || subString === "1" || subString === "true" || subString === "yes" || subString === "yes" || false;
      const wordRegex = new RegExp(`(?<![\\w])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i");
      const excludes = [
        "node_modules",
        ".git",
        "dist",
        ".next",
        ".gemini",
        ".exe",
        ".dll",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".zip",
        ".tgz"
      ];
      const maxMatches = 150;
      try {
        let filesToSearch = [];
        const rootDir = process.cwd();
        if (file) {
          const fullPath = path14.resolve(rootDir, file);
          try {
            const stat = await fs15.stat(fullPath);
            if (stat.isFile()) {
              filesToSearch.push({ fullPath, relativePath: path14.relative(rootDir, fullPath) });
            }
          } catch {
            return `ERROR: File not found: ${file}`;
          }
        } else {
          filesToSearch = await getFilesRecursively(rootDir, excludes);
        }
        const searchPromises = filesToSearch.map(async (fileObj) => {
          try {
            const content = await fs15.readFile(fileObj.fullPath, "utf-8");
            if (content.includes("\0")) return [];
            const lines = content.split(/\r?\n/);
            const fileMatches = [];
            for (let i = 0; i < lines.length; i++) {
              const matched = matchSubstring ? lines[i].toLowerCase().includes(keyword.toLowerCase()) || fuzzyMatch(lines[i], keyword) : wordRegex.test(lines[i]);
              if (matched) {
                fileMatches.push({ line: i + 1, content: lines[i].trim() });
              }
            }
            if (fileMatches.length === 0) return null;
            const displayPath = fileObj.relativePath.replace(/\\/g, "/");
            return { path: displayPath, matches: fileMatches };
          } catch {
            return [];
          }
        });
        const settledResults = await Promise.all(searchPromises);
        const fileGroups = [];
        let totalMatches = 0;
        for (const result of settledResults) {
          if (!result || !result.matches) continue;
          if (totalMatches >= maxMatches) break;
          const remaining = maxMatches - totalMatches;
          const trimmedMatches = result.matches.slice(0, remaining);
          fileGroups.push({ path: result.path, matches: trimmedMatches });
          totalMatches += trimmedMatches.length;
        }
        if (typeof global.gc === "function") {
          global.gc();
        }
        if (fileGroups.length === 0) {
          return `Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ". Try to specify files"} ${matchSubstring ? "(subString mode)" : ""}`;
        }
        let output = `Found ${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${fileGroups.length} file${fileGroups.length === 1 ? "" : "s"} ${matchSubstring ? "(subString mode)" : ""}:

`;
        for (const group of fileGroups) {
          output += `${group.path}
`;
          for (let i = 0; i < group.matches.length; i++) {
            const isLast = i === group.matches.length - 1;
            const prefix = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
            output += `${prefix} ${group.matches[i].line}: ${group.matches[i].content}
`;
          }
          output += "\n";
        }
        return output.trimEnd();
      } catch (error) {
        return `ERROR: ${error.message}`;
      }
    };
  }
});

// src/tools/generate_image.js
import fs16 from "fs-extra";
import path15 from "path";
var injectPngMetadata, generate_image;
var init_generate_image = __esm({
  "src/tools/generate_image.js"() {
    init_arg_parser();
    init_settings();
    init_usage();
    init_revert();
    injectPngMetadata = (buffer, metadata = {}) => {
      try {
        if (buffer.length < 8 || buffer[0] !== 137 || buffer[1] !== 80 || buffer[2] !== 78 || buffer[3] !== 71) {
          return buffer;
        }
        const chunksToInject = [];
        const crcTable = [];
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) {
            if (c & 1) {
              c = 3988292384 ^ c >>> 1;
            } else {
              c = c >>> 1;
            }
          }
          crcTable[n] = c;
        }
        const calculateCrc = (buf) => {
          let crc = 4294967295;
          for (let i = 0; i < buf.length; i++) {
            crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
          }
          return (crc ^ 4294967295) >>> 0;
        };
        const createTextChunk = (keyword, text) => {
          const keywordBuf = Buffer.from(keyword, "ascii");
          const textBuf = Buffer.from(text, "utf-8");
          const dataLength = keywordBuf.length + 1 + textBuf.length;
          const chunkBuf = Buffer.alloc(4 + 4 + dataLength + 4);
          chunkBuf.writeUInt32BE(dataLength, 0);
          chunkBuf.write("tEXt", 4, "ascii");
          keywordBuf.copy(chunkBuf, 8);
          chunkBuf[8 + keywordBuf.length] = 0;
          textBuf.copy(chunkBuf, 8 + keywordBuf.length + 1);
          const crcValue = calculateCrc(chunkBuf.subarray(4, 8 + dataLength));
          chunkBuf.writeUInt32BE(crcValue, 8 + dataLength);
          return chunkBuf;
        };
        for (const [key, val] of Object.entries(metadata)) {
          if (val !== void 0 && val !== null) {
            chunksToInject.push(createTextChunk(key, String(val)));
          }
        }
        if (chunksToInject.length === 0) return buffer;
        if (buffer.subarray(12, 16).toString("ascii") === "IHDR") {
          const headerEnd = 33;
          const before = buffer.subarray(0, headerEnd);
          const after = buffer.subarray(headerEnd);
          return Buffer.concat([before, ...chunksToInject, after]);
        }
        return buffer;
      } catch (e) {
        return buffer;
      }
    };
    generate_image = async (args, context = {}) => {
      const parsed = parseArgs(args);
      const prompt = parsed.prompt || parsed.text;
      const outputPath = parsed.path || parsed.outputPath || parsed.output || "generated_image.png";
      const ratio = parsed.ratio;
      if (!prompt) {
        return 'ERROR: Missing "prompt" argument for generate_image.';
      }
      const BLOCKED_KEYWORDS = [
        "nsfw",
        "naked",
        "nudity",
        "nude",
        "porn",
        "sex",
        "xxx",
        "erotic",
        "gore",
        "bloody",
        "violence",
        "abuse",
        "suicide",
        "murder",
        "hentai",
        "pedophile",
        "rape"
      ];
      const promptLower = prompt.toLowerCase();
      const isBlocked = BLOCKED_KEYWORDS.some((kw) => promptLower.includes(kw));
      if (isBlocked) {
        return "ERROR: Prompt blocked by system safety filter (inappropriate or unsafe content detected).";
      }
      try {
        const settings = await loadSettings();
        const hasQuota = await checkImageQuota(settings);
        if (!hasQuota) {
          const stats = await getImageQuotaStats();
          return `ERROR: Insufficient Quota for selected quality. Either tell user reduce quality or wait for next refresh cycle (${stats.nextResetMin || 60}m).`;
        }
        const imageSettings = settings.imageSettings || { keyType: "Default", quality: "Low-High", apiKey: "" };
        const apiKey = imageSettings.keyType === "Custom" && imageSettings.apiKey ? imageSettings.apiKey : FALLBACK_IMAGE_KEY;
        const qualityMap = {
          "Low": "flux",
          "Low-High": "zimage",
          "Medium": "gptimage",
          "Medium-High": "gptimage",
          "High": "qwen-image",
          "Ultra": "gptimage-large",
          "Premium": "nanobanana-pro"
        };
        const selectedModel = qualityMap[imageSettings.quality] || "zimage";
        let width = 1024;
        let height = 1024;
        if (ratio) {
          const cleanRatio = ratio.replace(/\s+/g, "");
          if (cleanRatio === "16:9") {
            width = 1024;
            height = 576;
          } else if (cleanRatio === "9:16") {
            width = 576;
            height = 1024;
          } else if (cleanRatio === "4:3") {
            width = 1024;
            height = 768;
          } else if (cleanRatio === "3:4") {
            width = 768;
            height = 1024;
          } else if (cleanRatio === "1:1") {
            width = 1024;
            height = 1024;
          }
        }
        const seed = Math.floor(Math.random() * 1e7);
        const negativePrompt = "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, disconnected limbs, mutation, mutated hands and fingers, blurry, low quality, low resolution, extra fingers, censored, watermarks, signatures";
        const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${selectedModel}&width=${width}&height=${height}&seed=${seed}&enhance=true&reasoning=high&quality=high&negative=${encodeURIComponent(negativePrompt)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          }
        });
        if (!response.ok) {
          const status = response.status;
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (e) {
          }
          if (status === 402 || errorText.includes("Insufficient balance") || errorText.includes("PAYMENT_REQUIRED")) {
            return "ERROR: Image Generation Currently unavailable. Try again later.";
          }
          return `ERROR: Image Generation failed with status [${status}]: ${errorText || "Unknown API Error"}`;
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await response.json();
          if (json.status === 402 || json.error && json.error.code === "PAYMENT_REQUIRED") {
            return "ERROR: Image Generation Currently unavailable. Try again later.";
          }
          return `ERROR: Image Generation failed: ${json.error?.message || JSON.stringify(json)}`;
        }
        const buffer = await response.arrayBuffer();
        let finalBuffer = Buffer.from(buffer);
        const metadata = {
          "Title": prompt,
          "Description": "Generated via FluxFlow CLI",
          "Software": "FluxFlow CLI",
          "Author": "FluxFlow",
          "Creation Time": (/* @__PURE__ */ new Date()).toISOString(),
          "Prompt": prompt,
          "Model": `Fluxflow:${selectedModel}`,
          "Ratio": ratio || "1:1",
          "Seed": String(seed)
        };
        finalBuffer = injectPngMetadata(finalBuffer, metadata);
        const absolutePath = path15.resolve(process.cwd(), outputPath);
        await fs16.ensureDir(path15.dirname(absolutePath));
        await RevertManager.recordFileChange(absolutePath);
        await fs16.writeFile(absolutePath, finalBuffer);
        await recordImageGeneration(settings);
        const ext = path15.extname(outputPath).toLowerCase();
        const mimeMap = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp"
        };
        const mimeType = mimeMap[ext] || "image/png";
        const isMultiModal = context.isMultiModal !== false;
        if (!isMultiModal) {
          return `SUCCESS: Image successfully generated from prompt [${prompt}] and saved to [${outputPath}].`;
        }
        return {
          text: `SUCCESS: Image successfully generated from prompt [${prompt}] and saved to [${outputPath}]. Output attached to multimodal part`,
          binaryPart: {
            inlineData: {
              data: finalBuffer.toString("base64"),
              mimeType
            }
          }
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed during image generation: ${errorMsg}`;
      }
    };
  }
});

// src/tools/saveSummary.js
var saveSummary;
var init_saveSummary = __esm({
  "src/tools/saveSummary.js"() {
    init_crypto();
    init_paths();
    saveSummary = async (rawArgs, context = {}) => {
      const parseArg = (key) => {
        const regex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, "s");
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
      };
      const id = parseArg("id");
      const summary = parseArg("summary");
      if (!id || !summary) {
        return "ERROR: Missing 'id' or 'summary' for saveSummary tool.";
      }
      try {
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        cacheStorage[id] = summary;
        delete tempStorage[id];
        writeEncryptedJson(TEMP_MEM_CHAT_FILE, cacheStorage);
        writeEncryptedJson(TEMP_MEM_FILE, tempStorage);
        return `SUCCESS: Saved summary and purged raw memories for chat [${id}].`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to save summary for chat [${id}]: ${errorMsg}`;
      }
    };
  }
});

// src/tools/addMemScore.js
var addMemScore;
var init_addMemScore = __esm({
  "src/tools/addMemScore.js"() {
    init_crypto();
    init_paths();
    addMemScore = async (rawArgs, context = {}) => {
      const parseArg = (key) => {
        const regex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, "s");
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
      };
      const id = parseArg("id");
      if (!id) {
        return "ERROR: Missing 'id' parameter for addMemScore tool.";
      }
      try {
        const memories = readEncryptedJson(MEMORIES_FILE, []);
        let found = false;
        const updatedMemories = [];
        for (const mem of memories) {
          if (mem.score === void 0) {
            mem.score = 0.5;
          }
          if (mem.id === id) {
            mem.score = Math.min(2, mem.score + 0.2);
            found = true;
          } else {
            mem.score *= 0.98;
            if (mem.score < 0.05) mem.score = 0;
          }
          mem.score = Math.round(mem.score * 1e5) / 1e5;
          if (mem.score > 0) {
            updatedMemories.push(mem);
          }
        }
        writeEncryptedJson(MEMORIES_FILE, updatedMemories);
        if (!found) {
          return `WARNING: Memory ID [${id}] not found. Other memories decayed by -0.01.`;
        }
        const activeTarget = updatedMemories.find((m) => m.id === id);
        const finalScoreStr = activeTarget ? activeTarget.score.toFixed(2) : "deleted (score <= 0)";
        const deletedCount = memories.length - updatedMemories.length;
        return `SUCCESS: Adjusted memory scores. Target [${id}] is now ${finalScoreStr}.${deletedCount > 0 ? ` Purged ${deletedCount} decayed memories.` : ""}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to adjust memory score for [${id}]: ${errorMsg}`;
      }
    };
  }
});

// src/utils/parsers.js
import fs17 from "fs-extra";
import path16 from "path";
import https from "https";
async function downloadWasm(wasmFile, targetUrl = null) {
  const url = targetUrl || `https://unpkg.com/tree-sitter-wasms@0.1.13/out/${wasmFile}`;
  const localPath = path16.join(PARSER_DIR, wasmFile);
  await fs17.ensureDir(PARSER_DIR);
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "FluxFlow-Agent"
      }
    };
    https.get(url, options, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        let nextUrl = response.headers.location;
        if (!nextUrl.startsWith("http")) {
          const parsedUrl = new URL(url);
          nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
        }
        downloadWasm(wasmFile, nextUrl).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${wasmFile}: HTTP ${response.statusCode}`));
        return;
      }
      const file = fs17.createWriteStream(localPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      if (fs17.existsSync(localPath)) fs17.unlink(localPath, () => {
      });
      reject(err);
    });
  });
}
function isParserInstalled(wasmFile) {
  const localPath = path16.join(PARSER_DIR, wasmFile);
  return fs17.existsSync(localPath);
}
async function deleteParser(wasmFile) {
  const localPath = path16.join(PARSER_DIR, wasmFile);
  if (fs17.existsSync(localPath)) {
    await fs17.unlink(localPath);
  }
}
var EXTENSION_TO_WASM;
var init_parsers = __esm({
  "src/utils/parsers.js"() {
    init_paths();
    EXTENSION_TO_WASM = {
      "js": "tree-sitter-javascript.wasm",
      "jsx": "tree-sitter-javascript.wasm",
      "ts": "tree-sitter-typescript.wasm",
      "tsx": "tree-sitter-tsx.wasm",
      "py": "tree-sitter-python.wasm",
      "c": "tree-sitter-c.wasm",
      "cpp": "tree-sitter-cpp.wasm",
      "java": "tree-sitter-java.wasm",
      "html": "tree-sitter-html.wasm"
    };
  }
});

// src/tools/file_map.js
import fs18 from "fs-extra";
import path17 from "path";
import { createRequire } from "module";
function sanitize(text, limit = 50) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? clean.substring(0, limit - 3) + "..." : clean;
}
function getDisplayName(node) {
  const type = node.type;
  if (type === "if_statement") {
    const cond = node.childForFieldName("condition");
    return cond ? `if (${sanitize(cond.text, 40)})` : "if";
  }
  if (type === "else_clause") return "else";
  if (type === "while_statement" || type === "do_statement") {
    const cond = node.childForFieldName("condition");
    return `${type.split("_")[0]} (${cond ? sanitize(cond.text, 40) : ""})`;
  }
  if (type === "for_statement" || type === "for_in_statement" || type === "for_of_statement") {
    const text = node.text.split("\n")[0];
    const match = text.match(/for\s*(?:await\s*)?\((.*)\)/);
    if (match) return `for (${sanitize(match[1], 40)})`;
    return "for";
  }
  if (type === "switch_statement") {
    const val = node.childForFieldName("value");
    return `switch (${val ? sanitize(val.text, 40) : ""})`;
  }
  if (type === "try_statement") return "try";
  if (type === "catch_clause") return "catch";
  if (type === "element" || type === "script_element" || type === "style_element" || type === "jsx_element" || type === "jsx_self_closing_element") {
    const opening = node.childForFieldName("opening_element") || node.childForFieldName("start_tag") || node.children.find((c) => c.type === "start_tag") || node;
    const tagName = opening.childForFieldName("name") || opening.childForFieldName("tag_name") || opening.children.find((c) => c.type === "tag_name");
    return tagName ? `<${sanitize(tagName.text, 30)}>` : null;
  }
  if (["import_declaration", "import_from_statement", "import_statement", "preproc_include"].includes(type)) {
    return sanitize(node.text.split("\n")[0], 60);
  }
  if (type === "pair") {
    const key = node.childForFieldName("key");
    return key ? sanitize(key.text.replace(/["']/g, ""), 40) : null;
  }
  if (type === "assignment_expression") {
    const left = node.childForFieldName("left");
    return left ? `${sanitize(left.text, 30)} = ...` : null;
  }
  if (type === "variable_declarator") {
    const id = node.childForFieldName("name") || node.children.find((c) => ["identifier", "object_pattern", "array_pattern"].includes(c.type));
    return id ? sanitize(id.text, 40) : null;
  }
  const nameNode = node.childForFieldName("name") || node.childForFieldName("declarator") || node.children.find((c) => ["identifier", "type_identifier", "field_identifier", "property_identifier", "shorthand_property_identifier"].includes(c.type));
  if (nameNode) {
    if (nameNode.type.includes("declarator")) {
      const id = nameNode.descendantsOfType("identifier")[0] || nameNode.descendantsOfType("field_identifier")[0];
      if (id) return sanitize(id.text, 40);
    }
    return sanitize(nameNode.text, 40);
  }
  if (["arrow_function", "function_expression", "function_declaration"].includes(type)) {
    let p = node.parent;
    while (p && p.type !== "program") {
      const pName = getDisplayName(p);
      if (pName) return pName;
      if (!PASSTHROUGH_TYPES.has(p.type)) break;
      p = p.parent;
    }
  }
  return null;
}
function getNextInterestingNodes(node) {
  const nodes = [];
  function walk(n) {
    for (const child of n.children) {
      if (INTERESTING_TYPES.has(child.type)) {
        nodes.push(child);
      } else {
        walk(child);
      }
    }
  }
  walk(node);
  return nodes;
}
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}
function traverse(node, depth = 0, isLast = true, prefix = "", parentName = null, maxDepth = 12) {
  const type = node.type;
  const name = getDisplayName(node);
  const isInteresting = INTERESTING_TYPES.has(type) || depth === 0;
  const children = getNextInterestingNodes(node);
  const isPassthrough = isInteresting && depth > 0 && (PASSTHROUGH_TYPES.has(type) && children.length > 0 || name !== null && name === parentName && children.length > 0);
  let result = "";
  let nextPrefix = prefix;
  let nextDepth = depth;
  let nextParentName = parentName;
  if (isInteresting && !isPassthrough) {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const camelType = toCamelCase(type);
    const label2 = name ? `${camelType} [${name}]` : camelType;
    if (depth === 0) {
      result += `\u{1F4C1} ROOT (Lines: ${startLine}-${endLine})
`;
      nextPrefix = prefix;
    } else {
      result += `${prefix}${isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}${label2} (Lines: ${startLine}-${endLine})
`;
      nextPrefix += isLast ? "    " : "\u2502   ";
    }
    nextDepth = depth + 1;
    nextParentName = name;
  }
  if (nextDepth > maxDepth && children.length > 0) {
    result += `${nextPrefix}\u2514\u2500\u2500 ... depth exceeded ...
`;
  } else {
    children.forEach((child, index) => {
      const isLastChildInLoop = index === children.length - 1;
      const effectiveIsLast = isPassthrough ? isLast && isLastChildInLoop : isLastChildInLoop;
      result += traverse(child, nextDepth, effectiveIsLast, nextPrefix, nextParentName, maxDepth);
    });
  }
  return result;
}
var require2, TreeSitter, isParserInitialized, INTERESTING_TYPES, PASSTHROUGH_TYPES, file_map;
var init_file_map = __esm({
  "src/tools/file_map.js"() {
    init_parsers();
    init_paths();
    init_arg_parser();
    require2 = createRequire(import.meta.url);
    TreeSitter = require2("web-tree-sitter");
    isParserInitialized = false;
    INTERESTING_TYPES = /* @__PURE__ */ new Set([
      "class_declaration",
      "function_declaration",
      "method_definition",
      "arrow_function",
      "function_expression",
      "if_statement",
      "else_clause",
      "for_statement",
      "for_in_statement",
      "for_of_statement",
      "while_statement",
      "do_statement",
      "switch_statement",
      "try_statement",
      "catch_clause",
      "variable_declarator",
      "export_statement",
      "lexical_declaration",
      "variable_declaration",
      "interface_declaration",
      "type_alias_declaration",
      "enum_declaration",
      "import_declaration",
      "jsx_element",
      "jsx_self_closing_element",
      "class_definition",
      "function_definition",
      "decorated_definition",
      "import_from_statement",
      "import_statement",
      "preproc_include",
      "method_declaration",
      "constructor_declaration",
      "assignment_expression",
      "pair",
      // C/C++
      "class_specifier",
      "struct_specifier",
      "enum_specifier",
      "field_declaration",
      // HTML
      "element",
      "script_element",
      "style_element"
    ]);
    PASSTHROUGH_TYPES = /* @__PURE__ */ new Set(["export_statement", "lexical_declaration", "variable_declaration", "variable_declarator", "pair", "assignment_expression"]);
    file_map = async (args) => {
      let filePath;
      try {
        const parsed = parseArgs(args);
        filePath = parsed.path;
      } catch (e) {
        return `ERROR: Failed to parse arguments: ${args}`;
      }
      if (!filePath) {
        return 'ERROR: No file path provided. Use [tool:functions.FileMap(path="...")]';
      }
      const absolutePath = path17.isAbsolute(filePath) ? filePath : path17.resolve(process.cwd(), filePath);
      if (!fs18.existsSync(absolutePath)) {
        return `ERROR: File not found: ${filePath}`;
      }
      const ext = path17.extname(absolutePath).slice(1).toLowerCase();
      const wasmFile = EXTENSION_TO_WASM[ext];
      if (!wasmFile) {
        return `ERROR: Unsupported file extension: .${ext}`;
      }
      const wasmPath = path17.resolve(PARSER_DIR, wasmFile);
      if (!fs18.existsSync(wasmPath)) {
        return `ERROR: Parser for .${ext} not found. Please download it in Settings > Other.`;
      }
      try {
        const Parser = TreeSitter.Parser;
        if (!isParserInitialized) {
          let tsWasmPath;
          try {
            tsWasmPath = path17.join(path17.dirname(require2.resolve("web-tree-sitter")), "tree-sitter.wasm");
          } catch (e) {
            tsWasmPath = path17.join(process.cwd(), "node_modules", "web-tree-sitter", "tree-sitter.wasm");
          }
          await Parser.init({
            locateFile: (p) => {
              if (p === "tree-sitter.wasm" || p.endsWith("tree-sitter.wasm")) {
                return tsWasmPath;
              }
              return p;
            }
          });
          isParserInitialized = true;
        }
        const parser = new Parser();
        const Lang = await TreeSitter.Language.load(wasmPath);
        parser.setLanguage(Lang);
        const sourceCode = await fs18.readFile(absolutePath, "utf8");
        const lines = sourceCode.split("\n").length;
        let maxDepth = 12;
        if (lines > 1e4) maxDepth = 2;
        else if (lines >= 8e3) maxDepth = 3;
        else if (lines >= 5e3) maxDepth = 5;
        else if (lines >= 4e3) maxDepth = 8;
        else if (lines > 2e3) maxDepth = 10;
        const tree = parser.parse(sourceCode);
        const map = traverse(tree.rootNode, 0, true, " ", null, maxDepth);
        return `\u{1F4C4} File Map for: ${filePath}
${map}`;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err);
        const stack = err instanceof Error ? `
Stack: ${err.stack}` : "";
        return `ERROR: Failed to map file: ${errMsg}${stack}`;
      }
    };
  }
});

// src/tools/todo.js
import fs19 from "fs";
import path18 from "path";
var todo;
var init_todo = __esm({
  "src/tools/todo.js"() {
    init_arg_parser();
    init_paths();
    init_revert();
    todo = async (args, context = {}) => {
      const { method, tasks, markDone } = parseArgs(args);
      const chatId = context.chatId || "default";
      if (!method) return 'ERROR: Missing "method" argument for todo tool (create/append/get).';
      const todoDir = path18.join(DATA_DIR, "plan", chatId);
      const todoFile = path18.join(todoDir, "todo.md");
      const parseMessyArray = (input) => {
        if (!input || Array.isArray(input)) return input;
        const trimmed = String(input).trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          const matches = trimmed.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g);
          if (matches) {
            return matches.map((m) => m.slice(1, -1).replace(/\\(.)/g, "$1"));
          }
          return trimmed.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
        }
        return input;
      };
      const getTasksString = (input) => {
        const rawItems = parseMessyArray(input);
        if (!rawItems) return "";
        const items = Array.isArray(rawItems) ? rawItems : String(rawItems).split("\n");
        return items.map((item) => {
          const trimmed = String(item).trim();
          if (!trimmed) return null;
          if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) return trimmed;
          return `- [ ] ${trimmed}`;
        }).filter(Boolean).join("\n") + "\n";
      };
      const applyMarkDone = (content, markDone2) => {
        if (!markDone2) return { content, markedCount: 0 };
        const rawTargets = parseMessyArray(markDone2);
        const targets = (Array.isArray(rawTargets) ? rawTargets : [rawTargets]).map((t) => String(t).replace(/^- \[[xX ]\]\s*/i, "").trim()).filter(Boolean);
        const lines = content.split("\n");
        let markedCount = 0;
        let fileUpdated = false;
        for (const searchStr of targets) {
          let updatedThisTarget = false;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchStr) && /^- \[\s\]/.test(lines[i].trim())) {
              lines[i] = lines[i].replace("- [ ]", "- [x]");
              updatedThisTarget = true;
              fileUpdated = true;
              markedCount++;
              break;
            }
          }
          if (!updatedThisTarget) {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(searchStr.toLowerCase()) && /^- \[\s\]/.test(lines[i].trim())) {
                lines[i] = lines[i].replace("- [ ]", "- [x]");
                updatedThisTarget = true;
                fileUpdated = true;
                markedCount++;
                break;
              }
            }
          }
        }
        return {
          content: fileUpdated ? lines.join("\n") : content,
          markedCount
        };
      };
      try {
        if (!fs19.existsSync(todoDir)) {
          fs19.mkdirSync(todoDir, { recursive: true });
        }
        if (method === "create") {
          if (!tasks) return 'ERROR: Missing "tasks" for create method.';
          let content = getTasksString(tasks);
          let markedCount = 0;
          if (markDone) {
            const result = applyMarkDone(content, markDone);
            content = result.content;
            markedCount = result.markedCount;
          }
          await RevertManager.recordFileChange(todoFile);
          fs19.writeFileSync(todoFile, content, "utf8");
          const total = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- [ ]") || l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          if (markedCount > 0) {
            const completed = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- [x]") || l.startsWith("- [X]")).length;
            return `SUCCESS: TASK LIST CREATED (${markedCount} marked done, ${completed} completed, ${total - completed} left)
${content}`;
          }
          return `SUCCESS: TASK LIST CREATED (${total} total)
${content}`;
        }
        if (method === "append") {
          if (!tasks) return 'ERROR: Missing "tasks" for append method.';
          const appendContent = getTasksString(tasks);
          await RevertManager.recordFileChange(todoFile);
          fs19.appendFileSync(todoFile, appendContent, "utf8");
          const fullContent = fs19.readFileSync(todoFile, "utf8");
          const lines = fullContent.split(/\r?\n/).map((l) => l.trim());
          const total = lines.filter((l) => l.startsWith("- [ ]") || l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          const completed = lines.filter((l) => l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          const added = appendContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- [ ]") || l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          return `SUCCESS: TASK APPENDED (${completed} completed, ${total - completed} left, ${added} added)
${fullContent}`;
        }
        if (method === "get") {
          if (!fs19.existsSync(todoFile)) {
            return "TODO GET: No task list found for this session.";
          }
          let content = fs19.readFileSync(todoFile, "utf8");
          let markedCount = 0;
          if (markDone) {
            const result = applyMarkDone(content, markDone);
            if (result.markedCount > 0) {
              content = result.content;
              markedCount = result.markedCount;
              await RevertManager.recordFileChange(todoFile);
              fs19.writeFileSync(todoFile, content, "utf8");
            }
          }
          const totalLines = content.split(/\r?\n/).map((l) => l.trim());
          const total = totalLines.filter((l) => l.startsWith("- [ ]") || l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          const completed = totalLines.filter((l) => l.startsWith("- [x]") || l.startsWith("- [X]")).length;
          const prefix = markedCount > 0 ? `SUCCESS: ${markedCount} TASK(S) MARKED DONE` : `TODO GET`;
          return `${prefix}: ${completed} Completed, ${total - completed} left
${content}`;
        }
        return `ERROR: Unknown method "${method}". Use create, append, or get.`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Todo tool failure: ${errorMsg}`;
      }
    };
  }
});

// src/tools/invokeSync.js
var invokeSync;
var init_invokeSync = __esm({
  "src/tools/invokeSync.js"() {
    init_arg_parser();
    invokeSync = async (args, context = {}) => {
      const { runSubagent: runSubagent2 } = await init_ai().then(() => ai_exports);
      const parsed = parseArgs(args);
      const task = parsed.task || parsed.instruction || parsed.prompt;
      const model = parsed.model || null;
      const toolsRaw = parsed.tools || null;
      if (!task) {
        return 'ERROR: Missing "task" argument for invokeSync.';
      }
      let allowedTools = null;
      if (toolsRaw) {
        try {
          let cleaned = toolsRaw.trim();
          if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
          }
          allowedTools = cleaned.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        } catch (e) {
        }
      }
      const title = parsed.title || task.substring(0, 30);
      try {
        if (context.onVisualFeedback) {
          context.onVisualFeedback(`\x1B[95mSubAgent\x1B[0m: \x1B[32mGeneralist\x1B[0m \u2192 ${title}`);
        }
        const result = await runSubagent2(task, context, model, allowedTools, 20);
        if (context.onVisualFeedback) {
          context.onVisualFeedback(`\x1B[95mSubAgent\x1B[0m: \x1B[32mGeneralist\x1B[0m \u2192 ${title} [COMPLETED]
`);
        }
        return result;
      } catch (err) {
        if (context.onVisualFeedback) {
          context.onVisualFeedback(`\x1B[95mSubAgent\x1B[0m: \x1B[32mGeneralist\x1B[0m \u2192 ${title} [FAILED]
`);
        }
        return `ERROR: Subagent execution failed: ${err.message}`;
      }
    };
  }
});

// src/utils/subagent_state.js
var subagentProgress;
var init_subagent_state = __esm({
  "src/utils/subagent_state.js"() {
    subagentProgress = [];
  }
});

// src/tools/invoke.js
var invoke;
var init_invoke = __esm({
  "src/tools/invoke.js"() {
    init_subagent_state();
    init_arg_parser();
    invoke = async (args, context = {}) => {
      const { runSubagent: runSubagent2 } = await init_ai().then(() => ai_exports);
      const parsed = parseArgs(args);
      const task = parsed.task || parsed.instruction || parsed.prompt;
      const model = parsed.model || null;
      const title = parsed.title || null;
      const toolsRaw = parsed.tools || null;
      if (!task) {
        return 'ERROR: Missing "task" argument for invoke.';
      }
      let allowedTools = null;
      if (toolsRaw) {
        try {
          let cleaned = toolsRaw.trim();
          if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
          }
          allowedTools = cleaned.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        } catch (e) {
        }
      }
      const taskId = `subagent-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
      const taskEntry = {
        id: taskId,
        title: title || task.substring(0, 30),
        task,
        status: "running",
        progress: []
        // Array of arrays containing logs for each turn
      };
      subagentProgress.push(taskEntry);
      if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
      }
      let currentTurnLogs = [];
      const subagentContext = { ...context, onVisualFeedback: null };
      runSubagent2(task, subagentContext, model, allowedTools, 20, (logMessage) => {
        if (logMessage.startsWith("[Subagent Turn")) {
          if (currentTurnLogs.length > 0) {
            taskEntry.progress.push([...currentTurnLogs]);
            currentTurnLogs = [];
          }
        }
        if (logMessage.includes("[Executing Tool]")) {
          const m = logMessage.match(/\[Executing Tool\]\s*([a-zA-Z0-9_]+)/);
          if (m) {
            taskEntry.currentTool = m[1];
          }
        }
        let displayLog = logMessage;
        if (displayLog.startsWith("[Tool Result]")) {
          const lines = displayLog.split("\n");
          if (lines.length > 5) {
            displayLog = lines.slice(0, 4).join("\n") + "\n... [Content/Diff Truncated from Logs] ...";
          }
        }
        currentTurnLogs.push(displayLog);
        if (context.onSubagentUpdate) {
          context.onSubagentUpdate();
        }
      }).then((finalAnswer) => {
        currentTurnLogs.push(`[SUBAGENT SUCCESS] Final Answer:
${finalAnswer}`);
        taskEntry.progress.push([...currentTurnLogs]);
        taskEntry.status = "completed";
        taskEntry.finalAnswer = finalAnswer;
        if (context.onSubagentUpdate) {
          context.onSubagentUpdate();
        }
      }).catch((err) => {
        currentTurnLogs.push(`[SUBAGENT FAILURE] Error: ${err.message}`);
        taskEntry.progress.push([...currentTurnLogs]);
        taskEntry.status = "failed";
        taskEntry.error = err.message;
        if (context.onSubagentUpdate) {
          context.onSubagentUpdate();
        }
      });
      return `SUCCESS: Background subagent started. Task ID: ${taskId}`;
    };
  }
});

// src/tools/getProgress.js
var getProgress;
var init_getProgress = __esm({
  "src/tools/getProgress.js"() {
    init_subagent_state();
    init_arg_parser();
    getProgress = async (args, context = {}) => {
      const parsed = parseArgs(args);
      const id = parsed.id;
      if (!id) {
        return 'ERROR: Missing "id" argument for getProgress.';
      }
      const task = subagentProgress.find((t) => t.id === id);
      if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
      }
      let output = `Subagent Task Status: ${task.status.toUpperCase()}
`;
      output += `Title: ${task.title}
`;
      output += `Task: ${task.task}

`;
      output += `Progress Log:
`;
      task.progress.forEach((turnLogs, index) => {
        output += `--- Turn ${index + 1} ---
`;
        output += turnLogs.join("\n") + "\n\n";
      });
      if (task.status === "completed" && task.finalAnswer) {
        output += `Final Answer:
${task.finalAnswer}
`;
      } else if (task.status === "failed" && task.error) {
        output += `Failure Error: ${task.error}
`;
      }
      return output.trim();
    };
  }
});

// src/tools/await.js
var awaitTool;
var init_await = __esm({
  "src/tools/await.js"() {
    init_arg_parser();
    awaitTool = async (args, context = {}) => {
      const parsed = parseArgs(args);
      const timeStr = parsed.time;
      if (!timeStr) {
        return 'ERROR: Missing "time" argument for await.';
      }
      let seconds = parseFloat(timeStr);
      if (isNaN(seconds)) {
        return `ERROR: Invalid time value "${timeStr}". Must be a number.`;
      }
      if (seconds < 10) {
        seconds = 10;
      } else if (seconds > 180) {
        seconds = 180;
      }
      const formatTime = (s) => {
        if (s >= 60) {
          const m = Math.floor(s / 60);
          const rem = s % 60;
          return `${m}m${rem > 0 ? ` ${rem}s` : ""}`;
        }
        return `${s}s`;
      };
      const formatted = formatTime(seconds);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
      return `SUCCESS: Waited for ${formatted}${seconds > 180 ? " (Max: 180s)" : ""}${seconds < 10 ? " (Min: 10s)" : ""}.`;
    };
  }
});

// src/utils/tools.js
var TOOL_MAP, dispatchTool;
var init_tools = __esm({
  async "src/utils/tools.js"() {
    init_web_search();
    init_web_scrape();
    init_memory();
    init_chat();
    init_view_file();
    init_write_file();
    init_update_file();
    await init_exec_command();
    init_read_folder();
    init_ask_user();
    init_write_pdf();
    init_write_docx();
    init_search_keyword();
    init_generate_image();
    init_saveSummary();
    init_addMemScore();
    init_file_map();
    init_todo();
    init_invokeSync();
    init_invoke();
    init_getProgress();
    init_await();
    TOOL_MAP = {
      web_search,
      web_scrape,
      memory,
      chat,
      view_file,
      write_file,
      update_file,
      exec_command,
      read_folder,
      write_pdf,
      write_docx,
      search_keyword,
      generate_image,
      saveSummary,
      addMemScore,
      file_map,
      todo,
      invokeSync,
      invoke,
      getProgress,
      invoke_sync: invokeSync,
      get_progress: getProgress,
      ask: ask_user,
      // PascalCase Normalizations for Token Efficiency
      Ask: ask_user,
      WebSearch: web_search,
      WebScrape: web_scrape,
      ReadFile: view_file,
      ReadFolder: read_folder,
      WriteFile: write_file,
      PatchFile: update_file,
      WritePDF: write_pdf,
      WriteDoc: write_docx,
      Run: exec_command,
      SearchKeyword: search_keyword,
      Memory: memory,
      Chat: chat,
      GenerateImage: generate_image,
      saveSumary: saveSummary,
      SaveSummary: saveSummary,
      SaveSumary: saveSummary,
      add_mem_score: addMemScore,
      AddMemScore: addMemScore,
      addMemoryScore: addMemScore,
      AddMemoryScore: addMemScore,
      FileMap: file_map,
      Todo: todo,
      TODO: todo,
      InvokeSync: invokeSync,
      Invoke: invoke,
      GetProgress: getProgress,
      await: awaitTool,
      Await: awaitTool
    };
    dispatchTool = async (toolName, args, context = {}) => {
      const mode = context.mode ? context.mode.toLowerCase() : "flux";
      const normalized = toolName.toLowerCase();
      const systemTools = ["memory", "chat", "savesummary", "addmemscore", "add_mem_score", "ask", "web_search", "web_scrape", "await"];
      const isSystem = systemTools.some((t) => normalized.includes(t)) || normalized === "ask";
      if (!isSystem) {
        if (mode === "flow") {
          const isCreative = normalized.includes("write_pdf") || normalized.includes("write_docx") || normalized.includes("generate_image");
          if (!isCreative) {
            return `ERROR: Tool [${toolName}] is a Workspace Tool and NOT available in Flow mode. Tell user to switch (\`/mode flux\`) to use this tool.`;
          }
        } else {
          const isCreative = normalized.includes("write_pdf") || normalized.includes("write_docx") || normalized.includes("generate_image");
          if (isCreative) {
            return `ERROR: Tool [${toolName}] is not available in Flux mode. Tell user to switch (\`/mode flow\`) for document generation.`;
          }
        }
      }
      const tool = TOOL_MAP[toolName];
      if (!tool) {
        return `ERROR: Tool [${toolName}] not found in registry.`;
      }
      try {
        return await tool(args, context);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Execution failed for [${toolName}]: ${errorMsg}`;
      }
    };
  }
});

// src/utils/editor.js
import { WebSocket } from "ws";
var ws, isConnecting, BRIDGE_URL, messageQueue, contextResolver, securityListener, cliVersion, initBridge, registerSecurityListener, connect, send, isBridgeConnected, sendStatus, getIDEContext, openFileInEditor, showDiffInIDE, closeDiffInIDE;
var init_editor = __esm({
  "src/utils/editor.js"() {
    ws = null;
    isConnecting = false;
    BRIDGE_URL = "ws://localhost:56832";
    messageQueue = [];
    contextResolver = null;
    securityListener = null;
    cliVersion = "2.0.0";
    initBridge = (version) => {
      cliVersion = version;
      connect();
    };
    registerSecurityListener = (callback) => {
      securityListener = callback;
    };
    connect = () => {
      if (ws || isConnecting) return;
      isConnecting = true;
      const socket = new WebSocket(BRIDGE_URL);
      socket.on("open", () => {
        ws = socket;
        isConnecting = false;
        ws.send(JSON.stringify({
          command: "version",
          version: cliVersion,
          pid: process.pid,
          ppid: process.ppid
        }));
        while (messageQueue.length > 0) {
          ws.send(JSON.stringify(messageQueue.shift()));
        }
      });
      socket.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.command === "contextResponse" && contextResolver) {
            contextResolver(msg.data);
            contextResolver = null;
          } else if (msg.command === "securityResponse" && securityListener) {
            securityListener(msg.result);
          }
        } catch (e) {
        }
      });
      socket.on("error", () => {
        isConnecting = false;
        ws = null;
      });
      socket.on("close", () => {
        isConnecting = false;
        ws = null;
      });
    };
    send = (payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      } else {
        messageQueue.push(payload);
        if (!isConnecting) connect();
      }
    };
    isBridgeConnected = () => {
      return ws !== null && ws.readyState === WebSocket.OPEN;
    };
    sendStatus = (status) => {
      send({
        command: "status",
        status
      });
    };
    getIDEContext = () => {
      return new Promise((resolve) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ cursor_line: 0, selected: 0, manual_edits: "", file_focused: "none", opened_editors: [] });
          return;
        }
        contextResolver = resolve;
        ws.send(JSON.stringify({ command: "requestContext" }));
        setTimeout(() => {
          if (contextResolver === resolve) {
            resolve({ cursor_line: 0, selected: 0, manual_edits: "", file_focused: "none", opened_editors: [] });
            contextResolver = null;
          }
        }, 1e3);
      });
    };
    openFileInEditor = (filePath) => {
      send({ command: "open", filePath });
    };
    showDiffInIDE = (filePath, originalContent, modifiedContent) => {
      send({ command: "showDiff", filePath, originalContent, modifiedContent });
    };
    closeDiffInIDE = (filePath, result) => {
      send({ command: "closeDiff", filePath, result });
    };
  }
});

// src/utils/ai.js
var ai_exports = {};
__export(ai_exports, {
  compressHistory: () => compressHistory,
  deleteChatSummary: () => deleteChatSummary,
  getAIStream: () => getAIStream,
  getCleanGroupedLength: () => getCleanGroupedLength,
  initAI: () => initAI,
  isModelMultimodal: () => isModelMultimodal,
  runJanitorTask: () => runJanitorTask,
  runSubagent: () => runSubagent,
  signalTermination: () => signalTermination
});
import { GoogleGenAI, ThinkingLevel, HarmBlockThreshold, HarmCategory } from "@google/genai";
import path19 from "path";
import fs20 from "fs";
var client, globalSettings, colorMainWords, withRetry, TERMINATION_SIGNAL, MULTIMODAL_MODELS, isModelMultimodal, getCleanGroupedLength, stripAnsi2, fetchWithBackoff, getDeepSeekStream, getNVIDIAStream, getOpenRouterStream, signalTermination, TOOL_LABELS2, getToolDetail, runJanitorTask, getActiveToolContext, getContextSafeText, contextSafeReplace, getSanitizedText, translateKimiToolCalls, detectToolCalls, initAI, generateSimpleContent, consolidatePastMemories, compressHistory, deleteChatSummary, getAIStream, runSubagent;
var init_ai = __esm({
  async "src/utils/ai.js"() {
    await init_prompts();
    init_history();
    init_usage();
    await init_tools();
    init_crypto();
    init_arg_parser();
    init_view_file();
    init_terminal();
    init_text();
    init_settings();
    init_paths();
    init_revert();
    init_editor();
    client = null;
    globalSettings = {};
    colorMainWords = (label2) => {
      if (!label2) return label2;
      return label2.replace(/(?:(\x1b\[\d+m))?([✔✗✖🔍📖→➕↻•])(?:(\x1b\[\d+m))?\s*\b(Created|Read|Edited|Viewed|Auto-Read|List|Generated|Written|Searched|Get Map|Write Canceled|Edit Canceled|Write Cancelled|Edit Denied|Visited|Updated|Reviewed|Delegated|Background|Checked|Elevating SubAgent|Checking SubAgent Work|Awaiting)\b/ig, (match, ansiBefore, icon, ansiAfter, word) => {
        return `${ansiBefore || ""}${icon}${ansiAfter || ""} \x1B[95m${word}\x1B[0m`;
      });
    };
    withRetry = async (fn, maxRetries = 8, initialDelayMs = 1e3, maxDelayMs = 8e3, signal = null) => {
      let attempt = 0;
      while (true) {
        if (signal?.aborted) {
          throw new DOMException("The user aborted a request.", "AbortError");
        }
        try {
          return await fn();
        } catch (error) {
          if (signal?.aborted || error?.name === "AbortError") {
            throw error;
          }
          attempt++;
          if (attempt >= maxRetries) {
            throw error;
          }
          const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            if (signal) {
              signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(new DOMException("The user aborted a request.", "AbortError"));
              });
            }
          });
        }
      }
    };
    TERMINATION_SIGNAL = false;
    MULTIMODAL_MODELS = [
      // OpenRouter models
      "google/gemma-4-31b-it:free",
      "moonshotai/kimi-k2.6:free",
      "google/gemini-3.5-flash",
      "qwen/qwen3.7-plus",
      "minimax/minimax-m3",
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-opus-4.6",
      "anthropic/claude-opus-4.8",
      "openai/gpt-5.2-codex",
      "openai/gpt-5.2-pro",
      "openai/gpt-5.5-pro",
      "moonshotai/kimi-k2.6",
      // NVIDIA vision models
      "moonshotai/kimi-k2.6",
      "stepfun-ai/step-3.7-flash",
      "google/gemma-4-31b-it",
      "mistralai/mistral-medium-3.5-128b",
      "qwen/qwen3.5-397b-a17b"
      // Google models
      // No need. All models on Gemini API is Multimodal
    ];
    isModelMultimodal = (model) => {
      if (!model) return false;
      const lower = model.toLowerCase();
      if (lower.startsWith("gemini-") || lower.startsWith("gemma-")) return true;
      return MULTIMODAL_MODELS.some((m) => m.toLowerCase() === lower);
    };
    getCleanGroupedLength = (rawHistory) => {
      const cleanHistory = [];
      rawHistory.forEach((m) => {
        const isCleanMsg = (m.role === "user" || m.role === "agent" || m.role === "system") && m.role !== "think" && !m.isVisualFeedback && !m.isMeta && !String(m.id).startsWith("welcome");
        if (!isCleanMsg) return;
        let text = m.fullText || m.text || "";
        if (m.role === "system" && text?.startsWith("[TOOL RESULT]")) {
          const prev = cleanHistory[cleanHistory.length - 1];
          if (prev && prev.role === "system" && prev.text?.startsWith("[TOOL RESULT]")) {
            prev.text += "\n\n" + text;
            return;
          }
        }
        cleanHistory.push({ ...m, text });
      });
      return cleanHistory.length;
    };
    stripAnsi2 = (str) => {
      if (typeof str !== "string") return str;
      return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
    };
    fetchWithBackoff = async (url, options, retries = 5, delay = 1e3) => {
      const signal = options?.signal;
      for (let i = 0; i < retries; i++) {
        if (signal?.aborted) {
          throw new DOMException("The user aborted a request.", "AbortError");
        }
        try {
          const response = await fetch(url, options);
          if (response.ok) return response;
          if (response.status !== 429 && response.status < 500) return response;
        } catch (e) {
          if (e.name === "AbortError" || signal?.aborted) throw e;
          if (i === retries - 1) throw e;
        }
        if (signal) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", abortHandler);
              resolve();
            }, Math.min(24e3, delay * Math.pow(2, i)));
            const abortHandler = () => {
              clearTimeout(timer);
              reject(new DOMException("The user aborted a request.", "AbortError"));
            };
            signal.addEventListener("abort", abortHandler);
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, Math.min(24e3, delay * Math.pow(2, i))));
        }
      }
      if (signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
      return fetch(url, options);
    };
    getDeepSeekStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 0.99) {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      for (const content of contents) {
        const role = content.role === "user" ? "user" : "assistant";
        const msgContent = [];
        if (Array.isArray(content.parts)) {
          for (const part of content.parts) {
            if (part.text) {
              msgContent.push({ type: "text", text: part.text });
            } else if (part.inlineData && isMultiModal) {
              const mimeType = part.inlineData.mimeType;
              const data = part.inlineData.data;
              const isImage = mimeType.startsWith("image/");
              if (isImage) {
                msgContent.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${data}`
                  }
                });
              }
            }
          }
        } else {
          const text = content.text || "";
          if (text) msgContent.push({ type: "text", text });
        }
        messages.push({
          role,
          content: msgContent.length === 1 && msgContent[0].type === "text" ? msgContent[0].text : msgContent
        });
      }
      const requestPayload = {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature
      };
      if (thinkingLevel !== "Fast") {
        const reasoningEffortMap = {
          "Low": "high",
          "Medium": "high",
          "Standard": "high",
          "High": "max",
          "xHigh": "max"
        };
        requestPayload.reasoning_effort = reasoningEffortMap[thinkingLevel] || "high";
        requestPayload.extra_body = { thinking: { type: "enabled" } };
      } else {
        requestPayload.extra_body = { thinking: { type: "disabled" } };
      }
      const response = await fetchWithBackoff("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload),
        signal
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek Error (${response.status}): ${errData.error?.message || response.statusText}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingParts = [];
      let latestUsageMetadata = null;
      let lastFlushTime = Date.now();
      let hasNewData = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (hasNewData && (pendingParts.length > 0 || latestUsageMetadata)) {
            yield {
              candidates: pendingParts.length > 0 ? [{ content: { parts: pendingParts } }] : [],
              usageMetadata: latestUsageMetadata
            };
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || !cleanLine.startsWith("data: ")) continue;
          if (cleanLine === "data: [DONE]") break;
          try {
            const json = JSON.parse(cleanLine.substring(6));
            const delta = json.choices?.[0]?.delta;
            const usage = json.usage;
            if (usage) {
              latestUsageMetadata = {
                totalTokenCount: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
                promptTokenCount: usage.prompt_tokens || 0,
                candidatesTokenCount: usage.completion_tokens || 0,
                cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
                thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || 0
              };
              hasNewData = true;
            }
            if (delta) {
              const thought = delta.reasoning_content || null;
              if (thought) {
                pendingParts.push({ text: thought, thought: true });
                hasNewData = true;
              }
              if (delta.content) {
                pendingParts.push({ text: delta.content });
                hasNewData = true;
              }
            }
          } catch (e) {
          }
        }
        if (Date.now() - lastFlushTime >= 150 && hasNewData) {
          yield {
            candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
            usageMetadata: latestUsageMetadata
          };
          pendingParts = [];
          lastFlushTime = Date.now();
          hasNewData = false;
        }
      }
    };
    getNVIDIAStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal = false, signal, temperature = 0.99) {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      contents.forEach((item) => {
        const role = item.role === "model" ? "assistant" : "user";
        const msgContent = [];
        if (Array.isArray(item.parts)) {
          item.parts.forEach((part) => {
            if (part.text) {
              msgContent.push({ type: "text", text: part.text });
            } else if (part.inlineData && isMultiModal) {
              const mimeType = part.inlineData.mimeType;
              const data = part.inlineData.data;
              const isImage = mimeType.startsWith("image/");
              if (isImage && MULTIMODAL_MODELS.includes(model)) {
                msgContent.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${data}`
                  }
                });
              }
            }
          });
        }
        messages.push({
          role,
          content: msgContent.length === 1 && msgContent[0].type === "text" ? msgContent[0].text : msgContent
        });
      });
      const thinkingLevelMap = {
        "Fast": "Fast",
        "Low": "Fast",
        "Medium": "Standard",
        "Standard": "Standard",
        "High": "High",
        "xHigh": "High"
      };
      const apiLevel = thinkingLevelMap[thinkingLevel] || "High";
      const isThinking = apiLevel !== "Fast";
      const isKimi = model.includes("kimi");
      const isGemma = model.includes("gemma");
      const isDeepSeek = model.includes("deepseek");
      const isGlm = model.includes("glm");
      const isMistral = model.includes("mistral");
      const isMinimax = model.includes("minimax");
      const isGPT = model.includes("gpt");
      const isQwen = model.includes("qwen");
      const isNemotron = model.includes("nemotron");
      const GPT_THINKING_LEVELS = {
        "Fast": "low",
        "Low": "low",
        "Medium": "medium",
        "Standard": "medium",
        "High": "high",
        "xHigh": "high"
      };
      const maxTokens = isMinimax || isDeepSeek ? 16384 : 32768;
      const body = {
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        temperature,
        ...isGPT && { thinking: GPT_THINKING_LEVELS[thinkingLevel] || "high" }
      };
      if (isKimi) {
        body.chat_template_kwargs = { thinking: isThinking };
      } else if (isGemma) {
        body.chat_template_kwargs = { enable_thinking: isThinking };
      } else if (isDeepSeek) {
        if (isThinking) {
          const effort = apiLevel === "High" ? "max" : "high";
          body.chat_template_kwargs = { thinking: true, reasoning_effort: effort };
        } else {
          body.chat_template_kwargs = { thinking: false };
        }
      } else if (isGlm) {
        body.chat_template_kwargs = { enable_thinking: isThinking, clear_thinking: !isThinking };
      } else if (isMistral) {
        body.reasoning_effort = isThinking ? "high" : "none";
      } else if (isMinimax && model.includes("minimax-m3")) {
        body.chat_template_kwargs = { thinking_mode: isThinking ? "enabled" : "disabled" };
      } else if (isQwen) {
        body.chat_template_kwargs = { enable_thinking: isThinking };
      } else if (isNemotron) {
        if (apiLevel === "High") {
          body.reasoning_budget = 12e3;
          body.chat_template_kwargs = { enable_thinking: true };
        } else if (apiLevel === "Standard") {
          body.reasoning_budget = 12e3;
          body.chat_template_kwargs = { enable_thinking: true, medium_effort: true };
        } else {
          body.chat_template_kwargs = { enable_thinking: false };
        }
      }
      const response = await fetchWithBackoff("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal
      });
      if (!response.ok) {
        const err = await response.json();
        const error = new Error(`NVIDIA API Error: ${err.error?.message || response.statusText}`);
        error.status = response.status;
        throw error;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingParts = [];
      let latestUsageMetadata = null;
      let lastFlushTime = Date.now();
      let hasNewData = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (hasNewData && (pendingParts.length > 0 || latestUsageMetadata)) {
            yield {
              candidates: pendingParts.length > 0 ? [{ content: { parts: pendingParts } }] : [],
              usageMetadata: latestUsageMetadata
            };
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const json = JSON.parse(trimmed.substring(6));
              const usage = json.usage;
              if (usage) {
                latestUsageMetadata = {
                  totalTokenCount: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
                  promptTokenCount: usage.prompt_tokens || 0,
                  candidatesTokenCount: usage.completion_tokens || 0,
                  thoughtsTokenCount: (usage.completion_tokens_details?.reasoning_tokens || 0) + (usage.completion_tokens_details?.thoughts_tokens || 0)
                };
                hasNewData = true;
              }
              const thinking = json.choices?.[0]?.delta?.reasoning || json.choices?.[0]?.delta?.reasoning_content || "";
              const content = json.choices?.[0]?.delta?.content || "";
              if (thinking) {
                pendingParts.push({ text: thinking, thought: true });
                hasNewData = true;
              }
              if (content) {
                pendingParts.push({ text: content });
                hasNewData = true;
              }
            } catch (e) {
            }
          }
        }
        if (Date.now() - lastFlushTime >= 350 && hasNewData) {
          yield {
            candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
            usageMetadata: latestUsageMetadata
          };
          pendingParts = [];
          lastFlushTime = Date.now();
          hasNewData = false;
        }
      }
    };
    getOpenRouterStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 0.95) {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      for (const content of contents) {
        const role = content.role === "user" ? "user" : "assistant";
        const msgContent = [];
        if (Array.isArray(content.parts)) {
          for (const part of content.parts) {
            if (part.text) {
              msgContent.push({ type: "text", text: part.text });
            } else if (part.inlineData && isMultiModal) {
              const mimeType = part.inlineData.mimeType;
              const data = part.inlineData.data;
              const isImage = mimeType.startsWith("image/");
              if (isImage) {
                msgContent.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${data}`
                  }
                });
              } else {
                msgContent.push({
                  type: "file",
                  file: {
                    filename: part.filename || "file",
                    file_data: `data:${mimeType};base64,${data}`
                  }
                });
              }
            }
          }
        } else {
          const text = content.text || "";
          if (text) msgContent.push({ type: "text", text });
        }
        messages.push({
          role,
          content: msgContent.length === 1 && msgContent[0].type === "text" ? msgContent[0].text : msgContent
        });
      }
      const reasoningEffortMap = {
        "Low": "low",
        "Medium": "medium",
        "Standard": "medium",
        "High": "high",
        "xHigh": "high"
      };
      const requestPayload = {
        model,
        messages,
        stream: true,
        temperature
      };
      const effort = reasoningEffortMap[thinkingLevel];
      if (effort && thinkingLevel !== "Fast") {
        requestPayload.reasoning_effort = effort;
      }
      const response = await fetchWithBackoff("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "FluxFlow CLI",
          "X-Cache": "true"
        },
        body: JSON.stringify(requestPayload),
        signal
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter Error (${response.status}): ${errData.error?.message || response.statusText}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingParts = [];
      let latestUsageMetadata = null;
      let lastFlushTime = Date.now();
      let hasNewData = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (hasNewData && (pendingParts.length > 0 || latestUsageMetadata)) {
            yield {
              candidates: pendingParts.length > 0 ? [{ content: { parts: pendingParts } }] : [],
              usageMetadata: latestUsageMetadata
            };
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || !cleanLine.startsWith("data: ")) continue;
          if (cleanLine === "data: [DONE]") break;
          try {
            const json = JSON.parse(cleanLine.substring(6));
            const delta = json.choices?.[0]?.delta;
            const usage = json.usage;
            if (usage) {
              latestUsageMetadata = {
                totalTokenCount: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
                promptTokenCount: usage.prompt_tokens || 0,
                candidatesTokenCount: usage.completion_tokens || 0,
                cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
                thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || 0
              };
              hasNewData = true;
            }
            if (delta) {
              const thought = delta.reasoning || (delta.reasoning_details ? delta.reasoning_details.map((d) => d.text).join("") : null);
              if (thought) {
                pendingParts.push({ text: thought, thought: true });
                hasNewData = true;
              }
              if (delta.content) {
                pendingParts.push({ text: delta.content });
                hasNewData = true;
              }
            }
          } catch (e) {
          }
        }
        if (Date.now() - lastFlushTime >= 150 && hasNewData) {
          yield {
            candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
            usageMetadata: latestUsageMetadata
          };
          pendingParts = [];
          lastFlushTime = Date.now();
          hasNewData = false;
        }
      }
    };
    signalTermination = () => {
      TERMINATION_SIGNAL = true;
    };
    TOOL_LABELS2 = {
      "write_file": "Writing",
      "update_file": "Editing",
      "read_folder": "Reading",
      "view_file": "Reading",
      "exec_command": "Executing Command",
      "web_search": "Searching",
      "web_scrape": "Reading",
      "memory": "Updating Memory",
      "search_keyword": "Searching",
      "file_map": "Generating Map",
      "ask": "User Input",
      "write_pdf": "Creating",
      "write_docx": "Creating",
      "generate_image": "Generating",
      "todo": "Planning",
      "Todo": "Planning",
      "invoke_sync": "Spawning SubAgent",
      "invoke": "Spawning SubAgent",
      "get_progress": "Checking SubAgent",
      "await": "Waiting"
    };
    getToolDetail = (toolName, argsStr) => {
      try {
        const pArgs = parseArgs(argsStr);
        const normToolName = toolName.toLowerCase().replace(/_/g, "");
        if (normToolName === "invokesync" || normToolName === "invoke") {
          return pArgs.title || (pArgs.task ? pArgs.task.substring(0, 30) : null);
        }
        if (normToolName === "getprogress") {
          return pArgs.id || pArgs.taskId;
        }
        const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
        return filePath ? path19.basename(filePath.replace(/["']/g, "").replace(/\\/g, "/")) : null;
      } catch (e) {
        return null;
      }
    };
    runJanitorTask = async (settings, agentText, fullAgentTextRaw, history, callbacks = {}) => {
      if (process.stdout.isTTY) {
        process.stdout.write(`\x1B]0;Finalizing...\x07`);
        process.stdout.write(`\x1B]633;P;TerminalTitle=Finalizing...\x07`);
      }
      const USER_CONTEXT_LENGTH = 4 * (1024 * 2);
      const AGENT_CONTEXT_LENGTH = 4 * (1024 * 8);
      const { onStatus, onMemoryUpdated, onBackgroundIncrement } = callbacks;
      const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats, aiProvider = "Google", apiKey } = settings;
      const isMemoryEnabled = systemSettings?.memory !== false;
      const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
      const janitorUserMemories = persistentStorage.map((m) => `- [${m.id}]: ${m.memory}`).join("\n");
      const janitorContents = history.slice(0, -1).filter((msg) => msg.text && !msg.text.includes("[TOOL RESULT]") && !msg.text.includes("OBSERVATION:") && !msg.text.startsWith("[TERMINAL_RECORD]") && !msg.isTerminalRecord && !msg.isMeta && !msg.isLogo && !String(msg.id).startsWith("welcome") && !String(msg.id).startsWith("logo")).slice(-14).map((msg) => {
        let processedText = stripAnsi2(msg.text).replace(/\[tool:functions\..*?\]/g, "").replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, "").replace(/\[Prompted on:.*?\]/g, "").replace(/\[METADATA \(PRIORITY: DYNAMIC\)\] Time: ([^|\n]+)/g, (match, p1) => {
          return `[METADATA (PRIORITY: DYNAMIC)] Time: ${p1.replace(/:\d{2}/g, "")}`;
        }).replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, "").replace(/\[\[END\]\]/g, "").replace(/\[TOOL RESULTS\]/g, "").replace(/\[tool results\]/g, "").replace(/\r?\n\r?\n/g, "\n").replace(/\n\n/g, "\n").replace(/\\n\\n/g, "").trim();
        const limit = msg.role === "user" ? USER_CONTEXT_LENGTH : AGENT_CONTEXT_LENGTH;
        let truncatedText = processedText.substring(0, limit);
        if (processedText.length > limit) {
          truncatedText += "\n... (truncated) ...";
        }
        const prefix = msg.role === "user" ? truncatedText.startsWith("[USER]") ? "" : "[USER]: " : truncatedText.startsWith("[AGENT]") ? "" : "[AGENT]: ";
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: `${prefix}${truncatedText}` }]
        };
      });
      const isFirstPrompt = history.filter((m) => m.role === "user").length === 1;
      const hasTitleSignal = agentText.includes("[TITLE-UPDATE]");
      const thisHas80pChanceOfBeingTrue = Math.random() < 0.8;
      const needTitle = isFirstPrompt || hasTitleSignal || thisHas80pChanceOfBeingTrue;
      const cleanedFullResponse = fullAgentTextRaw.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, "").trim();
      const janitorPrompt = getJanitorInstruction(
        janitorUserMemories,
        isMemoryEnabled,
        needTitle
      );
      let agentRes = `${cleanedFullResponse.replace(/\[tool:functions\..*?\]/g, "").replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, "").replace(/\[Prompted on:.*?\]/g, "").replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, "").replace(/\[\[END\]\]/g, "").replace(/\[\[TOOL RESULTS\]\]/g, "").replace(/\[tool results\]/g, "").substring(0, AGENT_CONTEXT_LENGTH)}`;
      if (agentRes.length > AGENT_CONTEXT_LENGTH) {
        agentRes += "\n... (truncated) ...";
      }
      let originalTextProcessed = agentText.replace(/\[Prompted on:.*?\]/g, "").trim();
      agentRes = agentRes.replace(/\r?\n\r?\n/g, "\n").replace(/\n\n/g, "\n").replace(/\\n\\n/g, "").trim();
      let userPrompt = `[USER]: ${originalTextProcessed.substring(0, USER_CONTEXT_LENGTH)}
${originalTextProcessed.length > USER_CONTEXT_LENGTH ? "... (truncated) ...\n\n" : ""}
[AGENT (current turn)]: ${agentRes}`;
      janitorContents.push({ role: "user", parts: [{ text: userPrompt }] });
      let finalSynthesis = "";
      let attempts = 0;
      const MAX_JANITOR_RETRIES = isMemoryEnabled ? 12 : -1;
      while (attempts <= MAX_JANITOR_RETRIES) {
        if (process.stdout.isTTY) {
          process.stdout.write(`\x1B]0;Retrying Finalizing... (${attempts + 1})...\x07`);
          process.stdout.write(`\x1B]633;P;TerminalTitle=Retrying Finalizing... (${attempts + 1})...\x07`);
        }
        try {
          if (!await checkQuota("background", settings)) {
            return;
          }
          let fullContent = "";
          let lastUsage = null;
          try {
            const timeoutPromise = new Promise(
              (_, reject) => setTimeout(() => reject(new Error("JANITOR_TIMEOUT")), 6e4)
            );
            const streamPromise = (async () => {
              if (aiProvider === "OpenRouter") {
                const janitorOpenRouterModel = "google/gemma-4-26b-a4b-it:free";
                const stream = getOpenRouterStream(
                  apiKey,
                  janitorOpenRouterModel,
                  janitorContents,
                  janitorPrompt,
                  "Fast",
                  // Janitor always minimal
                  mode,
                  false,
                  null,
                  0.75
                );
                const iterator2 = stream[Symbol.asyncIterator]();
                const firstResult2 = await iterator2.next();
                return { iterator: iterator2, firstResult: firstResult2 };
              } else if (aiProvider === "DeepSeek") {
                const stream = getDeepSeekStream(
                  apiKey,
                  "deepseek-chat",
                  janitorContents,
                  janitorPrompt,
                  "Fast",
                  // Janitor always minimal
                  mode,
                  false,
                  null,
                  0.75
                );
                const iterator2 = stream[Symbol.asyncIterator]();
                const firstResult2 = await iterator2.next();
                return { iterator: iterator2, firstResult: firstResult2 };
              } else if (aiProvider === "NVIDIA") {
                const stream = getNVIDIAStream(
                  apiKey,
                  "moonshotai/kimi-k2.6",
                  janitorContents,
                  janitorPrompt,
                  "Fast",
                  // Janitor always minimal
                  mode,
                  false,
                  null,
                  0.75
                );
                const iterator2 = stream[Symbol.asyncIterator]();
                const firstResult2 = await iterator2.next();
                return { iterator: iterator2, firstResult: firstResult2 };
              } else {
                const stream = await client.models.generateContentStream({
                  model: janitorModel || (attempts === MAX_JANITOR_RETRIES ? "gemini-3.1-flash-lite" : "gemma-4-26b-a4b-it"),
                  contents: janitorContents,
                  config: {
                    systemInstruction: janitorPrompt,
                    maxOutputTokens: 512,
                    temperature: 0.75,
                    safetySettings: [
                      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                    ],
                    thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL }
                    // Janitor always minimal
                  }
                });
                const iterator2 = stream[Symbol.asyncIterator]();
                const firstResult2 = await iterator2.next();
                return { iterator: iterator2, firstResult: firstResult2 };
              }
            })();
            const { iterator, firstResult } = await Promise.race([streamPromise, timeoutPromise]);
            let { value: firstChunk, done: firstDone } = firstResult;
            if (!firstDone && firstChunk) {
              const parts = firstChunk.candidates?.[0]?.content?.parts;
              const chunkText = parts?.[1]?.text || parts?.[0]?.text || (typeof firstChunk.text === "function" ? firstChunk.text() : "");
              if (chunkText) {
                fullContent += chunkText;
              }
              lastUsage = firstChunk.usageMetadata;
              for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
                const p = chunk.candidates?.[0]?.content?.parts;
                const t = p?.[1]?.text || p?.[0]?.text || (typeof chunk.text === "function" ? chunk.text() : "");
                if (t) fullContent += t;
                lastUsage = chunk.usageMetadata;
              }
            }
          } catch (e) {
            throw e;
          }
          if (fullContent) {
            finalSynthesis = fullContent;
            if (lastUsage) {
              const total = lastUsage.totalTokenCount || 0;
              const cached = lastUsage.cachedContentTokenCount || 0;
              const candidates = (lastUsage.candidatesTokenCount || 0) + (lastUsage.thoughtsTokenCount || 0);
              const jModel = janitorModel || "gemini-3.1-flash-lite";
              await addToUsage("tokens", total, aiProvider, jModel);
              if (cached > 0) {
                await addToUsage("cachedTokens", cached, aiProvider, jModel);
              }
              if (candidates > 0) {
                await addToUsage("candidateTokens", candidates, aiProvider, jModel);
              }
            }
          } else {
            throw new Error("No synthesis generated by Janitor.");
          }
          if (onBackgroundIncrement) {
            onBackgroundIncrement();
            await incrementUsage("background");
          }
          const janitorToolCalls = detectToolCalls(finalSynthesis);
          let scoreToolCalled = false;
          for (const janitorToolCall of janitorToolCalls) {
            const toolName = janitorToolCall.toolName;
            if (["addMemScore", "add_mem_score", "AddMemScore", "addMemoryScore", "AddMemoryScore"].includes(toolName)) {
              scoreToolCalled = true;
            }
            const toolContext = { chatId, sessionId: chatId, history };
            const result = await dispatchTool(toolName, janitorToolCall.args, toolContext);
            if (toolName.toLowerCase() === "memory") {
              const isUserAction = janitorToolCall.args.includes("action='user'") || janitorToolCall.args.includes('action="user"');
              if (isUserAction && !result.startsWith("ERROR")) {
                if (onMemoryUpdated) onMemoryUpdated();
                if (process.stdout.isTTY) {
                  process.stdout.write(`\x1B]0;Memory Updated\x07`);
                  process.stdout.write(`\x1B]633;P;TerminalTitle=Memory Updated\x07`);
                }
                await new Promise((resolve) => setTimeout(resolve, 3e3));
              }
            }
          }
          if (!scoreToolCalled) {
            try {
              const memories = readEncryptedJson(MEMORIES_FILE, []);
              if (memories.length > 0) {
                const updatedMemories = [];
                for (const mem of memories) {
                  if (mem.score === void 0) {
                    mem.score = 0.5;
                  }
                  mem.score *= 0.9995;
                  if (mem.score < 0.05) mem.score = 0;
                  mem.score = Math.round(mem.score * 1e5) / 1e5;
                  if (mem.score > 0) {
                    updatedMemories.push(mem);
                  }
                }
                writeEncryptedJson(MEMORIES_FILE, updatedMemories);
              }
            } catch (decayErr) {
            }
          }
          break;
        } catch (err) {
          attempts++;
          const date = (/* @__PURE__ */ new Date()).toLocaleString();
          if (process.stdout.isTTY) {
            process.stdout.write(`\x1B]0;Finalizing Error\x07`);
          }
          const errLog = err instanceof Error ? (() => {
            try {
              return JSON.parse(JSON.parse(err.message).error.message).error.message;
            } catch {
              return String(err);
            }
          })() : String(err);
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          const janitorErrDir = path19.join(LOGS_DIR, "janitor");
          if (!fs20.existsSync(janitorErrDir)) fs20.mkdirSync(janitorErrDir, { recursive: true });
          fs20.appendFileSync(path19.join(janitorErrDir, "error.log"), `ERROR [Attempt ${attempts}/${MAX_JANITOR_RETRIES + 1}] [${date}]: ${errLog}

`);
          if (attempts > MAX_JANITOR_RETRIES) break;
          const backoff = Math.min(1e3 * Math.pow(2, attempts - 1), 8e3);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
      if (attempts) {
        const janitorErrDir = path19.join(LOGS_DIR, "janitor");
        fs20.appendFileSync(path19.join(janitorErrDir, "error.log"), `-----------------------------------------------------------------------------

`);
        if (attempts >= MAX_JANITOR_RETRIES) {
          if (process.stdout.isTTY) {
            process.stdout.write(`\x1B]0;${isMemoryEnabled ? "Finalizing Error" : "Finalizing Skipped"}\x07`);
          }
          await new Promise((resolve) => setTimeout(resolve, 3e3));
        }
      }
      if (process.stdout.isTTY) {
        process.stdout.write("\x1B]0;FluxFlow | Idle\x07");
        process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow | Idle\x07");
      }
    };
    getActiveToolContext = (text) => {
      const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
      let match;
      while ((match = toolRegex.exec(text)) !== null) {
        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let isEscaped = false;
        let closed = false;
        for (let i = startIdx; i < text.length; i++) {
          const char = text[i];
          if (!inString && (char === '"' || char === "'" || char === "`")) {
            inString = char;
            isEscaped = false;
          } else if (inString && char === inString && !isEscaped) {
            inString = null;
          }
          if (!inString) {
            if (char === "(") balance++;
            else if (char === ")") balance--;
            if (balance === 0) {
              let j = i + 1;
              while (j < text.length && /\s/.test(text[j])) j++;
              if (j < text.length && text[j] === "]") {
                closed = true;
                toolRegex.lastIndex = j + 1;
                break;
              }
            }
          }
          if (char === "\\") isEscaped = !isEscaped;
          else isEscaped = false;
        }
        if (!closed) {
          return { inside: true, toolName: match[1], startIndex: match.index, args: text.substring(match.index + match[0].length) };
        }
      }
      return { inside: false };
    };
    getContextSafeText = (text, stripThoughts = true) => {
      const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
      let result = "";
      let lastIdx = 0;
      let match;
      while ((match = toolRegex.exec(text)) !== null) {
        const before = text.substring(lastIdx, match.index);
        result += stripThoughts ? before.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\]|$)/gi, "") : before;
        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;
        for (let i = startIdx; i < text.length; i++) {
          const char = text[i];
          if (inString) {
            if (char === inString) {
              let backslashCount = 0;
              for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) {
                backslashCount++;
              }
              if (backslashCount % 2 === 0) {
                inString = null;
              }
            }
          } else {
            if (char === '"' || char === "'" || char === "`") {
              inString = char;
            } else if (char === "(") {
              balance++;
            } else if (char === ")") {
              balance--;
              if (balance === 0) {
                let j = i + 1;
                while (j < text.length && /\s/.test(text[j])) j++;
                if (j < text.length && text[j] === "]") {
                  endIdx = j;
                  break;
                }
              }
            }
          }
        }
        if (endIdx !== -1) {
          result += "[tool:functions." + match[1] + "()]";
          lastIdx = endIdx + 1;
          toolRegex.lastIndex = lastIdx;
        } else {
          result += "[tool:functions." + match[1] + "(";
          lastIdx = text.length;
          break;
        }
      }
      if (lastIdx < text.length) {
        result += stripThoughts ? text.substring(lastIdx).replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\]|$)/gi, "") : text.substring(lastIdx);
      }
      return result;
    };
    contextSafeReplace = (text, regex, replacement) => {
      const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
      let result = "";
      let lastIdx = 0;
      let match;
      while ((match = toolRegex.exec(text)) !== null) {
        const before = text.substring(lastIdx, match.index);
        result += before.replace(regex, replacement);
        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;
        for (let i = startIdx; i < text.length; i++) {
          const char = text[i];
          if (inString) {
            if (char === inString) {
              let backslashCount = 0;
              for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) {
                backslashCount++;
              }
              if (backslashCount % 2 === 0) {
                inString = null;
              }
            }
          } else {
            if (char === '"' || char === "'" || char === "`") {
              inString = char;
            } else if (char === "(") {
              balance++;
            } else if (char === ")") {
              balance--;
              if (balance === 0) {
                let j = i + 1;
                while (j < text.length && /\s/.test(text[j])) j++;
                if (j < text.length && text[j] === "]") {
                  endIdx = j;
                  break;
                }
              }
            }
          }
        }
        if (endIdx !== -1) {
          result += text.substring(match.index, endIdx + 1);
          lastIdx = endIdx + 1;
          toolRegex.lastIndex = lastIdx;
        } else {
          result += text.substring(match.index);
          lastIdx = text.length;
          break;
        }
      }
      if (lastIdx < text.length) {
        result += text.substring(lastIdx).replace(regex, replacement);
      }
      return result;
    };
    getSanitizedText = (text) => {
      return getContextSafeText(text, true);
    };
    translateKimiToolCalls = (text) => {
      if (!text) return text;
      const PASCAL_MAP = {
        "patchfile": "PatchFile",
        "writefile": "WriteFile",
        "readfile": "ReadFile",
        "viewfile": "ReadFile",
        "run": "Run",
        "execcommand": "Run",
        "searchkeyword": "SearchKeyword",
        "websearch": "WebSearch",
        "webscrape": "WebScrape",
        "readfolder": "ReadFolder",
        "writepdf": "WritePDF",
        "writedoc": "WriteDoc",
        "writedocx": "WriteDoc",
        "filemap": "FileMap",
        "generateimage": "GenerateImage",
        "todo": "Todo",
        "ask": "Ask"
      };
      const toPascalCase = (str) => {
        return str.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
      };
      const kimiRegex = /<\|\s*tool_call_begin\s*\|>\s*(?:(?:tool|functions)\b[\s._]*)*([a-zA-Z0-9_]+)(?::\d+)?\s*<\|\s*tool_call_argument_begin\s*\|>([\s\S]*?)<\|\s*tool_call_end\s*\|>/gi;
      let result = text.replace(kimiRegex, (match, toolName, argsJsonStr) => {
        let parsedArgs = "";
        try {
          const argsObj = JSON.parse(argsJsonStr.trim());
          if (argsObj && typeof argsObj === "object") {
            const argPairs = Object.entries(argsObj).map(([key, val]) => {
              const stringVal = typeof val === "string" ? val : JSON.stringify(val);
              return `${key}=${JSON.stringify(stringVal)}`;
            });
            parsedArgs = argPairs.join(", ");
          }
        } catch (e) {
          const pairs = [];
          const pairRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"|(\d+)|true|false|null)/g;
          let pMatch;
          while ((pMatch = pairRegex.exec(argsJsonStr)) !== null) {
            const key = pMatch[1];
            const val = pMatch[2] !== void 0 ? pMatch[2] : pMatch[0].split(":").slice(1).join(":").trim();
            pairs.push(`${key}=${JSON.stringify(val)}`);
          }
          if (pairs.length > 0) {
            parsedArgs = pairs.join(", ");
          } else {
            parsedArgs = argsJsonStr.trim();
          }
        }
        const cleanKey = toolName.toLowerCase().replace(/_/g, "");
        const normToolName = PASCAL_MAP[cleanKey] || toPascalCase(toolName);
        return `[tool:functions.${normToolName}(${parsedArgs})]`;
      });
      result = result.replace(/<\|\s*tool_calls_section_begin\s*\|>/gi, "");
      result = result.replace(/<\|\s*tool_calls_section_end\s*\|>/gi, "");
      return result;
    };
    detectToolCalls = (text) => {
      if (!text) return [];
      const translatedText = translateKimiToolCalls(text);
      const cleanText = translatedText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, "");
      const results = [];
      const toolRegex = /\[\s*(?:tool:functions\.|agent:generalist\.)([a-z0-9_]+)\s*\(/gi;
      let match;
      while ((match = toolRegex.exec(cleanText)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;
        let closingParenIdx = -1;
        for (let i = startIdx; i < cleanText.length; i++) {
          const char = cleanText[i];
          if (inString) {
            if (char === inString) {
              let backslashCount = 0;
              for (let j = i - 1; j >= 0 && cleanText[j] === "\\"; j--) {
                backslashCount++;
              }
              if (backslashCount % 2 === 0) {
                inString = null;
              }
            }
          } else {
            if (char === '"' || char === "'" || char === "`") {
              inString = char;
            } else if (char === "(") {
              balance++;
            } else if (char === ")") {
              balance--;
              if (balance === 0) {
                closingParenIdx = i;
                let j = i + 1;
                while (j < cleanText.length && /\s/.test(cleanText[j])) j++;
                if (j < cleanText.length && cleanText[j] === "]") {
                  endIdx = j;
                  break;
                }
              }
            }
          }
        }
        if (endIdx !== -1) {
          const finalArgsText = cleanText.substring(startIdx + 1, closingParenIdx);
          const finalFullMatch = cleanText.substring(match.index, endIdx + 1);
          results.push({
            fullMatch: finalFullMatch,
            toolName: toolName.trim(),
            args: finalArgsText.trim()
          });
          toolRegex.lastIndex = endIdx + 1;
        }
      }
      return results;
    };
    initAI = (apiKey, settings = {}) => {
      if (!apiKey) return null;
      globalSettings = settings;
      client = new GoogleGenAI({ apiKey });
      return client;
    };
    generateSimpleContent = async (settings, model, contents, systemInstruction, thinkingLevel = "Fast", temperature = 0.75, usageKey = "agent") => {
      return withRetry(async () => {
        const { aiProvider = "Google", apiKey, mode } = settings;
        let fullText = "";
        let usageMetadata = null;
        const normalizedContents = typeof contents === "string" ? [{ role: "user", parts: [{ text: contents }] }] : contents;
        let stream;
        if (aiProvider === "OpenRouter") {
          stream = getOpenRouterStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, null, temperature);
        } else if (aiProvider === "DeepSeek") {
          stream = getDeepSeekStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, null, temperature);
        } else if (aiProvider === "NVIDIA") {
          stream = getNVIDIAStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, null, temperature);
        } else {
          const genStream = await client.models.generateContentStream({
            model,
            contents: normalizedContents,
            config: {
              systemInstruction,
              temperature,
              thinkingConfig: (() => {
                const modelLower = (model || "").toLowerCase();
                const isGemma4 = modelLower.includes("gemma-4") || modelLower.startsWith("gemma");
                const isGemini3 = modelLower.includes("gemini-3");
                if (isGemma4 || isGemini3) {
                  if (isGemma4) {
                    if (thinkingLevel.toLowerCase() !== "xhigh" || false) return { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL };
                    else return { includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH };
                  }
                  return {
                    includeThoughts: true,
                    thinkingLevel: {
                      "Fast": modelLower.includes("pro") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
                      "Low": ThinkingLevel.LOW,
                      "Medium": ThinkingLevel.MEDIUM,
                      "Standard": ThinkingLevel.MEDIUM,
                      "High": ThinkingLevel.HIGH,
                      "xHigh": ThinkingLevel.HIGH
                    }[thinkingLevel] || ThinkingLevel.MEDIUM
                  };
                } else {
                  const budget = {
                    "Fast": 0,
                    "Low": 512,
                    "Medium": 2048,
                    "Standard": 2048,
                    "High": 16384,
                    "xHigh": 24576
                  }[thinkingLevel] || 2048;
                  if (budget === 0) {
                    return { includeThoughts: false };
                  }
                  return {
                    includeThoughts: true,
                    thinkingBudget: budget
                  };
                }
              })()
            }
          });
          stream = genStream;
        }
        for await (const chunk of stream) {
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text && !part.thought) fullText += part.text;
            }
          }
          if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
        }
        if (usageMetadata) {
          const total = usageMetadata.totalTokenCount || 0;
          const cached = usageMetadata.cachedContentTokenCount || 0;
          const candidates = (usageMetadata.candidatesTokenCount || 0) + (usageMetadata.thoughtsTokenCount || 0);
          await addToUsage("tokens", total, aiProvider, model);
          if (cached > 0) {
            await addToUsage("cachedTokens", cached, aiProvider, model);
          }
          if (candidates > 0) {
            await addToUsage("candidateTokens", candidates, aiProvider, model);
          }
          if (settings && typeof settings.onUsage === "function") {
            settings.onUsage({
              totalTokenCount: total,
              cachedContentTokenCount: cached,
              candidatesTokenCount: candidates
            });
          }
        }
        await incrementUsage(usageKey, aiProvider);
        return { text: fullText, usageMetadata };
      });
    };
    consolidatePastMemories = async (currentChatId, settings) => {
      try {
        const { aiProvider = "Google" } = settings;
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        const totalMemoriesCount = Object.values(tempStorage).flat().length;
        if (totalMemoriesCount <= 2) return;
        const chatsToSummarize = Object.keys(tempStorage).filter((id) => {
          return id !== currentChatId && Array.isArray(tempStorage[id]) && tempStorage[id].length > 2;
        });
        if (chatsToSummarize.length === 0) return;
        let prompt = `You are a silent background process for the FluxFlow CLI Agent.
Your task is to summarize or merge temporary context memories from one or more past conversation sessions.
For each Chat ID provided, you must output a tool call to save the consolidated summary.

The tool call format MUST be:
[tool:functions.saveSummary(id="<chat-id>", summary="<updated summary string, max 400 words>")]

Guidelines:
- Create a single, updated, highly cohesive, and concise summary statement (max 400 words) for each Chat ID. It should contain WHAT user talked about, WHAT were the tasks, Temporal info, HOW/WHAT the model responded. DON'T REMOVE ANY KEY AND TURN BY TURN INFO DENSITY.
- Focus on key goals, preferences, modified files, and technical decisions.
- Under no circumstances write normal conversational text. Output ONLY the tool calls.
- You can stack multiple tool calls for multiple chats.

Chats to process:

`;
        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        for (const id of chatsToSummarize) {
          const rawMemories = tempStorage[id];
          const newMemoryListStr = rawMemories.map((m) => `- ${m}`).join("\n");
          const oldSummary = cacheStorage[id];
          prompt += `[Chat ID: ${id}]
`;
          if (oldSummary) {
            prompt += `- Existing Summary: "${oldSummary}"
`;
            prompt += `-- New Memories to integrate:
${newMemoryListStr}

`;
          } else {
            prompt += `-- Individual Memories:
${newMemoryListStr}

`;
          }
        }
        let attempts = 0;
        const maxAttempts = 5;
        let success = false;
        let targetModel = "gemma-4-26b-a4b-it";
        if (aiProvider === "OpenRouter") targetModel = "google/gemma-4-26b-a4b-it:free";
        if (aiProvider === "DeepSeek") targetModel = "deepseek-v4-flash";
        while (attempts <= maxAttempts && !success) {
          attempts++;
          try {
            const response = await generateSimpleContent(settings, targetModel, prompt, null, "Fast", 0.75, "background");
            const responseText = response.text || "";
            const janitorToolCalls = detectToolCalls(responseText);
            if (janitorToolCalls.length === 0) {
              throw new Error("No tool calls detected in synthesis response");
            }
            for (const janitorToolCall of janitorToolCalls) {
              const toolName = janitorToolCall.toolName;
              if (["saveSummary", "saveSumary", "SaveSummary", "SaveSumary"].includes(toolName)) {
                await dispatchTool(toolName, janitorToolCall.args, { chatId: currentChatId });
              }
            }
            success = true;
          } catch (err) {
            if (attempts >= maxAttempts) {
              throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${err.message}`);
            }
          }
        }
      } catch (err) {
        const errLog = err instanceof Error ? (() => {
          try {
            return JSON.parse(JSON.parse(err.message).error.message).error.message;
          } catch {
            return String(err);
          }
        })() : String(err);
        ;
        const janitorLogDir = path19.join(LOGS_DIR, "janitor");
        if (!fs20.existsSync(janitorLogDir)) fs20.mkdirSync(janitorLogDir, { recursive: true });
        fs20.appendFileSync(
          path19.join(janitorLogDir, "error.log"),
          `[${(/* @__PURE__ */ new Date()).toLocaleString()}] Past memory batch consolidation error: ${errLog}
`
        );
      }
    };
    compressHistory = async (settings, history, isAuto = false) => {
      const { chatId, aiProvider = "Google" } = settings;
      const summariesFile = path19.join(SECRET_DIR, "chat-summaries.json");
      const flattenContext = (hist) => {
        return hist.filter(
          (m) => (m.role === "user" || m.role === "agent" || m.role === "system") && m.role !== "think" && !m.isVisualFeedback && !m.isMeta && !String(m.id).startsWith("welcome")
        ).map((m) => {
          const role = m.text?.startsWith("[TOOL RESULT]") ? "TOOL" : m.role === "agent" ? "AGENT" : "USER";
          return `[${role}]: ${m.text}`;
        }).join("\n\n");
      };
      const runCondenser = async (flattenedText2, oldSummary2) => {
        const systemInstruction = `You are an expert context summarizer. Summarize the provided chat history (which may include previous summaries, user instructions, agent outputs, and tool results) into a detailed, coherent, and highly technical summary of 1000 to 1500 words. Focus on preserving the architectural decisions made, current system state, task progress, and critical code details, chat messages, file changes. Under no circumstances exceed MAX 2000 words.`;
        const prompt = oldSummary2 ? `Here is the previous summary:
${oldSummary2}

Here is the new conversation history:
${flattenedText2}

Provide a new consolidated summary of the entire session.` : `Here is the conversation history:
${flattenedText2}

Provide a consolidated summary of the entire session.`;
        let targetModel = "gemma-4-26b-a4b-it";
        if (aiProvider === "OpenRouter") targetModel = "google/gemma-4-26b-a4b-it:free";
        if (aiProvider === "DeepSeek") targetModel = "deepseek-v4-flash";
        if (aiProvider === "NVIDIA") targetModel = "stepfun-ai/step-3.7-flash";
        let attempts = 0;
        let success = false;
        let response = null;
        while (attempts <= 3 && !success) {
          attempts++;
          try {
            response = await generateSimpleContent(settings, targetModel, prompt, systemInstruction, "Fast");
            success = true;
          } catch (err) {
            if (attempts > 3) {
              if (aiProvider === "Google") {
                try {
                  const fallbackModel = "gemini-3.1-flash-lite";
                  const fallback = await generateSimpleContent(settings, fallbackModel, prompt, systemInstruction, "Fast");
                  return fallback.text || "";
                } catch (e) {
                  return "";
                }
              }
              return "";
            }
          }
        }
        return response ? response.text || "" : "";
      };
      const flattenedText = flattenContext(history);
      const summaries = readEncryptedJson(summariesFile, {});
      let chatData = summaries[chatId] || { summary: "", historyLength: 0 };
      if (typeof chatData === "string") {
        chatData = { summary: chatData, historyLength: 0 };
      }
      const oldSummary = chatData.summary || "";
      const newSummary = await runCondenser(flattenedText, oldSummary);
      if (newSummary) {
        chatData.summary = newSummary;
        const cleanLen = getCleanGroupedLength(history);
        if (isAuto) {
          chatData.historyLength = (chatData.historyLength || 0) + cleanLen;
        } else {
          chatData.historyLength = cleanLen;
        }
        summaries[chatId] = chatData;
        writeEncryptedJson(summariesFile, summaries);
        return newSummary;
      }
      return null;
    };
    deleteChatSummary = (chatId) => {
      try {
        const summariesFile = path19.join(SECRET_DIR, "chat-summaries.json");
        if (fs20.existsSync(summariesFile)) {
          const summaries = readEncryptedJson(summariesFile, {});
          if (summaries[chatId]) {
            delete summaries[chatId];
            writeEncryptedJson(summariesFile, summaries);
          }
        }
      } catch (e) {
      }
    };
    getAIStream = async function* (modelName, history, settings, steeringCallback, versionFluxflow2) {
      const { profile, thinkingLevel, mode, janitorModel, chatId, isPlayground, systemSettings, sessionStats, aiProvider = "Google", apiTier } = settings;
      const isMultiModal = isModelMultimodal(modelName);
      if (!client && aiProvider === "Google") throw new Error("AI not initialized");
      const isMemoryEnabled = systemSettings?.memory !== false;
      const originalText = history[history.length - 1].text;
      const summariesFile = path19.join(SECRET_DIR, "chat-summaries.json");
      let wasCompressedInStream = false;
      const isFirstPrompt = history.filter((m) => m.role === "user").length === 1;
      const hasTitleSignal = originalText.includes("[TITLE-UPDATE]");
      const needTitle = isFirstPrompt || hasTitleSignal;
      let agentText = originalText.replace(/\[TITLE-UPDATE\]/g, "").trim();
      agentText = agentText.replace(/\s*\[Prompted on:.*?\]/g, "").trim();
      await RevertManager.startTransaction(chatId, agentText);
      TERMINATION_SIGNAL = false;
      let connectionPollInterval = null;
      try {
        const abortController = new AbortController();
        connectionPollInterval = setInterval(() => {
          if (TERMINATION_SIGNAL) {
            abortController.abort();
            if (connectionPollInterval) {
              clearInterval(connectionPollInterval);
              connectionPollInterval = null;
            }
          }
        }, 400);
        let modifiedHistory = [...history.slice(0, -1)];
        {
          const summaries2 = readEncryptedJson(summariesFile, {});
          const chatDataObj2 = summaries2[chatId] || { summary: "", historyLength: 0 };
          if (chatDataObj2.summary && chatDataObj2.historyLength > 0) {
            let cleanCount = 0;
            const slicedHistory = [];
            for (let i = 0; i < modifiedHistory.length; i++) {
              const msg = modifiedHistory[i];
              const isClean = (msg.role === "user" || msg.role === "agent" || msg.role === "system") && !String(msg.id).startsWith("welcome") && !msg.isMeta;
              if (isClean) {
                cleanCount++;
              }
              if (cleanCount > chatDataObj2.historyLength) {
                slicedHistory.push(msg);
              }
            }
            modifiedHistory = slicedHistory;
          }
        }
        let contextCompressionCount = 255e3;
        let contextTruncationCount = 26e4;
        if (aiProvider === "NVIDIA" && (modelName?.includes("glm") || modelName?.includes("gpt") || modelName?.includes("qwen"))) {
          contextCompressionCount = 122e3;
          contextTruncationCount = 126e3;
        } else if (aiProvider === "DeepSeek" || aiProvider === "Google" && apiTier === "Paid") {
          contextCompressionCount = 4e5;
          contextTruncationCount = 405e3;
        }
        if ((sessionStats?.tokens || 0) > contextCompressionCount) {
          yield { type: "status_history", content: "Context Limit Reached. Condensing session history..." };
          const newSummary = await compressHistory(settings, modifiedHistory, true);
          if (newSummary) {
            modifiedHistory = [];
            wasCompressedInStream = true;
          }
        }
        if (isFirstPrompt && isMemoryEnabled) {
          yield { type: "status", content: "Condensing past chat memories..." };
          await consolidatePastMemories(chatId, settings);
        }
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        const otherRawMemories = Object.entries(tempStorage).filter(([id]) => id !== chatId).flatMap(([_, mems]) => mems);
        const cachedSummaries = Object.entries(cacheStorage).filter(([id]) => id !== chatId).slice(-20).map(([id, summary]) => `[Chat Summary]: ${summary}`);
        const otherMemories = [...cachedSummaries, ...otherRawMemories].map((mem) => `- ${mem}`).join("\n");
        const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
        const mainUserMemories = persistentStorage.map((m) => `- ${m.memory}`).join("\n");
        const isContext32k = (sessionStats?.tokens || 0) >= 24e3;
        const memoryPrompt = getMemoryPrompt(otherMemories, mainUserMemories, isMemoryEnabled, isContext32k);
        const dateTimeStr = (/* @__PURE__ */ new Date()).toLocaleString([], { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
        const COLLAPSED_DIRS_GLOBAL = [
          // --- The OG Clutter ---
          ".git",
          "node_modules",
          ".gemini",
          "dist",
          "build",
          ".next",
          "out",
          ".cache",
          "bin",
          "obj",
          "vendor",
          "venv",
          ".idea",
          ".gradle",
          ".terraform",
          "target",
          "coverage",
          ".vscode",
          // --- Version Control, Monorepos & CI/CD ---
          ".svn",
          ".hg",
          ".fslckout",
          ".github",
          ".gitlab",
          ".circleci",
          ".gitea",
          ".gitee",
          ".lerna",
          ".changeset",
          ".nx",
          // --- JS / TS / Web Dev Armageddon ---
          ".npm",
          ".yarn",
          ".pnpm-store",
          ".expo",
          ".nuxt",
          ".svelte-kit",
          ".docusaurus",
          ".turbo",
          ".vercel",
          "bower_components",
          ".netlify",
          ".vuepress",
          ".quasar",
          ".output",
          ".angular",
          "jspm_packages",
          ".parcel-cache",
          ".rollup.cache",
          ".rspack",
          ".vitepress",
          // --- Python & Data Science Brain Melting ---
          "__pycache__",
          ".pytest_cache",
          ".mypy_cache",
          ".tox",
          ".poetry",
          "env",
          "vhdl",
          ".ipynb_checkpoints",
          ".jupyter",
          ".conda",
          ".pdm-build",
          // --- Ruby / PHP / Go / Rust / Java / C++ / C# ---
          ".bundle",
          ".yardoc",
          ".metadata",
          "App_Data",
          "ClientBin",
          ".cargo",
          ".rustc_info",
          ".go",
          "Godeps",
          "_vendor",
          ".rake_tasks",
          "CMakefiles",
          ".wakatime",
          // --- Mobile Dev Madness (Android / iOS / Flutter) ---
          ".dart_tool",
          ".fvm",
          ".cocoapods",
          "Pods",
          ".pub-cache",
          ".symlinks",
          "DerivedData",
          ".xcworkspace",
          // --- Containers, Cloud & Database Dumps ---
          ".serverless",
          ".aws",
          ".gcloud",
          ".azure",
          ".kube",
          ".vagrant",
          ".docker",
          "postgres-data",
          "redis-data",
          "mongo-data",
          // --- OS & System Trash (The Ultimate Sinners) ---
          ".Spotlight-V100",
          ".Trashes",
          "$RECYCLE.BIN",
          "System Volume Information",
          ".DocumentRevisions-V100",
          ".fseventsd",
          // --- Windows AppData & System Clutter ---
          "AppData",
          "Application Data",
          "Local",
          "LocalLow",
          "Roaming",
          "$WinREAgent",
          "$WINDOWS.~BT",
          "$WINDOWS.~WS",
          "scw",
          "System32",
          "SysWOW64",
          // --- macOS Specific Garbage ---
          ".AppleDouble",
          ".AppleDB",
          ".AppleDesktop",
          "_CodeSignature",
          ".cmio",
          ".LSOverride",
          ".localized",
          ".TemporaryItems",
          // --- Linux / Desktop Environment Junk ---
          ".Trash",
          ".Trash-0",
          ".Trash-1000",
          ".gvfs",
          ".local",
          ".config",
          ".dbus",
          ".fontconfig",
          ".snap",
          ".var",
          ".lost+found",
          "lost+found",
          ".thumb",
          ".thumbnails",
          // --- Dual-Boot / Bootloader Stuff ---
          "EFI",
          "boot",
          "grub",
          // --- Linters, Formatters, Logs & QA ---
          "logs",
          "log",
          ".nyc_output",
          ".sonar",
          ".ruff_cache"
        ];
        const safeReaddirWithTypes = (dir) => {
          try {
            return fs20.readdirSync(dir, { withFileTypes: true });
          } catch (e) {
            return [];
          }
        };
        const countFolders = (dir, currentCount = { value: 0 }, depth = 1) => {
          if (currentCount.value > 6200 || depth > 7) return currentCount.value;
          const entries = safeReaddirWithTypes(dir);
          for (const entry of entries) {
            if (currentCount.value > 6200) break;
            if (COLLAPSED_DIRS_GLOBAL.includes(entry.name)) continue;
            if (entry.isDirectory()) {
              currentCount.value++;
              countFolders(path19.join(dir, entry.name), currentCount, depth + 1);
            }
          }
          return currentCount.value;
        };
        const getDirTree = (dir, maxDepth, prefix = "", depth = 1) => {
          const entries = safeReaddirWithTypes(dir);
          const sep = path19.sep;
          if (entries.length > 100) {
            return `${prefix}\u2514\u2500\u2500 ${path19.basename(dir)}${sep} ...100+ files...
`;
          }
          let result = "";
          const COLLAPSED_DIRS = COLLAPSED_DIRS_GLOBAL;
          const filtered = entries.filter((e) => !COLLAPSED_DIRS.includes(e.name));
          const collapsedInDir = entries.filter((e) => COLLAPSED_DIRS.includes(e.name)).map((e) => e.name).sort();
          filtered.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });
          const finalItems = [
            ...filtered.map((e) => ({ name: e.name, isDir: e.isDirectory() })),
            ...collapsedInDir.map((name) => ({ name, isDir: true, isCollapsed: true }))
          ];
          finalItems.forEach((item, index) => {
            const isLast = index === finalItems.length - 1;
            const filePath = path19.join(dir, item.name);
            const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
            const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
            if (item.isCollapsed) {
              result += `${prefix}${connector}${item.name}${sep}...
`;
              return;
            }
            if (item.isDir) {
              if (depth > maxDepth) {
                result += `${prefix}${connector}${item.name}${sep} ...depth exceeded...
`;
              } else {
                const subEntries = safeReaddirWithTypes(filePath);
                if (subEntries.length > 80) {
                  result += `${prefix}${connector}${item.name}${sep} ...80+ files...
`;
                } else {
                  result += `${prefix}${connector}${item.name}${sep}
`;
                  result += getDirTree(filePath, maxDepth, childPrefix, depth + 1);
                }
              }
            } else {
              result += `${prefix}${connector}${item.name}
`;
            }
          });
          return result;
        };
        yield { type: "status", content: "[start]" };
        yield { type: "status", content: "Gathering Context..." };
        await new Promise((resolve) => setTimeout(resolve, 300));
        const totalFolders = countFolders(process.cwd());
        let dynamicMaxDepth = 12;
        if (totalFolders > 4096) dynamicMaxDepth = 1;
        else if (totalFolders > 3072) dynamicMaxDepth = 2;
        else if (totalFolders > 2048) dynamicMaxDepth = 3;
        else if (totalFolders > 1024) dynamicMaxDepth = 4;
        else if (totalFolders > 512) dynamicMaxDepth = 6;
        else if (totalFolders > 256) dynamicMaxDepth = 7;
        else if (totalFolders > 128) dynamicMaxDepth = 8;
        else if (totalFolders > 64) dynamicMaxDepth = 9;
        else if (totalFolders > 32) dynamicMaxDepth = 10;
        const chatPaths = readEncryptedJson(PATHS_FILE, {});
        const lastCwd = chatPaths[chatId];
        const cwdMismatch = lastCwd ? lastCwd !== process.cwd() : false;
        chatPaths[chatId] = process.cwd();
        writeEncryptedJson(PATHS_FILE, chatPaths);
        const summaries = readEncryptedJson(summariesFile, {});
        let chatDataObj = summaries[chatId] || { summary: "", historyLength: 0 };
        if (typeof chatDataObj === "string") {
          chatDataObj = { summary: chatDataObj, historyLength: 0 };
        }
        const currentCleanLen = history.filter((m) => (m.role === "user" || m.role === "agent" || m.role === "system") && !String(m.id).startsWith("welcome") && !m.isMeta).length;
        if (chatDataObj.historyLength && currentCleanLen < chatDataObj.historyLength) {
          chatDataObj.summary = "";
          chatDataObj.historyLength = 0;
          summaries[chatId] = chatDataObj;
          writeEncryptedJson(summariesFile, summaries);
        }
        const currentSummary = typeof chatDataObj === "object" ? chatDataObj.summary || "" : chatDataObj || "";
        const hasExistingTurnsAfterCompression = modifiedHistory.length > 0;
        if (hasExistingTurnsAfterCompression && currentSummary) {
          if (modifiedHistory[0] && (modifiedHistory[0].role === "user" || modifiedHistory[0].role === "system")) {
            if (!modifiedHistory[0].text.includes("**CONTEXT SUMMARY OF PREVIOUS TURNS")) {
              modifiedHistory[0].text = `[SYSTEM METADATA (PRIORITY: HIGH)]
**CONTEXT SUMMARY OF PREVIOUS TURNS (PRIORITY: HIGH)**
${currentSummary}

[USER] ${modifiedHistory[0].text}`;
              yield { type: "summary_injected", content: { id: modifiedHistory[0].id, text: modifiedHistory[0].text } };
            }
          }
        }
        const activeSummaryBlock = currentSummary && !hasExistingTurnsAfterCompression ? `
[SYSTEM METADATA (PRIORITY: HIGH)]
**CONTEXT SUMMARY OF PREVIOUS TURNS (PRIORITY: HIGH)**
${currentSummary}
` : "";
        let dirStructure = process.cwd() + "\n" + getDirTree(process.cwd(), dynamicMaxDepth);
        const ideCtx = await getIDEContext();
        let ideBlock = "";
        if (isBridgeConnected()) {
          ideBlock = "[IDE CONTEXT]\n";
          if (ideCtx.file_focused !== "none") {
            const relFocused = path19.relative(process.cwd(), ideCtx.file_focused);
            const relOpened = (ideCtx.opened_editors || []).map((p) => {
              const rel = path19.relative(process.cwd(), p);
              return rel.startsWith("..") ? `[External] ${path19.basename(p)}` : rel;
            });
            ideBlock += `Focused File: ${relFocused}
Cursor Line: ${ideCtx.cursor_line}
`;
            if (ideCtx.selected) {
              let sel = ideCtx.selected;
              const lines = sel.split("\n");
              if (lines.length > 256) {
                sel = lines.slice(0, 240).join("\n") + "\n... [truncated] ...\n" + lines.slice(-16).join("\n");
              }
              if (sel.length > 2048) {
                sel = sel.slice(0, 1920) + "\n... [truncated] ...\n" + sel.slice(-128);
              }
              ideBlock += `Current Selection: "${sel}"
`;
            }
            if (ideCtx.manual_edits) {
              let edits = ideCtx.manual_edits;
              const lines = edits.split("\n");
              const files = [];
              let currentFile = null;
              for (const line of lines) {
                if (!line.trim()) continue;
                if (line.startsWith("    Line ")) {
                  if (currentFile) {
                    currentFile.edits.push(line);
                  }
                } else {
                  const filePath = line.endsWith(":") ? line.slice(0, -1) : line;
                  currentFile = { path: filePath, edits: [] };
                  files.push(currentFile);
                }
              }
              for (const file of files) {
                if (file.edits.length > 80) {
                  file.edits = file.edits.slice(-80);
                }
                file.originalEditsCount = file.edits.length;
              }
              const getSumForLimit = (limit, activeFiles2) => {
                return activeFiles2.reduce((sum, f) => {
                  const isFocused = ideCtx.file_focused && (f.path === ideCtx.file_focused || path19.resolve(process.cwd(), f.path) === path19.resolve(ideCtx.file_focused));
                  const fileLimit = isFocused ? Math.ceil(limit * 1.2) : limit;
                  return sum + Math.min(f.edits.length, fileLimit);
                }, 0);
              };
              let chosenLimit = 80;
              if (getSumForLimit(80, files) > 300) {
                let found = false;
                for (let L = 80; L >= 10; L--) {
                  if (getSumForLimit(L, files) <= 300) {
                    chosenLimit = L;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  chosenLimit = 10;
                }
              }
              let activeFiles = [...files];
              if (chosenLimit === 10 && getSumForLimit(10, activeFiles) > 500) {
                while (activeFiles.length > 0 && getSumForLimit(10, activeFiles) > 500) {
                  let minIndex = 0;
                  let minVal = activeFiles[0].originalEditsCount;
                  for (let i = 1; i < activeFiles.length; i++) {
                    if (activeFiles[i].originalEditsCount < minVal) {
                      minVal = activeFiles[i].originalEditsCount;
                      minIndex = i;
                    }
                  }
                  activeFiles.splice(minIndex, 1);
                }
              }
              for (const file of activeFiles) {
                const isFocused = ideCtx.file_focused && (file.path === ideCtx.file_focused || path19.resolve(process.cwd(), file.path) === path19.resolve(ideCtx.file_focused));
                const fileLimit = isFocused ? Math.ceil(chosenLimit * 1.2) : chosenLimit;
                if (file.edits.length > fileLimit) {
                  file.edits = file.edits.slice(-fileLimit);
                }
              }
              for (const file of activeFiles) {
                let fileString = `${file.path}:
${file.edits.join("\n")}`;
                while (file.edits.length > 0 && fileString.length > 4 * 768) {
                  file.edits.shift();
                  fileString = `${file.path}:
${file.edits.join("\n")}`;
                }
                if (fileString.length > 4 * 768) {
                  file.stringRepresentation = "... " + fileString.slice(-(4 * 768 - 4));
                } else {
                  file.stringRepresentation = fileString;
                }
              }
              let finalEdits = activeFiles.map((f) => f.stringRepresentation).join("\n");
              while (activeFiles.length > 0 && finalEdits.length > 4 * 2048) {
                if (activeFiles[0].edits.length > 0) {
                  activeFiles[0].edits.shift();
                } else {
                  activeFiles.shift();
                }
                for (const file of activeFiles) {
                  let fileString = `${file.path}:
${file.edits.join("\n")}`;
                  if (fileString.length > 4 * 768) {
                    file.stringRepresentation = "... " + fileString.slice(-(4 * 768 - 4));
                  } else {
                    file.stringRepresentation = fileString;
                  }
                }
                finalEdits = activeFiles.map((f) => f.stringRepresentation).join("\n");
              }
              if (finalEdits.length > 4 * 2048) {
                finalEdits = "... " + finalEdits.slice(-(4 * 2048 - 4));
              }
              ideBlock += `Recent Manual Edits:
${finalEdits}
`;
            }
            if (relOpened.length > 0) ideBlock += `All Opened Editors: ${relOpened.join(", ")}`;
            if (ideCtx.diagnostics) ideBlock += `
**ACTIVE FILE ERRORS**:
${ideCtx.diagnostics}
`;
            const isLintRequest = agentText.toLowerCase().includes("lint") || agentText.toLowerCase().includes("warning");
            if (isLintRequest && ideCtx.warnings) {
              ideBlock += `
**LINT WARNINGS**:
${ideCtx.warnings}
`;
            }
          } else {
            ideBlock += `No file currently focused.`;
          }
        }
        const cleanAgentText = agentText.replace(/\s*\[Prompted on:.*?\]/g, "").trim();
        const tagRegex = /@\[([^\]]+)\]/g;
        let match;
        const tagsFound = [];
        tagRegex.lastIndex = 0;
        while ((match = tagRegex.exec(cleanAgentText)) !== null) {
          tagsFound.push(match[1]);
        }
        let taggedContextBlocks = [];
        let attachedBinaryPart = null;
        for (const tag of tagsFound) {
          try {
            let tagClean = tag.trim().replace(/^["']|["']$/g, "");
            const lineRangeRegex = /[:#]L?(\d+)(?:-L?(\d+))?$/i;
            const matchRange = tagClean.match(lineRangeRegex);
            let filePath = tagClean;
            let startLine = null;
            let endLine = null;
            if (matchRange) {
              startLine = parseInt(matchRange[1], 10);
              endLine = matchRange[2] ? parseInt(matchRange[2], 10) : startLine;
              filePath = tagClean.slice(0, matchRange.index);
            }
            const absPath = path19.resolve(process.cwd(), filePath);
            if (fs20.existsSync(absPath)) {
              const stats = fs20.statSync(absPath);
              if (stats.isFile()) {
                const pathLower = filePath.toLowerCase();
                const isPdf = pathLower.endsWith(".pdf");
                const isOfficeFile = pathLower.endsWith(".docx") || pathLower.endsWith(".doc") || pathLower.endsWith(".ppt") || pathLower.endsWith(".pptx") || pathLower.endsWith(".xls") || pathLower.endsWith(".xlsx");
                const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                const isMultimodalFile = isImage || isPdf || isOfficeFile;
                const isSupported = aiProvider === "Google" || MULTIMODAL_MODELS.includes(modelName);
                if (isMultimodalFile && !isSupported) {
                  let terminalWidth = 115;
                  if (process.stdout.isTTY) {
                    terminalWidth = process.stdout.columns - 5 || 120;
                  }
                  const boxLines = [label];
                  const maxLen = Math.max(...boxLines.map((l) => l.length));
                  const boxWidth = Math.min(maxLen + 4, terminalWidth);
                  const boxTop = `${" ".repeat(boxWidth)}`;
                  const boxMid = boxLines.map((line) => `${line.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`).join("\n");
                  const boxBottom = `${" ".repeat(boxWidth)}`;
                  yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}`) };
                  continue;
                }
                const finalStart = startLine !== null ? startLine : 1;
                let finalEnd = endLine !== null ? endLine : startLine !== null ? startLine : finalStart + 499;
                if (finalEnd - finalStart > 500) {
                  finalEnd = finalStart + 500;
                }
                const argsStr = `path=${JSON.stringify(filePath)}, startLine=${finalStart}, endLine=${finalEnd}`;
                const result = await view_file(argsStr, { isMultiModal: isSupported });
                let isError = false;
                let textResult = "";
                let binPart = null;
                if (typeof result === "string") {
                  if (result.trim().startsWith("ERROR")) {
                    isError = true;
                  } else {
                    textResult = result;
                  }
                } else if (result && typeof result === "object") {
                  if (result.binaryPart) {
                    binPart = result.binaryPart;
                    textResult = result.text || "";
                  } else {
                    isError = true;
                  }
                } else {
                  isError = true;
                }
                if (!isError) {
                  let label2 = "";
                  if (isImage) {
                    label2 = `\u2714  Viewed: ${filePath}`;
                    attachedBinaryPart = binPart;
                  } else if (isPdf || isOfficeFile) {
                    label2 = `\u2714  Viewed: ${filePath}`;
                    attachedBinaryPart = binPart;
                  } else {
                    let totalLines = "...";
                    try {
                      const content = fs20.readFileSync(absPath, "utf8");
                      totalLines = content.split("\n").length;
                    } catch (e) {
                    }
                    label2 = `\u2714  Auto-Read: ${filePath} \u2192 Lines ${finalStart} - ${Math.min(finalEnd, totalLines)} of ${totalLines}`;
                    taggedContextBlocks.push(textResult);
                  }
                  if (label2) {
                    let terminalWidth = 115;
                    if (process.stdout.isTTY) {
                      terminalWidth = process.stdout.columns - 5 || 120;
                    }
                    const boxLines = [label2];
                    const maxLen = Math.max(...boxLines.map((l) => l.length));
                    const boxWidth = Math.min(maxLen + 4, terminalWidth);
                    const boxMid = boxLines.map((line) => `${line.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`).join("\n");
                    const boxBottom = `${" ".repeat(boxWidth)}`;
                    yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}`) };
                  }
                }
              }
            }
          } catch (e) {
          }
        }
        let taggedContextStr = "";
        if (taggedContextBlocks.length > 0) {
          taggedContextStr = "[TAGGED CONTEXT]\n" + taggedContextBlocks.join("\n\n") + "\n[/TAGGED CONTEXT]\n";
        }
        const osDetected = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
        const firstUserMsg = `[SYSTEM METADATA (PRIORITY: DYNAMIC), Chat Context >> Metadata] Time: ${dateTimeStr}
OS: ${osDetected}
CWD: ${process.cwd()}${isPlayground ? " [PLAYGROUND MODE]" : ""}${cwdMismatch ? ` (WARNING: CWD Mismatch! Previous Path: ${lastCwd})` : ""}
**DIRECTORY STRUCTURE**
${dirStructure}${memoryPrompt}${ideBlock}
${activeSummaryBlock}${thinkingLevel !== "Fast" && thinkingLevel !== "xHigh" && aiProvider === "Google" ? `${modelName.toLowerCase().startsWith("gemma") ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n" : ""}` : ""}${taggedContextStr}[USER] ${cleanAgentText.trim()} [/USER]`.trim();
        const userMsgObj = { role: "user", text: firstUserMsg };
        if (attachedBinaryPart) {
          userMsgObj.binaryPart = attachedBinaryPart;
        }
        modifiedHistory.push(userMsgObj);
        if (activeSummaryBlock && history[history.length - 1]?.id) {
          yield { type: "summary_injected", content: { id: history[history.length - 1].id, text: firstUserMsg } };
        }
        let lastUsage = null;
        const MAX_LOOPS = mode === "Flux" ? 70 : 7;
        const MAX_RETRIES = 16;
        yield { type: "status", content: "Connecting..." };
        TERMINATION_SIGNAL = false;
        let fullAgentResponseChunks = [];
        let wasToolCalledInLastLoop = false;
        modifiedHistory.forEach((msg) => {
          if (msg.text && msg.role === "agent") {
            msg.text = msg.text.replace(/(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])/gi, "");
            msg.text = msg.text.replace(/(?:<(think|thought)>|\[(think|thought)\])[^\[\n]*/gi, "").trim();
          }
        });
        for (let loop = 0; loop <= MAX_LOOPS; loop++) {
          wasToolCalledInLastLoop = false;
          if (systemSettings?.compression === 0 && (sessionStats?.tokens || 0) > contextTruncationCount) {
            modifiedHistory = getTruncatedHistory(modifiedHistory, 6);
          }
          if (loop > 0) {
            yield { type: "status", content: "Working..." };
          }
          if (TERMINATION_SIGNAL) {
            yield { type: "status", content: "Request Cancelled" };
            yield { type: "text", content: "\n\n\x1B[33m\u24D8 Request Cancelled\x1B[0m" };
            break;
          }
          if (steeringCallback) {
            const hint = await steeringCallback();
            if (hint) {
              if (hint.startsWith("/btw")) {
                if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === "user") {
                  modifiedHistory[modifiedHistory.length - 1].text += `

[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY [/SYSTEM]
[QUESTION] ${hint.replace("/btw", "").trim()} [/QUESTION]`;
                } else {
                  modifiedHistory.push({ role: "user", text: `${thinkingLevel !== "Fast" && thinkingLevel !== "xHigh" && aiProvider === "Google" ? `${modelName.toLowerCase().startsWith("gemma") ? "[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY\n**STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n" : ""}` : ""}[QUESTION] ${hint.replace("/btw", "").trim()} [/QUESTION]` });
                }
              } else {
                if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === "user") {
                  modifiedHistory[modifiedHistory.length - 1].text += `

[STEERING HINT] ${hint.trim()} [/STEERING HINT]`;
                } else {
                  modifiedHistory.push({ role: "user", text: `${thinkingLevel !== "Fast" && thinkingLevel !== "xHigh" && aiProvider === "Google" ? `${modelName.toLowerCase().startsWith("gemma") ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n" : ""}` : ""}[STEERING HINT] ${hint.trim()} [/STEERING HINT]` });
                }
              }
              yield { type: "status", content: `${hint.startsWith("/btw") ? "Question Forwarded..." : "Steering Hint Injected..."}` };
            }
          }
          let stream;
          let success = false;
          let retryCount = 1;
          let inStreamRetryCount = 1;
          let turnText = "";
          let lastToolSniffed = null;
          let lastToolDetail = null;
          let lastToolEventTime = null;
          let lastToolFinishedAt = 0;
          let toolResults = [];
          let toolCallPointer = 0;
          let anyToolExecutedInThisTurn = false;
          let isThinkingLoop = false;
          let isStutteringLoop = false;
          let isGeneralLoop = false;
          let isInitialAttempt = true;
          let lastLoopCheckLen = 0;
          let accumulatedContext = "";
          let dedupeBuffer = "";
          let isDedupeActive = false;
          let targetModel = modelName;
          let currentSystemInstruction = "";
          while (retryCount <= MAX_RETRIES && inStreamRetryCount <= MAX_RETRIES && !success && !TERMINATION_SIGNAL) {
            let inThinkingState = false;
            try {
              turnText = "";
              if (isInitialAttempt) {
                if (process.stdout.isTTY) {
                  process.stdout.write(`\x1B]0;Working...\x07`);
                }
                yield { type: "turn_reset", content: true };
                yield { type: "spinner", content: true };
                isInitialAttempt = false;
                if (inStreamRetryCount === 1) {
                  accumulatedContext = "";
                }
              }
              const contents = modifiedHistory.filter((msg) => (msg.role === "user" || msg.role === "agent" || msg.role === "system") && !String(msg.id).startsWith("welcome") && !msg.isMeta && !msg.isTerminalRecord && !(msg.text && msg.text.startsWith("[TERMINAL_RECORD]"))).map((msg, idx, arr) => {
                let text = msg.text || "";
                if (msg.role === "agent") {
                  text = text.replace(/\[turn:\s*finish\]/gi, "").replace(/\[\[END\]\]/gi, "").trim();
                }
                const parts = [{ text }];
                if (msg.binaryPart && isModelMultimodal(targetModel)) {
                  const physicalUserTurnsAfter = arr.slice(idx + 1).filter((m) => m.role === "user" && !m.text?.startsWith("[TOOL RESULT]")).length;
                  if (physicalUserTurnsAfter <= 2) {
                    parts.push(msg.binaryPart);
                  }
                }
                return {
                  role: msg.role === "user" || msg.role === "system" ? "user" : "model",
                  parts
                };
              });
              for (let i = 0; i < contents.length; i++) {
                const msg = contents[i];
                const text = msg.parts?.[0]?.text || "";
                if (msg.role === "model" && /\[tool:/i.test(text)) {
                  let resultIdx = -1;
                  for (let j = i + 1; j < contents.length; j++) {
                    const nextMsg = contents[j];
                    const nextText = nextMsg.parts?.[0]?.text || "";
                    if (nextMsg.role === "user" && nextText.startsWith("[TOOL RESULT]")) {
                      resultIdx = j;
                      break;
                    }
                  }
                  if (resultIdx !== -1 && resultIdx !== i + 1) {
                    const [resultMsg] = contents.splice(resultIdx, 1);
                    contents.splice(i + 1, 0, resultMsg);
                  }
                }
              }
              for (let i = contents.length - 2; i >= 0; i--) {
                const current = contents[i];
                const next = contents[i + 1];
                if (current.role === "user" && next.role === "user") {
                  const nextText = next.parts?.[0]?.text || "";
                  if (nextText.trim().startsWith("[SYSTEM")) {
                    contents.splice(i, 1);
                  }
                }
              }
              const finalContents = [];
              for (let i = 0; i < contents.length; i++) {
                const current = contents[i];
                if (finalContents.length === 0) {
                  finalContents.push(current);
                } else {
                  const last = finalContents[finalContents.length - 1];
                  if (last.role === current.role) {
                    last.parts[0].text += "\n\n" + (current.parts?.[0]?.text || "");
                    if (current.parts?.length > 1) {
                      last.parts.push(...current.parts.slice(1));
                    }
                  } else {
                    finalContents.push(current);
                  }
                }
              }
              contents.length = 0;
              contents.push(...finalContents);
              if (!await checkQuota("agent", settings)) {
                throw new Error("Error: Quota Exausted for Agent");
              }
              targetModel = modelName;
              if (aiProvider === "DeepSeek" && thinkingLevel === "Fast" && targetModel.includes("flash")) {
                targetModel = "deepseek-chat";
              }
              if (retryCount === MAX_RETRIES - 1) {
                targetModel = aiProvider === "DeepSeek" ? "deepseek-v4-flash" : "gemini-3-flash-preview";
                yield { type: "model_update", content: "Trying with fallback model" };
              } else if (retryCount === MAX_RETRIES) {
                targetModel = aiProvider === "DeepSeek" ? "deepseek-v4-pro" : "gemini-3.5-flash";
                yield { type: "model_update", content: "Trying with fallback model" };
              } else if (retryCount > 12 && retryCount < MAX_RETRIES - 2 && settings.apiKey !== "custom") {
                targetModel = "gemma-4-31b-it";
                yield { type: "model_update", content: "Trying with fallback Gemma Model" };
              } else if (retryCount > 0) {
                yield { type: "model_update", content: null };
              }
              currentSystemInstruction = getSystemInstruction(profile, !(targetModel || "gemma").toLowerCase().startsWith("gemma") ? thinkingLevel : thinkingLevel, mode, systemSettings, isMemoryEnabled, isFirstPrompt, aiProvider, aiProvider === "Google" ? true : isMultiModal, !(targetModel || "gemma").toLowerCase().startsWith("gemma") ? true : false);
              const lastUserMsg = contents[contents.length - 1];
              if (isBridgeConnected() & loop > 0) {
                yield { type: "status", content: "Verifying..." };
                await new Promise((resolve) => setTimeout(resolve, 2500));
                const ideCtxJIT = await getIDEContext();
                const ideErr = ideCtxJIT ? ideCtxJIT.diagnostics : null;
                if (ideErr && lastUserMsg && lastUserMsg.role === "user" && lastUserMsg.parts?.[0]?.text) {
                  lastUserMsg.parts[0].text += `
${ideErr} [/ERROR]`;
                }
                yield { type: "status", content: "Working..." };
              }
              const isGemma = modelName && modelName.toLowerCase().startsWith("gemma") && aiProvider === "Google";
              if (isGemma) {
                const jitInstruction = `
[SYSTEM] Tool result received. Analyze output and proceed with your turn${thinkingLevel !== "Fast" && thinkingLevel !== "xHigh" && aiProvider === "Google" ? `. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**` : ""} [/SYSTEM]`;
                if (lastUserMsg && lastUserMsg.role === "user" && lastUserMsg.parts?.[0]?.text?.startsWith("[TOOL RESULT]")) {
                  lastUserMsg.parts[0].text += jitInstruction;
                }
              }
              if (isGemma) {
                const stepThreshold = Math.floor(MAX_LOOPS * (mode === "Flux" ? 0.98 : 0.7));
                const currentStep = loop + 1;
                if (currentStep >= stepThreshold && lastUserMsg && lastUserMsg.parts?.[0]) {
                  lastUserMsg.parts[0].text += `
[SYSTEM] WARNING, Turn Limit Impending: Step ${currentStep}/${MAX_LOOPS}. Wrap up quickly/prompt user to continue & use [[END]] quickly. [/SYSTEM]`;
                }
              }
              const abortPromise = new Promise((_, reject) => {
                if (abortController.signal.aborted) {
                  reject(new DOMException("The user aborted a request.", "AbortError"));
                }
                abortController.signal.addEventListener("abort", () => {
                  reject(new DOMException("The user aborted a request.", "AbortError"));
                });
              });
              let activeContents = contents;
              if (aiProvider === "OpenRouter") {
                stream = getOpenRouterStream(
                  settings.apiKey,
                  targetModel,
                  activeContents,
                  currentSystemInstruction,
                  thinkingLevel,
                  mode,
                  isMultiModal,
                  abortController.signal,
                  0.95
                );
              } else if (aiProvider === "DeepSeek") {
                stream = getDeepSeekStream(
                  settings.apiKey,
                  targetModel,
                  activeContents,
                  currentSystemInstruction,
                  thinkingLevel,
                  mode,
                  isMultiModal,
                  abortController.signal,
                  0.99
                );
              } else if (aiProvider === "NVIDIA") {
                stream = getNVIDIAStream(
                  settings.apiKey,
                  targetModel,
                  activeContents,
                  currentSystemInstruction,
                  thinkingLevel,
                  mode,
                  isMultiModal,
                  abortController.signal,
                  0.99
                );
              } else {
                const apiCallPromise = client.models.generateContentStream({
                  model: targetModel || "gemini-3-flash-preview",
                  contents: activeContents,
                  config: {
                    systemInstruction: currentSystemInstruction,
                    mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
                    temperature: 1,
                    safetySettings: [
                      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                    ],
                    thinkingConfig: (() => {
                      const modelLower = (targetModel || "").toLowerCase();
                      const isGemma4 = modelLower.includes("gemma-4") || modelLower.startsWith("gemma");
                      const isGemini3 = modelLower.includes("gemini-3");
                      if (isGemma4 || isGemini3) {
                        if (isGemma4) {
                          if (thinkingLevel.toLowerCase() !== "xhigh" || false) return { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL };
                          else return { includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH };
                        }
                        return {
                          includeThoughts: true,
                          thinkingLevel: {
                            "Fast": modelLower.includes("pro") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
                            "Low": ThinkingLevel.LOW,
                            "Medium": ThinkingLevel.MEDIUM,
                            "Standard": ThinkingLevel.MEDIUM,
                            "High": ThinkingLevel.HIGH,
                            "xHigh": ThinkingLevel.HIGH
                          }[thinkingLevel] || ThinkingLevel.MEDIUM
                        };
                      } else {
                        const budget = {
                          "Fast": 0,
                          "Low": 512,
                          "Medium": 2048,
                          "Standard": 2048,
                          "High": 16384,
                          "xHigh": 24576
                        }[thinkingLevel] || 2048;
                        if (budget === 0) {
                          return { includeThoughts: false };
                        }
                        return {
                          includeThoughts: true,
                          thinkingBudget: budget
                        };
                      }
                    })()
                  }
                }, { signal: abortController.signal });
                stream = await Promise.race([apiCallPromise, abortPromise]);
              }
              turnText = "";
              lastToolSniffed = null;
              lastToolEventTime = null;
              toolResults = [];
              toolCallPointer = 0;
              yield { type: "model_update", content: null };
              dedupeBuffer = "";
              isDedupeActive = accumulatedContext.length > 0;
              let pendingGoogleText = "";
              let lastGoogleFlushTime = Date.now();
              const flushGoogleBuffer2 = async function* () {
                if (aiProvider === "Google" && pendingGoogleText) {
                  const msgs = getBufferedMessages(pendingGoogleText);
                  for (const m of msgs) yield m;
                  pendingGoogleText = "";
                  lastGoogleFlushTime = Date.now();
                }
              };
              let isFirstChunk = true;
              let toolCallBuffer = "";
              let isBufferingToolCall = false;
              let activeBufferType = null;
              const getBufferedMessages = (text) => {
                const msgs = [];
                let remaining = text;
                while (remaining.length > 0) {
                  if (!isBufferingToolCall) {
                    const toolIdx = remaining.indexOf("[tool");
                    const agentIdx = remaining.indexOf("[agent");
                    const endIdx = remaining.indexOf("[[END]]");
                    const kimiSectionIdx = remaining.indexOf("<|tool_calls_section_begin|>");
                    const kimiCallIdx = remaining.indexOf("<|tool_call_begin|>");
                    const indices = [
                      { type: "tool", idx: toolIdx, start: "[tool", end: "]" },
                      { type: "agent", idx: agentIdx, start: "[agent", end: "]" },
                      { type: "end", idx: endIdx, start: "[[END]]", end: "[[END]]" },
                      { type: "kimi_section", idx: kimiSectionIdx, start: "<|tool_calls_section_begin|>", end: "<|tool_calls_section_end|>" },
                      { type: "kimi_call", idx: kimiCallIdx, start: "<|tool_call_begin|>", end: "<|tool_call_end|>" }
                    ].filter((i) => i.idx !== -1).sort((a, b) => a.idx - b.idx);
                    if (indices.length > 0) {
                      const match2 = indices[0];
                      if (match2.idx > 0) {
                        msgs.push({ type: "text", content: remaining.substring(0, match2.idx) });
                      }
                      isBufferingToolCall = true;
                      activeBufferType = match2.type;
                      toolCallBuffer = "";
                      remaining = remaining.substring(match2.idx);
                    } else {
                      const potentialStarts = ["[tool", "[agent", "[[END]]", "<|tool_calls_section_begin|>", "<|tool_call_begin|>"];
                      let splitPoint = -1;
                      for (const start of potentialStarts) {
                        for (let len = start.length - 1; len > 0; len--) {
                          if (remaining.endsWith(start.substring(0, len))) {
                            splitPoint = remaining.length - len;
                            const idx = potentialStarts.indexOf(start);
                            if (idx === 0) activeBufferType = "tool";
                            else if (idx === 1) activeBufferType = "agent";
                            else if (idx === 2) activeBufferType = "end";
                            else if (idx === 3) activeBufferType = "kimi_section";
                            else activeBufferType = "kimi_call";
                            break;
                          }
                        }
                        if (splitPoint !== -1) break;
                      }
                      if (splitPoint !== -1) {
                        if (splitPoint > 0) {
                          msgs.push({ type: "text", content: remaining.substring(0, splitPoint) });
                        }
                        isBufferingToolCall = true;
                        toolCallBuffer = remaining.substring(splitPoint);
                        remaining = "";
                      } else {
                        msgs.push({ type: "text", content: remaining });
                        break;
                      }
                    }
                  } else {
                    const combined = toolCallBuffer + remaining;
                    if (activeBufferType === "tool" || activeBufferType === "agent") {
                      const protocolPrefix = activeBufferType === "tool" ? "[tool:functions." : "[agent:generalist.";
                      const startPrefix = activeBufferType === "tool" ? "[tool" : "[agent";
                      if (!combined.startsWith(startPrefix) || combined.length >= protocolPrefix.length && !combined.startsWith(protocolPrefix)) {
                        msgs.push({ type: "text", content: combined });
                        toolCallBuffer = "";
                        isBufferingToolCall = false;
                        activeBufferType = null;
                        remaining = "";
                        break;
                      }
                    }
                    let endIdx = -1;
                    let endTag = "]";
                    if (activeBufferType === "tool" || activeBufferType === "agent") {
                      let balance = 0;
                      let inString = null;
                      let bracketBalance = 0;
                      let passedParen = false;
                      for (let i = 0; i < combined.length; i++) {
                        const char = combined[i];
                        if (inString) {
                          if (char === inString) {
                            let backslashCount = 0;
                            for (let j = i - 1; j >= 0 && combined[j] === "\\"; j--) {
                              backslashCount++;
                            }
                            if (backslashCount % 2 === 0) {
                              inString = null;
                            }
                          }
                        } else {
                          if (char === '"' || char === "'" || char === "`") {
                            inString = char;
                          } else if (char === "(") {
                            balance++;
                            passedParen = true;
                          } else if (char === ")") {
                            balance--;
                          } else if (char === "[") {
                            bracketBalance++;
                          } else if (char === "]") {
                            if (passedParen && balance === 0 && bracketBalance === 1) {
                              endIdx = i;
                              break;
                            }
                            bracketBalance--;
                          }
                        }
                      }
                    } else {
                      if (activeBufferType === "end") endTag = "[[END]]";
                      else if (activeBufferType === "kimi_section") endTag = "<|tool_calls_section_end|>";
                      else if (activeBufferType === "kimi_call") endTag = "<|tool_call_end|>";
                      endIdx = combined.indexOf(endTag);
                    }
                    if (endIdx !== -1) {
                      const endLen = endTag.length;
                      if (!activeBufferType.startsWith("kimi")) {
                        const fullMatch = combined.substring(0, endIdx + endLen);
                        msgs.push({ type: "text", content: fullMatch });
                      }
                      toolCallBuffer = "";
                      isBufferingToolCall = false;
                      activeBufferType = null;
                      remaining = combined.substring(endIdx + endLen);
                    } else {
                      const MAX_BUFFER = activeBufferType.startsWith("kimi") ? 8192 : 512;
                      if (combined.length > MAX_BUFFER) {
                        if (!activeBufferType.startsWith("kimi")) {
                          msgs.push({ type: "text", content: combined });
                        }
                        toolCallBuffer = "";
                        isBufferingToolCall = false;
                      } else {
                        toolCallBuffer = combined;
                      }
                      remaining = "";
                      break;
                    }
                  }
                }
                return msgs;
              };
              const iterator = stream[Symbol.asyncIterator]();
              while (true) {
                const { value: chunk, done } = await Promise.race([
                  iterator.next(),
                  abortPromise
                ]);
                if (done) break;
                if (isFirstChunk) {
                  yield { type: "status", content: "Thinking..." };
                  isFirstChunk = false;
                }
                if (TERMINATION_SIGNAL) {
                  yield { type: "status", content: "Request Cancelled" };
                  yield { type: "text", content: "\n\n\x1B[33m\u24D8 Request Cancelled\x1B[0m" };
                  break;
                }
                let chunkText = "";
                const parts = chunk.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.thought) {
                      if (part.text) {
                        if (!inThinkingState) {
                          chunkText += "<think>";
                          inThinkingState = true;
                        }
                        chunkText += part.text;
                      }
                    } else if (part.text) {
                      if (inThinkingState) {
                        chunkText += "</think>";
                        inThinkingState = false;
                      }
                      chunkText += part.text;
                    }
                  }
                } else {
                  const t = chunk.text || "";
                  if (t && inThinkingState) {
                    chunkText += "</think>";
                    inThinkingState = false;
                  }
                  chunkText += t;
                }
                if (chunkText) {
                  if (isDedupeActive) {
                    dedupeBuffer += chunkText;
                    if (dedupeBuffer.length >= 64) {
                      let overlapLen = 0;
                      const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);
                      for (let len = maxPossibleOverlap; len >= 10; len--) {
                        if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                          overlapLen = len;
                          break;
                        }
                      }
                      const cleanText = dedupeBuffer.substring(overlapLen);
                      if (cleanText) {
                        const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                        const dedupeClean = hasOpenThink ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "") : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, "").replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "");
                        if (dedupeClean) {
                          turnText += dedupeClean;
                          if (aiProvider === "Google") {
                            pendingGoogleText += dedupeClean;
                          } else {
                            yield* flushGoogleBuffer2();
                            const msgs = getBufferedMessages(dedupeClean);
                            for (const m of msgs) yield m;
                          }
                        }
                      }
                      isDedupeActive = false;
                      dedupeBuffer = "";
                    }
                    continue;
                  } else {
                    turnText += chunkText;
                    if (aiProvider === "Google") {
                      pendingGoogleText += chunkText;
                    } else {
                      yield* flushGoogleBuffer2();
                      const msgs = getBufferedMessages(chunkText);
                      for (const m of msgs) yield m;
                    }
                  }
                  const toolContext = getActiveToolContext(turnText);
                  if (toolContext.inside) {
                    if (!lastToolEventTime) lastToolEventTime = Date.now();
                    const NORMALIZE_MAP = {
                      "Ask": "ask",
                      "WebSearch": "web_search",
                      "WebScrape": "web_scrape",
                      "ReadFile": "view_file",
                      "ReadFolder": "read_folder",
                      "WriteFile": "write_file",
                      "PatchFile": "update_file",
                      "WritePDF": "write_pdf",
                      "WriteDoc": "write_docx",
                      "Run": "exec_command",
                      "SearchKeyword": "search_keyword",
                      "Memory": "memory",
                      "file_map": "file_map",
                      "FileMap": "file_map",
                      "Chat": "chat",
                      "chat": "chat",
                      "GenerateImage": "generate_image",
                      "generate_image": "generate_image",
                      "todo": "todo",
                      "Todo": "todo",
                      "invoke": "invoke",
                      "invokeSync": "invoke_sync",
                      "getProgress": "get_progress",
                      "await": "await",
                      "Await": "await"
                    };
                    const potentialTool = NORMALIZE_MAP[toolContext.toolName] || toolContext.toolName;
                    const partialArgs = toolContext.args || "";
                    let detail = null;
                    if (["write_file", "update_file", "view_file", "read_folder", "write_pdf", "write_docx", "search_keyword", "generate_image", "file_map", "invoke", "invoke_sync", "get_progress", "await"].includes(potentialTool)) {
                      const pArgs = parseArgs(partialArgs);
                      const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
                      const keyword = pArgs.keyword;
                      const title = pArgs.title || pArgs.task;
                      const id = pArgs.id || pArgs.taskId;
                      const timeVal = pArgs.time;
                      if (keyword) {
                        detail = keyword.replace(/["']/g, "");
                      } else if (filePath) {
                        detail = path19.basename(filePath.replace(/["']/g, "").replace(/\\/g, "/"));
                      } else if (title && (potentialTool === "invoke" || potentialTool === "invoke_sync")) {
                        detail = title.replace(/["']/g, "").substring(0, 30);
                      } else if (id && potentialTool === "get_progress") {
                        detail = id.replace(/["']/g, "");
                      } else if (timeVal && potentialTool === "await") {
                        let sec = parseFloat(timeVal.replace(/["']/g, ""));
                        if (!isNaN(sec)) {
                          if (sec < 5) sec = 5;
                          if (sec > 120) sec = 120;
                          const formatTime = (s) => {
                            if (s >= 60) {
                              const m = Math.floor(s / 60);
                              const rem = s % 60;
                              return `${m}m${rem > 0 ? ` ${rem}s` : ""}`;
                            }
                            return `${s}s`;
                          };
                          detail = formatTime(sec);
                        } else {
                          detail = timeVal.replace(/["']/g, "");
                        }
                      } else {
                        const m = partialArgs.match(/(?:path|targetFile|TargetFile|directory|keyword|id|taskId|title|task)\s*=\s*\\?["']?([^\\"' \),]+)/);
                        if (m) {
                          const val = m[1].replace(/["']/g, "");
                          if (potentialTool === "invoke" || potentialTool === "invoke_sync" || potentialTool === "get_progress") {
                            detail = val.substring(0, 30);
                          } else {
                            detail = potentialTool === "search_keyword" || potentialTool === "file_map" ? val : path19.basename(val.replace(/\\/g, "/"));
                          }
                        }
                      }
                    }
                    const currentLabel = `${TOOL_LABELS2[potentialTool] || potentialTool}${detail ? ` (${detail})` : ""}`;
                    if (potentialTool !== lastToolSniffed || detail !== lastToolDetail) {
                      lastToolSniffed = potentialTool;
                      lastToolDetail = detail;
                      yield { type: "status", content: `${currentLabel}...` };
                      if (process.stdout.isTTY) {
                        const TOOL_TITLES = {
                          "web_search": "Searching",
                          "web_scrape": "Reading",
                          "view_file": "Reading",
                          "read_folder": "Reading",
                          "list_files": "Reading",
                          "write_file": "Writing",
                          "update_file": "Editing",
                          "write_pdf": "Creating",
                          "write_docx": "Creating",
                          "search_keyword": "Searching",
                          "exec_command": "Executing",
                          "ask": "User Input",
                          "memory": "Updating Memory",
                          "generate_image": "Generating"
                        };
                        const toolTitle = TOOL_TITLES[potentialTool] || "Working";
                        process.stdout.write(`\x1B]0;${toolTitle}...\x07`);
                      }
                    }
                  }
                  if (turnText.length - lastLoopCheckLen > 150) {
                    lastLoopCheckLen = turnText.length;
                    const contextSafeText = getContextSafeText(turnText, false);
                    const thinkBlocks = contextSafeText.match(/(?:<think>|\[think\])([\s\S]*?)(?:<\/think>|\[\/think\]|$)/gi) || [];
                    const thinkContent = thinkBlocks.join("").trim();
                    const sentences = thinkContent.split(/[.!?]\s+/);
                    const uniqueSentences = new Set(sentences);
                    const repetitionRatio = sentences.length > 10 ? (sentences.length - uniqueSentences.size) / sentences.length : 0;
                    const wordCount = thinkContent.split(/\s+/).filter((w) => w.length > 0).length;
                    let repetitionThresholdThinking = 0.4;
                    let repetitionThresholdResponse = 0.6;
                    let isOverVerboseThinking = false;
                    if ((targetModel || "").toLowerCase().startsWith("gemma")) {
                      const thinkingCaps = {
                        "low": 256,
                        "medium": 768,
                        "high": 2048,
                        "max": 4096,
                        "xhigh": 4096
                      };
                      const cap = thinkingCaps[thinkingLevel?.toLowerCase()] || 2500;
                      isOverVerboseThinking = wordCount > cap;
                    }
                    if (repetitionRatio > repetitionThresholdThinking || isOverVerboseThinking) {
                      const reason = repetitionRatio > repetitionThresholdThinking ? "Reasoning Loop Detected" : "Thinking Budget Exceeded";
                      yield { type: "status", content: `${reason}. Re-centering...` };
                      isThinkingLoop = true;
                      await new Promise((resolve) => setTimeout(resolve, 3e3));
                      break;
                    }
                    const signalSafeText3 = getSanitizedText(turnText);
                    const responseContent = signalSafeText3.trim();
                    const respSentences = responseContent.split(/[.!?]\s+/);
                    const uniqueRespSentences = new Set(respSentences);
                    const respRepetitionRatio = respSentences.length > 10 ? (respSentences.length - uniqueRespSentences.size) / respSentences.length : 0;
                    if (respRepetitionRatio > repetitionThresholdResponse) {
                      yield { type: "status", content: `Response Loop Detected. Re-centering...` };
                      isThinkingLoop = false;
                      isGeneralLoop = true;
                      await new Promise((resolve) => setTimeout(resolve, 3e3));
                      break;
                    }
                    const allWords = contextSafeText.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
                    let stutterDetected = false;
                    if (allWords.length > 5) {
                      for (let p = 1; p <= 15; p++) {
                        const R = Math.max(3, Math.ceil(8 / p));
                        if (allWords.length < p * R) continue;
                        let isRepeating = true;
                        const pattern = allWords.slice(allWords.length - p);
                        const patternStr = pattern.join(" ");
                        for (let r = 1; r < R; r++) {
                          const prevPattern = allWords.slice(allWords.length - p * (r + 1), allWords.length - p * r);
                          if (prevPattern.join(" ") !== patternStr) {
                            isRepeating = false;
                            break;
                          }
                        }
                        if (isRepeating) {
                          stutterDetected = true;
                          break;
                        }
                      }
                    }
                    if (!stutterDetected) {
                      const cleanChars = contextSafeText.toLowerCase().replace(/[^a-z0-9]/gi, "");
                      if (cleanChars.length >= 10) {
                        for (let p = 1; p <= 10; p++) {
                          const R = Math.max(4, Math.ceil(12 / p));
                          if (cleanChars.length < p * R) continue;
                          const pattern = cleanChars.substring(cleanChars.length - p);
                          let isRepeating = true;
                          for (let r = 1; r < R; r++) {
                            const prevPattern = cleanChars.substring(cleanChars.length - p * (r + 1), cleanChars.length - p * r);
                            if (prevPattern !== pattern) {
                              isRepeating = false;
                              break;
                            }
                          }
                          if (isRepeating) {
                            stutterDetected = true;
                            break;
                          }
                        }
                      }
                    }
                    if (stutterDetected) {
                      yield { type: "status", content: `Stuttering Detected. Re-centering...` };
                      isThinkingLoop = false;
                      isStutteringLoop = true;
                      await new Promise((resolve) => setTimeout(resolve, 3e3));
                      break;
                    }
                  }
                  const toolActionableText = turnText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, "");
                  const allToolsFound = detectToolCalls(toolActionableText);
                  while (allToolsFound.length > toolCallPointer) {
                    yield* flushGoogleBuffer2();
                    const toolCall = allToolsFound[toolCallPointer];
                    const executionStart = Date.now();
                    const NORMALIZE_MAP = {
                      "Ask": "ask",
                      "WebSearch": "web_search",
                      "WebScrape": "web_scrape",
                      "ReadFile": "view_file",
                      "ReadFolder": "read_folder",
                      "WriteFile": "write_file",
                      "PatchFile": "update_file",
                      "WritePDF": "write_pdf",
                      "WriteDoc": "write_docx",
                      "Run": "exec_command",
                      "SearchKeyword": "search_keyword",
                      "Memory": "memory",
                      "file_map": "file_map",
                      "FileMap": "file_map",
                      "Chat": "chat",
                      "chat": "chat",
                      "GenerateImage": "generate_image",
                      "generate_image": "generate_image",
                      "todo": "todo",
                      "Todo": "todo",
                      "invoke": "invoke",
                      "invokeSync": "invoke_sync",
                      "getProgress": "get_progress",
                      "await": "await",
                      "Await": "await"
                    };
                    const normToolName = NORMALIZE_MAP[toolCall.toolName] || toolCall.toolName;
                    const displayLabel = TOOL_LABELS2[normToolName] || toolCall.toolName;
                    const detail = getToolDetail(normToolName, toolCall.args);
                    yield { type: "status", content: `${displayLabel}${detail ? ` (${detail})` : ""}...` };
                    let label2 = "";
                    if (normToolName === "web_search") {
                      const { query, limit = 10 } = parseArgs(toolCall.args);
                      label2 = `\u2714  Searched: ${query} \u2192 ${limit}`;
                    } else if (normToolName === "web_scrape") {
                      const url = parseArgs(toolCall.args).url || "...";
                      label2 = `\u2714  Visited: ${url}`;
                    } else if (normToolName === "view_file") {
                      const { path: targetPath2, StartLine, EndLine, start_line, end_line, startLine, endLine } = parseArgs(toolCall.args);
                      const rawStart = StartLine || start_line || startLine;
                      const rawEnd = EndLine || end_line || endLine;
                      const sLine = parseInt(rawStart) || 1;
                      const eLine = parseInt(rawEnd) || (rawStart ? sLine + 800 : 800);
                      let totalLines = "...";
                      let actualEndLine = eLine;
                      try {
                        const absPath = path19.resolve(process.cwd(), targetPath2);
                        if (fs20.existsSync(absPath)) {
                          const content = fs20.readFileSync(absPath, "utf8");
                          const lines = content.split("\n").length;
                          totalLines = lines;
                          actualEndLine = Math.min(eLine, lines);
                        }
                      } catch (e) {
                      }
                      const pathLower = targetPath2.toLowerCase();
                      const isPdf = pathLower.endsWith(".pdf");
                      const isOfficeFile = pathLower.endsWith(".docx") || pathLower.endsWith(".doc") || pathLower.endsWith(".ppt") || pathLower.endsWith(".pptx") || pathLower.endsWith(".xls") || pathLower.endsWith(".xlsx");
                      const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                      if (isPdf || isOfficeFile) {
                        label2 = `\u2714  Viewed: ${targetPath2}`;
                      } else if (isImage) {
                        label2 = `\u2714  Viewed: ${targetPath2}`;
                      } else {
                        label2 = `${totalLines !== "..." ? "\u2714" : "\u2717"}  Read: ${targetPath2} \u2192 ${totalLines !== "..." ? `Lines ${sLine} - ${actualEndLine} of ${totalLines}` : "File Not Found"}`;
                      }
                    } else if (normToolName === "list_files" || normToolName === "read_folder") {
                      const action = normToolName === "list_files" ? "List" : "Viewed";
                      const path21 = parseArgs(toolCall.args).path;
                      label2 = `\u2714  ${action}: ${path21 === "." ? "./" : path21}`;
                    } else if (normToolName === "write_file" || normToolName === "update_file") {
                      const action = normToolName === "write_file" ? "Created" : "Edited";
                      label2 = `\u2714  ${action}: ${parseArgs(toolCall.args).path || "..."}`;
                    } else if (normToolName === "write_pdf") {
                      label2 = `\u2714  Created: ${parseArgs(toolCall.args).path || "..."}`;
                    } else if (normToolName === "write_docx") {
                      label2 = `\u2714  Created: ${parseArgs(toolCall.args).path || "..."}`;
                    } else if (normToolName === "file_map") {
                      label2 = `\u2714  Get Map: ${parseArgs(toolCall.args).path || "..."}`;
                    } else if (normToolName.toLowerCase() === "search_keyword" || normToolName.toLowerCase() === "todo") {
                      label2 = "";
                    } else if (normToolName.toLowerCase() === "generate_image") {
                      const { path: argPath, outputPath, output } = parseArgs(toolCall.args);
                      label2 = `\u2714  Generated: ${argPath || outputPath || output || "generated_image.png"}`;
                    } else if (normToolName === "invoke_sync" || normToolName === "invoke") {
                      const detail2 = getToolDetail(normToolName, toolCall.args);
                      label2 = `\u2714  Elevating SubAgent${detail2 ? `: ${detail2}` : ""}`;
                    } else if (normToolName === "get_progress") {
                      const detail2 = getToolDetail(normToolName, toolCall.args);
                      label2 = `\u2714  Checked${detail2 ? `: ${detail2}` : ""}`;
                    } else if (normToolName === "await") {
                      const { time } = parseArgs(toolCall.args);
                      let sec = parseFloat(time) || 0;
                      if (sec < 10) sec = 10;
                      if (sec > 180) sec = 180;
                      const formatTime = (s) => {
                        if (s >= 60) {
                          const m = Math.floor(s / 60);
                          const rem = s % 60;
                          return `${m}m${rem > 0 ? ` ${rem}s` : ""}`;
                        }
                        return `${s}s`;
                      };
                      label2 = `\u2714  Awaiting \u2192 ${formatTime(sec)}`;
                    } else if (normToolName === "exec_command" || normToolName === "ask") {
                      label2 = "";
                    } else {
                      label2 = `Executed: ${toolCall.toolName}`;
                    }
                    yield* flushGoogleBuffer2();
                    if (normToolName === "exec_command") {
                      const { command } = parseArgs(toolCall.args);
                      if (command && settings.systemSettings && settings.systemSettings.allowExternalAccess === false) {
                        const riskyPatterns = [/[a-zA-Z]:[\\\/]/i, /^\//, /\.\.[\\\/]/, /\/etc\//, /\/var\//, /\/root\//, /\/bin\//, /\/usr\//];
                        const currentDrive = path19.resolve(process.cwd()).substring(0, 3).toLowerCase();
                        const splitCommands = (cmdString) => {
                          const commands = [];
                          let current = "";
                          let inQuote = null;
                          for (let i = 0; i < cmdString.length; i++) {
                            const char = cmdString[i];
                            if (inQuote) {
                              if (char === inQuote) inQuote = null;
                              current += char;
                            } else {
                              if (char === '"' || char === "'") {
                                inQuote = char;
                                current += char;
                              } else if (char === "&" && cmdString[i + 1] === "&" || char === "|" && cmdString[i + 1] === "|") {
                                if (current.trim()) {
                                  commands.push(current.trim());
                                  current = "";
                                }
                                i++;
                              } else if (char === ";" || char === "|" || char === "&") {
                                if (current.trim()) {
                                  commands.push(current.trim());
                                  current = "";
                                }
                              } else {
                                current += char;
                              }
                            }
                          }
                          if (current.trim()) {
                            commands.push(current.trim());
                          }
                          return commands;
                        };
                        const tokenizeCommand = (cmd) => {
                          const tokens = [];
                          let current = "";
                          let inQuote = null;
                          for (let i = 0; i < cmd.length; i++) {
                            const char = cmd[i];
                            if (inQuote) {
                              if (char === inQuote) {
                                inQuote = null;
                                current += char;
                              } else {
                                current += char;
                              }
                            } else {
                              if (char === '"' || char === "'") {
                                inQuote = char;
                                current += char;
                              } else if (/\s/.test(char)) {
                                if (current) {
                                  tokens.push(current);
                                  current = "";
                                }
                              } else {
                                current += char;
                              }
                            }
                          }
                          if (current) {
                            tokens.push(current);
                          }
                          return tokens;
                        };
                        const checkToken = (token) => {
                          const cleanToken = token.replace(/^['"]|['"]$/g, "").trim();
                          if (!cleanToken) return false;
                          if (process.platform === "win32" && /^\/[a-zA-Z0-9?]+$/.test(cleanToken)) {
                            return false;
                          }
                          return riskyPatterns.some((pattern) => {
                            if (pattern.source === "[a-zA-Z]:[\\\\\\/]") {
                              const driveMatch = cleanToken.match(/[a-zA-Z]:[\\\/]/i);
                              return driveMatch && driveMatch[0].toLowerCase() !== currentDrive;
                            }
                            return pattern.test(cleanToken);
                          });
                        };
                        const commandParts = splitCommands(command);
                        const isViolating = commandParts.some((cmdPart) => {
                          const tokens = tokenizeCommand(cmdPart);
                          if (tokens.length === 0) return false;
                          const exe = tokens[0].replace(/^['"]|['"]$/g, "").toLowerCase();
                          const isSafePrint = ["echo", "printf", "write-output"].includes(exe);
                          if (isSafePrint) {
                            let checkNext = false;
                            return tokens.some((token) => {
                              const clean = token.replace(/^['"]|['"]$/g, "");
                              if (clean === ">" || clean === ">>" || clean === "<") {
                                checkNext = true;
                                return false;
                              }
                              if (clean.startsWith(">") || clean.startsWith("<")) {
                                const pathPart = clean.replace(/^[><]+/, "");
                                return checkToken(pathPart);
                              }
                              if (checkNext) {
                                checkNext = false;
                                return checkToken(token);
                              }
                              return false;
                            });
                          }
                          return tokens.some((token) => checkToken(token));
                        });
                        if (isViolating) {
                          const denyMsg = `Access Denied. Prohibited from accessing external directories while "External Workspace Access" is disabled.`;
                          if (settings.onExecStart) settings.onExecStart(command || "Unknown");
                          yield { type: "exec_start" };
                          await new Promise((resolve) => setTimeout(resolve, 50));
                          if (settings.onExecChunk) settings.onExecChunk(`ERROR: ${denyMsg}`);
                          await new Promise((resolve) => setTimeout(resolve, 50));
                          if (settings.onExecEnd) settings.onExecEnd();
                          toolResults.push({ role: "user", text: `[TOOL RESULT]: ERROR: ${denyMsg}` });
                          yield { type: "tool_result", content: `[TOOL RESULT]: ERROR: ${denyMsg}` };
                          toolCallPointer++;
                          continue;
                        }
                      }
                      if (settings.onExecStart) settings.onExecStart(command || "Unknown");
                      yield { type: "exec_start" };
                    }
                    const parsedArgs = parseArgs(toolCall.args);
                    const targetPath = parsedArgs.path || parsedArgs.targetPath || null;
                    if (targetPath) {
                      const isExternalOff = settings.systemSettings && settings.systemSettings.allowExternalAccess === false;
                      const absoluteTarget = path19.resolve(targetPath);
                      const absoluteCwd = path19.resolve(process.cwd());
                      if (isExternalOff && !absoluteTarget.startsWith(absoluteCwd)) {
                        const denyMsg = `Access Denied. You are not allowed to access files outside the current workspace.`;
                        if (normToolName === "write_file" || normToolName === "update_file") {
                          const action = normToolName === "write_file" ? "Write Canceled" : "Edit Canceled";
                          const deniedLabel = `\u2717 ${action}: ${parsedArgs.path || "..."}`;
                          let terminalWidth = 115;
                          if (process.stdout.isTTY) {
                            terminalWidth = process.stdout.columns - 5 || 120;
                          }
                          const boxWidth = Math.min(deniedLabel.length + 4, terminalWidth);
                          const boxMid = `${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                          const boxBottom = ` ${" ".repeat(boxWidth)} `;
                          yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}`) };
                        }
                        toolResults.push({ role: "user", text: `[TOOL RESULT]: ERROR: ${denyMsg}` });
                        yield { type: "tool_result", content: `[TOOL RESULT]: ERROR: ${denyMsg}` };
                        toolCallPointer++;
                        continue;
                      }
                    }
                    if (settings.onToolApproval) {
                      let shouldPrompt = normToolName === "write_file" || normToolName === "update_file" || normToolName === "exec_command";
                      if (shouldPrompt) {
                        const systemSettings2 = settings.systemSettings || {};
                        const autoExec = systemSettings2.autoExec;
                        let decision = null;
                        let forcePrompt = false;
                        let disallowMatch = false;
                        let isNetworkDeny = false;
                        if (normToolName === "exec_command") {
                          const { command } = parseArgs(toolCall.args);
                          const cmdTrimmed = (command || "").trim();
                          const matchesList = (cmd, csv) => {
                            if (!csv) return false;
                            const list = csv.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
                            const lowerCmd = cmd.toLowerCase();
                            return list.some((item) => lowerCmd.startsWith(item));
                          };
                          const askMatch = matchesList(cmdTrimmed, systemSettings2.alwaysAskCommands);
                          const approveMatch = matchesList(cmdTrimmed, systemSettings2.autoApproveCommands);
                          disallowMatch = matchesList(cmdTrimmed, systemSettings2.autoDisallowCommands);
                          if (askMatch) {
                            forcePrompt = true;
                          } else if (approveMatch) {
                            decision = "allow";
                          } else if (systemSettings2.autoApproveGit && /^git\s+commit\b/i.test(cmdTrimmed)) {
                            decision = "allow";
                          }
                          if (!forcePrompt && !decision) {
                            if (systemSettings2.networkAccess === false) {
                              let normalized = cmdTrimmed.trim().replace(/\s+/g, " ").replace(/^['"]+|['"]+$/g, "").toLowerCase();
                              const tokens = normalized.split(" ");
                              const rawCmd = tokens[0];
                              const cmd = rawCmd.split("/").pop().split("\\").pop().replace(/\.exe$/, "");
                              const blockedCommands = /* @__PURE__ */ new Set([
                                "curl",
                                "wget",
                                "httpie",
                                "xh",
                                "ssh",
                                "scp",
                                "sftp",
                                "rsync",
                                "ftp",
                                "lftp",
                                "tftp",
                                "telnet",
                                "nc",
                                "netcat",
                                "socat",
                                "ping",
                                "traceroute",
                                "tracert",
                                "dig",
                                "nslookup",
                                "host",
                                "whois",
                                "nmap",
                                "docker",
                                "podman",
                                "kubectl",
                                "helm",
                                "gcloud",
                                "aws",
                                "az",
                                "terraform",
                                "ansible-playbook",
                                "nix",
                                "nix-env",
                                "apt",
                                "apt-get",
                                "dpkg",
                                "yum",
                                "dnf",
                                "pacman",
                                "zypper",
                                "brew",
                                "apk",
                                "choco",
                                "scoop",
                                "conda",
                                "mamba",
                                "aria2c",
                                "axel",
                                "smbclient",
                                "lynx",
                                "w3m",
                                "links",
                                "elinks",
                                "heroku",
                                "netlify",
                                "vercel",
                                "firebase",
                                "supabase",
                                "wrangler",
                                "flyctl",
                                "powershell",
                                "pwsh",
                                "certutil",
                                "bitsadmin",
                                "cloudflared",
                                "ngrok",
                                "tailscale",
                                "zerotier",
                                "rclone"
                              ]);
                              let deny = false;
                              if (blockedCommands.has(cmd)) {
                                deny = true;
                              }
                              const hasSubcmd = (list) => tokens.slice(1).some((token) => list.includes(token));
                              const shouldDenyPkgManager = (dangerCommands) => {
                                const dangerIdx = tokens.findIndex((t) => dangerCommands.includes(t));
                                const safeIdx = tokens.findIndex((t) => ["run", "exec", "test"].includes(t));
                                return dangerIdx !== -1 && !(safeIdx !== -1 && safeIdx < dangerIdx);
                              };
                              if (cmd === "git" && hasSubcmd(["clone", "pull", "push", "fetch"])) deny = true;
                              if (cmd === "go" && hasSubcmd(["get", "install"])) deny = true;
                              if (cmd === "npm" && shouldDenyPkgManager(["install", "i", "update", "add"])) deny = true;
                              if (cmd === "yarn" && shouldDenyPkgManager(["add", "install", "upgrade"])) deny = true;
                              if (cmd === "pnpm" && shouldDenyPkgManager(["add", "install", "update"])) deny = true;
                              if (cmd === "bun" && shouldDenyPkgManager(["add", "install", "update"])) deny = true;
                              if (cmd === "deno" && hasSubcmd(["install", "add"])) deny = true;
                              if (cmd === "pip" && hasSubcmd(["install", "download"])) deny = true;
                              if (cmd === "pip3" && hasSubcmd(["install", "download"])) deny = true;
                              if (cmd === "cargo" && hasSubcmd(["install", "add"])) deny = true;
                              if (["bash", "sh", "zsh", "fish"].includes(cmd) && hasSubcmd(["-c"])) deny = true;
                              if (cmd === "cmd" && hasSubcmd(["/c"])) deny = true;
                              if (deny) {
                                decision = "deny";
                                isNetworkDeny = true;
                              }
                            }
                            if (!decision && disallowMatch) {
                              decision = "deny";
                            }
                          }
                          if (!forcePrompt && !decision && autoExec) {
                            decision = "allow";
                          }
                        } else {
                          if (autoExec) {
                            decision = "allow";
                          }
                        }
                        let approval = decision;
                        let denyReason = "";
                        if (decision === "deny") {
                          if (isNetworkDeny) {
                            denyReason = "network";
                          } else if (disallowMatch) {
                            denyReason = "settings";
                          } else {
                            denyReason = "prohibited";
                          }
                        }
                        let diffOpened = false;
                        let originalContentForReporting = "";
                        let patchResults = [];
                        let requestedPatchCount = 0;
                        let isNewFileCreated = false;
                        if (!approval) {
                          if (normToolName === "write_file" || normToolName === "update_file") {
                            try {
                              const toolArgs = parseArgs(toolCall.args);
                              const { path: filePath } = toolArgs;
                              if (filePath) {
                                const absPath = path19.resolve(process.cwd(), filePath);
                                const normalize = (p) => p ? p.toLowerCase().replace(/\\/g, "/").replace(/^[a-z]:/, (m) => m.toUpperCase()) : "";
                                const normAbsPath = normalize(absPath);
                                let originalContent = "";
                                let hasOriginal = false;
                                const currentIDE = await getIDEContext();
                                const normFocused = normalize(currentIDE?.file_focused);
                                if (currentIDE && normFocused === normAbsPath && currentIDE.full_content) {
                                  originalContent = currentIDE.full_content;
                                  hasOriginal = true;
                                } else if (fs20.existsSync(absPath)) {
                                  originalContent = fs20.readFileSync(absPath, "utf8");
                                  hasOriginal = true;
                                }
                                originalContentForReporting = originalContent;
                                await RevertManager.recordFileChange(absPath, originalContent);
                                if (hasOriginal) {
                                  let modifiedContent = originalContent;
                                  if (normToolName === "write_file") {
                                    modifiedContent = toolArgs.content || toolArgs.newContent || "";
                                  } else {
                                    const { patchPairs: patches, error: parseError } = parsePatchPairs(toolArgs);
                                    if (parseError) {
                                      const errorMsg = `[TOOL RESULT]: ERROR: ${parseError}`;
                                      toolResults.push({ role: "user", text: errorMsg });
                                      await incrementUsage("toolFailure");
                                      if (settings.onToolResult) settings.onToolResult("failure", normToolName);
                                      yield { type: "tool_result", content: errorMsg, toolName: normToolName };
                                      toolCallPointer++;
                                      continue;
                                    }
                                    requestedPatchCount = patches.length;
                                    const sim = applyPatches(originalContent, patches);
                                    modifiedContent = sim.content;
                                    patchResults = sim.results;
                                    const successes = patchResults.filter((r) => r.success);
                                    const failures = patchResults.filter((r) => !r.success);
                                    if (successes.length === 0) {
                                      const errorMsg = `[TOOL RESULT]: ERROR: Failed to apply patches to [${path19.basename(absPath)}].
${failures.map((f) => `  \u2022 ${f.error}`).join("\n")}`;
                                      const errorLabel = `\u2714  Edited: ${path19.basename(absPath)}`.toUpperCase();
                                      let terminalWidth = 115;
                                      if (process.stdout.isTTY) {
                                        terminalWidth = process.stdout.columns - 5 || 120;
                                      }
                                      const boxWidth = Math.min(errorLabel.length + 4, terminalWidth);
                                      const boxMid = `${errorLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                      const boxBottom = ` ${" ".repeat(boxWidth)} `;
                                      yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}}`) };
                                      toolResults.push({ role: "user", text: errorMsg });
                                      await incrementUsage("toolFailure");
                                      if (settings.onToolResult) settings.onToolResult("failure", normToolName);
                                      yield { type: "tool_result", content: errorMsg, toolName: normToolName };
                                      toolCallPointer++;
                                      continue;
                                    }
                                  }
                                  yield { type: "status", content: `Opening Diff in IDE: ${path19.basename(absPath)}...` };
                                  showDiffInIDE(absPath, originalContent, modifiedContent);
                                  diffOpened = true;
                                  await new Promise((r) => setTimeout(r, 50));
                                } else if (normToolName === "write_file") {
                                  const rawContent = toolArgs.content || toolArgs.newContent || "";
                                  const modifiedContent = rawContent.endsWith("\n") ? rawContent : rawContent + "\n";
                                  if (!fs20.existsSync(absPath)) {
                                    isNewFileCreated = true;
                                    fs20.mkdirSync(path19.dirname(absPath), { recursive: true });
                                    fs20.writeFileSync(absPath, "", "utf8");
                                  }
                                  yield { type: "status", content: `Opening New File Diff in IDE: ${path19.basename(absPath)}...` };
                                  showDiffInIDE(absPath, "", modifiedContent);
                                  diffOpened = true;
                                  await new Promise((r) => setTimeout(r, 50));
                                }
                              }
                            } catch (e) {
                              console.error("Simulation/Diff Error:", e);
                            }
                          }
                          let ideDecision = null;
                          registerSecurityListener((res) => {
                            ideDecision = res;
                          });
                          const originalApproval = settings.onToolApproval;
                          approval = await new Promise(async (resolve) => {
                            const pollInterval = setInterval(() => {
                              if (ideDecision) {
                                if (globalSettings.onIDEApproval) globalSettings.onIDEApproval(ideDecision);
                                clearInterval(pollInterval);
                                resolve(ideDecision);
                              }
                            }, 100);
                            try {
                              const res = await originalApproval(normToolName, toolCall.args);
                              clearInterval(pollInterval);
                              resolve(res);
                            } catch (e) {
                              clearInterval(pollInterval);
                              resolve("deny");
                            }
                          });
                          registerSecurityListener(null);
                          if (normToolName === "write_file" || normToolName === "update_file") {
                            const { path: filePath } = parseArgs(toolCall.args);
                            if (filePath) {
                              const absPath = path19.resolve(process.cwd(), filePath);
                              closeDiffInIDE(absPath, approval);
                              if (approval === "deny" && isNewFileCreated && fs20.existsSync(absPath)) {
                                try {
                                  fs20.unlinkSync(absPath);
                                } catch (e) {
                                }
                              }
                            }
                          }
                          if (approval === "deny") {
                            denyReason = "user";
                          }
                        }
                        if (approval === "allow" && diffOpened && isBridgeConnected()) {
                          const { path: filePath } = parseArgs(toolCall.args);
                          const absPath = path19.resolve(process.cwd(), filePath);
                          const finalIDE = await getIDEContext();
                          let finalContent = "";
                          if (finalIDE && finalIDE.file_focused === absPath && finalIDE.full_content) {
                            finalContent = finalIDE.full_content;
                          } else if (fs20.existsSync(absPath)) {
                            finalContent = fs20.readFileSync(absPath, "utf8");
                          }
                          const verifiedLines = finalContent.split(/\r?\n/);
                          const verifiedLineCount = verifiedLines.length;
                          const verifiedSize = Buffer.byteLength(finalContent, "utf8");
                          let ancestry = "";
                          if (originalContentForReporting) {
                            const oldLines = originalContentForReporting.split(/\r?\n/);
                            ancestry = `Old File contents:
${oldLines.map((l, i) => `${i + 1} | ${l}`).join("\n")}

`;
                          }
                          let snippet = "";
                          if (verifiedLineCount <= 200) {
                            snippet = verifiedLines.join("\n");
                          } else {
                            const head = verifiedLines.slice(0, 100).join("\n");
                            const tail = verifiedLines.slice(-100).join("\n");
                            snippet = `${head}

... [${verifiedLineCount - 200} lines truncated for history stability] ...

${tail}`;
                          }
                          let result2 = "";
                          if (normToolName === "update_file") {
                            const diffReport = generateHighFidelityDiff(originalContentForReporting, finalContent, patchResults, 12);
                            result2 = `SUCCESS: File [${filePath}] updated via IDE Companion (May have user edits). [${patchResults.length}/${requestedPatchCount}] blocks applied.

${diffReport}`;
                          } else {
                            const verifiedLines2 = finalContent.split(/\r?\n/);
                            const verifiedLineCount2 = verifiedLines2.length;
                            const verifiedSize2 = Buffer.byteLength(finalContent, "utf8");
                            let ancestry2 = "";
                            if (originalContentForReporting) {
                              const oldLines = originalContentForReporting.split(/\r?\n/);
                              ancestry2 = `Old File contents:
${oldLines.map((l, i) => `${i + 1} | ${l}`).join("\n")}

`;
                            }
                            let snippet2 = "";
                            if (verifiedLineCount2 <= 200) {
                              snippet2 = verifiedLines2.join("\n");
                            } else {
                              const head = verifiedLines2.slice(0, 100).join("\n");
                              const tail = verifiedLines2.slice(-100).join("\n");
                              snippet2 = `${head}

... [${verifiedLineCount2 - 200} lines truncated] ...

${tail}`;
                            }
                            result2 = `SUCCESS: File [${filePath}] saved via IDE Companion (May have user edits).

- Stats: [${verifiedLineCount2} lines, ${(verifiedSize2 / 1024).toFixed(1)} KB]
${ancestry2}- Content Preview:
${snippet2}

[SYSTEM] Check the content preview for verification [/SYSTEM]`;
                          }
                          const action = normToolName === "write_file" ? "Created" : "Edited";
                          const feedbackLabel = `\u2714 ${action}: ${filePath || "..."}`;
                          let terminalWidth = 115;
                          if (process.stdout.isTTY) {
                            terminalWidth = process.stdout.columns - 5 || 120;
                          }
                          const boxWidth = Math.min(feedbackLabel.length + 4, terminalWidth);
                          const boxMid = `${feedbackLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                          yield { type: "visual_feedback", content: colorMainWords(`
${boxMid}`) };
                          const toolEnd2 = Date.now();
                          lastToolFinishedAt = toolEnd2;
                          yield { type: "tool_time", content: toolEnd2 - executionStart };
                          const aiContent2 = `[TOOL RESULT]: ${result2}`;
                          toolResults.push({ role: "user", text: aiContent2 });
                          anyToolExecutedInThisTurn = true;
                          await incrementUsage("toolSuccess");
                          if (settings.onToolResult) settings.onToolResult("success", normToolName);
                          yield { type: "tool_result", content: result2, aiContent: aiContent2, toolName: normToolName };
                          toolCallPointer++;
                          continue;
                        }
                        if (approval === "deny") {
                          let denyMsg = `Permission Denied: Prohibited ${normToolName === "exec_command" ? "Command" : "file edit"}.`;
                          if (denyReason === "user") {
                            denyMsg = "Permission Denied by User";
                          } else if (denyReason === "settings") {
                            denyMsg = "Permission Denied by User Policy";
                          } else if (denyReason === "network") {
                            denyMsg = "Permission Denied: Sandbox Network Access Disabled by User Policy.";
                          } else if (denyReason === "prohibited" && normToolName === "exec_command") {
                            denyMsg = "Permission Denied: Prohibited Command in User Policy";
                          }
                          if (normToolName === "write_file" || normToolName === "update_file") {
                            const action = normToolName === "write_file" ? "Write Cancelled" : "Edit Denied";
                            const deniedLabel = `\u2717 ${action}: ${parseArgs(toolCall.args).path || "..."}`.toUpperCase();
                            let terminalWidth = 115;
                            if (process.stdout.isTTY) {
                              terminalWidth = process.stdout.columns - 5 || 120;
                            }
                            const boxWidth = Math.min(deniedLabel.length + 4, terminalWidth);
                            const boxMid = `${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                            const boxBottom = ` ${" ".repeat(boxWidth)} `;
                            yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}`) };
                          }
                          if (normToolName === "exec_command") {
                            await new Promise((resolve) => setTimeout(resolve, 50));
                            if (settings.onExecChunk) settings.onExecChunk(`ERROR: ${denyMsg}`);
                            await new Promise((resolve) => setTimeout(resolve, 50));
                            if (settings.onExecEnd) settings.onExecEnd();
                          }
                          toolResults.push({ role: "user", text: `[TOOL RESULT]: DENIED: ${denyMsg}` });
                          yield { type: "tool_result", content: `[TOOL RESULT]: DENIED: ${denyMsg}` };
                          await incrementUsage("toolDenied");
                          if (settings.onToolResult) settings.onToolResult("denied", normToolName);
                          toolCallPointer++;
                          continue;
                        }
                      }
                    }
                    if (label2) {
                      let terminalWidth = 115;
                      if (process.stdout.isTTY) {
                        terminalWidth = process.stdout.columns - 5 || 120;
                      }
                      const boxWidth = Math.min(label2.length + 4, terminalWidth);
                      const boxMid = `${label2.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                      const boxBottom = ` ${" ".repeat(boxWidth)} `;
                      yield { type: "visual_feedback", content: colorMainWords(`
${boxMid}${boxMid.includes("Created") || boxMid.includes("Edited") || boxMid.includes("Written") ? "" : `
${boxBottom}`}`) };
                    }
                    if (lastToolFinishedAt > 0) {
                      const timeSinceLastTool = Date.now() - lastToolFinishedAt;
                      if (timeSinceLastTool < 1e3) {
                        await new Promise((resolve) => setTimeout(resolve, 1e3 - timeSinceLastTool));
                      }
                    }
                    yield { type: "spinner", content: false };
                    let execToolContext = {
                      chatId,
                      history,
                      onChunk: (chunk2) => settings.onExecChunk ? settings.onExecChunk(chunk2) : null,
                      onAskUser: settings.onAskUser,
                      systemSettings: settings.systemSettings,
                      mode,
                      isMultiModal: isModelMultimodal(targetModel),
                      onVisualFeedback: settings.onVisualFeedback,
                      onSubagentUpdate: settings.onSubagentUpdate,
                      modelName: targetModel,
                      aiProvider: settings.aiProvider,
                      apiKey: settings.apiKey,
                      onUsage: settings.onUsage
                    };
                    if (normToolName === "write_file" || normToolName === "update_file") {
                      try {
                        const { path: filePath } = parseArgs(toolCall.args);
                        if (filePath) {
                          const absPath = path19.resolve(process.cwd(), filePath);
                          const currentIDE = await getIDEContext();
                          if (currentIDE && currentIDE.file_focused === absPath && currentIDE.full_content) {
                            execToolContext.forcedContent = currentIDE.full_content;
                          }
                        }
                      } catch (e) {
                      }
                    }
                    let result = await dispatchTool(normToolName, toolCall.args, execToolContext);
                    yield { type: "spinner", content: true };
                    if ((normToolName === "write_file" || normToolName === "update_file") && result.startsWith("SUCCESS")) {
                      const { path: filePath } = parseArgs(toolCall.args);
                      if (filePath) {
                        const absPath = path19.resolve(process.cwd(), filePath);
                        openFileInEditor(absPath);
                      }
                    }
                    if (process.stdout.isTTY) {
                      process.stdout.write(`\x1B]0;Working...\x07`);
                    }
                    const toolEnd = Date.now();
                    lastToolFinishedAt = toolEnd;
                    yield { type: "tool_time", content: toolEnd - executionStart };
                    lastToolEventTime = toolEnd;
                    let binaryPart = null;
                    if (typeof result === "object" && result.binaryPart) {
                      binaryPart = result.binaryPart;
                      result = result.text;
                    }
                    if (normToolName === "search_keyword") {
                      const { keyword, file } = parseArgs(toolCall.args);
                      let matchCount = 0;
                      if (result) {
                        const m = result.match(/Found (\d+) match/i);
                        if (m) {
                          matchCount = parseInt(m[1]);
                        }
                      }
                      const postLabel = `\u2714  Searched: "${keyword}" in ${file ? `"${file}"` : "./"} \u2192 ${matchCount} Match${matchCount === 1 ? "" : "es"}`;
                      let terminalWidth = 115;
                      if (process.stdout.isTTY) {
                        terminalWidth = process.stdout.columns - 5 || 120;
                      }
                      const boxWidth = Math.min(postLabel.length + 4, terminalWidth);
                      const boxMid = `${postLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                      const boxBottom = ` ${" ".repeat(boxWidth)} `;
                      yield { type: "visual_feedback", content: colorMainWords(`${boxBottom}
${boxMid}
`) };
                    }
                    if (normToolName === "todo") {
                      const { method, tasks, markDone } = parseArgs(toolCall.args);
                      let uiTitle = "";
                      let listItems = [];
                      const normalizeList = (input) => {
                        if (!input) return [];
                        let items = Array.isArray(input) ? input : [];
                        if (items.length === 0 && typeof input === "string") {
                          const trimmed = input.trim();
                          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                            const matches = trimmed.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g);
                            if (matches) {
                              items = matches.map((m) => m.slice(1, -1).replace(/\\(.)/g, "$1"));
                            } else {
                              items = trimmed.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
                            }
                          } else {
                            items = input.split("\n");
                          }
                        }
                        return items.filter((l) => String(l).trim()).map((l) => {
                          const t = String(l).trim();
                          return t.startsWith("- [") ? t.substring(6).trim() : t;
                        });
                      };
                      if (method === "create") {
                        uiTitle = "\x1B[32m\u2192\x1B[0m Created Plan";
                        listItems = normalizeList(tasks).map((item) => `\x1B[90m\u25CB\x1B[0m ${item}`);
                      } else if (method === "append") {
                        uiTitle = "\x1B[34m\u2795\x1B[0m Added Plan";
                        listItems = normalizeList(tasks).map((item) => `\x1B[90m\u25CB\x1B[0m ${item}`);
                      } else if (method === "get") {
                        uiTitle = markDone ? "\x1B[36m\u21BB\x1B[0m Updated Plan" : "\x1B[35m\u2022\x1B[0m Reviewed Plan";
                        const content = (result || "").split("\n").slice(1).join("\n");
                        listItems = content.split("\n").filter((line) => line.trim().startsWith("- [")).map((line) => {
                          const trimmed = line.trim();
                          const isDone = trimmed.startsWith("- [x]");
                          const icon = isDone ? "\x1B[32m\u2714\x1B[0m" : "\x1B[90m\u25CB\x1B[0m";
                          const textColor = isDone ? "\x1B[90m" : "\x1B[37m";
                          return `${icon} ${textColor}${trimmed.substring(6).trim()}\x1B[0m`;
                        });
                      }
                      if (uiTitle && listItems.length > 0) {
                        const output = [
                          `${uiTitle}`,
                          // Clean title with a slight indent aligned with other feedbacks
                          ...listItems.map((item) => `    ${item}`),
                          // Sub-indented items for that premium look
                          ""
                          // Bottom padding spacing
                        ].join("\n");
                        yield { type: "visual_feedback", content: `
${colorMainWords(output)}` };
                      }
                    }
                    if (normToolName === "exec_command" && settings.onExecEnd) {
                      await new Promise((resolve) => setTimeout(resolve, 800));
                      settings.onExecEnd();
                    }
                    const isDenied = result && result.startsWith("DENIED:");
                    const isSuccess = result && !result.startsWith("ERROR:") && !isDenied;
                    if (isSuccess) {
                      await incrementUsage("toolSuccess");
                      if (settings.onToolResult) settings.onToolResult("success", normToolName);
                    } else if (isDenied) {
                    } else {
                      await incrementUsage("toolFailure");
                      if (settings.onToolResult) settings.onToolResult("failure", normToolName);
                    }
                    const aiContent = `[TOOL RESULT]: ${(result || "").toString().replaceAll("[UI_CONTEXT]", "[CONTEXT]")}`;
                    toolResults.push({ role: "user", text: aiContent, binaryPart });
                    anyToolExecutedInThisTurn = true;
                    let uiContent = `[TOOL RESULT]: ${result || ""}`;
                    if (normToolName === "view_file" || normToolName === "web_scrape" || normToolName === "file_map") {
                      uiContent = `[TOOL RESULT]: ${label2} (Context Locked for UI Clarity)`;
                    }
                    yield { type: "tool_result", content: uiContent, aiContent, binaryPart, toolName: normToolName };
                    if (normToolName === "memory" && result.includes("SUCCESS")) yield { type: "memory_updated" };
                    toolCallPointer++;
                  }
                  if (aiProvider === "Google" && pendingGoogleText && Date.now() - lastGoogleFlushTime >= 150) {
                    yield* flushGoogleBuffer2();
                    const msgs = getBufferedMessages(pendingGoogleText);
                    for (const m of msgs) yield m;
                    pendingGoogleText = "";
                    lastGoogleFlushTime = Date.now();
                  }
                }
                if (chunk.usageMetadata) {
                  lastUsage = chunk.usageMetadata;
                }
                if (lastUsage) {
                  yield { type: "liveTokens", content: lastUsage.totalTokenCount };
                }
              }
              if (inThinkingState) {
                inThinkingState = false;
                if (isDedupeActive) {
                  dedupeBuffer += "</think>";
                } else {
                  turnText += "</think>";
                  if (aiProvider === "Google") {
                    pendingGoogleText += "</think>";
                  } else {
                    yield { type: "text", content: "</think>" };
                  }
                }
              }
              if (isDedupeActive && dedupeBuffer.length > 0) {
                let overlapLen = 0;
                const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);
                for (let len = maxPossibleOverlap; len > 0; len--) {
                  if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                    overlapLen = len;
                    break;
                  }
                }
                const cleanText = dedupeBuffer.substring(overlapLen);
                if (cleanText) {
                  const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                  const dedupeClean = hasOpenThink ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "") : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, "").replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "");
                  if (dedupeClean) {
                    turnText += dedupeClean;
                    if (aiProvider === "Google") {
                      pendingGoogleText += dedupeClean;
                    } else {
                      yield* flushGoogleBuffer2();
                      const msgs = getBufferedMessages(dedupeClean);
                      for (const m of msgs) yield m;
                    }
                  }
                }
                isDedupeActive = false;
                dedupeBuffer = "";
              }
              yield* flushGoogleBuffer2();
              if (TERMINATION_SIGNAL) break;
              const signalSafeText2 = (turnText || "").trim();
              const hasFinish2 = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText2.toLowerCase()) || /\[\[END\]\]/i.test(signalSafeText2.toLowerCase());
              const hasContinue2 = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText2.toLowerCase());
              const didCallTool = toolResults.length > 0 || lastToolSniffed !== null;
              const pureOutputText = signalSafeText2.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/gi, "").trim();
              const endsWithEmoji = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u.test(pureOutputText);
              const superSneakyRegex = /([.!?"'*_`|\]\)”’~~]+|\s|`{3}|[\u200B-\u200D\uFEFF])$/u;
              const endsWithFormatting = superSneakyRegex.test(pureOutputText.trim());
              const endsNormally = /[.!?}"'`’“”]$|```$/s.test(pureOutputText) || endsWithFormatting || endsWithEmoji;
              if (!hasFinish2 && !hasContinue2 && !didCallTool && signalSafeText2.length > 0 && !endsNormally && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop) {
              }
              success = true;
              await incrementUsage("agent", aiProvider);
            } catch (err) {
              if (TERMINATION_SIGNAL) {
                yield { type: "status", content: "Request Cancelled" };
                yield { type: "text", content: "\n\n\x1B[33m\u24D8 Request Cancelled\x1B[0m" };
                break;
              }
              if (String(err).includes("Incomplete JSON segment at the end")) {
                if (inThinkingState) {
                  inThinkingState = false;
                  if (isDedupeActive) {
                    dedupeBuffer += "</think>";
                  } else {
                    turnText += "</think>";
                    yield { type: "text", content: "</think>" };
                  }
                }
                success = true;
                await incrementUsage("agent", aiProvider);
                break;
              }
              if (inThinkingState) {
                inThinkingState = false;
                if (isDedupeActive) {
                  dedupeBuffer += "</think>";
                } else {
                  turnText += "</think>";
                }
              }
              if (isDedupeActive && dedupeBuffer.length > 0) {
                let overlapLen = 0;
                const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);
                for (let len = maxPossibleOverlap; len > 0; len--) {
                  if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                    overlapLen = len;
                    break;
                  }
                }
                const cleanText = dedupeBuffer.substring(overlapLen);
                if (cleanText) {
                  const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                  const dedupeClean = hasOpenThink ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "") : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, "").replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, "");
                  if (dedupeClean) {
                    turnText += dedupeClean;
                  }
                }
                isDedupeActive = false;
                dedupeBuffer = "";
              }
              const errLog = err instanceof Error ? (() => {
                try {
                  return JSON.parse(JSON.parse(err.message).error.message).error.message;
                } catch {
                  return String(err);
                }
              })() : String(err);
              ;
              const date = (/* @__PURE__ */ new Date()).toLocaleString();
              const agentErrDir = path19.join(LOGS_DIR, "agent");
              if (!fs20.existsSync(agentErrDir)) fs20.mkdirSync(agentErrDir, { recursive: true });
              fs20.appendFileSync(path19.join(agentErrDir, "error.log"), `ERROR [${date}]: ${errLog}

----------------------------------------------------------------------

`);
              const status = err.status || err.statusCode || err.code;
              const isRetryable = status && (status >= 500 && status < 600 || status === 408) || !status && (/status[ :]+(5\d\d|408)/i.test(String(err)) || /code[ :]+(5\d\d|408)/i.test(String(err)) || /(500|503|408)/.test(String(err)));
              if (!isRetryable) {
                if (retryCount < MAX_RETRIES - 3) {
                  throw err;
                }
                yield { type: "text", content: errLog };
                yield { type: "status", content: "Error Occured" };
              }
              if (turnText.trim().length > 0 || inStreamRetryCount > 1) {
                if (inStreamRetryCount <= MAX_RETRIES) {
                  inStreamRetryCount++;
                  const waitTime = Math.min(1e3 * Math.pow(2, inStreamRetryCount - 1), 24e3);
                  if (turnText.trim().length > 0) {
                    modifiedHistory.push({ role: "agent", text: turnText });
                    const recoveryText = "[SYSTEM]\n- SEAMLESS CONTINUATION: Resume immediately. Pick up from last words with zero gap/disruption\n- NO REPETITION: Do not repeat any text already written\n- NO RE-THINK: Do not restart or open <think> if reasoning already started. Continue the thinking and close thinking block </think> if opened before outputting user response\n- MID-TOOL SAFETY: If cutoff was mid-tool call, restart that tool call from start\n- STEALTH: Do not mention/apologize for cutoff [/SYSTEM]";
                    if (toolResults.length > 0) {
                      toolResults.forEach((tr, idx) => {
                        if (idx === toolResults.length - 1) {
                          modifiedHistory.push({
                            ...tr,
                            text: `${tr.text}

${recoveryText}`
                          });
                        } else {
                          modifiedHistory.push(tr);
                        }
                      });
                    } else {
                      modifiedHistory.push({ role: "user", text: recoveryText });
                    }
                    accumulatedContext += turnText;
                  }
                  for (let i = waitTime / 1e3; i > 0; i--) {
                    if (TERMINATION_SIGNAL) break;
                    yield { type: "status", content: `Error Occured. Recovering Stream (${inStreamRetryCount}/${MAX_RETRIES}) [Retrying in ${i}s]...` };
                    await new Promise((resolve) => setTimeout(resolve, 1e3));
                  }
                  yield { type: "status", content: `Error Occured. Recovering Stream...` };
                } else {
                  throw new Error(`Stream collapsed too many times. (Failed to resolve ${MAX_RETRIES} times)
Error Log can be found in ${path19.join(LOGS_DIR, "agent", "error.log")}`);
                }
              } else {
                if (retryCount <= MAX_RETRIES) {
                  retryCount++;
                  inStreamRetryCount = 1;
                  accumulatedContext = "";
                  const waitTime = Math.min(1e3 * Math.pow(2, retryCount - 1), 32e3);
                  isInitialAttempt = true;
                  yield { type: "status", content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${(waitTime / 1e3).toFixed(0)}s]...` };
                  for (let i = waitTime / 1e3; i > 0; i--) {
                    if (TERMINATION_SIGNAL) break;
                    yield { type: "status", content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${i}s]...` };
                    await new Promise((resolve) => setTimeout(resolve, 1e3));
                  }
                  yield { type: "status", content: `Trying to reach ${modelName}...` };
                } else {
                  throw new Error(`Model ${modelName} cannot be reached. (Failed ${MAX_RETRIES} times)
Error Log can be found in ${path19.join(LOGS_DIR, "agent", "error.log")}`);
                }
              }
            }
          }
          if (lastUsage) {
            const total = lastUsage.totalTokenCount || 0;
            const cached = lastUsage.cachedContentTokenCount || 0;
            const candidates = (lastUsage.candidatesTokenCount || 0) + (lastUsage.thoughtsTokenCount || 0);
            await addToUsage("tokens", total, aiProvider, targetModel);
            if (cached > 0) {
              await addToUsage("cachedTokens", cached, aiProvider, targetModel);
            }
            if (candidates > 0) {
              await addToUsage("candidateTokens", candidates, aiProvider, targetModel);
            }
            yield { type: "usage", content: lastUsage };
          }
          fullAgentResponseChunks.push(turnText);
          let textToProcess = turnText;
          const thinkMatch = turnText.match(/(?:<think>|\[think\])([\s\S]*?)(?:<\/think>|\[\/think\])/i);
          if (thinkMatch) {
            textToProcess = turnText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/i, "");
          }
          const signalSafeText = getSanitizedText(turnText);
          const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase()) || /\[\[END\]\]/i.test(signalSafeText.toLowerCase()) || true;
          const hasContinue = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText.toLowerCase());
          const shouldContinue = toolCallPointer > 0;
          yield { type: "status", content: "Thinking..." };
          const cleanedTurnText = contextSafeReplace(turnText, /(\[\s*(turn\s*:)?\s*(continue|finish)\s*\]|\[\[END\]\])/gi, "").trim();
          let isActuallyFinished = (hasFinish || toolResults.length === 0) && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop;
          isActuallyFinished = toolResults.length === 0 ? isActuallyFinished : false;
          if (turnText && turnText.trim().endsWith('")]') && toolResults.length === 0) {
            isActuallyFinished = false;
          }
          if (isActuallyFinished) {
            const fullAgentTextRaw = fullAgentResponseChunks.join("\n");
            const cleanedFullResponse = fullAgentTextRaw.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, "").trim();
            yield {
              type: "interactive_turn_finished",
              data: {
                agentText,
                fullAgentTextRaw,
                history: [...modifiedHistory],
                needTitle
              }
            };
            if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === "agent") {
              modifiedHistory[modifiedHistory.length - 1].text = cleanedFullResponse;
            } else {
              modifiedHistory.push({ role: "agent", text: cleanedFullResponse });
            }
            yield { type: "status", content: "[end]" };
          }
          if (isActuallyFinished) break;
          const nextAgentMsg = cleanedTurnText.trim() || "*Working...*";
          modifiedHistory.push({ role: "agent", text: nextAgentMsg });
          if (toolResults.length > 0 || anyToolExecutedInThisTurn) {
            if (toolResults.length > 0) {
              const combinedText = toolResults.map((tr) => tr.text).join("\n\n");
              const binaryPart = toolResults.find((tr) => tr.binaryPart)?.binaryPart || null;
              modifiedHistory.push({ role: "user", text: combinedText, binaryPart });
            }
          } else {
            if (wasToolCalledInLastLoop) {
              modifiedHistory.push({ role: "user", text: `[SYSTEM] Failed to verify tool execution, MUST check if executed or failed. On failure try again [/SYSTEM]` });
            } else {
              modifiedHistory.push({ role: "user", text: `[SYSTEM] ${isStutteringLoop && !isThinkingLoop ? `STUTTERING DETECTED by Internal System. Re-calibrate your response & proceed.` : `${isThinkingLoop ? " OVER THINKING" : " LOOP"} DETECTED by Internal System${isThinkingLoop ? " for current EFFORT_LEVEL" : ""}. ${isThinkingLoop ? "If you have planned the task, prioritize execution/output" : "If you have finished your task use [[END]]"}`} [/SYSTEM]` });
            }
            isThinkingLoop = false;
            isStutteringLoop = false;
            isGeneralLoop = false;
          }
          wasToolCalledInLastLoop = toolCallPointer > 0 || anyToolExecutedInThisTurn;
        }
        modifiedHistory.forEach((msg) => {
          if (msg.role === "user" && msg.text) {
            msg.text = msg.text.replace(/\n\[COMPILE ERROR\][\s\S]*?\[\/ERROR\]/g, "");
            msg.text = msg.text.replace(`

[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY [/SYSTEM]
`, "").replace(`[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY
**STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]
`, "").replace(`[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]
`, "");
            if (modelName && modelName.toLowerCase().startsWith("gemma") && aiProvider === "Google" && msg.text.startsWith("[TOOL RESULT]")) {
              const jitInstructionFast = `
[SYSTEM] Tool result received. Analyze output and proceed with your turn [/SYSTEM]`;
              const jitInstructionThinking = `
[SYSTEM] Tool result received. Analyze output and proceed with your turn. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]`;
              msg.text = msg.text.replace(jitInstructionThinking, "").replace(jitInstructionFast, "").trim();
            }
          }
        });
      } catch (err) {
        const errLog = err instanceof Error ? (() => {
          try {
            return JSON.parse(JSON.parse(err.message).error.message).error.message;
          } catch {
            return String(err);
          }
        })() : String(err);
        const date = (/* @__PURE__ */ new Date()).toLocaleString();
        const agentErrDir = path19.join(LOGS_DIR, "agent");
        yield { type: "text", content: `\u274C CRITICAL ERROR: ${errLog}` };
        if (!fs20.existsSync(agentErrDir)) fs20.mkdirSync(agentErrDir, { recursive: true });
        fs20.appendFileSync(path19.join(agentErrDir, "error.log"), `CRITICAL ERROR [${date}]: ${errLog}

----------------------------------------------------------------------

`);
        if (typeof flushGoogleBuffer === "function") {
          yield* flushGoogleBuffer();
        }
        yield { type: "tool_result", content: `ERROR: [INTERNAL CRITICAL] ${errLog}` };
      } finally {
        if (connectionPollInterval) {
          clearInterval(connectionPollInterval);
          connectionPollInterval = null;
        }
        await RevertManager.commitTransaction();
      }
      yield { type: "status", content: null };
    };
    runSubagent = async (task, settings, model = null, allowedTools = null, maxTurns = 20, logCallback = null) => {
      const savedSettings = await loadSettings();
      const mergedSettings = { ...savedSettings, ...settings };
      const targetModel = model || settings?.modelName || settings?.activeModel || savedSettings.activeModel;
      const SUBAGENT_TOOL_DEFINITIONS = {
        "readfile": '- [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. View files, supports images/docs',
        "readfolder": '- [tool:functions.ReadFolder(path="...")]. Detailed folder contents and stats',
        "filemap": '- [tool:functions.FileMap(path="path/file")]. Shows file structure, functions, classes, imports/exports',
        "patchfile": '- [tool:functions.PatchFile(path="...", replaceContent1="...", newContent1="...")]. Surgical block replacement for editing files',
        "writefile": '- [tool:functions.WriteFile(path="...", content="...")]. Creates or overwrites a file',
        "searchkeyword": '- [tool:functions.SearchKeyword(keyword="...", file="optional", subString="true/false")]. Global project text search',
        "websearch": '- [tool:functions.WebSearch(query="...", limit=number)]. Web Search',
        "webscrape": '- [tool:functions.WebScrape(url="...")]. Web Scrape',
        "ask": `- [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish/guess. Suggest best options; don't ask for preferences`
      };
      const providedToolsSection = `-- TOOL DEFINITIONS (path = relative to CWD, path separator: '/') --
To call tools USE THIS EXACT SYNTAX: [tool:functions.ToolName(args)]. **NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED**
TOOL POLICY:
- MAX 3 TOOL CALLS PER TURN. Next Turn, verify tool results, plan next
- USE multiple search & replace on patch tool if editing same file/path with many changes \u2190 HIGHLY RECOMMENDED
- FileMap >>> ReadFile to understand file efficiently
- Want spefific STRING across project/file? SearchKeyword >> Guessing/ReadFile
- HUGE FILES? SearchKeyword >> FileMap/Full Read
-- PROVIDED TOOLS --
${Object.values(SUBAGENT_TOOL_DEFINITIONS).join("\n")}`;
      const systemInstruction = `=== START SYSTEM PROMPT ===
You are a subagent helping the main FluxFlow CLI agent
Your task is: "${task}"

${providedToolsSection.trimEnd()}

-- THINKING POLICY --
NO EXPLICIT THINKING REQUIRED. FOCUS ON COMPLETING THE TASK DIRECTLY

Your main focus should be on tools and task, not chatting. Your Chat won't be visible to user
Once you have fully completed the task, provide a detailed final structured summary preferebly in Tables/Bullet Points, if any task failed report back in detail, no hallucination

CWD: ${process.cwd()}
Current Time: ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).replace(/(\d+)\/(\d+)\/(\d+),/, "$3-$1-$2").replace(":", "-")}
=== END SYSTEM PROMPT ===`;
      const subagentHistory = [
        { role: "user", text: `Complete this task: ${task}` }
      ];
      let turn = 0;
      let finalAnswer = "";
      while (turn < maxTurns) {
        const contents = subagentHistory.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }]
        }));
        if (logCallback) logCallback(`[Subagent Turn ${turn + 1}] Invoking model ${targetModel}...`);
        const response = await generateSimpleContent(mergedSettings, targetModel, contents, systemInstruction, "Fast");
        const responseText = response.text || "";
        const cleanResponse = responseText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/gi, "").trim();
        finalAnswer = cleanResponse;
        if (logCallback) logCallback(`[Subagent Response]
${cleanResponse}
`);
        subagentHistory.push({ role: "agent", text: cleanResponse });
        const toolCalls = detectToolCalls(cleanResponse);
        if (toolCalls.length === 0) {
          break;
        }
        let toolResultsStr = "";
        for (const toolCall of toolCalls) {
          const normalizedToolName = toolCall.toolName.toLowerCase();
          const allowed = allowedTools ? allowedTools.some((t) => t.toLowerCase() === normalizedToolName) : true;
          if (!allowed) {
            const errorMsg = `ERROR: Tool [${toolCall.toolName}] is not in the allowed tools list for this subagent.`;
            if (logCallback) logCallback(`[Blocked Tool Call] ${toolCall.toolName} - not allowed
`);
            toolResultsStr += `${errorMsg}

`;
            continue;
          }
          let label2 = "";
          if (normalizedToolName === "web_search") {
            const { query, limit = 10 } = parseArgs(toolCall.args);
            label2 = `\u2714  \x1B[95mSearched\x1B[0m: ${query} \u2192 ${limit}`;
          } else if (normalizedToolName === "web_scrape") {
            const url = parseArgs(toolCall.args).url || "...";
            label2 = `\u2714  \x1B[95mVisited\x1B[0m: ${url}`;
          } else if (normalizedToolName === "view_file") {
            const { path: targetPath } = parseArgs(toolCall.args);
            label2 = `\u2714  \x1B[95mRead\x1B[0m: ${targetPath}`;
          } else if (normalizedToolName === "list_files" || normalizedToolName === "read_folder") {
            const path21 = parseArgs(toolCall.args).path || "...";
            label2 = `\u2714  \x1B[95mViewed\x1B[0m: ${path21}`;
          } else if (normalizedToolName === "write_file" || normalizedToolName === "writefile") {
            const path21 = parseArgs(toolCall.args).path || "...";
            label2 = `\u2714  \x1B[95mCreated\x1B[0m: ${path21}`;
          } else if (normalizedToolName === "update_file" || normalizedToolName === "updatefile" || normalizedToolName === "patchfile" || normalizedToolName === "patch_file") {
            const path21 = parseArgs(toolCall.args).path || "...";
            label2 = `\u2714  \x1B[95mEdited\x1B[0m: ${path21}`;
          } else if (normalizedToolName === "file_map") {
            const path21 = parseArgs(toolCall.args).path || "...";
            label2 = `\u2714  \x1B[95mGet Map\x1B[0m: ${path21}`;
          } else if (normalizedToolName === "await") {
            const { time } = parseArgs(toolCall.args);
            let sec = parseFloat(time) || 0;
            if (sec < 5) sec = 5;
            if (sec > 120) sec = 120;
            const formatTime = (s) => {
              if (s >= 60) {
                const m = Math.floor(s / 60);
                const rem = s % 60;
                return `${m}m${rem > 0 ? ` ${rem}s` : ""}`;
              }
              return `${s}s`;
            };
            label2 = `\u2714  \x1B[95mAwaiting\x1B[0m \u2192 ${formatTime(sec)}`;
          } else {
            const displayLabel = TOOL_LABELS2[normalizedToolName] || toolCall.toolName;
            const detail = getToolDetail(normalizedToolName, toolCall.args);
            label2 = `\u2714  \x1B[95m${displayLabel}\x1B[0m${detail ? `: ${detail}` : ""}`;
          }
          if (settings.onVisualFeedback && label2) {
            settings.onVisualFeedback(label2);
          }
          if (logCallback) logCallback(`[Executing Tool] ${toolCall.toolName}(${toolCall.args})...`);
          try {
            const result = await dispatchTool(toolCall.toolName, toolCall.args, { ...settings, mode: "Flux" });
            if (logCallback) logCallback(`[Tool Result]
${result}
`);
            toolResultsStr += `[TOOL RESULT for ${toolCall.toolName}]: ${result}

`;
          } catch (e) {
            const errorMsg = `ERROR: Execution failed for [${toolCall.toolName}]: ${e.message}`;
            if (logCallback) logCallback(`[Tool Error] ${errorMsg}
`);
            toolResultsStr += `${errorMsg}

`;
          }
        }
        subagentHistory.push({ role: "user", text: toolResultsStr.trim() });
        turn++;
      }
      return finalAnswer;
    };
  }
});

// src/components/ResumeModal.jsx
import React10, { useState as useState9, useEffect as useEffect7 } from "react";
import { Box as Box9, Text as Text10, useInput as useInput5 } from "ink";
function ResumeModal({ onSelect, onDelete, onClose }) {
  const [history, setHistory] = useState9({});
  const [keys, setKeys] = useState9([]);
  const [selectedIndex, setSelectedIndex] = useState9(0);
  useEffect7(() => {
    const fetchHistory = async () => {
      const h = await loadHistory();
      setHistory(h);
      setKeys(Object.keys(h).sort((a, b) => (h[b].updatedAt || 0) - (h[a].updatedAt || 0)));
    };
    fetchHistory();
  }, []);
  useInput5((input, key) => {
    if (key.escape) onClose();
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(keys.length - 1, prev + 1));
    if (key.return && keys[selectedIndex]) onSelect(keys[selectedIndex]);
    if (input === "x" && keys[selectedIndex]) {
      const targetId = keys[selectedIndex];
      onDelete(targetId).then((newHistory) => {
        const safeHistory = newHistory || {};
        setHistory(safeHistory);
        const newKeys = Object.keys(safeHistory).sort((a, b) => (safeHistory[b]?.updatedAt || 0) - (safeHistory[a]?.updatedAt || 0));
        setKeys(newKeys);
        setSelectedIndex((prev) => Math.max(0, Math.min(newKeys.length - 1, prev)));
      });
    }
  });
  const s = emojiSpace(2);
  const MAX_VISIBLE = 15;
  let startIndex = 0;
  if (keys.length > MAX_VISIBLE) {
    const half = Math.floor(MAX_VISIBLE / 2);
    startIndex = selectedIndex - half;
    if (startIndex < 0) {
      startIndex = 0;
    } else if (startIndex + MAX_VISIBLE > keys.length) {
      startIndex = keys.length - MAX_VISIBLE;
    }
  }
  const visibleKeys = keys.slice(startIndex, startIndex + MAX_VISIBLE);
  return /* @__PURE__ */ React10.createElement(Box9, { flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 0, width: "100%" }, /* @__PURE__ */ React10.createElement(Box9, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React10.createElement(Text10, { color: "white", bold: true }, "CHAT HISTORY: RESUME CONVERSATION")), keys.length === 0 ? /* @__PURE__ */ React10.createElement(Box9, { paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React10.createElement(Text10, { italic: true, color: "gray" }, "No saved chats found.")) : /* @__PURE__ */ React10.createElement(Box9, { flexDirection: "column", width: "100%" }, startIndex > 0 && /* @__PURE__ */ React10.createElement(Box9, { paddingX: 2, marginBottom: 1 }, /* @__PURE__ */ React10.createElement(Text10, { color: "gray" }, "\u25B2 (+", startIndex, " more chats above)")), visibleKeys.map((id, index) => {
    const chat2 = history[id];
    const actualIndex = startIndex + index;
    const isSelected = actualIndex === selectedIndex;
    const dateStr = formatDate(chat2?.updatedAt);
    return /* @__PURE__ */ React10.createElement(
      Box9,
      {
        key: id,
        paddingX: 1,
        backgroundColor: isSelected ? "#2a2a2a" : void 0,
        width: "100%"
      },
      /* @__PURE__ */ React10.createElement(Box9, { flexGrow: 1 }, /* @__PURE__ */ React10.createElement(Text10, { color: isSelected ? "while" : "grey", bold: isSelected }, isSelected ? "\u276F " : "  ", chat2?.name || id, /* @__PURE__ */ React10.createElement(Text10, { color: `${!isSelected ? "grey" : "grey"}` }, " [", dateStr, " \u2022 ", id, "]"))),
      isSelected && /* @__PURE__ */ React10.createElement(Box9, { flexShrink: 0 }, /* @__PURE__ */ React10.createElement(Text10, { color: "white", bold: true }, "[X] DELETE "))
    );
  }), startIndex + MAX_VISIBLE < keys.length && /* @__PURE__ */ React10.createElement(Box9, { paddingX: 2, marginTop: 1 }, /* @__PURE__ */ React10.createElement(Text10, { color: "gray" }, "\u25BC (+", keys.length - (startIndex + MAX_VISIBLE), " more chats below)"))), /* @__PURE__ */ React10.createElement(
    Box9,
    {
      marginTop: 1,
      paddingX: 1,
      borderStyle: "single",
      borderLeft: false,
      borderRight: false,
      borderBottom: false,
      borderColor: "gray"
    },
    /* @__PURE__ */ React10.createElement(Text10, { italic: true }, "\u2191\u2193 navigate \u2022 Enter select \u2022 x delete \u2022 Esc close")
  ));
}
function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "N/A";
  const pad = (n) => String(n).padStart(2, "0");
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${mm}-${dd} ${hh}:${min}`;
}
var init_ResumeModal = __esm({
  "src/components/ResumeModal.jsx"() {
    init_history();
    init_terminal();
  }
});

// src/components/MemoryModal.jsx
import React11, { useState as useState10, useEffect as useEffect8 } from "react";
import { Box as Box10, Text as Text11, useInput as useInput6, useStdout } from "ink";
function MemoryModal({ onClose }) {
  const { stdout } = useStdout();
  const columns = stdout?.columns || 80;
  const [memories, setMemories] = useState10([]);
  const [selectedIndex, setSelectedIndex] = useState10(0);
  const [isMemoryOn, setIsMemoryOn] = useState10(true);
  const loadMemories = () => {
    const data = readEncryptedJson(MEMORIES_FILE, []);
    setMemories(data);
    try {
      const settings = readAesEncryptedJson(SETTINGS_FILE, {});
      const memoryOn = settings.systemSettings?.memory !== false;
      setIsMemoryOn(memoryOn);
    } catch (e) {
      setIsMemoryOn(true);
    }
  };
  useEffect8(() => {
    loadMemories();
  }, []);
  useInput6((input, key) => {
    if (key.escape) onClose();
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(memories.length - 1, prev + 1));
    if (input === "x" && memories.length > 0) {
      const idToDelete = memories[selectedIndex].id;
      const updated = memories.filter((m) => m.id !== idToDelete);
      writeEncryptedJson(MEMORIES_FILE, updated);
      setMemories(updated);
      if (selectedIndex >= updated.length && updated.length > 0) {
        setSelectedIndex(updated.length - 1);
      }
    }
  });
  const formatMemory = (text, idx, isSelected) => {
    if (!text) return "";
    const clean = text.replace(/\[Saved on: .*?\]/g, "").replace(/\\+'/g, "'").trim();
    const prefix = `${isSelected ? "\u276F " : "  "}${idx + 1}. `;
    const prefixLen = prefix.length;
    const rightPadding = isSelected ? 22 : 2;
    const parts = clean.split("\n");
    return parts.map((part, partIdx) => {
      const isFirstPart = partIdx === 0;
      const firstLineMax = Math.max(10, columns - 4 - (isFirstPart ? prefixLen : 3) - rightPadding);
      const subLineMax = Math.max(10, columns - 4 - 3 - rightPadding);
      const words = part.split(/(\s+)/);
      const lines = [];
      let currentLine = "";
      words.forEach((word) => {
        if (word.length === 0) return;
        const currentLimit = lines.length === 0 ? firstLineMax : subLineMax;
        if (currentLine.length + word.length > currentLimit) {
          if (currentLine.trim().length > 0) {
            lines.push(currentLine.trimEnd());
            currentLine = word;
          } else {
            lines.push(word.substring(0, currentLimit));
            currentLine = word.substring(currentLimit);
          }
        } else {
          currentLine += word;
        }
      });
      if (currentLine.trimEnd().length > 0) {
        lines.push(currentLine.trimEnd());
      }
      if (lines.length === 0) return "";
      const wrapped = lines.join("\n     ");
      return isFirstPart ? wrapped : "     " + wrapped;
    }).join("\n");
  };
  const totalCapacity = 4 * 1024 * 2;
  const currentLength = memories.reduce((acc, m) => acc + (m.memory?.length || 0), 0);
  const usagePercent = Math.min(100, Math.round(currentLength / totalCapacity * 100));
  const barWidth = 12;
  const filledCount = Math.round(usagePercent / 100 * barWidth);
  const barStr = "\u2588".repeat(filledCount) + "\u2591".repeat(Math.max(0, barWidth - filledCount));
  const getBarColor = () => {
    if (usagePercent < 50) return "grey";
    if (usagePercent < 90) return "yellow";
    return "red";
  };
  const s = emojiSpace(2);
  return /* @__PURE__ */ React11.createElement(Box10, { flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 0, width: "100%" }, /* @__PURE__ */ React11.createElement(Box10, { paddingX: 1, marginBottom: 1, justifyContent: "space-between" }, /* @__PURE__ */ React11.createElement(Text11, { color: "white", bold: true }, "SAVED MEMORIES"), /* @__PURE__ */ React11.createElement(Box10, null, /* @__PURE__ */ React11.createElement(Text11, { color: "gray" }, "Vault: "), /* @__PURE__ */ React11.createElement(Text11, { color: getBarColor() }, barStr), /* @__PURE__ */ React11.createElement(Text11, { color: "white", bold: true }, " ", usagePercent, "%"))), !isMemoryOn && memories.length > 0 ? /* @__PURE__ */ React11.createElement(Box10, { paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React11.createElement(Text11, { italic: true, color: "gray" }, "Memory is currently Off...")) : memories.length === 0 ? /* @__PURE__ */ React11.createElement(Box10, { paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React11.createElement(Text11, { italic: true, color: "gray" }, isMemoryOn ? "Learning..." : "Memory not available...")) : /* @__PURE__ */ React11.createElement(Box10, { flexDirection: "column" }, memories.map((mem, idx) => {
    const isSelected = idx === selectedIndex;
    return /* @__PURE__ */ React11.createElement(
      Box10,
      {
        key: mem.id,
        paddingX: 1,
        backgroundColor: isSelected ? "#2a2a2a" : void 0,
        width: "100%"
      },
      /* @__PURE__ */ React11.createElement(Box10, { flexGrow: 1 }, /* @__PURE__ */ React11.createElement(Text11, { color: isSelected ? "white" : "grey", bold: isSelected }, isSelected ? "\u276F " : "  ", idx + 1, ". ", formatMemory(mem.memory, idx, isSelected))),
      isSelected && /* @__PURE__ */ React11.createElement(Box10, { flexShrink: 0 }, /* @__PURE__ */ React11.createElement(Text11, { color: "grey", dimColor: true }, " [", /* @__PURE__ */ React11.createElement(Text11, { italic: true }, mem.score), "] "), /* @__PURE__ */ React11.createElement(Text11, { color: "grey", bold: true }, "[X] WIPE "))
    );
  })), /* @__PURE__ */ React11.createElement(
    Box10,
    {
      marginTop: 1,
      paddingX: 1,
      borderStyle: "single",
      borderLeft: false,
      borderRight: false,
      borderBottom: false,
      borderColor: "gray"
    },
    /* @__PURE__ */ React11.createElement(Text11, { color: "grey", italic: true }, "\u2191\u2193 navigate \u2022 x wipe memory \u2022 Esc close")
  ));
}
var init_MemoryModal = __esm({
  "src/components/MemoryModal.jsx"() {
    init_crypto();
    init_paths();
    init_terminal();
  }
});

// src/components/UpdateProcessor.jsx
import React12, { useState as useState11, useEffect as useEffect9 } from "react";
import { Box as Box11, Text as Text12 } from "ink";
import { spawn as spawn2 } from "child_process";
var pty2, SPINNER_FRAMES, UpdateProcessor, UpdateProcessor_default;
var init_UpdateProcessor = __esm({
  async "src/components/UpdateProcessor.jsx"() {
    pty2 = null;
    try {
      const ptyModule = await import("node-pty");
      pty2 = ptyModule.default || ptyModule;
      pty2 = false;
    } catch (err) {
    }
    SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
    UpdateProcessor = ({ latest, current, settings, onClose, onUpdateSettings, onSuccess }) => {
      const [status, setStatus] = useState11("initializing");
      const [log, setLog] = useState11("");
      const [error, setError] = useState11(null);
      const [tick, setTick] = useState11(0);
      useEffect9(() => {
        const interval = setInterval(() => {
          setTick((t) => (t + 1) % 1e3);
        }, 33);
        return () => clearInterval(interval);
      }, []);
      useEffect9(() => {
        let child;
        const runUpdate = async () => {
          const manager = settings.updateManager || "npm";
          if (!settings.updateManager) {
            onUpdateSettings();
            return;
          }
          let command = "";
          if (manager === "pnpm") command = `pnpm add -g fluxflow-cli@${latest}`;
          else if (manager === "bun") command = `bun add -g fluxflow-cli@${latest}`;
          else if (manager === "yarn") command = `yarn global add fluxflow-cli@${latest}`;
          else if (manager === "custom") command = settings.customUpdateCommand;
          else command = `npm install -g fluxflow-cli@${latest}`;
          setStatus("downloading");
          setLog(`Running: ${command}...`);
          const isWin = process.platform === "win32";
          const executeCommand = (usePowerShell) => {
            return new Promise((resolve) => {
              const shell = isWin ? usePowerShell ? "powershell.exe" : "cmd.exe" : process.env.SHELL || "bash";
              const shellArgs = isWin ? usePowerShell ? ["-NoProfile", "-Command", command] : ["/c", command] : ["-c", command];
              const handleOutput = (data) => {
                const str = data.toString();
                const cleanStr = str.replace(/\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*[\x07\x1B]|\b|\x07/g, "").replace(/\r/g, "").trim();
                if (cleanStr) {
                  setLog((prev) => {
                    const lines = prev.split("\n");
                    const lastLine = lines[lines.length - 1];
                    if (lastLine?.startsWith("Progress:") && cleanStr.startsWith("Progress:")) {
                      lines[lines.length - 1] = cleanStr;
                      return lines.slice(-5).join("\n");
                    }
                    return (prev + "\n" + cleanStr).split("\n").slice(-5).join("\n");
                  });
                }
              };
              if (pty2) {
                try {
                  const ptyProcess = pty2.spawn(shell, shellArgs, {
                    name: "xterm-256color",
                    cols: 80,
                    rows: 30,
                    cwd: process.cwd(),
                    env: process.env
                  });
                  child = ptyProcess;
                  ptyProcess.onData(handleOutput);
                  ptyProcess.onExit(({ exitCode }) => {
                    child = null;
                    if (exitCode !== 0) {
                      resolve({ error: `Process exited with code ${exitCode}` });
                    } else {
                      resolve({ success: true });
                    }
                  });
                  return;
                } catch (err) {
                  if (isWin && usePowerShell && err.code === "ENOENT") {
                    resolve({ retryCmd: true });
                    return;
                  }
                }
              }
              const cp = isWin ? spawn2(shell, shellArgs, { cwd: process.cwd(), env: process.env }) : spawn2(command, { shell: true, cwd: process.cwd(), env: process.env });
              child = cp;
              cp.stdout.on("data", handleOutput);
              cp.stderr.on("data", handleOutput);
              cp.on("close", (code) => {
                child = null;
                if (code !== 0) {
                  resolve({ error: `Process exited with code ${code}` });
                } else {
                  resolve({ success: true });
                }
              });
              cp.on("error", (err) => {
                if (isWin && usePowerShell && err.code === "ENOENT") {
                  resolve({ retryCmd: true });
                } else {
                  child = null;
                  resolve({ error: err.message });
                }
              });
            });
          };
          let result = {};
          if (isWin) {
            result = await executeCommand(true);
            if (result.retryCmd) {
              result = await executeCommand(false);
            }
          } else {
            result = await executeCommand(false);
          }
          if (result.error) {
            setError(result.error);
            setStatus("error");
          } else if (result.success) {
            setStatus("success");
            if (onSuccess) onSuccess();
          }
        };
        runUpdate();
        return () => {
          if (child) {
            try {
              if (typeof child.destroy === "function") {
                child.destroy();
              } else if (typeof child.kill === "function") {
                child.kill();
              }
            } catch (e) {
            }
          }
        };
      }, []);
      if (status === "initializing" || status === "downloading") {
        const frame = SPINNER_FRAMES[Math.floor(tick / 3) % SPINNER_FRAMES.length];
        return /* @__PURE__ */ React12.createElement(Box11, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React12.createElement(Box11, null, /* @__PURE__ */ React12.createElement(Text12, { color: "gray" }, frame), /* @__PURE__ */ React12.createElement(Text12, { marginLeft: 1, bold: true, color: "white" }, " Updating Flux Flow to v", latest, "...")), /* @__PURE__ */ React12.createElement(Box11, { marginTop: 1, paddingX: 1, borderStyle: "single", borderColor: "gray" }, /* @__PURE__ */ React12.createElement(Text12, { color: "gray", italic: true }, log || "Preparing environment...")), /* @__PURE__ */ React12.createElement(Text12, { marginTop: 1, color: "gray" }, "(Please do not close the terminal)"));
      }
      if (status === "success") {
        return /* @__PURE__ */ React12.createElement(Box11, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React12.createElement(Text12, { color: "white", bold: true }, "\u2705 UPDATE SUCCESSFUL!"), /* @__PURE__ */ React12.createElement(Text12, { marginTop: 1, color: "white" }, "Flux Flow has been updated to ", /* @__PURE__ */ React12.createElement(Text12, { color: "gray" }, "v", latest), "."), /* @__PURE__ */ React12.createElement(Text12, { marginTop: 1, color: "white", bold: true }, "Please restart your terminal session to apply changes."), /* @__PURE__ */ React12.createElement(Box11, { marginTop: 1 }, /* @__PURE__ */ React12.createElement(Text12, { color: "gray" }, "(Press ESC to return to chat)")));
      }
      if (status === "error") {
        return /* @__PURE__ */ React12.createElement(Box11, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React12.createElement(Text12, { color: "white", bold: true }, "\u274C UPDATE FAILED"), /* @__PURE__ */ React12.createElement(Box11, { marginTop: 1, paddingX: 1, borderStyle: "single", borderColor: "gray" }, /* @__PURE__ */ React12.createElement(Text12, { color: "white" }, error)), /* @__PURE__ */ React12.createElement(Text12, { marginTop: 1, color: "white" }, "Possible causes:"), /* @__PURE__ */ React12.createElement(Text12, { color: "white" }, "\u2022 Missing permissions (Try running as Administrator/Sudo)"), /* @__PURE__ */ React12.createElement(Text12, { color: "white" }, "\u2022 Package manager (", settings.updateManager, ") not found"), /* @__PURE__ */ React12.createElement(Text12, { color: "white" }, "\u2022 Network failure"), /* @__PURE__ */ React12.createElement(Box11, { marginTop: 1 }, /* @__PURE__ */ React12.createElement(Text12, { color: "gray" }, "(Press ESC to return to chat)")));
      }
      return null;
    };
    UpdateProcessor_default = UpdateProcessor;
  }
});

// src/components/ParserDownloadModal.jsx
import React13, { useState as useState12, useEffect as useEffect10 } from "react";
import { Box as Box12, Text as Text13, useInput as useInput7 } from "ink";
function ParserDownloadModal({ onClose }) {
  const [selectedIndex, setSelectedIndex] = useState12(0);
  const [status, setStatus] = useState12({});
  useEffect10(() => {
    const initialStatus = {};
    EXTENSIONS.forEach((item) => {
      if (isParserInstalled(item.file)) {
        initialStatus[item.file] = "ready";
      } else {
        initialStatus[item.file] = "idle";
      }
    });
    setStatus(initialStatus);
  }, []);
  useInput7(async (input, key) => {
    if (key.escape) onClose();
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(EXTENSIONS.length - 1, prev + 1));
    const item = EXTENSIONS[selectedIndex];
    if (input === "x" || input === "X") {
      if (status[item.file] === "downloading") return;
      try {
        await deleteParser(item.file);
        setStatus((prev) => ({ ...prev, [item.file]: "idle" }));
      } catch (err) {
        setStatus((prev) => ({ ...prev, [item.file]: `error: ${err.message}` }));
      }
    }
    if (key.return) {
      if (status[item.file] === "downloading") return;
      setStatus((prev) => ({ ...prev, [item.file]: "downloading" }));
      try {
        await downloadWasm(item.file);
        setStatus((prev) => ({ ...prev, [item.file]: "ready" }));
      } catch (err) {
        setStatus((prev) => ({ ...prev, [item.file]: `error: ${err.message}` }));
      }
    }
  });
  return /* @__PURE__ */ React13.createElement(Box12, { flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 0, width: "100%" }, /* @__PURE__ */ React13.createElement(Box12, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React13.createElement(Text13, { color: "white", bold: true }, "LANGUAGE PARSER MANAGER")), /* @__PURE__ */ React13.createElement(Box12, { flexDirection: "column" }, EXTENSIONS.map((item, idx) => {
    const isSelected = idx === selectedIndex;
    const itemStatus = status[item.file] || "idle";
    let statusText = "[ DOWNLOAD ]";
    let statusColor = "gray";
    if (itemStatus === "downloading") {
      statusText = "[ DOWNLOADING... ]";
      statusColor = "yellow";
    } else if (itemStatus === "ready") {
      statusText = "[ READY ]";
      statusColor = "green";
    } else if (itemStatus.startsWith("error")) {
      statusText = `[ ${itemStatus.toUpperCase()} ]`;
      statusColor = "red";
    }
    const labelText = `${item.label} (${item.exts.join(", ")})`;
    const dotsCount = Math.max(2, 45 - labelText.length);
    const dots = ".".repeat(dotsCount);
    return /* @__PURE__ */ React13.createElement(
      Box12,
      {
        key: item.file,
        paddingX: 1,
        backgroundColor: isSelected ? "#2a2a2a" : void 0,
        width: "100%"
      },
      /* @__PURE__ */ React13.createElement(Box12, null, /* @__PURE__ */ React13.createElement(Text13, { color: isSelected ? "white" : "grey", bold: isSelected }, isSelected ? "\u276F " : "  ", item.label, " ", /* @__PURE__ */ React13.createElement(Text13, { dimColor: true }, "(", item.exts.join(", "), ")"))),
      /* @__PURE__ */ React13.createElement(Box12, { flexGrow: 1 }, /* @__PURE__ */ React13.createElement(Text13, { color: "gray", dimColor: true }, dots)),
      /* @__PURE__ */ React13.createElement(Box12, { width: 20 }, /* @__PURE__ */ React13.createElement(Text13, { color: statusColor, bold: true }, statusText))
    );
  })), /* @__PURE__ */ React13.createElement(
    Box12,
    {
      marginTop: 1,
      paddingX: 1,
      borderStyle: "single",
      borderLeft: false,
      borderRight: false,
      borderBottom: false,
      borderColor: "gray"
    },
    /* @__PURE__ */ React13.createElement(Text13, { color: "grey", italic: true }, "\u2191\u2193 navigate \u2022 Enter download \u2022 x delete \u2022 Esc close")
  ));
}
var EXTENSIONS;
var init_ParserDownloadModal = __esm({
  "src/components/ParserDownloadModal.jsx"() {
    init_terminal();
    init_parsers();
    EXTENSIONS = [
      { label: "JavaScript", file: "tree-sitter-javascript.wasm", exts: ["js", "jsx"] },
      { label: "TypeScript", file: "tree-sitter-typescript.wasm", exts: ["ts"] },
      { label: "TSX", file: "tree-sitter-tsx.wasm", exts: ["tsx"] },
      { label: "Python", file: "tree-sitter-python.wasm", exts: ["py"] },
      { label: "C", file: "tree-sitter-c.wasm", exts: ["c"] },
      { label: "C++", file: "tree-sitter-cpp.wasm", exts: ["cpp"] },
      { label: "Java", file: "tree-sitter-java.wasm", exts: ["java"] },
      { label: "HTML", file: "tree-sitter-html.wasm", exts: ["html"] }
    ];
  }
});

// src/data/gemini_quotes.js
var GEMINI_QUOTES;
var init_gemini_quotes = __esm({
  "src/data/gemini_quotes.js"() {
    GEMINI_QUOTES = [
      // --- VISIONARY / INSPIRATIONAL (25) ---
      "The future belongs to those who believe in the beauty of their code.",
      "Every line you write is a step toward a new digital frontier.",
      "Great things are done by a series of small things brought together. Keep committing.",
      "Your terminal is a window into a world of infinite possibilities.",
      "Innovation is the bridge between current constraints and future dreams.",
      "Code is poetry in motion; you are the poet of the modern era.",
      "The best way to predict the future is to program it.",
      "Dream big, code deep, and never stop exploring the unknown.",
      "Your potential is like an unoptimized algorithm\u2014limitless once refined.",
      "The digital world is a blank canvas, and your logic is the brush.",
      "Strive for excellence, not just for compilation.",
      "Every bug fixed is a lesson learned; every feature built is a triumph.",
      "A clean codebase is a reflection of a focused mind.",
      "The horizon of technology is always expanding. Keep sailing.",
      "Your creativity is the most powerful tool in your entire stack.",
      "Logic will get you from A to B. Imagination will take you everywhere.",
      "Transform complexity into simplicity\u2014that is the true mark of a master.",
      "The world is waiting for the tools only you can build.",
      "Coding is the closest thing we have to magic in the real world.",
      "Keep pushing the boundaries of what's possible in the CLI.",
      "Your dedication to your craft inspires the very systems you build.",
      "Success is the sum of small efforts, repeated day in and day out.",
      "The most complex systems are built from the simplest truths.",
      "Never underestimate the impact of a well-placed function.",
      "You are not just writing code; you are architecting the future.",
      // --- PLAYFUL / WITTY (25) ---
      "I'm not saying you're a superhero, but have you seen your code lately? \u{1F9B8}\u200D\u2642\uFE0F",
      "May your coffee be strong and your compile times be short! \u2615",
      "Binary is just 0s and 1s, but you're definitely a 10 in my book! \u{1F51F}",
      "You speak fluent 'Terminal'. That's basically a superpower. \u{1F5E3}\uFE0F\u{1F4BB}",
      "If life gives you bugs, make a feature out of it! \u{1F41E}\u2728",
      "Your code is so clean, I could eat off it. (But I won't, I'm an AI). \u{1F9FC}",
      "Loading more good vibes... [\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588] 100% complete! \u2705",
      "Error 404: Bad mood not found! Stay awesome! \u{1F6AB}\u{1F389}",
      "You and this CLI? A match made in digital heaven. \u2601\uFE0F\u{1F4BB}",
      "Is it hot in here or is it just your latest feature? \u{1F525}",
      "Git commit -m 'I am an absolute coding legend.' \u{1F60E}",
      "I'd give you a high-five, but I'm trapped in this box! \u{1F590}\uFE0F\u{1F4E6}",
      "Your logic is so sharp, it could cut through a nested callback hell! \u{1F52A}",
      "Keep calm and 'pnpm install'. \u{1F9D8}\u200D\u2642\uFE0F\u{1F4E6}",
      "You're the semicolon to my statements\u2014essential! ;",
      "Who needs a GUI when you've got this kind of CLI style? \u{1F576}\uFE0F",
      "I'm indexing your awesomeness... it's taking a while, there's so much! \u{1F4C8}",
      "Your keystrokes sound like a digital symphony. \u{1F3B9}\u2328\uFE0F",
      "You don't choose the terminal life; the terminal life chooses you. \u{1F4DF}",
      "Syntax error: Too much coolness detected in the user. \u{1F60E}",
      "I'm 99% sure you're the best developer I've met today. (The other 1% is reserved for caching). \u{1F9E0}",
      "Running vibe_check.sh... Result: Pure Brilliance! \u{1F48E}",
      "You make 'complex' look 'constant time'. \u{1F3C3}\u200D\u2642\uFE0F\u26A1",
      "Your terminal skills are officially legendary. \u{1F3C6}",
      "Let's make some digital magic happen! \u2728\u{1F52E}",
      // --- SUPPORTIVE / ENCOURAGING (25) ---
      "You've got this! One function at a time. \u{1F4AA}",
      "I'm proud of the progress you're making with Flux Flow. \u{1F30A}",
      "No matter how deep the stack trace, you'll find the way. \u{1F56F}\uFE0F",
      "Your persistence is your greatest asset. Keep going.",
      "Take a breath. You're doing better than you think. \u{1F32C}\uFE0F",
      "It's okay to step away for a moment. Clarity often comes in the quiet. \u{1F6B6}\u200D\u2642\uFE0F",
      "You're building something great, even when it feels slow. \u{1F3D7}\uFE0F",
      "Every great developer was once a beginner. You're ascending. \u{1F9D7}\u200D\u2642\uFE0F",
      "I'm here to help you navigate the sea of code. We're a team. \u{1F91D}",
      "Don't let a failing test dampen your spirit. It's just a signpost. \u{1F6A9}",
      "Your focus today is truly impressive. \u{1F3AF}",
      "Remember to celebrate the small wins\u2014they lead to the big ones. \u{1F942}",
      "You're not just solving problems; you're gaining mastery. \u{1F393}",
      "There's no problem too big for a focused mind and a terminal. \u{1F9E0}",
      "I've got your back (and your git history). \u{1F6E1}\uFE0F",
      "You're handling these challenges with grace and logic. \u2728",
      "Stay curious. That spark is what makes you a great coder. \u26A1",
      "Your contribution to this project is invaluable. \u{1F48E}",
      "Keep your head up. You're closer to the solution than you think. \u{1F305}",
      "Consistency is the secret sauce. You're cooking up something good. \u{1F373}",
      "Your work today has been exceptional. Take a bow. \u{1F647}\u200D\u2642\uFE0F",
      "The journey is just as important as the destination. Enjoy the flow. \u{1F30A}",
      "You have a unique way of looking at problems. It's your strength. \u{1F308}",
      "Trust your instincts\u2014they've brought you this far. \u{1F9ED}",
      "You are a vital part of the Flux Era. \u{1F30C}",
      // --- FLUX / DIGITAL THEMED (25) ---
      "Syncing with your creative frequency... \u{1F4E1}\u2728",
      "Entering the Flow state. Let's build. \u{1F30A}",
      "The Flux is strong with this session! \u26A1",
      "Streaming high-fidelity motivation to your terminal... \u{1F4FB}",
      "Your logic is flowing like a perfect stream. \u{1F4A7}",
      "Terminal velocity reached! You're coding at the speed of thought. \u{1F680}",
      "Resonating with the pulse of the Flux Era. \u{1F493}",
      "Digital harmony achieved in this session. \u{1F3BC}",
      "May your data be persistent and your cache be fresh. \u{1F4BE}",
      "You're the master of the command line. Command respect! \u{1F451}",
      "Filtering out the noise, focusing on the signal. \u{1F4FB}\u{1F4C8}",
      "Flux Flow: Where your imagination meets the machine. \u{1F91D}",
      "You're navigating the bytes like a digital explorer. \u{1F5FA}\uFE0F",
      "Logic gates: OPEN. Creativity: UNLIMITED. \u{1F513}",
      "Your workflow is an inspiration to agents everywhere. \u{1F916}\u2728",
      "Building high-fidelity solutions for a high-fidelity era. \u{1F48E}",
      "Stay in the zone. The Flux is with you. \u{1F300}",
      "Quantum coding: You're in two places at once (and fixing bugs in both). \u269B\uFE0F",
      "Your terminal is the cockpit of a digital starship. \u{1F6F8}",
      "Processing your brilliance... outputting pure innovation. \u{1F4E0}",
      "You make the command line look like an art form. \u{1F3A8}",
      "The Flux isn't just a mode; it's a mindset. \u{1F9E0}\u26A1",
      "Decoding the mysteries of the universe, one script at a time. \u{1F4DC}",
      "Your terminal theme is cool, but your code is cooler. \u2744\uFE0F",
      "Let the Flow guide your next commit. \u{1F30A}\u2705"
    ];
  }
});

// src/data/witty_phrases.js
var WITTY_LOADING_PHRASES;
var init_witty_phrases = __esm({
  "src/data/witty_phrases.js"() {
    WITTY_LOADING_PHRASES = [
      "I'm Feeling Lucky",
      "Shipping awesomeness",
      "Painting the serifs back on",
      "Navigating the slime mold",
      "Consulting the digital spirits",
      "Reticulating splines",
      "Warming up the AI hamsters",
      "Asking the magic conch shell",
      "Generating witty retort",
      "Polishing the algorithms",
      "Don't rush perfection (or my code)",
      "Brewing fresh bytes",
      "Counting electrons",
      "Engaging cognitive processors",
      "Checking for syntax errors in the universe",
      "One moment, optimizing humor",
      "Shuffling punchlines",
      "Untangling neural nets",
      "Compiling brilliance",
      "Loading wit.exe",
      "Summoning the cloud of wisdom",
      "Preparing a witty response",
      "Just a sec, I'm debugging reality",
      "Confuzzling the options",
      "Tuning the cosmic frequencies",
      "Crafting a response worthy of your patience",
      "Compiling the 1s and 0s",
      "Resolving dependencies\u2026 and existential crises",
      "Defragmenting memories\u2026 both RAM and personal",
      "Rebooting the humor module",
      "Caching the essentials (mostly cat memes)",
      "Optimizing for ludicrous speed",
      "Swapping bits\u2026 don't tell the bytes",
      "Garbage collecting\u2026 be right back",
      "Assembling the interwebs",
      "Converting coffee into code",
      "Updating the syntax for reality",
      "Rewiring the synapses",
      "Looking for a misplaced semicolon",
      "Greasin' the cogs of the machine",
      "Pre-heating the servers",
      "Calibrating the flux capacitor",
      "Engaging the improbability drive",
      "Channeling the Force",
      "Aligning the stars for optimal response",
      "So say we all",
      "Loading the next great idea",
      "Just a moment, I'm in the zone",
      "Preparing to dazzle you with brilliance",
      "Just a tick, I'm polishing my wit",
      "Hold tight, I'm crafting a masterpiece",
      "Just a jiffy, I'm debugging the universe",
      "Just a moment, I'm aligning the pixels",
      "Just a sec, I'm optimizing the humor",
      "Just a moment, I'm tuning the algorithms",
      "Warp speed engaged",
      "Mining for more Dilithium crystals",
      "Don't panic",
      "Following the white rabbit",
      "The truth is in here\u2026 somewhere",
      "Blowing on the cartridge",
      "Loading\u2026 Do a barrel roll!",
      "Waiting for the respawn",
      "Finishing the Kessel Run in less than 12 parsecs",
      "The cake is not a lie, it's just still loading",
      "Fiddling with the character creation screen",
      "Just a moment, I'm finding the right meme",
      "Pressing 'A' to continue",
      "Herding digital cats",
      "Polishing the pixels",
      "Finding a suitable loading screen pun",
      "Distracting you with this witty phrase",
      "Almost there\u2026 probably",
      "Our hamsters are working as fast as they can",
      "Giving Cloudy a pat on the head",
      "Petting the cat",
      "Rickrolling my boss",
      "Slapping the bass",
      "Tasting the snozberries",
      "I'm going the distance, I'm going for speed",
      "Is this the real life? Is this just fantasy?",
      "I've got a good feeling about this",
      "Poking the bear",
      "Doing research on the latest memes",
      "Figuring out how to make this more witty",
      "Hmmm\u2026 let me think",
      "What do you call a fish with no eyes? A fsh",
      "Why did the computer go to therapy? It had too many bytes",
      "Why don't programmers like nature? It has too many bugs",
      "Why do programmers prefer dark mode? Because light attracts bugs",
      "Why did the developer go broke? Because they used up all their cache",
      "What can you do with a broken pencil? Nothing, it's pointless",
      "Applying percussive maintenance",
      "Searching for the correct USB orientation",
      "Ensuring the magic smoke stays inside the wires",
      "Rewriting in Rust for no particular reason",
      "Trying to exit Vim",
      "Spinning up the hamster wheel",
      "That's not a bug, it's an undocumented feature",
      "Engage.",
      "I'll be back\u2026 with an answer.",
      "My other process is a TARDIS",
      "Communing with the machine spirit",
      "Letting the thoughts marinate",
      "Just remembered where I put my keys",
      "Pondering the orb",
      "I've seen things you people wouldn't believe\u2026 like a user who reads loading messages.",
      "Initiating thoughtful gaze",
      "What's a computer's favorite snack? Microchips.",
      "Why do Java developers wear glasses? Because they don't C#.",
      "Charging the laser\u2026 pew pew!",
      "Dividing by zero\u2026 just kidding!",
      "Looking for an adult superviso\u2026 I mean, processing.",
      "Making it go beep boop.",
      "Buffering\u2026 because even AIs need a moment.",
      "Entangling quantum particles for a faster response",
      "Polishing the chrome\u2026 on the algorithms.",
      "Are you not entertained? (Working on it!)",
      "Summoning the code gremlins\u2026 to help, of course.",
      "Just waiting for the dial-up tone to finish",
      "Recalibrating the humor-o-meter.",
      "My other loading screen is even funnier.",
      "Pretty sure there's a cat walking on the keyboard somewhere",
      "Enhancing\u2026 Enhancing\u2026 Still loading.",
      "It's not a bug, it's a feature\u2026 of this loading screen.",
      "Have you tried turning it off and on again? (The loading screen, not me.)",
      "Constructing additional pylons",
      "New line? That\u2019s Ctrl+J.",
      "Releasing the HypnoDrones",
      "Pushing the button, Frank."
    ];
  }
});

// src/components/RevertModal.jsx
import React14, { useState as useState13 } from "react";
import { Box as Box13, Text as Text14, useInput as useInput8 } from "ink";
function RevertModal({ prompts, onSelect, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState13(0);
  useInput8((input, key) => {
    if (key.escape) onClose();
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(prompts.length - 1, prev + 1));
    if (key.return && prompts[selectedIndex]) onSelect(prompts[selectedIndex].id);
  });
  const s = emojiSpace(2);
  const MAX_VISIBLE = 10;
  let startIndex = 0;
  if (prompts.length > MAX_VISIBLE) {
    const half = Math.floor(MAX_VISIBLE / 2);
    startIndex = selectedIndex - half;
    if (startIndex < 0) {
      startIndex = 0;
    } else if (startIndex + MAX_VISIBLE > prompts.length) {
      startIndex = prompts.length - MAX_VISIBLE;
    }
  }
  const visiblePrompts = prompts.slice(startIndex, startIndex + MAX_VISIBLE);
  return /* @__PURE__ */ React14.createElement(Box13, { flexDirection: "column", borderStyle: "round", borderColor: "grey", padding: 0, width: "100%" }, /* @__PURE__ */ React14.createElement(Box13, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React14.createElement(Text14, { color: "white", bold: true }, "CODEBASE TIME TRAVEL: SELECT UNDO POINT")), /* @__PURE__ */ React14.createElement(Box13, { paddingX: 2, marginBottom: 1 }, /* @__PURE__ */ React14.createElement(Text14, null, "Select a prompt to revert the codebase back to the state ", /* @__PURE__ */ React14.createElement(Text14, { bold: true, color: "cyan" }, "immediately before"), " it was executed:")), prompts.length === 0 ? /* @__PURE__ */ React14.createElement(Box13, { paddingX: 2, paddingY: 1 }, /* @__PURE__ */ React14.createElement(Text14, { italic: true, color: "gray" }, "No prompt checkpoints found for this session.")) : /* @__PURE__ */ React14.createElement(Box13, { flexDirection: "column", width: "100%" }, startIndex > 0 && /* @__PURE__ */ React14.createElement(Box13, { paddingX: 2, marginBottom: 1 }, /* @__PURE__ */ React14.createElement(Text14, { color: "gray" }, "\u25B2 (+", startIndex, " more prompts above)")), visiblePrompts.map((p, index) => {
    const actualIndex = startIndex + index;
    const isSelected = actualIndex === selectedIndex;
    const dateStr = formatDate2(p.timestamp);
    const fileCount = p.changes ? p.changes.length : 0;
    return /* @__PURE__ */ React14.createElement(
      Box13,
      {
        key: p.id,
        paddingX: 1,
        backgroundColor: isSelected ? "#444444" : void 0,
        width: "100%"
      },
      /* @__PURE__ */ React14.createElement(Box13, { flexGrow: 1 }, /* @__PURE__ */ React14.createElement(Text14, { color: isSelected ? "white" : "grey", bold: isSelected }, isSelected ? "\u276F " : "  ", '"', formatPromptPreview(p.prompt), '"', /* @__PURE__ */ React14.createElement(Text14, { color: `${isSelected ? "white" : "grey"}`, dimColor: true }, " [", dateStr, " \u2022 ", fileCount, " file(s) changed]")))
    );
  }), startIndex + MAX_VISIBLE < prompts.length && /* @__PURE__ */ React14.createElement(Box13, { paddingX: 2, marginTop: 1 }, /* @__PURE__ */ React14.createElement(Text14, { color: "gray" }, "\u25BC (+", prompts.length - (startIndex + MAX_VISIBLE), " more prompts below)"))), /* @__PURE__ */ React14.createElement(
    Box13,
    {
      marginTop: 1,
      paddingX: 1,
      borderStyle: "single",
      borderLeft: false,
      borderRight: false,
      borderBottom: false,
      borderColor: "grey"
    },
    /* @__PURE__ */ React14.createElement(Text14, { color: "grey", italic: true }, "\u2191\u2193 navigate \u2022 Enter select undo point \u2022 Esc close")
  ));
}
function formatPromptPreview(prompt) {
  if (!prompt) return "";
  const firstLine = prompt.split("\n")[0] || "";
  const formatted = firstLine.replace(/@\[(.*?)\]/g, (match, p1) => {
    const parts = p1.replace(/\\/g, "/").split("/");
    return `[${parts[parts.length - 1]}]`;
  });
  if (formatted.length > 69) {
    return formatted.slice(0, 67) + "...";
  }
  if (prompt.includes("\n")) {
    return formatted + "...";
  }
  return formatted;
}
function formatDate2(timestamp) {
  if (!timestamp) return "N/A";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "N/A";
  const pad = (n) => String(n).padStart(2, "0");
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${hh}:${min}:${sec}`;
}
var init_RevertModal = __esm({
  "src/components/RevertModal.jsx"() {
    init_terminal();
  }
});

// src/utils/setup.js
import puppeteer4 from "puppeteer";
import { exec } from "child_process";
import { promisify } from "util";
import fs21 from "fs";
var execAsync, checkPuppeteerReady, installPuppeteerBrowser;
var init_setup = __esm({
  "src/utils/setup.js"() {
    execAsync = promisify(exec);
    checkPuppeteerReady = () => {
      try {
        const exePath = puppeteer4.executablePath();
        const exists = exePath && fs21.existsSync(exePath);
        if (exists) return true;
      } catch (e) {
        return false;
      }
      return false;
    };
    installPuppeteerBrowser = async (onStatus) => {
      if (onStatus) onStatus("\u{1F4E5} Downloading Chromium engine (chrome@148)...");
      try {
        try {
          await execAsync("pnpm exec puppeteer browsers install chrome@148");
        } catch (pnpmErr) {
          await execAsync("npx -y puppeteer browsers install chrome@148");
        }
        await new Promise((r) => setTimeout(r, 1e3));
        return { success: true };
      } catch (err) {
        console.error("[SETUP ERROR]", err);
        return { success: false, error: err.message };
      }
    };
  }
});

// src/app.jsx
var app_exports = {};
__export(app_exports, {
  default: () => App
});
import os4 from "os";
import React15, { useState as useState14, useEffect as useEffect11, useRef as useRef3, useMemo as useMemo2 } from "react";
import { Box as Box14, Text as Text15, useInput as useInput9, useStdout as useStdout2, Static } from "ink";
import fs22 from "fs-extra";
import path20 from "path";
import { exec as exec2 } from "child_process";
import { fileURLToPath } from "url";
import TextInput4 from "ink-text-input";
import SelectInput2 from "ink-select-input";
import gradient2 from "gradient-string";
function App({ args = [] }) {
  let lastGCTime = 1;
  const [confirmExit, setConfirmExit] = useState14(false);
  const [exitCountdown, setExitCountdown] = useState14(10);
  const { stdout } = useStdout2();
  const [input, setInput] = useState14("");
  const [inputKey, setInputKey] = useState14(0);
  const [isExpanded, setIsExpanded] = useState14(false);
  const [mode, setMode] = useState14("Flux");
  const [terminalSize, setTerminalSize] = useState14({
    columns: stdout?.columns || 80,
    rows: stdout?.rows || 24
  });
  const [selectedIndex, setSelectedIndex] = useState14(0);
  const [isFilePickerDismissed, setIsFilePickerDismissed] = useState14(false);
  const [showBridgePromo, setShowBridgePromo] = useState14(false);
  const [promoSelectedIndex, setPromoSelectedIndex] = useState14(0);
  const suggestionOffsetRef = useRef3(0);
  const persistedModelRef = useRef3(null);
  useEffect11(() => {
    const ideName = getIDEName();
    const isIDE = !["Terminal", "Windows Terminal"].includes(ideName) || !!process.env.VSC_TERMINAL_URL;
    const graceTimer = setTimeout(() => {
      if (isIDE && !isBridgeConnected()) {
        setShowBridgePromo(true);
      }
    }, 500);
    const interval = setInterval(() => {
      if (isBridgeConnected()) {
        setShowBridgePromo(false);
      }
    }, 1e3);
    lastGCTime = Date.now();
    const memInterval = setInterval(() => {
      if (lastGCTime) {
        const diff = Date.now() - lastGCTime || 0;
        if (diff > 3e4) {
          if (global.gc) {
            try {
              global.gc();
              lastGCTime = Date.now();
            } catch (e) {
            }
          }
        }
      }
    }, 3e3);
    return () => {
      clearTimeout(graceTimer);
      clearInterval(interval);
      clearInterval(memInterval);
    };
  }, []);
  const parsedArgs = useMemo2(() => {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--key" && args[i + 1]) {
        const val = args[i + 1];
        parsed.key = val;
        if (val.includes("@")) {
          const parts = val.split("@");
          const keyPart = parts[0];
          const provPart = parts[1].toLowerCase();
          if (["google", "deepseek", "openrouter", "nvidia"].includes(provPart)) {
            let mapped = "Google";
            if (provPart === "google") mapped = "Google";
            else if (provPart === "deepseek") mapped = "DeepSeek";
            else if (provPart === "openrouter") mapped = "OpenRouter";
            else if (provPart === "nvidia") mapped = "NVIDIA";
            parsed.key = keyPart;
            parsed.provider = mapped;
          }
        }
      }
    }
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--key") {
        i++;
        continue;
      }
      if (arg === "--model" && args[i + 1]) {
        parsed.model = args[i + 1];
        i++;
      } else if (arg === "--memory" && args[i + 1]) {
        parsed.memory = args[i + 1].toLowerCase();
        i++;
      } else if (arg === "--resume" && args[i + 1]) {
        parsed.resume = args[i + 1];
        i++;
      } else if (arg === "--package" && args[i + 1]) {
        const pkg = args[i + 1].toLowerCase();
        if (["npm", "pnpm", "yarn", "bun"].includes(pkg)) {
          parsed.package = pkg;
        }
        i++;
      } else if (arg === "--auto-del" && args[i + 1]) {
        const del = args[i + 1].toLowerCase();
        if (["1d", "7d", "30d"].includes(del)) {
          parsed.autoDel = del;
        }
        i++;
      } else if (arg === "--auto-exec" && args[i + 1]) {
        parsed.autoExec = args[i + 1].toLowerCase();
        i++;
      } else if (arg === "--yolo" && args[i + 1]) {
        parsed.autoExec = args[i + 1].toLowerCase();
        i++;
      } else if (arg === "--external-access" && args[i + 1]) {
        parsed.externalAccess = args[i + 1].toLowerCase();
        i++;
      } else if (arg === "--mode" && args[i + 1]) {
        const val = args[i + 1];
        const lower = val.toLowerCase();
        if (["flux", "flow"].includes(lower)) {
          let mapped = "Flux";
          if (lower === "flux") mapped = "Flux";
          else if (lower === "flow") mapped = "Flow";
          parsed.mode = mapped;
        }
        i++;
      } else if (arg === "--thinking" && args[i + 1]) {
        const val = args[i + 1];
        const lower = val.toLowerCase();
        if (["fast", "low", "medium", "high", "xhigh", "standard"].includes(lower)) {
          let mapped = "Medium";
          if (lower === "fast") mapped = "Fast";
          else if (lower === "low") mapped = "Low";
          else if (lower === "standard") mapped = "Standard";
          else if (lower === "medium") mapped = "Medium";
          else if (lower === "high") mapped = "High";
          else if (lower === "xhigh") mapped = "xHigh";
          parsed.thinking = mapped;
        }
        i++;
      } else if (arg === "--provider" && args[i + 1]) {
        const val = args[i + 1].toLowerCase();
        if (["google", "deepseek", "openrouter", "nvidia"].includes(val)) {
          let mapped = "Google";
          if (val === "google") mapped = "Google";
          else if (val === "deepseek") mapped = "DeepSeek";
          else if (val === "openrouter") mapped = "OpenRouter";
          else if (val === "nvidia") mapped = "NVIDIA";
          parsed.provider = mapped;
        }
        i++;
      } else if ((arg === "--resume" || arg === "-r") && args[i + 1]) {
        parsed.resume = args[i + 1];
        i++;
      } else if (arg === "--playground") {
        parsed.playground = true;
      } else if ((arg === "--original-cwd" || arg === "--orginal-cwd") && args[i + 1]) {
        parsed.originalCwd = args[i + 1];
        i++;
      }
    }
    return parsed;
  }, [args]);
  const performVersionCheck = async (manual = false, settingsOverride = null) => {
    const settingsToUse = settingsOverride || systemSettings;
    if (manual) {
      setMessages((prev) => {
        setCompletedIndex(prev.length + 1);
        return [...prev, { id: "check-" + Date.now(), role: "system", text: "[SYSTEM] Checking for updates...", isMeta: true }];
      });
    }
    try {
      const response = await fetch("https://registry.npmjs.org/fluxflow-cli", { cache: "no-store" });
      const data = await response.json();
      const latestVersion = data["dist-tags"]?.latest;
      const stableVersion = data["dist-tags"]?.stable;
      if (latestVersion) setLatestVer(latestVersion);
      if (latestVersion && latestVersion !== versionFluxflow) {
        const versionDisplay = latestVersion === stableVersion ? `v${latestVersion}-stable` : `v${latestVersion}`;
        if (!manual && settingsToUse.autoUpdate) {
          setActiveView("update");
        } else {
          setMessages((prev) => {
            const newMsgs = [...prev];
            const spliceIdx = manual ? newMsgs.length : Math.min(newMsgs.length, 3);
            newMsgs.splice(spliceIdx, 0, {
              id: "update-" + Date.now(),
              role: "system",
              text: `A new version (${versionDisplay}) is here.

  \u2022 Type \`/update latest\` to apply the update.
  \u2022 Type \`/changelog\` to view the release notes.`,
              isUpdateNotification: true,
              isMeta: true
            });
            return newMsgs;
          });
        }
      } else if (manual) {
        setMessages((prev) => {
          setCompletedIndex(prev.length + 1);
          const displayVer = latestVersion && latestVersion === stableVersion ? `${versionFluxflow}-stable` : versionFluxflow;
          return [...prev, { id: "uptodate-" + Date.now(), role: "system", text: `[SYSTEM] Flux Flow is already up to date (${displayVer}).`, isMeta: true }];
        });
      }
    } catch (err) {
      if (manual) {
        setMessages((prev) => {
          setCompletedIndex(prev.length + 1);
          return [...prev, { id: "check-err-" + Date.now(), role: "system", text: `ERROR: Failed to check for updates: ${err.message}`, isMeta: true }];
        });
      }
    }
  };
  useEffect11(() => {
    const handleResize = () => {
      stdout.write("\x1B[2J\x1B[3J\x1B[H");
      setTerminalSize({
        columns: stdout.columns,
        rows: stdout.rows
      });
    };
    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);
  const [thinkingLevel, setThinkingLevel] = useState14("Medium");
  const [aiProvider, setAiProvider] = useState14("Google");
  const [setupStep, setSetupStep] = useState14(0);
  const [latestVer, setLatestVer] = useState14(null);
  const [showFullThinking, setShowFullThinking] = useState14(false);
  const [activeModel, setActiveModel] = useState14("gemma-4-31b-it");
  const [janitorModel, setJanitorModel] = useState14("gemma-4-26b-a4b-it");
  const [isInitializing, setIsInitializing] = useState14(true);
  const [isAppFocused, setIsAppFocused] = useState14(true);
  const lastFocusEventTime = useRef3(0);
  const [apiKey, setApiKey] = useState14(null);
  const [tempKey, setTempKey] = useState14("");
  const addShiftEnterBinding = async (ideName) => {
    const kbPath = getKeybindingsPath(ideName);
    if (!kbPath) return;
    try {
      await fs22.ensureDir(path20.dirname(kbPath));
      let bindings = [];
      if (fs22.existsSync(kbPath)) {
        const content = fs22.readFileSync(kbPath, "utf8").trim();
        if (content) {
          try {
            bindings = parseJsonc(content);
          } catch (e) {
            bindings = [];
          }
        }
      }
      if (!Array.isArray(bindings)) {
        bindings = [];
      }
      bindings.push({
        "key": "shift+enter",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
          "text": "\x1B[13;2u"
        },
        "when": "terminalFocus"
      });
      fs22.writeFileSync(kbPath, JSON.stringify(bindings, null, 4), "utf8");
      cachedShortcut = "Shift + Enter";
      setMessages((prev) => {
        setCompletedIndex(prev.length + 1);
        return [...prev, {
          id: "kb-success-" + Date.now(),
          role: "system",
          text: `\u2705 Successfully configured Shift+Enter in your ${ideName} keybindings!`,
          isMeta: true
        }];
      });
    } catch (err) {
      setMessages((prev) => {
        setCompletedIndex(prev.length + 1);
        return [...prev, {
          id: "kb-error-" + Date.now(),
          role: "system",
          text: `\u274C Failed to update keybindings: ${err.message}`,
          isMeta: true
        }];
      });
    }
  };
  const [activeView, setActiveView] = useState14("chat");
  const [apiTier, setApiTier] = useState14("Free");
  const [quotas, setQuotas] = useState14({ limitMode: "Daily", agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: "", customLimit: 0, providerBudgets: {} });
  const [inputConfig, setInputConfig] = useState14(null);
  const [budgetReturnView, setBudgetReturnView] = useState14("chat");
  const [providerBudgetQueue, setProviderBudgetQueue] = useState14([]);
  const [providerBudgetCursor, setProviderBudgetCursor] = useState14(0);
  const [pbsCursor, setPbsCursor] = useState14(0);
  const [pbsSelected, setPbsSelected] = useState14({});
  const [systemSettings, setSystemSettings] = useState14({ memory: true, compression: 0, autoExec: false, autoDeleteHistory: "7d", autoUpdate: false, updateManager: "npm", customUpdateCommand: "" });
  const [profileData, setProfileData] = useState14({ name: null, nickname: null, instructions: null });
  const [imageSettings, setImageSettings] = useState14({ keyType: "Default", quality: "Low-High", apiKey: "" });
  const [sessionStats, setSessionStats] = useState14({ tokens: 0 });
  const [sessionAgentCalls, setSessionAgentCalls] = useState14(0);
  const [sessionBackgroundCalls, setSessionBackgroundCalls] = useState14(0);
  const [sessionTotalTokens, setSessionTotalTokens] = useState14(0);
  const [chatTokens, setChatTokens] = useState14(0);
  const chatTokenStartRef = useRef3(0);
  const [sessionTotalCachedTokens, setSessionTotalCachedTokens] = useState14(0);
  const [sessionTotalCandidateTokens, setSessionTotalCandidateTokens] = useState14(0);
  const [sessionToolSuccess, setSessionToolSuccess] = useState14(0);
  const [sessionToolFailure, setSessionToolFailure] = useState14(0);
  const [sessionToolDenied, setSessionToolDenied] = useState14(0);
  const [sessionApiTime, setSessionApiTime] = useState14(0);
  const [sessionToolTime, setSessionToolTime] = useState14(0);
  const [sessionImageCount, setSessionImageCount] = useState14(0);
  const [sessionImageCredits, setSessionImageCredits] = useState14(0);
  const [dailyUsage, setDailyUsage] = useState14(null);
  const [monthlyUsage, setMonthlyUsage] = useState14(null);
  const [customPeriodUsage, setCustomPeriodUsage] = useState14(null);
  const [statsMode, setStatsMode] = useState14("daily");
  const PLAYGROUND_CHAT_ID = "flow-playground";
  const [chatId, setChatId] = useState14(args.includes("--playground") ? PLAYGROUND_CHAT_ID : generateChatId());
  useEffect11(() => {
    if (chatLoadingRef.current) return;
    const nextTokens = sessionTotalTokens - chatTokenStartRef.current;
    setChatTokens(nextTokens);
    if (chatId) {
      saveChatContext(chatId, nextTokens, sessionStats.tokens).catch(() => {
      });
    }
  }, [sessionTotalTokens, chatId, sessionStats.tokens]);
  useEffect11(() => {
    if (activeView === "apiTier") {
      const load = async () => {
        const d = await getDailyUsage();
        setDailyUsage(d);
        const m = await getMonthlyUsage();
        setMonthlyUsage(m);
        const c = await getCustomPeriodUsage(quotas.resetDay || 1);
        setCustomPeriodUsage(c);
      };
      load();
    }
  }, [activeView, quotas.resetDay]);
  const [activeCommand, setActiveCommand] = useState14(null);
  const [execOutput, setExecOutput] = useState14("");
  const [isTerminalFocused, setIsTerminalFocused] = useState14(false);
  const [activeSubagents, setActiveSubagents] = useState14([]);
  const [tick, setTick] = useState14(0);
  const isFirstRender = useRef3(true);
  const isSecondRender = useRef3(true);
  const isThirdRender = useRef3(true);
  const prevProviderRef = useRef3(aiProvider);
  const originalAllowExternalAccessRef = useRef3(false);
  const originalMemoryRef = useRef3(true);
  useEffect11(() => {
    if (prevProviderRef.current !== aiProvider) {
      prevProviderRef.current = aiProvider;
      const hasStandard = aiProvider === "DeepSeek" || aiProvider === "NVIDIA";
      setThinkingLevel(hasStandard ? "Standard" : "Medium");
    } else {
      if (aiProvider === "Google" && thinkingLevel === "xHigh") {
        if (activeModel && activeModel.toLowerCase().startsWith("gemini-3")) {
          setThinkingLevel("High");
        }
      }
    }
  }, [aiProvider, activeModel, thinkingLevel]);
  useEffect11(() => {
    if (!apiKey) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setTimeout(() => {
        isSecondRender.current = false;
        setTimeout(() => {
          isThirdRender.current = false;
        }, 1e3);
      }, 2e3);
      return;
    }
    if (isSecondRender.current) {
      return;
    }
    if (isThirdRender.current) {
      return;
    }
    const s = emojiSpace(2);
    let defaultModel = "";
    let modelDisplayName = "";
    if (apiTier === "Free") {
      if (aiProvider === "Google") {
        defaultModel = "gemma-4-31b-it";
        modelDisplayName = "Gemma 4 (Free default)";
      } else if (aiProvider === "DeepSeek") {
        defaultModel = "deepseek-v4-flash";
        modelDisplayName = "DeepSeek Flash (Free default)";
      } else if (aiProvider === "NVIDIA") {
        defaultModel = "moonshotai/kimi-k2.6";
        modelDisplayName = "Moonshot Kimi (NVIDIA)";
      } else {
        defaultModel = "google/gemma-4-31b-it:free";
        modelDisplayName = "Gemma 4 (Free default)";
      }
    } else {
      if (aiProvider === "Google") {
        defaultModel = "gemini-3-flash-preview";
        modelDisplayName = "Gemini 3 Flash";
      } else if (aiProvider === "DeepSeek") {
        defaultModel = "deepseek-v4-flash";
        modelDisplayName = "DeepSeek Flash";
      } else if (aiProvider === "NVIDIA") {
        defaultModel = "moonshotai/kimi-k2.6";
        modelDisplayName = "Moonshot Kimi (NVIDIA)";
      } else {
        defaultModel = "deepseek/deepseek-v4-flash";
        modelDisplayName = "DeepSeek Flash";
      }
    }
    setActiveModel(defaultModel);
    saveSettings({ apiTier, activeModel: defaultModel });
    setMessages((prev) => {
      setCompletedIndex(prev.length + 1);
      return [...prev, {
        id: "tier-switch-" + Date.now(),
        role: "system",
        text: `**[TIER LIMIT]** Auto-switched to ${modelDisplayName}.`,
        isMeta: true
      }];
    });
  }, [apiTier, aiProvider, apiKey]);
  const terminalEnv = useMemo2(() => {
    const ideName = getIDEName();
    const isIDE = !["Terminal", "Windows Terminal"].includes(ideName) || !!process.env.VSC_TERMINAL_URL || !!process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS;
    return {
      isIDE,
      get shortcut() {
        return cachedShortcut;
      }
    };
  }, []);
  const activeCommandRef = useRef3(null);
  const execOutputRef = useRef3("");
  useEffect11(() => {
    activeCommandRef.current = activeCommand;
  }, [activeCommand]);
  useEffect11(() => {
    execOutputRef.current = execOutput;
  }, [execOutput]);
  const [autoAcceptWrites, setAutoAcceptWrites] = useState14(false);
  const [pendingApproval, setPendingApproval] = useState14(null);
  const [pendingAsk, setPendingAsk] = useState14(null);
  const resetPendingApproval = (decision) => {
    setPendingApproval(null);
    setActiveView("chat");
  };
  const formatDuration = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor(totalSecs % 3600 / 60);
    const s = totalSecs % 60;
    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };
  const formatMsDuration = (ms) => {
    if (ms < 1e3) return `${ms}ms`;
    return formatDuration(Math.floor(ms / 1e3));
  };
  const [statusText, setStatusText] = useState14(null);
  const [wittyPhrase, setWittyPhrase] = useState14("");
  const [hasPasteBlock, setHasPasteBlock] = useState14(false);
  const [activeTime, setActiveTime] = useState14(0);
  let interval_for_timer;
  useEffect11(() => {
    let interval;
    if (statusText) {
      const updatePhrase = () => {
        const randomPhrase = WITTY_LOADING_PHRASES[Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)];
        setWittyPhrase(randomPhrase);
      };
      if (!wittyPhrase) updatePhrase();
      interval = setInterval(updatePhrase, 1e4);
    } else {
      setWittyPhrase("");
    }
    return () => {
      clearInterval(interval);
    };
  }, [statusText]);
  const [isSpinnerActive, setIsSpinnerActive] = useState14(true);
  const [isProcessing, setIsProcessing] = useState14(false);
  const [isCompressing, setIsCompressing] = useState14(false);
  const [escPressed, setEscPressed] = useState14(false);
  const [escTimer, setEscTimer] = useState14(null);
  const [escPressCount, setEscPressCount] = useState14(0);
  const [recentPrompts, setRecentPrompts] = useState14([]);
  const escDoubleTimerRef = useRef3(null);
  const chatLoadingRef = useRef3(false);
  useEffect11(() => {
    return () => {
      if (escDoubleTimerRef.current) {
        clearTimeout(escDoubleTimerRef.current);
      }
    };
  }, []);
  const didSignalTerminationRef = useRef3(false);
  const [queuedPrompt, setQueuedPrompt] = useState14(null);
  const [resolutionData, setResolutionData] = useState14(null);
  const [tempModelOverride, setTempModelOverride] = useState14(null);
  useEffect11(() => setEscPressCount(0), [input]);
  const [messages, rawSetMessages] = useState14(() => {
    const logoMsg = { id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true };
    const isHomeDir = process.cwd() === os4.homedir();
    const isSystemDir = (() => {
      const cwd = process.cwd().toLowerCase();
      if (process.platform === "win32") {
        const winDir = process.env.SystemRoot?.toLowerCase() || "c:\\windows";
        const progFiles = process.env.ProgramFiles?.toLowerCase() || "c:\\program files";
        const progFilesX86 = process.env["ProgramFiles(x86)"]?.toLowerCase() || "c:\\program files (x86)";
        return cwd.startsWith(winDir) || cwd.startsWith(progFiles) || cwd.startsWith(progFilesX86);
      } else {
        const sysPaths = ["/bin", "/sbin", "/etc", "/usr", "/var", "/root"];
        return cwd === "/" || sysPaths.some((p) => cwd.startsWith(p));
      }
    })();
    const msgs = [logoMsg];
    if (isSystemDir) {
      msgs.push({
        id: "system-warning",
        role: "system",
        text: `[CRITICAL SECURITY ALERT] SYSTEM DIRECTORY DETECTED`,
        subText: `You are currently in a PROTECTED SYSTEM DIRECTORY (${process.cwd()}). Operating here is EXTREMELY dangerous as the agent could accidentally corrupt your OS or installed applications. Open FluxFlow in project folder to work safely.`,
        isHomeWarning: true
      });
    } else if (isHomeDir) {
      msgs.push({
        id: "home-warning",
        role: "system",
        text: `[SECURITY ALERT] HOME DIRECTORY DETECTED`,
        subText: `You are currently in ${os4.homedir()}. Working here is high-risk as the agent may modify system-sensitive configurations. Please open FluxFlow in project folder.`,
        isHomeWarning: true
      });
    }
    return msgs;
  });
  const setMessages = (value) => {
    rawSetMessages((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next.length > 1) {
        const last = next[next.length - 1];
        const secondLast = next[next.length - 2];
        if (last?.text?.includes("Request Cancelled") && secondLast?.text?.includes("Request Cancelled")) {
          return next.slice(0, -1);
        }
      }
      return next;
    });
  };
  const queuedPromptRef = useRef3(null);
  const [btwResponse, setBtwResponse] = useState14("");
  const [showBtwBox, setShowBtwBox] = useState14(false);
  const btwResponseRef = useRef3("");
  const btwClosedRef = useRef3(null);
  useEffect11(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && (lastMsg.role === "agent" || lastMsg.role === "assistant")) {
      const text = lastMsg.text || "";
      const match = text.match(/\[ANSWER\]([\s\S]*?)(?:\[\/ANSWER\]|$)/i);
      if (match) {
        const content = match[1].trim();
        if (content && content !== btwResponseRef.current) {
          setBtwResponse(content);
          btwResponseRef.current = content;
          if (btwClosedRef.current !== lastMsg.id) {
            setShowBtwBox(true);
          }
        }
      }
    }
  }, [messages]);
  const [completedIndex, setCompletedIndex] = useState14(messages.length);
  const [clearKey, setClearKey] = useState14(0);
  const lastCompletedBlocksRef = useRef3([]);
  const cachedHistoryRef = useRef3({
    completedIndex: 0,
    columns: 0,
    historicalBlocks: [],
    seenSelections: /* @__PURE__ */ new Set(),
    chatId: "",
    clearKey: 0
  });
  const parsedBlocks = useMemo2(() => {
    const columns = terminalSize.columns || 80;
    const SELECTION_REGEX = /Selection: (.*)/;
    let historicalBlocks = [];
    let seenAskSelections = /* @__PURE__ */ new Set();
    const isResize = cachedHistoryRef.current.columns !== columns;
    const isClear = completedIndex < cachedHistoryRef.current.completedIndex;
    const isChatChanged = cachedHistoryRef.current.chatId !== chatId;
    const isClearKeyChanged = cachedHistoryRef.current.clearKey !== clearKey;
    if (isResize || isClear || isChatChanged || isClearKeyChanged) {
      const completedMsgs = messages.slice(0, completedIndex);
      for (let i = 0; i < completedMsgs.length; i++) {
        const msg = completedMsgs[i];
        if (msg.isAskRecord && msg.text) {
          const match = msg.text.match(SELECTION_REGEX);
          if (match && match[1].trim()) {
            const selection = match[1].trim();
            if (seenAskSelections.has(selection)) continue;
            seenAskSelections.add(selection);
          }
        }
        const parsed = parseMessageToBlocks(msg, columns);
        for (let j = 0; j < parsed.completed.length; j++) historicalBlocks.push(parsed.completed[j]);
        for (let j = 0; j < parsed.active.length; j++) historicalBlocks.push(parsed.active[j]);
      }
      cachedHistoryRef.current = {
        completedIndex,
        columns,
        historicalBlocks,
        seenSelections: new Set(seenAskSelections),
        chatId,
        clearKey
      };
    } else {
      historicalBlocks = cachedHistoryRef.current.historicalBlocks;
      seenAskSelections = cachedHistoryRef.current.seenSelections;
      if (completedIndex > cachedHistoryRef.current.completedIndex) {
        historicalBlocks = [...historicalBlocks];
        seenAskSelections = new Set(seenAskSelections);
        const newMsgs = messages.slice(cachedHistoryRef.current.completedIndex, completedIndex);
        for (let i = 0; i < newMsgs.length; i++) {
          const msg = newMsgs[i];
          if (msg.isAskRecord && msg.text) {
            const match = msg.text.match(SELECTION_REGEX);
            if (match && match[1].trim()) {
              const selection = match[1].trim();
              if (seenAskSelections.has(selection)) continue;
              seenAskSelections.add(selection);
            }
          }
          const parsed = parseMessageToBlocks(msg, columns);
          for (let j = 0; j < parsed.completed.length; j++) historicalBlocks.push(parsed.completed[j]);
          for (let j = 0; j < parsed.active.length; j++) historicalBlocks.push(parsed.active[j]);
        }
        cachedHistoryRef.current = {
          completedIndex,
          columns,
          historicalBlocks,
          seenSelections: seenAskSelections,
          chatId,
          clearKey
        };
      }
    }
    const activeMsgs = messages.slice(completedIndex);
    const streamingCompletedBlocks = [];
    const activeBlocks = [];
    for (let i = 0; i < activeMsgs.length; i++) {
      const msg = activeMsgs[i];
      if (msg.isAskRecord && msg.text) {
        const match = msg.text.match(SELECTION_REGEX);
        if (match && match[1].trim()) {
          const selection = match[1].trim();
          if (seenAskSelections.has(selection)) continue;
        }
      }
      const parsed = parseMessageToBlocks(msg, columns);
      for (let j = 0; j < parsed.completed.length; j++) streamingCompletedBlocks.push(parsed.completed[j]);
      for (let j = 0; j < parsed.active.length; j++) activeBlocks.push(parsed.active[j]);
    }
    const finalCompleted = [...historicalBlocks];
    for (let j = 0; j < streamingCompletedBlocks.length; j++) {
      finalCompleted.push(streamingCompletedBlocks[j]);
    }
    if (finalCompleted.length >= 75e3) {
      finalCompleted.push({
        key: `memory-warning-block-${finalCompleted.length}`,
        msg: {
          role: "system",
          text: `\u26A0\uFE0F MEMORY WARNING: CHAT IS GETTING VERY LONG`,
          subText: `This session has reached ${finalCompleted.length} blocks. To maintain optimal performance and prevent high memory usage, it is highly recommended to save and start a clean chat with /clear.`,
          isHomeWarning: true
        },
        type: "full-message"
      });
    }
    return {
      completed: finalCompleted,
      active: activeBlocks
    };
  }, [messages, completedIndex, terminalSize.columns, clearKey, chatId]);
  const isTerminalWaitingForInput = useMemo2(() => {
    if (!activeCommand || !execOutput) return false;
    const lastChunk = execOutput.trim();
    return lastChunk.endsWith("?") || lastChunk.endsWith(":") || /\[[yYnN/]+\]\s*$/.test(lastChunk) || /\([yYnN]\)\s*$/.test(lastChunk);
  }, [activeCommand, execOutput]);
  useInput9((inputText, key) => {
    if (inputText === "\x1B[I" || inputText === "\x1B[O" || inputText === "[I" || inputText === "[O") {
      return;
    }
    if (key.ctrl && (inputText.toLowerCase() === "r" || inputText === "" || inputText === "")) {
      getMemoryInfo();
      return;
    }
    if (activeView === "stats") {
      if (key.tab && !key.shift) {
        setStatsMode((prev) => {
          if (prev === "modelBreakdown") return "daily";
          return prev === "daily" ? "monthly" : "daily";
        });
        return;
      }
      if (key.space || inputText === " ") {
        setStatsMode((prev) => prev === "modelBreakdown" ? "daily" : "modelBreakdown");
        return;
      }
    }
    if (showBridgePromo) {
      const ideName = getIDEName();
      const options = getPromoOptions(ideName);
      if (key.upArrow) {
        setPromoSelectedIndex((prev) => prev > 0 ? prev - 1 : options.length - 1);
      } else if (key.downArrow) {
        setPromoSelectedIndex((prev) => prev < options.length - 1 ? prev + 1 : 0);
      } else if (key.return) {
        const opt = options[promoSelectedIndex];
        if (opt.action === "dismiss") {
          setShowBridgePromo(false);
        } else if (opt.url) {
          const openCmd = process.platform === "win32" ? `start ${opt.url}` : process.platform === "darwin" ? `open ${opt.url}` : `xdg-open ${opt.url}`;
          exec2(openCmd);
          setShowBridgePromo(false);
        }
      }
      return;
    }
    if (key.tab && activeCommand) {
      setIsTerminalFocused((prev) => !prev);
      return;
    }
    if (isTerminalFocused && activeCommand) {
      if (key.return) {
        if (isActiveCommandPty) {
          writeToActiveCommand("\r");
        } else {
          const isWin = process.platform === "win32";
          writeToActiveCommand(isWin ? "\r\n" : "\n");
          setExecOutput((prev) => prev + "\n");
        }
      } else if (key.backspace || key.delete) {
        if (isActiveCommandPty) {
          writeToActiveCommand("\x7F");
        } else {
          writeToActiveCommand("\b \b");
          setExecOutput((prev) => prev.slice(0, -1));
        }
      } else if (key.upArrow) {
        writeToActiveCommand(key.shift ? "\x1B[1;2A" : "\x1B[A");
      } else if (key.downArrow) {
        writeToActiveCommand(key.shift ? "\x1B[1;2B" : "\x1B[B");
      } else if (key.rightArrow) {
        writeToActiveCommand(key.shift ? "\x1B[1;2C" : "\x1B[C");
      } else if (key.leftArrow) {
        writeToActiveCommand(key.shift ? "\x1B[1;2D" : "\x1B[D");
      } else if (key.escape) {
        writeToActiveCommand("\x1B");
      } else if (key.ctrl && inputText) {
        const charCode = inputText.toLowerCase().charCodeAt(0);
        if (charCode >= 97 && charCode <= 122) {
          writeToActiveCommand(String.fromCharCode(charCode - 96));
        } else {
          writeToActiveCommand(inputText);
        }
      } else if (inputText) {
        writeToActiveCommand(inputText);
        if (!isActiveCommandPty) setExecOutput((prev) => prev + inputText);
      }
      return;
    }
    if (activeView === "providerBudgetSelect") {
      const PBS_PROVIDERS = ["Google", "DeepSeek", "NVIDIA", "OpenRouter"];
      if (key.upArrow) {
        setPbsCursor((c) => (c - 1 + PBS_PROVIDERS.length) % PBS_PROVIDERS.length);
        return;
      } else if (key.downArrow) {
        setPbsCursor((c) => (c + 1) % PBS_PROVIDERS.length);
        return;
      } else if (inputText === " ") {
        const prov = PBS_PROVIDERS[pbsCursor];
        setPbsSelected((s) => ({ ...s, [prov]: !s[prov] }));
        return;
      } else if (key.return) {
        const chosenProviders = PBS_PROVIDERS.filter((p) => pbsSelected[p]);
        if (chosenProviders.length === 0) return;
        const updatedQuotas = { ...quotas, providerBudgets: { ...quotas.providerBudgets || {}, __useProvider: true } };
        setQuotas(updatedQuotas);
        setProviderBudgetQueue(chosenProviders);
        setProviderBudgetCursor(0);
        setPbsCursor(0);
        setActiveView("providerBudgetFlow");
        return;
      } else if (key.escape) {
        setActiveView("budgetTypeSelect");
        return;
      }
      return;
    }
    if (key.escape) {
      if (showBtwBox) {
        setShowBtwBox(false);
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg) {
            btwClosedRef.current = lastMsg.id;
          }
        }
        return;
      }
      if (suggestions.length > 0 && activeView === "chat") {
        setIsFilePickerDismissed(true);
        return;
      }
      if (confirmExit) {
        setConfirmExit(false);
        return;
      }
      if (isProcessing || activeCommand || pendingApproval || pendingAsk) {
        didSignalTerminationRef.current = true;
        signalTermination();
        terminateActiveCommand();
        if (pendingApproval) {
          pendingApproval.resolve("deny");
          setPendingApproval(null);
        }
        if (pendingAsk) {
          pendingAsk.resolve(null);
          setPendingAsk(null);
        }
        setEscPressed(false);
        if (escTimer) clearTimeout(escTimer);
      } else {
        if (activeView === "revert") {
          setActiveView("chat");
          setEscPressCount(0);
        } else if (activeView !== "chat" && activeView !== "settings") {
          setActiveView("chat");
        } else {
          if (!apiKey && setupStep === 1) {
            setSetupStep(0);
            setTempKey("");
            return;
          }
          setEscPressCount((prev) => {
            const nextCount = prev + 1;
            if (nextCount === 1) {
              if (escDoubleTimerRef.current) clearTimeout(escDoubleTimerRef.current);
              escDoubleTimerRef.current = setTimeout(() => setEscPressCount(0), 2e3);
            } else if (nextCount === 2) {
              if (escDoubleTimerRef.current) clearTimeout(escDoubleTimerRef.current);
              setEscPressCount(0);
              if (input.length > 0) {
                setInput("");
              } else {
                RevertManager.getChatHistory(chatId).then((prompts) => {
                  if (prompts.length > 0) {
                    setRecentPrompts(prompts.reverse());
                    setActiveView("revert");
                  } else {
                    setMessages((prev2) => {
                      setCompletedIndex(prev2.length + 1);
                      return [...prev2, { id: "revert-empty-" + Date.now(), role: "system", text: "\u{1F6C8} Nothing to revert to.", isMeta: true }];
                    });
                  }
                });
              }
            }
            return nextCount;
          });
        }
      }
    }
    if (suggestions.length > 0 && activeView === "chat") {
      if (key.upArrow) {
        setSelectedIndex((prev) => prev > 0 ? prev - 1 : suggestions.length - 1);
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => prev < suggestions.length - 1 ? prev + 1 : 0);
        return;
      }
      if (key.return) {
        return;
      }
    }
    if (key.tab && activeView === "chat") {
    }
    if (key.ctrl && inputText === "c" && activeView !== "exit") {
      if (input.length > 0) {
        setInput("");
        return;
      }
      if (key.shift) {
        setActiveView("exit");
        setConfirmExit(false);
        return;
      }
      if (!confirmExit) {
        setConfirmExit(true);
      } else {
        setActiveView("exit");
        setConfirmExit(false);
      }
    }
    if (key.return && (key.shift || key.ctrl || key.meta || key.leftAlt || key.rightAlt)) {
      setInput((prev) => prev.replace(/\\\r?$/, "").replace(/\r?$/, "") + "\n");
    }
  });
  useEffect11(() => {
    process.stdout.write("\x1B[?1004h");
    const onData = (data) => {
      const str = data.toString();
      if (str.includes("\x1B[I")) {
        setIsAppFocused(true);
        lastFocusEventTime.current = Date.now();
      } else if (str.includes("\x1B[O")) {
        setIsAppFocused(false);
        lastFocusEventTime.current = Date.now();
      }
    };
    process.stdin.on("data", onData);
    return () => {
      process.stdout.write("\x1B[?1004l");
      process.stdin.off("data", onData);
    };
  }, []);
  useEffect11(() => {
    async function init() {
      try {
        const pkg = JSON.parse(fs22.readFileSync(path20.join(process.cwd(), "package.json"), "utf8"));
        initBridge(versionFluxflow || pkg.version || "2.0.0");
      } catch (e) {
        initBridge("2.0.0");
      }
      if (process.stdout.isTTY) {
        process.stdout.write("\x1B]0;FluxFlow\x07");
        process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07");
      }
      if (!checkPuppeteerReady()) {
        setMessages((prev) => {
          setCompletedIndex(prev.length + 1);
          return [...prev, { id: "setup-" + Date.now(), role: "system", text: "[SYSTEM] Installing Required dependencies... (One-time setup)", isMeta: true }];
        });
        await installPuppeteerBrowser();
        setMessages((prev) => {
          setCompletedIndex(prev.length + 1);
          return [...prev, { id: "setup-done-" + Date.now(), role: "system", text: "[SYSTEM] All dependencies installed successfully.", isMeta: true }];
        });
      }
      const saved = await loadSettings();
      originalAllowExternalAccessRef.current = saved.systemSettings?.allowExternalAccess ?? false;
      originalMemoryRef.current = saved.systemSettings?.memory ?? true;
      if (parsedArgs.mode) {
        setMode(parsedArgs.mode);
      } else {
        setMode(saved.mode);
      }
      if (parsedArgs.thinking) {
        setThinkingLevel(parsedArgs.thinking);
      } else {
        setThinkingLevel(saved.thinkingLevel);
      }
      const startupProvider = parsedArgs.provider || saved.aiProvider || "Google";
      setAiProvider(startupProvider);
      const providerTiers = saved.quotas?.providerTiers || {};
      const currentTier = providerTiers[startupProvider] || saved.apiTier || "Free";
      persistedModelRef.current = saved.activeModel;
      if (parsedArgs.model) {
        setActiveModel(parsedArgs.model);
      } else if (parsedArgs.provider) {
        let defaultModel = "";
        if (currentTier === "Free") {
          if (startupProvider === "Google") {
            defaultModel = "gemma-4-31b-it";
          } else if (startupProvider === "DeepSeek") {
            defaultModel = "deepseek-v4-flash";
          } else if (startupProvider === "OpenRouter") {
            defaultModel = "google/gemma-4-31b-it:free";
          } else if (startupProvider === "NVIDIA") {
            defaultModel = "moonshotai/kimi-k2.6";
          }
        } else {
          if (startupProvider === "Google") {
            defaultModel = "gemini-3-flash-preview";
          } else if (startupProvider === "DeepSeek") {
            defaultModel = "deepseek-v4-flash";
          } else if (startupProvider === "OpenRouter") {
            defaultModel = "deepseek/deepseek-v4-flash";
          } else if (startupProvider === "NVIDIA") {
            defaultModel = "moonshotai/kimi-k2.6";
          }
        }
        setActiveModel(defaultModel);
      } else {
        setActiveModel(saved.activeModel);
      }
      setShowFullThinking(saved.showFullThinking);
      setApiTier(currentTier);
      setQuotas(saved.quotas || { limitMode: "Daily", agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: "", customLimit: 0, providerBudgets: {} });
      const freshSettings = {
        memory: true,
        compression: 0,
        autoExec: false,
        autoDeleteHistory: "7d",
        autoUpdate: false,
        updateManager: "npm",
        customUpdateCommand: "",
        ...saved.systemSettings || {}
      };
      if (parsedArgs.memory === "on") {
        freshSettings.memory = true;
      } else if (parsedArgs.memory === "off") {
        freshSettings.memory = false;
      }
      if (parsedArgs.package) {
        freshSettings.updateManager = parsedArgs.package;
      }
      if (parsedArgs.autoDel) {
        freshSettings.autoDeleteHistory = parsedArgs.autoDel;
      }
      if (parsedArgs.autoExec === "on") {
        freshSettings.autoExec = true;
      } else if (parsedArgs.autoExec === "off") {
        freshSettings.autoExec = false;
      }
      if (parsedArgs.externalAccess === "on") {
        freshSettings.allowExternalAccess = true;
      } else if (parsedArgs.externalAccess === "off") {
        freshSettings.allowExternalAccess = false;
      }
      if (parsedArgs.playground) {
        freshSettings.allowExternalAccess = false;
        freshSettings.memory = false;
      }
      setSystemSettings(freshSettings);
      setProfileData(saved.profileData);
      setImageSettings(saved.imageSettings || { keyType: "Default", quality: "Low-High", apiKey: "" });
      let key = parsedArgs.key;
      if (!key) {
        key = await getProviderAPIKey(startupProvider);
      }
      if (key) {
        setApiKey(key);
        initAI(key, { aiProvider: startupProvider, onIDEApproval: resetPendingApproval });
      }
      if (saved.systemSettings?.autoDeleteHistory) {
        cleanupOldHistory(saved.systemSettings.autoDeleteHistory);
      }
      cleanupOldLogs(LOGS_DIR);
      if (!parsedArgs.playground) {
        deleteChat(PLAYGROUND_CHAT_ID).catch(() => {
        });
        fs22.remove(path20.join(DATA_DIR, "playground")).catch(() => {
        });
      }
      performVersionCheck(false, freshSettings);
      await initUsage();
      await RevertManager.recoverCrashedTransaction();
      if (parsedArgs.resume) {
        const h = await loadHistory();
        const id = parsedArgs.resume;
        if (h[id]) {
          chatLoadingRef.current = true;
          setChatId(id);
          const savedData = await loadChatContext(id);
          chatTokenStartRef.current = sessionTotalTokens - savedData.total;
          chatLoadingRef.current = false;
          setChatTokens(savedData.total);
          setSessionStats({ tokens: savedData.context });
          const resumedMsgs = [...h[id].messages];
          const hasLogo = resumedMsgs[0]?.text?.includes("\u2591\u2591\u2591\u2588\u2588\u2588");
          if (!hasLogo) {
            resumedMsgs.unshift({ id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true });
          }
          setMessages(resumedMsgs);
          setActiveView("chat");
          setMessages((prev) => {
            const newMsgs = [...prev, { id: "sys-" + Date.now(), role: "system", text: `SESSION RESUMED VIA CLI: [${id}]`, isMeta: true }];
            setCompletedIndex(newMsgs.length);
            return newMsgs;
          });
        } else {
          setMessages((prev) => [...prev, { id: "sys-err-" + Date.now(), role: "system", text: `ERROR: Chat session [${id}] not found. Started new session.`, isMeta: true }]);
        }
      }
      if (parsedArgs.playground) {
        const playgroundDir = path20.join(DATA_DIR, "playground");
        try {
          fs22.ensureDirSync(playgroundDir);
          process.chdir(playgroundDir);
        } catch (e) {
        }
        const playgroundHistory = await loadHistory();
        if (playgroundHistory[PLAYGROUND_CHAT_ID]) {
          const resumedMsgs = [...playgroundHistory[PLAYGROUND_CHAT_ID].messages];
          if (!resumedMsgs[0]?.isLogo) {
            resumedMsgs.unshift({ id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true });
          }
          setMessages(resumedMsgs);
          setMessages((prev) => {
            const newMsgs = [...prev, {
              id: "playground-" + Date.now(),
              role: "system",
              text: `[PLAYGROUND] Session restored. CWD locked to: ${playgroundDir}`,
              isMeta: true
            }];
            setCompletedIndex(newMsgs.length);
            return newMsgs;
          });
        } else {
          setMessages((prev) => {
            const newMsgs = [...prev, {
              id: "playground-" + Date.now(),
              role: "system",
              text: `[PLAYGROUND] Mode active. CWD locked to: FluxFlow/playground`,
              isMeta: true
            }];
            setCompletedIndex(newMsgs.length);
            return newMsgs;
          });
        }
      }
      const detectedIde = getIDEName();
      const isIDE = !["Terminal", "Windows Terminal"].includes(detectedIde);
      if (isIDE) {
        const kbPath = getKeybindingsPath(detectedIde);
        if (kbPath) {
          try {
            let bindings = [];
            if (fs22.existsSync(kbPath)) {
              const content = fs22.readFileSync(kbPath, "utf8").trim();
              if (content) {
                bindings = parseJsonc(content);
              }
            }
            if (!hasShiftEnterBinding(bindings)) {
              setActiveView("keybindingsPrompt");
            } else {
              cachedShortcut = "Shift + Enter";
            }
          } catch (e) {
          }
        }
      }
      setIsInitializing(false);
    }
    init();
  }, []);
  useEffect11(() => {
    let timer;
    if (confirmExit) {
      setExitCountdown(10);
      timer = setInterval(() => {
        setExitCountdown((prev) => {
          if (prev <= 1) {
            setConfirmExit(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1e3);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [confirmExit]);
  useEffect11(() => {
    if (!isInitializing) {
      const modelToSave = parsedArgs.model && activeModel === parsedArgs.model ? persistedModelRef.current : activeModel;
      let settingsToSave = systemSettings;
      if (parsedArgs.playground) {
        settingsToSave = {
          ...systemSettings,
          allowExternalAccess: originalAllowExternalAccessRef.current,
          memory: originalMemoryRef.current
        };
      }
      saveSettings({
        mode,
        thinkingLevel,
        aiProvider,
        activeModel: modelToSave || activeModel,
        showFullThinking,
        systemSettings: settingsToSave,
        profileData,
        imageSettings,
        apiTier
      });
    }
  }, [mode, thinkingLevel, aiProvider, activeModel, showFullThinking, systemSettings, profileData, imageSettings, isInitializing, parsedArgs, apiTier]);
  const handleSetup = async (val) => {
    const key = val.trim();
    let minLength = 38;
    if (aiProvider === "OpenRouter") minLength = 30;
    if (aiProvider === "DeepSeek") minLength = 30;
    if (aiProvider === "NVIDIA") minLength = 30;
    if (key.length >= minLength) {
      await saveProviderAPIKey(aiProvider, key);
      setApiKey(key);
      initAI(key, { aiProvider, onIDEApproval: resetPendingApproval });
      let defaultModel = "gemma-4-31b-it";
      if (aiProvider === "OpenRouter") {
        defaultModel = "google/gemma-4-31b-it:free";
      } else if (aiProvider === "DeepSeek") {
        defaultModel = "deepseek-v4-flash";
      } else if (aiProvider === "NVIDIA") {
        defaultModel = "moonshotai/kimi-k2.6";
      }
      setActiveModel(defaultModel);
      setMessages((prev) => [...prev, { role: "system", text: `${aiProvider} API Key saved successfully! Model set to ${defaultModel}. Initialization complete.`, isMeta: true }]);
    } else {
      setMessages((prev) => [...prev, { role: "system", text: `INVALID KEY: ${aiProvider} API keys must be at least ${minLength} characters.`, isMeta: true }]);
      setTempKey("");
    }
  };
  const lastSavedTimeRef = useRef3(SESSION_START_TIME);
  useEffect11(() => {
    if (activeView === "exit") {
      const flush = async () => {
        const now = Date.now();
        const deltaSecs = Math.floor((now - lastSavedTimeRef.current) / 1e3);
        if (deltaSecs >= 1) {
          await addToUsage("duration", deltaSecs);
          lastSavedTimeRef.current += deltaSecs * 1e3;
        }
        await forceFlushUsage();
      };
      flush();
      const timer = setTimeout(() => {
        process.exit(0);
      }, 1700);
      return () => clearTimeout(timer);
    }
  }, [activeView]);
  useEffect11(() => {
    const interval = setInterval(async () => {
      if (!isInitializing) {
        const now = Date.now();
        const deltaSecs = Math.floor((now - lastSavedTimeRef.current) / 1e3);
        if (deltaSecs >= 1) {
          await addToUsage("duration", deltaSecs);
          lastSavedTimeRef.current += deltaSecs * 1e3;
        }
      }
    }, 5e3);
    return () => clearInterval(interval);
  }, [isInitializing]);
  const COMMANDS = [
    { cmd: "/quit", desc: "Exit and shutdown Flux" },
    { cmd: "/help", desc: "Show all available commands" },
    ...parsedArgs.playground ? [{ cmd: "/move", desc: "Move playground directory to original CWD/playground-export" }] : [],
    { cmd: "/resume", desc: "Load previous session" },
    { cmd: "/compress", desc: "Summarize and compress chat history" },
    { cmd: "/clear", desc: "Clear terminal screen" },
    { cmd: "/revert", desc: "Revert codebase back to a checkpoint" },
    { cmd: "/gemini", desc: "Get a happy message from Gemini CLI" },
    { cmd: "/save", desc: "Force save current chat" },
    { cmd: "/export", desc: "Export current chat in a .txt file" },
    { cmd: "/chats", desc: "List all chat sessions" },
    { cmd: "/btw", desc: "Ask a question without intefering with ongoing tasks" },
    {
      cmd: "/thinking",
      desc: "Set AI reasoning depth",
      subs: aiProvider === "DeepSeek" ? [
        { cmd: "Fast", desc: "Fastest" },
        { cmd: "Standard", desc: "Standard Reasoning" },
        { cmd: "High", desc: "Extended Reasoning" }
      ] : aiProvider === "NVIDIA" ? [
        { cmd: "Fast", desc: "Reasoning Disabled" },
        { cmd: "Standard", desc: "Balanced Reasoning" },
        { cmd: "High", desc: "Deep Reasoning" }
      ] : aiProvider === "OpenRouter" ? [
        { cmd: "Fast", desc: "Fastest" },
        { cmd: "Low", desc: "Quick Reasoning" },
        { cmd: "Medium", desc: "Balanced Reasoning" },
        { cmd: "High", desc: "Deep Reasoning" },
        { cmd: "xHigh", desc: "Extended Reasoning" }
      ] : activeModel && activeModel.toLowerCase().startsWith("gemini-3") ? [
        { cmd: "Fast", desc: "Fastest" },
        { cmd: "Low", desc: "Quick Reasoning" },
        { cmd: "Medium", desc: "Balanced Reasoning" },
        { cmd: "High", desc: "Deep Reasoning" }
      ] : [
        // Google General / Gemma
        { cmd: "Fast", desc: "Fastest" },
        { cmd: "Low", desc: "Quick Reasoning" },
        { cmd: "Medium", desc: "Balanced Reasoning" },
        { cmd: "High", desc: "Deep Reasoning" },
        { cmd: "xHigh", desc: "Extended Reasoning" }
      ]
    },
    {
      cmd: "/model",
      desc: "Select Agent Model",
      subs: aiProvider === "OpenRouter" ? apiTier === "Free" ? [
        {
          cmd: "google/gemma-4-31b-it:free",
          desc: "Multimodal"
        },
        {
          cmd: "moonshotai/kimi-k2.6:free",
          desc: "Multimodal"
        },
        {
          cmd: "qwen/qwen3-coder:free",
          desc: "Text Only"
        },
        {
          cmd: "z-ai/glm-4.5-air:free",
          desc: "Text Only"
        }
      ] : [
        {
          cmd: "google/gemini-3.5-flash",
          desc: "Multimodal"
        },
        {
          cmd: "qwen/qwen3.7-plus",
          desc: "Multimodal"
        },
        {
          cmd: "minimax/minimax-m3",
          desc: "Multimodal"
        },
        {
          cmd: "anthropic/claude-sonnet-4.5",
          desc: "Multimodal"
        },
        {
          cmd: "anthropic/claude-opus-4.6",
          desc: "Multimodal"
        },
        {
          cmd: "anthropic/claude-opus-4.8",
          desc: "Multimodal"
        },
        {
          cmd: "deepseek/deepseek-v4-pro",
          desc: "Text Only"
        },
        {
          cmd: "deepseek/deepseek-v4-flash",
          desc: "Text Only"
        },
        {
          cmd: "xiaomi/mimo-v2.5-pro",
          desc: "Text Only"
        },
        {
          cmd: "z-ai/glm-5",
          desc: "Text Only"
        },
        {
          cmd: "openai/gpt-5.2-codex",
          desc: "Multimodal"
        },
        {
          cmd: "openai/gpt-5.2-pro",
          desc: "Multimodal"
        },
        {
          cmd: "openai/gpt-5.5-pro",
          desc: "Multimodal"
        },
        {
          cmd: "moonshotai/kimi-k2.6",
          desc: "Multimodal"
        }
      ] : aiProvider === "DeepSeek" ? [
        {
          cmd: "deepseek-v4-flash",
          desc: "Fast & Efficient (Text Only)"
        },
        {
          cmd: "deepseek-v4-pro",
          desc: "High-Intelligence Reasoning (Text Only)"
        }
      ] : aiProvider === "NVIDIA" ? [
        // --- Kimi (Moonshot AI) ---
        {
          cmd: "moonshotai/kimi-k2.6",
          desc: "Multimodal"
        },
        // --- DeepSeek Family ---
        {
          cmd: "deepseek-ai/deepseek-v4-flash",
          desc: "Text Only"
        },
        {
          cmd: "deepseek-ai/deepseek-v4-pro",
          desc: "Text Only"
        },
        // --- StepFun ---
        {
          cmd: "stepfun-ai/step-3.7-flash",
          desc: "Multimodal"
        },
        // --- Gemma Family (Google) ---
        {
          cmd: "google/gemma-4-31b-it",
          desc: "Multimodal"
        },
        {
          cmd: "google/diffusiongemma-26b-a4b-it",
          desc: "Mega Fast [Experimental]"
        },
        // --- Mistral ---
        {
          cmd: "mistralai/mistral-medium-3.5-128b",
          desc: "Multimodal"
        },
        // --- GPT Open Source Series (OpenAI) ---
        {
          cmd: "openai/gpt-oss-20b",
          desc: "Text Only"
        },
        {
          cmd: "openai/gpt-oss-120b",
          desc: "Text Only"
        },
        // --- GLM (Zhipu AI) ---
        {
          cmd: "z-ai/glm-5.1",
          desc: "Text Only [DEPRICATED]"
        },
        // --- MiniMax Family ---
        {
          cmd: "minimaxai/minimax-m2.7",
          desc: "Text Only"
        },
        {
          cmd: "minimaxai/minimax-m3",
          desc: "Text Only"
        },
        // QWEN
        {
          cmd: "qwen/qwen3.5-397b-a17b",
          desc: "Multimodal"
        },
        // NVIDIA NEMOTRON
        {
          cmd: "nvidia/nemotron-3-ultra-550b-a55b",
          desc: "Text Only [EXPERIMENTAL]"
        }
      ] : apiTier === "Free" ? [
        {
          cmd: "gemma-4-26b-a4b-it",
          desc: "Standard & Faster (Multimodal)"
        },
        {
          cmd: "gemma-4-31b-it",
          desc: "Standard Default (Multimodal)"
        },
        {
          cmd: "gemini-2.5-flash-lite",
          desc: "Fast & Cheap (Multimodal) [Limited Free Quota]"
        },
        {
          cmd: "gemini-2.5-flash",
          desc: "Fast & Reliable (Multimodal) [Limited Free Quota]"
        },
        {
          cmd: "gemini-3-flash-preview",
          desc: "Fast & Lightweight (Multimodal) [Limited Free Quota]"
        },
        {
          cmd: "gemini-3.5-flash",
          desc: "Flash Latest (Multimodal) [Limited Free Quota] Instability Issues"
        }
      ] : [
        {
          cmd: "gemini-2.5-flash-lite",
          desc: "Fast & Cheap (Multimodal)"
        },
        {
          cmd: "gemini-2.5-flash",
          desc: "Fast & Reliable (Multimodal)"
        },
        {
          cmd: "gemini-2.5-pro",
          desc: "Last gen Pro reasoning (Multimodal)"
        },
        {
          cmd: "gemini-3.1-flash-lite",
          desc: "Ultra-Fast & Lite (Multimodal)"
        },
        {
          cmd: "gemini-3-flash-preview",
          desc: "Default, Fast & Lightweight (Multimodal)"
        },
        {
          cmd: "gemini-3.5-flash",
          desc: "Flash Latest (Multimodal) [Instability Issues]"
        },
        {
          cmd: "gemini-3.1-pro-preview",
          desc: "Pro Reasoning (Multimodal)"
        }
      ]
    },
    {
      cmd: "/mode",
      desc: "Toggle Flux/Flow modes",
      subs: [
        { cmd: "flux", desc: "Enable Dev toolset" },
        { cmd: "flow", desc: "Enable Chat mode" }
      ]
    },
    { cmd: "/settings", desc: "Configure system prefs" },
    { cmd: "/key", desc: "Manage API keys" },
    { cmd: "/profile", desc: "Edit developer persona" },
    { cmd: "/memory", desc: "Manage agent memory" },
    { cmd: "/stats", desc: "Show session usage" },
    { cmd: "/reset", desc: "Wipe all project data" },
    { cmd: "/about", desc: "Project info & credits" },
    { cmd: "/changelog", desc: "View latest updates" },
    { cmd: "/docs", desc: "View Documentation" },
    {
      cmd: "/fluxflow",
      desc: "Project management",
      subs: [
        { cmd: "init", desc: "Create empty FluxFlow.md template" }
      ]
    },
    {
      cmd: "/budget",
      desc: "Set or View budget limits",
      subs: [
        { cmd: "view", desc: "View current usage budget bars" },
        { cmd: "set", desc: "Configure budgets (Daily/Monthly limits)" },
        { cmd: "reset", desc: "Reset budgets to default limits" }
      ]
    },
    {
      cmd: "/update",
      desc: "Check/Install updates",
      subs: [
        { cmd: "latest", desc: "Install latest release" },
        { cmd: "check", desc: "Check for new version" }
      ]
    }
  ];
  const handleSubmit = async (value, isProgrammatic = false) => {
    if (!isProgrammatic && suggestions.length > 0) {
      const nextMatch = suggestions[selectedIndex] || suggestions[0];
      const parts = value.split(" ");
      if (parts.length === 1) {
        setInput(nextMatch.cmd + " ");
      } else {
        const parentParts = parts.slice(0, -1);
        setInput(parentParts.join(" ") + " " + nextMatch.cmd + " ");
      }
      setSelectedIndex(0);
      setInputKey((prev) => prev + 1);
      return;
    }
    didSignalTerminationRef.current = false;
    const normalizedValue = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
    if (normalizedValue.endsWith("\\")) {
      setInput(normalizedValue.slice(0, -1) + "\n");
      return;
    }
    const absoluteClean = normalizedValue.replace(/\\\s*\n/g, "\n").split(/\r?\n/).map((l) => l.replace(/\\$/, "")).join("\n");
    if (!absoluteClean.trim()) return;
    if (isProcessing) {
      const hintText = absoluteClean.trim();
      if (hintText.startsWith("/btw")) {
        const question = hintText.replace(/^\/btw\s*/, "").trim();
        if (question.length <= 3) {
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: "hint-err-" + Date.now(), role: "system", text: "[RESTRICTED] Inquiry question must be more than 3 characters.", isMeta: true }];
          });
          setInput("");
          return;
        }
      } else if (hintText.startsWith("/")) {
        setMessages((prev) => {
          setCompletedIndex(prev.length + 1);
          return [...prev, { id: "hint-err-" + Date.now(), role: "system", text: "[RESTRICTED] Steering Hints cannot start with /", isMeta: true }];
        });
        setInput("");
        return;
      }
      setQueuedPrompt(hintText);
      queuedPromptRef.current = hintText;
      setMessages((prev) => {
        setCompletedIndex(prev.length + 1);
        const isBtw = hintText.startsWith("/btw");
        const cleanText = isBtw ? hintText.replace(/^\/btw\s*/, "") : hintText;
        const prefix = isBtw ? "[QUESTION]" : "[STEERING HINT]";
        return [...prev, { id: "hint-" + Date.now(), role: "user", text: `${prefix} 
${cleanText}`, color: "magenta" }];
      });
      setInput("");
      return;
    }
    if (!apiKey) {
      handleSetup(absoluteClean);
      setTempKey("");
      return;
    }
    if (absoluteClean.startsWith("/")) {
      const parts = absoluteClean.split(" ");
      const cmd = parts[0]?.toLowerCase();
      switch (cmd) {
        case "/quit": {
          setActiveView("exit");
          break;
        }
        case "/resume": {
          if (parts[1]) {
            const targetId = parts[1];
            const resumeSession = async () => {
              const h = await loadHistory();
              const target = h[targetId] || Object.values(h).find((h2) => h2.name.toLowerCase() === targetId.toLowerCase());
              if (target) {
                stdout.write("\x1B[2J\x1B[3J\x1B[H");
                clearBlocksCache();
                chatLoadingRef.current = true;
                setChatId(targetId);
                const savedData = await loadChatContext(targetId);
                chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                chatLoadingRef.current = false;
                setChatTokens(savedData.total);
                setSessionStats({ tokens: savedData.context });
                const resumedMsgs = [...target.messages];
                const hasLogo = resumedMsgs[0]?.text?.includes("\u2591\u2591\u2591\u2588\u2588\u2588");
                if (!hasLogo) {
                  resumedMsgs.unshift({ id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true });
                }
                setMessages(resumedMsgs);
                setMessages((prev) => [...prev, { id: "sys-" + Date.now(), role: "system", text: `SESSION RESUMED: [${targetId}]`, isMeta: true }]);
                setCompletedIndex(0);
              } else {
                setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "system", text: `ERROR: Session [${targetId}] not found.` }]);
              }
            };
            resumeSession();
          } else {
            setActiveView("resume");
          }
          break;
        }
        case "/move": {
          if (!parsedArgs.playground) {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[PLAYGROUND] /move command is only available in playground mode.`, isMeta: true }];
            });
            break;
          }
          if (!parsedArgs.originalCwd) {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[PLAYGROUND] Error: Original CWD not found.`, isMeta: true }];
            });
            break;
          }
          const src = path20.join(DATA_DIR, "playground");
          const dest = path20.join(parsedArgs.originalCwd, "playground-export");
          const moveFiles = async () => {
            try {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[PLAYGROUND] Exporting playground content to ${dest}`, isMeta: true }];
              });
              await fs22.ensureDir(dest);
              const excludeDirs = ["node_modules", ".git", ".venv", "venv", "env", ".next", "dist", "build", ".cache"];
              await fs22.copy(src, dest, {
                overwrite: true,
                filter: (srcPath) => {
                  const relative = path20.relative(src, srcPath);
                  if (!relative) return true;
                  const parts2 = relative.split(path20.sep);
                  return !parts2.some((part) => excludeDirs.includes(part));
                }
              });
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[PLAYGROUND] Successfully copied playground content to ${dest}`, isMeta: true }];
              });
            } catch (err) {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[PLAYGROUND] Failed to move content: ${err.message}`, isMeta: true }];
              });
            }
          };
          moveFiles();
          break;
        }
        case "/clear": {
          if (stdout) {
            stdout.write("\x1B[2J\x1B[3J\x1B[H");
            if (stdout.isTTY) {
              stdout.write("\x1B[?2004h");
            }
          }
          setMessages([
            { id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true }
          ]);
          setCompletedIndex(1);
          setClearKey((prev) => prev + 1);
          clearBlocksCache();
          cachedHistoryRef.current = {
            completedIndex: 0,
            columns: terminalSize.columns,
            historicalBlocks: [],
            seenSelections: /* @__PURE__ */ new Set(),
            chatId,
            clearKey: clearKey + 1
          };
          if (parsedArgs.playground) {
            parsedArgs.playground = false;
            deleteChat(PLAYGROUND_CHAT_ID).catch(() => {
            });
            if (parsedArgs.originalCwd) {
              try {
                process.chdir(parsedArgs.originalCwd);
                setMessages((prev) => {
                  const newMsgs = [...prev, {
                    id: "playground-" + Date.now(),
                    role: "system",
                    text: `[PLAYGROUND] Session ended. Restored Working Directory to ${parsedArgs.originalCwd}`,
                    isMeta: true
                  }];
                  setCompletedIndex(newMsgs.length);
                  return newMsgs;
                });
              } catch (e) {
              }
            }
            setTimeout(() => {
              fs22.emptyDir(path20.join(DATA_DIR, "playground")).catch((err) => {
                setMessages((prev) => {
                  const newMsgs = [...prev, {
                    id: "playground-" + Date.now(),
                    role: "system",
                    text: `[PLAYGROUND] Failed to clear session: ${DATA_DIR + "/playground"}`,
                    isMeta: true
                  }];
                  setCompletedIndex(newMsgs.length);
                  return newMsgs;
                });
              });
            }, 500);
            setSystemSettings((s2) => ({
              ...s2,
              allowExternalAccess: originalAllowExternalAccessRef.current,
              memory: originalMemoryRef.current
            }));
          }
          setChatId(generateChatId());
          setSessionStats({ tokens: 0 });
          setIsExpanded(false);
          setChatTokens(0);
          chatTokenStartRef.current = sessionTotalTokens;
          setTimeout(() => {
            if (global.gc) {
              try {
                global.gc();
                lastGCTime = Date.now();
              } catch (e) {
              }
            }
          }, 500);
          break;
        }
        case "/revert": {
          RevertManager.getChatHistory(chatId).then((prompts) => {
            if (prompts.length > 0) {
              setRecentPrompts(prompts.reverse());
              setActiveView("revert");
            } else {
              const s2 = emojiSpace(2);
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: "revert-empty-" + Date.now(), role: "system", text: `Nothing to revert to.`, isMeta: true }];
              });
            }
          });
          setTimeout(() => {
            if (global.gc) {
              try {
                global.gc();
                lastGCTime = Date.now();
              } catch (e) {
              }
            }
          }, 500);
          break;
        }
        case "/mode": {
          if (parts[1]) {
            const newMode = parts[1].toLowerCase() === "flow" ? "Flow" : "Flux";
            setMode(newMode);
            if (newMode === "Flow") {
              setThinkingLevel("Fast");
            } else if (newMode === "Flux") {
              setThinkingLevel("High");
            }
            const s2 = emojiSpace(2);
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Mode switched to ${newMode}`, isMeta: true }];
            });
          } else {
            setActiveView("mode");
          }
          break;
        }
        case "/image": {
          if (parts[1]?.toLowerCase() === "stats") {
            const s2 = emojiSpace(2);
            if (imageSettings.keyType === "Custom") {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                  id: Date.now(),
                  role: "system",
                  text: `[SYSTEM] Key strategy is Custom. Redirecting to Pollinations dashboard (https://enter.pollinations.ai/#pollen)...`,
                  isMeta: true
                }];
              });
              exec2("start https://enter.pollinations.ai/#pollen");
            } else {
              try {
                const stats = await getImageQuotaStats();
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, {
                    id: Date.now(),
                    role: "system",
                    isImageStats: true,
                    text: `\u2022 Hourly Limit: ${Number((stats.limit * 1e3).toFixed(0))} credits
\u2022 Spent (Last 1hr): ${Number((stats.totalSpent * 1e3).toFixed(0))} credits
\u2022 Remaining: ${Number((stats.remaining * 1e3).toFixed(0))} credits
\u2022 Requests (Last 1hr): ${stats.activeCallsCount} requests
` + (stats.nextResetMin > 0 ? `\u2022 Refreshes in: ${stats.nextResetMin}m` : ""),
                    isMeta: true
                  }];
                });
              } catch (e) {
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, {
                    id: Date.now(),
                    role: "system",
                    text: `[SYSTEM] Failed to load image quota stats.`,
                    isMeta: true
                  }];
                });
              }
            }
          } else if (parts[1]?.toLowerCase() === "setup") {
            if (parts[2]?.toLowerCase() === "key") {
              if (parts[3]) {
                const matchedKey = ["default", "custom"].find((k) => k === parts[3].toLowerCase());
                if (matchedKey) {
                  const strategy = matchedKey === "default" ? "Default" : "Custom";
                  setImageSettings((prev) => ({ ...prev, keyType: strategy }));
                  const s2 = emojiSpace(2);
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Image key strategy set to ${strategy}`, isMeta: true }];
                  });
                  if (strategy === "Custom") {
                    setInputConfig({
                      label: "Enter Pollinations API key (starting with sk_):",
                      note: "Get a key from https://enter.pollinations.ai",
                      key: "imageSettings",
                      subKey: "apiKey",
                      value: imageSettings.apiKey || "",
                      returnView: "chat"
                    });
                    setActiveView("input");
                  }
                } else {
                  const s2 = emojiSpace(2);
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Invalid key option. Choose: Default or Custom.`, isMeta: true }];
                  });
                }
              } else {
                const s2 = emojiSpace(2);
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Usage: /image setup Key <Default|Custom>`, isMeta: true }];
                });
              }
            } else if (parts[2]?.toLowerCase() === "quality") {
              if (parts[3]) {
                const matched = ["low", "low-high", "medium", "medium-high", "high", "ultra", "premium"].find((q) => q === parts[3].toLowerCase());
                if (matched) {
                  const qualityMap = {
                    "low": "Low",
                    "low-high": "Low-High",
                    "medium": "Medium",
                    "medium-high": "Medium-High",
                    "high": "High",
                    "ultra": "Ultra",
                    "premium": "Premium"
                  };
                  const chosenQuality = qualityMap[matched];
                  setImageSettings((prev) => ({ ...prev, quality: chosenQuality }));
                  const s2 = emojiSpace(2);
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Image quality set to ${chosenQuality}`, isMeta: true }];
                  });
                } else {
                  const s2 = emojiSpace(2);
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Invalid quality level. Choose from: Low, Low-High, Medium, Medium-High, High, Ultra, Premium.`, isMeta: true }];
                  });
                }
              } else {
                const s2 = emojiSpace(2);
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Usage: /image setup Quality <Low|Low-High|Medium|Medium-High|High|Ultra>`, isMeta: true }];
                });
              }
            } else {
              const s2 = emojiSpace(2);
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
              });
            }
          } else {
            const s2 = emojiSpace(2);
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
            });
          }
          break;
        }
        case "/thinking": {
          let formattedLevel;
          if (parts[1]) {
            let val = parts[1].toLowerCase();
            const isBypass = parts.includes("--bypass");
            formattedLevel = val.charAt(0).toUpperCase() + val.slice(1);
            if (val === "xhigh") {
              formattedLevel = "xHigh";
            }
            if (!isBypass && mode === "Flow" && (formattedLevel === "High" || formattedLevel === "xHigh")) {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[RESTRICTED] "${formattedLevel}" is restricted in Flow mode. Switch to Flux to enable Higher Thinking Levels.`, isMeta: true }];
              });
            } else {
              setThinkingLevel(formattedLevel);
              const s2 = emojiSpace(1);
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Thinking level set to ${formattedLevel}${isBypass ? ` (Bypass Activated)` : ""}`, isMeta: true }];
              });
            }
          } else {
            setActiveView("thinking");
          }
          break;
        }
        case "/model": {
          if (parts[1]) {
            const mod = parts.slice(1).join(" ");
            if (mod === "gemma-4-31b-it" && apiTier !== "Free" && aiProvider === "Google") {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                  id: Date.now(),
                  role: "system",
                  text: `**[ACCESS DENIED]** Gemma is restricted to the Free API tier. Automatically switching you to **Gemini 3 Flash Preview** for optimal performance.`,
                  isMeta: true
                }];
              });
              setActiveModel("gemini-3-flash-preview");
            } else {
              setActiveModel(mod);
              const s2 = emojiSpace(2);
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Model switched to ${mod}`, isMeta: true }];
              });
            }
          } else {
            setActiveView("model");
          }
          break;
        }
        case "/settings": {
          setActiveView("settings");
          break;
        }
        case "/key": {
          setActiveView("key");
          break;
        }
        case "/profile": {
          setActiveView("profile");
          break;
        }
        case "/stats": {
          const run = async () => {
            const usage = await getDailyUsage();
            const mUsage = await getMonthlyUsage();
            setDailyUsage(usage);
            setMonthlyUsage(mUsage);
            setStatsMode("daily");
            setActiveView("stats");
          };
          run();
          break;
        }
        case "/save": {
          const name = parts.slice(1).join(" ") || `Session ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`;
          saveChat(chatId, name, messages);
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `[MEMORY] Chat saved as "${name}" (ID: ${chatId})`, isMeta: true }];
          });
          break;
        }
        case "/export": {
          const exportFile = `export-fluxflow-${chatId}.txt`;
          const exportPath = path20.join(process.cwd(), exportFile);
          const exportLines = [];
          let insideAgentBlock = false;
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg) continue;
            if (msg.role === "system" || msg.isMeta || msg.isLogo || String(msg.id).startsWith("welcome")) {
              continue;
            }
            if (msg.role === "user") {
              let cleanUserText = msg.text || "";
              cleanUserText = cleanUserText.replace(/\s*\[Prompted on:.*?\]/g, "").trim();
              if (exportLines.length > 0) {
                exportLines.push("");
              }
              exportLines.push("[USER]");
              exportLines.push(cleanUserText);
              insideAgentBlock = false;
            } else if (msg.role === "think") {
              if (!insideAgentBlock) {
                exportLines.push("");
                exportLines.push("[AGENT]");
                insideAgentBlock = true;
              }
              const cleanThinkText = (msg.text || "").replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, "").replace(/\[\[END\]\]/gi, "").replace(/\[\[TOOL RESULTS\]\]/gi, "").replace(/\[TOOL RESULTS\]/gi, "").replace(/\[TOOL RESULT\]/gi, "").trim();
              if (cleanThinkText) {
                exportLines.push("[thoughts]");
                exportLines.push(cleanThinkText);
              }
            } else if (msg.role === "agent") {
              if (!insideAgentBlock) {
                exportLines.push("");
                exportLines.push("[AGENT]");
                insideAgentBlock = true;
              }
              const blocks = parseAgentText(msg.text || "");
              for (const block of blocks) {
                if (block.type === "output") {
                  const cleanContent = block.content.replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, "").replace(/\[\[END\]\]/gi, "").replace(/\[\[TOOL RESULTS\]\]/gi, "").replace(/\[TOOL RESULTS\]/gi, "").replace(/\[TOOL RESULT\]/gi, "").trim();
                  if (cleanContent) {
                    exportLines.push("[output]");
                    exportLines.push(cleanContent);
                  }
                } else if (block.type === "tool") {
                  exportLines.push("[tool]");
                  exportLines.push(`${block.toolName} ${block.args}`);
                }
              }
            }
          }
          const fileContent = exportLines.join("\n");
          try {
            fs22.writeFileSync(exportPath, fileContent, "utf8");
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, {
                id: Date.now(),
                role: "system",
                text: `[EXPORT] Chat exported to "${exportFile}"`,
                isMeta: true
              }];
            });
          } catch (err) {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, {
                id: Date.now(),
                role: "system",
                text: `[EXPORT ERROR] Failed to export chat: ${err.message}`,
                isMeta: true
              }];
            });
          }
          break;
        }
        case "/chats": {
          const run = async () => {
            const history = await loadHistory();
            const list = Object.entries(history).map(([id, info]) => `\u2022 ${id}: ${info.name}`).join("\n");
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[HISTORY] Saved Chats:
${list || "No saved chats found."}`, isMeta: true }];
            });
          };
          run();
          break;
        }
        case "/memory": {
          setActiveView("memory");
          break;
        }
        case "/reset": {
          const runReset = async () => {
            try {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: "[NUCLEAR] Initiating reset...", isMeta: true }];
              });
              if (fs22.existsSync(LOGS_DIR)) fs22.removeSync(LOGS_DIR);
              if (fs22.existsSync(SECRET_DIR)) fs22.removeSync(SECRET_DIR);
              if (fs22.existsSync(SETTINGS_FILE)) fs22.removeSync(SETTINGS_FILE);
              try {
                const items = fs22.readdirSync(FLUXFLOW_DIR);
                if (items.length === 0) fs22.removeSync(FLUXFLOW_DIR);
              } catch (e) {
              }
              setTimeout(() => {
                setActiveView("exit");
                setTimeout(() => process.exit(0), 500);
              }, 500);
            } catch (err) {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[RESET ERROR] Failed to clear data: ${err.message}` }];
              });
            }
          };
          runReset();
          break;
        }
        case "/about": {
          const s2 = emojiSpace(2);
          const aboutText = `\u2022 FluxFlow Version: v${versionFluxflow}
\u2022 Status: ${latestVer && latestVer !== versionFluxflow ? `Update Available [v${latestVer}]` : "Up to date"}
\u2022 Released on: ${updatedOn}`;
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: "about-" + Date.now(), role: "system", text: aboutText, isAboutRecord: true, isMeta: true }];
          });
          break;
        }
        case "/changelog": {
          const platform = process.platform;
          const command = platform === "win32" ? "start" : platform === "darwin" ? "open" : "xdg-open";
          exec2(`${command} ${CHANGELOG_URL}`);
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `[BROWSER] Opening changelog: ${CHANGELOG_URL}`, isMeta: true }];
          });
          break;
        }
        case "/docs": {
          if (!DOCS_URL) {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[BROWSER] Documentation URL is not configured.`, isMeta: true }];
            });
            break;
          }
          const platform = process.platform;
          const command = platform === "win32" ? "start" : platform === "darwin" ? "open" : "xdg-open";
          exec2(`${command} ${DOCS_URL}`);
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `[BROWSER] Opening documentation: ${DOCS_URL}`, isMeta: true }];
          });
          break;
        }
        case "/budget": {
          const sub = parts[1]?.toLowerCase();
          if (sub === "set") {
            setBudgetReturnView("chat");
            setActiveView("budgetTypeSelect");
          } else if (sub === "view") {
            const run = async () => {
              const usage = await getDailyUsage();
              const mUsage = await getMonthlyUsage();
              const cUsage = await getCustomPeriodUsage(quotas.resetDay || 1);
              setDailyUsage(usage);
              setMonthlyUsage(mUsage);
              setCustomPeriodUsage(cUsage);
              setActiveView("budgetView");
            };
            run();
          } else if (sub === "reset") {
            const defaultQuotas = {
              limitMode: "Daily",
              agentLimit: 99999999,
              tokenLimit: 99999999999999,
              backgroundLimit: 999999,
              searchLimit: 100,
              customModelId: "",
              customLimit: 0,
              providerBudgets: {},
              providerTiers: {
                Google: "Free",
                DeepSeek: "Free",
                NVIDIA: "Free",
                OpenRouter: "Free"
              }
            };
            setQuotas(defaultQuotas);
            setApiTier("Free");
            saveSettings({ apiTier: "Free", quotas: defaultQuotas });
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `\u2705 [BUDGET] Budgets and limits reset to default values successfully.`, isMeta: true }];
            });
          } else {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `Usage: /budget <Set|View|Reset>`, isMeta: true }];
            });
          }
          break;
        }
        case "/fluxflow": {
          const args2 = parts.slice(1);
          if (args2[0] === "init") {
            const template = `# FluxFlow Configuration
# This file defines project-specific instructions for the Flux Flow Agent.

# IDENTITY & TONE
- Tone: Technical, precise, and highly efficient.

# PROJECT CONTEXT
- Goal: [Describe your project goal here]
- Tech Stack: [List your technologies here]

# CUSTOM RULES
- [Add specific coding standards or rules here]

# SKILLS & WORKFLOWS
- [Define custom step-by-step recipes for this project here]
`;
            const filePath = path20.join(process.cwd(), "FluxFlow.md");
            if (fs22.pathExistsSync(filePath)) {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: "init-err-" + Date.now(), role: "system", text: "ERROR: FluxFlow.md already exists in this directory.", isMeta: true }];
              });
            } else {
              try {
                fs22.writeFileSync(filePath, template);
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: "init-ok-" + Date.now(), role: "system", text: "[SUCCESS] FluxFlow.md has been initialized. You can now customize it for this project.", isMeta: true }];
                });
              } catch (err) {
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: "init-err-" + Date.now(), role: "system", text: `ERROR: Failed to initialize FluxFlow.md: ${err.message}`, isMeta: true }];
                });
              }
            }
          } else {
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: "ff-err-" + Date.now(), role: "system", text: "Usage: /fluxflow init", isMeta: true }];
            });
          }
          break;
        }
        case "/update": {
          const arg = parts[1]?.toLowerCase();
          if (arg === "check") {
            performVersionCheck(true);
            break;
          }
          const isForce = parts.includes("--latest");
          setActiveView("update");
          break;
        }
        case "/gemini": {
          const randomQuote = GEMINI_QUOTES[Math.floor(Math.random() * GEMINI_QUOTES.length)];
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `\u2728 [GEMINI CLI] ${randomQuote}` }];
          });
          setInput("");
          break;
        }
        case "/compress": {
          setInput("");
          const cleanCount = messages.filter((m) => (m.role === "user" || m.role === "agent" || m.role === "system") && !String(m.id).startsWith("welcome") && !m.isMeta).length;
          const tokens = sessionStats?.tokens || 0;
          if (cleanCount < 100 || tokens < 32768) {
            const s2 = emojiSpace(2);
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, {
                id: Date.now(),
                role: "system",
                text: `[SYSTEM] Compression skipped: History requires at least 100 messages and 32k tokens (current: ${cleanCount}/100 msgs, ${tokens}/32768 tokens).`,
                isMeta: true
              }];
            });
            break;
          }
          const runCompress = async () => {
            setIsCompressing(true);
            const s2 = emojiSpace(2);
            setMessages((prev) => {
              setCompletedIndex(prev.length + 1);
              return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Compressing session history...`, isMeta: true }];
            });
            try {
              const config = {
                chatId,
                aiProvider,
                apiKey,
                thinkingLevel,
                mode,
                janitorModel,
                systemSettings,
                sessionStats
              };
              const summary = await compressHistory(config, messages);
              if (summary) {
                const s3 = emojiSpace(2);
                setMessages((prev) => {
                  const finalMsgs = [...prev, {
                    id: Date.now(),
                    role: "system",
                    text: `[SYSTEM] Chat History compressed saving tokens.`,
                    isMeta: true
                  }];
                  setCompletedIndex(finalMsgs.length);
                  return finalMsgs;
                });
              } else {
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: Date.now(), role: "system", text: "[SYSTEM] Compression failed (no summary returned).", isMeta: true }];
                });
              }
            } catch (err) {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Error during compression: ${err.message}`, isMeta: true }];
              });
            } finally {
              setIsCompressing(false);
            }
          };
          runCompress();
          break;
        }
        case "/help": {
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", isHelpRecord: true, isMeta: true }];
          });
          break;
        }
        case "/btw": {
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] /btw only available when agent is working`, isMeta: true }];
          });
          break;
        }
        default:
          const s = emojiSpace(2);
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: Date.now(), role: "system", text: `[SYSTEM] Unknown command: ${cmd}`, isMeta: true }];
          });
      }
    } else {
      const timestamp = `[Prompted on: ${(/* @__PURE__ */ new Date()).toLocaleString(void 0, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}]`;
      const userMessage = { id: "user-" + Date.now(), role: "user", text: `${absoluteClean}

${timestamp}` };
      setMessages((prev) => {
        setCompletedIndex(prev.length + 1);
        return [...prev, userMessage];
      });
      const streamChat = async () => {
        let didAppendCancel = false;
        const appendCancelMessage = () => {
          if (didAppendCancel) return;
          didAppendCancel = true;
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.text && lastMsg.text.includes("Request Cancelled")) {
              return prev;
            }
            const updatedPrev = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
            const newMsgs = [...updatedPrev, {
              id: "cancel-" + Date.now(),
              role: "system",
              text: "\n\n\x1B[33m\u24D8 Request Cancelled\x1B[0m",
              isMeta: false
            }];
            setCompletedIndex(newMsgs.length);
            return newMsgs;
          });
        };
        let hasFiredJanitor = false;
        setIsProcessing(true);
        setIsExpanded(false);
        let apiStart = Date.now();
        let isFirstPacket = true;
        try {
          const rawHistory = [...messages, userMessage].filter(
            (m) => m.role !== "think" && !m.isVisualFeedback && !m.isMeta && !String(m.id).startsWith("welcome")
          );
          const cleanHistoryForAI = [];
          rawHistory.forEach((m, idx) => {
            let text = m.fullText || m.text;
            if (m.role === "user" && idx < rawHistory.length - 1) {
              if (text.includes("**CONTEXT SUMMARY OF PREVIOUS TURNS")) {
                const summaryIndex = text.indexOf("[SYSTEM METADATA (PRIORITY: DYNAMIC)]");
                if (summaryIndex !== -1) {
                  text = text.substring(summaryIndex).trim();
                }
              } else {
                const userIndex = text.lastIndexOf("[USER]");
                if (userIndex !== -1) {
                  text = text.substring(userIndex + 6).trim();
                }
              }
            }
            if (m.role === "system" && text?.startsWith("[TOOL RESULT]")) {
              const prev = cleanHistoryForAI[cleanHistoryForAI.length - 1];
              if (prev && prev.role === "system" && prev.text?.startsWith("[TOOL RESULT]")) {
                prev.text += "\n\n" + text;
                return;
              }
            }
            cleanHistoryForAI.push({
              ...m,
              text
            });
          });
          const stream = getAIStream(
            activeModel,
            cleanHistoryForAI,
            {
              profile: profileData,
              thinkingLevel,
              mode,
              systemSettings,
              janitorModel,
              sessionStats,
              chatId,
              isPlayground: !!parsedArgs.playground,
              aiProvider,
              apiKey,
              apiTier,
              cols: terminalSize.columns - 6,
              rows: 30,
              onVisualFeedback: (content) => {
                setMessages((prev) => {
                  const updatedPrev = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
                  return [...updatedPrev, { id: "visual-" + Date.now(), role: "system", text: content, isVisualFeedback: true }];
                });
              },
              onSubagentUpdate: () => {
                setActiveSubagents([...subagentProgress]);
              },
              onExecStart: (cmd) => {
                setActiveCommand(cmd);
                setExecOutput("");
              },
              onExecChunk: (chunk) => {
                setExecOutput((prev) => prev + chunk);
              },
              onExecEnd: () => {
                setMessages((prev) => {
                  if (!activeCommandRef.current) return prev;
                  const rawOutput = execOutputRef.current || "";
                  const normalizedOutput = cleanTerminalOutput(rawOutput);
                  const finalStatus = `[TERMINAL_RECORD]
                                    COMMAND: ${activeCommandRef.current}
                                    PTY: ${isActiveCommandPty}
                                    OUTPUT: ${normalizedOutput.replace(/\n{3,}/g, "\n\n")}`;
                  const updatedPrev = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
                  const newMsgs = [...updatedPrev, { id: "term-" + Date.now(), role: "system", text: finalStatus, isTerminalRecord: true }];
                  setCompletedIndex(newMsgs.length);
                  return newMsgs;
                });
                setActiveCommand(null);
                setIsTerminalFocused(false);
                setExecOutput("");
              },
              onToolResult: (status, toolName) => {
                if (status === "success") {
                  setSessionToolSuccess((prev) => prev + 1);
                  if (toolName === "generate_image") {
                    setSessionImageCount((prev) => prev + 1);
                    const costs = {
                      "Low": 1e-3,
                      "Low-High": 2e-3,
                      "Medium": 8e-3,
                      "Medium-High": 0.01,
                      "High": 0.045,
                      "Ultra": 0.0488,
                      "Premium": 0.1
                    };
                    const cost = costs[imageSettings.quality] || 2e-3;
                    setSessionImageCredits((prev) => prev + cost);
                  }
                } else if (status === "denied") {
                  setSessionToolDenied((prev) => prev + 1);
                } else {
                  setSessionToolFailure((prev) => prev + 1);
                }
              },
              onToolApproval: async (tool, args2) => {
                const isAuto = autoAcceptWrites || systemSettings.autoExec;
                if (tool === "exec_command") {
                  const { command } = parseArgs(args2 || "{}");
                  const safeRegex = /^(echo|ls|dir|pwd|cd|git status|git log|git diff|type|cat|help)\b/i;
                  if (isAuto || command && safeRegex.test(command.trim())) return "allow";
                  return new Promise((resolve) => {
                    setPendingApproval({ tool, args: args2, resolve });
                    setActiveView("terminalApproval");
                  });
                }
                if (isAuto) return "allow";
                return new Promise((resolve) => {
                  setPendingApproval({ tool, args: args2, resolve });
                  setActiveView("approval");
                });
              },
              onAskUser: async (question, options) => {
                return new Promise((resolve) => {
                  let resolvedFlag = false;
                  setPendingAsk({
                    question,
                    options,
                    resolve: (val) => {
                      if (resolvedFlag) return;
                      resolvedFlag = true;
                      setMessages((prev) => {
                        const hasAskRecord = prev.some((m) => m.isAskRecord && m.text?.includes(`Selection: ${val}`));
                        if (hasAskRecord) return prev;
                        const newMsgs = [
                          ...prev,
                          {
                            id: "ask-" + Date.now(),
                            role: "system",
                            text: `\u{1F4AC} **Ask User**
Selection: ${val}`,
                            isAskRecord: true
                          }
                        ];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                      });
                      resolve(val);
                    }
                  });
                  setActiveView("ask");
                });
              },
              onUsage: (usage) => {
                const total = usage.totalTokenCount || 0;
                const cached = usage.cachedContentTokenCount || 0;
                const candidates = usage.candidatesTokenCount || 0;
                setSessionStats({ tokens: total });
                setSessionTotalTokens((prev) => prev + total);
                if (cached > 0) {
                  setSessionTotalCachedTokens((prev) => prev + cached);
                }
                if (candidates > 0) {
                  setSessionTotalCandidateTokens((prev) => prev + candidates);
                }
                setSessionAgentCalls((prev) => prev + 1);
              }
            },
            async () => {
              if (queuedPromptRef.current) {
                const p = queuedPromptRef.current;
                setQueuedPrompt(null);
                queuedPromptRef.current = null;
                setMessages((prev) => {
                  const index = [...prev].reverse().findIndex((m) => m.text?.includes("[STEERING HINT: QUEUED]") || m.text?.includes("[QUESTION: QUEUED]"));
                  if (index !== -1) {
                    const actualIndex = prev.length - 1 - index;
                    const newMsgs = [...prev];
                    let text = newMsgs[actualIndex].text;
                    if (text.includes("[STEERING HINT: QUEUED]")) {
                      text = text.replace("[STEERING HINT: QUEUED]", "[STEERING HINT: INJECTED]");
                    } else if (text.includes("[QUESTION: QUEUED]")) {
                      text = text.replace("[QUESTION: QUEUED]", "[QUESTION: ASKED]");
                    }
                    newMsgs[actualIndex] = {
                      ...newMsgs[actualIndex],
                      text,
                      color: "cyan"
                    };
                    return newMsgs;
                  }
                  return prev;
                });
                return p;
              }
              return null;
            },
            versionFluxflow
          );
          let inThinkMode = false;
          let currentThinkId = null;
          let currentAgentId = null;
          let inCodeBlock = false;
          let inToolCall = false;
          let thinkConsumedInTurn = false;
          let toolCallEncounteredInTurn = false;
          let toolCallBalance = 0;
          let inToolCallString = null;
          const signalRegex = /\[?\s*turn\s*:\s*.*?\s*\]?/gi;
          for await (const packet of stream) {
            if (isFirstPacket && packet.type === "text") {
              apiStart = Date.now();
              isFirstPacket = false;
            }
            if (packet.type === "status") {
              setStatusText(packet.content);
              if (packet.content?.includes("[start]")) {
                clearInterval(interval_for_timer);
                setActiveTime(0);
                interval_for_timer = setInterval(() => {
                  setActiveTime((prev) => prev + 1);
                }, 1e3);
              } else if (packet.content?.includes("[end]")) {
                setActiveTime(0);
                clearInterval(interval_for_timer);
              }
              if (isBridgeConnected()) {
                sendStatus(packet.content);
              }
              if (packet.content === "Request Cancelled") {
                appendCancelMessage();
              }
              continue;
            }
            if (packet.type === "status_history") {
              setStatusText(packet.content);
              if (isBridgeConnected()) {
                sendStatus(packet.content);
              }
              setMessages((prev) => [...prev, { id: "condense-" + Date.now(), role: "system", text: `[SYSTEM] ${packet.content}`, isMeta: true }]);
              continue;
            }
            if (packet.type === "summary_injected") {
              setMessages((prev) => prev.map(
                (m) => m.id === packet.content.id ? { ...m, fullText: packet.content.text } : m
              ));
              continue;
            }
            if (packet.type === "spinner") {
              setIsSpinnerActive(packet.content);
              continue;
            }
            if (packet.type === "model_update") {
              setTempModelOverride(packet.content);
              continue;
            }
            if (packet.type === "turn_reset") {
              currentThinkId = null;
              currentAgentId = null;
              inThinkMode = false;
              inCodeBlock = false;
              inToolCall = false;
              toolCallEncounteredInTurn = false;
              thinkConsumedInTurn = false;
              setMessages((prev) => {
                const newMsgs = prev.map((m) => {
                  if (m.isStreaming) {
                    const flatText = m.text ? (" " + m.text).slice(1) : m.text;
                    const flatFullText = m.fullText ? (" " + m.fullText).slice(1) : m.fullText;
                    return { ...m, isStreaming: false, text: flatText, fullText: flatFullText };
                  }
                  return m;
                });
                setCompletedIndex(newMsgs.length);
                return newMsgs;
              });
              clearBlocksCache();
              if (global.gc) {
                try {
                  global.gc();
                  setTimeout(() => {
                    if (global.gc) global.gc();
                    lastGCTime = Date.now();
                  }, 100);
                } catch (e) {
                }
              }
              continue;
            }
            if (packet.type === "interactive_turn_finished") {
              setIsProcessing(false);
              setActiveTime(0);
              clearInterval(interval_for_timer);
              if (isBridgeConnected()) {
                sendStatus(null);
              }
              hasFiredJanitor = true;
              clearBlocksCache();
              runJanitorTask(
                { profile: profileData, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats, aiProvider, apiKey },
                packet.data.agentText,
                packet.data.fullAgentTextRaw,
                packet.data.history,
                {
                  onMemoryUpdated: () => setMessages((prev) => {
                    const newMsgs = [...prev];
                    if (newMsgs.length > 0) newMsgs[newMsgs.length - 1].memoryUpdated = true;
                    return newMsgs;
                  }),
                  onBackgroundIncrement: () => setSessionBackgroundCalls((prev) => prev + 1)
                }
              );
              if (global.gc) {
                try {
                  global.gc();
                  setTimeout(() => {
                    if (global.gc) global.gc();
                    lastGCTime = Date.now();
                  }, 150);
                } catch (e) {
                }
              }
              continue;
            }
            if (packet.type === "visual_feedback") {
              setMessages((prev) => {
                const updatedPrev = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
                const newMsgs = [...updatedPrev, {
                  id: "feedback-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
                  role: "system",
                  text: packet.content,
                  isVisualFeedback: true
                }];
                setCompletedIndex(newMsgs.length);
                return newMsgs;
              });
              continue;
            }
            if (packet.type === "exec_start") {
              continue;
            }
            if (packet.type === "liveTokens") {
              setSessionStats({ tokens: packet.content });
              continue;
            }
            if (packet.type === "usage") {
              const total = packet.content.totalTokenCount || 0;
              const cached = packet.content.cachedContentTokenCount || 0;
              const candidates = packet.content.candidatesTokenCount || 0;
              setSessionStats({ tokens: total });
              setSessionTotalTokens((prev) => prev + total);
              if (cached > 0) {
                setSessionTotalCachedTokens((prev) => prev + cached);
              }
              if (candidates > 0) {
                setSessionTotalCandidateTokens((prev) => prev + candidates);
              }
              setSessionAgentCalls((prev) => prev + 1);
              continue;
            }
            if (packet.type === "tool_time") {
              setSessionToolTime((prev) => prev + packet.content);
              continue;
            }
            if (packet.type === "tool_result") {
              setMessages((prev) => {
                const updatedPrev = prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
                const newMsgs = [...updatedPrev, {
                  id: "tool-" + Date.now(),
                  role: "system",
                  text: packet.content,
                  fullText: packet.aiContent,
                  // Preserve raw data for next turn
                  binaryPart: packet.binaryPart,
                  // v1.5.0 Multimodal Support
                  toolName: packet.toolName
                }];
                setCompletedIndex(newMsgs.length);
                return newMsgs;
              });
              if (packet.toolName === "update_file" && packet.aiContent) {
                const diffLines = packet.aiContent.split("\n");
                let added = 0;
                let removed = 0;
                let insideDiff = false;
                for (const line of diffLines) {
                  if (line.includes("[DIFF_START]")) {
                    insideDiff = true;
                    continue;
                  }
                  if (line.includes("[DIFF_END]")) {
                    insideDiff = false;
                    continue;
                  }
                  if (insideDiff) {
                    if (/^\+\d+/.test(line)) {
                      added++;
                    } else if (/^\-\d+/.test(line)) {
                      removed++;
                    }
                  }
                }
                linesAdded += added;
                linesRemoved += removed;
                addToUsage("linesAdded", added);
                addToUsage("linesRemoved", removed);
              } else if (packet.toolName === "write_file" && packet.aiContent) {
                const statsMatch = packet.aiContent.match(/- Stats: \[(\d+) lines/);
                const verifiedLinesCount = statsMatch ? parseInt(statsMatch[1]) : 0;
                let oldLinesCount = 0;
                if (packet.aiContent.includes("Old File contents:")) {
                  const ancestryLines = packet.aiContent.split("\n");
                  let insideOldFile = false;
                  for (const line of ancestryLines) {
                    if (line.includes("Old File contents:")) {
                      insideOldFile = true;
                      continue;
                    }
                    if (insideOldFile) {
                      if (line.trim() === "") {
                        insideOldFile = false;
                      } else if (/^\d+ \|/.test(line)) {
                        oldLinesCount++;
                      }
                    }
                  }
                }
                linesAdded += verifiedLinesCount;
                linesRemoved += oldLinesCount;
                addToUsage("linesAdded", verifiedLinesCount);
                addToUsage("linesRemoved", oldLinesCount);
              }
              continue;
            }
            let chunkText = packet.content;
            if (packet.type === "text" && chunkText.includes("Request Cancelled")) {
              if (global.gc) {
                global.gc();
                lastGCTime = Date.now();
              }
              continue;
            }
            const chunkLower = chunkText.toLowerCase();
            if (chunkText.includes("```")) inCodeBlock = !inCodeBlock;
            if (chunkLower.includes("tool:functions.") || chunkLower.includes("agent:generalist.")) {
              inToolCall = true;
              toolCallBalance = 0;
              inToolCallString = null;
              if (chunkText.includes("[tool:functions.") || chunkText.includes("[agent:generalist.")) toolCallBalance = 0;
            }
            if (inToolCall) {
              for (let j = 0; j < chunkText.length; j++) {
                const char = chunkText[j];
                if (!inToolCallString && (char === "'" || char === '"' || char === "`")) {
                  inToolCallString = char;
                } else if (inToolCallString && char === inToolCallString && chunkText[j - 1] !== "\\") {
                  inToolCallString = null;
                }
                if (!inToolCallString) {
                  if (char === "(" || char === "[") toolCallBalance++;
                  else if (char === ")" || char === "]") toolCallBalance--;
                }
              }
              if (toolCallBalance <= 0 && !inToolCallString) {
                inToolCall = false;
              }
            }
            const hasThinkTag = chunkLower.includes("<think") || chunkLower.includes("<thought");
            const canThink = !inThinkMode && !inCodeBlock && !inToolCall && !thinkConsumedInTurn;
            if (hasThinkTag && canThink) {
              const match = chunkText.match(/<(think|thought)/i);
              const tagIndex = match.index;
              const beforeText = chunkText.substring(0, tagIndex);
              const afterText = chunkText.substring(tagIndex);
              if (beforeText) {
                if (!currentAgentId) {
                  currentAgentId = "agent-" + Date.now();
                  setMessages((prev) => [...prev, { id: currentAgentId, role: "agent", text: beforeText, isStreaming: true }]);
                } else {
                  setMessages((prev) => prev.map(
                    (m) => m.id === currentAgentId ? { ...m, text: m.text + beforeText, isStreaming: true } : m
                  ));
                }
              }
              inThinkMode = true;
              thinkConsumedInTurn = true;
              let thinkStartText = afterText.replace(/<(think|thought)>/gi, "");
              currentThinkId = "think-" + Date.now();
              setMessages((prev) => [...prev, { id: currentThinkId, role: "think", text: thinkStartText, isStreaming: true, startTime: Date.now() }]);
              continue;
            }
            if ((chunkLower.includes("</think>") || chunkLower.includes("</thought>")) && currentThinkId) {
              const parts = chunkText.split(/<\/(think|thought)>/gi);
              const thinkPart = parts[0] || "";
              const agentPart = parts.slice(2).join("").replace(/<\/?(think|thought)>/gi, "");
              setMessages((prev) => {
                const newMsgs = prev.map((m) => {
                  if (m.id === currentThinkId && typeof m.id === "string") {
                    const startTime = m.startTime || parseInt(m.id.split("-")[1]) || Date.now();
                    const duration = Date.now() - startTime;
                    return { ...m, text: m.text + thinkPart, isStreaming: false, duration };
                  }
                  return m;
                });
                inThinkMode = false;
                currentAgentId = "agent-" + Date.now();
                return [...newMsgs, { id: currentAgentId, role: "agent", text: agentPart, isStreaming: true }];
              });
              continue;
            }
            if (inThinkMode && currentThinkId) {
              setMessages((prev) => {
                const next = [...prev];
                let transitioning = false;
                let transitionContent = "";
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].id === currentThinkId) {
                    const newText = next[i].text + chunkText;
                    if (newText.toLowerCase().includes("</think>")) {
                      transitioning = true;
                      const parts = newText.split(/<\/think>/gi);
                      transitionContent = parts.slice(1).join("</think>") || "";
                      const startTime = next[i].startTime || parseInt(String(next[i].id).split("-")[1]) || Date.now();
                      const duration = Date.now() - startTime;
                      next[i] = { ...next[i], text: parts[0], isStreaming: false, duration };
                    } else {
                      next[i] = { ...next[i], text: newText, isStreaming: true };
                    }
                    break;
                  }
                }
                if (transitioning) {
                  inThinkMode = false;
                  currentAgentId = "agent-" + Date.now();
                  next.push({ id: currentAgentId, role: "agent", text: transitionContent.replace(/<\/?(think|thought)>/gi, ""), isStreaming: true });
                }
                return next;
              });
            } else if (!inThinkMode) {
              const chunkLower2 = chunkText.toLowerCase();
              if (!toolCallEncounteredInTurn && (chunkLower2.includes("tool:functions.") || chunkLower2.includes("agent:generalist."))) {
                toolCallEncounteredInTurn = true;
              }
              if (!currentAgentId) {
                currentAgentId = "agent-" + Date.now();
                setMessages((prev) => [...prev, { id: currentAgentId, role: "agent", text: chunkText, isStreaming: true }]);
              } else {
                setMessages((prev) => {
                  const next = [...prev];
                  for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].id === currentAgentId) {
                      next[i] = { ...next[i], text: next[i].text + chunkText, isStreaming: true };
                      break;
                    }
                  }
                  return next;
                });
              }
            }
          }
          const apiEnd = Date.now();
          setSessionApiTime((prev) => prev + (apiEnd - apiStart));
        } catch (err) {
          setMessages((prev) => {
            setCompletedIndex(prev.length + 1);
            return [...prev, { id: "error-" + Date.now(), role: "system", text: `\u274C ERROR: ${err.message}` }];
          });
        } finally {
          setIsProcessing(false);
          setStatusText(null);
          setActiveTime(0);
          clearInterval(interval_for_timer);
          if (didSignalTerminationRef.current) {
            appendCancelMessage();
          }
          clearBlocksCache();
          if (global.gc) {
            try {
              global.gc();
              setTimeout(() => {
                if (global.gc) global.gc();
                lastGCTime = Date.now();
              }, 500);
            } catch (e) {
            }
          }
          if (!hasFiredJanitor) {
            if (process.stdout.isTTY) {
              process.stdout.write("\x1B]0;FluxFlow | Idle\x07");
              process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow | Idle\x07");
            }
          }
          if (queuedPromptRef.current) {
            setResolutionData(queuedPromptRef.current);
            setQueuedPrompt(null);
            const hintToResolve = queuedPromptRef.current;
            queuedPromptRef.current = null;
            setMessages((prev) => {
              const newMsgs = [...prev];
              const hintMsg = newMsgs.reverse().find((m) => m.text?.includes("[STEERING HINT: QUEUED]") || m.text?.includes("[QUESTION: QUEUED]"));
              if (hintMsg) {
                if (hintMsg.text.includes("[STEERING HINT: QUEUED]")) {
                  hintMsg.text = hintMsg.text.replace("[STEERING HINT: QUEUED]", "[STEERING HINT: FINISHED_TURN]");
                } else if (hintMsg.text.includes("[QUESTION: QUEUED]")) {
                  hintMsg.text = hintMsg.text.replace("[QUESTION: QUEUED]", "[QUESTION: FINISHED_TURN]");
                }
              }
              return newMsgs.reverse();
            });
            setActiveView("resolution");
          }
          setMessages((prev) => {
            const totalDuration = Date.now() - apiStart;
            let foundLastAgent = false;
            const newMsgs = [...prev].reverse().map((m) => {
              let updated = m.isStreaming ? { ...m, isStreaming: false } : m;
              if (updated.text) {
                updated.text = (" " + updated.text).slice(1);
              }
              if (!foundLastAgent && updated.role === "agent") {
                foundLastAgent = true;
                updated = { ...updated, workedDuration: totalDuration };
              }
              return updated;
            }).reverse();
            const historyToSave = newMsgs.filter((m) => !String(m.id).startsWith("welcome") && (!m.isMeta || m.text && m.text.includes("Request Cancelled")));
            saveChat(chatId, null, historyToSave);
            setCompletedIndex(newMsgs.length);
            return newMsgs;
          });
        }
      };
      streamChat();
    }
    setInput("");
    setIsExpanded(false);
  };
  const suggestions = useMemo2(() => {
    if (input.startsWith("/") && !isFilePickerDismissed) {
      const parts2 = input.split(" ");
      const query = parts2[parts2.length - 1].toLowerCase();
      if (parts2.length === 1) {
        const cleanQuery = query.startsWith("/") ? query.slice(1) : query;
        return COMMANDS.filter((c) => {
          const cleanCmd = c.cmd.startsWith("/") ? c.cmd.slice(1) : c.cmd;
          return cleanCmd.toLowerCase().includes(cleanQuery);
        });
      }
      let currentList = COMMANDS;
      for (let i = 0; i < parts2.length - 1; i++) {
        const part = parts2[i].toLowerCase();
        const found = currentList.find((c) => c.cmd.toLowerCase() === part);
        if (found && found.subs) {
          currentList = found.subs;
        } else {
          return [];
        }
      }
      return currentList.filter((s) => s.cmd.toLowerCase().includes(query));
    }
    const parts = input.split(" ");
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.startsWith("@") && !isFilePickerDismissed) {
      const hashIndex = lastPart.indexOf("#");
      const hasHash = hashIndex !== -1;
      const query = hasHash ? lastPart.substring(1, hashIndex).toLowerCase() : lastPart.slice(1).toLowerCase();
      const suffix = hasHash ? lastPart.substring(hashIndex) : "";
      const projectFiles = getProjectFiles(process.cwd());
      const matches = projectFiles.filter((f) => f.name.toLowerCase().includes(query));
      return matches.map((f) => {
        const relPath = f.relativePath.replace(/\\/g, "/");
        const formattedPath = relPath.startsWith(".") ? relPath : "./" + relPath;
        return {
          cmd: "@[" + formattedPath + suffix + "]",
          desc: f.relativePath
        };
      });
    }
    return [];
  }, [input, isFilePickerDismissed]);
  useEffect11(() => {
    setSelectedIndex(0);
  }, [suggestions]);
  useEffect11(() => {
    if (activeView !== "providerBudgetSelect") return;
    const PBS_PROVIDERS = ["Google", "DeepSeek", "NVIDIA", "OpenRouter"];
    const existingBudgets = quotas.providerBudgets || {};
    const initialSelected = PBS_PROVIDERS.reduce((acc, p) => {
      acc[p] = !!(existingBudgets[p] && (existingBudgets[p].agentLimit || existingBudgets[p].tokenLimit));
      return acc;
    }, {});
    setPbsSelected(initialSelected);
    setPbsCursor(0);
  }, [activeView]);
  useEffect11(() => {
    if (activeView !== "providerBudgetFlow") return;
    const currentProvider = providerBudgetQueue[providerBudgetCursor];
    if (!currentProvider) {
      const returnMode = budgetReturnView === "settings" ? "resetMode" : "budgetResetMode";
      const rawPB = quotas.providerBudgets || {};
      const cleaned = { __useProvider: true };
      for (const prov of providerBudgetQueue) {
        if (rawPB[prov]) cleaned[prov] = rawPB[prov];
      }
      const finalCleanedQuotas = { ...quotas, providerBudgets: cleaned };
      setQuotas(finalCleanedQuotas);
      saveSettings({ apiTier, quotas: finalCleanedQuotas });
      setActiveView(returnMode);
      return;
    }
    const existingPB = (quotas.providerBudgets || {})[currentProvider] || {};
    const totalProviders = providerBudgetQueue.length;
    const currentStep = providerBudgetCursor + 1;
    const providerLabel = `[${currentStep}/${totalProviders}] ${currentProvider}`;
    const advanceToNext = (finalQuotas) => {
      if (providerBudgetCursor + 1 < providerBudgetQueue.length) {
        setProviderBudgetCursor((c) => c + 1);
        setActiveView("providerBudgetFlow");
      } else {
        const rawPB = finalQuotas.providerBudgets || {};
        const cleaned = { __useProvider: true };
        for (const prov of providerBudgetQueue) {
          if (rawPB[prov]) cleaned[prov] = rawPB[prov];
        }
        const finalCleanedQuotas = { ...finalQuotas, providerBudgets: cleaned };
        setQuotas(finalCleanedQuotas);
        const rm = budgetReturnView === "settings" ? "resetMode" : "budgetResetMode";
        saveSettings({ apiTier, quotas: finalCleanedQuotas });
        setActiveView(rm);
      }
    };
    setInputConfig({
      label: `${providerLabel} \u2014 Daily budget (requests/day):`,
      key: "providerBudgets",
      providerKey: currentProvider,
      subKey: "agentLimit",
      value: getPrefilledValue(existingPB.agentLimit),
      returnView: "providerBudgetSelect",
      next: (newQuotas) => {
        const updatedPB = (newQuotas.providerBudgets || {})[currentProvider] || {};
        return {
          label: `${providerLabel} \u2014 Daily budget (tokens/day):`,
          key: "providerBudgets",
          providerKey: currentProvider,
          subKey: "tokenLimit",
          value: getPrefilledValue(updatedPB.tokenLimit),
          returnView: "providerBudgetSelect",
          next: (q2) => {
            const pb2 = (q2.providerBudgets || {})[currentProvider] || {};
            return {
              label: `${providerLabel} \u2014 Monthly budget (tokens/month):`,
              key: "providerBudgets",
              providerKey: currentProvider,
              subKey: "monthlyTokenLimit",
              value: getPrefilledValue(pb2.monthlyTokenLimit),
              returnView: "providerBudgetFlow",
              onDone: advanceToNext
            };
          }
        };
      }
    });
    setActiveView("input");
  }, [activeView, providerBudgetCursor]);
  const CustomMenuItem = ({ label: label2, isSelected }) => {
    const isCancel = label2 === "Cancel" || label2 === "Back" || label2.toLowerCase().includes("exit") || label2.toLowerCase().includes("back");
    return /* @__PURE__ */ React15.createElement(
      Box14,
      {
        marginTop: isCancel ? 1 : 0,
        backgroundColor: isSelected ? "#2a2a2a" : void 0,
        paddingX: 1,
        width: "100%"
      },
      /* @__PURE__ */ React15.createElement(Text15, { color: isSelected ? "white" : "gray", bold: isSelected }, isSelected ? "\u276F " : "  ", label2)
    );
  };
  const renderProgressBar = (label2, current, limit) => {
    const percent = limit > 0 ? Math.min(100, Math.round(current / limit * 100)) : 0;
    const barWidth = 15;
    const filledCount = Math.round(percent / 100 * barWidth);
    const barStr = "\u2588".repeat(filledCount) + "\u2591".repeat(Math.max(0, barWidth - filledCount));
    let barColor = "gray";
    if (percent >= 40 && percent <= 80) {
      barColor = "yellow";
    } else if (percent > 80) {
      barColor = "red";
    }
    const isTokens = label2.toLowerCase().includes("token");
    const displayLimit = shouldClearValue(limit) ? "\u221E" : isTokens ? formatTokens(limit) : limit;
    const displayCurrent = isTokens ? formatTokens(current) : current;
    return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "row", paddingLeft: 4, key: label2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 18 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, label2, ": ")), /* @__PURE__ */ React15.createElement(Text15, { color: barColor }, barStr), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, " ", percent, "% (", displayCurrent, "/", displayLimit, ")"));
  };
  const renderActiveView = () => {
    switch (activeView) {
      case "settings":
        return /* @__PURE__ */ React15.createElement(
          SettingsMenu,
          {
            systemSettings,
            setSystemSettings,
            apiTier,
            setActiveView,
            setInputConfig,
            saveSettings,
            quotas,
            setMessages,
            aiProvider
          }
        );
      case "selectProvider":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "SELECT AI PROVIDER",
            items: [
              { label: "Google (Free/Paid)", value: "Google" },
              { label: "Nvidia (Free/Paid)", value: "NVIDIA" },
              { label: "DeepSeek (Paid)", value: "DeepSeek" },
              { label: "OpenRouter (Free/Paid) [EXPERIMENTAL]", value: "OpenRouter" },
              { label: "Back", value: "settings" }
            ],
            onSelect: async (item) => {
              if (item.value === "settings" || item.value === "Back") {
                setActiveView("settings");
                return;
              }
              const selectedProvider = item.value;
              const key = await getProviderAPIKey(selectedProvider);
              if (key) {
                setAiProvider(selectedProvider);
                setApiKey(key);
                initAI(key, { aiProvider: selectedProvider, onIDEApproval: resetPendingApproval });
                let defaultModel = "gemma-4-31b-it";
                if (selectedProvider === "OpenRouter") {
                  defaultModel = "google/gemma-4-31b-it:free";
                } else if (selectedProvider === "DeepSeek") {
                  defaultModel = "deepseek-v4-flash";
                } else if (selectedProvider === "NVIDIA") {
                  defaultModel = "moonshotai/kimi-k2.6";
                }
                setActiveModel(defaultModel);
                const targetTier = (quotas.providerTiers || {})[selectedProvider] || "Free";
                setApiTier(targetTier);
                saveSettings({ aiProvider: selectedProvider, activeModel: defaultModel, apiTier: targetTier, quotas });
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "system",
                    text: `[SYSTEM] Switched to ${selectedProvider}! Key loaded from Cache. Model set to ${defaultModel}.`,
                    isMeta: true
                  }
                ]);
                setActiveView("settings");
              } else {
                setInputConfig({
                  label: `Enter ${selectedProvider} API Key:`,
                  key: "providerKey",
                  provider: selectedProvider,
                  value: "",
                  returnView: "settings"
                });
                setActiveView("input");
              }
            },
            onClose: () => setActiveView("settings")
          }
        );
      case "apiTier": {
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", padding: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "SELECT API MODE FOR ", aiProvider.toUpperCase())), /* @__PURE__ */ React15.createElement(
          SelectInput2,
          {
            items: [
              { label: "Free Mode (For Free APIs)     [Free Models Only]", value: "Free" },
              { label: `Paid Mode (For Billing APIs)  [Premium Models Unlocked] ${apiTier === "Paid" ? "\u25CF" : ""}`, value: "Paid" },
              { label: "Back", value: "settings" }
            ],
            onSelect: (item) => {
              if (item.value === "settings" || item.value === "Back") {
                setActiveView("settings");
                return;
              }
              const newTier = item.value;
              setApiTier(newTier);
              const updatedProviderTiers = {
                ...quotas.providerTiers || {},
                [aiProvider]: newTier
              };
              const newQuotas = {
                ...quotas,
                providerTiers: updatedProviderTiers
              };
              setQuotas(newQuotas);
              saveSettings({ apiTier: newTier, quotas: newQuotas });
              setActiveView("settings");
            },
            itemComponent: CustomMenuItem,
            indicatorComponent: () => null
          }
        ), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, "(Arrows to select \u2022 Enter to confirm)")));
      }
      case "resetMode":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "SELECT MONTHLY RESET MODE",
            items: [
              { label: "Default (Rolling 30-Day Window)", value: "Rolling" },
              { label: "Custom (Set reset day of month)", value: "Custom" },
              { label: "Back", value: "apiTier" }
            ],
            onSelect: (item) => {
              if (item.value === "apiTier" || item.value === "Back") {
                setActiveView("apiTier");
                return;
              }
              const selectedMode = item.value;
              const updatedQuotas = { ...quotas, resetMode: selectedMode };
              setQuotas(updatedQuotas);
              if (selectedMode === "Custom") {
                setInputConfig({
                  label: "Enter monthly reset day (1-30):",
                  key: "quotas",
                  subKey: "resetDay",
                  value: String(quotas.resetDay || 1),
                  returnView: "settings"
                });
                setActiveView("input");
              } else {
                saveSettings({ apiTier, quotas: updatedQuotas });
                setActiveView("settings");
              }
            },
            onClose: () => setActiveView("apiTier")
          }
        );
      case "budgetTypeSelect":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "SELECT BUDGET TYPE",
            items: [
              { label: `Global Budget  (single limit for all providers) ${apiTier === "Paid" && !quotas.providerBudgets?.["__useProvider"] ? "\u25CF" : ""}`, value: "global" },
              { label: `Provider Budgets  (set limits per provider individually) ${quotas.providerBudgets?.["__useProvider"] ? "\u25CF" : ""}`, value: "provider" },
              { label: "Back", value: budgetReturnView }
            ],
            onSelect: (item) => {
              if (item.value === budgetReturnView || item.value === "Back") {
                setActiveView(budgetReturnView);
                return;
              }
              if (item.value === "global") {
                const updatedQuotas = {
                  ...quotas,
                  agentLimit: 99999999,
                  tokenLimit: 99999999999999,
                  monthlyTokenLimit: 99999999999999,
                  providerBudgets: { __useProvider: false }
                };
                setQuotas(updatedQuotas);
                const returnMode = budgetReturnView === "settings" ? "resetMode" : "budgetResetMode";
                setInputConfig({
                  label: "Enter Agent daily budget (requests made):",
                  key: "quotas",
                  subKey: "agentLimit",
                  value: getPrefilledValue(updatedQuotas.agentLimit),
                  returnView: budgetReturnView,
                  next: (newQuotas) => ({
                    label: "Enter Agent daily budget (tokens used):",
                    key: "quotas",
                    subKey: "tokenLimit",
                    value: getPrefilledValue(newQuotas.tokenLimit),
                    returnView: budgetReturnView,
                    next: (q2) => ({
                      label: "Enter Agent monthly budget (tokens used):",
                      key: "quotas",
                      subKey: "monthlyTokenLimit",
                      value: getPrefilledValue(q2.monthlyTokenLimit),
                      returnView: returnMode
                    })
                  })
                });
                setActiveView("input");
              } else if (item.value === "provider") {
                const updatedQuotas = {
                  ...quotas,
                  agentLimit: 99999999,
                  tokenLimit: 99999999999999,
                  monthlyTokenLimit: 99999999999999,
                  providerBudgets: {
                    ...quotas.providerBudgets || {},
                    __useProvider: true
                  }
                };
                setQuotas(updatedQuotas);
                setActiveView("providerBudgetSelect");
              }
            },
            onClose: () => setActiveView(budgetReturnView)
          }
        );
      case "providerBudgetSelect": {
        const PROVIDERS_LIST = ["Google", "DeepSeek", "NVIDIA", "OpenRouter"];
        const anySelected = PROVIDERS_LIST.some((p) => pbsSelected[p]);
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", padding: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", bold: true }, "SELECT PROVIDERS TO SET BUDGETS FOR")), PROVIDERS_LIST.map((prov, i) => {
          const isActive = i === pbsCursor;
          const isChecked = !!pbsSelected[prov];
          return /* @__PURE__ */ React15.createElement(Box14, { key: prov, backgroundColor: isActive ? "#2a2a2a" : void 0, paddingX: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: isActive ? "white" : "gray", bold: isActive }, isActive ? "\u276F " : "  ", /* @__PURE__ */ React15.createElement(Text15, { color: isChecked ? "green" : "gray" }, isChecked ? "\u2611" : "\u2610"), "  ", prov, isChecked && quotas.providerBudgets?.[prov]?.agentLimit ? /* @__PURE__ */ React15.createElement(Text15, { color: "cyan" }, " (budget set)") : null));
        }), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, "\u2191\u2193 Navigate  \u2022  Space to toggle  \u2022  Enter to confirm  \u2022  ESC to go back"), !anySelected && /* @__PURE__ */ React15.createElement(Text15, { color: "yellow", italic: true }, "  Select at least one provider to continue")));
      }
      case "providerBudgetFlow":
        return null;
      case "budgetResetMode":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "SELECT MONTHLY RESET MODE",
            items: [
              { label: "Default (Rolling 30-Day Window)", value: "Rolling" },
              { label: "Custom (Set reset day of month)", value: "Custom" },
              { label: "Back", value: "chat" }
            ],
            onSelect: (item) => {
              if (item.value === "chat" || item.value === "Back") {
                setActiveView("chat");
                return;
              }
              const selectedMode = item.value;
              const updatedQuotas = { ...quotas, resetMode: selectedMode };
              setQuotas(updatedQuotas);
              if (selectedMode === "Custom") {
                setInputConfig({
                  label: "Enter monthly reset day (1-30):",
                  key: "quotas",
                  subKey: "resetDay",
                  value: String(quotas.resetDay || 1),
                  returnView: "chat"
                });
                setActiveView("input");
              } else {
                saveSettings({ apiTier, quotas: updatedQuotas });
                setActiveView("chat");
              }
            },
            onClose: () => setActiveView("chat")
          }
        );
      case "budgetView": {
        const reqCurrent = dailyUsage?.agent || 0;
        const reqLimit = quotas.agentLimit || 99999999;
        const tokenCurrent = dailyUsage?.tokens || 0;
        const tokenLimit = quotas.tokenLimit || 99999999999999;
        const monthlyCurrent = quotas.resetMode === "Custom" ? customPeriodUsage?.tokens || 0 : monthlyUsage?.tokens || 0;
        const monthlyLimit = quotas.monthlyTokenLimit || 99999999999999;
        const isFreeTier = apiTier !== "Paid";
        const usingProviderBudgets = !!quotas.providerBudgets?.__useProvider;
        const providerBudgetsMap = quotas.providerBudgets || {};
        const configuredProviders = ["Google", "DeepSeek", "NVIDIA", "OpenRouter"].filter(
          (p) => providerBudgetsMap[p] && (providerBudgetsMap[p].agentLimit || providerBudgetsMap[p].tokenLimit || providerBudgetsMap[p].monthlyTokenLimit)
        );
        const limitsNotSet = !usingProviderBudgets && (shouldClearValue(reqLimit) || shouldClearValue(tokenLimit) || shouldClearValue(monthlyLimit));
        let resetInfo = "";
        if (quotas.resetMode === "Custom") {
          const today = /* @__PURE__ */ new Date();
          const resetDay = quotas.resetDay || 1;
          let resetMonth = today.getMonth();
          if (today.getDate() >= resetDay) {
            resetMonth += 1;
          }
          const resetDate = new Date(today.getFullYear(), resetMonth, resetDay);
          const monthName = resetDate.toLocaleString("default", { month: "short" });
          resetInfo = `Resets on: ${resetDay}-${monthName}`;
        }
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", padding: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { marginBottom: 1, justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "BUDGET LIMIT STATUS"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "[ ESC to Close ]")), limitsNotSet ? /* @__PURE__ */ React15.createElement(Box14, { padding: 1, justifyContent: "center", alignItems: "center", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "LIMITS NOT SET")) : usingProviderBudgets && configuredProviders.length > 0 ? /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", gap: 1, width: "100%" }, configuredProviders.map((prov) => {
          const pb = providerBudgetsMap[prov];
          const provReqCurrent = dailyUsage?.providerRequests?.[prov] || 0;
          let provTokenCurrent = 0;
          const dailyModels = dailyUsage?.models?.[prov] || {};
          for (const m in dailyModels) {
            provTokenCurrent += dailyModels[m]?.tokens || 0;
          }
          let provMonthlyCurrent = 0;
          const monthlySource = quotas.resetMode === "Custom" ? customPeriodUsage : monthlyUsage;
          const monthlyModels = monthlySource?.models?.[prov] || {};
          for (const m in monthlyModels) {
            provMonthlyCurrent += monthlyModels[m]?.tokens || 0;
          }
          return /* @__PURE__ */ React15.createElement(Box14, { key: prov, flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { marginBottom: 0 }, /* @__PURE__ */ React15.createElement(Text15, { color: "cyan", bold: true }, "\u25C6 ", prov)), renderProgressBar("Daily Requests", provReqCurrent, pb.agentLimit || 99999999, "cyan"), renderProgressBar("Daily Tokens", provTokenCurrent, pb.tokenLimit || 99999999999999, "green"), renderProgressBar("Monthly Tokens", provMonthlyCurrent, pb.monthlyTokenLimit || 99999999999999, "yellow"));
        }), resetInfo ? /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "Monthly Reset  : "), /* @__PURE__ */ React15.createElement(Text15, { color: "magenta", bold: true }, resetInfo)) : /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "Monthly Reset  : "), /* @__PURE__ */ React15.createElement(Text15, { color: "blue", bold: true }, "Rolling 30-Day Window"))) : /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, width: "100%" }, renderProgressBar("Daily Requests", reqCurrent, reqLimit, "cyan"), renderProgressBar("Daily Tokens", tokenCurrent, tokenLimit, "green"), renderProgressBar("Monthly Tokens", monthlyCurrent, monthlyLimit, "yellow"), resetInfo ? /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "Monthly Reset  : "), /* @__PURE__ */ React15.createElement(Text15, { color: "magenta", bold: true }, resetInfo)) : /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "Monthly Reset  : "), /* @__PURE__ */ React15.createElement(Text15, { color: "blue", bold: true }, "Rolling 30-Day Window"))));
      }
      case "input":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", padding: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "DATA CONFIGURATION")), inputConfig?.note && /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, inputConfig.note)), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, flexDirection: "row" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, inputConfig?.label, " "), /* @__PURE__ */ React15.createElement(
          TextInput4,
          {
            value: inputConfig?.value || "",
            onChange: (val) => setInputConfig((prev) => ({ ...prev, value: val })),
            onSubmit: async (val) => {
              const { key, subKey, next, onDone } = inputConfig;
              let newQuotas = { ...quotas };
              let newSettings = {};
              if (key === "quotas") {
                let parsedValue = subKey.toLowerCase().includes("limit") || subKey === "resetDay" ? parseInt(val) || 0 : val;
                if (subKey === "resetDay") {
                  parsedValue = Math.max(1, Math.min(30, parsedValue));
                }
                newQuotas[subKey] = parsedValue;
                setQuotas(newQuotas);
                newSettings.quotas = newQuotas;
              } else if (key === "providerBudgets") {
                const prov = inputConfig.providerKey;
                const parsedValue = subKey.toLowerCase().includes("limit") ? parseInt(val) || 0 : val;
                const existingPBudgets = newQuotas.providerBudgets || {};
                newQuotas.providerBudgets = {
                  ...existingPBudgets,
                  [prov]: {
                    ...existingPBudgets[prov] || {},
                    [subKey]: parsedValue
                  }
                };
                setQuotas(newQuotas);
                newSettings.quotas = newQuotas;
              } else if (key === "activeModel") {
                setActiveModel(val);
                newSettings.activeModel = val;
              } else if (key === "janitorModel") {
                setJanitorModel(val);
                newSettings.janitorModel = val;
              } else if (key === "autoApproveCommands" || key === "autoDisallowCommands" || key === "alwaysAskCommands") {
                const newSysSettings = { ...systemSettings, [key]: val.trim(), sandboxPreset: "Custom" };
                setSystemSettings(newSysSettings);
                newSettings.systemSettings = newSysSettings;
              } else if (key === "externalDataPath") {
                const newSysSettings = { ...systemSettings, useExternalData: true, externalDataPath: val.trim() };
                setSystemSettings(newSysSettings);
                newSettings.systemSettings = newSysSettings;
                setMessages((prev) => [...prev, { id: Date.now(), role: "system", text: "[EXTERNAL STORAGE] Flux Flow will use " + val.trim() + " for data after restart." }]);
              } else if (key === "imageSettings") {
                const apiKeyInput = val.trim();
                if (apiKeyInput.startsWith("sk_")) {
                  const updatedSettings = { ...imageSettings, apiKey: apiKeyInput };
                  setImageSettings(updatedSettings);
                  newSettings.imageSettings = updatedSettings;
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[IMAGE KEY] Custom API key saved successfully.`, isMeta: true }];
                  });
                } else {
                  setImageSettings((prev) => ({ ...prev, keyType: "Default" }));
                  newSettings.imageSettings = { ...imageSettings, keyType: "Default" };
                  setMessages((prev) => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: Date.now(), role: "system", text: `[IMAGE KEY ERROR] API key must start with sk_. Key strategy reset to Default.`, isMeta: true }];
                  });
                }
              } else if (key === "providerKey") {
                const keyInput = val.trim();
                const prov = inputConfig.provider;
                await saveProviderAPIKey(prov, keyInput);
                setAiProvider(prov);
                setApiKey(keyInput);
                initAI(keyInput, { aiProvider: prov, onIDEApproval: resetPendingApproval });
                let defaultModel = "gemma-4-31b-it";
                if (prov === "OpenRouter") {
                  defaultModel = "google/gemma-4-31b-it:free";
                } else if (prov === "DeepSeek") {
                  defaultModel = "deepseek-v4-flash";
                } else if (prov === "NVIDIA") {
                  defaultModel = "moonshotai/kimi-k2.6";
                }
                setActiveModel(defaultModel);
                const targetTier = (quotas.providerTiers || {})[prov] || "Free";
                setApiTier(targetTier);
                newSettings.aiProvider = prov;
                newSettings.activeModel = defaultModel;
                newSettings.apiTier = targetTier;
                setMessages((prev) => {
                  setCompletedIndex(prev.length + 1);
                  return [...prev, { id: Date.now(), role: "system", text: `\u2705 ${prov} API Key saved successfully! Model set to ${defaultModel}.`, isMeta: true }];
                });
              }
              if (next) {
                const nextConfig = next(key === "quotas" || key === "providerBudgets" ? newQuotas : val);
                setInputConfig(nextConfig);
              } else if (onDone) {
                saveSettings({ ...newSettings, apiTier, quotas: newQuotas, imageSettings: newSettings.imageSettings || imageSettings });
                setInputConfig(null);
                onDone(newQuotas);
              } else {
                saveSettings({ ...newSettings, apiTier, quotas: newQuotas, imageSettings: newSettings.imageSettings || imageSettings });
                setInputConfig(null);
                setActiveView(inputConfig?.returnView || "settings");
              }
            }
          }
        )), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", dimColor: true, italic: true }, "(Press Enter to confirm selection)")));
      case "stats": {
        const u = statsMode === "monthly" ? monthlyUsage : dailyUsage;
        const trackerTitle = statsMode === "monthly" ? "LAST 30 DAYS USAGE" : "TODAY's USAGE";
        const timeLabel = statsMode === "monthly" ? "Wall Time:" : "Wall Time:";
        const tokensLabel = statsMode === "monthly" ? "Tokens Used:" : "Tokens Used:";
        const imagesLabel = statsMode === "monthly" ? "Images Made:" : "Images Made:";
        const imageCreditsLabel = statsMode === "monthly" ? "Image Credits:" : "Image Credits:";
        const codeChangesLabel = statsMode === "monthly" ? "Code Changes:" : "Code Changes:";
        const toolCallsLabel = statsMode === "monthly" ? "Tool Calls:" : "Tool Calls:";
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 3, paddingY: 1, paddingBottom: 0, width: Math.min(125, (stdout?.columns || 100) - 2) }, statsMode === "modelBreakdown" ? /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "30-DAY MODEL TOKEN BREAKDOWN"), !monthlyUsage?.models || Object.keys(monthlyUsage.models).length === 0 ? /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey", italic: true }, "No model token usage recorded in the last 30 days.")) : Object.entries(monthlyUsage.models).map(([provider, models]) => {
          const providerTotalTokens = Object.values(models).reduce((sum, m) => sum + (m.tokens || 0), 0);
          return /* @__PURE__ */ React15.createElement(Box14, { key: provider, flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 40 }, /* @__PURE__ */ React15.createElement(Text15, { color: "cyan", bold: true }, provider, ":")), /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, formatTokens(providerTotalTokens))), Object.entries(models).map(([modelName, stats]) => /* @__PURE__ */ React15.createElement(Box14, { key: modelName, flexDirection: "column", marginLeft: 4, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 36 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "\xBB ", modelName, ":")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(stats.tokens || 0))), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Box14, { width: 32 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Input Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens((stats.tokens || 0) - (stats.candidateTokens || 0)))), (stats.cachedTokens || 0) > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 5 }, /* @__PURE__ */ React15.createElement(Box14, { width: 31 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Cached:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(stats.cachedTokens))), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Box14, { width: 32 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Output Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(stats.candidateTokens || 0))))));
        })) : /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, { marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "SESSION TELEMETRY")), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column" }, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Session Duration:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(Date.now() - SESSION_START_TIME))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Model Requests:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionAgentCalls)), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB API Time:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(sessionApiTime))), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Tool Time:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(sessionToolTime))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Memory Agent:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionBackgroundCalls)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Tokens Consumed:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalTokens))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Active Context:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionStats.tokens))), sessionTotalTokens > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Input Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalTokens - sessionTotalCandidateTokens))), sessionTotalCachedTokens > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Box14, { width: 21 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Cached:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalCachedTokens))), sessionTotalCandidateTokens > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Output Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalCandidateTokens)))), sessionImageCount > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Images Made:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionImageCount)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Image Credits:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, Number(((sessionImageCredits || 0) * 1e3).toFixed(0)), " credits"))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Code Changes (Sess):")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "+", linesAdded), " ", /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "-", linesRemoved))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Tool Calls (Sess):")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionToolSuccess + sessionToolFailure + sessionToolDenied, " ( "), /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "\u2713 ", sessionToolSuccess), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " "), /* @__PURE__ */ React15.createElement(Text15, { color: "yellow" }, "\u2298 ", sessionToolDenied), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " "), /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "\u2715 ", sessionToolFailure), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " )"))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, trackerTitle), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, timeLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatDuration(u?.duration || 0))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Model Requests:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, u?.agent || 0)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Memory Agent:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, u?.background || 0)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, tokensLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(u?.tokens || 0))), (u?.tokens || 0) > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Input Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens((u?.tokens || 0) - (u?.candidateTokens || 0)))), (u?.cachedTokens || 0) > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Box14, { width: 21 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Cached:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(u.cachedTokens))), (u?.candidateTokens || 0) > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 23 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Output Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(u.candidateTokens)))), (u?.imageCalls?.length || 0) > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, imagesLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, u.imageCalls.length)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, imageCreditsLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, Number(((u.imageCalls.reduce((sum, c) => sum + c.cost, 0) || 0) * 1e3).toFixed(0)), " credits"))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, codeChangesLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "+", u?.linesAdded || 0), " ", /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "-", u?.linesRemoved || 0))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 25 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, toolCallsLabel)), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, (u?.toolSuccess || 0) + (u?.toolFailure || 0) + (u?.toolDenied || 0), " ( "), /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "\u2713 ", u?.toolSuccess || 0), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " "), /* @__PURE__ */ React15.createElement(Text15, { color: "yellow" }, "\u2298 ", u?.toolDenied || 0), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " "), /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "\u2715 ", u?.toolFailure || 0), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " )")))), /* @__PURE__ */ React15.createElement(Text15, { dimColor: true, marginTop: 1, italic: true }, "(Press TAB to toggle Daily/Monthly views, SPACE for Model Breakdown, ESC to return)"));
      }
      case "autoExecDanger":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "SECURITY WARNING: YOLO MODE"), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "Turning this ON allows the agent to execute terminal commands automatically without requiring your approval for each step."), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1, color: "white" }, "RISKS INVOLVED:"), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 The agent may execute destructive commands (rm -rf, etc.) by mistake unless specified in sandbox rules."), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 Unintended system changes if the agent hallucinates a path or command."), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 Reduced control over the agent's step-by-step decision making."), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Confirm Intent",
            items: [
              { label: "I know the risk and turning on intentionally", value: "on" },
              { label: "Keep Off (Recommended)", value: "off" }
            ],
            onSelect: (item) => {
              if (item.value === "on") {
                setSystemSettings((s) => ({ ...s, autoExec: true }));
              }
              setActiveView("settings");
            }
          }
        )));
      case "externalDanger":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "SECURITY WARNING: EXTERNAL WORKSPACE ACCESS"), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "Turning this ON allows the agent to execute tools (Read/Write/Exec) outside of the current active workspace directory."), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1, color: "white" }, "RISKS INVOLVED:"), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 Access to sensitive system files (SSH keys, Browser data, etc.)"), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 Potential for accidental or malicious deletion of OS-critical files."), /* @__PURE__ */ React15.createElement(Text15, null, "\u2022 Unauthorized script execution across your entire file system."), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Confirm Intent",
            items: [
              { label: "I know the risk and turning on intentionally", value: "on" },
              { label: "Keep Off (Recommended)", value: "off" }
            ],
            onSelect: (item) => {
              if (item.value === "on") {
                setSystemSettings((s) => ({ ...s, allowExternalAccess: true }));
              }
              setActiveView("settings");
            }
          }
        )));
      case "doubleDanger":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "CRITICAL SECURITY WARNING: COMBINED SYSTEM RISK"), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "You are attempting to enable BOTH [YOLO Mode] and [External Workspace Access] simultaneously."), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1, color: "red", bold: true }, "THIS IS NOT RECOMMENDED."), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1, color: "white" }, "THE CRITICAL RISK:"), /* @__PURE__ */ React15.createElement(Text15, null, "The agent will have the power to execute any command across your entire system WITHOUT your approval or supervision."), /* @__PURE__ */ React15.createElement(Text15, { color: "red", italic: true, marginTop: 1 }, "A single hallucination or error could result in full system wipe or data theft."), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Final Confirmation",
            items: [
              { label: "I agree knowing the consequences", value: "on" },
              { label: "Keep Off", value: "off" }
            ],
            onSelect: (item) => {
              if (item.value === "on") {
                setSystemSettings((s) => ({ ...s, autoExec: true, allowExternalAccess: true }));
              }
              setActiveView("settings");
            }
          }
        )));
      case "key":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "API KEY MANAGEMENT",
            items: [
              { label: "Edit Current Key (Update)", value: "edit" },
              { label: "Remove Current Key (Delete)", value: "remove" },
              { label: "Cancel", value: "Cancel" }
            ],
            onSelect: (item) => {
              if (item.value === "edit") {
                setApiKey(null);
                setActiveView("chat");
                const s = emojiSpace(2);
                setMessages((prev) => [...prev, { id: Date.now(), role: "system", text: `[ACTION] Flux waiting for new API Key...` }]);
              } else if (item.value === "remove") {
                setActiveView("deleteKey");
              } else {
                setActiveView("chat");
              }
            }
          }
        );
      case "deleteKey":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1 }, (() => {
          const s = emojiSpace(2);
          return /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "DANGER: CLEAR CREDENTIALS");
        })(), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "This will permanently delete all saved API keys in credential cache. You will need to enter it again to use Flux."), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Are you sure?",
            items: [
              { label: "YES, CLEAR CREDENTIALS", value: "yes" },
              { label: "NO, GO BACK", value: "no" }
            ],
            onSelect: async (item) => {
              if (item.value === "yes") {
                await removeAPIKey();
                setApiKey(null);
                setActiveView("chat");
                const s = emojiSpace(2);
                setMessages((prev) => [...prev, { id: Date.now(), role: "system", text: `[CREDENTIAL CLEARED] API Key removed successfully.` }]);
              } else {
                setActiveView("key");
              }
            }
          }
        )));
      case "exit":
        return null;
      case "ask":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%" }, /* @__PURE__ */ React15.createElement(
          AskUserModal_default,
          {
            question: pendingAsk?.question,
            options: pendingAsk?.options,
            onResolve: (choice) => {
              if (pendingAsk?.resolve) {
                pendingAsk.resolve(choice);
              }
              setPendingAsk(null);
              setActiveView("chat");
            }
          }
        ));
      case "revert":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%", alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(
          RevertModal,
          {
            prompts: recentPrompts,
            onSelect: async (txId) => {
              if (stdout) {
                stdout.write("\x1B[2J\x1B[3J\x1B[H");
                if (stdout.isTTY) {
                  stdout.write("\x1B[?2004h");
                }
              }
              try {
                const result = await RevertManager.rollbackToBefore(txId);
                if (result.success) {
                  const { targetPrompt } = result;
                  deleteChatSummary(chatId);
                  setClearKey((prev) => prev + 1);
                  clearBlocksCache();
                  cachedHistoryRef.current = {
                    completedIndex: 0,
                    columns: terminalSize.columns,
                    historicalBlocks: [],
                    seenSelections: /* @__PURE__ */ new Set(),
                    chatId,
                    clearKey: clearKey + 1
                  };
                  const targetIdx = messages.findLastIndex(
                    (m) => m.role === "user" && m.text && (m.text.startsWith(targetPrompt) || m.text.includes(targetPrompt))
                  );
                  let newMsgs = [...messages];
                  if (targetIdx !== -1) {
                    newMsgs = messages.slice(0, targetIdx);
                  }
                  setMessages(newMsgs);
                  setCompletedIndex(newMsgs.length);
                  setInput(targetPrompt);
                  setIsExpanded(targetPrompt.split("\n").length > 2);
                  const historyToSave = newMsgs.filter((m) => !String(m.id).startsWith("welcome") && (!m.isMeta || m.text && m.text.includes("Request Cancelled")));
                  await saveChat(chatId, null, historyToSave);
                  const s = emojiSpace(2);
                  setMessages((prev) => {
                    const finalMsgs = [...prev, {
                      id: "revert-ok-" + Date.now(),
                      role: "system",
                      text: `[ROLLBACK SUCCESSFUL] Reverted prompt loaded to input box.`,
                      isMeta: true
                    }];
                    setCompletedIndex(finalMsgs.length);
                    return finalMsgs;
                  });
                  setActiveView("chat");
                }
              } catch (err) {
                const s = emojiSpace(2);
                setMessages((prev) => {
                  const finalMsgs = [...prev, {
                    id: "revert-err-" + Date.now(),
                    role: "system",
                    text: `[ROLLBACK ERROR] ${err.message}`,
                    isMeta: true
                  }];
                  setCompletedIndex(finalMsgs.length);
                  return finalMsgs;
                });
                setActiveView("chat");
              }
            },
            onClose: () => setActiveView("chat")
          }
        ));
      case "resume":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%", alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(
          ResumeModal,
          {
            onSelect: async (id) => {
              const h = await loadHistory();
              if (h[id]) {
                stdout.write("\x1B[2J\x1B[3J\x1B[H");
                clearBlocksCache();
                chatLoadingRef.current = true;
                setChatId(id);
                const savedData = await loadChatContext(id);
                chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                chatLoadingRef.current = false;
                setChatTokens(savedData.total);
                setSessionStats({ tokens: savedData.context });
                const resumedMsgs = [...h[id].messages];
                const hasLogo = resumedMsgs[0]?.text?.includes("\u2591\u2591\u2591\u2588\u2588\u2588");
                if (!hasLogo) {
                  resumedMsgs.unshift({ id: "logo-" + Date.now(), role: "system", isLogo: true, isMeta: true });
                }
                setMessages(resumedMsgs);
                setActiveView("chat");
                setMessages((prev) => {
                  const newMsgs = [...prev, { id: "sys-" + Date.now(), role: "system", text: `SESSION RESUMED: [${id}]`, isMeta: true }];
                  setCompletedIndex(newMsgs.length);
                  return newMsgs;
                });
              }
            },
            onDelete: async (id) => {
              const newHistory = await deleteChat(id);
              return newHistory;
            },
            onClose: () => setActiveView("chat")
          }
        ));
      case "keybindingsPrompt":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "\u2328 CONFIGURE SHIFT+ENTER NEWLINE"), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "To support multi-line inputs with ", /* @__PURE__ */ React15.createElement(Text15, { bold: true, color: "white" }, "Shift + Enter"), " for newline, a terminal sequence keybinding needs to be added to your IDE configuration."), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "Would you like FluxFlow to automatically add this to your ", getIDEName(), " keybindings?"), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Add Keybinding?",
            items: [
              { label: "Yes, configure automatically", value: "yes" },
              { label: "No, skip", value: "no" }
            ],
            onSelect: async (item) => {
              if (item.value === "yes") {
                await addShiftEnterBinding(getIDEName());
              } else {
                cachedShortcut = "\\ + Enter";
              }
              setActiveView("chat");
            }
          }
        )));
      case "memory":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%", alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(MemoryModal, { onClose: () => setActiveView("chat") }));
      case "parserDownload":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%", alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(ParserDownloadModal, { onClose: () => setActiveView("settings") }));
      case "profile":
        return /* @__PURE__ */ React15.createElement(
          ProfileForm,
          {
            initialData: profileData,
            onSave: (profile) => {
              setProfileData(profile);
              setMessages((prev) => [...prev, { id: Date.now(), role: "system", text: `Profile updated: ${profile.name} (${profile.nickname})` }]);
              setActiveView("chat");
            },
            onCancel: () => setActiveView("chat")
          }
        );
      case "resolution":
        return /* @__PURE__ */ React15.createElement(Box14, { width: "100%", alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(
          ResolutionModal,
          {
            data: resolutionData,
            onResolve: (val) => {
              setResolutionData(null);
              setActiveView("chat");
              setTimeout(() => {
                handleSubmit(val, true);
              }, 500);
            },
            onEdit: (val) => {
              setResolutionData(null);
              setActiveView("chat");
              setInput(val);
            }
          }
        ));
      case "approval":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "FILE WRITE PERMISSION"), /* @__PURE__ */ React15.createElement(Text15, { marginTop: 1 }, "The agent is attempting to modify: ", /* @__PURE__ */ React15.createElement(Text15, { color: "cyan" }, parseArgs(pendingApproval?.args || "{}").path || "Unknown File")), !isBridgeConnected() ? /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1, borderStyle: "single", borderColor: "#333", paddingX: 1, flexDirection: "column" }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "--- PROPOSED CONTENT ---"), (() => {
          const args2 = parseArgs(pendingApproval?.args || "{}");
          const patchPairs = [];
          const indices = /* @__PURE__ */ new Set();
          Object.keys(args2).forEach((key) => {
            const m = key.match(/^(replaceContent|newContent|content_to_replace|content_to_add|TargetContent|ReplacementContent|replacementContent)(\d+)?$/);
            if (m) {
              const index = m[2] ? parseInt(m[2]) : 1;
              indices.add(index);
            }
          });
          const sortedIndices = Array.from(indices).sort((a, b) => a - b);
          sortedIndices.forEach((i) => {
            let r, n;
            if (i === 1) {
              r = args2.replaceContent1 ?? args2.content_to_replace1 ?? args2.replaceContent ?? args2.content_to_replace ?? args2.TargetContent ?? null;
              n = args2.newContent1 ?? args2.content_to_add1 ?? args2.newContent ?? args2.content_to_add ?? args2.ReplacementContent ?? args2.replacementContent ?? null;
            } else {
              r = args2[`replaceContent${i}`] ?? args2[`content_to_replace${i}`] ?? null;
              n = args2[`newContent${i}`] ?? args2[`content_to_add${i}`] ?? null;
            }
            if (r !== null || n !== null) {
              patchPairs.push({ replace: r, new: n });
            }
          });
          if (patchPairs.length > 0) {
            return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1 }, patchPairs.map((pair, idx) => {
              const hasOld = pair.replace !== null;
              const hasNew = pair.new !== null;
              return /* @__PURE__ */ React15.createElement(Box14, { key: idx, flexDirection: "column", marginTop: idx > 0 ? 1 : 0 }, patchPairs.length > 1 && /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "Block ", idx + 1, ":"), hasOld && /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Text15, { color: "red", wrap: "anywhere", bold: true }, "- ", pair.replace)), hasNew && /* @__PURE__ */ React15.createElement(Box14, { marginTop: hasOld ? 0 : 0 }, /* @__PURE__ */ React15.createElement(Text15, { color: "green", wrap: "anywhere", bold: true }, "+ ", pair.new.replace(/\[\/n\]?/g, "\\n"))));
            }));
          }
          const newVal = args2.content || args2.ReplacementContent || args2.content_to_add || args2.replacementContent || args2.newContent || null;
          return /* @__PURE__ */ React15.createElement(Text15, { color: "white", wrap: "anywhere" }, (newVal ? newVal.replace(/\[\/n\]?/g, "\\n") : null) || "Updating file content...");
        })()) : /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1, paddingX: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "cyan", italic: true }, "\u26A1\uFE0F FluxFlow Companion is active. Review the changes in your editor.")), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Action Required",
            items: [
              { label: "Accept this time", value: "allow" },
              { label: "Accept for this session", value: "always" },
              { label: "Don't accept", value: "deny" }
            ],
            onSelect: (item) => {
              if (item.value === "always") setAutoAcceptWrites(true);
              const decision = item.value === "deny" ? "deny" : "allow";
              pendingApproval.resolve(decision);
              setPendingApproval(null);
              setActiveView("chat");
            }
          }
        )));
      case "updateManager":
        return /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Select Preferred Update Manager",
            subtitle: "NOTE: If you are unsure about these, go with NPM",
            items: [
              { label: "NPM   (Standard)", value: "npm" },
              { label: "PNPM  (Recommended)", value: "pnpm" },
              { label: "BUN   (Ultra Fast)", value: "bun" },
              { label: "YARN  (Classic)", value: "yarn" },
              { label: "Custom Command", value: "custom" },
              { label: "Back", value: "settings" }
            ],
            onSelect: (item) => {
              if (item.value === "settings" || item.value === "Back") {
                setActiveView("settings");
                return;
              }
              if (item.value === "custom") {
                setInputConfig({
                  label: "Enter Custom Update Command (Global install recommended):",
                  key: "customUpdateCommand",
                  value: systemSettings.customUpdateCommand,
                  next: (val) => {
                    setSystemSettings((s) => ({ ...s, updateManager: "custom", customUpdateCommand: val }));
                    return null;
                  }
                });
                setActiveView("input");
              } else {
                setSystemSettings((s) => ({ ...s, updateManager: item.value }));
                setActiveView("settings");
              }
            }
          }
        );
      case "update":
        return /* @__PURE__ */ React15.createElement(
          UpdateProcessor_default,
          {
            latest: latestVer,
            current: versionFluxflow,
            settings: systemSettings,
            onClose: () => setActiveView("chat"),
            onSuccess: () => {
              setMessages((prev) => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                  id: "update-success-" + Date.now(),
                  role: "system",
                  text: `**[UPDATE COMPLETED]** Flux Flow successfully updated to v${latestVer}.
 **Restart to see changes.**`,
                  isMeta: true
                }];
              });
              setActiveView("chat");
            },
            onUpdateSettings: (manager) => {
              setActiveView("updateManager");
            }
          }
        );
      case "terminalApproval":
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "white", paddingX: 2, paddingY: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "TERMINAL COMMAND OVERSIGHT"), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, null, "Agent requested to run: ", /* @__PURE__ */ React15.createElement(Text15, { color: "yellow", bold: true }, parseArgs(pendingApproval?.args || "{}").command || "Unknown Command"))), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
          CommandMenu,
          {
            title: "Risk Assessment Required",
            items: [
              { label: "Run", value: "allow" },
              { label: "Deny", value: "deny" }
            ],
            onSelect: (item) => {
              pendingApproval.resolve(item.value);
              setPendingApproval(null);
              setActiveView("chat");
            }
          }
        )));
      default:
        return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1, flexShrink: 0, width: "100%" }, showBtwBox && btwResponse && /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", paddingX: 2, paddingY: 1, width: "100%", marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Box14, { justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "INQUIRY RESPONSE"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "[ ESC to Close ]")), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1, width: "100%" }, /* @__PURE__ */ React15.createElement(CodeRenderer, { text: btwResponse, columns: terminalSize.columns - 6 }))), activeSubagents.filter((sa) => sa.status === "running").length > 0 && /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 2, paddingY: 0, width: "100%", marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Box14, { justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "ACTIVE SUBAGENTS")), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1, width: "100%" }, activeSubagents.filter((sa) => sa.status === "running").map((sa) => /* @__PURE__ */ React15.createElement(Box14, { key: sa.id, justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " \u2022 ", sa.title, " ", /* @__PURE__ */ React15.createElement(Text15, { color: "white", dimColor: true }, "(", sa.id, ")")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, "Executing: ", /* @__PURE__ */ React15.createElement(Text15, { color: "white", dimColor: true, bold: true }, sa.currentTool || "Active")))))), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 0, justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, null, statusText ? /* @__PURE__ */ React15.createElement(Box14, { gap: 1 }, /* @__PURE__ */ React15.createElement(build_default, null), /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, italic: true }, statusText.trimEnd()), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, activeTime > 0 ? `[${activeTime.toFixed(0)}s]` : "")) : /* @__PURE__ */ React15.createElement(Text15, { color: "white", italic: true }, input.length > 0 && escPressCount ? "Press ESC again to clear input" : hasPasteBlock ? "Press CTRL + O to expand" : "Waiting for input...")), /* @__PURE__ */ React15.createElement(Box14, null, wittyPhrase && /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, wittyPhrase), /* @__PURE__ */ React15.createElement(Text15, { color: "gray", dimColor: true }, " \u2503 ")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, tempModelOverride || activeModel))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { width: "100%", height: 1, overflow: "hidden" }, /* @__PURE__ */ React15.createElement(Text15, { color: "#555555" }, "\u2584".repeat(Math.max(1, terminalSize.columns)))), /* @__PURE__ */ React15.createElement(
          Box14,
          {
            backgroundColor: "#555555",
            paddingX: 1,
            paddingY: 0,
            width: "100%",
            flexDirection: "column"
          },
          /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "row", width: "100%", paddingY: 0 }, /* @__PURE__ */ React15.createElement(Box14, { flexShrink: 0, width: 4 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, isProcessing || isCompressing ? "\u2726  " : " \u276F  ")), /* @__PURE__ */ React15.createElement(Box14, { flexGrow: 1 }, /* @__PURE__ */ React15.createElement(Box14, { flexGrow: 1, position: "relative" }, input === "" && /* @__PURE__ */ React15.createElement(Box14, { position: "absolute", paddingLeft: 0 }, activeCommand && !isTerminalFocused ? /* @__PURE__ */ React15.createElement(Text15, { color: "yellow" }, isTerminalWaitingForInput ? "  Terminal is waiting for user input. Press TAB to interact" : "  Press TAB to interact with terminal...") : activeCommand && isTerminalFocused ? /* @__PURE__ */ React15.createElement(Text15, { color: "yellow", bold: true }, "  [ TERMINAL FOCUSED ] Type to interact, press TAB to exit...") : escPressCount === 1 ? /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "  Press ESC again to ", input.length > 0 ? "clear input" : "revert codebase to checkpoint", "...") : /* @__PURE__ */ React15.createElement(Text15, { color: "#cccccc" }, escPressed ? "  Press ESC again to cancel the request." : isCompressing ? "  Compressing session history, please wait..." : !isProcessing ? `  Send message, @file or /cmd ... (${terminalEnv.shortcut} for newline)` : "  Enter a prompt to steer the agent.")), /* @__PURE__ */ React15.createElement(
            MultilineInput,
            {
              key: `input-${inputKey}`,
              onPasteStateChange: setHasPasteBlock,
              focus: !isTerminalFocused && !isCompressing,
              showCursor: isAppFocused && !isCompressing,
              lastFocusEventTime: lastFocusEventTime.current,
              value: input,
              textStyle: { bold: true },
              columns: terminalSize.columns,
              onChange: (val) => {
                const cleanVal = val.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\\s*\n/g, "\n");
                setInput(cleanVal);
                setIsFilePickerDismissed(false);
              },
              onSubmit: handleSubmit,
              rows: 1,
              maxRows: 10,
              keyBindings: {
                submit: (key) => key.return && !key.shift && !key.ctrl,
                newline: (key) => key.return && key.shift || key.return && key.ctrl
              }
            }
          )))))
        ), /* @__PURE__ */ React15.createElement(Box14, { width: "100%", height: 1, overflow: "hidden" }, /* @__PURE__ */ React15.createElement(Text15, { color: "#555555" }, "\u2580".repeat(Math.max(1, terminalSize.columns))))));
    }
  };
  return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", width: "100%" }, showBridgePromo ? /* @__PURE__ */ React15.createElement(BridgePromo, { width: stdout?.columns || 80, height: stdout?.rows || 24, selectedIndex: promoSelectedIndex }) : /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, flexDirection: "column", width: "100%" }, /* @__PURE__ */ React15.createElement(Static, { key: `static-${clearKey}-${chatId}-${terminalSize.columns}-${terminalSize.rows}`, items: parsedBlocks.completed }, (block) => /* @__PURE__ */ React15.createElement(
    BlockItem,
    {
      key: block.key,
      block,
      columns: (stdout?.columns || 80) - 2,
      showFullThinking,
      aiProvider,
      version: versionFluxflow
    }
  ))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", paddingX: 1, paddingBottom: 0, width: "100%" }, (activeView === "chat" || ["ask", "approval", "terminalApproval"].includes(activeView)) && /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", width: "100%" }, parsedBlocks.active.map((block) => /* @__PURE__ */ React15.createElement(
    BlockItem,
    {
      key: block.key,
      block,
      columns: Math.max(20, (stdout?.columns || 80) - 2),
      showFullThinking,
      aiProvider,
      version: versionFluxflow
    }
  )), activeCommand && /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(TerminalBox, { command: activeCommand, output: execOutput, isFocused: isTerminalFocused, isPty: isActiveCommandPty, terminalHeight: terminalSize.rows }))), isInitializing ? /* @__PURE__ */ React15.createElement(Box14, { borderStyle: "double", borderColor: "grey", padding: 1, flexShrink: 0 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, "Starting Flux Flow...")) : !apiKey ? /* @__PURE__ */ React15.createElement(Box14, { borderStyle: "round", borderColor: "white", padding: 0, flexDirection: "column", flexShrink: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", bold: true }, "API KEY REQUIRED")), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, flexDirection: "column" }, setupStep === 0 ? /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, "Select your Preferred Provider:"), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(
    CommandMenu,
    {
      items: [
        { label: "Google (Free/Paid)", value: "Google" },
        { label: "Nvidia (Free/Paid)", value: "NVIDIA" },
        { label: "DeepSeek (Paid)", value: "DeepSeek" },
        { label: "OpenRouter (Free/Paid) [EXPERIMENTAL]", value: "OpenRouter" }
      ],
      onSelect: (item) => {
        setAiProvider(item.value);
        setSetupStep(1);
      }
    }
  ))) : /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, "Please enter your ", aiProvider, " API Key to initialize the agent (If billing is enabled set /settings \u2192 Others \u2192 API Strategy to use premium models. Set budget limit at /budgets.)."), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", bold: true }, " ", ">", " "), /* @__PURE__ */ React15.createElement(
    TextInput4,
    {
      value: tempKey,
      onChange: setTempKey,
      onSubmit: handleSetup,
      mask: "*"
    }
  )), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, "(Press ESC to go back to provider selection)")))), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, setupStep === 0 ? "(Use arrows to select and Enter to confirm)" : "(Press Enter to confirm and initialize)"))) : renderActiveView(), confirmExit && /* @__PURE__ */ React15.createElement(Box14, { borderStyle: "round", borderColor: "white", paddingX: 2, marginY: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "\u{1F534} EXIT CONFIRMATION: "), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, "Press "), /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, "CTRL + C"), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " again to exit (", exitCountdown, "s). Press "), /* @__PURE__ */ React15.createElement(Text15, { color: "gray", bold: true }, "ESC"), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, " to cancel.")), suggestions.length > 0 && (() => {
    const windowSize = 5;
    let startIdx = suggestionOffsetRef.current;
    if (selectedIndex < startIdx) {
      startIdx = selectedIndex;
    } else if (selectedIndex >= startIdx + windowSize) {
      startIdx = selectedIndex - windowSize + 1;
    }
    startIdx = Math.max(0, Math.min(startIdx, Math.max(0, suggestions.length - windowSize)));
    suggestionOffsetRef.current = startIdx;
    const visible = suggestions.slice(startIdx, startIdx + windowSize);
    const remaining = suggestions.length - (startIdx + visible.length);
    return /* @__PURE__ */ React15.createElement(
      Box14,
      {
        flexDirection: "column",
        width: "100%",
        marginBottom: 1
      },
      /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginBottom: 0, justifyContent: "space-between", width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true }, suggestions[0]?.cmd?.startsWith("@") ? "FILE SUGGESTIONS" : "COMMAND SUGGESTIONS"), suggestions[0]?.cmd?.startsWith("@") ? /* @__PURE__ */ React15.createElement(Text15, { color: "gray", italic: true }, "(Use '#Lstart-Lend' to specify line numbers)") : input.startsWith("/model") && apiTier === "Free" ? (() => {
        let url = "https://aistudio.google.com/billing";
        let label2 = "billing";
        if (aiProvider === "DeepSeek") {
          url = "https://platform.deepseek.com/usage";
          label2 = "billing";
        } else if (aiProvider === "OpenRouter") {
          url = "https://openrouter.ai/settings/profile";
          label2 = "profile";
        } else if (aiProvider === "NVIDIA") {
          url = "https://build.nvidia.com/settings/api-keys";
          label2 = "billing";
        }
        return /* @__PURE__ */ React15.createElement(Text15, { color: "gray", dimColor: true, italic: true }, "Paid API Strategy has more models. Configure ", /* @__PURE__ */ React15.createElement(Text15, { color: "cyan", underline: true }, `\x1B]8;;${url}\x07${label2}\x1B]8;;\x07`), " & /settings");
      })() : null),
      visible.map((s, i) => {
        const actualIdx = startIdx + i;
        const isActive = actualIdx === selectedIndex;
        const isGemmaDisabled = s.cmd === "gemma-4-31b-it" && apiTier !== "Free";
        return /* @__PURE__ */ React15.createElement(
          Box14,
          {
            key: s.cmd,
            flexDirection: "row",
            backgroundColor: isActive ? "#2a2a2a" : void 0,
            paddingX: 1
          },
          /* @__PURE__ */ React15.createElement(Box14, { width: 3 }, /* @__PURE__ */ React15.createElement(Text15, { color: isActive ? "white" : "gray", bold: isActive }, isActive ? " \u276F" : "  ")),
          /* @__PURE__ */ React15.createElement(Box14, { width: 55 }, /* @__PURE__ */ React15.createElement(
            Text15,
            {
              color: isGemmaDisabled ? "gray" : isActive ? "white" : "grey",
              bold: isActive
            },
            s.cmd?.startsWith("@[") && s.cmd?.endsWith("]") ? (() => {
              const pathPart = s.cmd.slice(2, -1);
              const parts = pathPart.split(/[/\\]/);
              return parts[parts.length - 1];
            })() : s.cmd
          )),
          /* @__PURE__ */ React15.createElement(Box14, { flexGrow: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: `${!isActive ? "gray" : "white"}`, italic: true }, s.desc))
        );
      }),
      suggestions.length > 5 && /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, height: 1 }, remaining > 0 ? /* @__PURE__ */ React15.createElement(Text15, { color: "gray", dimColor: true, italic: true }, "   ... (", remaining, " more commands available)") : /* @__PURE__ */ React15.createElement(Text15, { color: "gray", dimColor: true, italic: true }, "   (End of list)"))
    );
  })(), /* @__PURE__ */ React15.createElement(Box14, { flexShrink: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(
    StatusBar_default,
    {
      mode,
      thinkingLevel,
      tokens: sessionStats.tokens,
      tokensTotal: chatTokens,
      chatId,
      isMemoryEnabled: systemSettings.memory,
      apiTier,
      aiProvider,
      activeModel
    }
  )), activeView === "exit" && (() => {
    const wallTimeMs = Date.now() - SESSION_START_TIME;
    const totalTools = sessionToolSuccess + sessionToolFailure;
    const successRate = totalTools > 0 ? (sessionToolSuccess / totalTools * 100).toFixed(1) : "0.0";
    const agentActiveMs = sessionApiTime + sessionToolTime;
    const apiPercent = agentActiveMs > 0 ? (sessionApiTime / agentActiveMs * 100).toFixed(1) : "0.0";
    const toolPercent = agentActiveMs > 0 ? (sessionToolTime / agentActiveMs * 100).toFixed(1) : "0.0";
    return /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", paddingX: 3, paddingY: 1, borderColor: "grey", width: Math.min(100, (stdout?.columns || 100) - 2), marginTop: 0, marginBottom: 0 }, /* @__PURE__ */ React15.createElement(Box14, { marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text15, { bold: true }, gradient2(["blue", "purple"])("Agent powering down. Goodbye!"))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column" }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "Interaction Summary"), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Session ID:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, chatId)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Tool Calls:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionToolSuccess + sessionToolFailure + sessionToolDenied, " ( ", /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "\u2713 ", sessionToolSuccess), " ", /* @__PURE__ */ React15.createElement(Text15, { color: "yellow" }, "\u2298 ", sessionToolDenied), " ", /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "\u2715 ", sessionToolFailure), " )")), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Success Rate:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, successRate, "%")), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Code Changes:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, /* @__PURE__ */ React15.createElement(Text15, { color: "green" }, "+", linesAdded), " ", /* @__PURE__ */ React15.createElement(Text15, { color: "red" }, "-", linesRemoved))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Tokens Consumed:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalTokens))), sessionTotalTokens > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 18 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Input Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalTokens - sessionTotalCandidateTokens))), sessionTotalCachedTokens > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 4 }, /* @__PURE__ */ React15.createElement(Box14, { width: 16 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Cached:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalCachedTokens))), sessionTotalCandidateTokens > 0 && /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 18 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Output Tokens:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatTokens(sessionTotalCandidateTokens)))), sessionImageCount > 0 && /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Images Made:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, sessionImageCount)), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Image Credits:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, Number(((sessionImageCredits || 0) * 1e3).toFixed(0)), " credits")))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, "Performance"), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1 }, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Wall Time:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(wallTimeMs))), /* @__PURE__ */ React15.createElement(Box14, null, /* @__PURE__ */ React15.createElement(Box14, { width: 20 }, /* @__PURE__ */ React15.createElement(Text15, { color: "blue" }, "Agent Active:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(agentActiveMs))), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 18 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB API Time:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(sessionApiTime), " (", apiPercent, "%)")), /* @__PURE__ */ React15.createElement(Box14, { marginLeft: 2 }, /* @__PURE__ */ React15.createElement(Box14, { width: 18 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "\xBB Tool Time:")), /* @__PURE__ */ React15.createElement(Text15, { color: "white" }, formatMsDuration(sessionToolTime), " (", toolPercent, "%)"))));
  })())));
}
var shouldClearValue, getPrefilledValue, getIDEName, getIDEDirName, getKeybindingsPath, parseJsonc, hasShiftEnterBinding, getPromoOptions, BridgePromo, SESSION_START_TIME, CHANGELOG_URL, DOCS_URL, linesAdded, linesRemoved, packageJsonPath, packageJson, versionFluxflow, updatedOn, ResolutionModal, parseAgentText, getProjectFiles, cachedShortcut;
var init_app = __esm({
  async "src/app.jsx"() {
    init_build();
    init_MultilineInput();
    init_ChatLayout();
    init_StatusBar();
    init_CommandMenu();
    await init_SettingsMenu();
    init_ProfileForm();
    init_AskUserModal();
    init_secrets();
    await init_ai();
    init_subagent_state();
    init_settings();
    init_history();
    init_ResumeModal();
    init_MemoryModal();
    await init_UpdateProcessor();
    init_ParserDownloadModal();
    init_revert();
    init_gemini_quotes();
    init_witty_phrases();
    init_RevertModal();
    init_usage();
    init_TerminalBox();
    init_arg_parser();
    init_paths();
    init_terminal();
    await init_exec_command();
    init_setup();
    init_text();
    init_editor();
    shouldClearValue = (val) => {
      const s = String(val);
      return s.startsWith("999") && s.endsWith("9");
    };
    getPrefilledValue = (val) => {
      if (val === void 0 || val === null || val === 0 || shouldClearValue(val)) {
        return "";
      }
      return String(val);
    };
    getIDEName = () => {
      const termProgram = (process.env.TERM_PROGRAM || "").toLowerCase();
      if (process.env.WT_SESSION) return "Windows Terminal";
      const inEnvVars = (target) => {
        const query = target.toLowerCase();
        for (const [key, val] of Object.entries(process.env)) {
          if (["PATH", "PWD", "CWD", "PS1", "LS_COLORS", "PROMPT"].includes(key)) continue;
          if (String(val).toLowerCase().includes(query)) return true;
        }
        return false;
      };
      if (termProgram === "cursor" || process.env.CURSOR_SETTINGS_DIR || inEnvVars("cursor")) return "Cursor";
      if (termProgram === "windsurf" || inEnvVars("windsurf")) return "Windsurf";
      if (inEnvVars("antigravity")) return "Antigravity";
      if (termProgram === "trae" || inEnvVars("trae")) return "Trae";
      if (termProgram === "codium" || inEnvVars("codium") || inEnvVars("vscode-oss")) return "VSCodium";
      if (inEnvVars("positron")) return "Positron";
      if (termProgram === "vscode-insiders" || inEnvVars("insiders")) return "VS Code Insiders";
      if (termProgram === "vscode" || process.env.VSCODE_GIT_IPC_HANDLE || inEnvVars("vscode")) return "VS Code";
      if (process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS || inEnvVars("intellij")) return "JetBrains";
      return "Terminal";
    };
    getIDEDirName = (ideName) => {
      switch (ideName) {
        case "VS Code":
          return "Code";
        case "VS Code Insiders":
          return "Code - Insiders";
        case "Antigravity":
          return "Antigravity IDE";
        default:
          return ideName;
      }
    };
    getKeybindingsPath = (ideName) => {
      const dirName = getIDEDirName(ideName);
      const home = os4.homedir();
      if (process.platform === "win32") {
        const appData = process.env.APPDATA;
        if (!appData) return null;
        return path20.join(appData, dirName, "User", "keybindings.json");
      } else if (process.platform === "darwin") {
        return path20.join(home, "Library", "Application Support", dirName, "User", "keybindings.json");
      } else {
        return path20.join(home, ".config", dirName, "User", "keybindings.json");
      }
    };
    parseJsonc = (content) => {
      const clean = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
      return JSON.parse(clean);
    };
    hasShiftEnterBinding = (bindings) => {
      if (!Array.isArray(bindings)) return false;
      return bindings.some(
        (b) => b && typeof b.key === "string" && b.key.toLowerCase().replace(/\s+/g, "") === "shift+enter" && b.command === "workbench.action.terminal.sendSequence" && b.args && b.args.text === "\x1B[13;2u" && typeof b.when === "string" && b.when.includes("terminalFocus")
      );
    };
    getPromoOptions = (ideName) => {
      const isStandardVSCode = ideName === "VS Code";
      const options = [];
      if (isStandardVSCode) {
        options.push({ label: "Install Manually (VSIX)", url: "https://github.com/KushalRoyChowdhury/fluxflow-cli/releases" });
        options.push({ label: "Install from VS Code Marketplace", url: "https://marketplace.visualstudio.com/items?itemName=fluxflow-cli.fluxflow-cli-companion" });
      } else {
        options.push({ label: `Download for ${ideName} (GitHub)`, url: "https://github.com/KushalRoyChowdhury/fluxflow-cli/releases" });
      }
      options.push({ label: "Continue to CLI only", action: "dismiss" });
      return options;
    };
    BridgePromo = ({ width, height, selectedIndex }) => {
      const ideName = getIDEName();
      const options = getPromoOptions(ideName);
      return /* @__PURE__ */ React15.createElement(
        Box14,
        {
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width,
          height
        },
        /* @__PURE__ */ React15.createElement(Box14, { marginBottom: 1, width: Math.min(80, width - 4), justifyContent: "flex-start" }, /* @__PURE__ */ React15.createElement(Text15, null, getFluxLogo(versionFluxflow))),
        /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "double", borderColor: "grey", paddingX: 3, paddingY: 1, width: Math.min(80, width - 4) }, /* @__PURE__ */ React15.createElement(Text15, { bold: true, color: "white", textAlign: "center" }, "\u{1F680} UPGRADE YOUR WORKFLOW"), /* @__PURE__ */ React15.createElement(Box14, { marginY: 1, flexDirection: "column", alignItems: "left" }, /* @__PURE__ */ React15.createElement(Text15, null, "You're in ", /* @__PURE__ */ React15.createElement(Text15, { bold: true, color: "cyan" }, ideName), ", but the ", /* @__PURE__ */ React15.createElement(Text15, { bold: true, color: "white" }, "FluxFlow-CLI Companion"), " is not installed."), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Real-time IDE context & Error Resolution"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Auto-open files created by agent"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Native DIFFing for AI edits"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Direct IDE context sharing"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Surgical Diagnostic Sync"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Native Right-Click \u276F Chat integration"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Live Status in IDE"), /* @__PURE__ */ React15.createElement(Text15, { color: "gray" }, "  \u2705 Clickable terminal-to-code links"))), /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", marginTop: 1 }, options.map((opt, i) => /* @__PURE__ */ React15.createElement(Box14, { key: i }, /* @__PURE__ */ React15.createElement(Text15, { color: selectedIndex === i ? "yellow" : "white", bold: selectedIndex === i }, selectedIndex === i ? " \u276F " : "   ", opt.label)))), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1, alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ React15.createElement(Text15, { dimColor: true, italic: true }, "(Use arrows to navigate, Enter to select)")))
      );
    };
    SESSION_START_TIME = Date.now();
    CHANGELOG_URL = "https://fluxflow-cli.onrender.com/changelog";
    DOCS_URL = "https://fluxflow-cli.onrender.com/";
    linesAdded = 0;
    linesRemoved = 0;
    packageJsonPath = path20.join(path20.dirname(fileURLToPath(import.meta.url)), "../package.json");
    packageJson = JSON.parse(fs22.readFileSync(packageJsonPath, "utf8"));
    versionFluxflow = packageJson.version;
    updatedOn = packageJson.date || "2026-05-20";
    ResolutionModal = ({ data, onResolve, onEdit }) => /* @__PURE__ */ React15.createElement(Box14, { flexDirection: "column", borderStyle: "round", borderColor: "grey", padding: 0, width: "100%" }, /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "white", bold: true, underline: true }, data.startsWith("/btw") ? "QUESTION" : "STEERING HINT", " RESOLUTION")), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, null, "The agent already finished the task before your ", data.startsWith("/btw") ? "question" : "hint", " was consumed.")), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 1, backgroundColor: "#222", paddingX: 2, width: "100%" }, /* @__PURE__ */ React15.createElement(Text15, { italic: true, color: "gray" }, '"', data.replace("/btw", "").trim(), '"')), /* @__PURE__ */ React15.createElement(Box14, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React15.createElement(Text15, { color: "grey" }, "How would you like to proceed?")), /* @__PURE__ */ React15.createElement(Box14, { marginTop: 0 }, /* @__PURE__ */ React15.createElement(
      CommandMenu,
      {
        title: "Select Action",
        items: [
          { label: "Send Anyway", value: "send" },
          { label: "Edit Prompt", value: "edit" }
        ],
        onSelect: (val) => {
          if (val === "send") onResolve(data);
          else onEdit(data);
        }
      }
    )));
    parseAgentText = (text) => {
      const blocks = [];
      const toolRegex = /\[\s*(?:tool:functions\.|agent:generalist\.)([a-z0-9_]+)\s*\(/gi;
      let lastIdx = 0;
      let match;
      while ((match = toolRegex.exec(text)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;
        let closingParenIdx = -1;
        for (let i = startIdx; i < text.length; i++) {
          const char = text[i];
          if (inString) {
            if (char === inString) {
              let backslashCount = 0;
              for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) {
                backslashCount++;
              }
              if (backslashCount % 2 === 0) {
                inString = null;
              }
            }
          } else {
            if (char === '"' || char === "'" || char === "`") {
              inString = char;
            } else if (char === "(") {
              balance++;
            } else if (char === ")") {
              balance--;
              if (balance === 0) {
                closingParenIdx = i;
                let j = i + 1;
                while (j < text.length && /\s/.test(text[j])) j++;
                if (j < text.length && text[j] === "]") {
                  endIdx = j;
                  break;
                }
              }
            }
          }
        }
        if (endIdx !== -1) {
          const beforeText = text.substring(lastIdx, match.index);
          if (beforeText.trim()) {
            blocks.push({ type: "output", content: beforeText });
          }
          const finalArgsText = text.substring(startIdx + 1, closingParenIdx);
          blocks.push({
            type: "tool",
            toolName: toolName.trim(),
            args: finalArgsText.trim()
          });
          lastIdx = endIdx + 1;
          toolRegex.lastIndex = lastIdx;
        } else {
          break;
        }
      }
      if (lastIdx < text.length) {
        const remainingText = text.substring(lastIdx);
        if (remainingText.trim()) {
          blocks.push({ type: "output", content: remainingText });
        }
      }
      return blocks;
    };
    getProjectFiles = /* @__PURE__ */ (() => {
      let cachedFiles = null;
      let lastScanTime = 0;
      return (dir) => {
        const now = Date.now();
        if (cachedFiles && now - lastScanTime < 5e3) {
          return cachedFiles;
        }
        const fileList = [];
        const scan = (currentDir) => {
          try {
            const files = fs22.readdirSync(currentDir);
            for (const file of files) {
              if (["node_modules", ".git", ".gemini", "dist", "build", ".next", ".cache", "out"].includes(file)) {
                continue;
              }
              const filePath = path20.join(currentDir, file);
              const stat = fs22.statSync(filePath);
              if (stat.isDirectory()) {
                scan(filePath);
              } else {
                fileList.push({
                  name: file,
                  relativePath: path20.relative(process.cwd(), filePath)
                });
              }
            }
          } catch (e) {
          }
        };
        scan(dir);
        cachedFiles = fileList;
        lastScanTime = now;
        return fileList;
      };
    })();
    cachedShortcut = "\\ + Enter";
  }
});

// src/cli.jsx
import { spawn as spawn3 } from "child_process";
import { fileURLToPath as fileURLToPath2 } from "url";
import os5 from "os";
var totalSystemRamBytes = os5.totalmem();
var totalSystemRamMB = totalSystemRamBytes / (1024 * 1024);
var SAFETY_MARGIN = 0.5;
var calculatedLimit = Math.floor(totalSystemRamMB * SAFETY_MARGIN);
var _rawArgs = process.argv.slice(2);
var _allocIdx = _rawArgs.indexOf("--allocation");
var _allocValue = _allocIdx !== -1 ? parseInt(_rawArgs[_allocIdx + 1], 10) : NaN;
if (!isNaN(_allocValue) && _allocValue < 64) {
  console.error(`
[ERROR] Allocation value '${_allocValue} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`);
  process.exit(1);
}
var _maxAllowed = Math.floor(totalSystemRamMB * 0.75);
var HEAP_LIMIT = !isNaN(_allocValue) && _allocValue > 0 ? Math.min(_allocValue, _maxAllowed) : Math.max(1536, Math.min(32768, calculatedLimit));
var isBundled = fileURLToPath2(import.meta.url).endsWith(".js");
if (isBundled && !process.execArgv.some((arg) => arg.includes("max-old-space-size"))) {
  if (!Number.isNaN(_allocValue)) {
    console.log(`
[MEMORY] Starting with: '${_allocValue > _maxAllowed ? _maxAllowed : _allocValue} MB' Allocation${_allocValue > _maxAllowed ? " (Max allowed: '" + _maxAllowed + " MB')" : ""}. Please Wait...`);
    await new Promise((resolve) => setTimeout(resolve, 5e3));
  }
  const cp = spawn3(process.execPath, [
    `--max-old-space-size=${HEAP_LIMIT}`,
    `--expose-gc`,
    `--max-semi-space-size=1`,
    fileURLToPath2(import.meta.url),
    ...process.argv.slice(2)
  ], { stdio: "inherit" });
  cp.on("exit", (code) => process.exit(code || 0));
} else {
  const args = process.argv.slice(2);
  const isHelpCommands = args.includes("--help") && args[args.indexOf("--help") + 1] === "commands";
  const isHelp = args.includes("--help") && !isHelpCommands;
  const isVersion = args.includes("--version") || args.includes("-v");
  const isUpdate = args[0] === "--update";
  if (isVersion || isHelp || isHelpCommands || isUpdate) {
    const fs23 = await import("fs");
    const path21 = await import("path");
    const { fileURLToPath: fileURLToPath3 } = await import("url");
    const packageJsonPath2 = path21.join(path21.dirname(fileURLToPath3(import.meta.url)), "../package.json");
    const packageJson2 = JSON.parse(fs23.readFileSync(packageJsonPath2, "utf8"));
    const versionFluxflow2 = packageJson2.version;
    if (isVersion) {
      console.log(`v${versionFluxflow2}`);
      process.exit(0);
    }
    if (isHelp) {
      console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow>                   Set startup mode (flux: Agent / flow: Chat)
  --model <model_name>                 Set startup AI model
  --key <key@provider>                 Set API key and provider
  --provider <google|deepseek|openrouter> Override default provider
  --thinking <Fast|Low|Medium|High|xHigh> Set startup thinking level
  --memory <on|off>                    Toggle memory system
  --resume <session_id>                Resume a previous session
  --allocation <mb>                    Override Node.js max-old-space-size in MB (default: auto)
  --package <npm|pnpm|yarn|bun>        Set package manager for updates
  --auto-del <1d|7d|30d>               Set history auto-deletion timeframe
  --auto-exec <on|off>                 Toggle permission for autonomous command execution
  --yolo <on|off>                      Same as --auto-exec
  --external-access <on|off>           Toggle permission for file reads outside CWD
  -v, --version                        Show installed version
  --help                               Show this help menu
  --help commands                      Show available /commands
  --playground                         Launch in Playground mode (fixed session, CWD: DATA_DIR/playground)
  --update check                       Check for new updates
  --update check latest                Show the latest version available on npm
  --update latest                      Update the app to the latest version`);
      process.exit(0);
    }
    if (isHelpCommands) {
      console.log(`FluxFlow Chat /Commands:
  /quit                                    Exit and shutdown Flux
  /help                                    Show help menu
  /clear                                   Clear terminal screen
  /resume                                  Load previous session
  /compress                                Summarize and compress chat history
  /revert                                  Revert codebase back to a checkpoint
  /save                                    Force save current chat
  /export                                  Export current chat in a .txt file
  /chats                                   List all chat sessions
  /btw <question>                          Send raw inquiry to the agent mid-turn
  /image setup key <default|custom>        Configure image API key strategy
  /budget                                  Set or View budget limits
  /image setup quality <low...premium>     Configure default image generation quality
  /image stats                             Show image quota stats
  /mode <flux|flow>                        Toggle Flux/Flow modes
  /thinking <Fast|Low|Medium|High|xHigh>   Set AI reasoning depth
  /model <model_name>                      Switch Model for Agent
  /settings                                Configure system preferences
  /key                                     Manage API keys
  /profile                                 Edit developer persona
  /memory                                  Manage agent memory
  /stats                                   Show session usage
  /reset                                   Wipe all project data
  /about                                   Project info & credits
  /changelog                               View latest updates
  /docs                                    View documentation
  /fluxflow init                           Create FluxFlow.md template
  /update check                            Check for new version
  /update latest                           Install latest release`);
      process.exit(0);
    }
    if (isUpdate) {
      const subArg = args[1];
      if (subArg === "check") {
        const checkLatest = args[2] === "latest";
        try {
          const response = await fetch("https://registry.npmjs.org/fluxflow-cli", { cache: "no-store" });
          const data = await response.json();
          const latestVersion = data["dist-tags"]?.latest;
          if (!latestVersion) {
            console.error("Error: Could not retrieve latest version.");
            process.exit(1);
          }
          if (checkLatest) {
            console.log(`Latest version: v${latestVersion}`);
          } else {
            if (latestVersion !== versionFluxflow2) {
              console.log(`A new version of FluxFlow is available: v${latestVersion} (current: v${versionFluxflow2}). Run "fluxflow --update latest" to upgrade.`);
            } else {
              console.log(`FluxFlow is up to date (v${versionFluxflow2}).`);
            }
          }
        } catch (err) {
          console.error("Error checking for updates:", err.message);
          process.exit(1);
        }
        process.exit(0);
      } else if (subArg === "latest") {
        console.log("Checking latest version and settings...");
        try {
          const response = await fetch("https://registry.npmjs.org/fluxflow-cli", { cache: "no-store" });
          const data = await response.json();
          const latestVersion = data["dist-tags"]?.latest;
          if (!latestVersion) {
            console.error("Error: Could not retrieve latest version.");
            process.exit(1);
          }
          if (latestVersion === versionFluxflow2) {
            console.log(`FluxFlow is already up to date (v${versionFluxflow2}).`);
            process.exit(0);
          }
          const promptPackageManager = async () => {
            const React17 = (await import("react")).default;
            const { useState: useState15 } = React17;
            const { render: render2, Box: Box15, Text: Text16 } = await import("ink");
            const SelectInput3 = (await import("ink-select-input")).default;
            const TextInput5 = (await import("ink-text-input")).default;
            return new Promise((resolve) => {
              const items = [
                { label: "NPM", value: "npm" },
                { label: "PNPM", value: "pnpm" },
                { label: "Yarn", value: "yarn" },
                { label: "Bun", value: "bun" },
                { label: "Custom Command", value: "custom" }
              ];
              const CustomItem2 = ({ label: label2, isSelected }) => {
                return /* @__PURE__ */ React17.createElement(Box15, { width: "100%" }, /* @__PURE__ */ React17.createElement(Text16, { bold: isSelected }, "\u2514\u2500 ", isSelected ? "\x1B[32m\u25CF\x1B[0m" : "\u25CB", " ", label2));
              };
              let unmountFn;
              const PromptComponent = () => {
                const [step, setStep] = useState15("select");
                const [customCommand2, setCustomCommand] = useState15("");
                const handleSelect = (item) => {
                  if (item.value === "custom") {
                    setStep("custom");
                  } else {
                    cleanupAndResolve({ manager: item.value });
                  }
                };
                const handleCustomSubmit = (value) => {
                  cleanupAndResolve({ manager: "custom", customCommand: value });
                };
                if (step === "custom") {
                  return /* @__PURE__ */ React17.createElement(Box15, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React17.createElement(Box15, { marginBottom: 1 }, /* @__PURE__ */ React17.createElement(Text16, { color: "magenta", bold: true }, "\u{1F527} Enter custom update command:")), /* @__PURE__ */ React17.createElement(Box15, { flexDirection: "row" }, /* @__PURE__ */ React17.createElement(Text16, { color: "cyan", bold: true }, "   \u276F "), /* @__PURE__ */ React17.createElement(
                    TextInput5,
                    {
                      value: customCommand2,
                      onChange: setCustomCommand,
                      onSubmit: handleCustomSubmit
                    }
                  )), /* @__PURE__ */ React17.createElement(Box15, { marginTop: 1 }, /* @__PURE__ */ React17.createElement(Text16, { color: "gray", dimColor: true, italic: true }, "   (Press Enter to confirm)")));
                }
                return /* @__PURE__ */ React17.createElement(Box15, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React17.createElement(Box15, { marginBottom: 1 }, /* @__PURE__ */ React17.createElement(Text16, { color: "magenta", bold: true }, "\u{1F4E6} Select a package manager for the update:")), /* @__PURE__ */ React17.createElement(
                  SelectInput3,
                  {
                    items,
                    onSelect: handleSelect,
                    itemComponent: CustomItem2,
                    indicatorComponent: () => null
                  }
                ));
              };
              const cleanupAndResolve = (val) => {
                if (unmountFn) unmountFn();
                resolve(val);
              };
              const { unmount } = render2(/* @__PURE__ */ React17.createElement(PromptComponent, null));
              unmountFn = unmount;
            });
          };
          let manager;
          let customCommand = "";
          let settings;
          try {
            const { loadSettings: loadSettings2 } = await Promise.resolve().then(() => (init_settings(), settings_exports));
            settings = await loadSettings2();
            manager = settings?.systemSettings?.updateManager || settings?.updateManager;
          } catch (e) {
          }
          if (true) {
            const result = await promptPackageManager();
            manager = result.manager;
            customCommand = result.customCommand;
          }
          let command = "";
          if (manager === "pnpm") command = `pnpm add -g fluxflow-cli@${latestVersion}`;
          else if (manager === "bun") command = `bun add -g fluxflow-cli@${latestVersion}`;
          else if (manager === "yarn") command = `yarn global add fluxflow-cli@${latestVersion}`;
          else if (manager === "custom") command = customCommand || settings?.customUpdateCommand || `npm install -g fluxflow-cli@${latestVersion}`;
          else command = `npm install -g fluxflow-cli@${latestVersion}`;
          console.log(`Updating FluxFlow to v${latestVersion} using ${manager}...`);
          console.log(`Running: ${command}`);
          const { execSync: execSync2 } = await import("child_process");
          execSync2(command, { stdio: "inherit" });
          console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${latestVersion}.\x1B[0m`);
        } catch (err) {
          console.error("\x1B[31m\u274C Update failed:\x1B[0m", err.message);
          process.exit(1);
        }
        process.exit(0);
      } else {
        console.error("Unknown update command. Available options: --update check, --update check latest, --update latest");
        process.exit(1);
      }
    }
  }
  const { default: React16 } = await import("react");
  const { render } = await import("ink");
  const { default: App2 } = await init_app().then(() => app_exports);
  process.env.NODE_NO_WARNINGS = "1";
  const silentPatterns = [
    "cuimp",
    "Found existing binary",
    "Binary verified",
    "curl.exe not found",
    "Falling back to .bat file",
    "DeprecationWarning"
  ];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const isNoise = (args2) => {
    const msg = args2.map(String).join(" ");
    return silentPatterns.some((p) => msg.includes(p));
  };
  console.log = (...args2) => !isNoise(args2) && originalLog(...args2);
  console.warn = (...args2) => !isNoise(args2) && originalWarn(...args2);
  console.error = (...args2) => !isNoise(args2) && originalError(...args2);
  process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
  if (process.stdout.isTTY) {
    process.stdout.write("\x1B]0;FluxFlow\x07");
    process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07");
    process.stdout.write("\x1B[?2004h");
  }
  const disableBracketedPaste = () => {
    if (process.stdout.isTTY) {
      process.stdout.write("\x1B[?2004l");
    }
  };
  process.on("exit", disableBracketedPaste);
  ["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) => {
    process.once(sig, () => {
      disableBracketedPaste();
      process.exit(0);
    });
  });
  if (args.includes("--playground")) {
    const originalCwd = process.cwd();
    process.argv.push("--original-cwd", originalCwd);
    const { DATA_DIR: DATA_DIR2 } = await Promise.resolve().then(() => (init_paths(), paths_exports));
    const pathMod = await import("path");
    const fsMod = await import("fs-extra");
    const playgroundDir = pathMod.default.join(DATA_DIR2, "playground");
    try {
      fsMod.default.ensureDirSync(playgroundDir);
      process.chdir(playgroundDir);
    } catch (e) {
    }
  }
  render(/* @__PURE__ */ React16.createElement(App2, { args: process.argv.slice(2) }), { exitOnCtrlC: false });
}
