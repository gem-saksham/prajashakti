/**
 * issueCache — AsyncStorage-backed cache of recently viewed feed issues.
 *
 * Stores up to 50 issues so the user can scroll the feed and open issues
 * offline. Cache is refreshed on every successful feed fetch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const LIST_KEY = 'prajashakti_issue_list_cache';
const DETAIL_KEY_PREFIX = 'prajashakti_issue_detail_';
const MAX_LIST = 50;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h

export async function cacheIssueList(issues) {
  try {
    const trimmed = (issues || []).slice(0, MAX_LIST);
    const payload = { savedAt: Date.now(), issues: trimmed };
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export async function readCachedIssueList() {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.savedAt || Date.now() - payload.savedAt > TTL_MS) return null;
    return payload.issues || [];
  } catch {
    return null;
  }
}

export async function cacheIssueDetail(issue) {
  if (!issue?.id) return;
  try {
    const payload = { savedAt: Date.now(), issue };
    await AsyncStorage.setItem(DETAIL_KEY_PREFIX + issue.id, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export async function readCachedIssueDetail(id) {
  if (!id) return null;
  try {
    const raw = await AsyncStorage.getItem(DETAIL_KEY_PREFIX + id);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.savedAt || Date.now() - payload.savedAt > TTL_MS) return null;
    return payload.issue;
  } catch {
    return null;
  }
}
