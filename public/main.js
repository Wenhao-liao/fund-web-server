const STORAGE_KEY = "fund_codes";
const MINUTE_KEY = "minute_cache";
const MAX_MINUTES = 60;

let FUND_CODES = JSON.parse(localStorage.getItem(STORAGE_KEY)) || ["161725"];
let minuteCache = JSON.parse(localStorage.getItem(MINUTE_KEY) || "{}");
let sortMode = "none";
let bigChart = null;

function saveCodes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(FUND_CODES));
}

function recordMinute(code, value) {
  if (!minuteCache[code]) minuteCache[code] = [];

  const now = Date.now();
  const last = minuteCache[code].at(-1);

  if (last && now - last.time < 60000) return;

  minuteCache[code].push({ time: now, value });

  if (minuteCache[code].length > MAX_MINUTES) {
    minuteCache[code].shift();
  }

  localStorage.setItem(MINUTE_KEY, JSON.stringify(minuteCache));
}

async function fetchFund(code) {
  const res = await fetch(`/api/fund/${code}`);
  return res.json();
}

function renderMiniChart(code) {
  const canvas = document.querySelector(`.mini-chart[data-code="${code}"]`);
  if (!canvas) return;

  const data = minuteCache[code];
  if (!data || data.length < 2) return;

  const ctx = canvas.getContext("2d");
  const values = data.map((d) => d.value);
  const color = values.at(-1) >= values[0] ? "#f56c6c" : "#67c23a";

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: values.map(() => ""),
      datasets: [
        {
          data: values,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

function renderCard(fund) {
  const div = document.createElement("div");
  div.className = "card";

  const rate = parseFloat(fund.gszzl);
  const rateClass = rate >= 0 ? "up" : "down";

  div.innerHTML = `
    <h3>${fund.name}</h3>
    <p>估值：${fund.gsz}</p>
    <p class="${rateClass}">涨跌：${fund.gszzl}%</p>
    <div class="mini-chart-wrap">
      <canvas class="mini-chart" data-code="${fund.fundcode}"></canvas>
    </div>
    <p class="time">${fund.gztime}</p>
    <button class="delete">删除</button>
  `;

  div.querySelector(".delete").onclick = () => {
    FUND_CODES = FUND_CODES.filter((c) => c !== fund.fundcode);
    saveCodes();
    loadAll();
  };

  div.onclick = () => drawHistory(fund.fundcode, fund.name);

  return div;
}

async function loadAll() {
  const list = document.getElementById("list");
  list.innerHTML = "加载中...";

  const results = await Promise.all(FUND_CODES.map((code) => fetchFund(code)));

  if (sortMode !== "none") {
    results.sort((a, b) =>
      sortMode === "asc" ? a.gszzl - b.gszzl : b.gszzl - a.gszzl,
    );
  }

  list.innerHTML = "";

  results.forEach((fund) => {
    recordMinute(fund.fundcode, parseFloat(fund.gsz));
    const card = renderCard(fund);
    list.appendChild(card);

    safeCreateChart(`.mini-chart[data-code="${fund.fundcode}"]`, () => {
      return renderMiniChart(fund.fundcode)
    });
  });
}

let historyChart = null;

async function drawHistory(code, name) {
  const res = await fetch(`/api/history/${code}`);
  const history = await res.json();

  const labels = history.map((i) => i.time);
  const values = history.map((i) => i.value);

  renderHistorySafe(labels, values, name);
}

function renderHistorySafe(labels, values, name) {
  setTimeout(() => {
    if (historyChart) historyChart.destroy();

    const ctx = document.getElementById("chart").getContext("2d");

    historyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: name,
            data: values,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
        },
      },
    });

    // 再保险一次
    setTimeout(() => {
      historyChart.resize();
    }, 200);
  }, 300);
}

function safeCreateChart(canvasId, createFn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrap = canvas.parentElement;

  waitForVisible(wrap, () => {
    const chart = createFn();

    // 再保险一次
    setTimeout(() => {
      chart.resize();
    }, 200);
  });
}

function waitForVisible(el, callback, retry = 20) {
  if (!el || retry <= 0) return;

  const h = el.offsetHeight;
  if (h > 0) {
    callback();
  } else {
    setTimeout(() => {
      waitForVisible(el, callback, retry - 1);
    }, 100);
  }
}

document.getElementById("addBtn").onclick = async () => {
  const input = document.getElementById("codeInput");
  const code = input.value.trim();

  if (!/^\d{6}$/.test(code)) {
    alert("请输入 6 位基金代码");
    return;
  }

  if (FUND_CODES.includes(code)) {
    alert("已存在");
    return;
  }

  try {
    await fetchFund(code);
    FUND_CODES.push(code);
    saveCodes();
    input.value = "";
    loadAll();
  } catch {
    alert("基金不存在");
  }
};

document.getElementById("sortBtn").onclick = () => {
  sortMode =
    sortMode === "none" ? "desc" : sortMode === "desc" ? "asc" : "none";
  loadAll();
};

loadAll();
setInterval(loadAll, 60000);
