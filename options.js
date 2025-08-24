function load() {
  chrome.storage.sync.get(
    { webhookUrl: "", sendAsFile: false, addPageInfo: true },
    v => {
      document.getElementById("webhookUrl").value = v.webhookUrl || "";
      document.getElementById("sendAsFile").checked = !!v.sendAsFile;
      document.getElementById("addPageInfo").checked = !!v.addPageInfo;
    }
  );
}
function save() {
  const webhookUrl = document.getElementById("webhookUrl").value.trim();
  const sendAsFile = document.getElementById("sendAsFile").checked;
  const addPageInfo = document.getElementById("addPageInfo").checked;
  chrome.storage.sync.set({ webhookUrl, sendAsFile, addPageInfo }, () => {
    const s = document.getElementById("status");
    s.textContent = "Đã lưu";
    setTimeout(() => (s.textContent = ""), 1500);
  });
}
document.getElementById("save").addEventListener("click", save);
document.addEventListener("DOMContentLoaded", load);
