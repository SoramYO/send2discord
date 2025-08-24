let pickerActive = false;
let hoverEl = null;
let hoverBox = null;
let mask = null;
let tip = null;

function qRect(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)), h: Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) };
}

function ensureUI() {
  if (!mask) {
    mask = document.createElement("div");
    mask.style.position = "fixed";
    mask.style.left = "0";
    mask.style.top = "0";
    mask.style.right = "0";
    mask.style.bottom = "0";
    mask.style.zIndex = "2147483646";
    mask.style.cursor = "crosshair";
    mask.style.background = "rgba(0,0,0,0.02)";
    document.documentElement.appendChild(mask);
  }
  if (!hoverBox) {
    hoverBox = document.createElement("div");
    hoverBox.style.position = "fixed";
    hoverBox.style.border = "2px solid #4C8BF5";
    hoverBox.style.boxShadow = "0 0 0 9999px rgba(0,0,0,0.15)";
    hoverBox.style.pointerEvents = "none";
    hoverBox.style.zIndex = "2147483647";
    document.documentElement.appendChild(hoverBox);
  }
  if (!tip) {
    tip = document.createElement("div");
    tip.textContent = "Click để chọn ảnh/video • Esc để hủy";
    tip.style.position = "fixed";
    tip.style.left = "50%";
    tip.style.transform = "translateX(-50%)";
    tip.style.bottom = "16px";
    tip.style.padding = "8px 12px";
    tip.style.background = "rgba(0,0,0,0.8)";
    tip.style.color = "#fff";
    tip.style.font = "13px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial";
    tip.style.borderRadius = "8px";
    tip.style.zIndex = "2147483648";
    tip.style.pointerEvents = "none";
    document.documentElement.appendChild(tip);
  }
}

function clearUI() {
  if (hoverBox && hoverBox.parentNode) hoverBox.parentNode.removeChild(hoverBox);
  if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
  if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
  hoverBox = null;
  mask = null;
  tip = null;
}

function findMediaFromElement(element) {
  if (!element) {
    return null;
  }
  
  // Direct video element
  if (element.tagName === "VIDEO") {
    const videoSrc = element.currentSrc || element.src;
    if (videoSrc && videoSrc.startsWith('http')) {
      return { url: videoSrc, type: 'video' };
    }
  }
  
  // Direct img element
  if (element.tagName === "IMG") {
    const imgSrc = element.currentSrc || element.src;
    if (imgSrc && imgSrc.startsWith('http')) {
      return { url: imgSrc, type: 'image' };
    }
  }
  
  // Background image
  const cs = getComputedStyle(element);
  if (cs.backgroundImage && cs.backgroundImage !== "none") {
    const m = cs.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (m && m[1] && m[1].startsWith('http')) {
      return { url: m[1], type: 'image' };
    }
  }
  
  // Look for video within element
  const video = element.querySelector("video");
  if (video) {
    const videoSrc = video.currentSrc || video.src;
    if (videoSrc && videoSrc.startsWith('http')) {
      return { url: videoSrc, type: 'video' };
    }
  }
  
  // Look for img within element
  const img = element.querySelector("img");
  if (img) {
    const imgSrc = img.currentSrc || img.src;
    if (imgSrc && imgSrc.startsWith('http')) {
      return { url: imgSrc, type: 'image' };
    }
  }
  
  // Look for parent elements that might contain the media
  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    if (parent.tagName === 'VIDEO') {
      const videoSrc = parent.currentSrc || parent.src;
      if (videoSrc && videoSrc.startsWith('http')) {
        return { url: videoSrc, type: 'video' };
      }
    }
    
    if (parent.tagName === 'IMG') {
      const imgSrc = parent.currentSrc || parent.src;
      if (imgSrc && imgSrc.startsWith('http')) {
        return { url: imgSrc, type: 'image' };
      }
    }
    
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.backgroundImage && parentStyle.backgroundImage !== 'none') {
      const match = parentStyle.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1] && match[1].startsWith('http')) {
        return { url: match[1], type: 'image' };
      }
    }
    
    parent = parent.parentElement;
    depth++;
  }
  
  // Look for elements with media in children
  const elementsWithMedia = element.querySelectorAll('*');
  for (const el of elementsWithMedia) {
    if (el.tagName === 'VIDEO') {
      const videoSrc = el.currentSrc || el.src;
      if (videoSrc && videoSrc.startsWith('http')) {
        return { url: videoSrc, type: 'video' };
      }
    }
    
    if (el.tagName === 'IMG') {
      const imgSrc = el.currentSrc || el.src;
      if (imgSrc && imgSrc.startsWith('http')) {
        return { url: imgSrc, type: 'image' };
      }
    }
    
    const style = getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      const match = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1] && match[1].startsWith('http')) {
        return { url: match[1], type: 'image' };
      }
    }
  }
  
  return null;
}

function elementAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el || document.body;
}

function updateHover(x, y) {
  const el = elementAtPoint(x, y);
  hoverEl = el;
  const rectEl = el.getBoundingClientRect();
  hoverBox.style.left = rectEl.left + "px";
  hoverBox.style.top = rectEl.top + "px";
  hoverBox.style.width = rectEl.width + "px";
  hoverBox.style.height = rectEl.height + "px";
}

function startPicker() {
  if (pickerActive) return;
  pickerActive = true;
  ensureUI();
  const onMove = (e) => updateHover(e.clientX, e.clientY);
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    pickConfirm();
  };
  const onKey = (e) => {
    if (e.key === "Escape") stopPicker(true);
  };
  mask.addEventListener("mousemove", onMove, true);
  mask.addEventListener("mousedown", onClick, true);
  document.addEventListener("keydown", onKey, true);
  mask._onMove = onMove;
  mask._onClick = onClick;
  document._onKeyPick = onKey;
  updateHover(innerWidth / 2, innerHeight / 2);
}

function stopPicker(cancelled) {
  if (!pickerActive) return;
  pickerActive = false;
  if (mask?._onMove) mask.removeEventListener("mousemove", mask._onMove, true);
  if (mask?._onClick) mask.removeEventListener("mousedown", mask._onClick, true);
  if (document._onKeyPick) document.removeEventListener("keydown", document._onKeyPick, true);
  clearUI();
  if (cancelled) {
    chrome.runtime.sendMessage({ action: "pickerResult", payload: { imageUrl: null, postUrl: location.href, pageTitle: document.title || "" } });
  }
}

function pickConfirm() {


  // Tìm container hợp lý (là chính element hoặc cha gần nhất có nhiều media)
  let container = hoverEl;
  
  for (let i = 0; i < 5 && container; i++) {
    const imgs = container.querySelectorAll("img");
    const videos = container.querySelectorAll("video");
    if (imgs.length + videos.length > 1) {
      break;
    }
    container = container.parentElement;
  }

  let allMedia = [];
  if (container) {
    // Get all images
    const imgs = container.querySelectorAll("img");
    const imageData = Array.from(imgs)
      .map((img, index) => {
        const src = img.currentSrc || img.src;
        return {
          url: src,
          element: img,
          index: index,
          width: img.width,
          height: img.height,
          type: 'image'
        };
      })
      .filter(mediaData => {
        const isValid = mediaData.url && mediaData.url.startsWith("http");
        if (!isValid) console.log('Filtered out invalid image src:', mediaData.url);
        return isValid;
      });
    
    // Get all videos
    const videos = container.querySelectorAll("video");
    const videoData = Array.from(videos)
      .map((video, index) => {
        const src = video.currentSrc || video.src;
        return {
          url: src,
          element: video,
          index: imageData.length + index, // Continue indexing after images
          width: video.videoWidth || video.clientWidth,
          height: video.videoHeight || video.clientHeight,
          type: 'video'
        };
      })
      .filter(mediaData => {
        const isValid = mediaData.url && mediaData.url.startsWith("http");
        if (!isValid) console.log('Filtered out invalid video src:', mediaData.url);
        return isValid;
      });
    
    allMedia = [...imageData, ...videoData];
  }

  // Nếu không có list thì fallback như cũ
  if (allMedia.length === 0) {
    const single = findMediaFromElement(hoverEl);
    if (single) {
      allMedia = [{
        url: single.url,
        element: hoverEl,
        index: 0,
        width: 0,
        height: 0,
        type: single.type
      }];
    }
  }


  // Stop picker and show selection UI
  stopPicker(false);

  // If only one media item, send it directly
  if (allMedia.length === 1) {
    sendSelectedMedia([allMedia[0]]);
    return;
  }

  // If multiple media items, show selection UI
  if (allMedia.length > 1) {
    showMediaSelector(allMedia);
    return;
  }

  // No media found
  chrome.runtime.sendMessage({ 
    action: "pickerResult", 
    payload: { 
      mediaUrls: [], 
      postUrl: location.href, 
      pageTitle: document.title || "" 
    } 
  });
}


