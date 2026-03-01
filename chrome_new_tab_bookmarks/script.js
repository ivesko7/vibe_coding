document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    updateTime();
    setInterval(updateTime, 1000);

    loadTopSites();
    loadMobileBookmarks();
});

function updateTime() {
    const now = new Date();
    document.getElementById('time').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

let currentSortType = 'default';
let currentSortDirection = 'asc';
let currentBookmarksNode = null;
let currentParentNodes = [];
let contextMenuTarget = null; // currently right-clicked bookmark
let zenRipplesEnabled = true;

let rippleCount = 1;
let rippleSeconds = 6;
let rippleIntervalId = null;

function initSettings() {
    // Load saved columns or default to 7
    const savedColumns = localStorage.getItem('bookmarksColumns') || 7;
    document.documentElement.style.setProperty('--bookmarks-columns', savedColumns);
    document.getElementById('column-count').value = savedColumns;

    zenRipplesEnabled = localStorage.getItem('zenRipplesEnabled') !== 'false';
    const stoneToggle = document.getElementById('stone-toggle');
    if (stoneToggle) stoneToggle.checked = zenRipplesEnabled;

    rippleCount = parseInt(localStorage.getItem('zenRippleCount')) || 1;
    rippleSeconds = parseInt(localStorage.getItem('zenRippleSeconds')) || 6;

    const countInput = document.getElementById('ripple-count');
    const secondsInput = document.getElementById('ripple-seconds');
    if (countInput) countInput.value = rippleCount;
    if (secondsInput) secondsInput.value = rippleSeconds;

    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.getElementsByClassName('close-btn')[0];
    const renameCloseBtn = document.querySelector('.rename-close');
    const saveBtn = document.getElementById('save-settings');
    const renameModal = document.getElementById('rename-modal');
    const saveRenameBtn = document.getElementById('save-rename');

    btn.onclick = () => { modal.style.display = "flex"; };

    closeBtn.onclick = () => { modal.style.display = "none"; };
    renameCloseBtn.onclick = () => { renameModal.style.display = "none"; };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        if (event.target == renameModal) {
            renameModal.style.display = "none";
        }
    };

    saveBtn.onclick = () => {
        const columns = document.getElementById('column-count').value;
        if (columns >= 1 && columns <= 12) {
            localStorage.setItem('bookmarksColumns', columns);
            document.documentElement.style.setProperty('--bookmarks-columns', columns);
        }
        zenRipplesEnabled = document.getElementById('stone-toggle').checked;
        localStorage.setItem('zenRipplesEnabled', zenRipplesEnabled);

        rippleCount = parseInt(document.getElementById('ripple-count').value) || 1;
        rippleSeconds = parseInt(document.getElementById('ripple-seconds').value) || 6;
        localStorage.setItem('zenRippleCount', rippleCount);
        localStorage.setItem('zenRippleSeconds', rippleSeconds);

        updateRippleInterval();

        modal.style.display = "none";
    };

    // Sort Settings Initialization
    const sortTypeSelect = document.getElementById('sort-type');
    const sortDirBtn = document.getElementById('sort-direction-btn');
    const ascIcon = document.querySelector('.sort-icon.asc');
    const descIcon = document.querySelector('.sort-icon.desc');

    currentSortType = localStorage.getItem('bookmarkSortType') || 'default';
    currentSortDirection = localStorage.getItem('bookmarkSortDirection') || 'asc';

    sortTypeSelect.value = currentSortType;
    updateSortDirectionUI(ascIcon, descIcon, sortDirBtn, currentSortType);

    sortTypeSelect.addEventListener('change', (e) => {
        currentSortType = e.target.value;
        localStorage.setItem('bookmarkSortType', currentSortType);
        updateSortDirectionUI(ascIcon, descIcon, sortDirBtn, currentSortType);
        if (currentBookmarksNode) {
            renderBookmarks(currentBookmarksNode, document.getElementById('bookmarks-container'), currentParentNodes);
        }
    });

    sortDirBtn.addEventListener('click', () => {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        localStorage.setItem('bookmarkSortDirection', currentSortDirection);
        updateSortDirectionUI(ascIcon, descIcon, sortDirBtn, currentSortType);
        if (currentBookmarksNode) {
            renderBookmarks(currentBookmarksNode, document.getElementById('bookmarks-container'), currentParentNodes);
        }
    });

    initContextMenu();

    saveRenameBtn.onclick = () => {
        if (!contextMenuTarget) return;
        const newName = document.getElementById('rename-input').value;
        if (newName && newName.trim() !== '') {
            chrome.bookmarks.update(contextMenuTarget.id, { title: newName.trim() }, () => {
                renameModal.style.display = "none";
                loadMobileBookmarks(); // refresh
            });
        }
    };
}

