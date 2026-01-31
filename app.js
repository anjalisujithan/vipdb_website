let rows = [];
let fuse = null;

const KEY_FIELDS = [
  "PubMed_ID", "Title", "VIP_name", "VIP_family_name",
  "Database", "DOI", "Homepage", "Source_code", "Website_accessible",
  "Primarily_for_VIP", "Gene-specific"
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
    div.onclick = () => renderDetails(item);
    el.appendChild(div);
  }
}

function renderDetails(row) {
  const el = document.getElementById("details");
  const keys = Object.keys(row);

  // nice: keep important fields at top, then rest alphabetical
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

  // linkify URLs lightly
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

function doSearch(query) {
  const meta = document.getElementById("meta");
  const q = query.trim();

  // Exact PMID shortcut (super common)
  const exact = rows.find(r => normPMID(r["PubMed_ID"]) === q);
  if (q && exact) {
    meta.textContent = `Exact PMID match: 1 row`;
    renderResults([{ item: exact }]);
    renderDetails(exact);
    return;
  }

  if (!q) {
    meta.textContent = `Loaded ${rows.length} rows.`;
    renderResults(rows.slice(0, 50).map(item => ({ item })));
    return;
  }

  const results = fuse.search(q).slice(0, 50);
  meta.textContent = `Matches: ${results.length} (showing up to 50)`;
  renderResults(results);
  if (results[0]) renderDetails(results[0].item);
}

async function main() {
  const resp = await fetch("vipdb.json");
  rows = await resp.json();

  // Build fuzzy index
  fuse = new Fuse(rows, {
    includeScore: true,
    threshold: 0.35, // lower = stricter
    ignoreLocation: true,
    keys: KEY_FIELDS
  });

  doSearch("");

  const input = document.getElementById("q");
  input.addEventListener("input", (e) => doSearch(e.target.value));

  document.getElementById("clear").onclick = () => {
    input.value = "";
    doSearch("");
    input.focus();
  };
}

main();
