// ==UserScript==
// @name         Coolmic Ripper
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Downloads high-quality images from coolmic.me with a movable all-in-one button.
// @author       ozler365
// @license      MIT
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAb1BMVEVQTP9NSf9IRP9GQf9DPv9PS/89OP9nZP+fnf+9vP/Kyf9KRv9BPP+jof/w7/////98ev/39/+op/+Bfv9yb/+3tf/d3P9XU/83Mf+jov/X1v+xsP/i4f+Oi//q6f9UUP94df+Egv+Xlf9gXf/Ozf883V2DAAAA6ElEQVR4AY2SBZbFIAxFm0BTIfV+d9n/Gufx3eDMO4JciCf/FLGx1jB9k5Qly4uyLPJMOH1nTqu6uamu1L0ybbvGq6uxYmn1yaRvoHIwAo0T7Ht5/PNsOlN38UXWlKC3v24AK+b0DG6+aJrBXbYKP8u53xlR8cHYEX7V2+EKH4nAdIVn60F100AVA8oWRq1n2Hj1+WXZCvzvsNnDllk179pR4g5YLexL9wEPLuEjVoFVbj505DiMmo0GFE0lUoRA+fa38gULz+GWNTkHmw3fEhiTi070e8CkPSMKExhNp9QvODjUKYNF9Qeipxuq30BSZwAAAABJRU5ErkJggg==
// @match        *://*.coolmic.me/episodes/*
// @match        https://coolmic.me/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/594978/Coolmic%20Ripper.user.js
// @updateURL https://update.greasyfork.org/scripts/594978/Coolmic%20Ripper.meta.js
// ==/UserScript==

