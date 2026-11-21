const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const api = require('../boj-group-practice-tier.user.js');
const source = fs.readFileSync(`${__dirname}/../boj-group-practice-tier.user.js`, 'utf8');
const live = require('./problems.json');
const base = live[0];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil(predicate) {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(5); }
    assert.fail('Expected state did not appear');
}

function harness({ ids = ['11641'], credentials = true, respond, timeoutScale = false, storage = new Map(), now, storageThrows = false, onWait } = {}) {
    const links = ids.map(id => `<li><a href="/problem/${id}">${id}</a></li>`).join('');
    const columns = ids.map(id => `<th class="problem_score"><a href="https://www.acmicpc.net/problem/${id}">${id}</a></th>`).join('');
    const dom = new JSDOM(`<html><head></head><body><ul class="sidebar-nav-v1">${links}</ul><div><table id="contest_scoreboard"><thead><tr>${columns}</tr></thead></table></div></body></html>`, {
        url: 'https://acmicpc.net/group/practice/view/1/1', runScripts: 'outside-only',
    });
    const w = dom.window;
    const commands = new Map();
    const stored = storage;
    if (credentials) stored.set('solved-ac-v4-app-credentials', { clientId: 'test-client', clientSecret: 'test-secret' });
    w.GM_getValue = (key, fallback) => structuredClone(stored.get(key) ?? fallback);
    w.GM_setValue = (key, value) => { if (storageThrows) throw new Error('quota'); stored.set(key, structuredClone(value)); };
    w.GM_deleteValue = key => stored.delete(key);
    w.GM_registerMenuCommand = (label, handler) => commands.set(label, handler);
    if (now) w.Date.now = now;
    const nativeSetTimeout = w.setTimeout.bind(w);
    w.setTimeout = (callback, ms) => { if (onWait?.(ms)) return 0; return nativeSetTimeout(callback, ms === 20000 ? (timeoutScale ? 50 : 20000) : Math.min(ms, 10)); };
    w.setInterval = () => 1;
    const requests = [];
    let aborts = 0;
    w.GM_xmlhttpRequest = options => {
        requests.push(options);
        if (respond) respond(options, requests.length);
        else nativeSetTimeout(() => {
            const url = new URL(options.url);
            const requested = [...url.searchParams.get('q').matchAll(/id:b(\d+)/g)].map(m => m[1]);
            const problems = live.filter(problem => requested.includes(String(problem.problemId)));
            options.onload({ status: 200, finalUrl: options.url, responseText: JSON.stringify({ problems, total: problems.length, page: Number(url.searchParams.get('page')), pageSize: 50 }) });
        }, 0);
        return { abort() { aborts++; options.onabort(); } };
    };
    w.eval(source);
    return { dom, w, requests, commands, stored, get aborts() { return aborts; }, close: () => dom.window.close() };
}

test('Both BOJ hosts and absolute links resolve; foreign and malformed links do not', () => {
    for (const host of ['acmicpc.net', 'www.acmicpc.net']) assert.equal(api.getBojProblemId('/problem/1000?x=1', `https://${host}/group/practice/view/1/2`), '1000');
    for (const url of ['https://evil.test/problem/1000', 'javascript:alert(1)', '/problem/0', '/problem/1000/submit']) assert.equal(api.getBojProblemId(url, 'https://acmicpc.net'), null);
    assert.match(source, /@match\s+https:\/\/acmicpc.net\/group\/practice\/view\/\*/);
    assert.match(source, /@match\s+https:\/\/www.acmicpc.net\/group\/practice\/view\/\*/);
});

test('Live practice: six rated, one unsettled, three unassigned', () => {
    const counts = live.reduce((counts, p) => { const state = api.getRatingState(p).key; counts[state] = (counts[state] || 0) + 1; return counts; }, {});
    assert.deepEqual(counts, { rated: 6, unassigned: 3, pending: 1 });
    assert.equal(api.getRatingState(live.find(p => p.problemId === 31333)).key, 'pending');
});

