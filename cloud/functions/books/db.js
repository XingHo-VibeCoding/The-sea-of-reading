/**
 * db.js —— 数据访问层（Day 19 从 index.js 拆出）
 *
 * 这个文件只干一件事：和数据库说话。
 * 上层的 index.js（接口层）收请求、做校验，需要数据时调这里的函数；
 * 它不需要知道数据存在哪、怎么取的——哪天换存储方式，只改这个文件。
 *
 * ⚠️ 为什么不直连数据库：官方社区确认（Issue #953），HTTP 型云函数与
 *   云开发数据库之间不走内网、不支持 VPC，体验版也没有公网直连开关。
 *   所以走官方文档给的唯一通道 —— PostgreSQL 的 HTTP API（PostgREST 风格）：
 *     基地址  https://<envId>.api.tcloudbasegateway.com
 *     查表    GET  /v1/rdb/rest/books?select=*&order=createdAt.desc
 *     插入    POST /v1/rdb/rest/books   （body 就是要插入的那一行，HTTP 201 = 插入成功）
 *   好处：Node 20 自带 fetch 就能调，本函数零 npm 依赖，控制台部署不用装包。
 *
 * Day 19 分层约定：
 *   - 这里的函数【不做】输入校验——那是接口层（index.js）的职责，分层后各管各的；
 *   - 这里的函数【会】抛错——超时、数据源不可用都 throw，由接口层 catch 后
 *     转成人能看懂的中文返回（错误翻译成什么样，属于「和人说话」，不归这层管）。
 *
 * 凭证说明：baseUrl 和 apiKey 由调用方传进来（index.js 每次请求时从环境变量读）。
 * 密钥只放环境变量（AGENTS.md 五.3），绝不写进代码/仓库。
 *
 * 读表的铁律（Day 16 定）：books 表的列名是驼峰（createdAt 等），
 * PostgREST 会原样返回这些键；title/author 全小写无此问题。
 */

// 统一的请求超时：8 秒。数据源卡住时尽快抛错，
// 让上层给用户一个明确提示，而不是让请求干等到底。
const REQUEST_TIMEOUT_MS = 8000;

// 读：查 books 表，按创建时间倒序。limit 不传 = 返回全部。
async function fetchBooks(limit, baseUrl, apiKey) {
  const params = new URLSearchParams({ select: "*", order: "createdAt.desc" });
  if (limit !== undefined) params.set("limit", String(limit));

  const resp = await fetch(`${baseUrl}/v1/rdb/rest/books?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`数据源返回 HTTP ${resp.status}`);
  }
  return resp.json(); // PostgREST 查询返回行对象数组
}

// 查重：把现有书的 title/author 拉回来逐条比对。
// 书单表很小（个位数到几十行），不值得为此造复杂查询；中文书名放 URL
// 参数里还要做编码，多一个坑，所以选「全拉回来在内存里比」。
// 口径（大帅拍板）：书名+作者都相同（trim 后）即算重复，其他字段不管——
// 同一本书补了封面再存也会被拒。
async function findDuplicate(title, author, baseUrl, apiKey) {
  const params = new URLSearchParams({ select: "id,title,author" });
  const resp = await fetch(`${baseUrl}/v1/rdb/rest/books?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`数据源返回 HTTP ${resp.status}`);
  }
  const rows = await resp.json();
  return rows.find(
    (r) => r.title.trim() === title && (r.author || "").trim() === author
  );
}

// 写：往 books 表插一行。row 就是要插入的行对象（键=驼峰列名），
// HTTP 201 Created = 插入成功（PostgREST 约定）。
async function insertBook(row, baseUrl, apiKey) {
  const resp = await fetch(`${baseUrl}/v1/rdb/rest/books`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`数据源返回 HTTP ${resp.status}`);
  }
}

module.exports = { fetchBooks, findDuplicate, insertBook };
