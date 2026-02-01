// fund.js
const https = require("https");

function getFund(code) {
  return new Promise((resolve, reject) => {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;

    https.get(url, res => {
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