test('Low contribution count alone does not imply unsettled, standard or vouched problems can be rated', () => {
    assert.equal(api.getRatingState({ ...base, effectiveVoteCount: 1 }).key, 'rated');
    assert.equal(api.getRatingState({ ...base, effectiveVoteCount: 1, isStandard: true }).key, 'rated');
    assert.equal(api.getRatingState({ ...base, givesNoRating: true, noRatingReasons: ['staff'], effectiveVoteCount: 1 }).key, 'excluded');
    assert.equal(api.getRatingState({ ...base, givesNoRating: true, noRatingReasons: ['future-reason'] }).key, 'excluded');
});

test('Additional exclusion reasons remain visible alongside unsettled', () => {
    const problem = { ...base, givesNoRating: true, noRatingReasons: ['unsettled', 'staff'] };
    assert.equal(api.getRatingState(problem).key, 'excluded');
    assert.equal(api.getRatingState(problem).label, '제외·보류');
    assert.match(api.describeProblem(problem, '11641'), /기여 부족/);
    assert.match(api.describeProblem(problem, '11641'), /운영진/);
});

test('Malformed noRatingWarnings fail validation before they can break rendering', () => {
    for (const noRatingWarnings of [{ type: 'same' }, [null], [{ type: 'same', problem: {} }]]) {
        assert.equal(api.validateProblem({ ...base, noRatingWarnings }), false);
        assert.throws(() => api.mapProblemsToBojIds([{ ...base, noRatingWarnings }], ['11641']));
    }
    assert.equal(api.validateProblem({ ...base, noRatingWarnings: [{ type: 'future', problem: null }] }), true);
});

test('Official current icons distinguish rated, non-rated and no level', () => {
    assert.equal(api.getTierIconUrl(base), 'https://cdn.solved.ac/assets/tier/p13.svg');
    assert.equal(api.getTierIconUrl({ ...base, givesNoRating: true }), 'https://cdn.solved.ac/assets/tier/u13.svg');
    assert.match(api.getTierIconUrl({ ...base, level: 0 }), /\/u00.svg$/);
    assert.match(api.getTierIconUrl({ ...base, level: -1, givesNoRating: true }), /\/unr.svg$/);
    assert.match(api.getTierIconUrl({ ...base, givesNoRating: true, isStandard: true }), /\/p13.svg$/);
});

test('Mapping uses BOJ judgeIds, handles merged IDs and multiple subproblems', () => {
    const merged = { ...base, problemId: 19759, judgeIds: [{ ojId: 'boj', problemId: '28955', subId: '' }] };
    const part = subId => ({ ...base, problemId: 19917, subId, judgeIds: [{ ojId: 'boj', problemId: '19918', subId: '' }] });
    const mapped = api.mapProblemsToBojIds([merged, part('a'), part('b'), part('a')], ['28955', '19759', '19918']);
    assert.equal(mapped.get('28955')[0].problemId, 19759);
    assert.equal(mapped.get('19759').length, 0);
    assert.equal(mapped.get('19918').length, 2);
    assert.throws(() => api.mapProblemsToBojIds([{ problemId: 1000, level: 1 }], ['1000']));
});

test('Search syntax is bounded and untrusted IDs cannot become a query', () => {
    assert.equal(api.buildSearchQuery(['11641', '4547']), 'id:b11641 | id:b4547');
    assert.throws(() => api.buildSearchQuery(['1000 | *30']));
    assert.throws(() => api.buildSearchQuery(Array(6).fill('1000')));
});

test('Retry-After supports seconds and dates without retrying early', () => {
    assert.equal(api.getRetryDelay('Retry-After: 120\r\n'), 120000);
    assert.equal(api.getRetryDelay('retry-after: Thu, 01 Jan 1970 00:01:00 GMT', 0), 60000);
    assert.equal(api.getRetryDelay(''), 5000);
});

test('Stats use solvedUserCount and never invent a success rate from averageTries', () => {
    const text = api.describeProblem({ ...base, averageTries: 2 }, '11641');
    assert.match(text, /푼 사람: 19명/);
    assert.match(text, /전체 기여: 8 · 유효 기여: 6/);
    assert.doesNotMatch(text, /%|평균 시도|정답률/);
});

