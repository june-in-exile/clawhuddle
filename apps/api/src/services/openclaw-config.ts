import { PROVIDERS } from '@clawhuddle/shared';

// Channel plugins that have working dependencies in the Docker image.
// Excluded: matrix, nostr, tlon, twitch (missing npm modules in OpenClaw image)
const CHANNEL_PLUGINS = [
  'telegram',
  'whatsapp',
  'discord',
  'slack',
  'signal',
  'imessage',
  'irc',
  'googlechat',
  'msteams',
  'mattermost',
  'line',
  'feishu',
  'zalo',
  'zalouser',
];

export interface ChannelTokens {
  telegram?: string;
  discord?: string;
  slack?: string;
}

export interface OpenClawConfig {
  meta: {
    lastTouchedVersion: string;
    lastTouchedAt: string;
  };
  commands: {
    native: string;
    nativeSkills: string;
    config: boolean;
  };
  gateway: {
    mode: string;
    port: number;
    bind: string;
    controlUi: {
      enabled: boolean;
      allowInsecureAuth: boolean;
    };
    auth: {
      mode: string;
      token: string;
    };
    trustedProxies?: string[];
  };
  agents?: {
    defaults: {
      model: { primary: string; fallbacks?: string[] };
      models: Record<string, Record<string, never>>;
    };
  };
  channels?: Record<string, { enabled: boolean; botToken: string; dmPolicy?: string; allowFrom?: string[] }>;
  plugins: {
    entries: Record<string, { enabled: boolean }>;
  };
}

export function generateOpenClawConfig(options: {
  port: number;
  token: string;
  enabledChannels?: string[];
  activeProviderIds?: string[];
  channelTokens?: ChannelTokens;
}): OpenClawConfig {
  const { port, token } = options;
  const channels = options.enabledChannels ?? CHANNEL_PLUGINS;

  const pluginEntries: Record<string, { enabled: boolean }> = {};
  for (const ch of channels) {
    pluginEntries[ch] = { enabled: true };
  }

  const config: OpenClawConfig = {
    meta: {
      lastTouchedVersion: '2026.2.17',
      lastTouchedAt: new Date().toISOString(),
    },
    commands: {
      native: 'auto',
      nativeSkills: 'auto',
      config: true,
    },
    gateway: {
      mode: 'local',
      port,
      bind: 'lan',
      controlUi: {
        enabled: true,
        allowInsecureAuth: true,
      },
      auth: {
        mode: 'token',
        token,
      },
      trustedProxies: ['172.16.0.0/12', '10.0.0.0/8', '192.168.0.0/16'],
    },
    plugins: {
      entries: pluginEntries,
    },
  };

  // Set default model based on active providers so OpenClaw doesn't
  // fall back to Anthropic when only another provider's key exists
  const activeProviders = (options.activeProviderIds ?? [])
    .map((id) => PROVIDERS.find((p) => p.id === id))
    .filter(Boolean) as typeof PROVIDERS;

  if (activeProviders.length > 0) {
    const models: Record<string, Record<string, never>> = {};
    for (const p of activeProviders) {
      models[p.defaultModel] = {};
    }
    const primary = activeProviders[0].defaultModel;
    const fallbacks = activeProviders.slice(1).map((p) => p.defaultModel);

    config.agents = {
      defaults: {
        model: { primary, ...(fallbacks.length > 0 ? { fallbacks } : {}) },
        models,
      },
    };
  }

  // Configure channel tokens (e.g. Telegram bot token)
  const ct = options.channelTokens;
  if (ct) {
    const channelsCfg: NonNullable<OpenClawConfig['channels']> = {};
    if (ct.telegram) {
      channelsCfg.telegram = { enabled: true, botToken: ct.telegram, dmPolicy: 'pairing' };
    }
    if (ct.discord) {
      channelsCfg.discord = { enabled: true, botToken: ct.discord };
    }
    if (ct.slack) {
      channelsCfg.slack = { enabled: true, botToken: ct.slack };
    }
    if (Object.keys(channelsCfg).length > 0) {
      config.channels = channelsCfg;
    }
  }

  return config;
}
