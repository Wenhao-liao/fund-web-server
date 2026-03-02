// history.js
const https = require("https");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 通用 https GET，自动跟随一次重定向，8s 超时
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, ...headers } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let raw = "";
      res.on("data", chunk => (raw += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, body: raw }));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// 接口1：fundf10.eastmoney.com HTML 表格接口（服务器可用，用正则提取）
// 返回格式：var apidata={ content:"<table>...</table>", ...}
async function trySource1(code) {
  const { statusCode, body } = await httpGet(
    `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=120`,
    { "Referer": `https://fundf10.eastmoney.com/jjjz_${code}.html` }
  );
  if (statusCode !== 200) throw new Error(`s1 status ${statusCode}`);

  // 从 <tbody> 中提取每行 <tr><td>日期</td><td>净值</td>...
  const rows = [];
  const trReg = /<tr>([\s\S]*?)<\/tr>/g;
  const tdReg = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let tr;
  while ((tr = trReg.exec(body)) !== null) {
    const cells = [];
    let td;
    const rowHtml = tr[1];
    while ((td = tdReg.exec(rowHtml)) !== null) {
      // 去掉内嵌标签，只保留文本
      cells.push(td[1].replace(/<[^>]+>/g, "").trim());
    }
    // cells[0] = 日期 yyyy-MM-dd，cells[1] = 单位净值
    if (cells.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(cells[0])) {
      const value = parseFloat(cells[1]);
      if (!isNaN(value)) rows.push({ time: cells[0], value });
    }
  }

  if (rows.length === 0) throw new Error("s1 empty");
  // 接口返回最新在前，翻转为升序
  return rows.reverse();
}

// 接口2：api.fund.eastmoney.com 纯 JSON（本地可用，服务器可能被拦，作为备用）
async function trySource2(code) {
  const { statusCode, body } = await httpGet(
    `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&page=1&sdate=&edate=&per=120&callback=`,
    { "Referer": `https://fund.eastmoney.com/f10/jjjz_${code}.html` }
  );
  if (statusCode !== 200) throw new Error(`s2 status ${statusCode}`);
  const json = JSON.parse(body);
  const list = json?.Data?.LSJZList;
  if (!Array.isArray(list) || list.length === 0) throw new Error("s2 empty");
  return list.reverse().map(item => ({
    time:  item.FSRQ,
    value: parseFloat(item.DWJZ),
  }));
}

// 自动降级：依次尝试各接口
async function getHistory(code) {
  const sources = [trySource1, trySource2];
  let lastErr;
  for (const fn of sources) {
    try {
      return await fn(code);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

module.exports = { getHistory };
