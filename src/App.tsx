import { useState, useEffect, useMemo, useRef } from 'react'
import Cropper from 'react-easy-crop'
import './App.css'

type Mark = 'none' | 'circle' | 'x-user' | 'x-auto'
type Cell = { color: string; mark: Mark }
type PixelCrop = { x:number; y:number; width:number; height:number }

const DEFAULT_PALETTE = [
  '#96562f', // café
  '#bf742c', // naranja quemado
  '#d98d68', // durazno
  '#d5a52c', // mostaza
  '#89c36c', // verde claro
  '#68974e', // verde bosque
  '#178a88', // turquesa
  '#3764a0', // azul medio
  '#8993a5', // azul grisáceo
  '#b479b7', // morado
  '#da9cd2', // rosa pastel
  '#b25373', // rosa viejo
]

const createEmpty = (n:number):Cell[][]=>Array.from({length:n},()=>Array.from({length:n},()=>({color:'#ffffff',mark:'none'})))

function applyAutoMarks(base:Cell[][]):Cell[][]{
  const n=base.length
  const g:Cell[][]=base.map(r=>r.map(c=>({...c,mark:(c.mark==='x-auto'?'none':c.mark) as Mark})))
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(g[r][c].mark==='circle'){
    const col=g[r][c].color
    for(let i=0;i<n;i++){if(i!==c&&g[r][i].mark==='none')g[r][i].mark='x-auto';if(i!==r&&g[i][c].mark==='none')g[i][c].mark='x-auto'}
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(dr===0&&dc===0)continue;const nr=r+dr,nc=c+dc;if(nr>=0&&nr<n&&nc>=0&&nc<n&&g[nr][nc].mark==='none')g[nr][nc].mark='x-auto'}
    for(let rr=0;rr<n;rr++)for(let cc=0;cc<n;cc++)if(!(rr===r&&cc===c)&&g[rr][cc].color===col&&g[rr][cc].mark==='none')g[rr][cc].mark='x-auto'
  }
  return g
}

