
(() => {
  const ZOOM = { "graph-container": 1.9, "global-graph-container": 1.5 }
  const closer = (canvas) => {
    const box = canvas.parentElement
    const k = box && ZOOM[[...box.classList].find((name) => name in ZOOM)]
    if (!k || !canvas.isConnected) return
    const r = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -Math.log2(k) / 0.002,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
  }
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLCanvasElement && node.closest(".graph"))
          setTimeout(() => closer(node), 400)
  }).observe(document.body, { childList: true, subtree: true })
})()
