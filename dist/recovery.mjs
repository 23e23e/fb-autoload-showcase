export function createCheckpoint() {
  return {
    scope: "workspace-demo/account-demo/launch-demo",
    status: "needs_review",
    canceled: false,
    mediaId: "media-demo",
    campaignId: null,
    adId: null,
    writes: [],
    events: ["Медиа сохранены", "Ответ на создание кампании потерян"],
  };
}

export function continueCheckpoint(checkpoint, observation, { approved = false } = {}) {
  const next = structuredClone(checkpoint);
  const stop = (reason) => {
    next.status = "blocked";
    next.events.push(reason);
    return next;
  };
  if (next.canceled || next.status === "canceled") {
    next.canceled = true;
    next.status = "canceled";
    next.events.push("Сохранённая отмена: выполнение не возобновлено");
    return next;
  }
  if (next.status === "completed") return next;
  if (!approved) return stop("Продолжение требует разрешения оператора");
  if (observation?.scope !== next.scope) return stop("Контекст чтения не совпал с задачей");
  if (observation?.complete !== true) return stop("Результат чтения неизвестен: новых записей нет");
  if (observation.mediaId !== next.mediaId) return stop("Сохранённое медиа не подтверждено");
  if (!Array.isArray(observation.campaignIds) || observation.campaignIds.length !== 1) {
    return stop("Нет однозначного совпадения: отдельное решение перед новой записью");
  }
  const [campaignId] = observation.campaignIds;
  if (typeof campaignId !== "string" || !campaignId.trim()) return stop("Некорректный ID кампании");
  if (next.campaignId && next.campaignId !== campaignId) return stop("ID кампании противоречит checkpoint");
  if (!Array.isArray(observation.adIds) || observation.adIds.length > 1) {
    return stop("Результат чтения объявлений неоднозначен");
  }
  next.campaignId = campaignId;
  next.events.push("Кампания найдена и переиспользована");
  if (observation.adIds.length === 1) {
    const [adId] = observation.adIds;
    if (typeof adId !== "string" || !adId.trim() || (next.adId && next.adId !== adId)) {
      return stop("ID объявления противоречит checkpoint");
    }
    next.adId = adId;
    next.events.push("Существующее объявление переиспользовано");
  } else {
    if (next.adId) return stop("Подтверждённое объявление не найдено: повтор запрещён");
    next.adId = "ad-demo";
    next.writes.push({ action: "simulate_missing_ad", campaignId, adId: next.adId });
    next.events.push("В модели создано только отсутствующее объявление");
  }
  next.status = "completed";
  return next;
}

export function demoScenario(scenario) {
  if (!["found", "unknown", "canceled"].includes(scenario)) throw new Error("Unknown demonstration scenario");
  const checkpoint = createCheckpoint();
  checkpoint.canceled = scenario === "canceled";
  return continueCheckpoint(checkpoint, {
    scope: checkpoint.scope,
    complete: scenario !== "unknown",
    mediaId: checkpoint.mediaId,
    campaignIds: ["campaign-demo"],
    adIds: [],
  }, { approved: true });
}
