export const DEMO_CAMPAIGNS = Object.freeze([
  Object.freeze({ id: "store-es", name: "Demo Store · Испания", country: "ES" }),
  Object.freeze({ id: "store-br", name: "Demo Store · Бразилия", country: "BR" }),
]);
export const DEMO_CREATIVES = Object.freeze([
  Object.freeze({ id: "studio", name: "studio_01.mp4", label: "STUDIO", detail: "Видео · 15 сек · 9:16" }),
  Object.freeze({ id: "detail", name: "detail_02.mp4", label: "DETAIL", detail: "Видео · 15 сек · 9:16" }),
  Object.freeze({ id: "story", name: "story_03.mp4", label: "STORY", detail: "Видео · 15 сек · 9:16" }),
]);
export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ id: "DEMO-A1", profile: "Профиль A", available: true, detail: "Доступы и ресурсы готовы" }),
  Object.freeze({ id: "DEMO-A2", profile: "Профиль A", available: true, detail: "Доступы и ресурсы готовы" }),
  Object.freeze({ id: "DEMO-B1", profile: "Профиль B", available: true, detail: "Доступы и ресурсы готовы" }),
  Object.freeze({ id: "DEMO-B2", profile: "Профиль B", available: false, detail: "Требуется вход · недоступен для выбора" }),
]);
export const DEMO_STAGES = Object.freeze(["Медиа подготовлены", "Кампании созданы", "Эдсеты созданы", "Объявления созданы", "Результат проверен"]);
export const DEMO_STEPS = Object.freeze(["campaign", "creatives", "accounts", "review", "result"]);

export function createLaunchDemo() {
  return { step: "campaign", campaignId: "", creativeIds: [], accountIds: [], status: "draft", progress: 0, results: [] };
}

function editable(state, step) {
  if (state.status !== "draft" || state.step !== step) throw new Error("Сначала вернитесь на соответствующий шаг");
}

export function selectCampaign(state, campaignId) {
  editable(state, "campaign");
  if (campaignId && !DEMO_CAMPAIGNS.some(item => item.id === campaignId)) throw new Error("Неизвестная демо-кампания");
  return { ...state, campaignId };
}

function toggleSelection(selected, id) {
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}

export function toggleCreative(state, creativeId) {
  editable(state, "creatives");
  if (!DEMO_CREATIVES.some(item => item.id === creativeId)) throw new Error("Неизвестный демо-креатив");
  return { ...state, creativeIds: toggleSelection(state.creativeIds, creativeId) };
}

export function toggleAccount(state, accountId) {
  editable(state, "accounts");
  if (!DEMO_ACCOUNTS.some(item => item.id === accountId && item.available)) throw new Error("Кабинет недоступен для выбора");
  return { ...state, accountIds: toggleSelection(state.accountIds, accountId) };
}

export function canContinue(state) {
  if (state.status !== "draft") return false;
  if (state.step === "campaign") return DEMO_CAMPAIGNS.some(item => item.id === state.campaignId);
  if (state.step === "creatives") return state.creativeIds.length > 0;
  if (state.step === "accounts") return state.accountIds.length > 0;
  return false;
}

export function nextStep(state) {
  if (!canContinue(state)) throw new Error("Завершите выбор на текущем шаге");
  return { ...state, step: DEMO_STEPS[DEMO_STEPS.indexOf(state.step) + 1] };
}

export function previousStep(state) {
  if (state.status !== "draft" || !DEMO_STEPS.includes(state.step) || state.step === "campaign") throw new Error("Назад на этом этапе недоступно");
  return { ...state, step: DEMO_STEPS[DEMO_STEPS.indexOf(state.step) - 1] };
}

export function summarizeDemo(state) {
  const campaign = DEMO_CAMPAIGNS.find(item => item.id === state.campaignId);
  const creatives = state.creativeIds.map(id => DEMO_CREATIVES.find(item => item.id === id));
  const accounts = state.accountIds.map(id => DEMO_ACCOUNTS.find(item => item.id === id && item.available));
  if (!campaign || !creatives.length || !accounts.length || creatives.some(item => !item) || accounts.some(item => !item)) throw new Error("План не готов к запуску");
  if (new Set(state.creativeIds).size !== creatives.length || new Set(state.accountIds).size !== accounts.length) throw new Error("План содержит повторяющиеся объекты");
  const adSets = creatives.length * accounts.length;
  return { campaign, creatives, accounts, campaigns: accounts.length, adSets, ads: adSets, budgetPerAdSet: 5, dailyBudget: adSets * 5 };
}

export function startDemo(state) {
  editable(state, "review");
  summarizeDemo(state);
  return { ...state, step: "result", status: "running", progress: 0, results: [] };
}

export function advanceDemo(state) {
  if (state.status === "completed") return state;
  if (state.step !== "result" || state.status !== "running") throw new Error("Демо ещё не запущено");
  const plan = summarizeDemo(state);
  const progress = Math.min(state.progress + 1, DEMO_STAGES.length);
  const completed = progress === DEMO_STAGES.length;
  return {
    ...state, progress, status: completed ? "completed" : "running",
    results: completed ? plan.accounts.map(account => ({
      accountId: account.id, profile: account.profile, campaignId: `campaign-${account.id.toLowerCase()}`,
      adSetIds: plan.creatives.map(creative => `adset-${account.id.toLowerCase()}-${creative.id}`),
      adIds: plan.creatives.map(creative => `ad-${account.id.toLowerCase()}-${creative.id}`),
      status: "completed",
    })) : [],
  };
}
