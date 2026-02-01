export default async function handler(req, res) {
  const { code } = req.query;

  const url = `https://fundgz.1234567.com.cn/js/${code}.js`;

  const r = await fetch(url);
  const text = await r.text();

  // jsonpgz({...});
  const json = JSON.parse(
    text.replace("jsonpgz(", "").replace(");", "")
  );

  res.setHeader("Cache-Control", "no-store");
  res.json(json);
}