test('20 links issue two batches; mutation, new links and href changes stay fresh without duplicates', async () => {
    const h = harness({ ids: live.map(p => String(p.problemId)) });
    try {
        await waitUntil(() => h.w.document.querySelectorAll('.boj-v4-state[data-state="rated"]').length === 12);
        assert.equal(h.requests.length, 2);
        assert.equal(h.w.document.querySelectorAll('.boj-v4-state[data-state="pending"]').length, 2);
        assert.equal(h.w.document.querySelectorAll('.boj-v4-state[data-state="unassigned"]').length, 6);
        const link = h.w.document.createElement('a'); link.href = '/problem/31333';
        h.w.document.querySelector('.sidebar-nav-v1').append(link);
        await waitUntil(() => link.querySelector('[data-state="pending"]'));
        assert.equal(h.requests.length, 2);
        link.href = '/problem/11641';
        await waitUntil(() => link.querySelector('[data-state="rated"]'));
        assert.equal(link.querySelectorAll('.boj-v4-info').length, 1);
        link.href = 'https://evil.test/problem/11641';
        await waitUntil(() => !link.querySelector('.boj-v4-info'));
        assert.equal(h.requests.length, 2);
        for (const request of h.requests) {
            assert.equal(new URL(request.url).origin, 'https://solved.ac');
            assert.equal(request.anonymous, true);
            assert.equal(request.redirect, 'error');
            assert.equal(request.headers['x-client-secret'], 'test-secret');
        }
        assert.doesNotMatch(h.w.document.documentElement.outerHTML, /test-secret|test-client/);
    } finally { h.close(); }
});

test('Missing credentials show setup without network requests or fabricated status', async () => {
    const h = harness({ credentials: false });
    try {
        await delay(30);
        assert.equal(h.requests.length, 0);
        assert.match(h.w.document.body.textContent, /API 키/);
        assert.equal(h.w.document.querySelectorAll('[data-state="pending"], [data-state="rated"]').length, 0);
    } finally { h.close(); }
});

test('401 stops remaining batches and shows authentication failure', async () => {
    const h = harness({ ids: live.map(p => String(p.problemId)), respond: options => options.onload({ status: 401 }) });
    try {
        await waitUntil(() => h.w.document.body.textContent.includes('인증 또는 접근'));
        assert.equal(h.requests.length, 1);
        assert.equal(h.w.document.querySelectorAll('[data-state="pending"], [data-state="rated"]').length, 0);
    } finally { h.close(); }
});

test('HTML/invalid schema/search diagnostics never become a rating decision', async () => {
    for (const responseText of ['<html>challenge</html>', '{}', JSON.stringify({ problems: [base], total: 1, page: 1, pageSize: 50, diagnostics: [{ severity: 'error' }] })]) {
        const h = harness({ respond: options => options.onload({ status: 200, responseText }) });
        try {
            await waitUntil(() => h.w.document.body.textContent.includes('조회 오류'));
            assert.equal(h.w.document.querySelectorAll('[data-state="pending"], [data-state="rated"]').length, 0);
        } finally { h.close(); }
    }
});

test('Chrome fetch timeout actively aborts a hanging request', async () => {
    const h = harness({ timeoutScale: true, respond: () => {} });
    try {
        await waitUntil(() => h.aborts === 1);
        await waitUntil(() => h.w.document.body.textContent.includes('조회 오류'));
        assert.match(h.w.document.querySelector('.boj-v4-info').dataset.description, /시간 초과/);
    } finally { h.close(); }
});

test('Late response after deleting credentials does not restore old state', async () => {
    const h = harness({ respond: () => {} });
    try {
        await waitUntil(() => h.requests.length === 1);
        h.commands.get('저장한 solved.ac API 키 지우기')();
        h.requests[0].onload({ status: 200, responseText: JSON.stringify({ problems: [base], total: 1, page: 1, pageSize: 50 }) });
        await waitUntil(() => h.w.document.body.textContent.includes('API 키를 한 번'));
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 0);
        assert.equal(h.stored.size, 0);
    } finally { h.close(); }
});


