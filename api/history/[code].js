export default async function handler(req, res) {
  const { code } = req.query;

  const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;

  const r = await fetch(url);
  const text = await r.text();

  // 把 js 文件变成可执行
  const sandbox = {};
  const script = new Function(
    "window",
    text + "; return { Data_netWorthTrend };"
  );

  const { Data_netWorthTrend } = script(sandbox);

  // 转成你前端要的结构
  const data = Data_netWorthTrend.map(item => ({
    time: new Date(item.x).toLocaleDateString(),
    value: item.y
  }));

  res.setHeader("Cache-Control", "no-store");
  res.json(data);
}
