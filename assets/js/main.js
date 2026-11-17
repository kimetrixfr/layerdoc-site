(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var narrow = window.matchMedia("(max-width: 900px)");
  function onChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn); else mq.addListener(fn);
  }

  /* ---------- Menu burger (≤ 900 px) ---------- */
  var header = document.querySelector(".ld-header");
  var toggle = document.getElementById("nav-toggle");
  var menu = document.getElementById("menu-mobile");
  var bar = document.querySelector(".ld-bar");
  var formSection = document.getElementById("formulaire");

  function setMenu(open, focusToggle) {
    if (!header || !toggle) return;
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open && focusToggle) toggle.focus();
    refreshBar();
  }

  /* Barre d'action collante : visible sur mobile, masquée sur le formulaire ou quand le menu est ouvert. */
  var formVisible = false;
  function refreshBar() {
    if (!bar) return;
    var menuOpen = header && header.classList.contains("is-open");
    bar.classList.toggle("is-hidden", formVisible || menuOpen);
    document.body.classList.toggle("has-ld-bar", narrow.matches);
  }
  if (bar && formSection && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      formVisible = entries[entries.length - 1].isIntersecting;
      refreshBar();
    }).observe(formSection);
  }
  onChange(narrow, function () { if (!narrow.matches) setMenu(false); refreshBar(); });
  refreshBar();

  if (header && toggle && menu) {
    toggle.addEventListener("click", function () { setMenu(!header.classList.contains("is-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) setMenu(false, true);
    });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("is-open") && !header.contains(e.target)) setMenu(false);
    });
  }

  /* ---------- Boutons d'action : mène au formulaire, préremplit le motif et le message ---------- */
  var form = document.getElementById("contact-form");
  var message = document.getElementById("message");
  var motifSelect = form && form.elements.besoin;
  var thanks = document.getElementById("form-thanks");

  // Clés = valeur de data-motif (et data-prefill) des boutons de la page.
  var PREFILL = {
    standard: { motif: "Standard", text: "Bonjour, je souhaite en savoir plus sur l'offre Standard de Layerdoc." },
    demo: { motif: "Démo Enterprise", text: "Bonjour, je souhaite une démonstration et un devis pour Layerdoc Enterprise." },
    accompagnement: { motif: "Accompagnement", text: "Bonjour, je souhaite que vous documentiez mes données de A à Z. Voici mon contexte\u00a0: " },
    agence: { motif: "Autre", text: "Bonjour, je souhaite en savoir plus sur l'offre agences de Layerdoc." }
  };
  // Message proposé quand on change de motif à la main (uniquement si le message n'a pas été réécrit).
  var MOTIF_TEXT = {
    "Standard": PREFILL.standard.text,
    "Démo Enterprise": PREFILL.demo.text,
    "Programme pionniers": "Bonjour, je souhaite rejoindre le programme pionniers de Layerdoc. Voici mon contexte\u00a0: ",
    "Dossier sécurité": "Bonjour, je souhaite recevoir le dossier sécurité de Layerdoc.",
    "Accompagnement": PREFILL.accompagnement.text,
    "Autre": ""
  };

  if (form && message && motifSelect && formSection) {
    document.querySelectorAll("[data-motif]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var preset = PREFILL[el.getAttribute("data-prefill") || el.getAttribute("data-motif")];
        if (!preset) return;
        e.preventDefault();
        // Si le formulaire a déjà été envoyé, on le réaffiche pour une nouvelle demande.
        if (form.hidden) { form.hidden = false; thanks.hidden = true; }
        motifSelect.value = preset.motif;
        message.value = preset.text;
        formSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        if (history.replaceState) history.replaceState(null, "", "#formulaire");
        message.focus({ preventScroll: true });
        message.setSelectionRange(message.value.length, message.value.length);
      });
    });

    motifSelect.addEventListener("change", function () {
      var current = message.value.trim();
      var untouched = !current || Object.keys(MOTIF_TEXT).some(function (k) { return MOTIF_TEXT[k].trim() === current; });
      if (untouched) message.value = MOTIF_TEXT[motifSelect.value] || "";
    });
  }

  /* ---------- FAQ : « Voir plus de questions » / « Voir moins » ---------- */
  var moreBtn = document.querySelector(".ld-more-btn");
  var morePanel = document.getElementById("faq-more");
  if (moreBtn && morePanel) {
    moreBtn.addEventListener("click", function () {
      var open = moreBtn.getAttribute("aria-expanded") !== "true";
      morePanel.hidden = !open;
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) {
        morePanel.querySelectorAll("details[open]").forEach(function (d) { d.open = false; });
        moreBtn.scrollIntoView({ block: "nearest" });
      }
    });
  }

  /* ---------- Formulaire Web3Forms ---------- */
  if (!form) return;
  var errorBox = document.getElementById("form-error");
  var submit = form.querySelector('button[type="submit"]');
  var submitLabel = submit.textContent;

  function showError(text) { errorBox.textContent = text; errorBox.hidden = false; }
  function clearError() { errorBox.hidden = true; errorBox.textContent = ""; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    // Validation native (champs obligatoires), avec message clair.
    var invalid = form.querySelectorAll(":invalid");
    form.querySelectorAll("[aria-invalid]").forEach(function (f) { f.removeAttribute("aria-invalid"); });
    if (invalid.length) {
      invalid.forEach(function (f) { f.setAttribute("aria-invalid", "true"); });
      showError("Merci de remplir les champs obligatoires : nom, e-mail professionnel, entreprise, et la case de consentement.");
      invalid[0].focus();
      return;
    }

    if (!WEB3FORMS_ACCESS_KEY) {
      showError("Le formulaire n'est pas encore activé. Votre message n'a pas été envoyé.");
      return;
    }

    var fd = new FormData(form);
    var motif = fd.get("besoin") || "";
    var payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: "Layerdoc : nouvelle demande" + (motif ? " – " + motif : "") + " (landing page)",
      from_name: "Landing page Layerdoc",
      name: fd.get("nom"),
      email: fd.get("email"),
      entreprise: (fd.get("entreprise") || "").trim(),
      besoin: motif,
      message: fd.get("message") || "",
      consentement: "Oui",
      botcheck: form.elements.botcheck.checked ? "1" : ""
    };

    submit.disabled = true;
    submit.textContent = "Envoi en cours…";

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        // Le remerciement ne s'affiche qu'après une réponse positive de l'API.
        if (r.ok && r.data && r.data.success === true) {
          form.reset();
          form.hidden = true;
          thanks.hidden = false;
          thanks.focus();
        } else {
          throw new Error("api");
        }
      })
      .catch(function () {
        showError("L'envoi a échoué. Vos données sont conservées : réessayez dans un instant, ou écrivez-nous directement.");
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = submitLabel;
      });
  });
})();
