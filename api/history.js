// history.js
const https = require("https");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 通用 https GET，返回 { statusCode, body }，自动跟随一次重定向，8s 超时
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

// 解析东方财富通用历史净值格式（纯 JSON 或 JSONP）
function parseEMBody(raw) {
  let json;
  // 先尝试直接 JSON.parse
  try {
    json = JSON.parse(raw);
  } catch (_) {
    // 去掉 JSONP 包装再试：jQuery123({...}) 或 jQuery({...})
    const stripped = raw.trim().replace(/^[^(]+\(/, "").replace(/\);?\s*$/, "");
    json = JSON.parse(stripped);
  }
  const list = json?.Data?.LSJZList;
  if (!Array.isArray(list) || list.length === 0) throw new Error("empty list");
  // 接口返回最新在前，翻转为时间升序
  return list.reverse().map(item => ({
    time:  item.FSRQ,
    value: parseFloat(item.DWJZ),
  }));
}

// 接口1：api.fund.eastmoney.com（纯 JSON，本地通常正常，服务器可能被拦）
async function trySource1(code) {
  const { statusCode, body } = await httpGet(
    `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&page=1&sdate=&edate=&per=120&callback=`,
    { "Referer": `https://fund.eastmoney.com/f10/jjjz_${code}.html` }
  );
  if (statusCode !== 200) throw new Error(`s1 status ${statusCode}`);
  return parseEMBody(body);
}

// 接口2：j4.fund.eastmoney.com JSONP（对服务器 IP 限制较宽松）
async function trySource2(code) {
  const { statusCode, body } = await httpGet(
    `https://j4.fund.eastmoney.com/lsjz/GetLSJZList?fundCode=${code}&pageIndex=1&pageSize=120&startDate=&endDate=&callback=jQuery`,
    { "Referer": `https://fundf10.eastmoney.com/jjjz_${code}.html` }
  );
  if (statusCode !== 200) throw new Error(`s2 status ${statusCode}`);
  return parseEMBody(body);
}

// 自动降级：依次尝试各接口，全部失败才抛错
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
