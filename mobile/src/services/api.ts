// Localtunnel URL that forwards to Flask on port 5001
// If this stops working, restart: npx localtunnel --port 5001
const BASE = "https://cold-suns-flow.loca.lt";

/* ── Types ──────────────────────────────────────────── */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: "patient" | "partner";
  linked_id: string | null;
  security_question: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  user: UserProfile;
  access_token: string;
}

export interface LinkCodeResponse {
  message: string;
  code: string;
}

export interface MyCodeResponse {
  code: string | null;
}

export interface UnlinkResponse {
  message: string;
  user: UserProfile;
}

export interface CheckInPayload {
  currentFeeling: string;
  overallHealth: string;
  hasRash: boolean;
  rashDetails: string;
  skinConcerns: string;
  otherSymptoms: string[];
  additionalConcerns: string;
}

export interface CheckInRecord {
  _id: string;
  patient_id: string;
  current_feeling: string;
  overall_health: string;
  has_rash: boolean;
  rash_details: string;
  skin_concerns: string;
  other_symptoms: string[];
  additional_concerns: string;
  created_at: string;
}

export interface AuraResponse {
  action: "update_condition" | "request_clarification" | "general_chat";
  condition_name: string;
  extracted_data: {
    pain_level: number;
    location: string[];
    details: string;
    timestamp: string;
    mascot_notes: string[];
  };
  mascot_response: string;
  audio_url?: string;
  log_id?: string;
  condition_id?: string;
  is_new_condition?: boolean;
}

export interface ConditionCard {
  id: string;
  user_id: string;
  condition_name: string;
  status: "active" | "resolved";
  log_count: number;
  first_reported: string;
  last_reported: string;
  created_at: string;
  updated_at: string;
}

export interface ConditionLogRecord {
  id: string;
  user_id: string;
  condition_name: string;
  pain_level: number;
  location: string[];
  details: string;
  symptom_timestamp: string;
  input_mode: string;
  mascot_response: string;
  mascot_notes: string[];
  condition_id: string;
  created_at: string;
}


/* ── Helpers ────────────────────────────────────────── */
async function post<T>(path: string, body: object, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",       // skip localtunnel interstitial
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong");
  return json as T;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "bypass-tunnel-reminder": "true",     // skip localtunnel interstitial
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong");
  return json as T;
}

/* ── API calls ──────────────────────────────────────── */
export const api = {
  register(name: string, email: string, password: string, securityAnswer: string) {
    return post<AuthResponse>("/auth/register", {
      name, email, password, role: "patient", security_answer: securityAnswer,
    });
  },

  login(email: string, password: string) {
    return post<AuthResponse>("/auth/login", { email, password });
  },

  resetPassword(email: string, securityAnswer: string, newPassword: string) {
    return post<AuthResponse>("/auth/reset-password", {
      email, security_answer: securityAnswer, new_password: newPassword,
    });
  },

  partnerLogin(code: string) {
    return post<AuthResponse>("/auth/partner-login", { code });
  },

  getMe(token: string) {
    return get<{ user: UserProfile }>("/auth/me", token);
  },

  generateLinkCode(token: string) {
    return post<LinkCodeResponse>("/auth/generate-link", {}, token);
  },

  getMyCode(token: string) {
    return get<MyCodeResponse>("/auth/my-code", token);
  },

  unlinkPartner(token: string) {
    return post<UnlinkResponse>("/auth/unlink", {}, token);
  },

  submitCheckIn(token: string, data: CheckInPayload) {
    return post<{ message: string; checkin: CheckInRecord }>("/checkins", data, token);
  },

  getMyConditions(token: string) {
    return get<{ conditions: ConditionCard[]; total: number }>("/api/conditions", token);
  },

  getConditionDetail(token: string, conditionId: string) {
    return get<{ condition: ConditionCard; logs: ConditionLogRecord[] }>(
      `/api/conditions/${conditionId}`, token,
    );
  },

  getLatestCheckIn(token: string) {
    return get<{ checkin: CheckInRecord | null }>("/checkins/latest", token);
  },

  getMyLatestCheckIn(token: string) {
    return get<{ checkin: CheckInRecord | null }>("/checkins/my-latest", token);
  },

  /* ── Aura / Gemini multimodal processing ───────── */

  processAuraText(token: string, text: string) {
    return post<AuraResponse>("/api/process-aura", { text }, token);
  },

  forceLog(token: string, conversationHistory: { role: string; text: string }[]) {
    return post<AuraResponse>("/api/process-aura", {
      force_log: true,
      conversation_history: conversationHistory,
    }, token);
  },

  async processAuraAudio(token: string, audioUri: string): Promise<AuraResponse> {
    const form = new FormData();
    form.append("audio", {
      uri: audioUri,
      name: "recording.m4a",
      type: "audio/mp4",
    } as any);
    const res = await fetch(`${BASE}/api/process-aura`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "bypass-tunnel-reminder": "true",
      },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Something went wrong");
    return json as AuraResponse;
  },

  async processAuraImage(token: string, imageUri: string, text?: string): Promise<AuraResponse> {
    const form = new FormData();
    form.append("image", {
      uri: imageUri,
      name: "photo.jpg",
      type: "image/jpeg",
    } as any);
    if (text) form.append("text", text);
    const res = await fetch(`${BASE}/api/process-aura`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "bypass-tunnel-reminder": "true",
      },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Something went wrong");
    return json as AuraResponse;
  },
};

