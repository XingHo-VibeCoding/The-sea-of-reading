/* ============================================================================
 * app.js —— 界面层（第一部分：书单管理）
 *
 * 依据
 *   docs/TECH_DESIGN.md 2.6（代码分成几块）、2.7（三个视图怎么切）
 *   docs/PRD.md 3.1（书单管理的动作/结果/边界）、4.1（页面必备元素）
 *
 * 范围（对应验收标准 AC-1 ~ AC-18）
 *   书单管理：添加 / 编辑 / 删除书籍（删除时连带删笔记的确认）、
 *             三态切换、状态筛选、空状态、封面与首字占位 …… AC-1 ~ AC-10
 *   阅读进度：录入当前页、百分比实时算、改「已读」即显示「读完」… AC-11 ~ AC-14
 *   读书笔记：写 / 改 / 删，只属于所属那本书 ………………… AC-15 ~ AC-18
 *
 * 进度相关的两条实现约定
 *   1. 百分比不存进数据，每次按 currentPage ÷ totalPages 现算
 *      （TECH_DESIGN 2.5 / PRD 4.2「派生值」）
 *   2. 状态为「想读」时进度区整块隐藏；为「已读」时不显示录入框，
 *      因为那时进度就是「读完」（PRD 3.2 可观察结果）
 *
 * 一条硬约束（TECH_DESIGN 2.11）
 *   本文件是普通脚本，不能用 import / export。原因：用模块方式打开会白屏。
 * ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------ 元素引用 */

  function byId(id) { return document.getElementById(id); }

  var el = {
    appError: byId('app-error'),

    viewList: byId('view-list'),
    viewDetail: byId('view-detail'),

    btnAddBook: byId('btn-add-book'),
    btnAddFirst: byId('btn-add-first'),
    filters: byId('filters'),
    bookList: byId('book-list'),
    emptyState: byId('empty-state'),
    filterEmpty: byId('filter-empty'),
    filterEmptyText: byId('filter-empty-text'),
    btnShowAll: byId('btn-show-all'),

    btnBack: byId('btn-back'),
    btnEditBook: byId('btn-edit-book'),
    btnDeleteBook: byId('btn-delete-book'),
    detailCover: byId('detail-cover'),
    detailTitle: byId('detail-title'),
    detailAuthor: byId('detail-author'),
    detailStatus: byId('detail-status'),
    detailFinished: byId('detail-finished'),

    // 进度区：想读时整块隐藏（PRD 4.1）
    progressBox: byId('progress-box'),
    progressView: byId('progress-view'),
    progressForm: byId('progress-box').querySelector('.progress-form'),
    inputCurrentPage: byId('input-current-page'),
    btnSaveProgress: byId('btn-save-progress'),
    progressHint: byId('progress-hint'),

    // 笔记区
    noteCount: byId('note-count'),
    btnAddNote: byId('btn-add-note'),
    noteEditor: byId('note-editor'),
    noteContent: byId('note-content'),
    notePage: byId('note-page'),
    btnCancelNote: byId('btn-cancel-note'),
    btnSaveNote: byId('btn-save-note'),
    noteList: byId('note-list'),
    noteEmpty: byId('note-empty'),

    modalBook: byId('modal-book'),
    modalTitle: byId('modal-title'),
    formBook: byId('form-book'),
    inputTitle: byId('input-title'),
    inputAuthor: byId('input-author'),
    inputCover: byId('input-cover'),
    inputTotal: byId('input-total'),
    formError: byId('form-error'),
    btnCancelBook: byId('btn-cancel-book')
  };

  /* ------------------------------------------------------------ 界面状态 */

  var STATUS_TEXT = { want: '想读', reading: '在读', finished: '已读' };
  var STATUS_ORDER = ['want', 'reading', 'finished'];

  var state = {
    filter: 'all',        // all / want / reading / finished
    currentBookId: null,  // 详情页正在看哪本
    editingBookId: null,  // 书籍弹窗在编辑哪本；null = 新增
    editingNoteId: null   // 笔记编辑器在改哪条；null = 新写一条
  };

  /* -------------------------------------------------------------- 小工具 */

  function showError(msg) {
    el.appError.textContent = msg;
    el.appError.hidden = false;
  }

  function clearError() {
    el.appError.textContent = '';
    el.appError.hidden = true;
  }

  /** 数据层返回 ok:false 时统一处理：提示用户，不静默（TECH_DESIGN 3.4） */
  function report(res) {
    showError(res && res.error ? res.error : '操作失败，请重试');
  }

  /** 书名首字，用作没有封面时的占位（PRD AC-4） */
  function firstChar(title) {
    var chars = Array.from(String(title || '').trim());
    return chars.length ? chars[0] : '书';
  }

  /** 2026 年 9 月 25 日 */
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  /**
   * 「第 120 / 320 页 · 38%」；没填总页数时不给百分比（PRD 3.2：不瞎猜）。
   * 百分比是实时算的，不存进数据里（TECH_DESIGN 2.5）。
   */
  function progressText(book) {
    var cur = book.currentPage;
    var total = book.totalPages;
    if (cur === null || cur === undefined) return '';
    if (!total) return '第 ' + cur + ' 页';
    return '第 ' + cur + ' / ' + total + ' 页 · ' + Math.round(cur / total * 100) + '%';
  }

  /**
   * 往容器里放封面（TECH_DESIGN 2.8）。
   * - 没填网址 → 书名首字（AC-4）
   * - 网址打不开 → 同样回退成首字，不留破图（AC-5）
   */
  function fillCover(container, book) {
    container.textContent = '';
    var url = String(book.coverUrl || '').trim();

    if (!url) {
      container.textContent = firstChar(book.title);
      return;
    }

    var img = document.createElement('img');
    img.alt = '';
    img.src = url;
    img.onerror = function () {
      container.textContent = firstChar(book.title);
    };
    container.appendChild(img);
  }

  function statusBadge(status) {
    var span = document.createElement('span');
    span.className = 'badge badge-' + status;
    span.textContent = STATUS_TEXT[status] || STATUS_TEXT.want;
    return span;
  }

  function buildBar(book) {
    if (!book.totalPages || book.currentPage === null || book.currentPage === undefined) return null;
    var wrap = document.createElement('div');
    wrap.className = 'bar';
    var fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = Math.min(100, Math.round(book.currentPage / book.totalPages * 100)) + '%';
    wrap.appendChild(fill);
    return wrap;
  }

  /* ---------------------------------------------------------- 视图切换 */

  // 社区视图（Day 11 新增）的 id 列表，切回 list/detail 时要把它们一起藏起来
  var COMMUNITY_VIEWS = ['view-forum', 'view-post', 'view-messages', 'view-me', 'view-auth'];

  function showView(name) {
    el.viewList.hidden = name !== 'list';
    el.viewDetail.hidden = name !== 'detail';
    // 切到书单/详情时，社区视图全部收起，避免残留
    for (var i = 0; i < COMMUNITY_VIEWS.length; i++) {
      var v = byId(COMMUNITY_VIEWS[i]);
      if (v) v.hidden = true;
    }
  }

  // 暴露给 community.js：让社区层也能切回「列表/详情」，且不被它自己挡住
  window.AppViews = {
    showList: function () { goList(); },
    showDetail: function (id) { openDetail(id); }
  };

  function goList() {
    state.currentBookId = null;
    renderList();          // 状态可能刚改过，回来要刷新（AC-6）
    showView('list');
    clearError();
  }

  function openDetail(id) {
    var res = Store.getBook(id);
    if (!res.ok) { report(res); return; }
    if (!res.data) {
      showError('这本书不存在，可能已被删除');
      renderList();
      showView('list');
      return;
    }
    state.currentBookId = id;
    clearError();
    closeNoteEditor();          // 每次进详情页，笔记编辑器都是收起的
    renderDetail(res.data);
    showView('detail');
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------- 书单渲染 */

  function buildCard(book) {
    var card = document.createElement('article');
    card.className = 'book-card';
    card.setAttribute('data-id', book.id);
    card.tabIndex = 0;                      // 键盘也能选中

    var cover = document.createElement('div');
    cover.className = 'cover';
    fillCover(cover, book);
    card.appendChild(cover);

    var body = document.createElement('div');
    body.className = 'book-card-body';

    var title = document.createElement('h3');
    title.className = 'book-title';
    title.textContent = book.title;
    body.appendChild(title);

    if (book.author) {
      var author = document.createElement('p');
      author.className = 'book-author';
      author.textContent = book.author;
      body.appendChild(author);
    }

    body.appendChild(statusBadge(book.status));

    // 在读的书才显示进度（PRD 4.1：卡片上「（在读时）进度」）
    if (book.status === 'reading') {
      var text = progressText(book);
      if (text) {
        var line = document.createElement('p');
        line.className = 'progress-line';
        line.textContent = text;
        body.appendChild(line);
        var bar = buildBar(book);
        if (bar) body.appendChild(bar);
      }
    }

    card.appendChild(body);
    return card;
  }

  function renderList() {
    var res = Store.listBooks();
    if (!res.ok) { report(res); return; }

    var all = res.data;
    var shown = all.filter(function (b) {
      return state.filter === 'all' || b.status === state.filter;
    });

    // 筛选项高亮
    var btns = el.filters.querySelectorAll('.filter');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-status') === state.filter;
      if (on) btns[i].classList.add('is-active');
      else btns[i].classList.remove('is-active');
    }

    el.bookList.textContent = '';
    for (var k = 0; k < shown.length; k++) {
      el.bookList.appendChild(buildCard(shown[k]));
    }

    // 两种「空」要分开（PRD 4.1）：
    //   一本都没有     → AC-9 的空状态（带「添加第一本书」）
    //   有书但这档没有 → 一句提示 + 一个「看全部」的出口
    //   （后者是 Day 7 补的：原本一片空白，会被当成页面坏了）
    var none = all.length === 0;
    var noneHere = !none && shown.length === 0;

    el.emptyState.hidden = !none;
    el.filterEmpty.hidden = !noneHere;
    if (noneHere) {
      el.filterEmptyText.textContent = '没有「' + STATUS_TEXT[state.filter] + '」的书。';
    }
    el.bookList.hidden = none || noneHere;
  }

  /* ---------------------------------------------------------- 详情渲染 */

  function renderDetail(book) {
    fillCover(el.detailCover, book);
    el.detailTitle.textContent = book.title;
    el.detailAuthor.textContent = book.author || '未填作者';

    // 三态切换：当前状态那颗按钮置灰
    el.detailStatus.textContent = '';
    for (var i = 0; i < STATUS_ORDER.length; i++) {
      var s = STATUS_ORDER[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm' + (book.status === s ? ' is-active' : '');
      btn.setAttribute('data-status', s);
      btn.textContent = STATUS_TEXT[s];
      btn.disabled = book.status === s;
      el.detailStatus.appendChild(btn);
    }

    // 完成日期：改成「已读」时自动记为今天（AC-14）
    if (book.status === 'finished' && book.finishedAt) {
      el.detailFinished.textContent = '读完于 ' + formatDate(book.finishedAt);
      el.detailFinished.hidden = false;
    } else {
      el.detailFinished.textContent = '';
      el.detailFinished.hidden = true;
    }

    renderProgress(book);
    renderNotes(book.id);
  }

  /* ---------------------------------------------------------- 进度渲染 */

  /**
   * 进度区（AC-11 ~ AC-14）。
   * - 想读：整块隐藏（还没开始读，进度没有意义）
   * - 在读：显示「第 120 / 320 页 · 38%」+ 进度条 + 录入框
   * - 已读：显示「读完」，收起录入框
   */
  function renderProgress(book) {
    if (book.status === 'want') {
      el.progressBox.hidden = true;
      return;
    }
    el.progressBox.hidden = false;

    var finished = book.status === 'finished';

    // --- 显示区 ---
    el.progressView.textContent = '';
    if (finished) {
      var strong = document.createElement('strong');
      strong.textContent = '读完';
      el.progressView.appendChild(strong);
      if (book.totalPages) {
        el.progressView.appendChild(document.createTextNode(' · 共 ' + book.totalPages + ' 页'));
      }
    } else if (book.currentPage === null || book.currentPage === undefined) {
      el.progressView.textContent = '还没记录进度。';
    } else {
      el.progressView.textContent = progressText(book);   // 百分比在这里现算
    }

    // --- 录入区 ---
    el.progressForm.hidden = finished;

    // 进度条每次重画，先清掉上一条，免得越堆越多
    var oldBar = el.progressForm.querySelector('.bar');
    if (oldBar) oldBar.parentNode.removeChild(oldBar);

    if (!finished) {
      var bar = buildBar(book);
      if (bar) el.progressForm.appendChild(bar);

      el.inputCurrentPage.value = (book.currentPage === null || book.currentPage === undefined)
        ? '' : String(book.currentPage);
    } else {
      el.inputCurrentPage.value = '';
    }

    // AC-12：没填总页数就不给百分比。这里说明一句为什么没有，
    // 免得看起来像页面坏了。
    var needTotal = !finished && !book.totalPages;
    if (needTotal) {
      el.progressHint.textContent = '这本书没填总页数，所以算不出百分比。可以在上方「编辑」里补上。';
      el.progressHint.hidden = false;
    } else {
      el.progressHint.textContent = '';
      el.progressHint.hidden = true;
    }
  }

  /* ---------------------------------------------------------- 笔记渲染 */

  function buildNoteItem(note) {
    var li = document.createElement('li');
    li.className = 'note-item';
    li.setAttribute('data-id', note.id);

    var body = document.createElement('p');
    body.className = 'note-body';
    body.textContent = note.content;
    li.appendChild(body);

    var foot = document.createElement('div');
    foot.className = 'note-foot';

    // 「第 88 页 · 2026 年 9 月 25 日」——页码没填就只显示日期
    var bits = [];
    if (note.page !== null && note.page !== undefined) bits.push('第 ' + note.page + ' 页');
    var created = formatDate(note.createdAt);
    if (created) bits.push(created);

    var meta = document.createElement('span');
    meta.className = 'note-meta';
    meta.textContent = bits.join(' · ');
    foot.appendChild(meta);

    var row = document.createElement('div');
    row.className = 'btn-row';
    row.appendChild(noteButton('edit', '编辑'));
    row.appendChild(noteButton('del', '删除', 'btn-danger'));
    foot.appendChild(row);

    li.appendChild(foot);
    return li;
  }

  function noteButton(act, text, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm' + (extraClass ? ' ' + extraClass : '');
    btn.setAttribute('data-act', act);
    btn.textContent = text;
    return btn;
  }

  /** 只重画笔记区（写完、改完、删完时用），不动整页 */
  function renderNotes(bookId) {
    var res = Store.listNotes(bookId);
    if (!res.ok) { report(res); return; }

    var notes = res.data;

    el.noteList.textContent = '';
    for (var i = 0; i < notes.length; i++) {
      el.noteList.appendChild(buildNoteItem(notes[i]));
    }

    el.noteEmpty.hidden = notes.length > 0;
    el.noteCount.textContent = notes.length > 0 ? '共 ' + notes.length + ' 条' : '';

    // 正在编辑的那条如果已经不存在了（比如在别处删掉了），把编辑器也收掉
    if (state.editingNoteId) {
      var still = false;
      for (var k = 0; k < notes.length; k++) {
        if (notes[k].id === state.editingNoteId) { still = true; break; }
      }
      if (!still) closeNoteEditor();
    }
  }

  /** 按 id 找一条笔记（数据层没有单独的 getNote，从本书笔记里找） */
  function findNote(bookId, noteId) {
    var res = Store.listNotes(bookId);
    if (!res.ok) { report(res); return null; }
    for (var i = 0; i < res.data.length; i++) {
      if (res.data[i].id === noteId) return res.data[i];
    }
    return null;
  }

  /* -------------------------------------------------------- 笔记编辑器 */

  /** note 传 null 表示新写一条 */
  function openNoteEditor(note) {
    state.editingNoteId = note ? note.id : null;
    el.noteContent.value = note ? note.content : '';
    el.notePage.value = (note && note.page !== null && note.page !== undefined)
      ? String(note.page) : '';
    el.btnSaveNote.textContent = note ? '保存修改' : '保存';
    el.noteEditor.hidden = false;
    el.noteContent.focus();
  }

  /** 取消：什么都不写回去，原内容自然保持不变（PRD 3.3 异常处理） */
  function closeNoteEditor() {
    el.noteEditor.hidden = true;
    el.noteContent.value = '';
    el.notePage.value = '';
    state.editingNoteId = null;
  }

  /* ------------------------------------------------------------ 弹窗 */

  function openBookModal(book) {
    state.editingBookId = book ? book.id : null;
    el.modalTitle.textContent = book ? '编辑书籍' : '添加书籍';
    el.inputTitle.value = book ? book.title : '';
    el.inputAuthor.value = book ? (book.author || '') : '';
    el.inputCover.value = book ? (book.coverUrl || '') : '';
    el.inputTotal.value = (book && book.totalPages !== null && book.totalPages !== undefined)
      ? String(book.totalPages) : '';
    el.formError.textContent = '';
    el.formError.hidden = true;
    el.modalBook.hidden = false;
    el.inputTitle.focus();
  }

  function closeBookModal() {
    el.modalBook.hidden = true;
    state.editingBookId = null;
  }

  /* ------------------------------------------------------------ 事件 */

  // 添加书籍（两处入口）
  el.btnAddBook.addEventListener('click', function () { openBookModal(null); });
  el.btnAddFirst.addEventListener('click', function () { openBookModal(null); });

  el.btnCancelBook.addEventListener('click', function () { closeBookModal(); });

  // 保存（新增或编辑共用）
  el.formBook.addEventListener('submit', function (e) {
    e.preventDefault();

    var editingId = state.editingBookId;
    var payload = {
      title: el.inputTitle.value,
      author: el.inputAuthor.value,
      coverUrl: el.inputCover.value,
      totalPages: el.inputTotal.value
    };

    var res = editingId ? Store.updateBook(editingId, payload) : Store.addBook(payload);

    if (!res.ok) {
      // AC-2：弹窗不关闭，就地说明哪里不对
      el.formError.textContent = res.error || '保存失败';
      el.formError.hidden = false;
      return;
    }

    closeBookModal();
    clearError();

    if (editingId) {
      renderDetail(res.data);   // 详情页立刻更新（AC-8）
      renderList();             // 列表页也同步
    } else {
      // 新增后切回「全部」——AC-1 要求新书「立刻出现」，
      // 若停在「已读」等筛选档下就看不见它。
      state.filter = 'all';
      renderList();
      showView('list');
      window.scrollTo(0, 0);
    }
  });

  // 点卡片进详情
  el.bookList.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('.book-card') : null;
    if (card) openDetail(card.getAttribute('data-id'));
  });

  // 键盘回车／空格也能进（卡片带了 tabIndex）
  el.bookList.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest ? e.target.closest('.book-card') : null;
    if (!card) return;
    e.preventDefault();
    openDetail(card.getAttribute('data-id'));
  });

  // 筛选
  el.filters.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.filter') : null;
    if (!btn) return;
    var s = btn.getAttribute('data-status');
    if (!s) return;
    state.filter = s;
    renderList();
  });

  // 「没有 XX 的书」那句提示里的出口
  el.btnShowAll.addEventListener('click', function () {
    state.filter = 'all';
    renderList();
  });

  // 详情页：状态切换（AC-6）
  el.detailStatus.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-status]') : null;
    if (!btn || btn.disabled) return;

    var res = Store.updateBook(state.currentBookId, { status: btn.getAttribute('data-status') });
    if (!res.ok) { report(res); return; }

    clearError();
    renderDetail(res.data);
  });

  el.btnBack.addEventListener('click', goList);

  /* ---------------- 阅读进度（AC-11 ~ AC-14） ---------------- */

  // 保存进度：页数不合法就不写进去，并说明原因（AC-13）
  el.btnSaveProgress.addEventListener('click', function () {
    if (!state.currentBookId) return;

    var res = Store.updateBook(state.currentBookId, { currentPage: el.inputCurrentPage.value });
    if (!res.ok) { showError(res.error || '进度没能保存'); return; }

    clearError();
    renderDetail(res.data);          // 页数与百分比立刻刷新（AC-11 / AC-12）
  });

  // 输入框里直接回车，等同于点「保存进度」
  el.inputCurrentPage.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    el.btnSaveProgress.click();
  });

  /* ---------------- 读书笔记（AC-15 ~ AC-18） ---------------- */

  el.btnAddNote.addEventListener('click', function () { openNoteEditor(null); });

  el.btnCancelNote.addEventListener('click', function () {
    closeNoteEditor();               // 取消不动数据，原内容保持不变
  });

  el.btnSaveNote.addEventListener('click', function () {
    var bookId = state.currentBookId;
    if (!bookId) return;

    var editingId = state.editingNoteId;
    var content = el.noteContent.value;
    var page = el.notePage.value;

    var res = editingId
      ? Store.updateNote(editingId, { content: content, page: page })   // AC-17：改原来那条
      : Store.addNote({ bookId: bookId, content: content, page: page });

    if (!res.ok) { showError(res.error || '笔记没能保存'); return; }

    closeNoteEditor();
    clearError();
    renderNotes(bookId);             // 最新的一条排在最上面（AC-15）
  });

  // 每条笔记上的「编辑」「删除」
  el.noteList.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-act]') : null;
    if (!btn) return;

    var li = btn.closest ? btn.closest('.note-item') : null;
    if (!li) return;

    var bookId = state.currentBookId;
    if (!bookId) return;
    var noteId = li.getAttribute('data-id');

    if (btn.getAttribute('data-act') === 'edit') {
      var note = findNote(bookId, noteId);
      if (!note) { showError('这条笔记不存在，可能已被删除'); renderNotes(bookId); return; }
      openNoteEditor(note);
      return;
    }

    // 删除笔记：先确认一次，避免误删（PRD 3.3 异常处理）
    if (!window.confirm('确定删除这条笔记吗？\n\n删除后无法恢复。')) return;

    var res = Store.deleteNote(noteId);
    if (!res.ok) { report(res); return; }

    clearError();
    renderNotes(bookId);
  });

  // 编辑这本书（AC-8）
  el.btnEditBook.addEventListener('click', function () {
    var res = Store.getBook(state.currentBookId);
    if (!res.ok) { report(res); return; }
    if (!res.data) { showError('这本书不存在，可能已被删除'); return; }
    openBookModal(res.data);
  });

  // 删除这本书（AC-10：先确认，并写明会连带删掉几条笔记）
  el.btnDeleteBook.addEventListener('click', function () {
    var id = state.currentBookId;
    if (!id) return;

    var bookRes = Store.getBook(id);
    if (!bookRes.ok) { report(bookRes); return; }
    if (!bookRes.data) { showError('这本书不存在，可能已被删除'); goList(); return; }

    var cntRes = Store.countNotes(id);
    if (!cntRes.ok) { report(cntRes); return; }   // 数不出来就不删，免得提示不准确

    var msg = '确定删除《' + bookRes.data.title + '》吗？\n\n';
    if (cntRes.data > 0) msg += '这本书的 ' + cntRes.data + ' 条笔记会一并删除。\n';
    msg += '删除后无法恢复。';
    if (!window.confirm(msg)) return;

    var res = Store.deleteBook(id);
    if (!res.ok) { report(res); return; }

    clearError();
    goList();
  });

  /* ------------------------------------------------------------ 启动 */

  function init() {
    if (!window.Store) {
      // 不白屏：至少告诉用户出了什么事（AC-23）
      showError('数据模块没能加载，页面无法使用，请刷新重试。');
      return;
    }

    if (!Store.isAvailable()) {
      showError('浏览器的本地存储不可用（可能开着无痕模式），数据将无法保存。');
    }

    // 进度区的显隐跟着状态走，由 renderProgress 决定；
    // 笔记区一直显示（没有笔记时由 renderNotes 给一句提示）。
    closeNoteEditor();

    renderList();
    showView('list');
  }

  // 兜底：任何未预期的报错都不该让页面变成一片空白
  window.addEventListener('error', function (e) {
    showError('页面出错了：' + (e.message || '未知错误'));
  });

  init();

})();
