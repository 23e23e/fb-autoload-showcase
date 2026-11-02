const loadDemoModule = () => import("./launch-demo.mjs");

async function connectDemo() {
  const root = document.getElementById("launch-demo");
  const status = document.getElementById("launch-status");
  let model;
  try {
    model = await loadDemoModule();
  } catch {
    status.textContent = "Не удалось загрузить демо. Обновите страницу или откройте автономную версию.";
    return;
  }
  let state = model.createLaunchDemo();
  let animationTimer = null;
  const campaign = document.getElementById("demo-campaign");
  const next = document.getElementById("demo-next");
  const back = document.getElementById("demo-back");
  const start = document.getElementById("demo-start");
  const restart = document.getElementById("demo-restart");
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  for (const item of model.DEMO_CAMPAIGNS) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    campaign.append(option);
  }
  for (const [index, item] of model.DEMO_CREATIVES.entries()) {
    const option = document.getElementById("creative-template").content.cloneNode(true);
    const input = option.querySelector("input");
    input.value = item.id;
    input.addEventListener("change", () => { state = model.toggleCreative(state, item.id); render(); });
    option.querySelector(".creative-poster").dataset.tone = String(index);
    option.querySelector(".creative-poster small").textContent = item.label;
    option.querySelector(".option-name").textContent = item.name;
    option.querySelector(".option-detail").textContent = item.detail;
    document.getElementById("creative-options").append(option);
  }
  for (const item of model.DEMO_ACCOUNTS) {
    const option = document.getElementById("account-template").content.cloneNode(true);
    const input = option.querySelector("input");
    input.value = item.id;
    input.disabled = !item.available;
    input.addEventListener("change", () => { state = model.toggleAccount(state, item.id); render(); });
    option.querySelector(".account-option").classList.toggle("unavailable", !item.available);
    option.querySelector(".option-name").textContent = `${item.id} · ${item.profile}`;
    option.querySelector(".option-detail").textContent = item.detail;
    option.querySelector(".option-state").textContent = item.available ? "Готов" : "Нет доступа";
    document.getElementById("account-options").append(option);
  }

  function render() {
    root.dataset.step = state.step;
    root.dataset.status = state.status;
    const current = model.DEMO_STEPS.indexOf(state.step);
    for (const [index, item] of [...root.querySelectorAll(".launch-stepper li")].entries()) {
      item.classList.toggle("current", index === current);
      item.classList.toggle("finished", index < current || state.status === "completed");
      if (index === current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    }
    for (const panel of root.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== state.step;
    document.getElementById("step-caption").textContent = `Шаг ${current + 1} из ${model.DEMO_STEPS.length}`;
    campaign.value = state.campaignId;
    for (const input of root.querySelectorAll("#creative-options input")) input.checked = state.creativeIds.includes(input.value);
    for (const input of root.querySelectorAll("#account-options input")) input.checked = state.accountIds.includes(input.value);
    document.getElementById("creative-count").textContent = `${state.creativeIds.length} из ${model.DEMO_CREATIVES.length}`;
    document.getElementById("account-count").textContent = `${state.accountIds.length} выбрано`;
    next.hidden = !["campaign", "creatives", "accounts"].includes(state.step);
    next.disabled = !model.canContinue(state);
    back.hidden = state.step === "campaign" || state.step === "result";
    start.hidden = state.step !== "review";
    restart.hidden = state.step !== "result";
    restart.disabled = state.status === "running";
    status.textContent = state.status === "running" ? "Симуляция запуска · без реальных запросов" : state.status === "completed" ? "Симуляция завершена · ничего не опубликовано в Meta" : "Демонстрационные кампании, файлы и кабинеты";
    if (["review", "result"].includes(state.step)) {
      const plan = model.summarizeDemo(state);
      document.getElementById("plan-campaign").textContent = plan.campaign.name;
      document.getElementById("plan-creatives").textContent = plan.creatives.map(item => item.name).join(" · ");
      document.getElementById("plan-accounts").textContent = plan.accounts.map(item => item.id).join(" · ");
      document.getElementById("plan-budget").textContent = `${money(plan.budgetPerAdSet)} / эдсет / день`;
      document.getElementById("plan-total").textContent = `${plan.campaigns} камп. · ${plan.adSets} эдс. · ${plan.ads} объявл.`;
      document.getElementById("plan-daily").textContent = `Всего ${money(plan.dailyBudget)} в день в демо-плане`;
      renderResult(plan);
    }
  }

  function renderResult(plan) {
    const progress = Math.round(state.progress / model.DEMO_STAGES.length * 100);
    const bar = document.getElementById("launch-progress");
    bar.value = progress;
    bar.textContent = `${progress}%`;
    document.getElementById("launch-progress-text").textContent = `${progress}%`;
    document.getElementById("result-heading").textContent = state.status === "completed" ? "Готово. Результат по каждому кабинету." : "Приложение выполняет план";
    document.getElementById("result-summary").textContent = state.status === "completed" ? `${plan.campaigns} камп. · ${plan.adSets} эдс. · ${plan.ads} объявл. созданы в демо` : "Медиа → кампании → эдсеты → объявления → проверка";
    document.getElementById("launch-activity").textContent = state.progress ? model.DEMO_STAGES[state.progress - 1] : "Подготовка выбранных медиа";
    const rows = document.getElementById("launch-results");
    rows.replaceChildren();
    for (const account of plan.accounts) {
      const row = document.getElementById("result-template").content.cloneNode(true);
      row.querySelector(".option-name").textContent = account.id;
      row.querySelector(".option-detail").textContent = state.status === "completed" ? `1 кампания · ${plan.creatives.length} эдс. · ${plan.creatives.length} объявл.` : account.profile;
      row.querySelector(".result-state").textContent = state.status === "completed" ? "Создано в демо" : state.progress ? "В работе" : "В очереди";
      rows.append(row);
    }
  }

  function move(transform) {
    state = transform(state);
    render();
    document.getElementById(`stage-${state.step}`).focus({ preventScroll: true });
  }
  campaign.addEventListener("change", () => { state = model.selectCampaign(state, campaign.value); render(); });
  next.addEventListener("click", () => move(model.nextStep));
  back.addEventListener("click", () => move(model.previousStep));
  start.addEventListener("click", () => {
    if (state.status !== "draft" || state.step !== "review") return;
    move(model.startDemo);
    const advance = () => {
      state = model.advanceDemo(state);
      render();
      if (state.status === "completed") { clearInterval(animationTimer); animationTimer = null; }
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      while (state.status === "running") advance();
    } else animationTimer = setInterval(advance, 450);
  });
  restart.addEventListener("click", () => {
    if (state.status === "running") return;
    clearInterval(animationTimer);
    animationTimer = null;
    move(model.createLaunchDemo);
  });
  render();
}

connectDemo();