function initContextMenu() {
    const menu = document.getElementById('context-menu');

    // Hide menu on click anywhere
    document.addEventListener('click', () => {
        menu.style.display = 'none';
    });

    // Handle menu actions
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!contextMenuTarget) return;
            const action = e.target.getAttribute('action');
            const url = contextMenuTarget.url;
            const id = contextMenuTarget.id;

            switch (action) {
                case 'open':
                    if (url) window.location.href = url;
                    break;
                case 'open-new':
                    if (url) chrome.tabs.create({ url: url, active: true });
                    break;
                case 'open-bg':
                    if (url) chrome.tabs.create({ url: url, active: false });
                    break;
                case 'rename':
                    const renameModal = document.getElementById('rename-modal');
                    const renameInput = document.getElementById('rename-input');
                    renameInput.value = contextMenuTarget.title;
                    renameModal.style.display = 'flex';
                    renameInput.focus();
                    break;
                case 'delete':
                    if (confirm(`Are you sure you want to delete '${contextMenuTarget.title}'?`)) {
                        chrome.bookmarks.removeTree(id, () => {
                            loadMobileBookmarks();
                        });
                    }
                    break;
                case 'manage':
                    chrome.tabs.create({ url: 'chrome://bookmarks/' });
                    break;
            }
            menu.style.display = 'none';
        });
    });
}

function updateSortDirectionUI(ascIcon, descIcon, sortDirBtn, sortType) {
    if (sortType === 'default') {
        sortDirBtn.style.display = 'none';
    } else {
        sortDirBtn.style.display = 'flex';
        if (currentSortDirection === 'asc') {
            ascIcon.style.display = 'block';
            descIcon.style.display = 'none';
        } else {
            ascIcon.style.display = 'none';
            descIcon.style.display = 'block';
        }
    }
}

// ==== ZEN RIPPLE EFFECT ====
const canvas = document.getElementById('water-canvas');
const ctx = canvas.getContext('2d');
let width, height;

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const ripples = [];

// Create a ripple on left click
document.addEventListener('click', (e) => {
    // Ignore clicks on the settings gear or within modals to avoid annoying the user
    if (!zenRipplesEnabled) return;
    if (e.target.closest('.modal') || e.target.closest('.settings-btn') || e.target.closest('.context-menu')) return;

    // Large, slow ripple on click
    createRipple(e.clientX, e.clientY, 150);
});

// Calculate and set up the automated ripple interval
function updateRippleInterval() {
    if (rippleIntervalId) {
        clearInterval(rippleIntervalId);
        rippleIntervalId = null;
    }

    if (zenRipplesEnabled && rippleCount > 0 && rippleSeconds > 0) {
        // e.g. 4 ripples every 4 seconds = 1 ripple per 1 second (1000ms)
        const intervalMs = (rippleSeconds / rippleCount) * 1000;
        rippleIntervalId = setInterval(() => {
            if (!zenRipplesEnabled || document.hidden) return;

            // Random position on the canvas
            const x = Math.random() * width * 0.8 + (width * 0.1);
            const y = Math.random() * height * 0.8 + (height * 0.1);

            createRipple(x, y, 100);
        }, intervalMs);
    }
}

// Initial setup
updateRippleInterval();

function createRipple(x, y, power) {
    ripples.push({
        x: x,
        y: y,
        radius: 5,
        maxRadius: power,
        alpha: 0.8,
        thickness: 2
    });
}

