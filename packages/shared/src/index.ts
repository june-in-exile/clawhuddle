// === Tier System ===

export type OrgTier = 'free' | 'pro' | 'enterprise';

export const TIER_LIMITS: Record<OrgTier, number> = {
  free: 5,
  pro: 20,
  enterprise: Infinity,
};

export const TIER_INFO: Record<OrgTier, { label: string; price: string; description: string }> = {
  free: { label: 'Free', price: '$0/mo', description: 'Up to 5 members' },
  pro: { label: 'Pro', price: '$10/mo', description: 'Up to 20 members' },
  enterprise: { label: 'Enterprise', price: 'Custom', description: 'Unlimited members' },
};

// === Database Row Types ===

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: OrgTier;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'disabled';
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'deploying' | 'provisioning' | null;
  gateway_token: string | null;
  gateway_subdomain: string | null;
  joined_at: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  last_login: string | null;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  type: 'mandatory' | 'optional' | 'restricted';
  path: string;
  git_url: string | null;
  git_path: string | null;
  org_id: string | null;
  enabled: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// === API Request/Response Types ===

export interface CreateOrgRequest {
  name: string;
  slug?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: 'admin' | 'member';
}

export interface UpdateMemberRequest {
  role?: 'owner' | 'admin' | 'member';
  status?: 'active' | 'disabled';
}

export interface AcceptInviteRequest {
  token: string;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  type?: 'mandatory' | 'optional' | 'restricted';
  path?: string;
  git_url: string;
  git_path: string;
}

export interface UpdateSkillRequest {
  type?: 'mandatory' | 'optional' | 'restricted';
  enabled?: boolean;
  git_url?: string;
  git_path?: string;
}

export interface ScanRepoRequest {
  git_url: string;
}

export interface ScanRepoResult {
  name: string;
  git_path: string;
}

export interface ImportSkillsRequest {
  git_url: string;
  skills: { name: string; git_path: string }[];
}

// === Provider Registry ===

export interface ProviderConfig {
  id: string;
  label: string;
  envVar: string;
  placeholder: string;
  /** Model ID used for agents.defaults.model in openclaw.json */
  defaultModel: string;
  supportsOAuth?: boolean;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'anthropic', label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', defaultModel: 'anthropic/claude-sonnet-4-5' },
  { id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY', placeholder: 'sk-...', defaultModel: 'openai/gpt-4.1', supportsOAuth: true },
  { id: 'openrouter', label: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', placeholder: 'sk-or-...', defaultModel: 'openrouter/anthropic/claude-sonnet-4.5' },
  { id: 'google', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', placeholder: 'AIza...', defaultModel: 'google/gemini-2.5-pro' },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

// === OAuth Provider Config ===

export interface OAuthProviderConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  openai: {
    clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
    authorizeUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    redirectUri: '', // set at runtime from APP_URL
    scopes: '',
  },
};

export interface SetApiKeyRequest {
  provider: string;
  key: string;
}
