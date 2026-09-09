// Wires up all user interactions: editing fields, mode switching,
// new/open/save/print. Pure vanilla JS, no build step required —
// just open index.html in a browser.

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveDraftToLocalStorage();
    const indicator = document.getElementById("saveIndicator");
    indicator.hidden = false;
    indicator.textContent = "บันทึกร่างอัตโนมัติแล้ว " + new Date().toLocaleTimeString("th-TH");
    clearTimeout(scheduleAutosave._hideTimer);
    scheduleAutosave._hideTimer = setTimeout(() => { indicator.hidden = true; }, 2500);
  }, 600);
}

function confirmDiscardIfNeeded(message) {
  return window.confirm(message);
}

// ---------- Toolbar: mode switch ----------

document.getElementById("modeSwitch").addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  state.mode = btn.dataset.mode;
  applyModeLocking();
  scheduleAutosave();
});

// ---------- Toolbar: new / open / save / print ----------

document.getElementById("btnNew").addEventListener("click", () => {
  if (!confirmDiscardIfNeeded("สร้างเอกสารใหม่? ข้อมูลที่ยังไม่ได้บันทึกเป็นไฟล์จะหายไป")) return;
  state = createEmptyState();
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
});

document.getElementById("btnOpen").addEventListener("click", () => {
  document.getElementById("fileOpenInput").click();
});

document.getElementById("fileOpenInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const loaded = JSON.parse(text);
    state = Object.assign(createEmptyState(), loaded);
    renderAll();
    scheduleAutosave();
  } catch (err) {
    alert("ไม่สามารถเปิดไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์โครงการ (.json) ที่ถูกต้อง");
  } finally {
    e.target.value = "";
  }
});

document.getElementById("btnSave").addEventListener("click", () => {
  const blob = serializeStateToJsonBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.jobInfo.jobName || state.meta.docNo || "เอกสารตรวจรับงาน").trim() || "เอกสารตรวจรับงาน";
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

// ---------- Letterhead: doc no / date / logo ----------

document.getElementById("docNo").addEventListener("input", (e) => {
  state.meta.docNo = e.target.value;
  scheduleAutosave();
});

document.getElementById("docDate").addEventListener("input", (e) => {
  state.meta.docDate = e.target.value;
  scheduleAutosave();
});

document.getElementById("logoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.meta.logo = await readFileAsDataUrl(file);
  renderStaticFields();
  scheduleAutosave();
  e.target.value = "";
});

// ---------- Job info fields ----------

document.getElementById("section-jobinfo").addEventListener("input", (e) => {
  const key = e.target.getAttribute("data-field");
  if (!key) return;
  state.jobInfo[key] = e.target.value;
  scheduleAutosave();
});

// ---------- Checklist ----------

document.getElementById("btnAddRow").addEventListener("click", () => {
  addChecklistRow();
  renderChecklist();
  scheduleAutosave();
});

document.getElementById("checklistBody").addEventListener("input", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const row = state.checklist.find((r) => r.id === tr.dataset.id);
  if (!row) return;
  const roleEl = e.target.getAttribute("data-role");
  if (roleEl === "item") row.item = e.target.value;
  if (roleEl === "remark") row.remark = e.target.value;
  scheduleAutosave();
});

document.getElementById("checklistBody").addEventListener("change", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const role = e.target.getAttribute("data-role");
  if (role === "result") {
    const row = state.checklist.find((r) => r.id === tr.dataset.id);
    if (row) {
      row.result = e.target.value;
      e.target.setAttribute("data-value", e.target.value);
    }
    scheduleAutosave();
  }
});

document.getElementById("checklistBody").addEventListener("click", (e) => {
  if (e.target.getAttribute("data-role") !== "delete") return;
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  removeChecklistRow(tr.dataset.id);
  renderChecklist();
  scheduleAutosave();
});

// ---------- Photos ----------

document.querySelectorAll(".photoInput").forEach((input) => {
  input.addEventListener("change", async (e) => {
    const group = e.target.getAttribute("data-group");
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      addPhoto(group, dataUrl, "");
    }
    renderPhotoGroup(group);
    scheduleAutosave();
    e.target.value = "";
  });
});

function wirePhotoGroupEvents(containerId, group) {
  const container = document.getElementById(containerId);

  container.addEventListener("click", (e) => {
    if (e.target.getAttribute("data-role") !== "remove-photo") return;
    const card = e.target.closest(".photo-card[data-id]");
    if (!card) return;
    removePhoto(group, card.dataset.id);
    renderPhotoGroup(group);
    scheduleAutosave();
  });

  container.addEventListener("input", (e) => {
    if (e.target.getAttribute("data-role") !== "caption") return;
    const card = e.target.closest(".photo-card[data-id]");
    if (!card) return;
    const photo = state.photos[group].find((p) => p.id === card.dataset.id);
    if (photo) photo.caption = e.target.value;
    scheduleAutosave();
  });
}

wirePhotoGroupEvents("photosBefore", "before");
wirePhotoGroupEvents("photosAfter", "after");

// ---------- Conclusion ----------

document.getElementById("conclusionOptions").addEventListener("change", (e) => {
  if (e.target.name !== "conclusion") return;
  state.conclusion.value = e.target.value;
  scheduleAutosave();
});

document.getElementById("conclusionNote").addEventListener("input", (e) => {
  state.conclusion.note = e.target.value;
  scheduleAutosave();
});

// ---------- Signatures ----------

document.getElementById("signatureRow").addEventListener("click", (e) => {
  const label = e.target.closest('[data-role="sig-upload-label"]');
  if (!label) return;
  // native <label><input hidden></label> click-through already opens the
  // file picker; nothing else to do here.
});

document.getElementById("signatureRow").addEventListener("change", async (e) => {
  const card = e.target.closest(".signature-card[data-role]");
  if (!card) return;
  const role = card.dataset.role;
  const sig = state.signatures[role];
  const fieldRole = e.target.getAttribute("data-role");

  if (fieldRole === "sig-upload") {
    const file = e.target.files[0];
    if (file) {
      sig.image = await readFileAsDataUrl(file);
      renderSignatures();
      applyModeLocking();
      scheduleAutosave();
    }
  }
});

document.getElementById("signatureRow").addEventListener("input", (e) => {
  const card = e.target.closest(".signature-card[data-role]");
  if (!card) return;
  const role = card.dataset.role;
  const sig = state.signatures[role];
  const fieldRole = e.target.getAttribute("data-role");

  if (fieldRole === "sig-name") sig.name = e.target.value;
  if (fieldRole === "sig-position") sig.position = e.target.value;
  if (fieldRole === "sig-date") sig.date = e.target.value;
  scheduleAutosave();
});

// ---------- Attachments ----------

document.getElementById("attachmentInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    addAttachment(file.name, file.size, dataUrl);
  }
  renderAttachments();
  scheduleAutosave();
  e.target.value = "";
});

document.getElementById("attachmentList").addEventListener("click", (e) => {
  if (e.target.getAttribute("data-role") !== "remove-attachment") return;
  const li = e.target.closest(".attachment-item[data-id]");
  if (!li) return;
  removeAttachment(li.dataset.id);
  renderAttachments();
  scheduleAutosave();
});

// ---------- Boot ----------

(function boot() {
  const draft = loadDraftFromLocalStorage();
  if (draft) {
    state = Object.assign(createEmptyState(), draft);
  }
  renderAll();
})();
