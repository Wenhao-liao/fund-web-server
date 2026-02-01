// history.js
const https = require("https");

function getHistory(code) {
  return new Promise((resolve, reject) => {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;

    https.get(url, res => {
      let raw = "";

      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          // 提取 Data_netWorthTrend
          const match = raw.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
          if (!match) throw new Error("no history");

          const arr = JSON.parse(match[1]);

          // 转成你前端已经在用的格式
          const history = arr.map(i => ({
            time: new Date(i.x).toISOString().slice(0, 10), // yyyy-mm-dd
            value: i.y
          }));

          resolve(history);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

module.exports = { getHistory };