const CACHE_KEY = 'solved-ac-v4-problem-cache-v1';
const fiveMinutes = 5 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;
function cachedEntry(problem, fetchedAt, id = String(problem.problemId)) {
    return { id, fetchedAt, problems: [problem] };
}
function seededStorage(entries) {
    return new Map([[CACHE_KEY, { version: 1, entries }]]);
}
function reply(options, problems) {
    options.onload({ status: 200, finalUrl: options.url,
        responseText: JSON.stringify({ problems, total: problems.length, page: 1, pageSize: 50 }) });
}

test('A new page instance reuses a fresh persistent cache without any API request', async () => {
    const storage = new Map();
    const first = harness({ storage });
    try {
        await waitUntil(() => first.w.document.querySelector('[data-state="rated"]'));
        assert.equal(first.requests.length, 1);
        assert.equal(storage.get(CACHE_KEY).entries.length, 1);
    } finally { first.close(); }
    const second = harness({ storage, respond: () => assert.fail('Revisit must not request fresh data') });
    try {
        assert.equal(second.w.document.querySelectorAll('[data-state="rated"]').length, 2);
        await delay(30);
        assert.equal(second.requests.length, 0);
        assert.match(second.w.document.querySelector('.boj-v4-info').dataset.description, /마지막 조회:/);
    } finally { second.close(); }
});

test('Expired but retained result stays visible during refresh and updates rating and timestamp', async () => {
    const now = Date.now(), fetchedAt = now - fiveMinutes - 1000;
    const h = harness({ storage: seededStorage([cachedEntry(base, fetchedAt)]), now: () => now, respond: () => {} });
    try {
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 2);
        assert.match(h.w.document.body.textContent, /갱신 중/);
        assert.doesNotMatch(h.w.document.body.textContent, /조회 중/);
        await waitUntil(() => h.requests.length === 1);
        const changed = { ...base, givesNoRating: true, noRatingReasons: ['unsettled'] };
        reply(h.requests[0], [changed]);
        await waitUntil(() => h.w.document.querySelector('[data-state="pending"]'));
        assert.equal(h.w.document.querySelectorAll('.boj-v4-freshness').length, 0);
        assert.equal(h.stored.get(CACHE_KEY).entries[0].fetchedAt, now);
        assert.equal(h.stored.get(CACHE_KEY).entries[0].problems[0].givesNoRating, true);
    } finally { h.close(); }
});

test('Refresh failure preserves prior result, last fetch time, and failure reason', async () => {
    const fetchedAt = Date.now() - fiveMinutes - 1000;
    const h = harness({ storage: seededStorage([cachedEntry(base, fetchedAt)]), respond: req => req.onload({ status: 503 }) });
    try {
        await waitUntil(() => h.w.document.body.textContent.includes('갱신 실패'));
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 2);
        const description = h.w.document.querySelector('.boj-v4-info').dataset.description;
        assert.match(description, /마지막 조회:/);
        assert.match(description, /이전 조회 결과/);
        assert.match(description, /503/);
        assert.equal(h.stored.get(CACHE_KEY).entries[0].fetchedAt, fetchedAt);
        assert.doesNotMatch(JSON.stringify(h.stored.get(CACHE_KEY)), /retryAt|503/);
    } finally { h.close(); }
});

test('Retry sends only failed IDs even if a previously successful result has since expired', async () => {
    let now = Date.now();
    const other = live.find(p => p.problemId === 31333);
    const storage = seededStorage([cachedEntry(base, now), cachedEntry(other, now - fiveMinutes - 1)]);
    const h = harness({ ids: [String(base.problemId), String(other.problemId)], storage, now: () => now,
        respond: (req, count) => count === 1 ? req.onload({ status: 503 }) : reply(req, [other]) });
    try {
        await waitUntil(() => h.w.document.body.textContent.includes('갱신 실패'));
        now += fiveMinutes + 1;
        h.w.document.querySelector('#boj-v4-notice button').click();
        await waitUntil(() => h.requests.length === 2 && !h.w.document.querySelector('#boj-v4-notice'));
        await delay(30);
        assert.equal(h.requests.length, 2);
        for (const req of h.requests) assert.equal(new URL(req.url).searchParams.get('q'), 'id:b31333');
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 2);
    } finally { h.close(); }
});

