// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");

const { getFund } = require("./api/fund");
const { getHistory } = require("./api/history");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ① 托管前端
app.use(express.static(path.join(__dirname, "public")));

// ② 实时估值接口
app.get("/api/fund/:code", async (req, res) => {
  try {
    const data = await getFund(req.params.code);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "基金代码无效或接口异常" });
  }
});

// ③ 历史净值接口
app.get("/api/history/:code", async (req, res) => {
  try {
    const data = await getHistory(req.params.code);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "历史数据获取失败" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
