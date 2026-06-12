/* FoundReach Growth white-label for embedded Suna / Kortix.
   Debrands Kortix/Suna -> FoundReach, hides logos + external links, sets a clean
   title, and per-Clerk auto-login: /__fr-session mints a self-hosted-Supabase
   session for the Clerk user, which we write into the @supabase/ssr auth cookie
   (sb-kortix-auth-token) so the embedded Suna logs in with no UI. */
(function () {
  /* ---- per-Clerk Supabase auto-login (runs before the debrand UI work) ---- */
  function b64url(str) {
    var b = btoa(unescape(encodeURIComponent(str)));
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function hasAuthCookie() {
    return /(^|;\s*)sb-kortix-auth-token(\.\d+)?=/.test(document.cookie);
  }
  function setAuthCookie(val) {
    var tail = "; path=/; max-age=2592000; samesite=none; secure; partitioned";
    for (var i = 0; i < 8; i++) document.cookie = "sb-kortix-auth-token." + i + "=; path=/; max-age=0";
    document.cookie = "sb-kortix-auth-token=; path=/; max-age=0";
    var CHUNK = 3180;
    if (val.length <= CHUNK) { document.cookie = "sb-kortix-auth-token=" + val + tail; return; }
    var idx = 0, off = 0;
    while (off < val.length) { document.cookie = "sb-kortix-auth-token." + idx + "=" + val.substr(off, CHUNK) + tail; off += CHUNK; idx++; }
  }
  try {
    var fru = new URLSearchParams(location.search).get("fr_user") || "";
    if (fru && fru !== "shared" && !hasAuthCookie()) {
      fetch("/__fr-session?fr_user=" + encodeURIComponent(fru), { credentials: "include" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok && d.session && d.session.access_token) {
            setAuthCookie("base64-" + b64url(JSON.stringify(d.session)));
            location.reload();
          }
        }).catch(function () {});
    }
  } catch (e) {}

  var MAP = [[/kortix/gi, "FoundReach"], [/\bsuna\b/gi, "FoundReach"]];
  function relabel(s) { for (var i = 0; i < MAP.length; i++) s = s.replace(MAP[i][0], MAP[i][1]); return s; }

  var css = document.createElement("style");
  css.textContent =
    'a[href*="kortix"],a[href*="suna.so"],a[href*="discord"],a[href*="github.com/kortix"],' +
    '[class*="powered" i],[class*="logo" i],[id*="logo" i],[class*="brand" i],[id*="brand" i],' +
    'img[alt*="kortix" i],img[src*="kortix" i],img[alt*="suna" i],img[src*="suna" i],' +
    'a[href="/"]>svg,a[href="/"]>img,svg[class*="logo" i],picture[class*="logo" i],link[rel*="icon"]' +
    '{display:none!important}';
  (document.head || document.documentElement).appendChild(css);

  function strip() {
    try { document.title = "FoundReach Growth"; } catch (e) {}
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false), n, c = 0;
      while ((n = w.nextNode()) && c < 6000) {
        c++; var v = n.nodeValue;
        if (v && /kortix|suna/i.test(v)) n.nodeValue = relabel(v);
      }
    } catch (e) {}
    // top-left brand logo sweep (CSS misses inline svgs with no logo class)
    try {
      var media = document.querySelectorAll('img,svg,picture,canvas');
      for (var i = 0; i < media.length; i++) {
        var r = media[i].getBoundingClientRect();
        if (r.width > 0 && r.left < 120 && r.top < 84 && r.bottom < 100 && r.width < 150) {
          media[i].style.display = "none";
        }
      }
    } catch (e) {}
  }
  var pending = false;
  function sched() { if (pending) return; pending = true; setTimeout(function () { pending = false; strip(); }, 600); }
  function boot() {
    strip();
    try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
  [800, 2500, 6000].forEach(function (t) { setTimeout(strip, t); });
})();
