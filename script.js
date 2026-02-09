// Simple utility for reading/writing localStorage safely
const storageKey = "luxbudget-data-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {
        transactions: [],
        budgets: defaultBudgets(),
        settings: { currency: "USD", darkMode: true },
        goal: null,
      };
    }
    const parsed = JSON.parse(raw);
    // Ensure defaults for missing fields
    return {
      transactions: parsed.transactions || [],
      budgets: parsed.budgets || defaultBudgets(),
      settings: {
        currency: (parsed.settings && parsed.settings.currency) || "USD",
        darkMode: parsed.settings ? parsed.settings.darkMode : true,
      },
      goal: parsed.goal || null,
    };
  } catch (e) {
    console.error("Failed to parse state, resetting.", e);
    return {
      transactions: [],
      budgets: defaultBudgets(),
      settings: { currency: "USD", darkMode: true },
      goal: null,
    };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function defaultBudgets() {
  return [
    { category: "Food", limit: 500 },
    { category: "Transport", limit: 200 },
    { category: "Entertainment", limit: 250 },
    { category: "Bills", limit: 400 },
    { category: "Shopping", limit: 350 },
    { category: "Health", limit: 150 },
    { category: "Other", limit: 100 },
  ];
}

let state = loadState();

const el = (id) => document.getElementById(id);

const totalBalanceEl = el("totalBalance");
const totalIncomeEl = el("totalIncome");
const totalExpensesEl = el("totalExpenses");
const statMonthlyIncomeEl = el("statMonthlyIncome");
const statMonthlyExpensesEl = el("statMonthlyExpenses");
const statSavingsRateEl = el("statSavingsRate");
const statBudgetRemainingEl = el("statBudgetRemaining");
const categoryChartCanvas = el("categoryChart");
const trendChartCanvas = el("trendChart");
const transactionForm = el("transactionForm");
const txTypeHidden = el("txType");
const currencySelect = el("currency");
const darkModeToggle = el("darkModeToggle");
const searchInput = el("searchInput");
const filterType = el("filterType");
const txTableBody = el("transactionTableBody");
const budgetList = el("budgetList");
const goalNameInput = el("goalName");
const goalTargetInput = el("goalTarget");
const saveGoalBtn = el("saveGoal");
const goalProgressWrapper = el("goalProgressWrapper");
const goalNameLabel = el("goalNameLabel");
const goalAmountLabel = el("goalAmountLabel");
const goalProgressBar = el("goalProgressBar");
const goalCaption = el("goalCaption");
const monthComparisonEl = el("monthComparison");
const topCategoryEl = el("topCategory");
const exportJsonBtn = el("exportJson");
const coinSound = el("coinSound");

let categoryChart;
let trendChart;
let currentSort = { field: "date", direction: "desc" };

function formatCurrency(amount) {
  const currency = state.settings.currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${amount.toFixed ? amount.toFixed(2) : amount}`;
  }
}

function animateNumber(elm, target) {
  const current = parseFloat((elm.dataset.value || "0") ?? "0");
  const duration = 450;
  const start = performance.now();
  const diff = target - current;

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = current + diff * progress;
    elm.textContent = formatCurrency(value);
    elm.dataset.value = value.toString();
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function applyTheme() {
  const html = document.documentElement;
  html.dataset.theme = state.settings.darkMode ? "dark" : "light";
}

function initThemeAndCurrency() {
  applyTheme();
  currencySelect.value = state.settings.currency || "USD";
}

function computeTotals(transactions) {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, balance: income - expenses };
}

function isSameMonthYear(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

function filterByCurrentMonth(transactions, offsetMonths = 0) {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths,
    1
  );
  return transactions.filter((t) =>
    isSameMonthYear(new Date(t.date), target)
  );
}

function computeBudgetsUsage() {
  const currentMonthTx = filterByCurrentMonth(state.transactions);
  const usage = {};
  for (const b of state.budgets) {
    usage[b.category] = 0;
  }
  for (const t of currentMonthTx) {
    if (t.type === "expense") {
      usage[t.category] = (usage[t.category] || 0) + t.amount;
    }
  }
  return usage;
}

function updateDashboard() {
  const { income, expenses, balance } = computeTotals(state.transactions);

  animateNumber(totalBalanceEl, balance);
  totalIncomeEl.textContent = formatCurrency(income);
  totalExpensesEl.textContent = formatCurrency(expenses);

  const thisMonth = filterByCurrentMonth(state.transactions);
  const lastMonth = filterByCurrentMonth(state.transactions, -1);

  const thisTotals = computeTotals(thisMonth);
  const lastTotals = computeTotals(lastMonth);

  statMonthlyIncomeEl.textContent = formatCurrency(thisTotals.income);
  statMonthlyExpensesEl.textContent = formatCurrency(thisTotals.expenses);

  const savingsBase = thisTotals.income || 1;
  const savingsRate = ((savingsBase - thisTotals.expenses) / savingsBase) * 100;
  const savingsClamped = Math.max(Math.min(savingsRate, 100), -100);
  statSavingsRateEl.textContent = `${savingsClamped.toFixed(1)}%`;

  const budgetsUsage = computeBudgetsUsage();
  const totalBudget = state.budgets.reduce((sum, b) => sum + b.limit, 0);
  const spentBudget = Object.values(budgetsUsage).reduce(
    (sum, v) => sum + v,
    0
  );
  const remainingBudget = Math.max(totalBudget - spentBudget, 0);
  statBudgetRemainingEl.textContent = formatCurrency(remainingBudget);

  const diff = thisTotals.expenses - lastTotals.expenses;
  if (lastTotals.expenses === 0 && thisTotals.expenses === 0) {
    monthComparisonEl.textContent = "No spending yet.";
  } else if (diff > 0) {
    monthComparisonEl.textContent = `Spending increased by ${formatCurrency(
      diff
    )} vs last month.`;
  } else if (diff < 0) {
    monthComparisonEl.textContent = `Spending decreased by ${formatCurrency(
      Math.abs(diff)
    )} vs last month.`;
  } else {
    monthComparisonEl.textContent = "Spending is the same as last month.";
  }

  const categoryTotals = {};
  for (const t of thisMonth) {
    if (t.type === "expense") {
      categoryTotals[t.category] =
        (categoryTotals[t.category] || 0) + t.amount;
    }
  }
  const entries = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );
  topCategoryEl.textContent =
    entries.length > 0 ? `${entries[0][0]} (${formatCurrency(entries[0][1])})` : "–";
}

function renderBudgets() {
  budgetList.innerHTML = "";
  const usage = computeBudgetsUsage();

  for (const budget of state.budgets) {
    const spent = usage[budget.category] || 0;
    const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
    const clampedPct = Math.min(pct, 130);

    const wrapper = document.createElement("div");
    wrapper.className = "budget-item";

    const header = document.createElement("div");
    header.className = "budget-header";
    const cat = document.createElement("div");
    cat.className = "budget-category";
    cat.textContent = budget.category;
    const limit = document.createElement("div");
    limit.className = "budget-limit";
    limit.textContent = `${formatCurrency(spent)} / ${formatCurrency(
      budget.limit
    )}`;
    header.append(cat, limit);
    wrapper.appendChild(header);

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const inner = document.createElement("div");
    inner.className = "progress-bar-inner";
    if (pct >= 100) inner.classList.add("progress-danger");
    inner.style.width = `${clampedPct}%`;
    bar.appendChild(inner);
    wrapper.appendChild(bar);

    if (pct >= 90) {
      const alert = document.createElement("div");
      alert.className = "budget-alert";
      alert.textContent =
        pct >= 100
          ? "Budget exceeded for this category."
          : "Approaching budget limit.";
      wrapper.appendChild(alert);
    }

    budgetList.appendChild(wrapper);
  }
}

function filteredAndSortedTransactions() {
  const q = (searchInput.value || "").toLowerCase().trim();
  const typeFilter = filterType.value;

  let txs = [...state.transactions];
  if (typeFilter !== "all") {
    txs = txs.filter((t) => t.type === typeFilter);
  }
  if (q) {
    txs = txs.filter(
      (t) =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );
  }

  txs.sort((a, b) => {
    if (currentSort.field === "date") {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return currentSort.direction === "asc" ? da - db : db - da;
    } else if (currentSort.field === "amount") {
      return currentSort.direction === "asc"
        ? a.amount - b.amount
        : b.amount - a.amount;
    }
    return 0;
  });

  return txs;
}

function renderTransactions() {
  txTableBody.innerHTML = "";
  const txs = filteredAndSortedTransactions();

  for (const tx of txs) {
    const tr = document.createElement("tr");

    const dateTd = document.createElement("td");
    dateTd.textContent = new Date(tx.date).toLocaleDateString();

    const descTd = document.createElement("td");
    descTd.textContent = tx.description || "-";

    const categoryTd = document.createElement("td");
    categoryTd.textContent = tx.category;

    const methodTd = document.createElement("td");
    methodTd.textContent = tx.paymentMethod || "-";

    const amountTd = document.createElement("td");
    amountTd.className = "tx-amount " + tx.type;
    const sign = tx.type === "expense" ? "-" : "+";
    amountTd.textContent = `${sign}${formatCurrency(tx.amount)}`;

    const actionsTd = document.createElement("td");
    actionsTd.className = "tx-actions";
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "chip-btn";
    editBtn.addEventListener("click", () => startEditTransaction(tx.id));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "chip-btn";
    delBtn.addEventListener("click", () => deleteTransaction(tx.id));
    actionsTd.append(editBtn, delBtn);

    tr.append(dateTd, descTd, categoryTd, methodTd, amountTd, actionsTd);
    txTableBody.appendChild(tr);
  }
}

function ensureCharts() {
  if (!categoryChart) {
    categoryChart = new Chart(categoryChartCanvas, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [
              "#6ba844",
              "#ffd700",
              "#4a7c2f",
              "#ffb700",
              "#c9a900",
              "#00c851",
              "#ff4444",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "rgba(255,255,255,0.8)", usePointStyle: true },
          },
        },
      },
    });
  }
  if (!trendChart) {
    trendChart = new Chart(trendChartCanvas, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        scales: {
          x: {
            ticks: { color: "rgba(255,255,255,0.6)" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            ticks: { color: "rgba(255,255,255,0.6)" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
        },
        plugins: {
          legend: {
            labels: { color: "rgba(255,255,255,0.8)" },
          },
        },
      },
    });
  }
}

function updateCharts() {
  ensureCharts();

  const currentMonth = filterByCurrentMonth(state.transactions);
  const categoryTotals = {};
  for (const t of currentMonth) {
    if (t.type === "expense") {
      categoryTotals[t.category] =
        (categoryTotals[t.category] || 0) + t.amount;
    }
  }
  categoryChart.data.labels = Object.keys(categoryTotals);
  categoryChart.data.datasets[0].data = Object.values(categoryTotals);
  categoryChart.update();

  const groups = {};
  for (const t of state.transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    if (!groups[key]) {
      groups[key] = { income: 0, expense: 0 };
    }
    groups[key][t.type] += t.amount;
  }
  const keys = Object.keys(groups).sort();
  trendChart.data.labels = keys;
  trendChart.data.datasets = [
    {
      label: "Income",
      data: keys.map((k) => groups[k].income),
      borderColor: "#00c851",
      backgroundColor: "rgba(0, 200, 81, 0.2)",
    },
    {
      label: "Expenses",
      data: keys.map((k) => groups[k].expense),
      borderColor: "#ff4444",
      backgroundColor: "rgba(255, 68, 68, 0.25)",
    },
  ];
  trendChart.update();
}

function updateGoal() {
  if (!state.goal) {
    goalProgressWrapper.hidden = true;
    return;
  }
  goalProgressWrapper.hidden = false;
  goalNameLabel.textContent = state.goal.name;
  goalAmountLabel.textContent = `${formatCurrency(
    state.goal.saved
  )} / ${formatCurrency(state.goal.target)}`;
  const pct =
    state.goal.target > 0
      ? Math.min((state.goal.saved / state.goal.target) * 100, 130)
      : 0;
  goalProgressBar.style.width = `${pct}%`;

  if (pct >= 100) {
    goalCaption.textContent = "Goal reached! Time to celebrate wisely.";
  } else {
    goalCaption.textContent = `You are ${pct.toFixed(
      1
    )}% of the way to your goal.`;
  }
}

function recomputeGoalFromBalance() {
  if (!state.goal) return;
  const { balance } = computeTotals(state.transactions);
  state.goal.saved = Math.max(balance, 0);
}

function renderAll() {
  recomputeGoalFromBalance();
  updateDashboard();
  renderBudgets();
  renderTransactions();
  updateCharts();
  updateGoal();
}

function startEditTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  txTypeHidden.value = tx.type;
  document
    .querySelectorAll(".type-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.type === tx.type)
    );
  el("amount").value = tx.amount;
  el("category").value = tx.category;
  el("date").value = tx.date.slice(0, 10);
  el("paymentMethod").value = tx.paymentMethod || "Card";
  el("description").value = tx.description || "";
  transactionForm.dataset.editing = id;
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveState();
  renderAll();
}

function handleFormSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(el("amount").value || "0");
  const category = el("category").value;
  const date = el("date").value;
  const paymentMethod = el("paymentMethod").value;
  const description = el("description").value.trim();
  const type = txTypeHidden.value;

  if (!amount || amount <= 0 || !date || !category) return;

  const isEditing = Boolean(transactionForm.dataset.editing);

  if (isEditing) {
    const id = transactionForm.dataset.editing;
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    tx.amount = amount;
    tx.category = category;
    tx.date = date;
    tx.paymentMethod = paymentMethod;
    tx.description = description;
    tx.type = type;
  } else {
    state.transactions.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      amount,
      category,
      date,
      paymentMethod,
      description,
      type,
    });
  }

  transactionForm.reset();
  delete transactionForm.dataset.editing;
  el("date").valueAsDate = new Date();
  txTypeHidden.value = "income";
  document
    .querySelectorAll(".type-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.type === "income")
    );

  saveState();
  renderAll();

  if (coinSound) {
    coinSound.currentTime = 0;
    coinSound.play().catch(() => {});
  }
}

function handleTypeToggleClick(e) {
  const btn = e.target.closest(".type-btn");
  if (!btn) return;
  const type = btn.dataset.type;
  txTypeHidden.value = type;
  document
    .querySelectorAll(".type-btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
}

function handleSortClick(e) {
  const th = e.target.closest("th[data-sort]");
  if (!th) return;
  const field = th.dataset.sort;
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort.field = field;
    currentSort.direction = "desc";
  }
  renderTransactions();
}

function handleSaveGoal() {
  const name = goalNameInput.value.trim();
  const target = parseFloat(goalTargetInput.value || "0");
  if (!name || !target || target <= 0) return;

  const { balance } = computeTotals(state.transactions);
  state.goal = { name, target, saved: Math.max(balance, 0) };
  saveState();
  goalNameInput.value = "";
  goalTargetInput.value = "";
  updateGoal();
}

function handleExportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "luxbudget-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initEvents() {
  transactionForm.addEventListener("submit", handleFormSubmit);
  document
    .querySelector(".type-toggle")
    .addEventListener("click", handleTypeToggleClick);

  searchInput.addEventListener("input", renderTransactions);
  filterType.addEventListener("change", renderTransactions);

  document
    .querySelectorAll(".tx-table th[data-sort]")
    .forEach((th) => th.addEventListener("click", handleSortClick));

  currencySelect.addEventListener("change", () => {
    state.settings.currency = currencySelect.value;
    saveState();
    renderAll();
  });

  darkModeToggle.addEventListener("click", () => {
    state.settings.darkMode = !state.settings.darkMode;
    saveState();
    applyTheme();
  });

  saveGoalBtn.addEventListener("click", handleSaveGoal);
  exportJsonBtn.addEventListener("click", handleExportJson);
}

function initDefaults() {
  if (!el("date").value) {
    el("date").valueAsDate = new Date();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeAndCurrency();
  initDefaults();
  initEvents();
  renderAll();
});