(function() {
    'use strict';

    let currentImages = [];
    let downloadedCount = 0;
    let currentChapterId = window.location.pathname.split('/').pop();

    // --- UI SETUP (Original Desktop Layout) ---
    const dragContainer = document.createElement('div');
    dragContainer.style.cssText = `
        position: fixed;
        bottom: 50px;
        right: 50px;
        background: rgba(0, 0, 0, 0.4);
        padding: 20px;
        border-radius: 15px;
        z-index: 999999;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        transition: background 0.3s;
    `;

    const downloadBtn = document.createElement('button');
    downloadBtn.style.cssText = `
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        cursor: pointer;
        font-weight: bold;
        font-family: sans-serif;
        font-size: 14px;
        transition: background 0.3s;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    downloadBtn.innerText = 'Waiting for images...';
    
    dragContainer.appendChild(downloadBtn);
    document.body.appendChild(dragContainer);

    // --- DRAG LOGIC ---
    let isDragging = false, startX, startY, initialX, initialY;

    dragContainer.addEventListener('mousedown', (e) => {
        if (e.target === downloadBtn) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = dragContainer.offsetLeft;
        initialY = dragContainer.offsetTop;
        dragContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragContainer.style.left = `${initialX + dx}px`;
        dragContainer.style.top = `${initialY + dy}px`;
        dragContainer.style.bottom = 'auto';
        dragContainer.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        dragContainer.style.cursor = 'grab';
    });

    // --- STATE MANAGEMENT ---
    function updateState(state, total = 0) {
        if (state === 'waiting') {
            downloadBtn.innerText = 'Waiting for images...';
            downloadBtn.style.background = '#6c757d'; 
        } else if (state === 'ready') {
            downloadBtn.innerText = `Download (${total} found)`;
            downloadBtn.style.background = '#007bff'; 
        } else if (state === 'downloading') {
            downloadBtn.innerText = `Downloading: ${downloadedCount} / ${total}`;
            downloadBtn.style.background = '#f0ad4e'; 
        } else if (state === 'done') {
            downloadBtn.innerText = `Done! (${total})`;
            downloadBtn.style.background = '#28a745'; 
        }
    }

    // --- DOWNLOAD LOGIC ---
    function fetchAndSaveImage(targetUrl, fallbackUrl, fileName, isFallback = false) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: targetUrl,
            responseType: 'blob',
            anonymous: true, 
            headers: {
                "Referer": window.location.origin + "/",
                "Origin": window.location.origin,
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
            },
            onload: function(response) {
                if (response.status === 200) {
                    const blobUrl = URL.createObjectURL(response.response);
                    GM_download({
                        url: blobUrl,
                        name: fileName,
                        saveAs: false,
                        onload: () => {
                            URL.revokeObjectURL(blobUrl);
                            handleDownloadProgress();
                        },
                        onerror: (err) => {
                            console.error('File save failed:', err);
                            URL.revokeObjectURL(blobUrl);
                            handleDownloadProgress();
                        }
                    });
                } else if ((response.status === 403 || response.status === 404) && !isFallback) {
                    fetchAndSaveImage(fallbackUrl, fallbackUrl, fileName, true);
                } else {
                    console.error('Download failed entirely. Status:', response.status);
                    handleDownloadProgress();
                }
            },
            onerror: function(err) {
                if (!isFallback) {
                    fetchAndSaveImage(fallbackUrl, fallbackUrl, fileName, true);
                } else {
                    console.error('Failed to fetch image data:', err);
                    handleDownloadProgress();
                }
            }
        });
    }

    downloadBtn.addEventListener('click', () => {
        if (currentImages.length === 0) return;
        downloadedCount = 0;
        updateState('downloading', currentImages.length);

        const folderName = document.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();

        currentImages.forEach((imgItem, index) => {
            let originalUrl = null;
            
            // Dynamically handle different JSON structures to prevent TypeErrors
            if (typeof imgItem === 'string') {
                originalUrl = imgItem;
            } else if (typeof imgItem === 'object' && imgItem !== null) {
                // 1. Check common keys first
                originalUrl = imgItem.url || imgItem.src || imgItem.image_url || imgItem.file_url || imgItem.link;
                
                // 2. Fallback: scan the object for any valid http link
                if (!originalUrl) {
                    for (const key in imgItem) {
                        if (typeof imgItem[key] === 'string' && imgItem[key].startsWith('http')) {
                            originalUrl = imgItem[key];
                            break;
                        }
                    }
                }
            }

            // If a valid string URL still wasn't found, skip it so the queue doesn't crash
            if (typeof originalUrl !== 'string') {
                console.error('Could not extract valid string URL from:', imgItem);
                handleDownloadProgress(); 
                return; 
            }

            const rawUrl = originalUrl.split('?')[0]; 
            
            let ext = rawUrl.split('.').pop();
            if(!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase())) ext = 'jpg';

            const fileName = `${folderName}/page_${String(index + 1).padStart(3, '0')}.${ext}`;
            fetchAndSaveImage(rawUrl, originalUrl, fileName, false);
        });
    });

    function handleDownloadProgress() {
        downloadedCount++;
        updateState('downloading', currentImages.length);
        if (downloadedCount >= currentImages.length) {
            updateState('done', currentImages.length);
        }
    }

    // --- NETWORK INTERCEPTION ---
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'COOLMIC_IMAGES_EXTRACTED') {
            currentImages = event.data.images;
            updateState('ready', currentImages.length);
        }
    });

    const script = document.createElement('script');
    script.textContent = `
        (function() {
            function scanForImageData(obj) {
                if (!obj || typeof obj !== 'object') return null;
                
                if (obj.image_data && Array.isArray(obj.image_data) && obj.image_data.length > 0) {
                    return obj.image_data;
                }
                
                for (let key in obj) {
                    let result = scanForImageData(obj[key]);
                    if (result) return result;
                }
                return null;
            }

            function extractImages(payload) {
                try {
                    const images = scanForImageData(payload);
                    if (images) {
                        window.postMessage({ type: 'COOLMIC_IMAGES_EXTRACTED', images: images }, '*');
                    }
                } catch(e) {}
            }

            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function() {
                this._url = arguments[1];
                return originalOpen.apply(this, arguments);
            };
            
            XMLHttpRequest.prototype.send = function() {
                this.addEventListener('load', function() {
                    try {
                        if (this.responseType === '' || this.responseType === 'text') {
                            const data = JSON.parse(this.responseText);
                            extractImages(data);
                        }
                    } catch (e) {}
                });
                return originalSend.apply(this, arguments);
            };

            const originalFetch = window.fetch;
            window.fetch = async function() {
                const response = await originalFetch.apply(this, arguments);
                try {
                    const clone = response.clone();
                    clone.json().then(data => extractImages(data)).catch(()=>{});
                } catch(e) {}
                return response;
            };
        })();
    `;
    document.documentElement.appendChild(script);

    // --- URL CHANGE DETECTION ---
    setInterval(() => {
        const urlParts = window.location.pathname.split('/');
        const newChapterId = urlParts[urlParts.indexOf('episodes') + 1] || urlParts.pop();
        
        if (newChapterId && newChapterId !== currentChapterId) {
            currentChapterId = newChapterId;
            currentImages = [];
            downloadedCount = 0;
            updateState('waiting');
        }
    }, 1000);

})();