function showMediaSelector(mediaItems) {
  
  let currentPage = 0;
  const itemsPerPage = 12;
  const totalPages = Math.ceil(mediaItems.length / itemsPerPage);
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.color = 'white';
  overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
  
  // Create container
  const container = document.createElement('div');
  container.style.maxWidth = '90%';
  container.style.maxHeight = '90%';
  container.style.overflow = 'auto';
  container.style.padding = '20px';
  container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  container.style.borderRadius = '10px';
  
  const selectedItems = new Set();
  
  function updateDisplay() {
    // Clear container
    container.innerHTML = '';
    
    // Count different media types
    const imageCount = mediaItems.filter(item => item.type === 'image').length;
    const videoCount = mediaItems.filter(item => item.type === 'video').length;
    
    // Title with pagination info
    const title = document.createElement('h2');
    let titleText = 'Chọn media để gửi';
    if (imageCount > 0 && videoCount > 0) {
      titleText += ` (${imageCount} ảnh, ${videoCount} video)`;
    } else if (imageCount > 0) {
      titleText += ` (${imageCount} ảnh)`;
    } else if (videoCount > 0) {
      titleText += ` (${videoCount} video)`;
    }
    
    if (totalPages > 1) {
      title.textContent = `${titleText} - Trang ${currentPage + 1}/${totalPages}`;
    } else {
      title.textContent = titleText;
    }
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    container.appendChild(title);
    
    // Pagination controls (top)
    if (totalPages > 1) {
      const topPaginationContainer = createPaginationControls();
      container.appendChild(topPaginationContainer);
    }
    
    // Get current page items
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, mediaItems.length);
    const displayItems = mediaItems.slice(startIndex, endIndex);
    
    // Media grid - 4x3 layout (4 items per row, max 3 rows)
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gridTemplateRows = 'repeat(3, 200px)';
    grid.style.gap = '10px';
    grid.style.marginBottom = '20px';
    grid.style.maxWidth = '800px';
    grid.style.width = '100%';
    
    displayItems.forEach((mediaData, displayIndex) => {
      const actualIndex = startIndex + displayIndex;
      const mediaContainer = document.createElement('div');
      mediaContainer.style.position = 'relative';
      mediaContainer.style.border = '3px solid transparent';
      mediaContainer.style.borderRadius = '8px';
      mediaContainer.style.overflow = 'hidden';
      mediaContainer.style.cursor = 'pointer';
      mediaContainer.style.transition = 'all 0.2s';
      mediaContainer.style.backgroundColor = '#f0f0f0';
      mediaContainer.style.display = 'flex';
      mediaContainer.style.alignItems = 'center';
      mediaContainer.style.justifyContent = 'center';
      
      // Create appropriate media element
      let mediaElement;
      if (mediaData.type === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = mediaData.url;
        mediaElement.muted = true;
        mediaElement.loop = true;
        mediaElement.preload = 'metadata';
        
        // Add play button overlay for videos
        const playButton = document.createElement('div');
        playButton.innerHTML = '▶';
        playButton.style.position = 'absolute';
        playButton.style.top = '50%';
        playButton.style.left = '50%';
        playButton.style.transform = 'translate(-50%, -50%)';
        playButton.style.fontSize = '40px';
        playButton.style.color = 'white';
        playButton.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        playButton.style.pointerEvents = 'none';
        mediaContainer.appendChild(playButton);
      } else {
        mediaElement = document.createElement('img');
        mediaElement.src = mediaData.url;
      }
      
      mediaElement.style.width = '100%';
      mediaElement.style.height = '100%';
      mediaElement.style.objectFit = 'cover';
      mediaElement.style.display = 'block';
      
      // Loading placeholder
      mediaElement.addEventListener('error', () => {
        mediaElement.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.textContent = `Lỗi tải ${mediaData.type === 'video' ? 'video' : 'ảnh'}`;
        placeholder.style.color = '#666';
        placeholder.style.fontSize = '12px';
        placeholder.style.textAlign = 'center';
        mediaContainer.appendChild(placeholder);
      });
      
      const checkbox = document.createElement('div');
      checkbox.style.position = 'absolute';
      checkbox.style.top = '8px';
      checkbox.style.right = '8px';
      checkbox.style.width = '24px';
      checkbox.style.height = '24px';
      checkbox.style.borderRadius = '50%';
      checkbox.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      checkbox.style.border = '2px solid white';
      checkbox.style.display = 'flex';
      checkbox.style.alignItems = 'center';
      checkbox.style.justifyContent = 'center';
      checkbox.style.fontSize = '14px';
      checkbox.style.color = 'white';
      checkbox.style.fontWeight = 'bold';
      
      // Media type indicator
      const typeIndicator = document.createElement('div');
      typeIndicator.style.position = 'absolute';
      typeIndicator.style.bottom = '8px';
      typeIndicator.style.right = '8px';
      typeIndicator.style.padding = '2px 6px';
      typeIndicator.style.borderRadius = '4px';
      typeIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      typeIndicator.style.color = 'white';
      typeIndicator.style.fontSize = '10px';
      typeIndicator.style.fontWeight = 'bold';
      typeIndicator.textContent = mediaData.type === 'video' ? 'VIDEO' : 'IMG';
      
      // Item number indicator (global index)
      const numberIndicator = document.createElement('div');
      numberIndicator.style.position = 'absolute';
      numberIndicator.style.top = '8px';
      numberIndicator.style.left = '8px';
      numberIndicator.style.width = '20px';
      numberIndicator.style.height = '20px';
      numberIndicator.style.borderRadius = '50%';
      numberIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      numberIndicator.style.color = 'white';
      numberIndicator.style.fontSize = '12px';
      numberIndicator.style.display = 'flex';
      numberIndicator.style.alignItems = 'center';
      numberIndicator.style.justifyContent = 'center';
      numberIndicator.textContent = actualIndex + 1;
      
      const updateSelection = () => {
        if (selectedItems.has(actualIndex)) {
          mediaContainer.style.border = '3px solid #4CAF50';
          mediaContainer.style.transform = 'scale(0.95)';
          checkbox.style.backgroundColor = '#4CAF50';
          checkbox.textContent = '✓';
        } else {
          mediaContainer.style.border = '3px solid transparent';
          mediaContainer.style.transform = 'scale(1)';
          checkbox.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          checkbox.textContent = '';
        }
      };
      
      mediaContainer.addEventListener('click', () => {
        if (selectedItems.has(actualIndex)) {
          selectedItems.delete(actualIndex);
        } else {
          selectedItems.add(actualIndex);
        }
        updateSelection();
        updateButtons();
      });
      
      // Hover effect with video preview
      mediaContainer.addEventListener('mouseenter', () => {
        if (!selectedItems.has(actualIndex)) {
          mediaContainer.style.border = '3px solid #2196F3';
        }
        // Start video preview on hover
        if (mediaData.type === 'video' && mediaElement.tagName === 'VIDEO') {
          mediaElement.currentTime = 0;
          mediaElement.play().catch(() => {});
        }
      });
      
      mediaContainer.addEventListener('mouseleave', () => {
        if (!selectedItems.has(actualIndex)) {
          mediaContainer.style.border = '3px solid transparent';
        }
        // Pause video preview on leave
        if (mediaData.type === 'video' && mediaElement.tagName === 'VIDEO') {
          mediaElement.pause();
        }
      });
      
      mediaContainer.appendChild(mediaElement);
      mediaContainer.appendChild(checkbox);
      mediaContainer.appendChild(typeIndicator);
      mediaContainer.appendChild(numberIndicator);
      grid.appendChild(mediaContainer);
      
      updateSelection();
    });
    
    container.appendChild(grid);
    
    // Pagination controls (bottom)
    if (totalPages > 1) {
      const bottomPaginationContainer = createPaginationControls();
      container.appendChild(bottomPaginationContainer);
    }
    
    // Action buttons
    createActionButtons();
  }
  
  function createPaginationControls() {
    const paginationContainer = document.createElement('div');
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'center';
    paginationContainer.style.alignItems = 'center';
    paginationContainer.style.gap = '10px';
    paginationContainer.style.marginBottom = '15px';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀ Trang trước';
    prevBtn.style.padding = '8px 16px';
    prevBtn.style.border = 'none';
    prevBtn.style.borderRadius = '5px';
    prevBtn.style.backgroundColor = currentPage > 0 ? '#2196F3' : '#666';
    prevBtn.style.color = 'white';
    prevBtn.style.cursor = currentPage > 0 ? 'pointer' : 'not-allowed';
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        updateDisplay();
      }
    });
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `${currentPage + 1} / ${totalPages}`;
    pageInfo.style.padding = '0 15px';
    pageInfo.style.fontSize = '16px';
    pageInfo.style.fontWeight = 'bold';
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Trang tiếp theo ▶';
    nextBtn.style.padding = '8px 16px';
    nextBtn.style.border = 'none';
    nextBtn.style.borderRadius = '5px';
    nextBtn.style.backgroundColor = currentPage < totalPages - 1 ? '#2196F3' : '#666';
    nextBtn.style.color = 'white';
    nextBtn.style.cursor = currentPage < totalPages - 1 ? 'pointer' : 'not-allowed';
    nextBtn.disabled = currentPage === totalPages - 1;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        currentPage++;
        updateDisplay();
      }
    });
    
    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);
    
    return paginationContainer;
  }
  
  function createActionButtons() {
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'center';
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Chọn tất cả trang này';
    selectAllBtn.style.padding = '10px 20px';
    selectAllBtn.style.border = 'none';
    selectAllBtn.style.borderRadius = '5px';
    selectAllBtn.style.backgroundColor = '#2196F3';
    selectAllBtn.style.color = 'white';
    selectAllBtn.style.cursor = 'pointer';
    selectAllBtn.addEventListener('click', () => {
      const startIndex = currentPage * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, mediaItems.length);
      for (let i = startIndex; i < endIndex; i++) {
        selectedItems.add(i);
      }
      updateDisplay();
    });
    
    const selectAllPagesBtn = document.createElement('button');
    selectAllPagesBtn.textContent = 'Chọn tất cả media';
    selectAllPagesBtn.style.padding = '10px 20px';
    selectAllPagesBtn.style.border = 'none';
    selectAllPagesBtn.style.borderRadius = '5px';
    selectAllPagesBtn.style.backgroundColor = '#FF9800';
    selectAllPagesBtn.style.color = 'white';
    selectAllPagesBtn.style.cursor = 'pointer';
    selectAllPagesBtn.addEventListener('click', () => {
      for (let i = 0; i < mediaItems.length; i++) {
        selectedItems.add(i);
      }
      updateDisplay();
    });
    
    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Gửi media đã chọn';
    sendBtn.style.padding = '10px 20px';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '5px';
    sendBtn.style.backgroundColor = '#4CAF50';
    sendBtn.style.color = 'white';
    sendBtn.style.cursor = 'pointer';
    sendBtn.disabled = true;
    sendBtn.addEventListener('click', () => {
      const selectedMediaItems = Array.from(selectedItems).map(index => mediaItems[index]);
      document.body.removeChild(overlay);
      sendSelectedMedia(selectedMediaItems);
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Hủy';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '5px';
    cancelBtn.style.backgroundColor = '#f44336';
    cancelBtn.style.color = 'white';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      chrome.runtime.sendMessage({ 
        action: "pickerResult", 
        payload: { 
          mediaUrls: [], 
          postUrl: location.href, 
          pageTitle: document.title || "" 
        } 
      });
    });
    
    const updateButtons = () => {
      sendBtn.disabled = selectedItems.size === 0;
      sendBtn.style.opacity = selectedItems.size === 0 ? '0.5' : '1';
      sendBtn.textContent = `Gửi ${selectedItems.size} media`;
    };
    
    // Make updateButtons accessible globally for this instance
    window.updateButtons = updateButtons;
    
    if (totalPages > 1) {
      buttonContainer.appendChild(selectAllBtn);
      buttonContainer.appendChild(selectAllPagesBtn);
    } else {
      selectAllBtn.textContent = 'Chọn tất cả';
      buttonContainer.appendChild(selectAllBtn);
    }
    
    buttonContainer.appendChild(sendBtn);
    buttonContainer.appendChild(cancelBtn);
    container.appendChild(buttonContainer);
    
    updateButtons();
  }
  
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  
  // Initialize display
  updateDisplay();
  
  // Close on ESC
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', handleKeydown);
      chrome.runtime.sendMessage({ 
        action: "pickerResult", 
        payload: { 
          mediaUrls: [], 
          postUrl: location.href, 
          pageTitle: document.title || "" 
        } 
      });
    } else if (e.key === 'ArrowLeft' && currentPage > 0) {
      currentPage--;
      updateDisplay();
    } else if (e.key === 'ArrowRight' && currentPage < totalPages - 1) {
      currentPage++;
      updateDisplay();
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

function sendSelectedMedia(selectedMediaItems) {
  
  // Gather detailed element information
  const style = getComputedStyle(hoverEl);
  const elementInfo = {
    tagName: hoverEl.tagName,
    className: hoverEl.className,
    id: hoverEl.id,
    innerHTML: hoverEl.innerHTML ? hoverEl.innerHTML.substring(0, 200) + '...' : 'No innerHTML',
    position: hoverEl.getBoundingClientRect(),
    computedStyle: {
      display: style.display,
      position: style.position,
      backgroundImage: style.backgroundImage,
      width: style.width,
      height: style.height
    }
  };

  const payload = {
    mediaUrls: selectedMediaItems.map(item => ({
      url: item.url,
      type: item.type
    })),
    postUrl: location.href,
    pageTitle: document.title || "",
    elementInfo: elementInfo
  };

  chrome.runtime.sendMessage({ action: "pickerResult", payload });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startPicker") {
    try {
      startPicker();
      sendResponse({ ok: true });
    } catch (error) {
      console.error('Error starting picker:', error);
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  }
});

