// The bookcase as an object: a camera over the scene (zoom, drag, fit, full screen), a book
// that slides out of its shelf when picked, and a panel with its card. Without this script the
// scene is a scrollable drawing whose books are plain links.

const SVG = "http://www.w3.org/2000/svg"
const DRAG_THRESHOLD = 5
const ZOOM_STEP = 1.35

interface Camera {
  x: number
  y: number
  k: number
}

function mount(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>(".bookcase-stage")!
  const scene = root.querySelector<SVGSVGElement>(".bookcase-scene")!
  const lift = scene.querySelector<SVGGElement>(".bookcase-lift")!
  const panel = root.querySelector<HTMLElement>(".bookcase-panel")!
  const [width, height] = [scene.width.baseVal.value, scene.height.baseVal.value]
  const origin = scene.viewBox.baseVal
  const camera: Camera = { x: 0, y: 0, k: 1 }
  let fitted = 1
  let picked: SVGAElement | null = null
  const cleanups: (() => void)[] = []
  const on = <K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K | string,
    handler: (event: any) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }

  root.classList.add("is-live")

  const apply = (glide = false) => {
    const [w, h] = [stage.clientWidth, stage.clientHeight]
    // The case may be dragged until only a strip of it is left in view, never out of it.
    const keep = 80
    camera.x = Math.min(w - keep, Math.max(keep - width * camera.k, camera.x))
    camera.y = Math.min(h - keep, Math.max(keep - height * camera.k, camera.y))
    root.classList.toggle("is-gliding", glide)
    scene.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`
  }

  // Aim at a rectangle given in the scene's own units, leaving room for a pulled book.
  const aim = (box: string | undefined, glide = true) => {
    const [bx, by, bw, bh] = (box ?? "").split(",").map(Number)
    if (![bx, by, bw, bh].every(Number.isFinite)) return
    // The section buttons lie over the foot of the stage.
    const [pad, foot] = [32, root.querySelector(".bookcase-sections") ? 44 : 0]
    const [w, h] = [stage.clientWidth, stage.clientHeight - foot]
    const k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 2.4)
    camera.k = k
    camera.x = (w - bw * k) / 2 - (bx - origin.x) * k
    camera.y = (h - bh * k) / 2 - (by - origin.y) * k
    apply(glide)
    return k
  }

  const fit = (glide = true) => {
    fitted = aim(scene.dataset.fit, glide) ?? 1
  }

  // The opening view: close enough to read the shelf tags, from the top shelf down.
  const home = () => {
    fit(false)
    // With nothing on the shelves yet, the nightstand is the whole story.
    if (scene.dataset.opening === "whole") return
    const [bx, by, bw] = (scene.dataset.fit ?? "").split(",").map(Number)
    const pad = 28
    const w = stage.clientWidth
    const k = Math.max(fitted, Math.min(1.25, Math.max(0.9, (w - pad * 2) / bw)))
    camera.k = k
    camera.x = (bw * k <= w - pad * 2 ? (w - bw * k) / 2 : pad) - (bx - origin.x) * k
    camera.y = pad - (by - origin.y) * k
    apply()
  }

  const zoom = (factor: number, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) => {
    const k = Math.min(Math.max(fitted * 0.6, camera.k * factor), Math.max(3, fitted * 6))
    camera.x = cx - ((cx - camera.x) * k) / camera.k
    camera.y = cy - ((cy - camera.y) * k) / camera.k
    camera.k = k
    apply(true)
  }

  const drop = () => {
    if (!picked) return
    const out = lift.firstElementChild
    const book = picked
    picked = null
    panel.hidden = true
    if (!out) return book.classList.remove("is-out")
    out.classList.remove("is-pulled")
    const done = () => {
      out.remove()
      book.classList.remove("is-out")
    }
    out.addEventListener("transitionend", done, { once: true })
    setTimeout(done, 400)
  }

  // Bring a picked book and the place it slides out to into view, without changing the zoom.
  const reveal = (book: SVGAElement) => {
    const [view, at] = [stage.getBoundingClientRect(), book.getBoundingClientRect()]
    const style = getComputedStyle(root)
    const pullX = parseFloat(style.getPropertyValue("--pull-x")) * camera.k
    const pullY = parseFloat(style.getPropertyValue("--pull-y")) * camera.k
    const pad = 24
    const [left, right] = [at.left + Math.min(0, pullX) - pad, at.right + pad]
    const [top, bottom] = [at.top - pad, at.bottom + Math.max(0, pullY) + pad]
    const dx = left < view.left ? view.left - left : right > view.right ? view.right - right : 0
    let dy = top < view.top ? view.top - top : bottom > view.bottom ? view.bottom - bottom : 0
    // The card lies over the lower right of the stage; a book under it is lifted clear of it.
    const card = panel.getBoundingClientRect()
    if (right + dx > card.left && bottom + dy > card.top && card.top - view.top > at.height) {
      dy = card.top - bottom
    }
    if (!dx && !dy) return
    camera.x += dx
    camera.y += dy
    apply(true)
  }

  // The picked book as a volume: drag it, or use the arrow keys, to turn it round.
  const volume = (book: SVGAElement) => {
    const data = book.dataset
    const holder = document.createElement("div")
    holder.className = "bookcase-volume"
    holder.tabIndex = 0
    holder.setAttribute("role", "img")
    holder.setAttribute("aria-label", data.title ?? "")
    const body = document.createElement("div")
    body.className = "bookcase-volume-body"
    const thick = Math.min(42, Math.max(14, Number(data.thick) * 1.2 || 20))
    const turn = { x: -8, y: 30 }
    const size = (ratio: number) => {
      const w = Math.min(120, 190 / ratio)
      body.style.setProperty("--w", `${w}px`)
      body.style.setProperty("--h", `${w * ratio}px`)
    }
    const set = () => {
      body.style.setProperty("--rx", `${turn.x}deg`)
      body.style.setProperty("--ry", `${turn.y}deg`)
    }
    body.style.setProperty("--t", `${thick}px`)
    body.style.setProperty("--colour", data.colour ?? "")
    body.style.setProperty("--ink", data.ink ?? "")
    body.style.setProperty("--edge", data.edge ?? "")
    size(1.5)
    set()
    for (const name of ["back", "pages", "top", "bottom", "spine", "front"]) {
      const face = document.createElement("div")
      face.className = `bookcase-volume-${name}`
      if (name === "spine" || name === "front") face.textContent = data.title ?? ""
      body.append(face)
    }
    if (data.cover) {
      // The cover is the face's own background: a child image drops out of a 3D face at some angles.
      const front = body.lastElementChild as HTMLElement
      const cover = new Image()
      cover.addEventListener("load", () => {
        size(cover.naturalHeight / cover.naturalWidth)
        front.textContent = ""
        front.style.backgroundImage = `url("${cover.src}")`
      })
      cover.src = data.cover
    }
    body.classList.add("is-new")
    body.classList.toggle("is-wrapped", data.status === "later")
    holder.append(body)
    let from: { x: number; y: number } | null = null
    holder.addEventListener("pointerdown", (event) => {
      body.classList.remove("is-new")
      from = { x: event.clientX, y: event.clientY }
      holder.setPointerCapture(event.pointerId)
    })
    holder.addEventListener("pointermove", (event) => {
      if (!from) return
      turn.y += (event.clientX - from.x) * 0.7
      turn.x = Math.min(40, Math.max(-40, turn.x - (event.clientY - from.y) * 0.5))
      from = { x: event.clientX, y: event.clientY }
      set()
    })
    const letGo = () => (from = null)
    holder.addEventListener("pointerup", letGo)
    holder.addEventListener("pointercancel", letGo)
    holder.addEventListener("keydown", (event) => {
      const step = {
        ArrowLeft: [0, -15],
        ArrowRight: [0, 15],
        ArrowUp: [10, 0],
        ArrowDown: [-10, 0],
      }[event.key]
      if (!step) return
      event.preventDefault()
      body.classList.remove("is-new")
      turn.x = Math.min(40, Math.max(-40, turn.x + step[0]))
      turn.y += step[1]
      set()
    })
    return holder
  }

  const describe = (book: SVGAElement) => {
    const data = book.dataset
    const figure = document.createElement("figure")
    figure.className = "bookcase-figure"
    const hint = document.createElement("figcaption")
    hint.textContent = `↔ ${root.dataset.turn ?? ""}`
    figure.append(volume(book), hint)
    const close = document.createElement("button")
    close.type = "button"
    close.dataset.do = "close"
    close.textContent = "×"
    close.title = root.dataset.close ?? ""
    close.setAttribute("aria-label", close.title)
    panel.replaceChildren(figure, close)
    const text = document.createElement("div")
    const line = (tag: string, content: string | undefined, className?: string) => {
      if (!content) return
      const el = document.createElement(tag)
      el.textContent = content
      if (className) el.className = className
      text.append(el)
    }
    line("h3", data.title)
    line("p", [data.author, data.year, data.state].filter(Boolean).join(" · "), "bookcase-byline")
    line("p", data.description)
    line("p", data.note, "bookcase-note")
    const open = document.createElement("a")
    open.href = book.href.baseVal
    open.className = "internal"
    open.textContent = `${root.dataset.open ?? ""} →`
    const last = document.createElement("p")
    last.append(open)
    text.append(last)
    panel.append(text)
    panel.hidden = false
  }

  const pick = (book: SVGAElement) => {
    if (picked === book) return
    drop()
    lift.replaceChildren()
    picked = book
    const out = document.createElementNS(SVG, "g")
    for (const child of book.children) out.append(child.cloneNode(true))
    // The cover goes onto the face that the shelf was hiding: the book's front board.
    const face = (book.dataset.face ?? "").split(",").map(Number)
    const board = out.querySelector(".bookcase-cover")
    if (
      book.dataset.cover &&
      board &&
      !out.querySelector("image") &&
      face.length === 6 &&
      face.every(Number.isFinite)
    ) {
      const [nx, ny, dx, dy, bx, by] = face
      const image = document.createElementNS(SVG, "image")
      image.setAttribute("href", book.dataset.cover)
      image.setAttribute("width", "100")
      image.setAttribute("height", "100")
      image.setAttribute("preserveAspectRatio", "none")
      image.setAttribute(
        "transform",
        `matrix(${(dx - nx) / 100} ${(dy - ny) / 100} ${(bx - nx) / 100} ${(by - ny) / 100} ${nx} ${ny})`,
      )
      board.after(image)
    }
    lift.append(out)
    book.classList.add("is-out")
    // A frame apart, or the pull would start already finished.
    requestAnimationFrame(() => requestAnimationFrame(() => out.classList.add("is-pulled")))
    describe(book)
    reveal(book)
  }

  const go = (book: SVGAElement) => window.spaNavigate(new URL(book.href.baseVal, location.href))

  const bookAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<SVGAElement>(".bookcase-book") : null

  // Dragging: a mouse or pen drags the case anywhere; a finger drags it sideways and leaves
  // the vertical gesture to the page, except in full screen where the case has the screen.
  const pointers = new Map<number, { x: number; y: number }>()
  let dragged = false
  let travelled = 0
  on(stage, "pointerdown", (event: PointerEvent) => {
    if ((event.target as Element).closest("button, .bookcase-panel")) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    travelled = 0
    dragged = false
  })
  on(stage, "pointermove", (event: PointerEvent) => {
    const from = pointers.get(event.pointerId)
    if (!from) return
    const [dx, dy] = [event.clientX - from.x, event.clientY - from.y]
    if (pointers.size === 2) {
      const [other] = [...pointers].filter(([id]) => id !== event.pointerId).map(([, p]) => p)
      const before = Math.hypot(from.x - other.x, from.y - other.y)
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
      const box = stage.getBoundingClientRect()
      if (before > 0) {
        root.classList.remove("is-gliding")
        const k = camera.k
        zoom(
          after / before,
          (event.clientX + other.x) / 2 - box.left,
          (event.clientY + other.y) / 2 - box.top,
        )
        if (camera.k !== k) root.classList.remove("is-gliding")
      }
      dragged = true
    } else {
      travelled += Math.hypot(dx, dy)
      if (!dragged && travelled < DRAG_THRESHOLD) return
      if (!dragged) {
        dragged = true
        stage.setPointerCapture(event.pointerId)
        stage.classList.add("is-dragging")
      }
      camera.x += dx
      camera.y += dy
      apply()
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  })
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    stage.classList.remove("is-dragging")
  }
  on(stage, "pointerup", release)
  on(stage, "pointercancel", release)

  // The first click pulls a book out; a click on the pulled book opens its card.
  on(stage, "click", (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button")
    if (button) {
      const action = button.dataset.do
      if (action === "in") zoom(ZOOM_STEP)
      else if (action === "out") zoom(1 / ZOOM_STEP)
      else if (action === "fit") fit()
      else if (action === "close") drop()
      else if (action === "full") {
        const full = root.classList.toggle("is-full")
        button.setAttribute("aria-pressed", String(full))
        document.documentElement.style.overflow = full ? "hidden" : ""
        fit(false)
      } else aim(button.dataset.to)
      return
    }
    if ((event.target as Element).closest(".bookcase-panel")) return
    if (dragged) {
      event.preventDefault()
      dragged = false
      return
    }
    const hit = (event.target as Element).closest(".bookcase-lift") ? picked : bookAt(event.target)
    if (!hit) return drop()
    if (event.ctrlKey || event.metaKey) return
    event.preventDefault()
    if (hit === picked) void go(hit)
    else pick(hit)
  })

  on(stage, "focusin", (event: FocusEvent) => {
    const book = bookAt(event.target)
    if (book && book.matches(":focus-visible")) pick(book)
  })

  // A plain wheel belongs to the page; with ctrl or a pinch on a trackpad it zooms the case.
  on(
    stage,
    "wheel",
    (event: WheelEvent) => {
      const full = root.classList.contains("is-full")
      if ((event.target as Element).closest(".bookcase-panel")) return
      if (!event.ctrlKey && !event.metaKey && !full) return
      event.preventDefault()
      const box = stage.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        zoom(Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top)
        root.classList.remove("is-gliding")
      } else {
        camera.x -= event.deltaX
        camera.y -= event.deltaY
        apply()
      }
    },
    { passive: false },
  )

  on(document as unknown as EventTarget, "keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    if (picked) drop()
    else if (root.classList.contains("is-full")) {
      root.classList.remove("is-full")
      document.documentElement.style.overflow = ""
      fit(false)
    }
  })

  const resized = new ResizeObserver(() => home())
  resized.observe(stage)
  cleanups.push(() => resized.disconnect())
  cleanups.push(() => (document.documentElement.style.overflow = ""))
  home()
  return () => cleanups.forEach((fn) => fn())
}

document.addEventListener("nav", () => {
  for (const root of document.querySelectorAll<HTMLElement>(".bookcase")) {
    // A view in a hidden tab has no size yet; it is mounted when its tab is shown.
    const start = () => {
      if (root.classList.contains("is-live") || root.offsetParent === null) return
      window.addCleanup(mount(root))
    }
    start()
    const tabs = root.closest(".bases-page")?.querySelector(".bases-view-tabs")
    if (tabs) {
      const later = () => requestAnimationFrame(start)
      tabs.addEventListener("click", later)
      window.addCleanup(() => tabs.removeEventListener("click", later))
    }
  }
})
