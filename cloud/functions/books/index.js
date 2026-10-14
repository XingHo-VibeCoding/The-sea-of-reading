/**
 * /api/books —— Day 17 的读接口（HTTP 型 / Web 函数，写法与 Day 15 的 health 同款）
 *
 * 作用：按接口契约（docs/api-contract.md 3.1）返回书单列表，
 *   数据来自 CloudBase SQL 型数据库（PostgreSQL）里 Day 16 建好的 books 表。
 *
 * ⚠️ 为什么不直连数据库：官方社区确认（Issue #953），HTTP 型云函数与
 *   云开发数据库之间不走内网、不支持 VPC，体验版也没有公网直连开关。
 *   所以走官方文档给的唯一通道 —— PostgreSQL 的 HTTP API（PostgREST 风格）：
 *     基地址  https://<envId>.api.tcloudbasegateway.com
 *     查表    GET /v1/rdb/rest/books?select=*&order=createdAt.desc
 *   好处：Node 20 自带 fetch 就能调，本函数零 npm 依赖，控制台部署不用装包。
 *
 * 环境变量（在 CloudBase 控制台函数配置里填，密钥绝不写进代码/仓库，AGENTS.md 五.3）：
 *   PG_API_KEY  数据 API 的 API Key（服务端权限，控制台「数据 API / API Key」处创建）
 *   PG_API_BASE 可选，数据 API 基地址；本地测试时指向假数据源，不配则用线上地址
 *
 * 契约要点：
 *   成功  HTTP 200  { ok: true,  data: { books: [...] } }   按 createdAt 倒序
 *   失败  HTTP 200  { ok: false, error: "人能看懂的中文" }   （契约 1.2）
 *   余力加练：?limit=N 限制返回条数，不传 = 返回全部（守契约 3.1），上限 100
 */

const http = require("http");

const PORT = 9000; // CloudBase HTTP 型函数的默认端口，别改

// ?limit 上限：防止一次拉全表把体验版的小实例拖垮；超过就悄悄按 100 算
const LIMIT_MAX = 100;

// 统一出口：所有响应都带跨域头 —— 前端静态托管域名和本网关域名不同源，
// 浏览器要能读到数据必须带这个头。
// ⚠️ 临时方案：契约原计划 Day 20 在 HTTP 网关的「跨域设置」里做（api-contract.md 第 4 节），
//    届时把下面这行删掉，别留着双份。
function send(res, payload) {
  // ⚠️ 这里故意【不】加 Access-Control-Allow-Origin —— 跨域由 HTTP 网关
  // 路由上的「跨域设置」负责（Day 17 起已启用，实测有效）。
  // 实测坑（Day 17）：函数和网关两边都加时，网关会把两个值拼进同一个头：
  //   access-control-allow-origin: https://静态域名,*
  // 浏览器见到逗号分隔的两个值直接拒绝，页面报 Failed to fetch。
  // 教训：跨域头全站只留一处，放网关（也正是契约第 4 节的原计划，只是提前了）。
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function fail(res, message) {
  send(res, { ok: false, error: message });
}

// ?limit 解析：不传 = 返回全部（undefined）；传了必须是正整数，超 100 按 100 算
function parseLimit(raw) {
  if (raw === null || raw === "") return { limit: undefined };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { error: "limit 必须是正整数，例如 /api/books?limit=5" };
  }
  return { limit: Math.min(n, LIMIT_MAX) };
}

// 调 PostgreSQL 的 HTTP API 查 books 表。
// 驼峰列名（createdAt 等）在库里是带双引号建的（Day 16 铁律），PostgREST 会原样返回这些键。
async function fetchBooks(limit, baseUrl, apiKey) {
  const params = new URLSearchParams({ select: "*", order: "createdAt.desc" });
  if (limit !== undefined) params.set("limit", String(limit));

  const resp = await fetch(`${baseUrl}/v1/rdb/rest/books?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000), // 8 秒超时：数据源卡住时尽快给用户一个明确错误
  });
  if (!resp.ok) {
    throw new Error(`数据源返回 HTTP ${resp.status}`);
  }
  return resp.json(); // PostgREST 查询返回行对象数组
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  // 凭证每次请求时读（而不是启动时读死）：环境变量配置后无需重新部署才生效，
  // 本地测试也能在同一次运行里切换「有/无密钥」两种场景
  const baseUrl = process.env.PG_API_BASE || "https://reading-sea-d7gd8l7o78b7304ae.api.tcloudbasegateway.com";
  const apiKey = process.env.PG_API_KEY || "";

  if (req.method === "GET" && url.pathname === "/api/books") {
    const { limit, error } = parseLimit(url.searchParams.get("limit"));
    if (error) return fail(res, error);
    if (!apiKey) return fail(res, "服务端未配置数据源凭证（环境变量 PG_API_KEY），请联系站长");

    fetchBooks(limit, baseUrl, apiKey)
      .then((rows) => send(res, { ok: true, data: { books: rows } }))
      .catch((err) => {
        const why = err.name === "TimeoutError" ? "请求超时" : err.message;
        fail(res, `数据源暂时不可用：${why}`);
      });
    return;
  }

  fail(res, "未知路径，本服务只提供 GET /api/books");
});

server.listen(PORT, () => {
  console.log(`books function listening on port ${PORT}`);
});
