// ==UserScript==
// @name         TOS2048
// @namespace    tos_2048
// @version      1.0
// @description  自動玩2048
// @author       Johnson8033
// @match        https://service-2048-215049868210.us-west1.run.app/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=towerofsaviors.com
// @license      MIT
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    // ---------------------------------------------
    // 更改時間間隔（毫秒）
    const time = 50;
    // 以下代碼無需更改
    // ---------------------------------------------
    const styleToIndex = {
        "calc(0%": 0,
        "calc(25%": 1,
        "calc(50%": 2,
        "calc(75%": 3
    };
    let isPaused = true;
    function simulateArrowKey(key) {
        const keyMap = {
            "ArrowUp": 38,
            "ArrowDown": 40,
            "ArrowLeft": 37,
            "ArrowRight": 39
        };
        const code = key;
        const keyCode = keyMap[key];
        ["keydown", "keypress", "keyup"].forEach(type => {
            const event = new KeyboardEvent(type, {
                key,
                code,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        });
    }
    function createPauseButton() {
        const host = document.createElement('div');
        host.style.all = 'initial';
        host.style.position = 'fixed';
        host.style.top = '12px';
        host.style.right = '12px';
        host.style.zIndex = '999999';
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
        <style>
            button {
                width: 140px;
                height: 50px;
                background: none;
                border: none;
                padding: 0;
                margin: 0;
                cursor: pointer;
                position: relative;
            }
            .top {
                width: 100%;
                height: 100%;
                background: rgb(255, 255, 238);
                color: rgb(36,38,34);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 7mm;
                outline: 2px solid rgb(36,38,34);
                transition: 0.2s;
                position: relative;
                overflow: hidden;
                user-select: none;
            }
            .bottom {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgb(229,229,199);
                top: 10px;
                left: 0;
                border-radius: 7mm;
                outline: 2px solid rgb(36,38,34);
                z-index: -1;
            }
            .bottom::before,
            .bottom::after {
                position: absolute;
                content: "";
                width: 2px;
                height: 9px;
                background: rgb(36,38,34);
                bottom: 0;
            }
            .bottom::before { left: 15%; }
            .bottom::after { left: 85%; }
            .top::before {
                position: absolute;
                content: "";
                width: 15px;
                height: 100%;
                background: rgba(0,0,0,0.1);
                transform: skewX(30deg);
                left: -20px;
                transition: left 0.25s;
            }
            button:active .top {
                transform: translateY(10px);
            }
            button:active .top::before {
                left: calc(100% + 20px);
            }
            button::before {
                content: "";
                position: absolute;
                width: calc(100% + 2px);
                height: 100%;
                background: rgb(140,140,140);
                top: 14px;
                left: -1px;
                border-radius: 7mm;
                outline: 2px solid rgb(36,38,34);
                z-index: -2;
            }
        </style>
        </style>
        <button>
            <div class="top">▶ 停止</div>
            <div class="bottom"></div>
        </button>
    `;

        const btn = shadow.querySelector('button');
        const top = shadow.querySelector('.top');

        btn.addEventListener('click', () => {
            isPaused = !isPaused;
            if (!isPaused) {

            }
            top.textContent = isPaused ? '▶ 停止' : '⏸ 繼續';
        });
        document.body.appendChild(shadow.host);
    }
    createPauseButton();
    const workerCode = `
    const DIRECTIONS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    const PROB_2 = 0.9;
    const PROB_4 = 0.1;
    const TRANSPOSITION = new Map();
    function predictNextMove(board) {
        TRANSPOSITION.clear();
        const depth = getSearchDepth(board);
        let bestMove = null;
        let bestScore = -Infinity;
        for (const dir of DIRECTIONS) {
            const next = simulateMove(board, dir);
            if (!boardsEqual(board, next)) {
                const score = expectimax(next, depth - 1, false);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = dir;
                }
            }
        }
        return bestMove;
    }
    function expectimax(board, depth, isPlayer) {
        const key = hashBoard(board) + "|" + depth + "|" + isPlayer;
        if (TRANSPOSITION.has(key)) return TRANSPOSITION.get(key);
        let result;
        if (depth === 0 || isGameOver(board)) {
            result = evaluateBoard(board);
        } else if (isPlayer) {
            let max = -Infinity;
            for (const dir of DIRECTIONS) {
                const b2 = simulateMove(board, dir);
                if (!boardsEqual(board, b2)) {
                    max = Math.max(max, expectimax(b2, depth - 1, false));
                }
            }
            result = max;
        } else {
            const empty = getEmptyCells(board);
            if (empty.length === 0) {
                result = evaluateBoard(board);
            } else {
                let sum = 0;
                for (const [r, c] of empty) {
                    let b2 = clone(board);
                    b2[r][c] = 2;
                    sum += PROB_2 * expectimax(b2, depth - 1, true);
                    let b4 = clone(board);
                    b4[r][c] = 4;
                    sum += PROB_4 * expectimax(b4, depth - 1, true);
                }
                result = sum / empty.length;
            }
        }
        TRANSPOSITION.set(key, result);
        return result;
    }
    function evaluateBoard(board) {
        let empty = 0;
        let smoothness = 0;
        let weighted = 0;
        let maxTile = 0;
        const weights = [
            [65536, 32768, 16384, 8192],
            [512, 1024, 2048, 4096],
            [256, 128, 64, 32],
            [2, 4, 8, 16]
        ];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const v = board[r][c];
                if (v === 0) empty++;
                maxTile = Math.max(maxTile, v);
                weighted += v * weights[r][c];
                if (v) {
                    if (c < 3 && board[r][c + 1])
                        smoothness -= Math.abs(Math.log2(v) - Math.log2(board[r][c + 1]));
                    if (r < 3 && board[r + 1][c])
                        smoothness -= Math.abs(Math.log2(v) - Math.log2(board[r + 1][c]));
                }
            }
        }
        if (board[0][0] !== maxTile) weighted -= maxTile * 100;
        return (
            empty * 300 +
            smoothness * 3 +
            weighted * 0.001
        );
    }
    function simulateMove(board, dir) {
        let b = clone(board);
        if (dir === "ArrowLeft") {
            b = b.map(slideRow);
        }
        if (dir === "ArrowRight") {
            b = b.map(r => slideRow(r.reverse()).reverse());
        }
        if (dir === "ArrowUp") {
            b = rotateLeft(b);
            b = b.map(slideRow);
            b = rotateRight(b);
        }
        if (dir === "ArrowDown") {
            b = rotateLeft(b);
            b = b.map(r => slideRow(r.reverse()).reverse());
            b = rotateRight(b);
        }
        return b;
    }
    function slideRow(row) {
        let arr = row.filter(v => v !== 0);
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                arr[i + 1] = 0;
                i++;
            }
        }
        arr = arr.filter(v => v !== 0);
        while (arr.length < 4) arr.push(0);
        return arr;
    }
    function getSearchDepth(board) {
        const empty = getEmptyCells(board).length;
        if (empty >= 8) return 5;
        if (empty >= 4) return 6;
        return 7;
    }
    function getEmptyCells(board) {
        const res = [];
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (board[r][c] === 0) res.push([r, c]);
        return res;
    }
    function isGameOver(board) {
        for (const d of DIRECTIONS)
            if (!boardsEqual(board, simulateMove(board, d))) return false;
        return true;
    }
    function clone(b) { return b.map(r => r.slice());}
    function boardsEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function rotateLeft(b) { return b[0].map((_, i) => b.map(r => r[3 - i])); }
    function rotateRight(b) { return b[0].map((_, i) => b.map(r => r[i]).reverse()); }
    function hashBoard(board) {
        let h = 0n;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                h = (h << 4n) | BigInt(board[r][c] ? Math.log2(board[r][c]) : 0);
            }
        }
        return h;
    }
    self.onmessage = (e) => {
        const board = e.data;
        const result = predictNextMove(board);
        self.postMessage(result);
    };`
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function observeElement(selector, callback) {
        const targetNode = document.body;
        const observer = new MutationObserver((mutations) => {
            const el = document.querySelectorAll(selector).length === 2 ? document.querySelectorAll(selector)[1] : document.querySelectorAll(selector)[2];
            if (el) callback(el);
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }
    observeElement(".absolute.inset-0.pointer-events-none", async (el) => {
        while (isPaused) { await new Promise(r => setTimeout(r, 50)); }
        const board = Array(4).fill(0).map(() => Array(4).fill(0));
        el.childNodes.forEach(node => {
            const img = node.querySelector("div img");
            const altText = img?.alt ?? null;
            if (!altText) return;
            const top = node.style.top.split(" ")[0];
            const left = node.style.left.split(" ")[0];
            board[styleToIndex[top]][styleToIndex[left]] = parseInt(altText.split(" ")[1], 10)
        });
        worker.postMessage(board);
        const move = await new Promise((resolve) => {
            worker.onmessage = (e) => {
                resolve(e.data);
            };
        });
        await sleep(time);
        // console.debug(move);
        simulateArrowKey(move);
    });
})();