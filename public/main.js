// ─── 常量 & 状态 ───────────────────────────────────────────────
const STORAGE_KEY  = "fund_codes";
const MINUTE_KEY   = "minute_cache";
const POSITION_KEY = "fund_positions";
const GROUP_KEY    = "fund_groups";
const MAX_MINUTES  = 60;

let FUND_CODES  = JSON.parse(localStorage.getItem(STORAGE_KEY))  || ["161725"];
let minuteCache = JSON.parse(localStorage.getItem(MINUTE_KEY)   || "{}");
let positions   = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
// groups: { [groupName]: string[] }  每组存基金代码数组
// 未分组的基金放在 "__default__" 组
let groups      = JSON.parse(localStorage.getItem(GROUP_KEY)    || "{}");
let sortMode    = "none";

// ─── 存储工具 ─────────────────────────────────────────────────
function saveCodes()     { localStorage.setItem(STORAGE_KEY,  JSON.stringify(FUND_CODES)); }
function savePositions() { localStorage.setItem(POSITION_KEY, JSON.stringify(positions)); }
function saveGroups()    { localStorage.setItem(GROUP_KEY,    JSON.stringify(groups)); }

// ─── 分组工具 ─────────────────────────────────────────────────
function getGroupOfCode(code) {
  for (const [name, codes] of Object.entries(groups)) {
    if (codes.includes(code)) return name;
  }
  return null; // 未分组
}

function getGroupNames() {
  return Object.keys(groups);
}

function addGroup(name) {
  if (!groups[name]) groups[name] = [];
  saveGroups();
}

function deleteGroup(name) {
  delete groups[name];
  saveGroups();
}

function setCodeGroup(code, groupName) {
  // 先从所有组里移除
  for (const key of Object.keys(groups)) {
    groups[key] = groups[key].filter(c => c !== code);
  }
  // 加入目标组（null 表示取消分组）
  if (groupName && groups[groupName]) {
    groups[groupName].push(code);
  }
  saveGroups();
}

// ─── 持仓计算 ─────────────────────────────────────────────────
function calcPosition(code, currentNav) {
  const p = positions[code];
  if (!p || (!p.shares && !p.cost)) return null;
  const shares = parseFloat(p.shares) || 0;
  const cost   = parseFloat(p.cost)   || 0;
  const nav    = parseFloat(currentNav) || 0;
  const currentValue = shares * nav;
  const profit       = currentValue - cost;
  const profitRate   = cost > 0 ? (profit / cost) * 100 : 0;
  return { shares, cost, currentValue, profit, profitRate };
}

// ─── 持仓弹窗 ─────────────────────────────────────────────────
function openPositionModal(code, name) {
  const overlay     = document.getElementById("modalOverlay");
  const modal       = document.getElementById("positionModal");
  const sharesInput = document.getElementById("modalShares");
  const costInput   = document.getElementById("modalCost");

  document.getElementById("modalTitle").textContent = `设置持仓 · ${name}`;
  sharesInput.value = positions[code]?.shares ?? "";
  costInput.value   = positions[code]?.cost   ?? "";

  modal.dataset.code = code;
  overlay.classList.add("show");
  sharesInput.focus();
}

function closePositionModal() {
  document.getElementById("modalOverlay").classList.remove("show");
}

// ─── 分组弹窗 ─────────────────────────────────────────────────
function openGroupPickerModal(code, fundName) {
  const overlay = document.getElementById("groupPickerOverlay");
  const modal   = document.getElementById("groupPickerModal");

  document.getElementById("groupPickerTitle").textContent = `分组 · ${fundName}`;
  modal.dataset.code = code;

  renderGroupPickerList(code);
  overlay.classList.add("show");
}

function closeGroupPickerModal() {
  document.getElementById("groupPickerOverlay").classList.remove("show");
}

