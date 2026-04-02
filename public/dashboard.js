(function () {
  function tabStorageKey() {
    return "phoenik_tab_" + location.pathname;
  }

  function readTabFromUrl() {
    return new URLSearchParams(location.search).get("tab");
  }

  function setActiveTab(tabId, opts) {
    opts = opts || {};
    var push = opts.push !== false;

    document.querySelectorAll(".tab-content").forEach(function (el) {
      el.classList.remove("active");
    });
    document.querySelectorAll("[data-tab]").forEach(function (el) {
      if (el.classList.contains("sidebar-nav") || el.closest(".sidebar-nav")) {
        /* only nav links */
      }
    });
    document.querySelectorAll(".sidebar-nav a[data-tab], .sidebar-nav button[data-tab]").forEach(function (a) {
      a.classList.remove("active");
    });

    var panel = document.getElementById(tabId);
    if (panel) panel.classList.add("active");

    var nav = document.querySelector('.sidebar-nav a[data-tab="' + tabId + '"], .sidebar-nav button[data-tab="' + tabId + '"]');
    if (nav) nav.classList.add("active");

    if (push) {
      var url = new URL(location.href);
      url.searchParams.set("tab", tabId);
      history.replaceState({}, "", url);
    }
    try {
      localStorage.setItem(tabStorageKey(), tabId);
    } catch (_) {}

    window.dispatchEvent(new CustomEvent("phoenik:tab", { detail: tabId }));
  }

  window.PhoenikDash = {
    setTab: setActiveTab,
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".sidebar-nav a[data-tab]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        setActiveTab(a.getAttribute("data-tab"), { push: true });
      });
    });
    document.querySelectorAll(".sidebar-nav button[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActiveTab(btn.getAttribute("data-tab"), { push: true });
      });
    });

    var initial = readTabFromUrl();
    if (!initial) {
      try {
        initial = localStorage.getItem(tabStorageKey());
      } catch (_) {}
    }
    if (initial && document.getElementById(initial)) {
      setActiveTab(initial, { push: !readTabFromUrl() });
    } else if (document.getElementById("tab-overview")) {
      setActiveTab("tab-overview", { push: !readTabFromUrl() });
    } else {
      var first = document.querySelector(".tab-content");
      if (first && first.id) setActiveTab(first.id, { push: false });
    }

    var toggle = document.getElementById("mobileSidebarToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        document.body.classList.toggle("sidebar-open");
      });
    }
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("sidebar-open")) return;
      var rail = document.querySelector(".sidebar-rail");
      if (!rail) return;
      if (e.target === toggle || toggle.contains(e.target)) return;
      if (!rail.contains(e.target)) document.body.classList.remove("sidebar-open");
    });
  });
})();
