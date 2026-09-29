/* ============================================================================
 * home.js —— 主视图（三栏看板）· mock 数据版
 *
 * 依据
 *   docs/day8-prompt.md  （本页的生成提示词，一~五节）
 *   docs/PRD.md 4.2      （书籍字段：status / currentPage / totalPages ……）
 *
 * 本版的特点
 *   数据是写死在页面里的假数据（MOCK_BOOKS），不读 localStorage、不联网。
 *   第 3 周接真实数据源时，只改 fetchBooks() 这一个函数，别处一行不动。
 *
 * 四种页面状态（本页重点）
 *   加载中 → 成功 → 空 → 错误，四条路径都要能走到。
 *   想亲手验证「空」和「错误」怎么改，见 fetchBooks() 上方和 MOCK_BOOKS 上方的注释。
 * ========================================================================== */

(function () {
  'use strict';

  /* ============================================================ 一、假数据 */

  /*
   * 本期数据就写在这里。
   *   · 要验「空状态」：把下面这个数组整个改成 []，保存后刷新页面
   *   · 每本书的字段名与取值都跟 PRD 4.2 一致，别改（status 只有三个值）
   *   · coverUrl 一律留空 —— 本页要求零外部请求，不放外链图片，
   *     封面位一律用「书名第一个字」的占位块。想看图片效果，给某本填个网址即可。
   *   · 「想读」特意放了 6 本，超过每栏 5 条的上限，这样才能看到「还有 N 本」那行提示
   */
  var MOCK_BOOKS = [
    {
      id: 'b_001',
      title: '三体',
      author: '刘慈欣',
      coverUrl: '',
      status: 'reading',
      totalPages: 320,
      currentPage: 120,          // 120 ÷ 320 = 38%
      startedAt: '2026-09-20T02:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-09-18T01:00:00.000Z',
      updatedAt: '2026-09-28T13:20:00.000Z'
    },
    {
      id: 'b_002',
      title: '活着',
      author: '余华',
      coverUrl: '',
      status: 'finished',
      totalPages: 200,
      currentPage: 200,
      startedAt: '2026-09-10T02:00:00.000Z',
      finishedAt: '2026-09-17T12:00:00.000Z',
      createdAt: '2026-09-09T01:00:00.000Z',
      updatedAt: '2026-09-17T12:00:00.000Z'
    },
    {
      id: 'b_003',
      title: '人类简史',
      author: '尤瓦尔·赫拉利',
      coverUrl: '',
      status: 'want',
      totalPages: 440,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-26T01:00:00.000Z',
      updatedAt: '2026-09-26T01:00:00.000Z'
    },
    {
      id: 'b_004',
      title: '百年孤独',
      author: '加西亚·马尔克斯',
      coverUrl: '',
      status: 'want',
      totalPages: 360,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-25T01:00:00.000Z',
      updatedAt: '2026-09-25T01:00:00.000Z'
    },
    {
      id: 'b_005',
      title: '时间简史',
      author: '',                // 故意没填作者 —— 页面应显示「未填作者」
      coverUrl: '',
      status: 'reading',
      totalPages: 260,
      currentPage: 65,           // 65 ÷ 260 = 25%
      startedAt: '2026-09-22T02:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-09-21T01:00:00.000Z',
      updatedAt: '2026-09-27T15:00:00.000Z'
    },
    {
      id: 'b_006',
      title: '夜航西飞',
      author: '柏瑞尔·马卡姆',
      coverUrl: '',
      status: 'want',
      totalPages: 300,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-24T01:00:00.000Z',
      updatedAt: '2026-09-24T01:00:00.000Z'
    },
    {
      id: 'b_007',
      title: '沙丘',
      author: '弗兰克·赫伯特',
      coverUrl: '',
      status: 'want',
      totalPages: 520,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-23T01:00:00.000Z',
      updatedAt: '2026-09-23T01:00:00.000Z'
    },
    {
      id: 'b_008',
      title: '银河系漫游指南',
      author: '道格拉斯·亚当斯',
      coverUrl: '',
      status: 'want',
      totalPages: 280,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-22T01:00:00.000Z',
      updatedAt: '2026-09-22T01:00:00.000Z'
    },
    {
      id: 'b_009',
      title: '克拉拉与太阳',
      author: '石黑一雄',
      coverUrl: '',
      status: 'want',
      totalPages: 400,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-09-21T01:00:00.000Z',
      updatedAt: '2026-09-21T01:00:00.000Z'
    },
    {
      id: 'b_010',
      title: '小王子',
      author: '圣埃克苏佩里',
      coverUrl: '',
      status: 'finished',
      totalPages: null,          // 没填总页数 → 已读的书照样显示「已读完」
      currentPage: null,
      startedAt: '2026-09-01T02:00:00.000Z',
      finishedAt: '2026-09-05T12:00:00.000Z',
      createdAt: '2026-08-30T01:00:00.000Z',
      updatedAt: '2026-09-05T12:00:00.000Z'
    }
  ];

  /* 每栏最多显示几条；超出的在栏底用一行字交代，不做滚动、不做翻页 */
  var MAX_PER_COLUMN = 5;

  /* 三栏与状态值的对应关系，顺序就是页面上的左右顺序 */
  var COLUMNS = ['want', 'reading', 'finished'];

  /* ============================================================ 二、取数据 */

  /**
   * 全页唯一的取数入口。第 3 周接真实数据源时，只改这个函数。
   * 回调参数：{ ok: true, data: [...] } 或 { ok: false, error: '中文提示' }
   */
  function fetchBooks(callback) {
    /*
     * 人为延迟 0.8 秒。真实数据源不会瞬间返回，
     * 不延迟的话「正在读取…」根本来不及出现，那条状态就白做了。
     *
     * 要验「错误状态」：把下面那行 return 的注释去掉（删掉行首的两个斜杠），
     * 保存后刷新 —— 会先闪一下「正在读取…」，再显示错误提示 + 重试按钮。
     * （失败也走同一条延迟，跟真实的网络出错一样，不会跳过加载中。）
     */
    setTimeout(function () {
      // return callback({ ok: false, error: '读取书架数据失败（这是模拟出来的错误）' });
      callback({ ok: true, data: MOCK_BOOKS });
    }, 800);
  }

  /* ============================================================ 三、小工具 */

  function byId(id) {
    return document.getElementById(id);
  }

  /** 书名第一个字，用作没有封面时的占位（PRD AC-4） */
  function firstChar(title) {
    var chars = Array.from(String(title || '').trim());
    return chars.length ? chars[0] : '书';
  }

  /** 作者：没填就写「未填作者」，不留空 */ 
  function authorText(book) {
    var a = String(book.author || '').trim();
    return a || '未填作者';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** 2026 年 9 月 29 日 11:30 */
  function formatDateTime(ms) {
    var d = new Date(ms);
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' +
           pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function parseTime(v) {
    var t = Date.parse(String(v || ''));
    return isNaN(t) ? null : t;
  }

  /**
   * 右侧那格显示什么（PRD 4.2 的派生值）：
   *   已读 → 已读完    想读 → 未开始
   *   在读 → 百分比 = currentPage ÷ totalPages，四舍五入到整数
   *          没填总页数时退一步显示「第 N 页」，实在没有就显示「在读」
   */
  function progressOf(book) {
    if (book.status === 'finished') {
      return { text: '已读完', isNone: false };
    }
    if (book.status === 'want') {
      return { text: '未开始', isNone: true };
    }

    var cur = Number(book.currentPage);
    var total = Number(book.totalPages);
    var hasCur = book.currentPage !== null && book.currentPage !== undefined && isFinite(cur);
    var hasTotal = book.totalPages !== null && book.totalPages !== undefined &&
                   isFinite(total) && total > 0;

    if (hasCur && hasTotal) {
      return { text: Math.round(cur / total * 100) + '%', isNone: false };
    }
    if (hasCur) {
      return { text: '第 ' + cur + ' 页', isNone: false };
    }
    return { text: '在读', isNone: false };
  }

  /** 这份数据里最新的一次改动时间；一本都没有就返回 null */
  function latestUpdated(books) {
    var max = null;
    books.forEach(function (book) {
      var t = parseTime(book.updatedAt);
      if (t !== null && (max === null || t > max)) max = t;
    });
    return max;
  }

  /* ============================================================ 四、渲染 */

  var el = {
    updatedAt:    byId('updated-at'),
    stateLoading: byId('state-loading'),
    stateSuccess: byId('state-success'),
    stateEmpty:   byId('state-empty'),
    stateError:   byId('state-error'),
    errorText:    byId('error-text'),
    btnRetry:     byId('btn-retry')
  };

  /** 四个状态同一时刻只显示一个 */
  function showState(name) {
    el.stateLoading.hidden = (name !== 'loading');
    el.stateSuccess.hidden = (name !== 'success');
    el.stateEmpty.hidden   = (name !== 'empty');
    el.stateError.hidden   = (name !== 'error');
  }

  /** 往封面位里放图；没网址、或图加载失败，都回退成书名首字（PRD AC-4 / AC-5） */
  function fillCover(box, book) {
    box.textContent = '';
    var url = String(book.coverUrl || '').trim();

    if (!url) {
      box.textContent = firstChar(book.title);
      return;
    }

    var img = document.createElement('img');
    img.alt = '';
    img.onerror = function () {
      box.textContent = firstChar(book.title);   // 不留破图
    };
    img.src = url;
    box.appendChild(img);
  }

  /** 一条书：序号 · 封面 · 书名+作者 · 进度 */
  function buildRow(book, index) {
    var row = document.createElement('li');
    row.className = 'book-row';

    var idx = document.createElement('span');
    idx.className = 'row-index';
    idx.textContent = String(index + 1);          // 序号只是"看得见的顺序"，不是 id
    row.appendChild(idx);

    var cover = document.createElement('span');
    cover.className = 'row-cover';
    fillCover(cover, book);
    row.appendChild(cover);

    var main = document.createElement('span');
    main.className = 'row-main';

    var title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = book.title;

    var author = document.createElement('span');
    author.className = 'row-author';
    author.textContent = authorText(book);

    main.appendChild(title);
    main.appendChild(author);
    row.appendChild(main);

    var prog = progressOf(book);
    var right = document.createElement('span');
    right.className = 'row-progress' + (prog.isNone ? ' is-none' : '');
    right.textContent = prog.text;
    row.appendChild(right);

    return row;
  }

  /** 渲染一栏：本栏的书按 updatedAt 倒序，只取前 5 条 */
  function renderColumn(status, books) {
    var list = byId('list-' + status);
    var more = byId('more-' + status);
    var none = byId('none-' + status);

    list.textContent = '';

    var mine = books.filter(function (book) { return book.status === status; });
    mine.sort(function (a, b) {
      var ta = parseTime(a.updatedAt) || 0;
      var tb = parseTime(b.updatedAt) || 0;
      return tb - ta;                             // 最近有动静的排最前
    });

    mine.slice(0, MAX_PER_COLUMN).forEach(function (book, i) {
      list.appendChild(buildRow(book, i));
    });

    var rest = mine.length - MAX_PER_COLUMN;
    if (rest > 0) {
      more.textContent = '还有 ' + rest + ' 本';
      more.hidden = false;
    } else {
      more.textContent = '';
      more.hidden = true;
    }

    // 本栏为空时给一行字，不留空白
    none.hidden = (mine.length !== 0);
  }

  /** 渲染三栏，并在顶部写上数据的更新时间 */
  function renderColumns(books) {
    COLUMNS.forEach(function (status) {
      renderColumn(status, books);
    });

    var latest = latestUpdated(books);
    el.updatedAt.textContent = '数据更新于 ' +
      formatDateTime(latest === null ? Date.now() : latest);
  }

  /* ============================================================ 五、主流程 */

  function load() {
    showState('loading');

    fetchBooks(function (res) {
      if (!res || !res.ok) {
        el.errorText.textContent = (res && res.error) ? res.error : '读取书架失败了，原因不明。';
        showState('error');
        return;
      }

      var books = res.data || [];
      if (books.length === 0) {
        showState('empty');
        return;
      }

      renderColumns(books);
      showState('success');
    });
  }

  /* ============================================================ 六、启动 */

  el.btnRetry.addEventListener('click', load);

  load();

})();
