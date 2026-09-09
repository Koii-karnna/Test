// DOM rendering for the dynamic parts of the document (checklist, photos,
// signatures, attachments) and applying admin/signer mode locking.

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderStaticFields() {
  document.getElementById("docNo").value = state.meta.docNo;
  document.getElementById("docDate").value = state.meta.docDate;

  const logoImg = document.getElementById("logoImg");
  const logoPlaceholder = document.getElementById("logoPlaceholder");
  if (state.meta.logo) {
    logoImg.src = state.meta.logo;
    logoImg.hidden = false;
    logoPlaceholder.hidden = true;
  } else {
    logoImg.hidden = true;
    logoPlaceholder.hidden = false;
  }

  document.querySelectorAll("[data-field]").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (key in state.jobInfo) el.value = state.jobInfo[key];
  });

  document.getElementById("conclusionNote").value = state.conclusion.note;
  document.querySelectorAll('input[name="conclusion"]').forEach((el) => {
    el.checked = el.value === state.conclusion.value;
  });
}

function renderChecklist() {
  const body = document.getElementById("checklistBody");
  body.innerHTML = "";

  if (state.checklist.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="attachment-empty" style="text-align:center;padding:16px;">ยังไม่มีรายการตรวจสอบ กด "เพิ่มรายการ" เพื่อเริ่มต้น</td>`;
    body.appendChild(tr);
    return;
  }

  state.checklist.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;
    tr.innerHTML = `
      <td class="row-index">${idx + 1}</td>
      <td><textarea rows="1" data-role="item" placeholder="รายการตรวจสอบ">${escapeHtml(row.item)}</textarea></td>
      <td>
        <select class="result-select" data-role="result" data-value="${row.result}">
          <option value="">-- เลือกผล --</option>
          <option value="pass" ${row.result === "pass" ? "selected" : ""}>ผ่าน</option>
          <option value="fail" ${row.result === "fail" ? "selected" : ""}>ไม่ผ่าน</option>
          <option value="na" ${row.result === "na" ? "selected" : ""}>ไม่เกี่ยวข้อง (N/A)</option>
        </select>
      </td>
      <td><textarea rows="1" data-role="remark" placeholder="หมายเหตุ">${escapeHtml(row.remark)}</textarea></td>
      <td class="no-print"><button type="button" class="row-delete-btn" data-role="delete" title="ลบรายการ">&times;</button></td>
    `;
    body.appendChild(tr);
  });
}

function renderPhotoGroup(group) {
  const container = document.getElementById(group === "before" ? "photosBefore" : "photosAfter");
  container.innerHTML = "";
  const list = state.photos[group];

  if (list.length === 0) {
    container.innerHTML = `<div class="photo-empty">ยังไม่มีรูปภาพ</div>`;
    return;
  }

  list.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.dataset.id = photo.id;
    card.innerHTML = `
      <button type="button" class="photo-remove-btn no-print" data-role="remove-photo" title="ลบรูป">&times;</button>
      <img src="${photo.dataUrl}" alt="รูปประกอบ">
      <input type="text" data-role="caption" placeholder="คำอธิบายภาพ" value="${escapeHtml(photo.caption)}">
    `;
    container.appendChild(card);
  });
}

function renderPhotos() {
  renderPhotoGroup("before");
  renderPhotoGroup("after");
}

function renderSignatures() {
  const row = document.getElementById("signatureRow");
  row.innerHTML = "";

  Object.keys(state.signatures).forEach((key) => {
    const sig = state.signatures[key];
    const card = document.createElement("div");
    card.className = "signature-card";
    card.dataset.role = key;
    card.innerHTML = `
      <div class="signature-role">${escapeHtml(sig.role)}</div>
      <label class="signature-box no-print-clickable" data-role="sig-upload-label">
        ${sig.image
          ? `<img src="${sig.image}" alt="ลายเซ็น ${escapeHtml(sig.role)}">`
          : `<span class="signature-box-empty no-print">คลิกเพื่ออัปโหลดลายเซ็น</span>`}
        <input type="file" accept="image/*" data-role="sig-upload" hidden>
      </label>
      <input type="text" data-role="sig-name" placeholder="ชื่อ-นามสกุล" value="${escapeHtml(sig.name)}">
      <input type="text" data-role="sig-position" placeholder="ตำแหน่ง" value="${escapeHtml(sig.position)}">
      <input type="date" data-role="sig-date" value="${escapeHtml(sig.date)}">
      <div class="signature-line">ลงชื่อ .............................................</div>
    `;
    row.appendChild(card);
  });
}

function renderAttachments() {
  const list = document.getElementById("attachmentList");
  list.innerHTML = "";

  if (state.attachments.length === 0) {
    list.innerHTML = `<li class="attachment-empty">ยังไม่มีไฟล์แนบ</li>`;
    return;
  }

  state.attachments.forEach((att) => {
    const li = document.createElement("li");
    li.className = "attachment-item";
    li.dataset.id = att.id;
    li.innerHTML = `
      <span class="attachment-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
      <span class="attachment-size">${formatFileSize(att.size)}</span>
      <button type="button" class="attachment-remove-btn no-print" data-role="remove-attachment" title="ลบไฟล์แนบ">&times;</button>
    `;
    list.appendChild(li);
  });
}

function applyModeLocking() {
  const isSigner = state.mode === "signer";

  document.body.classList.toggle("mode-signer", isSigner);

  document.querySelectorAll("#modeSwitch .mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  });

  // In signer mode: lock document content (job info, checklist, photos,
  // conclusion, attachments, logo) — signatures stay editable so the
  // reviewer/engineer can sign without altering what admin prepared.
  const lockSelectors = [
    "#section-jobinfo input, #section-jobinfo textarea",
    "#checklistBody textarea, #checklistBody select, #checklistBody .row-delete-btn",
    "#btnAddRow",
    "#photosBefore input, #photosAfter input",
    ".photoInput",
    "#photo-groups label.btn",
    "#conclusionOptions input, #conclusionNote",
    "#attachmentInput",
    "#attachmentList .attachment-remove-btn",
    "#docNo, #docDate",
    "#logoInput",
  ];

  lockSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.tagName === "BUTTON" || el.tagName === "LABEL" || el.type === "file") {
        el.style.display = isSigner ? "none" : "";
        el.disabled = isSigner;
      } else {
        el.disabled = isSigner;
        el.classList.toggle("locked-field", isSigner);
      }
    });
  });

  document.querySelectorAll(".photo-remove-btn").forEach((btn) => {
    btn.style.display = isSigner ? "none" : "";
  });

  document.getElementById("logoPlaceholder").style.display = isSigner ? "none" : "";
}

function renderAll() {
  renderStaticFields();
  renderChecklist();
  renderPhotos();
  renderSignatures();
  renderAttachments();
  applyModeLocking();
}
