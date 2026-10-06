import './style.css'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'
import { createGallery } from './scene.js'

const canvas = document.getElementById('scene')
const hall = document.getElementById('hall')
const gallery = createGallery(canvas)
const { camera, lookTarget, gems } = gallery
const narrow = window.matchMedia('(max-width: 719px)').matches
const touch = window.matchMedia('(pointer: coarse)').matches

if (narrow) camera.position.set(0, 6, 14)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.target = lookTarget
controls.minDistance = 4.5
controls.maxDistance = 18
controls.maxPolarAngle = Math.PI / 2 - 0.03
// ホイールはページのスクロールに使う
controls.enableZoom = false
// スマホでは指でページをスクロールできるよう、回転操作をオフにする
if (touch) {
  controls.enableRotate = false
  canvas.style.touchAction = 'pan-y'
}
gallery.controls = controls

// 展示室が画面外に出たら描画を止める
new IntersectionObserver(([entry]) => {
  gallery.paused = !entry.isIntersecting
}).observe(hall)

const panel = document.getElementById('panel')
const chips = [...document.querySelectorAll('.chip')]
let current = null
let returnShot = null

const fly = (shot, onComplete) => {
  const tween = { duration: 1.2, ease: 'power3.inOut', overwrite: 'auto' }
  gsap.to(camera.position, { ...tween, x: shot.pos.x, y: shot.pos.y, z: shot.pos.z })
  gsap.to(lookTarget, { ...tween, x: shot.look.x, y: shot.look.y, z: shot.look.z, onComplete })
}

const fillPanel = (gem) => {
  panel.style.setProperty('--hue', gem.hue)
  panel.dataset.gemId = gem.id
  const name = document.createElement('span')
  name.className = 'gem-name'
  name.textContent = gem.name
  const reading = document.createElement('span')
  reading.className = 'reading'
  reading.textContent = gem.reading
  document.getElementById('panel-name').replaceChildren(name, reading)
  document.getElementById('panel-text').textContent = gem.text
  document.getElementById('panel-specs').replaceChildren(
    ...gem.specs.map(([label, value]) => {
      const row = document.createElement('div')
      const dt = document.createElement('dt')
      const dd = document.createElement('dd')
      dt.textContent = label
      dd.textContent = value
      row.append(dt, dd)
      return row
    }),
  )
}

// 宝石を選ぶ: カメラが寄り、宝石が浮き、説明パネルが出る
const open = (gem) => {
  if (current === gem) return
  if (!current) returnShot = { pos: camera.position.clone(), look: lookTarget.clone() }
  if (current) gallery.setRaised(current, false)
  current = gem
  gallery.setRaised(gem, true)
  controls.enabled = false

  fillPanel(gem)
  panel.classList.add('is-open')
  panel.inert = false
  chips.forEach((chip, index) => chip.setAttribute('aria-pressed', String(index === gem.index)))

  fly(gallery.shotFor(gem, narrow ? { distance: 4.4, drop: 0.9 } : { shift: -1.1 }))
}

// 閉じる: 選ぶ前の視点へ戻ってから、ドラッグ操作を再開する
const close = () => {
  if (!current) return
  gallery.setRaised(current, false)
  current = null
  panel.classList.remove('is-open')
  panel.inert = true
  chips.forEach((chip) => chip.setAttribute('aria-pressed', 'false'))
  fly(returnShot, () => {
    controls.enabled = true
  })
}

// 3Dの宝石と名前ボタン: 選択中の宝石をもう一度押すと元に戻る(元の作品と同じ切り替え)
const toggle = (gem) => {
  if (current === gem) close()
  else open(gem)
}

const step = (offset) => {
  if (!current) return
  open(gems[(current.index + offset + gems.length) % gems.length])
}

chips.forEach((chip) => chip.addEventListener('click', () => toggle(gems[Number(chip.dataset.gem)])))
document.getElementById('panel-close').addEventListener('click', close)
document.getElementById('panel-prev').addEventListener('click', () => step(-1))
document.getElementById('panel-next').addEventListener('click', () => step(1))
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') close()
})

// 一覧のカードに、展示中と同じ宝石を回転させて表示する。一覧が画面にあるときだけ動かす
gallery
  .createCardViews(document.getElementById('card-views'), [...document.querySelectorAll('.gem-thumb')])
  .then((cardViews) => {
    new IntersectionObserver(([entry]) => {
      cardViews.setActive(entry.isIntersecting)
    }).observe(document.getElementById('collection'))
  })

// 一覧の「展示室で見る」: 展示室までスクロールして、その石に寄る
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    hall.scrollIntoView({ behavior: 'smooth' })
    open(gems[Number(button.dataset.view)])
  })
})

// ドラッグ(視点操作)とクリックを区別する
let down = null
canvas.addEventListener('pointerdown', (event) => {
  down = { x: event.clientX, y: event.clientY }
})
canvas.addEventListener('pointerup', (event) => {
  if (!down) return
  const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
  down = null
  if (moved > 6) return
  const gem = gallery.pick(event.clientX, event.clientY)
  if (gem) toggle(gem)
})
canvas.addEventListener('pointermove', (event) => {
  canvas.style.cursor = gallery.pick(event.clientX, event.clientY) ? 'pointer' : ''
})
