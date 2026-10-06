import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import gsap from 'gsap'

// 展示品の情報(名前・数値はすべて架空の標本として設定)
export const GEMS = [
  {
    id: 'blue',
    url: '/models/gem_blue.glb',
    color: 0x66c7ff,
    hue: '#66c7ff',
    size: 1.2,
    name: '空澄',
    reading: 'そらすみ',
    text: '晴れた日の高い空の青を、そのまま閉じ込めたような石。細長い柱の面が光を受けると、内側から淡い青が広がります。',
    specs: [
      ['硬度', '9.0'],
      ['屈折率', '1.77'],
      ['比重', '4.00'],
    ],
  },
  {
    id: 'green',
    url: '/models/gem_green.glb',
    color: 0x7be6a8,
    hue: '#7be6a8',
    size: 1.2,
    name: '若葉雫',
    reading: 'わかばしずく',
    text: '雨上がりの若葉に残るしずくの緑。丸くカットされた面が並び、角度を変えるたびに明るい緑と深い緑が入れ替わります。',
    specs: [
      ['硬度', '7.5'],
      ['屈折率', '1.58'],
      ['比重', '2.72'],
    ],
  },
  {
    id: 'pink',
    url: '/models/gem_pink.glb',
    color: 0xff9fe0,
    hue: '#ff9fe0',
    size: 1.2,
    name: '桜影',
    reading: 'さくらかげ',
    text: '花びらの影のような、やわらかい桃色。四角錐の面が光を集め、先端がほのかに白く光ります。',
    specs: [
      ['硬度', '7.0'],
      ['屈折率', '1.63'],
      ['比重', '3.06'],
    ],
  },
  {
    id: 'crystal',
    url: '/models/big_crystal.glb',
    color: 0xdcd0ff,
    hue: '#dcd0ff',
    size: 1.7,
    name: '夕紫群晶',
    reading: 'ゆうむらさきぐんしょう',
    text: '夕暮れの空の薄紫をまとった結晶の群れ。いくつもの柱が寄り集まった、展示室でいちばん大きな標本です。',
    specs: [
      ['硬度', '7.0'],
      ['屈折率', '1.55'],
      ['比重', '2.65'],
    ],
  },
]

const PEDESTAL_HEIGHT = 1.0
const RING_RADIUS = 3.2
const RAISE = 0.9

const gemMaterial = (color) =>
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