test('Whole refresh explicitly refreshes successes without hiding their prior tier', async () => {
    const h = harness({ storage: seededStorage([cachedEntry(base, Date.now())]), respond: () => {} });
    try {
        assert.equal(h.requests.length, 0);
        h.commands.get('전체 문제 정보 새로고침')();
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 2);
        assert.match(h.w.document.body.textContent, /갱신 중/);
        await waitUntil(() => h.requests.length === 1);
        reply(h.requests[0], [base]);
        await waitUntil(() => !h.w.document.querySelector('.boj-v4-freshness'));
    } finally { h.close(); }
});

test('Cache rejects invalid versions, future dates, expired data and mismatched BOJ IDs', () => {
    const now = Date.now(), valid = cachedEntry(base, now);
    assert.equal(api.decodeStoredCache({ version: 2, entries: [valid] }, now).size, 0);
    assert.equal(api.decodeStoredCache({ version: 1, entries: [null, {},
        cachedEntry(base, now + 1), cachedEntry(base, now - day), cachedEntry(base, now, '1000'),
        { ...valid, problems: [{ ...base, noRatingWarnings: [null] }] }] }, now).size, 0);
    const many = Array.from({ length: 305 }, (_, i) => cachedEntry({ ...base, problemId: i + 1,
        judgeIds: [{ ojId: 'boj', problemId: String(i + 1), subId: '' }] }, now - i));
    const decoded = api.decodeStoredCache({ version: 1, entries: many }, now);
    assert.equal(decoded.size, 300);
    assert.equal(decoded.has('1'), true);
    assert.equal(decoded.has('305'), false);
});

test('A result retained for 24 hours is discarded rather than shown as a current tier', async () => {
    const now = Date.now();
    const h = harness({ storage: seededStorage([cachedEntry(base, now - day)]), now: () => now, respond: () => {} });
    try {
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 0);
        await waitUntil(() => h.requests.length === 1);
    } finally { h.close(); }
});

test('Saving merges newer stored results, bounds cache, and never persists viewer fields or keys', async () => {
    const now = Date.now();
    const many = Array.from({ length: 300 }, (_, i) => cachedEntry({ ...base, problemId: i + 1,
        judgeIds: [{ ojId: 'boj', problemId: String(i + 1), subId: '' }] }, now - i));
    const h = harness({ storage: seededStorage(many), now: () => now, respond: () => {} });
    try {
        await waitUntil(() => h.requests.length === 1);
        h.stored.get(CACHE_KEY).entries.unshift(cachedEntry({ ...base, level: 20 }, now));
        reply(h.requests[0], [{ ...base, viewerFolders: ['private-folder'], userStatus: 'private-status',
            clientSecret: 'private-secret' }]);
        await waitUntil(() => h.w.document.querySelector('[data-state="rated"]'));
        const saved = h.stored.get(CACHE_KEY);
        assert.equal(saved.entries.length, 300);
        assert.equal(saved.entries.some(e => e.id === '300'), false);
        assert.doesNotMatch(JSON.stringify(saved), /private-|clientSecret|clientId|viewerFolders|userStatus|test-secret/);
    } finally { h.close(); }
});

test('Storage quota failures do not turn a successful API response into a display error', async () => {
    const h = harness({ storageThrows: true });
    try {
        await waitUntil(() => h.w.document.querySelector('[data-state="rated"]'));
        assert.equal(h.w.document.querySelector('#boj-v4-notice'), null);
        assert.equal(h.requests.length, 1);
    } finally { h.close(); }
});

test('Repeated pageshow restores only one set of badges and one stale refresh request', async () => {
    let now = Date.now();
    const h = harness({ storage: seededStorage([cachedEntry(base, now)]), now: () => now, respond: () => {} });
    try {
        h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true }));
        await delay(30);
        assert.equal(h.requests.length, 0);
        now += fiveMinutes + 1;
        for (let i = 0; i < 3; i++) h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true }));
        await waitUntil(() => h.requests.length === 1);
        await delay(30);
        assert.equal(h.requests.length, 1);
        assert.equal(h.w.document.querySelectorAll('.boj-v4-info').length, 2);
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 2);
    } finally { h.close(); }
});

