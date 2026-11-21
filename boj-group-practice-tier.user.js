// ==UserScript==
// @name         BOJ Group Practice Tier Display
// @namespace    http://tampermonkey.net/
// @version      2026.11.21.3
// @description  BOJ 그룹 연습에 solved.ac v4 난이도·레이팅·기여 부족 상태 표시
// @author       planPt
// @match        https://www.acmicpc.net/group/practice/view/*
// @match        https://acmicpc.net/group/practice/view/*
// @homepageURL  https://github.com/planPt/boj-group-practice-tier
// @supportURL   https://github.com/planPt/boj-group-practice-tier/issues
// @updateURL    https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.meta.js
// @downloadURL  https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      solved.ac
// ==/UserScript==

(function () {
    "use strict";

    const API_ORIGIN = "https://solved.ac";
    const CACHE_LIFETIME_MS = 5 * 60 * 1000;
    const REQUEST_INTERVAL_MS = 1600; // Search costs 3 units; refill is 2 units/sec.
    const CREDENTIALS_KEY = "solved-ac-v4-app-credentials";
    const LINK_SELECTOR = ".sidebar-nav-v1 a[href], #contest_scoreboard thead a[href]";
    const REASON_LABELS = {
        unsettled: "기여 부족: 난이도 보증 조건 미충족",
        unofficial: "비공식·번외 문제",
        legacy: "기존 레이팅 제외 지정",
        staff: "운영진의 레이팅 제외 지정",
        judgeOff: "온라인 저지 레이팅 비활성",
    };
    const WARNING_LABELS = {
        same: "같은 문제 존재",
        searchable: "검색으로 쉽게 해결 가능",
        "wrong-inputs": "입력 데이터 문제",
        "insufficient-conditions": "조건 부족",
        "no-special-judge": "스페셜 저지 부재",
        "wrong-conditions": "조건 오류",
        "wrong-statement": "지문 오류",
    };

    function getBojProblemId(href, baseUrl) {
        try {
            const url = new URL(href, baseUrl);
            if (url.protocol !== "https:" || !["acmicpc.net", "www.acmicpc.net"].includes(url.hostname)) return null;
            const match = url.pathname.match(/^\/problem\/([1-9]\d*)\/?$/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    function getTierName(level) {
        if (!Number.isInteger(level) || level < 1 || level > 30) return "난이도 미정 / Unrated";
        const names = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby"];
        const ranks = ["V", "IV", "III", "II", "I"];
        return `${names[Math.floor((level - 1) / 5)]} ${ranks[(level - 1) % 5]}`;
    }

    function getRatingState(problem) {
        if (problem.givesNoRating) {
            if (problem.noRatingReasons.includes("unsettled")) {
                if (problem.noRatingReasons.some((reason) => reason !== "unsettled")) {
                    return { key: "excluded", label: "제외·보류", detail: "기여 부족 및 별도 사유로 레이팅 제외" };
                }
                return { key: "pending", label: "보류", detail: "기여 부족으로 레이팅 보류" };
            }
            return { key: "excluded", label: "제외", detail: "레이팅 제외" };
        }
        // Level 0 with givesNoRating=false exists in the live v4 API.
        // It is not a rated problem merely because exclusion is false.
        if (problem.level <= 0) return { key: "unassigned", label: "미정", detail: "아직 난이도 없음" };
        return { key: "rated", label: "레이팅", detail: "레이팅 반영 대상" };
    }

    function getTierIconUrl(problem) {
        // Matches solved.ac's v4 icon selector, including its standard-problem priority.
        const prefix = problem.isStandard ? "p" : problem.givesNoRating ? "u" : "p";
        const level = Math.max(0, problem.level);
        const slug = problem.givesNoRating && level === 0 ? `${prefix}nr`
            : problem.effectiveVoteCount === 0 || level === 0 ? "u00"
            : `${prefix}${String(level).padStart(2, "0")}`;
        return `https://cdn.solved.ac/assets/tier/${slug}.svg`;
    }

    function validateProblem(problem) {
        const validCount = (value) => Number.isInteger(value) && value >= 0;
        return problem && Number.isInteger(problem.problemId) && problem.problemId > 0
            && typeof problem.subId === "string"
            && Number.isInteger(problem.level) && problem.level >= -1 && problem.level <= 30
            && typeof problem.givesNoRating === "boolean" && typeof problem.isStandard === "boolean"
            && Array.isArray(problem.noRatingReasons) && problem.noRatingReasons.every((reason) => typeof reason === "string")
            && Array.isArray(problem.noRatingWarnings) && problem.noRatingWarnings.every((warning) => warning
                && typeof warning.type === "string" && (warning.problem === null || (warning.problem
                    && Number.isInteger(warning.problem.problemId) && warning.problem.problemId > 0 && typeof warning.problem.subId === "string")))
            && validCount(problem.effectiveVoteCount) && validCount(problem.votedUserCount) && validCount(problem.solvedUserCount)
            && Array.isArray(problem.judgeIds) && problem.judgeIds.every((judge) => judge && typeof judge.ojId === "string"
                && typeof judge.problemId === "string" && typeof judge.subId === "string");
    }

    function buildSearchQuery(ids) {
        if (!ids.length || ids.some((id) => !/^[1-9]\d*$/.test(id))) throw new Error("잘못된 BOJ 문제 번호");
        const query = ids.map((id) => `id:b${id}`).join(" | ");
        if (ids.length > 5 || query.length > 100) throw new Error("API 검색 한도 초과");
        return query;
    }

    function mapProblemsToBojIds(problems, requestedIds) {
        const mapped = new Map(requestedIds.map((id) => [id, []]));
        for (const problem of problems) {
            if (!validateProblem(problem)) throw new Error("API 문제 응답 형식 변경");
            for (const judge of problem.judgeIds) {
                if (judge.ojId !== "boj" || !mapped.has(judge.problemId)) continue;
                const matches = mapped.get(judge.problemId);
                if (!matches.some((item) => item.problemId === problem.problemId && item.subId === problem.subId)) matches.push(problem);
            }
        }
        return mapped;
    }

    function getRetryDelay(responseHeaders, now = Date.now()) {
        const value = responseHeaders?.match(/^retry-after:\s*(.+)$/im)?.[1].trim();
        if (!value) return 5000;
        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
        const date = Date.parse(value);
        return Number.isFinite(date) ? Math.max(1000, date - now) : 5000;
    }

    function describeProblem(problem, bojId) {
        const state = getRatingState(problem);
        const lines = [
            `BOJ ${bojId} · solved.ac ${problem.problemId}${problem.subId}`,
            `${getTierName(problem.level)} · ${state.detail}`,
            `푼 사람: ${problem.solvedUserCount.toLocaleString()}명`,
            `전체 기여: ${problem.votedUserCount.toLocaleString()} · 유효 기여: ${problem.effectiveVoteCount.toLocaleString()}`,
        ];
        if (problem.isStandard) lines.push("운영진이 난이도를 고정한 표준 문제");
        for (const reason of problem.noRatingReasons) lines.push(REASON_LABELS[reason] || `기타 제외 사유: ${reason}`);
        for (const warning of problem.noRatingWarnings || []) {
            const related = warning.problem ? ` (solved.ac ${warning.problem.problemId}${warning.problem.subId || ""})` : "";
            lines.push(`참고: ${WARNING_LABELS[warning.type] || warning.type}${related}`);
        }
        lines.push("레이팅 여부는 solved.ac의 판정값을 사용합니다.");
        return lines.join("\n");
    }

    // Pure functions can also be exercised by Node's built-in test runner.
    if (typeof module !== "undefined" && module.exports && typeof document === "undefined") {
        module.exports = { getBojProblemId, getTierName, getRatingState, getTierIconUrl, validateProblem, buildSearchQuery, mapProblemsToBojIds, getRetryDelay, describeProblem };
        return;
    }

    let credentials = GM_getValue(CREDENTIALS_KEY, null);
    const cache = new Map();
    const pendingIds = new Set();
    const inFlightIds = new Set();
    const linkViews = new WeakMap();
    let queueRunning = false;
    let scanTimer;
    let credentialsGeneration = 0;
    let nextRequestAt = 0;
    let authenticationFailed = false;

    function hasCredentials() {
        return credentials && typeof credentials.clientId === "string" && credentials.clientId.trim()
            && typeof credentials.clientSecret === "string" && credentials.clientSecret.trim();
    }

    function resetResults() {
        credentialsGeneration++;
        cache.clear();
        pendingIds.clear();
        authenticationFailed = false;
        scheduleScan();
    }

    function configureCredentials() {
        const clientId = window.prompt("solved.ac Backstage에서 발급받은 Client ID를 입력하세요.", credentials?.clientId || "");
        if (clientId === null || !clientId.trim()) return;
        const clientSecret = window.prompt("Client Secret을 입력하세요. 스크립트 전용 저장소에 보관하며 solved.ac에만 전송합니다. 키를 채팅에 보내지 마세요.");
        if (clientSecret === null || !clientSecret.trim()) return;
        if (/[\r\n]/.test(clientId + clientSecret)) { window.alert("키에 줄바꿈을 넣을 수 없습니다."); return; }
        credentials = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
        GM_setValue(CREDENTIALS_KEY, credentials);
        resetResults();
    }

    GM_registerMenuCommand("solved.ac API 키 설정", configureCredentials);
    GM_registerMenuCommand("문제 정보 새로고침 / 오류 재시도", resetResults);
    GM_registerMenuCommand("저장한 solved.ac API 키 지우기", () => {
        GM_deleteValue(CREDENTIALS_KEY);
        credentials = null;
        resetResults();
    });

    const style = document.createElement("style");
    style.textContent = `
        .boj-v4-info { display:inline-flex; align-items:center; gap:4px; margin-right:5px; vertical-align:middle; }
        .boj-v4-icon { width:16px; height:20px; object-fit:contain; vertical-align:middle; }
        .boj-v4-state { font:600 10px/1.5 system-ui,sans-serif; padding:0 4px; border:1px solid currentColor; border-radius:3px; white-space:nowrap; }
        .boj-v4-state[data-state="rated"] { color:#277945; background:#effaf2; }
        .boj-v4-state[data-state="pending"] { color:#875000; background:#fff5d9; border-style:dashed; }
        .boj-v4-state[data-state="excluded"] { color:#79538c; background:#f8f0ff; border-style:dashed; }
        .boj-v4-state[data-state="unassigned"] { color:#606970; background:#f3f5f6; }
        .boj-v4-state[data-state="error"] { color:#a02828; background:#fff0f0; }
        .boj-v4-table { display:flex; flex-direction:column; align-items:center; margin:0 0 3px; gap:2px; }
        #boj-v4-notice { font:13px/1.6 system-ui,sans-serif; padding:10px 12px; margin:10px 0; border:1px solid #d4dbe1; border-radius:5px; color:#34404c; background:#f5f8fa; }
        #boj-v4-notice button { margin-left:10px; padding:2px 7px; cursor:pointer; }
        #boj-v4-tooltip { position:fixed; z-index:100000; max-width:min(420px,calc(100vw - 20px)); padding:10px 12px; white-space:pre-line; color:#fff; background:#222b35; border-radius:5px; font:12px/1.7 system-ui,sans-serif; box-shadow:0 3px 14px #0003; pointer-events:none; }
        #boj-v4-tooltip[hidden] { display:none; }
    `;
    document.head.appendChild(style);

    const tooltip = document.createElement("div");
    tooltip.id = "boj-v4-tooltip";
    tooltip.role = "tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);

    function showTooltip(view) {
        tooltip.textContent = view.dataset.description || "";
        tooltip.hidden = false;
        const rect = view.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(10, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - 10))}px`;
        const top = rect.top - box.height - 8;
        tooltip.style.top = `${Math.max(8, Math.min(top >= 8 ? top : rect.bottom + 8, window.innerHeight - box.height - 8))}px`;
    }

    const hideTooltip = () => { tooltip.hidden = true; };
    document.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideTooltip(); });

    function createStateLabel(label, state) {
        const badge = document.createElement("span");
        badge.className = "boj-v4-state";
        badge.dataset.state = state;
        badge.textContent = label;
        return badge;
    }

    function renderLink(link, bojId, result) {
        const signature = JSON.stringify([bojId, result]);
        let view = linkViews.get(link);
        if (view && view.isConnected && view.dataset.signature === signature) return;
        if (!view || !view.isConnected) {
            view = document.createElement("span");
            view.className = "boj-v4-info" + (link.closest("thead") ? " boj-v4-table" : "");
            view.tabIndex = 0;
            view.setAttribute("aria-describedby", tooltip.id);
            view.addEventListener("mouseenter", () => showTooltip(view));
            view.addEventListener("mouseleave", hideTooltip);
            view.addEventListener("focus", () => showTooltip(view));
            view.addEventListener("blur", hideTooltip);
            link.prepend(view);
            linkViews.set(link, view);
        }
        view.replaceChildren();
        view.dataset.signature = signature;
        if (result.kind !== "success") {
            view.appendChild(createStateLabel(result.label, result.kind === "loading" ? "unassigned" : "error"));
            view.dataset.description = result.message;
        } else {
            const descriptions = [];
            for (const problem of result.problems) {
                const image = document.createElement("img");
                image.className = "boj-v4-icon";
                image.alt = getTierName(problem.level);
                image.src = getTierIconUrl(problem);
                image.referrerPolicy = "no-referrer";
                image.addEventListener("error", () => {
                    const fallback = document.createElement("span");
                    fallback.textContent = getTierName(problem.level);
                    image.replaceWith(fallback);
                }, { once: true });
                const state = getRatingState(problem);
                view.append(image, createStateLabel(`${problem.subId ? problem.subId + ": " : ""}${state.label}`, state.key));
                descriptions.push(describeProblem(problem, bojId));
            }
            view.dataset.description = descriptions.join("\n\n");
        }
        view.setAttribute("aria-label", view.dataset.description);
    }

    function updateNotice() {
        const parent = document.querySelector("#contest_scoreboard")?.parentElement || document.querySelector(".sidebar-nav-v1")?.parentElement;
        if (!parent) return;
        let notice = document.getElementById("boj-v4-notice");
        const message = !hasCredentials() ? "티어 표시: solved.ac v4 API 키를 한 번 설정해 주세요."
            : authenticationFailed ? "solved.ac API 인증 또는 접근이 거부되었습니다. 키·앱 상태를 확인한 뒤 재시도해 주세요."
            : Array.from(cache.values()).some((entry) => entry.result.kind === "error") ? "일부 문제를 조회하지 못했습니다. 조회 오류는 레이팅 보류와 별도로 표시됩니다."
            : "";
        if (!message) { notice?.remove(); return; }
        if (notice?.dataset.message === message) return;
        if (!notice) { notice = document.createElement("div"); notice.id = "boj-v4-notice"; parent.prepend(notice); }
        notice.dataset.message = message;
        notice.textContent = message;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = !hasCredentials() || authenticationFailed ? "API 키 설정" : "재시도";
        button.addEventListener("click", !hasCredentials() || authenticationFailed ? configureCredentials : resetResults);
        notice.appendChild(button);
    }

    function requestSearchPage(query, page, appCredentials) {
        return new Promise((resolve, reject) => {
            let request;
            let settled = false;
            // anonymous/redirect activate fetch mode, where GM's timeout is ignored in Chrome.
            const timeout = setTimeout(() => {
                fail(new Error("solved.ac 요청 시간 초과"));
                request?.abort();
            }, 20000);
            const succeed = (data) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(data); } };
            const fail = (error) => { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } };
            const url = new URL("/api/v4/problems", API_ORIGIN);
            url.search = new URLSearchParams({ q: query, page: String(page), sort: "id", direction: "asc" }).toString();
            try { request = GM_xmlhttpRequest({
                method: "GET", url: url.href, timeout: 20000, anonymous: true,
                redirect: "error", // Never forward app credentials across redirects.
                headers: { Accept: "application/json", "x-client-id": appCredentials.clientId, "x-client-secret": appCredentials.clientSecret },
                onload(response) {
                    if (response.status === 429) {
                        const error = new Error("요청 한도 초과: 잠시 후 재시도해 주세요.");
                        error.retryAfter = getRetryDelay(response.responseHeaders);
                        fail(error); return;
                    }
                    if (response.status === 401 || response.status === 403) {
                        const error = new Error("API 키·앱 권한 또는 solved.ac 접근 상태를 확인해 주세요.");
                        error.authentication = true;
                        fail(error); return;
                    }
                    if (response.status < 200 || response.status >= 300) { fail(new Error(`solved.ac HTTP ${response.status}`)); return; }
                    try {
                        if (response.finalUrl && new URL(response.finalUrl).origin !== API_ORIGIN) throw new Error("예상하지 못한 응답 주소");
                        const data = JSON.parse(response.responseText);
                        if (!Array.isArray(data.problems) || !Number.isInteger(data.total) || data.total < 0
                            || data.page !== page || !Number.isInteger(data.pageSize) || data.pageSize <= 0) throw new Error("API 응답 형식 변경");
                        if (data.diagnostics?.some((item) => item.severity === "error" || item.severity === "warning")) throw new Error("문제 번호 검색을 처리하지 못했습니다.");
                        succeed(data);
                    } catch (error) { fail(new Error(error instanceof SyntaxError ? "JSON 응답이 아닙니다. solved.ac 접근 상태를 확인해 주세요." : error.message)); }
                },
                onerror() { fail(new Error("solved.ac 네트워크 연결 실패")); },
                ontimeout() { fail(new Error("solved.ac 요청 시간 초과")); },
                onabort() { fail(new Error("solved.ac 요청 중단")); },
            }); } catch { fail(new Error("Tampermonkey 요청을 시작하지 못했습니다.")); }
        });
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function lookupBatch(ids, generation, appCredentials) {
        const query = buildSearchQuery(ids);
        const problems = [];
        for (let page = 1; page <= 20; page++) {
            await wait(Math.max(0, nextRequestAt - Date.now()));
            if (generation !== credentialsGeneration) return null;
            nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
            const data = await requestSearchPage(query, page, appCredentials);
            problems.push(...data.problems);
            if (page * data.pageSize >= data.total) return mapProblemsToBojIds(problems, ids);
            if (!data.problems.length) throw new Error("불완전한 페이지 응답");
        }
        throw new Error("문제 검색 결과가 예상보다 많습니다.");
    }

    async function drainQueue() {
        if (queueRunning || !hasCredentials() || authenticationFailed) return;
        queueRunning = true;
        try {
            while (pendingIds.size && hasCredentials() && !authenticationFailed) {
                const generation = credentialsGeneration;
                const appCredentials = { ...credentials };
                const ids = [];
                for (const id of pendingIds) {
                    if (ids.length === 5 || (ids.length && ids.map((value) => `id:b${value}`).join(" | ").length + id.length + 7 > 100)) break;
                    ids.push(id);
                }
                ids.forEach((id) => { pendingIds.delete(id); inFlightIds.add(id); });
                try {
                    const results = await lookupBatch(ids, generation, appCredentials);
                    if (generation !== credentialsGeneration || !results) continue;
                    for (const [id, matches] of results) {
                        cache.set(id, { expires: Date.now() + CACHE_LIFETIME_MS, result: matches.length
                            ? { kind: "success", problems: matches }
                            : { kind: "error", label: "정보 없음", message: `BOJ ${id}에 대응하는 solved.ac 문제를 찾지 못했습니다. 레이팅 보류 판정이 아닙니다.` } });
                    }
                } catch (error) {
                    if (generation !== credentialsGeneration) continue;
                    if (error.authentication) { authenticationFailed = true; pendingIds.clear(); }
                    if (error.retryAfter) nextRequestAt = Math.max(nextRequestAt, Date.now() + error.retryAfter);
                    for (const id of ids) cache.set(id, { expires: Date.now() + Math.max(CACHE_LIFETIME_MS, error.retryAfter || 0),
                        result: { kind: "error", label: error.authentication ? "인증 확인" : "조회 오류", message: error.message } });
                } finally {
                    ids.forEach((id) => inFlightIds.delete(id));
                    scheduleScan();
                }
            }
        } finally { queueRunning = false; }
    }

    function scanProblemLinks() {
        for (const link of document.querySelectorAll(LINK_SELECTOR)) {
            const id = getBojProblemId(link.getAttribute("href"), location.href);
            if (!id) { linkViews.get(link)?.remove(); continue; }
            const entry = cache.get(id);
            if (entry && entry.expires > Date.now()) { renderLink(link, id, entry.result); continue; }
            if (!hasCredentials() || authenticationFailed) {
                renderLink(link, id, { kind: "error", label: "API 설정", message: "Tampermonkey 메뉴의 ‘solved.ac API 키 설정’을 사용해 주세요." });
                continue;
            }
            renderLink(link, id, { kind: "loading", label: "조회 중", message: `BOJ ${id} 정보를 조회하고 있습니다.` });
            if (!inFlightIds.has(id)) pendingIds.add(id);
        }
        updateNotice();
        void drainQueue();
    }

    function scheduleScan() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scanProblemLinks, 100);
    }

    const observer = new MutationObserver((mutations) => {
        const affectsProblems = mutations.some((mutation) => {
            const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
            return !element?.closest(".boj-v4-info, #boj-v4-tooltip, #boj-v4-notice");
        });
        if (affectsProblems) scheduleScan();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleScan(); });
    setInterval(() => { if (!document.hidden) scheduleScan(); }, 60000);
    scanProblemLinks();
})();