export function createGallery(canvas) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.6
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xcdd9e6)
  scene.fog = new THREE.Fog(0xd8e3ee, 24, 60)

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  camera.position.set(0, 4.2, 10)
  const lookTarget = new THREE.Vector3(0, 1.4, 0)

  // 空のHDRは展示室とカードの両方で使うので、読み込み完了をPromiseで受け取れるようにする
  const skyReady = new Promise((resolve) => {
    new RGBELoader().load('/textures/kloppenheim_06_puresky_1k.hdr', (sky) => {
      sky.mapping = THREE.EquirectangularReflectionMapping
      scene.background = sky
      scene.environment = sky
      scene.backgroundIntensity = 0.5
      resolve(sky)
    })
  })

  const floor = new THREE.TextureLoader().load('/textures/marble_01_diff_1k.jpg')
  floor.colorSpace = THREE.SRGBColorSpace
  floor.wrapS = THREE.RepeatWrapping
  floor.wrapT = THREE.RepeatWrapping
  floor.repeat.set(4, 4)

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6 * 1.08, 0.6, 64),
    new THREE.MeshStandardMaterial({ map: floor, roughness: 0.85, metalness: 0.1 }),
  )
  platform.position.y = -0.3
  platform.receiveShadow = true
  scene.add(platform)

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.05, 16, 128),
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

  // 霞は円形にして、霧がかかっても四角い輪郭が出ないようにする
  const mist = new THREE.Mesh(
    new THREE.CircleGeometry(22, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false }),
  )
  mist.rotation.x = -Math.PI / 2
  mist.position.y = -3.4
  scene.add(mist)

  const key = new THREE.DirectionalLight(0xfff4de, 1.1)
  key.position.set(6, 10, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { near: 0.5, far: 30, left: -8, right: 8, top: 8, bottom: -8 })
  scene.add(new THREE.AmbientLight(0xffffff, 0.55), key)
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.4)
  fill.position.set(-6, 4, -4)
  scene.add(fill)

  const loader = new GLTFLoader()
  const pickTargets = []
  // clone()がuserDataをJSONで複製するため、メッシュと宝石の対応はuserDataではなくMapで持つ
  const gemByMesh = new Map()

  const gems = GEMS.map((def, index) => {
    const angle = (index / GEMS.length) * Math.PI * 2
    const x = Math.cos(angle) * RING_RADIUS
    const z = Math.sin(angle) * RING_RADIUS

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.65, PEDESTAL_HEIGHT, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x4a4552,
        roughness: 0.6,
        metalness: 0.2,
        clearcoat: 0.25,
        clearcoatRoughness: 0.35,
      }),
    )
    pedestal.position.set(x, PEDESTAL_HEIGHT / 2, z)
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    scene.add(pedestal)

    const light = new THREE.PointLight(def.color, 1.4, 6, 2)
    light.position.set(x, PEDESTAL_HEIGHT + 1.1, z)
    scene.add(light)

    // 宝石は底の中心を原点にしたpivotに入れ、回転と上下移動をpivotで行う
    const pivot = new THREE.Group()
    pivot.position.set(x, PEDESTAL_HEIGHT, z)
    scene.add(pivot)

    const gem = {
      ...def,
      index,
      pivot,
      light,
      lightBase: 1.4,
      phase: index * 1.7,
      center: new THREE.Vector3(x, PEDESTAL_HEIGHT + def.size / 2, z),
      dir: new THREE.Vector3(x, 0, z).normalize(),
      materials: [],
    }

    let markReady
    gem.ready = new Promise((resolve) => {
      markReady = resolve
    })

    loader.load(
      def.url,
      (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const middle = box.getCenter(new THREE.Vector3())
        const scale = def.size / Math.max(size.x, size.y, size.z)
        model.position.set(-middle.x * scale, -box.min.y * scale, -middle.z * scale)
        model.traverse((child) => {
          if (!child.isMesh) return
          child.material = gemMaterial(def.color)
          child.castShadow = true
          gemByMesh.set(child, gem)
          gem.materials.push(child.material)
          pickTargets.push(child)
        })
        pivot.add(model)
        gem.model = model
        gem.modelScale = scale
        markReady()

        // 台座の中から浮き上がりつつ、大きくなりながらフェードインする
        const restY = model.position.y
        model.position.y = restY - 0.8
        model.scale.setScalar(0.001)
        gem.materials.forEach((material) => {
          material.transparent = true
          material.opacity = 0
        })

        const reveal = gsap.timeline({ delay: 0.2 + index * 0.18 })
        reveal.to(model.position, { y: restY, duration: 1.1, ease: 'power3.out' })
        reveal.to(model.scale, { x: scale, y: scale, z: scale, duration: 1, ease: 'back.out(1.6)' }, '<')
        // マテリアルごとに直接opacityをアニメーションする(timeline.progress()を代入する書き方は使わない)
        gem.materials.forEach((material) => {
          reveal.to(material, { opacity: 1, duration: 0.9, ease: 'power2.out' }, '<')
        })
      },
      undefined,
      (error) => {
        console.error(`宝石モデルの読み込みに失敗しました: ${def.url}`, error)
      },
    )

    return gem
  })

  // 空気感を出す浮遊パーティクル
  const count = 500
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const phases = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const radius = 2 + Math.random() * 9
    const theta = Math.random() * Math.PI * 2
    positions.set([Math.cos(theta) * radius, 0.5 + Math.random() * 6, Math.sin(theta) * radius], i * 3)
    const color = new THREE.Color().setHSL(0.12 + Math.random() * 0.08, 0.6, 0.85)
    colors.set([color.r, color.g, color.b], i * 3)
    phases[i] = Math.random() * Math.PI * 2
  }
  const basePositions = positions.slice()
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
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

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  const api = {
    camera,
    gems,
    lookTarget,
    controls: null,
    // 3Dが画面外にあるときは描画を止めて負荷を下げる
    paused: false,
    // クリック位置にある宝石を返す
    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(pickTargets, false)[0]
      return hit ? gemByMesh.get(hit.object) : null
    },
    // 宝石を正面から映すカメラ位置。shiftが正なら宝石は画面の右寄り、負なら左寄りに映る
    shotFor(gem, { shift = 0, distance = 3.4, drop = 0 } = {}) {
      const center = gem.center.clone()
      center.y += RAISE
      const side = new THREE.Vector3(-gem.dir.z, 0, gem.dir.x)
      const pos = center.clone().addScaledVector(gem.dir, distance).add(new THREE.Vector3(0, 0.9, 0))
      const look = center.clone().addScaledVector(side, shift)
      look.y -= drop
      return { pos, look }
    },
    // 展示品カードの位置に、宝石を1つずつ回しながら描く。
    // キャンバスは1枚だけ使い、カードごとに描く範囲(viewport/scissor)を区切って描き分ける
    async createCardViews(overlay, slots) {
      const [sky] = await Promise.all([skyReady, ...gems.map((gem) => gem.ready)])

      const viewRenderer = new THREE.WebGLRenderer({ canvas: overlay, antialias: true, alpha: true })
      viewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      viewRenderer.outputColorSpace = THREE.SRGBColorSpace
      viewRenderer.toneMapping = THREE.ACESFilmicToneMapping
      viewRenderer.toneMappingExposure = 0.7
      viewRenderer.setClearColor(0x000000, 0)

      const elevation = THREE.MathUtils.degToRad(22)

      const views = gems.map((gem, index) => {
        const stage = new THREE.Scene()
        stage.background = sky
        stage.environment = sky
        stage.backgroundIntensity = 0.45
        stage.backgroundBlurriness = 0.35
        const keyLight = new THREE.DirectionalLight(0xfff4de, 1.2)
        keyLight.position.set(3, 5, 4)
        const glow = new THREE.PointLight(gem.color, 3, 6, 2)
        glow.position.set(0, 0.8, 1.2)
        stage.add(new THREE.AmbientLight(0xffffff, 0.5), keyLight, glow)

        const copy = gem.model.clone()
        copy.scale.setScalar(gem.modelScale)
        // 展示室の出現演出の途中でも透けないよう、カード用は不透明な質感にする
        copy.traverse((child) => {
          if (!child.isMesh) return
          child.material = child.material.clone()
          child.material.opacity = 1
          child.material.transparent = false
        })

        // 見た目の中心で回るよう、中心をturntableの原点に合わせる
        const turntable = new THREE.Group()
        turntable.add(copy)
        stage.add(turntable)
        copy.position.set(0, 0, 0)
        const box = new THREE.Box3().setFromObject(copy)
        copy.position.sub(box.getCenter(new THREE.Vector3()))
        const radius = box.getSize(new THREE.Vector3()).length() / 2

        const viewCamera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 50)
        const distance = (radius / Math.sin(THREE.MathUtils.degToRad(viewCamera.fov / 2))) * 1.05
        viewCamera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance)
        viewCamera.lookAt(0, 0, 0)

        return { stage, camera: viewCamera, turntable, radius, slot: slots[index], phase: index * 0.8 }
      })

      let active = false
      const viewClock = new THREE.Clock()

      const draw = () => {
        requestAnimationFrame(draw)
        if (!active) return

        const width = overlay.clientWidth
        const height = overlay.clientHeight
        const ratio = viewRenderer.getPixelRatio()
        if (overlay.width !== Math.floor(width * ratio) || overlay.height !== Math.floor(height * ratio)) {
          viewRenderer.setSize(width, height, false)
        }

        const elapsed = viewClock.getElapsedTime()
        viewRenderer.setScissorTest(false)
        viewRenderer.clear()
        viewRenderer.setScissorTest(true)

        views.forEach((view) => {
          const rect = view.slot.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) return

          const bottom = height - rect.bottom
          viewRenderer.setViewport(rect.left, bottom, rect.width, rect.height)
          viewRenderer.setScissor(rect.left, bottom, rect.width, rect.height)
          view.camera.aspect = rect.width / rect.height
          view.camera.updateProjectionMatrix()

          if (!reducedMotion) {
            view.turntable.rotation.y = elapsed * 0.6 + view.phase
            view.turntable.position.y = Math.sin(elapsed * 1.4 + view.phase) * view.radius * 0.06
          }
          viewRenderer.render(view.stage, view.camera)
        })
      }
      requestAnimationFrame(draw)

      return {
        // 一覧が画面にあるときだけ描く
        setActive(value) {
          active = value
          if (!active) {
            viewRenderer.setScissorTest(false)
            viewRenderer.clear()
          }
        },
      }
    },
    // 宝石を持ち上げる/戻す。どちらのときも1回転させ、台座の灯りの強さも合わせて変える
    setRaised(gem, raised) {
      gsap.to(gem.pivot.position, {
        y: PEDESTAL_HEIGHT + (raised ? RAISE : 0),
        duration: 0.9,
        ease: 'power2.inOut',
        overwrite: 'auto',
      })
      gsap.to(gem.pivot.rotation, {
        y: gem.pivot.rotation.y + Math.PI * 2,
        duration: 0.9,
        ease: 'power2.inOut',
        overwrite: 'auto',
      })
      gsap.to(gem, { lightBase: raised ? 1.9 : 1.4, duration: 0.9, ease: 'power2.inOut', overwrite: 'auto' })
    },
  }

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.fov = camera.aspect < 0.8 ? 64 : 50
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  const clock = new THREE.Clock()
  const frame = () => {
    requestAnimationFrame(frame)
    if (api.paused) return

    const elapsed = clock.getElapsedTime()

    gems.forEach((gem) => {
      if (!reducedMotion) gem.pivot.rotation.y += 0.006
      gem.light.intensity = gem.lightBase + Math.sin(elapsed * 1.6 + gem.phase) * 0.3
    })

    if (!reducedMotion) {
      particles.rotation.y = elapsed * 0.015
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3
        positions[i3] = basePositions[i3] + Math.sin(elapsed * 0.4 + phases[i]) * 0.4
        positions[i3 + 1] = basePositions[i3 + 1] + Math.sin(elapsed * 0.3 + phases[i] * 1.3) * 0.3
        positions[i3 + 2] = basePositions[i3 + 2] + Math.cos(elapsed * 0.4 + phases[i]) * 0.4
      }
      particleGeometry.attributes.position.needsUpdate = true
    }

    // OrbitControlsが有効なときは任せ、演出中は注視点を直接向く
    if (api.controls?.enabled) api.controls.update()
    else camera.lookAt(lookTarget)

    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  return api
}
