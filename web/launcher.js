(() => {
  if (window.__DSH_HUMANIZER_LAUNCHER__) return
  window.__DSH_HUMANIZER_LAUNCHER__ = true

  const BASE = '/dsh-humanizer'

  const style = document.createElement('style')
  style.textContent = `
    #dsh-humanizer-fab {
      position: fixed; right: 22px; bottom: 96px; z-index: 2147483000;
      width: 64px; height: 64px; border-radius: 50%; border: 2px solid #ffffff;
      background: #ffffff; padding: 0; overflow: hidden; cursor: grab;
      touch-action: none; user-select: none;
      display: grid; place-items: center; color: #245a8a;
      font: 800 20px/1 "Microsoft YaHei", system-ui, sans-serif;
      box-shadow: 0 10px 28px rgba(36, 90, 138, .35), 0 0 0 4px rgba(74, 143, 216, .16);
      transition: transform .18s ease, box-shadow .18s ease;
    }
    #dsh-humanizer-fab img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #dsh-humanizer-fab::after {
      content: ""; position: absolute; right: 2px; bottom: 2px; width: 10px; height: 10px;
      border-radius: 50%; background: #d93a3a; border: 2px solid #ffffff;
    }
    #dsh-humanizer-fab:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 16px 36px rgba(36, 90, 138, .42), 0 0 0 6px rgba(74, 143, 216, .18);
    }
    #dsh-humanizer-fab.dragging {
      cursor: grabbing; transition: none; transform: none;
    }
    #dsh-humanizer-overlay {
      position: fixed; inset: 0; z-index: 2147483001; display: none;
      background: rgba(18, 45, 72, .45); backdrop-filter: blur(4px);
    }
    #dsh-humanizer-overlay.open { display: block; }
    #dsh-humanizer-frame {
      position: absolute; inset: 4% 6%; width: 88%; height: 92%;
      border: 2px solid rgba(255, 255, 255, .85); border-radius: 18px;
      background: #eaf7ff; box-shadow: 0 30px 80px rgba(12, 40, 70, .45);
    }
    #dsh-humanizer-close {
      position: absolute; right: 7%; top: 2.2%; z-index: 2;
      width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
      border: 1px solid rgba(74, 143, 216, .45); background: #ffffff; color: #245a8a;
      font: 17px/1 system-ui; box-shadow: 0 4px 14px rgba(36, 90, 138, .2);
    }
    #dsh-humanizer-close:hover { background: #eaf7ff; }
    @media (max-width: 720px) {
      #dsh-humanizer-fab { width: 54px; height: 54px; right: 14px; bottom: 84px; }
      #dsh-humanizer-frame { inset: 2% 2%; width: 96%; height: 96%; }
      #dsh-humanizer-close { right: 3%; top: 1.2%; }
    }
  `
  document.head.appendChild(style)

  const fab = document.createElement('button')
  fab.id = 'dsh-humanizer-fab'
  fab.title = '姆咪 · 真人化控制台'
  fab.innerHTML = `<img src="${BASE}/assets/mumi-chibi.png" alt="姆咪" onerror="var p=this.parentElement;this.remove();p.textContent='姆'" />`
  document.body.appendChild(fab)

  const overlay = document.createElement('div')
  overlay.id = 'dsh-humanizer-overlay'
  overlay.innerHTML = `<button id="dsh-humanizer-close" title="关闭">×</button><iframe id="dsh-humanizer-frame" src="${BASE}/panel" title="真人化控制台"></iframe>`
  document.body.appendChild(overlay)

  const close = () => overlay.classList.remove('open')
  const open = () => overlay.classList.add('open')

  // 可拖动，位置记在 localStorage；拖动结束才保存，单击仍然打开面板
  const POS_KEY = 'dsh-humanizer-fab-pos'
  let drag = null
  let moved = false
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const setPos = (left, top) => {
    const r = fab.getBoundingClientRect()
    const w = r.width || 64
    const h = r.height || 64
    fab.style.left = clamp(left, 4, window.innerWidth - w - 4) + 'px'
    fab.style.top = clamp(top, 4, window.innerHeight - h - 4) + 'px'
    fab.style.right = 'auto'
    fab.style.bottom = 'auto'
  }
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      requestAnimationFrame(() => setPos(saved.left, saved.top))
    }
  } catch {}

  fab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const r = fab.getBoundingClientRect()
    drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top }
    moved = false
    fab.classList.add('dragging')
    try { fab.setPointerCapture(e.pointerId) } catch {}
    e.preventDefault()
  })

  fab.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true
    if (!moved) return
    setPos(drag.left + dx, drag.top + dy)
  })

  const endDrag = () => {
    if (!drag) return
    drag = null
    fab.classList.remove('dragging')
    if (moved) {
      const r = fab.getBoundingClientRect()
      try { localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top })) } catch {}
    } else {
      open()
    }
    moved = false
  }
  fab.addEventListener('pointerup', endDrag)
  fab.addEventListener('pointercancel', () => {
    drag = null
    moved = false
    fab.classList.remove('dragging')
  })
  fab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  })
  window.addEventListener('resize', () => {
    if (!fab.style.left) return
    const r = fab.getBoundingClientRect()
    setPos(r.left, r.top)
  })
  overlay.querySelector('#dsh-humanizer-close').addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'dsh-humanizer-close') close()
  })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
})()