function animateRipples() {
    requestAnimationFrame(animateRipples);

    ctx.clearRect(0, 0, width, height);

    if (!zenRipplesEnabled) return;

    // Draw Ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];

        // Very slow expansion (twice as slow as previous slow value)
        r.radius += r.maxRadius * 0.005 + 0.1;

        // Very slow fade (half the decay of previous slow value)
        r.alpha -= 0.0018;

        if (r.alpha <= 0) {
            ripples.splice(i, 1);
            continue;
        }

        ctx.beginPath();
        // Elliptical ripple for perspective
        ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(88, 166, 255, ${r.alpha})`;
        ctx.lineWidth = r.thickness;
        ctx.stroke();
    }
}
animateRipples();

function getFaviconUrl(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "32");
    return url.toString();
}

function getFallbackFavicon(color = '#8b949e') {
    return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`)}`;
}

function loadTopSites() {
    if (chrome.topSites && chrome.topSites.get) {
        chrome.topSites.get((sites) => {
            const section = document.getElementById('top-sites-section');
            const container = document.getElementById('top-sites-container');

            if (sites && sites.length > 0) {
                section.style.display = 'block';
                // Get up to 8 top sites
                sites.slice(0, 8).forEach(site => {
                    const a = document.createElement('a');
                    a.href = site.url;
                    a.className = 'site-item';

                    const img = document.createElement('img');
                    img.src = getFaviconUrl(site.url);
                    img.className = 'icon';
                    img.onerror = () => { img.src = getFallbackFavicon(); };

                    const span = document.createElement('span');
                    span.className = 'title';
                    span.textContent = site.title || new URL(site.url).hostname;
                    span.title = site.title;

                    a.appendChild(img);
                    a.appendChild(span);
                    container.appendChild(a);
                });
            }
        });
    }
}

function loadMobileBookmarks() {
    if (chrome.bookmarks && chrome.bookmarks.getTree) {
        chrome.bookmarks.getTree((tree) => {
            const bookmarksBarNode = findBookmarksBar(tree[0]);
            const container = document.getElementById('bookmarks-container');

            if (bookmarksBarNode && bookmarksBarNode.children && bookmarksBarNode.children.length > 0) {
                renderBookmarks(bookmarksBarNode.children, container, []);
            } else {
                container.innerHTML = '<p style="color: var(--text-secondary)">Bookmarks Bar not found or empty.</p>';
            }
        });
    } else {
        document.getElementById('bookmarks-container').innerHTML = '<p style="color: var(--text-secondary)">Bookmarks permission denied or not available.</p>';
    }
}

function findBookmarksBar(node) {
    if (node.title && node.title.toLowerCase() === 'bookmarks bar') {
        return node;
    }
    if (node.children) {
        for (let child of node.children) {
            const found = findBookmarksBar(child);
            if (found) return found;
        }
    }
    return null;
}

function sortBookmarksList(bookmarksList) {
    if (currentSortType === 'default') {
        return bookmarksList; // Keep original order
    }

    // Separate folders and links to sort them independently or together if preferred
    // For now, let's sort them all together, but typically folders go first.
    // Let's implement Folders First, then sort within each group.
    const folders = bookmarksList.filter(b => b.children);
    const links = bookmarksList.filter(b => !b.children);

    const sortFn = (a, b) => {
        let valA, valB;
        if (currentSortType === 'name') {
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
        } else if (currentSortType === 'date') {
            valA = a.dateAdded || 0;
            valB = b.dateAdded || 0;
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    };

    folders.sort(sortFn);
    links.sort(sortFn);

    return [...folders, ...links];
}

function renderBookmarks(bookmarks, container, parentNodes = []) {
    currentBookmarksNode = bookmarks;
    currentParentNodes = parentNodes;
    container.innerHTML = ''; // Clear container

    // Optional: Update title to show breadcrumb or current folder
    const titleEl = document.getElementById('bookmarks-title');
    if (parentNodes.length > 0) {
        const currentFolder = parentNodes[parentNodes.length - 1];
        titleEl.textContent = `Bookmarks Bar / ${currentFolder.title}`;

        // Add "Back" button
        const backBtn = document.createElement('a');
        backBtn.href = '#';
        backBtn.className = 'bookmark-item bookmark-back';

        const btnSpan = document.createElement('span');
        btnSpan.className = 'title';
        btnSpan.textContent = 'Back';

        backBtn.appendChild(btnSpan);

        backBtn.onclick = (ev) => {
            ev.preventDefault();
            if (parentNodes.length > 1) {
                // Go back up one level
                const previousParent = parentNodes[parentNodes.length - 2];
                renderBookmarks(previousParent.children, container, parentNodes.slice(0, -1));
            } else {
                // Go back to root
                loadMobileBookmarks();
            }
        };
        container.appendChild(backBtn);
    } else {
        titleEl.textContent = 'Bookmarks Bar';
    }

    const sortedBookmarks = sortBookmarksList([...bookmarks]);

    sortedBookmarks.forEach(bookmark => {
        const a = document.createElement('a');

        // Add right-click listener
        a.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMenuTarget = bookmark; // Save the target

            const menu = document.getElementById('context-menu');
            menu.style.display = 'block';

            // Basic position calculation to prevent menu from going off screen
            let x = e.pageX;
            let y = e.pageY;

            if (e.clientX + 200 > window.innerWidth) x = e.pageX - 200;
            if (e.clientY + menu.offsetHeight > window.innerHeight) y = e.pageY - menu.offsetHeight;

            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        });

        if (bookmark.url) {
            // It's a bookmark
            a.className = 'bookmark-item';
            a.href = bookmark.url;

            const img = document.createElement('img');
            img.src = getFaviconUrl(bookmark.url);
            img.className = 'icon';
            img.onerror = () => { img.src = getFallbackFavicon(); };

            const span = document.createElement('span');
            span.className = 'title';
            span.textContent = bookmark.title || new URL(bookmark.url).hostname;
            span.title = bookmark.title;

            a.appendChild(img);
            a.appendChild(span);
        } else if (bookmark.children) {
            // It's a folder
            a.className = 'bookmark-item bookmark-folder';
            a.href = '#';

            const span = document.createElement('span');
            span.className = 'title';
            span.textContent = bookmark.title;
            span.title = bookmark.title;

            a.appendChild(span);

            a.onclick = (e) => {
                e.preventDefault();
                renderBookmarks(bookmark.children, container, [...parentNodes, { title: bookmark.title, children: bookmark.children }]);
            };
        }

        // Add drag & drop support
        if (currentSortType === 'default') {
            a.draggable = true;
            a.dataset.id = bookmark.id;

            a.addEventListener('dragstart', (e) => {
                a.classList.add('dragging');
                e.dataTransfer.setData('text/plain', bookmark.id);
            });

            a.addEventListener('dragend', () => {
                a.classList.remove('dragging');
                // Clean up drag-over classes
                container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });

            a.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                if (!a.classList.contains('dragging')) {
                    a.classList.add('drag-over');
                }
            });

            a.addEventListener('dragleave', () => {
                a.classList.remove('drag-over');
            });

            a.addEventListener('drop', (e) => {
                e.preventDefault();
                a.classList.remove('drag-over');
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId === bookmark.id) return; // Dropped on itself

                // Get all current nodes to find indexes
                const items = Array.from(container.children).filter(child => child.draggable);
                const draggedElement = document.querySelector('.dragging');
                if (!draggedElement) return;

                const draggedIndex = items.indexOf(draggedElement);
                const targetIndex = items.indexOf(a);

                const dropIndex = bookmark.index;

                // Attempt to move it in Chrome Bookmarks
                // We determine where it should fall based on hover position. For simplicity, we just use the target's index.
                let newIndex = dropIndex;
                if (draggedIndex < targetIndex) {
                    // moving down, index remains the same because removing the previous element shifts everything up
                } else {
                    // moving up
                }

                chrome.bookmarks.move(draggedId, { parentId: bookmark.parentId, index: newIndex }, () => {
                    loadMobileBookmarks();
                });
            });
        }

        container.appendChild(a);
    });
}
