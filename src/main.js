import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import gsap from 'gsap'

const canvas = document.querySelector('#c')

// シーン・カメラ・レンダラー
const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
)
camera.position.set(0, 4.2, 10)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.6
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.target.set(0, 1.4, 0)
controls.minDistance = 4.5
controls.maxDistance = 18
controls.maxPolarAngle = Math.PI / 2 - 0.03 // 台座の下を覗けないようにする

const clock = new THREE.Clock()

// 空と台座のテクスチャ(いずれもPoly HavenのCC0素材)
const textureLoader = new THREE.TextureLoader()

new RGBELoader().load('/textures/kloppenheim_06_puresky_1k.hdr', (skyTexture) => {
  skyTexture.mapping = THREE.EquirectangularReflectionMapping
  scene.background = skyTexture
  scene.environment = skyTexture
  // 背景として直接目に映る明るさだけを抑える(宝石の環境反射には影響しない)
  scene.backgroundIntensity = 0.5
})

// 遠くをうっすら霞ませて奥行きを出す(台座や宝石には影響しない距離に設定)
scene.fog = new THREE.Fog(0xd8e3ee, 24, 60)

const floorTexture = textureLoader.load('/textures/marble_01_diff_1k.jpg')
floorTexture.colorSpace = THREE.SRGBColorSpace
floorTexture.wrapS = THREE.RepeatWrapping
floorTexture.wrapT = THREE.RepeatWrapping
floorTexture.repeat.set(4, 4)

// 空に浮かぶ展示プラットフォーム
const platformRadius = 6
const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(platformRadius, platformRadius * 1.08, 0.6, 64),
  new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.85,
    metalness: 0.1,
  }),
)
platform.position.y = -0.3
platform.receiveShadow = true
scene.add(platform)

// 台座の縁を淡く光らせるリング
const rim = new THREE.Mesh(
  new THREE.TorusGeometry(platformRadius, 0.05, 16, 128),
  new THREE.MeshStandardMaterial({
    color: 0xffe9b3,
    emissive: 0xffcf87,
    emissiveIntensity: 1.3,
    metalness: 0.3,
    roughness: 0.4,
  }),
)
rim.rotation.x = Math.PI / 2
scene.add(rim)

// プラットフォームの下に雲のような霞を敷いて浮遊感を出す
const mist = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 46),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
)
mist.rotation.x = -Math.PI / 2
mist.position.y = -3.4
scene.add(mist)

// ライティング
const ambient = new THREE.AmbientLight(0xffffff, 0.55)

const key = new THREE.DirectionalLight(0xfff4de, 1.1)
key.position.set(6, 10, 6)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.near = 0.5
key.shadow.camera.far = 30
key.shadow.camera.left = -8
key.shadow.camera.right = 8
key.shadow.camera.top = 8
key.shadow.camera.bottom = -8

const fill = new THREE.DirectionalLight(0xbcd4ff, 0.4)
fill.position.set(-6, 4, -4)

scene.add(ambient, key, fill)

// ポストプロセス(Bloom)で宝石の輝きを強調する
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,
  0.4,
  1.0,
)
composer.addPass(bloomPass)

// クリック判定(レイキャスト)用の準備
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const pickTargets = []

let hovered = null
let selected = null

