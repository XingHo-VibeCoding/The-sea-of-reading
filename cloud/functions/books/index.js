/**
 * /api/books —— 书单接口（HTTP 型 / Web 函数，写法与 Day 15 的 health 同款）
 *
 * Day 17：GET  读书单列表（契约 3.1）
 * Day 18：POST 新增一本书（契约 3.2）——本函数第一次拥有「写入真库」的能力
 *
 * ⚠️ 为什么不直连数据库：官方社区确认（Issue #953），HTTP 型云函数与
 *   云开发数据库之间不走内网、不支持 VPC，体验版也没有公网直连开关。
 *   所以走官方文档给的唯一通道 —— PostgreSQL 的 HTTP API（PostgREST 风格）：
 *     基地址  https://<envId>.api.tcloudbasegateway.com
 *     查表    GET  /v1/rdb/rest/books?select=*&order=createdAt.desc
 *     插入    POST /v1/rdb/rest/books   （body 就是要插入的那一行，HTTP 201 = 插入成功）
 *   好处：Node 20 自带 fetch 就能调，本函数零 npm 依赖，控制台部署不用装包。
 *
 * 环境变量（在 CloudBase 控制台函数配置里填，密钥绝不写进代码/仓库，AGENTS.md 五.3）：
 *   PG_API_KEY  数据 API 的 API Key（服务端权限，控制台「数据 API / API Key」处创建）
 *   PG_API_BASE 可选，数据 API 基地址；本地测试时指向假数据源，不配则用线上地址
 *
 * 契约要点（docs/api-contract.md 1.2 / 3.1 / 3.2）：
 *   成功  HTTP 200  { ok: true,  data: { ... } }
 *   失败  HTTP 200  { ok: false, error: "人能看懂的中文" }   前端只看 ok 字段
 *
 * Day 18 主题——服务端为什么要自己校验：
 *   前端表单的校验可以被绕过（用 curl 直接打接口就绕过了），
 *   所以「缺必填字段」「非法值」「重复提交」必须在服务端再挡一遍。
 *   本函数防两类问题：
 *     ① 错误输入：书名为空 / status 不在三值白名单 / 页数不是非负整数
 *     ② 重复提交：书名+作者都相同（trim 后）的书已存在 → 拒绝再插一行
 *   每种拦截都有一条可复现的测试（见 journal 或 Day 18 验证记录）。
 */

const http = require("http");
// 数据访问层（Day 19 拆分）：所有查库/写库的操作都在 db.js，
// 本文件只负责「收请求 → 校验 → 调 db → 回 JSON」，不再直接 fetch 数据库。
const db = require("./db");

const PORT = 9000; // CloudBase HTTP 型函数的默认端口，别改

// ?limit 上限：防止一次拉全表把体验版的小实例拖垮；超过就悄悄按 100 算
const LIMIT_MAX = 100;

// status 全局只有这三个值（契约 1.3），白名单之外的都拒收
const STATUS_WHITELIST = ["want", "reading", "finished"];

// 请求体大小上限（100KB）：一本书的信息用不了这么大，
// 超过基本是恶意/异常请求，直接拒收省得白耗内存
const BODY_MAX_BYTES = 100 * 1024;

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

