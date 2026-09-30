/* ============================================================================
 * community.js —— 阅读社区层（Day 11 新增）
 *
 * 依据 docs/COMMUNITY_DESIGN.md：把「阅读的海洋」从个人记录本升级为公开阅读社区。
 * 本文件负责：顶部导航切换、登录/注册（mock）、论坛帖子流、热门书籍排行、
 *            帖子详情与评论、私信（一对一对话）、「我的」页。
 *
 * ⚠️ 本轮边界（COMMUNITY_DESIGN.md 第 11 节）：
 *   - 只做前端界面 + 数据 mock，涉及后端的一律不做。
 *   - 数据暂存内存（刷新即清空），后端就绪后把 data.* 换成接口调用即可。
 *   - 沿用 {ok, data|error} 返回约定，错误码按文档 3.x 预留。
 *
 * 硬约束：普通 <script>，不能用 import/export（file:// 会白屏）。
 * 加载顺序：store.js → app.js → community.js（要读 window.AppViews）。
 * ========================================================================== */

(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  /* =============================================================
   * 0. mock 数据（刷新即清空；后端就绪后换成接口）
   * ============================================================= */

  // 预设头像色板（色块头像可选）
  var AVATAR_COLORS = ['#1f6f6b', '#b3261e', '#7a6a4f', '#2f6b3a', '#5b5bd6', '#b0643a', '#8a3ab0', '#3a7a8a'];

  // 已注册账号（模拟数据库 users 表）。密码只存明文做演示，
  // 真实后端会存哈希（COMMUNITY_DESIGN.md 4.2），这里绝不照搬。
  // avatar：字符串——色块颜色值（如 '#1f6f6b'）或图片 dataURL；空=用首字占位
  // shelves：该用户的书单，四类：want 想读 / reading 在读 / finished 已读 / favorite 喜欢
  var MOCK_USERS = [
    {
      id: 'user_1', username: '阿澈', avatar: '', bio: '喜欢科幻和推理',
      shelves: {
        want: ['沙丘', '银河帝国'],
        reading: ['三体'],
        finished: ['球状闪电', '献给阿尔吉侬的花束'],
        favorite: ['三体', '银河系漫游指南']
      }
    },
    {
      id: 'user_2', username: '小林', avatar: '', bio: '在读历史类',
      shelves: {
        want: ['万历十五年'],
        reading: ['明朝那些事儿'],
        finished: ['人类简史'],
        favorite: ['明朝那些事儿']
      }
    },
    {
      id: 'user_3', username: '月白', avatar: '', bio: '什么都读一点',
      shelves: {
        want: ['百年孤独'],
        reading: [],
        finished: ['围城', '活着'],
        favorite: ['百年孤独', '活着']
      }
    }
  ];

  // 帖子（模拟 posts 表）
  var MOCK_POSTS = [
    {
      id: 'post_1', authorId: 'user_1', title: '三体', author: '刘慈欣',
      coverUrl: '', content: '读完第二遍了，黑暗森林法则越想越冷。你们觉得宇宙社会学成立吗？',
      createdAt: '2026-09-30T10:00:00', comments: [
        { id: 'c1', authorId: 'user_2', content: '成立，但那是零和博弈下的推演。', createdAt: '2026-09-30T10:20:00' },
        { id: 'c2', authorId: 'user_3', content: '我更喜欢死神永生里的二向箔。', createdAt: '2026-09-30T11:05:00' }
      ]
    },
    {
      id: 'post_2', authorId: 'user_2', title: '明朝那些事儿', author: '当年明月',
      coverUrl: '', content: '把历史写活了的典范，轻松又好读，适合入门。',
      createdAt: '2026-09-29T21:00:00', comments: [
        { id: 'c3', authorId: 'user_1', content: '确实，我三天看完了前三册。', createdAt: '2026-09-29T21:40:00' }
      ]
    },
    {
      id: 'post_3', authorId: 'user_3', title: '百年孤独', author: '加西亚·马尔克斯',
      coverUrl: '', content: '人名太难记了，但读进去之后放不下。有人同感吗？',
      createdAt: '2026-09-28T14:30:00', comments: []
    }
  ];

  // 私信会话（模拟 conversations / messages）
  var MOCK_CONVERSATIONS = [
    {
      id: 'conv_1', peerId: 'user_2', peerName: '小林',
      messages: [
        { fromId: 'user_2', content: '你也喜欢三体啊！', createdAt: '2026-09-30T11:00:00' },
        { fromId: 'me', content: '是啊，刚看完第二部。', createdAt: '2026-09-30T11:02:00' },
        { fromId: 'user_2', content: '要不要聊聊黑暗森林？', createdAt: '2026-09-30T11:03:00', unread: true }
      ]
    }
  ];

  // 运行期状态
  var state = {
    currentUser: null,          // 登录用户（null=未登录）
    currentRange: 'day',        // 热门档位
    currentPostId: null,        // 正在看的帖子
    currentConvId: null,        // 正在聊的会话
    authMode: 'login',          // login / register
    avatarColor: null,          // 注册时选中的色块头像颜色（null=未选）
    avatarImage: null,          // 注册时上传的图片头像 dataURL（null=未传）
    postFromBook: false,        // 帖子详情是从「同书列表」进来的吗
    lastBookTitle: null,        // 最近一次点热门书看的是哪本（返回时用）
    profileUserId: null         // 正在看的个人主页属于谁（null=未打开）
  };

  /* =============================================================
   * 1. 小工具
   * ============================================================= */

  function firstChar(s) {
    var chars = Array.from(String(s || '').trim());
    return chars.length ? chars[0] : '书';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function usernameById(id) {
    if (id === 'me') return state.currentUser ? state.currentUser.username : '我';
    for (var i = 0; i < MOCK_USERS.length; i++) {
      if (MOCK_USERS[i].id === id) return MOCK_USERS[i].username;
    }
    return '读者';
  }

  function userById(id) {
    if (id === 'me') return state.currentUser;
    for (var i = 0; i < MOCK_USERS.length; i++) {
      if (MOCK_USERS[i].id === id) return MOCK_USERS[i];
    }
    return null;
  }

  // 某用户发的帖子（按时间倒序）
  function postsByUser(userId) {
    var out = [];
    for (var i = 0; i < MOCK_POSTS.length; i++) {
      if (MOCK_POSTS[i].authorId === userId) out.push(MOCK_POSTS[i]);
    }
    out.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return out;
  }

  // 某用户发的评论（按时间倒序），附带所属帖子标题方便跳转
  function commentsByUser(userId) {
    var out = [];
    for (var i = 0; i < MOCK_POSTS.length; i++) {
      var p = MOCK_POSTS[i];
      if (!p.comments) continue;
      for (var j = 0; j < p.comments.length; j++) {
        if (p.comments[j].authorId === userId) {
          out.push({ comment: p.comments[j], postTitle: p.title, postId: p.id });
        }
      }
    }
    out.sort(function (a, b) { return new Date(b.comment.createdAt) - new Date(a.comment.createdAt); });
    return out;
  }

  /**
   * 统一头像渲染：avatar 可能是
   *   - 空字符串 → 首字占位（默认墨绿渐变）
   *   - '#xxxxxx' 色值 → 色块底 + 首字
   *   - data:image/... 或 http(s) URL → 直接放 <img>
   */
  function renderAvatar(container, username, avatar) {
    container.textContent = '';
    var name = username || '';
    var av = String(avatar || '').trim();

    if (av && av.indexOf('data:') === 0) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = av;
      container.appendChild(img);
      return;
    }
    if (av && av.indexOf('http') === 0) {
      var img2 = document.createElement('img');
      img2.alt = '';
      img2.src = av;
      img2.onerror = function () { container.textContent = firstChar(name); };
      container.appendChild(img2);
      return;
    }
    if (av && av.charAt(0) === '#') {
      container.textContent = firstChar(name);
      container.style.background = av;
      return;
    }
    container.textContent = firstChar(name);
    container.style.background = '';
  }

  function showError(msg) {
    var box = byId('app-error');
    box.textContent = msg;
    box.hidden = false;
  }
  function clearError() {
    var box = byId('app-error');
    box.textContent = '';
    box.hidden = true;
  }

  // 成功提示条：几秒后自动消失（注册/登录成功等正向反馈）
  var successTimer = null;
  function showSuccess(msg) {
    var box = byId('app-success');
    if (!box) return;
    box.textContent = msg;
    box.hidden = false;
    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(function () { box.hidden = true; }, 3000);
  }
  function clearSuccess() {
    var box = byId('app-success');
    if (box) { box.textContent = ''; box.hidden = true; }
  }

  /* =============================================================
   * 2. 导航切换
   * ============================================================= */

  var VIEW_IDS = ['view-list', 'view-detail', 'view-forum', 'view-post', 'view-book-posts', 'view-messages', 'view-me', 'view-auth', 'view-profile'];

  function switchView(name) {
    var map = {
      home: 'view-list',
      forum: 'view-forum',
      messages: 'view-messages',
      me: 'view-me',
      login: 'view-auth'
    };
    var target = map[name] || 'view-list';

    for (var i = 0; i < VIEW_IDS.length; i++) {
      var v = byId(VIEW_IDS[i]);
      if (v) v.hidden = (VIEW_IDS[i] !== target);
    }

    // 高亮导航
    var links = document.querySelectorAll('.site-nav-link');
    for (var k = 0; k < links.length; k++) {
      var on = links[k].getAttribute('data-nav') === name;
      if (on) links[k].classList.add('is-active');
      else links[k].classList.remove('is-active');
    }

    clearError();
    window.scrollTo(0, 0);

    // 进入某页时刷新其内容
    if (name === 'forum') renderForum();
    if (name === 'messages') renderConversations();
    if (name === 'me') renderMe();
    if (name === 'login') renderAuth();
  }

  function bindNav() {
    document.addEventListener('click', function (e) {
      // e.target 可能是文本节点，统一先取元素再 closest，避免空引用
      var t = e.target;
      var el = t && t.nodeType === 1 ? t : (t && t.parentNode ? t.parentNode : null);
      var nav = el && el.closest ? el.closest('[data-nav]') : null;
      if (!nav) return;
      var name = nav.getAttribute('data-nav');
      // 登录按钮和导航里的登录入口共用 data-nav="login"
      switchView(name);
    });
  }

  /* =============================================================
   * 3. 封面渲染（复用首字占位；Google Books 真接等后端打卡）
   * ============================================================= */

  function fillCover(container, title, url) {
    container.textContent = '';
    var u = String(url || '').trim();
    if (!u) {
      container.textContent = firstChar(title);
      return;
    }
    var img = document.createElement('img');
    img.alt = '';
    img.src = u;
    img.onerror = function () { container.textContent = firstChar(title); };
    container.appendChild(img);
  }

  /* =============================================================
   * 4. 论坛：热门排行 + 帖子流
   * ============================================================= */

  // 讨论量 = 帖子数 + 评论数（COMMUNITY_DESIGN.md 6.1）
  function postHeat(post) {
    return 1 + (post.comments ? post.comments.length : 0);
  }

  // 按书名聚合讨论量（COMMUNITY_DESIGN.md 6.3）
  function aggregateHot() {
    var map = {};
    for (var i = 0; i < MOCK_POSTS.length; i++) {
      var p = MOCK_POSTS[i];
      if (!map[p.title]) map[p.title] = { title: p.title, author: p.author, coverUrl: p.coverUrl, heat: 0 };
      map[p.title].heat += postHeat(p);
    }
    var arr = [];
    for (var k in map) arr.push(map[k]);
    arr.sort(function (a, b) { return b.heat - a.heat; });
    return arr;
  }

  function renderHot() {
    var list = byId('hot-list');
    var empty = byId('hot-empty');
    list.textContent = '';

    var hot = aggregateHot();
    if (hot.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;

    for (var i = 0; i < hot.length; i++) {
      var item = hot[i];
      var li = document.createElement('li');
      li.className = 'hot-item';
      li.setAttribute('data-title', item.title);

      var rank = document.createElement('span');
      rank.className = 'hot-rank' + (i < 3 ? ' hot-rank-top' : '');
      rank.textContent = String(i + 1);
      li.appendChild(rank);

      var cover = document.createElement('div');
      cover.className = 'cover cover-sm';
      fillCover(cover, item.title, item.coverUrl);
      li.appendChild(cover);

      var body = document.createElement('div');
      body.className = 'hot-body';
      var t = document.createElement('p');
      t.className = 'hot-title';
      t.textContent = item.title;
      body.appendChild(t);
      var meta = document.createElement('p');
      meta.className = 'muted sub';
      meta.textContent = (item.author ? item.author + ' · ' : '') + item.heat + ' 次讨论';
      body.appendChild(meta);
      li.appendChild(body);

      var go = document.createElement('span');
      go.className = 'hot-go';
      go.textContent = '去讨论 ›';
      li.appendChild(go);

      list.appendChild(li);
    }
  }

  function renderPosts() {
    var list = byId('post-list');
    var empty = byId('post-empty');
    list.textContent = '';

    if (MOCK_POSTS.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;

    var posts = MOCK_POSTS.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    for (var i = 0; i < posts.length; i++) {
      list.appendChild(buildPostCard(posts[i]));
    }
  }

  function buildPostCard(post) {
    var card = document.createElement('article');
    card.className = 'post-card';
    card.setAttribute('data-id', post.id);

    var cover = document.createElement('div');
    cover.className = 'cover cover-sm';
    fillCover(cover, post.title, post.coverUrl);
    card.appendChild(cover);

    var body = document.createElement('div');
    body.className = 'post-card-body';

    var t = document.createElement('h3');
    t.className = 'post-title';
    t.textContent = post.title;
    body.appendChild(t);

    var meta = document.createElement('p');
    meta.className = 'post-meta';
    var authorName = document.createElement('a');
    authorName.className = 'user-link';
    authorName.textContent = usernameById(post.authorId);
    authorName.href = '#';
    (function (uid) {
      authorName.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();   // 别触发帖子卡片的点击进详情
        openProfile(uid);
      });
    })(post.authorId);
    meta.appendChild(authorName);
    meta.appendChild(document.createTextNode(' · ' + timeAgo(post.createdAt)));
    body.appendChild(meta);

    var excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = post.content;
    body.appendChild(excerpt);

    var foot = document.createElement('div');
    foot.className = 'post-foot';
    var cc = document.createElement('span');
    cc.className = 'muted';
    cc.textContent = '💬 ' + (post.comments ? post.comments.length : 0) + ' 条评论';
    foot.appendChild(cc);
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function renderForum() {
    renderHot();
    renderPosts();
  }

  // 打开发帖弹窗（清空上次残留）
  function openComposer() {
    byId('compose-title-input').value = '';
    byId('compose-author').value = '';
    byId('compose-cover').value = '';
    byId('compose-content').value = '';
    var err = byId('compose-error');
    err.hidden = true;
    err.textContent = '';
    byId('modal-compose').hidden = false;
  }

  // 提交发帖
  function submitCompose() {
    var title = byId('compose-title-input').value.trim();
    var author = byId('compose-author').value.trim();
    var cover = byId('compose-cover').value.trim();
    var content = byId('compose-content').value.trim();
    var err = byId('compose-error');

    if (!title) { err.textContent = '书名不能为空'; err.hidden = false; return; }
    if (title.length > 100) { err.textContent = '书名太长（最多 100 字）'; err.hidden = false; return; }
    if (!content) { err.textContent = '感受 / 看法不能为空'; err.hidden = false; return; }

    var post = {
      id: 'post_' + Date.now(),
      authorId: state.currentUser.id,   // 用真实 id，保证「我的」页聚合能查到
      title: title,
      author: author || '',
      coverUrl: cover,
      content: content,
      createdAt: new Date().toISOString(),
      comments: []
    };
    MOCK_POSTS.push(post);

    byId('modal-compose').hidden = true;
    renderForum();
    showSuccess('发布成功！');
    // 直接打开刚发的帖子详情
    openPost(post.id);
  }

  /* =============================================================
   * 4b. 同书帖子列表（点热门书进来看这本书的所有讨论）
   * ============================================================= */

  function postsByTitle(title) {
    var out = [];
    for (var i = 0; i < MOCK_POSTS.length; i++) {
      if (MOCK_POSTS[i].title === title) out.push(MOCK_POSTS[i]);
    }
    out.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return out;
  }

  function openBookPosts(title) {
    var posts = postsByTitle(title);
    if (posts.length === 0) { showError('这本书还没有讨论'); return; }
    state.postFromBook = true;
    state.lastBookTitle = title;

    // 头部：封面 + 书名 + 作者 + 帖子数
    var head = byId('book-posts-head');
    head.textContent = '';
    var cover = document.createElement('div');
    cover.className = 'cover cover-lg';
    fillCover(cover, posts[0].title, posts[0].coverUrl);
    head.appendChild(cover);
    var meta = document.createElement('div');
    meta.className = 'detail-meta';
    var h2 = document.createElement('h2');
    h2.textContent = title;
    meta.appendChild(h2);
    var p = document.createElement('p');
    p.className = 'muted';
    var author = posts[0].author || '';
    var totalComments = 0;
    for (var i = 0; i < posts.length; i++) totalComments += posts[i].comments ? posts[i].comments.length : 0;
    p.textContent = (author ? author + ' · ' : '') + posts.length + ' 篇讨论 · ' + totalComments + ' 条评论';
    meta.appendChild(p);
    head.appendChild(meta);

    // 帖子列表
    var list = byId('book-posts-list');
    var empty = byId('book-posts-empty');
    list.textContent = '';
    if (posts.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;
    for (var k = 0; k < posts.length; k++) {
      list.appendChild(buildPostCard(posts[k]));
    }

    switchViewBookPosts();
  }

  function switchViewBookPosts() {
    for (var i = 0; i < VIEW_IDS.length; i++) {
      var v = byId(VIEW_IDS[i]);
      if (v) v.hidden = (VIEW_IDS[i] !== 'view-book-posts');
    }
    window.scrollTo(0, 0);
  }

  /* =============================================================
   * 5. 帖子详情 + 评论
   * ============================================================= */

  function findPost(id) {
    for (var i = 0; i < MOCK_POSTS.length; i++) {
      if (MOCK_POSTS[i].id === id) return MOCK_POSTS[i];
    }
    return null;
  }

  function openPost(id) {
    var post = findPost(id);
    if (!post) { showError('这篇帖子不存在或已删除'); switchView('forum'); return; }
    state.currentPostId = id;
    // 帖子流点进来 → postFromBook 应为 false；同书列表点进来保持 true
    renderPostDetail(post);
    switchViewPost();
  }

  function switchViewPost() {
    for (var i = 0; i < VIEW_IDS.length; i++) {
      var v = byId(VIEW_IDS[i]);
      if (v) v.hidden = (VIEW_IDS[i] !== 'view-post');
    }
    window.scrollTo(0, 0);
  }

  function renderPostDetail(post) {
    var box = byId('post-detail');
    box.textContent = '';

    // 头部：封面 + 书名 + 作者 + 发帖人
    var head = document.createElement('div');
    head.className = 'detail-head';
    var cover = document.createElement('div');
    cover.className = 'cover cover-lg';
    fillCover(cover, post.title, post.coverUrl);
    head.appendChild(cover);
    var meta = document.createElement('div');
    meta.className = 'detail-meta';
    var h2 = document.createElement('h2');
    h2.textContent = post.title;
    meta.appendChild(h2);
    var author = document.createElement('p');
    author.className = 'muted';
    if (post.author) {
      author.appendChild(document.createTextNode(post.author + ' · '));
    }
    author.appendChild(document.createTextNode('由 '));
    var authorLink = document.createElement('a');
    authorLink.className = 'user-link';
    authorLink.textContent = usernameById(post.authorId);
    authorLink.href = '#';
    (function (uid) {
      authorLink.addEventListener('click', function (e) {
        e.preventDefault();
        openProfile(uid);
      });
    })(post.authorId);
    author.appendChild(authorLink);
    author.appendChild(document.createTextNode(' 分享'));

    // 私信作者（非本人时显示）
    if (!state.currentUser || state.currentUser.id !== post.authorId) {
      var msgBtn = document.createElement('button');
      msgBtn.className = 'btn btn-ghost btn-sm';
      msgBtn.type = 'button';
      msgBtn.textContent = '私信';
      (function (pid) {
        msgBtn.addEventListener('click', function () {
          openChatWith(pid, usernameById(pid));
        });
      })(post.authorId);
      author.appendChild(document.createTextNode(' '));
      author.appendChild(msgBtn);
    }
    meta.appendChild(author);
    head.appendChild(meta);
    box.appendChild(head);

    // 正文
    var content = document.createElement('div');
    content.className = 'box';
    content.textContent = post.content;
    box.appendChild(content);

    // 评论区
    var commentBox = document.createElement('div');
    commentBox.className = 'box';
    var cbHead = document.createElement('div');
    cbHead.className = 'box-head';
    var cbTitle = document.createElement('h3');
    cbTitle.className = 'box-title';
    cbTitle.textContent = '评论 ' + (post.comments ? post.comments.length : 0);
    cbHead.appendChild(cbTitle);
    commentBox.appendChild(cbHead);

    var ul = document.createElement('ul');
    ul.className = 'comment-list';
    if (post.comments && post.comments.length) {
      for (var i = 0; i < post.comments.length; i++) {
        ul.appendChild(buildComment(post.comments[i]));
      }
    } else {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = '还没有评论，来发表你的看法吧。';
      ul.appendChild(empty);
    }
    commentBox.appendChild(ul);

    // 发表看法（登录后才能评；未登录给提示）
    var editor = document.createElement('div');
    editor.className = 'comment-editor';
    var ta = document.createElement('textarea');
    ta.rows = 2;
    ta.placeholder = '说说你对这本书的看法…';
    ta.disabled = !state.currentUser;
    editor.appendChild(ta);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = state.currentUser ? '发表' : '登录后发表';
    btn.disabled = !state.currentUser;
    btn.addEventListener('click', function () {
      if (!state.currentUser) { switchView('login'); return; }
      if (!ta.value.trim()) { showError('评论不能为空'); return; }
      post.comments.push({ id: 'c' + Date.now(), authorId: state.currentUser.id, content: ta.value.trim(), createdAt: new Date().toISOString() });
      ta.value = '';
      renderPostDetail(post);
      renderForum();
    });
    editor.appendChild(btn);
    commentBox.appendChild(editor);

    box.appendChild(commentBox);
  }

  function buildComment(c) {
    var li = document.createElement('li');
    li.className = 'comment-item';
    var head = document.createElement('div');
    head.className = 'comment-head';
    var name = document.createElement('a');
    name.className = 'comment-name user-link';
    name.textContent = usernameById(c.authorId);
    name.href = '#';
    (function (uid) {
      name.addEventListener('click', function (e) {
        e.preventDefault();
        openProfile(uid);
      });
    })(c.authorId);
    head.appendChild(name);

    // 私信评论作者（非本人时显示）
    if (!state.currentUser || state.currentUser.id !== c.authorId) {
      var msgBtn = document.createElement('button');
      msgBtn.className = 'btn btn-ghost btn-sm';
      msgBtn.type = 'button';
      msgBtn.textContent = '私信';
      (function (cid) {
        msgBtn.addEventListener('click', function () {
          openChatWith(cid, usernameById(cid));
        });
      })(c.authorId);
      head.appendChild(msgBtn);
    }

    var time = document.createElement('span');
    time.className = 'muted sub';
    time.textContent = timeAgo(c.createdAt);
    head.appendChild(time);
    li.appendChild(head);
    var body = document.createElement('p');
    body.className = 'comment-body';
    body.textContent = c.content;
    li.appendChild(body);
    return li;
  }

  /* =============================================================
   * 6. 私信（一对一对话）
   * ============================================================= */

  function renderConversations() {
    var list = byId('conversation-list');
    var empty = byId('conversation-empty');
    list.textContent = '';

    if (!state.currentUser) {
      empty.hidden = false;
      empty.textContent = '登录后才能收发私信。';
      return;
    }
    if (MOCK_CONVERSATIONS.length === 0) {
      empty.hidden = false;
      empty.textContent = '还没有私信。去论坛找本喜欢的书，认识个读者吧。';
      return;
    }
    empty.hidden = true;

    for (var i = 0; i < MOCK_CONVERSATIONS.length; i++) {
      list.appendChild(buildConversationItem(MOCK_CONVERSATIONS[i]));
    }
  }

  function buildConversationItem(conv) {
    var item = document.createElement('div');
    item.className = 'conversation-item';
    item.setAttribute('data-id', conv.id);

    var peer = userById(conv.peerId);

    var avatar = document.createElement('span');
    avatar.className = 'avatar avatar-link';
    renderAvatar(avatar, conv.peerName, peer ? peer.avatar : '');
    if (peer) {
      (function (pid) {
        avatar.addEventListener('click', function (e) {
          e.stopPropagation();
          openProfile(pid);
        });
      })(peer.id);
    }
    item.appendChild(avatar);

    var body = document.createElement('div');
    body.className = 'conversation-body';
    var name = document.createElement('p');
    name.className = 'conversation-name';
    name.textContent = conv.peerName;
    if (peer) {
      name.classList.add('user-link');
      (function (pid) {
        name.addEventListener('click', function (e) {
          e.stopPropagation();
          openProfile(pid);
        });
      })(peer.id);
    }
    body.appendChild(name);

    var last = conv.messages[conv.messages.length - 1];
    var preview = document.createElement('p');
    preview.className = 'muted';
    preview.textContent = last ? last.content : '（还没有消息，打个招呼吧）';
    body.appendChild(preview);
    item.appendChild(body);

    // 未读红点
    var hasUnread = false;
    for (var i = 0; i < conv.messages.length; i++) {
      if (conv.messages[i].unread) { hasUnread = true; break; }
    }
    if (hasUnread) {
      var dot = document.createElement('span');
      dot.className = 'unread-dot';
      item.appendChild(dot);
    }

    return item;
  }

  function openConversation(id) {
    for (var i = 0; i < MOCK_CONVERSATIONS.length; i++) {
      if (MOCK_CONVERSATIONS[i].id === id) {
        state.currentConvId = id;
        // 打开会话即清掉未读
        for (var j = 0; j < MOCK_CONVERSATIONS[i].messages.length; j++) {
          MOCK_CONVERSATIONS[i].messages[j].unread = false;
        }
        renderChat(MOCK_CONVERSATIONS[i]);
        switchViewChat();
        return;
      }
    }
  }

  // 找到（或新建）与某个用户的一对一会话，返回会话对象
  function getOrCreateConversation(peerId, peerName) {
    for (var i = 0; i < MOCK_CONVERSATIONS.length; i++) {
      if (MOCK_CONVERSATIONS[i].peerId === peerId) return MOCK_CONVERSATIONS[i];
    }
    var conv = { id: 'conv_' + Date.now(), peerId: peerId, peerName: peerName, messages: [] };
    MOCK_CONVERSATIONS.unshift(conv);
    return conv;
  }

  // 从任意入口发起私信：找到/新建会话并打开对话窗口
  function openChatWith(peerId, peerName) {
    if (!state.currentUser) { switchView('login'); return; }
    if (state.currentUser.id === peerId) { showError('不能给自己发私信'); return; }
    var conv = getOrCreateConversation(peerId, peerName);
    state.currentConvId = conv.id;
    // 打开会话即清掉未读
    for (var i = 0; i < conv.messages.length; i++) conv.messages[i].unread = false;
    renderChat(conv);
    switchViewChat();
  }

  function switchViewChat() {
    // 私信详情在 view-messages 内展开，这里直接复用 view-messages
    for (var i = 0; i < VIEW_IDS.length; i++) {
      var v = byId(VIEW_IDS[i]);
      if (v) v.hidden = (VIEW_IDS[i] !== 'view-messages');
    }
    window.scrollTo(0, 0);
  }

  function renderChat(conv) {
    var box = byId('conversation-list');
    box.textContent = '';

    var header = document.createElement('div');
    header.className = 'chat-head';
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-ghost';
    back.textContent = '← 返回列表';
    back.addEventListener('click', function () { renderConversations(); });
    header.appendChild(back);
    var title = document.createElement('strong');
    title.textContent = conv.peerName;
    var peer = userById(conv.peerId);
    if (peer) {
      title.className = 'user-link';
      title.addEventListener('click', function () { openProfile(peer.id); });
    }
    header.appendChild(title);
    box.appendChild(header);

    var log = document.createElement('div');
    log.className = 'chat-log';
    for (var i = 0; i < conv.messages.length; i++) {
      var m = conv.messages[i];
      var line = document.createElement('div');
      line.className = 'chat-msg ' + (m.fromId === 'me' ? 'chat-msg-me' : 'chat-msg-peer');
      line.textContent = m.content;
      log.appendChild(line);
    }
    box.appendChild(log);

    var input = document.createElement('div');
    input.className = 'chat-input';
    var ta = document.createElement('input');
    ta.type = 'text';
    ta.placeholder = '发消息…';
    var send = document.createElement('button');
    send.type = 'button';
    send.className = 'btn btn-primary';
    send.textContent = '发送';
    function doSend() {
      if (!ta.value.trim()) return;
      conv.messages.push({ fromId: 'me', content: ta.value.trim(), createdAt: new Date().toISOString() });
      ta.value = '';
      renderChat(conv);
    }
    send.addEventListener('click', doSend);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSend();
    });
    input.appendChild(ta);
    input.appendChild(send);
    box.appendChild(input);
  }

  /* =============================================================
   * 7. 登录 / 注册
   * ============================================================= */

  function renderAuth() {
    var title = byId('auth-title');
    var submitBtn = byId('btn-auth-submit');
    var avatarField = byId('auth-avatar-field');
    var avatarPicker = byId('auth-avatar-picker');
    var hint = document.querySelector('.auth-hint');
    var tabLogin = byId('auth-tab-login');
    var tabRegister = byId('auth-tab-register');

    // tab 高亮跟随当前模式
    if (state.authMode === 'login') {
      tabLogin.classList.add('is-active');
      tabRegister.classList.remove('is-active');
      title.textContent = '登录';
      submitBtn.textContent = '登录';
      avatarField.hidden = true;
      avatarPicker.hidden = true;
      hint.textContent = '登录后可以发帖、评论、私信。';
    } else {
      tabRegister.classList.add('is-active');
      tabLogin.classList.remove('is-active');
      title.textContent = '注册';
      submitBtn.textContent = '注册';
      avatarField.hidden = false;
      avatarPicker.hidden = false;
      hint.textContent = '注册不需要手机号、不需要邮箱，只填账号名和密码。头像可选，不选就用首字占位。';
      renderAvatarColors();
      refreshAvatarPreview();
    }
  }

  // 渲染头像色板
  function renderAvatarColors() {
    var box = byId('avatar-colors');
    box.textContent = '';
    for (var i = 0; i < AVATAR_COLORS.length; i++) {
      var swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'avatar-swatch';
      swatch.setAttribute('data-color', AVATAR_COLORS[i]);
      swatch.style.background = AVATAR_COLORS[i];
      if (state.avatarColor === AVATAR_COLORS[i]) swatch.classList.add('is-active');
      box.appendChild(swatch);
    }
  }

  // 刷新头像预览（按当前选中的色块 / 上传图 / 首字）
  function refreshAvatarPreview() {
    var preview = byId('avatar-preview');
    var name = byId('auth-username').value.trim() || '海';
    var clearBtn = byId('btn-avatar-clear');

    if (state.avatarImage) {
      renderAvatar(preview, name, state.avatarImage);
      clearBtn.hidden = false;
      return;
    }
    if (state.avatarColor) {
      renderAvatar(preview, name, state.avatarColor);
      clearBtn.hidden = false;
      return;
    }
    renderAvatar(preview, name, '');
    clearBtn.hidden = true;
  }

  // 清空登录/注册表单（切 tab 时调用，避免残留上次输入与错误提示）
  function resetAuthForm() {
    byId('auth-username').value = '';
    byId('auth-password').value = '';
    byId('auth-error').hidden = true;
    byId('auth-error').textContent = '';
    // 头像选择状态也一并重置，避免登录页残留上次注册的色块
    state.avatarColor = null;
    state.avatarImage = null;
  }

  function doAuth() {
    var name = byId('auth-username').value.trim();
    var pwd = byId('auth-password').value;
    var err = byId('auth-error');
    // 校验（COMMUNITY_DESIGN.md 4.1）
    if (!name) { err.textContent = '账号名不能为空'; err.hidden = false; return; }
    if (name.length < 2 || name.length > 20) { err.textContent = '账号名需 2~20 个字符'; err.hidden = false; return; }
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(name)) { err.textContent = '账号名只能含中文、字母、数字、下划线'; err.hidden = false; return; }
    if (!pwd || pwd.length < 6) { err.textContent = '密码至少 6 位'; err.hidden = false; return; }

    if (state.authMode === 'register') {
      // 账号名占用校验（大帅点名要求：相同账号名无法注册，明确提示）
      for (var i = 0; i < MOCK_USERS.length; i++) {
        if (MOCK_USERS[i].username === name) {
          err.textContent = '该账号名已被使用，无法注册';
          err.hidden = false;
          return;
        }
      }
      var avatar = state.avatarImage || state.avatarColor || '';
      var newUser = { id: 'user_' + Date.now(), username: name, avatar: avatar, bio: '' };
      MOCK_USERS.push(newUser);
      state.currentUser = newUser;
      // 重置头像选择状态，避免下次注册残留
      state.avatarColor = null;
      state.avatarImage = null;
      err.hidden = true;
      clearError();
      clearSuccess();
      updateNavUser();
      switchView('home');
      showSuccess('注册成功，欢迎 ' + newUser.username + '！');
      return;
    }

    // 登录：查账号名是否存在（mock 只查账号名，不校验密码——真实后端会校验）
    var found = null;
    for (var j = 0; j < MOCK_USERS.length; j++) {
      if (MOCK_USERS[j].username === name) { found = MOCK_USERS[j]; break; }
    }
    if (!found) { err.textContent = '账号名或密码错误'; err.hidden = false; return; }
    state.currentUser = found;
    err.hidden = true;
    clearError();
    clearSuccess();
    updateNavUser();
    switchView('home');
    showSuccess('欢迎回来，' + found.username + '！');
  }

  function updateNavUser() {
    var loginBtn = byId('btn-nav-login');
    var userBox = byId('nav-user');
    if (state.currentUser) {
      loginBtn.hidden = true;
      userBox.hidden = false;
      renderAvatar(byId('nav-user-avatar'), state.currentUser.username, state.currentUser.avatar);
      byId('nav-user-name').textContent = state.currentUser.username;
    } else {
      loginBtn.hidden = false;
      userBox.hidden = true;
    }
  }

  /* =============================================================
   * 8. 我的 / 个人主页
   * ============================================================= */

  // 书单区块：把 {want/reading/finished/favorite} 渲染成四行
  function buildShelves(user) {
    var box = document.createElement('div');
    box.className = 'shelves';
    var shelves = user && user.shelves ? user.shelves : { want: [], reading: [], finished: [], favorite: [] };

    var defs = [
      { key: 'reading', label: '在读', icon: '📖' },
      { key: 'want', label: '想读', icon: '🔖' },
      { key: 'finished', label: '已读', icon: '✅' },
      { key: 'favorite', label: '喜欢', icon: '❤️' }
    ];
    for (var i = 0; i < defs.length; i++) {
      var row = document.createElement('div');
      row.className = 'shelf-row';
      var lab = document.createElement('span');
      lab.className = 'shelf-label';
      lab.textContent = defs[i].icon + ' ' + defs[i].label;
      row.appendChild(lab);
      var val = document.createElement('span');
      val.className = 'shelf-books';
      var list = shelves[defs[i].key] || [];
      val.textContent = list.length ? list.join('、') : '（暂无）';
      row.appendChild(val);
      box.appendChild(row);
    }
    return box;
  }

  // 聚合区块：帖子 + 评论（个人主页和「我的」共用）
  function buildActivity(userId) {
    var box = document.createElement('div');
    box.className = 'profile-activity';

    var posts = postsByUser(userId);
    var comments = commentsByUser(userId);

    var postBox = document.createElement('div');
    postBox.className = 'box';
    var ph = document.createElement('div');
    ph.className = 'box-head';
    var pt = document.createElement('h3');
    pt.className = 'box-title';
    pt.textContent = '发布的帖子 ' + posts.length;
    ph.appendChild(pt);
    postBox.appendChild(ph);
    if (posts.length) {
      for (var i = 0; i < posts.length; i++) {
        var pc = buildPostCard(posts[i]);
        postBox.appendChild(pc);
      }
    } else {
      var pe = document.createElement('p');
      pe.className = 'muted';
      pe.textContent = '还没有发过帖子。';
      postBox.appendChild(pe);
    }
    box.appendChild(postBox);

    var cmtBox = document.createElement('div');
    cmtBox.className = 'box';
    var ch = document.createElement('div');
    ch.className = 'box-head';
    var ct = document.createElement('h3');
    ct.className = 'box-title';
    ct.textContent = '发表的评论 ' + comments.length;
    ch.appendChild(ct);
    cmtBox.appendChild(ch);
    if (comments.length) {
      var ul = document.createElement('ul');
      ul.className = 'comment-list';
      for (var j = 0; j < comments.length; j++) {
        var li = buildComment(comments[j].comment);
        // 附上「来自《书名》」的跳转入口
        var src = document.createElement('span');
        src.className = 'comment-source';
        src.textContent = '来自《' + comments[j].postTitle + '》';
        src.style.cursor = 'pointer';
        (function (pid) {
          src.addEventListener('click', function () { openPost(pid); });
        })(comments[j].postId);
        li.appendChild(src);
        ul.appendChild(li);
      }
      cmtBox.appendChild(ul);
    } else {
      var ce = document.createElement('p');
      ce.className = 'muted';
      ce.textContent = '还没有发过评论。';
      cmtBox.appendChild(ce);
    }
    box.appendChild(cmtBox);

    return box;
  }

  // 简介区：本人可编辑，别人只读
  function buildBioCard(user, isSelf) {
    var card = document.createElement('div');
    card.className = 'box me-card';
    var avatar = document.createElement('span');
    avatar.className = 'avatar avatar-lg';
    renderAvatar(avatar, user.username, user.avatar);
    card.appendChild(avatar);
    var name = document.createElement('h2');
    name.textContent = user.username;
    card.appendChild(name);

    var bioWrap = document.createElement('div');
    bioWrap.className = 'bio-wrap';

    if (isSelf) {
      // 本人：显示简介 + 编辑按钮
      var bioText = document.createElement('p');
      bioText.className = 'muted bio-text';
      bioText.textContent = user.bio || '这个人还没有写简介。';
      bioWrap.appendChild(bioText);

      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm';
      editBtn.type = 'button';
      editBtn.textContent = '编辑简介';
      editBtn.addEventListener('click', function () {
        // 就地切换成编辑态
        bioText.hidden = true;
        editBtn.hidden = true;
        bioText.parentNode.insertBefore(buildBioEditor(user, bioText, editBtn), bioText);
      });
      bioWrap.appendChild(editBtn);
    } else {
      var bioView = document.createElement('p');
      bioView.className = 'muted bio-text';
      bioView.textContent = user.bio || '这个人还没有写简介。';
      bioWrap.appendChild(bioView);

      // 非本人：加「发私信」按钮（聊得来就私信）
      var msgBtn = document.createElement('button');
      msgBtn.className = 'btn btn-primary';
      msgBtn.type = 'button';
      msgBtn.textContent = '发私信';
      (function (u) {
        msgBtn.addEventListener('click', function () {
          openChatWith(u.id, u.username);
        });
      })(user);
      card.appendChild(msgBtn);
    }
    card.appendChild(bioWrap);

    if (isSelf) {
      var logout = document.createElement('button');
      logout.className = 'btn btn-danger';
      logout.type = 'button';
      logout.textContent = '退出登录';
      logout.addEventListener('click', function () {
        state.currentUser = null;
        updateNavUser();
        switchView('home');
      });
      card.appendChild(logout);
    }
    return card;
  }

  // 简介编辑框（内联）
  function buildBioEditor(user, bioText, editBtn) {
    var editor = document.createElement('div');
    editor.className = 'bio-editor';

    var ta = document.createElement('textarea');
    ta.rows = 3;
    ta.placeholder = '介绍一下自己，比如喜欢的书、读书的口味…';
    ta.value = user.bio || '';
    editor.appendChild(ta);

    var row = document.createElement('div');
    row.className = 'bio-editor-actions';

    var save = document.createElement('button');
    save.className = 'btn btn-primary btn-sm';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      var v = ta.value.trim();
      if (v.length > 200) { showError('简介最多 200 字'); return; }
      user.bio = v;
      // 退出编辑态
      editor.remove();
      bioText.textContent = v || '这个人还没有写简介。';
      bioText.hidden = false;
      editBtn.hidden = false;
      showSuccess('简介已更新');
    });
    row.appendChild(save);

    var cancel = document.createElement('button');
    cancel.className = 'btn btn-sm';
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.addEventListener('click', function () {
      editor.remove();
      bioText.hidden = false;
      editBtn.hidden = false;
    });
    row.appendChild(cancel);

    editor.appendChild(row);
    return editor;
  }

  function renderMe() {
    var box = byId('me-content');
    box.textContent = '';

    if (!state.currentUser) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      var t = document.createElement('p');
      t.className = 'empty-title';
      t.textContent = '还没登录';
      empty.appendChild(t);
      var p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '登录后可以看自己的资料，也可以去论坛发帖交流。';
      empty.appendChild(p);
      var btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = '去登录 / 注册';
      btn.addEventListener('click', function () { switchView('login'); });
      empty.appendChild(btn);
      box.appendChild(empty);
      return;
    }

    var me = state.currentUser;
    box.appendChild(buildBioCard(me, true));

    // 书单（本人）
    var shelfBox = document.createElement('div');
    shelfBox.className = 'box';
    var sh = document.createElement('div');
    sh.className = 'box-head';
    var st = document.createElement('h3');
    st.className = 'box-title';
    st.textContent = '我的书单';
    sh.appendChild(st);
    shelfBox.appendChild(sh);
    shelfBox.appendChild(buildShelves(me));
    box.appendChild(shelfBox);

    // 帖子 + 评论
    box.appendChild(buildActivity(me.id));
  }

  // 打开别人主页
  function openProfile(userId) {
    var user = userById(userId);
    if (!user) { showError('这个用户不存在'); return; }
    state.profileUserId = userId;
    renderProfile(user);
    switchViewProfile();
  }

  function switchViewProfile() {
    for (var i = 0; i < VIEW_IDS.length; i++) {
      var v = byId(VIEW_IDS[i]);
      if (v) v.hidden = (VIEW_IDS[i] !== 'view-profile');
    }
    window.scrollTo(0, 0);
  }

  function renderProfile(user) {
    var box = byId('profile-content');
    box.textContent = '';

    box.appendChild(buildBioCard(user, false));

    // 书单
    var shelfBox = document.createElement('div');
    shelfBox.className = 'box';
    var sh = document.createElement('div');
    sh.className = 'box-head';
    var st = document.createElement('h3');
    st.className = 'box-title';
    st.textContent = user.username + ' 的书单';
    sh.appendChild(st);
    shelfBox.appendChild(sh);
    shelfBox.appendChild(buildShelves(user));
    box.appendChild(shelfBox);

    // 帖子 + 评论
    box.appendChild(buildActivity(user.id));
  }

  /* =============================================================
   * 9. 事件绑定 + 启动
   * ============================================================= */

  function bindEvents() {
    // 发帖按钮：打开发帖弹窗（登录后才可发）
    byId('btn-new-post').addEventListener('click', function () {
      if (!state.currentUser) { switchView('login'); return; }
      openComposer();
    });

    // 发帖弹窗：取消 / 提交
    byId('btn-cancel-compose').addEventListener('click', function () {
      byId('modal-compose').hidden = true;
    });
    byId('form-compose').addEventListener('submit', function (e) {
      e.preventDefault();
      submitCompose();
    });

    // 热门档位切换
    byId('hot-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.filter') : null;
      if (!btn) return;
      state.currentRange = btn.getAttribute('data-range');
      var tabs = byId('hot-tabs').querySelectorAll('.filter');
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i] === btn) tabs[i].classList.add('is-active');
        else tabs[i].classList.remove('is-active');
      }
      // 本轮 mock：三档数据暂用同一份；后端就绪后按 range 拉不同窗口
      renderHot();
    });

    // 帖子流点击进详情
    byId('post-list').addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.post-card') : null;
      if (!card) return;
      state.postFromBook = false;
      openPost(card.getAttribute('data-id'));
    });

    // 热门榜点击：进「这本书的所有讨论」
    byId('hot-list').addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.hot-item') : null;
      if (item) openBookPosts(item.getAttribute('data-title'));
    });

    // 同书帖子列表里，点某条帖子进详情（postFromBook 保持 true）
    byId('book-posts-list').addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.post-card') : null;
      if (card) openPost(card.getAttribute('data-id'));
    });

    // 返回：帖子详情根据来源回「同书列表」或「论坛」
    byId('btn-post-back').addEventListener('click', function () {
      if (state.postFromBook && state.lastBookTitle) {
        openBookPosts(state.lastBookTitle);
      } else {
        switchView('forum');
      }
    });
    byId('btn-book-posts-back').addEventListener('click', function () { state.postFromBook = false; switchView('forum'); });

    // 个人主页返回（回论坛）
    byId('btn-profile-back').addEventListener('click', function () { switchView('forum'); });

    // 会话列表点击进对话
    byId('conversation-list').addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.conversation-item') : null;
      if (item) openConversation(item.getAttribute('data-id'));
    });

    // 登录/注册 tab 切换（切换时清空表单残留 + 错误提示，避免串台）
    byId('auth-tab-login').addEventListener('click', function () {
      state.authMode = 'login';
      resetAuthForm();
      renderAuth();
    });
    byId('auth-tab-register').addEventListener('click', function () {
      state.authMode = 'register';
      resetAuthForm();
      renderAuth();
    });

    // 头像色块点击
    byId('avatar-colors').addEventListener('click', function (e) {
      var sw = e.target.closest ? e.target.closest('.avatar-swatch') : null;
      if (!sw) return;
      state.avatarColor = sw.getAttribute('data-color');
      state.avatarImage = null;   // 选色块就清掉图片
      renderAvatarColors();
      refreshAvatarPreview();
    });

    // 上传头像图片
    byId('btn-avatar-upload').addEventListener('click', function () {
      byId('avatar-file-input').click();
    });
    byId('avatar-file-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        state.avatarImage = ev.target.result;
        state.avatarColor = null;
        renderAvatarColors();
        refreshAvatarPreview();
      };
      reader.readAsDataURL(file);
    });

    // 清除头像
    byId('btn-avatar-clear').addEventListener('click', function () {
      state.avatarColor = null;
      state.avatarImage = null;
      renderAvatarColors();
      refreshAvatarPreview();
    });

    // 账号名输入变化时，头像预览跟着变（首字随名字走）
    byId('auth-username').addEventListener('input', function () {
      if (state.authMode === 'register') refreshAvatarPreview();
    });

    // 提交登录/注册
    byId('form-auth').addEventListener('submit', function (e) {
      e.preventDefault();
      doAuth();
    });
  }

  function init() {
    bindNav();
    bindEvents();
    updateNavUser();
    // 默认停在首页（书单），与 app.js 的初始视图一致
    switchView('home');
  }

  init();
})();
