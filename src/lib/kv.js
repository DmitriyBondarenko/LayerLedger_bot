const DRAFT_TTL_SECONDS = 1800;

function draftKey(chatId) {
  return `draft:${chatId}`;
}

export async function getDraft(env, chatId) {
  const raw = await env.DRAFTS.get(draftKey(chatId));
  return raw ? JSON.parse(raw) : null;
}

export function setDraft(env, chatId, draft) {
  return env.DRAFTS.put(draftKey(chatId), JSON.stringify(draft), {
    expirationTtl: DRAFT_TTL_SECONDS,
  });
}

export function clearDraft(env, chatId) {
  return env.DRAFTS.delete(draftKey(chatId));
}
