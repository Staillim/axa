// ============== APP STATE (balance + transactions) ==============
// El balance y las transacciones se persisten en localStorage para que
// sobrevivan al cerrar sesión y al recargar la página.
const BALANCE_KEY = "roblox_clone_balance";

function loadBalanceState() {
    try {
        const raw = localStorage.getItem(BALANCE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            return {
                balance: Number(data.balance) || 0,
                transactions: Array.isArray(data.transactions) ? data.transactions : [],
            };
        }
    } catch (_) { /* ignore */ }
    return { balance: 0, transactions: [] };
}

function saveBalanceState() {
    try {
        localStorage.setItem(BALANCE_KEY, JSON.stringify({
            balance: appState.balance,
            transactions: appState.transactions,
        }));
    } catch (_) { /* ignore quota errors */ }
}

const appState = loadBalanceState();

// Pintar el balance y las transacciones persistidas al cargar la página
updateBalanceDisplay();
updateTransactionsDisplay();

function formatNum(n) {
    return Number(n || 0).toLocaleString("en-US");
}

function updateBalanceDisplay() {
    document.querySelectorAll("[data-app-balance]").forEach((el) => {
        el.textContent = formatNum(appState.balance);
    });
}

function updateTransactionsDisplay() {
    const incoming = appState.transactions
        .filter((t) => t.type === "in")
        .reduce((sum, t) => sum + t.amount, 0);
    const outgoing = appState.transactions
        .filter((t) => t.type === "out")
        .reduce((sum, t) => sum + t.amount, 0);
    document.querySelectorAll("[data-tx-incoming]").forEach((el) => {
        el.textContent = formatNum(incoming);
    });
    document.querySelectorAll("[data-tx-outgoing]").forEach((el) => {
        el.textContent = formatNum(outgoing);
    });
}

function addTransaction(type, amount, party) {
    appState.transactions.unshift({
        type,
        amount,
        party: party || "",
        date: new Date(),
    });
    if (type === "in") appState.balance += amount;
    else if (type === "out") appState.balance = Math.max(0, appState.balance - amount);
    updateBalanceDisplay();
    updateTransactionsDisplay();
    saveBalanceState();
}

