// Central application state + helpers for creating/serializing it.
// No framework, no build step: this file just owns the data shape.

const STORAGE_KEY = "buildingAcceptanceDraft_v1";

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

function createEmptyState() {
  return {
    version: 1,
    mode: "admin",
    meta: {
      docNo: "",
      docDate: "",
      logo: null, // dataURL
    },
    jobInfo: {
      jobName: "",
      contractNo: "",
      contractorName: "",
      contractorContact: "",
      location: "",
      supervisor: "",
      contractPeriod: "",
      periodRound: "",
      scope: "",
    },
    checklist: [],
    photos: {
      before: [],
      after: [],
    },
    conclusion: {
      value: "",
      note: "",
    },
    signatures: {
      inspector: { role: "ผู้ตรวจงาน", name: "", position: "", date: "", image: null },
      engineer: { role: "วิศวกรผู้ตรวจสอบ", name: "", position: "", date: "", image: null },
      approver: { role: "ผู้อนุมัติ", name: "", position: "", date: "", image: null },
    },
    attachments: [],
  };
}

let state = createEmptyState();

function addChecklistRow() {
  state.checklist.push({ id: uid("row"), item: "", result: "", remark: "" });
}

function removeChecklistRow(id) {
  state.checklist = state.checklist.filter((r) => r.id !== id);
}

function addPhoto(group, dataUrl, caption) {
  state.photos[group].push({ id: uid("photo"), dataUrl, caption: caption || "" });
}

function removePhoto(group, id) {
  state.photos[group] = state.photos[group].filter((p) => p.id !== id);
}

function addAttachment(name, size, dataUrl) {
  state.attachments.push({ id: uid("att"), name, size, dataUrl });
}

function removeAttachment(id) {
  state.attachments = state.attachments.filter((a) => a.id !== id);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveDraftToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage full or unavailable — silently skip, this is only a convenience net
  }
}

function loadDraftFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function serializeStateToJsonBlob() {
  return new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
}