function renderGroupPickerList(code) {
  const ul       = document.getElementById("groupPickerList");
  const current  = getGroupOfCode(code);
  const names    = getGroupNames();

  ul.innerHTML = "";

  // 「不分组」选项
  const noneItem = document.createElement("li");
  noneItem.className = "group-pick-item" + (current === null ? " active" : "");
  noneItem.innerHTML = `<span class="group-pick-name">不分组</span>${current === null ? '<span class="group-pick-check">✓</span>' : ""}`;
  noneItem.onclick = () => {
    setCodeGroup(code, null);
    closeGroupPickerModal();
    loadAll();
  };
  ul.appendChild(noneItem);

  names.forEach(name => {
    const li = document.createElement("li");
    li.className = "group-pick-item" + (current === name ? " active" : "");
    li.innerHTML = `<span class="group-pick-name">${name}</span>${current === name ? '<span class="group-pick-check">✓</span>' : ""}`;
    li.onclick = () => {
      setCodeGroup(code, name);
      closeGroupPickerModal();
      loadAll();
    };
    ul.appendChild(li);
  });

  if (names.length === 0) {
    const empty = document.createElement("p");
    empty.className = "group-pick-empty";
    empty.textContent = "暂无分组，请先在「管理分组」中新建";
    ul.appendChild(empty);
  }
}

function openGroupManagerModal() {
  renderGroupManagerList();
  document.getElementById("groupManagerOverlay").classList.add("show");
}

function closeGroupManagerModal() {
  document.getElementById("groupManagerOverlay").classList.remove("show");
}

function renderGroupManagerList() {
  const ul    = document.getElementById("groupManagerList");
  const names = getGroupNames();
  ul.innerHTML = "";

  if (names.length === 0) {
    ul.innerHTML = `<p class="group-pick-empty">暂无分组</p>`;
    return;
  }

  names.forEach(name => {
    const li = document.createElement("li");
    li.className = "group-manager-item";
    li.innerHTML = `
      <span class="group-manager-name">${name}</span>
      <span class="group-manager-count">${groups[name].length} 支</span>
      <button class="group-manager-del">删除</button>
    `;
    li.querySelector(".group-manager-del").onclick = () => {
      deleteGroup(name);
      renderGroupManagerList();
      loadAll();
    };
    ul.appendChild(li);
  });
}