function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${label || "Procesando..."}`;
        btn.classList.add("loading");
        btn.disabled = true;
    } else {
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

// ============== Global helpers ==============
function showToast(message) {
    const t = document.createElement("div");
    t.className = "send-toast";
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.transition = "opacity 0.2s, transform 0.2s";
        t.style.opacity = "0";
        t.style.transform = "translate(-50%, 10px)";
        setTimeout(() => t.remove(), 220);
    }, 2200);
}

// ============== TAB SWITCHING ==============
(function () {
    const tabs = document.querySelectorAll(".tab");
    const sections = document.querySelectorAll(".section");

    function activateTab(tabName) {
        tabs.forEach((t) => {
            t.classList.toggle("active", t.dataset.tab === tabName);
        });
        sections.forEach((s) => {
            s.classList.toggle("section-active", s.id === tabName);
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    // External buttons that jump to a specific tab (data-go-to="<tabname>")
    document.querySelectorAll("[data-go-to]").forEach((el) => {
        el.addEventListener("click", () => activateTab(el.dataset.goTo));
    });
})();

// ============== MODAL: ENVIAR ROBUX ==============
(function () {
    const overlay = document.getElementById("sendModal");
    const openBtn = document.getElementById("openSendModal");
    const closeBtn = document.getElementById("closeSendModal");
    if (!overlay || !openBtn || !closeBtn) return;

    const searchInput = document.getElementById("userSearch");
    const stateInitial = document.getElementById("modalState");
    const stateLoading = document.getElementById("modalLoading");
    const stateResults = document.getElementById("modalResults");
    const stateNoResults = document.getElementById("modalNoResults");
    const stateError = document.getElementById("modalError");
    const fallbackBanner = document.getElementById("fallbackBanner");

    function showState(name) {
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = el.dataset.state !== name && !el.classList.contains(`modal-state-${name}`);
        });
    }
    function showOnly(name) {
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = true;
        });
        const map = {
            initial: stateInitial,
            loading: stateLoading,
            results: stateResults,
            noresults: stateNoResults,
            error: stateError,
        };
        if (map[name]) map[name].hidden = false;
    }

    function openModal() {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        setTimeout(() => searchInput.focus(), 150);
        document.body.style.overflow = "hidden";
    }
    function closeModal() {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        // reset state on close
        searchInput.value = "";
        showOnly("initial");
        fallbackBanner.hidden = true;
    }

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
    });

    // ============== USER SEARCH ==============
    // Detect environment: localhost → local proxy, anything else → netlify function
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const API_BASE = isLocal ? "http://localhost:3000" : "/.netlify/functions/roblox-user";

    // Fallback users — used when the proxy is offline so the UI never breaks
    const FALLBACK_USERS = [
        { id: 1, name: "Roblox", displayName: "Roblox", hasVerifiedBadge: true, avatarUrl: null },
        { id: 2, name: "Stickmasterluke", displayName: "Stickmasterluke", hasVerifiedBadge: true, avatarUrl: null },
        { id: 3, name: "Shedletsky", displayName: "Shedletsky", hasVerifiedBadge: true, avatarUrl: null },
        { id: 4, name: "Saturu_Gojo", displayName: "Saturu_Gojo", hasVerifiedBadge: false, avatarUrl: null },
        { id: 5, name: "SharkBlox", displayName: "SharkBlox", hasVerifiedBadge: false, avatarUrl: null },
        { id: 6, name: "Stail", displayName: "Stail", hasVerifiedBadge: false, avatarUrl: null },
    ];

    function buildUserUrl(name) {
        return isLocal
            ? `${API_BASE}/api/user/${encodeURIComponent(name)}`
            : `${API_BASE}?name=${encodeURIComponent(name)}`;
    }

    function initialOf(name) {
        return (name || "?").trim().charAt(0).toUpperCase();
    }

    function userCard(user) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "user-card";
        card.dataset.userId = user.id;

        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        if (user.avatarUrl) {
            const img = document.createElement("img");
            img.src = user.avatarUrl;
            img.alt = user.displayName || user.name;
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            img.onerror = () => {
                img.remove();
                avatar.textContent = initialOf(user.displayName || user.name);
            };
            avatar.appendChild(img);
        } else {
            avatar.textContent = initialOf(user.displayName || user.name);
        }

        const info = document.createElement("div");
        info.className = "user-info";

        const display = document.createElement("div");
        display.className = "user-display";
        display.textContent = user.displayName || user.name;
        if (user.hasVerifiedBadge) {
            const v = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            v.setAttribute("class", "verified-badge");
            v.setAttribute("viewBox", "0 0 24 24");
            v.setAttribute("width", "14");
            v.setAttribute("height", "14");
            v.setAttribute("fill", "currentColor");
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
            v.appendChild(p);
            display.appendChild(v);
        }

        const name = document.createElement("div");
        name.className = "user-name";
        name.textContent = "@" + user.name;

        info.appendChild(display);
        info.appendChild(name);

        const action = document.createElement("div");
        action.className = "user-action";
        action.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

        card.appendChild(avatar);
        card.appendChild(info);
        card.appendChild(action);

        card.addEventListener("click", () => selectUser(user, card));
        return card;
    }

    function renderResults(users) {
        stateResults.innerHTML = "";
        if (!users || users.length === 0) {
            showOnly("noresults");
            return;
        }
        const heading = document.createElement("h3");
        heading.className = "modal-section-title";
        heading.textContent = "Resultados";
        stateResults.appendChild(heading);

        const list = document.createElement("div");
        list.className = "user-list";
        users.forEach((u) => list.appendChild(userCard(u)));
        stateResults.appendChild(list);
        showOnly("results");
    }

    // ============== SEND FLOW (multi-step) ==============
    let sendState = {
        user: null,
        amount: 0,
    };

    function avatarImg(user) {
        if (user.avatarUrl) {
            return `<img src="${escapeHtml(user.avatarUrl)}" alt="" onerror="this.remove();this.parentNode.textContent='${escapeHtml(initialOf(user.displayName || user.name))}'" />`;
        }
        return escapeHtml(initialOf(user.displayName || user.name));
    }

    // Generate consistent mock details per user
    function recipientDetails(user) {
        const key = (user.name || "").toString();
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        const months = (hash % 36) + 1;
        const friends = hash % 16;
        const year = 2015 + (hash % 8);
        return { months, friends, year };
    }

    function showSendStep(step) {
        sendState.step = step;
        // Hide all other states inside the modal body
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = true;
        });
        // Remove any previous send-flow container
        const existing = stateResults.parentNode.querySelector(".send-flow");
        if (existing) existing.remove();

        if (step === "results") {
            stateResults.hidden = false;
            return;
        }

        // Create send-flow container
        const flow = document.createElement("div");
        flow.className = "send-flow";
        flow.dataset.step = step;

        if (step === "amount") flow.innerHTML = amountStepHTML(sendState.user);
        else if (step === "confirm") flow.innerHTML = confirmStepHTML(sendState.user, sendState.amount);
        else if (step === "loading") flow.innerHTML = loadingStepHTML();
        else if (step === "success") flow.innerHTML = successStepHTML(sendState.user, sendState.amount);

        // Insert into modal body, after the search input
        const searchInput = document.getElementById("userSearch");
        searchInput.parentNode.insertBefore(flow, searchInput.nextSibling);

        wireSendStep(flow, step);
    }

    function amountStepHTML(user) {
        return `
            <div class="send-step" data-step="amount">
                <div class="send-recipient">
                    <button class="send-back-btn" type="button" data-action="back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="send-recipient-avatar">${avatarImg(user)}</div>
                    <div class="send-recipient-name">${escapeHtml(user.displayName || user.name)}</div>
                </div>
                <div class="send-amount-display">
                    <span class="robux-hex"></span>
                    <input type="number" min="1" class="send-amount-input" value="${sendState.amount || ""}" placeholder="0" inputmode="numeric" />
                </div>
                <div class="send-amount-chips">
                    <button class="send-amount-chip" type="button" data-amount="25"><span class="robux-hex-small"></span> 25</button>
                    <button class="send-amount-chip" type="button" data-amount="50"><span class="robux-hex-small"></span> 50</button>
                    <button class="send-amount-chip" type="button" data-amount="100"><span class="robux-hex-small"></span> 100</button>
                    <button class="send-amount-chip" type="button" data-amount="200"><span class="robux-hex-small"></span> 200</button>
                </div>
                <button class="send-primary-btn" type="button" data-action="next" disabled>Next</button>
                <p class="send-fee-note">Robux are sent instantly with no fees</p>
            </div>
        `;
    }

    function confirmStepHTML(user, amount) {
        const d = recipientDetails(user);
        return `
            <div class="send-step" data-step="confirm">
                <div class="send-recipient">
                    <button class="send-back-btn" type="button" data-action="back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="send-recipient-avatar">${avatarImg(user)}</div>
                    <div class="send-recipient-name">${escapeHtml(user.displayName || user.name)}</div>
                    <div class="send-recipient-username">@${escapeHtml(user.name)}</div>
                    <div class="send-recipient-details">
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            Connected ${d.months} ${d.months === 1 ? "month" : "months"}
                        </span>
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            ${d.friends} mutual Friends
                        </span>
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Joined in ${d.year}
                        </span>
                    </div>
                </div>
                <div class="send-amount-display">
                    <span class="robux-hex"></span>
                    <span class="send-amount-input" style="border:none;outline:none;background:none;width:auto;padding:0;">${formatNum(amount)}</span>
                </div>
                <p class="send-confirm-text">The recipient will get <strong>${formatNum(amount)}</strong> Robux.</p>
                <div class="send-actions">
                    <button class="send-primary-btn active" type="button" data-action="send">Send</button>
                    <button class="send-secondary-btn" type="button" data-action="edit">Edit</button>
                </div>
                <p class="send-fee-note">You need an age check or parental consent to send Robux</p>
            </div>
        `;
    }

    function loadingStepHTML() {
        return `
            <div class="send-step" data-step="loading">
                <div class="send-loading">
                    <div class="spinner" aria-hidden="true"></div>
                    <p>Enviando Robux…</p>
                </div>
            </div>
        `;
    }

    function successStepHTML(user, amount) {
        return `
            <div class="send-step" data-step="success">
                <div class="send-success">
                    <div class="send-success-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h3>You sent ${formatNum(amount)} Robux</h3>
                    <p>a <strong>@${escapeHtml(user.name)}</strong></p>
                </div>
            </div>
        `;
    }

    function formatNum(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function wireSendStep(flow, step) {
        if (step === "amount") {
            const input = flow.querySelector(".send-amount-input");
            const chips = flow.querySelectorAll(".send-amount-chip");
            const nextBtn = flow.querySelector('[data-action="next"]');
            const backBtn = flow.querySelector('[data-action="back"]');

            function updateAmount(value) {
                sendState.amount = parseInt(value, 10) || 0;
                chips.forEach((c) => c.classList.toggle("selected", parseInt(c.dataset.amount, 10) === sendState.amount));
                if (sendState.amount > 0) {
                    nextBtn.classList.add("active");
                    nextBtn.disabled = false;
                } else {
                    nextBtn.classList.remove("active");
                    nextBtn.disabled = true;
                }
            }

            input.addEventListener("input", (e) => updateAmount(e.target.value));
            chips.forEach((chip) => {
                chip.addEventListener("click", () => {
                    const v = parseInt(chip.dataset.amount, 10);
                    input.value = v;
                    updateAmount(v);
                });
            });
            nextBtn.addEventListener("click", () => {
                if (sendState.amount > 0) showSendStep("confirm");
            });
            backBtn.addEventListener("click", () => showSendStep("results"));
            updateAmount(sendState.amount);

            setTimeout(() => input.focus(), 100);
        } else if (step === "confirm") {
            const backBtn = flow.querySelector('[data-action="back"]');
            const editBtn = flow.querySelector('[data-action="edit"]');
            const sendBtn = flow.querySelector('[data-action="send"]');
            backBtn && backBtn.addEventListener("click", () => showSendStep("amount"));
            editBtn && editBtn.addEventListener("click", () => showSendStep("amount"));
            sendBtn && sendBtn.addEventListener("click", () => {
                const amount = sendState.amount;
                const recipient = sendState.user ? (sendState.user.name || "") : "";
                setButtonLoading(sendBtn, true, "Enviando...");
                setTimeout(() => {
                    setButtonLoading(sendBtn, false);
                    showSendStep("loading");
                    setTimeout(() => {
                        addTransaction("out", amount, recipient);
                        showSendStep("success");
                        setTimeout(closeModal, 1800);
                    }, 800);
                }, 700);
            });
        }
    }

    function selectUser(user, cardEl) {
        sendState.user = user;
        sendState.amount = 0;
        showSendStep("amount");
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        })[c]);
    }

    let lastReq = 0;
    let debounceId = null;
    async function search(query) {
        query = (query || "").trim();
        if (query.length === 0) {
            fallbackBanner.hidden = true;
            showOnly("initial");
            return;
        }
        if (query.length < 3) {
            fallbackBanner.hidden = true;
            showOnly("initial");
            return;
        }
        const reqId = ++lastReq;
        showOnly("loading");
        try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(buildUserUrl(query), { signal: ctrl.signal });
            clearTimeout(timeout);
            if (reqId !== lastReq) return; // stale
            if (res.status === 404) {
                fallbackBanner.hidden = true;
                renderResults([]);
                return;
            }
            if (!res.ok) throw new Error("HTTP " + res.status);
            const user = await res.json();
            if (reqId !== lastReq) return;
            fallbackBanner.hidden = true;
            renderResults([user]);
        } catch (e) {
            if (reqId !== lastReq) return;
            // Proxy down / network error — use fallback
            const filtered = FALLBACK_USERS.filter((u) => {
                const q = query.toLowerCase();
                return u.name.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q));
            });
            fallbackBanner.hidden = false;
            if (filtered.length === 0) {
                showOnly("noresults");
            } else {
                renderResults(filtered);
            }
        }
    }

    searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceId);
        const value = e.target.value;
        debounceId = setTimeout(() => search(value), 300);
    });
})();

// ============== ROBUX DROPDOWN (navbar) ==============
(function () {
    const btn = document.getElementById("robuxMenuBtn");
    const dropdown = document.getElementById("robuxDropdown");
    if (!btn || !dropdown) return;

    function open() {
        dropdown.hidden = false;
        btn.setAttribute("aria-expanded", "true");
    }
    function close() {
        dropdown.hidden = true;
        btn.setAttribute("aria-expanded", "false");
    }
    function isOpen() {
        return !dropdown.hidden;
    }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        isOpen() ? close() : open();
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target)) return;
        close();
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) close();
    });

    // Close after clicking any item (so data-go-to lands on the new tab without the menu still open)
    dropdown.querySelectorAll(".robux-dropdown-item").forEach((item) => {
        item.addEventListener("click", () => close());
    });
})();

// ============== PAGO ==============
(function () {
    const pagoSection = document.getElementById("pago");
    if (!pagoSection) return;

    const pkgButtons = document.querySelectorAll("[data-pkg-amount]");
    const viewMain = pagoSection.querySelector('[data-view="main"]');
    const viewVerify = pagoSection.querySelector('[data-view="verify"]');
    const viewSuccess = pagoSection.querySelector('[data-view="success"]');
    const continueBtn = pagoSection.querySelector('[data-action="continue"]');
    const verifyBtn = pagoSection.querySelector('[data-action="verify"]');
    const backLink = pagoSection.querySelector('[data-action="back-to-main"]');
    const methodButtons = pagoSection.querySelectorAll(".pago-method");
    const pinInputs = pagoSection.querySelectorAll(".pago-pin");

    const METHOD_LABELS = {
        card: "Tarjeta de crédito o débito",
        paypal: "Paypal",
        redeem: "Canjear tarjetas de Roblox",
        other: "Otro",
    };

    function formatNum(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function showView(name) {
        viewMain.hidden = name !== "main";
        viewVerify.hidden = name !== "verify";
        viewSuccess.hidden = name !== "success";
    }

    // Estado del paquete seleccionado (para acreditar el bonus al verificar)
    let currentPkg = { amount: 0, bonus: 0 };

    // 1. Click en un package → navega a #pago y rellena el resumen
    pkgButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            // Si el botón no estaba en un .package-row, igual leemos data-attrs
            const amount = parseInt(btn.dataset.pkgAmount, 10) || 0;
            const old = btn.dataset.pkgOld;
            const price = btn.dataset.pkgPrice;
            const bonus = parseInt(btn.dataset.pkgBonus, 10) || 0;

            // Guardar en el estado del pago para usarlo al verificar
            currentPkg = { amount, bonus };

            pagoSection.querySelector("[data-pago-amount]").textContent = formatNum(amount);
            pagoSection.querySelector("[data-pago-old]").textContent = formatNum(old);
            pagoSection.querySelector("[data-pago-price]").textContent = `EUR ${parseFloat(price).toFixed(2)}`;
            pagoSection.querySelector("[data-pago-bonus]").textContent = `+${formatNum(bonus)} bonificación`;

            showView("main");
            // Reset PIN
            pinInputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); });
            verifyBtn.disabled = true;
        });
    });

    // 2. Selección de método de pago
    methodButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            methodButtons.forEach((b) => {
                b.classList.remove("selected");
                b.setAttribute("aria-checked", "false");
            });
            btn.classList.add("selected");
            btn.setAttribute("aria-checked", "true");
            const method = btn.dataset.method;
            pagoSection.querySelector("[data-pago-method-label]").textContent = METHOD_LABELS[method] || "Paypal";
        });
    });

    // 3. Continuar → ir a verify (con spinner de carga leve)
    continueBtn.addEventListener("click", () => {
        setButtonLoading(continueBtn, true, "Procesando...");
        setTimeout(() => {
            setButtonLoading(continueBtn, false);
            showView("verify");
            setTimeout(() => pinInputs[0].focus(), 150);
        }, 900);
    });

    // 4. PIN inputs: solo dígitos, auto-avanzar, manejar backspace
    pinInputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            const v = e.target.value.replace(/\D/g, "");
            e.target.value = v;
            if (v) {
                e.target.classList.add("filled");
                if (idx < pinInputs.length - 1) pinInputs[idx + 1].focus();
            } else {
                e.target.classList.remove("filled");
            }
            // Habilitar verify cuando los 6 estén llenos
            const allFilled = Array.from(pinInputs).every((i) => i.value.length === 1);
            verifyBtn.disabled = !allFilled;
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                pinInputs[idx - 1].focus();
            } else if (e.key === "ArrowLeft" && idx > 0) {
                pinInputs[idx - 1].focus();
            } else if (e.key === "ArrowRight" && idx < pinInputs.length - 1) {
                pinInputs[idx + 1].focus();
            }
        });
        input.addEventListener("paste", (e) => {
            const data = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
            if (data) {
                e.preventDefault();
                data.split("").forEach((ch, i) => {
                    if (pinInputs[i]) {
                        pinInputs[i].value = ch;
                        pinInputs[i].classList.add("filled");
                    }
                });
                const allFilled = Array.from(pinInputs).every((i) => i.value.length === 1);
                verifyBtn.disabled = !allFilled;
                (pinInputs[Math.min(data.length, pinInputs.length - 1)]).focus();
            }
        });
    });

    // 5. Verificar → success → volver a Robux (con spinner de carga)
    verifyBtn.addEventListener("click", () => {
        setButtonLoading(verifyBtn, true, "Verificando...");
        setTimeout(() => {
            setButtonLoading(verifyBtn, false);
            // Usar los datos del paquete seleccionado (incluye el bonus)
            const amount = currentPkg.amount || 0;
            const bonus = currentPkg.bonus || 0;
            const total = amount + bonus;
            const succAmount = viewSuccess.querySelector("[data-pago-amount]");
            if (succAmount) succAmount.textContent = formatNum(total);
            // Actualizar el mensaje de éxito con el desglose
            const succMsg = viewSuccess.querySelector("[data-pago-success-msg]");
            if (succMsg) {
                if (bonus > 0) {
                    succMsg.innerHTML = `Tus <strong>${formatNum(amount)} Robux</strong> + <strong>${formatNum(bonus)} de bonificación</strong> = <strong>${formatNum(total)} Robux</strong> han sido añadidos a tu cuenta. Serás redirigido a la sección Robux.`;
                } else {
                    succMsg.innerHTML = `Tus <strong>${formatNum(total)} Robux</strong> han sido añadidos a tu cuenta. Serás redirigido a la sección Robux.`;
                }
            }
            // Sumar al balance y registrar transacción entrante
            // (cantidad base + bonificación)
            addTransaction("in", total, "Compra de Robux");
            showView("success");
            setTimeout(() => {
                const robuxTab = document.querySelector('.tab[data-tab="robux"]');
                if (robuxTab) robuxTab.click();
            }, 2500);
        }, 1100);
    });

    // 6. Back link
    backLink.addEventListener("click", () => {
        showView("main");
    });
})();

// ============== LOGIN MODAL ==============
(function () {
    const overlay = document.getElementById("loginModal");
    const openBtn = document.getElementById("openLoginModal");
    const closeBtn = document.getElementById("closeLoginModal");
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (!overlay || !openBtn) return;

    function open() {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setTimeout(() => {
            const input = overlay.querySelector(".login-input");
            if (input) input.focus();
        }, 200);
    }
    function close() {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    openBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    // Submit demo: show spinner, close, toast
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
            setButtonLoading(submitBtn, true, "Iniciando...");
            setTimeout(() => {
                setButtonLoading(submitBtn, false);
                close();
                showToast("Demo: inicio de sesión simulado");
            }, 900);
        });
    }
})();

// ============== FIREBASE + AUTH + ADMIN ==============
(function () {
    if (!window.firebase || !window.__firebaseConfig) return;

    try {
        firebase.initializeApp(window.__firebaseConfig);
    } catch (e) {
        console.error("Firebase init error:", e);
        return;
    }
    const rtdb = firebase.database();
    const auth = firebase.auth();

    // ============== Password hashing (SHA-256 + salt) ==============
    const SALT = "roblox-clone-salt-2024";
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + SALT);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // ============== Session ==============
    const SESSION_KEY = "roblox_clone_session";

    function getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }
    function setSession(user) {
        const session = {
            username: user.username,
            role: user.role,
            avatar: user.avatar || null,
            expiresAt: user.expiresAt ? (user.expiresAt.toMillis ? user.expiresAt.toMillis() : new Date(user.expiresAt).getTime()) : null,
            loggedInAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }
    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }
    function isSessionValid(session) {
        if (!session) return false;
        if (!session.expiresAt) return false;
        return session.expiresAt > Date.now();
    }

    // ============== User CRUD (Firebase Realtime Database) ==============
    // Estructura RTDB:
    //   users/
    //     {username}/
    //       username: string
    //       passwordHash: string
    //       role: "admin" | "user"
    //       createdAt: number (Unix ms)
    //       expiresAt: number (Unix ms)

    function tsToMs(ts) {
        if (ts == null) return null;
        if (typeof ts === "number") return ts;
        return ts;
    }

    // RTDB no permite los caracteres  . # $ [ ]  en las keys de los paths.
    // Sanitizamos el username para usarlo como key, pero conservamos el
    // username ORIGINAL en el documento (es lo que ve el admin y lo que
    // usa el login para resolver el hash de la contraseña).
    function sanitizeKey(name) {
        return String(name || "").replace(/[.#$\[\]@/]/g, "_");
    }

    async function findUser(username) {
        try {
            const key = sanitizeKey(username);
            const snap = await rtdb.ref("users/" + key).once("value");
            return snap.exists() ? { id: snap.key, ...snap.val() } : null;
        } catch (e) {
            console.error("findUser error:", e);
            return null;
        }
    }
    async function createUser({ username, password, role, daysValid, avatar }) {
        const passwordHash = await hashPassword(password);
        const now = Date.now();
        const expiresAt = now + daysValid * 24 * 60 * 60 * 1000;
        const user = {
            username,
            passwordHash,
            role: role || "user",
            avatar: avatar || "1.webp",
            createdAt: now,
            expiresAt: expiresAt,
        };
        await rtdb.ref("users/" + sanitizeKey(username)).set(user);
        return user;
    }
    async function listUsers() {
        try {
            const snap = await rtdb.ref("users").orderByChild("createdAt").once("value");
            const list = [];
            snap.forEach((child) => {
                list.push({ id: child.key, ...child.val() });
            });
            // Ordenar de más nuevo a más viejo
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return list;
        } catch (e) {
            console.error("listUsers error:", e);
            return [];
        }
    }
    async function deleteUser(username) {
        const key = sanitizeKey(username);
        await rtdb.ref("users/" + key).remove();
    }

    // ============== Auth UI updates ==============
    function updateAuthUI() {
        const session = getSession();
        const valid = isSessionValid(session);
        const loginTrigger = document.getElementById("openLoginModal");
        const profileChip = document.querySelector(".profile-chip");
        const adminTab = document.querySelector(".tab-admin");

        if (valid && session) {
            // Logged in
            if (loginTrigger) loginTrigger.hidden = true;
            if (profileChip) {
                profileChip.hidden = false;
                const nameEl = document.getElementById("profileName");
                if (nameEl) nameEl.textContent = session.username;
                const iconEl = document.getElementById("profileAvatarIcon");
                if (iconEl) {
                    // Si no hay avatar en la sesión, intentar leerlo de RTDB
                    if (session.avatar) {
                        iconEl.src = "recursos/iconos/" + session.avatar;
                        iconEl.style.display = "";
                    } else {
                        // Fallback: letra inicial mientras carga el avatar
                        iconEl.style.display = "none";
                        // Buscar el avatar en RTDB
                        findUser(session.username).then((u) => {
                            if (u && u.avatar) {
                                session.avatar = u.avatar;
                                setSession(session);
                                if (iconEl) {
                                    iconEl.src = "recursos/iconos/" + u.avatar;
                                    iconEl.style.display = "";
                                }
                            }
                        }).catch(() => {});
                    }
                }
            }
            if (adminTab && session.role === "admin") {
                adminTab.hidden = false;
                adminTab.classList.add("visible");
            } else if (adminTab) {
                adminTab.hidden = true;
                adminTab.classList.remove("visible");
            }
        } else {
            // Not logged in / expired
            clearSession();
            if (loginTrigger) loginTrigger.hidden = false;
            if (profileChip) {
                profileChip.hidden = true;
            }
            if (adminTab) {
                adminTab.hidden = true;
                adminTab.classList.remove("visible");
            }
        }
    }

    // ============== Sign in (override the demo submit) ==============
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (submitBtn) {
        // Replace the existing click handler from the login modal IIFE
        // by adding a new one (we'll detect and override below)
        const newSubmit = async () => {
            const inputs = document.querySelectorAll("#loginModal .login-input");
            const identifier = (inputs[0]?.value || "").trim();
            const password = inputs[1]?.value || "";
            if (!identifier || !password) {
                showToast("Ingresa usuario/correo y contraseña");
                return;
            }
            setButtonLoading(submitBtn, true, "Iniciando...");
            const closeAndWelcome = (user) => {
                const overlay = document.getElementById("loginModal");
                if (overlay) {
                    // Mover el foco fuera del modal ANTES de ocultarlo
                    // para evitar el warning de aria-hidden + focus retenido
                    if (document.activeElement && overlay.contains(document.activeElement)) {
                        document.activeElement.blur();
                    }
                    overlay.classList.remove("open");
                    overlay.setAttribute("aria-hidden", "true");
                    document.body.style.overflow = "";
                    inputs.forEach((i) => (i.value = ""));
                }
                const name = user.displayName || user.username || "admin";
                showToast(`Bienvenido, ${name}`);
            };

            // Helper: procesar un usuario de RTDB
            const handleRtdbUser = (rtdbUser) => {
                const expiresMs = Number(rtdbUser.expiresAt) || 0;
                if (expiresMs < Date.now()) {
                    setButtonLoading(submitBtn, false);
                    showToast("Esta cuenta ha expirado");
                    return false;
                }
                setSession({
                    username: rtdbUser.username,
                    role: rtdbUser.role || "user",
                    expiresAt: expiresMs,
                });
                setButtonLoading(submitBtn, false);
                updateAuthUI();
                closeAndWelcome({ username: rtdbUser.username });
                return true;
            };

            // Helper: procesar un usuario de Auth
            const handleAuthUser = async (authUser) => {
                let role = "admin";
                let expiresMs = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 año
                // Buscar metadata extra en RTDB (por si el admin limitó su propia cuenta)
                try {
                    const safeKey = sanitizeKey(authUser.email);
                    const rtdbSnap = await rtdb.ref("users/" + safeKey).once("value");
                    if (rtdbSnap.exists()) {
                        const data = rtdbSnap.val();
                        if (data.role) role = data.role;
                        if (data.expiresAt) {
                            const exp = Number(data.expiresAt) || 0;
                            if (exp < Date.now()) {
                                await auth.signOut();
                                setButtonLoading(submitBtn, false);
                                showToast("Esta cuenta ha expirado");
                                return false;
                            }
                            expiresMs = exp;
                        }
                    }
                } catch (_) { /* no metadata, default admin */ }
                setSession({
                    username: authUser.email,
                    role: role,
                    expiresAt: expiresMs,
                });
                setButtonLoading(submitBtn, false);
                updateAuthUI();
                closeAndWelcome({ username: authUser.email, displayName: "admin" });
                return true;
            };

            try {
                const looksLikeEmail = identifier.includes("@");

                if (looksLikeEmail) {
                    // === EMAIL → Firebase Authentication (admin) ===
                    console.log("[auth] Trying Firebase Auth with email:", identifier);
                    try {
                        const cred = await auth.signInWithEmailAndPassword(identifier, password);
                        console.log("[auth] Auth success:", cred.user.email);
                        await handleAuthUser(cred.user);
                        return;
                    } catch (authErr) {
                        console.warn("[auth] Auth signin failed:", authErr.code, authErr.message);
                        // Si fue INVALID_LOGIN_CREDENTIALS, igual intentamos RTDB
                        // (porque el usuario pudo haber sido creado en RTDB con ese
                        // email-style como username)
                    }
                }

                // === USUARIO (sin @) o fallback → RTDB ===
                console.log("[auth] Trying RTDB with identifier:", identifier);
                const rtdbUser = await findUser(identifier);
                if (rtdbUser && rtdbUser.passwordHash) {
                    const hash = await hashPassword(password);
                    if (hash === rtdbUser.passwordHash) {
                        const ok = handleRtdbUser(rtdbUser);
                        if (ok) return;
                        return;
                    } else {
                        setButtonLoading(submitBtn, false);
                        showToast("Contraseña incorrecta");
                        return;
                    }
                }

                // Si llegamos aquí, no se encontró en ningún lado
                setButtonLoading(submitBtn, false);
                if (looksLikeEmail) {
                    showToast("No existe una cuenta con ese correo");
                } else {
                    showToast("Usuario no encontrado");
                }
            } catch (e) {
                console.error("[auth] Login error:", e);
                setButtonLoading(submitBtn, false);
                showToast("Error al iniciar sesión: " + (e.message || e));
            }
        };
        // Clone to remove any previous listener (the demo one from LOGIN MODAL IIFE)
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener("click", newSubmit);

        // También capturar Enter en los inputs del modal
        const loginInputs = document.querySelectorAll("#loginModal .login-input");
        loginInputs.forEach((inp) => {
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    newBtn.click();
                }
            });
        });
    }

    // ============== Sign out ==============
    function signOut() {
        clearSession();
        updateAuthUI();
        // Navigate to Destacadas
        const tab = document.querySelector('.tab[data-tab="destacadas"]');
        if (tab) tab.click();
        // Show login modal automatically
        const loginOverlay = document.getElementById("loginModal");
        if (loginOverlay && !loginOverlay.classList.contains("open")) {
            loginOverlay.classList.add("open");
            loginOverlay.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
        showToast("Sesión cerrada");
    }
    const signOutBtn = document.getElementById("adminSignOut");
    if (signOutBtn) signOutBtn.addEventListener("click", signOut);

    // Listen for signout requests from other parts of the app (e.g. settings dropdown)
    window.addEventListener("roblox:requestSignOut", signOut);

    // El profile-chip es solo visual — al hacer click no debe pasar nada.
    // El usuario cierra sesión desde el botón "Cerrar sesión" del panel admin
    // o desde el menú de ajustes (settings dropdown).
    const profileChip = document.querySelector(".profile-chip");
    if (profileChip) {
        profileChip.style.cursor = "default";
    }

    // ============== Admin: create user ==============
    const createForm = document.getElementById("adminCreateForm");
    let selectedIcon = "1.webp";
    if (createForm) {
        // Wire icon picker
        const iconPicker = document.getElementById("iconPicker");
        if (iconPicker) {
            iconPicker.querySelectorAll(".icon-option").forEach((opt) => {
                opt.addEventListener("click", () => {
                    iconPicker.querySelectorAll(".icon-option").forEach((o) => o.classList.remove("selected"));
                    opt.classList.add("selected");
                    selectedIcon = opt.dataset.icon;
                });
            });
        }

        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("adminNewUsername").value.trim();
            const password = document.getElementById("adminNewPassword").value;
            // Forzar rol de usuario (los admins solo se crean desde Firebase Auth)
            const role = "user";
            const days = parseInt(document.getElementById("adminNewDuration").value, 10) || 30;
            const msg = document.getElementById("adminCreateMsg");
            const btn = document.getElementById("adminCreateBtn");

            if (!username || !password) {
                showMsg(msg, "Ingresa usuario y contraseña", "error");
                return;
            }
            if (username.length < 3) {
                showMsg(msg, "El usuario debe tener al menos 3 caracteres", "error");
                return;
            }
            // Solo letras, números, guion bajo, guion y punto.
            // (El . se sanitiza a _ automáticamente al guardar en RTDB)
            if (!/^[A-Za-z0-9_.\-]{3,32}$/.test(username)) {
                showMsg(msg, "Usuario inválido. Solo letras, números, guion bajo, guion y punto (3-32 caracteres).", "error");
                return;
            }
            if (password.length < 4) {
                showMsg(msg, "La contraseña debe tener al menos 4 caracteres", "error");
                return;
            }
            if (days < 1 || days > 365) {
                showMsg(msg, "La duración debe estar entre 1 y 365 días", "error");
                return;
            }

            setButtonLoading(btn, true, "Creando...");
            try {
                // Timeout de 8s para detectar problemas de RTDB
                const existing = await Promise.race([
                    findUser(username),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-conexion")), 8000)),
                ]);
                if (existing) {
                    setButtonLoading(btn, false);
                    showMsg(msg, `El usuario "${username}" ya existe`, "error");
                    return;
                }
                await Promise.race([
                    createUser({ username, password, role, daysValid: days, avatar: selectedIcon }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-conexion")), 8000)),
                ]);
                setButtonLoading(btn, false);
                showMsg(msg, `✓ Cuenta "${username}" creada. Válida por ${days} días. Credenciales: ${username} / ${password}`, "success");
                createForm.reset();
                document.getElementById("adminNewDuration").value = 30;
                // Reset icon picker al primero
                const iconPickerEl = document.getElementById("iconPicker");
                if (iconPickerEl) {
                    iconPickerEl.querySelectorAll(".icon-option").forEach((o, i) => {
                        o.classList.toggle("selected", i === 0);
                    });
                    selectedIcon = "1.webp";
                }
                await renderAdminUsers();
            } catch (e) {
                console.error(e);
                setButtonLoading(btn, false);
                if (e.message === "timeout-conexion") {
                    showMsg(msg, "No se puede conectar a la base de datos. Crea la Realtime Database en Firebase Console primero.", "error");
                } else {
                    showMsg(msg, "Error al crear la cuenta: " + (e.message || e), "error");
                }
            }
        });
    }

    function showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = "admin-form-msg " + type;
        el.hidden = false;
    }

    // ============== Admin: list users ==============
    async function renderAdminUsers() {
        const list = document.getElementById("adminUsersList");
        if (!list) return;
        list.innerHTML = '<p class="admin-empty">Cargando usuarios…</p>';
        let users;
        try {
            // Intentar leer la lista directamente con timeout
            // (no usamos .info/connected porque puede dar falsos negativos
            // si las reglas no permiten ese path específico)
            users = await Promise.race([
                listUsers(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-leyendo-usuarios")), 8000)),
            ]);
        } catch (e) {
            console.error("RTDB list error:", e);
            const isTimeout = e.message === "timeout-leyendo-usuarios";
            const detail = isTimeout
                ? "La lectura tardó demasiado. Revisa las reglas de Firebase RTDB — deben permitir read en /users."
                : (e.message || String(e));
            list.innerHTML = `
                <div class="admin-error">
                    <strong>⚠️ No se pudo leer la lista de usuarios.</strong>
                    <p>Verifica las reglas de seguridad de Realtime Database en Firebase Console. Deben permitir <code>.read: true</code> en el nodo <code>users</code>:</p>
                    <pre style="background:#fff8e8;padding:8px;border-radius:4px;font-size:11px;margin:6px 0;overflow:auto;">{
  "rules": {
    "users": { ".read": true, ".write": true }
  }
}</pre>
                    <p class="admin-error-detail">Detalle: ${escapeHtml(detail)}</p>
                </div>
            `;
            return;
        }
        if (users.length === 0) {
            list.innerHTML = '<p class="admin-empty">No hay usuarios registrados todavía. Crea uno arriba.</p>';
            return;
        }
        list.innerHTML = "";
        const now = Date.now();
        users.forEach((u) => {
            const expiresMs = u.expiresAt?.toMillis ? u.expiresAt.toMillis() : new Date(u.expiresAt).getTime();
            const isExpired = expiresMs < now;
            const daysLeft = Math.max(0, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000)));
            const createdMs = u.createdAt?.toMillis ? u.createdAt.toMillis() : new Date(u.createdAt).getTime();
            const createdDate = new Date(createdMs);
            const avatarFile = u.avatar || "1.webp";
            const initial = (u.username || "?").charAt(0).toUpperCase();

            const row = document.createElement("div");
            row.className = "admin-user-row";
            row.innerHTML = `
                <div class="admin-user-avatar">
                    <img src="recursos/iconos/${escapeHtml(avatarFile)}" alt="" onerror="this.remove();this.parentNode.innerHTML='<span class=&quot;admin-user-avatar-fallback&quot;>${escapeHtml(initial)}</span>'" />
                </div>
                <div class="admin-user-info">
                    <div class="admin-user-name">@${escapeHtml(u.username)}</div>
                    <div class="admin-user-meta">
                        <span class="admin-role-badge ${u.role === "admin" ? "admin" : "user"}">${escapeHtml(u.role || "user")}</span>
                        <span class="admin-status-badge ${isExpired ? "expired" : "active"}">${isExpired ? "Expirado" : `${daysLeft} día${daysLeft === 1 ? "" : "s"} restantes`}</span>
                        <span>Creado: ${createdDate.toLocaleDateString("es-CO")}</span>
                    </div>
                </div>
                <button class="admin-delete-btn" type="button" data-username="${escapeHtml(u.username)}">Eliminar</button>
            `;
            list.appendChild(row);
        });
        list.querySelectorAll(".admin-delete-btn").forEach((b) => {
            b.addEventListener("click", async () => {
                const username = b.dataset.username;
                if (!confirm(`¿Eliminar la cuenta "${username}"?`)) return;
                try {
                    await deleteUser(username);
                    showToast(`Cuenta "${username}" eliminada`);
                    await renderAdminUsers();
                } catch (e) {
                    console.error(e);
                    showToast("Error al eliminar");
                }
            });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }

    const refreshBtn = document.getElementById("adminRefreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", renderAdminUsers);

    // When the admin tab is activated, refresh the user list
    const adminTab = document.querySelector('.tab[data-tab="admin"]');
    if (adminTab) {
        adminTab.addEventListener("click", () => {
            setTimeout(renderAdminUsers, 50);
        });
    }

    // Initial auth state on page load
    updateAuthUI();
    // If no valid session, automatically show the login modal
    if (!isSessionValid(getSession())) {
        const loginOverlay = document.getElementById("loginModal");
        if (loginOverlay) {
            loginOverlay.classList.add("open");
            loginOverlay.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
    }
})();

// ============== SETTINGS DROPDOWN (navbar gear) ==============
(function () {
    const btn = document.getElementById("settingsMenuBtn");
    const dropdown = document.getElementById("settingsDropdown");
    if (!btn || !dropdown) return;

    function open() {
        dropdown.hidden = false;
        btn.setAttribute("aria-expanded", "true");
    }
    function close() {
        dropdown.hidden = true;
        btn.setAttribute("aria-expanded", "false");
    }
    function isOpen() { return !dropdown.hidden; }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        isOpen() ? close() : open();
    });

    document.addEventListener("click", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target)) return;
        close();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) close();
    });

    dropdown.querySelectorAll(".settings-item").forEach((item) => {
        item.addEventListener("click", () => {
            const action = item.dataset.action;
            close();
            switch (action) {
                case "config":
                    showToast("Configuración (demo)");
                    break;
                case "quick-login":
                    showToast("Inicio de sesión rápido (demo)");
                    break;
                case "help":
                    showToast("Ayuda y seguridad (demo)");
                    break;
                case "switch":
                    // Open login modal so the user can log in with a different account
                    const loginOverlay = document.getElementById("loginModal");
                    if (loginOverlay) {
                        loginOverlay.classList.add("open");
                        loginOverlay.setAttribute("aria-hidden", "false");
                        document.body.style.overflow = "hidden";
                    }
                    break;
                case "signout":
                    // Dispatch a custom event so the Firebase IIFE handles the full signout flow
                    window.dispatchEvent(new CustomEvent("roblox:requestSignOut"));
                    break;
            }
        });
    });
})();

// ============== Tap feedback on cards ==============
document.querySelectorAll(".game-card, .item-card, .crear-tile").forEach((el) => {
    el.addEventListener("pointerdown", () => (el.style.opacity = "0.85"));
    el.addEventListener("pointerup", () => (el.style.opacity = ""));
    el.addEventListener("pointerleave", () => (el.style.opacity = ""));
});
