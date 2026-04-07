const input = document.getElementById("inputBox");
const preview = document.getElementById("preview");
const keypad = document.querySelector(".button-grid");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const angleToggle = document.getElementById("angleToggle");
const themeToggle = document.getElementById("themeToggle");

let expression = "";
let lastAnswer = "0";
let history = JSON.parse(localStorage.getItem("calc-history") || "[]");
let angleMode = localStorage.getItem("calc-angle-mode") || "deg";

const FUNCTIONS = new Set(["sqrt", "sin", "cos", "tan", "log", "ln"]);
const CONSTANTS = { pi: Math.PI, e: Math.E };

function loadTheme() {
    const theme = localStorage.getItem("calc-theme") || "dark";
    document.body.classList.toggle("theme-light", theme === "light");
}

function normalizeExpression(exp) {
    return exp
        .replace(/\s+/g, "")
        .replace(/×/g, "*")
        .replace(/÷/g, "/");
}

function tokenize(exp) {
    const tokens = [];
    let i = 0;

    while (i < exp.length) {
        const ch = exp[i];

        if (/\d|\./.test(ch)) {
            let num = ch;
            i += 1;
            while (i < exp.length && /\d|\./.test(exp[i])) {
                num += exp[i];
                i += 1;
            }
            if ((num.match(/\./g) || []).length > 1) {
                throw new Error("Invalid number format");
            }
            tokens.push(num);
            continue;
        }

        if (/[a-z]/i.test(ch)) {
            let name = ch;
            i += 1;
            while (i < exp.length && /[a-z]/i.test(exp[i])) {
                name += exp[i];
                i += 1;
            }

            if (FUNCTIONS.has(name) || Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
                tokens.push(name);
                continue;
            }

            throw new Error("Unknown token");
        }

        if (/[+\-*/%^()]/.test(ch)) {
            tokens.push(ch);
            i += 1;
            continue;
        }

        throw new Error("Invalid token");
    }

    return tokens;
}

function toRpn(tokens) {
    const output = [];
    const stack = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3, "u-": 4 };
    const rightAssoc = new Set(["^", "u-"]);

    let prev = null;
    for (const token of tokens) {
        if (!Number.isNaN(Number(token)) || Object.prototype.hasOwnProperty.call(CONSTANTS, token)) {
            output.push(token);
            prev = "num";
            continue;
        }

        if (FUNCTIONS.has(token)) {
            stack.push(token);
            prev = "op";
            continue;
        }

        if (token === "(") {
            stack.push(token);
            prev = "(";
            continue;
        }

        if (token === ")") {
            while (stack.length && stack[stack.length - 1] !== "(") {
                output.push(stack.pop());
            }
            if (!stack.length) {
                throw new Error("Mismatched parentheses");
            }
            stack.pop();
            if (FUNCTIONS.has(stack[stack.length - 1])) {
                output.push(stack.pop());
            }
            prev = ")";
            continue;
        }

        let op = token;
        if (token === "-" && (prev === null || prev === "op" || prev === "(")) {
            op = "u-";
        }

        while (stack.length) {
            const top = stack[stack.length - 1];
            if (top === "(") {
                break;
            }
            if (
                precedence[top] > precedence[op] ||
                (precedence[top] === precedence[op] && !rightAssoc.has(op))
            ) {
                output.push(stack.pop());
            } else {
                break;
            }
        }
        stack.push(op);
        prev = "op";
    }

    while (stack.length) {
        const op = stack.pop();
        if (op === "(") {
            throw new Error("Mismatched parentheses");
        }
        output.push(op);
    }

    return output;
}

function evalRpn(rpn) {
    const stack = [];
    for (const token of rpn) {
        if (!Number.isNaN(Number(token))) {
            stack.push(Number(token));
            continue;
        }

        if (Object.prototype.hasOwnProperty.call(CONSTANTS, token)) {
            stack.push(CONSTANTS[token]);
            continue;
        }

        if (token === "u-") {
            if (!stack.length) {
                throw new Error("Invalid expression");
            }
            stack.push(-stack.pop());
            continue;
        }

        if (FUNCTIONS.has(token)) {
            if (!stack.length) {
                throw new Error("Invalid function usage");
            }
            const v = stack.pop();
            switch (token) {
                case "sqrt":
                    if (v < 0) {
                        throw new Error("Sqrt of negative");
                    }
                    stack.push(Math.sqrt(v));
                    break;
                case "sin": {
                    const angle = angleMode === "deg" ? (v * Math.PI) / 180 : v;
                    stack.push(Math.sin(angle));
                    break;
                }
                case "cos": {
                    const angle = angleMode === "deg" ? (v * Math.PI) / 180 : v;
                    stack.push(Math.cos(angle));
                    break;
                }
                case "tan": {
                    const angle = angleMode === "deg" ? (v * Math.PI) / 180 : v;
                    stack.push(Math.tan(angle));
                    break;
                }
                case "log":
                    if (v <= 0) {
                        throw new Error("Invalid logarithm");
                    }
                    stack.push(Math.log10(v));
                    break;
                case "ln":
                    if (v <= 0) {
                        throw new Error("Invalid logarithm");
                    }
                    stack.push(Math.log(v));
                    break;
                default:
                    throw new Error("Unknown function");
            }
            continue;
        }

        if (stack.length < 2) {
            throw new Error("Invalid expression");
        }

        const b = stack.pop();
        const a = stack.pop();
        switch (token) {
            case "+":
                stack.push(a + b);
                break;
            case "-":
                stack.push(a - b);
                break;
            case "*":
                stack.push(a * b);
                break;
            case "/":
                if (b === 0) {
                    throw new Error("Division by zero");
                }
                stack.push(a / b);
                break;
            case "%":
                if (b === 0) {
                    throw new Error("Modulo by zero");
                }
                stack.push(a % b);
                break;
            case "^":
                stack.push(a ** b);
                break;
            default:
                throw new Error("Unknown operator");
        }
    }

    if (stack.length !== 1) {
        throw new Error("Invalid expression");
    }
    return stack[0];
}