// マテリアルを配列/単体どちらでも扱えるようにする
const getMaterials = (mesh) => {
  if (!mesh?.material) return []
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

const resetMaterialEmissive = (material) => {
  if (!material?.emissive?.isColor) return
  const base = material.userData?.baseEmissive
  material.emissive.setHex(typeof base === 'number' ? base : 0x000000)
}

const setMaterialEmissive = (material, color) => {
  if (!material?.emissive?.isColor) return
  if (typeof material.userData.baseEmissive !== 'number') {
    material.userData.baseEmissive = material.emissive.getHex()
  }
  material.emissive.setHex(color)
}

const resetEmissive = (mesh) => {
  if (!mesh) return
  getMaterials(mesh).forEach(resetMaterialEmissive)
}

const applyHighlight = (mesh) => {
  if (!mesh) return
  const color = mesh === selected ? 0x66e0ff : 0x335577
  getMaterials(mesh).forEach((material) => setMaterialEmissive(material, color))
}

const setPointerFromEvent = (event) => {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

const pick = () => {
  raycaster.setFromCamera(pointer, camera)
  return raycaster.intersectObjects(pickTargets, false)[0]?.object ?? null
}

// クリックされたメッシュから、宝石グループ(userData.gem)を遡って探す
const findGem = (mesh) => {
  let node = mesh
  while (node && !node.userData?.gem) {
    node = node.parent
  }
  return node?.userData?.gem ?? null
}

renderer.domElement.addEventListener('pointermove', (event) => {
  setPointerFromEvent(event)
  const hit = pick()

  if (hit !== hovered) {
    if (hovered && hovered !== selected) resetEmissive(hovered)
    hovered = hit
    if (hovered && hovered !== selected) applyHighlight(hovered)
  }
})

renderer.domElement.addEventListener('pointerdown', (event) => {
  setPointerFromEvent(event)
  const hit = pick()

  if (selected && selected !== hit) {
    resetEmissive(selected)
    if (selected === hovered) applyHighlight(selected)
  }

  selected = hit
  applyHighlight(selected)

  const gem = findGem(hit)
  if (gem) toggleLevitate(gem)
})

renderer.domElement.addEventListener('pointerleave', () => {
  if (hovered && hovered !== selected) resetEmissive(hovered)
  hovered = null
})

// モデルの中心を原点へ寄せ、指定サイズに正規化する
const fitModelAtOrigin = (model, targetSize) => {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)

  const size = box.getSize(new THREE.Vector3())
  const maxAxis = Math.max(size.x, size.y, size.z) || 1
  model.scale.setScalar(targetSize / maxAxis)

  box.setFromObject(model)
  model.position.y -= box.min.y
}

// GLBの元マテリアルを、透過(transmission)とクリアコートを持つ宝石らしい質感に差し替える
const applyGemMaterial = (model, color) => {
  const buildMaterial = () =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.92,
      thickness: 0.6,
      ior: 1.8,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.2,
    })

  model.traverse((child) => {
    if (!child.isMesh) return
    child.material = Array.isArray(child.material)
      ? child.material.map(buildMaterial)
      : buildMaterial()
  })
}

const registerPickTargets = (root) => {
  root.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    pickTargets.push(child)
  })
}

// 台座の上に出現するリビール演出(下から浮き上がりつつスケールインする)
const revealModel = (model, delay) => {
  const targetScale = model.scale.clone()
  model.position.y -= 0.8
  model.scale.setScalar(0.001)

  // フェード対象のマテリアルを重複なく集めておく(同一マテリアルを複数メッシュが共有していても二重にアニメーションしないため)
  const materials = new Set()
  model.traverse((child) => {
    if (!child.isMesh) return
    getMaterials(child).forEach((material) => {
      material.transparent = true
      material.opacity = 0
      materials.add(material)
    })
  })

  const timeline = gsap.timeline({ delay })
  timeline.to(model.position, { y: '+=0.8', duration: 1.1, ease: 'power3.out' })
  timeline.to(
    model.scale,
    { x: targetScale.x, y: targetScale.y, z: targetScale.z, duration: 1, ease: 'back.out(1.6)' },
    '<',
  )
  // マテリアルごとに直接opacityをアニメーションする(timeline.progress()を代入する書き方だと、
  // このトゥイーンより長い他のトゥイーンがある場合に1へ到達しないまま止まってしまうため使わない)
  materials.forEach((material) => {
    timeline.to(material, { opacity: 1, duration: 0.9, ease: 'power2.out' }, '<')
  })
}

// 展示する4つの宝石(すべてQuaternius氏によるCC0/パブリックドメインの3Dモデル)
const gemDefs = [
  { url: '/models/gem_blue.glb', color: 0x66c7ff, size: 1.2 },
  { url: '/models/gem_green.glb', color: 0x7be6a8, size: 1.2 },
  { url: '/models/gem_pink.glb', color: 0xff9fe0, size: 1.2 },
  { url: '/models/big_crystal.glb', color: 0xdcd0ff, size: 1.7 },
]

const arrangementRadius = 3.2
const pedestalHeight = 1.0
const gltfLoader = new GLTFLoader()
const gems = []

