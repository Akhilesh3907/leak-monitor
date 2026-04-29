/**
 * DarkWatch — script.js
 * Handles domain input, API call to /search, and results rendering.
 */

"use strict";

// ── DOM references ─────────────────────────────────────────────────────────────
const domainInput  = document.getElementById("domainInput");
const searchBtn    = document.getElementById("searchBtn");
const inputError   = document.getElementById("inputError");
const resultsSection = document.getElementById("results");
const loadingState = document.getElementById("loadingState");
const resultsOutput = document.getElementById("resultsOutput");
const resultsTitle = document.getElementById("resultsTitle");
const resultsMeta  = document.getElementById("resultsMeta");
const noResults    = document.getElementById("noResults");
const tableWrapper = document.getElementById("tableWrapper");
const resultsBody  = document.getElementById("resultsBody");
const clearBtn     = document.getElementById("clearBtn");


// ── Client-side validation ────────────────────────────────────────────────────

/**
 * Validate the domain field value.
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateDomain(value) {
  const v = value.trim();
  if (!v) return { valid: false, message: "Please enter a domain." };
  if (!v.startsWith("@")) return { valid: false, message: "Domain must start with '@' — e.g. @company.com" };
  if (v.length < 4) return { valid: false, message: "Domain is too short." };
  return { valid: true, message: "" };
}


// ── UI helpers ─────────────────────────────────────────────────────────────────

/** Show an error message below the input. */
function showError(msg) {
  inputError.textContent = msg;
}

/** Clear the error message. */
function clearError() {
  inputError.textContent = "";
}

/** Show / hide the loading spinner. */
function setLoading(on) {
  resultsSection.classList.remove("hidden");
  loadingState.classList.toggle("hidden", !on);
  resultsOutput.classList.add("hidden");
}

/** Scroll results section into view smoothly. */
function scrollToResults() {
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Reset everything back to the initial empty state. */
function resetUI() {
  resultsSection.classList.add("hidden");
  loadingState.classList.add("hidden");
  resultsOutput.classList.add("hidden");
  noResults.classList.add("hidden");
  tableWrapper.classList.add("hidden");
  resultsBody.innerHTML = "";
  clearError();
}


// ── Render results ────────────────────────────────────────────────────────────

/**
 * Render the list of breach records into the results table.
 * @param {string} domain   - the searched domain
 * @param {Array}  records  - array of { email, password } objects
 */
function renderResults(domain, records) {
  resultsOutput.classList.remove("hidden");

  // Title & meta line
  resultsTitle.textContent = `Results for ${domain}`;
  resultsMeta.textContent  = `Dataset: leaks.csv  |  Scanned: ${new Date().toLocaleString()}`;

  if (records.length === 0) {
    // No breaches found
    noResults.classList.remove("hidden");
    tableWrapper.classList.add("hidden");
  } else {
    noResults.classList.add("hidden");
    tableWrapper.classList.remove("hidden");

    // Clear previous rows
    resultsBody.innerHTML = "";

    // Build table rows with a staggered animation delay
    records.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.style.animationDelay = `${i * 40}ms`;

      // Row number
      const tdNum = document.createElement("td");
      tdNum.textContent = i + 1;

      // Email
      const tdEmail = document.createElement("td");
      tdEmail.textContent = escapeHTML(row.email ?? "");

      // Password
      const tdPass = document.createElement("td");
      tdPass.textContent = escapeHTML(row.password ?? "");

      tr.append(tdNum, tdEmail, tdPass);
      resultsBody.appendChild(tr);
    });
  }
}


// ── API call ──────────────────────────────────────────────────────────────────

/**
 * POST the domain to /search and handle the JSON response.
 * @param {string} domain
 */
async function performSearch(domain) {
  clearError();
  setLoading(true);
  scrollToResults();

  // Disable the button while searching
  searchBtn.disabled = true;
  searchBtn.querySelector(".btn-text").textContent = "Scanning…";

  try {
    const response = await fetch("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain.trim() }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      // Server returned a validation / processing error
      setLoading(false);
      resultsSection.classList.add("hidden");
      showError(data.error ?? "An unexpected error occurred.");
      return;
    }

    // Success — render results
    setLoading(false);
    renderResults(data.domain, data.results);

    // Update results title with count badge
    const count = data.count;
    resultsTitle.textContent = `${count} breached account${count !== 1 ? "s" : ""} found for ${data.domain}`;

  } catch (err) {
    // Network or parse error
    setLoading(false);
    resultsSection.classList.add("hidden");
    showError("Could not reach the server. Is the Flask app running?");
    console.error("Search error:", err);
  } finally {
    // Re-enable the button
    searchBtn.disabled = false;
    searchBtn.querySelector(".btn-text").textContent = "Scan";
  }
}


// ── Security helper ───────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS when injecting into the DOM.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ── Event listeners ───────────────────────────────────────────────────────────

// Scan button click
searchBtn.addEventListener("click", () => {
  const value = domainInput.value;
  const { valid, message } = validateDomain(value);
  if (!valid) {
    showError(message);
    domainInput.focus();
    return;
  }
  performSearch(value);
});

// Allow Enter key to trigger search
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// Live-clear error as user types
domainInput.addEventListener("input", () => {
  if (inputError.textContent) clearError();
});

// Clear button resets UI and returns focus to the input
clearBtn.addEventListener("click", () => {
  resetUI();
  domainInput.value = "";
  domainInput.focus();
});