// ─── 渲染迷你图 ───────────────────────────────────────────────
function renderMiniChart(code) {
  const canvas = document.querySelector(`.mini-chart[data-code="${code}"]`);
  if (!canvas) return;
  const data = minuteCache[code];
  if (!data || data.length < 2) return;
  const ctx    = canvas.getContext("2d");
  const values = data.map(d => d.value);
  const color  = values.at(-1) >= values[0] ? "#ff4d4f" : "#18c167";
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: values.map(() => ""),
      datasets: [{ data: values, borderColor: color, borderWidth: 1.5, pointRadius: 0, tension: 0.35 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}

// ─── 渲染卡片 ─────────────────────────────────────────────────
function renderCard(fund) {
  const div      = document.createElement("div");
  div.className  = "card";

  const rate      = parseFloat(fund.gszzl);
  const rateClass = rate >= 0 ? "up" : "down";
  const rateSign  = rate >= 0 ? "+" : "";

  const pos = calcPosition(fund.fundcode, fund.gsz);
  let posHTML = "";
  if (pos) {
    const pc   = pos.profit >= 0 ? "up" : "down";
    const ps   = pos.profit >= 0 ? "+" : "";
    posHTML = `
      <div class="card-position">
        <div class="pos-item"><span class="pos-label">市值</span><span class="pos-val">¥${pos.currentValue.toFixed(2)}</span></div>
        <div class="pos-item"><span class="pos-label">成本</span><span class="pos-val">¥${pos.cost.toFixed(2)}</span></div>
        <div class="pos-item"><span class="pos-label">盈亏</span><span class="pos-val ${pc}">${ps}¥${pos.profit.toFixed(2)}</span></div>
        <div class="pos-item"><span class="pos-label">收益率</span><span class="pos-val ${pc}">${ps}${pos.profitRate.toFixed(2)}%</span></div>
      </div>`;
  }

  const currentGroup = getGroupOfCode(fund.fundcode);
  const groupLabel   = currentGroup ? `🗂️ ${currentGroup}` : "分组";

  div.innerHTML = `
    <div class="card-top">
      <h3 class="card-name">${fund.name}</h3>
      <span class="card-rate ${rateClass}">${rateSign}${fund.gszzl}%</span>
    </div>
    <div class="card-body">
      <div class="card-info">
        <span class="card-value">${fund.gsz}</span>
        <span class="card-time">${fund.gztime}</span>
      </div>
      <div class="card-actions">
        <button class="btn-group">${groupLabel}</button>
        <button class="btn-position">${pos ? "编辑持仓" : "设置持仓"}</button>
        <button class="delete">删除</button>
      </div>
    </div>
    ${posHTML}
    <div class="mini-chart-wrap">
      <canvas class="mini-chart" data-code="${fund.fundcode}"></canvas>
    </div>`;

  div.querySelector(".delete").onclick = (e) => {
    e.stopPropagation();
    FUND_CODES = FUND_CODES.filter(c => c !== fund.fundcode);
    setCodeGroup(fund.fundcode, null);
    saveCodes();
    loadAll();
  };
  div.querySelector(".btn-position").onclick = (e) => {
    e.stopPropagation();
    openPositionModal(fund.fundcode, fund.name);
  };
  div.querySelector(".btn-group").onclick = (e) => {
    e.stopPropagation();
    openGroupPickerModal(fund.fundcode, fund.name);
  };
  div.onclick = () => drawHistory(fund.fundcode, fund.name);

  return div;
}

// ─── 主渲染 ───────────────────────────────────────────────────
function recordMinute(code, value) {
  if (!minuteCache[code]) minuteCache[code] = [];
  const now  = Date.now();
  const last = minuteCache[code].at(-1);
  if (last && now - last.time < 60000) return;
  minuteCache[code].push({ time: now, value });
  if (minuteCache[code].length > MAX_MINUTES) minuteCache[code].shift();
  localStorage.setItem(MINUTE_KEY, JSON.stringify(minuteCache));
}

async function fetchFund(code) {
  const res = await fetch(`/api/fund/${code}`);
  return res.json();
}

async function loadAll() {
  const container = document.getElementById("list");
  container.innerHTML = "加载中...";

  const results = await Promise.allSettled(FUND_CODES.map(code => fetchFund(code)));

  // 按 sortMode 排序
  if (sortMode !== "none") {
    results.sort((a, b) => {
      if (a.status !== "fulfilled" || b.status !== "fulfilled") return 0;
      return sortMode === "asc"
        ? a.value.gszzl - b.value.gszzl
        : b.value.gszzl - a.value.gszzl;
    });
  }

  container.innerHTML = "";

  // 收集有效基金数据
  const funds = results
    .filter(r => r.status === "fulfilled" && !r.value.error)
    .map(r => r.value);

  funds.forEach(fund => recordMinute(fund.fundcode, parseFloat(fund.gsz)));

  // 按分组归类
  const grouped   = {}; // { groupName: fund[] }
  const ungrouped = [];

  funds.forEach(fund => {
    const g = getGroupOfCode(fund.fundcode);
    if (g) {
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(fund);
    } else {
      ungrouped.push(fund);
    }
  });

  // 渲染有分组的基金
  for (const [groupName, groupFunds] of Object.entries(grouped)) {
    const section = document.createElement("div");
    section.className = "group-section";
    section.innerHTML = `<div class="group-header"><span class="group-tag">🗂️ ${groupName}</span></div>`;

    const grid = document.createElement("div");
    grid.className = "group-grid";
    groupFunds.forEach(fund => {
      const card = renderCard(fund);
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  // 渲染未分组的基金
  if (ungrouped.length > 0) {
    // 如果存在分组，则显示「未分组」标题
    if (Object.keys(grouped).length > 0) {
      const section = document.createElement("div");
      section.className = "group-section";
      section.innerHTML = `<div class="group-header"><span class="group-tag group-tag-default">未分组</span></div>`;
      const grid = document.createElement("div");
      grid.className = "group-grid";
      ungrouped.forEach(fund => {
        const card = renderCard(fund);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    } else {
      const grid = document.createElement("div");
      grid.className = "group-grid";
      ungrouped.forEach(fund => {
        const card = renderCard(fund);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    }
  }

  // 渲染迷你图
  funds.forEach(fund => {
    safeCreateChart(`.mini-chart[data-code="${fund.fundcode}"]`, () =>
      renderMiniChart(fund.fundcode)
    );
  });
}

// ─── 历史净值图 ───────────────────────────────────────────────
let historyChart = null;

async function drawHistory(code, name) {
  try {
    const res     = await fetch(`/api/history/${code}`);
    const history = await res.json();
    if (!Array.isArray(history) || history.length === 0) { alert("暂无历史数据"); return; }
    renderHistorySafe(history.map(i => i.time), history.map(i => i.value), name);
  } catch {
    alert("历史数据加载失败，请稍后重试");
  }
}

function renderHistorySafe(labels, values, name) {
  setTimeout(() => {
    if (historyChart) historyChart.destroy();
    const ctx = document.getElementById("chart").getContext("2d");
    historyChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: name, data: values, borderWidth: 2, tension: 0.35, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } },
    });
    setTimeout(() => historyChart.resize(), 200);
  }, 300);
}

// ─── 图表工具 ─────────────────────────────────────────────────
function safeCreateChart(canvasSelector, createFn) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) return;
  waitForVisible(canvas.parentElement, () => {
    const chart = createFn();
    if (chart) setTimeout(() => chart.resize(), 200);
  });
}

function waitForVisible(el, callback, retry = 20) {
  if (!el || retry <= 0) return;
  if (el.offsetHeight > 0) { callback(); }
  else { setTimeout(() => waitForVisible(el, callback, retry - 1), 100); }
}

// ─── DOMContentLoaded ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 持仓弹窗
  document.getElementById("modalCancel").onclick  = closePositionModal;
  document.getElementById("modalOverlay").onclick = closePositionModal;
  document.querySelector("#positionModal").onclick = e => e.stopPropagation();

  document.getElementById("modalClear").onclick = () => {
    const code = document.getElementById("positionModal").dataset.code;
    delete positions[code];
    savePositions();
    closePositionModal();
    loadAll();
  };

  document.getElementById("modalSave").onclick = () => {
    const code   = document.getElementById("positionModal").dataset.code;
    const shares = parseFloat(document.getElementById("modalShares").value);
    const cost   = parseFloat(document.getElementById("modalCost").value);
    if (isNaN(shares) || shares < 0 || isNaN(cost) || cost < 0) { alert("请输入有效的数值"); return; }
    positions[code] = { shares, cost };
    savePositions();
    closePositionModal();
    loadAll();
  };

  // 分组选择弹窗
  document.getElementById("groupPickerOverlay").onclick = closeGroupPickerModal;
  document.getElementById("groupPickerModal").onclick   = e => e.stopPropagation();
  document.getElementById("groupPickerCancel").onclick  = closeGroupPickerModal;

  // 分组管理弹窗
  document.getElementById("groupManagerOverlay").onclick = closeGroupManagerModal;
  document.getElementById("groupManagerModal").onclick   = e => e.stopPropagation();
  document.getElementById("groupManagerClose").onclick   = closeGroupManagerModal;
  document.getElementById("manageGroupBtn").onclick      = openGroupManagerModal;

  document.getElementById("groupManagerAdd").onclick = () => {
    const input = document.getElementById("groupManagerInput");
    const name  = input.value.trim();
    if (!name) { alert("请输入分组名称"); return; }
    if (groups[name]) { alert("分组已存在"); return; }
    addGroup(name);
    input.value = "";
    renderGroupManagerList();
  };

  document.getElementById("groupManagerInput").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("groupManagerAdd").click();
  });

  // ESC 关闭所有弹窗
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closePositionModal();
      closeGroupPickerModal();
      closeGroupManagerModal();
    }
  });

  // 添加基金
  document.getElementById("addBtn").onclick = async () => {
    const input = document.getElementById("codeInput");
    const code  = input.value.trim();
    if (!/^\d{6}$/.test(code))     { alert("请输入 6 位基金代码"); return; }
    if (FUND_CODES.includes(code)) { alert("已存在"); return; }
    try {
      const data = await fetchFund(code);
      if (data.error) { alert("基金不存在或代码无效"); return; }
      FUND_CODES.push(code);
      saveCodes();
      input.value = "";
      loadAll();
    } catch { alert("基金不存在"); }
  };

  // 排序
  document.getElementById("sortBtn").onclick = () => {
    sortMode = sortMode === "none" ? "desc" : sortMode === "desc" ? "asc" : "none";
    loadAll();
  };

  loadAll();
  setInterval(loadAll, 60000);
});