gemDefs.forEach((def, index) => {
  const angle = (index / gemDefs.length) * Math.PI * 2
  const x = Math.cos(angle) * arrangementRadius
  const z = Math.sin(angle) * arrangementRadius

  // 台座(表面に薄いクリアコートを乗せて艶を出す)
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, pedestalHeight, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0x4a4552,
      roughness: 0.6,
      metalness: 0.2,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
    }),
  )
  pedestal.position.set(x, pedestalHeight / 2, z)
  pedestal.castShadow = true
  pedestal.receiveShadow = true
  scene.add(pedestal)

  // 宝石ごとの色で台座を灯すスポットライト
  const light = new THREE.PointLight(def.color, 1.4, 6, 2)
  light.position.set(x, pedestalHeight + 1.1, z)
  scene.add(light)

  const gem = {
    def,
    baseY: pedestalHeight,
    baseIntensity: 1.4,
    phase: index * 1.7,
    raised: false,
    model: null,
    light,
  }
  gems.push(gem)

  gltfLoader.load(
    def.url,
    (gltf) => {
      const model = gltf.scene
      fitModelAtOrigin(model, def.size)
      model.position.set(x, pedestalHeight, z)
      model.userData.gem = gem
      gem.model = model

      applyGemMaterial(model, def.color)
      scene.add(model)
      registerPickTargets(model)
      revealModel(model, 0.2 + index * 0.18)
    },
    undefined,
    (error) => {
      console.error(`宝石モデルの読み込みに失敗しました: ${def.url}`, error)
    },
  )
})

// クリックした宝石を持ち上げて回転させる/元に戻す
const toggleLevitate = (gem) => {
  if (!gem.model) return
  gem.raised = !gem.raised

  gsap.to(gem.model.position, {
    y: gem.raised ? gem.baseY + 0.9 : gem.baseY,
    duration: 0.9,
    ease: 'power2.inOut',
  })
  gsap.to(gem.model.rotation, {
    y: gem.model.rotation.y + Math.PI * 2,
    duration: 0.9,
    ease: 'power2.inOut',
  })
  gsap.to(gem, {
    baseIntensity: gem.raised ? 1.9 : 1.4,
    duration: 0.9,
    ease: 'power2.inOut',
  })
}

// 空気感を出す浮遊パーティクル
const particleCount = 500
const particleGeometry = new THREE.BufferGeometry()
const particlePositions = new Float32Array(particleCount * 3)
const particleColors = new Float32Array(particleCount * 3)

for (let i = 0; i < particleCount; i += 1) {
  const i3 = i * 3
  const radius = 2 + Math.random() * 9
  const theta = Math.random() * Math.PI * 2
  particlePositions[i3] = Math.cos(theta) * radius
  particlePositions[i3 + 1] = 0.5 + Math.random() * 6
  particlePositions[i3 + 2] = Math.sin(theta) * radius

  const color = new THREE.Color().setHSL(0.12 + Math.random() * 0.08, 0.6, 0.85)
  particleColors[i3] = color.r
  particleColors[i3 + 1] = color.g
  particleColors[i3 + 2] = color.b
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

// 各粒子の基準位置と揺れの位相(漂う動きに使う)
const particleBasePositions = particlePositions.slice()
const particlePhases = new Float32Array(particleCount)
for (let i = 0; i < particleCount; i += 1) {
  particlePhases[i] = Math.random() * Math.PI * 2
}

const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
)
scene.add(particles)

// カメラの導入アニメーション
gsap.fromTo(
  camera.position,
  { x: 0, y: 6.5, z: 15 },
  { x: 0, y: 4.2, z: 10, duration: 2, ease: 'power2.out' },
)

// アニメーションループ
function animate() {
  requestAnimationFrame(animate)

  const elapsed = clock.getElapsedTime()
  controls.update()

  gems.forEach((gem) => {
    if (gem.model) gem.model.rotation.y += 0.006
    gem.light.intensity = gem.baseIntensity + Math.sin(elapsed * 1.6 + gem.phase) * 0.3
  })

  particles.rotation.y = elapsed * 0.015

  // 各粒子を基準位置から緩やかに漂わせ、空気の流れ感を出す
  const positionsArray = particleGeometry.attributes.position.array
  for (let i = 0; i < particleCount; i += 1) {
    const i3 = i * 3
    const phase = particlePhases[i]
    positionsArray[i3] = particleBasePositions[i3] + Math.sin(elapsed * 0.4 + phase) * 0.4
    positionsArray[i3 + 1] = particleBasePositions[i3 + 1] + Math.sin(elapsed * 0.3 + phase * 1.3) * 0.3
    positionsArray[i3 + 2] = particleBasePositions[i3 + 2] + Math.cos(elapsed * 0.4 + phase) * 0.4
  }
  particleGeometry.attributes.position.needsUpdate = true

  composer.render()
}

// ウィンドウサイズが変わったらカメラ・レンダラー・ポストプロセスを更新
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  composer.setSize(window.innerWidth, window.innerHeight)
})

animate()
