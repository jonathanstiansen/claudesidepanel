// ponytail: fixed seed so stars hold still across redraws; SMIL does the twinkle, no timers
export const STARFIELD_SIZE = { width: 600, height: 1400 }

const TINTS = ['#f2c14e', '#9b87f5', '#5fb3f0', '#f58ab8']

export const STARFIELD = (() => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const stars = Array.from({ length: 420 }, (_, i) => {
    const [x, y, tint] = [rand() * STARFIELD_SIZE.width, rand() * STARFIELD_SIZE.height, TINTS[i % TINTS.length]]
    const twinkle = `<animate attributeName="opacity" values="0.25;1;0.25" dur="${(1.8 + rand() * 3).toFixed(1)}s" begin="-${(rand() * 5).toFixed(1)}s" repeatCount="indefinite"/>`
    if (i % 6 === 0) {
      const r = 3 + rand() * 3
      const [cx, cy, k] = [x.toFixed(0), y.toFixed(0), (r * 0.25).toFixed(1)]
      return `<path d="M${cx} ${(y - r).toFixed(1)}L${(x + +k).toFixed(1)} ${(y - +k).toFixed(1)}L${(x + r).toFixed(1)} ${cy}L${(x + +k).toFixed(1)} ${(y + +k).toFixed(1)}L${cx} ${(y + r).toFixed(1)}L${(x - +k).toFixed(1)} ${(y + +k).toFixed(1)}L${(x - r).toFixed(1)} ${cy}L${(x - +k).toFixed(1)} ${(y - +k).toFixed(1)}Z" fill="${tint}">${twinkle}</path>`
    }
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + rand() * 1).toFixed(1)}" fill="${tint}">${twinkle}</circle>`
  })
  const { width, height } = STARFIELD_SIZE
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin slice">${stars.join('')}</svg>`
})()

const TWINKLE = ['·', '✧', '✦', '⋆', '✦', '✧']

// ponytail: terminal has no Svg, so the sky is text; one tick per frame, each star on its own phase
export const skyRow = (t: number, width: number, row: number): { ch: string; color?: string }[] =>
  Array.from({ length: width }, (_, i) => {
    let h = Math.imul(i + 1, 374761393) ^ Math.imul(row + 1, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = (h ^ (h >>> 16)) >>> 0
    if (h % 7 !== 0) return { ch: ' ' }
    return { ch: TWINKLE[(t + (h >>> 3)) % TWINKLE.length] ?? '·', color: TINTS[(h >>> 7) % TINTS.length] }
  })

// blanks merge into plain strings so a row is ~1 node per star, not 1 per cell
export const skyRuns = (t: number, width: number, row: number): ({ ch: string; color: string } | string)[] =>
  skyRow(t, width, row).reduce<({ ch: string; color: string } | string)[]>((runs, cell) => {
    const last = runs[runs.length - 1]
    if (cell.color) runs.push({ ch: cell.ch, color: cell.color })
    else if (typeof last === 'string') runs[runs.length - 1] = last + cell.ch
    else runs.push(cell.ch)
    return runs
  }, [])