function evaluate(exp) {
    const normalized = normalizeExpression(exp);
    if (!normalized) {
        throw new Error("Empty expression");
    }
    const tokens = tokenize(normalized);
    const rpn = toRpn(tokens);
    const result = evalRpn(rpn);
    if (!Number.isFinite(result)) {
        throw new Error("Result is not finite");
    }
    return Number(result.toFixed(10)).toString();
}

function updateDisplay() {
    input.value = expression || "";

    if (!expression) {
        preview.innerHTML = "&nbsp;";
        return;
    }

    try {
        preview.textContent = `= ${evaluate(expression)}`;
    } catch {
        preview.innerHTML = "&nbsp;";
    }
}

function addToHistory(exp, ans) {
    history.unshift({ exp, ans });
    history = history.slice(0, 12);
    localStorage.setItem("calc-history", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = "";
    if (!history.length) {
        const li = document.createElement("li");
        li.innerHTML = '<p class="exp">No calculations yet</p>';
        historyList.appendChild(li);
        return;
    }

    history.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<p class="exp">${item.exp}</p><p class="ans">${item.ans}</p>`;
        li.addEventListener("click", () => {
            expression = item.exp;
            updateDisplay();
        });
        historyList.appendChild(li);
    });
}

function appendValue(value) {
    expression += value;
    updateDisplay();
}

function clearAll() {
    expression = "";
    updateDisplay();
}

function deleteOne() {
    expression = expression.slice(0, -1);
    updateDisplay();
}

function toggleSign() {
    if (!expression) {
        expression = "-";
        updateDisplay();
        return;
    }

    if (/^-/.test(expression)) {
        expression = expression.slice(1);
    } else {
        expression = `-${expression}`;
    }
    updateDisplay();
}

function calculate() {
    if (!expression) {
        return;
    }

    try {
        const exp = expression;
        const result = evaluate(expression);
        expression = result;
        lastAnswer = result;
        addToHistory(exp, result);
        updateDisplay();
    } catch {
        preview.textContent = "Error";
    }
}

function handleAction(action) {
    switch (action) {
        case "clear":
            clearAll();
            break;
        case "delete":
            deleteOne();
            break;
        case "toggle-sign":
            toggleSign();
            break;
        case "insert-ans":
            expression += lastAnswer;
            updateDisplay();
            break;
        case "calculate":
            calculate();
            break;
        default:
            break;
    }
}

keypad.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    const value = button.dataset.value;

    if (action) {
        handleAction(action);
    } else if (value) {
        appendValue(value);
    }
});

clearHistoryBtn.addEventListener("click", () => {
    history = [];
    localStorage.setItem("calc-history", JSON.stringify(history));
    renderHistory();
});

angleToggle.addEventListener("click", () => {
    angleMode = angleMode === "deg" ? "rad" : "deg";
    localStorage.setItem("calc-angle-mode", angleMode);
    angleToggle.dataset.angle = angleMode;
    angleToggle.textContent = angleMode.toUpperCase();
    updateDisplay();
});

themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
    localStorage.setItem("calc-theme", nextTheme);
    loadTheme();
});

document.addEventListener("keydown", (e) => {
    const key = e.key;

    if (/^[0-9]$/.test(key) || ["+", "-", "*", "/", "%", ".", "(", ")", "^"].includes(key)) {
        appendValue(key);
        return;
    }

    if (key.toLowerCase() === "p") {
        appendValue("pi");
        return;
    }

    if (key.toLowerCase() === "e") {
        appendValue("e");
        return;
    }

    if (key.toLowerCase() === "s") {
        appendValue("sin(");
        return;
    }

    if (key.toLowerCase() === "c") {
        appendValue("cos(");
        return;
    }

    if (key.toLowerCase() === "t") {
        appendValue("tan(");
        return;
    }

    if (key.toLowerCase() === "l") {
        appendValue("ln(");
        return;
    }

    if (key.toLowerCase() === "g") {
        appendValue("log(");
        return;
    }

    if (key.toLowerCase() === "r") {
        appendValue("sqrt(");
        return;
    }

    if (key.toLowerCase() === "a") {
        expression += lastAnswer;
        updateDisplay();
        return;
    }

    if (key === "Enter" || key === "=") {
        e.preventDefault();
        calculate();
        return;
    }

    if (key === "Backspace") {
        deleteOne();
        return;
    }

    if (key === "Escape") {
        clearAll();
    }
});

loadTheme();
angleToggle.dataset.angle = angleMode;
angleToggle.textContent = angleMode.toUpperCase();
renderHistory();
updateDisplay();