// fund.js
const https = require("https");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getFund(code) {
  return new Promise((resolve, reject) => {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;

    const options = {
      headers: {
        "User-Agent": UA,
        "Referer": "https://fund.eastmoney.com/",
      }
    };

    https.get(url, options, res => {
      let raw = "";

      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          // 返回格式：jsonpgz({...});
          const jsonStr = raw.match(/\((.*)\)/)[1];
          const data = JSON.parse(jsonStr);

          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

module.exports = { getFund };
