// Static demo only (GitHub Pages, `npm run demo:build`): answers the pages' /api/* calls inside the browser,
// from the committed fictional month (demo/*.json, written by scripts/build-demo.ts). Lines written here are kept
// in this browser only (localStorage). Nothing is sent anywhere, and Claude is never called.
// 試し版だけ: 画面の /api/* への問い合わせに、ブラウザの中で架空の1か月 (demo/*.json) から答える。
// 書いた1行はこのブラウザの中だけに残り、どこにも送らない。Claude は呼ばない。
(function () {
  "use strict";
  var BASE = "/mienai-ganbari";
  var KEY = "mienai-ganbari-demo-entries";
  var MAX_CHARS = 200; // same as src/lib/entries.ts
  var NO_CLAUDE = "この試し版では Claude を呼びません（手元で動かすと呼べます）";
  var NO_SAVE = "この試し版では保存しません（手元で動かすと保存できます）";
  var realFetch = window.fetch.bind(window);
  var files = {};
  var memory = [];

  function data(name) {
    if (!files[name]) {
      files[name] = realFetch(BASE + "/demo/" + name + ".json").then(function (r) {
        if (!r.ok) throw new Error(name + ": " + r.status);
        return r.json();
      });
    }
    return files[name];
  }

  function reply(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json" } });
  }

  function readLocal() {
    try {
      var v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return memory;
    }
  }

  function writeLocal(list) {
    memory = list;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // private mode or blocked storage: the line stays in memory until the page is closed
    }
  }

  function todayJst() {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "demo-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  // oldest first, like listEntries() in src/lib/entries.ts
  function byDate(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  }

  // the same checks and messages as validateEntry() in src/lib/entries.ts
  function validate(staff, authorId, text) {
    var known = staff.some(function (s) {
      return s.id === authorId;
    });
    if (typeof authorId !== "string" || !known) return "名前を一覧から選んでください";
    if (typeof text !== "string") return "1行を書いてください";
    if (/[\r\n\u2028\u2029]/.test(text)) return "1行で書いてください（改行は入れられません）";
    if (text.trim().length === 0) return "1行を書いてください";
    if (Array.from(text).length > MAX_CHARS) return MAX_CHARS + "文字までにしてください";
    return null;
  }

  function parseBody(init) {
    try {
      return JSON.parse((init && init.body) || "{}");
    } catch {
      return null;
    }
  }

  // F10: the demo never calls Claude, so the question back is written beforehand, only for the fictional month's
  // vague lines (the same sentences as the "あいまいな例" button). Any other line gets no question, as when Claude
  // finds nothing missing.
  // F10: 試し版は Claude を呼ばないので、架空の月のあいまいな1行 (「あいまいな例」と同じ文) にだけ、用意した聞き返しを出す。
  var ASKED = {
    "いろいろ手伝いました。": "だれの、どんな仕事を手伝いましたか？",
    "今日もみんなよく頑張っていた。": "だれが、どんなことをしていましたか？",
    "今日は忙しかったけど、なんとか回った。": "だれが、どんな仕事をしていましたか？",
    "Hôm nay mọi người đều cố gắng.": "Ai đã làm việc gì vậy?",
    "Hôm nay bận nhưng mọi việc vẫn ổn.": "Hôm nay ai đã làm việc gì vậy?",
    "Semua orang bekerja keras hari ini.": "Siapa yang mengerjakan apa hari ini?",
    "Hari ini sibuk, tapi semuanya lancar.": "Siapa yang mengerjakan apa sampai semuanya lancar?",
  };

  // changes one line written here (like updateLocalEntry() in src/lib/entries.ts)
  function updateLocal(id, change) {
    var list = readLocal();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var next = change(list[i]);
        if (typeof next === "string") return next;
        list[i] = next;
        writeLocal(list);
        return next;
      }
    }
    return "その1行が見つかりません";
  }

  // the same checks and messages as validateAnswer() in src/lib/entries.ts
  function validateAnswer(answer) {
    if (typeof answer !== "string") return "答えを1行で書いてください";
    if (/[\r\n\u2028\u2029]/.test(answer)) return "1行で書いてください（改行は入れられません）";
    if (answer.trim().length === 0) return "答えを1行で書いてください";
    if (Array.from(answer).length > MAX_CHARS) return MAX_CHARS + "文字までにしてください";
    return null;
  }

  function json(name) {
    return data(name).then(function (d) {
      return reply(d);
    });
  }

  function route(method, path, url, init) {
    if (path === "/api/entries" && method === "GET") {
      var limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 500);
      return data("entries").then(function (seed) {
        var all = seed.concat(readLocal()).sort(byDate);
        return reply({ total: all.length, entries: all.slice(-limit).reverse() });
      });
    }
    if (path === "/api/entries" && method === "POST") {
      return data("staff").then(function (staff) {
        var b = parseBody(init);
        if (!b) return reply({ error: "送る形がちがいます" }, 400);
        var problem = validate(staff, b.authorId, b.text);
        if (problem) return reply({ error: problem }, 400);
        var person = staff.filter(function (s) {
          return s.id === b.authorId;
        })[0];
        var entry = {
          id: newId(),
          date: todayJst(),
          authorId: person.id,
          lang: person.lang,
          text: b.text,
          createdAt: new Date().toISOString(),
          source: "app",
        };
        writeLocal(readLocal().concat([entry]));
        return reply({ entry: entry }, 201);
      });
    }
    if (path === "/api/entries/ask" && method === "POST") {
      var ab = parseBody(init) || {};
      var asked = null;
      updateLocal(ab.entryId, function (e) {
        var q = ASKED[String(e.text).trim()];
        if (e.clarification || !q) return "no question";
        asked = q;
        return Object.assign({}, e, { clarification: { question: q, askedAt: new Date().toISOString() } });
      });
      return Promise.resolve(reply({ question: asked }));
    }
    if (path === "/api/entries/answer" && method === "POST") {
      var bb = parseBody(init);
      if (!bb) return Promise.resolve(reply({ error: "送る形がちがいます" }, 400));
      var bad = validateAnswer(bb.answer);
      if (bad) return Promise.resolve(reply({ error: bad }, 400));
      var r = updateLocal(bb.entryId, function (e) {
        if (!e.clarification) return "この1行には聞き返していません";
        if (e.clarification.answer !== undefined) return "答えはもう足してあります";
        return Object.assign({}, e, {
          clarification: Object.assign({}, e.clarification, { answer: bb.answer, answeredAt: new Date().toISOString() }),
        });
      });
      if (typeof r === "string") return Promise.resolve(reply({ error: r }, 400));
      return Promise.resolve(reply({ entry: r }));
    }
    if (method === "GET" && path === "/api/month") return json("month");
    if (method === "GET" && path === "/api/monosashi") return json("monosashi");
    if (method === "GET" && path === "/api/monosashi/examples") return json("examples");
    if (path === "/api/letters" || path === "/api/monosashi") return Promise.resolve(reply({ error: NO_CLAUDE }, 503));
    if (path === "/api/monosashi/examples") return Promise.resolve(reply({ error: NO_SAVE }, 503));
    return Promise.resolve(reply({ error: "見つかりません" }, 404));
  }

  window.fetch = function (input, init) {
    var raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    var url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin) {
      var path = url.pathname;
      if (path.indexOf(BASE + "/api/") === 0) path = path.slice(BASE.length);
      if (path.indexOf("/api/") === 0) {
        var method = ((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
        return route(method, path.replace(/\/+$/, ""), url, init).catch(function () {
          return reply({ error: "読み込めませんでした" }, 500);
        });
      }
    }
    return realFetch(input, init);
  };
})();
