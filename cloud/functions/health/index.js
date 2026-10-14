/**
 * /api/health —— Day 15 的第一个云函数（HTTP 型 / Web 函数）
 *
 * 作用：证明「代码能部署到 CloudBase 并被公网访问」。
 * 刻意保持最小：不连数据库、不写任何业务逻辑，只返回一个固定形状的 JSON。
 * 返回的 service 名 = 项目英文名，验证时核对它，确认访问的是自己部署的代码。
 *
 * 这是 CloudBase 的「HTTP 型云函数」模板写法：函数内部起一个 HTTP 服务，
 * HTTP 网关把公网请求直接转发到这个服务（端口 9000，与模板 scf_bootstrap 一致）。
 */

const http = require("http");

const PORT = 9000; // CloudBase HTTP 型函数的默认端口，别改

const server = http.createServer((req, res) => {
  // 任何路径/方法都返回同样的健康信息（health 不需要区分）
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      ok: true,
      service: "whale-fall-letters",
      time: new Date().toISOString(),
    })
  );
});

server.listen(PORT, () => {
  console.log(`health function listening on port ${PORT}`);
});
