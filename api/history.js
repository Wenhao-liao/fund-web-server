// history.js
const https = require("https");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getHistory(code) {
  return new Promise((resolve, reject) => {
    // 使用东方财富官方 JSON 接口，获取最近 120 条历史净值
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&page=1&sdate=&edate=&per=120&callback=`;

    const options = {
      headers: {
        "User-Agent": UA,
        "Referer": `https://fund.eastmoney.com/f10/jjjz_${code}.html`,
      }
    };

    https.get(url, options, res => {
      let raw = "";

      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          const list = json?.Data?.LSJZList;

          if (!Array.isArray(list) || list.length === 0) {
            throw new Error("no history data");
          }

          // 接口返回最新在前，翻转为时间升序
          const history = list.reverse().map(item => ({
            time:  item.FSRQ,        // yyyy-MM-dd
            value: parseFloat(item.DWJZ), // 单位净值
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
