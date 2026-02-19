// All available channel plugin IDs in OpenClaw
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
  'nostr',
  'matrix',
  'line',
  'feishu',
  'twitch',
  'tlon',
  'zalo',
  'zalouser',
];

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
    auth: {
      mode: string;
      token: string;
    };
    trustedProxies?: string[];
  };
  controlUi: {
    allowInsecureAuth: boolean;
  };
  plugins: {
    entries: Record<string, { enabled: boolean }>;
  };
}

export function generateOpenClawConfig(options: {
  port: number;
  token: string;
  enabledChannels?: string[];
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
      auth: {
        mode: 'token',
        token,
      },
      trustedProxies: ['172.16.0.0/12', '10.0.0.0/8', '192.168.0.0/16'],
    },
    controlUi: {
      allowInsecureAuth: true,
    },
    plugins: {
      entries: pluginEntries,
    },
  };

  return config;
}
