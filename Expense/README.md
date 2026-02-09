# LuxBudget – Premium Expense Tracker

LuxBudget is a modern, money-themed expense tracker dashboard with a luxury fintech vibe. It runs entirely in the browser and stores your data in localStorage, so no backend is required.

## Features

- **Dashboard overview** with animated total balance, income, expenses, savings rate, and budget remaining.
- **Add transactions** (income or expense) with amount, category, date, payment method, and description.
- **Transaction history** with search, type filter, sortable columns, edit and delete.
- **Budget planner** with per-category monthly limits, visual progress bars, and alerts when you approach/exceed budgets.
- **Categories overview & analytics** using interactive charts (Chart.js) for:
  - Spending by category (doughnut chart)
  - Monthly cash flow trends (line chart)
- **Financial goal tracker** tied to your current balance.
- **LocalStorage persistence** so all data survives page reloads.
- **Dark/light mode toggle**, currency selector, subtle coin animations, and responsive layout.

## Getting Started

You can run it in two simple ways:

### 1. Open directly in the browser

1. Open the `Expense` folder.
2. Double-click `index.html` to open it in your browser.

> Note: Some browsers restrict `localStorage` and script imports for `file://` URLs. If charts or persistence don’t work correctly, use the dev server option below.

### 2. Run a simple local dev server (recommended)

From the `Expense` folder:

```bash
npm install
npm start
```

Then open the URL printed in the terminal (usually `http://localhost:3000` or similar, depending on the `serve` tool) in your browser.

The `"start"` script uses `npx serve .` to host the static files.

## Usage Tips

- Use the **type toggle** (Income / Expense) at the top of the form when adding or editing a transaction.
- Budgets apply to **this month’s expenses** and update automatically as you add transactions.
- Set a **financial goal** in the Analytics & Goals panel; progress is calculated from your current balance.
- Use **Export Data (JSON)** to download your full dataset as a JSON file.

Enjoy tracking your money in style with LuxBudget. 💸

