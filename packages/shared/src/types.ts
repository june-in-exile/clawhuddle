// === Database Row Types ===

export interface Company {
  id: string;
  name: string;
  allowed_domain: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
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
  joined_at: string;
  // Joined fields from user table
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
  // Joined fields
  org_name?: string;
  invited_by_name?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'deploying' | 'provisioning' | null;
  gateway_token: string | null;
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

export interface UserSkill {
  user_id: string;
  skill_id: string;
  enabled: boolean;
}

export interface ApiKey {
  id: string;
  provider: 'anthropic' | 'openai';
  key_encrypted: string;
  is_company_default: boolean;
  org_id: string | null;
  created_at: string;
}

export interface UsageLog {
  id: number;
  user_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  org_id: string | null;
  created_at: string;
}

// === API Request/Response Types ===

export interface CreateUserRequest {
  email: string;
  name?: string;
  role?: 'admin' | 'member';
}

export interface UpdateUserRequest {
  status?: 'active' | 'disabled';
  role?: 'admin' | 'member';
}

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

export interface SetApiKeyRequest {
  provider: 'anthropic' | 'openai';
  key: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// === API Response wrappers ===

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface GatewayActionResponse {
  memberId: string;
  userId: string;
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'deploying' | 'provisioning' | null;
}
