let selectedScenario = "found";
const loadDemoModule = () => import("./recovery.mjs");
const scenarioCopy = {
  found: "Полное чтение подтвердило: кампания уже существует, объявление ещё не создано.",
  unknown: "Чтение завершилось ошибкой. Отсутствие ответа не доказывает отсутствие кампании.",
  canceled: "До перезапуска оператор отменил задачу. Флаг отмены сохранён вместе с её прогрессом.",
};
const outcomeCopy = {
  completed: ["Продолжили, не начали заново", "Кампания и медиа переиспользованы. Модель выполнила только недостающий этап: создание объявления. Реальных запросов не было."],
  blocked: ["Остановились без новых записей", "Неоднозначный результат не разрешает повтор. Сохранённые медиа остаются; требуется проверка и отдельное решение."],
  canceled: ["Отмена сохранена", "Перезапуск не возвращает задачу в очередь. Сохранённые объекты и история не удаляются."],
};
const runButton = document.getElementById("run-demo");
const output = document.getElementById("demo-output");
const rowValues = [...document.querySelectorAll("#recovery-rows strong")];

function resetView() {
  document.getElementById("scenario-copy").textContent = scenarioCopy[selectedScenario];
  const values = ["Сохранены", "Нужна сверка", "Ожидает"];
  rowValues.forEach((node, index) => {
    node.textContent = values[index];
    node.className = index === 0 ? "green-text" : index === 1 ? "amber-text" : "";
  });
  output.querySelector("strong").textContent = "Начинаем с сохранённого шага";
  output.querySelector("p").textContent = "В демо разрешение оператора уже задано. Новая кампания не создаётся автоматически.";
  runButton.textContent = "Проверить и продолжить →";
  output.removeAttribute("data-result");
}

for (const button of document.querySelectorAll("[data-scenario]")) {
  button.addEventListener("click", () => {
    selectedScenario = button.dataset.scenario;
    for (const option of document.querySelectorAll("[data-scenario]")) {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
    resetView();
  });
}

async function connectDemo() {
  let demoScenario;
  try {
    ({ demoScenario } = await loadDemoModule());
  } catch {
    output.querySelector("strong").textContent = "Не удалось загрузить модуль демо";
    output.querySelector("p").textContent = "Откройте презентацию через npm start. Внешние API для этого не нужны.";
    return;
  }
  runButton.disabled = false;
  runButton.addEventListener("click", () => {
    const result = demoScenario(selectedScenario);
    const [title, description] = outcomeCopy[result.status];
    output.querySelector("strong").textContent = title;
    output.querySelector("p").textContent = description;
    output.dataset.result = result.status;
    const completed = result.status === "completed";
    rowValues[1].textContent = completed ? "Переиспользована" : result.status === "canceled" ? "Не изменяем" : "Неизвестно";
    rowValues[2].textContent = completed ? "Создано в модели" : "Не создаём";
    rowValues[1].className = completed ? "green-text" : "amber-text";
    rowValues[2].className = completed ? "green-text" : "";
    document.getElementById("duplicate-count").textContent = String(result.writes.filter(write => write.action === "simulate_campaign").length);
    runButton.textContent = "Повторить демо ↻";
  });
}

connectDemo();
