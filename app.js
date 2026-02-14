let rows = [];
let fuse = null;
let currentPage = 1;
const pageSize = 50;
let currentFilteredRows = [];

const KEY_FIELDS = [
  "PubMed_ID", "Title", "VIP_name", "VIP_family_name",
  "Database", "DOI", "Homepage", "Source_code", "Website_accessible",
  "Primarily_for_VIP", "Gene-specific"
];

const FILTER_COLUMNS = [
  "Indel", "SNVs", "SVs", "Nonsynonymous_nonsense", "Synonymous", "Splicing", "Regulatory_regions",
  "Standalone", "Web_server", "Website_accessible", "Primarily_for_VIP", "Database"
];

function normPMID(x) {
  return String(x ?? "").trim();
}

function renderResults(items) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  for (const { item } of items) {
    const pmid = normPMID(item["PubMed_ID"]);
    const title = item["Title"] ?? "(no title)";
    const vip = item["VIP_name"] ?? "";
    const db  = item["Database"] ?? "";

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="card-title">${escapeHtml(title)}</div>
      <div class="card-sub">
        <span class="pill">PMID: ${escapeHtml(pmid)}</span>
        ${vip ? `<span class="pill">${escapeHtml(vip)}</span>` : ""}
        ${db ? `<span class="pill">${escapeHtml(db)}</span>` : ""}
      </div>
    `;
    div.onclick = () => {
      renderDetails(item);
      // Scroll the details panel to top when a new item is selected
      document.getElementById("details").scrollTop = 0;
    };
    el.appendChild(div);
  }
}

function renderPagination(totalItems) {
  const el = document.getElementById("pagination");
  el.innerHTML = "";
  
  if (totalItems <= pageSize) return;

  const totalPages = Math.ceil(totalItems / pageSize);
  
  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Previous";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    updateDisplay();
  };

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    updateDisplay();
  };

  const info = document.createElement("span");
  info.textContent = `Page ${currentPage} of ${totalPages}`;

  el.appendChild(prevBtn);
  el.appendChild(info);
  el.appendChild(nextBtn);
}

function renderDetails(row) {
  const el = document.getElementById("details");
  const keys = Object.keys(row);

  const top = ["PubMed_ID","Title","VIP_name","VIP_family_name","Database","DOI","Homepage","Source_code","Year"];
  const rest = keys.filter(k => !top.includes(k)).sort((a,b)=>a.localeCompare(b));
  const ordered = [...top.filter(k => k in row), ...rest];

  el.innerHTML = ordered.map(k => `
    <div class="kv">
      <div class="k">${escapeHtml(k)}</div>
      <div class="v">${formatValue(row[k])}</div>
    </div>
  `).join("");
}

function formatValue(v) {
  if (v === null || v === undefined) return "<span class='muted'>(blank)</span>";
  const s = String(v);
  if (/^https?:\/\//i.test(s)) {
    return `<a href="${escapeAttr(s)}" target="_blank" rel="noreferrer">${escapeHtml(s)}</a>`;
  }
  return escapeHtml(s);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s){ return escapeHtml(s); }

function doSearch() {
  currentPage = 1; // Reset to first page on new search
  const fTitle = document.getElementById("f-title").value.trim().toLowerCase();
  const fVipName = document.getElementById("f-vip-name").value.trim().toLowerCase();
  const fVipFamily = document.getElementById("f-vip-family").value.trim().toLowerCase();
  const fPmid = document.getElementById("f-pmid").value.trim().toLowerCase();
  const yearStart = document.getElementById("year-start").value;
  const yearEnd = document.getElementById("year-end").value;

  const activeFilters = {};
  FILTER_COLUMNS.forEach(col => {
    const val = document.getElementById(`filter-${col}`).value;
    if (val !== "any") {
      activeFilters[col] = val;
    }
  });

  const hasActiveFilters = fTitle || fVipName || fVipFamily || fPmid || yearStart || yearEnd || Object.keys(activeFilters).length > 0;

  if (!hasActiveFilters) {
    currentFilteredRows = [];
    updateDisplay(false);
    return;
  }

  let filtered = rows;

  // 1. Apply Field-specific searches (AND)
  if (fTitle) {
    filtered = filtered.filter(r => String(r["Title"] ?? "").toLowerCase().includes(fTitle));
  }
  if (fVipName) {
    filtered = filtered.filter(r => String(r["VIP_name"] ?? "").toLowerCase().includes(fVipName));
  }
  if (fVipFamily) {
    filtered = filtered.filter(r => String(r["VIP_family_name"] ?? "").toLowerCase().includes(fVipFamily));
  }
  if (fPmid) {
    filtered = filtered.filter(r => String(r["PubMed_ID"] ?? "").toLowerCase().includes(fPmid));
  }

  // 2. Apply Year Range Filter
  if (yearStart || yearEnd) {
    const startYear = yearStart ? parseInt(yearStart) : -Infinity;
    const endYear = yearEnd ? parseInt(yearEnd) : Infinity;
    filtered = filtered.filter(r => {
      const rowYear = parseInt(r["Year"] ?? 0);
      return rowYear >= startYear && rowYear <= endYear;
    });
  }

  // 3. Apply Score Filters (AND)
  for (const [col, targetVal] of Object.entries(activeFilters)) {
    filtered = filtered.filter(r => {
      const v = String(r[col] ?? "");
      return v === targetVal;
    });
  }

  currentFilteredRows = filtered;
  updateDisplay(true);
}

function updateDisplay(hasActiveFilters = true) {
  const meta = document.getElementById("meta");
  const resultsEl = document.getElementById("results");
  const detailsEl = document.getElementById("details");

  if (!hasActiveFilters) {
    meta.textContent = "Please enter a search term or select a filter to see results.";
    resultsEl.innerHTML = "";
    document.getElementById("pagination").innerHTML = "";
    detailsEl.textContent = "Search or filter to view details.";
    return;
  }

  const totalItems = currentFilteredRows.length;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = currentFilteredRows.slice(start, end).map(item => ({ item }));

  meta.textContent = `Matches: ${totalItems}`;
  renderResults(pageItems);
  renderPagination(totalItems);

  if (pageItems.length === 0) {
    detailsEl.textContent = "No results found.";
  } else {
    detailsEl.textContent = "Click a result to view all columns.";
  }
  
  // Scroll results container to top when page changes
  const resultsContainer = resultsEl.parentElement;
  if (resultsContainer && resultsContainer.classList.contains('details')) {
    resultsContainer.scrollTop = 0;
  }
}

function setupFilters() {
  const container = document.getElementById("filters");
  FILTER_COLUMNS.forEach(col => {
    const group = document.createElement("div");
    group.className = "filter-group";
    const labelText = col.replace(/_/g, " ");
    group.innerHTML = `
      <label for="filter-${col}">${labelText}:</label>
      <select id="filter-${col}">
        <option value="any">Any</option>
        <option value="1">Yes (1)</option>
        <option value="0">No (0)</option>
      </select>
    `;
    group.querySelector("select").onchange = doSearch;
    container.appendChild(group);
  });
}

function setupYearFilters() {
  // Extract all unique years from the dataset and sort them
  const years = [...new Set(rows.map(r => parseInt(r["Year"])).filter(y => y && !isNaN(y)))].sort((a, b) => a - b);
  
  const startSelect = document.getElementById("year-start");
  const endSelect = document.getElementById("year-end");
  
  // Populate both dropdowns with the same years
  years.forEach(year => {
    const option1 = document.createElement("option");
    option1.value = year;
    option1.textContent = year;
    startSelect.appendChild(option1);
    
    const option2 = document.createElement("option");
    option2.value = year;
    option2.textContent = year;
    endSelect.appendChild(option2);
  });
  
  // Add event listeners
  startSelect.addEventListener("change", doSearch);
  endSelect.addEventListener("change", doSearch);
}

async function main() {
  const resp = await fetch("vipdb.json");
  rows = await resp.json();

  setupFilters();
  setupYearFilters();

  const inputs = ["f-title", "f-vip-name", "f-vip-family", "f-pmid"];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener("input", doSearch);
  });

  document.getElementById("clear").onclick = () => {
    inputs.forEach(id => document.getElementById(id).value = "");
    FILTER_COLUMNS.forEach(col => document.getElementById(`filter-${col}`).value = "any");
    document.getElementById("year-start").value = "";
    document.getElementById("year-end").value = "";
    doSearch();
  };

  doSearch();
}

main();