test('Key replacement discards the old response and requests with the replacement credentials', async () => {
    const h = harness({ respond: () => {} });
    try {
        await waitUntil(() => h.requests.length === 1);
        const prompts = ['replacement-client', 'replacement-secret'];
        h.w.prompt = () => prompts.shift();
        h.commands.get('solved.ac API 키 설정')();
        await delay(30);
        reply(h.requests[0], [base]);
        await waitUntil(() => h.requests.length === 2);
        assert.equal(h.requests[1].headers['x-client-id'], 'replacement-client');
        assert.equal(h.stored.has(CACHE_KEY), false);
        reply(h.requests[1], [base]);
        await waitUntil(() => h.w.document.querySelector('[data-state="rated"]'));
        assert.doesNotMatch(JSON.stringify(h.stored.get(CACHE_KEY)), /replacement-secret/);
    } finally { h.close(); }
});

test('Retry and whole refresh cannot bypass a 429 server cooldown', async () => {
    for (const command of ['실패한 문제만 재시도', '전체 문제 정보 새로고침']) {
        const waits = [];
        const h = harness({ now: () => 1800000000000,
            onWait: ms => { if (ms > 20000) { waits.push(ms); return true; } },
            respond: req => req.onload({ status: 429, responseHeaders: 'Retry-After: 120' }) });
        try {
            await waitUntil(() => h.w.document.body.textContent.includes('실패한 문제만 재시도'));
            h.commands.get(command)();
            await waitUntil(() => waits.length > 0);
            assert.equal(waits[0], 120000);
            await delay(20);
            assert.equal(h.requests.length, 1);
        } finally { h.close(); }
    }
});

test('A successful empty lookup invalidates a previously cached mapping', async () => {
    const h = harness({ storage: seededStorage([cachedEntry(base, Date.now() - fiveMinutes - 1)]), respond: req => reply(req, []) });
    try {
        await waitUntil(() => h.w.document.body.textContent.includes('정보 없음'));
        assert.equal(h.w.document.querySelectorAll('[data-state="rated"]').length, 0);
        assert.equal(h.stored.get(CACHE_KEY).entries.length, 0);
    } finally { h.close(); }
});

test('Saving another result preserves a newer stored entry from a sequential tab', async () => {
    const now = Date.now();
    const other = live.find(p => p.problemId === 31333);
    const storage = seededStorage([cachedEntry(base, now - 1000), cachedEntry(other, now - fiveMinutes - 1)]);
    const h = harness({ ids: ['11641', '31333'], storage, now: () => now, respond: () => {} });
    try {
        await waitUntil(() => h.requests.length === 1);
        storage.get(CACHE_KEY).entries[0] = cachedEntry({ ...base, level: 20 }, now - 500);
        reply(h.requests[0], [other]);
        await waitUntil(() => !h.w.document.querySelector('.boj-v4-freshness'));
        const saved = storage.get(CACHE_KEY).entries.find(e => e.id === '11641');
        assert.equal(saved.fetchedAt, now - 500);
        assert.equal(saved.problems[0].level, 20);
    } finally { h.close(); }
});

test('pageshow clears an obsolete failure when a newer successful result was stored elsewhere', async () => {
    let now = Date.now();
    const storage = seededStorage([cachedEntry(base, now - fiveMinutes - 1)]);
    const h = harness({ storage, now: () => now, respond: req => req.onload({ status: 503 }) });
    try {
        await waitUntil(() => h.w.document.body.textContent.includes('갱신 실패'));
        now += 1000;
        storage.set(CACHE_KEY, { version: 1, entries: [cachedEntry({ ...base, level: 20 }, now)] });
        h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true }));
        await waitUntil(() => h.w.document.querySelector('.boj-v4-info').dataset.description.includes('Platinum I'));
        assert.equal(h.w.document.querySelector('.boj-v4-freshness'), null);
        assert.equal(h.w.document.querySelector('#boj-v4-notice'), null);
        assert.doesNotMatch(h.w.document.querySelector('.boj-v4-info').dataset.description, /503|갱신 실패/);
        h.commands.get('실패한 문제만 재시도')();
        await delay(20);
        assert.equal(h.requests.length, 1);
    } finally { h.close(); }
});
