chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-image-to-discord",
    title: "Gửi ảnh này lên Discord",
    contexts: ["image"]
  });
  
  chrome.contextMenus.create({
    id: "send-video-to-discord",
    title: "Gửi video này lên Discord",
    contexts: ["video"]
  });
});

function getSettings() {
  return new Promise(r => chrome.storage.sync.get({ webhookUrl: "", sendAsFile: true, addPageInfo: true }, r));
}

async function fetchBlob(url) {
  const res = await fetch(url, { referrerPolicy: "no-referrer", credentials: "omit" });
  if (!res.ok) throw new Error("fetch");
  return await res.blob();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const s = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, s);
  const b64 = dataUrl.slice(s + 1);
  const mime = meta.split(":")[1].split(";")[0];
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function postEmbed(webhookUrl, mediaUrl, pageUrl = "", pageTitle = "", addPageInfo = true, mediaType = "image") {
  let content = "";
  if (addPageInfo && pageUrl) {
    content = pageTitle ? `Nguồn: [${pageTitle}](${pageUrl})` : `Nguồn: ${pageUrl}`;
  }
  
  let payload;
  if (mediaType === "video") {
    // For videos, Discord doesn't support video embeds, so we'll send as attachment URL
    payload = { content: content ? `${content}\n${mediaUrl}` : mediaUrl };
  } else {
    // For images, use embed
    payload = { content: content || undefined, embeds: [{ image: { url: mediaUrl } }] };
  }
  
  await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

async function postFile(webhookUrl, blob, filename, pageUrl = "", pageTitle = "", addPageInfo = true, mediaType = "image") {
  const form = new FormData();
  const defaultName = mediaType === "video" ? "video" : "image";
  form.append("file", blob, filename || defaultName);
  let content = "";
  if (addPageInfo && pageUrl) {
    content = pageTitle ? `Nguồn: [${pageTitle}](${pageUrl})` : `Nguồn: ${pageUrl}`;
  }
  form.append("payload_json", JSON.stringify({ content }));
  await fetch(webhookUrl, { method: "POST", body: form });
}

function filenameFromUrl(u, mediaType = "image") {
  try {
    const url = new URL(u);
    const p = url.pathname.split("/").filter(Boolean).pop() || (mediaType === "video" ? "video" : "image");
    return p.split("?")[0].split("#")[0];
  } catch { 
    return mediaType === "video" ? "video" : "image"; 
  }
}

async function sendByDataUrl(webhookUrl, mediaUrl, pageUrl = "", pageTitle = "", addPageInfo = true, mediaType = "image") {
  try {
    const blob = await fetchBlob(mediaUrl);
    const name = filenameFromUrl(mediaUrl, mediaType);
    await postFile(webhookUrl, blob, name, pageUrl, pageTitle, addPageInfo, mediaType);
  } catch (error) {
    console.error('sendByDataUrl error:', error);
    throw error;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-image-to-discord" && info.menuItemId !== "send-video-to-discord") return;
  const { webhookUrl, sendAsFile, addPageInfo } = await getSettings();
  if (!webhookUrl) { 
    chrome.runtime.openOptionsPage(); 
    return; 
  }
  const mediaUrl = info.srcUrl;
  const pageUrl = info.pageUrl || tab?.url || "";
  const pageTitle = tab?.title || "";
  const mediaType = info.menuItemId === "send-video-to-discord" ? "video" : "image";
  try {
    if (sendAsFile) await sendByDataUrl(webhookUrl, mediaUrl, pageUrl, pageTitle, addPageInfo, mediaType);
    else await postEmbed(webhookUrl, mediaUrl, pageUrl, pageTitle, addPageInfo, mediaType);
  } catch {
    // Silent failure - no notifications
  }
});

async function startPicker(tabId) {
  // Explicit check to ensure we're in background script context
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new Error("startPicker called in wrong context - should be background script only");
  }
  
  try {
    await chrome.tabs.sendMessage(tabId, { action: "startPicker" });
  } catch (error) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await new Promise(r => setTimeout(r, 200)); // Increased delay
      await chrome.tabs.sendMessage(tabId, { action: "startPicker" });
    } catch (injectError) {
      console.error('Content script injection failed:', injectError);
      throw new Error("Could not inject or communicate with content script");
    }
  }

  return await new Promise((resolve, reject) => {
    const t = setTimeout(() => { 
      cleanup(); 
      reject(new Error("timeout")); 
    }, 30000);
    
    function onMsg(msg, sender) {
      try {
        if (sender.tab?.id !== tabId) return;
        if (msg.action === "pickerResult") { 
          clearTimeout(t); 
          cleanup(); 
          resolve(msg.payload); 
        }
      } catch (error) {
        console.error('Message handler error:', error);
        clearTimeout(t);
        cleanup();
        reject(error);
      }
    }
    
    function cleanup() {
      try {
        chrome.runtime.onMessage.removeListener(onMsg); 
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    chrome.runtime.onMessage.addListener(onMsg);
  });
}

async function handlePickAndSend(tab) {
  const settings = await getSettings();
  if (!settings.webhookUrl) { 
    chrome.runtime.openOptionsPage(); 
    return; 
  }
  
  
  // Initialize variables early to prevent reference errors
  let pageUrl = tab.url || "";
  let pageTitle = tab.title || "";
  
  try {
    const res = await startPicker(tab.id);

    
    // Handle both mediaUrls (array with type info) and imageUrls (legacy array) for backward compatibility
    let mediaItems = [];
    if (res?.mediaUrls && Array.isArray(res.mediaUrls)) {
      mediaItems = res.mediaUrls;
    } else if (res?.imageUrls && Array.isArray(res.imageUrls)) {
      // Legacy format - convert to new format
      mediaItems = res.imageUrls.map(url => ({ url, type: 'image' }));
    } else if (res?.imageUrl) {
      // Single image legacy format
      mediaItems = [{ url: res.imageUrl, type: 'image' }];
    }
    
    if (mediaItems.length === 0) {
      return;
    }
    
    
    // Update pageUrl and pageTitle if available in response
    pageUrl = res.postUrl || pageUrl;
    pageTitle = res.pageTitle || pageTitle;
    
    // Send all media items
    for (let i = 0; i < mediaItems.length; i++) {
      const mediaItem = mediaItems[i];
      
      if (settings.sendAsFile) {
        await sendByDataUrl(settings.webhookUrl, mediaItem.url, pageUrl, pageTitle, settings.addPageInfo, mediaItem.type);
      } else {
        await postEmbed(settings.webhookUrl, mediaItem.url, pageUrl, pageTitle, settings.addPageInfo, mediaItem.type);
      }
    }
    
    // Success notification removed per user request
  } catch (error) {
    console.error('Picker error:', error);
    console.error('Error stack:', error.stack);
    let errorMessage = "Không thể bật chế độ chọn media.";
    
    if (error.message === "timeout") {
      errorMessage = "Hết thời gian chờ. Vui lòng thử lại.";
    } else if (error.message && error.message.includes("content script")) {
      errorMessage = "Không thể tải trang này. Hãy tải lại trang và thử lại.";
    } else if (error.message === "fetch") {
      errorMessage = "Không thể tải media. Media có thể bị chặn CORS.";
    } else if (error.name === "ReferenceError") {
      errorMessage = "Lỗi tham chiếu biến: " + error.message;
      console.error('Reference error details:', error);
    }
    
    // Error notification removed per user request
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await handlePickAndSend(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "send-current-to-discord") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await handlePickAndSend(tab);
});