export default function App(){
  const [grid,setGrid]=useState<Cell[][]>(()=>createEmpty(9))
  const [newSize,setNewSize]=useState(9)
  const [mode,setMode]=useState<'pintar'|'circulo'|'xuser'>('pintar')
  const [selectedColor,setSelectedColor]=useState(DEFAULT_PALETTE[0])
  const [showPalette,setShowPalette]=useState(false)
  const [isPainting,setIsPainting]=useState(false)
  const [status,setStatus]=useState('')
  const [showDefault,setShowDefault]=useState(true)
  const [showCustom,setShowCustom]=useState(true)
  const [customPal,setCustomPal]=useState<string[]>(()=>JSON.parse(localStorage.getItem('custom-palette')||'[]'))
  const [past,setPast]=useState<Cell[][][]>([])
  const [theme,setTheme]=useState(()=>localStorage.getItem('theme')||'light')
  const [showEdit,setShowEdit]=useState(true)
  const [showGame,setShowGame]=useState(false)
  const [cropSrc, setCropSrc] = useState<string|null>(null)
  const [crop, setCrop] = useState({ x:0, y:0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<PixelCrop|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastPainted = useRef<string|null>(null)

  // Para drag de X
  const [isDraggingX, setIsDraggingX] = useState(false)
  const [dragModeX, setDragModeX] = useState<'paint' | 'erase' | null>(null)
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set())

  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme)},[theme])
  useEffect(()=>{localStorage.setItem('custom-palette',JSON.stringify(customPal))},[customPal])
  useEffect(()=>{const up=()=>{setIsPainting(false); setIsDraggingX(false)};window.addEventListener('pointerup',up);return()=>window.removeEventListener('pointerup',up)},[])

  const blockedColors = useMemo(()=>{
    const map=new Map<string,Cell[]>()
    grid.forEach(r=>r.forEach(c=>{if(c.color!=='#ffffff'){if(!map.has(c.color))map.set(c.color,[]);map.get(c.color)!.push(c)}}))
    return Array.from(map.entries()).filter(([,cells])=>!cells.some(c=>c.mark==='circle')&&cells.every(c=>c.mark==='x-auto'||c.mark==='x-user')).map(([col])=>col)
  },[grid])

  const saveSnapshot=()=>setPast(p=>[...p,grid.map(r=>r.map(c=>({...c})))].slice(-50))
  const selectColor=(col:string)=>{setSelectedColor(col); setShowPalette(false)}
  const deleteCustom=(col:string)=>{setCustomPal(p=>p.filter(c=>c!==col));if(selectedColor===col)setSelectedColor(DEFAULT_PALETTE[0])}

  const paintCell = (r:number, c:number, withHistory=false) => {
    if (withHistory) saveSnapshot()
    setGrid(prev => {
      const cell = prev[r][c]
      if (!withHistory && cell.color === selectedColor) return prev
      const g = prev.map(row => row.map(cell => ({...cell})))
      if (withHistory && g[r][c].color === selectedColor) {
        g[r][c].color = '#ffffff'; g[r][c].mark = 'none'
      } else {
        g[r][c].color = selectedColor; g[r][c].mark = 'none'
      }
      return applyAutoMarks(g)
    })
  }

  const rgbToHex = (r:number,g:number,b:number) =>
    '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')

  const hexToRgb = (hex:string) => {
    const h = hex.replace('#','')
    return [
      parseInt(h.slice(0,2),16),
      parseInt(h.slice(2,4),16),
      parseInt(h.slice(4,6),16)
    ] as [number,number,number]
  }

  const nearestPalette = (hex:string, palette:string[]) => {
    const [r1,g1,b1] = hexToRgb(hex)
    let best = palette[0]
    let min = Infinity
    for (const p of palette) {
      const [r2,g2,b2] = hexToRgb(p)
      const d = (r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2
      if (d < min) { min = d; best = p }
    }
    return best
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const getCroppedImg = (imageSrc:string, crop:PixelCrop):Promise<string> => {
    return new Promise(res => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = crop.width
        canvas.height = crop.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
        res(canvas.toDataURL('image/jpeg'))
      }
      img.src = imageSrc
    })
  }

  const processCrop = async () => {
    if (!cropSrc ||!croppedArea) return
    const croppedDataUrl = await getCroppedImg(cropSrc, croppedArea)
    setCropSrc(null)

    const n = Math.max(3, Math.min(20, newSize))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = n; canvas.height = n
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, n, n)

      // Ahora usa paleta dinámica: default + custom si existe
      const activePalette = customPal.length > 0? [...customPal,...DEFAULT_PALETTE] : DEFAULT_PALETTE
      const newGrid = createEmpty(n)
      for (let r=0;r<n;r++) for (let c=0;c<n;c++) {
        const [R,G,B] = ctx.getImageData(c,r,1,1).data
        const isWhite = R>240 && G>240 && B>240
        newGrid[r][c].color = isWhite? '#ffffff' : nearestPalette(rgbToHex(R,G,B), activePalette)
      }
      saveSnapshot()
      setGrid(applyAutoMarks(newGrid))
    }
    img.src = croppedDataUrl
  }