// 余力加练（Day 18）：每次请求留一行服务端日志。
// 部署后在控制台「函数 → 日志」里能看到，以后排查「用户说接口不对」时
// 先看这里：请求到底进没进来、走到了哪个分支。
function log(method, path, result, extra) {
  const line = `[books] ${method} ${path} -> ${result}${extra ? " | " + extra : ""}`;
  console.log(line);
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

// ---------- Day 18：请求体读取 ----------

// HTTP 型函数的请求体不是现成给的，要从流里一块块收。
// 包成 Promise 是为了让下面能用 async/await 顺序写，不嵌套回调。
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_MAX_BYTES) {
        reject(new Error("请求体太大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ---------- Day 18：输入校验（服务端门卫） ----------

// 把请求 body 洗成一行能入库的数据；不合格就返回中文错误。
// 返回 { row } 或 { error }，调用方只看有没有 error。
function validateBookInput(body) {
  // ---- title：必填 ----
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return { error: "书名不能为空" };
  }

  // ---- status：缺省 want，白名单校验 ----
  let status = body.status;
  if (status === undefined) status = "want";
  if (!STATUS_WHITELIST.includes(status)) {
    return { error: "阅读状态只能是 want、reading 或 finished" };
  }

  // ---- author / coverUrl：可空，缺省空串（与建表 DEFAULT '' 一致）----
  let author = body.author === undefined ? "" : body.author;
  let coverUrl = body.coverUrl === undefined ? "" : body.coverUrl;
  if (typeof author !== "string") return { error: "作者必须是文本" };
  if (typeof coverUrl !== "string") return { error: "封面地址必须是文本" };

  // ---- totalPages / currentPage：可空，传了必须是非负整数 ----
  // （页数以后要参与进度计算 currentPage/totalPages，非数字没法算）
  function parsePage(value, label) {
    if (value === undefined || value === null) return { value: null };
    if (!Number.isInteger(value) || value < 0) {
      return { error: `${label}必须是非负整数` };
    }
    return { value };
  }
  const total = parsePage(body.totalPages, "总页数");
  if (total.error) return total;
  const current = parsePage(body.currentPage, "当前页码");
  if (current.error) return current;

  // trim 收尾：存进库的统一去掉首尾空格，查重比对也基于 trim 后的值
  return {
    row: {
      title: body.title.trim(),
      author: author.trim(),
      coverUrl: coverUrl.trim(),
      status,
      totalPages: total.value,
      currentPage: current.value,
    },
  };
}

// 后端生成 id（契约 1.3：id 由后端生成，前端不指定）。
// 时间戳(base36)保证趋势唯一，随机段防同一毫秒内的碰撞，总长不超 VARCHAR(40)。
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 数据访问层已拆到 db.js（Day 19） ----------
// 原 fetchBooks / findDuplicate / insertBook 三个函数原样搬去 db.js，
// 本文件通过文件开头的 require("./db") 调用，函数体一行逻辑没改。

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  // 凭证每次请求时读（而不是启动时读死）：环境变量配置后无需重新部署才生效，
  // 本地测试也能在同一次运行里切换「有/无密钥」两种场景
  const baseUrl = process.env.PG_API_BASE || "https://reading-sea-d7gd8l7o78b7304ae.api.tcloudbasegateway.com";
  const apiKey = process.env.PG_API_KEY || "";

  // ---------- GET /api/books（Day 17，逻辑不动） ----------
  if (req.method === "GET" && url.pathname === "/api/books") {
    const { limit, error } = parseLimit(url.searchParams.get("limit"));
    if (error) {
      log("GET", "/api/books", "400", error);
      return fail(res, error);
    }
    if (!apiKey) {
      log("GET", "/api/books", "500", "缺少 PG_API_KEY");
      return fail(res, "服务端未配置数据源凭证（环境变量 PG_API_KEY），请联系站长");
    }

    db.fetchBooks(limit, baseUrl, apiKey)
      .then((rows) => {
        log("GET", "/api/books", "200", `返回 ${rows.length} 本`);
        send(res, { ok: true, data: { books: rows } });
      })
      .catch((err) => {
        const why = err.name === "TimeoutError" ? "请求超时" : err.message;
        log("GET", "/api/books", "500", why);
        fail(res, `数据源暂时不可用：${why}`);
      });
    return;
  }

  // ---------- POST /api/books（Day 18 新增） ----------
  if (req.method === "POST" && url.pathname === "/api/books") {
    readBody(req)
      .then((raw) => {
        // 第 1 关：必须是合法 JSON
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          fail(res, "请求体不是合法的 JSON");
          log("POST", "/api/books", "400", "JSON 解析失败");
          return;
        }

        // 第 2 关：字段校验（缺书名 / 非法 status / 非法页数都在这被拒）
        const { row, error } = validateBookInput(body);
        if (error) {
          fail(res, error);
          log("POST", "/api/books", "400", error);
          return;
        }

        if (!apiKey) {
          fail(res, "服务端未配置数据源凭证（环境变量 PG_API_KEY），请联系站长");
          log("POST", "/api/books", "500", "缺少 PG_API_KEY");
          return;
        }

        // 第 3 关：查重（书名+作者相同 → 拒绝，防重复提交）
        db.findDuplicate(row.title, row.author, baseUrl, apiKey)
          .then((dup) => {
            if (dup) {
              fail(res, "这本书已经在书单里了，不用重复添加");
              log("POST", "/api/books", "409", `重复：命中 ${dup.id}`);
              return;
            }

            // 三关全过：补上后端生成的 id 和时间戳，插库
            const book = {
              id: newId("book"),
              ...row,
              startedAt: null,
              finishedAt: null,
              createdAt: new Date().toISOString(),
            };
            db.insertBook(book, baseUrl, apiKey)
              .then(() => {
                log("POST", "/api/books", "200", `新增 ${book.id}《${book.title}》`);
                // 契约 3.2：返回 { ok: true, data: { book: {...} } }
                send(res, { ok: true, data: { book } });
              })
              .catch((err) => {
                const why = err.name === "TimeoutError" ? "请求超时" : err.message;
                fail(res, `写入失败，数据源暂时不可用：${why}`);
                log("POST", "/api/books", "500", why);
              });
          })
          .catch((err) => {
            const why = err.name === "TimeoutError" ? "请求超时" : err.message;
            fail(res, `数据源暂时不可用：${why}`);
            log("POST", "/api/books", "500", why);
          });
      })
      .catch((err) => {
        fail(res, err.message === "请求体太大" ? "请求体太大，请减小内容后重试" : "读取请求失败");
        log("POST", "/api/books", "400", err.message);
      });
    return;
  }

  // 备注：浏览器跨域 POST 会先发 OPTIONS 预检（网关跨域设置已覆盖，函数不用管）。
  fail(res, "未知路径，本服务只提供 GET /api/books 和 POST /api/books");
  log(req.method, url.pathname, "404", "未知路径");
});

server.listen(PORT, () => {
  console.log(`books function listening on port ${PORT}`);
});