/*
  const handleGridDown = (e: React.PointerEvent) => {
    const cell = (e.target as HTMLElement).closest('.cell') as HTMLElement | null
    if (!cell) return
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c)

    if (mode!== 'pintar') { handleAction(r, c); return }

    e.preventDefault()
    setIsPainting(true)
    lastPainted.current = `${r}-${c}`
    paintCell(r, c, true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handleGridMove = (e: React.PointerEvent) => {
    if (!isPainting || mode!== 'pintar') return
    e.preventDefault()
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell') as HTMLElement | null
    if (!el) return
    const r = Number(el.dataset.r), c = Number(el.dataset.c)
    const key = `${r}-${c}`
    if (lastPainted.current === key) return
    lastPainted.current = key
    paintCell(r, c, false)
  }

  const handleGridUp = () => { setIsPainting(false); lastPainted.current = null }
*/
  // Toggle X de usuario
  const toggleUserX = (r:number, c:number, force?: 'paint' | 'erase') => {
    setGrid(prev => {
      const cell = prev[r][c]
      if (cell.mark === 'circle' || cell.mark === 'x-auto') return prev // No tocar X del sistema

      const shouldPaint = force? force === 'paint' : cell.mark!== 'x-user'
      if (!shouldPaint && cell.mark!== 'x-user') return prev
      if (shouldPaint && cell.mark === 'x-user') return prev

      const g = prev.map(row => row.map(c => ({...c})))
      g[r][c].mark = shouldPaint? 'x-user' : 'none'
      return applyAutoMarks(g)
    })
  }

  const handleAction=(r:number,c:number)=>{
    setStatus('');const n=grid.length
    if(mode==='xuser'){
      saveSnapshot()
      toggleUserX(r,c)
      return
    }
    if(mode==='circulo'){
      if(grid[r][c].color==='#ffffff'){setStatus('Pinta primero');return}
      saveSnapshot();setGrid(p=>{const g=p.map(r=>r.map(c=>({...c})));if(g[r][c].mark==='circle'){g[r][c].mark='none';return applyAutoMarks(g)};const circles=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(g[i][j].mark==='circle')circles.push({r:i,c:j,color:g[i][j].color});if(circles.some(m=>m.color===g[r][c].color)){setStatus('Ya hay gatito de ese color');return p};if(circles.some(m=>m.r===r||m.c===c)){setStatus('Fila/columna ocupada');return p};if(circles.some(m=>Math.abs(m.r-r)<=1&&Math.abs(m.c-c)<=1)){setStatus('No se tocan');return p};g[r][c].mark='circle';return applyAutoMarks(g)})
    }
  }

  // Drag para X en modo 'xuser'
  const handleXDragStart = (r:number, c:number, e?: React.PointerEvent) => {
    if (mode!== 'xuser') return
    e?.preventDefault() // Evita scroll y zoom
    const cell = grid[r][c]
    if (cell.mark === 'circle' || cell.mark === 'x-auto') return

    setIsDraggingX(true)
    setVisitedCells(new Set([`${r}-${c}`]))
    const newMode = cell.mark === 'x-user'? 'erase' : 'paint'
    setDragModeX(newMode)
    saveSnapshot()
    toggleUserX(r, c, newMode)
  }

  const handleXDragEnter = (r:number, c:number) => {
    if (!isDraggingX ||!dragModeX || mode!== 'xuser') return
    const key = `${r}-${c}`
    if (visitedCells.has(key)) return
    const cell = grid[r][c]
    if (cell.mark === 'circle' || cell.mark === 'x-auto') return

    setVisitedCells(prev => new Set(prev).add(key))
    toggleUserX(r, c, dragModeX)
  }

  const handleXDragEnd = () => {
    setIsDraggingX(false)
    setDragModeX(null)
    setVisitedCells(new Set())
  }

  const undo=()=>{setPast(p=>{if(p.length===0)return p;const last=p[p.length-1];setGrid(last);return p.slice(0,-1)})}
  const clearMarks=()=>{saveSnapshot();setGrid(p=>p.map(r=>r.map(c=>({...c,mark:'none'}))))}

  return(
    <div className="app">
      <button className="theme-toggle" onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>
        {theme==='light'?'🌙':'☀'}
      </button>

      <h1>Matriz {grid.length}x{grid.length}</h1>

      <div className="toolbar">
        <div className="toolbar-section">
          <div className="section-header" onClick={()=>setShowEdit(!showEdit)}>
            <span>Modo edición</span><span>{showEdit?'−':'+'}</span>
          </div>
          {showEdit&&(
            <div className="section-body">
              <input type="number" min="3" max="20" value={newSize} onChange={e=>setNewSize(Number(e.target.value))} style={{width:55}}/>
              <button onClick={()=>{saveSnapshot();const n=Math.max(3,Math.min(20,newSize));setGrid(createEmpty(n));setStatus('')}}>Crear</button>
              <button onClick={()=>fileInputRef.current?.click()}>Importar foto</button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handleFile} />
              <button className={mode==='pintar'?'active':''} onClick={()=>setMode('pintar')}>Pintar</button>
              <button onClick={clearMarks}>Limpiar marcas</button>
              <button onClick={()=>{saveSnapshot();setGrid(createEmpty(grid.length));setStatus('')}}>Reiniciar</button>
            </div>
          )}
        </div>

        <div className="toolbar-section">
          <div className="section-header" onClick={()=>setShowGame(!showGame)}>
            <span>Modo juego</span><span>{showGame?'−':'+'}</span>
          </div>
          {showGame&&(
            <div className="section-body">
              <button className={mode==='circulo'?'active':''} onClick={()=>setMode('circulo')}>Gatito</button>
              <button className={mode==='xuser'?'active':''} onClick={()=>setMode('xuser')}>X manual</button>
              <button onClick={undo} disabled={past.length===0}>Deshacer</button>
            </div>
          )}
        </div>
      </div>

      {mode==='pintar'&&<>
        <div className="picker-row">
          <div className="current-color" style={{background:selectedColor}} onClick={()=>setShowPalette(!showPalette)}/>
          <input type="color" value={selectedColor} onChange={e=>selectColor(e.target.value)}/>
          <button onClick={()=>{if(!DEFAULT_PALETTE.includes(selectedColor)&&!customPal.includes(selectedColor))setCustomPal(p=>[...p,selectedColor])}} title="Guardar">＋</button>
        </div>

        {showPalette&&(
          <div className="palette-dropdown">
            <div className="palette-section">
              <div className="palette-header" onClick={()=>setShowDefault(!showDefault)}>
                <span>Predeterminados</span><span>{showDefault?'−':'+'}</span>
              </div>
              {showDefault&&(
                <div className="palette-grid">
                  {DEFAULT_PALETTE.map(col=>(
                    <div key={col} className={`color ${selectedColor===col?'selected':''}`} style={{background:col}} onClick={()=>selectColor(col)}/>
                  ))}
                </div>
              )}
            </div>

            {customPal.length>0&&(
              <div className="palette-section">
                <div className="palette-header" onClick={()=>setShowCustom(!showCustom)}>
                  <span>Mis colores ({customPal.length})</span><span>{showCustom?'−':'+'}</span>
                </div>
                {showCustom&&(
                  <div className="palette-grid">
                    {customPal.map(col=>(
                      <div key={col} className="color-wrapper">
                        <div className={`color ${selectedColor===col?'selected':''}`} style={{background:col}} onClick={()=>selectColor(col)}/>
                        <button className="color-delete" onClick={e=>{e.stopPropagation();deleteCustom(col)}}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </>}

      <div className="grid"
        style={{gridTemplateColumns:`repeat(${grid.length},1fr)`, touchAction:'none'}}
      >
        {grid.map((row,r)=>row.map((cell,c)=>(
          <div key={`${r}-${c}`}
            className="cell"
            data-r={r} data-c={c}
            onPointerDown={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) // CLAVE

              if (mode === 'pintar') {
                setIsPainting(true)
                lastPainted.current = `${r}-${c}`
                paintCell(r, c, true)
              } else if (mode === 'xuser') {
                handleXDragStart(r, c, e)
              } else if (mode === 'circulo') {
                handleAction(r, c)
              }
            }}
            onPointerMove={(e) => {
              // Ahora usamos PointerMove en la celda que capturó
              const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell') as HTMLElement | null
              if (!el) return
              const nr = Number(el.dataset.r), nc = Number(el.dataset.c)
              
              if (mode === 'pintar' && isPainting) {
                const key = `${nr}-${nc}`
                if (lastPainted.current === key) return
                lastPainted.current = key
                paintCell(nr, nc, false)
              }
              if (mode === 'xuser' && isDraggingX) {
                handleXDragEnter(nr, nc)
              }
            }}
            onPointerUp={() => {
              if (mode === 'xuser') handleXDragEnd()
              if (mode === 'pintar') { setIsPainting(false); lastPainted.current = null }
            }}
            style={{
              background: cell.color === '#ffffff'? 'var(--cell-empty)' : cell.color,
              border: `1px solid ${cell.color === '#ffffff'? 'var(--cell-border)' : 'transparent'}`,
              touchAction: 'none'
            }}
          >
            {cell.mark==='circle'&&<div className="mark-emoji">🐱</div>}
            {cell.mark==='x-user'&&<div className="mark-x user">✕</div>}
            {cell.mark==='x-auto'&&<div className="mark-x auto">✕</div>}
          </div>
        )))}
      </div>


      <div className="status">{status}</div>
      {blockedColors.length>0&&<div className="status" style={{display:'flex',gap:6,justifyContent:'center',alignItems:'center'}}>Color bloqueado:{blockedColors.map(c=><span key={c} style={{width:16,height:16,background:c,border:'1px solid #333',borderRadius:3}}/> )}</div>}

      {cropSrc && (
        <div style={{position:'fixed',inset:0,background:'#000c',zIndex:999,display:'flex',flexDirection:'column'}}>
          <div style={{position:'relative',flex:1}}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels)=>setCroppedArea(areaPixels)}
            />
          </div>
          <div style={{padding:12,display:'flex',gap:8,justifyContent:'center',background:'var(--bg)'}}>
            <button onClick={()=>setCropSrc(null)}>Cancelar</button>
            <button onClick={processCrop}>Usar recorte</button>
          </div>
        </div>
      )}
    </div>
  )
}
